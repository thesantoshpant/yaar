import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { runWeeklyDrop } from "../services/opportunityEngine";
import { followUpSweep } from "../services/engagement";
import { assertOwnership } from "../lib/userAuth";
import { requireAdmin } from "../lib/adminAuth";

export const engineRouter = Router();

// The "magic" button: generate this student's personalized opportunity drop now.
engineRouter.post("/run-now/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const result = await runWeeklyDrop(req.params.profileId);
  if (!result) return res.status(404).json({ error: "Profile not found" });
  res.json(result);
});

// Manual trigger of the follow-up sweep (also runs on a cron). Admin-only: it
// sweeps EVERY student's due follow-ups (one model call each), so it must not be
// callable by the public.
engineRouter.post("/followups", requireAdmin, async (_req, res) => {
  const result = await followUpSweep();
  res.json(result);
});

// Inbox feed for a student. The unread count is computed independently of the
// 50-item display window so older unread items still count toward the badge.
engineRouter.get("/inbox/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const [items, unread] = await Promise.all([
    store.getInbox(req.params.profileId),
    store.countUnread(req.params.profileId),
  ]);
  res.json({ items, unread });
});

engineRouter.patch("/inbox/:id/read", async (req, res) => {
  const item = await store.getInboxItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  await assertOwnership(req, item.profileId);
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
  await assertOwnership(req, item.profileId);

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
