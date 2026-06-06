// Mechanics test for the free public launch: rate-limit tiers, error handling,
// the delete-my-data flow, and the removed billing surface. Needs NO API keys.
//
// Run against a MOCK-MODE backend booted with tiny limits, e.g. (PowerShell):
//   $env:DOTENV_CONFIG_PATH="C:\nonexistent\.env"; $env:PORT="4100"
//   $env:RATE_AI_PER_MIN="4"; $env:RATE_HEAVY_PER_MIN="2"; $env:RATE_CREATE_PER_MIN="2"
//   npx tsx src/index.ts
// then:
//   BASE=http://localhost:4100 node scripts/test-mechanics.mjs
//
// The rate-limit assertions depend on exact call order; AI-tier consumption is
// memory.get(1) -> chat(2) -> chat-invalid(3) -> diya(4) -> chat(5 trips).
//
// Exits non-zero if any check fails.

const BASE = process.env.BASE || "http://localhost:4100";
const results = [];

async function call(method, path, body, raw) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json, headers: res.headers };
}

function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  console.log(`Mechanics testing ${BASE}\n`);

  // Sanity: never run this against a live-AI backend (it would spend real money
  // and the rate-limit assertions assume the tiny test limits).
  const health = await call("GET", "/api/health");
  if (health.json?.mode?.gemini !== "mock") {
    console.error("ABORT: backend is not in mock mode. Boot it without keys (see header comment).");
    process.exit(2);
  }
  check("health (mock mode)", health.status === 200 && health.json?.ok);

  // ---- Billing is gone ----
  const billing = await call("GET", "/api/billing/status/whatever");
  check("billing endpoints removed", billing.status === 404, `got ${billing.status}`);

  // ---- Error handling ----
  const unknown = await call("GET", "/api/definitely-not-a-route");
  check("unknown API route -> 404 JSON", unknown.status === 404 && typeof unknown.json?.error === "string");

  const badJson = await call("POST", "/api/counselor/chat", "{not json", true);
  check("malformed JSON -> 400", badJson.status === 400, `got ${badJson.status}`);

  const huge = await call("POST", "/api/counselor/chat", { messages: [{ role: "user", content: "x".repeat(2 * 1024 * 1024) }] });
  check("oversized body -> 413", huge.status === 413, `got ${huge.status}`);

  // ---- Create tier + delete-my-data (RATE_CREATE_PER_MIN=2) ----
  const a = await call("POST", "/api/profile", { name: "Mechanics A", country: "Nepal" });
  const pidA = a.json?.profile?.id;
  check("create profile A", a.status === 200 && pidA);

  const getA = await call("GET", `/api/profile/${pidA}`);
  check("get profile A", getA.status === 200 && getA.json?.profile?.name === "Mechanics A");

  const delA = await call("DELETE", `/api/profile/${pidA}`);
  check("delete-my-data", delA.status === 200 && delA.json?.ok === true);

  const getGone = await call("GET", `/api/profile/${pidA}`);
  check("deleted profile is gone", getGone.status === 404, `got ${getGone.status}`);

  const memGone = await call("GET", `/api/memory/${pidA}`);
  check("deleted memory is empty", memGone.status === 200 ? (memGone.json?.facts?.length ?? 0) === 0 : true);

  const b = await call("POST", "/api/profile", { name: "Mechanics B", country: "Nepal" });
  check("create profile B", b.status === 200 && b.json?.profile?.id);

  const c = await call("POST", "/api/profile", { name: "Mechanics C", country: "Nepal" });
  check("create tier trips at limit", c.status === 429 && c.headers.get("retry-after"), `got ${c.status}`);

  // ---- Heavy tier (RATE_HEAVY_PER_MIN=2): transcribe size guard, then risk, then 429 ----
  const tooBig = await call("POST", "/api/transcribe", { mimeType: "audio/webm", data: "A".repeat(14 * 1024 * 1024) });
  check("oversized recording -> 413", tooBig.status === 413, `got ${tooBig.status}`);

  const risk = await call("POST", "/api/risk/report", {
    documents: [{ kind: "i20", text: "I-20 cost $48,000 per year. Bank balance $9,000. Sponsor: father, farmer." }],
  });
  const r = risk.json?.report;
  const riskOk =
    risk.status === 200 &&
    r && typeof r.overall === "number" &&
    Array.isArray(r.dimensions) && r.dimensions.length > 0 &&
    Array.isArray(r.weakPoints) && r.weakPoints.length > 0 &&
    !("locked" in (r ?? {})) && !("paid" in (risk.json ?? {})) &&
    risk.json?.needsAccount === true;
  check("anonymous risk report is FULL + free", riskOk);

  const tts = await call("POST", "/api/tts", { text: "hello" });
  check("heavy tier trips at limit", tts.status === 429 && tts.headers.get("retry-after"), `got ${tts.status}`);

  // ---- AI tier (RATE_AI_PER_MIN=3) ----
  const chat1 = await call("POST", "/api/counselor/chat", { messages: [{ role: "user", content: "hi" }] });
  check("counselor mock reply", chat1.status === 200 && typeof chat1.json?.reply === "string" && chat1.json?.source === "mock");

  const chatBad = await call("POST", "/api/counselor/chat", { messages: [] });
  check("invalid body -> 400 zod", chatBad.status === 400);

  const diya = await call("POST", "/api/eval/diya", { type: "social_post", title: "t", payload: "Guaranteed visa approval! Sign up now!!!" });
  check("Diya fails CLOSED in mock mode", diya.status === 200 && diya.json?.approved === false && (diya.json?.weakest?.length ?? 0) > 0);

  const chat4 = await call("POST", "/api/counselor/chat", { messages: [{ role: "user", content: "hi again" }] });
  check("AI tier trips at limit", chat4.status === 429 && chat4.headers.get("retry-after"), `got ${chat4.status}`);

  // ---- Ops console reachable from localhost ----
  const safety = await call("GET", "/api/ops/safety");
  check("ops.safety on localhost", safety.status === 200 && "killSwitchEngaged" in (safety.json ?? {}));

  // ---- Done ----
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Mechanics test crashed:", e.message);
  process.exit(1);
});
