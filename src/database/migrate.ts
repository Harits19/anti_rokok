import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./client";
import { logger } from "../shared/logger";

/** Jalankan migration: bun run db:migrate */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./src/database/migrations" });
  logger.info("Migration selesai");
}

if (import.meta.main) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Migration gagal", err);
      process.exit(1);
    });
}
