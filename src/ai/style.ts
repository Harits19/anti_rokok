/**
 * Deteksi bahasa + gaya bahasa post, supaya balasan "nyambung" dengan penulisnya.
 *
 * Heuristik kata (bukan model bahasa): murah, deterministik, dan bisa diuji.
 * Hasilnya dipakai untuk menyusun instruksi ke LLM, mis. "balas dalam bahasa
 * Indonesia dengan gaya santai seperti penulis post".
 */

export type ReplyLanguage = "id" | "en" | "other";
export type ReplyRegister = "santai" | "netral" | "formal";

export interface StyleInfo {
  lang: ReplyLanguage;
  register: ReplyRegister;
  /** Kata-kata pemicu yang terdeteksi, untuk transparansi/audit. */
  markers: string[];
}

const ID_MARKERS =
  /\b(yang|dan|tidak|gue|gua|aku|kamu|ini|itu|jangan|udah|kalo|kalau|banget|bgt|sih|dong|kok|nggak|gak|enggak|wkwk|cuy|bro|lur|ges|njir|anjir|juga|bisa|ada|apa|kenapa|gimana|buat|dari|dengan|untuk|karena|emang|emg|kyk|kayak|malah|toh|mah|nih|tuh|bakal|gimana|biar|jadi|udh|aja|saja|pake|pakai|merokok|rokok)\b/gi;

const EN_MARKERS =
  /\b(the|is|are|was|were|you|your|that|this|and|but|how|why|what|with|for|not|just|like|really|about|people|smoke|smoking|tobacco|cigarette|health|risk|because|there|they)\b/gi;

const SANTAI_MARKERS =
  /\b(gue|gua|gw|aku|banget|bgt|sih|dong|kok|wkwk|hehe|haha|anjir|njir|anjay|cuy|bro|lur|ges|nggak|gak|ga|emg|emang|kyk|kayak|bang|tolol|nyepong|ngerokok|rokoknya|gue?|doang|banget|bgt|plis|pls|lah|deh|nih|tuh|mah)\b/gi;

const FORMAL_MARKERS =
  /\b(saya|anda|kami|mereka|tidak|bukan|apabila|bilamana|tersebut|merupakan|hendaknya|sebaiknya|mohon|dimohon|saudara|bapak|ibu|terima kasih|dapat|tersebut|yakni|yaitu|sehingga|maupun|diperlukan)\b/gi;

function countMatches(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => (m[0] ?? "").toLowerCase());
}

export function detectLanguage(text: string): ReplyLanguage {
  const id = countMatches(text, ID_MARKERS).length;
  const en = countMatches(text, EN_MARKERS).length;

  if (id === 0 && en === 0) return "other";
  if (en > id * 1.5) return "en";
  return "id";
}

export function detectRegister(text: string): ReplyRegister {
  const santai = countMatches(text, SANTAI_MARKERS).length;
  const formal = countMatches(text, FORMAL_MARKERS).length;

  if (santai >= 2 && santai > formal) return "santai";
  if (formal > santai * 1.5 && formal >= 1) return "formal";
  if (santai === 1 && formal === 0) return "santai";
  return "netral";
}

export function analyzeStyle(text: string): StyleInfo {
  const markers = [
    ...new Set([
      ...countMatches(text, SANTAI_MARKERS),
      ...countMatches(text, FORMAL_MARKERS),
    ]),
  ].slice(0, 8);

  return {
    lang: detectLanguage(text),
    register: detectRegister(text),
    markers,
  };
}

