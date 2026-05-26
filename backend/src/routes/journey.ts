import { Router } from "express";
import { z } from "zod";
import { getOrCreateJourney, recomputeJourney, markModuleComplete } from "../services/journey";
import { assertOwnership } from "../lib/userAuth";

export const journeyRouter = Router();

const completeSchema = z.object({ module: z.string().min(1) });
journeyRouter.post("/:profileId/complete", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const journey = await markModuleComplete(req.params.profileId, parsed.data.module);
  if (!journey) return res.status(404).json({ error: "Profile not found" });
  res.json({ journey });
});

journeyRouter.get("/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const journey = await getOrCreateJourney(req.params.profileId);
  if (!journey) return res.status(404).json({ error: "Profile not found" });
  res.json({ journey });
});

journeyRouter.post("/:profileId/recompute", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const journey = await recomputeJourney(req.params.profileId);
  if (!journey) return res.status(404).json({ error: "Profile not found" });
  res.json({ journey });
});
