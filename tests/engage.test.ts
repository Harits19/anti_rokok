import { test, expect } from "bun:test";
import type { ScrapedPost } from "../src/modules/threads/ui/types";
import type { ProRokokVerdict } from "../src/ai/classify";
import type { Store } from "../src/store/sqlite";
import type { EngageDeps } from "../src/modules/threads/counter";

// Env diset sebelum modul produksi di-import (config/env mem-parse sekali).
process.env.AI_API_KEY = "test-key";
process.env.DRY_RUN = "false";
// Jeda manusiawi antar aksi di-nol-kan supaya test tidak menunggu puluhan detik.
process.env.ACTION_MIN_DELAY_MS = "1";
process.env.ACTION_MAX_DELAY_MS = "2";
process.env.ACTION_MAX_PER_HOUR = "50";

const { engageRokokPosts } = await import("../src/modules/threads/counter");

function post(postId: string, text: string, hasLiked = false): ScrapedPost {
  return {
    postId,
    permalink: `https://www.threads.com/@u/post/${postId}`,
    author: "u",
    text,
    postedAt: "1 jam",
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    hasLiked,
    scrapedAt: Date.now(),
  };
}

const POSTS: ScrapedPost[] = [
  post("p1", "bahaya rokok: nikotin bikin kecanduan"),
  post("p2", "rokok itu hak, jangan dilarang", true),
  post("p3", "harga rokok naik bulan ini"),
  post("p4", "rokok bikin fokus, jadi enak"),
];

const STANCE: Record<string, ProRokokVerdict["stance"]> = {
  p1: "proHealth",
  p2: "proRokok",
  p3: "lain",
  p4: "proRokok",
};

function verdictFor(postId: string): ProRokokVerdict {
  const stance = STANCE[postId]!;
  return {
    stance,
    proRokok: stance === "proRokok",
    proHealth: stance === "proHealth",
    reason: `uji: ${stance}`,
    arguments: stance === "proRokok" ? ["argumen uji"] : [],
  };
}

/** Pabrik ketergantungan palsu: tanpa browser, tanpa jaringan, tanpa SQLite. */
function makeDeps() {
  const likeCalls: string[] = [];
  const replyCalls: { postId: string; text: string }[] = [];
  const actions: { kind: string; status: string; targetId?: string }[] = [];
  const seen = new Set<string>();
  const reopened: string[] = [];

  const store = {
    hasSeen: (id: string) => seen.has(id),
    markSeen: (id: string) => void seen.add(id),
    recordAction(
      kind: string,
      _payload: unknown,
      status: string,
      o?: { targetId?: string },
    ) {
      actions.push({ kind, status, targetId: o?.targetId });
      return 1;
    },
    countActionsSince: () => 0,
  } as unknown as Store;

  const deps: Partial<EngageDeps> = {
    store,
    scrape: async () => POSTS,
    // Peta id post dari teksnya, biar tidak bergantung urutan.
    classify: async ({ postText }) => {
      const p = POSTS.find((x) => x.text === postText)!;
      return verdictFor(p.postId);
    },
    like: async (_page, p) => {
      likeCalls.push(p.postId);
      return {
        kind: "like" as const,
        status: "done" as const,
        targetId: p.postId,
        permalink: p.permalink,
        message: "di-like (uji)",
      };
    },
    reply: async (_page, p, text) => {
      replyCalls.push({ postId: p.postId, text });
      return {
        kind: "reply" as const,
        status: "done" as const,
        targetId: p.postId,
        permalink: p.permalink,
        message: "dibalas (uji)",
      };
    },
    reopenSearchPage: async (_page, _keyword, postId) => {
      reopened.push(postId);
      return true;
    },
    generateReply: async ({ postText }) => ({
      ok: true as const,
      text: `BUKTI ${postText.slice(0, 12)}`,
      source: "llm" as const,
      model: "uji",
      style: { lang: "id" as const, register: "santai" as const, markers: [] },
    }),
  };

  return { likeCalls, replyCalls, actions, seen, reopened, deps };
}

const PAGE = {} as never;

test("satu scan: pro kesehatan di-like, pro rokok dibalas, lain dilewati", async () => {
  const h = makeDeps();

  const report = await engageRokokPosts(PAGE, { maxLikes: 5, maxReplies: 5 }, h.deps);

  expect(report.scanned).toBe(4);
  expect(report.classified).toEqual({ proRokok: 2, proHealth: 1, lain: 1 });

  // p1 pro kesehatan → diklik like. p2 sudah di-like → tidak diklik ulang.
  expect(h.likeCalls).toEqual(["p1"]);
  expect(report.liked.map((l) => l.targetId)).toEqual(["p1"]);

  // p2 & p4 pro rokok → dibalas dengan teks dari LLM.
  expect(h.replyCalls.map((r) => r.postId)).toEqual(["p2", "p4"]);
  expect(h.replyCalls[0]!.text).toBe("BUKTI rokok itu ha");
  expect(report.plans.map((p) => p.postId)).toEqual(["p2", "p4"]);
  expect(report.plans[0]!.argumentHits).toEqual(["argumen uji"]);

  // p3 netral → dilewati dengan alasan LLM.
  expect(report.rejected.map((r) => r.postId)).toEqual(["p3"]);
  expect(report.rejected[0]!.reason).toBe("uji: lain");

  // Semua aksi tercatat: 1 like + 2 balasan.
  expect(h.actions.map((a) => a.kind).sort()).toEqual(["like", "reply", "reply"]);
  expect(h.seen.has("p1")).toBe(true);
  expect(h.seen.has("p4")).toBe(true);
});

test("balasan kedua membuka ulang halaman pencarian dulu", async () => {
  const h = makeDeps();

  await engageRokokPosts(PAGE, { maxLikes: 1, maxReplies: 5 }, h.deps);

  // Balasan pertama masih di halaman pencarian; balasan kedua butuh buka ulang.
  expect(h.reopened).toEqual(["p4"]);
});

test("kuota maxLikes/maxReplies membatasi aksi per panggilan", async () => {
  const h = makeDeps();

  const report = await engageRokokPosts(PAGE, { maxLikes: 1, maxReplies: 1 }, h.deps);

  expect(h.likeCalls).toEqual(["p1"]);
  expect(h.replyCalls.map((r) => r.postId)).toEqual(["p2"]);
  expect(report.stoppedBecause).toContain("maxReplies=1");
});

test("post yang sudah pernah diproses tidak disentuh lagi", async () => {
  const h = makeDeps();
  h.deps.scrape = async () => POSTS;
  h.seen.add("p1");
  h.seen.add("p2");

  const report = await engageRokokPosts(PAGE, { maxLikes: 5, maxReplies: 5 }, h.deps);

  expect(h.likeCalls).toEqual([]);
  expect(h.replyCalls.map((r) => r.postId)).toEqual(["p4"]);
  expect(report.alreadyProcessed.sort()).toEqual(["p1", "p2"]);
});

test("klasifikasi gagal → post dilewati, bukan dipaksa dibalas", async () => {
  const h = makeDeps();
  h.deps.classify = async ({ postText }) => {
    if (postText.startsWith("rokok itu hak")) throw new Error("HTTP 500");
    const p = POSTS.find((x) => x.text === postText)!;
    return verdictFor(p.postId);
  };

  const report = await engageRokokPosts(PAGE, { maxLikes: 5, maxReplies: 5 }, h.deps);

  expect(h.replyCalls.map((r) => r.postId)).toEqual(["p4"]);
  expect(report.rejected.find((r) => r.postId === "p2")?.reason).toContain(
    "klasifikasi LLM gagal",
  );
});
