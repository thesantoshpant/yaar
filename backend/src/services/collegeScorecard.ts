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

export async function searchSchools(query: SchoolQuery): Promise<{ schools: School[]; source: "scorecard" | "mock" }> {
  if (!hasScorecard) {
    return { schools: filterMock(query), source: "mock" };
  }
  try {
    const params = new URLSearchParams();
    params.set("api_key", config.collegeScorecardApiKey);
    params.set("fields", FIELDS);
    params.set("per_page", String(query.perPage ?? 20));
    params.set("school.operating", "1");
    params.set("latest.student.size__range", "1..");
    if (query.search) params.set("school.name", query.search);
    if (query.state) params.set("school.state", query.state);
    if (query.maxNetPriceUsd) params.set("latest.cost.attendance.academic_year__range", `..${query.maxNetPriceUsd}`);

    const res = await fetch(`${BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`Scorecard ${res.status}`);
    const json = (await res.json()) as { results: ScorecardResult[] };
    const schools = (json.results ?? []).map(mapResult);
    return { schools, source: "scorecard" };
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
