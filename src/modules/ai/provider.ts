import { AppError, serviceUnavailable } from "../../shared/errors";
import type { AiProvider, ContentAnalysis } from "./types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAICompatConfig {
  apiKey: string;
  model: string;
  baseUrl: string; // sudah termasuk /v1
}

/**
 * Provider OpenAI-compatible (OpenAI, Groq, Together, Ollama via proxy, dll).
 * Cukup ganti baseUrl/key. Implementasi lain cukup mengikuti kontrak AiProvider.
 */
export class OpenAICompatProvider implements AiProvider {
  constructor(private readonly config: OpenAICompatConfig) {}

  async generateContent(prompt: string): Promise<string> {
    const content = await this.chat([
      { role: "system", content: "Kamu asisten penulis konten yang ringkas dan akurat." },
      { role: "user", content: prompt },
    ]);
    return content;
  }

  async analyzeContent(text: string): Promise<ContentAnalysis> {
    const raw = await this.chat([
      { role: "system", content: "Kamu asisten analisis konten. Selalu jawab JSON valid." },
      { role: "user", content: text },
    ]);

    try {
      const parsed = JSON.parse(extractJson(raw)) as Partial<ContentAnalysis>;
      if (typeof parsed.isRelevant !== "boolean") throw new Error("isRelevant bukan boolean");
      return {
        isRelevant: parsed.isRelevant,
        reason: parsed.reason ?? "",
        educationalResponse: parsed.educationalResponse ?? "",
      };
    } catch {
      throw new AppError(502, "AI_BAD_RESPONSE", "Respons AI bukan JSON yang valid", { raw: raw.slice(0, 500) });
    }
  }

  private async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.config.apiKey) {
      throw serviceUnavailable("OPENAI_API_KEY belum diisi. Lihat .env.example");
    }

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: this.config.model, messages }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new AppError(502, "AI_REQUEST_FAILED", `AI API error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new AppError(502, "AI_EMPTY_RESPONSE", "AI API mengembalikan konten kosong");
    return content;
  }
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}
