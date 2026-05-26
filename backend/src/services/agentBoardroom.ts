// The Boardroom: a live, multi-turn meeting where Yaar's AI employees actually talk
// to each other. The CEO opens with the situation, each department head reads the
// discussion so far and adds their perspective (building on or challenging colleagues),
// the CEO synthesizes decisions into assigned tasks, and the eval/QA agent reviews the
// plan for honesty and brand-safety. Every proposed action routes through the Action
// Gateway, so autonomy mode and guardrails still apply. This is the visible heart of
// the "fully autonomous company" USP.
import { generateJson } from "./gemini";
import { getEmployee, COMPANY_BRAIN, type Employee } from "../lib/org";
import { YAAR_PRINCIPLES } from "../lib/prompts";
import { dispatch } from "../lib/actionGateway";
import { reviewAction } from "./evalAgent";
import { companyKpis, recordDecision, recentDecisions } from "./companyIntel";
import { store } from "../lib/store";
import type { AgentAction, CompanyTask } from "../lib/types";

export interface BoardroomTurn {
  agentId: string;
  title: string;
  department: string;
  message: string;
  ts: string;
}

export interface BoardroomResult {
  topic: string;
  startedAt: string;
  transcript: BoardroomTurn[];
  tasks: CompanyTask[];
  actions: AgentAction[];
  review: { approved: boolean; reason: string };
  source: string;
}

// Who speaks, in order, between the CEO's opening and closing.
const CONTRIBUTORS = ["analytics", "memory", "marketing_content", "growth_outreach", "support"];

let lastBoardroom: BoardroomResult | null = null;
export function getLastBoardroom(): BoardroomResult | null {
  return lastBoardroom;
}

async function gatherKpis(): Promise<string> {
  return companyKpis();
}

interface Contribution {
  message: string;
  proposedActions?: { type: string; channel?: string; title: string; payload: string; riskLevel?: "low" | "medium" | "high" }[];
}

function transcriptText(turns: BoardroomTurn[]): string {
  return turns.map((t) => `${t.title}: ${t.message}`).join("\n") || "(meeting just opened)";
}

async function speak(emp: Employee, topic: string, kpis: string, turns: BoardroomTurn[], instruction: string, mockMsg: string): Promise<Contribution> {
  const { data } = await generateJson<Contribution>({
    system: `${YAAR_PRINCIPLES}
Company: ${COMPANY_BRAIN}
You are ${emp.title} in the ${emp.department} team. Your mission: ${emp.mission}
You are in a live company meeting. ${instruction}
Keep your message to 1-3 punchy sentences. Reference what colleagues said by name where it helps. Only propose actions within your allowed types: ${emp.allowedActions.join(", ")}.
Return ONLY JSON: { "message": string, "proposedActions": [ { "type": string, "channel"?: string, "title": string, "payload": string, "riskLevel": "low"|"medium"|"high" } ] }`,
    prompt: `Meeting topic: "${topic}"
Company KPIs: ${kpis}
Discussion so far:
${transcriptText(turns)}

Your turn now.`,
    mock: () => ({ message: mockMsg, proposedActions: [] }),
  });
  return { message: data?.message ?? mockMsg, proposedActions: Array.isArray(data?.proposedActions) ? data.proposedActions : [] };
}

async function routeActions(emp: Employee, c: Contribution): Promise<AgentAction[]> {
  const out: AgentAction[] = [];
  for (const pa of (c.proposedActions ?? []).slice(0, 2)) {
    if (!emp.allowedActions.includes(pa.type)) continue; // guardrail
    out.push(
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
  return out;
}

export async function runBoardroom(topicArg?: string): Promise<BoardroomResult> {
  const topic = topicArg?.trim() || "Grow trust and paid conversion this week without ever being pushy or spammy.";
  const kpis = await gatherKpis();
  const turns: BoardroomTurn[] = [];
  const actions: AgentAction[] = [];
  let source = "mock";
  const now = () => new Date().toISOString();
  const push = (e: Employee, message: string) => turns.push({ agentId: e.id, title: e.title, department: e.department, message, ts: now() });

  const ceo = getEmployee("ceo")!;

  // 1. CEO opens (aware of what the company already decided).
  const open = await speak(ceo, topic, kpis, turns, `Open the meeting: state the situation in one line and the single priority you want the team to rally around, then invite their input. Recent decisions on record (build on them, don't repeat):\n${recentDecisions()}`, "Team, the priority is simple: turn our free visa-risk users into trusting paying families, and do it by being more helpful, never pushier. What's our highest-leverage move?");
  push(ceo, open.message);

  // 2. Each department head contributes, reading the discussion so far.
  for (const id of CONTRIBUTORS) {
    const emp = getEmployee(id);
    if (!emp) continue;
    const mockByRole: Record<string, string> = {
      analytics: "The one number that matters is risk-report completion to account creation. It's our leakiest step, so let's make finishing a report feel like a win, not a paywall.",
      memory: "I can already tell who's serious: students who upload an I-20 and ask follow-ups. I'll surface those to support and tailor each plan to what I know about them.",
      marketing_content: "Building on analytics, I'll publish an honest 'why F-1 visas get refused' guide that ends in a free risk check. No hype, just help, exactly the families we want find us.",
      growth_outreach: "Agreed with marketing. I'll line up a consented weekly opportunity email for opted-in students only, with a clear unsubscribe. Welcome, never spam.",
      support: "I'll clear the question queue within a day and flag anything legal to a human. Fast, honest answers are the cheapest trust we can buy.",
    };
    const c = await speak(emp, topic, kpis, turns, "Add YOUR department's perspective, building on or respectfully challenging what colleagues just said. Be concrete.", mockByRole[id] ?? "Here's my take.");
    push(emp, c.message);
    const routed = await routeActions(emp, c);
    actions.push(...routed);
    if (c.proposedActions && c.proposedActions.length) source = "gemini";
  }

  // 3. CEO synthesizes the decision into assigned tasks.
  const close = await generateJson<{ message: string; tasks: { title: string; detail: string; department: string }[] }>({
    system: `${YAAR_PRINCIPLES}
Company: ${COMPANY_BRAIN}
You are the agentic CEO closing the meeting. Read the whole discussion and synthesize ONE clear decision plus 2-4 concrete tasks, each assigned to exactly one department (marketing, customer_care, growth, ops, intelligence). Propose; humans approve money, partnerships, or public statements.
Return ONLY JSON: { "message": string, "tasks": [ { "title": string, "detail": string, "department": string } ] }`,
    prompt: `Topic: "${topic}"\nKPIs: ${kpis}\nFull discussion:\n${transcriptText(turns)}\n\nClose the meeting now.`,
    mock: () => ({
      message: "Decision: lead with helpfulness. Ship the honest refusal-reasons guide, make finishing a risk report feel like a win, and only email opted-in students. Memory tailors every touch. I'll review conversion next week.",
      tasks: [
        { title: "Publish the honest 'why F-1 visas get refused' guide", detail: "End with a free risk check. No hype.", department: "marketing" },
        { title: "Tighten risk-report to account-creation flow", detail: "Make finishing feel like a win, not a paywall.", department: "ops" },
      ],
    }),
  });
  push(ceo, close.data?.message ?? "Let's ship it.");
  if (close.source === "gemini") source = "gemini";

  const tasks: CompanyTask[] = [];
  for (const t of (close.data?.tasks ?? []).slice(0, 4)) {
    const task = await store.addTask({ title: t.title, detail: t.detail, department: t.department, createdBy: "ceo" });
    tasks.push(task);
  }

  // 4. Eval / QA agent reviews the plan as the last line of defense.
  const review = await reviewAction({ type: "report", title: `Boardroom plan: ${topic}`, payload: `${close.data?.message ?? ""}\nTasks: ${tasks.map((t) => t.title).join("; ")}` });
  turns.push({ agentId: "eval", title: "Eval / QA Agent", department: "trust", message: review.approved ? `Approved. ${review.reason}` : `Held for revision. ${review.reason}`, ts: now() });

  recordDecision("boardroom", close.data?.message ?? `Met on: ${topic}`);
  lastBoardroom = { topic, startedAt: now(), transcript: turns, tasks, actions, review, source };
  return lastBoardroom;
}
