# 07 — Open Questions and Decisions

## Locked Decisions
### 1. Web App First
Decision: build a mobile web app / PWA first.

Why:
- fastest to ship
- easiest to share
- best fit for portfolio visibility

### 2. Driving-Safe Scope Boundary
Decision: optimize for pre-drive start, in-drive low interaction, post-drive review.

Why:
- realistic MVP boundary
- avoids fake promises about background behavior
- preserves safety-oriented UX

### 3. Compact Feedback Over Giant Reports
Decision: prioritize top corrections and usable phrases, not exhaustive analysis.

Why:
- users will actually read it
- easier to build and validate
- better daily ritual design

## Open Questions
### 1. Anonymous Demo vs Auth First
Recommendation: start with anonymous demo mode, then add auth.

### 2. Level System
Recommendation: use `basic / intermediate / advanced` first, not full CEFR calibration.

### 3. Scoring Strategy
Recommendation: avoid fake precision. Prefer broad trend indicators before detailed numeric scoring.

### 4. Language of UI
Recommendation: Chinese UI with English speaking experience, since that best fits the target user context.

### 5. Audio Retention Policy
**Decided (Phase 2): transcript only. Raw audio is never stored.**

Why:
- the review only needs text, so audio buys nothing for the core loop
- it removes a class of privacy and retention questions entirely
- no Supabase Storage bucket, no lifecycle policy, no deletion tooling

The schema reflects this: `sessions.transcript` exists, and there is no audio
column or bucket.

## Main Risks
- mobile browser audio constraints
- latency degrading speaking feel
- in-car noise hurting recognition quality
- over-expanding scope into a fake assistant product

## Anti-Scope-Creep Rule
If a feature does not directly improve:
- session start
- speaking flow
- review quality
- repeat-use visibility

then it should probably not be in MVP.
