// Per-user auth + ownership. Enforcement is ACTIVE only when Google auth is
// configured (GOOGLE_CLIENT_ID + JWT_SECRET). In that mode, profile-scoped data is
// locked to its owner. With auth unconfigured (local dev), it stays open so the
// app is usable without keys. Set the keys in any real deployment.
import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../services/auth";
import { hasGoogleAuth } from "../config";
import { store } from "./store";
import { HttpError } from "./errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Non-blocking: attaches req.userId if a valid token is present.
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    const payload = verifyJwt(token);
    if (payload) req.userId = payload.uid;
  }
  next();
}

// Blocking, but only when auth is configured.
export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!hasGoogleAuth) return next();
  if (!req.userId) return next(new HttpError(401, "Sign in required."));
  next();
}

// Ensure the requester owns this profile. No-op when auth is unconfigured.
// If the profile has no owner yet and the requester is signed in, claim it.
export async function assertOwnership(req: Request, profileId: string | undefined): Promise<void> {
  if (!hasGoogleAuth || !profileId) return;
  const profile = await store.getProfile(profileId);
  if (!profile) throw new HttpError(404, "Profile not found");
  if (profile.userId && profile.userId !== req.userId) throw new HttpError(403, "You do not have access to this profile.");
  if (!profile.userId && req.userId) await store.updateProfile(profileId, { userId: req.userId });
}
