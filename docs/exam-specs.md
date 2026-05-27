# IELTS & TOEFL — buildable mock-test spec (verified 2024-2026)

Source of truth for the mock-test engine. Verified against ielts.org / British Council / IDP
and ets.org. We build IELTS Academic and the TOEFL "classic" (2023, 0-120) format — the one
students and universities still recognize. (TOEFL's Jan-2026 adaptive 1-6 format is noted but
not the primary build: it needs adaptive routing + phonetic scoring.)

## IELTS Academic (bands 0-9)
- **Listening** — 4 parts, 40 Q, ~30 min, audio plays once. Types: form/note/table completion, MCQ, matching, map/diagram labelling, sentence completion, short-answer.
- **Reading** — 3 passages (2150-2750 words total), 40 Q, 60 min. Types: True/False/Not Given, Yes/No/Not Given, matching headings, MCQ, sentence/summary completion, matching information.
- **Writing** — Task 1 (>=150 words, ~20 min: describe a chart/process, no opinion) + Task 2 (>=250 words, ~40 min: opinion/argument essay). Task 2 weighted 2x. Criteria (each 0-9): Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
- **Speaking** — Part 1 interview (4-5 min), Part 2 cue card (1 min prep + ~2 min talk), Part 3 discussion (4-5 min). Criteria (each 0-9): Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- **Raw->band (L & Academic R, /40, approx):** 9.0=39-40, 8.5=37-38, 8.0=35-36, 7.5=33-34, 7.0=30-32, 6.5=27-29, 6.0=23-26, 5.5=19-22, 5.0=15-18, 4.5=13-14, 4.0=10-12.
- **Writing band** = (Task1 + 2*Task2)/3 rounded to nearest 0.5. **Speaking band** = avg of 4 criteria, nearest 0.5.
- **Overall** = average of the 4 section bands; round .25 up to half band, .75 up to whole band.

## TOEFL iBT — classic format (sections 0-30, total 0-120)
Order: Reading -> Listening -> Speaking -> Writing.
- **Reading** — 2 passages (~700 words), 20 Q, 35 min. Types: factual, negative-factual, inference, rhetorical-purpose, vocabulary, reference, sentence-simplification, insert-text, prose-summary (pick 3 of 6, worth 2).
- **Listening** — 2 conversations (5 Q each) + 3 lectures (6 Q each) = 28 Q, ~36 min, audio once, notes allowed. Types: gist-content/purpose, detail, function, attitude, organization, connecting-content, inference.
- **Speaking** — 4 tasks, ~16 min. T1 independent (15s prep/45s speak); T2 integrated read+listen campus (30s/60s); T3 integrated read+listen academic (30s/60s); T4 integrated listen-only (20s/60s). Each task 0-4 on Delivery, Language Use, Topic Development.
- **Writing** — Integrated (read + lecture + write, 20 min, ~150-225 words, 0-5) + Academic Discussion (read prompt+posts, write >=100 words, 10 min, 0-5).
- **Scaled scores:** Reading/Listening raw -> `round(30 * raw/maxRaw)` with a mild top-end curve. Speaking = avg(4 task 0-4) * 7.5. Writing = avg(2 task 0-5) * 6. **Total** = sum of 4 (0-120). Bands: 100+ top university, 80-99 mid, 60-79 lower; per-skill 26+ advanced.

## What we auto-generate + auto-score
- Reading: Gemini generates passage + questions + answer key; objective auto-scoring (key match). Fully faithful.
- Listening: Gemini generates a transcript; the browser reads it aloud (speechSynthesis); objective auto-scoring. Single-play discipline + multi-voice are the effort.
- Writing: Gemini generates the task(s) and scores against the verbatim rubrics (formative estimate, not a certified score).
- Speaking: tasks generated; student records (MediaRecorder -> /api/transcribe -> Gemini); scored on the criteria from the transcript. Pronunciation/Delivery is approximate from transcript only — flag to the user.

## Adaptivity + memory + history (the core loop)
1. Each completed mock saves a **MockAttempt** (per-skill scores, per-question-type performance) -> history + trend.
2. We write durable facts to the student's mind (e.g. `ielts.reading.band`, `ielts.weak.inference`).
3. The next test reads those facts + recent attempts and **biases generation toward weak question types and the right difficulty** (target band/score), and feedback names what to drill. This is the "learns your patterns, strengthens weak parts" loop.

## Honesty
Always label AI scores as practice estimates, not official results, and note that pronunciation/delivery
scoring is approximate. Never guarantee a real-exam band.
