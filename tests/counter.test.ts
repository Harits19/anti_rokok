import { test, expect } from "bun:test";
import { buildMessages, clampReply } from "../src/ai/client";
import { isReplySubmitLabel } from "../src/modules/threads/ui/reply";
import type { StyleInfo } from "../src/ai/style";

const SANTAI: StyleInfo = { lang: "id", register: "santai", markers: ["gue", "banget"] };
const FORMAL: StyleInfo = { lang: "id", register: "formal", markers: ["saya", "tidak"] };

test("prompt balasan memuat larangan mengarang dan instruksi gaya", () => {
  const messages = buildMessages({ postText: "rokok enak bgt", author: "x" }, SANTAI);
  const system = messages[0]!.content.toLowerCase();
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  expect(messages[0]!.role).toBe("system");
  expect(system).toContain("dilarang mengarang");
  expect(user).toContain("GAYA BALASAN");
  expect(user.toLowerCase()).toContain("santai");
  expect(user).toContain("rokok enak bgt");
});

test("argumen hasil klasifikasi diteruskan ke prompt balasan", () => {
  const user = buildMessages(
    { postText: "rokok enak bgt", author: "x", arguments: ["rokok itu hak"] },
    SANTAI,
  )[1]!.content;

  expect(user).toContain("Argumen pro-rokok yang terdeteksi");
  expect(user).toContain("rokok itu hak");
});

test("instruksi gaya membedakan santai dan formal", () => {
  const santai = buildMessages({ postText: "x", author: "a" }, SANTAI)[1]!.content.toLowerCase();
  const formal = buildMessages({ postText: "x", author: "a" }, FORMAL)[1]!.content.toLowerCase();

  expect(santai).toContain("santai");
  expect(formal).toContain("formal");
  expect(santai).not.toBe(formal);
});

test("instruksi bahasa mengikuti bahasa post", () => {
  const en: StyleInfo = { lang: "en", register: "netral", markers: [] };
  const messages = buildMessages({ postText: "smoking is fine", author: "a" }, en);
  expect(messages[1]!.content.toLowerCase()).toContain("inggris");
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
