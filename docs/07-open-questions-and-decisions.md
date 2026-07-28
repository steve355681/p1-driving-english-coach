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

### 4. Deployed App Talks to the Real Database
Decision: the deployed app connects to Supabase. Anonymous visitors get real,
RLS-isolated sessions.

This reverses an earlier call to keep the public deployment on placeholder
data. That call assumed the deployment was a demo only. It is not: the owner
uses it on a phone during an actual commute, and a deployment that cannot save
a session makes the review and dashboard — half the product — meaningless.

The original worry was that a public anon key plus open anonymous sign-in lets
anyone write to the project. That is true and accepted:
- row level security confines each visitor to their own rows
- the data is text, against a 500 MB free tier
- letting a visitor actually try the product beats showing them fake data

### 5. Hosting: Vercel, not GitHub Pages
Decision: deploy on Vercel.

GitHub Pages served the Phase 1 skeleton, but a static export can only serve
paths known at build time. Once sessions are real records, `/session/<uuid>`
404s. Vercel was already the target in `docs/04`, needs no code changes, and
Phase 4 requires a server route regardless — an OpenAI key cannot ship to the
browser.

## Open Questions
### 1. Anonymous Demo vs Auth First
Decision: anonymous first, **auth required before Phase 4 ships**.

Anonymous is right for Phase 3, where the worst a visitor can do is store some
text. It stops being right the moment voice is connected: every visitor who
starts a session spends real money against the project's OpenAI key, with no
upper bound. Phase 4 must not ship an ungated voice path.

The gate does not have to be full accounts — restricting voice to a known
identity, or a per-user session cap, would both do. But something has to exist
before the first token is spent.

### 2. Level System
**Decided: CEFR A1–C2.** Reverses the earlier recommendation to start with
`basic / intermediate / advanced`.

That recommendation was about avoiding calibration work — but nothing here
calibrates anyone. The learner picks their own level, and it only shapes how
the coach speaks. Three bands turned out too coarse for that: "intermediate"
covers both a learner who needs every question rephrased and one who can
defend a position, and the coach cannot serve both from one instruction.

Existing rows were mapped to the middle of each band (basic→A2,
intermediate→B1, advanced→C1) rather than dropped.

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
