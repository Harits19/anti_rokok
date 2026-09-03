type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw === "debug" || raw === "warn" || raw === "error" ? raw : "info";
}

function write(level: Level, msg: string, meta?: unknown): void {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const time = new Date().toISOString();
  const line = meta === undefined ? `[${time}] ${level.toUpperCase()} ${msg}` : `[${time}] ${level.toUpperCase()} ${msg} ${JSON.stringify(meta)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => write("debug", msg, meta),
  info: (msg: string, meta?: unknown) => write("info", msg, meta),
  warn: (msg: string, meta?: unknown) => write("warn", msg, meta),
  error: (msg: string, meta?: unknown) => write("error", msg, meta),
};
