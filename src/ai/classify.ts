/**
 * Klasifikasi sikap post terhadap rokok — sepenuhnya oleh LLM.
 *
 * Tiga hasil: "proRokok" (dibalas/counter), "proHealth" (di-like), "lain"
 * (dilewati). Alasan + argumen dipakai untuk audit dan memberi sudut balasan
 * ke LLM penyusun balasan (src/ai/client.ts).
 *
 * Prompt dan parser dipisah dari panggilan jaringan supaya bisa diuji tanpa
 * memanggil LLM.
 */
import { chatCompletion, type ChatMessage } from "./llm";

/** Sikap post terhadap rokok, hasil klasifikasi LLM. */
export type RokokStance = "proRokok" | "proHealth" | "lain";

export interface ProRokokVerdict {
  /** proRokok = membela/menormalkan; proHealth = mengingatkan bahaya/anti rokok. */
  stance: RokokStance;
  /** Pintasan `stance === "proRokok"`; post seperti ini dibalas (counter). */
  proRokok: boolean;
  /** Pintasan `stance === "proHealth"`; post seperti ini di-like. */
  proHealth: boolean;
  /** Alasan singkat dari LLM, untuk audit/laporan. */
  reason: string;
  /** Argumen pro-rokok yang terdeteksi, mis. "rokok itu hak". */
  arguments: string[];
}

export interface ClassifyInput {
  postText: string;
  author: string;
}

export const CLASSIFY_SYSTEM_PROMPT = [
  "Kamu pengklasifikasi opini publik berbahasa Indonesia tentang rokok.",
  "Tugas: tentukan sikap sebuah post terhadap rokok, salah satu dari:",
  '- "proRokok" = membela/menormalkan/menyepelekan rokok, termasuk alasan keliru',
  '  ("rokok itu hak", "yang mati kan yang ngerokok sendiri", "rokok bikin fokus",',
  '  "knalpot lebih bahaya", "rokok bukan penyebab kanker").',
  '- "proHealth" = menekankan bahaya rokok, mengajak berhenti, anti rokok, atau',
  "  mendukung kebijakan pengendalian tembakau.",
  '- "lain" = netral, sekadar bertanya/berita, tidak membahas rokok, atau tidak jelas.',
  "Balas HANYA JSON valid, tanpa markdown dan tanpa penjelasan tambahan, bentuknya:",
  '{"sikap": "proRokok"|"proHealth"|"lain", "alasan": "<satu kalimat bahasa Indonesia>", "argumen": ["<argumen pro-rokok yang terdeteksi>"]}',
].join("\n");

/** Pesan klasifikasi — dipisah supaya bisa diuji tanpa jaringan. */
export function buildClassifyMessages(input: ClassifyInput): ChatMessage[] {
  return [
    { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Post dari @${input.author}:\n"""${input.postText}"""\n\n` +
        `Bagaimana sikap post ini terhadap rokok? Jawab dalam JSON.`,
    },
  ];
}

/** Ambil objek JSON pertama di dalam teks (LLM kadang membungkus dengan ```json). */
export function extractJson(raw: string): string | undefined {
  const withoutFence = raw.replace(/```(?:json)?/gi, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  return withoutFence.slice(start, end + 1);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function asStance(record: Record<string, unknown>): RokokStance {
  const raw = typeof record.sikap === "string" ? record.sikap.trim().toLowerCase() : "";
  if (raw === "prorokok") return "proRokok";
  if (raw === "prohealth") return "proHealth";
  if (raw === "lain") return "lain";

  // Bentuk lama/alternatif: hanya boolean.
  if (record.proRokok === true || record.proRokok === "true") return "proRokok";
  if (record.proHealth === true || record.proHealth === "true") return "proHealth";
  return "lain";
}

/**
 * Baca jawaban LLM jadi verdict. Toleran terhadap markdown/teks pembungkus.
 * Kalau tidak bisa dibaca: dianggap "lain" (post dilewati) — bukan dipaksa
 * dibalas atau di-like.
 */
export function parseVerdict(raw: string): ProRokokVerdict {
  const fallback: ProRokokVerdict = {
    stance: "lain",
    proRokok: false,
    proHealth: false,
    reason: "",
    arguments: [],
  };

  const json = extractJson(raw);
  if (!json) return { ...fallback, reason: "jawaban LLM bukan JSON" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...fallback, reason: "jawaban LLM bukan JSON valid" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ...fallback, reason: "jawaban LLM bukan objek JSON" };
  }

  const record = parsed as Record<string, unknown>;
  const stance = asStance(record);
  const reason = typeof record.alasan === "string" ? record.alasan.trim() : "";
  const args = asStringArray(record.argumen);

  return {
    stance,
    proRokok: stance === "proRokok",
    proHealth: stance === "proHealth",
    reason,
    arguments: args,
  };
}

/** Klasifikasi lewat LLM. Melempar LlmError kalau panggilan LLM gagal. */
export async function classifyPostStance(input: ClassifyInput): Promise<ProRokokVerdict> {
  const { text } = await chatCompletion(buildClassifyMessages(input), {
    temperature: 0,
    maxTokens: 300,
    label: "klasifikasi",
  });

  return parseVerdict(text);
}
