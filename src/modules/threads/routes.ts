import { Router, type Request, type Response } from "express";
import { badRequest, unauthorized } from "../../shared/errors";
import { publishText } from "./service";
import { publishTextInput } from "./schema";

export const threadsRoutes = Router();

threadsRoutes.post("/publish", async (req: Request, res: Response) => {
  const parsed = publishTextInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.status(201).json({ data: await publishText(parsed.data.text) });
});