import { z } from "zod";

export const createContentInput = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Konten tidak boleh kosong").max(5000),
  campaignId: z.number().int().positive().optional(),
});

export const generateContentInput = z.object({
  topic: z.string().trim().min(3, "Topik terlalu pendek").max(200),
  tone: z.string().trim().max(50).optional(),
});

export const contentQuery = z.object({
  status: z.enum(["draft", "pending_approval", "approved", "rejected", "published"]).optional(),
});

export type CreateContentInput = z.infer<typeof createContentInput>;
export type GenerateContentInput = z.infer<typeof generateContentInput>;
