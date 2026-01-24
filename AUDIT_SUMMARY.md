# BRDC Audit Summary
**2026-01-21**

---

## Critical Bugs (Fix Before League Night)

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | **Doubles stats 2x** - Both players get 100% of team stats | `functions/leagues/index.js:762` | Divide by player count |
| 2 | **Return nav broken** - Users dumped to wrong page after game | `league-501.html:3000-3041` | Always return to match-hub |
| 3 | **Nav menu disabled** on scorer-hub | `scorer-hub.html:451` | Uncomment the script tag |
| 4 | **No leave warning** - Back button loses game data | Both scorers | Add beforeunload handler |

---

## Triples Format Issues

| Game | Expected | Actual | Problem |
|------|----------|--------|---------|
| 1,4,7 | Cork winner picks 501 OR Cricket | Locked to 501 | **Choice not implemented** |
| All | Cork winner recorded | Not saved | **No audit trail** |

---

## Orphan Pages (No Links To Them)

- `stream-camera.html`, `stream-director.html` - Streaming not built
- `members.html` - Complete but unreachable
- `match-report.html` - No entry point
- `matchmaker-*.html` (4 pages) - Feature hidden

---

## Stats Impact

**Example:** In a doubles game where team throws 60 darts:
- **Expected:** Each player credited with 30 darts
- **Actual:** Each player credited with 60 darts
- **Result:** 3-Dart Average is wrong (shows ~35 instead of ~50)

---

## Quick Wins (< 5 min each)

1. Uncomment nav-menu.js in scorer-hub.html
2. Add `window.onbeforeunload` in scorers
3. Fix return URL logic

## Medium Effort (30-60 min)

1. Fix doubles stats division
2. Standardize URL params (`league_id` everywhere)

## Larger Work (2+ hours)

1. Implement Cork's Choice game selection UI
2. Add offline score queue
3. Modularize dashboard.html

---

## Recommended Order

```
1. Nav menu fix (2 min)
2. Leave warning (5 min)
3. Return nav fix (15 min)
4. Doubles stats fix (30 min)
```

Total: ~1 hour to fix ship blockers

---

*Full details in: SHIP_AUDIT.md, TRIPLES_LEAGUE_SIMULATION_REPORT.md, AGENT_AUDIT_RESULTS.md*
