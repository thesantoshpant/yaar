// Concrete "coach" endpoints that deepen the core: recommender coach, family/funding
// coach, a grade 9-12 milestone plan (the parent-program product), and an
// informational F-1 status guard. All use strong centralized prompts + mock fallback.
import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { buildContextPack } from "../services/contextPack";
import {
  RECOMMENDER_COACH_SYSTEM,
  FUNDING_COACH_SYSTEM,
  MILESTONE_PLAN_SYSTEM,
  F1_GUARD_SYSTEM,
} from "../lib/prompts";

export const coachRouter = Router();

async function context(profileId?: string): Promise<string> {
  if (!profileId) return "";
  try {
    return await buildContextPack(profileId);
  } catch {
    return "";
  }
}

// ---------- Recommender coach ----------
const recommenderSchema = z.object({
  profileId: z.string().optional(),
  recommenderRole: z.string().optional(), // e.g. "math teacher"
  achievements: z.string().optional(),
});

coachRouter.post("/recommender", async (req, res) => {
  const parsed = recommenderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ctx = await context(b.profileId);

  const { data, source } = await generateJson<{
    requestMessage: string;
    bragSheet: string[];
    projectSummary: string;
    logistics: string[];
  }>({
    system: `${RECOMMENDER_COACH_SYSTEM}
Return ONLY JSON: { "requestMessage": string, "bragSheet": string[], "projectSummary": string, "logistics": string[] }`,
    prompt: `${ctx ? `Student context:\n${ctx}\n\n` : ""}Recommender: ${b.recommenderRole ?? "a teacher who knows the student well"}.
Achievements/notes from the student: ${b.achievements ?? "(none provided yet)"}.
Write the recommender package now.`,
    mock: () => ({
      requestMessage: `Dear ${b.recommenderRole ?? "Teacher"}, I am applying to US universities and would be grateful if you could write a recommendation letter. I have prepared a short brag sheet and all deadlines to make it easy. Would you be willing?`,
      bragSheet: [
        "A specific moment you showed initiative or curiosity (add your example).",
        "A challenge you overcame and what it taught you.",
        "A concrete result or project you are proud of.",
      ],
      projectSummary: "One paragraph describing your most meaningful project: what you built, why, and the impact. (Add your details.)",
      logistics: ["Share the deadline for each school", "How the letter is submitted (usually an email link)", "Your final school list"],
    }),
  });
  res.json({ ...data, source });
});

// ---------- Family + funding coach ----------
const fundingSchema = z.object({
  profileId: z.string().optional(),
  i20CostUsd: z.number().optional(),
  fundsUsd: z.number().optional(),
  sponsor: z.string().optional(),
  notes: z.string().optional(),
});

coachRouter.post("/funding", async (req, res) => {
  const parsed = fundingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ctx = await context(b.profileId);
  const gap =
    b.i20CostUsd != null && b.fundsUsd != null ? b.i20CostUsd - b.fundsUsd : null;

  const { data, source } = await generateJson<{
    costExplanation: string;
    sponsorStory: string;
    gapAnalysis: string;
    howToClose: string[];
    parentExplainer: string;
  }>({
    system: `${FUNDING_COACH_SYSTEM}
Return ONLY JSON: { "costExplanation": string, "sponsorStory": string, "gapAnalysis": string, "howToClose": string[], "parentExplainer": string }`,
    prompt: `${ctx ? `Student context:\n${ctx}\n\n` : ""}I-20 cost/yr: ${b.i20CostUsd ?? "unknown"}. Funds shown: ${
      b.fundsUsd ?? "unknown"
    }. Sponsor: ${b.sponsor ?? "unknown"}. Notes: ${b.notes ?? "none"}. ${
      gap != null ? `Computed gap: ${gap} USD.` : ""
    }\nProduce the funding guidance now.`,
    mock: () => ({
      costExplanation:
        "The I-20 lists the total cost the school expects you to cover for one year, including tuition, living, and fees. Your visa officer expects proof you can cover it without working illegally.",
      sponsorStory:
        "Name who pays (often a parent), their occupation and yearly income, and the liquid funds available. The story must be consistent and believable.",
      gapAnalysis:
        gap != null
          ? gap > 0
            ? `There is a gap of about $${gap.toLocaleString()} between your funds and the I-20 cost. Officers flag this fast.`
            : "Your funds appear to cover the I-20 cost. Keep documents consistent."
          : "Provide the I-20 cost and funds to see the gap.",
      howToClose: [
        "Look for need-based aid or scholarships at schools that fund international students",
        "Consider more affordable schools where your funds cover the cost",
        "Explore assistantships (mostly graduate) or an education loan",
        "Never fabricate bank documents. It causes refusals and bans.",
      ],
      parentExplainer:
        "Simple version for parents: the US school needs to see that our family can pay for one year up front, on paper. Let's make sure our real documents clearly show that, or choose a school that fits our budget.",
    }),
  });
  res.json({ ...data, gapUsd: gap, source });
});

// ---------- Grade 9-12 milestone plan (parent-program product) ----------
const milestoneSchema = z.object({
  profileId: z.string().optional(),
  gradeLevel: z.string().default("9"),
  intendedMajor: z.string().optional(),
  country: z.string().default("Nepal"),
  constraints: z.string().optional(),
});

coachRouter.post("/milestones", async (req, res) => {
  const parsed = milestoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ctx = await context(b.profileId);

  const { data, source } = await generateJson<{
    overview: string;
    terms: { term: string; focus: string; milestones: { area: string; action: string; proof: string }[] }[];
  }>({
    system: `${MILESTONE_PLAN_SYSTEM}
Return ONLY JSON: { "overview": string, "terms": [ { "term": string, "focus": string, "milestones": [ { "area": string, "action": string, "proof": string } ] } ] }`,
    prompt: `${ctx ? `Student context:\n${ctx}\n\n` : ""}Current grade: ${b.gradeLevel}. Intended major: ${
      b.intendedMajor ?? "undecided"
    }. Country: ${b.country}. Constraints: ${b.constraints ?? "none stated"}.
Build a term-by-term milestone plan from grade ${b.gradeLevel} through grade 12.`,
    mock: () => ({
      overview: `A milestone plan from grade ${b.gradeLevel} to grade 12 for a ${b.intendedMajor ?? "future"} applicant from ${b.country}. Each milestone is something you can finish and show.`,
      terms: [
        {
          term: `Grade ${b.gradeLevel}, Term 1`,
          focus: "Foundations and a first project",
          milestones: [
            { area: "Academics", action: "Keep grades strong; pick the hardest classes available to you", proof: "Report card" },
            { area: "English", action: "Take a free diagnostic and start daily practice", proof: "Diagnostic score" },
            { area: "Project", action: "Start a small project in your interest area (e.g. a coding project)", proof: "A public link or photo" },
          ],
        },
        {
          term: `Grade ${b.gradeLevel}, Term 2`,
          focus: "Leadership you start yourself",
          milestones: [
            { area: "Leadership", action: "If your school has no club, start one or teach younger students", proof: "Attendance list, photos" },
            { area: "English", action: "Reach a target practice band", proof: "Practice test result" },
          ],
        },
      ],
    }),
  });
  res.json({ ...data, source });
});

// ---------- F-1 status guard (informational) ----------
const f1Schema = z.object({
  profileId: z.string().optional(),
  question: z.string().min(1),
});

coachRouter.post("/f1-status", async (req, res) => {
  const parsed = f1Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;
  const ctx = await context(b.profileId);

  const { data, source } = await generateJson<{
    answer: string;
    mustDo: string[];
    checkWithDSO: boolean;
    disclaimer: string;
  }>({
    system: `${F1_GUARD_SYSTEM}
Return ONLY JSON: { "answer": string, "mustDo": string[], "checkWithDSO": true, "disclaimer": string }`,
    prompt: `${ctx ? `Student context:\n${ctx}\n\n` : ""}Student question about maintaining F-1 status: ${b.question}\nAnswer informationally now.`,
    mock: () => ({
      answer:
        "In general, F-1 students must keep a full course load, only do authorized work (on-campus is limited, off-campus needs CPT or OPT), and keep their I-20 and address current. Unauthorized work, including most self-employment, can end your status.",
      mustDo: [
        "Maintain full-time enrollment",
        "Do not work without authorization (CPT/OPT)",
        "Keep your address and I-20 up to date",
        "Get a travel signature before leaving the US",
      ],
      checkWithDSO: true,
      disclaimer: "This is general information, not legal advice. Always confirm with your DSO and, if needed, an immigration attorney before acting.",
    }),
  });
  res.json({ ...data, source });
});
