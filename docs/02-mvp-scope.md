# 02 — MVP Scope

## MVP Goal
Ship the smallest version that proves the full loop works:
1. start a voice session
2. have a useful spoken interaction
3. save the session
4. generate a review
5. show progress in a dashboard

## MVP In Scope
### Core Experience
- mobile web app or PWA
- session launcher
- one active speaking mode
- post-session review page
- dashboard with history

### Session Inputs
- topic selection
- difficulty selection
- duration selection

### Session Outputs
- transcript
- summary
- top 3 corrections
- useful phrases
- next-step recommendation

### Dashboard Outputs
- session count
- recent sessions
- recurring correction themes
- expression wall
- lightweight trend line

### Infrastructure
- public deployment
- database persistence
- basic privacy notice
- basic error states

## MVP Out of Scope
- native iOS / Android build
- CarPlay / Android Auto apps
- full background audio support
- real wake-word activation
- multi-user collaboration
- advanced gamification
- complete spaced repetition system
- rich teacher admin tools

## Future Scope (Good Candidates)
- topic recommendations from user interests
- CEFR profile calibration
- 1 / 3 / 7 day correction resurfacing
- exportable study notes
- richer progress analytics
- sharing cards for social proof / portfolio demo

## MVP Success Metrics
### Product Success
- first-time user can complete a session without external guidance
- review output feels useful, not generic
- dashboard makes repeat use feel cumulative

### Demo Success
- a hiring manager / peer can understand the product in under 2 minutes
- a user can try the product from a public URL
- the product shows clear AI-specific value

## Key Tradeoff
The MVP prioritizes **realistic deployability** over ambitious platform integration.
That means:
- better to have a solid mobile web app than a fake-native dream
- better to have compact useful feedback than giant reports
- better to support pre-drive start than pretend background magic is solved
