import { getAiProvider } from "./index";
import { analysisPrompt, contentGenerationPrompt } from "./prompts";
import type { ContentAnalysis } from "./types";

/** Generate draf konten edukasi berdasarkan topik. */
export async function generateContent(topic: string, tone?: string): Promise<string> {
  const prompt = contentGenerationPrompt(topic, tone);
  return getAiProvider().generateContent(prompt);
}

/** Analisis teks/event: relevan tidaknya dengan edukasi bahaya rokok. */
export async function analyzeText(text: string): Promise<ContentAnalysis> {
  const prompt = analysisPrompt(text);
  return getAiProvider().analyzeContent(prompt);
}
