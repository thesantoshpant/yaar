// Progress + history for a student: trends, comparisons, weak areas, activity timeline,
// and an honest recap. See services/progress.ts.
import { Router } from "express";
import { buildProgress } from "../services/progress";
import { assertOwnership } from "../lib/userAuth";

export const progressRouter = Router();

progressRouter.get("/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  res.json(await buildProgress(req.params.profileId));
});
