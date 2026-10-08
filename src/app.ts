import express from "express";
import { notFoundHandler } from "./middleware/not-found";
import { errorHandler } from "./middleware/error";

/**
 * Host proses + healthcheck. Semua kerja bot Threads dilakukan lewat Chromium
 * (src/browser, src/modules/threads/ui) yang dipicu dari script, bukan HTTP API.
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
