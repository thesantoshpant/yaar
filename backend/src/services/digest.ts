// Weekly email digest: a short, warm, personal note from Yaar grounded in the student's
// memory and this week's moves. Sends via lib/email.ts, which gracefully simulates when
// no provider key is set, so this works end to end today and turns into real email the
// moment a Resend key is added.
import { generateJson } from "./gemini";
import { buildContextPack } from "./contextPack";
import { store } from "../lib/store";
import { sendEmail } from "../lib/email";
import { YAAR_PRINCIPLES } from "../lib/prompts";

export interface Digest {
  subject: string;
  body: string;
  to: string | null; // resolved recipient (linked account email) or null -> simulated
  source: string;
}

export async function buildDigest(profileId: string): Promise<Digest | null> {
  const profile = await store.getProfile(profileId);
  if (!profile) return null;

  const [ctx, inbox, openActions] = await Promise.all([
    buildContextPack(profileId),
    store.getInbox(profileId, 8),
    store.getActionItems(profileId, "suggested"),
  ]);

  const name = profile.name && profile.name !== "Student" ? profile.name : "there";
  const moves =
    inbox
      .filter((i) => i.kind === "opportunity" || i.kind === "followup")
      .slice(0, 4)
      .map((i) => `- ${i.title}: ${i.body}`)
      .join("\n") ||
    openActions.slice(0, 4).map((a) => `- ${a.title}`).join("\n") ||
    "Keep moving on your current step.";

  const { data, source } = await generateJson<{ subject: string; body: string }>({
    system: `${YAAR_PRINCIPLES}
Write a short weekly email from Yaar to ONE student. Warm, specific, skimmable, like a friend who remembers them. Reference what you know about them and this week's moves, point to ONE clear next step, and end with one genuine line of encouragement. Plain text only (no markdown, no asterisks). 80-140 words.
Return ONLY JSON: { "subject": string (under 60 chars, specific to this student), "body": string (the plain-text email) }`,
    prompt: `What we know about the student:\n${ctx || name}\n\nThis week's moves for them:\n${moves}\n\nWrite the email now.`,
    mock: () => ({
      subject: `${name}, your moves for this week`,
      body: `Hi ${name},\n\nHere's what I'd focus on this week:\n${moves}\n\nStart with the first one and tell me how it goes. You're moving forward, and that's what matters most.\n\n- Yaar`,
    }),
  });

  let to: string | null = null;
  if (profile.userId) {
    const u = await store.getUser(profile.userId);
    to = u?.email ?? null;
  }

  return { subject: data.subject ?? `Your week with Yaar`, body: data.body ?? "", to, source };
}

export async function sendDigest(profileId: string): Promise<{ subject: string; result: string } | null> {
  const d = await buildDigest(profileId);
  if (!d) return null;
  const result = await sendEmail({ to: d.to ?? undefined, subject: d.subject, text: d.body });
  await store
    .addEvent({ profileId, kind: "note", summary: `Weekly digest ${result.startsWith("sent") ? "emailed" : "prepared (simulated, no email key)"}` })
    .catch(() => {});
  return { subject: d.subject, result };
}

export async function weeklyDigestForAll(): Promise<{ students: number; sent: number }> {
  const ids = await store.allProfileIds();
  let sent = 0;
  for (const id of ids) {
    try {
      const r = await sendDigest(id);
      if (r?.result.startsWith("sent")) sent++;
    } catch (err) {
      console.error("[digest] failed for", id, err);
    }
  }
  return { students: ids.length, sent };
}
