import "dotenv/config";

// Vertex AI vs AI Studio: when GEMINI_USE_VERTEX is on (and a GCP project is set),
// we route Gemini through Vertex AI so it draws on Google Cloud credit and unlocks
// the higher model tiers. Auth then uses Application Default Credentials
// (gcloud auth application-default login, or GOOGLE_APPLICATION_CREDENTIALS).
const useVertex =
  /^(1|true|yes)$/i.test(process.env.GEMINI_USE_VERTEX ?? process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "") &&
  (process.env.GOOGLE_CLOUD_PROJECT ?? "").length > 0;

export const config = {
  port: Number(process.env.PORT ?? 4000),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  useVertex,
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT ?? "",
  googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  // Default to the strong, fast multimodal model. The flagship report uses the pro tier.
  geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
  geminiProModel: process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-pro",
  geminiTtsModel: process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts",
  // gemini-2.0-flash-live-001 was deprecated 2026-02-18 and retires 2026-06-01.
  // Default now targets the supported native-audio Live model. Live is still
  // off by default (see YAAR_ENABLE_LIVE_VOICE in index.ts).
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio",
  collegeScorecardApiKey: process.env.COLLEGE_SCORECARD_API_KEY ?? "",
  mongodbUri: process.env.MONGODB_URI ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:5173",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  // How autonomously the company agents may act on the real world.
  // dry_run = log only (safe default), assist = outbound needs human approval, live = execute.
  autonomyMode: (process.env.YAAR_AUTONOMY_MODE ?? "dry_run") as "dry_run" | "assist" | "live",
  // Admin token guarding the /api/ops console. Required once autonomy is not dry_run.
  adminToken: process.env.ADMIN_TOKEN ?? "",
  // Safety caps for the agentic company.
  maxExternalActionsPerDay: Number(process.env.MAX_EXTERNAL_ACTIONS_PER_DAY ?? 100),
  maxAgentRunsPerDay: Number(process.env.MAX_AGENT_RUNS_PER_DAY ?? 300),
  // Email integration (Resend). Without these, email actions are simulated.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFrom: process.env.RESEND_FROM ?? "",
  notifyEmail: process.env.NOTIFY_EMAIL ?? "",
};

// Gemini is "live" if we have an AI Studio key, or Vertex is enabled with a project.
export const hasGemini = config.geminiApiKey.length > 0 || config.useVertex;
export const hasScorecard = config.collegeScorecardApiKey.length > 0;
export const hasMongo = config.mongodbUri.length > 0;
export const hasGoogleAuth = config.googleClientId.length > 0 && config.jwtSecret.length > 0;
export const hasEmail = config.resendApiKey.length > 0 && config.resendFrom.length > 0;
