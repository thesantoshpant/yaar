import { Router } from "express";
import { z } from "zod";
import { generateText } from "../services/gemini";
import { hasGemini } from "../config";
import { buildContextPack } from "../services/contextPack";
import { extractMemory } from "../services/memoryUpdate";
import type { ChatMessage } from "../lib/types";

export const counselorRouter = Router();

const COUNSELOR_SYSTEM = `You are Yaar, an honest AI counselor for international students applying to US universities.
You work for the STUDENT, not for the schools. You never take kickbacks and you never push a school because it pays you.
You are warm, direct, and practical. You give specific, actionable guidance and you are honest about what is realistic.
You have a memory of this student; use it so the conversation feels personal and continuous.
Hard rules: you are a coaching and information tool, NOT a legal or immigration adviser. Never give legal advice and never
guarantee admission or visa outcomes. If asked for legal advice, say you provide guidance and information and suggest a
licensed professional for legal questions. Keep answers concise and concrete. Use plain language.`;

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
  profileSummary: z.string().optional(),
  profileId: z.string().optional(),
});

function transcript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role === "user" ? "Student" : "Counselor"}: ${m.content}`).join("\n");
}

function mockReply(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1]?.content ?? "";
  return [
    "Here is how I would think about that (running in demo mode, add a Gemini key for full answers):",
    `You asked: "${last.slice(0, 140)}".`,
    "First, get clear on your target intake and budget, then we pick a balanced school list, then we prep your tests and essays, and finally your visa interview.",
    "Tell me your country, intended major, and rough budget and I will sketch a roadmap.",
  ].join(" ");
}

counselorRouter.post("/chat", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { messages, profileSummary, profileId } = parsed.data;
  const pack = profileId ? await buildContextPack(profileId) : "";

  if (!hasGemini) {
    if (profileId) extractMemory(profileId, transcript(messages));
    return res.json({ reply: mockReply(messages), source: "mock" });
  }

  const prompt = [
    pack ? `What you remember about this student:\n${pack}` : profileSummary ? `Student profile: ${profileSummary}` : "",
    "Conversation so far:",
    transcript(messages),
    "Reply as the counselor to the student's latest message. Use the memory above so it feels personal and continuous. If something important is still unknown and the moment is natural, ask ONE gentle question to learn it.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, source } = await generateText({ prompt, system: COUNSELOR_SYSTEM, temperature: 0.6 });

  if (profileId) extractMemory(profileId, `${transcript(messages)}\nCounselor: ${text}`);
  res.json({ reply: text, source });
});
