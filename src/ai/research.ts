/**
 * Pengumpul fakta dari internet untuk memperkuat balasan.
 *
 * Prinsip: jangan berargumen tanpa data. Setiap fakta wajib membawa sumber
 * (nama + URL) supaya bisa diverifikasi pembaca dan diaudit.
 *
 * Sumber diambil dari halaman otoritatif (WHO, Kemenkes, TCSC-IAKMI) serta
 * Wikipedia (id) untuk konteks berbahasa Indonesia. Halaman di-fetch langsung —
 * kalau gagal/timeout, caller memakai fakta kurasi (yang juga bersumber).
 */
import { Logger } from "../shared/logger";

const logger = new Logger("AiResearch");

export interface FactSource {
  /** Kalimat fakta, sudah dibersihkan dan dibatasi panjangnya. */
  claim: string;
  /** Nama sumber yang ditampilkan ke pembaca. */
  source: string;
  url: string;
  /** Bahasa sumber — balasan template lebih sopan kalau memakai fakta berbahasa Indonesia. */
  lang: "id" | "en";
}

interface SourceDef {
  source: string;
  url: string;
  /** "id" | "en" — dipakai untuk memilih halaman yang cocok dengan bahasa balasan. */
  lang: "id" | "en";
  /** Topik bahasa yang dipakai untuk menyaring kalimat di sumber ini. */
  topics?: readonly string[];
  /** URL yang ditampilkan ke pembaca kalau beda dari URL pengambilan data (mis. endpoint API). */
  citeUrl?: string;
}

/** Halaman berbahasa Inggris butuh kata kunci Inggris. */
export const EN_TOPICS: readonly string[] = [
  "tobacco",
  "smoking",
  "smoker",
  "cigarette",
  "nicotine",
  "cancer",
  "lung",
  "heart",
  "second-hand",
  "secondhand",
  "deaths",
  "addiction",
];

export const FACT_SOURCES: readonly SourceDef[] = [
  {
    source: "WHO",
    url: "https://www.who.int/news-room/fact-sheets/detail/tobacco",
    lang: "en",
    topics: EN_TOPICS,
  },
  {
    source: "Wikipedia (id)",
    url: "https://id.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Rokok%7CMerokok%7CNikotin%7CPerokok%20pasif%7CKanker%20paru-paru",
    lang: "id",
    citeUrl: "https://id.wikipedia.org/wiki/Rokok",
  },
  {
    source: "Wikipedia (en)",
    url: "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=Tobacco%20smoking%7CHealth%20effects%20of%20tobacco%20smoking%7CNicotine",
    lang: "en",
    topics: EN_TOPICS,
    citeUrl: "https://en.wikipedia.org/wiki/Tobacco_smoking",
  },
];

const DEFAULT_TOPICS = [
  "rokok",
  "merokok",
  "nikotin",
  "asap",
  "kanker",
  "paru",
  "jantung",
  "perokok pasif",
  "kecanduan",
  "kematian",
  "tembakau",
];

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Pecah jadi kalimat; buang yang terlalu pendek/panjang atau bukan kalimat. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 60 && s.length <= 320)
    .filter((s) => /[a-z]/i.test(s))
    // buang sisa markup: judul wiki (== ... ==), JSON, tag yang lolos.
    .filter((s) => !/[={}<>]|^\||\bhttp\S+\b/.test(s));
}

function collectStrings(value: unknown, out: string[], minLen: number): void {
  if (typeof value === "string") {
    const text = htmlToText(value);
    if (text.length >= minLen) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, minLen);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out, minLen);
  }
}

/**
 * Banyak situs (Next.js/React) menaruh teksnya di dalam JSON di dalam <script>,
 * bukan di HTML. Tanpa ini, halaman seperti ayosehat.kemkes.go.id terbaca kosong.
 */
export function extractEmbeddedStrings(html: string, minLen = 80): string[] {
  const out: string[] = [];
  const pattern =
    /<script[^>]*(?:type="application\/json"|id="__NEXT_DATA__")[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (!raw) continue;
    try {
      collectStrings(JSON.parse(raw), out, minLen);
    } catch {
      // bukan JSON valid → lewati
    }
  }

  return out;
}

/**
 * Pilih kalimat yang paling "berisi data": mengandung angka/persentase dan
 * menyebut topik rokok/kesehatan.
 */
export function pickSentences(
  text: string,
  topics: readonly string[] = DEFAULT_TOPICS,
  max = 3,
): string[] {
  const scored = splitSentences(text).map((sentence) => {
    const lower = sentence.toLowerCase();
    const topicHits = topics.filter((t) => lower.includes(t)).length;
    const hasNumber = /(\d[\d.,]*\s*(%|persen|juta|ribu|miliar|million|billion|tahun|kali))|\d/.test(lower);

    let score = topicHits * 2;
    if (hasNumber) score += 3;
    if (/\b(who|world health|kemenkes|riset|studi|penelitian|data|laporan)\b/.test(lower)) score += 2;

    // Kalimat panjang cenderung lebih informatif, tapi jangan ekstrem.
    if (sentence.length >= 90) score += 1;

    return { sentence, score, topicHits };
  });

  return scored
    .filter((s) => s.topicHits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.sentence);
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; text: string }>();

async function fetchText(url: string, timeoutMs = 20_000): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "id-ID,id;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} untuk ${url}`);

  const raw = await response.text();

  // Wikipedia action=query pakai JSON; ambil field extract-nya.
  let text = raw;
  if (url.includes("w/api.php")) {
    const data = JSON.parse(raw) as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = data.query?.pages ?? {};
    text = Object.values(pages)
      .map((p) => p.extract ?? "")
      .join("\n");
  } else if (raw.trimStart().startsWith("<")) {
    // Teks HTML + teks yang tersembunyi di JSON dalam <script> (situs Next/React).
    text = [htmlToText(raw), ...extractEmbeddedStrings(raw)].join("\n");
  }

  cache.set(url, { at: Date.now(), text });
  return text;
}

/**
 * Ambil fakta bersumber dari internet. Tidak pernah melempar error: sumber yang
 * gagal dilewati, dan daftar kosong berarti caller harus memakai fakta kurasi.
 */
export async function fetchFacts(
  topics: readonly string[] = DEFAULT_TOPICS,
  limit = 3,
): Promise<FactSource[]> {
  const results = await Promise.allSettled(
    FACT_SOURCES.map(async (def) => {
      const topicsForSource = def.topics ?? (topics.length > 0 ? [...topics, ...DEFAULT_TOPICS] : DEFAULT_TOPICS);
      const text = await fetchText(def.url);
      const sentences = pickSentences(text, topicsForSource, 2);
      return sentences.map(
        (claim) =>
          ({
            claim,
            source: def.source,
            url: def.citeUrl ?? def.url,
            lang: def.lang,
          }) as FactSource,
      );
    }),
  );

  const facts: FactSource[] = [];
  for (const [i, result] of results.entries()) {
    const def = FACT_SOURCES[i];
    if (result.status === "rejected") {
      logger.warn(`sumber dilewati: ${def?.source}`, String(result.reason).slice(0, 120));
      continue;
    }
    facts.push(...result.value);
  }

  // Dedupe berdasarkan kalimat (beberapa sumber bisa memuat kalimat sama).
  const seen = new Set<string>();
  const unique = facts.filter((f) => {
    const key = f.claim.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logger.info(`fakta terkumpul: ${unique.length} dari ${FACT_SOURCES.length} sumber`);
  return unique.slice(0, limit);
}
