# Parser Fix: Leg Orientation Normalization

**Date:** 2026-02-04

## Problem

Parser was showing 1-1 ties when matches should be 2-0 sweeps.

### Affected Files
- `temp/trips league/week 1/mezlak v russano.rtf` - Set 1, Set 8
- `temp/trips league/week 1/partlo v olschansky.rtf` - Set 6
- `temp/trips league/week 3/russano v yasenchak.rtf` - Set 9

### Root Cause

The RTF parser determined "home" vs "away" sides based on **position in the RTF line**, not by actual team membership.

```
Format: [Player] [Score] [Remaining] ROUND [Remaining] [Score] [Player]
         ^^^^^^^ = "home"                                      ^^^^^^^ = "away"
```

**The bug:** DartConnect RTF exports can flip the left/right orientation between legs within the same game. This caused:

- Leg 1: Russano on LEFT (parsed as "home") → wins → winner='home'
- Leg 2: Russano on RIGHT (parsed as "away") → wins → winner='away'
- **Result:** 1-1 tie instead of 2-0 sweep

### Example from mezlak v russano.rtf Game 1

**Before fix:**
- Leg 1: winner='away' (Russano team on right in RTF)
- Leg 2: winner='home' (Russano team on left in RTF)
- Score: 1-1 ❌ INVALID

**After fix:**
- Leg 1: winner='away' (Russano team normalized to "away")
- Leg 2: winner='away' (Russano team normalized to "away")
- Score: 0-2 ✅ CORRECT

## Solution

Added `normalizeSideAssignments(game)` function in `temp/parse-rtf.js`.

### Algorithm

1. **Establish canonical orientation from first leg**
   - Get all players from first leg
   - Remember which players were "home" and which were "away"

2. **Check each subsequent leg for flipping**
   - Count how many canonical home players appear on each side
   - Count how many canonical away players appear on each side
   - If more canonical home players are on away side (or vice versa), the leg is flipped

3. **Fix flipped legs**
   - Swap all `side` values in `player_stats`
   - Swap all `side` values in `throws` array
   - Swap the `winner` value

### Code Location

File: `temp/parse-rtf.js`
- Function: `normalizeSideAssignments(game)` (lines 997-1091)
- Called from: `parseMatchSection()` after all legs are parsed

## Testing

Created comprehensive test scripts:

### `scripts/test-parser-leg-counts.js`
Tests a single RTF file for valid leg counts.

### `scripts/test-all-parser-leg-counts.js`
Tests all problematic files at once.

### `scripts/show-parser-orientation.js`
Shows detailed player side assignments for debugging.

## Results

**Before fix:**
- mezlak v russano: 7 valid, 2 invalid
- partlo v olschansky: 8 valid, 1 invalid
- russano v yasenchak: 8 valid, 1 invalid

**After fix:**
- mezlak v russano: 9 valid, 0 invalid ✅
- partlo v olschansky: 9 valid, 0 invalid ✅
- russano v yasenchak: 9 valid, 0 invalid ✅

**Total: 27/27 games valid across all files**

## Impact

This fix ensures:
- ✅ Correct match scores (no more false 1-1 ties)
- ✅ Accurate win/loss records for players and teams
- ✅ Proper standings calculations
- ✅ Correct statistics aggregation

## Files Modified

- `temp/parse-rtf.js` - Added `normalizeSideAssignments()` function
- `scripts/test-parser-leg-counts.js` - Updated test file path
- `scripts/test-all-parser-leg-counts.js` - NEW comprehensive test
- `scripts/show-parser-orientation.js` - NEW debugging tool

## Next Steps

1. Re-import all affected matches using the fixed parser
2. Verify standings are now correct
3. Update any cached statistics
