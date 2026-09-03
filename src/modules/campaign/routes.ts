import { Router } from "express";
import { badRequest } from "../../shared/errors";
import {
  approveContent,
  cancelCampaign,
  createCampaign,
  getCampaign,
  listCampaignContents,
  listCampaigns,
  rejectContent,
  scheduleCampaign,
} from "./service";
import { createCampaignInput, reviewContentInput, scheduleCampaignInput } from "./schema";

export const campaignRoutes = Router();

campaignRoutes.get("/", (_req, res) => {
  res.json({ data: listCampaigns() });
});

campaignRoutes.post("/", (req, res) => {
  const parsed = createCampaignInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.status(201).json({ data: createCampaign(parsed.data) });
});

campaignRoutes.get("/:id", (req, res) => {
  res.json({ data: getCampaign(Number(req.params.id)) });
});

campaignRoutes.get("/:id/contents", (req, res) => {
  res.json({ data: listCampaignContents(Number(req.params.id)) });
});

campaignRoutes.post("/:id/schedule", (req, res) => {
  const campaignId = Number(req.params.id);
  const parsed = scheduleCampaignInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.json({ data: scheduleCampaign(campaignId, parsed.data) });
});

campaignRoutes.post("/:id/cancel", (req, res) => {
  res.json({ data: cancelCampaign(Number(req.params.id)) });
});

/** Approval konten — bisa dipakai di dalam maupun luar campaign. */
campaignRoutes.post("/approvals/approve", (req, res) => {
  const parsed = reviewContentInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.json({ data: approveContent(parsed.data.contentId) });
});

campaignRoutes.post("/approvals/reject", (req, res) => {
  const parsed = reviewContentInput.safeParse(req.body);
  if (!parsed.success) throw badRequest("Body tidak valid", parsed.error.issues);
  res.json({ data: rejectContent(parsed.data.contentId, parsed.data.reason) });
});
