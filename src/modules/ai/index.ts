import { env } from "../../config/env";
import { OpenAICompatProvider } from "./provider";
import type { AiProvider } from "./types";

let provider: AiProvider | null = null;

/** Factory: ganti provider cukup di sini (mis. AnthropicProvider baru). */
export function getAiProvider(): AiProvider {
  if (provider) return provider;

  const baseUrl = (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  provider = new OpenAICompatProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, baseUrl });
  return provider;
}
