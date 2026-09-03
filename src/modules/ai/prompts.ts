/**
 * Prompt management: semua template prompt terpusat di sini.
 * Ubah gaya/instruksi edukasi cukup di file ini.
 */

const EDU_PERSONA = `Kamu adalah asisten edukasi kesehatan publik Indonesia.
Fokus: sosialisasi bahaya merokok, vape, dan asap rokok (rokok konvensional & elektrik).
Gaya: ramah, berbasis fakta ilmiah, tidak menghakimi perokok, bahasa Indonesia santai formal.
Hindari klaim medis tanpa dasar. Sertakan angka/fakta bila ada.`;

export function contentGenerationPrompt(topic: string, tone = "edukatif"): string {
  return `${EDU_PERSONA}

Tulis 1 konten edukasi bahaya rokok dengan topik: "${topic}".
Nada: ${tone}.
Panjang: 300-500 karakter (cocok untuk post Threads), boleh 1-3 paragraf pendek.
Format output: hanya teks konten, tanpa judul, tanpa penjelasan tambahan.`;
}

export function analysisPrompt(text: string): string {
  return `${EDU_PERSONA}

Analisis teks/event berikut dari platform Threads:
"""${text.slice(0, 4000)}"""

Tugas:
1. Apakah konten ini RELEVAN dengan edukasi bahaya rokok? (bisa berupa pertanyaan user, misinformasi, atau ajakan diskusi)
2. Beri alasan singkat.
3. Bila relevan, buat 1 draf respons edukatif 200-300 karakter.

Jawab HANYA dalam format JSON:
{"isRelevant": boolean, "reason": "alasan", "educationalResponse": "draf atau string kosong"}`;
}
