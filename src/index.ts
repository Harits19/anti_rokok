import "./config/env"; // validasi env dulu (fail-fast)
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./shared/logger";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`Anti-Rokok API jalan di http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal: string) => {
  logger.info(`Menerima ${signal}, shutdown...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
