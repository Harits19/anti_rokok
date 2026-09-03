import { z } from "zod";

export const createCampaignInput = z.object({
  name: z.string().trim().min(3, "Nama campaign minimal 3 karakter").max(200),
  description: z.string().trim().max(1000).optional(),
});

export const scheduleCampaignInput = z.object({
  scheduleAt: z.string().datetime({ offset: true }).or(z.string().datetime()), // ISO 8601
  contentIds: z.array(z.number().int().positive()).min(1, "Pilih minimal 1 konten").default([]),
});

export const reviewContentInput = z.object({
  contentId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignInput>;
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignInput>;
