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
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Supabase — not wired up yet (Phase 2)
- OpenAI Realtime or STT/TTS fallback — not wired up yet (Phase 4)
- Vercel

## Getting Started
```bash
npm install
npm run dev      # http://localhost:3000
```

No environment variables are needed to run the current skeleton. Copy
`.env.example` to `.env.local` when the data and voice layers land.

Other scripts:
```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Routes
| Route | Purpose | Chrome |
| --- | --- | --- |
| `/` | Landing page — what the product is, and what it deliberately does not do | none |
| `/app` | Session launcher: topic / level / duration | bottom nav |
| `/session/[id]` | Driving mode — status, timer, two large controls | **none, on purpose** |
| `/review/[id]` | Post-session review | bottom nav |
| `/dashboard` | History, recurring issues, expression wall | bottom nav |
| `/settings` | Preferences and privacy | bottom nav |

`/session/[id]` sits outside the `app/(main)` route group so it can never
inherit navigation. Nothing on that screen should invite a tap while the car is
moving.

## Project Structure
```
app/
  (main)/          screens with the bottom nav
  session/[id]/    driving mode, deliberately outside (main)
  layout.tsx       html shell, metadata, viewport
  globals.css      Tailwind + design tokens
components/
  layout/          MobileShell, PageHeader, BottomNav, SafetyNotice
  launcher/        launcher-specific inputs
  session/         driving-mode screen
  ui/              Button, Card, Badge, EmptyState, ...
lib/               constants, helpers, placeholder data
types/             domain types mirroring docs/04
docs/              product spec — read this before changing scope
public/
```

## Current Status
**Phase 0 and Phase 1 complete.** The app builds, runs, and every route renders.

Not yet built: Supabase schema (Phase 2), session state machine and persistence
(Phase 3), voice pipeline (Phase 4), AI review generation (Phase 5), real
dashboard aggregation (Phase 6), deployment hardening (Phase 7).

Screens that render `lib/placeholder-data.ts` show a `示範資料` badge so the demo
stays honest about what is not wired up.

## Conventions
- UI copy is Traditional Chinese; the speaking practice itself is English
  (`docs/07`, open question 4).
- Single dark theme, no theme switcher — the driving screen needs high contrast
  and there is no reason to maintain two palettes.
- Colors and fonts come from the `@theme` block in `app/globals.css`. Use the
  tokens (`bg-surface`, `text-muted`, `border-line`) rather than raw Tailwind
  palette values.

## Docs Map
- `docs/README.md` — docs index
- `docs/01-product-prd.md` — product spec / PRD
- `docs/02-mvp-scope.md` — MVP / non-goals / success criteria
- `docs/03-information-architecture.md` — pages, flows, user journeys
- `docs/04-technical-architecture.md` — technical architecture and data model
- `docs/05-claude-code-handoff.md` — implementation handoff prompt
- `docs/06-build-phases.md` — implementation phases
- `docs/07-open-questions-and-decisions.md` — decisions, constraints, open questions

## Next Step
Phase 2 — define the Supabase schema for `sessions`, `feedback_items` and
`vocabulary_items` to match `types/index.ts`, then replace
`lib/placeholder-data.ts` with real queries.
