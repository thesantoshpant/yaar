// Mock-test endpoints: generate an exam-accurate section (adaptive to the student's
// memory), score it, and read past attempts (history). See services/mockExam.ts.
import { Router } from "express";
import { z } from "zod";
import { generateReading, scoreReading, type Exam } from "../services/mockExam";
import { store } from "../lib/store";
import { assertOwnership } from "../lib/userAuth";

export const mockRouter = Router();

const examOf = (s: unknown): Exam => (String(s ?? "IELTS").toUpperCase().includes("TOEFL") ? "TOEFL" : "IELTS");

const generateSchema = z.object({ exam: z.string().optional(), profileId: z.string().optional() });
mockRouter.post("/reading/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const test = await generateReading(examOf(parsed.data.exam), parsed.data.profileId);
  res.json(test);
});

const scoreSchema = z.object({
  testId: z.string().min(1),
  responses: z.record(z.string(), z.string()).default({}),
  profileId: z.string().optional(),
});
mockRouter.post("/reading/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await scoreReading(parsed.data.testId, parsed.data.responses, parsed.data.profileId);
  if (!result) return res.status(404).json({ error: "This test expired. Start a fresh one." });
  res.json(result);
});

mockRouter.get("/history/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  res.json({ attempts: await store.listMockAttempts(req.params.profileId) });
});
