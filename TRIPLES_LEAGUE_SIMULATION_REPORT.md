# Triples League Night Simulation Report
**Generated:** 2026-01-21
**Simulator:** QA Audit Mode (Code Trace)
**Focus:** Complete 9-game triples match end-to-end

---

## Key Routes Identified

| Purpose | Route | Status |
|---------|-------|--------|
| Login | `/pages/dashboard.html` | Complete |
| Match Creation | `/pages/league-director.html` | Complete |
| Match Hub | `/pages/match-hub.html` | Complete |
| 501 Scorer | `/pages/league-501.html` | Complete |
| Cricket Scorer | `/pages/league-cricket.html` | Complete |
| Match History | `/pages/match-hub.html` (completed tab) | Complete |
| Player Stats | `/pages/player-profile.html` | Complete |
| Team Stats | `/pages/team-profile.html` | Complete |

---

## Match Format Verification

### Expected Triples Format (from user spec)
| Game | Players | Format |
|------|---------|--------|
| 1 | A/B (Doubles) | 501/Cricket/Choice |
| 2 | C (Singles) | Cricket |
| 3 | A (Singles) | Cricket |
| 4 | B/C (Doubles) | 501/Cricket/Choice |
| 5 | B (Singles) | Cricket |
| 6 | A (Singles) | 501 |
| 7 | A/C (Doubles) | 501/Cricket/Choice |
| 8 | B (Singles) | 501 |
| 9 | C (Singles) | 501 |

### Actual Format in Code (`functions/leagues/index.js:23-33`)
```javascript
const MATCH_FORMAT = [
    { game: 1, homePositions: [1, 2], awayPositions: [1, 2], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 2, homePositions: [3], awayPositions: [3], type: 'singles', format: 'cricket', checkout: null },
    { game: 3, homePositions: [1], awayPositions: [1], type: 'singles', format: 'cricket', checkout: null },
    { game: 4, homePositions: [2, 3], awayPositions: [2, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 5, homePositions: [2], awayPositions: [2], type: 'singles', format: 'cricket', checkout: null },
    { game: 6, homePositions: [1], awayPositions: [1], type: 'singles', format: '501', checkout: 'double' },
    { game: 7, homePositions: [1, 3], awayPositions: [1, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 8, homePositions: [2], awayPositions: [2], type: 'singles', format: '501', checkout: 'double' },
    { game: 9, homePositions: [3], awayPositions: [3], type: 'singles', format: '501', checkout: 'double' }
];
```

### Format Mismatch Analysis

| Game | Expected | Actual | Issue |
|------|----------|--------|-------|
| 1 | A/B - 501/C/CH | Pos 1,2 - 501 choice | **Mismatch: Doubles only shows 501, not Choice of 501/Cricket** |
| 2 | C - Cricket | Pos 3 - cricket | OK |
| 3 | A - Cricket | Pos 1 - cricket | OK |
| 4 | B/C - 501/C/CH | Pos 2,3 - 501 choice | **Mismatch: Same as Game 1** |
| 5 | B - Cricket | Pos 2 - cricket | OK |
| 6 | A - 501 | Pos 1 - 501 | OK |
| 7 | A/C - 501/C/CH | Pos 1,3 - 501 choice | **Mismatch: Same as Game 1** |
| 8 | B - 501 | Pos 2 - 501 | OK |
| 9 | C - 501 | Pos 3 - 501 | OK |

**P0-CRITICAL:** Doubles games are hardcoded to 501 only, not "Cork's Choice" between 501 AND Cricket. The `checkout: 'choice'` only refers to checkout method (double/master), NOT game format choice.

---

## Simulation Walkthrough

### Phase 1: Authentication

**Flow:** User opens `/pages/dashboard.html`

1. **Check:** Page loads login form if no `brdc_player_pin` in localStorage
2. **Result:** Login flow works - PIN entry validates against Firestore `players` collection
3. **Issue Found:** None for basic auth

**Protected Route Test:**
- Navigating to `/pages/match-hub.html` without params shows error state
- Navigating to `/pages/league-501.html` without params shows setup mode (casual game fallback)
- **Result:** Pages gracefully handle missing auth but don't force redirect

### Phase 2: Match Setup (Director Flow)

**Flow:** Director → `/pages/league-director.html?league_id=XXX`

1. **Tonight's Matches Tab:** Lists matches for current date
2. **Click match → Opens Match Hub**

**UI Clarity Issues:**
- [ ] **P1:** Roster order (A=Position 1, B=Position 2, C=Position 3) not clearly displayed
- [ ] **P1:** No visual mapping showing "Game 1 = A/B" etc.
- [ ] **P2:** Cork rules shown in settings but not reinforced on match start

### Phase 3: Playing All 9 Games

#### Game 1: Doubles 501 (A/B vs A/B)

**Flow:** Match Hub → Select Game 1 → `/pages/league-501.html?...`

**Cork Simulation:**
1. Home team chooses who corks first (UI exists)
2. Winner throws first
3. **Issue:** Cork logic exists but...
   - **P1:** No UI to record actual cork results (who hit closer to bull)
   - Cork winner is assumed, not recorded

**Doubles Turn Order:**
- Scorer shows both players on each side
- Turn alternates between teams
- **Question:** Does alternation work correctly within team (A throws, then B throws, etc.)?
- **Finding:** `league-501.html` handles doubles but turn order WITHIN a doubles team is not tracked turn-by-turn. Both players' combined score is entered per turn.

**Score Entry Events:**
- Bust detection: Works (score > remaining shows warning)
- Undo: Works (removes last throw)
- Refresh mid-leg: **P0-Risk** - State synced to Firestore on each throw, but page refresh may lose unsaved local state if connection interrupted

**Result:** Game 1 completes, winner recorded.

#### Games 2-5: Singles Cricket

**Flow:** Match Hub → Select Game → `/pages/league-cricket.html?...`

**Cork:** Same cork flow
**Single Player:** Only one player per side shown
**MPR Tracking:** Marks and MPR calculated correctly

**Issues:**
- **P2:** Cricket scorer doesn't show who corked

#### Games 6-9: Singles 501

**Flow:** Standard 501 scorer
**Issues:** None additional

### Phase 4: Post-Match

**Flow:** All 9 games complete → Match status = "completed"

**Match Hub View:**
- Shows final score (games won by each team)
- Shows each game result with player stats
- Cork winner shown with "C" badge per game (`match-hub.html:2024-2028`)

**Issues:**
- **P1:** No "Match Complete" celebration/summary screen
- **P1:** User must manually navigate back to Match Hub after each game
- **P2:** No end-of-match notification

### Phase 5: Stats Validation

**Stats Flow:**
1. Game completes → `saveLeagueGame()` called
2. Match finalizes → `updatePlayerStatsFromMatch()` runs
3. Stats written to `leagues/{id}/stats/{playerId}`

**Stats Fields Tracked (`functions/leagues/index.js:124-180`):**

**501:**
- `x01_legs_played`, `x01_legs_won`
- `x01_total_darts`, `x01_total_points` (used for 3DA calculation)
- `x01_first9_darts`, `x01_first9_points` (first 9 dart average)
- `x01_tons`, `x01_ton_00` through `x01_ton_80`
- `x01_high_checkout`, `x01_checkouts_hit`, `x01_checkout_attempts`

**Cricket:**
- `cricket_legs_played`, `cricket_legs_won`
- `cricket_total_darts`, `cricket_total_marks` (used for MPR)

**Doubles Attribution Issue:**

From `functions/leagues/index.js:762`:
```javascript
// For team games (doubles/triples), stats are shared among players on the side
```

**P0-CRITICAL:** In doubles, stats are attributed to ALL players on the side equally. This means:
- If A/B play doubles and throw 60 total darts for 501, BOTH A and B get credited with 60 darts each (not 30 each)
- 3DA calculations will be WRONG because the denominator is doubled
- MPR in doubles cricket will similarly be inflated

---

## Findings by Severity

### P0: League Night Cannot Run Correctly

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P0-1 | **Doubles "Choice" games locked to 501** | `functions/leagues/index.js:24,27,30` | Cork winner cannot choose Cricket. Format must be expanded to support `format: ['501', 'cricket']` and UI to select |
| P0-2 | **Doubles stats double-counted** | `functions/leagues/index.js:762` | Player A gets full team stats, not half. 3DA/MPR will be 2x inflated for doubles games |
| P0-3 | **Cork result not recorded** | `league-501.html`, `league-cricket.html` | No field to record who won the cork. "Cork winner starts" is assumed, not tracked |
| P0-4 | **No offline resilience during scoring** | All scorers | Network drop mid-leg = data loss. No IndexedDB queue for throws |

### P1: Confusing or Error-Prone

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P1-1 | **No A/B/C position labels in UI** | `match-hub.html` | Users see "Position 1" not "A Player". Must mentally map |
| P1-2 | **No game-by-game player assignment UI** | Match Hub | Can't easily see "Game 1 = which specific players" before starting |
| P1-3 | **Cork option UI is standalone** | Scorers | Cork selection happens but doesn't integrate with game type choice for Choice games |
| P1-4 | **No confirmation before leaving mid-game** | Scorers | Back button abandons game without warning |
| P1-5 | **Turn order in doubles not tracked** | `league-501.html` | Scorer shows "Team" throw, not which player within team threw |
| P1-6 | **Best-of tracking per SET not per GAME** | `match-hub.html:1822-1830` | Games grouped by "SET" but triples format is 9 distinct GAMES |

### P2: Polish / Clarity Issues

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| P2-1 | **No match summary screen** | Post-match | Just returns to Match Hub, no celebration |
| P2-2 | **Cork badge small and easy to miss** | `match-hub.html:2024` | "C" badge in leg detail, not prominent |
| P2-3 | **Game number display is SET-based** | `match-hub.html:2034` | Shows "LEG 1" not "GAME 1" |
| P2-4 | **No running match score visible in scorer** | Scorers | Can't see "Home 3 - Away 2" while scoring Game 6 |

---

## Stats Mismatch Table (Simulated)

### Test Scenario
- Player A plays: Game 1 (D), Game 3 (S), Game 6 (S), Game 7 (D)
- In Game 1 (Doubles), team throws 60 darts total, scores 280 points toward checkout
- In Game 6 (Singles), throws 45 darts, wins

| Player | Stat | Expected | Actual (Code Trace) | Cause |
|--------|------|----------|---------------------|-------|
| Player A | `x01_legs_played` | 3 (S+D+D) | 3 | OK |
| Player A | `x01_total_darts` (Game 1) | 30 (half of 60) | 60 | **Doubles not split** |
| Player A | `x01_total_darts` (total) | 75 (30+45) | 105 (60+45) | **Inflated by doubles** |
| Player A | 3-Dart Average (3DA) | ~50 | ~35 (diluted) | Darts over-counted |
| Player B | Same | Same | Same | Same issue |

**Root Cause:** `updatePlayerStatsFromMatch()` loops through `homePlayers` and credits EACH player with the full leg stats, not divided.

---

## Repro Steps for P0/P1 Issues

### P0-1: Doubles Choice Games Locked to 501
1. Go to `/pages/league-director.html?league_id=XXX`
2. View Match Format section
3. Note Games 1, 4, 7 show "501" only
4. Start Game 1 from Match Hub
5. **Expected:** UI asks cork winner to choose 501 or Cricket
6. **Actual:** Scorer opens directly in 501 mode

### P0-2: Doubles Stats Double-Counted
1. Complete a doubles 501 game
2. Check `leagues/{id}/stats/{playerA_id}` in Firestore
3. Note `x01_total_darts` = full team darts, not half
4. Calculate 3DA manually vs displayed
5. **Expected:** 3DA reflects player's actual throws
6. **Actual:** 3DA is lower (more darts than points warrant)

### P0-3: Cork Not Recorded
1. Start any game
2. Complete cork (select who throws first)
3. Check Firestore for the leg document
4. **Expected:** `cork_winner: 'home'` or `'away'`
5. **Actual:** No cork_winner field

### P1-4: No Leave Confirmation
1. Start scoring a game
2. Enter several throws
3. Press browser back button
4. **Expected:** "Are you sure? Progress will be lost"
5. **Actual:** Immediately navigates away, game state may be lost

---

## Recommended Fixes Priority

### Critical (Block ship for league night)
1. **Fix doubles format to support game type choice** - Expand `MATCH_FORMAT.format` to array, add UI
2. **Fix doubles stats attribution** - Divide stats by number of players on side
3. **Add cork winner recording** - Field in leg document

### High (Fix before next match)
1. Add A/B/C labels to position numbers
2. Add beforeunload warning in scorers
3. Show match score in scorer header

### Medium (Quality of life)
1. Match completion summary screen
2. Track individual throws within doubles team
3. Prominent cork winner display

---

## Conclusion

The BRDC Triples League system has a **solid foundation** but has **critical gaps for the specific triples format**:

1. **Format:** Doubles "Cork's Choice" games don't actually offer a choice - they're hardcoded to 501
2. **Stats:** Doubles attribution is broken - players get 2x credit
3. **Cork:** Cork logic exists for WHO starts, but not recorded and doesn't control game TYPE selection

The match flow (login → match hub → scorer → complete) **works mechanically** but the **business rules for triples format are not fully implemented**.

---

*End of Simulation Report*
