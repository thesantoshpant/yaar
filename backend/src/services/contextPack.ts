// Assembles a compact "everything we remember about this student" block that is
// injected into Gemini prompts so every interaction feels personal and continuous.
import { store } from "../lib/store";
import { getOrCreateJourney } from "./journey";
import { personaPreamble } from "../lib/personaPreamble";

export async function buildContextPack(profileId: string): Promise<string> {
  const profile = await store.getProfile(profileId);
  if (!profile) return "";

  const [journey, facts, openActions, recentEvents] = await Promise.all([
    getOrCreateJourney(profileId),
    store.getFacts(profileId, 15),
    store.getActionItems(profileId, "suggested"),
    store.getEvents(profileId, { limit: 5 }),
  ]);

  const who = [
    `${profile.name}, ${profile.country}, ${profile.intendedLevel}`,
    profile.intendedMajor ? `major ${profile.intendedMajor}` : "",
    profile.targetIntake ? `target ${profile.targetIntake}` : "",
    profile.gradeLevel ? `grade ${profile.gradeLevel}` : "",
    profile.isRural ? "rural" : "",
    profile.firstGen ? "first-gen" : "",
  ]
    .filter(Boolean)
    .join(", ");

  const sections: string[] = [];
  sections.push(`## WHO\n${who}`);

  const preamble = personaPreamble(journey);
  if (preamble) sections.push(`## CONTEXT\n${preamble}`);

  if (facts.length) sections.push(`## KEY FACTS\n${facts.map((f) => `- ${f.value}`).join("\n")}`);

  if (openActions.length)
    sections.push(
      `## OPEN ITEMS WE SUGGESTED\n${openActions.slice(0, 6).map((a) => `- ${a.title} [${a.status}]`).join("\n")}`
    );

  if (recentEvents.length)
    sections.push(`## RECENTLY\n${recentEvents.map((e) => `- ${e.ts.slice(0, 10)} ${e.summary}`).join("\n")}`);

  return sections.join("\n\n");
}
