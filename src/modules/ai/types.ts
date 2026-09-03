/** Hasil analisis konten/event oleh AI. */
export interface ContentAnalysis {
  isRelevant: boolean; // relevan dengan edukasi bahaya rokok?
  reason: string;
  educationalResponse?: string; // draf respons edukatif bila relevan
}

/** Kontrak provider AI. Pisah dari implementasi agar mudah ganti provider. */
export interface AiProvider {
  generateContent(prompt: string): Promise<string>;
  analyzeContent(text: string): Promise<ContentAnalysis>;
}
