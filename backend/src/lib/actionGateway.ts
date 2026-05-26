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

  // Internal actions (drafts, tasks, reports) are always safe to record.
  if (!external) {
    return store.addAction({ ...p, external, status: "executed", result: "internal action recorded" });
  }

  // dry_run: never touch the world, just log the intent.
  if (config.autonomyMode === "dry_run") {
    return store.addAction({ ...p, external, status: "dry_run", result: "dry run: nothing was sent" });
  }

  // assist + live: vet the content first.
  const review = await reviewAction(p);
  if (!review.approved) {
    return store.addAction({ ...p, external, status: "rejected", result: `blocked by review: ${review.reason}` });
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
