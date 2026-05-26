// Read and refresh a student's persistent mind. Powers the "What Yaar remembers
// about you" panel and lets the Memory Agent re-synthesize on demand.
import { Router } from "express";
import { store } from "../lib/store";
import { assertOwnership } from "../lib/userAuth";
import { consolidateMind } from "../services/memoryAgent";

export const memoryRouter = Router();

memoryRouter.get("/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const all = await store.getFacts(req.params.profileId, 80);
  const brief = all.find((f) => f.key === "mind.brief")?.value ?? null;
  const facts = all
    .filter((f) => f.key !== "mind.brief")
    .map((f) => ({ key: f.key, type: f.type, value: f.value, confidence: f.confidence, source: f.source }));
  res.json({ brief, facts });
});

memoryRouter.post("/:profileId/consolidate", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const result = await consolidateMind(req.params.profileId);
  res.json(result ?? { brief: "", insights: 0, source: "mock" });
});
