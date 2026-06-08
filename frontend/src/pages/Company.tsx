import { useCallback, useEffect, useState } from "react";
import { PageHeading, Spinner, ErrorNote } from "../components/ui";
import { SkeletonCard, SkeletonList } from "../components/Skeleton";
import Markdown from "../components/Markdown";
import {
  ops,
  OpsError,
  type AutonomyMode,
  type ActionStatus,
  type OpsEmployee,
  type OpsAction,
  type OpsTask,
  type BoardroomResponse,
  type BoardroomTurn,
} from "../api/client";

// ---------------------------------------------------------------------------
// Company HQ — visualizes Yaar as an autonomous AI company: the org chart, a
// live multi-agent boardroom meeting, the action queue, and the autonomy mode
// (the human-approval safety valve).
// ---------------------------------------------------------------------------

// Department display order + labels + a colored badge from existing tokens.
const DEPARTMENTS: { key: string; label: string; emoji: string; badge: string }[] = [
  { key: "executive", label: "Executive", emoji: "👑", badge: "bg-gold-300/15 text-gold-500" },
  { key: "ops", label: "Operations", emoji: "⚙️", badge: "bg-brand-500/12 text-brand-500" },
  { key: "intelligence", label: "Intelligence", emoji: "🧠", badge: "bg-violet-500/12 text-violet-500" },
  { key: "marketing", label: "Marketing", emoji: "📣", badge: "bg-violet-500/12 text-violet-500" },
  { key: "customer_care", label: "Customer care", emoji: "💬", badge: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  { key: "growth", label: "Growth", emoji: "📈", badge: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
];

function deptMeta(key: string) {
  return (
    DEPARTMENTS.find((d) => d.key === key) ?? {
      key,
      label: key.replace(/_/g, " "),
      emoji: "•",
      badge: "bg-surface-2 text-muted",
    }
  );
}

const AUTONOMY_META: Record<AutonomyMode, { label: string; sub: string; badge: string; dot: string }> = {
  dry_run: {
    label: "Dry run",
    sub: "logs only, safe",
    badge: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  assist: {
    label: "Assist",
    sub: "needs human approval",
    badge: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  live: {
    label: "Live",
    sub: "acting",
    badge: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

const STATUS_BADGE: Record<ActionStatus, string> = {
  dry_run: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  pending_approval: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  approved: "bg-brand-500/12 text-brand-500",
  executed: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  failed: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
};

function statusBadge(status: ActionStatus) {
  return STATUS_BADGE[status] ?? "bg-surface-2 text-muted";
}

// Pick a role emoji for a transcript turn's avatar, by department/title cues.
function avatarFor(turn: { title: string; department: string }) {
  const t = turn.title.toLowerCase();
  if (t.includes("ceo") || t.includes("chief executive")) return "👑";
  if (t.includes("eval") || t.includes("qa") || t.includes("quality")) return "🛡️";
  const d = deptMeta(turn.department);
  if (d.emoji && d.emoji !== "•") return d.emoji;
  return turn.title.charAt(0).toUpperCase() || "•";
}

function isCeo(turn: { title: string }) {
  const t = turn.title.toLowerCase();
  return t.includes("ceo") || t.includes("chief executive");
}

function isEval(turn: { title: string; department: string }) {
  const t = turn.title.toLowerCase();
  return t.includes("eval") || t.includes("qa") || t.includes("quality") || turn.department === "eval";
}

export default function Company() {
  const [org, setOrg] = useState<{ autonomyMode: AutonomyMode; employees: OpsEmployee[] } | null>(null);
  const [board, setBoard] = useState<BoardroomResponse | null>(null);
  const [actions, setActions] = useState<OpsAction[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  // Per-employee run state.
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runSummary, setRunSummary] = useState<Record<string, string>>({});

  // Boardroom run state.
  const [topic, setTopic] = useState("");
  const [meeting, setMeeting] = useState(false);
  const [meetError, setMeetError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setNeedsToken(false);
    try {
      const [orgRes, latest, acts] = await Promise.all([
        ops.getOrg(),
        ops.latestBoardroom(),
        ops.listActions(),
      ]);
      setOrg(orgRes);
      setBoard(latest);
      setActions(acts.actions ?? []);
    } catch (err) {
      // Two unauthorized cases, both should surface the token field rather than a
      // generic failure: 401 = ADMIN_TOKEN is set but our header is missing/wrong
      // (the normal production case — paste a token to fix); 503 = no ADMIN_TOKEN
      // configured on a non-local host. On 401 a stale/bad saved token is the
      // likely cause, so clear it before prompting for a fresh one.
      if (err instanceof OpsError && (err.status === 401 || err.status === 503)) {
        if (err.status === 401) localStorage.removeItem("yaar.adminToken");
        setNeedsToken(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function saveTokenAndRetry() {
    if (tokenInput.trim()) localStorage.setItem("yaar.adminToken", tokenInput.trim());
    void load();
  }

  async function runEmployee(id: string) {
    setRunning((r) => ({ ...r, [id]: true }));
    try {
      const res = await ops.runEmployee(id);
      setRunSummary((s) => ({ ...s, [id]: res.summary }));
      // Refresh the action queue so newly produced actions show up.
      try {
        const acts = await ops.listActions();
        setActions(acts.actions ?? []);
      } catch {
        /* non-fatal */
      }
    } catch {
      setRunSummary((s) => ({ ...s, [id]: "Couldn't run this agent right now. Try again." }));
    } finally {
      setRunning((r) => ({ ...r, [id]: false }));
    }
  }

  async function runBoardroom() {
    setMeeting(true);
    setMeetError(false);
    try {
      const res = await ops.runBoardroom(topic.trim() || undefined);
      setBoard(res);
      try {
        const acts = await ops.listActions();
        setActions(acts.actions ?? []);
      } catch {
        /* non-fatal */
      }
    } catch {
      setMeetError(true);
    } finally {
      setMeeting(false);
    }
  }

  const autonomy = org ? AUTONOMY_META[org.autonomyMode] : null;

  // Group employees by department, in display order.
  const grouped = DEPARTMENTS.map((d) => ({
    ...d,
    items: (org?.employees ?? []).filter((e) => e.department === d.key),
  })).filter((g) => g.items.length > 0);
  // Any employees with an unrecognized department.
  const knownDepts = new Set(DEPARTMENTS.map((d) => d.key));
  const otherEmployees = (org?.employees ?? []).filter((e) => !knownDepts.has(e.department));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Company HQ 🏢"
        subtitle="Yaar runs as an autonomous AI company. Watch the team meet, decide, and act, with a human-approval safety valve."
        action={
          autonomy && (
            <div className={`badge gap-2 px-3 py-1.5 ${autonomy.badge}`} title={`Autonomy mode: ${autonomy.label}`}>
              <span className={`h-2 w-2 rounded-full ${autonomy.dot}`} />
              <span className="font-bold">{autonomy.label}</span>
              <span className="font-medium opacity-70">· {autonomy.sub}</span>
            </div>
          )
        }
      />

      {/* Admin token prompt (deployed only). */}
      {needsToken && (
        <div className="card relative overflow-hidden border-amber-500/30 bg-amber-500/5">
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(245,158,11,0.10)_0,transparent_60%)]" />
          <div className="relative space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Admin access required</h2>
              <p className="mt-1 text-sm text-muted">
                The ops console is admin-gated in production. Paste an admin token to view the company.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input max-w-sm"
                type="password"
                placeholder="Admin token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTokenAndRetry()}
              />
              <button className="btn-primary" onClick={saveTokenAndRetry} disabled={!tokenInput.trim()}>
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonList count={3} lines={1} />
        </>
      ) : loadError ? (
        <ErrorNote onRetry={load} />
      ) : needsToken ? null : (
        <>
          {/* ---- ORG ---- */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">The org</h2>
              <span className="text-xs text-faint">{org?.employees.length ?? 0} AI employees</span>
            </div>

            {[...grouped, ...(otherEmployees.length ? [{ ...deptMeta("other"), label: "Other", items: otherEmployees }] : [])].map(
              (g) => (
                <div key={g.key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${g.badge}`}>
                      {g.emoji} {g.label}
                    </span>
                    <span className="text-xs text-faint">
                      {g.items.length} {g.items.length === 1 ? "role" : "roles"}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {g.items.map((e) => (
                      <EmployeeCard
                        key={e.id}
                        employee={e}
                        running={!!running[e.id]}
                        summary={runSummary[e.id]}
                        onRun={() => runEmployee(e.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </section>

          {/* ---- BOARDROOM (centerpiece) ---- */}
          <section className="card relative overflow-hidden border-brand-500/20 bg-brand-500/5">
            <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_80%_at_100%_0%,rgba(99,102,241,0.12)_0,transparent_60%)]" />
            <div className="relative space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-ink">The boardroom</h2>
                <p className="mt-1 text-sm text-muted">
                  Convene the team. They debate the topic, the CEO decides, and an eval agent reviews before anything ships.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1 min-w-[16rem]"
                  placeholder="e.g. How do we grow trust with rural families this week?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !meeting && runBoardroom()}
                  disabled={meeting}
                />
                <button className="btn-primary" onClick={runBoardroom} disabled={meeting}>
                  {meeting ? <Spinner label="The team is meeting..." /> : "Run boardroom"}
                </button>
              </div>

              {meetError && <ErrorNote onRetry={runBoardroom}>The boardroom couldn't convene right now. Try again.</ErrorNote>}

              {board?.topic && !meeting && (
                <p className="text-sm text-muted">
                  Topic: <span className="font-medium text-ink">{board.topic}</span>
                </p>
              )}

              {/* Transcript thread */}
              {board && board.transcript.length > 0 ? (
                <div className="space-y-3">
                  {board.transcript.map((turn, i) => (
                    <TranscriptRow key={i} turn={turn} />
                  ))}

                  {/* Eval / review verdict */}
                  {board.review && (
                    <div
                      className={`rounded-xl border p-4 ${
                        board.review.approved
                          ? "border-emerald-500/30 bg-emerald-500/8"
                          : "border-amber-500/30 bg-amber-500/8"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-base">🛡️</span>
                        <span
                          className={`badge ${
                            board.review.approved
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          Eval · {board.review.approved ? "Approved" : "Held"}
                        </span>
                      </div>
                      <Markdown className="text-sm" inline>
                        {board.review.reason}
                      </Markdown>
                    </div>
                  )}
                </div>
              ) : (
                !meeting && <p className="text-sm text-muted">No meeting yet. Set a topic and run the boardroom.</p>
              )}

              {/* Resulting tasks */}
              {board && board.tasks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-ink">Tasks created</h3>
                  <ul className="space-y-2">
                    {board.tasks.map((t) => (
                      <TaskRow key={t.id} task={t} />
                    ))}
                  </ul>
                </div>
              )}

              {/* Resulting actions (compact) */}
              {board && board.actions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-ink">Actions queued from this meeting</h3>
                  <div className="space-y-1.5">
                    {board.actions.map((a) => (
                      <ActionRow key={a.id} action={a} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ---- ACTION QUEUE ---- */}
          <section className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold tracking-tight text-ink">Action queue</h2>
              <span className="text-xs text-faint">{actions.length} recent</span>
            </div>
            {actions.length > 0 ? (
              <div className="space-y-2">
                {actions.map((a) => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    onChange={async () => {
                      const r = await ops.listActions();
                      setActions(r.actions ?? []);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No actions yet. Run an employee or the boardroom to generate some.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function EmployeeCard({
  employee,
  running,
  summary,
  onRun,
}: {
  employee: OpsEmployee;
  running: boolean;
  summary?: string;
  onRun: () => void;
}) {
  const d = deptMeta(employee.department);
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{employee.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`badge ${d.badge}`}>
              {d.emoji} {d.label}
            </span>
            <span className="badge bg-surface-2 text-muted">⏱ {employee.cadence}</span>
          </div>
        </div>
        <button className="btn-ghost shrink-0 px-3 py-1.5 text-xs" onClick={onRun} disabled={running}>
          {running ? <Spinner label="Running..." /> : "Run"}
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">{employee.mission}</p>

      {employee.allowedActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {employee.allowedActions.map((a) => (
            <span key={a} className="chip px-2.5 py-1 text-xs">
              {a}
            </span>
          ))}
        </div>
      )}

      {summary && (
        <div className="mt-3 rounded-lg border border-line bg-surface-2/60 p-3">
          <Markdown className="text-sm">{summary}</Markdown>
        </div>
      )}
    </div>
  );
}

function TranscriptRow({ turn }: { turn: BoardroomTurn }) {
  const ceo = isCeo(turn);
  const ev = isEval(turn);
  const d = deptMeta(turn.department);
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          ceo
            ? "bg-gradient-to-br from-gold-300 to-gold-500 text-slate-950 shadow-glow"
            : ev
              ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white"
              : "bg-gradient-to-br from-brand-500 to-violet-500 text-white"
        }`}
      >
        {avatarFor(turn)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-ink">{turn.title}</span>
          <span className={`badge ${d.badge}`}>
            {d.emoji} {d.label}
          </span>
        </div>
        <div
          className={`rounded-2xl rounded-tl-sm border px-3.5 py-2.5 ${
            ceo
              ? "border-gold-500/30 bg-gold-300/10"
              : "border-line bg-surface"
          }`}
        >
          <Markdown className="text-sm" inline>
            {turn.message}
          </Markdown>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: OpsTask }) {
  const d = deptMeta(task.department);
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-ink">{task.title}</span>
          <span className={`badge ${d.badge}`}>
            {d.emoji} {d.label}
          </span>
        </div>
        {task.detail && <p className="mt-0.5 text-xs text-muted">{task.detail}</p>}
      </div>
      <span className="badge shrink-0 bg-surface-2 text-muted">{task.status.replace(/_/g, " ")}</span>
    </li>
  );
}

function ActionRow({ action, compact = false, onChange }: { action: OpsAction; compact?: boolean; onChange?: () => void }) {
  const d = deptMeta(action.department);
  const [busy, setBusy] = useState(false);
  const pending = action.status === "pending_approval";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-line bg-surface ${
        compact ? "px-3 py-2" : "p-3"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-ink">{action.title}</span>
          {action.external && <span className="badge bg-violet-500/12 text-violet-500">external</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className={`badge ${d.badge}`}>
            {d.emoji} {d.label}
          </span>
          <span className="text-faint">
            {action.type}
            {action.channel ? ` · ${action.channel}` : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pending && onChange && (
          <>
            <button
              className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                // Always resync afterward, even on error: a 409 (another tab/click
                // already claimed it) or 400 means this row is stale, so refetch to
                // show its real status instead of leaving it stuck on "pending".
                try { await ops.approveAction(action.id); } catch { /* resynced below */ } finally { onChange?.(); setBusy(false); }
              }}
            >
              Approve
            </button>
            <button
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-500/5 disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                // Resync on error too (e.g. the action was already acted on elsewhere)
                // so the row reflects the server's real status.
                try { await ops.rejectAction(action.id); } catch { /* resynced below */ } finally { onChange?.(); setBusy(false); }
              }}
            >
              Reject
            </button>
          </>
        )}
        <span className={`badge ${statusBadge(action.status)}`}>{action.status.replace(/_/g, " ")}</span>
      </div>
    </div>
  );
}
