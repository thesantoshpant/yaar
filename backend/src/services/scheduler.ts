// Cron heartbeat. For the MVP this runs inside the API process; the design splits
// it into a dedicated worker later (see STATUS.md). Every job is safe to re-run.
import cron from "node-cron";
import { weeklyDropForAll, followUpSweep } from "./engagement";

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

  // Follow-up sweep ("did you do it?"): twice daily.
  cron.schedule(
    "0 10,18 * * *",
    () => {
      void followUpSweep().then((r) => console.log(`[scheduler] follow-up sweep checked ${r.checked}, sent ${r.sent}`));
    },
    { timezone: TZ }
  );

  console.log("[scheduler] cron jobs registered (weekly drop, follow-up sweep)");
}
