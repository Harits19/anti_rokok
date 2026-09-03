import { env } from "../../config/env";
import { serviceUnavailable } from "../../shared/errors";
import { ThreadsClient } from "./client";

/**
 * Konsep akun bot: SATU akun Threads (dari env) yang melakukan semua post.
 * Tanpa database — publish langsung ke API Threads.
 */
function getBotClient(): ThreadsClient {
  if (!env.THREADS_BOT_USER_ID || !env.THREADS_BOT_ACCESS_TOKEN) {
    throw serviceUnavailable("Akun bot belum dikonfigurasi. Isi THREADS_BOT_USER_ID & THREADS_BOT_ACCESS_TOKEN di .env");
  }
  return new ThreadsClient(env.THREADS_BOT_USER_ID, env.THREADS_BOT_ACCESS_TOKEN);
}

/** Publish teks ke Threads via akun bot. Kembalikan thread id. */
export async function publishText(text: string): Promise<{ threadId: string }> {
  const client = getBotClient();
  try {
    const threadId = await client.publishText(text);
    return { threadId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw serviceUnavailable(`Gagal publish ke Threads: ${message}`);
  }
}
