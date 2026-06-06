// Lightweight, dependency-free fixed-window rate limiting. Per-IP; in-memory
// (fine for a single instance). Swap for a Redis-backed limiter when we move to
// multiple instances.
//
// Yaar is free, and the AI endpoints cost real money per call, so the limits are
// deliberately strict and layered: a burst limit (per minute) stops hammering, an
// hourly limit stops sustained scripting, and a daily limit bounds the worst case
// per IP. The daily Vertex spend cap in services/safety.ts stays the final
// backstop, but these tiers keep one abuser from eating the whole day's budget
// and locking everyone else out.
import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

// Every limiter instance gets its own bucket map (two limiters must never share
// counts). One sweeper cleans all of them so the maps can't grow unbounded.
const allBuckets: Map<string, Bucket>[] = [];
setInterval(() => {
  const now = Date.now();
  for (const buckets of allBuckets) {
    for (const [key, b] of buckets) if (now > b.resetAt) buckets.delete(key);
  }
}, 5 * 60_000).unref();

export interface RateLimitOpts {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function rateLimit(opts: RateLimitOpts = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 120; // 120 requests/minute/IP by default
  const message = opts.message ?? "Too many requests. Please slow down.";
  const buckets = new Map<string, Bucket>();
  allBuckets.push(buckets);

  return (req: Request, res: Response, next: NextFunction) => {
    // req.ip respects Express's trust-proxy setting, so behind one proxy hop it
    // is the real client IP. Never read x-forwarded-for directly: a direct
    // client can spoof that header and mint itself unlimited fresh buckets.
    const ip = req.ip || "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

const envNum = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

type Middleware = ReturnType<typeof rateLimit>;

function layered(prefix: string, perMin: number, perHour: number, perDay: number, what: string): Middleware[] {
  const msg = (when: string) => `You've hit the ${when} limit for ${what}. Yaar is free for everyone, so limits keep it fair. ${when === "daily" ? "Come back tomorrow." : "Take a short break and try again."}`;
  return [
    rateLimit({ windowMs: 60_000, max: envNum(`${prefix}_PER_MIN`, perMin), message: msg("per-minute") }),
    rateLimit({ windowMs: 3_600_000, max: envNum(`${prefix}_PER_HOUR`, perHour), message: msg("hourly") }),
    rateLimit({ windowMs: 86_400_000, max: envNum(`${prefix}_PER_DAY`, perDay), message: msg("daily") }),
  ];
}

// AI tier: every endpoint that triggers a Gemini call (chat, plans, scoring,
// mock generation). Strict but roomy enough for a real study session (and for
// the smoke suite, which makes ~26 AI calls back to back).
export function aiTier(): Middleware[] {
  return layered("RATE_AI", 30, 150, 500, "AI features");
}

// Heavy tier: the most expensive surfaces (multimodal document reading, speech
// synthesis, audio transcription). Tighter on every window.
export function heavyTier(): Middleware[] {
  return layered("RATE_HEAVY", 8, 50, 150, "document and voice features");
}

// Creation tier: endpoints that create durable per-student state (profiles,
// sample students). Stops scripted signups from bloating the database and the
// nightly cron fan-out.
export function createTier(): Middleware[] {
  return [
    rateLimit({ windowMs: 60_000, max: envNum("RATE_CREATE_PER_MIN", 5), message: "You're creating profiles too fast. Give it a minute." }),
    rateLimit({ windowMs: 86_400_000, max: envNum("RATE_CREATE_PER_DAY", 30), message: "That's enough new profiles for today. Come back tomorrow." }),
  ];
}
