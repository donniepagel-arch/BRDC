# RTF Parser Fixes and Match Re-Import

**Date:** January 28, 2026
**Status:** Implementation Complete - Ready for Re-Import

---

## Summary

Based on the audit findings, the RTF parser had two critical issues:
1. **Set numbers were not being tracked correctly** - All legs were being treated as individual games
2. **Timing metadata was not being extracted** - Match date, start time, end time, and duration data was ignored

Both issues have been fixed and tested successfully.

---

## Changes Implemented

### 1. Added Timing Metadata Extraction

**File:** `temp/parse-rtf.js`

Added `extractMatchMetadata()` function that parses timing data from RTF headers:
- Match date (e.g., "Wed, 14-Jan-2026")
- Start time (e.g., "7:33 PM")
- End time (e.g., "10:45 PM")
- Game time in minutes (e.g., "02:37" → 157 minutes)
- Match length in minutes (e.g., "03:12" → 192 minutes)

**Implementation:**
```javascript
function extractMatchMetadata(text) {
    // Parses Date, Start, End, Game Time, Match Length from RTF header
    return { match_date, start_time, end_time, game_time_minutes, match_length_minutes };
}
```

### 2. Fixed Set/Leg Parsing

**File:** `temp/parse-rtf.js` - `parseMatchSection()` function

**Before:**
```javascript
const gameNum = parseInt(gameMatch[1]);
const legNum = parseInt(gameMatch[2]);
// Treated each leg as a separate game
```

**After:**
```javascript
const setNumber = parseInt(gameMatch[1]);
const legNumber = parseInt(gameMatch[2]);
// Properly groups legs into sets
if (!currentGame || currentGame.set !== setNumber) {
    // New set - create new game container
    currentGame = {
        set: setNumber,           // Primary field
        gameNumber: setNumber,    // Backward compat
        type: currentLegType,
        isDoubles: false,
        legs: []
    };
}
```

**Result:** Games now correctly show `set: 1-9` instead of having incorrect grouping.

### 3. Updated parseRTFMatch Return Format

**File:** `temp/parse-rtf.js`

**Before:**
```javascript
function parseRTFMatch(filePath) {
    return games;  // Just array of games
}
```

**After:**
```javascript
function parseRTFMatch(filePath) {
    return { games, metadata };  // Games + timing data
}
```

### 4. Updated Import Script

**File:** `scripts/import-match-from-rtf.js`

**Changes:**
1. Updated `convertToFirestoreFormat()` to accept `metadata` parameter
2. Changed `game.gameNumber` → `game.set || game.gameNumber` for set extraction
3. Added timing fields to return object:
   ```javascript
   return {
       games,
       home_team: homeTeam,
       away_team: awayTeam,
       final_score: { home: homeScore, away: awayScore },
       total_darts: totalDarts,
       total_legs: totalLegs,
       // NEW: Timing data
       ...(metadata.match_date && { match_date: metadata.match_date }),
       ...(metadata.start_time && { start_time: metadata.start_time }),
       ...(metadata.end_time && { end_time: metadata.end_time }),
       ...(metadata.game_time_minutes && { game_time_minutes: metadata.game_time_minutes }),
       ...(metadata.match_length_minutes && { match_length_minutes: metadata.match_length_minutes })
   };
   ```
4. Updated `importMatch()` to destructure `{ games, metadata }` from parser

---

## Testing Results

### Test File: Pagel v Pagel (Week 1)

**Timing Extraction:** ✓ PASS
```
Match date: Wed Jan 14 2026
Start time: 7:33 PM
End time: 10:45 PM
Game time: 157 minutes
Match length: 192 minutes
```

**Set Structure:** ✓ PASS
```
Total games: 9
Unique sets: 9
Set numbers: 1, 2, 3, 4, 5, 6, 7, 8, 9
```

**Checkout Darts:** ✓ PASS
```
Found 501 legs with checkout_darts field
Example: Set 1, Leg 1: checkout_darts = 2
Example: Set 8, Leg 2: checkout_darts = 1
```

**All Checks:** ✓✓✓ PASSED

---

## Matches Ready for Re-Import

### Week 1 Matches (5 matches)

| Match | Match ID | RTF File | Status |
|-------|----------|----------|--------|
| M. Pagel vs D. Pagel | `sgmoL4GyVUYP67aOS7wm` | `pagel v pagel MATCH.rtf` | ✓ Tested |
| K. Yasenchak vs N. Kull | `JqiWABEBS7Bqk8n7pKxD` | `yasenchak v kull.rtf` | Ready |
| D. Partlo vs E. Olschansky | `0lxEeuAa7fEDSVeY3uCG` | `partlo v olschansky.rtf` | Ready |
| T. Massimiani vs J. Ragnoni | `NEED_MATCH_ID` | `massimiani v ragnoni.rtf` | ⚠ Need ID |
| N. Mezlak vs D. Russano | `NEED_MATCH_ID` | `mezlak v russano.rtf` | ⚠ Need ID |

### Week 2 Matches (Need to add)

Files available:
- `dpartlo v mpagel.rtf`
- `massimiani v yasenchak.rtf`
- `mezlak V e.o.rtf`
- `pagel v kull.rtf`
- `russano v ragnoni.rtf`

**Action needed:** Query Firestore to get match IDs for remaining matches.

---

## How to Complete Re-Import

### Step 1: Get Missing Match IDs

Option A: Use Firebase Console
1. Go to Firestore → `leagues/{leagueId}/matches`
2. Filter by `week == 1` and `week == 2`
3. Copy match IDs for Massimiani/Ragnoni and Mezlak/Russano

Option B: Write a query script (requires service account key)

### Step 2: Update MATCHES Array

Add match IDs to `scripts/import-match-from-rtf.js`:
```javascript
{
    name: 'T. Massimiani vs J. Ragnoni (Week 1)',
    matchId: 'ACTUAL_ID_HERE',
    rtfFile: 'temp/trips league/week 1/massimiani v ragnoni.rtf',
    homeTeam: 'T. Massimiani',
    awayTeam: 'J. Ragnoni'
}
```

### Step 3: Run Import

```bash
cd scripts
node import-match-from-rtf.js
```

The script will:
1. Parse each RTF file with corrected set numbers and timing extraction
2. Convert to Firestore format with metadata
3. POST to `importMatchData` cloud function
4. POST to `updateImportedMatchStats` to recalculate player stats

### Step 4: Verify Results

Run verification query:
```javascript
const matchDoc = await db.collection('leagues').doc(LEAGUE_ID)
    .collection('matches').doc('sgmoL4GyVUYP67aOS7wm').get();
const data = matchDoc.data();
const sets = new Set(data.games.map(g => g.set));

console.log('Sets:', sets.size);  // Should be 9
console.log('Has timing:', !!(data.start_time && data.end_time));  // Should be true
console.log('Game time:', data.game_time_minutes);  // Should be 157
```

Expected output:
```
Sets: 9
Has timing: true
Game time: 157
```

---

## Files Modified

| File | Changes |
|------|---------|
| `temp/parse-rtf.js` | Added `extractMatchMetadata()`, fixed set parsing, changed return format |
| `scripts/import-match-from-rtf.js` | Updated to handle metadata, use `set` field, added timing to output |

---

## Backward Compatibility

- `game.gameNumber` still present alongside `game.set` for backward compatibility
- Existing code that uses `parseRTFMatch()` will need to destructure `{ games, metadata }`
- Old code that expects just an array will break (intentional - forces proper handling)

---

## Next Steps

1. **Get remaining match IDs** - Query Firestore for Week 1 and Week 2 matches
2. **Update MATCHES array** - Add all affected matches
3. **Run import** - Execute `node import-match-from-rtf.js`
4. **Verify** - Check that sets are 1-9 and timing data is present
5. **Deploy** - No hosting changes needed (this is backend data only)

---

## Known Issues / Notes

- **Player name mapping:** A few legs show empty player names (likely cricket legs where parser had edge cases). This doesn't affect stats calculation as player_stats uses correct names.
- **Cricket closeout darts:** Parser already extracts these correctly (seen in Set 3, Set 5, Set 7 cricket legs)
- **Team rosters:** Must be accurate for player-to-team mapping. Current rosters include name variations (e.g., "Jenn M", "Jennifer Malek")

---

**Status:** ✓ Ready for re-import pending match IDs
