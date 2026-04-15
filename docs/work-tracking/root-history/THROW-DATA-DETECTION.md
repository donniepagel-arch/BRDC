# Implementation Plan: Throw Data Detection

**Status:** Planning  
**Started:** February 7, 2026  
**Scope:** Add notable event detection to match import pipeline

---

## Phase 1: Add Detection Functions (No Data Changes)

Create lib/throw-detectors.js with pure functions:

### X01 Notable Detection
- 180 = maximum
- ton-plus = 140-179
- ton = 100-139
- near-ton = 95-99
- null = less than 95

### Checkout Detection
- isCheckout: remaining === 0
- countCheckoutDarts: count darts in current round

### Cricket Detection
- isCricketCloseout: isLastThrow && legWinner threw it
- countCloseoutDarts: count hits in closing throw

---

## Phase 2: Integrate into Import Pipeline

Modify scripts/import-match-from-rtf.js:

1. After parsing RTF, iterate all throws
2. For X01 legs:
   - Set throw.home.notable and throw.away.notable
   - Set throw.home.checkout and throw.home.checkout_darts if remaining === 0
   - Same for away
3. For Cricket legs:
   - Set throw.home.closed_out and throw.home.closeout_darts for winner
   - Same for away

---

## Phase 3: Cloud Function Updates

Update functions/importMatchData.js:

- Preserve detection fields (notable, checkout, checkout_darts, closed_out, closeout_darts)
- No stripping anymore
- Write to Firestore as-is

---

## Phase 4: Render-Time Fallback

For existing matches without detection fields, UI can detect from raw data:

```
getThrowNotable(throw):
  if throw.notable return it
  else if throw.score == 180 return '180'
  else if throw.score >= 140 return 'ton-plus'
  else if throw.score >= 100 return 'ton'
  else if throw.score >= 95 return 'near-ton'
  else return null

isThrowCheckout(throw):
  return throw.checkout === true || throw.remaining === 0
```

---

## Phase 5: Migration for Existing Matches

Create scripts/add-detection-fields-to-matches.js:

1. Iterate all leagues and matches
2. For each match without detection fields:
   - Apply Phase 1-2 logic (enrichment)
   - Write back to Firestore
3. Log progress

---

## Testing Plan

### Unit Tests
- detectNotableX01(180) -> '180'
- detectNotableX01(140) -> 'ton-plus'
- isCheckout(0) -> true, isCheckout(1) -> false

### Integration Tests
1. Import match with RTF
2. Verify throws have detection fields
3. Verify checkouts marked correctly
4. Verify cricket closeouts marked correctly

### UI Tests
1. Match Hub Games Tab shows cork indicator
2. Checkout values display (★ OUT: 43)
3. Cricket closeouts display (★ CLOSED (7M))
4. Leaderboards show stats

---

## Timeline

| Phase | Effort | Depends |
|-------|--------|---------|
| 1: Detection functions | 2 hrs | None |
| 2: Import integration | 1 hr | Phase 1 |
| 3: Cloud functions | 30 min | Phase 2 |
| 4: UI fallback | 1 hr | Parallel |
| 5: Migration | 2 hrs | Phase 1 |
| Testing & deploy | 2 hrs | All |
| **TOTAL** | **8.5 hrs** | |

---

## Deployment Order

1. Deploy Phase 1 + 2 (detection in import)
2. Test with new match import
3. Deploy Phase 3 (cloud function)
4. Deploy Phase 4 (UI fallback)
5. Run Phase 5 migration
6. Verify UI displays correctly
7. Deploy Match Hub with cork, checkout, closeout display

---

## Files to Create/Modify

### New
- lib/throw-detectors.js
- scripts/add-detection-fields-to-matches.js
- tests/throw-detectors.test.js

### Modified
- scripts/import-match-from-rtf.js
- functions/importMatchData.js
- public/pages/match-hub.html
- public/js/live-ticker.js

### Unchanged
- temp/parse-rtf.js (raw data only)
