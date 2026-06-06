// Evidence Vault: log what a student actually did, then turn it into application
// material (Common App activity lines + an essay-ready paragraph). This compounds
// the student's story over years instead of scrambling senior year.
import { Router } from "express";
import { z } from "zod";
import { store } from "../lib/store";
import { generateJson } from "../services/gemini";
import { YAAR_PRINCIPLES } from "../lib/prompts";
import { rememberEvidence } from "../services/memoryUpdate";
import { assertOwnership } from "../lib/userAuth";

export const evidenceRouter = Router();

const createSchema = z.object({
  profileId: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  whatYouDid: z.string().min(1).max(4000),
  whoBenefited: z.string().max(300).optional(),
  proofUrl: z.string().max(500).optional(),
  skills: z.array(z.string().max(60)).max(20).default([]),
  reflection: z.string().max(4000).optional(),
  linkedActionItemId: z.string().max(40).optional(),
});

evidenceRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await assertOwnership(req, parsed.data.profileId);
  const item = await store.addEvidence(parsed.data);
  await store.addEvent({
    profileId: item.profileId,
    kind: "milestone",
    summary: `Logged evidence: ${item.title}`,
    status: "done",
  });
  // Closing the loop: evidence linked to a suggested action completes it. Because
  // gaps are computed from completed action tags, this also advances gap state.
  // The linked action must belong to the SAME profile; otherwise a crafted link
  // could mark another student's action item done.
  if (item.linkedActionItemId) {
    const linked = await store.getActionItem(item.linkedActionItemId);
    if (linked && linked.profileId === item.profileId) {
      await store.updateActionItem(item.linkedActionItemId, { status: "done", resolvedAt: new Date().toISOString() });
    }
  }
  // Remember the skills and achievement this activity proves.
  await rememberEvidence(item);
  res.json({ evidence: item });
});

evidenceRouter.get("/:profileId", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const items = await store.getEvidence(req.params.profileId);
  res.json({ evidence: items });
});

// Turn the vault into application material.
evidenceRouter.post("/:profileId/summarize", async (req, res) => {
  await assertOwnership(req, req.params.profileId);
  const items = await store.getEvidence(req.params.profileId);
  if (items.length === 0) return res.json({ activityLines: [], essayParagraph: "", source: "mock" });

  const list = items
    .map((e) => `- ${e.title}: ${e.whatYouDid}${e.whoBenefited ? ` (helped: ${e.whoBenefited})` : ""}${e.skills.length ? ` [skills: ${e.skills.join(", ")}]` : ""}`)
    .join("\n");

  const { data, source } = await generateJson<{ activityLines: string[]; essayParagraph: string }>({
    system: `${YAAR_PRINCIPLES}
Turn the student's real activities into US application material. Write (1) Common App-style activity descriptions, each <= 150 characters, action-verb led, concrete and honest; and (2) one short essay-ready paragraph that weaves the activities into a coherent story of who the student is. Do not invent anything not in the activities.
Return ONLY JSON: { "activityLines": string[], "essayParagraph": string }`,
    prompt: `Student activities:\n${list}\n\nWrite the activity lines and the paragraph now.`,
    mock: () => ({
      activityLines: items.slice(0, 10).map((e) => `${e.title}: ${e.whatYouDid}`.slice(0, 150)),
      essayParagraph:
        "Demo mode (add a Gemini key for a tailored paragraph). Your logged activities already tell a story of initiative and follow-through. Lead your essay with the most personal moment, then show the impact you created.",
    }),
  });
  // Defensive normalization in case the model returns partial JSON.
  res.json({
    activityLines: Array.isArray(data?.activityLines) ? data.activityLines : [],
    essayParagraph: typeof data?.essayParagraph === "string" ? data.essayParagraph : "",
    source,
  });
});
