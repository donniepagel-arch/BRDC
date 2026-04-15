# Discovery: Missing Throw Data Detection - February 7, 2026

## Problem Statement

Match-Hub Games Tab cannot display:
- Cork indicators (first throw player)
- Checkout values (★ OUT: 43)
- Cricket closeouts (★ CLOSED (7M))
- Leaderboard stats (180s, tons, checkout %, cricket closeouts)

**ROOT CAUSE:** Throw data in Firestore does NOT include detection fields

---

## Evidence

Inspection of Pagel v Pagel Week 1 match (sgmoL4GyVUYP67aOS7wm):

```
Throws examined: 51 total
Throws with 'notable' field: 0
Throws with 'checkout' field: 0
Throws with 'closed_out' field: 0

But high scores ARE present:
  Christian Ketchum scored 140 (no notable marker)
  Joe Peters scored 101 (no notable marker)
  Multiple 5+ mark throws in cricket (no markers)
```

**Data structure present:**
```javascript
throw.home = {
  player: "Matt Pagel",
  score: 60,       // For X01
  remaining: 441,  // For X01
  hit: "S19",      // For cricket
  marks: 1         // For cricket
}
// Missing: notable, checkout, checkout_darts, closed_out, closeout_darts
```

---

## Impact

### What we CAN'T display without detection:
1. **Cork indicator** - Don't know who threw first
2. **Checkout values** - Can't identify checkout throws
3. **Cricket closeouts** - Can't identify closing throws
4. **Leaderboards with:**
   - Total 180s
   - Tons thrown
   - Checkout success rate
   - Cricket closeout counts

### What we CAN still display:
- Player stats (3DA, MPR from aggregated stats)
- Set winners
- Leg format and scores
- Player names and teams

---

## Solution Architecture

**5-Phase implementation plan documented in THROW-DATA-DETECTION.md**

### Phase 1: Create detection library (lib/throw-detectors.js)
Pure functions to detect from raw data:
- `detectNotableX01(score)` → '180', 'ton-plus', 'ton', 'near-ton', null
- `isCheckout(remaining)` → boolean
- `countCheckoutDarts(throws, index, remaining)` → 1-3
- `isCricketCloseout(throws, index, winner)` → boolean
- `countCloseoutDarts(throws, index, winner)` → 1-3

### Phase 2: Integrate into import pipeline
Modify scripts/import-match-from-rtf.js to enrich throws before Firestore write

### Phase 3: Update cloud functions
Preserve detection fields in importMatchData.js

### Phase 4: UI fallback
For existing matches, detect from raw scores at render time

### Phase 5: Migration
Backfill all existing matches with detection fields

---

## Timeline

- **Full implementation:** 8.5 hours
- **Phase 1-2 (new matches):** 3 hours
- **Phase 4 (UI fallback):** 1 hour
- **Phase 5 (backfill):** 2 hours
- **Testing & deploy:** 2 hours

---

## Next Steps

1. **Approve:** Review THROW-DATA-DETECTION.md implementation plan
2. **Implement:** Create detection functions + import integration
3. **Test:** Verify with new RTF match import
4. **Deploy:** Push to Firebase
5. **Backfill:** Run migration on existing matches
6. **UI Update:** Implement cork, checkout, closeout display in Match Hub

---

## Files Referenced

- **Analysis:** c:\Users\gcfrp\projects\brdc-firebase\THROW-DATA-ANALYSIS.md
- **Plan:** c:\Users\gcfrp\projects\brdc-firebase\THROW-DATA-DETECTION.md
- **Inspection script:** checked-throw-data.js (temp location)
