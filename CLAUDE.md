# CySA+ Study Desk

A static study app for the CompTIA CySA+ (CS0-003) exam: practice questions, flashcards, domain
readiness tracking, and an AI tutor when hosted on claude.ai.

## Architecture
- No build step and no dependencies. `index.html` loads plain scripts in order:
  `data/domains.js` → `data/questions.js` → `data/flashcards.js` → `js/app.js`.
  Each data file adds to `window.CYSA`. Keep them as plain scripts (not ES modules or JSON + fetch)
  so the page still opens straight from disk via `file://`.
- `js/app.js` is one IIFE, split into sections by `// ---------- Name ----------` comments
  (State, Helpers, Tabs, Overview, Practice, Claude, Flashcards, Tutor, Boot).
- Progress lives in `localStorage` under `cysa-study-desk-v1`. `window.claude` (db, sample) only
  exists inside claude.ai. Every use of it must be guarded and must degrade by hiding the feature.
- Styling: `css/styles.css`. All colors are tokens on `:root`, with dark values in two places (the
  `prefers-color-scheme` block and `[data-theme="dark"]`). Never use a literal color in a component rule.

## Data rules
- Question and flashcard `id`s are stable keys for saved progress. Never rename or reuse one.
- Questions: exactly 4 distinct options, `a` is a 0-3 index, `x` is required. Domain weights sum to 100.
- After any change under `data/`, run `node scripts/validate-data.mjs`. A PostToolUse hook in
  `.claude/settings.json` runs it automatically when Node is installed.
- To grow the bank, use the `add-questions` skill.

## Conventions
- Vanilla JS, 2-space indent, double quotes, `$("id")` for element lookup, `esc()` for any text put into HTML.
- Keep exam facts accurate (CS0-003: up to 85 questions, 165 minutes, passing 750 on a 100-900 scale).
- Commit messages: imperative mood, with a short body explaining why.
