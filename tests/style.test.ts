import { test, expect } from "bun:test";
import {
  analyzeStyle,
  detectLanguage,
  detectRegister,
  buildStyleInstruction,
} from "../src/ai/style";

test("deteksi bahasa Indonesia pada post santai", () => {
  expect(detectLanguage("kenapa si rokok enak bgt? gue gak ngerti")).toBe("id");
});

test("deteksi bahasa Inggris", () => {
  expect(
    detectLanguage("I really think smoking is fine, the government should not ban it"),
  ).toBe("en");
});

test("teks tanpa penanda jelas dianggap other", () => {
  expect(detectLanguage("🚬🚬🚬")).toBe("other");
});

test("post santai dikenali sebagai santai", () => {
  expect(detectRegister("rokok gue emang enak banget sih, wkwk")).toBe("santai");
});

test("post formal dikenali sebagai formal", () => {
  expect(
    detectRegister("Menurut saya, kebijakan tersebut tidak seharusnya diberlakukan kepada masyarakat."),
  ).toBe("formal");
});

test("post biasa dianggap netral", () => {
  expect(detectRegister("Harga rokok naik bulan ini")).toBe("netral");
});

test("analyzeStyle menggabungkan bahasa dan gaya", () => {
  const style = analyzeStyle("rokok gue enak banget sih, gak usah dilarang lah");
  expect(style.lang).toBe("id");
  expect(style.register).toBe("santai");
  expect(style.markers.length).toBeGreaterThan(0);
});

test("instruksi gaya menyebut bahasa dan register yang sesuai", () => {
  const santaiId = buildStyleInstruction({ lang: "id", register: "santai", markers: [] });
  expect(santaiId).toContain("bahasa Indonesia");
  expect(santaiId.toLowerCase()).toContain("santai");

  const formalId = buildStyleInstruction({ lang: "id", register: "formal", markers: [] });
  expect(formalId.toLowerCase()).toContain("formal");
  expect(formalId).toContain("Anda");

  const en = buildStyleInstruction({ lang: "en", register: "netral", markers: [] });
  expect(en).toContain("Inggris");

  const other = buildStyleInstruction({ lang: "other", register: "netral", markers: [] });
  expect(other).toContain("bahasa yang sama");
});
