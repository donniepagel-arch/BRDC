# Notable Event and Checkout Flags Implementation

## Summary
Added notable event detection and checkout/closeout flags to the BRDC match import pipeline. These flags are now set during RTF parsing and preserved through to Firestore storage.

## Changes Made

### 1. RTF Parser (`temp/parse-rtf.js`)

#### New Helper Functions
- `getX01Notable(score)` - Detects notable X01 throws (180, T80, TON+, TON, 95+)
- `getCricketNotable(marks)` - Detects notable Cricket throws (9M, 8M, 7M, 6M, 5M)

#### X01 Throw Flags
Each X01 throw object now includes:
```javascript
{
    notable: string,           // "180", "T80", "TON+", "TON", "95+" (if score >= 95)
    checkout: boolean,         // true if remaining === 0
    checkout_darts: number     // 1, 2, or 3 (darts used for checkout)
}
```

**Detection logic:**
- `notable` flag set based on score value
- `checkout` flag set when `remaining === 0` and not busted
- `checkout_darts` extracted from RTF `DO (n)` markers or defaults to 3

#### Cricket Throw Flags
Each Cricket throw object now includes:
```javascript
{
    notable: string,           // "9M", "8M", "7M", "6M", "5M" (if marks >= 5)
    closed_out: boolean,       // true if this throw closed the game
    closeout_darts: number     // 1, 2, or 3 (darts used on closing round)
}
```

**Detection logic:**
- `notable` flag set based on marks value
- `closed_out` flag set for the final throw of the winner
- `closeout_darts` defaults to 3, adjusted if options.closeoutDarts provided

#### Modified Sections
1. **parse501Leg()** - Lines 347-403
   - Added notable detection for home and away throws
   - Added checkout and checkout_darts flags
   - Updated checkout-only row handling (lines 291-316)

2. **parseCricketLeg()** - Lines 708-813
   - Added notable detection for all throws
   - Added closed_out flag to closing throws
   - Updated winner detection to mark final throw as closeout

3. **Closeout adjustment** - Lines 833-853
   - Updated to also set closeout_darts on throw object when adjusting

### 2. Import Script (`scripts/import-match-from-rtf.js`)

#### Modified Functions
**groupThrowsByRound()** - Lines 252-277
- Preserves all flags when converting throws to Firestore format
- Adds X01 flags: `notable`, `checkout`, `checkout_darts`
- Adds Cricket flags: `notable`, `closed_out`, `closeout_darts`

## Data Structure

### X01 Throw Object (in Firestore)
```javascript
{
    round: 5,
    home: {
        player: "Matt Pagel",
        score: 140,
        remaining: 41,
        notable: "TON+",           // NEW
        checkout: false            // NEW
    },
    away: {
        player: "Donnie Pagel",
        score: 180,
        remaining: 151,
        notable: "180",            // NEW
        checkout: false            // NEW
    }
}
```

### Checkout Throw (X01)
```javascript
{
    round: 12,
    home: {
        player: "Christian Ketchum",
        score: 43,
        remaining: 0,
        notable: null,
        checkout: true,            // NEW
        checkout_darts: 2          // NEW - checked out on 2nd dart
    }
}
```

### Cricket Throw Object (in Firestore)
```javascript
{
    round: 8,
    home: {
        player: "Nathan Kull",
        hit: "T20, T19",
        marks: 6,
        score: 265,
        notable: "6M"              // NEW
    },
    away: {
        player: "Kevin Yasenchak",
        hit: "T20x2, S20",
        marks: 7,
        score: 280,
        notable: "7M"              // NEW
    }
}
```

### Cricket Closeout Throw
```javascript
{
    round: 15,
    away: {
        player: "Brian Smith",
        hit: "DB, DB",
        marks: 4,
        score: 375,
        closed_out: true,          // NEW
        closeout_darts: 2,         // NEW - closed on 2nd dart
        notable: null              // Not 5M+ so no notable flag
    }
}
```

## Notable Thresholds

### X01 Categories
| Label | Score Range | Description |
|-------|-------------|-------------|
| `180` | 180 | Maximum score |
| `T80` | 171-179 | Ton-80 range |
| `TON+` | 140-169 | Ton-40+ (high ton) |
| `TON` | 100-139 | Standard ton |
| `95+` | 95-99 | Near-ton |

### Cricket Categories
| Label | Marks | Description |
|-------|-------|-------------|
| `9M` | 9 | Maximum marks (3 triples) |
| `8M` | 8 | Excellent round |
| `7M` | 7 | Great round |
| `6M` | 6 | Good round |
| `5M` | 5 | Minimum tracked |

## Usage

### For Future Imports
These flags will automatically be added to all future match imports that use:
- `temp/parse-rtf.js` for parsing
- `scripts/import-match-from-rtf.js` for importing

No code changes needed - the flags are now part of the standard data flow.

### For UI Display (Match Hub)
The match-hub.html can now read these flags directly from throw data:

```javascript
// Check if throw is notable
if (throwData.home?.notable) {
    // Display badge: throwData.home.notable ("180", "TON+", etc.)
}

// Check if checkout
if (throwData.away?.checkout) {
    // Display checkout info
    const darts = throwData.away.checkout_darts; // 1, 2, or 3
}

// Check if cricket closeout
if (throwData.home?.closed_out) {
    // Display closeout info
    const darts = throwData.home.closeout_darts;
}
```

### For Feed Generation
The `generateLeagueFeed` cloud function can now use these flags directly instead of re-detecting from raw scores:

```javascript
// Before (manual detection)
if (throwData.home.score >= 140) {
    event.type = 'high_score';
}

// After (use flag)
if (throwData.home.notable) {
    event.type = 'notable_throw';
    event.label = throwData.home.notable;
}
```

## Testing

Run the test script to verify flags are working:
```bash
node test-notable-flags.js
```

Expected output:
- Notable throws detected in X01 legs (180s, tons, etc.)
- Checkout flags with correct dart count
- Notable cricket throws (5M+, 6M+, etc.)
- Cricket closeout flags

## Backfilling Existing Data

This implementation only affects FUTURE imports. To backfill existing matches:

1. Delete existing match data from Firestore
2. Re-run import script: `node scripts/import-match-from-rtf.js`
3. All matches will be reimported with new flags

OR

Create a separate backfill script that:
1. Reads existing match data
2. Iterates through throws
3. Adds flags based on score/marks values
4. Updates Firestore documents

## Related Files

- `temp/parse-rtf.js` - RTF parser with flag detection
- `scripts/import-match-from-rtf.js` - Import script preserving flags
- `functions/generateLeagueFeed.js` - Feed generator (can now use flags)
- `public/pages/match-hub.html` - Match detail view (can display flags)
- `test-notable-flags.js` - Test script to verify implementation

## CLAUDE.md References

- **RULE 15**: Match Data Import System
- **RULE 16**: Stat Calculation - Checkout Darts
- **RULE 17**: Match Data Hierarchy - Sets vs Legs
- **RULE 18**: Checkout and Double-In Categories
- **RULE 19**: Cricket Closeout Categories
- **RULE 20**: Leg Card Display Enhancements

This implementation provides the data foundation for all UI enhancements described in RULE 20.
