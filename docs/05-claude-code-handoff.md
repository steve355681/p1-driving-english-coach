# 05 — Claude Code Handoff

Use this as the starting brief for implementation.

```text
You are implementing a mobile-first AI English speaking web app called P1 Driving English Coach.

Product goal:
Build a publicly deployable, portfolio-ready product that helps users practice spoken English during a commute using a safe interaction model:
- before driving: setup and start
- during driving: low-interaction voice conversation
- after driving: structured review and progress dashboard

Core constraints:
1. Do not assume lock-screen full interaction is solved.
2. Do not assume wake-word reliability.
3. Do not assume deep CarPlay / Android Auto integration.
4. Keep the MVP as a web app, not a native mobile app.
5. Optimize for real deployment and demoability.

MVP priorities:
1. session launcher
2. live speaking session UI and state machine
3. transcript persistence
4. post-session review generation
5. dashboard with session history and learning signals

Preferred stack:
- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase
- Vercel
- OpenAI Realtime or STT/TTS fallback

Required product behavior:
- mobile-first
- simple setup flow
- large controls during live session
- no long-form reading during active driving mode
- post-session feedback should be compact and high-value

Please work in phases:
- Phase 0: repo bootstrap
- Phase 1: layout and route skeleton
- Phase 2: DB schema and types
- Phase 3: session launcher and state machine
- Phase 4: voice pipeline MVP
- Phase 5: review generation
- Phase 6: dashboard MVP
- Phase 7: deployment hardening and polish

Implementation guidance:
- keep architecture simple
- avoid overengineering
- explain which files you change
- explain how to verify each phase
- prefer a small shippable product over speculative features
```
