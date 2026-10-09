/**
 * Alur "buzz": cari post dengan keyword, minta LLM menilai sikap tiap post,
 * lalu like yang mendukung bahaya rokok (pro kesehatan).
 *
 * Alur ini HANYA like — tidak membalas. Kombinasi like + balas ada di
 * src/modules/threads/counter.ts (engageRokokPosts).
 *
 * Aturan main (sengaja konservatif — automation UI berisiko ban):
 * - Hanya like. Tidak membalas, tidak repost.
 * - Klasifikasi oleh LLM (src/ai/classify.ts); kalau LLM gagal, post dilewati.
 * - Idempotent: post yang sudah di-like / sudah pernah diproses tidak disentuh lagi.
 * - Dibatasi ACTION_MAX_PER_HOUR per jam, dengan jeda acak antar like.
 * - DRY_RUN=true (default): seluruh alur jalan, klik like TIDAK dilakukan, dan
 *   tidak ada state yang ditulis ke database.
 */
import type { Page } from "playwright-core";
import { env } from "../../config/env";
import { canActNow, nextDelayMs } from "../../browser/rate-limit";
import { getStore } from "../../store/sqlite";
import { serviceUnavailable } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { classifyPostStance } from "../../ai/classify";
import { scrapeSearch } from "./ui/feed";
import { likePostOnPage } from "./ui/like";
import type { ActionResult, ScrapedPost } from "./ui/types";

const logger = new Logger("ThreadsBuzz");

const HOUR_MS = 60 * 60 * 1000;

export interface RejectedPost {
  postId: string;
  permalink: string;
  author: string;
  text: string;
  /** Alasan LLM kenapa post ini tidak di-like. */
  reason: string;
}

export interface BuzzReport {
  keyword: string;
  dryRun: boolean;
  scanned: number;
  liked: ActionResult[];
  alreadyLiked: ActionResult[];
  alreadyProcessed: string[];
  rejected: RejectedPost[];
  actionsLastHour: number;
  maxPerHour: number;
  stoppedBecause?: string;
}

export interface BuzzOptions {
  keyword?: string;
  /** Berapa post yang di-scan dari hasil pencarian. */
  scanLimit?: number;
  /** Batas like dalam satu panggilan. */
  maxLikes?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toRejected(post: ScrapedPost, reason: string): RejectedPost {
  return {
    postId: post.postId,
    permalink: post.permalink,
    author: post.author,
    text: post.text,
    reason,
  };
}

export async function buzzRokokPosts(page: Page, options: BuzzOptions = {}): Promise<BuzzReport> {
  const keyword = options.keyword ?? "rokok";
  const scanLimit = Math.min(Math.max(options.scanLimit ?? 20, 1), 50);
  const maxLikes = Math.min(Math.max(options.maxLikes ?? 3, 1), env.ACTION_MAX_PER_HOUR);
  const dryRun = env.DRY_RUN;
  const store = getStore();

  if (!env.AI_API_KEY) {
    throw serviceUnavailable(
      "AI_API_KEY belum diisi. Klasifikasi sikap post dibuat LLM, jadi buzz tidak dijalankan.",
    );
  }

  const report: BuzzReport = {
    keyword,
    dryRun,
    scanned: 0,
    liked: [],
    alreadyLiked: [],
    alreadyProcessed: [],
    rejected: [],
    actionsLastHour: 0,
    maxPerHour: env.ACTION_MAX_PER_HOUR,
  };

  const posts = await scrapeSearch(page, keyword, { limit: scanLimit });
  report.scanned = posts.length;
  logger.info(`scan ${posts.length} post untuk keyword "${keyword}"`);

  const candidates: ScrapedPost[] = [];

  for (const post of posts) {
    let verdict;
    try {
      verdict = await classifyPostStance({ postText: post.text, author: post.author });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.rejected.push(toRejected(post, `klasifikasi LLM gagal: ${message}`));
      logger.warn(`lewatkan ${post.postId}: klasifikasi LLM gagal (${message})`);
      continue;
    }

    logger.info(`post ${post.postId} @${post.author} → ${verdict.stance} (${verdict.reason})`);

    if (!verdict.proHealth) {
      report.rejected.push(toRejected(post, verdict.reason || `sikap: ${verdict.stance}`));
      continue;
    }
    if (post.hasLiked) {
      report.alreadyLiked.push({
        kind: "like",
        status: "skipped",
        targetId: post.postId,
        permalink: post.permalink,
        message: "sudah di-like (terlihat dari hasil pencarian)",
      });
      continue;
    }
    candidates.push(post);
  }

  logger.info(
    `kandidat: ${candidates.length} pro kesehatan, ${report.rejected.length} ditolak, ${report.alreadyLiked.length} sudah di-like`,
  );

  let acted = 0;

  for (const post of candidates) {
    if (acted >= maxLikes) {
      report.stoppedBecause = `batas maxLikes=${maxLikes} per panggilan tercapai`;
      break;
    }

    if (store.hasSeen(post.postId)) {
      report.alreadyProcessed.push(post.postId);
      continue;
    }

    const used = store.countActionsSince(Date.now() - HOUR_MS);
    report.actionsLastHour = used;
    if (!canActNow(used, env.ACTION_MAX_PER_HOUR)) {
      report.stoppedBecause = `rate limit ${env.ACTION_MAX_PER_HOUR} aksi/jam tercapai — berhenti, tidak retry`;
      break;
    }

    // Jeda manusiawi hanya saat benar-benar akan mengklik.
    if (!dryRun && acted > 0) {
      const delay = nextDelayMs({ min: env.ACTION_MIN_DELAY_MS, max: env.ACTION_MAX_DELAY_MS });
      logger.info(`jeda ${Math.round(delay / 1000)}s sebelum aksi berikutnya`);
      await sleep(delay);
    }

    const result = await likePostOnPage(page, post);
    logger.info(`like ${post.postId} → ${result.status}${result.error ? ` (${result.error})` : ""}`);

    if (result.status === "done") {
      // State hanya ditulis kalau aksi benar-benar terjadi.
      store.recordAction("like", { postId: post.postId, permalink: post.permalink }, "done", {
        targetId: post.postId,
      });
      store.markSeen(post.postId, post.permalink);
      report.liked.push(result);
      acted++;
      continue;
    }

    if (result.status === "planned") {
      // Dry-run: tidak mengklik, tidak menulis state (biar tidak memakan kuota).
      report.liked.push(result);
      acted++;
      continue;
    }

    if (result.status === "failed") {
      store.recordAction("like", { postId: post.postId, permalink: post.permalink }, "failed", {
        targetId: post.postId,
        error: result.error,
      });
      report.liked.push(result);
      acted++;
      continue;
    }

    report.alreadyLiked.push(result);
  }

  report.actionsLastHour = store.countActionsSince(Date.now() - HOUR_MS);
  return report;
}
