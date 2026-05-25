import { Router } from "express";
import { z } from "zod";
import { hasGoogleAuth } from "../config";
import { verifyGoogleCredential, issueJwt, verifyJwt } from "../services/auth";
import { store } from "../lib/store";

export const authRouter = Router();

authRouter.get("/config", (_req, res) => {
  res.json({ googleAuthEnabled: hasGoogleAuth });
});

const googleSchema = z.object({ credential: z.string().min(1) });
authRouter.post("/google", async (req, res) => {
  if (!hasGoogleAuth) return res.status(503).json({ error: "Google auth not configured on the server." });
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const g = await verifyGoogleCredential(parsed.data.credential);
    const user = await store.upsertUserByGoogle({ googleSub: g.sub, email: g.email, name: g.name });
    const token = issueJwt(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error("[auth] google verify failed:", err);
    res.status(401).json({ error: "Could not verify Google sign-in." });
  }
});

authRouter.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  const user = await store.getUser(payload.uid);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});
