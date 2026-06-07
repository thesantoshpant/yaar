// Anonymous bug reports and ideas. This is the product's only contact channel,
// so it must work with zero login and zero personal details. Reading reports is
// admin-only (the ops console / a curl with the admin token).
import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { requireAdmin } from "../lib/adminAuth";
import { rateLimit } from "../lib/rateLimit";

export const feedbackRouter = Router();

const submitSchema = z.object({
  kind: z.enum(["bug", "idea", "other"]).default("bug"),
  message: z.string().min(5).max(4000),
  email: z.string().max(200).optional(),
  page: z.string().max(300).optional(),
});

// Strict per-IP limits: this endpoint is unauthenticated and writes to the DB.
const submitLimit = [
  rateLimit({ windowMs: 60_000, max: 3, message: "That's a lot of reports at once. Give it a minute." }),
  rateLimit({ windowMs: 86_400_000, max: 20, message: "You've sent plenty for today. Thank you! Come back tomorrow if there's more." }),
];

feedbackRouter.post("/", ...submitLimit, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await store.addFeedback(parsed.data);
  res.json({ ok: true });
});

feedbackRouter.get("/", requireAdmin, async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
  res.json({ feedback: await store.listFeedback(limit) });
});
