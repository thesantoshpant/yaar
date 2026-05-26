# Yaar — Autonomous Build Plan & Log

Founder is asleep (~8h from 2026-05-26). I'm building Yaar to win the Build with Gemini XPRIZE,
acting as the founder. Free hand. Safe checkpoint: `main` @ `d696aec`. Work branch: `yaar-autobuild`.

## Principles
- Stay green: every commit must pass backend `tsc --noEmit` and frontend `npm run build`.
- Commit per working unit. No Claude co-author. Never push.
- Failproof: graceful mocks everywhere; an API or key being absent must never crash a page.
- Think student POV (rural first-gen, urban, aid-dependent, grad) AND parent POV.
- Lean on real Gemini/Vertex intelligence and the per-user memory as the MOAT.
- Skip anything needing the founder: live Stripe, real email provider keys, new cloud accounts.

## Backlog (priority order) — update status as I go
1. [x] Agentic-company dashboard + visible agent-to-agent conversation. DONE (boardroom + Company HQ page).
2. [x] Parent mode FULLY DONE. Backend (report any language + shareable link) + frontend (student page /app/parent to generate/translate/share, public /parent/:token no-login view, shared ParentReportView).
3. [x] Persona demo seeds DONE. 3 sample students (rural first-gen Ramesh, urban grad Aditya, aid-dependent Sita); each seeds a full profile + 22-24 memory facts + a logged activity + consolidated mind. GET /api/profile/personas, POST /api/profile/seed-persona. PersonaPicker on Dashboard (shown when no profile). Verified: briefs accurate per persona.
4. [x] Deepen intelligence DONE. companyIntel.ts: real KPIs (students, action breakdown, tasks) + a decision journal so agents recall/build on prior decisions (wired into boardroom, runEmployee, orchestrate). Plus a student "what-if" simulator (POST /api/whatif, read-only, memory-grounded) with a WhatIf card on the Dashboard. Verified live (source=gemini, persona-aware).
5. [ ] UI/UX polish pass + accessibility + landing story tightening.
6. [ ] Voice mode (Gemini Live) for the visa interview (text+TTS solid; live audio scaffolded). Browser-only verify.
7. [ ] Email engagement (graceful/simulated until a provider key exists) + weekly digest from memory.
8. [ ] Smoke-test/eval harness committed for failproofing + a judges' demo script.

## Log (newest first)
- 2026-05-26: Item 4 DONE. (a) companyIntel.ts: real KPIs + in-memory decision journal wired into all agent paths so agents reference prior decisions; verified Analytics cites "17 students" and CEO references the open-task backlog. (b) What-if simulator: POST /api/whatif (read-only, memory-grounded) + WhatIf card on Dashboard (shows on a plan); verified persona-aware (knew Ramesh's full-scholarship need at $5k). Frontend builds (451KB). Next: item 5 (UI/UX polish + landing story).
- 2026-05-26: Item 3 DONE. Persona demo seeds (3 sample students) + PersonaPicker on Dashboard. Backend seeds rich profile+memory+evidence+consolidated mind; verified briefs accurate. Frontend builds (449KB). Next: item 4 (deepen agent intelligence: richer KPIs + per-agent memory/journal + what-if simulator).
- 2026-05-26: Item 2 FULLY DONE. Parent-mode frontend: /app/parent (pick language, generate, copy share link) + public /parent/:token no-login view + shared ParentReportView + nav "For parents". Frontend builds (447KB). Next: item 3 persona demo seeds.
- 2026-05-26: Item 1 FULLY DONE (Company HQ dashboard frontend built: org chart, live boardroom transcript thread, action queue, autonomy badge; ops client with admin-token support). Item 2 backend DONE + verified (parent report in English & Nepali via Vertex, source=gemini, stateless shareable link roundtrips). Both committed, frontend builds (440KB). Next: item 2 frontend (parent page + public share view), then item 3 persona seeds.
- 2026-05-26: Item 1 backend DONE. Built agentBoardroom.ts: CEO opens -> 5 dept heads contribute in sequence (each reads the discussion, references colleagues by name) -> CEO synthesizes decision + tasks -> eval/QA reviews. Routes actions through the gateway. Exposed at POST/GET /api/ops/boardroom. Verified live: real grounded multi-agent convo, source=gemini, eval approved. Next: frontend Company dashboard to visualize it.
- 2026-05-26: Branched yaar-autobuild from main d696aec. Wrote this plan. Starting item 1.
