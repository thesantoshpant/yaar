// One-glance phone pulse page. Reads /api/ops/pulse (admin-token-gated; the
// token lives in localStorage like Company.tsx). The whole point is "is Yaar
// OK?" answered in two seconds from a hotel wifi: four traffic-light tiles
// (Autonomy, Kill switch, Spend, Pending approvals) plus the kill button.
// Auto-refreshes every 20 seconds.
import { useCallback, useEffect, useState } from "react";
import { ops, OpsError } from "../api/client";

interface Pulse {
  ok: boolean;
  autonomyMode: string;
  killSwitchEngaged: boolean;
  reason: string;
  spend: { today: number; cap: number; pct: number; calls: number };
  pendingApprovalCount: number;
  recentActions: { id: string; agentId: string; type: string; status: string; title: string; createdAt: string }[];
  recentRejections: { ts: string; reason: string }[];
  serverTime: string;
}

const TOKEN_KEY = "yaar.adminToken";

export default function Pulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "auth" | "error">("loading");
  const [tokenInput, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await ops.getPulse();
      setPulse(r);
      setStatus("ok");
    } catch (err) {
      if (err instanceof OpsError && err.status === 401) setStatus("auth");
      else setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (status === "auth") {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-md pt-12">
          <h1 className="font-display text-2xl font-bold text-ink">Pulse</h1>
          <p className="mt-2 text-sm text-muted">Enter the admin token to see Yaar's status.</p>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              className="input"
              placeholder="ADMIN_TOKEN"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              className="btn-primary w-full"
              onClick={() => {
                if (tokenInput.trim()) localStorage.setItem(TOKEN_KEY, tokenInput.trim());
                setStatus("loading");
                void load();
              }}
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error" || !pulse) {
    return (
      <div className="min-h-screen bg-bg p-6 text-ink">
        <div className="mx-auto max-w-md pt-12 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Pulse</h1>
          <p className="mt-2 text-muted">Couldn't reach the backend. Refresh in a moment.</p>
          <button className="btn-ghost mt-4" onClick={() => void load()}>Retry</button>
        </div>
      </div>
    );
  }

  const spendTone = pulse.spend.pct >= 90 ? "rose" : pulse.spend.pct >= 70 ? "amber" : "emerald";
  return (
    <div className="min-h-screen bg-bg p-4 text-ink sm:p-6">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink">Pulse</h1>
          <span className="text-xs text-faint">{new Date(pulse.serverTime).toLocaleTimeString()}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile
            label="Autonomy"
            value={pulse.autonomyMode}
            tone={pulse.autonomyMode === "live" ? "amber" : "emerald"}
          />
          <Tile
            label="Kill switch"
            value={pulse.killSwitchEngaged ? "ENGAGED" : "off"}
            tone={pulse.killSwitchEngaged ? "rose" : "emerald"}
            sub={pulse.killSwitchEngaged ? pulse.reason : undefined}
          />
          <Tile
            label="Spend today"
            value={`$${pulse.spend.today.toFixed(2)} / $${pulse.spend.cap}`}
            tone={spendTone}
            sub={`${pulse.spend.calls} calls · ${pulse.spend.pct}%`}
          />
          <Tile
            label="Pending approvals"
            value={String(pulse.pendingApprovalCount)}
            tone={pulse.pendingApprovalCount > 5 ? "amber" : "emerald"}
          />
        </div>

        <div className="mt-4">
          <button
            className={`w-full rounded-full py-3 text-base font-bold shadow-sm transition ${
              pulse.killSwitchEngaged
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-rose-500 text-white hover:bg-rose-600"
            } disabled:opacity-50`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await ops.setKill(!pulse.killSwitchEngaged, pulse.killSwitchEngaged ? "" : "manual stop from pulse");
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            {pulse.killSwitchEngaged ? "Resume Yaar" : "Engage kill switch"}
          </button>
        </div>

        <div className="card mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Recent actions</h2>
          {pulse.recentActions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No actions yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pulse.recentActions.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{a.title}</span>
                  <span className={`badge ${statusBadge(a.status)}`}>{a.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pulse.recentRejections.length > 0 && (
          <div className="card mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Recent safety rejections</h2>
            <ul className="mt-2 space-y-1.5 text-xs text-muted">
              {pulse.recentRejections.slice(0, 5).map((r, i) => (
                <li key={i}>
                  <span className="text-faint">{new Date(r.ts).toLocaleTimeString()}</span> — {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-faint">Auto-refresh every 20s</p>
      </div>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  emerald: "ring-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  amber: "ring-amber-500/40 text-amber-700 dark:text-amber-400",
  rose: "ring-rose-500/40 text-rose-700 dark:text-rose-400",
};

function Tile({ label, value, tone, sub }: { label: string; value: string; tone: "emerald" | "amber" | "rose"; sub?: string }) {
  return (
    <div className={`card flex flex-col gap-1 py-4 ring-2 ${TONE_CLASS[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

function statusBadge(s: string): string {
  if (s === "executed" || s === "approved") return "bg-emerald-500/12 text-emerald-600";
  if (s === "pending_approval") return "bg-amber-500/12 text-amber-700";
  if (s === "rejected") return "bg-rose-500/12 text-rose-600";
  if (s === "dry_run") return "bg-brand-500/12 text-brand-600";
  return "bg-surface-2 text-muted";
}
