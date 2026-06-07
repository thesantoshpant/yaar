# Yaar — Redesign Brief for Google Stitch

Paste the relevant sections of this into Google Stitch to generate screens. The goal of
this redesign is one word: **simple**. The current app has ~24 pages and a 10-item
sidebar; it looks like software, and a stressed 17-year-old freezes and leaves. We are
collapsing it to **4 places and one obvious first action**, and making it feel like
messaging a friend, not operating a dashboard.

---

## 1. What Yaar is (so the design serves it)

Yaar is a **free** AI counselor for South Asian students (Nepal, India, Bangladesh)
trying to get into a US university and pass the F-1 student visa interview. No payment,
no human agents, no school commissions. It works for the student, never for schools.

**The user:** 16–22, often the first in their family to do this, sometimes rural with a
**shared phone and weak internet**. They are **scared and skeptical of "another AI app."**
They came with exactly three fears:
1. Can I actually get in?
2. Can I afford it?
3. Will I pass the visa interview?

**Design implications, non-negotiable:**
- **Mobile-first.** Most users are on a phone. Design the phone screen first; desktop is the afterthought.
- **Light and fast.** Assume a slow 3G connection on a cheap Android. No heavy hero animations, no autoplaying anything, minimal images.
- **Warm, human, calm.** It should feel like a kind older sibling who has done this, not a consultancy or a bank.
- **Trustworthy without a human face.** The founder is anonymous, so the design itself must earn trust: honest, plain, no hype, no fake urgency.

---

## 2. The anti-"AI-made" rules (read this twice)

The friend's feedback was "the UI looks like AI made it — too complex." That look comes
from specific tells. **Avoid all of these:**

- ❌ **Bento-grid dashboards** with many cards of different sizes competing for attention.
- ❌ **Three things on one screen** all saying "start here" (a card + a stepper + a simulator).
- ❌ **Gradient-on-gradient**, glowing radial backgrounds behind every card.
- ❌ **A fact-dump** the AI shows about the user ("here are 14 facts I extracted about you").
- ❌ **Streaks, sparklines, "Wrapped"** and other gamification bolted onto a once-in-a-lifetime task.
- ❌ **Emoji in every heading**, badges on every element, a "live" pulse dot on everything.
- ❌ Long marketing landing pages with 8 animated sections.

**Do this instead:**
- ✅ **One clear thing per screen.** A screen should answer one question.
- ✅ **A single accent color** used sparingly for the one primary action.
- ✅ **Lots of plain whitespace**, generous line height, short sentences.
- ✅ **Chat as the primary metaphor** — most interaction is conversational, not form-filling.
- ✅ **Plain language** everywhere: "Practice your visa interview," not "F-1 214(b) Simulator."
- ✅ Buttons that say what happens: "Check my visa readiness," "Ask Yaar."

---

## 3. The new information architecture (only 4 places)

The bottom nav (mobile) / sidebar (desktop) has **exactly four items**:

| # | Nav label | What it is | Replaces / absorbs |
|---|---|---|---|
| 1 | **Ask Yaar** | The chat. This is the home screen (`/app`). Opens with a warm line and 3 big taps for the 3 fears. Intake happens conversationally inside the chat, not via a form. | Dashboard form, Counselor, Mind page, what-if, roadmap, school search, SOP/essay, coaches — all become things the chat does or opens. |
| 2 | **Practice** | Take a scored IELTS/TOEFL section (reading, listening, writing, speaking) and see your last few scores + weak areas. | Mock test + standalone Speaking page + Progress page. |
| 3 | **Visa** | The flagship. One guided flow: paste/upload your I-20 + funding → get an honest readiness score and flagged weak points → practice a mock interview drilling those → get a shareable "Visa Pass" card. | Visa simulator + risk report + Visa Pass. |
| 4 | **For parents** | Generate a warm, plain-language update for parents in their language, with a no-login share link. | (kept; it's a genuine trust + growth feature) |

Everything else (Company HQ, Wrapped, Mock Card, persona picker, evidence vault) is
**removed from the student app**. A single tiny **Settings** link (not a nav item) holds
the "Delete everything Yaar knows about me" control and a one-line privacy explainer.

---

## 4. Design system direction

Keep the existing **warm, South-Asian-rooted identity** (it's good), but simplify how it's used.

**Color** — one warm primary, one calm secondary, lots of cream/white, used sparingly:
- **Primary (action): Marigold / Saffron** `#F4A300` with dark text on it. The ONE color for the main button on a screen.
- **Secondary (calm/trust): Deep Teal** `#216867`. For quiet accents, links, the parent feature.
- **Background: Warm cream** `#FCF8FF` (very near white, paper-like, not harsh).
- **Text: Near-black plum** `#1A1A2E`.
- **Success: green** `#1FA37A`, **Warning: amber**, **Danger: soft red** `#BA1A1A` — used only where meaning requires.
- Support a simple **dark mode** (students study at night on low brightness).
- **Rule:** at most ONE accent color visible per screen section. No rainbow of badges.

**Type** — friendly, readable, not corporate:
- Headings: **Plus Jakarta Sans**, bold, tight tracking.
- Body: **Be Vietnam Pro** (or Inter), 16px+, line-height 1.5–1.6. Long counselor answers must stay easy to read.
- Keep headings short. No 48px hero text on mobile.

**Shape & depth** — soft and approachable:
- Rounded corners: 16px on cards/inputs, pill-shaped buttons and chips.
- Depth from **very soft, low-opacity shadows + a 1px ghost border**, not heavy drop shadows or glows.
- **No glowing radial gradients behind cards.** Flat warm surfaces.

**Motion** — almost none:
- Skip page-transition animations entirely (they hurt low-end phones and read as "AI demo").
- Allow only tiny, optional feedback (a button press state, a typing indicator in chat).

---

## 5. Screen-by-screen prompts for Stitch

Generate each as a **mobile screen first**, then a desktop variant. Use the design system above.

### Screen A — Ask Yaar (home / chat) ⭐ most important
> A clean mobile chat screen for a free AI study-abroad counselor called Yaar, for a South
> Asian student. Warm cream background, one marigold accent. At the very top, a short
> friendly greeting: "Hi, I'm Yaar. I work for you, not for any school. What's worrying you
> most right now?" Below it, **three large, tappable cards stacked vertically** (not a grid),
> each one a real fear in plain words: "Can I actually get in?", "Can I afford this?", "Will I
> pass the visa interview?". Below those, a normal chat input pinned to the bottom with a
> friendly placeholder ("Ask Yaar anything…") and a send button. Minimal, lots of whitespace,
> no sidebar clutter, feels like WhatsApp, not a dashboard. A small bottom nav bar with 4
> icons: Ask Yaar (active), Practice, Visa, For parents. A tiny "Report a problem" and
> "Settings" link reachable but not prominent.

Also generate the **active conversation state**: the same screen mid-chat, with the
student's message bubbles (right, plain) and Yaar's replies (left, warm), a subtle typing
indicator, and the input at the bottom. No fact-dump, no side panels.

### Screen B — Visa (the flagship flow) ⭐
Generate this as a **short guided sequence of mobile screens**, one step per screen:
> Step 1 — "Check your visa readiness": a calm screen that asks the student to upload or
> paste their I-20 and funding details, with a reassuring line: "Yaar reads it the way a
> visa officer would. Your documents are never saved." One big marigold button: "Check my
> readiness." Plain, not scary.
>
> Step 2 — the readiness result: a single clear **score out of 100** at the top (a simple ring
> or bar, not a busy chart), then a short honest summary, then a tidy list of "What an officer
> will push on" with each weak point as a simple row. One button: "Practice these in a mock
> interview."
>
> Step 3 — mock interview: a chat-like screen where an AI consular officer asks one question
> at a time. Terse, realistic, not chatty. The student types or speaks (a mic button) their
> answer. A small counter "Question 3 of 8."
>
> Step 4 — the Visa Pass card: a **screenshot-worthy, share-friendly card** (portrait, fits a
> phone screen / WhatsApp). Shows "Mock F-1 interview: 7/10" with a one-line verdict, 2 strong
> points, the student's first name, and a small "practiced free on Yaar" footer. Big buttons:
> "Share on WhatsApp" and "Save image." Designed to look great as a screenshot. No app chrome
> around it.

### Screen C — Practice
> A simple mobile screen titled "Practice." At the top, the student picks an exam (IELTS /
> TOEFL) and one of four skills (Reading, Listening, Writing, Speaking) as four plain tappable
> rows, not a grid of fancy cards. Below, a small quiet strip: "Your last 3 scores" with three
> simple band numbers. One marigold button: "Start a practice test." When a test is running,
> show one question at a time, a clear timer, and a plain "Submit" button. Results screen: a
> single band score, a short honest note, and the 1–2 weak areas to work on next. No streaks,
> no sparklines, no gamification.

### Screen D — For parents
> A warm mobile screen titled "An update for your parents." Short explainer: "Yaar writes a
> simple, honest update your parents can read in their own language. No login needed for them."
> A language dropdown (Nepali, Hindi, Bangla, English, …). One button: "Create the update."
> Result: a clean readable report card with a few plain sections (where they are, what's going
> well, what to watch, the money picture, how to help) and a big "Share link with my parents"
> button. Calm, trustworthy, no jargon.

### Screen E — Landing (public, short)
> A short, honest landing page for a free AI study-abroad counselor, mobile-first. One headline:
> "Your honest guide to US universities. Free, forever." One sub-line: "An agency charges
> 1.5 lakh. Yaar is free, and it never takes a cut from any school." One marigold button:
> "Start free — no signup needed." Below, just three short rows (not eight animated sections):
> "Practice your visa interview," "Get scored on IELTS/TOEFL," "Find out if you can afford it."
> A quiet footer with Privacy, Report a problem. No long marketing, no carousel, no fake
> testimonials. Calm, trustworthy, fast-loading.

### Screen F — Settings (tiny)
> A minimal settings screen: a short privacy line ("Yaar never sells your data and never shows
> ads."), a toggle for weekly email (off by default), and one quiet but clear red link: "Delete
> everything Yaar knows about me." Nothing else.

---

## 6. What to hand back to the implementer

When you've generated screens you like in Stitch, export them (or share the project), and
the engineer will pull them via the Stitch MCP and rebuild the React app against this 4-screen
structure. The cuts (removing Company HQ, Progress, Mind page, Wrapped, etc. from the student
app) happen during that rebuild — the code is preserved in git history, nothing is lost.

**One rule for the implementer and for Stitch:** if a screen feels busy, **remove something.**
The bar is "could a scared 17-year-old on a shared phone understand this in 5 seconds?"
