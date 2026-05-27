# Yaar — Product Design Prompt

Design a modern, mobile-first product called **Yaar**, an honest, autonomous AI counselor that guides international students (starting in Nepal, India, Bangladesh, and South Asia) through the whole journey of studying in the US: planning, English test prep, school search, applications, finances, and the F-1 visa interview. "Yaar" means "buddy" or "close friend." The brand feeling is a warm, smart friend who has done this before, never an intimidating consultancy. Honest, hopeful, human, never salesy.

Use the design system below consistently across every screen so it feels like one product. Make every screen fully responsive and beautiful on a phone first, then scale up to desktop.

## Audience

Students aged 16 to 24, Gen-Z, often first-generation, usually on phones, sometimes on slow connections. The look must feel young, friendly, and trustworthy at the same time.

## Visual theme: "Warm Buddy"

Warm, South-Asian-inspired, modern, and the opposite of generic SaaS.

Colors:
- Primary, Marigold / saffron `#F4A300` (primary buttons, highlights)
- Secondary, Deep teal `#0E5C5B` (headers, sidebar, trust elements)
- Background, Warm cream `#FFF6E9` (app background, light and soft)
- Accent pop, Coral pink `#FF5C8A` (badges, streaks, playful highlights)
- Ink (text), Near-black plum `#1A1A2E`
- Support, soft marigold tint `#FFEFC9`, soft teal tint `#DCEDEC`, success green `#1FA37A`
- Dark mode, deep teal-navy background `#0E1B22` with cream text and the same accents glowing.

Typography:
- Headings: "Clash Display" or a bold, characterful geometric display font, tight tracking, large and confident.
- Body and UI: "General Sans" or a clean humanist sans, comfortable line-height, very readable.
- Big friendly numbers for stats and scores.

Shape and feel:
- Generous rounded corners (16 to 24px), pill-shaped buttons.
- Soft, layered shadows and a subtle 1px warm border on cards. No harsh lines.
- Plenty of whitespace and breathing room. Warm, cozy, optimistic.
- Tasteful emoji as friendly accents, one per card at most, never clutter.
- Gentle micro-interactions: fade-and-rise on load, soft hover lift on cards.
- Subtle warm radial gradients (marigold to coral) behind hero areas only.

Components to define once and reuse everywhere:
- Primary button: marigold pill, ink text. Secondary button: teal outline pill.
- Cards: cream or white, rounded-2xl, soft shadow, warm hairline border.
- Chips and badges: pill-shaped, tinted backgrounds (teal tint, marigold tint, coral tint).
- Progress bars: rounded, marigold-to-coral fill.
- Stat tiles: big number plus a small label.
- Chat bubbles: student bubble is white with ink text, Yaar bubble is a teal-to-marigold soft gradient with cream text.
- Skeleton loaders: soft cream shimmer for loading states.

## App layout (shared shell for all signed-in screens)

- Desktop: a fixed left sidebar (deep teal or cream) with the Yaar star logo, a "Signed in as {name}" chip, and a vertical nav list. The active nav item is a marigold rounded pill. Main content is centered, max width about 960px, on the cream background. A small "System" status card sits at the bottom of the sidebar.
- Mobile: a slim top bar (logo, theme toggle, hamburger) with a slide-in drawer holding the same nav, or a bottom tab bar with five key items (Home, Updates, Mind, Progress, Chat). Prefer the bottom tab bar on mobile for the most-used screens.
- A light and dark theme toggle lives in the top-right.

Nav items in order: Dashboard (home), Updates, Mind, Progress, Counselor (chat), Roadmap, School search, Applications, Coaches, Evidence vault, Speaking prep, Mock test, Visa simulator, For parents, Company.

---

## Screens

### 1. Landing page (marketing, logged-out)

Design the marketing landing page using the Warm Buddy theme. Mobile-first, plus a desktop version.
- Hero: warm cream background with a soft marigold-to-coral radial glow. A friendly badge pill that reads `"Yaar" means buddy. That's the whole idea.` A big Clash Display headline: "From your hometown to a US degree, with a buddy who never takes a cut." A subline about no agents, no commissions, an AI that runs your whole study-abroad journey. A primary marigold pill button "Start free, no card" and a teal outline button "Try a mock visa interview." A row of country chips: 🇳🇵 Nepal, 🇮🇳 India, 🇧🇩 Bangladesh, + South Asia.
- Beside the hero on desktop: a phone-style chat preview card showing a warm, casual conversation between a nervous student and Yaar (teal-marigold gradient bubbles).
- Sections below: "Built for students like you" (four persona cards with emoji: rural and first-gen, city kid big dreams, tight budget, already applying); a three-up "why Yaar is different" (does the work for you, zero bias and zero cut, same shot for everyone); a comparison table "Yaar vs typical consultancy" with checkmarks; a six-step journey grid (Roadmap, Test prep, School search, Applications, Money and I-20, Visa); and a final warm CTA section.
- Friendly, optimistic, youthful but credible. Rounded cards, soft shadows.

### 2. Dashboard / Home (the app entry)

Design the dashboard home screen in the Warm Buddy theme, inside the app shell.
- A warm welcome heading ("Hey 👋 let's plan your move" or "Welcome back, {name}").
- A friendly "About you" card: a simple form with Name, "I'm applying for" (Undergrad or Grad), current grade, intended major, budget, in an "answer what you can" tone. Smart and minimal.
- A highlighted "Your next best step" card produced by AI: a tag chip (for example Roadmap), a bold title, a short why, and a marigold "Let's do it 🚀" button. Include a thin progress bar.
- A horizontal stepper of journey modules (Roadmap, Test prep, School search, Applications, Finances, Visa) with done, active, and locked states.
- A "What if?" mini card to explore changes to their plan.
- Mobile: single column, big tap targets. Desktop: two columns with the next-step card prominent.

### 3. Updates (inbox of nudges and opportunities)

Design the "Updates" inbox screen in the Warm Buddy theme. A friendly feed of AI-generated cards: opportunities, follow-ups, nudges, and celebrations. Each card has a colored category pill (opportunity is teal tint, follow-up is marigold tint, celebration is coral tint), a title, a short body, a timestamp, and a primary action button (for example "I did it" or "Open"). Unread items show a coral dot. Include an empty state with a warm illustration and a "Check for new opportunities" button. Mobile-first list with comfortable spacing.

### 4. Mind (the memory page, Yaar's private picture of you)

Design the "Mind" screen in the Warm Buddy theme. This shows what Yaar remembers about the student. At the top, a warm "Your mind" brief card with a short AI-written paragraph summarizing who the student is and where they are, plus a "Refresh" button. Below, a grid of memory "fact" chips grouped by type (goals, constraints, skills, context, preferences), each a tinted pill with a small confidence indicator. It should feel like a living, growing brain, friendly and not clinical, with a subtle 🧠 motif. Mobile: stacked. Desktop: brief on top, fact grid below.

### 5. Progress (trends and history)

Design the "Progress" screen in the Warm Buddy theme. It shows how the student is growing.
- A row of stat tiles: day streak (with a 🔥 and coral accent), mocks taken, "things you've done," and "things Yaar knows about you" (links to Mind). Big friendly numbers.
- A warm "How you're doing" recap card: a short, honest AI paragraph about their improvement and what to focus on, with a 🧭 icon and a soft marigold tint background.
- "Score trends" section: per-skill cards (for example IELTS Reading, TOEFL Speaking), each with a small line sparkline chart of scores over time, the latest score shown big, a "best" label, and a delta badge ("up +0.5 vs last" in green, "down" in amber).
- A "This month vs last" comparison with two side-by-side mini panels.
- A "What to focus on" card with coral-tinted weak-area chips.
- An "Everything you've done" vertical timeline feed, each row an emoji bubble plus activity text plus relative time.
- Mobile-first, single column, charts scale to width.

### 6. Counselor (chat)

Design the "Counselor" chat screen in the Warm Buddy theme. A full-height friendly chat: Yaar messages in teal-to-marigold soft gradient bubbles with a small "Y" avatar, student messages in white bubbles aligned right. A warm greeting, suggested prompt chips above the input, a rounded input bar with a send button and a mic icon for voice. A typing indicator with three soft dots. It should feel like texting a smart friend. Mobile-first, input pinned to the bottom.

### 7. Roadmap

Design the "Roadmap" screen in the Warm Buddy theme. A "Build my roadmap" intro with a primary button, then a generated honest study-abroad plan: a summary card, a "realistic outcome" callout, and a vertical timeline of phases (Test prep, School research, Applications, Finances and I-20, Visa). Each phase is a rounded card with a timeframe chip, a checklist of actions, and a short "why." A coral-tinted "red flags, avoid this" warning card at the end. Mobile-first timeline.

### 8. School search

Design the "School search" screen in the Warm Buddy theme. At the top, a filter bar (search, US state, budget per year, major). Results are a responsive grid of school cards, each with the school name, location, a category badge (reach is coral tint, match is marigold tint, safety is teal or green tint), three mini stats (admit percent, cost per year, median earnings), a short fit reason, and a "Visit site" link. An "honest, unbiased, built from public data" advisor note sits at the top. Loading uses cream skeleton cards. Mobile: one column. Desktop: two to three columns.

### 9. Applications (essay drafting)

Design the "Applications" screen in the Warm Buddy theme. A form to draft a Statement of Purpose or Common App essay: choose type, target school, major, and a notes field for the student's real details. A marigold "Draft my essay" button. The result is a clean, readable draft in a card with copy and regenerate buttons, plus friendly editing tips. Mobile-first, comfortable reading width.

### 10. Coaches

Design the "Coaches" hub screen in the Warm Buddy theme. A grid of coach cards: Recommender coach, Family and funding coach, Grade 9 to 12 milestone plan, and F-1 status guard. Each card has an emoji, a title, a one-line description, and opens an inputs form and an AI result. Show one example expanded: the funding coach with cost vs funds inputs and a clear "gap" result with steps to close it. Warm, supportive tone. Mobile-first cards.

### 11. Evidence vault

Design the "Evidence vault" screen in the Warm Buddy theme. A place to log everything a student does so it becomes application material later. At the top, three small stat tiles (items logged, skills shown, encouragement). A "Log something you did" form (what, who benefited, proof link, skills, reflection). Below, a grid of logged evidence cards with skill chips and a proof link. A gold or marigold "Build my application material" button produces Common App activity lines and an essay-ready paragraph. Trophy 🏆 motif. Mobile-first.

### 12. Speaking prep

Design the "Speaking prep" screen in the Warm Buddy theme. A practice tool: pick exam (IELTS or TOEFL), get a speaking prompt in a card, a big round mic record button with a live waveform animation while recording, then a scored result card with a band or score, per-criterion bars, feedback, a model answer, and drills. Encouraging and game-like. Mobile-first, mic button prominent.

### 13. Mock test (IELTS / TOEFL)

Design the "Mock test" screen in the Warm Buddy theme.
- Intro: pick exam (IELTS or TOEFL) and a section (Reading, Listening, Writing, Speaking) as friendly selectable cards, with a "Start" button and a small past-attempts list.
- Taking state: a timed test view with a clean question panel, a reading passage or audio player, and answer inputs, with a progress indicator and a calm timer.
- Results state: a big score (band or x out of 30), a per-question or per-criterion breakdown with correct and incorrect markers and explanations, weak-area chips, and a "practice these next" nudge.
- Use a friendly "almost there" progress loader while generating. Mobile-first.

### 14. Visa simulator

Design the "Visa simulator" screen in the Warm Buddy theme. A mock F-1 interview: a chat-style exchange where a consular "officer" asks questions and the student answers by typing or voice (mic button). An option to paste I-20 and funding details first. After the interview, a readiness score out of 100 in a big dial or gauge, dimension bars, red-flag callouts, and drills to practice. Serious but supportive, confidence-building tone. Mobile-first.

### 15. For parents

Design the "For parents" screen in the Warm Buddy theme. It lets a student generate a warm, honest, plain-language update for their parents in any language. Inputs: choose language, generate button. The result is a friendly report card (where they are, doing well, watch for, the money, how you can help, next milestones) and a "Copy share link" button for a no-login shareable page. Also design the public shared parent view (clean, no app nav, just the warm report). Mobile-first, large readable text.

### 16. Company (AI company HQ)

Design the "Company" screen in the Warm Buddy theme. It shows the AI team that runs Yaar: an org of AI "employees" (CEO plus department heads) as cards with role and mission, an autonomy-mode badge, a live "boardroom" discussion thread where agents talk to each other and decide, and an action queue with approve and reject controls. A modern internal-dashboard feel, still warm. Mobile-first. Desktop can use two columns (team and boardroom).
