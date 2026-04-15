# Throw Data Detection Implementation Checklist

**Status:** READY FOR IMPLEMENTATION  
**Total Effort:** 8.5 hours  
**Dependencies:** None (can start immediately)

---

## Phase 1: Detection Library (2 hours)

- [ ] Create `lib/throw-detectors.js`
- [ ] Implement `detectNotableX01(score)`
  - [ ] Test with 180
  - [ ] Test with 140+
  - [ ] Test with 100+
  - [ ] Test with 95+
- [ ] Implement `isCheckout(remaining)`
- [ ] Implement `countCheckoutDarts(throws, index, remaining)`
  - [ ] Test counting 1-dart checkouts
  - [ ] Test counting 2-dart checkouts
  - [ ] Test counting 3-dart checkouts
- [ ] Implement `isCricketCloseout(throws, index, winner)`
- [ ] Implement `countCloseoutDarts(throws, index, winner)`
  - [ ] Test hit notation parsing
  - [ ] Test marking separation

**Definition of Done:**
- [ ] All functions have unit tests
- [ ] Functions handle edge cases (null, undefined, empty arrays)
- [ ] Exported for use in other modules

---

## Phase 2: Import Integration (1 hour)

- [ ] Modify `scripts/import-match-from-rtf.js`
- [ ] Add import of throw-detectors library
- [ ] Create `enrichThrowsWithDetection(game)` function
  - [ ] Iterate all games
  - [ ] Iterate all legs
  - [ ] Iterate all throws
  - [ ] For X01 legs:
    - [ ] Detect notable for home throws
    - [ ] Detect notable for away throws
    - [ ] Detect checkouts for home
    - [ ] Detect checkouts for away
    - [ ] Set checkout_darts
  - [ ] For cricket legs:
    - [ ] Detect closeouts for final throw
    - [ ] Set closeout_darts
- [ ] Call enrichment before posting to importMatchData
- [ ] Test with reference match (Pagel v Pagel Week 1)

**Definition of Done:**
- [ ] Import script adds detection fields before Firestore write
- [ ] New imports have all detection fields populated
- [ ] No data is lost or corrupted

---

## Phase 3: Cloud Function Updates (30 minutes)

- [ ] Open `functions/importMatchData.js`
- [ ] Review current field stripping logic
- [ ] Update to preserve detection fields
  - [ ] Don't strip `notable`
  - [ ] Don't strip `checkout`
  - [ ] Don't strip `checkout_darts`
  - [ ] Don't strip `closed_out`
  - [ ] Don't strip `closeout_darts`
- [ ] Test cloud function with enriched data

**Definition of Done:**
- [ ] Detection fields are written to Firestore
- [ ] No errors in cloud function logs
- [ ] Firestore documents contain the new fields

---

## Phase 4: UI Fallback (1 hour)

- [ ] Create `lib/throw-display-helpers.js`
- [ ] Implement `getThrowNotable(throwData)`
  - [ ] Return stored notable if present
  - [ ] Fallback to detectNotableX01(score)
- [ ] Implement `isThrowCheckout(throwData)`
  - [ ] Return checkout field if present
  - [ ] Fallback to remaining === 0
- [ ] Add to `public/js/match-hub.js`
- [ ] Test with old match (no detection fields)
- [ ] Test with new match (with detection fields)

**Definition of Done:**
- [ ] Old matches work (fallback detection)
- [ ] New matches work (stored detection)
- [ ] No console errors
- [ ] UI renders correctly

---

## Phase 5: Migration Script (2 hours)

- [ ] Create `scripts/add-detection-fields-to-matches.js`
- [ ] Import detection library
- [ ] Create `migrateMatch(leagueId, matchId)` function
  - [ ] Load match from Firestore
  - [ ] Check if already has detection
  - [ ] Enrich with detection (copy Phase 2 logic)
  - [ ] Write back to Firestore
  - [ ] Log progress
- [ ] Create `runMigration()` function
  - [ ] Iterate all leagues
  - [ ] Iterate all matches in each league
  - [ ] Call migrateMatch for each
  - [ ] Count processed matches
- [ ] Test on small subset (5-10 matches)
- [ ] Run full migration on all matches

**Definition of Done:**
- [ ] All existing matches have detection fields
- [ ] No matches are corrupted
- [ ] Migration completes without errors
- [ ] Stats calculations use new fields

---

## Phase 6: Testing & Validation (2 hours)

### Unit Tests
- [ ] Test detectNotableX01 with all inputs
- [ ] Test isCheckout edge cases
- [ ] Test countCheckoutDarts with various round structures
- [ ] Test cricket detection with different leg structures

### Integration Tests
- [ ] Import new RTF match → verify detection fields added
- [ ] Query random existing match → verify has detection fields
- [ ] Render old match in UI → verify fallback works
- [ ] Render new match in UI → verify detection used

### UI Tests
- [ ] Cork indicator displays correctly
- [ ] Checkout values show ("★ OUT: 43")
- [ ] Cricket closeouts show ("★ CLOSED (7M)")
- [ ] Notable throws highlighted (180, tons, etc.)

### Performance Tests
- [ ] Migration completes in reasonable time (< 5 min for 100 matches)
- [ ] UI renders fast with detection (no lag)
- [ ] Firestore reads don't slow down

**Definition of Done:**
- [ ] All tests pass
- [ ] No regressions in existing features
- [ ] UI is performant

---

## Phase 7: Documentation & Deployment (1 hour)

- [ ] Update CLAUDE.md with detection field reference
- [ ] Document stats aggregation logic
- [ ] Update API docs if applicable
- [ ] Prepare deployment checklist
- [ ] Deploy to Firebase (functions + hosting)
- [ ] Monitor for errors post-deployment

**Definition of Done:**
- [ ] Documentation is current
- [ ] Deployment is smooth
- [ ] No errors in production

---

## Quick Reference

### Detection Fields Added to Throws

```javascript
// X01 throws
throw.notable = '180' | 'ton-plus' | 'ton' | 'near-ton' | null
throw.checkout = true | undefined
throw.checkout_darts = 1 | 2 | 3 | undefined

// Cricket throws
throw.closed_out = true | undefined
throw.closeout_darts = 1 | 2 | 3 | undefined
```

### Files to Create
- lib/throw-detectors.js
- lib/throw-display-helpers.js
- scripts/add-detection-fields-to-matches.js
- tests/throw-detectors.test.js

### Files to Modify
- scripts/import-match-from-rtf.js
- functions/importMatchData.js
- public/js/match-hub.js
- CLAUDE.md

### No Changes Needed
- temp/parse-rtf.js
- Match data schema
- Firestore structure

---

## Blockers & Dependencies

✅ No blockers  
✅ Can start immediately after approval  
✅ All phases independent or sequential only

---

## Approval

**Ready to start:** YES / NO (circle one)

**Approved by:**  
**Date:**

