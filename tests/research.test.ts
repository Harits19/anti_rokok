import { test, expect } from "bun:test";
import {
  htmlToText,
  splitSentences,
  pickSentences,
  extractEmbeddedStrings,
} from "../src/ai/research";

test("htmlToText membuang script/style/tag dan merapikan spasi", () => {
  const html = `<html><head><style>.a{color:red}</style><script>var x = 1;</script></head>
  <body><p>Rokok   mengandung   nikotin.</p><div>Asap rokok berbahaya.</div></body></html>`;
  const text = htmlToText(html);
  expect(text).not.toContain("var x");
  expect(text).not.toContain("color:red");
  expect(text).not.toContain("<p>");
  expect(text).toContain("Rokok mengandung nikotin.");
});

test("splitSentences membuang potongan markup, heading wiki, dan URL panjang", () => {
  const text =
    "== Persentase perokok ==\n" +
    "Perokok pasif berisiko lebih tinggi terkena kanker paru-paru dibanding orang yang tidak terpapar asap tembakau sama sekali.\n" +
    '{"json": "ini bukan kalimat"}\n' +
    "Lihat https://contoh.example/artikel-panjang-sekali-yang-tidak-perlu-masuk-balasan-ini";
  const sentences = splitSentences(text);

  expect(sentences.some((s) => s.includes("Perokok pasif berisiko"))).toBe(true);
  expect(sentences.some((s) => s.includes("=="))).toBe(false);
  expect(sentences.some((s) => s.includes('{"json"'))).toBe(false);
  expect(sentences.some((s) => s.includes("http"))).toBe(false);
});

test("splitSentences menyaring kalimat yang terlalu pendek atau terlalu panjang", () => {
  const short = "Rokok itu apa?";
  const long = `${"kata ".repeat(100)}rokok.`;
  const sentences = splitSentences(`${short}\n${long}`);
  expect(sentences).not.toContain(short);
  expect(sentences.length).toBe(0);
});

test("pickSentences mengutamakan kalimat berangka dan bertopik", () => {
  const text = [
    "Cuaca hari ini cukup panas di kota besar.",
    "Merokok menyebabkan 80-90% kasus kanker paru menurut data yang dikumpulkan.",
    "Rokok dapat menyebabkan berbagai penyakit.",
    "Harga cabai naik 20 persen.",
  ].join("\n");

  const picked = pickSentences(text, ["rokok", "kanker", "paru"], 2);
  expect(picked.length).toBeGreaterThan(0);
  expect(picked[0]).toContain("kanker paru");
  expect(picked.some((s) => s.includes("Harga cabai"))).toBe(false);
});

test("extractEmbeddedStrings mengambil teks dari JSON dalam script", () => {
  const html = `<html><body><div>pendek</div>
  <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"body":"Nikotin adalah zat adiktif yang membuat orang sulit berhenti merokok meski sudah ingin berhenti."}}}</script>
  </body></html>`;

  const strings = extractEmbeddedStrings(html);
  expect(strings.length).toBe(1);
  expect(strings[0]).toContain("Nikotin adalah zat adiktif");
});

test("extractEmbeddedStrings aman terhadap JSON rusak", () => {
  const html = `<script type="application/json">{bukan json}</script>`;
  expect(extractEmbeddedStrings(html)).toEqual([]);
});
