// Spend-tracking key for the per-user daily cap in services/safety.ts.
// Use the student's profile when known; otherwise key on the caller's IP so
// anonymous traffic is capped per caller too instead of only by the global cap.
import type { Request } from "express";

export function spendActor(req: Request, profileId?: string): string {
  return profileId || `ip:${req.ip ?? "unknown"}`;
}
