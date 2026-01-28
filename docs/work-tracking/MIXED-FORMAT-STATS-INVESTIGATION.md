# Mixed Format Stats Investigation Report

**Date**: 2026-01-28
**Issue**: Agent 5 reported that stats "carry over incorrectly" in mixed format games
**Investigated by**: Terminal Agent

---

## Summary

**CONFIRMED BUG**: In mixed format games (e.g., 501 → Cricket → 501), the running 501 average does NOT correctly accumulate across all 501 legs. The cumulative stats are lost when switching game types.

---

## Expected Behavior (Per User Clarification)

When playing mixed format (501, cricket, 501 in a set), the scorer should track:

1. **Combined running 501 average** across ALL 501 legs (regardless of cricket legs in between)
2. **Combined running cricket MPR** across ALL cricket legs (regardless of 501 legs in between)
3. **Current leg stats** separately for each individual leg

**Example Scenario:**
- Leg 1: 501 (45 avg)
- Leg 2: Cricket (2.5 MPR)
- Leg 3: 501 (50 avg)

**Expected 501 Running Average**: (45+50)/2 = **47.5 avg**
**Actual Behavior**: Leg 3 shows only ~50 avg (leg 1 stats lost)

---

## Root Cause Analysis

### How Mixed Format Works Currently

1. **Game 1 (501)**: User plays 501, stats accumulate in `teams[0].darts`, `teams[0].points`
2. **Navigate to Game 2 (Cricket)**:
   - Code stores `home_legs` and `away_legs` in sessionStorage
   - **Page reloads** with `window.location.href = '/pages/league-cricket.html?...'`
   - `teams` array is **reinitialized** to all zeros (darts: 0, points: 0, etc.)
   - Cricket leg completes
3. **Navigate to Game 3 (501)**:
   - Code stores updated `home_legs` and `away_legs`
   - **Page reloads** with `window.location.href = '/pages/x01-scorer.html?...'`
   - `teams` array is **reinitialized AGAIN** to all zeros
   - **STATS FROM GAME 1 ARE LOST**

### Code References

**Where teams are initialized** (x01-scorer.html, lines 2063-2106):
```javascript
const teams = [
    {
        name: homePlayers.map(p => p?.name || 'Home').join(' & ') || 'Home',
        score: STARTING_SCORE,
        legs: 0,
        darts: 0,     // ← RESET TO 0 ON EVERY PAGE LOAD
        points: 0,    // ← RESET TO 0 ON EVERY PAGE LOAD
        tons: 0,
        // ... more stats
    },
    { /* same for away team */ }
];
```

**Where legs are restored** (x01-scorer.html, lines 2118-2123):
```javascript
// Load leg scores from URL params (for mixed game mode)
if (isMixedGame) {
    const homeLegsParam = parseInt(params.get('home_legs') || '0');
    const awayLegsParam = parseInt(params.get('away_legs') || '0');
    teams[0].legs = homeLegsParam;  // ← Only legs are restored
    teams[1].legs = awayLegsParam;  // ← NOT darts, points, or other cumulative stats
}
```

**Where stats are saved before navigation** (x01-scorer.html, lines 3910-3914):
```javascript
// Update match score in sessionStorage
mixedConfig.current_leg = nextLegIndex;
mixedConfig.home_legs = teams[0].legs;      // ← Only legs saved
mixedConfig.away_legs = teams[1].legs;      // ← NOT cumulative stats
sessionStorage.setItem('mixedGameConfig', JSON.stringify(mixedConfig));
```

### What's Missing

The `mixedGameConfig` in sessionStorage needs to store:

**For 501 stats:**
- `x01_darts` (cumulative darts thrown in 501 games)
- `x01_points` (cumulative points scored in 501 games)
- `x01_tons`, `x01_ton40s`, `x01_ton80s`
- `x01_checkouts`, `x01_checkout_attempts`
- `x01_high_checkout`, `x01_high_score`
- `x01_legs_played` (count of 501 legs, for correct averaging)

**For Cricket stats:**
- `cricket_marks` (cumulative marks in cricket games)
- `cricket_rounds` (cumulative rounds thrown in cricket games)
- `cricket_legs_played` (count of cricket legs)
- Other cricket-specific stats

---

## The Fix

### Option 1: Store Cumulative Stats in sessionStorage (Recommended)

**When leaving a 501 leg** (in `nextLeg()` function):
```javascript
// If this was a 501 game, save cumulative 501 stats
if (!nextLeg || nextLeg.type !== 'cricket') {
    mixedConfig.x01_stats = {
        darts: teams[0].darts,
        points: teams[0].points,
        tons: teams[0].tons,
        ton40s: teams[0].ton40s,
        ton80s: teams[0].ton80s,
        checkouts: teams[0].totalCheckouts,
        checkout_attempts: teams[0].checkoutAttempts,
        high_checkout: teams[0].highCheckout,
        high_score: teams[0].highScore,
        legs_played: /* count 501 legs */
    };
    mixedConfig.x01_stats_away = { /* same for away */ };
}
```

**When initializing a 501 leg** (after line 2123):
```javascript
// Restore cumulative 501 stats if returning to 501 from mixed format
if (isMixedGame) {
    const mixedConfig = JSON.parse(sessionStorage.getItem('mixedGameConfig') || '{}');
    if (mixedConfig.x01_stats) {
        teams[0].darts = mixedConfig.x01_stats.darts || 0;
        teams[0].points = mixedConfig.x01_stats.points || 0;
        teams[0].tons = mixedConfig.x01_stats.tons || 0;
        // ... restore all cumulative stats
    }
    if (mixedConfig.x01_stats_away) {
        teams[1].darts = mixedConfig.x01_stats_away.darts || 0;
        teams[1].points = mixedConfig.x01_stats_away.points || 0;
        // ... restore all cumulative stats
    }
}
```

### Option 2: Use legStats Array (Alternative)

Instead of relying on `teams[].darts` and `teams[].points`, calculate running averages by:
1. Filtering `legStats[0]` for only 501 legs
2. Summing darts and points across those legs
3. Calculating average on-the-fly

**Pros**: No sessionStorage needed
**Cons**: Requires refactoring how averages are displayed throughout the UI

---

## Impact Assessment

### Affected Functionality

1. **Match Averages** (displayed during game) - WRONG
2. **Leg Modal Stats** (shown after each leg) - WRONG
3. **Final Game Modal** (shown when match ends) - WRONG
4. **Saved Match Data** (submitted to Firestore) - LIKELY WRONG

### What Still Works

- Leg counts (preserved correctly)
- Individual leg stats (each leg's stats are correct in isolation)
- Throw history per leg (preserved in `legStats` and `legThrowsHistory`)

---

## Recommendation

**Implement Option 1** (sessionStorage for cumulative stats) because:
1. Minimal code changes
2. Preserves current architecture
3. Works for both singles and doubles
4. Already using sessionStorage for `mixedGameConfig`

**Testing scenarios:**
1. Play 501 → Cricket → 501 (verify 501 avg includes leg 1 + leg 3)
2. Play Cricket → 501 → Cricket (verify cricket MPR includes leg 1 + leg 3)
3. Play 301 → 501 → 301 (verify each 301/501 tracks separately)
4. Verify final match stats submitted to Firestore include correct averages

---

## Files to Modify

1. **x01-scorer.html** (lines 3910-3949): Add cumulative stats to `mixedGameConfig` before navigation
2. **x01-scorer.html** (lines 2118-2123): Restore cumulative stats on page init if mixed format
3. **league-cricket.html** (similar changes for cricket MPR tracking)

---

## Status

**INVESTIGATION COMPLETE**
**FIX REQUIRED**: Yes
**Priority**: High (affects match stat accuracy)
