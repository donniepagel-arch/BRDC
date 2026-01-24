# Mobile/Visual Audit Results
**Generated:** 2026-01-21
**Source:** Terminal 4 Agent

---

## Summary

**6 pages have ZERO @media queries:**
- league-view.html
- match-hub.html
- league-501.html
- league-cricket.html
- player-profile.html
- team-profile.html

Only dashboard.html and scorer-hub.html have mobile handling.

---

## CRITICAL (Fix First)

| Page | Issue | Lines |
|------|-------|-------|
| league-view.html | Zero @media queries | Entire file |
| match-hub.html | Throws grid fixed 30px/50px overflows | 451, 465 |
| league-cricket.html | Cricket row grid overflows on mobile | 258 |
| league-501.html | Calc bottom row forces 5 columns | 350-351 |
| league-501.html | Same throws grid issue as match-hub | 451, 465 |

---

## HIGH Severity

| Page | Issue | Lines |
|------|-------|-------|
| dashboard.html | Login box max-width: 380px exceeds 320px phones | 534 |
| dashboard.html | No media query for container below 768px | 499 |
| league-view.html | Info grid minmax(180px) too wide for mobile | 315 |
| league-view.html | Modal max-width: 500px exceeds phone safe area | 448 |
| match-hub.html | Toggle detail button only 28-32px (below 44px) | 330-339 |
| match-hub.html | Performance leaders forces 2 columns | 556 |
| league-501.html | Asymmetric border - home has border-right, away missing border-left | 100-106 |
| player-profile.html | Players grid minmax(280px) cramps on mobile | 268 |
| player-profile.html | Standings table no horizontal scroll | 464 |
| team-profile.html | Same issues as player-profile | 268, 464 |

---

## MEDIUM Severity

| Page | Issue | Lines |
|------|-------|-------|
| dashboard.html | Teammate badge 24x24px below touch minimum | 380-391 |
| league-view.html | Asymmetric flex alignment left/right team sides | 354-372 |
| match-hub.html | Game team side alignment inconsistent | 277-278 |
| league-501.html | Side button padding only 2px - cramped | 310 |
| player-profile.html | Rank badges 28x28px below touch minimum | 512-521 |
| team-profile.html | Rank badges 28x28px same issue | 512 |

---

## Fix Priority

### Wave 1: Add @media queries to critical pages
1. league-view.html - Most visited page after dashboard
2. match-hub.html - Critical for league night
3. league-501.html - Used during scoring

### Wave 2: Fix overflow issues
4. Throws grid in match-hub.html and league-501.html
5. Cricket row grid in league-cricket.html
6. Calc bottom row in league-501.html

### Wave 3: Touch targets and symmetry
7. Button/badge sizes
8. Border symmetry on scorer
9. Alignment consistency

---

## Quick Fix Pattern

Add this to pages missing @media queries:

```css
@media (max-width: 768px) {
    .container { padding: 0 12px; }
    /* Stack grids */
    .info-grid, .stats-grid { grid-template-columns: 1fr; }
    /* Make tables scroll */
    .table-wrapper { overflow-x: auto; }
}

@media (max-width: 480px) {
    /* Further adjustments for small phones */
    .modal-content { max-width: 95vw; margin: 10px; }
}
```
