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

  // Mock tests (reading) for both exams: generate (adaptive) + score (objective) + history.
  for (const exam of ["IELTS", "TOEFL"]) {
    const gen = await call("POST", "/api/mock/reading/generate", { exam, profileId: pid });
    const t = gen.json;
    const genOk = gen.status === 200 && t?.testId && Array.isArray(t.questions) && t.questions.length > 0;
    check(`mock.generate ${exam}`, genOk, gen.status, "gemini");
    if (genOk) {
      const responses = {};
      for (const q of t.questions) responses[q.id] = q.options ? q.options[0] : "x";
      const sc = await call("POST", "/api/mock/reading/score", { testId: t.testId, responses, profileId: pid });
      check(`mock.score ${exam}`, sc.status === 200 && has(sc.json, ["scaledLabel", "questions"]), sc.status);
    }
  }
  // Guest scoring (no profileId) must NOT 500.
  const gg = await call("POST", "/api/mock/reading/generate", { exam: "TOEFL" });
  if (gg.json?.testId) {
    const gr = {};
    for (const q of gg.json.questions) gr[q.id] = q.options ? q.options[0] : "x";
    const gsc = await call("POST", "/api/mock/reading/score", { testId: gg.json.testId, responses: gr });
    check("mock.score guest (no profile)", gsc.status === 200, gsc.status);
  }
  // Writing, Listening, Speaking sections (one exam each to keep the run reasonable).
  const wg = await call("POST", "/api/mock/writing/generate", { exam: "IELTS", profileId: pid });
  check("mock.writing.generate", wg.status === 200 && has(wg.json, ["prompt", "taskType"]), wg.status, "gemini");
  if (wg.json?.prompt) {
    const ws = await call("POST", "/api/mock/writing/score", { exam: "IELTS", taskType: wg.json.taskType, prompt: wg.json.prompt, essay: "University should be free because it widens access and benefits the economy. Talented students who cannot pay are lost to society. It must be funded fairly and standards kept high. Overall I agree, with safeguards.", profileId: pid });
    check("mock.writing.score", ws.status === 200 && has(ws.json, ["scaledLabel", "criteria"]), ws.status, "gemini");
  }
  const lg = await call("POST", "/api/mock/listening/generate", { exam: "TOEFL", profileId: pid });
  check("mock.listening.generate", lg.status === 200 && has(lg.json, ["transcript", "questions"]), lg.status, "gemini");
  if (lg.json?.testId) {
    const lr = {};
    for (const q of lg.json.questions) lr[q.id] = q.options ? q.options[0] : "x";
    const ls = await call("POST", "/api/mock/listening/score", { testId: lg.json.testId, responses: lr, profileId: pid });
    check("mock.listening.score", ls.status === 200 && has(ls.json, ["scaledLabel"]), ls.status);
  }
  const sg = await call("POST", "/api/mock/speaking/generate", { exam: "IELTS", profileId: pid });
  check("mock.speaking.generate", sg.status === 200 && has(sg.json, ["prompt", "taskType"]), sg.status, "gemini");
  if (sg.json?.prompt) {
    const ss = await call("POST", "/api/mock/speaking/score", { exam: "IELTS", taskType: sg.json.taskType, prompt: sg.json.prompt, transcript: "I would like to learn the guitar because music relaxes me. I would learn from free online tutorials and practise every evening, and it would help me share something creative with friends.", profileId: pid });
    check("mock.speaking.score", ss.status === 200 && has(ss.json, ["scaledLabel", "criteria"]), ss.status, "gemini");
  }

  const mh = await call("GET", `/api/mock/history/${pid}`);
  check("mock.history", mh.status === 200 && Array.isArray(mh.json?.attempts), mh.status);

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
