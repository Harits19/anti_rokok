import express from "express";
import { sql } from "drizzle-orm";
import swaggerUi from "swagger-ui-express";
import type { SwaggerUiOptions } from "swagger-ui-express";
import { db } from "./database/client";
import { errorHandler } from "./middleware/error";
import { notFoundHandler } from "./middleware/not-found";
import { contentRoutes } from "./modules/content/routes";
import { campaignRoutes } from "./modules/campaign/routes";
import { threadsRoutes } from "./modules/threads/routes";
import { requireApiKey } from "./middleware/auth";
import { env, isProd } from "./config/env";
import { openapiSpec } from "./docs/openapi";

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

  // Dokumentasi + testing interaktif API (publik, tanpa API key).
  app.get("/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });

  // Dev: pre-authorize otomatis biar tes route modul fitur 1-klik.
  // Prod: JANGAN embed key ke browser -> Authorize manual di UI.
  const preauthJs =
    !isProd && env.API_KEY
      ? `(function(){var t=setInterval(function(){if(window.ui){clearInterval(t);window.ui.preauthorizeApiKey("ApiKeyAuth",${JSON.stringify(env.API_KEY)});}},200);})();`
      : "";
  // customJsStr didukung runtime swagger-ui-express tapi belum ada di @types -> cast.
  const uiOptions = {
    customSiteTitle: "Anti-Rokok API Docs",
    customJsStr: preauthJs,
    swaggerOptions: { persistAuthorization: true, tryItOutEnabled: true },
  } as SwaggerUiOptions & { customJsStr: string };
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, uiOptions));

  // API key HANYA untuk modul fitur.
  // Publik: /health, /docs, /openapi.json, /threads (webhook dipanggil Meta tanpa key).
  app.use("/threads", threadsRoutes);
  app.use("/contents", requireApiKey, contentRoutes);
  app.use("/campaigns", requireApiKey, campaignRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
