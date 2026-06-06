import { Router } from "express";
import { z } from "zod";
import { generateText } from "../services/gemini";
import { hasGemini } from "../config";
import { buildContextPack } from "../services/contextPack";
import { extractMemory } from "../services/memoryUpdate";
import { assertOwnership } from "../lib/userAuth";
import { spendActor } from "../lib/actor";
import { COUNSELOR_SYSTEM } from "../lib/prompts";
import type { ChatMessage } from "../lib/types";

export const counselorRouter = Router();

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(40),
  profileSummary: z.string().max(2000).optional(),
  profileId: z.string().max(40).optional(),
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
  // The context pack contains this student's private memory; never build it for
  // a profile the requester doesn't own.
  await assertOwnership(req, profileId);
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

  const { text, source } = await generateText({ prompt, system: COUNSELOR_SYSTEM, temperature: 0.6, profileId: spendActor(req, profileId) });

  if (profileId) extractMemory(profileId, `${transcript(messages)}\nCounselor: ${text}`);
  res.json({ reply: text, source });
});
