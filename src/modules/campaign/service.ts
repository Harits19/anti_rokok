import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "../../database/client";
import { campaigns, contents } from "../../database/schema";
import type { Campaign, Content } from "../../database/schema";
import { badRequest, conflict, notFound } from "../../shared/errors";
import { logActivity } from "../../shared/activity";
import type { CreateCampaignInput, ScheduleCampaignInput } from "./schema";

export function listCampaigns(): Campaign[] {
  return db.select().from(campaigns).all();
}

export function getCampaign(id: number): Campaign {
  const row = db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!row) throw notFound(`Campaign ${id} tidak ditemukan`);
  return row;
}

export function createCampaign(input: CreateCampaignInput): Campaign {
  const now = Date.now();
  const row = db
    .insert(campaigns)
    .values({ name: input.name, description: input.description ?? null, status: "draft", createdAt: now, updatedAt: now })
    .returning()
    .get();
  logActivity(db, "campaign", `Campaign dibuat: ${row.name}`, { campaignId: row.id });
  return row;
}

/** Set jadwal campaign + tautkan konten (harus berstatus approved). */
export function scheduleCampaign(id: number, input: ScheduleCampaignInput): Campaign {
  const campaign = getCampaign(id);
  if (campaign.status !== "draft" && campaign.status !== "cancelled") {
    throw conflict(`Campaign tidak bisa dijadwalkan dari status ${campaign.status}`);
  }

  const scheduleAt = Date.parse(input.scheduleAt);
  if (Number.isNaN(scheduleAt)) throw badRequest("scheduleAt bukan tanggal valid");

  const linked = db.select().from(contents).where(inArray(contents.id, input.contentIds)).all();
  if (linked.length !== input.contentIds.length) throw notFound("Ada contentId yang tidak ditemukan");

  const notApproved = linked.filter((c) => c.status !== "approved");
  if (notApproved.length > 0) {
    throw conflict(`Konten harus berstatus approved sebelum dijadwalkan: id ${notApproved.map((c) => c.id).join(", ")}`);
  }

  for (const content of linked) {
    db.update(contents).set({ campaignId: campaign.id, updatedAt: Date.now() }).where(eq(contents.id, content.id)).run();
  }

  db.update(campaigns)
    .set({ status: "scheduled", scheduleAt, updatedAt: Date.now() })
    .where(eq(campaigns.id, id))
    .run();

  logActivity(db, "campaign", `Campaign dijadwalkan: ${campaign.name}`, { campaignId: id, scheduleAt, contentIds: input.contentIds });
  return getCampaign(id);
}

export function cancelCampaign(id: number): Campaign {
  const campaign = getCampaign(id);
  if (campaign.status === "completed" || campaign.status === "cancelled") {
    throw conflict(`Campaign ${campaign.status} tidak bisa dibatalkan`);
  }
  db.update(campaigns).set({ status: "cancelled", updatedAt: Date.now() }).where(eq(campaigns.id, id)).run();
  logActivity(db, "campaign", `Campaign dibatalkan: ${campaign.name}`, { campaignId: id });
  return getCampaign(id);
}

export function listCampaignContents(id: number): Content[] {
  getCampaign(id);
  return db.select().from(contents).where(eq(contents.campaignId, id)).all();
}

/** Approval: konten pending_approval -> approved (bisa juga di luar campaign). */
export function approveContent(contentId: number): Content {
  const content = db.select().from(contents).where(eq(contents.id, contentId)).get();
  if (!content) throw notFound(`Konten ${contentId} tidak ditemukan`);
  if (content.status !== "pending_approval") throw conflict(`Hanya konten pending_approval yang bisa disetujui (sekarang: ${content.status})`);

  db.update(contents).set({ status: "approved", rejectionReason: null, updatedAt: Date.now() }).where(eq(contents.id, contentId)).run();
  logActivity(db, "approval", `Konten disetujui`, { contentId });
  return db.select().from(contents).where(eq(contents.id, contentId)).get()!;
}

/** Reject: pending_approval -> rejected + alasan. */
export function rejectContent(contentId: number, reason?: string): Content {
  const content = db.select().from(contents).where(eq(contents.id, contentId)).get();
  if (!content) throw notFound(`Konten ${contentId} tidak ditemukan`);
  if (content.status !== "pending_approval") throw conflict(`Hanya konten pending_approval yang bisa ditolak (sekarang: ${content.status})`);

  db.update(contents)
    .set({ status: "rejected", rejectionReason: reason ?? null, updatedAt: Date.now() })
    .where(eq(contents.id, contentId))
    .run();
  logActivity(db, "approval", `Konten ditolak`, { contentId, reason: reason ?? null });
  return db.select().from(contents).where(eq(contents.id, contentId)).get()!;
}

/** Dipakai scheduler: campaign scheduled yang waktunya sudah tiba. */
export function findDueCampaigns(now: number): Campaign[] {
  return db.select().from(campaigns).where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduleAt, now))).all();
}

export function completeCampaign(id: number): Campaign {
  db.update(campaigns).set({ status: "completed", publishedAt: Date.now(), updatedAt: Date.now() }).where(eq(campaigns.id, id)).run();
  logActivity(db, "campaign", "Campaign selesai dipublish", { campaignId: id });
  return getCampaign(id);
}
