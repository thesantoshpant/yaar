import http from "node:http";
import express from "express";
import "express-async-errors"; // makes async route errors flow to the error handler
import cors from "cors";
import { WebSocketServer } from "ws";
import { config, hasGemini, hasScorecard, hasStripe, hasGoogleAuth } from "./config";
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
import { billingRouter } from "./routes/billing";
import { authRouter } from "./routes/auth";
import { coachRouter } from "./routes/coach";
import { evidenceRouter } from "./routes/evidence";
import { opsRouter } from "./routes/ops";
import { requireAdmin } from "./lib/adminAuth";
import { attachUser } from "./lib/userAuth";
import { startScheduler } from "./services/scheduler";
import { rateLimit } from "./lib/rateLimit";
import { notFoundHandler, errorHandler, installProcessGuards } from "./lib/errors";
import { handleLiveConnection, type LiveParams } from "./services/geminiLive";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: "1mb" }));
// Basic abuse protection. AI endpoints are the costly ones, so cap a bit tighter.
app.use("/api/", rateLimit({ windowMs: 60_000, max: 120 }));
// Attach the signed-in user (if any) to every API request for ownership checks.
app.use("/api", attachUser);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "yaar-backend",
    mode: {
      gemini: hasGemini ? "live" : "mock",
      collegeScorecard: hasScorecard ? "live" : "mock",
      db: dbConnected() ? "mongodb" : "in-memory",
      billing: hasStripe ? "stripe" : "off",
      auth: hasGoogleAuth ? "google" : "off",
      autonomy: config.autonomyMode,
    },
  });
});

app.use("/api/profile", profileRouter);
app.use("/api/counselor", counselorRouter);
app.use("/api/roadmap", roadmapRouter);
app.use("/api/schools", schoolsRouter);
app.use("/api/visa", visaRouter);
app.use("/api/speaking", speakingRouter);
app.use("/api/agent", agentRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/journey", journeyRouter);
app.use("/api/engine", engineRouter);
app.use("/api/risk", riskRouter);
app.use("/api/billing", billingRouter);
app.use("/api/auth", authRouter);
app.use("/api/coach", coachRouter);
app.use("/api/evidence", evidenceRouter);
app.use("/api/ops", requireAdmin, opsRouter);

// Unmatched API routes -> clean 404; everything else -> centralized error handler.
app.use("/api", notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

// Gemini Live voice relay. Connect to ws://host/ws/live?mode=visa|speaking|counselor
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

async function main() {
  installProcessGuards();
  await connectDb();
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
