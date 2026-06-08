# Yaar — Demo & Setup Guide

**Yaar is an autonomous, structurally unbiased AI counselor that takes an international
student from their hometown to a US degree and an approved F-1 visa, and it's run by a
team of AI employees.** No human agents, no school commissions, so its only incentive is
the student's best outcome. It remembers each student, adapts to very different journeys,
and even keeps their parents in the loop in their own language.

## Why it can win
- **Memory MOAT.** A per-student "mind" (MongoDB) is built from every chat, document, and
  win, and feeds every feature, so advice compounds instead of resetting.
- **Fully autonomous company.** AI employees (CEO, analytics, marketing, growth, support,
  and a dedicated Memory agent) meet, debate, decide, and act through an Action Gateway
  with a human-approval valve and an eval/QA reviewer.
- **Honest + unbiased by construction.** Document-grounded visa risk reports, balanced
  school lists ranked on real outcomes (US Dept of Education data), never pay-to-rank.
- **Real Gemini, end to end.** Runs on Vertex AI; multimodal document understanding,
  per-feature personalization, and multi-agent reasoning.

## Run it locally
1. **Backend:** `cd backend && npm install && npm run dev` (listens on :4000).
   - Copy `backend/.env.example` to `backend/.env`. The app runs WITHOUT keys (mock mode).
     For live AI either set `GEMINI_API_KEY`, or use Vertex AI with
     `GEMINI_USE_VERTEX=true`, `GOOGLE_CLOUD_PROJECT`, and
     `GOOGLE_APPLICATION_CREDENTIALS` (a service-account JSON).
   - Optional: `MONGODB_URI` (else in-memory), `COLLEGE_SCORECARD_API_KEY` (live school
     data), `GOOGLE_CLIENT_ID` + `JWT_SECRET` (sign-in), `RESEND_API_KEY` + `RESEND_FROM`
     (real email; otherwise emails are simulated).
2. **Frontend:** `cd frontend && npm install && npm run dev` (Vite on :5173).
   - Optional `frontend/.env` with `VITE_GOOGLE_CLIENT_ID` to enable the sign-in gates.
3. Open `http://localhost:5173`.

## Health check
`node scripts/smoke.mjs` (with the backend running) hits every key endpoint, asserts the
responses, and prints whether each AI feature is live (`gemini`) or `mock`. Exit code is
non-zero if anything fails, so run it right before a demo.

## 3-minute judge demo script
The student app is four screens — **Ask Yaar** (`/app`), **Practice** (`/app/practice`),
**Visa** (`/app/visa`), **For parents** (`/app/parents`) — plus an off-nav Settings (gear)
and an off-nav Company console.

1. **Land + the story (15s).** Open `/`. The honest pitch: "I work for you, not for any
   school" — no agents, no commissions.
2. **Ask Yaar, the front door (30s).** Go to `/app`. Tap a fear ("Can I actually get in?")
   or type a real question. Yaar answers honestly, and the chat itself is the intake: it
   silently builds a per-student memory (no form to fill). Hit the speaker icon on a reply
   to hear it read aloud.
3. **Visa — the flagship (45s).** Open **Visa**. Walk the guided flow: upload an I-20 or
   bank letter (Gemini reads the PDF/photo and flags real issues — cost vs. funds, missing
   sponsor, wrong I-20 type), see the readiness ring, answer a few mock-interview
   questions, then generate the **Visa Pass** and share it (WhatsApp / save image). Free,
   like everything else.
4. **Practice — a real, scored mock (30s).** Open **Practice**. Generate a fresh IELTS or
   TOEFL section (try Writing), submit, and get a banded score with a verbatim quote and a
   concrete fix per criterion. Share the **Mock Card**.
5. **For parents (25s).** Open **For parents**, pick a language (try Nepali), generate the
   update, copy the share link, and open it (`/parent/:token`) in a new tab: a no-login,
   plain-language report a parent actually understands.
6. **Under the hood — the autonomous company (35s).** It's off the student nav: open
   `/app/company` directly (on a deployed instance with `ADMIN_TOKEN` set, paste the token
   when prompted). Run a boardroom on a real topic and watch the CEO open, departments
   debate by name, decisions become tasks, and the eval/QA agent review — with the action
   queue and autonomy mode (dry-run/assist/live) visible. `/pulse` shows the live
   spend/kill-switch dashboard.

## Notes
- Branch `yaar-autobuild` holds the autonomous build; `main` is the pre-session checkpoint.
- Secrets (`.env`, `credentials/`, the sample I-20) are gitignored and never committed.
- Voice mode (Gemini Live) is scaffolded; see AUTONOMOUS_PLAN.md for status.
