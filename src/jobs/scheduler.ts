import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../database/client";
import { campaigns, contents } from "../database/schema";
import { logActivity } from "../shared/activity";
import { logger } from "../shared/logger";
import { completeCampaign, findDueCampaigns } from "../modules/campaign/service";
import { publishContent } from "../modules/content/service";

/**
 * Scheduler MVP berbasis interval (tanpa Redis/broker):
 * tiap SCHEDULER_INTERVAL_MS, cari campaign scheduled yang waktunya tiba,
 * publish semua konten approved-nya, tandai campaign selesai.
 */
export function startScheduler(): { stop: () => void } {
  const interval = setInterval(() => {
    tick().catch((err) => logger.error("Scheduler tick error", { err: err instanceof Error ? err.message : String(err) }));
  }, env.SCHEDULER_INTERVAL_MS);
  logger.info(`Scheduler jalan (interval ${env.SCHEDULER_INTERVAL_MS}ms)`);

  // jalankan sekali saat boot biar campaign yang telat langsung terproses
  tick().catch((err) => logger.error("Scheduler boot tick error", { err: err instanceof Error ? err.message : String(err) }));

  return { stop: () => clearInterval(interval) };
}

async function tick(): Promise<void> {
  const due = findDueCampaigns(Date.now());
  for (const campaign of due) {
    await runCampaign(campaign.id);
  }
}

async function runCampaign(campaignId: number): Promise<void> {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) return;

  const approvedContents = db.select().from(contents).where(eq(contents.campaignId, campaignId)).all().filter((c) => c.status === "approved");
  logger.info(`Campaign due diproses: ${campaign.name} (${approvedContents.length} konten)`);

  let ok = 0;
  for (const content of approvedContents) {
    try {
      await publishContent(content.id);
      ok += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Publish konten dari scheduler gagal", { contentId: content.id, err: message });
      logActivity(db, "publish", "Publish scheduler gagal", { campaignId, contentId: content.id, error: message });
    }
  }

  if (ok === approvedContents.length) completeCampaign(campaignId);
  else logActivity(db, "campaign", "Campaign sebagian gagal dipublish", { campaignId, ok, total: approvedContents.length });
}
