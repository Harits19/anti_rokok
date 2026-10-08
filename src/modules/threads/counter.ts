/**
 * Alur "counter": cari post yang membela rokok dengan argumen keliru, susun
 * balasan (LLM kalau AI_API_KEY diisi, kalau tidak pakai template), lalu balas.
 *
 * Aturan main:
 * - Hanya membalas post yang terdeteksi pro-rokok (argumen keliru), bukan semua post soal rokok.
 * - Idempotent: post yang sudah pernah diproses tidak disentuh lagi.
 * - Rate limit ACTION_MAX_PER_HOUR per jam + jeda acak antar balasan.
 * - DRY_RUN=true (default): balasan disusun dan dilaporkan, TIDAK dikirim, DB tidak ditulis.
 */
import type { Page } from "playwright-core";
import { env } from "../../config/env";
import { canActNow, nextDelayMs } from "../../browser/rate-limit";
import { THREADS_SEARCH_URL } from "../../browser/session";
import { getStore } from "../../store/sqlite";
import { serviceUnavailable } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { generateCounterReply, type CounterReply } from "../../ai/client";
import { classifyProRokokStance } from "./classify";
import { scrapeSearch } from "./ui/feed";
import { containerForPost } from "./ui/like";
import { replyToPostOnPage } from "./ui/reply";
import type { ActionResult, ScrapedPost } from "./ui/types";

const logger = new Logger("ThreadsCounter");
const HOUR_MS = 60 * 60 * 1000;

export interface CounterPlan {
  postId: string;
  permalink: string;
  author: string;
  postText: string;
  argumentHits: string[];
  reply: CounterReply;
  result?: ActionResult;
}

export interface RejectedSimilarPost {
  postId: string;
  permalink: string;
  author: string;
  text: string;
  score: number;
}

export interface CounterReport {
  keyword: string;
  dryRun: boolean;
  aiEnabled: boolean;
  scanned: number;
  plans: CounterPlan[];
  rejected: RejectedSimilarPost[];
  alreadyProcessed: string[];
  actionsLastHour: number;
  maxPerHour: number;
  stoppedBecause?: string;
}

export interface CounterOptions {
  keyword?: string;
  scanLimit?: number;
  maxReplies?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hasil pencarian Threads bisa berubah urutan antar load, jadi post target tidak
 * selalu ada di halaman begitu saja. Buka ulang halaman pencarian + scroll, dan
 * tunggu container post itu benar-benar muncul.
 *
 * Return false = post tidak ditemukan lagi di hasil pencarian.
 */
export async function openSearchPageWithPost(
  page: Page,
  keyword: string,
  postId: string,
): Promise<boolean> {
  const container = containerForPost(page, postId);

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(THREADS_SEARCH_URL(keyword), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);

    try {
      await container.waitFor({ state: "visible", timeout: 12_000 });
      return true;
    } catch {
      await page.mouse.wheel(0, 1500).catch(() => {});
      await page.waitForTimeout(2500);
      try {
        await container.waitFor({ state: "visible", timeout: 8000 });
        return true;
      } catch {
        logger.warn(`post ${postId} belum muncul (percobaan ${attempt + 1}/3)`);
      }
    }
  }

  return false;
}

export async function counterProSmokingPosts(
  page: Page,
  options: CounterOptions = {},
): Promise<CounterReport> {
  const keyword = options.keyword ?? "rokok";
  const scanLimit = Math.min(Math.max(options.scanLimit ?? 20, 1), 50);
  const maxReplies = Math.min(Math.max(options.maxReplies ?? 2, 1), env.ACTION_MAX_PER_HOUR);
  const dryRun = env.DRY_RUN;
  const store = getStore();

  if (!env.AI_API_KEY) {
    throw serviceUnavailable(
      "AI_API_KEY belum diisi. Balasan hanya dibuat oleh LLM (bersumber internet), jadi counter tidak dijalankan.",
    );
  }

  const report: CounterReport = {
    keyword,
    dryRun,
    aiEnabled: Boolean(env.AI_API_KEY),
    scanned: 0,
    plans: [],
    rejected: [],
    alreadyProcessed: [],
    actionsLastHour: 0,
    maxPerHour: env.ACTION_MAX_PER_HOUR,
  };

  const posts = await scrapeSearch(page, keyword, { limit: scanLimit });
  report.scanned = posts.length;
  logger.info(`scan ${posts.length} post untuk keyword "${keyword}"`);

  const candidates: { post: ScrapedPost; hits: string[] }[] = [];

  for (const post of posts) {
    const stance = classifyProRokokStance(post.text);
    if (!stance.proRokok) {
      report.rejected.push({
        postId: post.postId,
        permalink: post.permalink,
        author: post.author,
        text: post.text,
        score: stance.score,
      });
      continue;
    }
    candidates.push({ post, hits: stance.hits });
  }

  logger.info(`kandidat pro-rokok: ${candidates.length}, ditolak: ${report.rejected.length}`);

  let acted = 0;
  // Setelah balasan terkirim, halaman berpindah ke post tujuan — bukan lagi
  // halaman hasil pencarian.
  let onSearchPage = true;

  for (const { post, hits } of candidates) {
    if (acted >= maxReplies) {
      report.stoppedBecause = `batas maxReplies=${maxReplies} per panggilan tercapai`;
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

    const reply = await generateCounterReply({
      postText: post.text,
      author: post.author,
      hits,
    });

    const plan: CounterPlan = {
      postId: post.postId,
      permalink: post.permalink,
      author: post.author,
      postText: post.text,
      argumentHits: hits,
      reply,
    };

    // Balasan hanya dari LLM. Kalau LLM gagal atau data tidak ada: JANGAN membalas.
    if (!reply.ok) {
      plan.result = {
        kind: "reply",
        status: "skipped",
        targetId: post.postId,
        permalink: post.permalink,
        error: reply.error ?? "balasan tidak berhasil dibuat",
      };
      report.plans.push(plan);
      logger.warn(`lewatkan ${post.postId}: ${plan.result.error}`);
      continue;
    }

    if (dryRun) {
      plan.result = {
        kind: "reply",
        status: "planned",
        targetId: post.postId,
        permalink: post.permalink,
        message: `dry-run: balasan (${reply.source}) tidak dikirim`,
      };
      report.plans.push(plan);
      acted++;
      continue;
    }

    // Jeda manusiawi sebelum aksi tulis berikutnya.
    if (acted > 0) {
      const delay = nextDelayMs({ min: env.ACTION_MIN_DELAY_MS, max: env.ACTION_MAX_DELAY_MS });
      logger.info(`jeda ${Math.round(delay / 1000)}s sebelum balasan berikutnya`);
      await sleep(delay);
    }

    // Klik Balas memindahkan halaman; pastikan kembali ke hasil pencarian dulu.
    if (!onSearchPage) {
      const found = await openSearchPageWithPost(page, keyword, post.postId);
      if (!found) {
        plan.result = {
          kind: "reply",
          status: "failed",
          targetId: post.postId,
          permalink: post.permalink,
          error: "post tidak lagi muncul di hasil pencarian, dilewati",
        };
        report.plans.push(plan);
        continue;
      }
    }

    const result = await replyToPostOnPage(page, post, reply.text);
    onSearchPage = false;
    plan.result = result;
    report.plans.push(plan);

    logger.info(`balas ${post.postId} → ${result.status}${result.error ? ` (${result.error})` : ""}`);

    store.recordAction(
      "reply",
      { postId: post.postId, permalink: post.permalink, text: reply.text, source: reply.source, hits },
      result.status,
      { targetId: post.postId, error: result.error },
    );

    if (result.status === "done") store.markSeen(post.postId, post.permalink);

    acted++;
  }

  report.actionsLastHour = store.countActionsSince(Date.now() - HOUR_MS);
  return report;
}
