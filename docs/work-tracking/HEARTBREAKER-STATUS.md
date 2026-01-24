# Heartbreaker Tournament Implementation Status

**Last Updated:** 2026-01-22 (Evening)
**Status:** Backend 100% | Frontend 85% | Terminals running

---

## What Is Heartbreaker?

Valentine's themed mixed doubles darts tournament with:
- **Double-elimination bracket** (Winners Bracket + Losers Bracket + Grand Finals)
- **Anonymous breakup mechanic** - lose in WC, get option to find new partner
- **Mingle period** - time to decide if you want to break up (ends when last WC R2 match STARTS)
- **Savage summaries** - playful stats about partner's failures shown after loss
- **Nudge system** - anonymous interest signaling during mingle
- **Cupid Shuffle** - director-triggered random re-matching of breakup opt-ins

Game settings:
- Winners Bracket: Cricket Best-of-3 (~20 min avg)
- Losers Bracket: 501 Best-of-1 (~7 min avg)
- Venue: Rookies with 12 boards, 24 teams is sweet spot

---

## Terminal Prompts Written

All 8 terminal prompts were created and delivered:

| Terminal | Task | Prompt Location |
|----------|------|-----------------|
| 1 | Double-elimination bracket generator | Delivered verbally |
| 2 | Match advancement logic | Delivered verbally |
| 3 | Heartbreaker system (triggers, savage summary, breakup) | Delivered verbally |
| 4 | Nudge system | Delivered verbally |
| 5 | Mingle period management | Delivered verbally |
| 6 | TV display page | Delivered verbally |
| 7 | Update existing matchmaker pages | Delivered verbally |
| 8 | Heartbreaker format preset | `temp/tournaments/TERMINAL-8-PROMPT.txt` |

---

## Implementation Status (Pre-Audit)

### Backend Functions - IMPLEMENTED

**brackets.js:**
- `generateDoubleEliminationBracket` ✅ Implemented & exported

**matches.js:**
- `submitDoubleElimMatchResult` ✅ Implemented (lines 150-439)
- `startDoubleElimMatch` ✅ Implemented (lines 632-695)
- `advanceInWinnersBracket` ✅ Helper function (lines 456-491)
- `dropToLosersBracket` ✅ Helper function (lines 510-551)
- `advanceInLosersBracket` ✅ Helper function (lines 573-606)
- `checkMingleStatus` ✅ Helper function (lines 612-627)

**matchmaker.js:**
- `triggerHeartbreaker` ✅ Implemented (lines 727-809)
- `submitBreakupDecision` ✅ Implemented (lines 815-887)
- `getHeartbrokenTeams` ✅ Implemented (lines 893-947)
- `startMinglePeriod` ✅ Implemented (lines 953-1009)
- `endMinglePeriod` ✅ Implemented (lines 1015-1069)
- `runCupidShuffle` ✅ Implemented (lines 1076-1235)
- `getMingleStatus` ✅ Implemented (lines 1348-1427)
- `createHeartbreakerTournament` ✅ Implemented (lines 1241-1342)
- `generateSavageSummary` ✅ Helper function (lines 668-720)

### Backend Functions - MISSING

**Nudge System (matchmaker.js):**
- `sendNudge` ❌ NOT IMPLEMENTED
- `getNudgeCount` ❌ NOT IMPLEMENTED
- `getAvailableNudgeTargets` ❌ NOT IMPLEMENTED

### Export Issues

**index.js:**
- matchmaker.js functions ARE exported via `Object.assign(exports, matchmakerFunctions)` at line 159
- `submitDoubleElimMatchResult` ❌ NOT EXPORTED (exists in matches.js but not imported/exported in index.js)
- `startDoubleElimMatch` ❌ NOT EXPORTED (exists in matches.js but not imported/exported in index.js)

### Frontend Pages - STATUS UNKNOWN

Need to check:
- `public/pages/matchmaker-bracket.html` (TV display)
- `public/pages/matchmaker-director.html` (Director controls)
- `public/pages/matchmaker-view.html` (Player view)

---

## Audit Prompt

A comprehensive audit prompt was created at:
**`temp/tournaments/TERMINAL-AUDIT-PROMPT.txt`**

This prompt will:
1. Fix missing exports in index.js for double-elim match functions
2. Audit all implementations
3. Create missing nudge functions
4. Deploy and report findings

---

## Current Terminal Status (2026-01-22 Evening)

**8 terminals deployed - see `docs/work-tracking/TERMINAL-PROMPTS-2026-01-22.md`**

| # | Task | Status |
|---|------|--------|
| 1 | Deploy functions & verify exports | 🔄 RUNNING |
| 2 | Create player mingle page | 🔄 RUNNING |
| 3 | Update director dashboard (Cupid Shuffle) | ✅ DONE |
| 4 | Connect bracket to real double-elim data | 🔄 RUNNING |
| 5 | Add mingle status to public view | ✅ DONE |
| 6 | Create integration test script | 🔄 RUNNING |
| 7 | BRDC mobile responsive audit | 🔄 RUNNING |
| 8 | BRDC mobile functional audit | 🔄 RUNNING |

**Frontend Pages Updated:**
- matchmaker-director.html - Added Cupid Shuffle button, heartbroken stats, real-time polling
- matchmaker-view.html - Added mingle banner, countdown timer, heartbroken teams section

---

## Next Steps (When Resuming)

1. **Check terminal outputs** - Review results from all 8 terminals
2. **Verify function deployment** - Terminal 1 should report deploy status
3. **Test mingle page** - Terminal 2 creates the player mingle experience
4. **Run integration test** - Terminal 6 creates full flow test script
5. **Deploy hosting** - `firebase deploy --only hosting` after frontend complete

---

## Key Files

| File | Purpose |
|------|---------|
| `functions/tournaments/brackets.js` | Double-elim bracket generation |
| `functions/tournaments/matches.js` | Match result submission & advancement |
| `functions/matchmaker.js` | All Heartbreaker/mingle/breakup logic |
| `functions/index.js` | Function exports (needs fixing) |
| `public/pages/matchmaker-*.html` | Frontend pages |

---

## Reference: Bracket Structure

```
WINNERS BRACKET (Cricket BO3)
WC R1 → WC R2 → WC Finals → Grand Finals
   ↓       ↓         ↓
   LC R1   LC R2    (WC champion gets advantage in GF)

LOSERS BRACKET (501 BO1)
LC R1 → LC R2 → LC R3 → LC Finals → Grand Finals
        (dropouts from WC join here)

GRAND FINALS
- WC Champion vs LC Champion
- If LC Champion wins → Bracket Reset (play again)
- Winner of reset = Tournament Champion
```

---

## Critical Rules

1. **Absolute anonymity** - NEVER reveal who opted for breakup
2. **Mingle ends when LAST WC R2 match STARTS** (not when it ends)
3. **20-second delay** after loss before showing mingle UI (let emotions settle)
4. **Opposite gender only** for re-matching (mixed doubles requirement)
5. **3 nudges max** per mingle period
