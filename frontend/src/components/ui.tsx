import type { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label ?? "Working..."}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const live = source === "gemini" || source === "scorecard";
  return (
    <span
      className={`badge ${live ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
      title={live ? "Generated live by AI / real data" : "Demo data (add API keys for live AI)"}
    >
      {live ? `live: ${source}` : "demo mode"}
    </span>
  );
}

export function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-gold-400" : "bg-rose-400";
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
