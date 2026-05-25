import { Router } from "express";
import { z } from "zod";
import { createCheckoutUrl, confirmSession, isEntitled } from "../services/billing";
import { hasStripe } from "../config";

export const billingRouter = Router();

billingRouter.get("/status/:profileId", (req, res) => {
  res.json({ billingEnabled: hasStripe, entitled: isEntitled(req.params.profileId) });
});

const checkoutSchema = z.object({ profileId: z.string().min(1) });
billingRouter.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const url = await createCheckoutUrl(parsed.data.profileId);
  if (!url) return res.json({ url: null, free: true }); // billing disabled => already unlocked
  res.json({ url });
});

const confirmSchema = z.object({ sessionId: z.string().min(1) });
billingRouter.post("/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await confirmSession(parsed.data.sessionId);
  res.json(result);
});
