import type { ParentReport } from "../api/client";

// Shared renderer for a parent report, used by both the student-facing page and the
// public no-login share view. Warm, calm, easy to read on a phone.
export default function ParentReportView({ report }: { report: ParentReport }) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">Where {report.childName} is now</h3>
        <p className="mt-1.5 leading-relaxed text-ink">{report.whereTheyAre}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card border-emerald-500/20 bg-emerald-500/5">
          <h3 className="font-semibold text-emerald-600 dark:text-emerald-400">Doing well</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{report.doingWell}</p>
        </div>
        <div className="card border-amber-500/20 bg-amber-500/5">
          <h3 className="font-semibold text-amber-600 dark:text-amber-400">What still needs work</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/90">{report.watchFor}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-ink">The money, honestly</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{report.theMoney}</p>
      </div>

      {report.howYouCanHelp.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-ink">How you can help</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {report.howYouCanHelp.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.nextMilestones.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-ink">What's next</h3>
          <ol className="mt-2 space-y-1.5 text-sm text-muted">
            {report.nextMilestones.map((m, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-500">{i + 1}</span>
                {m}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
