/**
 * Transport LLM (endpoint OpenAI-compatible).
 *
 * Semua panggilan LLM lewat sini: klasifikasi post dan penyusunan balasan
 * memakai jalur yang sama supaya penanganan error, timeout, dan parsing
 * respons konsisten.
 */
import { env } from "../config/env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Label untuk log, mis. "klasifikasi" atau "balasan". */
  label?: string;
}

/** Error panggilan LLM. Semua kegagalan jaringan/HTTP/parsing dibungkus ini. */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface ChatResult {
  text: string;
  model: string;
}

/** Satu kali chat completion. Melempar LlmError kalau gagal. */
export async function chatCompletion(
  messages: readonly ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  if (!env.AI_API_KEY) throw new LlmError("AI_API_KEY kosong");

  const url = `${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 400,
      messages,
    }),
    signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LlmError(`HTTP ${response.status} ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) throw new LlmError(`respons LLM kosong (${options.label ?? "llm"})`);

  return { text, model: env.AI_MODEL };
}
