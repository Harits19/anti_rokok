import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---- Status (constraint di lapisan app via zod; kolom plain text agar migrasi ke PG mudah) ----

export const CONTENT_STATUSES = ["draft", "pending_approval", "approved", "rejected", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "completed", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const POST_STATUSES = ["published", "failed"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

// ---- Tabel ----

/** Akun Threads terhubung + token akses. */
export const threadsAccounts = sqliteTable("threads_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadsUserId: text("threads_user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: integer("token_expires_at"), // unix ms, null = tidak expire
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Konten edukasi. */
export const contents = sqliteTable("contents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"),
  body: text("body").notNull(),
  status: text("status").notNull(), // CONTENT_STATUSES
  rejectionReason: text("rejection_reason"),
  aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull().default(false),
  campaignId: integer("campaign_id"), // FK manual: campaign bisa punya banyak konten
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Kampanye edukasi + jadwal. */
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull(), // CAMPAIGN_STATUSES
  scheduleAt: integer("schedule_at"), // unix ms, null = tanpa jadwal (manual)
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Riwayat post ke Threads. */
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: integer("content_id").notNull(),
  threadsAccountId: integer("threads_account_id"),
  threadId: text("thread_id"), // id post di Threads setelah sukses
  status: text("status").notNull(), // POST_STATUSES
  errorMessage: text("error_message"),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
});

/** Log aktivitas: webhook, job, approval, publish, dll. */
export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  meta: text("meta"), // JSON
  createdAt: integer("created_at").notNull(),
});

// ---- Tipe baris ----

export type ThreadsAccount = typeof threadsAccounts.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
