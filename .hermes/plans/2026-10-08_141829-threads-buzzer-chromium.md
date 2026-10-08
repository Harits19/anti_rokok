# Threads Buzzer Bot via Chromium (Playwright) — Implementation Plan

> **For Hermes:** rencana ini ditulis dengan skill `plan`. Eksekusi task-by-task
> memakai `subagent-driven-development` (satu subagent per task + review), atau
> manual kalau kamu mau pegang sendiri.

**Goal:** Bot buzzer Threads yang menjalankan aksi akun nyata (post, reply, like,
repost, scrape feed/search) lewat UI Threads di Chromium headless — bukan lewat
API resmi/GraphQL privat.

**Architecture:** Modular monolith yang sudah ada (Bun + Express + TypeScript
strict) tetap dipakai. Tambah module `browser/` (lifecycle Chromium + session)
dan sub-layer `threads/ui/` (aksi UI: post/like/reply/repost/feed) di dalam
module `threads/` yang sudah ada. Semua aksi masuk lewat queue in-memory
sederhana + rate limiter, lalu HTTP route tipis di atasnya. Tidak ada Redis,
tidak ada microservice, tidak ada queue broker.

**Tech Stack:** Bun 1.3 (`bun:sqlite` untuk state), TypeScript strict,
Express 5, Zod 4, `playwright-core` + Chromium persistent context.

---

## 0. Peringatan (baca dulu — ini bukan disclaimer formalitas)

**Automation UI melanggar Terms of Service Meta/Threads.** Akun yang dipakai bot
berisiko dibatasi, shadowban, atau dihapus permanen. Endpoint privat Threads
(auth cookie, `lsd`, `csrftoken`) juga berubah tanpa pemberitahuan sehingga
selector dan endpoint bisa rusak kapan saja.

Konsekuensi teknis yang harus kamu terima sebelum eksekusi:

- Bot harus dibatasi volume: delay manusiawi, jitter, dan cap per jam.
- Bot tidak boleh "kejar-kejaran" — kalau rate limit kena, berhenti, jangan retry
  agresif. Retry agresif justru pemicu ban paling cepat.
- Jalankan dari 1 akun, 1 profil browser, 1 IP. Jangan paralel multi-akun dari
  mesin yang sama pada MVP.
- Semua aksi harus bisa di-`dryRun` (default) sebelum benar-benar dijalankan.

Kalau butuh operasi resmi dan stabil, jalur yang benar adalah Threads API
(`graph.threads.com`) yang sudah dipakai `src/modules/threads/service.ts`. Rencana
ini dibuat karena kamu memang memilih jalur UI automation, dan kode API + UI
akan hidup berdampingan.

---

## 1. Current Context (hasil inspeksi repo, bukan asumsi)

Fakta yang sudah diverifikasi di workspace:

- Runtime Bun 1.3.14, Node 22.14.0. Typecheck: `bun run typecheck` (tsc `--noEmit`).
- Express 5 + Zod 4 + swagger-ui-express. **Tidak ada database** saat ini
  (`src/docs/openapi.ts:10` menyebut eksplisit "Tanpa database").
- Struktur module: `src/modules/threads/{routes,service,schema,model}.ts`.
- `src/modules/threads/service.ts` memanggil Threads Graph API resmi
  (`https://graph.threads.com/v1.0`) untuk `publishText` dan `searchThreadsByKeyword`.
- `src/modules/threads/model.ts` sudah berisi type respons GraphQL privat Threads
  (`ThreadsFeedResponse`, `ThreadsPost`, `ThreadsUser`, dst.) — sisa dari client
  lama, masih berguna untuk parsing hasil scrape.
- Commit `3d207dc` menghapus `src/modules/threads/client.ts`: client fetch-based
  yang memakai cookie + `x-fb-lsd` + `doc_id` hardcoded ke
  `https://www.threads.com/graphql/query`. Ini pendekatan yang **ditinggalkan**
  dan digantikan UI automation.
- `.env.example` sudah punya `THREADS_COOKIE`, `THREADS_CSRF_TOKEN`, `THREADS_LSD`,
  dan `.env` memang mengisinya → token privat ini **sudah tidak dipakai lagi**
  setelah client dihapus. Rencana ini menghapus ketergantungan itu (session
  dipegang oleh profil Chromium, bukan string di env).
- `src/app.ts:44` memanggil `startKeywordSearch()` saat app dibuat → pola lama
  polling 5 menit. Ini perlu dirapikan (lihat Task 10).
- `src/config/env.ts` sudah memvalidasi env dengan Zod dan fail-fast.
- `src/shared/logger.ts` = `Logger` class (`info/warn/error`), dipakai lewat
  `new Logger(namaFungsi)`. **Pakai ini, jangan `console.log` baru.**
- `src/shared/errors.ts` = `AppError` + helper `badRequest/unauthorized/notFound/conflict/serviceUnavailable`.
- Playwright browser **sudah ter-cache di mesin**:
  `~/Library/Caches/ms-playwright/chromium-1243` (+ `chromium_headless_shell-1243`).
  Artinya kita tidak perlu unduh Chromium besar; cukup pasang paketnya.
- Google Chrome asli juga ada di `/Applications/Google Chrome.app` → bisa dipakai
  sebagai `channel: "chrome"` (fingerprint lebih wajar daripada Chromium bundle).
- Tidak ada test runner terpasang. Bun punya `bun:test` bawaan → tidak perlu
  install vitest/jest.

Konsekuensi desain dari fakta di atas:

1. Session login **tidak** disimpan di `.env`. Disimpan di profil Chromium
   persisten (`storageState`/`userDataDir`) yang di-gitignore.
2. `THREADS_COOKIE`/`THREADS_CSRF_TOKEN`/`THREADS_LSD` di-deprecate (dibiarkan ada
   tapi tidak dipakai, atau dihapus di task cleanup).
3. Semua selector UI dikumpulkan di satu file supaya perbaikan saat Threads ganti
   markup hanya menyentuh satu tempat.
4. Tablet state (post yang sudah di-like/comment) butuh persistence → pakai
   `bun:sqlite` (file kecil, tanpa ORM, sesuai prinsip simplicity project).

---

## 2. Arsitektur yang Diusulkan

```
HTTP route (existing pattern)
      │  zod validate
      ▼
threads/service.ts  ──────────────►  (existing) Graph API resmi
      │
      ▼
threads/ui/*.ts   (aksi UI: post, reply, like, repost, feed)
      │  pakai
      ▼
browser/session.ts  ──► browser/launcher.ts  (Chromium persistent context)
      │                        │
      │                        └── userDataDir: .data/chromium-profile/
      ▼
browser/rate-limit.ts   (delay manusiawi + cap per jam)
browser/queue.ts        (serial in-memory, 1 worker, backpressure)
store/sqlite.ts         (bun:sqlite: action_log, seen_post, session_state)
```

Prinsip:

- **Satu browser context, satu worker.** Aksi UI dijalankan serial. Paralel =
  cepat ban. Queue FIFO cukup untuk MVP.
- **Semua aksi lewat satu pintu**: `runAction(kind, payload)` di queue → itu
  tempat rate limit, dryRun, logging, dan retry policy dipegang.
- **Pure logic dipisah dari UI** (rate-limit math, dedupe, cooldown) supaya bisa
  diuji dengan `bun:test` tanpa menyalakan browser. Ini yang membuat "TDD"
  realistis untuk automation.

---

## 3. Struktur File Baru / Berubah

Baru:

```
src/browser/launcher.ts          # launch Chromium persistent context
src/browser/session.ts           # pastikan login, storageState, health
src/browser/rate-limit.ts        # hitung delay + cap per jam (pure, testable)
src/browser/queue.ts             # serial queue + runAction()
src/browser/dry-run.ts           # gerbang dryRun
src/scripts/threads-login.ts     # login manual sekali (headed), simpan profil
src/store/sqlite.ts              # buka db, ensure schema
src/store/schema.sql             # DDL tabel
src/modules/threads/ui/selectors.ts   # semua selector Threads (satu sumber)
src/modules/threads/ui/post.ts
src/modules/threads/ui/like.ts
src/modules/threads/ui/reply.ts
src/modules/threads/ui/repost.ts
src/modules/threads/ui/feed.ts        # scrape feed + search
src/modules/threads/ui/types.ts       # ActionResult, dst.
tests/rate-limit.test.ts
tests/dedupe.test.ts
```

Berubah:

```
package.json                         # script login:threads, deps playwright-core
.gitignore                           # .data/
src/config/env.ts                    # + BROWSER_* , THREADS_PROFILE_DIR, DRY_RUN
src/modules/threads/service.ts       # ekspos post/reply/like/repost via UI
src/modules/threads/routes.ts        # + endpoint baru
src/modules/threads/schema.ts        # + zod input baru
src/modules/threads/model.ts         # (opsional) tambah type hasil scrape
src/docs/openapi.ts                  # dokumentasikan endpoint baru
src/app.ts                           # wiring + start worker, bukan startKeywordSearch()
```

---

## 4. Env Baru (`src/config/env.ts` + `.env.example`)

```ts
// tambahan ke envSchema
THREADS_PROFILE_DIR: z.string().default(".data/chromium-profile"),
BROWSER_HEADLESS: z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true"),
BROWSER_CHANNEL: z.enum(["chrome", "chromium"]).default("chrome"),
BROWSER_SLOWMO_MS: z.coerce.number().int().min(0).default(120),
DRY_RUN: z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true"),
// rate limit
ACTION_MIN_DELAY_MS: z.coerce.number().int().positive().default(45_000),
ACTION_MAX_DELAY_MS: z.coerce.number().int().positive().default(150_000),
ACTION_MAX_PER_HOUR: z.coerce.number().int().positive().default(20),
```

`.env.example`:

```
# Browser automation (Chromium)
THREADS_PROFILE_DIR=.data/chromium-profile
BROWSER_HEADLESS=true
BROWSER_CHANNEL=chrome
BROWSER_SLOWMO_MS=120
# true = tidak benar-benar klik apa pun (hanya log rencana aksi)
DRY_RUN=true
ACTION_MIN_DELAY_MS=45000
ACTION_MAX_DELAY_MS=150000
ACTION_MAX_PER_HOUR=20
```

Catatan `DRY_RUN` default **true** itu disengaja: setelah `bun run dev`, tidak ada
aksi destruktif sampai kamu eksplisit mengubahnya.

---

## 5. Rencana Task (bite-sized, urut)

### Task 1: Pasang dependency browser

**Objective:** Tambah `playwright-core` dan pakai Chromium yang sudah ter-cache.

**Files:**
- Modify: `package.json`

**Step 1:** `bun add playwright-core`
**Step 2:** Verifikasi Chromium bisa diluncurkan:

```bash
bun -e 'import {chromium} from "playwright-core"; const b=await chromium.launch({channel:"chrome"}); console.log("ok", b.version()); await b.close();'
```

Expected: `ok 1xx.x.x` (angka versi), tanpa error.

**Step 3:** Tambah script login:

```json
"login:threads": "bun src/scripts/threads-login.ts"
```

**Step 4:** Commit: `chore: add playwright-core for chromium automation`

> Kalau `channel:"chrome"` gagal (Chrome tidak ada di PATH), fallback
> `channel:"chromium"` + `executablePath` ke cache ms-playwright.

---

### Task 2: Env baru + validasi

**Objective:** Env bertipe untuk browser & rate limit, fail-fast seperti env lain.

**Files:**
- Modify: `src/config/env.ts`, `.env.example`, `.gitignore`

**Step 1:** Tambahkan blok env dari bagian 4.
**Step 2:** Tambah `.data/` ke `.gitignore` (profil Chromium berisi cookie login —
**jangan pernah** di-commit).
**Step 3:** Run: `bun run typecheck` → Expected: exit 0.
**Step 4:** Run: `bun run start` → Expected: server jalan, log env valid.
**Step 5:** Commit: `feat: add browser automation env config`

---

### Task 3: Store SQLite (dedupe + log aksi)

**Objective:** Simpan state minimal supaya bot tidak mengulang aksi yang sama.

**Files:**
- Create: `src/store/schema.sql`, `src/store/sqlite.ts`
- Create: `tests/dedupe.test.ts`

Tabel:

```sql
CREATE TABLE IF NOT EXISTS action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- post | reply | like | repost
  target_id TEXT,                -- post id / permalink
  payload TEXT,                  -- JSON
  status TEXT NOT NULL,          -- planned | done | failed | skipped
  error TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS seen_post (
  post_id TEXT PRIMARY KEY,
  permalink TEXT,
  acted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
```

**Step 1 (test dulu):**

```ts
// tests/dedupe.test.ts
import { test, expect, beforeEach } from "bun:test";
import { openStore } from "../src/store/sqlite";

let store: ReturnType<typeof openStore>;
beforeEach(() => {
  store = openStore(":memory:", { migrate: true });
});

test("post yang sudah terlihat tidak diproses dua kali", () => {
  expect(store.hasSeen("123")).toBe(false);
  store.markSeen("123", "https://www.threads.com/@a/post/123");
  expect(store.hasSeen("123")).toBe(true);
});

test("hitung aksi per jam", () => {
  const now = 1_000_000;
  store.recordAction("like", { postId: "1" }, "done", now);
  store.recordAction("like", { postId: "2" }, "done", now + 1000);
  expect(store.countActionsSince(now - 1)).toBe(2);
});
```

**Step 2:** `bun test tests/dedupe.test.ts` → Expected: FAIL (`openStore` belum ada).
**Step 3:** Implement `openStore(path, {migrate})` memakai `bun:sqlite` dengan
method: `migrate()`, `hasSeen`, `markSeen`, `recordAction`, `finishAction`,
`countActionsSince`, `close`.
**Step 4:** `bun test tests/dedupe.test.ts` → Expected: PASS (2 pass).
**Step 5:** `bun run typecheck` → Expected: exit 0.
**Step 6:** Commit: `feat: add sqlite store for dedupe and action log`

> `openStore(":memory:")` untuk test, `openStore(".data/bot.sqlite")` untuk
> runtime. Satu fungsi, dua mode — tidak perlu DI container.

---

### Task 4: Rate limiter (pure, teruji)

**Objective:** Delay manusiawi acak + cap per jam, dipisah dari UI supaya bisa diuji.

**Files:**
- Create: `src/browser/rate-limit.ts`, `tests/rate-limit.test.ts`

Kontrak:

```ts
export function nextDelayMs(args: {
  min: number; max: number; rand?: () => number;
}): number;

export function canActNow(actionsInWindow: number, maxPerHour: number): boolean;

export function windowExpired(windowStart: number, now: number, windowMs?: number): boolean;
```

**Step 1:** Tulis test di `tests/rate-limit.test.ts`:

```ts
test("delay selalu dalam rentang min..max", () => {
  for (const r of [0, 0.5, 0.999]) {
    const d = nextDelayMs({ min: 1000, max: 5000, rand: () => r });
    expect(d).toBeGreaterThanOrEqual(1000);
    expect(d).toBeLessThanOrEqual(5000);
  }
});

test("cap per jam memblokir aksi ke-21", () => {
  expect(canActNow(19, 20)).toBe(true);
  expect(canActNow(20, 20)).toBe(false);
});
```

**Step 2:** `bun test tests/rate-limit.test.ts` → Expected: FAIL.
**Step 3:** Implement (`rand` injectable → deterministic di test, `Math.random` di prod).
**Step 4:** `bun test tests/rate-limit.test.ts` → Expected: PASS (2 pass).
**Step 5:** Commit: `feat: add human-like rate limiter`

---

### Task 5: Chromium launcher (persistent context)

**Objective:** Satu fungsi yang membuka Chromium dengan profil persisten + config stealth dasar.

**Files:**
- Create: `src/browser/launcher.ts`

Kontrak:

```ts
export async function launchContext(): Promise<{
  context: BrowserContext;
  close: () => Promise<void>;
}>;
```

Detail yang wajib ada:

- `chromium.launchPersistentContext(env.THREADS_PROFILE_DIR, {...})`.
- `headless: env.BROWSER_HEADLESS`, `channel: env.BROWSER_CHANNEL`,
  `slowMo: env.BROWSER_SLOWMO_MS`.
- `viewport: { width: 1280, height: 900 }` (bukan ukuran default headless).
- `locale: "id-ID"`, `timezoneId: "Asia/Jakarta"` — konsisten dengan akun.
- Argumen minimal: `["--disable-blink-features=AutomationControlled"]`.
- `userAgent` **tidak** di-hardcode; biarkan Chrome asli (channel chrome sudah wajar).
- `mkdir -p` profil dir sebelum launch (`Bun.write`/`fs.mkdir`).
- Simpan `context` singleton di module scope supaya aksi berurutan memakai
  context yang sama; sediakan `getContext()` dan `closeContext()`.

**Step 1:** Tulis file.
**Step 2:** Verifikasi manual:

```bash
bun -e 'import {getContext,closeContext} from "./src/browser/launcher"; const c=await getContext(); const p=await c.newPage(); await p.goto("https://www.threads.com/",{waitUntil:"domcontentloaded"}); console.log("title:", await p.title()); await closeContext();'
```

Expected: log `title: Threads` (atau judul serupa), bukan blank/error.
**Step 3:** `bun run typecheck` → exit 0.
**Step 4:** Commit: `feat: add chromium persistent context launcher`

---

### Task 6: Session + script login manual sekali

**Objective:** Login sekali secara manual (headed), lalu semua aksi berikutnya
memakai profil yang sudah tersimpan tanpa login lagi.

**Files:**
- Create: `src/browser/session.ts`, `src/scripts/threads-login.ts`

`sessions.ts`:

```ts
export async function isLoggedIn(page: Page): Promise<boolean>;
export async function ensureLoggedIn(): Promise<void>; // throw unauthorized() kalau belum
```

Deteksi login: buka `https://www.threads.com/`, cek keberadaan elemen composer
atau tombol "Log in" (`selectors.ts` menyediakan `loginButton` / `composerEntry`).
Kalau URL mengandung `/login` → belum login.

`threads-login.ts`:

1. `headless: false` paksa (butuh interaksi manusia).
2. Buka `https://www.threads.com/login`.
3. Tunggu user login manual (username/password/2FA) — poll tiap 2 detik sampai
   `isLoggedIn()` true atau timeout 5 menit.
4. Log sukses, `close()` (profil tersimpan di `THREADS_PROFILE_DIR`).

**Step 1:** Implement kedua file.
**Step 2:** Run: `bun run login:threads` → login manual di window yang muncul →
Expected: log `Login terdeteksi, profil tersimpan`.
**Step 3:** Verifikasi session headless:

```bash
bun -e 'import {ensureLoggedIn} from "./src/browser/session"; await ensureLoggedIn(); console.log("session ok"); process.exit(0);'
```

Expected: `session ok`. Kalau `503/401` dari `unauthorized()` → ulangi langkah 2.
**Step 4:** Commit: `feat: add threads session check and manual login script`

> **Jangan** tambahkan login otomatis pakai password. Menyimpan password akun di
> file/kode adalah risiko keamanan yang tidak sebanding; login manual sekali ini
> sudah cukup dan jauh lebih aman.

---

### Task 7: Selectors — satu sumber kebenaran

**Objective:** Semua selector Threads terkumpul di satu file, mudah diperbaiki saat markup berubah.

**Files:**
- Create: `src/modules/threads/ui/selectors.ts`, `src/modules/threads/ui/types.ts`

Prinsip:

- Utamakan selektor berbasis `role` + `accessible name`
  (`getByRole("button", { name: /post|kirim/i })`) — lebih tahan perubahan kelas CSS.
- Sediakan fallback `data-testid` **hanya jika** ada.
- Setiap selector diberi komentar kondisi terakhir kali diverifikasi.
- Jangan pakai indeks arbitrer (`nth(3)`) kecuali tidak ada pilihan lain, dan
  kalau terpaksa, tulis alasannya.

Isi minimal (contoh, sesuaikan saat inspeksi UI nyata):

```ts
export const selectors = {
  composerEntry: (p: Page) => p.getByRole("button", { name: /mulai thread baru|new thread|what's new/i }),
  composerBox: (p: Page) => p.getByRole("textbox"),
  publishButton: (p: Page) => p.getByRole("button", { name: /^post$|^kirim$|^publish$/i }),
  likeButton: (p: Page) => p.getByRole("button", { name: /suka|like/i }),
  replyButton: (p: Page) => p.getByRole("button", { name: /balas|reply/i }),
  repostButton: (p: Page) => p.getByRole("button", { name: /repost|reposting/i }),
  postRoot: (p: Page) => p.locator('div[data-pressable-container="true"]'),
  permalinkAnchor: (p: Page) => p.locator('a[href*="/post/"]'),
} as const;
```

**Step 1:** Isi `selectors.ts` + `types.ts` (`ActionResult`, `UiActionKind`).
**Step 2:** Inspeksi nyata **wajib**: buka Threads headed, devtool, konfirmasi
setiap selector benar-benar match. Jangan asal tulis. Catat tanggal verifikasi.
**Step 3:** `bun run typecheck` → exit 0.
**Step 4:** Commit: `feat: add threads ui selectors`

> Task ini kemungkinan butuh iterasi. Anggap selektor sebagai kode yang akan
> sering dibetulkan, bukan sekali jadi.

---

### Task 8: Aksi `post` (tulis thread baru)

**Objective:** Post teks ke Threads lewat composer UI.

**Files:**
- Create: `src/modules/threads/ui/post.ts`

Kontrak:

```ts
export async function postText(page: Page, text: string): Promise<ActionResult>;
```

Langkah: `goto("/")` → tunggu network idle → klik `composerEntry` → isi
`composerBox` (pakai `pressSequentially` dengan delay acak, bukan `fill`, supaya
terlihat manusia) → **verifikasi teks muncul di composer** → klik `publishButton`
→ tunggu toast/navigasi sukses → ambil permalink hasil.

Aturan:

- Kalau `DRY_RUN` true → jangan klik publish; log `[dry-run] post: "<text>"` dan return `{status:"planned"}`.
- Panjang teks divalidasi ulang (Threads ~500 char per post; potong/thread-kan
  hanya kalau kamu memang minta fitur thread — YAGNI untuk MVP, tolak > 500).
- Screenshot ke `.data/artifacts/{timestamp}-post.png` sebelum klik publish —
  wajib, ini satu-satunya bukti saat gagal.

**Step 1:** Implement.
**Step 2:** Uji dengan `DRY_RUN=true`: panggil `postText(page, "test")` → Expected:
`[dry-run]` log, tidak ada post dibuat di Threads.
**Step 3:** Uji nyata dengan `DRY_RUN=false` **satu kali** dengan teks sampah:
`"test bot <timestamp>"`. Cek di app Threads bahwa post muncul, lalu hapus manual.
**Step 4:** Commit: `feat: add threads ui post action`

---

### Task 9: Aksi `like`, `reply`, `repost`

**Objective:** Tiga aksi interaksi dasar pada post target.

**Files:**
- Create: `src/modules/threads/ui/like.ts`, `reply.ts`, `repost.ts`

Kontrak seragam:

```ts
export async function likePost(page: Page, permalink: string): Promise<ActionResult>;
export async function replyPost(page: Page, permalink: string, text: string): Promise<ActionResult>;
export async function repostPost(page: Page, permalink: string): Promise<ActionResult>;
```

Aturan wajib:

- **Idempoten.** Cek dulu status: kalau post sudah `has_liked` (aria-pressed /
  label berubah jadi "Unlike"), `likePost` return `{status:"skipped"}` dan jangan klik.
  Ini pemanggil utama dedupe + `seen_post`.
- `goto(permalink)` lalu tunggu post root render sebelum bertindak.
- Sama seperti post: screenshot sebelum klik, DRY_RUN gerbang, delay manusiawi
  sebelum klik.
- Return `ActionResult` berisi `{ kind, targetId, status, permalink?, error? }`.

**Step 1:** Implement ketiganya (bagikan helper `openPost(page, permalink)` di
`ui/feed.ts` atau helper kecil terpisah — DRY).
**Step 2:** Uji DRY_RUN untuk ketiganya → Expected: log planned, tidak ada perubahan.
**Step 3:** Uji nyata satu like pada post kamu sendiri → cek status berubah, lalu
jalankan ulang → Expected: `skipped` (bukti idempotensi).
**Step 4:** Commit: `feat: add threads ui like, reply, repost actions`

---

### Task 10: Scrape feed + search (sumber target)

**Objective:** Dapatkan daftar post target (id, permalink, author, text, like_count)
untuk di-like/reply.

**Files:**
- Create: `src/modules/threads/ui/feed.ts`
- Modify: `src/modules/threads/service.ts` (ganti `startKeywordSearch` lama)

Kontrak:

```ts
export interface ScrapedPost {
  postId: string;
  permalink: string;
  author: string;
  text: string;
  likeCount: number;
  takenAt: number;
}

export async function scrapeSearch(page: Page, keyword: string, limit: number): Promise<ScrapedPost[]>;
export async function scrapeFeed(page: Page, limit: number): Promise<ScrapedPost[]>;
```

Aturan:

- Scroll bertahap (`page.mouse.wheel` + jeda acak), stop saat `limit` tercapai
  atau tidak ada konten baru setelah 3 scroll.
- Ekstrak dari DOM yang tampil, bukan dari endpoint GraphQL privat (itu yang
  dihapus di commit `3d207dc`; jangan dihidupkan lagi).
- `postId` diambil dari `href*="/post/"` → parse. Kalau tidak ada anchor, skip post
  (jangan menebak id).
- **Hapus** `startKeywordSearch()` dari `src/app.ts:44` — digantikan worker
  periodik di Task 11. Jangan biarkan dua loop berjalan bersamaan.

**Step 1:** Implement `scrapeSearch` + `scrapeFeed`.
**Step 2:** Uji: `bun -e` panggil `scrapeSearch` keyword `"rokok"`, limit 10 →
Expected: array ≥1 item dengan permalink valid.
**Step 3:** Hapus `startKeywordSearch()` dari app.ts dan dari service.ts.
**Step 4:** Commit: `feat: scrape threads feed and search via ui`

---

### Task 11: Queue serial + worker buzzer

**Objective:** Semua aksi lewat satu worker serial dengan rate limit dan dedupe.

**Files:**
- Create: `src/browser/queue.ts`, `src/browser/dry-run.ts`
- Create: `src/modules/threads/worker.ts`
- Modify: `src/app.ts`

`queue.ts`:

```ts
export type Job = { kind: "post" | "like" | "reply" | "repost"; payload: unknown };
export function enqueue(job: Job): void;
export function queueDepth(): number;
export function startWorker(): void;   // idempotent
export function stopWorker(): Promise<void>;
```

Loop worker (satu-satunya tempat yang menyentuh browser untuk aksi):

1. Pop job → cek `canActNow(countActionsSince(now-1h), ACTION_MAX_PER_HOUR)`.
2. Kalau tidak boleh → re-queue job, tunggu sampai window reset (log jelas).
3. Cek dedupe (`hasSeen`) untuk like/reply/repost → `skipped` kalau sudah.
4. Tunggu `nextDelayMs(min,max)` + jitter.
5. Jalankan aksi UI di context singleton.
6. `recordAction(...)` planned → done/failed + `markSeen` saat sukses.
7. Kegagalan: retry maksimal **1x** dengan backoff panjang (mis. 10 menit).
   Gagal lagi → `failed`, log, lanjut. **Tidak ada retry agresif.**

`worker.ts`: loop periodik (default 15 menit, bukan 5 menit seperti versi lama)
yang melakukan `scrapeSearch` per keyword campaign, filter yang belum `hasSeen`,
lalu `enqueue` like/reply sesuai kebijakan campaign.

`app.ts`: ganti `startKeywordSearch()` → `startWorker()`; tambah
`stopWorker()` di shutdown (`src/index.ts`).

**Step 1:** Implement `dry-run.ts`, `queue.ts`, `worker.ts`.
**Step 2:** Wiring di `app.ts` + `index.ts` shutdown.
**Step 3:** Uji dengan DRY_RUN=true: jalankan server 1 menit, enqueue 3 job lewat
route, cek log urut serial + delay + `planned` di `action_log`.
**Step 4:** Cek idempotensi `startWorker()`: panggil dua kali → hanya 1 loop
(assert `queueDepth`/log tidak dobel).
**Step 5:** Commit: `feat: add serial action queue and buzzer worker`

---

### Task 12: HTTP endpoints + Zod + OpenAPI

**Objective:** Endpoint tipis supaya bot bisa dikendalikan dari luar, konsisten dengan pola yang ada.

**Files:**
- Modify: `src/modules/threads/routes.ts`, `schema.ts`, `docs/openapi.ts`

Endpoint baru (semua butuh `x-api-key` seperti `/threads/publish`):

```
POST /threads/ui/post      { text }
POST /threads/ui/like      { permalink }
POST /threads/ui/reply     { permalink, text }
POST /threads/ui/repost    { permalink }
GET  /threads/ui/search?q=&limit=
POST /threads/ui/scrape    { keyword?, limit }
GET  /threads/status       → { queueDepth, actionsLastHour, loggedIn, dryRun }
```

Route hanya melakukan: validasi Zod → `enqueue(...)` → `res.status(202).json({ queued: true })`.
Jangan jalankan aksi UI di dalam request handler (bisa menggantung request
bermenit-menit). Aksi terjadi di worker.

Update `openapiSpec` untuk semua endpoint di atas + tambah tag `threads-ui`.
Version bump ke `0.3.0`.

**Step 1:** Tambah schema Zod.
**Step 2:** Tambah route.
**Step 3:** Update OpenAPI.
**Step 4:** Uji:

```bash
curl -s localhost:8000/threads/status -H "x-api-key: $API_KEY" | jq
curl -s -XPOST localhost:8000/threads/ui/like -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' -d '{"permalink":"https://www.threads.com/@x/post/1"}' | jq
```

Expected: 200 status payload; 202 `{queued:true}`; lalu log worker memproses.
**Step 5:** Cek `/docs` menampilkan endpoint baru.
**Step 6:** Commit: `feat: add threads ui endpoints and openapi docs`

---

### Task 13: Status kesehatan + shutdown bersih

**Objective:** Bot tidak meninggalkan proses Chromium zombie.

**Files:**
- Modify: `src/index.ts`, `src/modules/threads/routes.ts`

- `GET /health` tetap. Tambah `GET /threads/status` (sudah di Task 12).
- Di `shutdown()`: `await stopWorker(); await closeContext();` sebelum
  `listen.close()`. Timeout 5 detik yang sudah ada dipertahankan.
- Pastikan `closeContext()` juga memanggil `context.close()` supaya profil tidak
  terkunci (`SingletonLock`) saat restart.

**Step 1:** Implement.
**Step 2:** Uji: jalankan server, `Ctrl+C`, lalu `bun run start` lagi →
Expected: tidak ada error lock profil, Chromium tidak nyangkut
(`pgrep -fl "Google Chrome"` sebelum/sesudah).
**Step 3:** Commit: `fix: clean chromium shutdown on sigint`

---

### Task 14: Cleanup env privat lama + dokumentasi

**Objective:** Buang sisa pendekatan cookie/GraphQL yang sudah ditinggalkan.

**Files:**
- Modify: `.env.example`, `src/config/env.ts`, `README` (kalau ada / buat `README.md`)

- Hapus `THREADS_COOKIE`, `THREADS_CSRF_TOKEN`, `THREADS_LSD` dari schema & contoh
  env (tidak dipakai siapa pun setelah Task 10).
- Hapus juga dari `.env` lokal (hati-hati: nilai ini secret — hapus saja, jangan
  dicetak).
- Tambah `README.md`: cara login sekali, env wajib, cara menjalankan dry-run vs
  live, dan peringatan ToS dari bagian 0.
- Hapus `note.json`/`output.json` yang masih staged (sisa debugging) — konfirmasi
  ke user sebelum `git rm`.

**Step 1:** Bersihkan env + schema.
**Step 2:** `bun run typecheck` → exit 0.
**Step 3:** Commit: `chore: drop legacy private graphql credentials`

---

## 6. Validasi (acceptance criteria)

Semua harus lulus sebelum bilang "selesai":

1. `bun run typecheck` → exit 0.
2. `bun test` → semua pass (rate-limit, dedupe).
3. `bun run start` → server naik, `/health` 200, `/threads/status` 200 dengan
   `loggedIn: true`.
4. `POST /threads/ui/post` dengan `DRY_RUN=true` → 202, log `[dry-run]`, **tidak
   ada** post baru di Threads.
5. `POST /threads/ui/post` dengan `DRY_RUN=false` → post benar-benar muncul di
   akun Threads (diverifikasi manual di app), screenshot tersimpan di `.data/artifacts/`.
6. `POST /threads/ui/like` dua kali pada permalink sama → sekali `done`, sekali
   `skipped` (bukti dedupe).
7. Rate limit: setelah 20 aksi dalam 1 jam, aksi ke-21 tidak dijalankan dan
   dicatat `skipped`/menunggu — bukan dipaksa jalan.
8. `Ctrl+C` → tidak ada proses Chrome zombie, restart tanpa error lock.
9. `/docs` menampilkan seluruh endpoint baru.

---

## 7. Risiko & Tradeoff

| Risiko | Dampak | Mitigasi di rencana |
|---|---|---|
| Automation melanggar ToS, akun kena ban | Fatal | 1 akun/1 IP, cap 20 aksi/jam, delay 45–150s, retry maks 1x, DRY_RUN default |
| Selector Threads berubah | Fitur mati | Semua selector di `ui/selectors.ts`, verifikasi berbasis role/name |
| Login session expired | Semua aksi gagal | `ensureLoggedIn()` → error 401 jelas + cara re-login di README |
| Profil Chromium bocor (berisi cookie) | Pembajakan akun | `.data/` di-gitignore, tidak pernah dicetak, tidak pernah di-commit |
| Chromium headless terdeteksi | Aksi gagal/diam-diam di-drop | `channel:"chrome"` asli, `disable-blink-features=AutomationControlled`, locale/timezone konsisten |
| Request HTTP menggantung | UX API buruk | Semua aksi async lewat queue, route balas 202 |
| Zombie Chrome | Disk/CPU bocor | Task 13 shutdown bersih |

Tradeoff yang disadari: UI automation jauh lebih rapuh daripada Graph API resmi,
tapi memberi aksi yang API resmi tidak punya (like/repost/reply massal). Kode API
resmi tetap dipertahankan; keduanya hidup berdampingan, jadi kalau UI rusak,
`/threads/publish` masih jalan.

---

## 8. Pertanyaan Terbuka (perlu keputusan kamu)

1. **Keyword & kebijakan campaign.** Keyword apa yang dipantau, dan untuk setiap
   post: langsung like+reply, atau hanya dikumpulkan untuk approval manual dulu?
   (Rencana MVP: kumpulkan → like saja, reply butuh approval.)
2. **Isi balasan.** Balasan statis dari daftar template, atau di-generate AI
   (env `OPENAI_*` sudah ada di `env.ts`)? Rencana ini sengaja belum menyentuh AI.
3. **Multi-akun.** MVP rencana ini 1 akun. Kalau nanti multi-akun, butuh 1 profil
   Chromium + 1 proxy per akun, dan itu perubahan besar (bukan sekadar loop).
4. **`channel: "chrome"` vs bundled chromium.** Chrome asli = fingerprint lebih
   wajar, tapi mesin yang tidak punya Chrome harus pakai `chromium`.
5. **`note.json`/`output.json`** yang masih staged — hapus atau simpan?
6. **Bahasa balasan.** Indonesia saja, atau ikut bahasa post target?
7. **Approval flow.** Mau CLI approval (`bun scripts/approve.ts`) atau lewat
   endpoint `POST /threads/ui/approve`? Requirement.md lama menyebut approval.

---

## 9. Urutan Eksekusi yang Disarankan

1–2 (setup) → 3–4 (store + rate limit, pure & teruji) → 5–6 (launcher + login)
→ 7 (selectors, butuh inspeksi nyata) → 8–9 (aksi) → 10 (scrape) → 11 (queue+worker)
→ 12 (HTTP) → 13–14 (hardening + cleanup).

Task 1–4 bisa paralel dikerjakan subagent. Task 5–9 **harus serial** karena semua
bergantung pada bentuk UI nyata dan selector yang sama. Jangan mulai Task 11
sebelum Task 8 dan 9 benar-benar bekerja live satu kali.

---

## 10. STATUS: Task 1–5 + 10 SELESAI & TERVERIFIKASI (2026-10-08)

Yang sudah jalan (dibuktikan dengan run nyata, bukan asumsi):

- `bun run typecheck` → exit 0. `bun test` → 16 pass / 0 fail.
- `bun run start` + `GET /health` → 200. `startKeywordSearch()` lama sudah dihapus
  dari `src/app.ts` (loop 5 menit tidak jalan lagi).
- `bun run search:threads rokok --limit 10` → **10 post nyata** dari
  `https://www.threads.com/search?q=rokok`, lengkap dengan postId, permalink,
  author, teks, likeCount/replyCount/repostCount, dan flag `hasLiked`.

Fakta lapangan yang berbeda dari rencana awal (penting untuk task berikutnya):

1. **Chromium cache tidak dipakai.** `playwright-core@1.64.0` menuntut
   `chromium-1248`, sementara yang ter-cache `chromium-1243` → launch gagal.
   Yang jalan: `channel: "chrome"` (Google Chrome asli, 155.0.8059.39). Jadi
   `BROWSER_CHANNEL=chrome` bukan sekadar pilihan fingerprint, tapi keharusan di
   mesin ini.
2. **Login manual TIDAK dibutuhkan sekarang.** `THREADS_COOKIE` lama di `.env`
   masih valid → `bootstrapCookiesFromEnv()` cukup, langsung login sebagai
   `@abd.harits19`. `bun run login:threads` tetap disediakan sebagai jalan
   cadangan kalau cookie kedaluwarsa.
3. **Deteksi login** pakai `a[href^="/@"]` (link profil sendiri), bukan tombol
   composer. Selector composer di `selectors.ts` **belum terbukti match** —
   di beranda, composer adalah `div` dengan teks "Apa yang baru?" + tombol
   "Kirim", bukan `button`. Wajib diinspeksi ulang di Task 8.
4. **Struktur DOM satu post** (diverifikasi lewat probe):
   `div[data-pressable-container="true"]` → `a[href="/@user/post/<id>"]` +
   `span` (username) + `<time>` (tanggal) + `span` (teks) +
   `div[role="button"]` dengan label di `svg > title`
   ("Suka"/"Balas"/"Posting ulang"/"Bagikan"; "Batal suka" = sudah di-like).
5. **Format angka id-ID**: "1.234" = 1234, "14,8 rb" = 14800, "2 jt" = 2000000.
   Sudah ditangani `parseCount()`.
6. **Header post harus dibuang**: nama komunitas/tag + timestamp semuanya di
   dalam `<a>`, jadi span di dalam anchor di-skip saat ekstraksi teks.
7. Layout `tsconfig.json` berubah: `lib` + `"DOM"` (kode `page.evaluate` pakai
   `document`), dan `src/playground/` di-`exclude` (script probe dev, gitignored).
8. `THREADS_BOT_USER_ID`/`THREADS_BOT_ACCESS_TOKEN`/`THREADS_APP_ID`/
   `THREADS_APP_SECRET` di `env.ts` sebelumnya ter-comment padahal dipakai
   `service.ts` → sudah diaktifkan (typecheck sebelumnya gagal karena ini).
9. Catatan lama: `package.json` masih menunjuk `src/scripts/refresh-threads-token.ts`
   dan `src/scripts/get-access-token.ts` yang **tidak ada di repo** — script
   `token`/`token:refresh` sudah rusak sebelum perubahan ini.

Sisa yang belum dikerjakan: Task 6 opsional (login manual — tidak perlu sekarang),
7 selesai sebagian (selector aksi posting/reply/like **belum diverifikasi**),
8, 9, 11–14.

---

## 11. ARAH BERUBAH: HAPUS JALUR API, MURNI CHROMIUM (2026-10-08, setelah §10)

Atas permintaan user ("hapus semua, fokus Chromium"), seluruh jalur non-Chromium
dibuang:

DIHAPUS:
- `src/modules/threads/service.ts` — Threads Graph API resmi (publishText,
  threadsFetch, createPost, publish).
- `src/modules/threads/routes.ts` + `schema.ts` — endpoint `POST /threads/publish`.
- `src/docs/openapi.ts` — spec OpenAPI (dan dengan itu klaim ApiKeyAuth palsu:
  endpoint publish sebenarnya tidak pernah dilindungi middleware apa pun).
- `src/modules/threads/model.ts` — 273 baris type GraphQL privat (tak terpakai).
- `src/playground/` — scratch probe dev.
- Dependency `swagger-ui-express` + `@types/swagger-ui-express`.
- Env: `API_KEY`, `LOG_LEVEL`, `THREADS_APP_ID/SECRET`, `THREADS_BOT_USER_ID`,
  `THREADS_BOT_ACCESS_TOKEN`, `WEBHOOK_VERIFY_TOKEN`, `AI_*`,
  `THREADS_STATE_DIR` (semuanya tak terbaca kode).
- Helper error tak terpakai: `badRequest`, `conflict`, `serviceUnavailable`.

DIPERTAHANKAN (inti bot Chromium):
- `src/browser/{launcher,session,rate-limit}.ts`
- `src/modules/threads/ui/{feed,selectors,types}.ts` — scrape search & feed
- `src/store/{sqlite.ts,schema.sql}` — dedupe + action log
- `src/scripts/{threads-login,threads-search}.ts`
- `src/app.ts` + `src/index.ts` — hanya host proses + `GET /health`
  (bukan API Threads; tetap ada supaya `bun run start` punya entrypoint)
- `tests/*` — 16 pass

KONSEKUENSI untuk Task 11–12 di dokumen ini: endpoint HTTP untuk aksi UI
(`/threads/ui/*`) dan dokumentasi OpenAPI **batal** — kalau nanti butuh dikontrol
dari luar, tambahkan lagi dari nol. Aksi bot sekarang dipicu lewat script/worker,
bukan HTTP.

Catatan: `src/scripts/` masih memuat `refresh-threads-token.ts` / `get-access-token.ts`
di `package.json`? Tidak — script itu sudah dihapus dari package.json (file-nya
memang tidak pernah ada di repo).


