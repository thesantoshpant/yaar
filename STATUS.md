# Yaar build status

Autonomous build session, May 25, 2026. Stack: React + Vite + TS + Tailwind (frontend), Node + Express + TS
via tsx (backend), Gemini for AI, MongoDB (with in-memory fallback), College Scorecard (with mock fallback).

## What works right now (verified)

- Backend builds (tsc --noEmit passes) and runs (`npm start`), confirmed listening on :4000.
- Frontend builds (`npm run build` passes, Tailwind purged to ~23kB CSS).
- All API endpoints smoke-tested in mock mode and returning correct shapes:
  - GET /api/health -> mode flags
  - POST /api/agent/plan -> autonomous next-best-action (the USP brain)
  - POST /api/counselor/chat -> counselor reply
  - POST /api/roadmap -> personalized roadmap
  - POST /api/schools/search -> balanced reach/match/safety list
  - POST /api/visa/next and /api/visa/score -> interview turns + scoring
  - POST /api/speaking/score -> speaking band + criteria
  - POST /api/applications/draft -> SOP / Common App essay draft
- Visa simulator accepts optional document context (paste I-20 / funding): the AI officer probes
  inconsistencies against it. This is the differentiator, working in text form today.
- Frontend pages built and wired to the backend: Landing, Dashboard (autonomous brain),
  Counselor, Roadmap, School search, Applications, Speaking practice, Visa simulator.
- The whole thing runs with NO API keys (mock mode), so it is demoable immediately.

## Personal intelligence + proactive engagement (added, verified live with Gemini + MongoDB)

The system now adapts to each student and proactively guides them, not just answers on demand.

- Persona classifier (`lib/classify.ts`): deterministic, turns a profile into an adaptive JourneyState
  (path, persona tags, pacing, stages). Verified: a rural first-gen Nepal student is classified
  `UG_RURAL_BOOTSTRAP`, patient pacing, tags rural_first_gen + aid_dependent + strong_stem_weak_english.
- Per-student memory: `memory_facts` + `events` collections, a context-pack (`services/contextPack.ts`)
  injected into the counselor and the agent brain so every reply is personal and continuous, plus
  fire-and-forget fact extraction after each chat (`services/memoryUpdate.ts`).
- Opportunity engine (`services/opportunityEngine.ts` + `data/opportunities.ts`): a seeded, verified set of
  free/low-bandwidth opportunities incl. self-startable "manufacture-an-extracurricular" initiatives; a gap
  analyzer + scorer + diversify picks a personalized weekly drop with a Gemini "why this fits you" + first step.
  Verified live: produced GSoC, MOSTEC, Kaggle, and a "build a GitHub project" initiative for the rural student.
- Proactive engagement (`services/engagement.ts` + `services/scheduler.ts`): node-cron weekly drop + twice-daily
  follow-up sweep ("did you do it?"); an Inbox the student reads; action items tracked; marking one done emits a
  celebration and a timeline event. The "Run my updates now" button triggers a drop on demand.
- New endpoints (all smoke-tested live): GET /api/journey/:id, POST /api/engine/run-now/:id,
  GET /api/engine/inbox/:id, PATCH /api/engine/inbox/:id/read, PATCH /api/engine/action/:id, POST /api/engine/followups.
- New frontend: persona intake on the Dashboard, an "Updates" page (the proactive feed) with run-now + follow-up
  buttons, and an unread badge in the nav.
- New collections: journeys, memory_facts, events, action_items, inbox_items (all with in-memory fallback).

## Trust, revenue, and auth (added after the external audit)

- Trust fixes: truthful visa-document privacy copy; Dashboard now PATCHes the backend profile on re-plan
  (not just first create); per-IP rate limiting on /api; school-search international-aid caveat; "New student" reset.
- Document-grounded visa RiskReport (the paid flagship), verified live: parses pasted I-20/admit/funding text via
  Gemini, extracts key fields, flags inconsistencies (e.g. funding below I-20 cost), scores readiness 0-100 with
  per-214(b)-dimension scores, weak points, and a recommendation. New models Document + RiskReport; route
  POST /api/risk/report (+ GET /api/risk/latest/:id); UI panel on the Visa page. Anonymous try-it path supported.
- Stripe (graceful): POST /api/billing/checkout + /confirm + /status. When STRIPE_SECRET_KEY is absent the report is
  unlocked for free; when present, the report returns a locked preview until paid, with an "Unlock full report"
  button that runs Stripe Checkout and confirms on return. Entitlements are in-memory for now (persist later).
- Google sign-in (graceful): POST /api/auth/google verifies the Google ID token (google-auth-library) and issues a
  JWT; GET /api/auth/me; User model. Frontend uses @react-oauth/google behind VITE_GOOGLE_CLIENT_ID; the client
  attaches the Bearer token. With no client id, the app runs in guest mode (sign-in hidden). Auth is additive and
  not yet enforced on routes; full per-user data scoping is the next step.
- /api/health now reports billing and auth mode. New env vars in .env.example (GOOGLE_CLIENT_ID, JWT_SECRET,
  STRIPE_SECRET_KEY, STRIPE_PRICE_USD, PUBLIC_URL; frontend VITE_GOOGLE_CLIENT_ID).

## Backend hardening + new features (this session, verified live)

- Robustness: centralized async error handling (`express-async-errors` + `lib/errors.ts`), a clean 404 for
  unmatched API routes, consistent error JSON (no stack leaks), and process-level guards so a thrown error
  never crashes the server. Verified: bad input returns a 400 validation error, unknown routes return 404.
- Centralized, strengthened system prompts in `lib/prompts.ts` (shared principles + expert, safety-aware
  prompts for counselor, agent brain, roadmap, visa officer, visa scoring, and the risk report). Core routes
  rewired to use them.
- New endpoints (all Gemini + mock fallback, smoke-tested live):
  - `POST /api/coach/recommender` — recommender request message, brag sheet, project summary, logistics.
  - `POST /api/coach/funding` — cost-of-attendance + sponsor story + computed funding gap + parent explainer.
  - `POST /api/coach/milestones` — grade 9-12 term-by-term milestone plan (the parent-program product).
  - `POST /api/coach/f1-status` — informational F-1 status guidance with a mandatory "check your DSO" note.
  - Evidence Vault: `POST /api/evidence`, `GET /api/evidence/:profileId`, and
    `POST /api/evidence/:profileId/summarize` (turns logged activities into Common App activity lines + an essay paragraph).
- Seeded graduate-level opportunities (GRE prep, professor outreach, assistantship search, research contribution)
  so grad applicants get real matches.
- Stripe entitlements now persist to MongoDB (`entitlements` collection) instead of in-memory, so paid access
  survives restarts.

## Agentic company (Phase 0 foundation, verified live in dry-run)

Yaar is being built to run itself with AI "employees", in addition to serving students.

- Autonomy mode (`YAAR_AUTONOMY_MODE`): `dry_run` (default, logs only) | `assist` (outbound actions queue for human approval) | `live` (executes). Surfaced in `/api/health`.
- Action Gateway (`lib/actionGateway.ts`): the single chokepoint for every real-world action. Internal actions
  (drafts, tasks, reports) execute immediately; external actions (social, email, WhatsApp, support replies) are
  logged-only in dry_run, queued for approval in assist, and executed (via integrations, when wired) in live.
  Real integrations (Resend, Twilio/WhatsApp, X/Meta) are stubbed/simulated until keys are added.
- Org registry (`lib/org.ts`): a company brain + employees — CEO/chief-of-staff, analytics, content marketer,
  customer care, growth/outreach — each with a mission, role prompt, cadence, and a hard allow-list of action types.
- Runtime (`services/companyAgents.ts`): builds an employee's prompt from the org + KPIs, asks Gemini what to do,
  and routes each proposed action through the gateway (enforcing the allow-list). `companyStandup()` runs the
  always-on employees; wired to a daily cron (honors autonomy mode, so safe in dry_run).
- Ops console (`routes/ops.ts`): GET /api/ops/org, POST /api/ops/run/:employeeId, POST /api/ops/standup,
  GET /api/ops/actions, GET /api/ops/approvals, POST /api/ops/actions/:id/{approve,reject}.
- Verified live (dry_run): agents produced on-brand proposals; internal actions executed, external actions held.
- Next for this layer: protect /api/ops with admin auth; wire real integrations behind the gateway; add spend caps
  + per-channel rate limits; add the inter-agent task board and the eval/QA agent before any `live` use.

## Agentic company Phase 1 (guardrails + email + orchestrator, verified live in assist mode)

- Admin auth on the ops console (`lib/adminAuth.ts`): open in dry_run for dev; once autonomy != dry_run an
  `ADMIN_TOKEN` is required (verified: 401 without it). Applied to all `/api/ops` routes.
- Spend/rate caps in the gateway: a daily external-action cap and a daily agent-run cap (cost control), both env-tunable.
- Eval/QA agent (`services/evalAgent.ts`): every outbound action is vetted for honesty, brand-safety, and
  compliance before it can queue (assist) or execute (live). Failures are recorded as "rejected" with a reason.
- Real email integration (`lib/email.ts`, Resend via REST, graceful): the gateway executor sends email for
  email/support actions when keys are set, and simulates otherwise. Social/WhatsApp remain stubbed.
- CEO orchestrator + inter-agent task board (`CompanyTask` model + `orchestrate()`): the CEO sets tasks per
  department, then each department's agent works its task, routing any outbound through the gateway. Endpoints:
  POST /api/ops/orchestrate, GET /api/ops/tasks, plus approve/reject on queued actions.
- Verified end-to-end in assist mode: admin auth enforced; CEO created tasks -> departments worked them (tasks
  done); external actions passed eval and queued; approving executed (email simulated), rejecting closed them out.
- Before `live`: add real social/WhatsApp integrations (with approved templates), per-recipient consent/opt-in,
  and wire `ADMIN_TOKEN` + `RESEND_*`. The plumbing and guardrails are all in place.

## Still open (priority order)
1. Enforce auth + scope all data by userId (auth is wired but not enforced yet).
2. Persist Stripe entitlements (currently in-memory) and add a webhook for reliability.
3. Real binary file upload (PDF/image) + Gemini multimodal extraction for the risk report (text paste works today).
4. Privacy policy, consent, and delete-my-data path before real users.
5. Wave 2/3 from the plan: Gap + EvidenceArtifact models, recommender coach, family/funding coach, Safe Arrival OS,
   F-1 Status Guard (informational), School Truth Layer, WhatsApp channel. Seed grad-level opportunities.

## How to run

See README.md. Short version: `npm install` then `npm run dev` in both `backend/` and `frontend/`.

## What is stubbed or needs work next

1. Gemini Live voice (services/geminiLive.ts) is a scaffold. It needs a real GEMINI_API_KEY, an audio-capable
   Live model, and a browser audio pipeline (mic capture -> 16kHz PCM over WS -> play 24kHz PCM back). The
   visa and speaking modules currently use the fully working text-turn fallback.
2. Real keys not yet added. Drop GEMINI_API_KEY and COLLEGE_SCORECARD_API_KEY into backend/.env to go live.
3. No auth yet. Profiles are created but there is no login. Add auth before real users.
4. MongoDB models: only Profile exists. Add Journey/Session, scores history, and documents collections.
5. Applications essay drafting agent is built (SOP + Common App). Still to add: recommender management,
   deadline/portal tracking, and a dedicated I-20 financial-doc organizer (Finances still routes to chat).
   Visa doc-grounding is text-paste today; next step is real file upload + Gemini multimodal extraction.
6. Payments (Stripe) not wired. Needed for the XPRIZE revenue evidence.
7. Document upload + multimodal grounding (parse a real I-20 / bank statement to ground the visa mock) is the
   key differentiator and is not built yet.
8. Voice capture UI, security review of PII handling, and rate limiting.

## Suggested next priorities (when you are back)

1. Add a GEMINI_API_KEY and confirm live JSON generation across roadmap / visa / speaking / agent.
2. Build the document-grounded visa mock (upload I-20 + bank doc, Gemini multimodal extracts, the officer
   probes inconsistencies). This is the wow feature and the moat.
3. Wire Stripe so the speaking and visa packs can take real payments (revenue evidence for the submission).
4. Stand up MongoDB Atlas and add the Journey model so progress persists per student.
