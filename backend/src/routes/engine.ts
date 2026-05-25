import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { runWeeklyDrop } from "../services/opportunityEngine";
import { followUpSweep } from "../services/engagement";

export const engineRouter = Router();

// The "magic" button: generate this student's personalized opportunity drop now.
engineRouter.post("/run-now/:profileId", async (req, res) => {
  const result = await runWeeklyDrop(req.params.profileId);
  if (!result) return res.status(404).json({ error: "Profile not found" });
  res.json(result);
});

// Manual trigger of the follow-up sweep (also runs on a cron).
engineRouter.post("/followups", async (_req, res) => {
  const result = await followUpSweep();
  res.json(result);
});

// Inbox feed for a student.
engineRouter.get("/inbox/:profileId", async (req, res) => {
  const items = await store.getInbox(req.params.profileId);
  res.json({ items, unread: items.filter((i) => !i.read).length });
});

engineRouter.patch("/inbox/:id/read", async (req, res) => {
  await store.markInboxRead(req.params.id);
  res.json({ ok: true });
});

// Resolve an action item (the follow-up loop close).
const actionPatch = z.object({ status: z.enum(["in_progress", "done", "skipped"]) });
engineRouter.patch("/action/:id", async (req, res) => {
  const parsed = actionPatch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const item = await store.getActionItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Action not found" });

  const status = parsed.data.status;
  const updated = await store.updateActionItem(req.params.id, {
    status,
    resolvedAt: status === "done" || status === "skipped" ? new Date().toISOString() : undefined,
  });

  if (status === "done") {
    await store.addEvent({ profileId: item.profileId, kind: "action_taken", module: item.module, summary: `Did: ${item.title}`, status: "done" });
    await store.addInboxItem({
      profileId: item.profileId,
      kind: "celebration",
      title: "Nice work",
      body: `You completed "${item.title}". That genuinely strengthens your application. I will build your next step around it.`,
      source: "mock",
    });
  }
  res.json({ action: updated });
});
