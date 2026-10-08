import { test, expect, beforeEach } from "bun:test";
import { openStore, type Store } from "../src/store/sqlite";

let store: Store;

beforeEach(() => {
  store = openStore(":memory:", { migrate: true });
});

test("post yang sudah terlihat tidak diproses dua kali", () => {
  expect(store.hasSeen("123")).toBe(false);
  store.markSeen("123", "https://www.threads.com/@a/post/123");
  expect(store.hasSeen("123")).toBe(true);
});

test("markSeen idempotent (upsert, bukan error)", () => {
  store.markSeen("123");
  store.markSeen("123", "https://www.threads.com/@a/post/123");
  expect(store.hasSeen("123")).toBe(true);
});

test("hitung aksi dalam window", () => {
  const now = 1_000_000;
  store.recordAction("like", { postId: "1" }, "done", { now });
  store.recordAction("like", { postId: "2" }, "done", { now: now + 1000 });
  expect(store.countActionsSince(now - 1)).toBe(2);
  expect(store.countActionsSince(now + 5000)).toBe(0);
});

test("status failed tidak dihitung sebagai kuota terpakai", () => {
  const now = 1_000_000;
  store.recordAction("like", { postId: "1" }, "failed", { now });
  expect(store.countActionsSince(0)).toBe(0);
});

test("finishAction menutup baris log", () => {
  const id = store.recordAction("post", { text: "hai" }, "planned");
  store.finishAction(id, "done");
  const [row] = store.recentActions(1);
  expect(row?.status).toBe("done");
  expect(row?.finished_at).toBeGreaterThan(0);
});
