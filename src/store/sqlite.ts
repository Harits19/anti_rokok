import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ActionKind = "post" | "reply" | "like" | "repost" | "scrape";
export type ActionStatus = "planned" | "done" | "failed" | "skipped";

export interface ActionLogRow {
  id: number;
  kind: ActionKind;
  target_id: string | null;
  payload: string | null;
  status: ActionStatus;
  error: string | null;
  created_at: number;
  finished_at: number | null;
}

export interface Store {
  readonly db: Database;
  migrate(): void;

  hasSeen(postId: string): boolean;
  markSeen(postId: string, permalink?: string, now?: number): void;

  recordAction(
    kind: ActionKind,
    payload: unknown,
    status: ActionStatus,
    opts?: { targetId?: string; now?: number; error?: string },
  ): number;
  finishAction(id: number, status: ActionStatus, opts?: { error?: string; now?: number }): void;
  countActionsSince(since: number): number;
  recentActions(limit?: number): ActionLogRow[];

  close(): void;
}

const SCHEMA_PATH = new URL("./schema.sql", import.meta.url).pathname;

/**
 * Buka store SQLite. Path `:memory:` dipakai untuk test.
 * Migrasi idempotent — aman dipanggil berulang.
 */
export function openStore(path: string, opts: { migrate?: boolean } = {}): Store {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");

  const store: Store = {
    db,

    migrate() {
      db.exec(readFileSync(SCHEMA_PATH, "utf8"));
    },

    hasSeen(postId) {
      const row = db.query("SELECT 1 FROM seen_post WHERE post_id = ?").get(postId);
      return row !== null;
    },

    markSeen(postId, permalink, now = Date.now()) {
      db.run(
        `INSERT INTO seen_post (post_id, permalink, acted_at) VALUES (?, ?, ?)
         ON CONFLICT(post_id) DO UPDATE SET permalink = excluded.permalink, acted_at = excluded.acted_at`,
        [postId, permalink ?? null, now],
      );
    },

    recordAction(kind, payload, status, o = {}) {
      const now = o.now ?? Date.now();
      const res = db.run(
        `INSERT INTO action_log (kind, target_id, payload, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [kind, o.targetId ?? null, JSON.stringify(payload ?? null), status, o.error ?? null, now],
      );
      return Number(res.lastInsertRowid);
    },

    finishAction(id, status, o = {}) {
      db.run(`UPDATE action_log SET status = ?, error = ?, finished_at = ? WHERE id = ?`, [
        status,
        o.error ?? null,
        o.now ?? Date.now(),
        id,
      ]);
    },

    countActionsSince(since) {
      const row = db
        .query<{ n: number }, [number]>(
          "SELECT COUNT(*) AS n FROM action_log WHERE created_at >= ? AND status IN ('done','planned')",
        )
        .get(since);
      return row?.n ?? 0;
    },

    recentActions(limit = 20) {
      return db
        .query<ActionLogRow, [number]>("SELECT * FROM action_log ORDER BY id DESC LIMIT ?")
        .all(limit);
    },

    close() {
      db.close();
    },
  };

  if (opts.migrate) store.migrate();

  return store;
}

let defaultStore: Store | null = null;

/** Store untuk runtime. File di .data/ (gitignored). Migrasi idempotent. */
export function getStore(path = ".data/bot.sqlite"): Store {
  if (!defaultStore) {
    defaultStore = openStore(resolve(process.cwd(), path), { migrate: true });
  }
  return defaultStore;
}
