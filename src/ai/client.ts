/**
 * Penyusun balasan untuk argumen pro-rokok.
 *
 * Aturan yang berlaku:
 * 1. Balasan SELALU dari LLM. Tidak ada fallback template — kalau LLM gagal,
 *    hasilnya `ok: false` dan pemanggil WAJIB melewati post itu (tidak membalas).
 * 2. Data pendukung datang dari pengetahuan LLM sendiri (tanpa scraping manual).
 *    LLM wajib menyebut sumbernya; dilarang mengarang angka, studi, atau tautan.
 * 3. Bahasa dan gaya balasan mengikuti post yang dibalas (src/ai/style.ts),
 *    supaya penulis post mudah memahaminya.
 */
import { Logger } from "../shared/logger";
import { chatCompletion, type ChatMessage } from "./llm";
import { analyzeStyle, buildStyleInstruction, type StyleInfo } from "./style";

const logger = new Logger("AiReply");

export interface CounterReplyInput {
  postText: string;
  author: string;
  /** Argumen pro-rokok hasil klasifikasi LLM, dipakai memilih sudut balasan. */
  arguments?: readonly string[];
}

export interface CounterReply {
  /** false = balasan tidak layak dikirim (LLM gagal). Pemanggil harus melewati post. */
  ok: boolean;
  text: string;
  source: "llm";
  model?: string;
  error?: string;
  /** Bahasa + gaya post yang dideteksi, dipakai untuk menyesuaikan balasan. */
  style: StyleInfo;
}

const MAX_CHARS = 460;

export function clampReply(text: string, max = MAX_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

const SYSTEM_PROMPT = [
  "Kamu menulis balasan Threads yang berbasis data.",
  "Tugas: tanggapi argumen yang membela/menormalkan rokok dengan satu koreksi faktual.",
  "Aturan wajib:",
  "- Pakai data faktual yang kamu yakini benar. Dilarang mengarang angka, studi, atau tautan.",
  "- Sebut sumbernya (mis. WHO, Kemenkes, studi ilmiah) lengkap dengan tautannya.",
  "- Kalau sumbernya berbahasa Inggris, terjemahkan datanya ke bahasa balasan.",
  "- Jangan menyerang pribadi, jangan menyebut penulis bodoh.",
  "- Output HANYA teks balasannya. Tanpa tanda kutip, tanpa penjelasan tambahan.",
  "- Output bisa berupa sarkastik dengan analogi yang memancing untuk dibalas orang lain.",
  "- Output bernada provokatif untuk memancing perdebatan.",
].join("\n");

/** Pesan ke LLM — dipisah supaya bisa diuji tanpa memanggil jaringan. */
export function buildMessages(
  input: CounterReplyInput,
  style: StyleInfo,
): ChatMessage[] {
  const args = input.arguments ?? [];
  const argumentBlock =
    args.length > 0
      ? `Argumen pro-rokok yang terdeteksi:\n${args.map((a) => `- ${a}`).join("\n")}\n\n`
      : "";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Post dari @${input.author}:\n"""${input.postText}"""\n\n` +
        argumentBlock +
        `GAYA BALASAN:\n${buildStyleInstruction(style)}\n\n` +
        `Tulis balasannya.`,
    },
  ];
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateCounterReply(
  input: CounterReplyInput,
  options: GenerateOptions = {},
): Promise<CounterReply> {
  const style = analyzeStyle(input.postText);

  try {
    const { text, model } = await chatCompletion(buildMessages(input, style), {
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 400,
      label: "balasan",
    });

    return {
      ok: true,
      text: clampReply(text),
      source: "llm",
      model,
      style,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("LLM gagal — balasan dibatalkan", message);
    return { ok: false, text: "", source: "llm", error: message, style };
  }
}
