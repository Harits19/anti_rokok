import "./config/env"; // validasi env dulu (fail-fast)
import { createApp } from "./app";
import { env } from "./config/env";
import { Logger } from "./shared/logger";

const app = createApp();
const listen = app.listen(env.PORT, () => {
  const logger = new Logger(app.listen);
  logger.info(`Anti-Rokok API jalan di http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal: string) => {
  const logger = new Logger(shutdown)
  logger.info(`Menerima ${signal}, shutdown...`);
  listen.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
