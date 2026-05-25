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
};

export const hasGemini = config.geminiApiKey.length > 0;
export const hasScorecard = config.collegeScorecardApiKey.length > 0;
export const hasMongo = config.mongodbUri.length > 0;
export const hasStripe = config.stripeSecretKey.length > 0;
export const hasGoogleAuth = config.googleClientId.length > 0 && config.jwtSecret.length > 0;
