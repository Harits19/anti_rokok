import type { Request, Response } from "express";
import { notFound } from "../shared/errors";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route tidak ditemukan" } });
}
