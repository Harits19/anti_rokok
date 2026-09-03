import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_PATH: z.string().default("./data/anti_rokok.db"),
  THREADS_APP_ID: z.string().default(""),
  THREADS_APP_SECRET: z.string().default(""),
  THREADS_REDIRECT_URI: z.string().default(""),
  WEBHOOK_VERIFY_TOKEN: z.string().default(""),
  AI_PROVIDER: z.enum(["openai", "openai-compatible"]).default("openai"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  AI_BASE_URL: z.string().url().optional().or(z.literal("")),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Environment variable tidak valid:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
