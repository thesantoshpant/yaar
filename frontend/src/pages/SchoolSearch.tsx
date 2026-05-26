import { useState } from "react";
import { api } from "../api/client";
import type { School } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge, PageHeading } from "../components/ui";

const CAT_STYLE: Record<string, string> = {
  reach: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  match: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  safety: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <div className="font-bold text-ink">{value}</div>
      <div className="text-faint">{label}</div>
    </div>
  );
}

function SchoolCard({ s }: { s: School }) {
  return (
    <div className="group rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{s.name}</h3>
          <p className="text-sm text-muted">{[s.city, s.state].filter(Boolean).join(", ")}</p>
        </div>
        {s.category && <span className={`badge capitalize ${CAT_STYLE[s.category]}`}>{s.category}</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat value={s.admitRate != null ? `${Math.round(s.admitRate * 100)}%` : "n/a"} label="admit" />
        <Stat value={s.netPriceUsd != null ? `$${Math.round(s.netPriceUsd / 1000)}k` : "n/a"} label="cost/yr" />
        <Stat value={s.medianEarningsUsd != null ? `$${Math.round(s.medianEarningsUsd / 1000)}k` : "n/a"} label="earnings" />
      </div>
      {s.url && (
        <a className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline" href={`https://${s.url}`} target="_blank" rel="noreferrer">
          Visit site →
        </a>
      )}
    </div>
  );
}

export default function SchoolSearch() {
  const [filters, setFilters] = useState({ search: "", state: "", maxNetPriceUsd: "", intendedMajor: "" });
  const [schools, setSchools] = useState<School[]>([]);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await api.searchSchools({
        search: filters.search || undefined,
        state: filters.state || undefined,
        maxNetPriceUsd: filters.maxNetPriceUsd ? Number(filters.maxNetPriceUsd) : undefined,
        intendedMajor: filters.intendedMajor || undefined,
      });
      setSchools(res.schools);
      setNote(res.advisorNote);
      setSource(res.source);
      setSearched(true);
      markCompleted("school_search");
    } finally {
      setLoading(false);
    }
  }

  const groups: ["reach", "match", "safety"] = ["reach", "match", "safety"];

  return (
    <div className="space-y-6">
      <PageHeading
        title="School search 🎓"
        subtitle="A balanced reach / match / safety list from real cost and outcome data. No school pays to rank here — ever."
      />

      <div className="card">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search by name</label>
            <input className="input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="e.g. State University" />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })} placeholder="e.g. TX" />
          </div>
          <div>
            <label className="label">Max cost/yr (USD)</label>
            <input className="input" value={filters.maxNetPriceUsd} onChange={(e) => setFilters({ ...filters, maxNetPriceUsd: e.target.value })} placeholder="e.g. 30000" />
          </div>
        </div>
        <button className="btn-primary mt-5" onClick={run} disabled={loading}>
          {loading ? <Spinner label="Searching..." /> : "Find my schools"}
        </button>
      </div>

      {searched && (
        <>
          <div className="card border-brand-500/15 bg-brand-500/5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold text-ink">Counselor note</h2>
              <SourceBadge source={source} />
            </div>
            <p className="text-sm text-ink/90">{note}</p>
            <p className="mt-2 text-xs text-muted">
              Heads up: cost figures are sticker / general net price and may not reflect aid for international students,
              which varies a lot by school. Treat these as a starting point, and prioritize schools known to fund
              international students well. A true international-aid layer is coming.
            </p>
          </div>

          {groups.map((g) => {
            const list = schools.filter((s) => s.category === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <h2 className="mb-3 text-lg font-semibold capitalize text-ink">
                  {g} <span className="text-sm font-normal text-faint">({list.length})</span>
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
