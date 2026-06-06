import { Router, json } from "express";
import { z } from "zod";
import { generateRiskReport, analyzeDocuments, extractFieldsFromFiles } from "../services/riskReport";
import { store } from "../lib/store";
import { assertOwnership } from "../lib/userAuth";
import { spendActor } from "../lib/actor";
import type { RiskReport } from "../lib/types";

export const riskRouter = Router();

// Uploaded files arrive as base64 inside JSON, so this route needs a bigger body limit
// than the 1mb global default (a phone photo of an I-20 is a few MB).
const uploadBody = json({ limit: "25mb" });

const MAX_FILES = 4;
const MAX_BYTES = 12 * 1024 * 1024; // ~12MB per file before base64 inflation
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/i;

const extractSchema = z.object({
  files: z
    .array(
      z.object({
        kind: z.enum(["i20", "admit", "funding", "ds160", "other"]).default("other"),
        mimeType: z.string(),
        data: z.string().min(1), // base64, no data: prefix
        filename: z.string().optional(),
      })
    )
    .min(1)
    .max(MAX_FILES),
});

// Read uploaded documents and return only the extracted fields for the student to confirm.
// We never persist the file bytes. This eases the worst friction: typing numbers off an I-20.
riskRouter.post("/extract", uploadBody, async (req, res) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  for (const f of parsed.data.files) {
    if (!ALLOWED_MIME.test(f.mimeType)) return res.status(400).json({ error: `Unsupported file type: ${f.mimeType}. Upload a PDF or a photo.` });
    if (Buffer.byteLength(f.data, "base64") > MAX_BYTES) return res.status(413).json({ error: "That file is too large. Try a smaller photo or PDF (under 12MB)." });
  }
  const result = await extractFieldsFromFiles(parsed.data.files, spendActor(req));
  res.json(result);
});

const schema = z.object({
  profileId: z.string().max(40).optional(),
  documents: z
    .array(
      z.object({
        kind: z.enum(["i20", "admit", "funding", "ds160", "other"]).default("other"),
        // Same cap as the visa interview's documents field: the UI feeds one
        // shared textarea into both, so the two must accept identical input.
        text: z.string().min(1).max(12000),
        filename: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(6),
});

// The full report is free for everyone. Anonymous students get the complete analysis
// too; it just isn't saved anywhere, so we nudge them to make a profile to keep it.
riskRouter.post("/report", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { profileId, documents } = parsed.data;

  if (!profileId) {
    const core = await analyzeDocuments(documents, spendActor(req));
    const full: RiskReport = { id: "transient", profileId: "", createdAt: new Date().toISOString(), ...core };
    return res.json({ report: full, needsAccount: true });
  }

  await assertOwnership(req, profileId);
  const report = await generateRiskReport(profileId, documents);
  res.json({ report });
});

riskRouter.get("/latest/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const report = await store.getLatestRiskReport(req.params.profileId);
  res.json({ report });
});
