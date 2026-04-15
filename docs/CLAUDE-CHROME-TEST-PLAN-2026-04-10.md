# BRDC Claude-In-Chrome Test Plan

**Last Updated:** 2026-04-14  
**Purpose:** Give Claude in Chrome a repeatable manual QA plan for the live BRDC site without guessing which pages matter or which actions are too risky on production.

## Primary Goal

Test the real user-facing BRDC product surface in a controlled order:

1. Confirm the site loads and auth works.
2. Confirm the main routed pages still render and navigate correctly.
3. Confirm the core league, match, scorer, messaging, and admin/director surfaces remain stable after cleanup.
4. Keep destructive or data-writing actions isolated and explicit.
5. Verify known repaired issues stay fixed and known data-repair candidates are not worsened.

## Test Rules

- Prefer the production BRDC site first.
- Use the Firebase host only as a fallback comparison surface.
- Treat league data, scores, standings, stats, messaging, notifications, imports, and admin tools as **live**.
- Do **not** click buttons that:
  - import matches
  - clear stats
  - regenerate schedules
  - send SMS/email/bulk notifications
  - save scorer results
  - submit match scores
  - edit league settings
  - delete anything
- If a page offers both read-only and write actions, stop at the last safe read-only state unless the test step explicitly says otherwise.
- When a test requires creating data, use disposable test data only and record exactly what was created.

## Environment

- Preferred host: `burningriverdarts.com`
- Fallback host: `brdc-v2.web.app`
- Browser: Chrome with Claude operating the page
- Authentication: use Donnie Pagel admin account for the current regression pass unless a member-only comparison is needed

## Expected Output From Claude

For each tested area, Claude should report:

- page/route tested
- pass/fail
- screenshot if visually broken
- console/network errors if visible
- whether the issue is render-only, auth, Firestore permissions, function failure, or data inconsistency
- exact step where the failure occurred

## Phase A: P0 Smoke Pass

Run these first, in order. Stop and report before going deeper if one of these fails.

### 1. Landing + Login

- Open `/`
- If already authenticated, confirm redirect behavior is clean
- Confirm navigation to `/pages/register.html` works
- Confirm navigation to `/pages/signup.html` works
- Expected:
  - no blank screen
  - no stuck skeleton
  - no auth error loop
  - post-login route resolves cleanly

### 2. Dashboard

- Open `/pages/dashboard.html`
- Confirm dashboard feed area renders
- Confirm left/right/nav surfaces load
- Confirm no infinite loader or fatal error overlay
- Safe actions:
  - scroll
  - open menus
  - inspect visible widgets
- Do not:
  - post
  - comment
  - react

### 3. Messages

- Open `/pages/messages.html`
- Confirm conversation list renders
- Open an existing conversation read-only
- Confirm thread content loads
- Confirm no repeated presence/permission errors
- Do not send a message

### 4. Profile

- Open `/pages/player-profile.html`
- Confirm player profile loads
- Confirm stats/availability/profile sections render
- Do not save profile edits

### 5. League View

- Open `/pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
- Confirm header, tabs, standings, schedule/matches, and stats render
- Confirm there is no permanent skeleton state
- Confirm standings and stats panels populate
- Do not register, edit, or import from this page

### 6. Match Hub

- Open `/pages/match-hub.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=TNUKhFB5xrtTNmzmTaob`
- Confirm header, box score, rosters, and tabs load
- Confirm game rows and scorer launch buttons appear
- Do not confirm attendance unless explicitly using a disposable test match

### 7. Scorer Entry Points

- Open `/pages/game-setup.html`
- Confirm game setup page renders
- Open scorer routes from a safe link without saving
- Confirm both scorer UIs load:
  - `/pages/x01-scorer.html`
  - `/pages/league-cricket.html`
- Confirm cricket no longer throws `legsToWin is not defined`
- Note any `[LiveMatch] Failed to start: Unauthorized` warning, but treat it as low severity unless it breaks the page
- Do not submit legs or final scores

## Phase B: Core Feature Coverage

Run this only after Phase A passes.

### Auth + Registration

- `/pages/register.html`
- `/pages/signup.html`
- Confirm forms render, validation messages appear, and submit buttons are wired
- Only run a real registration if using disposable data and cleanup is planned

### Social + Member Surface

- `/friends`
- `/pages/members.html`
- `/pages/conversation.html`
- `/pages/chat-room.html`
- Confirm lists/search/load states render
- Do not send messages or mutate social data

### Events + Tournaments

- `/events`
- `/pages/event-view.html`
- `/pages/tournaments.html`
- `/pages/tournament-view.html`
- `/pages/tournament-bracket.html`
- Confirm list/detail pages render and route transitions work
- Do not create or edit tournaments/events

### Trader

- `/pages/dart-trader.html`
- `/pages/dart-trader-listing.html`
- Confirm listings and detail views load
- Confirm there is no Firestore index failure
- Do not create listings in smoke QA

## Phase C: League And Match Integrity Checks

This is the highest-value product QA area.

### League View Deep Check

On `/pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP`:

- verify standings tab loads
- verify stats tab loads
- verify match list loads
- compare at least one completed match from standings to match hub
- confirm there is no obvious mismatch between:
  - match result
  - team record
  - displayed stats

### Match Hub Deep Check

On `/pages/match-hub.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=TNUKhFB5xrtTNmzmTaob`:

- verify box score renders
- verify roster section renders
- verify each game/set row is present
- open scorer launch links without saving
- confirm x01 and cricket routes open for the expected game types

### Scorer UI Deep Check

- confirm player names/team assignments look correct
- confirm no missing-canonical-player warning appears unexpectedly
- confirm save controls exist but do not use them
- if a warning appears, capture the exact text

## Phase D: Director Tools

Use a director account. Stay read-only unless a step explicitly says validation-only.

### League Director

- Open `/pages/league-director.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
- Confirm dashboard loads
- Confirm week selector, match cards, settings panels, and tools render
- Confirm Import QA card/report renders
- Confirm Manual Import Workbench renders
- Confirm DIRECTOR TOOLS tab opens without auth/PIN errors
- Confirm Activity Log default view loads
- Change the audit-action filter only if the Firestore composite index has been created; otherwise record the missing-index failure as known infrastructure

Safe actions:

- open tabs
- inspect weekly match cards
- paste a recap URL and run **parse/validate only**

Do not:

- import a payload
- edit settings
- send messages
- trigger bulk actions

### Import Workbench Validation-Only

If testing import tooling:

- enter known `leagueId`
- enter known `matchId`
- paste known DartConnect URL
- run parse
- run validation
- capture:
  - parsed groups
  - scheduled groups
  - unresolved players
  - warnings/errors

Do not press the final import button during routine QA.

## Phase E: Admin Surface

Use an admin account only after all previous phases pass.

### Admin Dashboard

- Open `/pages/admin.html`
- Confirm dashboard/tabs load for authenticated admin
- Confirm lists/cards/tables render

Do not:

- clear data
- delete leagues/tournaments/players
- trigger repair utilities
- send notifications

## High-Risk Pages To Treat As Manual-Only

These should not be part of routine Claude-in-Chrome smoke QA unless the explicit goal is operator testing:

- `/pages/admin.html`
- `/pages/league-director.html`
- `/pages/create-league.html`
- `/pages/create-tournament.html`
- `/pages/player-registration.html`
- `/pages/bot-management.html`
- any page that sends SMS/email or performs imports
- any scorer flow that would save live results

## Suggested Test Order For Claude

1. `/`
2. `/pages/register.html`
3. `/pages/signup.html`
4. `/pages/dashboard.html`
5. `/pages/messages.html`
6. `/pages/player-profile.html`
7. `/pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
8. `/pages/match-hub.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=TNUKhFB5xrtTNmzmTaob`
9. `/pages/game-setup.html`
10. scorer safe-entry routes for x01 and cricket
11. `/events`
12. `/pages/tournaments.html`
13. `/pages/dart-trader.html`
14. `/pages/league-director.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
15. `/pages/admin.html`

## Suggested Bug Buckets

Claude should classify findings into one of these:

- `P0 Auth/Blank Screen`
- `P0 Stuck Loader/Skeleton`
- `P1 Navigation/Route Failure`
- `P1 Function/Permission Error`
- `P1 Data Integrity Mismatch`
- `P2 Visual/Layout Regression`
- `P2 Search/List/Filtering Failure`
- `P3 Copy/Polish`

## Known Current Focus Areas

Give extra attention to these because they changed recently:

- chat drawer and messages load states
- live match helper warnings on scorer pages
- match hub -> scorer launch path
- cricket scorer init path
- admin dashboard auth-free load for authenticated admin
- director tools auth path after PIN removal
- director audit-log filtering if the `audit_log(action, timestamp)` index exists
- importer-related read-only audit surfaces

## Known Repair Queue To Keep In Mind

These are current data-repair candidates from the latest read-only audit. Do not mutate them during routine QA, but note if their visible state differs from the audit:

- Week 8 `smKBx8m5t5QJYQrXpcxV` D. Partlo vs neon nightmares
- Week 10 `kC7C0NNtalEyNblHHTSW` K. Yasenchak vs N. Kull
- Week 2 `fqICAD9zFe7cLgNM2m4T` D. Partlo vs M. Pagel
- Week 6 `0vSyH2zgRdoevOv2KEgX` N. Mezlak vs N. Kull
- Week 6 `56py28cEEFO64uo8IN3U` E. O vs D. Russano
- Week 6 `JVrGYr5saQADImC451xc` D. Partlo vs J. Ragnoni

## If A Failure Is Found

Claude should stop at the failing point and report:

- exact URL
- account role used
- exact click path
- exact visible error text
- screenshot
- whether the failure is safe to reproduce again
- whether any live data may have been mutated

## Out Of Scope For Routine Chrome QA

- broad data repair
- standings/stat recalculation
- production imports
- notification delivery verification
- bulk admin utilities
- migration/debug endpoints

This plan is for reliable feature validation, not ops surgery.
