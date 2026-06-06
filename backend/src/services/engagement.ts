// Proactive engagement: the follow-up loop ("did you do it?") and the cohort-wide
// weekly opportunity drop. This is what makes Yaar feel like a counselor who never
// forgets and never sleeps.
import { generateJson } from "./gemini";
import { store } from "../lib/store";
import { runWeeklyDrop } from "./opportunityEngine";

const MAX_FOLLOWUPS = 2;

export async function followUpSweep(): Promise<{ checked: number; sent: number }> {
  const due = await store.getActionItemsDueForFollowup(new Date().toISOString());
  let sent = 0;
  for (const a of due) {
    if (a.followUpCount >= MAX_FOLLOWUPS) {
      await store.updateActionItem(a.id, { status: "expired", resolvedAt: new Date().toISOString() });
      continue;
    }
    const profile = await store.getProfile(a.profileId);
    const { data, source } = await generateJson<{ body: string }>({
      system: "You are Yaar following up on something you suggested. Be warm and brief, no guilt. Ask if they did it and offer help if stuck. One or two sentences.",
      prompt: `You suggested to ${profile?.name ?? "the student"}: "${a.title}" (${a.why}). It has been a few days. Write a short check-in.`,
      mock: () => ({ body: `${profile?.name ?? "Hi"}, how'd it go with "${a.title}"? No stress if you haven't started. I can help, or swap it for something simpler.` }),
    });
    await store.addInboxItem({
      profileId: a.profileId,
      kind: "followup",
      title: "Quick check-in",
      body: data.body,
      cta: { label: "I did it", actionItemId: a.id },
      source: source === "gemini" ? "gemini" : "mock",
    });
    await store.updateActionItem(a.id, {
      followUpCount: a.followUpCount + 1,
      followUpAt: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
    });
    sent++;
  }
  return { checked: due.length, sent };
}

// Each drop is one Gemini call, so the cron fan-out is bounded: a runaway pile of
// scripted profiles must never turn the Monday drop into a four-figure bill.
const MAX_DROP_FANOUT = Number(process.env.MAX_CRON_FANOUT ?? 300);

export async function weeklyDropForAll(): Promise<{ students: number }> {
  const ids = await store.allProfileIds();
  const batch = ids.slice(0, MAX_DROP_FANOUT);
  if (ids.length > batch.length) {
    console.warn(`[engagement] weekly drop capped at ${batch.length} of ${ids.length} profiles (MAX_CRON_FANOUT)`);
  }
  for (const id of batch) {
    try {
      await runWeeklyDrop(id);
    } catch (err) {
      console.error("[engagement] drop failed for", id, err);
    }
  }
  return { students: batch.length };
}
