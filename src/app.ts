import express from "express";
import { sql } from "drizzle-orm";
import { db } from "./database/client";
import { errorHandler } from "./middleware/error";
import { notFoundHandler } from "./middleware/not-found";
import { contentRoutes } from "./modules/content/routes";
import { campaignRoutes } from "./modules/campaign/routes";
import { threadsRoutes } from "./modules/threads/routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // Health check: pastikan server + DB hidup.
  app.get("/health", (_req, res) => {
    try {
      db.run(sql`select 1`);
      res.json({ status: "ok", db: "up", timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded", db: "down" });
    }
  });

  // Modul-modul fitur.
  app.use("/threads", threadsRoutes);
  app.use("/contents", contentRoutes);
  app.use("/campaigns", campaignRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
