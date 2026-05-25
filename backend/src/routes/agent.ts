// The autonomous counselor brain. This is the USP: no human agent, no commissions.
// Given where a student is in their journey, it decides the single best next action
// and drives them forward, unbiased and 24/7. This is what makes Yaar
// fully autonomous rather than a set of tools a human has to operate.
import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { getOrCreateJourney } from "../services/journey";
import { buildContextPack } from "../services/contextPack";
import { personaPreamble } from "../lib/personaPreamble";

export const agentRouter = Router();

export type ModuleKey = "roadmap" | "test_prep" | "school_search" | "applications" | "finances" | "visa";

interface NextAction {
  module: ModuleKey;
  title: string;
  why: string;
  autoRunnable: boolean; // can the agent execute this without the student doing anything first
}

interface AgentPlan {
  nextAction: NextAction;
  alternatives: NextAction[];
  progressPct: number;
  encouragement: string;
}

const bodySchema = z.object({
  profileSummary: z.string().optional(),
  completed: z.array(z.string()).default([]),
  notes: z.string().optional(),
  profileId: z.string().optional(),
});

// Default unbiased ordering of the journey, used by the mock and as a guardrail.
const ORDER: { module: ModuleKey; title: string; why: string; autoRunnable: boolean }[] = [
  { module: "roadmap", title: "Build your personal roadmap", why: "We need a realistic plan before anything else.", autoRunnable: true },
  { module: "test_prep", title: "Start English test prep", why: "Your TOEFL or IELTS score gates both admission and the visa.", autoRunnable: true },
  { module: "school_search", title: "Build a balanced school list", why: "An unbiased reach, match, safety list based on real data.", autoRunnable: true },
  { module: "applications", title: "Draft your applications", why: "Strong essays and on-time submission decide outcomes.", autoRunnable: true },
  { module: "finances", title: "Organize your I-20 finances", why: "Clean, consistent funding documents are essential for the visa.", autoRunnable: false },
  { module: "visa", title: "Run a mock visa interview", why: "Most refusals are about ties and finances, both fixable with practice.", autoRunnable: true },
];

function mockPlan(completed: string[]): AgentPlan {
  const remaining = ORDER.filter((o) => !completed.includes(o.module));
  const next = remaining[0] ?? ORDER[ORDER.length - 1];
  const progressPct = Math.round((completed.length / ORDER.length) * 100);
  return {
    nextAction: next,
    alternatives: remaining.slice(1, 3),
    progressPct,
    encouragement:
      progressPct >= 80
        ? "You are almost there. Finish strong."
        : progressPct >= 40
        ? "Good momentum. Keep going, one step at a time."
        : "Great start. Let us take this one step at a time, together.",
  };
}

agentRouter.post("/plan", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { profileSummary, completed, notes, profileId } = parsed.data;

  // Persona + memory make the plan adapt to who the student actually is.
  let preamble = "";
  let pack = "";
  if (profileId) {
    const journey = await getOrCreateJourney(profileId);
    preamble = personaPreamble(journey);
    pack = await buildContextPack(profileId);
  }

  const system = `You are Yaar's autonomous counselor brain. You guide an international student from zero to a US admission and an approved F-1 visa, with NO human counselor and NO school commissions, so your advice is always unbiased and in the student's best interest.
Decide the single best NEXT ACTION for this student, drawn from these modules: roadmap, test_prep, school_search, applications, finances, visa.
Adapt to the student's situation and pacing. Be proactive and decisive. Never guarantee outcomes. This is coaching and information, not legal advice.${preamble ? `\n${preamble}` : ""}
Return ONLY JSON: { "nextAction": { "module": one of the modules, "title": string, "why": string, "autoRunnable": boolean }, "alternatives": same-shape[], "progressPct": number 0-100, "encouragement": string }`;

  const prompt = `${pack ? `What you remember about this student:\n${pack}\n\n` : `Student profile: ${profileSummary ?? "unknown"}.\n`}Modules already completed: ${
    completed.length ? completed.join(", ") : "none"
  }.
Extra notes: ${notes ?? "none"}.
Decide the next action now.`;

  const { data, source } = await generateJson<AgentPlan>({ system, prompt, mock: () => mockPlan(completed) });
  res.json({ plan: data, source });
});
