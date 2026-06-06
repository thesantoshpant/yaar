// Audio -> text via Gemini. Browser records a short clip and posts it here as base64.
import { Router, json } from "express";
import { z } from "zod";
import { transcribeAudio } from "../services/transcribe";
import { spendActor } from "../lib/actor";

export const transcribeRouter = Router();

// Audio arrives base64 in JSON, so this route needs a larger body than the 1mb default.
const uploadBody = json({ limit: "20mb" });
const MAX_BYTES = 10 * 1024 * 1024; // ~10MB of audio (a couple of minutes)

const schema = z.object({
  mimeType: z.string().min(1),
  data: z.string().min(1), // base64, no data: prefix
});

transcribeRouter.post("/", uploadBody, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { mimeType, data } = parsed.data;
  // Browsers record audio as audio/webm or audio/mp4; some report it as video/webm.
  if (!/^(audio\/|video\/webm)/i.test(mimeType)) return res.status(400).json({ error: "Expected an audio recording." });
  if (Buffer.byteLength(data, "base64") > MAX_BYTES) return res.status(413).json({ error: "That recording is too long. Keep it under about two minutes." });
  const result = await transcribeAudio({ mimeType, data }, spendActor(req));
  res.json(result);
});
