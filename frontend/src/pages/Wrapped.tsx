// Yaar Wrapped — a monthly snapshot card a student generates from their Progress
// page. Same hash-encoded URL pattern as VisaPass and MockCard: no server state,
// screenshot-friendly, fully shareable on stories / WhatsApp.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface WrappedData {
  name: string;
  monthLabel: string; // "May 2026"
  streak: number;
  activities: number;
  mocks: number;
  factsKnown: number;
  topSkill?: { key: string; latest: string; delta: number | null; unit: "band" | "points" };
  focus?: string; // a single weak-area to drill next
  recap?: string; // a sentence from the AI recap (truncated)
  date: string;
}

function decodeHash(): WrappedData | null {
  try {
    const raw = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#data=/, "");
    if (!raw) return null;
    const b = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b)));
    return JSON.parse(json) as WrappedData;
  } catch {
    return null;
  }
}

function fmtDelta(unit: "band" | "points" | undefined, delta: number | null | undefined): string {
  if (delta == null || !unit) return "";
  const v = unit === "band" ? Math.abs(delta).toFixed(1) : String(Math.abs(Math.round(delta)));
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${v}`;
}

export default function Wrapped() {
  const loc = useLocation();
  const [w, setW] = useState<WrappedData | null>(null);

  useEffect(() => {
    setW(decodeHash());
  }, [loc.hash]);

  if (!w) {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-xl pt-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Yaar Wrapped</h1>
          <p className="mt-2 text-muted">
            This page expects a wrapped payload in the URL. Open your Progress page in Yaar and tap "Share my month."
          </p>
          <Link to="/app/progress" className="btn-primary mt-6 inline-block">Go to Progress</Link>
        </div>
      </div>
    );
  }

  const better = (w.topSkill?.delta ?? 0) > 0;
  return (
    <div className="min-h-screen bg-bg p-4 text-ink sm:p-8">
      <div className="mx-auto max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-surface p-7 shadow-lift ring-2 ring-coral-500/30 ghost-border">
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_100%_0%,rgba(255,92,138,0.20),transparent_55%),radial-gradient(50%_45%_at_0%_100%,rgba(244,163,0,0.18),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/star.svg" alt="" className="h-6 w-6" />
                <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar Wrapped</span>
              </div>
              <span className="text-xs font-medium text-faint">{w.monthLabel}</span>
            </div>

            <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight text-ink">{w.name}</h1>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat value={w.streak > 0 ? `${w.streak}🔥` : "0"} label="day streak" />
              <Stat value={w.activities} label="things you did" />
              <Stat value={w.mocks} label="mocks taken" />
              <Stat value={w.factsKnown} label="things Yaar knows" />
            </div>

            {w.topSkill && (
              <div className="mt-5 rounded-xl bg-surface-2/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Biggest move</p>
                <p className="mt-1 text-base font-semibold text-ink">{w.topSkill.key} → {w.topSkill.latest}</p>
                {w.topSkill.delta != null && (
                  <p className={`mt-0.5 text-sm font-semibold ${better ? "text-emerald-600" : "text-amber-600"}`}>
                    {better ? "▲" : "▼"} {fmtDelta(w.topSkill.unit, w.topSkill.delta)} vs last time
                  </p>
                )}
              </div>
            )}

            {w.focus && (
              <div className="mt-3 rounded-xl bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Focus next</p>
                <p className="mt-1 text-sm capitalize text-ink">{w.focus.replace(/_/g, " ")}</p>
              </div>
            )}

            {w.recap && (
              <p className="mt-5 text-sm italic leading-relaxed text-muted">"{w.recap}"</p>
            )}

            <div className="mt-7 border-t border-line pt-4 text-center">
              <p className="text-xs text-muted">Yaar is the free AI counselor that remembers you and grows with you.</p>
              <p className="font-display text-sm font-bold text-ink">yaar.app</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            className="btn-ghost"
            onClick={() => {
              if (navigator.clipboard) void navigator.clipboard.writeText(window.location.href);
            }}
          >
            Copy share link
          </button>
          <Link to="/app/progress" className="btn-primary">My progress →</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
