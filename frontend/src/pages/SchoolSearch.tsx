import { useState } from "react";
import { api } from "../api/client";
import type { School } from "../lib/types";
import { markCompleted } from "../lib/progress";
import { Spinner, SourceBadge } from "../components/ui";

const CAT_STYLE: Record<string, string> = {
  reach: "bg-rose-100 text-rose-700",
  match: "bg-amber-100 text-amber-700",
  safety: "bg-emerald-100 text-emerald-700",
};

function SchoolCard({ s }: { s: School }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{s.name}</h3>
          <p className="text-sm text-slate-500">
            {[s.city, s.state].filter(Boolean).join(", ")}
          </p>
        </div>
        {s.category && <span className={`badge ${CAT_STYLE[s.category]}`}>{s.category}</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="font-bold text-slate-800">{s.admitRate != null ? `${Math.round(s.admitRate * 100)}%` : "n/a"}</div>
          <div className="text-slate-500">admit</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="font-bold text-slate-800">{s.netPriceUsd != null ? `$${Math.round(s.netPriceUsd / 1000)}k` : "n/a"}</div>
          <div className="text-slate-500">cost/yr</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="font-bold text-slate-800">{s.medianEarningsUsd != null ? `$${Math.round(s.medianEarningsUsd / 1000)}k` : "n/a"}</div>
          <div className="text-slate-500">earnings</div>
        </div>
      </div>
      {s.url && (
        <a className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline" href={`https://${s.url}`} target="_blank" rel="noreferrer">
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School search</h1>
        <p className="mt-1 text-slate-600">
          A balanced list built from public cost and outcome data. No school pays us to rank it.
        </p>
      </div>

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
          <div className="card bg-brand-50">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold text-brand-900">Counselor note</h2>
              <SourceBadge source={source} />
            </div>
            <p className="text-sm text-brand-900">{note}</p>
            <p className="mt-2 text-xs text-brand-700">
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
                <h2 className="mb-3 text-lg font-semibold capitalize text-slate-800">
                  {g} <span className="text-sm font-normal text-slate-400">({list.length})</span>
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
