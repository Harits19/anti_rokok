import { Router, type Request, type Response } from "express";
import { env } from "../../config/env";
import { badRequest, unauthorized } from "../../shared/errors";
import { analyzeText } from "../ai/service";
import { logger } from "../../shared/logger";
import { requireApiKey } from "../../middleware/auth";
import { publishText } from "./service";
import { publishTextInput } from "./schema";

export const threadsRoutes = Router();

/**
 * Verifikasi webhook (dipanggil Meta saat setup):
 * GET /threads/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 */
threadsRoutes.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  throw unauthorized("Verifikasi webhook gagal");
});

/** Terima event dari Threads. Tanpa DB: cukup log + analisis AI ke console. */
threadsRoutes.post("/webhook", async (req: Request, res: Response) => {
  const payload = req.body as unknown;
  logger.info("Webhook event diterima", { payload: JSON.stringify(payload).slice(0, 2000) });

  const texts = extractTexts(payload);
  for (const text of texts) {
    try {
      const analysis = await analyzeText(text);
      logger.info("Analisis event selesai", { isRelevant: analysis.isRelevant, reason: analysis.reason.slice(0, 200) });
    } catch (err) {
      logger.warn("Analisis AI gagal (dilewati)", { err: err instanceof Error ? err.message : String(err) });
    }
  }

  res.status(200).json({ status: "ok" });
});

// Route non-webhook threads WAJIB API key (webhook di atas tetap publik untuk Meta).
threadsRoutes.use(requireApiKey);

/** Publish teks mentah langsung ke Threads API via akun bot. */
threadsRoutes.post("/publish", async (req: Request, res: Response) => {
  const parsed = publishTextInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.status(201).json({ data: await publishText(parsed.data.text) });
});

/** Ekstrak teks dari format event Threads secara defensif. */
function extractTexts(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  const texts: string[] = [];

  const walk = (node: unknown): void => {
    if (typeof node === "string" && node.length > 2) {
      texts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object" && node !== null) {
      const obj = node as Record<string, unknown>;
      const candidates = ["text", "message", "caption", "body", "content", "post_text"];
      for (const key of candidates) {
        if (typeof obj[key] === "string") texts.push(obj[key]);
      }
    }
  };

  walk(record);
  return texts;
}
