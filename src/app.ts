import express from "express";
import swaggerUi from "swagger-ui-express";
import type { SwaggerUiOptions } from "swagger-ui-express";
import { errorHandler } from "./middleware/error";
import { notFoundHandler } from "./middleware/not-found";
import { threadsRoutes } from "./modules/threads/routes";
import { requireApiKey } from "./middleware/auth";
import { env, isProd } from "./config/env";
import { openapiSpec } from "./docs/openapi";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // Health check sederhana (tanpa DB).
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Dokumentasi + testing interaktif API (publik, tanpa API key).
  app.get("/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });

  // Dev: pre-authorize otomatis biar tes route 1-klik. Prod: Authorize manual.
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

  // Route threads: webhook publik (dipanggil Meta tanpa key), publish butuh API key.
  app.use("/threads", threadsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
