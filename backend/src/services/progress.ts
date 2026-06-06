// Turns everything Yaar has stored about a student into a picture of how they're
// growing: per-skill score trends, last-vs-previous and month-over-month comparisons,
// the weak areas that keep recurring, a full activity timeline, and an honest AI recap.
// Read-only aggregation over the same store the rest of the app writes to.
import { store } from "../lib/store";
import { generateText } from "./gemini";

export interface TrendPoint {
  date: string; // ISO
  scaled: number;
  label: string;
}
export interface SkillTrend {
  key: string; // e.g. "IELTS reading"
  exam: string;
  skill: string;
  unit: "band" | "points"; // IELTS band 0-9 vs TOEFL 0-30
  max: number;
  points: TrendPoint[];
  latest: number;
  latestLabel: string;
  previous: number | null;
  delta: number | null; // latest - previous (in scale units)
  best: number;
  attempts: number;
}
export interface ProgressData {
  totals: { mocks: number; activities: number; evidence: number; factsKnown: number; activeDays: number; streak: number };
  monthly: { thisMonth: { activities: number; mocks: number }; lastMonth: { activities: number; mocks: number } };
  skills: SkillTrend[];
  weakAreas: { type: string; count: number }[];
  timeline: { ts: string; kind: string; module?: string; summary: string; status?: string }[];
  recap: string;
  hasData: boolean;
}

// Day buckets are computed in the app timezone, not UTC. Most students are in
// South Asia (UTC+5:45ish), where a 1am study session falls on "yesterday" in
// UTC and silently breaks streaks. en-CA gives YYYY-MM-DD directly.
const APP_TZ = process.env.APP_TIMEZONE ?? "Asia/Kathmandu";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayKey = (iso: string) => dayFmt.format(new Date(iso));
const monthKey = (iso: string) => dayKey(iso).slice(0, 7);

// Consecutive days with at least one activity, counting back from today. A one-day
// grace (start from yesterday if nothing yet today) keeps the streak from reading 0
// all morning before the student has done anything.
function computeStreak(dayset: Set<string>): number {
  const d = new Date();
  if (!dayset.has(dayFmt.format(d))) d.setTime(d.getTime() - 24 * 3600 * 1000);
  let streak = 0;
  while (dayset.has(dayFmt.format(d))) {
    streak++;
    d.setTime(d.getTime() - 24 * 3600 * 1000);
  }
  return streak;
}

function prettyDelta(unit: "band" | "points", delta: number): string {
  const v = unit === "band" ? delta.toFixed(1) : String(Math.round(delta));
  return delta > 0 ? `+${v}` : v;
}

function buildRecap(data: Omit<ProgressData, "recap">): string {
  const moved = data.skills.filter((s) => s.delta != null && s.delta !== 0);
  const up = moved.filter((s) => (s.delta ?? 0) > 0);
  const down = moved.filter((s) => (s.delta ?? 0) < 0);
  const parts: string[] = [];
  if (data.totals.streak >= 2) parts.push(`You're on a ${data.totals.streak}-day streak.`);
  if (up.length) parts.push(`You improved in ${up.map((s) => `${s.key} (${prettyDelta(s.unit, s.delta!)})`).join(", ")}.`);
  if (down.length) parts.push(`${down.map((s) => s.key).join(", ")} dipped a little since last time, which is normal.`);
  if (data.weakAreas.length) parts.push(`Worth focusing next on: ${data.weakAreas.slice(0, 3).map((w) => w.type.replace(/_/g, " ")).join(", ")}.`);
  if (!parts.length) parts.push("This is the start of your record. Take a mock or build something, and Yaar will start showing how you grow over time.");
  return parts.join(" ");
}

export async function buildProgress(profileId: string): Promise<ProgressData> {
  const [attemptsDesc, events, facts, evidence] = await Promise.all([
    store.listMockAttempts(profileId, 200),
    store.getEvents(profileId, { limit: 500 }),
    store.getFacts(profileId, 300),
    store.getEvidence(profileId),
  ]);

  // Chronological (oldest first) so trends read left-to-right.
  const attempts = [...attemptsDesc].reverse();

  // Group attempts into per-skill trends.
  const groups = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const key = `${a.exam} ${a.skill}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
  }
  const skills: SkillTrend[] = [...groups.entries()].map(([key, list]) => {
    const exam = list[0].exam;
    const unit: "band" | "points" = exam === "IELTS" ? "band" : "points";
    const max = exam === "IELTS" ? 9 : 30;
    const points = list.map((a) => ({ date: a.createdAt, scaled: a.scaled, label: a.scaledLabel }));
    const latest = points[points.length - 1];
    const previous = points.length >= 2 ? points[points.length - 2] : null;
    return {
      key,
      exam,
      skill: list[0].skill,
      unit,
      max,
      points,
      latest: latest.scaled,
      latestLabel: latest.label,
      previous: previous ? previous.scaled : null,
      delta: previous ? Math.round((latest.scaled - previous.scaled) * 10) / 10 : null,
      best: Math.max(...points.map((p) => p.scaled)),
      attempts: points.length,
    };
  });
  skills.sort((a, b) => b.attempts - a.attempts || a.key.localeCompare(b.key));

  // Recurring weak areas across all attempts.
  const weakCount = new Map<string, number>();
  for (const a of attempts) for (const w of a.weakTypes ?? []) weakCount.set(w, (weakCount.get(w) ?? 0) + 1);
  const weakAreas = [...weakCount.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  // Totals + streak.
  const eventDays = new Set(events.map((e) => dayKey(e.ts)));
  for (const a of attempts) eventDays.add(dayKey(a.createdAt));
  const totals = {
    mocks: attempts.length,
    activities: events.length,
    evidence: evidence.length,
    factsKnown: facts.length,
    activeDays: eventDays.size,
    streak: computeStreak(eventDays),
  };

  // Month over month.
  const thisM = monthKey(new Date().toISOString());
  const lastDate = new Date();
  lastDate.setUTCMonth(lastDate.getUTCMonth() - 1);
  const lastM = monthKey(lastDate.toISOString());
  const monthly = {
    thisMonth: { activities: events.filter((e) => monthKey(e.ts) === thisM).length, mocks: attempts.filter((a) => monthKey(a.createdAt) === thisM).length },
    lastMonth: { activities: events.filter((e) => monthKey(e.ts) === lastM).length, mocks: attempts.filter((a) => monthKey(a.createdAt) === lastM).length },
  };

  const timeline = events.slice(0, 60).map((e) => ({ ts: e.ts, kind: e.kind, module: e.module, summary: e.summary, status: e.status }));

  const partial: Omit<ProgressData, "recap"> = {
    totals,
    monthly,
    skills,
    weakAreas,
    timeline,
    hasData: attempts.length > 0 || events.length > 0,
  };

  // Honest, encouraging recap. Deterministic by default; upgraded by Gemini when available.
  let recap = buildRecap(partial);
  if (partial.hasData && skills.length) {
    try {
      const summary = skills
        .map((s) => `${s.key}: latest ${s.latestLabel}${s.delta != null ? ` (change ${prettyDelta(s.unit, s.delta)} vs previous)` : ""}, best ${s.best}, ${s.attempts} attempt(s)`)
        .join("; ");
      const { text } = await generateText({
        system:
          "You are Yaar, an honest, warm study-abroad counselor. In 2-3 sentences, summarize how this student is progressing using ONLY the data given. Be specific with the numbers, celebrate real improvement, be honest about dips without discouraging, and end with the single most useful thing to focus on next. No emojis, no hype, no invented facts.",
        prompt: `Streak: ${totals.streak} days. Mocks taken: ${totals.mocks}. This month vs last: ${monthly.thisMonth.activities} vs ${monthly.lastMonth.activities} activities. Skill trends: ${summary}. Recurring weak areas: ${weakAreas.slice(0, 4).map((w) => w.type).join(", ") || "none"}.`,
        temperature: 0.5,
        profileId,
      });
      if (text && !text.startsWith("[mock]")) recap = text.trim();
    } catch {
      // keep the deterministic recap
    }
  }

  return { ...partial, recap };
}
