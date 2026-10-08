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

/**
 * Argumen "mendukung rokok" — terutama yang keliru/keliru secara faktual.
 * Ini yang jadi sasaran balasan.
 */
export const PRO_ROKOK_ARGUMENTS: readonly string[] = [
  "rokok bikin fokus",
  "rokok bikin santai",
  "rokok bikin ga stres",
  "rokok bantu stress",
  "rokok bikin kurus",
  "rokok bukan penyebab kanker",
  "rokok bukan penyebab",
  "rokok gak bikin sakit",
  "rokok itu hak",
  "hak merokok",
  "jangan dilarang",
  "rokok itu enak",
  "kenapa si rokok enak",
  "enak bgt",
  "enak banget",
  "gue suka rokok",
  "saya suka merokok",
  "rokok bukan masalah",
  "rokok bukan apa-apa",
  "atur aja",
  "yang penting gue",
  "yang mati kan yang ngerokok",
  "kan yang ngerokok sendiri",
  "gak ganggu orang lain",
  "asap knalpot",
  "knalpot lebih bahaya",
  "negara dapat cukai",
  "petani tembakau",
  "dilarang malah makin mahal",
  "dilarang malah tambah enak",
  "malah banyak yang sakit padahal gak ngerokok",
  "orang gak ngerokok juga sakit",
  "berhenti malah gemuk",
  "berhenti malah tambah batuk",
  "udah kebiasaan susah",
  "hidup sekali",
  "rokok teman begadang",
  "rokok biar gak ngantuk",
  "vape lebih bahaya dari rokok",
  "para ahli juga",
  "masa sih",
];

export interface ProRokokResult {
  /** true = post membela/menormalkan rokok dengan argumen keliru. */
  proRokok: boolean;
  score: number;
  hits: string[];
}

/**
 * Pola argumen pro-rokok yang lebih luwes daripada daftar frasa kaku.
 * Frasa persis sering meleset karena orang menulis dengan variasi ("rokoknya enak",
 * "ga masalah merokok", "rokok itu hak"). Label dipakai untuk pelaporan.
 */
export const PRO_ROKOK_PATTERNS: readonly { label: string; re: RegExp }[] = [
  { label: "rokok itu enak/nikmat", re: /rokok(nya|nya\?| itu| tuh)?\s*(enak|nikmat|mantap|lezat|oke|top)\b/i },
  { label: "enak/nikmat + rokok", re: /(enak|nikmat|mantap|lezat|suka|cinta|prefer)\b.{0,30}rokok/i },
  { label: "rokok tidak apa-apa", re: /\b(ga|gak|enggak|tidak|tdk|gpp|gapapa)\s*(ada)?\s*(masalah|apa-apa|ganggu|ngefek|berpengaruh)\b.{0,40}rokok/i },
  { label: "rokok itu hak/pilihan", re: /rokok\b.{0,20}\b(hak|pilihan|kebebasan)\b/i },
  { label: "jangan dilarang", re: /\b(jangan|gak usah|ga usah|jgn|nggak usah)\s*(dilarang|dibatas|dipajak|naikin)/i },
  { label: "yang lain lebih bahaya", re: /\b(knalpot|polusi|asap pabrik|kendaraan|junk ?food)\b.{0,30}\blebih\s*(bahaya|parah|buruk)/i },
  { label: "rokok bantu fokus/santai", re: /rokok\b.{0,25}\b(bikin|buat|bantu|biar|bikin)\s*(fokus|santai|tenang|rileks|gak ngantuk|ga ngantuk|kurang stress|ngurangin stress)/i },
  { label: "yang mati yang ngerokok sendiri", re: /\b(yang|yg)\s*(mati|sakit|kena)\b.{0,20}\b(yg|yang)\s*(ngerokok|merokok)/i },
  { label: "rokok bukan penyebab", re: /rokok\b.{0,20}\b(bukan|bkn|bukanlah)\s*(masalah|penyebab|bikin sakit)/i },
  { label: "mending merokok daripada", re: /\b(mending|lebih baik|mendingan)\b.{0,20}\b(merokok|rokok)\b/i },
  { label: "rokok teman begadang/kerja", re: /rokok\b.{0,20}\b(teman|kawan|partner)\s*(begadang|kerja|lembur|nongkrong)/i },
];

export function classifyProRokokStance(text: string): ProRokokResult {
  const lower = text.toLowerCase();

  const phraseHits = PRO_ROKOK_ARGUMENTS.filter((p) => lower.includes(p));
  const patternHits = PRO_ROKOK_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  const hits = [...new Set([...phraseHits, ...patternHits])];

  const health = classifyRokokStance(text);
  const score = hits.length - health.hits.length * 1.5;

  return { proRokok: hits.length > 0 && score > 0 && !health.proHealth, score, hits };
}
