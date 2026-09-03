import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { contents, posts, threadsAccounts } from "../../database/schema";
import type { Content } from "../../database/schema";
import { logActivity } from "../../shared/activity";
import { serviceUnavailable } from "../../shared/errors";
import { ThreadsClient } from "./client";

/** Ambil akun Threads pertama yang punya token (cukup untuk MVP). */
function getActiveAccount() {
  const account = db.select().from(threadsAccounts).limit(1).get();
  if (!account) throw serviceUnavailable("Belum ada akun Threads terhubung (isi tabel threads_accounts / tambah endpoint OAuth)");
  return account;
}

/** Publish konten edukasi ke Threads, catat ke tabel posts. */
export async function publishContent(content: Content): Promise<{ postId: string; contentId: number }> {
  const account = getActiveAccount();
  const client = new ThreadsClient(account.threadsUserId, account.accessToken);

  const now = Date.now();
  let threadId: string;
  try {
    threadId = await client.publishText(content.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.insert(posts)
      .values({ contentId: content.id, threadsAccountId: account.id, status: "failed", errorMessage: message, createdAt: now })
      .run();
    logActivity(db, "publish", "Publish konten GAGAL", { contentId: content.id, error: message });
    throw serviceUnavailable(`Gagal publish ke Threads: ${message}`);
  }

  db.insert(posts)
    .values({ contentId: content.id, threadsAccountId: account.id, threadId, status: "published", publishedAt: now, createdAt: now })
    .run();
  logActivity(db, "publish", "Konten terpublish", { contentId: content.id, threadId });
  return { postId: threadId, contentId: content.id };
}

/**
 * Publish teks MENTAH langsung ke Threads API (tanpa alur draft/approval).
 * Tetap dicatat: 1 baris contents (status published) + 1 baris posts.
 */
export async function publishText(text: string): Promise<{ threadId: string; contentId: number }> {
  const account = getActiveAccount();
  const client = new ThreadsClient(account.threadsUserId, account.accessToken);

  let threadId: string;
  try {
    threadId = await client.publishText(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logActivity(db, "publish", "Publish teks langsung GAGAL", { error: message });
    throw serviceUnavailable(`Gagal publish ke Threads: ${message}`);
  }

  const now = Date.now();
  const contentRow = db
    .insert(contents)
    .values({ body: text, status: "published", aiGenerated: false, createdAt: now, updatedAt: now })
    .returning()
    .get();
  db.insert(posts)
    .values({ contentId: contentRow.id, threadsAccountId: account.id, threadId, status: "published", publishedAt: now, createdAt: now })
    .run();
  logActivity(db, "publish", "Teks langsung terpublish", { contentId: contentRow.id, threadId });
  return { threadId, contentId: contentRow.id };
}
