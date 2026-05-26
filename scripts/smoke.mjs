// Yaar smoke test. Hits every key endpoint against a running backend, asserts a 200 +
// expected fields, and reports whether each AI feature came back live (gemini) or mock.
// Usage:  node scripts/smoke.mjs            (defaults to http://localhost:4000)
//         BASE=http://host:4000 node scripts/smoke.mjs
// Exits non-zero if any check fails, so it can gate a demo.

const BASE = process.env.BASE || "http://localhost:4000";
const results = [];

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

function check(name, ok, status, source) {
  results.push({ name, ok: !!ok, status, source: source || "-" });
}

function has(obj, keys) {
  return obj && keys.every((k) => k in obj);
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  const health = await call("GET", "/api/health");
  check("health", health.status === 200 && health.json?.ok, health.status, health.json?.mode?.gemini);

  // A sample student gives us a profileId with rich memory to exercise everything.
  const seed = await call("POST", "/api/profile/seed-persona", { persona: "rural_firstgen" });
  const pid = seed.json?.profile?.id;
  check("seed-persona", seed.status === 200 && pid, seed.status);
  if (!pid) return finish();

  const counselor = await call("POST", "/api/counselor/chat", { messages: [{ role: "user", content: "What should I do first?" }], profileId: pid });
  check("counselor.chat", counselor.status === 200 && has(counselor.json, ["reply"]), counselor.status, counselor.json?.source);

  const memory = await call("GET", `/api/memory/${pid}`);
  check("memory.get", memory.status === 200 && Array.isArray(memory.json?.facts) && memory.json.facts.length > 0, memory.status);

  const roadmap = await call("POST", "/api/roadmap", { country: "Nepal", intendedLevel: "undergraduate", intendedMajor: "Computer Science", profileId: pid });
  check("roadmap", roadmap.status === 200 && has(roadmap.json, ["roadmap"]), roadmap.status, roadmap.json?.source);

  const schools = await call("POST", "/api/schools/search", { intendedMajor: "Computer Science", maxNetPriceUsd: 30000, country: "Nepal" });
  check("schools (expect live)", schools.status === 200 && Array.isArray(schools.json?.schools), schools.status, schools.json?.source);

  const essay = await call("POST", "/api/applications/draft", { type: "common_app", major: "Computer Science", notes: "Taught coding in my village", profileId: pid });
  check("applications.draft", essay.status === 200 && has(essay.json, ["draft"]), essay.status, essay.json?.source);

  const fund = await call("POST", "/api/coach/funding", { profileId: pid, i20CostUsd: 60000, fundsUsd: 8000, sponsor: "father, farmer" });
  check("coach.funding", fund.status === 200 && has(fund.json, ["costExplanation"]), fund.status, fund.json?.source);

  const sp = await call("GET", "/api/speaking/prompt?exam=IELTS");
  check("speaking.prompt", sp.status === 200 && has(sp.json, ["prompt"]), sp.status);

  const visa = await call("POST", "/api/visa/next", { country: "Nepal", history: [], profileId: pid });
  check("visa.next", visa.status === 200 && has(visa.json, ["question"]), visa.status, visa.json?.source);

  const risk = await call("POST", "/api/risk/report", { profileId: pid, documents: [{ kind: "i20", text: "Knox College, CS, I-20 cost $68,494, scholarship $54,768" }] });
  check("risk.report", risk.status === 200 && has(risk.json, ["report"]), risk.status);

  const whatif = await call("POST", "/api/whatif", { profileId: pid, scenario: "What if I raise my budget to $30k a year?" });
  check("whatif", whatif.status === 200 && has(whatif.json, ["impact"]), whatif.status, whatif.json?.source);

  const parent = await call("POST", `/api/parent/${pid}/report`, {});
  const token = parent.json?.shareToken;
  check("parent.report", parent.status === 200 && has(parent.json?.report, ["whereTheyAre"]), parent.status, parent.json?.report?.source);
  if (token) {
    const shared = await call("GET", `/api/parent/shared/${token}`);
    check("parent.shared (public)", shared.status === 200 && has(shared.json?.report, ["whereTheyAre"]), shared.status);
  }

  const digest = await call("GET", `/api/digest/${pid}/preview`);
  check("digest.preview", digest.status === 200 && has(digest.json, ["subject", "body"]), digest.status, digest.json?.source);

  const drop = await call("POST", `/api/engine/run-now/${pid}`, {});
  check("engine.drop", drop.status === 200 && Array.isArray(drop.json?.inbox), drop.status, drop.json?.source);

  // Agentic company (ops is open on localhost).
  const org = await call("GET", "/api/ops/org");
  check("ops.org", org.status === 200 && Array.isArray(org.json?.employees), org.status);

  const board = await call("POST", "/api/ops/boardroom", { topic: "Smoke test: highest-leverage move this week" });
  check("ops.boardroom", board.status === 200 && Array.isArray(board.json?.transcript) && board.json.transcript.length >= 3, board.status, board.json?.source);

  finish();
}

function finish() {
  console.log("RESULT".padEnd(6), "CHECK".padEnd(26), "HTTP", "SOURCE");
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log((r.ok ? "PASS" : "FAIL").padEnd(6), r.name.padEnd(26), String(r.status).padEnd(4), r.source);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e.message);
  process.exit(1);
});
