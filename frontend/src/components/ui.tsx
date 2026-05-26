import type { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500" />
      {label ?? "Working..."}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const live = source === "gemini" || source === "scorecard";
  return (
    <span
      className={`badge gap-1.5 ${
        live
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/12 text-amber-600 dark:text-amber-400"
      }`}
      title={live ? "Generated live by AI / real data" : "Demo data (add API keys for live AI)"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
      {live ? `live: ${source}` : "demo mode"}
    </span>
  );
}

export function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct >= 75
      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
      : pct >= 50
        ? "bg-gradient-to-r from-gold-300 to-gold-500"
        : "bg-gradient-to-r from-rose-400 to-rose-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// A small page heading used at the top of every app page for consistency.
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
