import { Router } from "express";
import { badRequest } from "../../shared/errors";
import { getContent, listContents, createContent, generateDraft, publishContent, submitForApproval } from "./service";
import { contentQuery, createContentInput, generateContentInput } from "./schema";

export const contentRoutes = Router();

contentRoutes.get("/", (req, res) => {
  const query = contentQuery.safeParse(req.query);
  if (!query.success) throw badRequest("Query tidak valid", query.error.issues);
  res.json({ data: listContents(query.data.status) });
});

contentRoutes.post("/", (req, res) => {
  const parsed = createContentInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.status(201).json({ data: createContent(parsed.data) });
});

contentRoutes.post("/generate", async (req, res) => {
  const parsed = generateContentInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.status(201).json({ data: await generateDraft(parsed.data) });
});

contentRoutes.get("/:id", (req, res) => {
  res.json({ data: getContent(Number(req.params.id)) });
});

contentRoutes.post("/:id/submit", (req, res) => {
  res.json({ data: submitForApproval(Number(req.params.id)) });
});

contentRoutes.post("/:id/publish", async (req, res) => {
  res.json({ data: await publishContent(Number(req.params.id)) });
});
