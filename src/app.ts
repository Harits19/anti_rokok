import express from "express";
import swaggerUi from "swagger-ui-express";
import type { SwaggerUiOptions } from "swagger-ui-express";
import { notFoundHandler } from "./middleware/not-found";
import { threadsRoutes } from "./modules/threads/routes";
import { env, isProd } from "./config/env";
import { openapiSpec } from "./docs/openapi";
import { errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });

  const preauthJs =
    !isProd && env.API_KEY
      ? `(function(){var t=setInterval(function(){if(window.ui){clearInterval(t);window.ui.preauthorizeApiKey("ApiKeyAuth",${JSON.stringify(env.API_KEY)});}},200);})();`
      : "";

  const uiOptions = {
    customSiteTitle: "Anti-Rokok API Docs",
    customJsStr: preauthJs,
    swaggerOptions: { persistAuthorization: true, tryItOutEnabled: true },
  } as SwaggerUiOptions & { customJsStr: string };
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, uiOptions));

  app.use("/threads", threadsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
