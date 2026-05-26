import { Router } from "express";
import { z } from "zod";
import { generateText, generateJson } from "../services/gemini";
import { hasGemini } from "../config";
import { visaQuestionsFor } from "../data/questionBanks";
import { VISA_DIMENSIONS } from "../data/rubrics";
import { VISA_OFFICER_SYSTEM, visaScoreSystem } from "../lib/prompts";
import { buildContextPack } from "../services/contextPack";
import type { VisaScore, VisaTurn } from "../lib/types";

export const visaRouter = Router();

const turnSchema = z.object({
  role: z.enum(["officer", "student"]),
  text: z.string(),
});

// `documents` is the differentiator: the student pastes their real I-20 / funding
// details so the officer can probe inconsistencies the way a real consular officer would.
const nextSchema = z.object({
  country: z.string().default("Nepal"),
  history: z.array(turnSchema).default([]),
  documents: z.string().optional(),
  profileId: z.string().optional(),
});

function docBlock(documents?: string): string {
  return documents ? `\nApplicant documents (I-20 / funding):\n${documents}\n` : "";
}

visaRouter.post("/next", async (req, res) => {
  const parsed = nextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { country, history, documents, profileId } = parsed.data;

  if (!hasGemini) {
    const bank = visaQuestionsFor(country);
    const asked = history.filter((t) => t.role === "officer").length;
    const question = bank[asked % bank.length];
    return res.json({ question, done: asked >= 8, source: "mock" });
  }

  const ctx = profileId ? await buildContextPack(profileId) : "";
  const system = ctx ? `${ctx}\n\n${VISA_OFFICER_SYSTEM}` : VISA_OFFICER_SYSTEM;
  const convo = history.map((t) => `${t.role === "officer" ? "Officer" : "Applicant"}: ${t.text}`).join("\n");
  const { text, source } = await generateText({
    system,
    prompt: `Country: ${country}.${docBlock(documents)}\nInterview so far:\n${convo || "(not started)"}\n\nAsk your next question now. If you have asked 8 or more questions, you may say "That is all, please wait." Output only the officer's line.`,
    temperature: 0.7,
  });
  const officerCount = history.filter((t) => t.role === "officer").length;
  res.json({ question: text, done: officerCount >= 8, source });
});

const scoreSchema = z.object({
  country: z.string().default("Nepal"),
  history: z.array(turnSchema).min(1),
  documents: z.string().optional(),
  profileId: z.string().optional(),
});

function mockScore(history: VisaTurn[]): VisaScore {
  const answers = history.filter((t) => t.role === "student");
  const avgLen = answers.length ? answers.reduce((a, t) => a + t.text.split(/\s+/).length, 0) / answers.length : 0;
  const base = Math.max(40, Math.min(88, Math.round(50 + avgLen * 1.5)));
  return {
    overall: base,
    recommendation:
      base >= 75
        ? "Solid. Tighten your weakest answers and you are interview-ready."
        : "Not ready yet. Your answers need to be more specific and consistent, especially on ties to home and finances.",
    dimensions: VISA_DIMENSIONS.map((d, i) => ({
      name: d.name,
      score: Math.max(35, Math.min(90, base + ((i % 3) - 1) * 8)),
      note: d.description,
    })),
    redFlags: [
      avgLen < 8 ? "Answers are too short. Officers read brevity as lack of preparation or honesty." : "Watch for memorized-sounding answers.",
      "Make sure every number you say matches your I-20 and bank documents exactly.",
    ],
    drills: [
      "Record a 30-second answer to: why this university and this major.",
      "Practice naming your sponsor, their job, and the exact funding amount in one breath.",
      "Prepare two concrete reasons you will return home after graduation.",
    ],
  };
}

visaRouter.post("/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { country, history, documents, profileId } = parsed.data;
  const ctx = profileId ? await buildContextPack(profileId) : "";

  const baseSystem = `${visaScoreSystem(VISA_DIMENSIONS.map((d) => d.name).join(", "))}
Return ONLY JSON: { "overall": number 0-100, "recommendation": string, "dimensions": { "name": string, "score": number, "note": string }[], "redFlags": string[], "drills": string[] }`;
  const system = ctx ? `${ctx}\n\n${baseSystem}` : baseSystem;
  const convo = history.map((t) => `${t.role === "officer" ? "Officer" : "Applicant"}: ${t.text}`).join("\n");

  const { data, source } = await generateJson<VisaScore>({
    system,
    prompt: `Country: ${country}.${docBlock(documents)}\nTranscript:\n${convo}\n\nScore it now.`,
    mock: () => mockScore(history),
  });
  res.json({ score: data, source });
});
