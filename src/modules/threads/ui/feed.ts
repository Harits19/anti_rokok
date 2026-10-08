/**
 * Scrape feed & hasil pencarian Threads dari DOM.
 * Sengaja TIDAK menyentuh endpoint GraphQL privat (pendekatan lama yang dihapus
 * di commit 3d207dc dan rapuh).
 *
 * Struktur DOM yang diandalkan (diverifikasi 2026-10-08):
 *   div[data-pressable-container="true"]        ← wrapper satu post
 *     ├─ a[href="/@user/post/<id>"]             ← permalink (juga anchor waktu)
 *     ├─ span                                   ← username
 *     ├─ time                                   ← tanggal tampil
 *     ├─ span (daun terpanjang)                 ← teks post
 *     └─ div[role="button"] (svg > title)       ← Suka/Balas/Posting ulang/Bagikan
 */
import type { Page } from "playwright-core";
import { THREADS_HOME, THREADS_SEARCH_URL } from "../../../browser/session";
import { Logger } from "../../../shared/logger";
import type { ScrapedPost } from "./types";

const logger = new Logger("ThreadsUiFeed");

/** Label aksi di UI Threads (id-ID dan en). */
export const ACTION_LABELS = {
  like: ["Suka", "Like"],
  liked: ["Batal suka", "Unlike"],
  reply: ["Balas", "Reply"],
  repost: ["Posting ulang", "Repost"],
  share: ["Bagikan", "Share"],
} as const;

/** Baris mentah dari page.evaluate — dipisah supaya parsing bisa diuji tanpa browser. */
export interface RawPostRow {
  href: string;
  author: string;
  postedAt: string;
  text: string;
  /** Teks tombol like, mis. "Suka857" atau "Batal suka857". */
  likeButtonText: string;
  replyButtonText: string;
  repostButtonText: string;
}

/**
 * Parse href Threads jadi postId + permalink + author.
 * Menerima "/@user/post/<id>", "/@user/post/<id>/media", atau URL absolut.
 * Return null kalau bukan post (mis. "/search?q=...").
 */
export function parsePostHref(
  href: string,
): { postId: string; permalink: string; author: string } | null {
  if (!href) return null;

  let path = href;
  try {
    if (/^https?:\/\//i.test(href)) path = new URL(href).pathname;
  } catch {
    return null;
  }

  const match = /^\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/.exec(path);
  if (!match) return null;

  const [, author, postId] = match;
  if (!author || !postId) return null;

  return { postId, permalink: `${THREADS_HOME}/@${author}/post/${postId}`, author };
}

/** "857" → 857, "1.234" → 1234, "14,8 rb" → 14800, "2 jt" → 2000000, "-" → 0. */
export function parseCount(raw: string): number {
  const m = /([\d][\d.,]*)\s*(rb|ribu|jt|juta|k|m)?/i.exec(raw.trim());
  if (!m?.[1]) return 0;

  const numStr = m[1];
  let n: number;
  if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) {
    n = Number(numStr.replace(/\./g, "")); // 1.234 (id-ID ribuan)
  } else {
    n = Number(numStr.replace(/\./g, "").replace(",", ".")); // 14,8 → 14.8
  }
  if (!Number.isFinite(n)) return 0;

  const suffix = (m[2] ?? "").toLowerCase();
  const mult =
    suffix === "rb" || suffix === "ribu" || suffix === "k"
      ? 1_000
      : suffix === "jt" || suffix === "juta" || suffix === "m"
        ? 1_000_000
        : 1;

  return Math.round(n * mult);
}

/** Tombol like berubah jadi "Batal suka"/"Unlike" kalau post sudah di-like. */
export function isLikedFromLabel(likeButtonText: string): boolean {
  return ACTION_LABELS.liked.some((l) => likeButtonText.startsWith(l));
}

/** Buang duplikat (href /media menunjuk post yang sama) dan baris tanpa postId valid. */
export function dedupeRawRows(rows: RawPostRow[]): ScrapedPost[] {
  const byId = new Map<string, ScrapedPost>();

  for (const row of rows) {
    const parsed = parsePostHref(row.href);
    if (!parsed || byId.has(parsed.postId)) continue;

    byId.set(parsed.postId, {
      postId: parsed.postId,
      permalink: parsed.permalink,
      author: row.author || parsed.author,
      text: row.text.trim(),
      postedAt: row.postedAt,
      likeCount: parseCount(row.likeButtonText),
      replyCount: parseCount(row.replyButtonText),
      repostCount: parseCount(row.repostButtonText),
      hasLiked: isLikedFromLabel(row.likeButtonText),
      scrapedAt: Date.now(),
    });
  }

  return [...byId.values()];
}

async function collectRows(page: Page): Promise<RawPostRow[]> {
  const labelGroups: string[][] = [
    [...ACTION_LABELS.like],
    [...ACTION_LABELS.reply],
    [...ACTION_LABELS.repost],
  ];

  return page.evaluate((labels) => {
    const [likeLabels = [], replyLabels = [], repostLabels = []] = labels;
    const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
    const isNumericOnly = (s: string) => /^[\d\s.,/]+$/.test(s);

    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]'));
    const rows: RawPostRow[] = [];
    const ignoredTexts = labels.flat().concat(["Ikuti", "Follow", "Lainnya", "More"]);

    for (const a of anchors) {
      const href = a.getAttribute("href") ?? "";
      if (!href) continue;

      const box = a.closest('div[data-pressable-container="true"]') ?? a.closest("article");
      if (!box) continue;

      const author = clean(box.querySelector('a[href^="/@"]')?.textContent);
      const postedAt = clean(box.querySelector("time")?.textContent) || clean(a.textContent);

      // Label aksi: svg <title> lalu naik ke tombolnya.
      const buttonText = (names: readonly string[]): string => {
        for (const name of names) {
          for (const title of Array.from(box.querySelectorAll("svg title"))) {
            if (clean(title.textContent) !== name) continue;
            const btn = title.closest('[role="button"]') ?? title.closest("div");
            return clean(btn?.textContent);
          }
        }
        return "";
      };

      // Teks post: gabung span daun di luar tombol/anchor/author/angka.
      const parts: string[] = [];
      for (const span of Array.from(box.querySelectorAll("span"))) {
        if (span.children.length > 0) continue;
        if (span.closest('[role="button"]')) continue;
        // Header (nama komunitas/tag, waktu, dsb) selalu di dalam <a>.
        if (span.closest("a")) continue;
        const t = clean(span.textContent);
        if (!t || isNumericOnly(t) || t === author || t === postedAt) continue;
        if (ignoredTexts.includes(t)) continue;
        parts.push(t);
      }

      rows.push({
        href,
        author,
        postedAt,
        text: parts.join(""),
        likeButtonText: buttonText(likeLabels),
        replyButtonText: buttonText(replyLabels),
        repostButtonText: buttonText(repostLabels),
      });
    }

    return rows;
  }, labelGroups);
}

interface ScrapeOpts {
  limit?: number;
  /** Jumlah scroll maksimum. Default 5, tiap scroll tunggu 1.5-2.5s. */
  maxScrolls?: number;
}

async function scrapeFrom(page: Page, url: string, opts: ScrapeOpts): Promise<ScrapedPost[]> {
  const limit = opts.limit ?? 20;
  const maxScrolls = opts.maxScrolls ?? 5;

  logger.info(`buka ${url} (limit=${limit})`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);

  let posts = dedupeRawRows(await collectRows(page));
  let stale = 0;

  for (let i = 0; i < maxScrolls && posts.length < limit; i++) {
    const before = posts.length;
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(1500 + Math.round(Math.random() * 1000));

    posts = dedupeRawRows(await collectRows(page));
    if (posts.length === before) {
      stale++;
      if (stale >= 3) break; // tidak ada konten baru 3x berturut-turut
    } else {
      stale = 0;
    }
  }

  const result = posts.slice(0, limit);
  logger.info(`dapat ${result.length} post dari ${url}`);
  return result;
}

export function scrapeSearch(
  page: Page,
  keyword: string,
  opts: ScrapeOpts = {},
): Promise<ScrapedPost[]> {
  return scrapeFrom(page, THREADS_SEARCH_URL(keyword), opts);
}

export function scrapeFeed(page: Page, opts: ScrapeOpts = {}): Promise<ScrapedPost[]> {
  return scrapeFrom(page, `${THREADS_HOME}/for_you`, opts);
}
