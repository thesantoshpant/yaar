// Visa Pass — a public, shareable, no-login card a student generates after a
// scored mock F-1 interview. The whole pass payload lives in the URL hash (not
// a backend record): privacy-friendly (hash is never sent to the server), zero
// storage cost, and any link can be revoked just by deleting it. Designed to
// be screenshot-worthy on a phone (instagram story sized).
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface PassData {
  name: string;
  consulate: string;
  overall: number; // 0..100
  verdict: "passed" | "needs work" | "not yet ready";
  top: { name: string; score: number }[]; // 2-3 highlight dimensions
  highlights: { officer: string; student: string }[]; // 1-2 exchanges
  date: string; // ISO date
}

function decodeHash(): PassData | null {
  try {
    const raw = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#data=/, "");
    if (!raw) return null;
    const b = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b)));
    return JSON.parse(json) as PassData;
  } catch {
    return null;
  }
}

const VERDICT_TONE: Record<PassData["verdict"], { ring: string; pill: string; emoji: string }> = {
  passed: { ring: "ring-emerald-500/40", pill: "bg-emerald-500 text-white", emoji: "✅" },
  "needs work": { ring: "ring-gold-500/40", pill: "bg-gold-500 text-gold-ink", emoji: "🛠️" },
  "not yet ready": { ring: "ring-rose-500/40", pill: "bg-rose-500 text-white", emoji: "⚠️" },
};

export default function VisaPass() {
  const loc = useLocation();
  const [pass, setPass] = useState<PassData | null>(null);

  useEffect(() => {
    setPass(decodeHash());
  }, [loc.hash]);

  if (!pass) {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-xl pt-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Visa Pass</h1>
          <p className="mt-2 text-muted">
            This page expects a pass payload in the URL. Run a free mock F-1 interview to generate one.
          </p>
          <Link to="/app/visa" className="btn-primary mt-6 inline-block">Try the visa simulator</Link>
        </div>
      </div>
    );
  }

  const tone = VERDICT_TONE[pass.verdict];
  return (
    <div className="min-h-screen bg-bg p-4 text-ink sm:p-8">
      <div className="mx-auto max-w-md">
        {/* The card. Sized like an Instagram story for natural screenshot framing. */}
        <div className={`relative overflow-hidden rounded-3xl bg-surface p-7 shadow-lift ring-2 ${tone.ring} ghost-border`}>
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_100%_0%,rgba(244,163,0,0.18),transparent_55%),radial-gradient(50%_45%_at_0%_100%,rgba(255,92,138,0.12),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/star.svg" alt="" className="h-6 w-6" />
                <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
              </div>
              <span className="text-xs font-medium text-faint">{new Date(pass.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">F-1 Mock Interview · {pass.consulate}</div>
              <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-ink">{pass.name}</h1>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-6xl font-extrabold text-ink">{pass.overall}</span>
              <span className="text-lg text-muted">/ 100 readiness</span>
            </div>

            <div className="mt-3 inline-flex items-center gap-2">
              <span className={`badge px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.pill}`}>
                <span aria-hidden="true">{tone.emoji}</span> {pass.verdict}
              </span>
            </div>

            {pass.top.length > 0 && (
              <div className="mt-6 space-y-2">
                {pass.top.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{d.name}</span>
                    <span className="font-semibold text-brand-600">{d.score}/100</span>
                  </div>
                ))}
              </div>
            )}

            {pass.highlights.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">A line from the drill</div>
                {pass.highlights.slice(0, 1).map((h, i) => (
                  <div key={i} className="space-y-1.5 rounded-xl border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Officer</p>
                    <p className="text-sm leading-snug text-ink">"{h.officer}"</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{pass.name}</p>
                    <p className="text-sm leading-snug text-ink">"{h.student}"</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-7 border-t border-line pt-4 text-center">
              <p className="text-xs text-muted">Practice your real F-1 interview, free.</p>
              <p className="font-display text-sm font-bold text-ink">yaar.app/visa</p>
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
          <Link to="/app/visa" className="btn-primary">Run yours →</Link>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-center text-xs text-faint">
          A practice score. Not a prediction. Real interviews depend on many things only the consular officer can weigh.
        </p>
      </div>
    </div>
  );
}
