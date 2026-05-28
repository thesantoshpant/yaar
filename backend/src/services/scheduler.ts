// Cron heartbeat. For the MVP this runs inside the API process; the design splits
// it into a dedicated worker later (see STATUS.md). Every job is safe to re-run.
import cron from "node-cron";
import { weeklyDropForAll, followUpSweep } from "./engagement";
import { companyStandup, weeklyOutreachDraft } from "./companyAgents";
import { runMemoryAgent } from "./memoryAgent";
import { weeklyDigestForAll } from "./digest";

const TZ = "Asia/Kathmandu";

export function startScheduler(): void {
  // Weekly personalized opportunity drop: Mondays 09:00 local.
  cron.schedule(
    "0 9 * * 1",
    () => {
      void weeklyDropForAll().then((r) => console.log(`[scheduler] weekly drop ran for ${r.students} students`));
    },
    { timezone: TZ }
  );

  // Weekly digest email: Mondays 09:10, just after the opportunity drop so it includes
  // this week's fresh moves. Uses lib/email (simulated until a provider key is set).
  cron.schedule(
    "10 9 * * 1",
    () => {
      void weeklyDigestForAll().then((r) => console.log(`[scheduler] weekly digest: ${r.students} students, ${r.sent} emailed`));
    },
    { timezone: TZ }
  );

  // Follow-up sweep ("did you do it?"): twice daily.
  cron.schedule(
    "0 10,18 * * *",
    () => {
      void followUpSweep().then((r) => console.log(`[scheduler] follow-up sweep checked ${r.checked}, sent ${r.sent}`));
    },
    { timezone: TZ }
  );

  // Daily company "standup": the agentic team runs once (analytics, CEO, marketing).
  // Honors the autonomy mode, so in dry_run it only logs proposed actions.
  cron.schedule(
    "0 8 * * *",
    () => {
      void companyStandup().then(() => console.log("[scheduler] company standup ran"));
    },
    { timezone: TZ }
  );

  // Weekly outreach drafting: Leo proposes personalized influencer DMs on Mondays
  // at 09:30 (just after the opportunity drop + digest). In dry_run / assist mode
  // these queue for human approval; in live mode they still pass through Diya.
  cron.schedule(
    "30 9 * * 1",
    () => {
      void weeklyOutreachDraft().then(() => console.log("[scheduler] weekly outreach draft ran"));
    },
    { timezone: TZ }
  );

  // Memory Agent: rebuild every student's synthesized mind nightly (03:30 local),
  // off-peak so it never competes with daytime traffic.
  cron.schedule(
    "30 3 * * *",
    () => {
      void runMemoryAgent().then((r) => console.log(`[scheduler] memory agent ${r.summary}`));
    },
    { timezone: TZ }
  );

  console.log("[scheduler] cron jobs registered (weekly drop, weekly digest, follow-up sweep, company standup, weekly outreach, memory agent)");
}
