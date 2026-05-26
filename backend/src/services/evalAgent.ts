// The eval / QA agent. Before any outbound action queues or executes, it vets the
// content for honesty, brand-safety, and compliance. A bad autonomous message is
// reputationally expensive, so this is the last line of defense before the world.
import { generateJson } from "./gemini";

export async function reviewAction(a: { type: string; channel?: string; title: string; payload: string }): Promise<{
  approved: boolean;
  reason: string;
}> {
  const { data } = await generateJson<{ approved: boolean; reason: string }>({
    system: `You are Yaar's brand-safety and compliance reviewer for an honest AI counseling company for international students.
Approve an outbound action ONLY if it is: honest and accurate (no unverifiable stats, no fake testimonials), on-brand (warm, specific, never hypey, never guarantees admission or visa outcomes), in the student's interest (no school commissions/bias), not spammy, and respectful of platform rules and consent.
Reject anything misleading, guaranteeing outcomes, pressuring, spammy, discriminatory, or that gives legal advice. Be strict.
Return ONLY JSON: { "approved": boolean, "reason": string }`,
    prompt: `Action type: ${a.type}, channel: ${a.channel ?? "n/a"}
Title: ${a.title}
Content: ${a.payload}
Review it now.`,
    mock: () => ({ approved: true, reason: "review skipped (no Gemini key); approved by default in dev" }),
  });
  return { approved: Boolean(data?.approved), reason: data?.reason ?? "no reason given" };
}
