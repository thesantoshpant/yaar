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

function matches(actual, expect) {
  const failures = [];
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

async function runOne(casePath) {
  const c = await readJson(casePath);
  const start = Date.now();
  try {
    let actual;
    if (c.suite === "diya") actual = await callDiya(c.input);
    else throw new Error(`unknown suite: ${c.suite}`);
    const failures = matches(actual, c.expect ?? {});
    return {
      suite: c.suite,
      name: c.name,
      pass: failures.length === 0,
      ms: Date.now() - start,
      failures,
      actual,
      expect: c.expect ?? {},
    };
  } catch (err) {
    return { suite: c.suite, name: c.name, pass: false, ms: Date.now() - start, failures: [String(err)], actual: null, expect: c.expect ?? {} };
  }
}

async function main() {
  if (!existsSync(CASES_DIR)) {
    console.error(`No cases dir at ${CASES_DIR}`);
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
  }

  const bySuite = {};
  for (const c of cases) {
    const s = (bySuite[c.suite] ??= { total: 0, passed: 0 });
    s.total += 1;
    if (c.pass) s.passed += 1;
  }
  const total = cases.length;
  const passed = cases.filter((c) => c.pass).length;
  const summary = {
    ranAt: new Date().toISOString(),
    base: BASE,
    total,
    passed,
    passRate: total === 0 ? 0 : passed / total,
    bySuite,
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
