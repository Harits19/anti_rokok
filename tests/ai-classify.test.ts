import { test, expect } from "bun:test";
import {
  buildClassifyMessages,
  extractJson,
  parseVerdict,
} from "../src/ai/classify";

test("prompt klasifikasi memuat tiga sikap dan minta JSON", () => {
  const messages = buildClassifyMessages({ postText: "rokok enak bgt", author: "x" });
  const system = messages[0]!.content;

  expect(messages[0]!.role).toBe("system");
  expect(system).toContain('"proRokok"');
  expect(system).toContain('"proHealth"');
  expect(system).toContain('"lain"');
  expect(messages[1]!.content).toContain("rokok enak bgt");
});

test("sikap proRokok dibaca dari JSON", () => {
  const v = parseVerdict(
    '{"sikap": "proRokok", "alasan": "menormalkan rokok", "argumen": ["rokok itu hak"]}',
  );
  expect(v.stance).toBe("proRokok");
  expect(v.proRokok).toBe(true);
  expect(v.proHealth).toBe(false);
  expect(v.reason).toBe("menormalkan rokok");
  expect(v.arguments).toEqual(["rokok itu hak"]);
});

test("sikap proHealth dibaca dari JSON", () => {
  const v = parseVerdict(
    '{"sikap": "proHealth", "alasan": "mengingatkan bahaya rokok", "argumen": []}',
  );
  expect(v.stance).toBe("proHealth");
  expect(v.proHealth).toBe(true);
  expect(v.proRokok).toBe(false);
});

test("sikap lain dibaca dari JSON", () => {
  const v = parseVerdict('{"sikap": "lain", "alasan": "berita harga rokok", "argumen": []}');
  expect(v.stance).toBe("lain");
  expect(v.proRokok).toBe(false);
  expect(v.proHealth).toBe(false);
});

test("sikap tanpa spasi besar/kecil tetap dikenali", () => {
  expect(parseVerdict('{"sikap": "ProHealth"}').stance).toBe("proHealth");
  expect(parseVerdict('{"sikap": "PROROKOK"}').stance).toBe("proRokok");
});

test("bentuk lama (hanya boolean) masih terbaca", () => {
  expect(parseVerdict('{"proRokok": true}').proRokok).toBe(true);
  expect(parseVerdict('{"proHealth": true}').proHealth).toBe(true);
});

test("JSON di dalam markdown fence tetap terbaca", () => {
  const v = parseVerdict(
    'Ini hasilnya:\n```json\n{"sikap": "proRokok", "alasan": "x", "argumen": ["rokok bikin fokus"]}\n```\n',
  );
  expect(v.proRokok).toBe(true);
  expect(v.arguments).toEqual(["rokok bikin fokus"]);
});

test("jawaban kacau dianggap lain — tidak dibalas, tidak di-like", () => {
  for (const raw of ["", "maaf saya tidak bisa", "{bukan json}", "null", "[]"]) {
    const v = parseVerdict(raw);
    expect(v.stance).toBe("lain");
    expect(v.proRokok).toBe(false);
    expect(v.proHealth).toBe(false);
    expect(v.arguments).toEqual([]);
  }
});

test("argumen non-string dibuang dan string kosong dibuang", () => {
  const v = parseVerdict('{"sikap": "proRokok", "argumen": ["ok", 1, "  ", null]}');
  expect(v.arguments).toEqual(["ok"]);
});

test("extractJson ambil objek pertama saja", () => {
  expect(extractJson('teks {"a":1} sisa')).toBe('{"a":1}');
  expect(extractJson("tanpa json")).toBeUndefined();
});
