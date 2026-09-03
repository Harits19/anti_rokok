import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { contents } from "../../database/schema";
import type { Content, ContentStatus } from "../../database/schema";
import { badRequest, conflict, notFound } from "../../shared/errors";
import { generateContent as aiGenerate } from "../ai/service";
import { publishContent as threadsPublish } from "../threads/service";
import type { CreateContentInput } from "./schema";

export function listContents(status?: ContentStatus): Content[] {
  if (status) return db.select().from(contents).where(eq(contents.status, status)).all();
  return db.select().from(contents).all();
}

export function getContent(id: number): Content {
  const row = db.select().from(contents).where(eq(contents.id, id)).get();
  if (!row) throw notFound(`Konten ${id} tidak ditemukan`);
  return row;
}

export function createContent(input: CreateContentInput): Content {
  const now = Date.now();
  const row = db
    .insert(contents)
    .values({
      title: input.title ?? null,
      body: input.body,
      status: "draft",
      aiGenerated: false,
      campaignId: input.campaignId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return row;
}

/** Generate draf via AI lalu simpan sebagai konten draft. */
export async function generateDraft(input: { topic: string; tone?: string }): Promise<Content> {
  const body = await aiGenerate(input.topic, input.tone);
  return createContent({ title: `Draf AI: ${input.topic}`, body });
}

/** Kirim konten ke antrian approval. */
export function submitForApproval(id: number): Content {
  const content = getContent(id);
  if (content.status !== "draft") throw conflict(`Hanya konten draft yang bisa disubmit (sekarang: ${content.status})`);
  return updateStatus(id, "pending_approval");
}

/** Publish konten (harus approved) via module Threads. */
export async function publishContent(id: number): Promise<Content> {
  const content = getContent(id);
  if (content.status !== "approved") throw conflict(`Hanya konten approved yang bisa dipublish (sekarang: ${content.status})`);
  await threadsPublish(content);
  return updateStatus(id, "published");
}

function updateStatus(id: number, status: ContentStatus): Content {
  db.update(contents).set({ status, updatedAt: Date.now() }).where(eq(contents.id, id)).run();
  return getContent(id);
}

export { updateStatus };
