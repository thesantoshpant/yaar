import { Router } from "express";
import { z } from "zod";
import { generateText } from "../services/gemini";
import { hasGemini } from "../config";
import { buildContextPack } from "../services/contextPack";
import { recordActivity } from "../services/activity";

export const applicationsRouter = Router();

const bodySchema = z.object({
  type: z.enum(["sop", "common_app"]).default("sop"),
  profileSummary: z.string().optional(),
  school: z.string().optional(),
  major: z.string().optional(),
  promptText: z.string().optional(),
  notes: z.string().optional(),
  profileId: z.string().optional(),
});

type Body = z.infer<typeof bodySchema>;

const SYSTEM = `You are Yaar's application writing agent. You draft a strong, authentic first draft of a US university
essay in the student's own voice. Be specific and human, avoid cliches, and never fabricate facts. If details are missing,
use clearly marked placeholders like [your specific example]. This is a draft for the student to edit, not a final product.`;

function mockDraft(b: Body): string {
  const kind = b.type === "common_app" ? "Common App personal essay" : "Statement of Purpose";
  const school = b.school ? ` for ${b.school}` : "";
  const major = b.major ?? "[your major]";
  return [
    `Draft ${kind}${school} (demo mode, add a Gemini key for a tailored draft):`,
    "",
    `When I first [describe a specific moment that drew you to ${major}], I realized that [the concrete problem you want to solve]. That moment set the direction I have followed since.`,
    "",
    `At [your school or context], I [specific project or experience], where I learned [specific skill or insight]. I want to study ${major}${school} because [name a specific program feature, professor, lab, or course] aligns with this goal.`,
    "",
    `After my degree, I plan to [specific, realistic post-study plan and how it ties you to your home country and career]. [Add one concrete detail that proves this is real for you.]`,
    "",
    "Editing tips: replace every bracket with a specific, true detail. Cut any sentence that could appear in anyone's essay. Lead with a concrete moment, not a general statement.",
  ].join("\n");
}

applicationsRouter.post("/draft", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = parsed.data;

  // Whichever path we take, remember they're working on this essay and mine the real
  // details they shared (their notes are some of the most valuable, true facts we get).
  const kindLabel = b.type === "common_app" ? "Common App essay" : "Statement of Purpose";
  recordActivity(b.profileId, {
    module: "applications",
    summary: `Drafted a ${kindLabel}${b.school ? ` for ${b.school}` : ""}`,
    facts: b.school ? [{ profileId: b.profileId!, key: `application.target.${b.school.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`, type: "goal", value: `Working on an application to ${b.school}`, confidence: 0.8, source: "student_stated" }] : undefined,
    extractText: b.notes && b.notes.trim().length > 24 ? `Real details the student shared for their essay: ${b.notes}` : undefined,
  });

  if (!hasGemini) {
    return res.json({ draft: mockDraft(b), source: "mock" });
  }

  const ctx = b.profileId ? await buildContextPack(b.profileId) : "";
  const system = ctx ? `${ctx}\n\n${SYSTEM}` : SYSTEM;

  const prompt = [
    `Essay type: ${b.type === "common_app" ? "Common App personal essay (650 words)" : "Statement of Purpose"}.`,
    b.school ? `Target school: ${b.school}.` : "",
    b.major ? `Intended major: ${b.major}.` : "",
    b.profileSummary ? `Student profile: ${b.profileSummary}.` : "",
    b.promptText ? `Essay prompt: ${b.promptText}.` : "",
    b.notes ? `Student notes and real details to use: ${b.notes}.` : "",
    "Write the draft now. Use [placeholders] only where you lack a real detail.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text, source } = await generateText({ system, prompt, temperature: 0.7 });
  res.json({ draft: text, source });
});
