// Shared intelligence for the agentic company: real KPIs computed from the store, and
// a lightweight decision journal so agents remember what the company already decided
// and can build on it instead of repeating themselves. The journal is in-memory (resets
// on restart); that's fine for the demo and keeps it dependency-free.
import { store } from "../lib/store";

export async function companyKpis(): Promise<string> {
  const [ids, actions, tasks] = await Promise.all([
    store.allProfileIds(),
    store.listActions({ limit: 100 }),
    store.listTasks({}),
  ]);
  const by = (s: string) => actions.filter((a) => a.status === s).length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  return [
    `students=${ids.length}`,
    `agent_actions(last100): executed=${by("executed")}, awaiting_human_approval=${by("pending_approval")}, logged_only=${by("dry_run")}, rejected_by_eval=${by("rejected")}`,
    `tasks: open=${openTasks}, done=${doneTasks}`,
  ].join("; ");
}

interface JournalEntry {
  ts: string;
  agent: string;
  summary: string;
}

const journal: JournalEntry[] = [];
const MAX = 60;

export function recordDecision(agent: string, summary: string): void {
  if (!summary?.trim()) return;
  journal.unshift({ ts: new Date().toISOString(), agent, summary: summary.trim().slice(0, 280) });
  if (journal.length > MAX) journal.length = MAX;
}

// A compact "what the company has recently decided/done", for prompt continuity.
export function recentDecisions(n = 5): string {
  if (journal.length === 0) return "(no prior decisions on record yet)";
  return journal
    .slice(0, n)
    .map((e) => `- ${e.ts.slice(5, 10)} ${e.agent}: ${e.summary}`)
    .join("\n");
}

export function getJournal(n = 30): JournalEntry[] {
  return journal.slice(0, n);
}
