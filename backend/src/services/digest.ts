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
    profileId,
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
  // Always include a way out. Consent to receive is checked by the caller (the
  // cron only emails opted-in students; the manual send is student-initiated).
  const body = `${d.body}\n\n--\nYou get this weekly note because you turned it on in Yaar. To stop it, turn off "Weekly email" in your Yaar profile, or reply STOP.`;
  const result = await sendEmail({ to: d.to ?? undefined, subject: d.subject, text: body });
  await store
    .addEvent({ profileId, kind: "note", summary: `Weekly digest ${result.startsWith("sent") ? "emailed" : "prepared (simulated, no email key)"}` })
    .catch(() => {});
  return { subject: d.subject, result };
}

// Bounded like the weekly drop: each digest is a Gemini call (and possibly an
// email), so the cron fan-out is capped no matter how many profiles exist.
const MAX_DIGEST_FANOUT = Number(process.env.MAX_CRON_FANOUT ?? 300);

export async function weeklyDigestForAll(): Promise<{ students: number; sent: number }> {
  const allIds = await store.allProfileIds();
  const ids = allIds.slice(0, MAX_DIGEST_FANOUT);
  if (allIds.length > ids.length) {
    console.warn(`[digest] weekly digest capped at ${ids.length} of ${allIds.length} profiles (MAX_CRON_FANOUT)`);
  }
  let sent = 0;
  let skipped = 0;
  for (const id of ids) {
    try {
      // Consent gate: the scheduled digest only ever goes to students who
      // explicitly opted in. No opt-in, no email. Ever.
      const profile = await store.getProfile(id);
      if (!profile?.emailOptIn) {
        skipped++;
        continue;
      }
      const r = await sendDigest(id);
      if (r?.result.startsWith("sent")) sent++;
    } catch (err) {
      console.error("[digest] failed for", id, err);
    }
  }
  if (skipped) console.log(`[digest] skipped ${skipped} students without email opt-in`);
  return { students: ids.length - skipped, sent };
}
