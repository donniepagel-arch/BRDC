# Throw Data Analysis - February 7, 2026

## Finding: Notable Events and Checkouts Are NOT Stored

Inspection of the Pagel v Pagel Week 1 match (sgmoL4GyVUYP67aOS7wm) reveals that throw data **DOES NOT include**:
- `notable` field (for 180s, tons, high scores)
- `checkout` field (for X01 checkouts)
- `closed_out` field (for cricket closeouts)
- `checkout_darts` field (for tracking partial checkout rounds)

### Evidence
```
High scores (100+) in first X01 leg: 2 found
  Away: Christian Ketchum scored 140, notable: undefined
  Home: Joe Peters scored 101, notable: undefined

High marks (5+) in first cricket leg: 3 found
  Home: Joe Peters marks=5, notable: undefined
  Home: Joe Peters marks=5, notable: undefined
  Away: Donnie Pagel marks=5, notable: undefined

TOTALS across entire 9-game match:
  Throws with 'notable' field: 0
  Throws with 'checkout' field: 0
```

## Data Actually Present
What IS stored for each throw:
```javascript
// X01 throw
{
  player: "Matt Pagel",
  score: 60,           // Points scored in this round
  remaining: 441,      // Points left to 501
}

// Cricket throw
{
  player: "Matt Pagel",
  hit: "S19",          // Dart hit notation
  score: 0,            // Score value (different from X01)
  marks: 1             // Number of marks scored
}
```

## Implications

### For UI Display
Cannot highlight 180s, tons, or high scores without:
1. **Option A:** Calculate from raw scores at render time
2. **Option B:** Re-parse throws data on import with detected notable events
3. **Option C:** Add a post-processing function to import pipeline

### For Match-Hub Games Tab
The leg cards won't show:
- Cork indicator (can't detect first throw player)
- Checkout values (`★ OUT: 43`)
- Cricket closeouts (`★ CLOSED (7M)`)
- "Left: X" remaining score for loser

### For Stats Calculations
Cannot track checkout percentages without:
- Identifying which throws were checkout attempts
- Counting successful vs missed checkout attempts
- Categorizing by range (60-99, 100-139, etc.)

### For Leaderboards
Cannot show:
- Total 180s
- Ton+ count
- Checkout success rate
- Tons per round average
- Cricket closeout counts

## Root Cause
The match import system (`scripts/import-match-from-rtf.js`) processes RTF files but **does not detect notable events** during parsing. The RTF parser (`temp/parse-rtf.js`) extracts raw throw data but doesn't:
- Detect 180s (T20 + T20 + T20 = 180)
- Detect tons (100-179)
- Detect checkouts (when remaining = 0)
- Detect cricket closeouts (final throw with marks)
- Count darts on checkout rounds

## Solution Strategy
Add post-processing to match import:

1. **During RTF import**, after parsing throws but before Firestore write:
   - Iterate each throw
   - Calculate derived fields: `notable`, `checkout`, `checkout_darts`
   - Set `closed_out` and `closeout_darts` for cricket

2. **Add detection functions:**
   - `detectNotable(throw, legFormat)` → detects 180, tons, etc.
   - `detectCheckout(throw, remaining)` → detects checkouts
   - `detectCricketCloseout(throw, isLastThrow, legWinner)` → detects cricket closure

3. **Store these fields** in throw document before inserting

4. **For existing matches**, run a migration to add these fields retroactively

## Next Steps
See THROW-DATA-DETECTION.md for implementation plan
