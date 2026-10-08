import { test, expect } from "bun:test";
import { classifyRokokStance } from "../src/modules/threads/classify";

test("post yang menekankan bahaya rokok dianggap pro kesehatan", () => {
  const r = classifyRokokStance(
    "Kalau asap rokok menempel di baju 19 bulan, di sofa berbulan-bulan. Itu bahaya rokok yang jarang dibahas.",
  );
  expect(r.proHealth).toBe(true);
  expect(r.score).toBeGreaterThan(0);
  expect(r.hits).toContain("bahaya rokok");
});

test("ajakan berhenti merokok dianggap pro kesehatan", () => {
  const r = classifyRokokStance(
    "Mau ngumpulin temen yang sudah berhasil berhenti dari candu rokok. kalian udah stop rokok berapa lama?",
  );
  expect(r.proHealth).toBe(true);
});

test("post yang menormalkan rokok ditolak", () => {
  const r = classifyRokokStance(
    "rokok itu enak banget, jangan dilarang lah, hak merokok setiap orang",
  );
  expect(r.proHealth).toBe(false);
  expect(r.against.length).toBeGreaterThan(0);
});

test("teks tanpa sinyal tidak dianggap pro kesehatan", () => {
  const r = classifyRokokStance("Hari ini cuacanya panas sekali ya");
  expect(r.proHealth).toBe(false);
  expect(r.hits).toEqual([]);
  expect(r.score).toBe(0);
});

test("frasa negatif berat menang atas sinyal positif tunggal", () => {
  const r = classifyRokokStance("bahaya rokok itu hoaks, jangan dilarang, hak merokok");
  expect(r.proHealth).toBe(false);
});
