// Where Yaar lets a student taste value for free, then asks them to join. Each gate
// allows a few free uses, then requires sign-in to continue. Tune freeUses + copy here.

export type GateKey = "counselor" | "visaInterview" | "evidence" | "roadmap" | "essay" | "speaking";

export interface GateDef {
  freeUses: number; // how many times a guest may do this before we ask them to join
  title: string;
  body: string;
}

export const GATES: Record<GateKey, GateDef> = {
  counselor: {
    freeUses: 3,
    title: "Let's keep this going",
    body: "You and Yaar are just getting started. Sign in to keep chatting, and so Yaar remembers everything about you next time instead of starting over.",
  },
  visaInterview: {
    freeUses: 0,
    title: "Step into the interview room",
    body: "You've seen your risk report. Sign in to practice with the AI officer until you walk in calm, and to save how you did.",
  },
  evidence: {
    freeUses: 0,
    title: "Your story is worth keeping",
    body: "Sign in to save what you've done. Yaar turns it into your application material later, so nothing you achieve gets lost.",
  },
  roadmap: {
    freeUses: 1,
    title: "Save your plan and make it yours",
    body: "You've got your first roadmap. Sign in to refine it, rebuild it anytime, and have Yaar track your progress through it.",
  },
  essay: {
    freeUses: 1,
    title: "Keep drafting with Yaar",
    body: "Sign in to draft more essays and save your work, so you can come back and refine them whenever you want.",
  },
  speaking: {
    freeUses: 1,
    title: "Keep practicing",
    body: "Sign in to keep practicing your speaking, track your band over time, and let Yaar coach the exact areas you need.",
  },
};

const key = (k: GateKey) => `yaar.gate.${k}`;

export function gateUseCount(k: GateKey): number {
  return Number(localStorage.getItem(key(k)) ?? "0") || 0;
}

export function recordGateUse(k: GateKey): void {
  try {
    localStorage.setItem(key(k), String(gateUseCount(k) + 1));
  } catch {
    // ignore
  }
}
