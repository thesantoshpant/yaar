import http from "node:http";
import express from "express";
import "express-async-errors"; // makes async route errors flow to the error handler
import cors from "cors";
import { WebSocketServer } from "ws";
import { config, hasGemini, hasScorecard, hasGoogleAuth } from "./config";
import { connectDb, dbConnected } from "./db";
import { profileRouter } from "./routes/profile";
import { counselorRouter } from "./routes/counselor";
import { roadmapRouter } from "./routes/roadmap";
import { schoolsRouter } from "./routes/schools";
import { visaRouter } from "./routes/visa";
import { speakingRouter } from "./routes/speaking";
import { agentRouter } from "./routes/agent";
import { applicationsRouter } from "./routes/applications";
import { journeyRouter } from "./routes/journey";
import { engineRouter } from "./routes/engine";
import { riskRouter } from "./routes/risk";
import { authRouter } from "./routes/auth";
import { coachRouter } from "./routes/coach";
import { evidenceRouter } from "./routes/evidence";
import { memoryRouter } from "./routes/memory";
import { parentRouter } from "./routes/parent";
import { whatifRouter } from "./routes/whatif";
import { digestRouter } from "./routes/digest";
import { transcribeRouter } from "./routes/transcribe";
import { mockRouter, mockAudioRouter } from "./routes/mock";
import { progressRouter } from "./routes/progress";
import { evalsRouter } from "./routes/evals";
import { ttsRouter } from "./routes/tts";
import { feedbackRouter } from "./routes/feedback";
import { opsRouter } from "./routes/ops";
import { requireAdmin } from "./lib/adminAuth";
import { attachUser } from "./lib/userAuth";
import { startScheduler } from "./services/scheduler";
import { rateLimit, aiTier, heavyTier } from "./lib/rateLimit";
import { notFoundHandler, errorHandler, installProcessGuards } from "./lib/errors";
import { handleLiveConnection, type LiveParams } from "./services/geminiLive";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigins }));
// Body parsing. Most routes accept small JSON, but the upload routes (document
// photos, voice recordings) declare their own larger parsers with explicit size
// guards. The global 1mb parser must SKIP those paths: whichever json() runs
// first consumes the body, so parsing them here would 413 every real upload
// before the route's own limit ever applied.
const smallJson = express.json({ limit: "1mb" });
const BIG_UPLOAD_PATH = /^\/api\/(risk\/extract|transcribe)\/?$/;
app.use((req, res, next) => (BIG_UPLOAD_PATH.test(req.path) ? next() : smallJson(req, res, next)));
// Basic abuse protection. Layered: this global per-IP limit catches raw request
// floods; the aiTier/heavyTier stacks below strictly cap the endpoints that cost
// real money per call; and services/safety.ts holds the daily dollar cap as the
// final backstop. Yaar is free, so these limits are what keeps it free.
app.use("/api/", rateLimit({ windowMs: 60_000, max: 120 }));
// Attach the signed-in user (if any) to every API request for ownership checks.
app.use("/api", attachUser);

// Strict per-IP tiers for everything that triggers a model call.
const ai = aiTier();
const heavy = heavyTier();

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "yaar-backend",
    mode: {
      gemini: hasGemini ? "live" : "mock",
      collegeScorecard: hasScorecard ? "live" : "mock",
      db: dbConnected() ? "mongodb" : "in-memory",
      auth: hasGoogleAuth ? "google" : "off",
      autonomy: config.autonomyMode,
    },
  });
});

app.use("/api/profile", profileRouter);
app.use("/api/counselor", ai, counselorRouter);
app.use("/api/roadmap", ai, roadmapRouter);
app.use("/api/schools", ai, schoolsRouter);
app.use("/api/visa", ai, visaRouter);
app.use("/api/speaking", ai, speakingRouter);
app.use("/api/agent", ai, agentRouter);
app.use("/api/applications", ai, applicationsRouter);
app.use("/api/journey", journeyRouter);
// engine applies the AI tier internally on run-now only; its inbox/action
// endpoints are cheap reads the UI polls and must not consume AI budget.
app.use("/api/engine", engineRouter);
app.use("/api/risk", heavy, riskRouter);
app.use("/api/auth", authRouter);
app.use("/api/coach", ai, coachRouter);
app.use("/api/evidence", ai, evidenceRouter);
app.use("/api/memory", ai, memoryRouter);
app.use("/api/parent", ai, parentRouter);
app.use("/api/whatif", ai, whatifRouter);
app.use("/api/digest", ai, digestRouter);
app.use("/api/transcribe", heavy, transcribeRouter);
// The audio poll endpoint is a pure cache read the client polls while TTS
// generates; it must come BEFORE the AI-tier mock mount and skip that tier.
app.use("/api/mock", mockAudioRouter);
app.use("/api/mock", ai, mockRouter);
// progress builds an optional Gemini recap, so it carries the AI tier like every
// other model-calling route (not just the generic global limiter).
app.use("/api/progress", ai, progressRouter);
app.use("/api/eval", ai, evalsRouter);
app.use("/api/tts", heavy, ttsRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/ops", requireAdmin, opsRouter);

// Unmatched API routes -> clean 404; everything else -> centralized error handler.
app.use("/api", notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

// Gemini Live voice relay. Connect to ws://host/ws/live?mode=visa|speaking|counselor
//
// SAFETY: this endpoint is OFF by default. Live audio bills per minute of
// streaming, has no per-connection auth here, and bypasses the daily Vertex
// spend cap (which only intercepts the REST surface in services/gemini.ts).
// 50 idle sockets could drain the $300 credit overnight. Re-enable only
// after wiring (a) signed token auth in verifyClient, (b) per-profile single
// concurrent session, (c) checkSpendOk on connect + recordSpend on a 30s
// interval while streaming. Until then keep YAAR_ENABLE_LIVE_VOICE unset.
const enableLiveVoice = /^(1|true|yes)$/i.test(process.env.YAAR_ENABLE_LIVE_VOICE ?? "");
if (enableLiveVoice) {
  const wss = new WebSocketServer({ server, path: "/ws/live" });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const mode = (url.searchParams.get("mode") ?? "counselor") as LiveParams["mode"];
    const systemByMode: Record<LiveParams["mode"], string> = {
      visa: "You are a US consular officer conducting an F-1 visa interview. Ask one realistic question at a time.",
      speaking: "You are an IELTS/TOEFL speaking examiner. Ask a prompt, listen, then probe with follow-ups.",
      counselor: "You are Yaar, an honest study-abroad counselor. Be warm, concise, and practical.",
    };
    void handleLiveConnection(ws, { mode, systemInstruction: systemByMode[mode] });
  });
  console.log("[ws] /ws/live enabled (YAAR_ENABLE_LIVE_VOICE=1) — auth + per-minute spend gate NOT yet wired");
} else {
  console.log("[ws] /ws/live disabled (set YAAR_ENABLE_LIVE_VOICE=1 to enable; auth + spend gate required first)");
}

async function main() {
  installProcessGuards();
  await connectDb();
  // Hydrate the kill switch + today's spend counters from Mongo BEFORE any
  // cron job, request, or external action can run. Otherwise the first ~50ms
  // after boot would race the hydrate, briefly using default state.
  const { initSafety } = await import("./services/safety");
  await initSafety();
  startScheduler();
  server.listen(config.port, () => {
    console.log(`[yaar] backend listening on http://localhost:${config.port}`);
    console.log(
      `[yaar] gemini=${hasGemini ? "live" : "mock"} scorecard=${hasScorecard ? "live" : "mock"} db=${
        dbConnected() ? "mongodb" : "in-memory"
      }`
    );
  });
}

void main();
