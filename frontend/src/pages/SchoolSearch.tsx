import { useState } from "react";
import { api } from "../api/client";
import type { School } from "../lib/types";
import { markCompleted, getProfileId } from "../lib/progress";
import { useProfile } from "../lib/profile";
import { Spinner, SourceBadge, PageHeading, ErrorNote } from "../components/ui";
import { SkeletonList } from "../components/Skeleton";
import Markdown from "../components/Markdown";

const CAT_STYLE: Record<string, string> = {
  reach: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  match: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  safety: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
};

const BUDGET_OPTIONS = [
  { value: "", label: "No limit" },
  { value: "12000", label: "Under $15k/yr" },
  { value: "22000", label: "$15k–30k/yr" },
  { value: "40000", label: "Over $30k/yr" },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2.5">
      <div className="text-sm font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[0.7rem] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}

function SchoolCard({ s }: { s: School }) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{s.name}</h3>
          <p className="text-sm text-muted">{[s.city, s.state].filter(Boolean).join(", ") || "United States"}</p>
        </div>
        {s.category && <span className={`badge shrink-0 capitalize ${CAT_STYLE[s.category]}`}>{s.category}</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={s.admitRate != null ? `${Math.round(s.admitRate * 100)}%` : "n/a"} label="admit" />
        <Stat value={s.netPriceUsd != null ? `$${Math.round(s.netPriceUsd / 1000)}k` : "n/a"} label="cost/yr" />
        <Stat value={s.medianEarningsUsd != null ? `$${Math.round(s.medianEarningsUsd / 1000)}k` : "n/a"} label="earnings" />
      </div>
      {s.fitReason && <p className="mt-3 text-sm text-muted">{s.fitReason}</p>}
      {s.url && (
        <a
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:underline"
          href={`https://${s.url}`}
          target="_blank"
          rel="noreferrer"
        >
          Visit site →
        </a>
      )}
    </div>
  );
}

export default function SchoolSearch() {
  const { profile, setField, saveNow } = useProfile();
  // Page-specific filters stay local; major / budget / level live in the shared profile.
  const [local, setLocal] = useState({ search: "", state: "" });
  const [schools, setSchools] = useState<School[]>([]);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);

  async function run() {
    setLoading(true);
    setError(false);
    try {
      const pid = await saveNow(); // keep the shared profile fresh before searching
      const res = await api.searchSchools({
        search: local.search || undefined,
        state: local.state || undefined,
        maxNetPriceUsd: profile.budget ? Number(profile.budget) : undefined,
        intendedMajor: profile.intendedMajor || undefined,
        profileId: pid || undefined,
      });
      setSchools(res.schools);
      setNote(res.advisorNote);
      setSource(res.source);
      setSearched(true);
      markCompleted("school_search");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function clearAndSearch() {
    setLocal({ search: "", state: "" });
    setField({ budget: "" });
    setLoading(true);
    setError(false);
    api
      .searchSchools({ intendedMajor: profile.intendedMajor || undefined, profileId: getProfileId() || undefined })
      .then((res) => {
        setSchools(res.schools);
        setNote(res.advisorNote);
        setSource(res.source);
        setSearched(true);
        markCompleted("school_search");
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const groups: ["reach", "match", "safety"] = ["reach", "match", "safety"];

  return (
    <div className="space-y-6">
      <PageHeading
        title="School search 🎓"
        subtitle="A balanced reach / match / safety list from real cost and outcome data. No school pays to rank here. Ever."
      />

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Intended major</label>
            <input
              className="input"
              value={profile.intendedMajor}
              onChange={(e) => setField({ intendedMajor: e.target.value })}
              placeholder="e.g. Computer Science"
            />
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
            <label className="label">Max cost/yr</label>
            <select className="input" value={profile.budget} onChange={(e) => setField({ budget: e.target.value })}>
              {BUDGET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Search by name</label>
            <input
              className="input"
              value={local.search}
              onChange={(e) => setLocal({ ...local, search: e.target.value })}
              placeholder="e.g. State University"
            />
          </div>
          <div>
            <label className="label">State</label>
            <input
              className="input"
              value={local.state}
              onChange={(e) => setLocal({ ...local, state: e.target.value })}
              placeholder="e.g. TX"
            />
          </div>
        </div>
        {error && (
          <div className="mt-4">
            <ErrorNote onRetry={run} />
          </div>
        )}
        <button className="btn-primary mt-5" onClick={run} disabled={loading}>
          {loading ? <Spinner label="Searching..." /> : "Find my schools"}
        </button>
      </div>

      {loading && schools.length === 0 && <SkeletonList count={4} lines={2} />}

      {searched && (
        <>
          <div className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.10)_0,transparent_60%)]" />
            <div className="relative">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-ink">Counselor note</h2>
                <SourceBadge source={source} />
              </div>
              <Markdown className="text-sm text-ink/90">{note}</Markdown>
              <p className="mt-2 text-xs text-muted">
                Heads up: cost figures are sticker / general net price and may not reflect aid for international students,
                which varies a lot by school. Treat these as a starting point, and prioritize schools known to fund
                international students well. A true international-aid layer is coming.
              </p>
            </div>
          </div>

          {schools.length === 0 && (
            <div className="card text-center">
              <p className="text-ink">No schools matched. Try raising your budget or removing the state filter.</p>
              <button className="btn-primary mt-4" onClick={clearAndSearch} disabled={loading}>
                Clear filters &amp; search again
              </button>
            </div>
          )}

          {groups.map((g) => {
            const list = schools.filter((s) => s.category === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold capitalize text-ink">
                  <span className={`badge capitalize ${CAT_STYLE[g]}`}>{g}</span>
                  <span className="text-sm font-normal text-faint">{list.length} schools</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((s) => (
                    <SchoolCard key={s.name} s={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
