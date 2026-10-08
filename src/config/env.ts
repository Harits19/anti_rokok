import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Browser automation (Chromium) ---
  /** Profil Chromium persisten — berisi session login. Jangan pernah di-commit. */
  THREADS_PROFILE_DIR: z.string().default(".data/chromium-profile"),
  BROWSER_HEADLESS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  BROWSER_CHANNEL: z.enum(["chrome", "chromium"]).default("chrome"),
  BROWSER_SLOWMO_MS: z.coerce.number().int().min(0).default(120),

  /** true = tidak benar-benar klik apa pun (hanya log rencana aksi). */
  DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  /** Rate limit aksi tulis (post/like/reply/repost). */
  ACTION_MIN_DELAY_MS: z.coerce.number().int().positive().default(45_000),
  ACTION_MAX_DELAY_MS: z.coerce.number().int().positive().default(150_000),
  ACTION_MAX_PER_HOUR: z.coerce.number().int().positive().default(20),

  // --- LLM untuk menyusun balasan (opsional) ---
  /** Kosongkan untuk memakai balasan template (tanpa jaringan, tanpa biaya). */
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  /** Endpoint OpenAI-compatible; ganti kalau pakai provider lain (OpenRouter, Groq, lokal). */
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Environment variable tidak valid:");
  for (const issue of parsed.error.issues)
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
