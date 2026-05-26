import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Roadmap as RoadmapType } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { useAuthGate } from "../lib/authGate";
import { Spinner, SourceBadge, PageHeading, ErrorNote, CopyButton } from "../components/ui";
import Markdown from "../components/Markdown";

const STORAGE_KEY = "yaar.roadmap";

const BUDGET_OPTIONS = [
  { value: "", label: "Not sure" },
  { value: "12000", label: "Under $15k/yr" },
  { value: "22000", label: "$15k–30k/yr" },
  { value: "40000", label: "Over $30k/yr" },
];
const TEST_OPTIONS = ["Haven't started", "Studying now", "Already took it"];

function budgetLabel(v: string): string {
  return BUDGET_OPTIONS.find((o) => o.value === v)?.label ?? "Not sure";
}

export default function Roadmap() {
  const { profile, setField, saveNow } = useProfile();
  const { gate } = useAuthGate();
  const [roadmap, setRoadmap] = useState<RoadmapType | null>(null);
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Restore a previously built roadmap (form fields now live in the shared profile).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { roadmap?: RoadmapType; source?: string };
        if (saved.roadmap) setRoadmap(saved.roadmap);
        if (saved.source) setSource(saved.source);
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  async function build() {
    setLoading(true);
    setError(false);
    try {
      await saveNow(); // persist the latest profile before the run
      const res = await api.roadmap({
        country: profile.country,
        intendedLevel: profile.intendedLevel,
        intendedMajor: profile.intendedMajor || undefined,
        budgetUsdPerYear: profile.budget ? Number(profile.budget) : undefined,
        targetIntake: profile.targetIntake || undefined,
        testStatus: profile.testStatus || undefined,
        profileId: getProfileId() || undefined,
      });
      setRoadmap(res.roadmap);
      setSource(res.source);
      markCompleted("roadmap");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ roadmap: res.roadmap, source: res.source }));
      } catch {
        // ignore quota errors
      }
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Plain-text version of the roadmap for the copy button.
  const roadmapText = roadmap
    ? [
        roadmap.summary,
        `Realistic outcome: ${roadmap.realisticOutcome}`,
        roadmap.estimatedTotalCostUsd ? `Estimated cost: ${roadmap.estimatedTotalCostUsd}` : "",
        "",
        ...roadmap.steps.map(
          (s, i) =>
            `${i + 1}. ${s.phase} (${s.timeframe})\n` +
            s.actions.map((a) => `   - ${a}`).join("\n") +
            `\n   Why: ${s.why}`,
        ),
        roadmap.redFlags.length ? "\nWatch out for:\n" + roadmap.redFlags.map((r) => `- ${r}`).join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const summaryChips = [
    profile.intendedLevel === "graduate" ? "Graduate" : "Undergraduate",
    profile.intendedMajor || "Major undecided",
    profile.country,
    budgetLabel(profile.budget),
    profile.targetIntake,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Your roadmap 🗺️"
        subtitle="A real plan made for you. The honest steps, in the right order, with no pressure."
      />

      <div className="card">
        {/* Yaar already knows these — show as a collapsed panel the student can adjust. */}
        <div className="flex flex-wrap items-center gap-2">
          {summaryChips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost mt-3 inline-flex items-center gap-1.5 text-sm"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${showDetails ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Details Yaar will use (tap to adjust)
        </button>

        {showDetails && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <div>
              <label className="label">Country</label>
              <input className="input" value={profile.country} onChange={(e) => setField({ country: e.target.value })} />
            </div>
            <div>
              <label className="label">Level</label>
              <select
                className="input"
                value={profile.intendedLevel}
                onChange={(e) => setField({ intendedLevel: e.target.value as "undergraduate" | "graduate" })}
              >
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
              </select>
            </div>
            <div>
              <label className="label">Intended major</label>
              <input
                className="input"
                value={profile.intendedMajor}
                onChange={(e) => setField({ intendedMajor: e.target.value })}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div>
              <label className="label">Budget per year</label>
              <select className="input" value={profile.budget} onChange={(e) => setField({ budget: e.target.value })}>
                {BUDGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Target intake</label>
              <input
                className="input"
                value={profile.targetIntake}
                onChange={(e) => setField({ targetIntake: e.target.value })}
                placeholder="e.g. Fall 2027"
              />
            </div>
            <div>
              <label className="label">Test status</label>
              <select
                className="input"
                value={profile.testStatus}
                onChange={(e) => setField({ testStatus: e.target.value })}
              >
                <option value="">Haven't started</option>
                {TEST_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorNote onRetry={build} />
          </div>
        )}
        <button className="btn-primary mt-5" onClick={() => gate("roadmap", () => build())} disabled={loading}>
          {loading ? <Spinner label="Building..." /> : roadmap ? "Rebuild my roadmap" : "Build my roadmap"}
        </button>
      </div>

      {roadmap && (
        <div className="space-y-4" ref={resultRef}>
          <div className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.10)_0,transparent_60%)]" />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">Summary</h2>
                <div className="flex items-center gap-2">
                  <SourceBadge source={source} />
                  <CopyButton text={roadmapText} label="Copy plan" />
                </div>
              </div>
              <Markdown className="text-ink/90">{roadmap.summary}</Markdown>
              <div className="mt-3 rounded-xl border border-brand-500/20 bg-surface/60 p-3 text-sm text-ink">
                <strong className="text-brand-500">Realistic outcome:</strong> {roadmap.realisticOutcome}
              </div>
              {roadmap.estimatedTotalCostUsd && (
                <p className="mt-2 text-sm text-muted">
                  <strong className="text-ink">Estimated cost:</strong> {roadmap.estimatedTotalCostUsd}
                </p>
              )}
            </div>
          </div>

          <ol className="relative space-y-3 before:absolute before:left-[1.15rem] before:top-3 before:bottom-3 before:w-px before:bg-line sm:before:left-[1.4rem]">
            {roadmap.steps.map((s, i) => (
              <li key={i} className="card relative transition-shadow hover:shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-3 text-base font-bold text-ink">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-glow">
                      {i + 1}
                    </span>
                    {s.phase}
                  </h3>
                  <span className="badge bg-surface-2 text-muted">{s.timeframe}</span>
                </div>
                <ul className="mt-3 list-inside list-disc space-y-1 pl-11 text-sm text-ink/90">
                  {s.actions.map((a, j) => (
                    <li key={j}><Markdown inline>{a}</Markdown></li>
                  ))}
                </ul>
                <div className="mt-2 pl-11 text-sm italic text-muted">
                  <Markdown>{`Why: ${s.why}`}</Markdown>
                </div>
              </li>
            ))}
          </ol>

          {roadmap.redFlags.length > 0 && (
            <div className="card border-rose-500/20 bg-rose-500/5">
              <h3 className="font-semibold text-rose-600 dark:text-rose-400">Watch out for</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-rose-600 dark:text-rose-300">
                {roadmap.redFlags.map((r, i) => (
                  <li key={i}><Markdown inline>{r}</Markdown></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
