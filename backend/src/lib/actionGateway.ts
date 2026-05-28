// The Action Gateway: the single chokepoint through which every company-agent
// action reaches the real world. It enforces, in order:
//   1) internal vs external classification
//   2) autonomy mode (dry_run logs, assist queues for approval, live executes)
//   3) an eval/QA review of all outbound content (assist + live)
//   4) a daily cap on external actions (rate/spend safety)
//   5) execution via real integrations (email today; social/WhatsApp stubbed)
import { config } from "../config";
import { store } from "./store";
import { sendEmail } from "./email";
import { reviewAction } from "../services/evalAgent";
import { checkSpendOk } from "../services/safety";
import type { AgentAction } from "./types";

const EXTERNAL_TYPES = new Set(["social_post", "email_campaign", "whatsapp_message", "support_reply"]);

export interface ProposedAction {
  agentId: string;
  department: string;
  type: string;
  channel?: string;
  title: string;
  payload: string;
  riskLevel: "low" | "medium" | "high";
}

// Daily external-action quota (resets each day). Safety against runaway/spam.
let quota = { day: "", count: 0 };
function consumeExternalQuota(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (quota.day !== today) quota = { day: today, count: 0 };
  if (quota.count >= config.maxExternalActionsPerDay) return false;
  quota.count += 1;
  return true;
}

export async function dispatch(p: ProposedAction): Promise<AgentAction> {
  const external = EXTERNAL_TYPES.has(p.type);

  // Global kill switch + daily spend cap. Engaged from /api/ops/safety/kill;
  // when on, every external action is hard-rejected with a clear audit trail.
  if (external) {
    const gate = checkSpendOk(undefined, 0.01);
    if (!gate.ok) {
      return store.addAction({ ...p, external, status: "rejected", result: `safety gate: ${gate.reason}` });
    }
  }

  // Internal actions (drafts, tasks, reports) are always safe to record.
  if (!external) {
    return store.addAction({ ...p, external, status: "executed", result: "internal action recorded" });
  }

  // Diya scores EVERY external draft up front, regardless of autonomy mode.
  // This is intentional: even in dry_run we want the audit log to show whether
  // the draft would have been approved, so the founder can calibrate Diya
  // before flipping to assist or live. A hard-rejected draft never reaches
  // any later branch.
  const review = await reviewAction(p);
  if (!review.approved) {
    return store.addAction({ ...p, external, status: "rejected", result: `blocked by review: ${review.reason}` });
  }

  // dry_run: passed review, but never touch the world.
  if (config.autonomyMode === "dry_run") {
    return store.addAction({ ...p, external, status: "dry_run", result: `dry run (review passed): ${review.reason}` });
  }

  // assist: hold for human approval.
  if (config.autonomyMode === "assist") {
    return store.addAction({ ...p, external, status: "pending_approval", result: `review passed: ${review.reason}` });
  }

  // live: enforce the daily cap, then execute.
  if (!consumeExternalQuota()) {
    return store.addAction({ ...p, external, status: "failed", result: "daily external-action cap reached" });
  }
  try {
    const result = await execute(p);
    return store.addAction({ ...p, external, status: "executed", result });
  } catch (err) {
    return store.addAction({ ...p, external, status: "failed", result: String(err) });
  }
}

// Called when a human approves a queued action (assist mode).
export async function executeApproved(action: AgentAction): Promise<AgentAction | null> {
  const gate = checkSpendOk(undefined, 0.01);
  if (!gate.ok) {
    return store.setActionStatus(action.id, "failed", `safety gate: ${gate.reason}`);
  }
  if (!consumeExternalQuota()) {
    return store.setActionStatus(action.id, "failed", "daily external-action cap reached");
  }
  try {
    const result = await execute(action);
    return store.setActionStatus(action.id, "executed", result);
  } catch (err) {
    return store.setActionStatus(action.id, "failed", String(err));
  }
}

// Real integrations live here. Email is wired (Resend, graceful). Social and
// WhatsApp are simulated until their APIs + approved templates are added.
async function execute(p: { type: string; channel?: string; title: string; payload: string }): Promise<string> {
  switch (p.type) {
    case "email_campaign":
    case "support_reply":
      return sendEmail({ subject: p.title, text: p.payload });
    case "social_post":
      return `[simulated] posted to ${p.channel ?? "social"}: ${p.title}`;
    case "whatsapp_message":
      return `[simulated] sent WhatsApp (template): ${p.title}`;
    default:
      return "executed";
  }
}
