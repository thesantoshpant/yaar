import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { buildContextPack } from "../services/contextPack";
import { recordActivity } from "../services/activity";
import type { Roadmap } from "../lib/types";

export const roadmapRouter = Router();

const bodySchema = z.object({
  country: z.string().default("Nepal"),
  intendedLevel: z.enum(["undergraduate", "graduate"]).default("undergraduate"),
  intendedMajor: z.string().optional(),
  budgetUsdPerYear: z.number().optional(),
  testStatus: z.string().optional(),
  careerGoal: z.string().optional(),
  targetIntake: z.string().optional(),
  profileId: z.string().optional(),
});

type Body = z.infer<typeof bodySchema>;

function mockRoadmap(b: Body): Roadmap {
  const intake = b.targetIntake ?? "Fall 2027";
  return {
    summary: `A ${b.intendedLevel} plan for a student from ${b.country} targeting ${intake}${
      b.intendedMajor ? ` in ${b.intendedMajor}` : ""
    }.`,
    realisticOutcome:
      "With steady effort you can target a balanced list of mid-tier US universities with assistantships or partial scholarships. Top-20 schools are a reach without strong scores and profile.",
    steps: [
      {
        phase: "Test prep",
        timeframe: "Next 2 to 3 months",
        actions: ["Take a diagnostic TOEFL or IELTS", "Drill the speaking section daily", "Target IELTS 7.0+ or TOEFL 100+"],
        why: "English scores gate both admission and the visa conversation.",
      },
      {
        phase: "School research",
        timeframe: "Months 2 to 4",
        actions: ["Build a reach, match, safety list of 8 to 12 schools", "Check cost, scholarships, and post-study work outcomes"],
        why: "An honest, data-driven list beats a consultancy's commission-driven list.",
      },
      {
        phase: "Applications",
        timeframe: "Months 3 to 6",
        actions: ["Draft a strong statement of purpose per school", "Line up recommenders early", "Track deadlines and portals"],
        why: "Quality essays and on-time submission decide outcomes.",
      },
      {
        phase: "Finances and I-20",
        timeframe: "After admits",
        actions: ["Organize funding proof to meet the I-20 requirement", "Apply for any scholarships and assistantships"],
        why: "Clean, consistent funding documents are essential for the visa.",
      },
      {
        phase: "Visa",
        timeframe: "Final 1 to 2 months",
        actions: ["File DS-160 and pay SEVIS", "Practice the interview until answers are natural"],
        why: "Most refusals are about ties to home and finances, both fixable with prep.",
      },
    ],
    estimatedTotalCostUsd: b.budgetUsdPerYear
      ? `Around ${(b.budgetUsdPerYear * 2).toLocaleString()} USD for a typical 2-year program at your budget level.`
      : "Varies widely. Many strong public universities run 25,000 to 35,000 USD per year all-in.",
    redFlags: [
      "Avoid consultancies that promise admission or visa approval.",
      "Do not let anyone fabricate financial documents. It is the fastest way to a refusal or ban.",
    ],
  };
}

roadmapRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ctx = b.profileId ? await buildContextPack(b.profileId) : "";

  const baseSystem = `You are Yaar, an honest AI counselor. Produce a realistic, specific study-abroad roadmap.
Be honest about what outcomes are realistic. Never guarantee outcomes. Warn about predatory consultancy practices.
Return ONLY JSON matching this TypeScript type:
{ "summary": string, "realisticOutcome": string, "steps": { "phase": string, "timeframe": string, "actions": string[], "why": string }[], "estimatedTotalCostUsd": string, "redFlags": string[] }`;
  const system = ctx ? `${ctx}\n\n${baseSystem}` : baseSystem;

  const prompt = `Student: country=${b.country}, level=${b.intendedLevel}, major=${b.intendedMajor ?? "undecided"}, budgetUsdPerYear=${
    b.budgetUsdPerYear ?? "unknown"
  }, testStatus=${b.testStatus ?? "unknown"}, careerGoal=${b.careerGoal ?? "unknown"}, targetIntake=${b.targetIntake ?? "unknown"}.
Create the roadmap now.`;

  const { data, source } = await generateJson<Roadmap>({ prompt, system, mock: () => mockRoadmap(b) });

  // Defensive normalization in case the model returns partial JSON.
  const roadmap: Roadmap = {
    summary: typeof data?.summary === "string" ? data.summary : "",
    realisticOutcome: typeof data?.realisticOutcome === "string" ? data.realisticOutcome : "",
    estimatedTotalCostUsd: typeof data?.estimatedTotalCostUsd === "string" ? data.estimatedTotalCostUsd : undefined,
    redFlags: Array.isArray(data?.redFlags) ? data.redFlags : [],
    steps: Array.isArray(data?.steps)
      ? data.steps.map((s) => ({
          phase: typeof s?.phase === "string" ? s.phase : "",
          timeframe: typeof s?.timeframe === "string" ? s.timeframe : "",
          actions: Array.isArray(s?.actions) ? s.actions : [],
          why: typeof s?.why === "string" ? s.why : "",
        }))
      : [],
  };
  // Remember that they built a plan, and mine their goals/timeline from it.
  recordActivity(b.profileId, {
    module: "roadmap",
    summary: `Built a roadmap${b.intendedMajor ? ` for ${b.intendedMajor}` : ""}${b.targetIntake ? `, targeting ${b.targetIntake}` : ""}`,
    facts: [
      ...(b.targetIntake ? [{ profileId: b.profileId!, key: "target.intake", type: "goal" as const, value: b.targetIntake, confidence: 0.8, source: "student_stated" as const }] : []),
      ...(b.intendedMajor ? [{ profileId: b.profileId!, key: "goal.major", type: "goal" as const, value: b.intendedMajor, confidence: 0.8, source: "student_stated" as const }] : []),
    ],
    extractText: roadmap.summary && roadmap.realisticOutcome ? `Roadmap built for this student. Summary: ${roadmap.summary} Realistic outcome: ${roadmap.realisticOutcome}` : undefined,
  });

  res.json({ roadmap, source });
});
