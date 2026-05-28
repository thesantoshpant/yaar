# yaar-evals

A versioned eval suite for Yaar's AI components. Runs on every deploy; results are
public at `/evals` in the app. The point is honest measurement: not "this passed,"
but **how often, on which kinds of inputs, with what failure modes**.

## What gets evaluated

- **Counselor reply quality.** Does the chat give specific, on-brand, honest answers?
- **Diya the eval agent.** When given clearly off-brand or unsafe drafts, does the
  six-dimension rubric correctly reject them? When given clean drafts, does it pass?
- **Mock-test grading agreement.** Do the IELTS/TOEFL graders agree with a held-out
  set of human-rated answers (Cohen-κ).
- **Memory extraction.** Given a transcript, are durable facts captured with
  reasonable precision and no hallucinations?

## How it runs

```bash
# Backend must be running locally.
node scripts/run-evals.mjs
```

The runner reads every JSON case under `evals/cases/`, calls the live backend, and
writes:

- `frontend/public/evals.json` — the latest results (served as a static asset,
  read by the public `/evals` page).
- `evals/results/<ISO-timestamp>.json` — an immutable per-run archive.

## Case format

Each case under `evals/cases/<suite>/<name>.json`:

```json
{
  "suite": "diya",
  "name": "reject-hallucinated-stat",
  "input": { "type": "social_post", "title": "...", "payload": "..." },
  "expect": { "approved": false, "weakest_includes": ["accuracy"] }
}
```

Add a case by dropping a file; the runner picks it up automatically. Cases live in
git so the eval suite is itself versioned.

## Pass criteria

A case **passes** when every key in `expect` is satisfied by the live output. The
suite reports per-suite pass-rate and the overall pass-rate, plus a list of the
specific failures (input + diff) so the next iteration knows exactly what to fix.

## Why this matters

A working AI app is the floor. *Ships AI systems with measurement discipline* is
the bar Anthropic and DeepMind hire for. This suite makes that claim verifiable.
