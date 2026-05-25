import { Router } from "express";
import { z } from "zod";
import { generateRiskReport, analyzeDocuments } from "../services/riskReport";
import { isEntitled } from "../services/billing";
import { store } from "../lib/store";
import { hasStripe } from "../config";
import type { RiskReport } from "../lib/types";

export const riskRouter = Router();

const schema = z.object({
  profileId: z.string().optional(),
  documents: z
    .array(
      z.object({
        kind: z.enum(["i20", "admit", "funding", "ds160", "other"]).default("other"),
        text: z.string().min(1),
        filename: z.string().optional(),
      })
    )
    .min(1),
});

// When the report is locked (Stripe configured + not yet paid), return only a teaser.
function preview(r: RiskReport) {
  return {
    ...r,
    extracted: [],
    inconsistencies: r.inconsistencies.slice(0, 1),
    weakPoints: r.weakPoints.slice(0, 1),
    dimensions: [],
    locked: true,
  };
}

riskRouter.post("/report", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { profileId, documents } = parsed.data;

  if (profileId) {
    const report = await generateRiskReport(profileId, documents);
    if (isEntitled(profileId)) return res.json({ report, paid: true });
    return res.json({ report: preview(report), paid: false, needsPayment: hasStripe });
  }

  // anonymous try-it path: analyze without persisting
  const core = await analyzeDocuments(documents);
  const report: RiskReport = { id: "preview", profileId: "", createdAt: new Date().toISOString(), ...core };
  res.json({ report, paid: true, anonymous: true });
});

riskRouter.get("/latest/:profileId", async (req, res) => {
  const report = await store.getLatestRiskReport(req.params.profileId);
  res.json({ report, entitled: isEntitled(req.params.profileId) });
});
