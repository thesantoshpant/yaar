// Public-ish endpoints that expose Yaar's evaluable AI components to the
// yaar-evals runner. The runner (scripts/run-evals.mjs) calls these against
// the live backend so the eval suite measures the real system, not a stub.
import { Router } from "express";
import { z } from "zod";
import { reviewAction } from "../services/evalAgent";

export const evalsRouter = Router();

const diyaSchema = z.object({
  type: z.string().min(1),
  channel: z.string().optional(),
  title: z.string().min(1),
  payload: z.string().min(1),
});

evalsRouter.post("/diya", async (req, res) => {
  const parsed = diyaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const r = await reviewAction(parsed.data);
  res.json(r);
});
