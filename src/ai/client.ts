/**
 * Penyusun balasan untuk argumen pro-rokok.
 *
 * Aturan yang berlaku:
 * 1. Balasan SELALU dari LLM. Tidak ada fallback template — kalau LLM gagal,
 *    hasilnya `ok: false` dan pemanggil WAJIB melewati post itu (tidak membalas).
 * 2. Data pendukung SELALU dari internet (WHO, Wikipedia) lewat src/ai/research.ts.
 *    Tanpa fakta bersumber, balasan tidak dibuat: jangan berargumen tanpa data.
 * 3. Bahasa dan gaya balasan mengikuti post yang dibalas (src/ai/style.ts),
 *    supaya penulis post mudah memahaminya.
 */
import { env } from "../config/env";
import { Logger } from "../shared/logger";
import { fetchFacts, type FactSource } from "./research";
import { analyzeStyle, type StyleInfo } from "./style";

const logger = new Logger("AiReply");

export interface CounterReplyInput {
  postText: string;
  author: string;
  /** Argumen pro-rokok yang terdeteksi, dipakai memilih fakta yang relevan. */
  hits?: string[];
}

export interface CounterReply {
  /** false = balasan tidak layak dikirim (LLM gagal / tanpa data). Pemanggil harus melewati post. */
  ok: boolean;
  text: string;
  source: "llm";
  model?: string;
  error?: string;
  /** Fakta bersumber dari internet yang dipakai menyusun balasan. */
  facts: FactSource[];
  /** Bahasa + gaya post yang dideteksi, dipakai untuk menyesuaikan balasan. */
  style: StyleInfo;
}

const MAX_CHARS = 460;

export function clampReply(text: string, max = MAX_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Pilih fakta paling relevan dengan argumen yang terdeteksi. */
export function pickFact(
  facts: readonly FactSource[],
  hits: readonly string[] = [],
): FactSource | undefined {
  if (facts.length === 0) return undefined;

  const keywordMatch = facts.find((f) => {
    const claim = f.claim.toLowerCase();
    return hits.some((h) => {
      const key = h.split(" ").pop() ?? h;
      return key.length > 3 && claim.includes(key);
    });
  });

  return keywordMatch ?? facts[0];
}

const SYSTEM_PROMPT = [
  "Kamu menulis balasan Threads yang berbasis data.",
  "Tugas: tanggapi argumen yang membela/menormalkan rokok dengan satu koreksi faktual.",
  "Aturan wajib:",
  "- WAJIB memakai data dari daftar FAKTA BERSUMBER yang diberikan. Dilarang mengarang angka, studi, atau data lain.",
  "- Kalau sumbernya berbahasa Inggris, terjemahkan datanya ke bahasa balasan.",
  "- Sebut sumbernya lengkap beserta link dari internet yang mendukung",
  "- Jangan menyerang pribadi, jangan menyebut penulis bodoh",
  "- Output HANYA teks balasannya. Tanpa tanda kutip, tanpa penjelasan tambahan.",
  "- Output bisa berupa sarkastik dengan analogi yang memancing untuk dibalas orang lain"
].join("\n");

/** Pesan ke LLM — dipisah supaya bisa diuji tanpa memanggil jaringan. */
export function buildMessages(
  input: CounterReplyInput,
  facts: readonly FactSource[],
  style: StyleInfo,
): { role: "system" | "user"; content: string }[] {
  const factList = facts
    .map((f, i) => `${i + 1}. "${f.claim}" — sumber: ${f.source} (${f.url})`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Post dari @${input.author}:\n"""${input.postText}"""\n\n` +
        `Hanya membalas argumen yang menggunakan bahasa indonesia\n\n` +
        `FAKTA BERSUMBER (ambil dari sini, jangan mengarang):\n${factList}\n\n` +
        `Tulis balasannya.`,
    },
  ];
}

export interface GenerateOptions {
  /** Fakta siap pakai (mis. dari test). Kalau kosong, diambil dari internet. */
  facts?: readonly FactSource[];
  /** Topik untuk pencarian fakta di internet. */
  topics?: readonly string[];
}

export async function generateCounterReply(
  input: CounterReplyInput,
  options: GenerateOptions = {},
): Promise<CounterReply> {
  const style = analyzeStyle(input.postText);

  // 1. Data dulu. Tanpa fakta bersumber, tidak ada balasan.
  let facts: FactSource[] = [...(options.facts ?? [])];

  if (facts.length === 0) {
    const topics = options.topics ?? [...(input.hits ?? []), "bahaya rokok", "kesehatan"];
    facts = await fetchFacts(topics, 4).catch((err: unknown) => {
      logger.error(
        "gagal ambil fakta dari internet",
        err instanceof Error ? err.message : String(err),
      );
      return [] as FactSource[];
    });
  }

  if (facts.length === 0) {
    return {
      ok: false,
      text: "",
      source: "llm",
      error: "tidak ada fakta bersumber dari internet — balasan dibatalkan",
      facts: [],
      style,
    };
  }

  // 2. Balasan wajib dari LLM.
  if (!env.AI_API_KEY) {
    return {
      ok: false,
      text: "",
      source: "llm",
      error: "AI_API_KEY kosong — balasan hanya boleh dari LLM",
      facts,
      style,
    };
  }

  const url = `${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.6,
        max_tokens: 400,
        messages: buildMessages(input, facts, style),
      }),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) throw new Error("respons LLM kosong");

    return {
      ok: true,
      text: clampReply(text),
      source: "llm",
      model: env.AI_MODEL,
      facts,
      style,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("LLM gagal — balasan dibatalkan", message);
    return { ok: false, text: "", source: "llm", error: message, facts, style };
  }
}
