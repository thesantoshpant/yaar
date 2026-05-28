# Grader-agreement study (yaar-evals)

A held-out study of how often Yaar's IELTS/TOEFL writing grader agrees with
published human bands. The methodology is what matters for the resume signal:
not "I built a grader," but "I built a grader and here is how wrong it is, on
inputs I did not write."

## What the runner reports

For each case:
- The published human band (the ground truth).
- N independent grader calls (default 3) for test-retest stability.
- The grader's mean band, standard deviation across runs, and absolute error
  vs the published band.

Aggregated across the suite:
- **MAE**: mean absolute error vs published bands.
- **Within-1-band rate**: % of cases where |grader_mean − published| ≤ 1.0.
- **Mean test-retest SD**: how reproducible the grader is on the same essay.

A case is reported as "passed" if its mean error ≤ 1.0 band.

## Case format

```json
{
  "suite": "grader",
  "name": "task2-band-7-balanced",
  "exam": "IELTS",
  "skill": "writing",
  "taskType": "ielts_task2",
  "published_band": 7.0,
  "source": "British Council teaching sample — task description",
  "prompt": "Some people think... To what extent do you agree or disagree?",
  "essay": "It is often argued that ...",
  "runs": 3
}
```

## Honest limits of the starter set

The cases checked in here are **an illustrative starter set**, not a held-out
Cambridge sample. To make the study credible for a senior reviewer:

1. Replace these essays with 20+ scripts from the Cambridge IELTS book series
   (1-19) or ETS Official Guide TOEFL samples. Each comes with an examiner-
   assigned band score and rationale.
2. Re-run the suite (`node scripts/run-evals.mjs`) and publish the new MAE +
   within-1-band rate on `/evals`.

The harness already handles 20-100 cases without changes; only the data needs
extending. That swap is what turns this from "demonstrated methodology" into
a real grader-agreement claim a staff engineer can press on.
