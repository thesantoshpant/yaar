import { Router } from "express";
import { z } from "zod";
import { searchSchools } from "../services/collegeScorecard";
import { generateText } from "../services/gemini";
import { hasGemini } from "../config";
import { recordActivity } from "../services/activity";
import type { School } from "../lib/types";

export const schoolsRouter = Router();

const bodySchema = z.object({
  search: z.string().optional(),
  state: z.string().optional(),
  maxNetPriceUsd: z.number().optional(),
  minAdmitRate: z.number().optional(),
  intendedMajor: z.string().optional(),
  country: z.string().optional(),
  profileId: z.string().optional(),
});

function categorize(s: School): School {
  const rate = s.admitRate ?? 0.6;
  let category: School["category"];
  if (rate >= 0.7) category = "safety";
  else if (rate >= 0.4) category = "match";
  else category = "reach";
  const admitPct = s.admitRate != null ? `${Math.round(s.admitRate * 100)}% admit rate` : "admit rate n/a";
  const price = s.netPriceUsd != null ? `~$${s.netPriceUsd.toLocaleString()}/yr all-in` : "cost n/a";
  return { ...s, category, fitReason: `${admitPct}, ${price}.` };
}

schoolsRouter.post("/search", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;

  const { schools, source } = await searchSchools({
    search: b.search,
    state: b.state,
    maxNetPriceUsd: b.maxNetPriceUsd,
    minAdmitRate: b.minAdmitRate,
  });

  const ranked = schools.map(categorize);
  const order = { reach: 0, match: 1, safety: 2 } as const;
  ranked.sort((a, b2) => {
    const ca = order[a.category ?? "match"];
    const cb = order[b2.category ?? "match"];
    if (ca !== cb) return ca - cb;
    return (b2.admitRate ?? 0) - (a.admitRate ?? 0);
  });

  let advisorNote =
    "This list is balanced into reach, match, and safety. It is built from public cost and outcome data, not from any school paying us.";

  if (hasGemini && ranked.length > 0) {
    const top = ranked
      .slice(0, 10)
      .map((s) => `${s.name} (${s.category}, ${s.fitReason})`)
      .join("; ");
    const { text } = await generateText({
      system:
        "You are Yaar, an honest study-abroad counselor. In 2 to 3 sentences, advise the student how to use this balanced school list. Be specific and unbiased. No guarantees.",
      prompt: `Student: major=${b.intendedMajor ?? "undecided"}, country=${b.country ?? "unknown"}, max budget/yr=${
        b.maxNetPriceUsd ?? "flexible"
      }. Schools: ${top}.`,
      temperature: 0.5,
    });
    if (text && !text.startsWith("[mock]")) advisorNote = text;
  }

  // Remember what they're looking for, so the rest of the app reflects their interest.
  const searchLabel = [b.search, b.state && `in ${b.state}`, b.maxNetPriceUsd && `under $${b.maxNetPriceUsd.toLocaleString()}/yr`].filter(Boolean).join(" ");
  recordActivity(b.profileId, {
    module: "school_search",
    summary: `Searched schools${searchLabel ? `: ${searchLabel}` : ""} (${ranked.length} results)`,
    facts: b.maxNetPriceUsd ? [{ profileId: b.profileId!, key: "preference.school_budget", type: "preference", value: `Looking at schools under ~$${b.maxNetPriceUsd.toLocaleString()}/yr`, confidence: 0.7, source: "inferred" }] : undefined,
  });

  res.json({ schools: ranked, advisorNote, source });
});
