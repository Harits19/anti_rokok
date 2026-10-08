/**
 * Klasifikasi opini post terhadap bahaya rokok.
 *
 * Ini heuristik kata kunci, BUKAN pemahaman bahasa. Tujuannya: murah, cepat,
 * deterministik, dan bisa diuji. Skor + kata kunci pemicu selalu dikembalikan
 * supaya keputusan bisa diaudit (dan ditolak) oleh manusia atau klien AI.
 *
 * Kalau nanti butuh akurasi lebih, ganti fungsi ini dengan panggilan LLM —
 * kontraknya sengaja tetap sederhana supaya mudah ditukar.
 */

export interface StanceResult {
  /** true = post mendukung bahaya rokok (pro kesehatan). */
  proHealth: boolean;
  score: number;
  /** Kata kunci pendukung bahaya rokok yang ketemu. */
  hits: string[];
  /** Kata kunci yang menyepelekan/normalisasi rokok. */
  against: string[];
}

/** Frase yang menunjukkan dukungan pada bahaya rokok / anti merokok. */
export const PRO_HEALTH_PHRASES: readonly string[] = [
  "bahaya rokok",
  "bahaya merokok",
  "bahaya vape",
  "rokok haram",
  "haram",
  "berhenti merokok",
  "berhenti dari rokok",
  "stop merokok",
  "stop rokok",
  "berhasil berhenti",
  "bebas asap",
  "tanpa rokok",
  "kawasan tanpa rokok",
  "anti rokok",
  "tolak rokok",
  "kecanduan",
  "candu",
  "nikotin",
  "kanker",
  "paru",
  "stroke",
  "jantung",
  "asap rokok",
  "perokok pasif",
  "asapnya",
  "terbebas dari candu",
  "tidak merokok",
  "gak merokok",
  "ga merokok",
  "enggak merokok",
  "udah stop",
  "sudah stop",
  "dampak buruk",
  "pajak rokok",
  "cukai",
  "iklan rokok",
  "anak merokok",
  "pelajar merokok",
  "menyesal merokok",
  "sesak",
  "bau rokok",
  "pengen berhenti",
];

/** Frase yang menyepelekan, membela, atau menormalkan rokok. */
export const AGAINST_PHRASES: readonly string[] = [
  "rokok itu enak",
  "enak banget merokok",
  "jangan dilarang",
  "rokok bukan masalah",
  "rokok bukan penyebab",
  "bola liar",
  "gak masalah merokok",
  "ga masalah merokok",
  "wajar merokok",
  "hak merokok",
  "rokok murah",
  "rokok naik terus",
  "gimana mau berhenti",
];

const AGAINST_WEIGHT = 1.5;

export function classifyRokokStance(text: string): StanceResult {
  const haystack = text.toLowerCase();

  const hits = PRO_HEALTH_PHRASES.filter((p) => haystack.includes(p));
  const against = AGAINST_PHRASES.filter((p) => haystack.includes(p));

  const score = hits.length - against.length * AGAINST_WEIGHT;

  return { proHealth: hits.length > 0 && score > 0, score, hits, against };
}
