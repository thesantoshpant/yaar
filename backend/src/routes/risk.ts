import { Router } from "express";
import { z } from "zod";
import { generateRiskReport, analyzeDocuments } from "../services/riskReport";
import { isEntitled } from "../services/billing";
import { store } from "../lib/store";
import { hasStripe } from "../config";
import { assertOwnership } from "../lib/userAuth";
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

  // Anonymous (no profile): only a locked teaser. A full report requires an account
  // (and payment when billing is on) so the paywall cannot be bypassed by clearing storage.
  if (!profileId) {
    const core = await analyzeDocuments(documents);
    const full: RiskReport = { id: "preview", profileId: "", createdAt: new Date().toISOString(), ...core };
    return res.json({ report: preview(full), paid: false, needsAccount: true });
  }

  await assertOwnership(req, profileId);
  const report = await generateRiskReport(profileId, documents);
  if (await isEntitled(profileId)) return res.json({ report, paid: true });
  return res.json({ report: preview(report), paid: false, needsPayment: hasStripe });
});

riskRouter.get("/latest/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const report = await store.getLatestRiskReport(req.params.profileId);
  const entitled = await isEntitled(req.params.profileId);
  // Apply the same preview lock as /report so the full report never leaks unpaid.
  res.json({ report: report && !entitled ? preview(report) : report, entitled });
});
