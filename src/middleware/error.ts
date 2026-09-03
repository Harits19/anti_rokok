import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors";
import { logger } from "../shared/logger";

/** Tangkap error async Express 5 otomatis, lalu serahkan ke handler ini. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  logger.error("Unhandled error", { path: req.path, err: err instanceof Error ? err.message : String(err) });

  const status = 500;
  res.status(status).json({
    error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan internal" },
  });
}
