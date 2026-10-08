-- Schema state bot. Dijalankan idempotent saat openStore().
-- Lihat src/store/sqlite.ts

CREATE TABLE IF NOT EXISTS action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- post | reply | like | repost | scrape
  target_id TEXT,                -- post id / permalink
  payload TEXT,                  -- JSON
  status TEXT NOT NULL,          -- planned | done | failed | skipped
  error TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_action_log_created_at ON action_log (created_at);

CREATE TABLE IF NOT EXISTS seen_post (
  post_id TEXT PRIMARY KEY,
  permalink TEXT,
  acted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_window (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
