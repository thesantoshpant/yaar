// Text -> natural speech (WAV). Used by the listening mock so audio sounds human, not robotic.
import { Router } from "express";
import { z } from "zod";
import { synthesize } from "../services/tts";

export const ttsRouter = Router();

const schema = z.object({ text: z.string().min(1).max(8000), voice: z.string().optional() });

ttsRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await synthesize(parsed.data.text, parsed.data.voice);
  // source "mock" means TTS is unavailable; the client falls back to the browser voice.
  res.json(result);
});
