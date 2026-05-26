// Tracks which journey modules the student has completed, plus a short profile
// summary, in localStorage. This feeds the autonomous counselor brain so it can
// decide the next best action.
import type { ModuleKey } from "./types";

const DONE_KEY = "yaar.completed";
const PROFILE_KEY = "yaar.profileSummary";
const PROFILE_ID_KEY = "yaar.profileId";

export function getProfileId(): string | null {
  return localStorage.getItem(PROFILE_ID_KEY);
}

export function setProfileId(id: string): void {
  localStorage.setItem(PROFILE_ID_KEY, id);
}

// Reset to a clean slate so a new student (or a demo of a different persona) starts fresh.
export function clearStudent(): void {
  localStorage.removeItem(PROFILE_ID_KEY);
  localStorage.removeItem(DONE_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

const TOKEN_KEY = "yaar.token";
const USER_KEY = "yaar.user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAuth(token: string, user: { name: string; email: string }): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getUser(): { name: string; email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    return null;
  }
}
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCompleted(): ModuleKey[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]") as ModuleKey[];
  } catch {
    return [];
  }
}

export function markCompleted(module: ModuleKey): void {
  const set = new Set(getCompleted());
  set.add(module);
  localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
  // Also record completion server-side (source of truth, consistent across devices).
  const pid = getProfileId();
  if (pid) {
    const base = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
    const token = getToken();
    void fetch(`${base}/api/journey/${pid}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ module }),
    }).catch(() => {});
  }
}

export function getProfileSummary(): string {
  return localStorage.getItem(PROFILE_KEY) ?? "";
}

export function setProfileSummary(summary: string): void {
  localStorage.setItem(PROFILE_KEY, summary);
}
