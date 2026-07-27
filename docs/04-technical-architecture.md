# 04 — Technical Architecture

## Recommended Stack
### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Zustand or React Context for session state
- PWA support

### Backend
- Next.js Route Handlers / Server Actions
- Supabase Postgres
- Supabase Auth or anonymous trial mode
- Supabase Storage if audio assets are retained

### AI / Voice
Preferred:
- OpenAI Realtime for interactive voice

Fallback:
- STT → LLM → TTS pipeline

### Deployment
- Vercel for app hosting
- Supabase for DB / auth / storage

## Why This Stack
- fast to ship
- easy to deploy publicly
- portfolio-friendly
- strong TypeScript ergonomics
- realistic for a single-builder MVP

## Core Technical Components
### 1. Session Launcher
Creates a session record and initializes client state.

### 2. Live Session State Machine
States:
- idle
- connecting
- listening
- ai_speaking
- paused
- ending
- completed
- error

### 3. Transcript Persistence
Save partial transcript incrementally when possible.
Do not depend on end-of-session only persistence.

### 4. Review Generator
Converts transcript into:
- summary
- top corrections
- alternative phrasing
- vocabulary items
- next recommendation

### 5. Dashboard Aggregator
Builds repeat-use insights from stored sessions and feedback items.

## Suggested Data Model
### `user_profiles`
- id
- english_level
- interests
- preferred_topics
- preferred_feedback_style
- created_at

### `sessions`
- id
- user_id
- topic
- duration_minutes
- level
- status
- started_at
- ended_at
- transcript
- summary
- score_overall
- score_fluency
- score_clarity
- score_vocab

### `feedback_items`
- id
- session_id
- type
- original_text
- improved_text
- explanation
- severity

### `vocabulary_items`
- id
- session_id
- phrase
- meaning_zh
- example_en
- category

## Key Constraints
- mobile browser audio permissions can be fragile
- background behavior differs across devices
- latency strongly affects perceived quality
- noisy in-car audio can reduce STT accuracy

## Practical Design Rule
Build the product around **pre-drive activation**, not around assumptions of full background voice assistant capability.
