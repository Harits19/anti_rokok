import type { NextFunction, Request, Response } from "express";
import { notFound } from "../shared/errors";

/** Route tak dikenal → dilempar sebagai AppError supaya format error seragam. */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(notFound("Route tidak ditemukan"));
}
