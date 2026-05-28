# Yaar

A free, fully autonomous AI counselor that takes an international student from their hometown to a US degree and an approved F-1 visa. No human agents, no school commissions, no bias.

Built solo for the **Build with Gemini XPRIZE**. The interesting part isn't the chat — it's the agentic infrastructure underneath: a multi-agent "Company HQ" with a risk-tiered Action Gateway, a six-dimension evaluator (Diya) that gates every external action, a typed long-horizon memory engine, and a public versioned eval suite that runs on every deploy.

Free forever. If it grows, it grows; if it's acquired, it's acquired; either way the product stays free.

---

## Live artifacts

- **`/evals`** — public yaar-evals dashboard. Every release runs the suite against the live backend and publishes the pass rate, by-suite bars, and per-case failure detail. Honest measurement, not vibe-check.
- **`/visa-pass`** — share-card endpoint. After a scored mock F-1 interview, students generate a screenshot-worthy verdict card. Payload encoded in the URL hash, so the link carries no server state and never sends PII to a backend.
- **`/api/ops/org`** — the named AI org (CEO, Arjun, Kabir, Aanya, Ravi, Maya, Leo, Sara, Diya, Memory). Each agent has a sharp single mission and a strict `allowedActions` whitelist.
- **`/api/ops/safety`** — kill switch + daily $8 Vertex spend cap + per-user $0.50 cap. The single non-negotiable guardrail before deploying autonomous agents to the public internet.

## Architecture, in one breath

```
 user / inbound -> Counselor / Mock / Visa / etc -> persistent memory (typed facts + timeline)
                                                                |
                  +--- agents propose actions ---+              v
                  |                              |     contextPack used everywhere
        CEO -> Arjun / Aanya / Ravi / ...        |
                  |                              v
                  +-------> Action Gateway (risk tier + Diya 6-dim eval + safety gate)
                                                |
                                                +-> dry_run | pending_approval | executed
                                                                                 |
                                                +-> Resend / Reddit / Twitter / Mongo
```

- **Gemini via Vertex AI** for every model call (text, JSON, neural TTS, transcription, multimodal vision on uploaded docs).
- **MongoDB** for persistent state (graceful in-memory fallback for demos with no DB).
- **Action Gateway** is the only door to the outside world. Internal actions free; external actions consult the safety gate, then Diya, then the autonomy mode (dry_run / assist / live), then a daily quota.
- **Safety service** maintains an in-memory rolling daily budget with per-call atomic decrement and a global kill switch flippable from `/api/ops/safety/kill`.
- **Per-user memory engine** keeps a typed `MemoryFact` store with supersede-by-key plus a `TimelineEvent` log, fed by every interaction via `recordActivity()`.

## What's measurable

| Claim | Verifiable at |
|---|---|
| Multi-agent ops with bounded autonomy | `GET /api/ops/org`, `POST /api/ops/boardroom`, `GET /api/ops/actions` |
| Six-dim brand-safety eval | `POST /api/eval/diya`, public `/evals` page |
| Versioned eval suite, runs on deploy | `scripts/run-evals.mjs`, `evals/cases/`, `evals/results/`, public `/evals` |
| Persistent typed memory | `GET /api/memory/:profileId`, `GET /api/progress/:profileId` |
| Adaptive IELTS/TOEFL grader across all four skills | `POST /api/mock/{reading,writing,listening,speaking}/score`, `/api/mock/history/:profileId` |
| Neural TTS for listening prep | `POST /api/tts`, `/api/mock/listening/:id/audio` |
| Safety gate + kill switch | `GET /api/ops/safety`, `POST /api/ops/safety/kill` |

## Quickstart

```bash
# backend
cd backend && npm install && npm run dev

# frontend (separate terminal)
cd frontend && npm install && npm run dev

# smoke (separate terminal, backend must be running)
node scripts/smoke.mjs

# eval suite
node scripts/run-evals.mjs
```

Works out of the box without any API keys — every AI call has a deterministic mock fallback. To run live: set `GEMINI_USE_VERTEX=1`, `GOOGLE_CLOUD_PROJECT=...`, and `GOOGLE_APPLICATION_CREDENTIALS=./sa.json`.

## The named AI org

| Agent | Role | Cadence | Allowed actions |
|---|---|---|---|
| CEO | Sets the week's one big bet | weekly | `internal_task`, `report` |
| Arjun | Nightly analyst memo | daily | `report` |
| Kabir | Weekly roadmap issues | weekly | `internal_task`, `report` |
| Aanya | One SEO article per day | daily | `draft_content` |
| Ravi | Reddit answers, where helpful | daily | `draft_content`, `social_post` |
| Maya | Cuts long content into social | on_demand | `draft_content`, `social_post` |
| Leo | Personalized outreach DMs | weekly | `email_campaign`, `internal_task` |
| Sara | Inbound student/parent triage | on_demand | `support_reply`, `internal_task` |
| Diya | Six-dim evaluator (eval/QA gate) | on_demand | `report` |
| Memory | Per-user mind synthesis | daily | `internal_task`, `report` |

Every external action proposed by any of them flows through Diya, then the Action Gateway, then the safety gate, before reaching anything real.

## Why this exists

International students from South Asia get bad advice from paid consultants who collect 15-25% commissions from the schools they recommend. The honest version of that workflow runs on Gemini for fractions of a cent per session. Yaar is the proof.

It is also the founder's resume project. If you're hiring AI / agent / founding engineers and want to verify the claims above, the live dashboards exist and the code is here. Start at `/evals`.

---

> Yaar is a coaching and information tool, not legal or immigration advice. Outcomes are never guaranteed.
