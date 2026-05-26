// US Dept of Education College Scorecard integration with a curated mock fallback.
// Free key: https://api.data.gov/signup/
import { config, hasScorecard } from "../config";
import type { School } from "../lib/types";

const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";

const FIELDS = [
  "school.name",
  "school.city",
  "school.state",
  "school.school_url",
  "latest.admissions.admission_rate.overall",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.earnings.10_yrs_after_entry.median",
  "latest.student.size",
].join(",");

export interface SchoolQuery {
  search?: string; // name fragment
  maxNetPriceUsd?: number;
  minAdmitRate?: number;
  state?: string;
  perPage?: number;
}

interface ScorecardResult {
  "school.name": string;
  "school.city"?: string;
  "school.state"?: string;
  "school.school_url"?: string;
  "latest.admissions.admission_rate.overall"?: number | null;
  "latest.cost.attendance.academic_year"?: number | null;
  "latest.cost.tuition.in_state"?: number | null;
  "latest.cost.tuition.out_of_state"?: number | null;
  "latest.earnings.10_yrs_after_entry.median"?: number | null;
  "latest.student.size"?: number | null;
}

function mapResult(r: ScorecardResult): School {
  return {
    name: r["school.name"],
    city: r["school.city"] ?? undefined,
    state: r["school.state"] ?? undefined,
    url: r["school.school_url"] ?? undefined,
    admitRate: r["latest.admissions.admission_rate.overall"] ?? undefined,
    netPriceUsd: r["latest.cost.attendance.academic_year"] ?? undefined,
    inStateTuitionUsd: r["latest.cost.tuition.in_state"] ?? undefined,
    outOfStateTuitionUsd: r["latest.cost.tuition.out_of_state"] ?? undefined,
    medianEarningsUsd: r["latest.earnings.10_yrs_after_entry.median"] ?? undefined,
    size: r["latest.student.size"] ?? undefined,
  };
}

// One Scorecard page of real, operating, bachelor's-predominant schools, ranked by
// strong 10-year earnings (on-brand: we rank on outcomes, never on who pays us).
async function fetchScorecard(extra: Record<string, string>, perPage: number): Promise<School[]> {
  const params = new URLSearchParams();
  params.set("api_key", config.collegeScorecardApiKey);
  params.set("fields", FIELDS);
  params.set("per_page", String(perPage));
  params.set("school.operating", "1");
  params.set("latest.student.size__range", "1..");
  params.set("school.degrees_awarded.predominant", "3"); // real 4-year colleges, not community/trade
  params.set("sort", "latest.earnings.10_yrs_after_entry.median:desc");
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Scorecard ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const json = (await res.json()) as { results: ScorecardResult[] };
  return (json.results ?? []).map(mapResult);
}

const withinBudget = (list: School[], max?: number): School[] =>
  max == null ? list : list.filter((s) => s.netPriceUsd != null && s.netPriceUsd <= max);

export async function searchSchools(query: SchoolQuery): Promise<{ schools: School[]; source: "scorecard" | "mock" }> {
  if (!hasScorecard) {
    return { schools: filterMock(query), source: "mock" };
  }
  try {
    const extra: Record<string, string> = {};
    if (query.search) extra["school.name"] = query.search;
    if (query.state) extra["school.state"] = query.state;

    // Caller pinned a selectivity floor: honor it as a single ranked query.
    if (query.minAdmitRate != null) {
      const list = await fetchScorecard({ ...extra, "latest.admissions.admission_rate.overall__range": `${query.minAdmitRate}..1` }, 60);
      return { schools: withinBudget(list, query.maxNetPriceUsd).slice(0, 24), source: "scorecard" };
    }

    // Otherwise build a genuinely balanced list: the best-outcome schools the student
    // can actually afford in EACH selectivity tier (reach / match / safety).
    const tiers: { range: string; take: number }[] = [
      { range: "0..0.4", take: 6 },
      { range: "0.4..0.7", take: 9 },
      { range: "0.7..1", take: 9 },
    ];
    const buckets = await Promise.all(
      tiers.map((t) =>
        fetchScorecard({ ...extra, "latest.admissions.admission_rate.overall__range": t.range }, 40)
          .then((list) => withinBudget(list, query.maxNetPriceUsd).slice(0, t.take))
          .catch(() => [] as School[])
      )
    );
    const schools = buckets.flat();
    if (schools.length > 0) return { schools, source: "scorecard" };

    // Budget too tight for any tier: show the most affordable real options honestly,
    // cheapest first, so the student still sees a path instead of an empty page.
    const all = (await fetchScorecard(extra, 100))
      .filter((s) => s.netPriceUsd != null)
      .sort((a, b) => (a.netPriceUsd ?? 0) - (b.netPriceUsd ?? 0))
      .slice(0, 12);
    return { schools: all, source: "scorecard" };
  } catch (err) {
    console.error("[scorecard] failed, using mock:", err);
    return { schools: filterMock(query), source: "mock" };
  }
}

// A small curated set so the search works offline and during demos.
const MOCK_SCHOOLS: School[] = [
  { name: "University of Texas at Arlington", city: "Arlington", state: "TX", admitRate: 0.85, netPriceUsd: 22000, outOfStateTuitionUsd: 28000, medianEarningsUsd: 58000, size: 40000, url: "uta.edu" },
  { name: "Arizona State University", city: "Tempe", state: "AZ", admitRate: 0.9, netPriceUsd: 29000, outOfStateTuitionUsd: 31000, medianEarningsUsd: 60000, size: 75000, url: "asu.edu" },
  { name: "University of Cincinnati", city: "Cincinnati", state: "OH", admitRate: 0.84, netPriceUsd: 27000, outOfStateTuitionUsd: 27000, medianEarningsUsd: 57000, size: 38000, url: "uc.edu" },
  { name: "Wichita State University", city: "Wichita", state: "KS", admitRate: 0.95, netPriceUsd: 18000, outOfStateTuitionUsd: 16000, medianEarningsUsd: 52000, size: 16000, url: "wichita.edu" },
  { name: "University of Illinois Chicago", city: "Chicago", state: "IL", admitRate: 0.79, netPriceUsd: 26000, outOfStateTuitionUsd: 28000, medianEarningsUsd: 61000, size: 34000, url: "uic.edu" },
  { name: "Texas Tech University", city: "Lubbock", state: "TX", admitRate: 0.69, netPriceUsd: 23000, outOfStateTuitionUsd: 25000, medianEarningsUsd: 59000, size: 40000, url: "ttu.edu" },
  { name: "University at Buffalo (SUNY)", city: "Buffalo", state: "NY", admitRate: 0.68, netPriceUsd: 25000, outOfStateTuitionUsd: 28000, medianEarningsUsd: 60000, size: 32000, url: "buffalo.edu" },
  { name: "University of South Florida", city: "Tampa", state: "FL", admitRate: 0.44, netPriceUsd: 21000, outOfStateTuitionUsd: 17000, medianEarningsUsd: 58000, size: 50000, url: "usf.edu" },
  { name: "Northeastern University", city: "Boston", state: "MA", admitRate: 0.18, netPriceUsd: 50000, outOfStateTuitionUsd: 60000, medianEarningsUsd: 84000, size: 28000, url: "northeastern.edu" },
  { name: "Purdue University", city: "West Lafayette", state: "IN", admitRate: 0.53, netPriceUsd: 28000, outOfStateTuitionUsd: 28000, medianEarningsUsd: 70000, size: 50000, url: "purdue.edu" },
  { name: "Stony Brook University (SUNY)", city: "Stony Brook", state: "NY", admitRate: 0.49, netPriceUsd: 27000, outOfStateTuitionUsd: 28000, medianEarningsUsd: 65000, size: 26000, url: "stonybrook.edu" },
  { name: "University of Washington", city: "Seattle", state: "WA", admitRate: 0.48, netPriceUsd: 38000, outOfStateTuitionUsd: 40000, medianEarningsUsd: 75000, size: 48000, url: "washington.edu" },
];

function filterMock(query: SchoolQuery): School[] {
  let list = [...MOCK_SCHOOLS];
  if (query.search) {
    const q = query.search.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (query.state) {
    list = list.filter((s) => s.state === query.state);
  }
  if (query.maxNetPriceUsd) {
    list = list.filter((s) => (s.netPriceUsd ?? Infinity) <= query.maxNetPriceUsd!);
  }
  if (query.minAdmitRate) {
    list = list.filter((s) => (s.admitRate ?? 0) >= query.minAdmitRate!);
  }
  return list;
}
