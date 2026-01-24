# X01 Scorer Fixes - Agent Report

**Date:** 2026-01-24
**File Modified:** `/public/pages/x01.html`
**Status:** Complete - Ready for deployment

---

## Changes Made

### 1. Master Out Implementation

**Problem:** The game setup allowed selecting "Master Out" (finish on double OR triple) via the create-league page, but x01.html only validated "free" and "double" out options.

**Solution:**
- Updated the OUT RULE UI from a simple ON/OFF toggle to three options: FREE / DOUBLE / MASTER
- Added new `setOutOption(option)` function to handle all three states
- Updated `enterScore()` to properly validate Master Out (allows double OR triple finish)
- When checking out with Double or Master out rules, shows a confirmation modal asking which type of finish was achieved

**UI Changes:**
```html
<!-- Before -->
<div class="option-label">DOUBLE OUT</div>
<button onclick="toggleDO(false)">OFF</button>
<button onclick="toggleDO(true)">ON</button>

<!-- After -->
<div class="option-label">OUT RULE</div>
<button onclick="setOutOption('free')">FREE</button>
<button onclick="setOutOption('double')">DOUBLE</button>
<button onclick="setOutOption('master')">MASTER</button>
```

**Checkout Confirmation Modal:**
- For Double Out: Shows "YES - DOUBLE OUT" or "NO - BUST" options
- For Master Out: Shows "DOUBLE OUT", "TRIPLE OUT", or "BUST" options
- Stores `finish_type` on the throw record for stat tracking

---

### 2. Impossible Score Validation

**Problem:** The scorer accepted mathematically impossible 3-dart scores like 179, 178, 176, etc.

**Solution:**
- Added `IMPOSSIBLE_SCORES` constant with all impossible values between 160-180
- Added validation in `enterScore()` that rejects these scores with a clear error message

**Impossible Scores (160-180 range):**
- 163, 166, 169, 172, 173, 175, 176, 178, 179

**Implementation:**
```javascript
const IMPOSSIBLE_SCORES = [163, 166, 169, 172, 173, 175, 176, 178, 179];

// In enterScore():
if (IMPOSSIBLE_SCORES.includes(score)) {
    alert('Invalid score - ' + score + ' is not achievable with 3 darts');
    clearInput();
    return;
}
```

---

### 3. Checkout Dart Count Prompt

**Problem:** When a player checked out, the system assumed 3 darts were thrown, which threw off 3-dart average calculations.

**Solution:**
- Added a new modal that appears after every checkout asking "How many darts to checkout?" with buttons for 1, 2, or 3
- Stores `checkout_darts` on the throw record
- Updated `calculateLegStats()` to properly account for checkout darts in total dart calculations
- Supports both the new `checkout_darts` field and legacy `dart` field for backwards compatibility

**New Modal HTML:**
```html
<div class="winner-modal" id="checkoutDartsModal">
    <div class="winner-content">
        <div class="winner-title">CHECKOUT: [score]</div>
        <div>How many darts to checkout?</div>
        <button onclick="selectCheckoutDarts(1)">1</button>
        <button onclick="selectCheckoutDarts(2)">2</button>
        <button onclick="selectCheckoutDarts(3)">3</button>
    </div>
</div>
```

**Data Structure:**
```javascript
// Throw record now includes:
{
    total: 43,
    checkout: true,
    checkout_darts: 2,      // NEW: 1, 2, or 3
    finish_type: 'double'   // NEW: 'free', 'double', or 'triple'
}
```

---

### 4. Save Game Config Updates

Updated the `match_config` object sent to the cloud function to include the new out options:

```javascript
match_config: {
    bestOfLegs: gameState.bestOfLegs,
    bestOfSets: gameState.bestOfSets,
    outOption: gameState.outOption,    // 'free', 'double', or 'master'
    inOption: gameState.inOption,      // 'free' or 'double'
    // Legacy fields for backwards compatibility
    doubleOut: gameState.outOption === 'double',
    masterOut: gameState.outOption === 'master',
    doubleIn: gameState.inOption === 'double'
}
```

---

## Testing Checklist

- [ ] Free Out: Can checkout on any score without confirmation
- [ ] Double Out: Checkout requires confirmation (YES - DOUBLE OUT / NO - BUST)
- [ ] Master Out: Checkout shows three options (DOUBLE OUT / TRIPLE OUT / BUST)
- [ ] Impossible scores (179, 178, etc.) are rejected with error message
- [ ] Checkout dart count modal appears after every checkout
- [ ] Stats are saved correctly with checkout_darts and finish_type
- [ ] Bust on score 1 works correctly for both Double and Master out

---

## Files Changed

1. `/public/pages/x01.html` - All changes in this single file

## Deployment

Ready for deployment with:
```bash
firebase deploy --only hosting
```
