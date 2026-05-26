// Email integration (Resend, via REST so no SDK dependency). Graceful: if no key
// is configured, returns a simulated result so the gateway still works in dev.
import { config, hasEmail } from "../config";

export async function sendEmail(opts: { to?: string; subject: string; text: string }): Promise<string> {
  const to = opts.to || config.notifyEmail;
  if (!hasEmail || !to) {
    return `[simulated email] to=${to || "(no recipient configured)"} subject="${opts.subject}"`;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.resendFrom, to, subject: opts.subject, text: opts.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { id?: string };
  return `sent email id=${json.id ?? "?"} to=${to}`;
}
