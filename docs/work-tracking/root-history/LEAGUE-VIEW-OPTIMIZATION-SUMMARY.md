# League-View.html Data Loading Optimization

**Date:** 2026-02-11
**File:** `public/pages/league-view.html`

## Problem
The page had massive data loading redundancy. The same Firestore collections were queried repeatedly across functions, with the worst offender being `loadLeagueMatchCard()` which ran PER MATCH CARD and each invocation loaded:
- The ENTIRE players collection (36+ times for a full season)
- Individual stat docs for each player (hundreds of redundant reads)
- Recalculated team records and standings from scratch (36+ times)

With 36+ matches in a season, this created:
- **36+ redundant reads of the players collection**
- **Hundreds of individual stat doc reads**
- **36+ redundant team record/standings calculations**

## Solution
Implemented module-level caching with shared data loading functions:

### 1. Added Cache Variables (line ~3046)
```javascript
// Cached data - loaded once, used everywhere
let allPlayersById = null;  // { playerId: playerData }
let allPlayersList = null;  // [playerData, ...]
let allStatsById = null;    // { playerId: statsData }
let teamRecords = null;     // { teamId: { wins, losses, ties, gamesWon, gamesLost } }
let teamStandings = null;   // [{ id, wins, losses, gamePct }, ...] sorted by rank
```

### 2. Created Shared Data Loading Functions (after line ~3129)
- `ensurePlayersLoaded()` - Loads all players once, caches in `allPlayersById` and `allPlayersList`
- `ensureStatsLoaded()` - Loads all stats once, caches in `allStatsById`
- `ensureTeamRecordsCalculated()` - Calculates team records and standings once from matches array
- `getTeamRoster(teamId)` - Returns cached players for a team
- `getTeamStanding(teamId)` - Returns team rank from cached standings

### 3. Pre-load in loadLeagueData() (line ~3121)
Added after teams and matches are loaded:
```javascript
// Pre-load players and stats for active leagues
await Promise.all([ensurePlayersLoaded(), ensureStatsLoaded()]);
ensureTeamRecordsCalculated();
```

### 4. Cache Invalidation (line ~3075)
Added at start of `loadLeagueData()` to clear caches when data is reloaded:
```javascript
// Invalidate caches - data is being reloaded
allPlayersById = null;
allPlayersList = null;
allStatsById = null;
teamRecords = null;
teamStandings = null;
```

### 5. Updated Functions to Use Cached Data

**loadLeagueMatchCard() (line ~3646)**
- REMOVED: 45 lines of team records calculation
- REMOVED: Players collection query
- REMOVED: Individual stat doc queries per player
- REPLACED WITH: 6 lines using cached data

**loadByeCard() (line ~3947)**
- REMOVED: Players collection query
- REMOVED: Individual stat doc queries per player
- REPLACED WITH: Cached roster and stats lookup

**initStandings() (line ~4012)**
- REMOVED: Team records calculation
- REMOVED: Players collection query
- REMOVED: Stats collection query
- REPLACED WITH: Direct population from cached data

**initStats() (line ~4450)**
- REMOVED: Players collection query
- REMOVED: Stats collection query
- REPLACED WITH: Direct population from cached data

**getLevelRanges() (line ~5340)**
- REMOVED: Players collection query
- REMOVED: Stats collection query
- REPLACED WITH: Cached data iteration

**checkMatchNightForLeague() (line ~6127 and ~6169)**
- REMOVED: Players collection query for team lookup
- REMOVED: Players + Stats collection queries for rosters
- REPLACED WITH: Cached lookups

## Performance Impact

### Before:
- **Players collection:** Loaded 6+ times (once per major function + once per match card × 36)
- **Stats collection:** Loaded 5+ times (similar pattern)
- **Individual stat docs:** Hundreds of reads (per-player queries in match cards)
- **Team records calculation:** 36+ times (once per match card)

### After:
- **Players collection:** Loaded ONCE on page load
- **Stats collection:** Loaded ONCE on page load
- **Individual stat docs:** ZERO (all from cached collection)
- **Team records calculation:** ONCE on page load

### Estimated Savings:
- **~35+ eliminated players collection queries**
- **~35+ eliminated stats collection queries**
- **~300-500 eliminated individual stat doc queries**
- **~35+ eliminated team records recalculations**

## Testing
- Verify league-view.html loads correctly
- Check all tabs (Schedule, Standings, Stats)
- Verify match cards display properly with team records/standings
- Verify bye cards display rosters and stats
- Verify match night banner works for logged-in users
- Verify sub signup form shows level ranges

## Files Modified
- `public/pages/league-view.html` (~6,488 lines)

## Notes
- All existing functionality preserved (fill-in detection, roster display, etc.)
- The `allPlayersById` structure matches original: `{ playerId: { id, name, team_id, position, level, ... } }`
- Uses existing `get3DA()` and `getMPR()` helper functions from `stats-helpers.js`
- `getTeamRecord()` helper function signature unchanged (takes record object with wins/losses/ties)
- No HTML structure or CSS changes
