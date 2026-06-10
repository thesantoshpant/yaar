// Mock Card — a public, shareable, no-login card a student generates after a
// scored IELTS/TOEFL mock attempt. Like the Visa Pass: payload encoded in the
// URL hash (never sent to a server), zero storage cost. Designed for Instagram
// story / WhatsApp share at the moment a student wants to show off a strong score.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface CardData {
  name: string;
  exam: "IELTS" | "TOEFL" | string;
  skill: "reading" | "listening" | "writing" | "speaking" | string;
  scaled: number;
  scaledLabel: string; // e.g. "Band 7.5" or "26 / 30"
  percentile: number | null;
  cohortSize: number;
  highlight?: string; // a one-line takeaway from the feedback
  date: string;
}

function decodeHash(): CardData | null {
  try {
    const raw = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#data=/, "");
    if (!raw) return null;
    const b = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b)));
    const p = JSON.parse(json) as Record<string, unknown>;
    // Untrusted URL payload on an error-boundary-free public route: validate the
    // fields we render (skill/exam/scaledLabel/name) so a malformed-but-parseable
    // link shows the empty state instead of crashing on e.g. card.skill.charAt.
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.skill !== "string" ||
      typeof p.exam !== "string" ||
      typeof p.scaledLabel !== "string" ||
      typeof p.name !== "string"
    ) {
      return null;
    }
    return p as unknown as CardData;
  } catch {
    return null;
  }
}

export default function MockCard() {
  const loc = useLocation();
  const [card, setCard] = useState<CardData | null>(null);

  useEffect(() => {
    setCard(decodeHash());
  }, [loc.hash]);

  if (!card) {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-xl pt-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Mock Card</h1>
          <p className="mt-2 text-muted">
            This page expects a card payload in the URL. Take a free IELTS or TOEFL mock to generate one.
          </p>
          <Link to="/app/mock" className="btn-primary mt-6 inline-block">Try a free mock</Link>
        </div>
      </div>
    );
  }

  const skillLabel = card.skill.charAt(0).toUpperCase() + card.skill.slice(1);
  return (
    <div className="min-h-screen bg-bg p-4 text-ink sm:p-8">
      <div className="mx-auto max-w-md">
        <div className="relative overflow-hidden rounded-3xl bg-surface p-7 shadow-lift ring-2 ring-brand-600/30">
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_100%_0%,rgba(244,163,0,0.18),transparent_55%),radial-gradient(50%_45%_at_0%_100%,rgba(33,104,103,0.14),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/star.svg" alt="" className="h-6 w-6" />
                <span className="font-display text-base font-extrabold tracking-tight text-ink">Yaar</span>
              </div>
              <span className="text-xs font-medium text-faint">{new Date(card.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>

            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{card.exam} · {skillLabel} mock</div>
              <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-ink">{card.name}</h1>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-6xl font-extrabold text-ink">{card.scaledLabel}</span>
            </div>

            {card.percentile != null && (
              <div className="mt-4 inline-flex items-center gap-2">
                <span className="badge bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Top {Math.max(1, 100 - card.percentile)}% of recent {card.exam} {skillLabel}
                </span>
              </div>
            )}

            {card.highlight && (
              <p className="mt-6 rounded-xl bg-surface-2/60 px-4 py-3 text-sm leading-snug text-ink">
                {card.highlight}
              </p>
            )}

            <div className="mt-7 border-t border-line pt-4 text-center">
              <p className="text-xs text-muted">Take a free IELTS or TOEFL mock, scored on every skill.</p>
              <p className="font-display text-sm font-bold text-ink">yaar.app/mock</p>
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
          <Link to="/app/mock" className="btn-primary">Take yours →</Link>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-center text-xs text-faint">
          Percentile is computed across recent Yaar mock attempts only and reflects practice, not the real exam.
        </p>
      </div>
    </div>
  );
}
