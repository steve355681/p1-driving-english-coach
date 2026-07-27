# 01 — Product PRD

## Product One-Liner
A mobile-first AI English speaking coach for commuters that supports **safe, low-interaction speaking practice while driving** and delivers **structured feedback after the session**.

## Target User
- People with 10–30 minute commutes
- Learners who want to actually speak, not just read or memorize
- People who cannot justify frequent 1:1 speaking tutor costs
- Users willing to use AI as a daily speaking partner and coach

## Problem
Most English learning tools are optimized for:
- reading
- flashcards
- desktop interaction
- passive consumption

But the target user needs something different:
- usable from a phone
- practical during real life
- voice-first
- low-friction enough to repeat daily
- capable of producing feedback worth reviewing later

## Why This Matters
If the product works, it turns dead commute time into high-frequency speaking practice without requiring expensive tutoring or a heavy course workflow.

## Success Criteria
The product succeeds if a user can:
1. start a session in under a minute
2. complete a 10–20 minute spoken English session on mobile
3. receive a compact but useful review after the session
4. see progress across repeated sessions
5. share or demo the product publicly as a believable AI product

## Core User Stories
### User Story A
As a commuter, I want to quickly start a spoken English session before driving so I can use commute time for real practice.

### User Story B
As a speaking learner, I want post-session feedback that is short and actionable so I know what to fix next time.

### User Story C
As a repeat user, I want a dashboard of sessions, mistakes, and good phrases so I can track improvement over time.

## Functional Requirements
### FR-1 Session Launch
- Start a new session from mobile
- Choose topic manually or accept a recommendation
- Select a duration: 5–60 minutes, in 5-minute steps
- Select level: basic / intermediate / advanced

### FR-2 Live Voice Conversation
- AI speaks with the user in English
- AI adjusts difficulty based on user ability
- AI can simplify or rephrase when user is stuck
- AI keeps the topic focused enough for useful practice

### FR-3 Driving Mode
- Only minimal controls during the session
- Large buttons and large state indicators
- No long-form reading while driving
- Visible states: connecting / listening / AI speaking / paused / ending

### FR-4 Post-Session Review
Each completed session should generate:
- session title
- short summary
- 3 most important corrections
- 3–5 alternative expressions
- 5 useful words or phrases
- next practice recommendation

### FR-5 Dashboard
The dashboard should show:
- session history
- recent activity count
- common error types
- quote wall / expression wall
- progress trend view

### FR-6 Data Persistence
Store at least:
- session metadata
- transcript
- generated feedback
- vocabulary items
- derived scoring or progress markers

### FR-7 Public Deployability
- The app must be deployable to a public URL
- It should be demoable by other users
- MVP can support anonymous trial mode before full auth

## Non-Functional Requirements
- mobile-first layout
- low interaction cost
- graceful handling of network issues
- clear privacy disclosure for audio / transcript storage
- public-facing quality suitable for portfolio use

## Explicit Non-Goals for MVP
- full native app
- lock-screen full control
- wake-word reliability
- deep CarPlay / Android Auto integration
- heavy social/community features
- overcomplicated pronunciation scoring

## Acceptance Criteria
- A user can start and finish a session on a phone
- A transcript is saved
- A review page is generated
- A dashboard lists prior sessions
- The app is deployable publicly
