import { Router } from "express";
import { getOrCreateJourney, recomputeJourney } from "../services/journey";

export const journeyRouter = Router();

journeyRouter.get("/:profileId", async (req, res) => {
  const journey = await getOrCreateJourney(req.params.profileId);
  if (!journey) return res.status(404).json({ error: "Profile not found" });
  res.json({ journey });
});

journeyRouter.post("/:profileId/recompute", async (req, res) => {
  const journey = await recomputeJourney(req.params.profileId);
  if (!journey) return res.status(404).json({ error: "Profile not found" });
  res.json({ journey });
});
