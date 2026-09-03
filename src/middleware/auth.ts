import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { unauthorized } from "../shared/errors";

/** Wajibkan header x-api-key. Pasang per-modul fitur (bukan global). */
export function requireApiKey(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.header("x-api-key");
  if (apiKey !== env.API_KEY) {
    throw unauthorized("API key tidak valid");
  }
  next();
}
