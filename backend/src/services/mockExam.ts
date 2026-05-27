// Mock-test engine for IELTS Academic and TOEFL (classic 0-120 format). Generates a
// real exam-style section with Gemini (adapted to the student's weak areas from memory),
// scores it, saves the attempt for history, and writes performance back into the student's
// mind so the next test targets their weak spots. See docs/exam-specs.md for the spec.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import { rememberFacts } from "./memoryUpdate";
import { synthesize } from "./tts";
import { YAAR_PRINCIPLES } from "../lib/prompts";
import { IELTS_SPEAKING_CRITERIA, TOEFL_SPEAKING_CRITERIA } from "../data/rubrics";
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
interface CachedSection {
  exam: Exam;
  skill: "reading" | "listening";
  title: string;
  passage: string; // reading passage, or the listening transcript (read aloud client-side)
  questions: KeyedQuestion[];
  targetBand: string;
  createdAt: number;
}

// Generated tests live in memory until scored (the answer key must never reach the client).
const cache = new Map<string, CachedSection>();
const TTL = 3 * 60 * 60 * 1000;

// Listening audio is generated in the background (TTS is slow) and cached by testId,
// so it's ready by the time the student reads the page instead of waiting on a click.
const audioCache = new Map<string, { status: "pending" | "ready" | "failed"; audio?: string; mimeType?: string; at: number }>();
function prepareListeningAudio(testId: string, transcript: string): void {
  audioCache.set(testId, { status: "pending", at: Date.now() });
  void (async () => {
    try {
      const r = await synthesize(transcript);
      if (r.source === "gemini" && r.audioBase64) audioCache.set(testId, { status: "ready", audio: r.audioBase64, mimeType: r.mimeType, at: Date.now() });
      else audioCache.set(testId, { status: "failed", at: Date.now() });
    } catch {
      audioCache.set(testId, { status: "failed", at: Date.now() });
    }
  })();
}
export function getListeningAudio(testId: string): { status: "pending" | "ready" | "failed"; audioBase64?: string; mimeType?: string } {
  const e = audioCache.get(testId);
  if (!e) return { status: "failed" }; // unknown -> client uses the browser-voice fallback
  if (e.status === "ready") return { status: "ready", audioBase64: e.audio, mimeType: e.mimeType };
  return { status: e.status };
}

function prune() {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.createdAt > TTL) cache.delete(k);
  for (const [k, v] of audioCache) if (now - v.at > TTL) audioCache.delete(k);
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

// The model sometimes returns the answer key as a bare letter ("B") while the options
// are full strings ("B) The concept..."), or vice-versa. Grade robustly across all forms.
function letterOf(opt: string, options?: string[]): string | null {
  const m = opt.trim().match(/^\(?([A-Za-z])[).:]/);
  if (m) return m[1].toUpperCase();
  if (options) {
    const i = options.findIndex((o) => norm(o) === norm(opt));
    if (i >= 0 && i < 26) return String.fromCharCode(65 + i);
  }
  return null;
}
function gradeChoice(your: string, key: string, options?: string[]): boolean {
  if (!your.trim()) return false;
  if (norm(your) === norm(key)) return true;
  const k = key.trim();
  if (/^[A-Za-z]$/.test(k)) {
    const yl = letterOf(your, options);
    if (yl && yl === k.toUpperCase()) return true;
    const idx = k.toUpperCase().charCodeAt(0) - 65;
    if (options && options[idx] && norm(options[idx]) === norm(your)) return true;
    return false;
  }
  const km = k.match(/^\(?([A-Za-z])[).:]\s*(.*)$/);
  if (km) {
    if (km[2] && norm(km[2]) === norm(your)) return true;
    const yl = letterOf(your, options);
    if (yl && yl === km[1].toUpperCase()) return true;
  }
  return false;
}
// Resolve the answer key to the full option text for display.
function correctDisplay(key: string, options?: string[]): string {
  const k = key.trim();
  if (options && options.length) {
    const exact = options.find((o) => norm(o) === norm(k));
    if (exact) return exact;
    if (/^[A-Za-z]$/.test(k)) {
      const i = k.toUpperCase().charCodeAt(0) - 65;
      if (options[i]) return options[i];
    }
    const km = k.match(/^\(?([A-Za-z])[).:]/);
    if (km) {
      const i = km[1].toUpperCase().charCodeAt(0) - 65;
      if (options[i]) return options[i];
    }
  }
  return key;
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
  const count = 7;
  const genOnce = () =>
    generateJson<{ title: string; passage: string; questions: KeyedQuestion[] }>({
      system: `${YAAR_PRINCIPLES}
You are an expert ${exam} item writer. Create ONE authentic ${exam} Academic Reading practice set: a single academic passage plus EXACTLY ${count} questions (the "questions" array must contain ${count} items), exam-accurate in style and difficulty.
${READING_TYPES[exam]}
Passage length: ${exam === "IELTS" ? "about 500-600 words" : "about 400-500 words"}, non-specialist academic prose, original (do not copy real exam texts). Keep it focused so it generates quickly.
Each question needs: a unique short id, a "type" (snake_case from the list), a "prompt", optional "options" (string array) for choice/notgiven types, the exact "answer" (must match an option string for choice types, or the exact passage word(s) for completion), and a one-sentence "explanation" grounded in the passage.
Adaptivity: ${hint}
Return ONLY JSON: { "title": string, "passage": string, "questions": [ { "id": string, "type": string, "prompt": string, "options": string[], "answer": string, "explanation": string } ] }`,
      prompt: `Write the ${exam} reading practice set now. Include all ${count} questions.`,
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

  // The model occasionally returns a passage with an empty/short questions array; retry
  // until we have a usable set so a student never gets a 0-question test.
  let data: { title?: string; passage?: string; questions?: KeyedQuestion[] } = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await genOnce();
    if (res.data?.passage && !data.passage) data = res.data;
    const valid = (Array.isArray(res.data?.questions) ? res.data.questions : []).filter((q) => q && q.prompt && String(q.answer ?? "").trim());
    if (valid.length >= 3) {
      data = res.data;
      break;
    }
  }

  const questions: KeyedQuestion[] = (Array.isArray(data?.questions) ? data.questions : [])
    .filter((q) => q && q.prompt && String(q.answer ?? "").trim())
    .map((q, i) => ({
      id: q.id || `q${i + 1}`,
      type: q.type || "multiple_choice",
      prompt: q.prompt || "",
      options: Array.isArray(q.options) && q.options.length ? q.options : undefined,
      answer: (q.answer ?? "").toString(),
      explanation: q.explanation || "",
    }));

  const testId = id();
  const targetBand = exam === "IELTS" ? "calibrated to your level" : "scaled 0-30";
  cache.set(testId, { exam, skill: "reading", title: data.title || "Reading practice", passage: data.passage || "", questions, targetBand, createdAt: Date.now() });

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

export interface SectionResult {
  exam: Exam;
  skill: "reading" | "listening";
  rawCorrect: number;
  rawTotal: number;
  scaled: number;
  scaledLabel: string;
  byType: { type: string; correct: number; total: number }[];
  weakTypes: string[];
  feedback: string;
  questions: { id: string; type: string; prompt: string; your: string; correctAnswer: string; correct: boolean; explanation: string }[];
}

export async function scoreSection(testId: string, responses: Record<string, string>, profileId?: string): Promise<SectionResult | null> {
  const test = cache.get(testId);
  if (!test) return null;
  const skill = test.skill;

  const byType = new Map<string, { correct: number; total: number }>();
  let correctCount = 0;
  const questions = test.questions.map((q) => {
    const your = (responses[q.id] ?? "").toString();
    const hasOptions = Array.isArray(q.options) && q.options.length > 0;
    const correct = hasOptions ? gradeChoice(your, q.answer, q.options) : norm(your) === norm(q.answer) && your.trim() !== "";
    if (correct) correctCount++;
    const t = byType.get(q.type) ?? { correct: 0, total: 0 };
    t.total++;
    if (correct) t.correct++;
    byType.set(q.type, t);
    return { id: q.id, type: q.type, prompt: q.prompt, your, correctAnswer: hasOptions ? correctDisplay(q.answer, q.options) : q.answer, correct, explanation: q.explanation };
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

  // Save history + write memory only for known students (guests still get scored, just
  // not persisted — there is no identity to attach the attempt to).
  if (profileId) {
    await store.saveMockAttempt({
      profileId,
      exam: test.exam,
      skill,
      scaled,
      scaledLabel,
      rawCorrect: correctCount,
      rawTotal: total,
      byType: byTypeArr,
      weakTypes,
      feedback,
      analysis: { kind: "objective", title: test.title, questions },
    });

    // The next test (and the whole app) now knows their level + weak spots for this skill.
    const ex = test.exam.toLowerCase();
    const facts = [
      { profileId, key: `${ex}.${skill}.level`, type: "skill" as const, value: `${test.exam} ${skill}: ${scaledLabel} (latest mock)`, confidence: 0.85, source: "module_outcome" as const },
      ...weakTypes.slice(0, 4).map((w) => ({ profileId, key: `${ex}.${skill}.weak.${slug(w)}`, type: "constraint" as const, value: `Needs work on ${test.exam} ${skill} "${w.replace(/_/g, " ")}" questions`, confidence: 0.8, source: "module_outcome" as const })),
    ];
    await rememberFacts(facts);
    await store.addEvent({ profileId, kind: "module_run", module: "test_prep", summary: `${test.exam} ${skill} mock: ${scaledLabel}`, status: "done" }).catch(() => {});
  }

  cache.delete(testId);
  return { exam: test.exam, skill, rawCorrect: correctCount, rawTotal: total, scaled, scaledLabel, byType: byTypeArr, weakTypes, feedback, questions };
}

const roundHalf = (x: number) => Math.round(x * 2) / 2;

// Writing criteria per exam (drives the scoring prompt + the result UI).
const WRITING_CRITERIA: Record<Exam, { name: string; max: number }[]> = {
  IELTS: [
    { name: "Task Response", max: 9 },
    { name: "Coherence and Cohesion", max: 9 },
    { name: "Lexical Resource", max: 9 },
    { name: "Grammatical Range and Accuracy", max: 9 },
  ],
  TOEFL: [
    { name: "Relevance and elaboration", max: 5 },
    { name: "Coherence and organization", max: 5 },
    { name: "Language use", max: 5 },
  ],
};

export interface WritingTask {
  exam: Exam;
  skill: "writing";
  taskType: string; // "ielts_task2" | "toefl_academic_discussion"
  prompt: string;
  context?: string; // TOEFL: professor question + two student posts
  minWords: number;
  timeSec: number;
}

async function memoryHint(profileId: string | undefined, exam: Exam, skill: string): Promise<string> {
  if (!profileId) return "First attempt; aim for a balanced, mid-difficulty task.";
  const attempts = (await store.listMockAttempts(profileId, 20)).filter((a) => a.exam === exam && a.skill === skill);
  if (attempts.length === 0) return "First attempt for this skill; balanced, mid-difficulty.";
  const weak = [...new Set(attempts.flatMap((a) => a.weakTypes))].slice(0, 4);
  return `${attempts.length} prior attempt(s); last ${attempts[0].scaledLabel}. Weak areas to stretch: ${weak.join(", ") || "none yet"}. Calibrate just above their last result.`;
}

export async function generateWriting(exam: Exam, profileId?: string): Promise<WritingTask> {
  const hint = await memoryHint(profileId, exam, "writing");
  const taskType = exam === "IELTS" ? "ielts_task2" : "toefl_academic_discussion";
  const { data } = await generateJson<{ prompt: string; context?: string }>({
    system: `${YAAR_PRINCIPLES}
You are an expert ${exam} item writer. Create ONE authentic ${exam} writing task.
${
      exam === "IELTS"
        ? 'IELTS Academic Writing Task 2: an essay question on a topic of general interest (opinion / discuss both views / problem-solution / advantages-disadvantages). Return just the prompt text.'
        : 'TOEFL "Writing for an Academic Discussion": return "context" = a professor\'s question plus two short student posts (label them, e.g. "Dr. ___:", "Student A:", "Student B:"), and "prompt" = the instruction to write your own contribution (>=100 words) stating and supporting a clear opinion.'
    }
Adaptivity: ${hint}
Return ONLY JSON: { "prompt": string, "context": string }`,
    prompt: `Write the ${exam} writing task now.`,
    temperature: 0.8,
    mock: () =>
      exam === "IELTS"
        ? { prompt: "Some people believe that university education should be free for all students. To what extent do you agree or disagree? Give reasons and examples. Write at least 250 words." }
        : { prompt: "Write a post of at least 100 words contributing your own view, with reasons and examples.", context: "Dr. Lee: Should cities invest more in public transport or in roads for cars? Student A: Public transport reduces traffic and pollution. Student B: But many families rely on cars for work and rural access." },
  });
  return {
    exam,
    skill: "writing",
    taskType,
    prompt: data.prompt || "",
    context: data.context,
    minWords: exam === "IELTS" ? 250 : 100,
    timeSec: exam === "IELTS" ? 40 * 60 : 10 * 60,
  };
}

export interface WritingResult {
  exam: Exam;
  skill: "writing";
  scaled: number;
  scaledLabel: string;
  criteria: { name: string; score: number; max: number; feedback: string }[];
  modelNote: string;
  weakTypes: string[];
  feedback: string;
}

export async function scoreWriting(exam: Exam, taskType: string, prompt: string, context: string | undefined, essay: string, profileId?: string): Promise<WritingResult> {
  const crit = WRITING_CRITERIA[exam];
  const { data } = await generateJson<{ criteria: { name: string; score: number; feedback: string }[]; modelNote: string }>({
    system: `${YAAR_PRINCIPLES}
You are a strict but fair ${exam} writing examiner. Score the student's response against these criteria, each out of ${crit[0].max}: ${crit.map((c) => c.name).join(", ")}.
Apply the real ${exam} band descriptors. Be honest and specific; cite what would push each criterion higher. Also give a 1-2 sentence "modelNote" describing what a top-scoring response does differently.
Return ONLY JSON: { "criteria": [ { "name": string, "score": number, "feedback": string } ], "modelNote": string }`,
    prompt: `Task type: ${taskType}\n${context ? `Stimulus:\n${context}\n` : ""}Prompt: ${prompt}\n\nStudent response (${essay.split(/\s+/).filter(Boolean).length} words):\n${essay}\n\nScore it now.`,
    temperature: 0.3,
    mock: () => ({
      criteria: crit.map((c) => ({ name: c.name, score: Math.round(c.max * 0.6 * 2) / 2, feedback: `Reasonable ${c.name.toLowerCase()}. Develop ideas further with specific examples to score higher.` })),
      modelNote: "A top response states a clear position, develops each point with a concrete example, and uses varied, precise language with very few errors.",
    }),
  });

  const scored = crit.map((c) => {
    const found = (data.criteria ?? []).find((x) => x.name?.toLowerCase().includes(c.name.toLowerCase().slice(0, 6)));
    const raw = typeof found?.score === "number" ? found.score : c.max * 0.6;
    return { name: c.name, score: Math.max(0, Math.min(c.max, raw)), max: c.max, feedback: found?.feedback || "" };
  });
  const avg = scored.reduce((s, c) => s + c.score, 0) / scored.length;

  let scaled: number;
  let scaledLabel: string;
  if (exam === "IELTS") {
    scaled = roundHalf(avg);
    scaledLabel = `Band ${scaled.toFixed(1)}`;
  } else {
    scaled = Math.round(Math.min(30, avg * 6));
    scaledLabel = `${scaled} / 30`;
  }

  const weakTypes = scored.filter((c) => c.score / c.max < 0.6).map((c) => c.name);
  const feedback =
    weakTypes.length > 0
      ? `${scaledLabel}. Biggest gains will come from: ${weakTypes.join(", ")}. Your next writing task will target these.`
      : `${scaledLabel}. Solid and balanced across the criteria. Your next task will push the difficulty up.`;

  if (profileId) {
    await store.saveMockAttempt({ profileId, exam, skill: "writing", scaled, scaledLabel, byType: scored.map((c) => ({ type: c.name, correct: Math.round(c.score), total: c.max })), weakTypes, feedback, analysis: { kind: "rubric", prompt, context, essay, criteria: scored, modelNote: data.modelNote || "" } });
    const ex = exam.toLowerCase();
    await rememberFacts([
      { profileId, key: `${ex}.writing.level`, type: "skill", value: `${exam} writing: ${scaledLabel} (latest mock)`, confidence: 0.85, source: "module_outcome" },
      ...weakTypes.slice(0, 3).map((w) => ({ profileId, key: `${ex}.writing.weak.${slug(w)}`, type: "constraint" as const, value: `Needs work on ${exam} writing: ${w}`, confidence: 0.8, source: "module_outcome" as const })),
    ]);
    await store.addEvent({ profileId, kind: "module_run", module: "test_prep", summary: `${exam} writing mock: ${scaledLabel}`, status: "done" }).catch(() => {});
  }

  return { exam, skill: "writing", scaled, scaledLabel, criteria: scored, modelNote: data.modelNote || "", weakTypes, feedback };
}

// ---------- Listening (transcript read aloud client-side, objective questions) ----------
export interface GeneratedListening {
  testId: string;
  exam: Exam;
  skill: "listening";
  title: string;
  transcript: string; // the browser reads this aloud (speechSynthesis); hidden until review
  questions: MockQuestion[];
  timeSec: number;
}

export async function generateListening(exam: Exam, profileId?: string): Promise<GeneratedListening> {
  prune();
  const hint = await memoryHint(profileId, exam, "listening");
  const count = 6;
  const genOnce = () =>
    generateJson<{ title: string; transcript: string; questions: KeyedQuestion[] }>({
      system: `${YAAR_PRINCIPLES}
You are an expert ${exam} item writer. Create ONE authentic ${exam} listening item: a TRANSCRIPT that will be read aloud to the student (text-to-speech), plus EXACTLY ${count} questions (the "questions" array must contain ${count} items).
The transcript is a ${exam === "IELTS" ? "natural monologue or a two-speaker conversation (social or academic)" : "short academic lecture or a campus conversation"}, about 150-190 words, spoken style. For conversations, prefix each turn with the speaker and a colon (e.g. "Tutor:", "Student:") so different voices can be used.
Questions: mostly multiple_choice (4 options) plus 1-2 short "completion" (answer is exact word(s) from the transcript, no options). Questions must be answerable only by listening (do not show the transcript during the test).
Adaptivity: ${hint}
Return ONLY JSON: { "title": string, "transcript": string, "questions": [ { "id": string, "type": string, "prompt": string, "options": string[], "answer": string, "explanation": string } ] }`,
      prompt: `Write the ${exam} listening item now. Include all ${count} questions.`,
      temperature: 0.7,
      mock: () => ({
        title: "Booking a Study Room",
        transcript:
          "Librarian: Good morning, how can I help? Student: Hi, I'd like to book a group study room for tomorrow afternoon. Librarian: Sure. Rooms hold up to six people and can be booked for two hours. The afternoon slots are 1 to 3, or 3 to 5. Student: The 3 to 5 slot, please, for four people. Librarian: Done. Just bring your student card to collect the key from this desk. (Demo transcript — add a Gemini key for a full item.)",
        questions: [
          { id: "q1", type: "multiple_choice", prompt: "How long can a room be booked for?", options: ["One hour", "Two hours", "Three hours", "All day"], answer: "Two hours", explanation: "The librarian says rooms can be booked for two hours." },
          { id: "q2", type: "multiple_choice", prompt: "Which slot did the student choose?", options: ["1 to 3", "3 to 5", "2 to 4", "Morning"], answer: "3 to 5", explanation: "The student chose the 3 to 5 slot." },
          { id: "q3", type: "completion", prompt: "To collect the key, bring your ____.", answer: "student card", explanation: "The librarian says to bring your student card." },
        ],
      }),
    });

  // Retry if the model returns too few usable questions, so a student never gets an empty test.
  let data: { title?: string; transcript?: string; questions?: KeyedQuestion[] } = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await genOnce();
    if (res.data?.transcript && !data.transcript) data = res.data;
    const valid = (Array.isArray(res.data?.questions) ? res.data.questions : []).filter((q) => q && q.prompt && String(q.answer ?? "").trim());
    if (valid.length >= 3) {
      data = res.data;
      break;
    }
  }

  const questions: KeyedQuestion[] = (Array.isArray(data?.questions) ? data.questions : [])
    .filter((q) => q && q.prompt && String(q.answer ?? "").trim())
    .map((q, i) => ({
      id: q.id || `q${i + 1}`,
      type: q.type || "multiple_choice",
      prompt: q.prompt || "",
      options: Array.isArray(q.options) && q.options.length ? q.options : undefined,
      answer: (q.answer ?? "").toString(),
      explanation: q.explanation || "",
    }));

  const testId = id();
  cache.set(testId, { exam, skill: "listening", title: data.title || "Listening", passage: data.transcript || "", questions, targetBand: "", createdAt: Date.now() });
  prepareListeningAudio(testId, data.transcript || ""); // start TTS now so it's ready on play
  return {
    testId,
    exam,
    skill: "listening",
    title: data.title || "Listening",
    transcript: data.transcript || "",
    questions: questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options })),
    timeSec: 8 * 60,
  };
}

// ---------- Speaking (recorded answer -> transcript -> rubric score) ----------
const SPEAKING_CRITERIA: Record<Exam, { name: string; max: number }[]> = {
  IELTS: IELTS_SPEAKING_CRITERIA.map((c) => ({ name: c.name, max: 9 })),
  TOEFL: TOEFL_SPEAKING_CRITERIA.map((c) => ({ name: c.name, max: 4 })),
};

export interface SpeakingTask {
  exam: Exam;
  skill: "speaking";
  taskType: string;
  prompt: string;
  bullets?: string[];
  prepSec: number;
  speakSec: number;
}

export async function generateSpeaking(exam: Exam, profileId?: string): Promise<SpeakingTask> {
  const hint = await memoryHint(profileId, exam, "speaking");
  const { data } = await generateJson<{ prompt: string; bullets?: string[] }>({
    system: `${YAAR_PRINCIPLES}
You are an expert ${exam} examiner writing ONE authentic speaking task.
${
      exam === "IELTS"
        ? 'IELTS Speaking Part 2 (the long turn): a cue-card topic. Return "prompt" = "Describe ..." and "bullets" = the 3-4 "You should say:" points plus a final "and explain ..." point.'
        : 'TOEFL Speaking Task 1 (Independent): a paired-choice / opinion question the student answers in 45 seconds. Return "prompt" = the question. No bullets.'
    }
Adaptivity: ${hint}
Return ONLY JSON: { "prompt": string, "bullets": string[] }`,
    prompt: `Write the ${exam} speaking task now.`,
    temperature: 0.8,
    mock: () =>
      exam === "IELTS"
        ? { prompt: "Describe a skill you would like to learn.", bullets: ["what the skill is", "why you want to learn it", "how you would learn it", "and explain how it would help you"] }
        : { prompt: "Some students prefer to study in the morning, while others prefer the evening. Which do you prefer, and why? Include reasons and examples." },
  });
  return {
    exam,
    skill: "speaking",
    taskType: exam === "IELTS" ? "ielts_part2" : "toefl_task1",
    prompt: data.prompt || "",
    bullets: Array.isArray(data.bullets) && data.bullets.length ? data.bullets : undefined,
    prepSec: exam === "IELTS" ? 60 : 15,
    speakSec: exam === "IELTS" ? 120 : 45,
  };
}

export interface SpeakingResult {
  exam: Exam;
  skill: "speaking";
  scaled: number;
  scaledLabel: string;
  criteria: { name: string; score: number; max: number; feedback: string }[];
  modelNote: string;
  weakTypes: string[];
  feedback: string;
  note: string;
}

export async function scoreSpeaking(exam: Exam, taskType: string, prompt: string, transcript: string, profileId?: string): Promise<SpeakingResult> {
  const crit = SPEAKING_CRITERIA[exam];
  const { data } = await generateJson<{ criteria: { name: string; score: number; feedback: string }[]; modelNote: string }>({
    system: `${YAAR_PRINCIPLES}
You are a ${exam} speaking examiner. You are scoring from a TRANSCRIPT of the student's spoken answer, so judge Fluency/Language/Topic well, but treat Pronunciation/Delivery as approximate (a transcript cannot fully capture it) and say so in that criterion's feedback.
Score each criterion out of ${crit[0].max}: ${crit.map((c) => c.name).join(", ")}. Use the real ${exam} descriptors. Give a 1-2 sentence "modelNote" on what a top answer does.
Return ONLY JSON: { "criteria": [ { "name": string, "score": number, "feedback": string } ], "modelNote": string }`,
    prompt: `Task: ${taskType}\nPrompt: ${prompt}\n\nStudent's spoken answer (transcribed, ${transcript.split(/\s+/).filter(Boolean).length} words):\n${transcript}\n\nScore it now.`,
    temperature: 0.3,
    mock: () => ({
      criteria: crit.map((c) => ({ name: c.name, score: Math.round(c.max * 0.6 * 2) / 2, feedback: `Reasonable ${c.name.toLowerCase()}. Speak longer and develop ideas with examples to score higher.` })),
      modelNote: "A top answer is fluent, well-organized, uses a range of accurate language, and fully develops the response with specific examples.",
    }),
  });

  const scored = crit.map((c) => {
    const found = (data.criteria ?? []).find((x) => x.name?.toLowerCase().includes(c.name.toLowerCase().slice(0, 6)));
    const raw = typeof found?.score === "number" ? found.score : c.max * 0.6;
    return { name: c.name, score: Math.max(0, Math.min(c.max, raw)), max: c.max, feedback: found?.feedback || "" };
  });
  const avg = scored.reduce((s, c) => s + c.score, 0) / scored.length;

  let scaled: number;
  let scaledLabel: string;
  if (exam === "IELTS") {
    scaled = roundHalf(avg);
    scaledLabel = `Band ${scaled.toFixed(1)}`;
  } else {
    scaled = Math.round(Math.min(30, avg * 7.5));
    scaledLabel = `${scaled} / 30`;
  }

  const weakTypes = scored.filter((c) => c.score / c.max < 0.6).map((c) => c.name);
  const feedback =
    weakTypes.length > 0
      ? `${scaledLabel}. Focus next on: ${weakTypes.join(", ")}. Your next speaking task will target these.`
      : `${scaledLabel}. Well balanced across the criteria. Your next task will push you further.`;

  if (profileId) {
    await store.saveMockAttempt({ profileId, exam, skill: "speaking", scaled, scaledLabel, byType: scored.map((c) => ({ type: c.name, correct: Math.round(c.score), total: c.max })), weakTypes, feedback, analysis: { kind: "rubric", prompt, transcript, criteria: scored, modelNote: data.modelNote || "" } });
    const ex = exam.toLowerCase();
    await rememberFacts([
      { profileId, key: `${ex}.speaking.level`, type: "skill", value: `${exam} speaking: ${scaledLabel} (latest mock)`, confidence: 0.85, source: "module_outcome" },
      ...weakTypes.slice(0, 3).map((w) => ({ profileId, key: `${ex}.speaking.weak.${slug(w)}`, type: "constraint" as const, value: `Needs work on ${exam} speaking: ${w}`, confidence: 0.8, source: "module_outcome" as const })),
    ]);
    await store.addEvent({ profileId, kind: "module_run", module: "test_prep", summary: `${exam} speaking mock: ${scaledLabel}`, status: "done" }).catch(() => {});
  }

  return { exam, skill: "speaking", scaled, scaledLabel, criteria: scored, modelNote: data.modelNote || "", weakTypes, feedback, note: "Pronunciation/delivery is estimated from your transcript and is approximate." };
}
