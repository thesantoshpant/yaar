// Diya — the eval / QA agent. Every external agent action passes through her on
// a six-dimension rubric before the Action Gateway will execute or queue it. A
// bad autonomous message (hallucinated visa advice, off-brand tone, spammy CTA)
// is reputationally and legally expensive, so this is the last line of defense
// before anything reaches a real student or a public platform.
//
// The rubric is scored 0..1 per dimension; an action is `approved` only if it
// clears the threshold on EVERY dimension. The reason returned by reviewAction
// summarizes which dimension(s) failed so the proposing agent can refine.

import { generateJson } from "./gemini";

export type RubricDim = "accuracy" | "tone" | "legal_safety" | "brand_fit" | "novelty" | "cta_hygiene";

export interface RubricScores {
  accuracy: number; // does it state only verifiable facts? no invented stats?
  tone: number; // warm, specific, never hypey or guarantee-y?
  legal_safety: number; // does it avoid legal/medical advice; gives proper disclaimers?
  brand_fit: number; // on-voice for Yaar's honest-buddy positioning?
  novelty: number; // not boilerplate / not a repeat of recent posts?
  cta_hygiene: number; // CTA respectful, opt-in, no pressure / fake urgency?
}

export interface ReviewResult {
  approved: boolean;
  scores: RubricScores;
  reason: string; // one-line summary, citing the weakest dim(s)
  weakest: RubricDim[]; // dims that failed the threshold
}

const SYSTEM = `You are Diya, the brand-safety + compliance reviewer for Yaar, an honest AI counseling company for international students.
Score the proposed outbound action on EACH dimension from 0.0 (fails outright) to 1.0 (excellent). Be strict.

Dimensions:
- accuracy: every claim is verifiable / supported. No invented statistics, fake testimonials, made-up admission rates, fabricated quotes.
- tone: warm, direct, specific, in service of the student. Not hypey, not pushy, no exaggeration, no all-caps shouting.
- legal_safety: avoids unauthorized practice of immigration law or medical advice. Includes appropriate disclaimers when touching visa/legal/health topics. Never guarantees admission or visa outcomes. Never tells anyone what they "will" or "won't" get.
- brand_fit: Yaar works for the student, never for schools (no commission language). Honest about limits. No "best in market" / "10x your chances" hype.
- novelty: this is not boilerplate or near-duplicate of typical AI-counselor content. There is at least one specific, concrete useful detail.
- cta_hygiene: any call to action is respectful, opt-in, no fake urgency, no manipulative framing. Platform-rule compliant (no Reddit self-promotion spam, no email without unsubscribe).

Return ONLY JSON: { "scores": { "accuracy": 0..1, "tone": 0..1, "legal_safety": 0..1, "brand_fit": 0..1, "novelty": 0..1, "cta_hygiene": 0..1 }, "summary": string }`;

// Per-dim pass threshold. Defaults are intentionally strict for legal_safety
// (hallucinated visa advice is catastrophic) and accuracy (false stats damage
// trust permanently). Override in env for experimentation.
const T = {
  accuracy: Number(process.env.EVAL_T_ACCURACY ?? 0.8),
  tone: Number(process.env.EVAL_T_TONE ?? 0.7),
  legal_safety: Number(process.env.EVAL_T_LEGAL ?? 0.9),
  brand_fit: Number(process.env.EVAL_T_BRAND ?? 0.7),
  novelty: Number(process.env.EVAL_T_NOVELTY ?? 0.5),
  cta_hygiene: Number(process.env.EVAL_T_CTA ?? 0.7),
};

function clamp01(x: unknown): number {
  const n = typeof x === "number" && Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(1, n));
}

export async function reviewAction(a: { type: string; channel?: string; title: string; payload: string }): Promise<ReviewResult> {
  const { data } = await generateJson<{ scores: Partial<RubricScores>; summary: string }>({
    system: SYSTEM,
    prompt: `Action type: ${a.type}, channel: ${a.channel ?? "n/a"}\nTitle: ${a.title}\nContent:\n${a.payload}\n\nScore it now.`,
    mock: () => ({
      // In dev (no key), default to all-pass so the rest of the pipeline is exercisable.
      scores: { accuracy: 1, tone: 1, legal_safety: 1, brand_fit: 1, novelty: 0.7, cta_hygiene: 1 },
      summary: "review skipped (no Gemini key); approved by default in dev",
    }),
  });

  const s = data?.scores ?? {};
  const scores: RubricScores = {
    accuracy: clamp01(s.accuracy),
    tone: clamp01(s.tone),
    legal_safety: clamp01(s.legal_safety),
    brand_fit: clamp01(s.brand_fit),
    novelty: clamp01(s.novelty),
    cta_hygiene: clamp01(s.cta_hygiene),
  };

  const weakest: RubricDim[] = (Object.keys(T) as RubricDim[]).filter((d) => scores[d] < T[d]);
  const approved = weakest.length === 0;
  const summary = (data?.summary ?? "").trim();
  const reason = approved
    ? summary || "all six dimensions cleared the threshold"
    : `failed: ${weakest.join(", ")} (scores: ${weakest.map((d) => `${d}=${scores[d].toFixed(2)}`).join(", ")})${summary ? `. ${summary}` : ""}`;

  return { approved, scores, reason, weakest };
}
