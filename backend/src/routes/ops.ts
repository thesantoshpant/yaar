// Operations console for the agentic company: see the org, run an employee,
// review the action audit log, and approve/reject queued (assist-mode) actions.
// NOTE: these are admin endpoints; protect them with auth before production.
import { Router } from "express";
import { EMPLOYEES } from "../lib/org";
import { runEmployee, companyStandup, orchestrate } from "../services/companyAgents";
import { runBoardroom, getLastBoardroom } from "../services/agentBoardroom";
import { executeApproved } from "../lib/actionGateway";
import { store } from "../lib/store";
import { config } from "../config";
import { getSafetyStatus, setKillSwitch } from "../services/safety";

export const opsRouter = Router();

// Safety: the kill switch + daily-spend status. GET shows where we are; POST
// engages or disengages the global gate (every external action is rejected
// when the switch is on, until a human flips it back).
opsRouter.get("/safety", (_req, res) => {
  res.json(getSafetyStatus());
});

opsRouter.post("/safety/kill", (req, res) => {
  const engaged = Boolean(req.body?.engaged);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
  setKillSwitch(engaged, reason);
  res.json(getSafetyStatus());
});

// One-glance pulse: everything a founder needs to answer "is Yaar OK?" in 30
// seconds from a phone at a resort. autonomy mode, kill-switch state, today's
// spend vs cap, pending-approval count, last 5 Diya rejections, last 5 actions.
opsRouter.get("/pulse", async (_req, res) => {
  const safety = getSafetyStatus();
  const pending = await store.listActions({ status: "pending_approval", limit: 50 });
  const recent = await store.listActions({ limit: 5 });
  res.json({
    ok: !safety.killSwitchEngaged,
    autonomyMode: safety.autonomyMode,
    killSwitchEngaged: safety.killSwitchEngaged,
    reason: safety.reason,
    spend: {
      today: safety.totalSpendUsd,
      cap: safety.dailyHardCapUsd,
      pct: Math.round((safety.totalSpendUsd / Math.max(safety.dailyHardCapUsd, 0.0001)) * 100),
      calls: safety.callCount,
    },
    pendingApprovalCount: pending.length,
    recentActions: recent.map((a) => ({ id: a.id, agentId: a.agentId, type: a.type, status: a.status, title: a.title, createdAt: a.createdAt })),
    recentRejections: safety.recentRejections.slice(0, 5),
    serverTime: new Date().toISOString(),
  });
});

// Audit feed: last N actions with proposer + verdict. Cheap turn-the-autonomy-
// claim-into-a-measured-artifact: rate of Diya blocks vs. approvals visible.
opsRouter.get("/audit", async (req, res) => {
  const limit = Math.min(200, Math.max(10, Number(req.query.limit ?? 50)));
  const actions = await store.listActions({ limit });
  const summary = {
    total: actions.length,
    byStatus: actions.reduce<Record<string, number>>((m, a) => ({ ...m, [a.status]: (m[a.status] ?? 0) + 1 }), {}),
    diyaBlockedRate: actions.length === 0 ? 0 : actions.filter((a) => a.status === "rejected").length / actions.length,
  };
  res.json({ summary, actions });
});

opsRouter.get("/org", (_req, res) => {
  res.json({
    autonomyMode: config.autonomyMode,
    employees: EMPLOYEES.map((e) => ({
      id: e.id,
      title: e.title,
      department: e.department,
      mission: e.mission,
      cadence: e.cadence,
      allowedActions: e.allowedActions,
    })),
  });
});

opsRouter.post("/run/:employeeId", async (req, res) => {
  const context = typeof req.body?.context === "string" ? req.body.context : undefined;
  const result = await runEmployee(req.params.employeeId, context);
  if (!result) return res.status(404).json({ error: "Unknown employee" });
  res.json(result);
});

opsRouter.post("/standup", async (_req, res) => {
  await companyStandup();
  res.json({ ok: true, actions: await store.listActions({ limit: 20 }) });
});

// The CEO sets tasks per department, then each department's agent works its task.
opsRouter.post("/orchestrate", async (_req, res) => {
  const result = await orchestrate();
  res.json(result);
});

// Run a live boardroom: the employees discuss a topic, the CEO decides, eval reviews.
opsRouter.post("/boardroom", async (req, res) => {
  const topic = typeof req.body?.topic === "string" ? req.body.topic : undefined;
  res.json(await runBoardroom(topic));
});

opsRouter.get("/boardroom/latest", (_req, res) => {
  res.json(getLastBoardroom() ?? { transcript: [], tasks: [], actions: [] });
});

opsRouter.get("/tasks", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json({ tasks: await store.listTasks({ status }) });
});

opsRouter.get("/actions", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json({ actions: await store.listActions({ status }) });
});

opsRouter.get("/approvals", async (_req, res) => {
  res.json({ actions: await store.listActions({ status: "pending_approval" }) });
});

opsRouter.post("/actions/:id/approve", async (req, res) => {
  const action = await store.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Not found" });
  if (action.status !== "pending_approval") return res.status(400).json({ error: `Action is ${action.status}, not pending` });
  const updated = await executeApproved(action);
  res.json({ action: updated });
});

opsRouter.post("/actions/:id/reject", async (req, res) => {
  const action = await store.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Not found" });
  const updated = await store.setActionStatus(req.params.id, "rejected");
  res.json({ action: updated });
});
