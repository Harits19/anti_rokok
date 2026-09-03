import "./config/env"; // validasi env dulu (fail-fast)
import { createApp } from "./app";
import { env } from "./config/env";
import { closeDb } from "./database/client";
import { runMigrations } from "./database/migrate";
import { startScheduler } from "./jobs/scheduler";
import { logger } from "./shared/logger";

async function main(): Promise<void> {
  await runMigrations();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Anti-Rokok API jalan di http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Catatan MVP: scheduler hidup di proses yang sama.
  // Nanti (production multi-instance) pindahkan ke proses/job terpisah.
  startScheduler();

  const shutdown = (signal: string) => {
    logger.info(`Menerima ${signal}, shutdown...`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // paksa tutup kalau ada koneksi menggantung
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Gagal boot aplikasi", err);
  process.exit(1);
});
