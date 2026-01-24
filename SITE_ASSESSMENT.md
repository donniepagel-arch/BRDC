# BRDC Site Assessment
**Generated:** 2026-01-21
**Purpose:** Comprehensive inventory and gap analysis for coordinating parallel development

---

## 1. System Overview

BRDC (Bull's Ring Dart Club) is a comprehensive dart league management platform designed to handle everything from casual pickup games to full league seasons and tournaments. The system provides PIN-based authentication, real-time scoring for 501 and Cricket games, team management, statistics tracking (aiming for DartConnect parity), messaging, and live streaming capabilities. The platform is built on Firebase (Firestore + Cloud Functions + Hosting) with a mobile-first PWA frontend. Currently deployed at https://brdc-v2.web.app.

---

## 2. User Roles and Journeys

### Player (Primary User)
**Goal:** Check schedule, view stats, score games, communicate with team

| Journey | Path | Status |
|---------|------|--------|
| Login | `index.html` -> PIN entry -> `dashboard.html` | Working |
| View Schedule | Dashboard -> Schedule Tab (calendar) | Working |
| View Stats | Dashboard -> Header stats or Profile link | Working |
| Score League Game | Dashboard -> Match Hub -> Select Game -> Scorer | Working (bugs) |
| Score Casual Game | Scorer Hub -> Play Now -> Game Setup -> Scorer | Working |
| View Messages | Dashboard -> Messages quick link | Working |
| Check Standings | Dashboard -> Leagues Tab -> League Card -> league-view.html | Working |

### Team Captain
**Goal:** Manage roster, confirm attendance, handle subs, oversee match night

| Journey | Path | Status |
|---------|------|--------|
| Confirm Attendance | Dashboard -> Tonight's Match card | Working |
| Manage Lineup | Dashboard -> Captain Dashboard quick link | Partial |
| Request Sub | Captain Dashboard -> Sub Management | Working |
| View Team | Dashboard -> Leagues Tab -> Team Profile | Working |

### League Director
**Goal:** Create/manage leagues, handle schedules, view all matches, handle disputes

| Journey | Path | Status |
|---------|------|--------|
| Create League | `create-league.html` (direct URL or admin) | Working |
| View League | `league-view.html?league_id=X` | Working |
| Director Dashboard | Dashboard -> Director quick link | Working |
| Manage Matches | League Director -> Match Management | Partial |
| Import Stats | Admin functions | Working |

### Tournament Director
**Goal:** Create tournaments, manage brackets, run events

| Journey | Path | Status |
|---------|------|--------|
| Create Tournament | `create-tournament.html` | Working |
| View Tournament | `tournament-view.html` | Working |
| Director Controls | `director-dashboard.html` | Working |
| Matchmaker | `matchmaker-director.html` | Working (hidden) |

### System Admin
**Goal:** Full system access, player management, data fixes

| Journey | Path | Status |
|---------|------|--------|
| Admin Panel | `admin.html` (PIN protected) | Working |
| Bot Management | `bot-management.html` | Working |
| Stats Import | Cloud functions | Working |

---

## 3. Feature Matrix

### CORE Features (Must work for league night)

| Feature | Status | Notes |
|---------|--------|-------|
| PIN Login | **Working** | Uses localStorage for session |
| Dashboard | **Working** | 14K lines, slow but functional |
| Match Hub | **Working** | Entry point for league games |
| 501 Scorer | **Working** | Singles work; doubles stats broken |
| Cricket Scorer | **Working** | Singles work; doubles stats broken |
| Stats Display | **Working** | DartConnect parity implemented |
| Match Completion | **Partial** | Return navigation fragile |

### IMPORTANT Features (Should work)

| Feature | Status | Notes |
|---------|--------|-------|
| League View | **Working** | Schedule, standings, teams |
| Team Profile | **Working** | Roster, team stats |
| Player Profile | **Working** | Full DC-parity stats |
| Standings | **Working** | W-L-T, sets, legs |
| Schedule Calendar | **Working** | In dashboard |
| Captain Tools | **Partial** | Basic lineup management |
| Director Dashboard | **Working** | League and tournament |
| Messaging DMs | **Working** | Direct messages |
| Chat Rooms | **Working** | Team/league chat |

### NICE-TO-HAVE Features (Can wait)

| Feature | Status | Notes |
|---------|--------|-------|
| Live Streaming | **Placeholder** | WebRTC + RTMP code exists, not integrated |
| Online Play | **Partial** | UI exists, functions exist, not linked |
| Mini Tournaments | **Working** | Hidden, no nav entry |
| Matchmaker | **Working** | Full system, not linked from main nav |
| Knockout | **Working** | 8-team format |
| Dart Trader | **Partial** | Marketplace stub |
| Community Events | **Partial** | Map view stub |
| Virtual Darts | **Partial** | Separate SPA, incomplete |

---

## 4. Critical Path: League Night Flow

This is the must-work sequence for a typical league night:

```
1. PLAYER LOGIN
   index.html (or dashboard.html) -> Enter 8-digit PIN -> Dashboard
   Status: WORKING

2. VIEW TONIGHT'S MATCH
   Dashboard -> "Tonight's Match" card (if match today)
   Status: WORKING (timezone edge case at midnight)

3. GO TO MATCH HUB
   Click match card -> match-hub.html?league_id=X&match_id=Y
   Status: WORKING (param naming inconsistent but handled)

4. SELECT GAME TO SCORE
   Match Hub -> Game list -> Click game row
   Status: WORKING

5. SCORE THE GAME
   league-501.html or league-cricket.html
   Status: WORKING for singles
   BUG: Doubles stats credited 2x to each player

6. GAME COMPLETE -> RETURN
   Game ends -> Should return to match-hub
   Status: BROKEN - Complex conditional logic, often dumps to scorer-hub

7. SCORE NEXT GAME
   Repeat steps 4-6 for all 9 games
   Status: Flow breaks if return fails

8. MATCH COMPLETE
   All games done -> View results
   Status: PARTIAL - No celebration screen, no clear "match done" state

9. VIEW UPDATED STATS
   Player profile or dashboard header
   Status: WORKING (after refresh)
```

### Critical Path Blockers (P0)

| ID | Issue | Impact | Complexity |
|----|-------|--------|------------|
| P0-1 | Doubles stats 2x | All doubles averages wrong | Medium |
| P0-2 | Return navigation broken | Users lost after game | Medium |
| P0-3 | No offline fallback | Network drop = lost data | High |
| P0-4 | No beforeunload warning | Back button = lost game | Low |

---

## 5. Pages Inventory (53 total)

### By Reachability

| Category | Count | Examples |
|----------|-------|----------|
| Linked from Nav | 3 | dashboard, scorer-hub, logout |
| Linked from Dashboard | 10+ | match-hub, profile, messages, leagues |
| Linked from Flow | 15+ | league-view, team-profile, scorers |
| **ORPHANED** | 12 | streaming, members, mini-tournament, matchmaker |

### Orphaned Pages (No inbound links)

| Page | Why Orphaned | Action Needed |
|------|--------------|---------------|
| `stream-camera.html` | Streaming not complete | Hide or complete |
| `stream-director.html` | Streaming not complete | Hide or complete |
| `members.html` | Never linked | Link from dashboard or remove |
| `match-report.html` | No entry point | Link from match-hub |
| `matchmaker-*.html` (4) | Feature hidden | Link from nav or dashboard |
| `mini-tournament.html` | Feature hidden | Link from scorer-hub |
| `online-play.html` | Feature hidden | Link from dashboard |
| `community-events.html` | Stub feature | Link or remove |
| `dart-trader*.html` (2) | Stub feature | Link or remove |

### Duplicate/Redundant Pages

| Primary | Duplicate | Resolution |
|---------|-----------|------------|
| `league-501.html` | `x01.html`, `/scorers/x01.html` | Keep league-501 as primary |
| `league-cricket.html` | `cricket.html`, `/scorers/cricket.html` | Keep league-cricket as primary |

---

## 6. Cloud Functions Inventory (275+ total)

### By Status

| Category | Count | Status |
|----------|-------|--------|
| League Management | ~50 | Active, deployed |
| Tournament | ~10 | Active, deployed |
| Admin | ~20 | Active, deployed |
| Player/Auth | ~25 | Active, deployed |
| Messaging | ~20 | Active, deployed |
| Social | ~12 | Active, deployed |
| Notifications | ~20 | Active, deployed |
| Stats | ~11 | Active, deployed |
| Advanced | ~17 | Active, deployed |
| Import | ~11 | Active, deployed |
| **Legacy** | ~60+ | Unused, should audit |

### Key Functions for League Night

| Function | File | Purpose |
|----------|------|---------|
| `playerLogin` | player-profile.js | PIN authentication |
| `getDashboardData` | global-auth.js | Load dashboard |
| `getMatchByPin` | leagues/index.js | Find match by PIN |
| `startGame` | leagues/index.js | Initialize game |
| `recordLeg` | leagues/index.js | Save leg result |
| `submitGameResult` | leagues/index.js | Complete game |
| `finalizeMatch` | leagues/index.js | End match |
| `updatePlayerStatsFromMatch` | leagues/index.js | Stats aggregation |

---

## 7. Known Bugs Summary

### Critical (P0) - Fix before league night

| Bug | Location | Symptom |
|-----|----------|---------|
| Doubles stats 2x | `functions/leagues/index.js:762` | Each player gets 100% of team stats |
| Return nav broken | `league-501.html:3000-3041` | Dumps to scorer-hub instead of match-hub |
| Nav menu disabled | `scorer-hub.html:451` | No hamburger menu on scorer |
| No leave warning | Both scorers | Back button loses data |

### High (P1) - Fix soon

| Bug | Location | Symptom |
|-----|----------|---------|
| URL params inconsistent | Various | `league_id` vs `league` vs `id` |
| Cork's Choice locked | leagues/index.js | Doubles always 501, no Cricket option |
| Cork not recorded | Scorers | No audit trail of who won cork |
| No loading states | Most pages | Blank screen while loading |
| Timezone issue | Dashboard | Tonight's Match wrong near midnight |

### Medium (P2) - Fix eventually

| Bug | Location | Symptom |
|-----|----------|---------|
| Dashboard 14K lines | dashboard.html | Slow load, hard to maintain |
| Error messages technical | Various | Firebase errors shown to users |
| Console.log everywhere | Various | Debug spam in production |
| Orphan pages | 12 pages | Features unreachable |

---

## 8. Recommended Work Streams

### Terminal 1: CORE FIXES (Scorer/Stats Focus)

**Priority:** Fix the critical path for league night

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 1. Fix doubles stats division | `functions/leagues/index.js:762` | 30 min |
| 2. Add per-player throw tracking in doubles | `league-501.html`, `league-cricket.html` | 2 hrs |
| 3. Fix return navigation | `league-501.html:3000-3041`, `league-cricket.html` | 30 min |
| 4. Add beforeunload warning | Both scorers | 10 min |
| 5. Enable nav menu on scorer-hub | `scorer-hub.html:451` | 2 min |
| 6. Implement Cork's Choice | `league-501.html`, `league-cricket.html` | 1 hr |

**Deliverable:** Singles and doubles games score correctly with proper stats attribution

### Terminal 2: NAVIGATION & UX

**Priority:** Fix broken flows and orphan pages

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 1. Standardize URL params | All league pages | 1 hr |
| 2. Link match-report.html | match-hub.html | 15 min |
| 3. Link members.html | dashboard.html or nav-menu.js | 15 min |
| 4. Add loading skeletons | Top 5 pages | 2 hrs |
| 5. User-friendly error messages | Various | 1 hr |
| 6. Add match completion screen | match-hub.html | 1 hr |
| 7. Fix back button consistency | Various | 1 hr |

**Deliverable:** Users can navigate all features without getting lost

### Terminal 3: FEATURES & POLISH

**Priority:** Complete partial features, clean up

| Task | File(s) | Est. Time |
|------|---------|-----------|
| 1. Link mini-tournament from scorer-hub | scorer-hub.html | 15 min |
| 2. Link online-play from dashboard | dashboard.html | 15 min |
| 3. Link matchmaker from nav/dashboard | nav-menu.js or dashboard | 15 min |
| 4. Decide streaming fate (remove or complete) | stream-*.html | 30 min |
| 5. Add offline score queue (IndexedDB) | Both scorers | 3 hrs |
| 6. Remove console.log statements | Various | 30 min |
| 7. Remove duplicate scorer pages or redirect | x01.html, cricket.html | 30 min |

**Deliverable:** All features accessible, codebase cleaner

---

## 9. Priority Order (If Only One Terminal)

If limited resources, fix in this exact order:

1. **Doubles stats division** (30 min) - Wrong stats are worse than no stats
2. **Return navigation** (30 min) - Users getting lost breaks the flow
3. **beforeunload warning** (10 min) - Prevents accidental data loss
4. **Nav menu on scorer-hub** (2 min) - Trivial fix, big UX improvement
5. **URL param standardization** (1 hr) - Prevents subtle broken links
6. **Per-player doubles tracking** (2 hrs) - Complete stats accuracy
7. **Loading skeletons** (2 hrs) - Perceived performance improvement
8. **Cork's Choice implementation** (1 hr) - Correct triples format
9. **Offline queue** (3 hrs) - Network resilience
10. **Match completion screen** (1 hr) - Polish

---

## 10. Testing Reference Data

### League for Testing
- **League:** Winter Triple Draft
- **ID:** `aOq4Y0ETxPZ66tM1uUtP`
- **URL:** `/pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP`

### Match for Testing
- **Match:** Pagel v Pagel (Week 1)
- **ID:** `sgmoL4GyVUYP67aOS7wm`
- **URL:** `/pages/match-hub.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=sgmoL4GyVUYP67aOS7wm`

### Teams for Testing
- Home (M. Pagel): `mgR4e3zldLsM9tAnXmK8`
- Away (D. Pagel): `U5ZEAT55xiNM9Otarafx`

---

## 11. Files Reference

### Critical Files to Understand
| File | Purpose | Lines |
|------|---------|-------|
| `public/pages/dashboard.html` | Main dashboard | 14,000+ |
| `public/pages/league-501.html` | 501 scorer | ~3,000 |
| `public/pages/league-cricket.html` | Cricket scorer | ~3,000 |
| `public/pages/match-hub.html` | Match overview | ~1,500 |
| `functions/leagues/index.js` | League functions | ~800 |
| `public/js/nav-menu.js` | Global navigation | ~370 |
| `public/js/stats-helpers.js` | Stats utilities | ~200 |

### Documentation Files
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Development rules (MUST READ) |
| `docs/PROJECT-STATUS.md` | Feature status |
| `docs/FUNCTIONS.md` | Cloud functions inventory |
| `docs/PAGES.md` | Page inventory |
| `MASTER_PLAN.md` | Tonight's fix plan |
| `SHIP_AUDIT.md` | Full route audit |
| `AUDIT_SUMMARY.md` | Bug summary |
| `AGENT_AUDIT_RESULTS.md` | Consolidated audit findings |

---

## 12. Quick Commands

### Deploy Frontend
```bash
firebase deploy --only hosting
```

### Deploy Functions
```bash
firebase deploy --only functions
```

### View Logs
```bash
firebase functions:log
```

### Local Dev (Not Recommended - see CLAUDE.md Rule 0)
```bash
firebase serve
```

---

*End of Site Assessment - Use this to coordinate parallel terminal work*
