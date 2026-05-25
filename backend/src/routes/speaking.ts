import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../services/gemini";
import { SPEAKING_PROMPTS } from "../data/questionBanks";
import { examCriteria } from "../data/rubrics";
import type { SpeakingScore } from "../lib/types";

export const speakingRouter = Router();

speakingRouter.get("/prompt", (req, res) => {
  const exam = String(req.query.exam ?? "IELTS").toUpperCase().includes("TOEFL") ? "TOEFL" : "IELTS";
  const prompts = SPEAKING_PROMPTS[exam];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  res.json({ exam, prompt });
});

const scoreSchema = z.object({
  exam: z.string().default("IELTS"),
  prompt: z.string().min(1),
  answer: z.string().min(1),
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
  const { exam, prompt, answer } = parsed.data;
  const { exam: examName, scale, criteria } = examCriteria(exam);

  const system = `You are Yaar's speaking-test coach for ${examName}. Score the answer on a ${scale}-point scale using these criteria: ${criteria
    .map((c) => c.name)
    .join(", ")}. Be honest and specific, and provide a rewritten model answer.
Return ONLY JSON: { "band": number, "exam": "${examName}", "criteria": { "name": string, "score": number, "feedback": string }[], "improvedAnswer": string, "drills": string[] }`;

  const { data, source } = await generateJson<SpeakingScore>({
    system,
    prompt: `Prompt: ${prompt}\n\nStudent answer (transcribed): ${answer}\n\nScore it now.`,
    mock: () => mockSpeakingScore(exam, answer),
  });
  res.json({ score: data, source });
});
