/**
 * Alur "engage": satu kali scan, lalu tiap post dinilai oleh LLM.
 *
 * - "proHealth" → LIKE (dukung konten yang mengingatkan bahaya rokok).
 * - "proRokok"  → BALAS dengan argumen kontra (counter), juga disusun LLM.
 * - "lain"      → dilewati.
 *
 * Dikerjakan dua fase supaya tidak bolak-balik navigasi:
 *   fase 1 = like (cukup di halaman hasil pencarian yang sudah terbuka),
 *   fase 2 = balas (klik Balas memindahkan halaman, jadi halaman pencarian
 *            dibuka ulang per post kalau perlu).
 *
 * Aturan main:
 * - Klasifikasi, balasan: semuanya oleh LLM. Tidak ada heuristik kata kunci,
 *   tidak ada template. Kalau LLM gagal, post itu dilewati.
 * - Idempotent: post yang sudah pernah diproses tidak disentuh lagi.
 * - Rate limit ACTION_MAX_PER_HOUR per jam untuk SEMUA aksi tulis (like + balas),
 *   plus jeda acak antar aksi.
 * - DRY_RUN=true (default): aksi tidak diklik, DB tidak ditulis.
 */
import type { Page } from "playwright-core";
import { env } from "../../config/env";
import { canActNow, nextDelayMs } from "../../browser/rate-limit";
import { THREADS_SEARCH_URL } from "../../browser/session";
import { getStore, type Store } from "../../store/sqlite";
import { serviceUnavailable } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { generateCounterReply, type CounterReply } from "../../ai/client";
import { classifyPostStance, type ProRokokVerdict } from "../../ai/classify";
import { scrapeSearch } from "./ui/feed";
import { containerForPost, likePostOnPage } from "./ui/like";
import { replyToPostOnPage } from "./ui/reply";
import type { ActionResult, ScrapedPost } from "./ui/types";

const logger = new Logger("ThreadsEngage");
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
  /** Alasan LLM kenapa post ini tidak diapa-apakan. */
  reason: string;
}

export interface CounterReport {
  keyword: string;
  dryRun: boolean;
  aiEnabled: boolean;
  scanned: number;
  /** Hasil klasifikasi LLM, untuk audit biaya/efektivitas. */
  classified: { proRokok: number; proHealth: number; lain: number };
  /** Hasil aksi like (termasuk yang dilewati/langsung sudah di-like). */
  liked: ActionResult[];
  /** Rencana + hasil balasan untuk post pro-rokok. */
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
  /** Batas like dalam satu panggilan. */
  maxLikes?: number;
  /** Batas balasan dalam satu panggilan. */
  maxReplies?: number;
}

/**
 * Ketergantungan luar alur ini (scrape, LLM, aksi UI, store). Bisa ditukar di
 * test supaya seluruh alur bisa diuji tanpa browser dan tanpa jaringan.
 */
export interface EngageDeps {
  scrape: typeof scrapeSearch;
  classify: typeof classifyPostStance;
  like: typeof likePostOnPage;
  reply: typeof replyToPostOnPage;
  reopenSearchPage: typeof openSearchPageWithPost;
  generateReply: typeof generateCounterReply;
  store: Store;
}

function resolveDeps(overrides: Partial<EngageDeps> = {}): EngageDeps {
  return {
    scrape: scrapeSearch,
    classify: classifyPostStance,
    like: likePostOnPage,
    reply: replyToPostOnPage,
    reopenSearchPage: openSearchPageWithPost,
    generateReply: generateCounterReply,
    store: getStore(),
    ...overrides,
  };
}

interface ReplyCandidate {
  post: ScrapedPost;
  verdict: ProRokokVerdict;
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
    await page.goto(THREADS_SEARCH_URL(keyword), {
      waitUntil: "domcontentloaded",
    });
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

export async function engageRokokPosts(
  page: Page,
  options: CounterOptions = {},
  deps: Partial<EngageDeps> = {},
): Promise<CounterReport> {
  const d = resolveDeps(deps);
  const { store } = d;
  const keyword = options.keyword ?? "rokok";
  const scanLimit = Math.min(Math.max(options.scanLimit ?? 20, 1), 50);
  const maxLikes = Math.min(
    Math.max(options.maxLikes ?? 3, 1),
    env.ACTION_MAX_PER_HOUR,
  );
  const maxReplies = Math.min(
    Math.max(options.maxReplies ?? 2, 1),
    env.ACTION_MAX_PER_HOUR,
  );
  const dryRun = env.DRY_RUN;

  // Kunci LLM wajib selama klasifikasi/balasan memakai LLM asli.
  if (!env.AI_API_KEY && d.classify === classifyPostStance) {
    throw serviceUnavailable(
      "AI_API_KEY belum diisi. Klasifikasi sikap post dan balasan sama-sama dibuat LLM, jadi engage tidak dijalankan.",
    );
  }

  const report: CounterReport = {
    keyword,
    dryRun,
    aiEnabled: Boolean(env.AI_API_KEY),
    scanned: 0,
    classified: { proRokok: 0, proHealth: 0, lain: 0 },
    liked: [],
    plans: [],
    rejected: [],
    alreadyProcessed: [],
    actionsLastHour: 0,
    maxPerHour: env.ACTION_MAX_PER_HOUR,
  };

  const posts = await d.scrape(page, keyword, { limit: scanLimit });
  report.scanned = posts.length;
  logger.info(`scan ${posts.length} post untuk keyword "${keyword}"`);

  // Fase 0: klasifikasi semua post (LLM), pisahkan jadi calon like & calon balas.
  const likeCandidates: ScrapedPost[] = [];
  const replyCandidates: ReplyCandidate[] = [];

  for (const post of posts) {
    if (store.hasSeen(post.postId)) {
      report.alreadyProcessed.push(post.postId);
      continue;
    }

    let verdict: ProRokokVerdict;
    try {
      verdict = await d.classify({ postText: post.text, author: post.author });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.rejected.push({
        postId: post.postId,
        permalink: post.permalink,
        author: post.author,
        text: post.text,
        reason: `klasifikasi LLM gagal: ${message}`,
      });
      logger.warn(`lewatkan ${post.postId}: klasifikasi LLM gagal (${message})`);
      continue;
    }

    report.classified[verdict.stance]++;
    logger.info(
      `post ${post.postId} @${post.author} → ${verdict.stance} (${verdict.reason})`,
    );

    if (verdict.proHealth) {
      if (post.hasLiked) {
        report.liked.push({
          kind: "like",
          status: "skipped",
          targetId: post.postId,
          permalink: post.permalink,
          message: "sudah di-like (terlihat dari hasil pencarian)",
        });
        continue;
      }
      likeCandidates.push(post);
      continue;
    }

    if (verdict.proRokok) {
      replyCandidates.push({ post, verdict });
      continue;
    }

    report.rejected.push({
      postId: post.postId,
      permalink: post.permalink,
      author: post.author,
      text: post.text,
      reason: verdict.reason || "post netral / tidak membahas rokok",
    });
  }

  logger.info(
    `klasifikasi: ${report.classified.proHealth} pro kesehatan (calon like), ` +
      `${report.classified.proRokok} pro rokok (calon balas), ${report.classified.lain} lain`,
  );

  // Fase 1: like post pro kesehatan — cukup di halaman pencarian yang terbuka.
  let liked = 0;

  for (const post of likeCandidates) {
    if (liked >= maxLikes) {
      report.stoppedBecause = `batas maxLikes=${maxLikes} per panggilan tercapai`;
      break;
    }

    const used = store.countActionsSince(Date.now() - HOUR_MS);
    report.actionsLastHour = used;
    if (!canActNow(used, env.ACTION_MAX_PER_HOUR)) {
      report.stoppedBecause = `rate limit ${env.ACTION_MAX_PER_HOUR} aksi/jam tercapai — berhenti, tidak retry`;
      break;
    }

    // Jeda manusiawi hanya saat benar-benar akan mengklik.
    if (!dryRun && liked > 0) {
      const delay = nextDelayMs({ min: env.ACTION_MIN_DELAY_MS, max: env.ACTION_MAX_DELAY_MS });
      logger.info(`jeda ${Math.round(delay / 1000)}s sebelum like berikutnya`);
      await sleep(delay);
    }

    const result = await d.like(page, post);
    logger.info(`like ${post.postId} → ${result.status}${result.error ? ` (${result.error})` : ""}`);
    report.liked.push(result);

    if (result.status === "done") {
      store.recordAction(
        "like",
        { postId: post.postId, permalink: post.permalink },
        "done",
        { targetId: post.postId },
      );
      store.markSeen(post.postId, post.permalink);
      liked++;
      continue;
    }

    if (result.status === "planned") {
      // Dry-run: tidak mengklik, tidak menulis state (biar tidak memakan kuota).
      liked++;
      continue;
    }

    if (result.status === "failed") {
      store.recordAction("like", { postId: post.postId, permalink: post.permalink }, "failed", {
        targetId: post.postId,
        error: result.error,
      });
      liked++;
    }
  }

  // Fase 2: balas post pro rokok. Klik Balas memindahkan halaman, jadi halaman
  // pencarian dibuka ulang kalau post berikutnya belum ada di halaman aktif.
  let replied = 0;
  let onSearchPage = true;

  for (const { post, verdict } of replyCandidates) {
    if (replied >= maxReplies) {
      report.stoppedBecause = `batas maxReplies=${maxReplies} per panggilan tercapai`;
      break;
    }

    const used = store.countActionsSince(Date.now() - HOUR_MS);
    report.actionsLastHour = used;
    if (!canActNow(used, env.ACTION_MAX_PER_HOUR)) {
      report.stoppedBecause = `rate limit ${env.ACTION_MAX_PER_HOUR} aksi/jam tercapai — berhenti, tidak retry`;
      break;
    }

    const hits = verdict.arguments;
    const reply = await d.generateReply({
      postText: post.text,
      author: post.author,
      arguments: hits,
    });

    const plan: CounterPlan = {
      postId: post.postId,
      permalink: post.permalink,
      author: post.author,
      postText: post.text,
      argumentHits: hits,
      reply,
    };

    // Balasan hanya dari LLM. Kalau LLM gagal: JANGAN membalas.
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
      replied++;
      continue;
    }

    // Jeda manusiawi sebelum aksi tulis berikutnya.
    if (replied > 0) {
      const delay = nextDelayMs({
        min: env.ACTION_MIN_DELAY_MS,
        max: env.ACTION_MAX_DELAY_MS,
      });
      logger.info(
        `jeda ${Math.round(delay / 1000)}s sebelum balasan berikutnya`,
      );
      await sleep(delay);
    }

    if (!onSearchPage) {
      const found = await d.reopenSearchPage(page, keyword, post.postId);
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

    const result = await d.reply(page, post, reply.text);
    onSearchPage = false;
    plan.result = result;
    report.plans.push(plan);

    logger.info(
      `balas ${post.postId} → ${result.status}${result.error ? ` (${result.error})` : ""}`,
    );

    store.recordAction(
      "reply",
      {
        postId: post.postId,
        permalink: post.permalink,
        text: reply.text,
        source: reply.source,
        arguments: hits,
      },
      result.status,
      { targetId: post.postId, error: result.error },
    );

    if (result.status === "done") store.markSeen(post.postId, post.permalink);

    replied++;
  }

  report.actionsLastHour = store.countActionsSince(Date.now() - HOUR_MS);
  return report;
}
