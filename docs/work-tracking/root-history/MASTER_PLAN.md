# BRDC Master Plan - League Night Ready
**Generated:** 2026-01-21
**Priority:** Get the system working for league night TONIGHT

---

## Executive Summary

The BRDC app has **solid foundations** but needs targeted fixes before league night. The critical path (login → match hub → scorer → stats) works, but **doubles stats attribution is broken**.

---

## 🚨 CRITICAL FIX NEEDED TONIGHT

### Doubles Per-Player Throw Tracking

**Problem:** In doubles games, both players get credited with 100% of team stats instead of their individual throws.

**Root Cause:** The scorer (`league-501.html`) only tracks `activeTeam`, not which player within the team threw.

**Terminal 2 is working on this fix.**

**If not fixed tonight:** Stats from doubles games (Games 1, 4, 7 in triples format) will be inflated.

---

## Quick Wins (Do These Now)

| # | Fix | File | Time |
|---|-----|------|------|
| 1 | **Enable nav menu** on scorer-hub | `scorer-hub.html:451` | 2 min |
| 2 | **Add leave warning** to scorers | `league-501.html`, `league-cricket.html` | 5 min |
| 3 | **Fix return navigation** | `league-501.html:3000-3041` | 15 min |

### Fix 1: Enable Nav Menu
```javascript
// scorer-hub.html line 451 - UNCOMMENT this:
<script src="/js/nav-menu.js"></script>
```

### Fix 2: Add Leave Warning
Add to both scorers near the top of the script section:
```javascript
window.onbeforeunload = function(e) {
    if (gameInProgress) {
        return "You have an unsaved game in progress. Are you sure you want to leave?";
    }
};
```

### Fix 3: Return Navigation
The return logic at `league-501.html:3000-3041` is complex. Simplify to:
```javascript
// After game completion, always return to match-hub for league games
if (leagueId && matchId) {
    window.location.href = `/pages/match-hub.html?league_id=${leagueId}&match_id=${matchId}`;
} else {
    window.location.href = `/pages/scorer-hub.html`;
}
```

---

## Match Flow (Verified Working)

```
✅ Login (dashboard.html)
✅ See Tonight's Match
✅ Go to Match Hub (match-hub.html)
✅ Select Game to Score
✅ Score 501 (league-501.html)
✅ Score Cricket (league-cricket.html)
⚠️ Return to Match Hub (needs fix)
✅ View Match Results
⚠️ Stats Attribution (doubles broken)
```

---

## Stats Flow

```
Scorer → saveLeagueGame() → Firestore match doc
                               ↓
                    updatePlayerStatsFromMatch()
                               ↓
                    leagues/{id}/stats/{playerId}
                               ↓
                    player-profile.html displays
```

**Current Bug:** `updatePlayerStatsFromMatch()` credits EACH player on a team with FULL team stats, not divided.

---

## Triples Format Reminder

| Game | Players | Format | Notes |
|------|---------|--------|-------|
| 1 | A/B (Doubles) | 501 | Cork's Choice locked to 501 |
| 2 | C (Singles) | Cricket | ✅ |
| 3 | A (Singles) | Cricket | ✅ |
| 4 | B/C (Doubles) | 501 | Cork's Choice locked to 501 |
| 5 | B (Singles) | Cricket | ✅ |
| 6 | A (Singles) | 501 | ✅ |
| 7 | A/C (Doubles) | 501 | Cork's Choice locked to 501 |
| 8 | B (Singles) | 501 | ✅ |
| 9 | C (Singles) | 501 | ✅ |

**Known Issue:** Doubles "Choice" games should let cork winner choose 501 OR Cricket. Currently locked to 501.

---

## Files Reference

### Critical Files for Tonight
- `functions/leagues/index.js` - Stats aggregation (lines 191-254)
- `public/pages/league-501.html` - 501 scorer
- `public/pages/league-cricket.html` - Cricket scorer
- `public/pages/match-hub.html` - Match navigation
- `public/pages/scorer-hub.html` - Scorer entry point

### Documentation Created Today
- `AUDIT_SUMMARY.md` - One-page bug summary
- `SHIP_AUDIT.md` - All routes/pages inventory
- `TRIPLES_LEAGUE_SIMULATION_REPORT.md` - Format verification
- `AGENT_AUDIT_RESULTS.md` - Consolidated findings
- `docs/STATISTICS-TRACKING.md` - Full stats schema

---

## Post-League Night TODO

### High Priority
1. Implement Cork's Choice (let winner choose 501 or Cricket)
2. Record cork winner in Firestore
3. Add offline score queue (IndexedDB)
4. Modularize dashboard.html (14,000+ lines)

### Medium Priority
1. Standardize URL params (`league_id` everywhere)
2. Add loading skeletons
3. User-friendly error messages
4. Match completion celebration screen

### Low Priority
1. Clean up orphan pages
2. Remove streaming placeholders or complete feature
3. Remove console.log statements

---

## Backup Created

`backup-pre-agents-2026-01-21.tar.gz` - Full codebase backup before today's changes

---

## Terminal 2 Assignment

**Task:** Fix per-player throw tracking in doubles
**File:** `public/pages/league-501.html`
**Details:** Add `activePlayerIndex` to track which player throws, rotate after each turn, accumulate stats per player

---

*Good luck tonight! The core flow works - just watch the doubles stats.*
