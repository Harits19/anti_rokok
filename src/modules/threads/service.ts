import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { posts, threadsAccounts } from "../../database/schema";
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
