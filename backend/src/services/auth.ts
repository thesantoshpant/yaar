// Google sign-in: verify the Google ID token, then issue our own JWT session.
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { config } from "../config";

const client = new OAuth2Client(config.googleClientId);

export async function verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string; name: string }> {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: config.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Invalid Google token");
  return { sub: payload.sub, email: payload.email, name: payload.name ?? payload.email };
}

export function issueJwt(user: { id: string; email: string }): string {
  return jwt.sign({ uid: user.id, email: user.email }, config.jwtSecret, { expiresIn: "30d" });
}

export function verifyJwt(token: string): { uid: string; email: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { uid: string; email: string };
  } catch {
    return null;
  }
}
