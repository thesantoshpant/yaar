// Mock-test endpoints: generate an exam-accurate section (adaptive to the student's
// memory), score it, and read past attempts (history). See services/mockExam.ts.
import { Router } from "express";
import { z } from "zod";
import { generateReading, scoreSection, generateWriting, scoreWriting, generateListening, generateSpeaking, scoreSpeaking, getListeningAudio, type Exam } from "../services/mockExam";
import { store } from "../lib/store";
import { assertOwnership } from "../lib/userAuth";
import { spendActor } from "../lib/actor";

export const mockRouter = Router();

const examOf = (s: unknown): Exam => (String(s ?? "IELTS").toUpperCase().includes("TOEFL") ? "TOEFL" : "IELTS");

const generateSchema = z.object({ exam: z.string().max(20).optional(), profileId: z.string().max(40).optional() });
mockRouter.post("/reading/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  const test = await generateReading(examOf(parsed.data.exam), parsed.data.profileId, spendActor(req, parsed.data.profileId));
  res.json(test);
});

const scoreSchema = z.object({
  testId: z.string().min(1).max(40),
  responses: z.record(z.string().max(40), z.string().max(500)).default({}),
  profileId: z.string().max(40).optional(),
});
mockRouter.post("/reading/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  const result = await scoreSection(parsed.data.testId, parsed.data.responses, parsed.data.profileId);
  if (!result) return res.status(404).json({ error: "This test expired. Start a fresh one." });
  res.json(result);
});

// Listening reuses the cached objective scorer (same as reading).
mockRouter.post("/listening/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  res.json(await generateListening(examOf(parsed.data.exam), parsed.data.profileId, spendActor(req, parsed.data.profileId)));
});

// Poll for the pre-generated natural-voice audio (generated in the background at
// /generate). NO model call happens here (pure cache read), and the client polls
// it every few seconds, so it lives on its own router OFF the AI rate tier —
// otherwise the polling alone would eat the student's AI budget.
export const mockAudioRouter = Router();
mockAudioRouter.get("/listening/:testId/audio", (req, res) => {
  res.json(getListeningAudio(req.params.testId));
});
mockRouter.post("/listening/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  const result = await scoreSection(parsed.data.testId, parsed.data.responses, parsed.data.profileId);
  if (!result) return res.status(404).json({ error: "This test expired. Start a fresh one." });
  res.json(result);
});

// Speaking: generate a task, then score the recorded answer's transcript.
mockRouter.post("/speaking/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  res.json(await generateSpeaking(examOf(parsed.data.exam), parsed.data.profileId, spendActor(req, parsed.data.profileId)));
});
const speakingScoreSchema = z.object({
  exam: z.string().max(20).optional(),
  taskType: z.string().max(40).default(""),
  prompt: z.string().min(1).max(2000),
  transcript: z.string().min(1).max(12000),
  profileId: z.string().max(40).optional(),
});
mockRouter.post("/speaking/score", async (req, res) => {
  const parsed = speakingScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  await assertOwnership(req, d.profileId);
  res.json(await scoreSpeaking(examOf(d.exam), d.taskType, d.prompt, d.transcript, d.profileId, spendActor(req, d.profileId)));
});

mockRouter.post("/writing/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  res.json(await generateWriting(examOf(parsed.data.exam), parsed.data.profileId, spendActor(req, parsed.data.profileId)));
});

const writingScoreSchema = z.object({
  exam: z.string().max(20).optional(),
  taskType: z.string().max(40).default(""),
  prompt: z.string().min(1).max(4000),
  context: z.string().max(4000).optional(),
  essay: z.string().min(1).max(12000),
  profileId: z.string().max(40).optional(),
});
mockRouter.post("/writing/score", async (req, res) => {
  const parsed = writingScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  await assertOwnership(req, d.profileId);
  res.json(await scoreWriting(examOf(d.exam), d.taskType, d.prompt, d.context, d.essay, d.profileId, spendActor(req, d.profileId)));
});

mockRouter.get("/history/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  res.json({ attempts: await store.listMockAttempts(req.params.profileId) });
});

// Cohort percentile: "you scored higher than X% of the most recent N attempts
// for this exam+skill." Used by the Mock share card. No auth: the result is a
// number plus a sample size, both anonymous and harmless to expose.
mockRouter.get("/cohort/:exam/:skill", async (req, res) => {
  const exam = examOf(req.params.exam);
  const skillParam = String(req.params.skill || "").toLowerCase();
  const skill = (["reading", "listening", "writing", "speaking"] as const).find((s) => s === skillParam);
  if (!skill) return res.status(400).json({ error: "bad skill" });
  const score = Number(req.query.score);
  if (!Number.isFinite(score)) return res.status(400).json({ error: "score required" });
  const attempts = await store.listMockAttemptsByExamSkill(exam, skill, 500);
  // Self-attempts are noise; treat the request as anonymous percentile math.
  const scores = attempts.map((a) => a.scaled).filter((s) => Number.isFinite(s));
  if (scores.length < 5) {
    return res.json({ percentile: null, cohortSize: scores.length, note: "not enough data yet" });
  }
  const below = scores.filter((s) => s < score).length;
  const equal = scores.filter((s) => s === score).length;
  // Standard percentile-rank formula treats half of the ties as below.
  const percentile = Math.round(((below + equal / 2) / scores.length) * 100);
  res.json({ percentile, cohortSize: scores.length });
});
