import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { buildContextPack } from "../services/contextPack";
import { recordActivity } from "../services/activity";
import { store } from "../lib/store";
import { assertOwnership } from "../lib/userAuth";
import { spendActor } from "../lib/actor";
import { SPEAKING_PROMPTS } from "../data/questionBanks";
import { examCriteria } from "../data/rubrics";
import type { SpeakingScore } from "../lib/types";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}

export const speakingRouter = Router();

speakingRouter.get("/prompt", (req, res) => {
  const exam = String(req.query.exam ?? "IELTS").toUpperCase().includes("TOEFL") ? "TOEFL" : "IELTS";
  const prompts = SPEAKING_PROMPTS[exam];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  res.json({ exam, prompt });
});

const scoreSchema = z.object({
  exam: z.string().max(20).default("IELTS"),
  prompt: z.string().min(1).max(2000),
  answer: z.string().min(1).max(12000),
  profileId: z.string().max(40).optional(),
});

function mockSpeakingScore(exam: string, answer: string): SpeakingScore {
  const { exam: examName, scale, criteria } = examCriteria(exam);
  const words = answer.split(/\s+/).filter(Boolean).length;
  const ratio = Math.min(1, words / (examName === "TOEFL" ? 110 : 180));
  const band = examName === "TOEFL" ? Math.round(scale * (0.5 + ratio * 0.45)) : Math.round((4 + ratio * 4) * 2) / 2;
  return {
    band,
    exam: examName,
    criteria: criteria.map((c, i) => ({
      name: c.name,
      score: examName === "TOEFL" ? Math.round(scale * (0.5 + ratio * 0.4)) : Math.round((4 + ratio * 4 + ((i % 2) - 0.5)) * 2) / 2,
      feedback: words < 40 ? `Too brief to show ${c.name.toLowerCase()}. Speak longer and develop your ideas.` : `Reasonable ${c.name.toLowerCase()}. Add detail and examples to push higher.`,
    })),
    improvedAnswer:
      "Demo mode: add a Gemini key for a rewritten model answer. Tip: state your opinion in the first sentence, give two reasons with concrete examples, then conclude.",
    drills: [
      "Speak for 60 seconds without filler words (um, like).",
      "Practice linking ideas with: firstly, for example, as a result, in conclusion.",
      "Record yourself and compare against a band 8 sample.",
    ],
  };
}

speakingRouter.post("/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { exam, prompt, answer, profileId } = parsed.data;
  await assertOwnership(req, profileId);
  const { exam: examName, scale, criteria } = examCriteria(exam);
  const ctx = profileId ? await buildContextPack(profileId) : "";

  const baseSystem = `You are Yaar's speaking-test coach for ${examName}. Score the answer on a ${scale}-point scale using these criteria: ${criteria
    .map((c) => c.name)
    .join(", ")}. Be honest and specific, and provide a rewritten model answer.
Return ONLY JSON: { "band": number, "exam": "${examName}", "criteria": { "name": string, "score": number, "feedback": string }[], "improvedAnswer": string, "drills": string[] }`;
  const system = ctx ? `${ctx}\n\n${baseSystem}` : baseSystem;

  const { data, source } = await generateJson<SpeakingScore>({
    system,
    prompt: `Prompt: ${prompt}\n\nStudent answer (transcribed): ${answer}\n\nScore it now.`,
    profileId: spendActor(req, profileId),
    mock: () => mockSpeakingScore(exam, answer),
  });

  // Defensive normalization in case the model returns partial JSON.
  const score: SpeakingScore = {
    band: typeof data?.band === "number" && Number.isFinite(data.band) ? data.band : 0,
    exam: typeof data?.exam === "string" ? data.exam : examName,
    criteria: Array.isArray(data?.criteria)
      ? data.criteria.map((c) => ({
          name: typeof c?.name === "string" ? c.name : "",
          score: typeof c?.score === "number" && Number.isFinite(c.score) ? c.score : 0,
          feedback: typeof c?.feedback === "string" ? c.feedback : "",
        }))
      : [],
    improvedAnswer: typeof data?.improvedAnswer === "string" ? data.improvedAnswer : "",
    drills: Array.isArray(data?.drills) ? data.drills : [],
  };

  // Standalone speaking practice counts toward the student's history + progress just
  // like a mock does. Persist the attempt and write their level/weak areas to memory.
  if (profileId) {
    const scaledLabel = examName === "IELTS" ? `Band ${score.band.toFixed(1)}` : `${Math.round(score.band)} / 30`;
    const weakTypes = score.criteria.filter((c) => c.score / scale < 0.6).map((c) => c.name);
    void store
      .saveMockAttempt({
        profileId,
        exam: examName as "IELTS" | "TOEFL",
        skill: "speaking",
        scaled: score.band,
        scaledLabel,
        byType: score.criteria.map((c) => ({ type: c.name, correct: Math.round(c.score), total: scale })),
        weakTypes,
        feedback: `Speaking practice: ${scaledLabel}.`,
        analysis: { kind: "rubric", prompt, transcript: answer, criteria: score.criteria.map((c) => ({ ...c, max: scale })), modelNote: score.improvedAnswer },
      })
      .catch(() => {});
    recordActivity(profileId, {
      module: "speaking",
      summary: `${examName} speaking practice: ${scaledLabel}`,
      facts: [
        { profileId, key: `${examName.toLowerCase()}.speaking.level`, type: "skill", value: `${examName} speaking: ${scaledLabel} (latest practice)`, confidence: 0.8, source: "module_outcome" },
        ...weakTypes.slice(0, 3).map((w) => ({ profileId, key: `${examName.toLowerCase()}.speaking.weak.${slug(w)}`, type: "constraint" as const, value: `Needs work on ${examName} speaking: ${w}`, confidence: 0.75, source: "module_outcome" as const })),
      ],
    });
  }

  res.json({ score, source });
});
