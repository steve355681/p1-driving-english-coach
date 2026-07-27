# 03 — Information Architecture

## Product Modes
### Before Driving
Purpose: setup and launch.

Allowed complexity:
- choose topic
- choose duration
- choose level
- start session

### During Driving
Purpose: low-interaction speaking.

Allowed complexity:
- view session state
- pause
- resume
- end session

Not allowed:
- long reading
- dense corrections
- settings-heavy interaction

### After Driving
Purpose: reflection and progress.

Allowed complexity:
- detailed review
- transcript scan
- corrections
- phrase collection
- progress trends

## Primary Routes
- `/` — landing page
- `/app` — session launcher
- `/session/[id]` — live session page
- `/review/[id]` — session review
- `/dashboard` — history and trends
- `/settings` — preferences and privacy

## Main User Flow
### Flow A — First-Time User
1. Open landing page
2. Understand product in under 30 seconds
3. Tap start
4. Choose topic / duration / level
5. Start speaking session
6. End session
7. View review
8. Visit dashboard

### Flow B — Returning User
1. Open app
2. Tap suggested topic or repeat mode
3. Start session quickly
4. Review top corrections
5. Check trend or expression wall later

## Page Responsibilities
### Landing Page
- explain the product clearly
- show the driving-safe interaction model
- provide CTA to try demo
- present portfolio-ready framing

### Session Launcher
- present simplest possible setup flow
- minimize friction
- store session settings

### Live Session Page
- render state machine
- show only essential status
- provide large controls
- avoid text-heavy UI

### Review Page
- session summary
- strongest correction opportunities
- improved alternatives
- vocabulary / phrase takeaway

### Dashboard
- session history
- patterns across sessions
- progress trend
- expression wall

## IA Principle
The app should feel like **one focused daily ritual**, not a general-purpose language platform.
