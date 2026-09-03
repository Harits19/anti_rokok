import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { activityLogs } from "../database/schema";

/**
 * Catat aktivitas (webhook, job, publish, approval, dll) ke tabel activity_logs.
 * Meta di-serialize JSON agar satu kolom cukup untuk MVP.
 */
export function logActivity(db: BunSQLiteDatabase, type: string, message: string, meta?: unknown): void {
  db.insert(activityLogs)
    .values({ type, message, meta: meta === undefined ? null : JSON.stringify(meta), createdAt: Date.now() })
    .run();
}
