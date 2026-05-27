// Mock-test engine for IELTS Academic and TOEFL (classic 0-120 format). Generates a
// real exam-style section with Gemini (adapted to the student's weak areas from memory),
// scores it, saves the attempt for history, and writes performance back into the student's
// mind so the next test targets their weak spots. See docs/exam-specs.md for the spec.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import { rememberFacts } from "./memoryUpdate";
import { YAAR_PRINCIPLES } from "../lib/prompts";
import type { MockAttempt } from "../lib/types";

export type Exam = "IELTS" | "TOEFL";

export interface MockQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
}
interface KeyedQuestion extends MockQuestion {
  answer: string;
  explanation: string;
}
interface CachedReading {
  exam: Exam;
  title: string;
  passage: string;
  questions: KeyedQuestion[];
  targetBand: string;
  createdAt: number;
}

// Generated tests live in memory until scored (the answer key must never reach the client).
const cache = new Map<string, CachedReading>();
const TTL = 3 * 60 * 60 * 1000;
function prune() {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.createdAt > TTL) cache.delete(k);
}
function id(): string {
  return Math.random().toString(36).slice(2, 12);
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}
function norm(s: string): string {
  return (s ?? "").toString().trim().toLowerCase().replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ");
}

const READING_TYPES: Record<Exam, string> = {
  IELTS:
    "Use a realistic spread of IELTS Academic reading question types: true_false_notgiven, yes_no_notgiven, matching_headings, multiple_choice, sentence_completion, summary_completion. For *_notgiven the options are exactly [\"True\",\"False\",\"Not Given\"] or [\"Yes\",\"No\",\"Not Given\"]. For multiple_choice give 4 options. For completion types, answer is the exact word(s) from the passage (no options).",
  TOEFL:
    "Use a realistic spread of TOEFL reading question types: factual, negative_factual, inference, vocabulary, rhetorical_purpose, sentence_simplification, insert_text. Each is multiple_choice-style with 4 options (A-D) except keep it as plain option strings. The answer must be the exact correct option string.",
};

// IELTS Academic Reading: percent-correct -> band (anchored to the official /40 table).
function ieltsReadingBand(pct: number): number {
  const p = pct * 100;
  if (p >= 96) return 9;
  if (p >= 91) return 8.5;
  if (p >= 86) return 8;
  if (p >= 81) return 7.5;
  if (p >= 74) return 7;
  if (p >= 66) return 6.5;
  if (p >= 56) return 6;
  if (p >= 46) return 5.5;
  if (p >= 36) return 5;
  if (p >= 30) return 4.5;
  if (p >= 24) return 4;
  return 3.5;
}

export interface GeneratedReading {
  testId: string;
  exam: Exam;
  skill: "reading";
  title: string;
  passage: string;
  questions: MockQuestion[];
  timeSec: number;
  targetBand: string;
}

// Build an adaptive hint from the student's recent reading attempts + mind.
async function adaptiveHint(profileId: string | undefined, exam: Exam): Promise<string> {
  if (!profileId) return "This is their first attempt; aim for a balanced, mid-difficulty set.";
  const attempts = (await store.listMockAttempts(profileId, 20)).filter((a) => a.exam === exam && a.skill === "reading");
  if (attempts.length === 0) return "First reading attempt for this exam; aim for a balanced, mid-difficulty set.";
  const last = attempts[0];
  const weak = [...new Set(attempts.flatMap((a) => a.weakTypes))].slice(0, 4);
  return `The student has done ${attempts.length} reading mock(s). Last result: ${last.scaledLabel}. Weak question types to emphasize and gently push on: ${weak.join(", ") || "none identified yet"}. Calibrate difficulty just above their last result so it stretches them without crushing them.`;
}

export async function generateReading(exam: Exam, profileId?: string): Promise<GeneratedReading> {
  prune();
  const hint = await adaptiveHint(profileId, exam);
  const count = 10;
  const { data } = await generateJson<{ title: string; passage: string; questions: KeyedQuestion[] }>({
    system: `${YAAR_PRINCIPLES}
You are an expert ${exam} item writer. Create ONE authentic ${exam} Academic Reading practice set: a single academic passage plus ${count} questions, exam-accurate in style and difficulty.
${READING_TYPES[exam]}
Passage length: ${exam === "IELTS" ? "about 750-850 words" : "about 600-700 words"}, non-specialist academic prose, original (do not copy real exam texts).
Each question needs: a unique short id, a "type" (snake_case from the list), a "prompt", optional "options" (string array) for choice/notgiven types, the exact "answer" (must match an option string for choice types, or the exact passage word(s) for completion), and a one-sentence "explanation" grounded in the passage.
Adaptivity: ${hint}
Return ONLY JSON: { "title": string, "passage": string, "questions": [ { "id": string, "type": string, "prompt": string, "options": string[], "answer": string, "explanation": string } ] }`,
    prompt: `Write the ${exam} reading practice set now.`,
    temperature: 0.7,
    mock: () => ({
      title: "The Rise of Urban Vertical Farms",
      passage:
        "Vertical farming, the practice of growing crops in stacked layers indoors, has moved from a niche experiment to a serious response to urban food security. By controlling light, temperature, and nutrients, these farms can produce greens year-round using a fraction of the water of traditional agriculture. Critics note the high energy cost of artificial lighting, yet proponents argue that proximity to cities cuts transport emissions and waste. As LED efficiency improves, the economics continue to shift. (Demo passage — add a Gemini key for a full exam-accurate set.)",
      questions: [
        { id: "q1", type: "true_false_notgiven", prompt: "Vertical farms use less water than traditional agriculture.", options: ["True", "False", "Not Given"], answer: "True", explanation: "The passage says they use a fraction of the water." },
        { id: "q2", type: "true_false_notgiven", prompt: "Vertical farms are cheaper to run than outdoor farms today.", options: ["True", "False", "Not Given"], answer: "Not Given", explanation: "Costs are discussed but no direct comparison of total cost is made." },
        { id: "q3", type: "multiple_choice", prompt: "What is the main drawback critics raise?", options: ["Water use", "Energy cost of lighting", "Transport emissions", "Crop variety"], answer: "Energy cost of lighting", explanation: "Critics note the high energy cost of artificial lighting." },
      ],
    }),
  });

  const questions: KeyedQuestion[] = (Array.isArray(data?.questions) ? data.questions : []).map((q, i) => ({
    id: q.id || `q${i + 1}`,
    type: q.type || "multiple_choice",
    prompt: q.prompt || "",
    options: Array.isArray(q.options) && q.options.length ? q.options : undefined,
    answer: (q.answer ?? "").toString(),
    explanation: q.explanation || "",
  }));

  const testId = id();
  const targetBand = exam === "IELTS" ? "calibrated to your level" : "scaled 0-30";
  cache.set(testId, { exam, title: data.title || "Reading practice", passage: data.passage || "", questions, targetBand, createdAt: Date.now() });

  return {
    testId,
    exam,
    skill: "reading",
    title: data.title || "Reading practice",
    passage: data.passage || "",
    questions: questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options })),
    timeSec: exam === "IELTS" ? 20 * 60 : 18 * 60,
    targetBand,
  };
}

export interface ReadingResult {
  exam: Exam;
  skill: "reading";
  rawCorrect: number;
  rawTotal: number;
  scaled: number;
  scaledLabel: string;
  byType: { type: string; correct: number; total: number }[];
  weakTypes: string[];
  feedback: string;
  questions: { id: string; type: string; prompt: string; your: string; correctAnswer: string; correct: boolean; explanation: string }[];
}

export async function scoreReading(testId: string, responses: Record<string, string>, profileId?: string): Promise<ReadingResult | null> {
  const test = cache.get(testId);
  if (!test) return null;

  const byType = new Map<string, { correct: number; total: number }>();
  let correctCount = 0;
  const questions = test.questions.map((q) => {
    const your = (responses[q.id] ?? "").toString();
    const correct = norm(your) === norm(q.answer) && your.trim() !== "";
    if (correct) correctCount++;
    const t = byType.get(q.type) ?? { correct: 0, total: 0 };
    t.total++;
    if (correct) t.correct++;
    byType.set(q.type, t);
    return { id: q.id, type: q.type, prompt: q.prompt, your, correctAnswer: q.answer, correct, explanation: q.explanation };
  });

  const total = test.questions.length || 1;
  const pct = correctCount / total;
  const byTypeArr = [...byType.entries()].map(([type, v]) => ({ type, correct: v.correct, total: v.total }));
  const weakTypes = byTypeArr.filter((t) => t.correct / t.total < 0.6).map((t) => t.type);

  let scaled: number;
  let scaledLabel: string;
  if (test.exam === "IELTS") {
    scaled = ieltsReadingBand(pct);
    scaledLabel = `Band ${scaled.toFixed(1)}`;
  } else {
    scaled = Math.round(30 * Math.pow(pct, 0.92));
    scaledLabel = `${scaled} / 30`;
  }

  const feedback =
    weakTypes.length > 0
      ? `You got ${correctCount} of ${total} right (${scaledLabel}). You're losing the most marks on: ${weakTypes.join(", ")}. Your next practice set will give you more of these so you can turn them into strengths.`
      : `Strong work: ${correctCount} of ${total} right (${scaledLabel}). No single weak question type stood out. Your next set will push the difficulty up a notch.`;

  // History.
  await store.saveMockAttempt({
    profileId: profileId ?? "",
    exam: test.exam,
    skill: "reading",
    scaled,
    scaledLabel,
    rawCorrect: correctCount,
    rawTotal: total,
    byType: byTypeArr,
    weakTypes,
    feedback,
  });

  // Memory: the next test (and the whole app) now knows their reading level + weak spots.
  if (profileId) {
    const ex = test.exam.toLowerCase();
    const facts = [
      { profileId, key: `${ex}.reading.level`, type: "skill" as const, value: `${test.exam} reading: ${scaledLabel} (latest mock)`, confidence: 0.85, source: "module_outcome" as const },
      ...weakTypes.slice(0, 4).map((w) => ({ profileId, key: `${ex}.reading.weak.${slug(w)}`, type: "constraint" as const, value: `Needs work on ${test.exam} reading "${w.replace(/_/g, " ")}" questions`, confidence: 0.8, source: "module_outcome" as const })),
    ];
    await rememberFacts(facts);
    await store.addEvent({ profileId, kind: "module_run", module: "test_prep", summary: `${test.exam} reading mock: ${scaledLabel}`, status: "done" }).catch(() => {});
  }

  cache.delete(testId);
  return { exam: test.exam, skill: "reading", rawCorrect: correctCount, rawTotal: total, scaled, scaledLabel, byType: byTypeArr, weakTypes, feedback, questions };
}
