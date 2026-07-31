# P1 Driving English Coach

Mobile-first AI English speaking coach for commuters.

## Project Goal
Build a **publicly deployable**, **portfolio-ready** product that helps users practice spoken English during a car commute with a safe interaction model:
- **Before driving:** start session
- **During driving:** low-interaction voice conversation
- **After driving:** structured review and progress dashboard

## Product Principles
- Mobile-first
- Driving-safe interaction boundaries
- Low-friction daily use
- Public demo friendly
- Small enough to ship as MVP

## Stack
- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS 4 — tokens in `app/globals.css`, no config file
- Supabase — Postgres, row level security, anonymous sign-in, Google OAuth,
  email one-time codes as a fallback
- OpenAI Realtime API over WebRTC for the conversation (`gpt-realtime-2.1-mini`);
  `gpt-5.6-luna` for review generation and note condensing, each with a fallback
  to the previous model if the API rejects the name
- Vercel

## Getting Started
```bash
npm install
npm run dev      # http://localhost:3000
```

The app runs with no environment variables at all. Without Supabase it falls
back to `lib/placeholder-data.ts`, and every screen doing so shows a `示範資料`
badge — the demo never presents fixtures as real records.

```bash
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # node:test over the pure logic
npm run check:supabase   # verify a real project is reachable and configured
```

`npm test` runs the real modules through `tests/loader.mjs`, which resolves the
`@/` alias and stubs `server-only` so plain Node can import them. It covers the
things that are wrong silently rather than loudly: review-output validation,
practice-time arithmetic, week bucketing, and the spaced-review schedule.

## Environment

Copy `.env.example` to `.env.local`. Nothing is required, but each variable
turns something on:

| Variable | Needed for | Without it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | any persistence | placeholder data everywhere |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | any persistence | placeholder data everywhere |
| `OPENAI_API_KEY` | voice, review generation, note condensing | voice returns 503; reviews cannot be generated |
| `SUPABASE_SERVICE_ROLE_KEY` | the voice and review API routes | both routes fail |
| `VOICE_ACCESS` | restricting who may spend voice | defaults to `trial` — see below |
| `NEXT_PUBLIC_EMAIL_CODE` | offering a six-digit code in the email fallback | the fallback uses the emailed link only |

`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-side only. Neither
may ever be prefixed `NEXT_PUBLIC_`; that prefix ships the value to the browser.

Supabase needs anonymous sign-ins enabled, Google OAuth configured, and the
migrations in `supabase/migrations/` applied in filename order. See
`supabase/README.md`.

Sign-in is Google, with an emailed fallback. The fallback sends a link by
default; set `NEXT_PUBLIC_EMAIL_CODE=1` only after `{{ .Token }}` is actually in
both Supabase email templates, which requires custom SMTP or a paid plan.
Without that the code never arrives, and a field the email cannot fill looks
like a broken product rather than an unconfigured one.

## Who can spend voice

Voice is metered, so a public URL is a standing offer to spend money on
strangers. Two things bound it.

**Tiers.** Every user starts on `trial`: one session a day, three minutes each.
A `voice_entitlements` row promotes them to `full` (eight a day, up to an
hour). Users cannot write that table — only the API route can, with the service
role — so nobody can promote themselves or delete usage rows to reset a quota.
`lib/voice/policy.ts` is a pure function for exactly this reason: it is the only
thing between a visitor and an unbounded bill, and it is testable without a
network.

**Deployment mode.** `VOICE_ACCESS=allowlist` closes voice to everyone without
an entitlement row; the rest of the product stays usable. It defaults to
`trial`, which is what makes the site demoable — at roughly $0.02 a minute, a
hundred visitors on the trial cap is a few dollars.

## Deploying

Vercel. Import the repo; no build configuration needed. Set the variables above
for every environment, then redeploy — Vercel bakes them in at build time, so
adding one does not affect the running deployment until it rebuilds.

The app was briefly on GitHub Pages. It moved because a static export can only
serve paths known at build time, so `/session/<uuid>` 404s once sessions are
real records. See `docs/07` for that decision.

`.github/workflows/keep-supabase-awake.yml` queries the database every three
days, because Supabase pauses a free-tier project after 7 days of inactivity.
It needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets. Note
that GitHub disables scheduled workflows in a repository with no activity for
60 days.

## Routes
| Route | Purpose | Chrome |
| --- | --- | --- |
| `/` | Landing page — what the product is, and what it deliberately does not do | none |
| `/app` | Session launcher: topic / level / duration | bottom nav |
| `/session/[id]` | Driving mode — status, timer, two large controls | **none, on purpose** |
| `/review/[id]` | Post-session review, generated on first view | bottom nav |
| `/dashboard` | History, weekly focus, expression wall | bottom nav |
| `/topics` | Saved notes to practise against | bottom nav |
| `/settings` | Account and privacy | bottom nav |
| `/api/realtime/token` | Mints a short-lived OpenAI credential; the only place voice spending is authorised | — |
| `/api/review` | Turns a transcript into a review | — |
| `/api/topics/condense` | Shortens pasted notes before they reach a metered prompt | — |

`/session/[id]` sits outside the `app/(main)` route group so it can never
inherit navigation. Nothing on that screen should invite a tap while the car is
moving.

## Project Structure
```
app/
  (main)/          screens with the bottom nav
  session/[id]/    driving mode, deliberately outside (main)
  api/             route handlers — the only place server secrets are used
  error.tsx        last-resort client error screen
  not-found.tsx    404
  globals.css      Tailwind + design tokens
components/
  dashboard/       session list, weekly chart, expression wall
  layout/          MobileShell, PageHeader, BottomNav, SafetyNotice
  launcher/        launcher-specific inputs
  review/          post-session review screen
  session/         driving-mode screen
  topics/          saved-notes editor and list
  ui/              Button, Card, Badge, EmptyState, ...
lib/
  db/              persistence helpers, one module per table
  progress/        pure dashboard aggregation and the review rhythm
  review/          review generation, validation and persistence
  session/         state machine and transcript log
  supabase/        browser client, server clients, auth
  voice/           realtime config, WebRTC connection, spending policy
tests/             node:test over the pure logic
types/             domain types (index.ts) and DB row types (database.ts)
supabase/          SQL migrations, RLS tests and setup notes
docs/              product spec — read this before changing scope
```

## Current Status

**Phases 0–7 complete.** The acceptance criteria in `docs/01` are met: a
session can be started and finished on a phone, the transcript is saved, a
review is generated from it, the dashboard lists prior sessions, and the app is
deployed publicly.

What works end to end: anonymous sign-in upgraded in place to Google, saved topics from
pasted notes, a spoken session over WebRTC with a live transcript, a generated
review, weekly aggregation, spaced review of collected phrases, and deletion of
practice history.

Known limits, all deliberate and recorded in `docs/07`:
- No scores. `sessions.score_*` stays null — a number invented from one
  imperfect transcript is fake precision, so the dashboard counts what happened
  instead.
- No pronunciation teaching, anywhere. Text cannot distinguish a
  mispronunciation from a transcription error, and car-cabin audio on
  speakerphone cannot either — real sessions had the coach correcting words the
  learner had said correctly. The product teaches sentence patterns and word
  choice instead.
- A review is generated once per session and cannot be regenerated from the UI.
- Transcripts are best-effort. They are guidance about what was said, not a
  record exact enough to quote.

## Conventions
- UI copy is Traditional Chinese; the speaking practice itself is English
  (`docs/07`, open question 4).
- Single dark theme, no theme switcher — the driving screen needs high contrast
  and there is no reason to maintain two palettes.
- Colors and fonts come from the `@theme` block in `app/globals.css`. Use the
  tokens (`bg-surface`, `text-muted`, `border-line`) rather than raw Tailwind
  palette values.
- Row types in `types/database.ts` must be `type`, never `interface`. Only type
  aliases get the implicit index signature Supabase's schema constraint needs;
  as interfaces every table silently resolves to `never` at the call site.

## Docs Map
- `docs/README.md` — docs index
- `docs/01-product-prd.md` — product spec / PRD
- `docs/02-mvp-scope.md` — MVP / non-goals / success criteria
- `docs/03-information-architecture.md` — pages, flows, user journeys
- `docs/04-technical-architecture.md` — technical architecture and data model
- `docs/05-claude-code-handoff.md` — implementation handoff prompt
- `docs/06-build-phases.md` — implementation phases
- `docs/07-open-questions-and-decisions.md` — decisions, constraints, open questions
