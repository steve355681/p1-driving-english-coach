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

**Closed (Phase 7): a per-user cap, plus a switch to close it entirely.**

Three things, together:

1. **Tiers.** Everyone is `trial` — one session a day, three minutes each —
   until a `voice_entitlements` row promotes them to `full`. Users cannot write
   that table or `voice_usage`; only the API route can, with the service role.
   So nobody can promote themselves, and nobody can delete usage rows to reset
   a quota. Deleting practice history does not do it either: `voice_usage`
   holds `on delete set null` against `sessions`, not cascade.
2. **One authorisation point.** `/api/realtime/token` is the only place voice
   spending is authorised, and it recomputes tier, quota and session ownership
   from the database. Everything the client sends is treated as a request.
3. **A deployment switch.** `VOICE_ACCESS=allowlist` restricts voice to users
   with an entitlement row. The rest of the product stays fully usable.

The default stays `trial`, deliberately. Measured cost is roughly $0.02 a
minute, so a hundred trial visitors is a few dollars — worth paying for a demo
someone can actually speak to, and bounded by the daily cap if it is not. The
switch exists so that stops being a decision that has to be made in a hurry.

What this does *not* defend against is one person creating many anonymous
identities. Anonymous sign-in is what makes the demo work without a login wall,
and it means the cap is per browser rather than per human. `allowlist` is the
answer if that ever matters; a stricter middle ground would be requiring a
verified email before the first grant.

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

**Decided (Phase 5): review generation writes no scores.** The
`sessions.score_*` columns stay null. A 0–100 number invented by a model from a
single imperfect transcript is exactly the fake precision above, and once it is
on screen the learner will read it as a measurement. Phase 6 needs something to
show a trend from; recurring error types and counts are real and already in the
data.

**Decided (Phase 5, settled after real use): this product does not teach
pronunciation.** It teaches sentence patterns and word choice.

The review reads a text transcript, where a mispronunciation and a
transcription error are indistinguishable. Real sessions then showed the live
coach doing the same thing out loud — correcting words the learner had said
correctly and the recognition had misheard. In a moving car, on speakerphone,
with road noise, that is not a tuning problem: it is what the input is. Being
told you mispronounced a word you said correctly is worse than no feedback,
because it costs trust in everything else the coach says.

So `pronunciation` is gone from `FeedbackType`, from the review's response
schema, from the dashboard's labels, and from the `feedback_items` check
constraint. The coach's prompt bans it outright and tells it to ask for a
repeat rather than guess at a word it could not make out.

Pronunciation work needs a quiet room and audio the model can trust. If it is
ever built it belongs in a separate parked mode, not in the driving path — and
it would be a different product decision, not an extension of this one.

**Refined (post-launch, at the owner's request): the coach may work on a word
that was genuinely unintelligible.** The line moved from "never" to "only when
it blocked understanding" — the coach could not make the word out, asked for a
repeat, and still could not. That is a fact about communication rather than a
judgement about accent, and it is the one case the original ban was too broad
for: a word nobody can understand is worth fixing whatever the microphone is
doing.

Everything else holds. An accent is not an error, a word that merely sounds off
is not evidence, and the written review still offers no pronunciation category
at all — text cannot tell a mispronunciation from a transcription error, and
that has not changed.

Corrections of every kind are now delivered as four separated steps, slowly, at
every level: what you said, which part is wrong, the correct version with the
changed part stressed, then repeat it back. The learner cannot see the words, so
hearing the contrast is the only channel they have, and at normal speed a
one-word change is inaudible.

**Decided (Phase 5): the review is generated on first view, not at session
end.** Generating at the end would hold the driver on a spinner at the moment
they most want to put the phone down, and would pay for reviews nobody opens.
One generation per session: if a summary already exists the endpoint returns
without calling the model, which caps the cost and makes retries free. The
trade-off is that a poor-but-valid review cannot be regenerated from the UI.

**Decided (Phase 6): the dashboard counts elapsed time, not requested
duration.** The totals previously summed `duration_minutes`, which is what the
learner picked in the launcher before the drive. That overstates: a trial grant
caps at three minutes, sessions get ended early, and a session that never
connected still carries its requested duration — so opening the launcher five
times and never speaking read as 75 minutes practised. Sessions with no
`ended_at` now count as zero and are labelled 未完成.

The trend view is minutes per week, not a score curve. It shows whether the
habit is holding, which is the thing this product actually depends on, and it
requires inventing nothing.

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
