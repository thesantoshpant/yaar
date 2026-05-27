// Mock-test endpoints: generate an exam-accurate section (adaptive to the student's
// memory), score it, and read past attempts (history). See services/mockExam.ts.
import { Router } from "express";
import { z } from "zod";
import { generateReading, scoreSection, generateWriting, scoreWriting, generateListening, generateSpeaking, scoreSpeaking, getListeningAudio, type Exam } from "../services/mockExam";
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
  const result = await scoreSection(parsed.data.testId, parsed.data.responses, parsed.data.profileId);
  if (!result) return res.status(404).json({ error: "This test expired. Start a fresh one." });
  res.json(result);
});

// Listening reuses the cached objective scorer (same as reading).
mockRouter.post("/listening/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await generateListening(examOf(parsed.data.exam), parsed.data.profileId));
});
// Poll for the pre-generated natural-voice audio (generated in the background at /generate).
mockRouter.get("/listening/:testId/audio", (req, res) => {
  res.json(getListeningAudio(req.params.testId));
});
mockRouter.post("/listening/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await scoreSection(parsed.data.testId, parsed.data.responses, parsed.data.profileId);
  if (!result) return res.status(404).json({ error: "This test expired. Start a fresh one." });
  res.json(result);
});

// Speaking: generate a task, then score the recorded answer's transcript.
mockRouter.post("/speaking/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await generateSpeaking(examOf(parsed.data.exam), parsed.data.profileId));
});
const speakingScoreSchema = z.object({
  exam: z.string().optional(),
  taskType: z.string().default(""),
  prompt: z.string().min(1),
  transcript: z.string().min(1),
  profileId: z.string().optional(),
});
mockRouter.post("/speaking/score", async (req, res) => {
  const parsed = speakingScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  res.json(await scoreSpeaking(examOf(d.exam), d.taskType, d.prompt, d.transcript, d.profileId));
});

mockRouter.post("/writing/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await generateWriting(examOf(parsed.data.exam), parsed.data.profileId));
});

const writingScoreSchema = z.object({
  exam: z.string().optional(),
  taskType: z.string().default(""),
  prompt: z.string().min(1),
  context: z.string().optional(),
  essay: z.string().min(1),
  profileId: z.string().optional(),
});
mockRouter.post("/writing/score", async (req, res) => {
  const parsed = writingScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  res.json(await scoreWriting(examOf(d.exam), d.taskType, d.prompt, d.context, d.essay, d.profileId));
});

mockRouter.get("/history/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  res.json({ attempts: await store.listMockAttempts(req.params.profileId) });
});
