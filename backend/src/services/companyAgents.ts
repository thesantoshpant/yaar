// The runtime that runs a company "employee": builds its role prompt from the org
// + company brain + live KPIs, asks Gemini what to do, and routes each proposed
// action through the Action Gateway (which enforces the autonomy mode + guardrails).
import { generateJson } from "./gemini";
import { getEmployee, COMPANY_BRAIN, type Employee } from "../lib/org";
import { YAAR_PRINCIPLES } from "../lib/prompts";
import { dispatch } from "../lib/actionGateway";
import { store } from "../lib/store";
import { config } from "../config";
import { runMemoryAgent } from "./memoryAgent";
import { companyKpis, recordDecision, recentDecisions } from "./companyIntel";
import type { AgentAction, CompanyTask } from "../lib/types";

// Daily cap on agent runs to control LLM spend.
let runQuota = { day: "", count: 0 };
function consumeRunQuota(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (runQuota.day !== today) runQuota = { day: today, count: 0 };
  if (runQuota.count >= config.maxAgentRunsPerDay) return false;
  runQuota.count += 1;
  return true;
}

interface ProposedActionDraft {
  type: string;
  channel?: string;
  title: string;
  payload: string;
  riskLevel: "low" | "medium" | "high";
}

interface AgentDecision {
  summary: string;
  proposedActions: ProposedActionDraft[];
}

export interface EmployeeRunResult {
  employee: string;
  title: string;
  summary: string;
  actions: AgentAction[];
  source: string;
}

async function gatherKpis(): Promise<string> {
  return companyKpis();
}

function mockDecision(emp: Employee): AgentDecision {
  switch (emp.id) {
    case "ceo":
      return {
        summary: "Demo mode. Focus this week: convert visa-risk-report users to paid, and ship one honest Nepal guide.",
        proposedActions: [
          { type: "internal_task", title: "Marketing: publish 'Why Nepali F-1 visas get refused' guide", payload: "Assign to content marketer", riskLevel: "low" },
          { type: "report", title: "Weekly priorities", payload: "1) paid conversion 2) one helpful guide 3) reply to all support within a day", riskLevel: "low" },
        ],
      };
    case "arjun":
      return {
        summary: "Demo mode. The number that matters: paid visa-report conversion.",
        proposedActions: [{ type: "report", title: "Daily status", payload: "Students growing; track paid conversion and weekly active.", riskLevel: "low" }],
      };
    case "aanya":
      return {
        summary: "Demo mode. Drafted a helpful, on-brand piece for Nepali applicants.",
        proposedActions: [
          { type: "draft_content", title: "Blog: 5 reasons Nepali F-1 visas get refused (and how to fix each)", payload: "Honest guide, no hype, ends with a free risk-check CTA.", riskLevel: "low" },
          { type: "social_post", channel: "x", title: "Thread: the 3 questions that sink most F-1 interviews", payload: "Short, useful thread; link to the free risk check.", riskLevel: "medium" },
        ],
      };
    case "sara":
      return {
        summary: "Demo mode. Prepared a clear reply to a common question.",
        proposedActions: [{ type: "support_reply", channel: "email", title: "Re: Do I need the SAT?", payload: "Plain answer + what matters more for your profile.", riskLevel: "low" }],
      };
    case "leo":
      return {
        summary: "Demo mode. Planned a consented weekly opportunity email.",
        proposedActions: [{ type: "email_campaign", channel: "email", title: "This week's opportunities for Nepal CS students", payload: "Only to opted-in users; includes unsubscribe.", riskLevel: "medium" }],
      };
    default:
      return { summary: "Demo mode.", proposedActions: [] };
  }
}

export async function runEmployee(employeeId: string, context?: string): Promise<EmployeeRunResult | null> {
  const emp = getEmployee(employeeId);
  if (!emp) return null;
  if (!consumeRunQuota()) {
    return { employee: emp.id, title: emp.title, summary: "Daily agent-run cap reached; skipping to control cost.", actions: [], source: "mock" };
  }

  // The Memory Agent does real per-student work (it consolidates minds) rather than
  // proposing outbound actions, so it has its own runner.
  if (emp.id === "memory") {
    const r = await runMemoryAgent();
    return { employee: emp.id, title: emp.title, summary: r.summary, actions: [], source: r.source };
  }

  const kpis = await gatherKpis();
  const system = `${YAAR_PRINCIPLES}
Company context: ${COMPANY_BRAIN}
Your role: ${emp.title} in the ${emp.department} team. Mission: ${emp.mission}
${emp.systemPrompt}
You may ONLY propose actions of these types: ${emp.allowedActions.join(", ")}. Keep proposals concrete and on-brand. Outbound actions (to real people or platforms) may require human approval, so be conservative and never spammy.
Return ONLY JSON: { "summary": string, "proposedActions": [ { "type": string, "channel"?: string, "title": string, "payload": string, "riskLevel": "low"|"medium"|"high" } ] }`;

  const prompt = `Company KPIs: ${kpis}.
Recent company decisions (don't repeat these; build on them):
${recentDecisions()}
${context ? `Extra context: ${context}\n` : ""}Decide what to do now. Propose 1 to 3 concrete actions, only within your allowed types.`;

  const { data, source } = await generateJson<AgentDecision>({ system, prompt, mock: () => mockDecision(emp) });
  recordDecision(emp.id, data.summary ?? "");

  const actions: AgentAction[] = [];
  for (const pa of (data.proposedActions ?? []).slice(0, 5)) {
    if (!emp.allowedActions.includes(pa.type)) continue; // guardrail: enforce allowed types
    actions.push(
      await dispatch({
        agentId: emp.id,
        department: emp.department,
        type: pa.type,
        channel: pa.channel,
        title: pa.title ?? "(untitled)",
        payload: typeof pa.payload === "string" ? pa.payload : JSON.stringify(pa.payload ?? ""),
        riskLevel: pa.riskLevel ?? "low",
      })
    );
  }

  return { employee: emp.id, title: emp.title, summary: data.summary ?? "", actions, source };
}

// A "company standup": run the always-on employees once. Used by the scheduler.
export async function companyStandup(): Promise<void> {
  for (const id of ["arjun", "ceo", "aanya"]) {
    try {
      await runEmployee(id);
    } catch (err) {
      console.error("[company] standup failed for", id, err);
    }
  }
}

// Maps a department to the employee who works its tasks.
const DEPT_EMPLOYEE: Record<string, string> = {
  marketing: "aanya",
  customer_care: "sara",
  growth: "leo",
  ops: "arjun",
};

// The CEO orchestrator: set tasks per department, then have each department's
// agent actually work its task (routing any outbound through the gateway).
export async function orchestrate(): Promise<{ summary: string; tasks: CompanyTask[]; worked: EmployeeRunResult[] }> {
  const kpis = await gatherKpis();
  const { data } = await generateJson<{ summary: string; tasks: { title: string; detail: string; department: string }[] }>({
    system: `${YAAR_PRINCIPLES}
Company context: ${COMPANY_BRAIN}
You are the agentic CEO / chief of staff. Based on the KPIs, set 2 to 4 concrete tasks for this cycle, each assigned to exactly one department: marketing, customer_care, growth, or ops. Be strategic and lean; prioritize the one thing that moves the company most. Propose; the human founders approve anything involving money, partnerships, or public statements.
Return ONLY JSON: { "summary": string, "tasks": [ { "title": string, "detail": string, "department": "marketing"|"customer_care"|"growth"|"ops" } ] }`,
    prompt: `Company KPIs: ${kpis}.\nRecent company decisions (build on these, don't repeat):\n${recentDecisions()}\nDecide this cycle's tasks now.`,
    mock: () => ({
      summary: "Demo mode. Priority: convert visa-risk-report users to paid, and ship one honest Nepal guide.",
      tasks: [
        { title: "Publish an honest F-1 visa guide for Nepal", detail: "Cover the top refusal reasons and how to prepare. End with the free risk check.", department: "marketing" },
        { title: "Answer all open student questions within a day", detail: "Clear the support queue; escalate anything risky.", department: "customer_care" },
      ],
    }),
  });

  const tasks: CompanyTask[] = [];
  const worked: EmployeeRunResult[] = [];
  for (const t of (data.tasks ?? []).slice(0, 5)) {
    const task = await store.addTask({ title: t.title, detail: t.detail, department: t.department, createdBy: "ceo" });
    tasks.push(task);
    const empId = DEPT_EMPLOYEE[t.department];
    if (!empId) continue;
    await store.updateTask(task.id, { status: "in_progress" });
    const r = await runEmployee(empId, `Task from the CEO: ${t.title}. ${t.detail}`);
    if (r) worked.push(r);
    await store.updateTask(task.id, { status: "done", resolvedAt: new Date().toISOString() });
  }
  recordDecision("ceo", data.summary ?? "");
  return { summary: data.summary ?? "", tasks, worked };
}
