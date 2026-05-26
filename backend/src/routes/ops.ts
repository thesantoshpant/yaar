// Operations console for the agentic company: see the org, run an employee,
// review the action audit log, and approve/reject queued (assist-mode) actions.
// NOTE: these are admin endpoints; protect them with auth before production.
import { Router } from "express";
import { EMPLOYEES } from "../lib/org";
import { runEmployee, companyStandup, orchestrate } from "../services/companyAgents";
import { executeApproved } from "../lib/actionGateway";
import { store } from "../lib/store";
import { config } from "../config";

export const opsRouter = Router();

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
