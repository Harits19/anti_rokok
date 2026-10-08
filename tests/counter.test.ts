import { test, expect } from "bun:test";
import { classifyProRokokStance } from "../src/modules/threads/classify";
import { buildMessages, clampReply, pickFact } from "../src/ai/client";
import { isReplySubmitLabel } from "../src/modules/threads/ui/reply";
import type { FactSource } from "../src/ai/research";
import type { StyleInfo } from "../src/ai/style";

const FACTS: FactSource[] = [
  {
    claim: "Tobacco kills more than 7 million people each year, including over 1.6 million non-smokers.",
    source: "WHO",
    url: "https://www.who.int/news-room/fact-sheets/detail/tobacco",
    lang: "en",
  },
  {
    claim: "Paparan asap tembakau menyebabkan 80-90% kasus kanker paru.",
    source: "Wikipedia (id)",
    url: "https://id.wikipedia.org/wiki/Rokok",
    lang: "id",
  },
];

const SANTAI: StyleInfo = { lang: "id", register: "santai", markers: ["gue", "banget"] };
const FORMAL: StyleInfo = { lang: "id", register: "formal", markers: ["saya", "tidak"] };

test("post yang membela rokok dengan argumen keliru terdeteksi", () => {
  const r = classifyProRokokStance(
    "kenapa si rokok enak bgt? dilarang malah makin mahal, toh yang mati kan yang ngerokok sendiri",
  );
  expect(r.proRokok).toBe(true);
  expect(r.hits.length).toBeGreaterThan(0);
});

test("post kebebasan pribadi terdeteksi sebagai argumen pro rokok", () => {
  expect(classifyProRokokStance("rokok itu hak, jangan dilarang, gak ganggu orang lain").proRokok).toBe(true);
});

test("post yang menekankan bahaya rokok TIDAK dianggap pro rokok", () => {
  const r = classifyProRokokStance(
    "bahaya rokok: nikotin bikin kecanduan, asap rokok juga bahaya untuk perokok pasif",
  );
  expect(r.proRokok).toBe(false);
});

test("post netral tidak dianggap pro rokok", () => {
  expect(classifyProRokokStance("harga rokok naik lagi ya bulan ini").proRokok).toBe(false);
});

test("prompt LLM memuat fakta bersumber, larangan mengarang, dan instruksi gaya", () => {
  const messages = buildMessages({ postText: "rokok enak bgt", author: "x" }, FACTS, SANTAI);
  const system = messages[0]!.content.toLowerCase();
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  expect(system).toContain("dilarang mengarang");
  expect(user).toContain("FAKTA BERSUMBER");
  expect(user).toContain(FACTS[0]!.claim);
  expect(user).toContain(FACTS[1]!.url);
  expect(user).toContain("GAYA BALASAN");
  expect(user.toLowerCase()).toContain("santai");
});

test("instruksi gaya membedakan santai dan formal", () => {
  const santai = buildMessages({ postText: "x", author: "a" }, FACTS, SANTAI)[1]!.content.toLowerCase();
  const formal = buildMessages({ postText: "x", author: "a" }, FACTS, FORMAL)[1]!.content.toLowerCase();

  expect(santai).toContain("santai");
  expect(formal).toContain("formal");
  expect(santai).not.toBe(formal);
});

test("instruksi bahasa mengikuti bahasa post", () => {
  const en: StyleInfo = { lang: "en", register: "netral", markers: [] };
  const messages = buildMessages({ postText: "smoking is fine", author: "a" }, FACTS, en);
  expect(messages[1]!.content.toLowerCase()).toContain("inggris");
});

test("pickFact cocokkan kata kunci argumen", () => {
  const facts: FactSource[] = [
    { claim: "Data tentang jantung dan nikotin.", source: "A", url: "https://a", lang: "id" },
    { claim: "Data tentang kanker paru.", source: "B", url: "https://b", lang: "id" },
  ];
  expect(pickFact(facts, ["rokok bukan penyebab kanker"])?.source).toBe("B");
  expect(pickFact([], [])).toBeUndefined();
});

test("clampReply memotong teks yang terlalu panjang", () => {
  const out = clampReply("a".repeat(1200));
  expect(out.length).toBeLessThanOrEqual(460);
  expect(out.endsWith("…")).toBe(true);
  expect(clampReply("  pendek   banget ")).toBe("pendek banget");
});

test("label tombol kirim balasan dikenali", () => {
  expect(isReplySubmitLabel("Balas")).toBe(true);
  expect(isReplySubmitLabel("Balas25")).toBe(false);
  expect(isReplySubmitLabel("Suka")).toBe(false);
});
