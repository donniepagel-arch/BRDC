# BRDC Agent Audit Results - Consolidated
**Generated:** 2026-01-21
**Agents Run:** 7 parallel audit agents + 1 triples simulation

---

## Summary of All Audits

| Audit Type | Agent ID | Status | Key Findings |
|------------|----------|--------|--------------|
| Dashboard UI/UX | a8fe3ee | Completed | Monolithic 14K+ lines, slow load |
| Team Profile UI/UX | aba0460 | Completed | Good design, consistent |
| Cross-Page Consistency | a036836 | Completed | Inconsistent back buttons, param naming |
| Navigation Flow | aa3a149 | Completed | Orphan pages, broken links |
| Firestore Data Model | af00553 | Completed | Model is sound, some inconsistencies |
| Dashboard JS Errors | a8fce79 | Completed | Multiple potential runtime errors |
| Scorer Pages Functionality | a40b5a3 | Completed | Works but offline fragile |

---

## 1. Ship Audit Summary (SHIP_AUDIT.md)

### Pages Inventory
- **53 pages** in `/public/pages/`
- **8 core match flow pages** (scorer-hub → game-setup → scorers → match-hub)
- **12 orphan/unreachable pages** including streaming, matchmaker, members

### Critical Path: Match Flow
```
Dashboard → Tonight's Match/Match Hub → Select Game → Scorer → Complete → Return
```
**Status:** Works but return navigation is fragile (P0-1)

### P0 Issues (4)
1. Return navigation after game completion has complex conditional logic
2. Match transition page depends on specific URL params
3. PIN-based match entry relies on cloud function without graceful error handling
4. No offline fallback for mid-match scoring

### P1 Issues (9)
1. Inconsistent back button behavior
2. Nav menu disabled on scorer-hub
3. League links inconsistent parameter naming (`league_id` vs `id`)
4. dashboard.html is 14,000+ lines (performance)
5. Tournament flow unclear
6. match-hub query params inconsistent
7. No loading states on many pages
8. Error messages not user-friendly
9. "Tonight's Match" timezone logic

### P2 Issues (10)
- Streaming pages placeholders
- Matchmaker not connected
- Members page orphan
- Duplicate scorer pages
- Console.log in production
- etc.

---

## 2. Triples League Simulation (TRIPLES_LEAGUE_SIMULATION_REPORT.md)

### Format Verification
Expected 9-game triples format was compared to actual code in `functions/leagues/index.js`.

### Critical Findings

| ID | Severity | Issue |
|----|----------|-------|
| P0-1 | CRITICAL | **Doubles "Choice" games locked to 501 only** - Cork winner cannot choose Cricket |
| P0-2 | CRITICAL | **Doubles stats double-counted** - Both players get 100% of team stats, not 50% |
| P0-3 | CRITICAL | **Cork result not recorded** - Who won cork not saved to Firestore |
| P0-4 | CRITICAL | **No offline resilience** - Network drop = data loss |

### Stats Attribution Bug
In doubles games, the code at `functions/leagues/index.js:762` credits EACH player with full team stats instead of splitting:

**Example:**
- Team throws 60 darts in doubles
- Expected: Each player credited with 30 darts
- Actual: Each player credited with 60 darts
- **Result:** 3-Dart Average is artificially deflated

---

## 3. UI/UX Audit Findings

### Dashboard (`dashboard.html`)
- **Size:** 14,000+ lines, needs modularization
- **Load time:** Potentially slow on mobile
- **Tabs:** Many tabs, complex state management
- **Quick Links:** Good design but overwhelm new users

### Team Profile (`team-profile.html`)
- **Design:** Consistent with BRDC style guide
- **Stats:** Well-organized by level (A/B/C toggle)
- **Navigation:** Clean back button to league view
- **Issue:** Minor - relies on URL params only

### Cross-Page Consistency
- **Color scheme:** Consistent (pink #FF469A, teal #91D7EB, yellow #FDD835)
- **Typography:** Bebas Neue + Inter throughout
- **Cards:** Consistent border/shadow treatment
- **Issue:** Back button destinations vary

### Navigation
- **Global nav:** Hamburger menu with Dashboard, Scorer, Logout
- **Issue:** Nav menu disabled on `scorer-hub.html` (line 451-452)
- **Issue:** Many pages not reachable from nav

---

## 4. JavaScript Error Audit

### Potential Issues Found

1. **Undefined checks needed:**
   - Many places access nested properties without null checks
   - Example: `match.games[0].home_players[0].name` could throw

2. **Async error handling:**
   - Try/catch blocks present but error messages technical
   - No graceful fallbacks for network failures

3. **Event listener cleanup:**
   - Firestore real-time listeners not always unsubscribed
   - Memory leak potential on long sessions

4. **LocalStorage dependency:**
   - Auth relies on `localStorage.getItem('brdc_player_pin')`
   - Private browsing mode could break

---

## 5. Firestore Data Model Audit

### Collections Structure
```
leagues/
  {leagueId}/
    teams/{teamId}
    players/{playerId}
    matches/{matchId}
    stats/{playerId}
    schedule/{weekId} (optional)
```

### Findings
- **Sound design:** Subcollections under league is correct
- **Denormalization:** Team names stored in match docs (good for display)
- **Indexes:** `firestore.indexes.json` has necessary composite indexes

### Issues
- **Inconsistent player reference:** Sometimes `player_id`, sometimes `id`
- **Stats aggregation:** Done server-side only, no real-time updates
- **Match games:** Stored as array, not subcollection (limits query flexibility)

---

## 6. Scorer Pages Functionality

### 501 Scorer (`league-501.html`)
- **Works:** Score entry, bust detection, undo, checkout
- **Works:** Turn alternation
- **Issue:** Doubles not split by individual player
- **Issue:** No offline queue

### Cricket Scorer (`league-cricket.html`)
- **Works:** Mark entry, MPR calculation, close-out detection
- **Works:** Points when ahead
- **Issue:** Same doubles issues as 501

### Common Issues
- Refresh mid-leg may lose local state
- No beforeunload warning
- Return navigation is complex

---

## 7. Recommended Fix Priority

### Ship Blockers (Fix before any league night)
1. Fix doubles stats attribution (divide by player count)
2. Add offline score queue (IndexedDB)
3. Fix return navigation consistency
4. Add beforeunload warning in scorers

### High Priority (Fix soon)
1. Enable nav menu on scorer-hub
2. Standardize URL param names
3. Add loading skeletons
4. Fix "Cork's Choice" to actually offer choice

### Medium Priority
1. Modularize dashboard.html
2. Link orphan pages or remove them
3. User-friendly error messages
4. Match completion celebration screen

### Low Priority
1. Remove streaming placeholders
2. Clean up console.logs
3. Remove duplicate scorer pages

---

## Files Created

1. **SHIP_AUDIT.md** - Complete route inventory and P0/P1/P2 issues
2. **TRIPLES_LEAGUE_SIMULATION_REPORT.md** - Detailed triples format simulation
3. **AGENT_AUDIT_RESULTS.md** - This consolidated file

---

## Quick Reference: Critical Bugs

| Bug | File | Line | Fix Complexity |
|-----|------|------|----------------|
| Doubles stats 2x | `functions/leagues/index.js` | 762 | Low |
| Choice games locked | `functions/leagues/index.js` | 24,27,30 | Medium |
| Cork not recorded | `league-501.html`, `league-cricket.html` | - | Low |
| Return nav broken | `league-501.html` | 3000-3041 | Medium |
| Nav menu disabled | `scorer-hub.html` | 451-452 | Trivial |

---

*Generated by Claude Code audit agents*
*Review these findings and prioritize fixes before next league night*
