# Investigation Summary: Why Match Hub Can't Show Notable Throws

**Date:** February 7, 2026  
**Status:** ANALYSIS COMPLETE - IMPLEMENTATION PLAN READY

---

## The Problem

Match-Hub Games Tab cannot display:
- Cork indicators (C badge for first-throw player)
- Checkout values (★ OUT: 43)
- Cricket closeouts (★ CLOSED (7M))
- Notable throw stats (180s, tons, checkout %, cricket closeouts)

**Why?** Throw data in Firestore lacks detection fields.

---

## Root Cause

Inspection of actual match data (Pagel v Pagel, Week 1):
- 51 throws analyzed
- 0 with `notable` field (for 180s, tons)
- 0 with `checkout` field (for checkouts)
- 0 with `closed_out` field (for cricket closeouts)

**High scores ARE present in data:**
- Christian Ketchum scored 140 (unmarked)
- Joe Peters scored 101 (unmarked)
- Multiple 5+ mark cricket throws (unmarked)

---

## What's Actually Stored

```javascript
// X01 throw
{ player: "Matt Pagel", score: 60, remaining: 441 }

// Cricket throw
{ player: "Matt Pagel", hit: "S19", marks: 1 }
```

**Missing:** detection fields that flag notable events

---

## The Solution

**5-phase implementation plan** (8.5 hours total):

### Phase 1: Detection Library (2 hrs)
Create `lib/throw-detectors.js` with pure functions:
- detectNotableX01(score) → '180'|'ton-plus'|'ton'|'near-ton'|null
- isCheckout(remaining) → boolean
- countCheckoutDarts(throws, index, remaining) → 1-3
- isCricketCloseout(throws, index, winner) → boolean
- countCloseoutDarts(throws, index, winner) → 1-3

### Phase 2: Import Integration (1 hr)
Modify `scripts/import-match-from-rtf.js`:
- After parsing RTF, enrich throws with detection
- Set `notable`, `checkout`, `checkout_darts` fields
- Set `closed_out`, `closeout_darts` for cricket
- Write enriched data to Firestore

### Phase 3: Cloud Function Updates (30 min)
Update `functions/importMatchData.js`:
- Preserve detection fields (don't strip them)
- Write to Firestore as-is

### Phase 4: UI Fallback (1 hr)
For existing matches without detection:
- Calculate from raw scores at render time
- isCheckout() = remaining === 0
- detectNotable() = analyze score value

### Phase 5: Migration (2 hrs)
`scripts/add-detection-fields-to-matches.js`:
- Backfill all existing matches
- Apply Phase 1 logic to historical data

### Testing & Deploy (2 hrs)
- Unit tests for detection functions
- Integration tests with RTF imports
- UI tests in Match Hub

---

## Impact

### Once Implemented

✅ Match Hub Games Tab shows:
- Cork indicators
- Checkout values
- Cricket closeouts
- Notable throw highlighting

✅ Leaderboards can show:
- Total 180s per player
- Tons thrown
- Checkout success rate by range (60-99, 100-139, etc.)
- Cricket closeout distribution (9M, 8M, 7M, etc.)

✅ Stats aggregation works correctly:
- Including checkout_darts in 3DA calculation
- Cricket closeout marks per player
- Checkout performance tracking

---

## Documents Created

1. **THROW-DATA-ANALYSIS.md**
   - Evidence of missing detection fields
   - Data structure analysis
   - Implications for UI and stats

2. **THROW-DATA-DETECTION.md**
   - 5-phase implementation plan
   - Code patterns and examples
   - Timeline and dependencies

3. **DETECTION-REQUIREMENTS.md**
   - Specification for each detection field
   - Display usage
   - Stats aggregation rules

4. **docs/work-tracking/THROW-DATA-MISSING.md**
   - Discovery summary
   - Next steps checklist

---

## Next Steps

1. **Review** THROW-DATA-DETECTION.md for implementation plan
2. **Approve** to proceed with Phase 1-2 (new matches detection)
3. **Implement** detection library and import integration
4. **Test** with new RTF match import
5. **Deploy** to Firebase
6. **Backfill** existing matches (Phase 5)
7. **Update** Match Hub UI with cork/checkout/closeout display

---

## Cost vs Value

| Effort | Benefit |
|--------|---------|
| 8.5 hours | Match Hub fully featured |
|  | Leaderboards with notable stats |
|  | Correct 3DA calculation (checkout_darts) |
|  | Professional match reports |

Payoff: High-quality match analytics that competitors can't match.

---

## File Locations

```
c:\Users\gcfrp\projects\brdc-firebase\
  ├── THROW-DATA-ANALYSIS.md
  ├── THROW-DATA-DETECTION.md
  ├── DETECTION-REQUIREMENTS.md
  ├── SUMMARY.md (this file)
  └── docs\work-tracking\THROW-DATA-MISSING.md
```

