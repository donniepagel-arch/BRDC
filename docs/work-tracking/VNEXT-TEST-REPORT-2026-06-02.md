# vNext QA Test Report — 2026-06-02

**Tested by:** QA agent (read-only pass)
**Date:** 2026-06-02
**Server:** http://localhost:5601 (static, serving `public/`)
**Viewport:** 375px mobile (preset `mobile`)

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Pages tested | 28 |
| Pages clean (no overflow, no novel JS error) | 26 |
| Pages with expected/graceful errors | 2 |
| Pages with real blocking errors | 0 |
| Static sweep demo-marker hits | 0 |
| Static sweep syntax errors | 0 |
| Static sweep `/rookies/` link hits | 0 |
| Scorer smoke — X01 | PASS |
| Scorer smoke — Cricket | PASS |

No HIGH-severity findings. Two LOW-severity notes (expected auth/param errors that surface gracefully).

---

## Part 1 — Static Code Sweep

### 1a. Demo-marker grep
Patterns searched: `rookies-demo`, `rookies-wing`, `demo_brian`, `rookies.example`, `demo_mode`, `rookies_demo`, `/rookies/`, `rookies-vnext`
Scope: all `public/pages/*-vnext.html`, `public/js/*-vnext.js`, `public/css/*-vnext.css`

**Result: ZERO hits across all files.**

| File group | Files scanned | Hits |
|------------|--------------|------|
| `public/pages/*-vnext.html` | 28 | 0 |
| `public/js/*-vnext.js` | 28 | 0 |
| `public/css/*-vnext.css` | 9 | 0 |

### 1b. JS syntax check
All `public/js/*-vnext.js` files checked via `node --check`.

**Result: ZERO syntax errors.**

Notes:
- `x01-scorer-vnext.html` — inline JS only, no separate JS file, skipped per spec.
- `league-cricket-vnext.html` — inline JS only, no separate JS file, skipped per spec.

### 1c. Link audit — `/rookies/` hrefs
**Result: ZERO hits across all vnext HTML and JS files.**

---

## Part 2 — Mobile Browser Sweep (375px)

Console log buffer accumulates across navigations in this harness. Errors attributed to specific pages are identified by origin URL in stack traces. All stale `player-profile-vnext` errors in later page reads are from page 7 (expected). All `dart-trader-create-vnext` auth errors are from page 27 (expected).

| # | Page | Overflow px | Rendered | Console errors (page-local) | Notes |
|---|------|-------------|----------|-----------------------------|-------|
| 1 | `/pages/home-vnext.html` | 0 | yes | none | Clean. Nav, signed-out state visible. |
| 2 | `/pages/triples-vnext.html?league_id=...` | 0 | yes | none | League command center renders. |
| 3 | `/pages/league-team-vnext.html?league_id=...&team_id=...` | 0 | yes | none | "Make A Wish" team, rank #7, renders. |
| 4 | `/pages/match-hub-vnext.html?league_id=...&match_id=...` | 0 | yes | none | Match report Week 1 renders. |
| 5 | `/pages/members-vnext.html?league_id=...` | 0 | yes | none | 51 members listed. |
| 6 | `/pages/events-vnext.html` | 0 | yes | none | Events page, loading state visible. |
| 7 | `/pages/player-profile-vnext.html` (no player_id) | 0 | yes | `Error: Missing player_id` (expected) | Page renders gracefully with "Missing player_id" message. Error is handled. LOW. |
| 8 | `/pages/admin-vnext.html` | 0 | yes | none | "ADMIN UNAVAILABLE" (no auth) renders. |
| 9 | `/pages/scorer-setup-vnext.html` | 0 | yes | none | "PLAY NOW / Scorer Setup" renders. |
| 10 | `/pages/create-tournament-vnext.html` | 0 | yes | none | "DIRECTOR LOGIN REQUIRED" renders. |
| 11 | `/pages/create-league-vnext.html` | 0 | yes | none | "LEAGUE SETUP / Create League" renders. |
| 12 | `/pages/tournament-view-vnext.html?tournament_id=...` | 0 | yes | none | Wing It Wednesdays #3 registration view renders with real data. |
| 13 | `/pages/tournament-register-vnext.html?tournament_id=...` | 0 | yes | none | Registration / 1 event option renders. |
| 14 | `/pages/tournament-runtime-vnext.html?tournament_id=...` | 0 | yes | none | "DIRECTOR LOGIN REQUIRED" renders. |
| 15 | `/pages/x01-scorer-vnext.html` | 0 | yes | none | Two players at 501, keypad visible. |
| 16 | `/pages/league-cricket-vnext.html` | 0 | yes | none | Casual game setup screen renders. |
| 17 | `/pages/messages-vnext.html` | 0 | yes | none | "Log in to use chat" state renders. |
| 18 | `/pages/contact-center-vnext.html` | 0 | yes | none | "DIRECTOR LOGIN REQUIRED" renders. |
| 19 | `/pages/director-home-vnext.html` | 0 | yes | none | "DIRECTOR LOGIN REQUIRED" renders. |
| 20 | `/pages/league-import-vnext.html?league_id=...` | 0 | yes | none | "DIRECTOR LOGIN REQUIRED / Import Reports" renders. |
| 21 | `/pages/wing-it-wednesdays-vnext.html` | 0 | yes | none | "NO WEEKS FOUND" graceful empty state renders. |
| 22 | `/pages/matchmaker-mingle-vnext.html?tournament_id=...` | 0 | yes | none | 0 pairs/singles, Wing It Wednesdays #3 renders. |
| 23 | `/pages/matchmaker-tv-vnext.html?tournament_id=...` | 0 | yes | none | TV bracket view, "Waiting for bracket" state renders. |
| 24 | `/pages/captain-dashboard-vnext.html?league_id=...` | 0 | yes | none | "CAPTAIN BOARD / Log in from dashboard first" renders. |
| 25 | `/pages/dart-trader-vnext.html` | 0 | yes | none | "0 listings shown" marketplace renders. |
| 26 | `/pages/dart-trader-listing-vnext.html` (no listing_id) | 0 | yes | none | "Listing unavailable / No listing ID provided" graceful state. |
| 27 | `/pages/dart-trader-create-vnext.html` | 0 | yes | `Error: No auth token provided` (expected) | Page renders form shell. Error is unauthenticated-session expected. LOW. |
| 28 | `/pages/league-director-vnext.html?league_id=...` | 0 | yes | none | "LOADING DIRECTOR BOARD..." renders. |

**Summary: 28/28 pages rendered. 0 horizontal overflow. 0 blocking/unexpected JS errors.**

---

## Part 3 — Scorer Engine Smoke

### X01 — `/pages/x01-scorer-vnext.html`

**Result: PASS**

Steps taken (read-only):
1. Loaded page — both players at 501, keypad visible.
2. Clicked the `60` quick-score button (present in keypad alongside digit buttons).
3. Observed: HOME player score dropped 501 → **441**. AVG updated to 60.0/60.0. Score applied immediately without separate ENTER step.
4. No leg completion triggered (score safely above 0).

### Cricket — `/pages/league-cricket-vnext.html`

**Result: PASS**

Steps taken (read-only):
1. Loaded setup screen — player name inputs and format selector visible.
2. Selected "Player 1 starts" (resolved cork modal without randomness).
3. Clicked START GAME — live scorer loaded with 20/19/18/17/16/15/Bull target rows.
4. Clicked the `20` target button 3 times in rapid succession.
5. Observed: `X` closed indicator appeared on the 20 row; pending tally shows `20 20 20` and `3 MARKS`. No leg completion triggered.

---

## Issues Found

### HIGH severity
None.

### LOW severity

| # | Page | Issue | Classification |
|---|------|-------|----------------|
| L-01 | `player-profile-vnext.html` (no param) | Throws `Error: Missing player_id` to console when loaded without a `player_id` query param. Page renders a graceful "Missing player_id" message, so UX is handled — but the error is still surfaced as a console error rather than a silent guard. | LOW — cosmetic/polish |
| L-02 | `dart-trader-create-vnext.html` | Throws `Error: No auth token provided` (multiple retries) when loaded unauthenticated. Expected behavior, but retry count generates noisy log entries. | LOW — cosmetic/polish |

---

## Not Testable Without Credentials

The following paths require a director-authenticated session and explicit write approval before functional testing:

| Page | Gated action |
|------|-------------|
| `/pages/create-tournament-vnext.html` | Submit "Create tournament" form (Firestore write) |
| `/pages/create-league-vnext.html` | Submit "Create league" form (Firestore write) |
| `/pages/tournament-runtime-vnext.html` | Check-in, bracket generation, score submission actions |
| `/pages/contact-center-vnext.html` | Send message (SMS/email dispatch) |
| `/pages/messages-vnext.html` | Send direct/league/team message (Firestore write) |
| `/pages/league-import-vnext.html` | "Import" submit (batch Firestore match writes) |
| `/pages/admin-vnext.html` | Any admin write operations |
| `/pages/director-home-vnext.html` | Any director write operations |

These pages all render correctly in the unauthenticated state (auth wall shown gracefully). Functional write-path testing requires: (1) a director-authenticated browser session, (2) explicit operator approval per the read-only testing constraint.

---

*Report generated by QA agent. Static server: http://localhost:5601. Repo: `E:\projects\brdc-firebase`.*
