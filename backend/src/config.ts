import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL ?? "gemini-2.0-flash-live-001",
  collegeScorecardApiKey: process.env.COLLEGE_SCORECARD_API_KEY ?? "",
  mongodbUri: process.env.MONGODB_URI ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:5173",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePriceUsd: Number(process.env.STRIPE_PRICE_USD ?? 19),
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

export const hasGemini = config.geminiApiKey.length > 0;
export const hasScorecard = config.collegeScorecardApiKey.length > 0;
export const hasMongo = config.mongodbUri.length > 0;
export const hasStripe = config.stripeSecretKey.length > 0;
export const hasGoogleAuth = config.googleClientId.length > 0 && config.jwtSecret.length > 0;
export const hasEmail = config.resendApiKey.length > 0 && config.resendFrom.length > 0;
