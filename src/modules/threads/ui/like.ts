/**
 * Aksi like lewat UI Threads.
 *
 * Bekerja pada halaman yang SEDANG TERBUKA (hasil pencarian / feed), jadi tidak
 * perlu navigasi per post — pencarian sudah memuat state tombol like tiap post.
 *
 * Struktur DOM (diverifikasi 2026-10-08):
 *   div[data-pressable-container="true"]        ← wrapper post
 *     └─ div[role="button"] (svg > title "Suka") ← tombol like; teks "Suka443"
 *   Setelah di-like, teksnya jadi "Batal suka444".
 */
import type { Locator, Page } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../../../config/env";
import { Logger } from "../../../shared/logger";
import type { ActionResult } from "./types";

const logger = new Logger("ThreadsUiLike");

export type LikeButtonState = "like" | "liked" | "none";

/** "Suka443" → "like"; "Batal suka444" → "liked"; lain-lain → "none". */
export function likeButtonState(text: string): LikeButtonState {
  const t = text.replace(/\s+/g, " ").trim();
  if (/^(Batal suka|Unlike)/i.test(t)) return "liked";
  if (/^(Suka|Like)(\b|\d)/i.test(t)) return "like";
  return "none";
}

export function containerForPost(page: Page, postId: string): Locator {
  return page
    .locator('div[data-pressable-container="true"]')
    .filter({ has: page.locator(`a[href*="/post/${postId}"]`) })
    .first();
}

function likeButtonIn(container: Locator): Locator {
  return container
    .locator('div[role="button"]')
    .filter({ hasText: /^\s*(Suka|Batal suka|Like|Unlike)/ })
    .first();
}

async function readState(container: Locator): Promise<LikeButtonState> {
  const text = (await likeButtonIn(container).textContent().catch(() => null)) ?? "";
  return likeButtonState(text);
}

/**
 * Like satu post yang sedang tampil di halaman aktif.
 * Idempotent: kalau sudah di-like → status "skipped", tidak mengklik apa pun.
 */
export async function likePostOnPage(
  page: Page,
  post: { postId: string; permalink: string },
): Promise<ActionResult> {
  const container = containerForPost(page, post.postId);

  if ((await container.count()) === 0) {
    return {
      kind: "like",
      status: "failed",
      targetId: post.postId,
      permalink: post.permalink,
      error: "container post tidak ada di halaman aktif",
    };
  }

  await container.scrollIntoViewIfNeeded().catch(() => {});

  const before = await readState(container);

  if (before === "liked") {
    return {
      kind: "like",
      status: "skipped",
      targetId: post.postId,
      permalink: post.permalink,
      message: "sudah di-like sebelumnya",
    };
  }

  if (before === "none") {
    return {
      kind: "like",
      status: "failed",
      targetId: post.postId,
      permalink: post.permalink,
      error: "tombol like tidak ketemu / teks tombol tidak dikenali",
    };
  }

  if (env.DRY_RUN) {
    return {
      kind: "like",
      status: "planned",
      targetId: post.postId,
      permalink: post.permalink,
      message: "dry-run: tombol like tidak diklik (DRY_RUN=true)",
    };
  }

  // Bukti visual sebelum tindakan (berguna saat gagal).
  const dir = resolve(process.cwd(), ".data/artifacts");
  mkdirSync(dir, { recursive: true });
  const screenshot = resolve(dir, `${Date.now()}-like-${post.postId}.png`);
  await page.screenshot({ path: screenshot }).catch(() => {});

  await likeButtonIn(container).click();

  // Verifikasi state benar-benar berubah; kalau tidak, klik tidak dianggap sukses.
  await page.waitForTimeout(1500);
  const after = await readState(container);

  if (after !== "liked") {
    return {
      kind: "like",
      status: "failed",
      targetId: post.postId,
      permalink: post.permalink,
      error: `state tombol tidak berubah setelah klik (masih "${after}")`,
      screenshot,
    };
  }

  logger.info(`post ${post.postId} berhasil di-like`);
  return {
    kind: "like",
    status: "done",
    targetId: post.postId,
    permalink: post.permalink,
    message: "di-like",
    screenshot,
  };
}
