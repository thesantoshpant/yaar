import { useState, type ReactNode } from "react";

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

// A circular score gauge — calmer than a chart, used for visa readiness + test bands.
export function ScoreRing({ value, max = 100, size = 132, suffix }: { value: number; max?: number; size?: number; suffix?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 0.75 ? "#1FA37A" : pct >= 0.5 ? "#F4A300" : "#E11D48";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-display text-3xl font-extrabold text-ink">{Math.round(value)}</span>
        {suffix && <span className="mt-0.5 text-xs text-muted">{suffix}</span>}
      </div>
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

// Friendly, retryable error card. Used wherever an API call can fail so a student
// never hits a silent dead end on a flaky connection.
export function ErrorNote({ onRetry, children }: { onRetry?: () => void; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
      <p>{children ?? "That didn't go through. Check your internet and try again. Nothing you typed is lost."}</p>
      {onRetry && (
        <button className="btn-ghost mt-2 text-rose-700 dark:text-rose-200" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// One-click copy for AI output the student wants to send, paste, or keep.
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-ink ${className}`}
      aria-label={label}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
      {copied ? "Copied" : label}
    </button>
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
