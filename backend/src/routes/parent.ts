// Parent mode endpoints. A student can generate a warm, plain-language report for a
// parent (optionally in the parent's language) and share a read-only link the parent
// opens with no login. The link is a stateless signed token, so it survives restarts
// without extra storage.
import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { assertOwnership } from "../lib/userAuth";
import { generateParentReport, type ParentReport } from "../services/parentReport";

export const parentRouter = Router();

function makeShareToken(profileId: string, language: string): string {
  if (config.jwtSecret) return jwt.sign({ pid: profileId, language, kind: "parent_share" }, config.jwtSecret, { expiresIn: "365d" });
  return Buffer.from(JSON.stringify({ pid: profileId, language })).toString("base64url");
}

function readShareToken(token: string): { pid: string; language: string } | null {
  if (config.jwtSecret) {
    try {
      const p = jwt.verify(token, config.jwtSecret) as { pid?: string; language?: string; kind?: string };
      if (p.kind === "parent_share" && p.pid) return { pid: p.pid, language: p.language ?? "English" };
    } catch {
      return null;
    }
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(token, "base64url").toString()) as { pid?: string; language?: string };
    return p.pid ? { pid: p.pid, language: p.language ?? "English" } : null;
  } catch {
    return null;
  }
}

// Tiny TTL cache so a parent refreshing the link doesn't trigger a model call each time.
const cache = new Map<string, { report: ParentReport; at: number }>();
const TTL = 10 * 60 * 1000;
async function reportCached(pid: string, language: string): Promise<ParentReport | null> {
  const key = `${pid}|${language}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.report;
  const report = await generateParentReport(pid, language);
  if (report) cache.set(key, { report, at: Date.now() });
  return report;
}

const bodySchema = z.object({ language: z.string().max(40).optional() });

// Owner generates the report and gets a shareable link.
parentRouter.post("/:profileId/report", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const lang = parsed.data.language?.trim() || "English";
  const report = await generateParentReport(req.params.profileId, lang);
  if (!report) return res.status(404).json({ error: "Profile not found" });
  cache.set(`${req.params.profileId}|${lang}`, { report, at: Date.now() });
  const token = makeShareToken(req.params.profileId, lang);
  res.json({ report, shareToken: token, shareUrl: `${config.publicUrl}/parent/${token}` });
});

// Public read-only view for a parent (no login).
parentRouter.get("/shared/:token", async (req, res) => {
  const parsed = readShareToken(req.params.token);
  if (!parsed) return res.status(404).json({ error: "This link is invalid or has expired." });
  const report = await reportCached(parsed.pid, parsed.language);
  if (!report) return res.status(404).json({ error: "Report not available." });
  res.json({ report });
});
