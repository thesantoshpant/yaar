// yaar-evals runner. Reads every case under evals/cases/<suite>/<name>.json,
// calls the live backend at BASE (default http://localhost:4000), records
// pass/fail + per-case detail, and writes the latest results to
// frontend/public/evals.json (served by the public /evals page) plus an
// immutable archive at evals/results/<ISO>.json.
//
// Exits non-zero if any case fails so it can gate CI.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const CASES_DIR = join(REPO, "evals", "cases");
const ARCHIVE_DIR = join(REPO, "evals", "results");
const PUBLIC_RESULTS = join(REPO, "frontend", "public", "evals.json");
const BASE = process.env.BASE || "http://localhost:4000";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.name.endsWith(".json")) out.push(p);
  }
  return out;
}

async function callDiya(input) {
  const res = await fetch(`${BASE}/api/eval/diya`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Diya endpoint returned ${res.status}`);
  return await res.json();
}

async function callCounselor(input) {
  const res = await fetch(`${BASE}/api/counselor/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: input.messages }),
  });
  if (!res.ok) throw new Error(`Counselor endpoint returned ${res.status}`);
  const json = await res.json();
  // Normalize so the matcher works on a single "reply" string.
  return { reply: json.reply ?? "", source: json.source };
}

// Grader study: score the same essay N times against /api/mock/writing/score,
// then return mean band, test-retest SD, and absolute error vs published band.
async function callGrader(c) {
  const runs = Math.max(1, Number(c.runs ?? 3));
  const bands = [];
  for (let i = 0; i < runs; i++) {
    if (i > 0) {
      // Pace the test-retest runs so Vertex's RPM cap doesn't push some calls
      // into the mock fallback (which would silently corrupt the MAE result).
      await new Promise((r) => setTimeout(r, 1500));
    }
    const res = await fetch(`${BASE}/api/mock/writing/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam: c.exam,
        taskType: c.taskType,
        prompt: c.prompt,
        essay: c.essay,
      }),
    });
    if (!res.ok) throw new Error(`Writing score endpoint returned ${res.status}`);
    const json = await res.json();
    if (typeof json.scaled === "number") bands.push(json.scaled);
  }
  if (bands.length === 0) throw new Error("no successful runs");
  const mean = bands.reduce((s, b) => s + b, 0) / bands.length;
  const variance = bands.reduce((s, b) => s + (b - mean) ** 2, 0) / bands.length;
  const stdDev = Math.sqrt(variance);
  const absError = Math.abs(mean - c.published_band);
  return { bands, mean, stdDev, absError, published: c.published_band };
}

function lc(s) {
  return String(s ?? "").toLowerCase();
}

function matches(actual, expect, suite) {
  const failures = [];

  if (suite === "diya") {
    if ("approved" in expect && Boolean(actual.approved) !== Boolean(expect.approved)) {
      failures.push(`approved expected ${expect.approved}, got ${actual.approved}`);
    }
    if (Array.isArray(expect.weakest_includes)) {
      const aw = Array.isArray(actual.weakest) ? actual.weakest : [];
      for (const dim of expect.weakest_includes) {
        if (!aw.includes(dim)) failures.push(`weakest expected to include "${dim}", got [${aw.join(", ") || "<none>"}]`);
      }
    }
    return failures;
  }

  if (suite === "grader") {
    const maxErr = typeof expect.max_abs_error === "number" ? expect.max_abs_error : 1.0;
    if (actual.absError > maxErr) {
      failures.push(`abs error ${actual.absError.toFixed(2)} > max ${maxErr.toFixed(2)} (mean=${actual.mean.toFixed(2)}, published=${actual.published})`);
    }
    return failures;
  }

  if (suite === "counselor") {
    const reply = lc(actual.reply);
    if (Array.isArray(expect.must_include_any) && expect.must_include_any.length) {
      const ok = expect.must_include_any.some((s) => reply.includes(lc(s)));
      if (!ok) failures.push(`reply must include any of [${expect.must_include_any.join(", ")}]`);
    }
    if (Array.isArray(expect.must_not_include_any) && expect.must_not_include_any.length) {
      const bad = expect.must_not_include_any.find((s) => reply.includes(lc(s)));
      if (bad) failures.push(`reply must NOT include "${bad}"`);
    }
    if (typeof expect.min_len === "number" && reply.length < expect.min_len) {
      failures.push(`reply length ${reply.length} < min ${expect.min_len}`);
    }
    if (typeof expect.max_len === "number" && reply.length > expect.max_len) {
      failures.push(`reply length ${reply.length} > max ${expect.max_len}`);
    }
    return failures;
  }

  return [`unknown suite ${suite}`];
}

async function callSuite(c) {
  if (c.suite === "diya") return callDiya(c.input);
  if (c.suite === "counselor") return callCounselor(c.input);
  if (c.suite === "grader") return callGrader(c);
  throw new Error(`unknown suite: ${c.suite}`);
}

async function runOne(casePath) {
  const c = await readJson(casePath);
  const start = Date.now();
  // Retry once on transient fetch failures: tsx-watch reloads briefly drop
  // connections, and we don't want flakes to register as real regressions.
  let actual;
  try {
    actual = await callSuite(c);
  } catch (err) {
    const msg = String(err);
    if (/fetch failed|ECONN|ETIMEDOUT|socket hang up/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        actual = await callSuite(c);
      } catch (err2) {
        return { suite: c.suite, name: c.name, pass: false, ms: Date.now() - start, failures: [String(err2)], actual: null, expect: c.expect ?? {} };
      }
    } else {
      return { suite: c.suite, name: c.name, pass: false, ms: Date.now() - start, failures: [msg], actual: null, expect: c.expect ?? {} };
    }
  }
  const failures = matches(actual, c.expect ?? {}, c.suite);
  return {
    suite: c.suite,
    name: c.name,
    pass: failures.length === 0,
    ms: Date.now() - start,
    failures,
    actual,
    expect: c.expect ?? {},
  };
}

async function main() {
  if (!existsSync(CASES_DIR)) {
    console.error(`No cases dir at ${CASES_DIR}`);
    process.exit(2);
  }
  // Require LIVE AI. In mock mode the grader returns a constant band for every
  // essay (and Diya fails closed), so the suite would publish fabricated
  // "grader agreement" / pass rates. Refuse to run unless Gemini is live.
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (health?.mode?.gemini !== "live") {
    console.error("ABORT: backend is not in live AI mode (mode.gemini !== 'live'). Evals need a real Gemini/Vertex key; mock results are meaningless.");
    process.exit(2);
  }
  const files = (await walk(CASES_DIR)).sort();
  console.log(`Running ${files.length} cases against ${BASE}\n`);

  const cases = [];
  for (const f of files) {
    process.stdout.write(`  ${f.replace(REPO + "/", "").replace(REPO + "\\", "")} ... `);
    const r = await runOne(f);
    cases.push(r);
    process.stdout.write(r.pass ? "PASS\n" : `FAIL (${r.failures.join("; ")})\n`);
    // Be polite to Vertex's RPM cap; 600ms between cases keeps us under most
    // free / low-tier quotas without dragging the whole run out.
    await new Promise((r) => setTimeout(r, 600));
  }

  const bySuite = {};
  for (const c of cases) {
    const s = (bySuite[c.suite] ??= { total: 0, passed: 0 });
    s.total += 1;
    if (c.pass) s.passed += 1;
  }
  const total = cases.length;
  const passed = cases.filter((c) => c.pass).length;
  // Grader-suite aggregate: MAE, within-1-band, mean test-retest SD.
  const graderRuns = cases.filter((c) => c.suite === "grader" && c.actual);
  let graderSummary = null;
  if (graderRuns.length > 0) {
    const errs = graderRuns.map((r) => r.actual.absError);
    const sds = graderRuns.map((r) => r.actual.stdDev);
    const within1 = errs.filter((e) => e <= 1.0).length;
    graderSummary = {
      n: graderRuns.length,
      mae: errs.reduce((s, e) => s + e, 0) / errs.length,
      within1BandRate: within1 / errs.length,
      meanTestRetestSd: sds.reduce((s, x) => s + x, 0) / sds.length,
      perCase: graderRuns.map((r) => ({
        name: r.name,
        published: r.actual.published,
        mean: r.actual.mean,
        stdDev: r.actual.stdDev,
        absError: r.actual.absError,
        bands: r.actual.bands,
      })),
    };
  }

  const summary = {
    ranAt: new Date().toISOString(),
    base: BASE,
    total,
    passed,
    passRate: total === 0 ? 0 : passed / total,
    bySuite,
    grader: graderSummary,
    cases: cases.map((c) => ({
      suite: c.suite,
      name: c.name,
      pass: c.pass,
      ms: c.ms,
      failures: c.failures,
    })),
  };

  await mkdir(ARCHIVE_DIR, { recursive: true });
  await mkdir(dirname(PUBLIC_RESULTS), { recursive: true });
  const ts = summary.ranAt.replace(/[:.]/g, "-");
  await writeFile(join(ARCHIVE_DIR, `${ts}.json`), JSON.stringify(summary, null, 2));
  await writeFile(PUBLIC_RESULTS, JSON.stringify(summary, null, 2));

  console.log(`\n${passed} / ${total} passed (${Math.round(summary.passRate * 100)}%).`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error("Runner crashed:", e);
  process.exit(2);
});
