// "What if?" simulator. A student asks how a change (more budget, a different major,
// switching to a master's, a gap year) would shift their plan and chances. Yaar answers
// honestly and specifically, grounded in everything it remembers about them. Read-only:
// it never changes the saved profile, so students can explore freely.
import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { buildContextPack } from "../services/contextPack";
import { recordActivity } from "../services/activity";
import { assertOwnership } from "../lib/userAuth";
import { spendActor } from "../lib/actor";
import { YAAR_PRINCIPLES } from "../lib/prompts";

export const whatifRouter = Router();

const schema = z.object({
  scenario: z.string().min(1).max(2000),
  profileId: z.string().max(40).optional(),
  profileSummary: z.string().max(2000).optional(),
});

interface WhatIf {
  impact: string;
  opensUp: string[];
  watchOut: string[];
  verdict: string;
}

whatifRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { scenario, profileId, profileSummary } = parsed.data;
  await assertOwnership(req, profileId);

  const ctx = profileId ? await buildContextPack(profileId) : "";
  const who = ctx || profileSummary || "an international student applying to the US";

  const { data, source } = await generateJson<WhatIf>({
    system: `${YAAR_PRINCIPLES}
You run a "what-if" for a student exploring a change to their plan. Given who they are and the hypothetical change, explain honestly and specifically how it shifts their roadmap, their school options, their funding picture, and their realistic chances. Never guarantee outcomes. Be concrete (name the kinds of schools, tests, or money that change). If the change is unrealistic for them, say so kindly.
Return ONLY JSON: { "impact": string (2-3 sentences on what changes overall), "opensUp": string[] (2-4 things that become possible or easier), "watchOut": string[] (2-4 new trade-offs or risks), "verdict": string (one honest bottom-line sentence) }`,
    prompt: `Student situation:\n${who}\n\nWhat if: ${scenario}\n\nRun the what-if now.`,
    profileId: spendActor(req, profileId),
    mock: () => ({
      impact: `Changing "${scenario}" would reshape parts of your plan. Add a Gemini key for a tailored breakdown; in general, budget and level changes most affect which schools and funding paths fit you.`,
      opensUp: ["Potentially a different tier of schools", "A different funding strategy"],
      watchOut: ["Make sure the new plan still fits your real budget", "Some timelines may shift"],
      verdict: "Worth exploring, but keep it realistic and honest with the numbers.",
    }),
  });

  // A what-if reveals what the student is weighing (a different major, a master's, a
  // gap year). That's a real signal about where their head is, so remember it.
  recordActivity(profileId, {
    module: "whatif",
    kind: "note",
    summary: `Explored a what-if: "${scenario.slice(0, 80)}"`,
    facts: [{ profileId: profileId!, key: "context.considering", type: "context", value: `Considering: ${scenario}`, confidence: 0.6, source: "inferred" }],
  });

  // `data` is parsed model JSON; with a live key it can be null or a primitive
  // (JSON.parse("null") succeeds), so guard the access — bare data.impact would
  // throw and 500. Mirrors the optional-chaining used by the sibling JSON routes.
  res.json({
    scenario,
    impact: typeof data?.impact === "string" ? data.impact : "",
    opensUp: Array.isArray(data?.opensUp) ? data.opensUp : [],
    watchOut: Array.isArray(data?.watchOut) ? data.watchOut : [],
    verdict: typeof data?.verdict === "string" ? data.verdict : "",
    source,
  });
});
