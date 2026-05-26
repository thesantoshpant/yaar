// The "join Yaar" gate. Wrap a high-intent action in gate(key, onPass): if the
// student is signed in (or auth isn't configured, or they still have free uses left)
// it runs immediately; otherwise it opens a warm sign-in modal and runs the action
// once they join. This is the classic taste-then-join growth pattern.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../api/client";
import { getProfileId, getToken, setAuth } from "./progress";
import { GATES, gateUseCount, recordGateUse, type GateKey } from "./gates";

const authEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

interface GateCtx {
  signedIn: boolean;
  // Run `onPass` if allowed, otherwise open the join modal and run it after sign-in.
  gate: (key: GateKey, onPass: () => void) => void;
  // True if this gate would block right now (for showing a lock hint in the UI).
  isLocked: (key: GateKey) => boolean;
}

const Ctx = createContext<GateCtx | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean>(() => !!getToken());
  const [open, setOpen] = useState<GateKey | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const isLocked = useCallback(
    (k: GateKey) => authEnabled && !getToken() && gateUseCount(k) >= GATES[k].freeUses,
    []
  );

  const gate = useCallback((k: GateKey, onPass: () => void) => {
    // Auth not configured, or already signed in: just go.
    if (!authEnabled || getToken()) {
      recordGateUse(k);
      onPass();
      return;
    }
    // Guest still has free uses left.
    if (gateUseCount(k) < GATES[k].freeUses) {
      recordGateUse(k);
      onPass();
      return;
    }
    // Out of free uses: ask them to join, then resume their action.
    pending.current = onPass;
    setOpen(k);
  }, []);

  async function onCredential(credential?: string) {
    if (!credential) return;
    try {
      const r = await api.authGoogle(credential);
      setAuth(r.token, r.user);
      setSignedIn(true);
      const pid = getProfileId();
      if (pid) await api.getProfile(pid).catch(() => {}); // claim the guest profile
    } catch {
      return;
    }
    setOpen(null);
    const fn = pending.current;
    pending.current = null;
    if (fn) {
      recordGateUse(open as GateKey);
      fn();
    }
  }

  function close() {
    setOpen(null);
    pending.current = null;
  }

  const def = open ? GATES[open] : null;

  return (
    <Ctx.Provider value={{ signedIn, gate, isLocked }}>
      {children}
      {def && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={close} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_60%_at_100%_0%,rgba(99,102,241,0.14)_0,transparent_60%)]" />
            <div className="relative">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-lg font-extrabold text-slate-900 shadow-sm">Y</span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">{def.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{def.body}</p>
              <p className="mt-3 text-xs text-faint">Free, takes a few seconds. Yaar saves your progress, your plan, and your story so you never start over.</p>
              <div className="mt-5 flex flex-col items-center gap-3">
                <GoogleLogin onSuccess={(cr) => onCredential(cr.credential)} onError={() => {}} width="320" />
                <button className="text-sm text-muted hover:text-ink" onClick={close}>
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useAuthGate(): GateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthGate must be used inside AuthGateProvider");
  return ctx;
}
