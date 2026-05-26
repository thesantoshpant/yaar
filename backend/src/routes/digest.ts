// Preview or send a student's weekly email digest. Preview lets the student (and the
// founder during a demo) see exactly what Yaar would email, even with no provider key.
import { Router } from "express";
import { assertOwnership } from "../lib/userAuth";
import { buildDigest, sendDigest } from "../services/digest";

export const digestRouter = Router();

digestRouter.get("/:profileId/preview", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const d = await buildDigest(req.params.profileId);
  if (!d) return res.status(404).json({ error: "Profile not found" });
  res.json(d);
});

digestRouter.post("/:profileId/send", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const r = await sendDigest(req.params.profileId);
  if (!r) return res.status(404).json({ error: "Profile not found" });
  res.json(r);
});
