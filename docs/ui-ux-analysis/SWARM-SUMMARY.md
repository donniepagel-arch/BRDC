# BRDC Site Audit - Swarm Summary
**Date:** 2026-02-04
**Agents Deployed:** 6 (6 complete)

---

## OVERALL HEALTH SCORES

| Area | Score | Grade |
|------|:-----:|:-----:|
| Navigation & Architecture | 7.5/10 | B |
| Visual Design Consistency | 7/10 | B- |
| Mobile & Responsive UX | 75/100 | C+ |
| User Journey Flows | 6.5/10 | C+ |
| Error & Empty States | Medium Risk | C |
| Page Inventory Health | 74/100 | C+ |

**Combined Grade: C+ (73/100)** - Strong core, significant debt.

---

## TOP 15 CRITICAL FINDINGS (Ranked by Impact)

### 1. Match Night Flow is Disconnected
**Source:** User Journey Audit
**Impact:** The app's PRIMARY use case (playing a match night) has no connected flow. match-confirm -> scorer -> transition -> completion is broken.

**4 Critical Flow Breakers:**
- match-confirm "Start Match" destination unclear
- No match completion state or results page
- Manual game-to-game transitions (no match-transition integration)
- Inconsistent session validation across pages

**Fix:** Build complete match orchestrator flow per Journey 3 recommendations.

---

### 2. 42 Pages Silently Swallow Errors
**Source:** Error & Empty States Audit
**Impact:** When Firestore queries fail, users see nothing. `catch` blocks log to console but show no UI feedback. Users think app is frozen or broken.

**Fix:** Create global toast notification system, add `showToast('error')` to all catch blocks.

---

### 3. Offline Queue Built But NOT Integrated
**Source:** Error & Empty States Audit
**Impact:** Excellent IndexedDB queue system exists (`offline-storage.js` - 612 lines, exponential backoff, auto-retry) but ZERO pages actually use it. Scores lost if network drops during save.

**Fix:** Import `callWithQueue` from offline-storage.js into scorer pages.

---

### 4. X01 Scorer Double-Out Bust Detection BROKEN
**Source:** Scorer Code Review (separate from swarm)
**Impact:** Standard 501 Double Out is unplayable. Scoring 60 from 501 falsely busts (441 is odd).

**Fix:** Remove third condition from bust check at x01-scorer.html:3152.

---

### 5. Cricket Scorer - Winning Turn Darts Not Counted
**Source:** Scorer Code Review (separate from swarm)
**Impact:** Winner's closeout darts silently dropped from total count. MPR and dart totals are wrong.

**Fix:** Add `player.totalDarts += dartsUsed` to confirmWinDarts().

---

### 6. 8 Dead Links in Primary Navigation
**Source:** Navigation Audit
**Impact:** Every logged-in user hits broken links in the sidebar menu.

| Dead Link | Who Sees It |
|-----------|-------------|
| settings.html | ALL users |
| notification-settings.html | ALL users |
| roster.html | All captains |
| team-messages.html | All captains |
| league-settings.html | Directors |
| analytics.html | Site admins |
| feedback-admin.html | Site admins |
| league-select.html | Internal JS |

**Fix:** Create stub pages or remove links from fb-nav.js until built.

---

### 7. ~9,500 Lines of Dead Code (11% of Codebase)
**Source:** Page Inventory Audit
**Impact:** Duplicates, stubs, and abandoned features clutter the codebase.

| Category | Lines | Files |
|----------|-------|-------|
| Duplicate pages | ~2,200 | 6 (register.html, bracket.html, player-registration.html, legacy scorers) |
| Stub features | ~6,751 | 10 (dart-trader, streaming, matchmaker-mingle, online-play, mini-tournament, my-stats) |
| Legacy code | ~500 | 2 (scorers/ directory) |

**Fix:** Delete duplicates immediately. Decide on stubs: complete or remove.

---

### 8. 5 Files Over 4,000 Lines (31% of Codebase)
**Source:** Page Inventory Audit
**Impact:** Unmaintainable, slow to debug, performance concerns.

| File | Lines |
|------|-------|
| league-view.html | 6,165 |
| league-director.html | 5,828 |
| x01-scorer.html | 5,552 |
| match-hub.html | 4,812 |
| league-cricket.html | 3,911 |

**Fix:** Break each into modular components (tab components, game logic, UI, bot AI).

---

### 9. 33 Pages Use 100vh Instead of 100dvh
**Source:** Mobile Audit
**Impact:** Layout breaks on iOS Safari (address bar overlap) and Android Chrome (nav bar overlap).

**Fix:** Global find/replace `100vh` -> `100dvh` with fallback.

---

### 10. 17 Pages Use alert() for Errors/Confirmations
**Source:** Error & Empty States Audit
**Impact:** Browser alerts block UI, look outdated, can't be styled, interrupt user flow.

**Worst offenders:** league-director.html (15 instances), dashboard.html (8), director-dashboard.html (6)

**Fix:** Replace all `alert()` with toast system, all `confirm()` with modal component.

---

### 11. 16 Pages Missing user-scalable=no
**Source:** Mobile Audit
**Impact:** Forms zoom in on input focus, breaking multi-field entry.

**Fix:** Add `maximum-scale=1.0, user-scalable=no` to viewport meta.

---

### 12. 24 Orphan Pages (43% of site)
**Source:** Navigation Audit
**Impact:** Pages exist but have no clear entry point. Users can't discover features.

**Key orphans:** live-match.html, mini-tournament.html, online-play.html, draft-room.html.

---

### 13. 19 Pages Have No Empty State Handling
**Source:** Error & Empty States Audit
**Impact:** When data is empty, users see blank white space with no guidance.

**Critical missing:** x01-scorer, league-cricket, conversation.html, messages.html, my-stats.html

**Fix:** Create reusable empty state component with icon, title, text, CTA button.

---

### 14. Two Competing Background Color Systems
**Source:** Visual Design Audit
**Impact:** Subtle visual inconsistency.

| Standard | bg-dark | bg-panel | Used By |
|----------|---------|----------|---------|
| A (warm) | #1a1a2e | #16213e | 38 pages (70%) |
| B (dark) | #0a0a1a | #12122a | 6 pages (11%) |

**Decision needed:** Pick one and standardize.

---

### 15. 53 Pages Missing touch-action: manipulation
**Source:** Mobile Audit
**Impact:** 300ms tap delay on mobile. Scorer feels sluggish.

**Fix:** Add to global CSS reset or create mobile-base.css shared across all pages.

---

## CODEBASE HEALTH SNAPSHOT

### Page Inventory (61 Total)

| Status | Count | % | Lines |
|--------|:-----:|:-:|------:|
| Complete (Production-Ready) | 25 | 41% | ~35,000 |
| Partial (Functional but Incomplete) | 20 | 33% | ~40,000 |
| Stub (Minimal/No Functionality) | 10 | 16% | ~7,000 |
| Broken/Abandoned | 6 | 10% | ~2,200 |
| **Total** | **61** | **100%** | **~84,200** |

### Error Handling Coverage

| Pattern | Pages | Quality |
|---------|:-----:|---------|
| Try/catch coverage | 55/54 | Good - 100% |
| Loading indicators | 50/54 | Good - 93% |
| Silent error swallowing | 42 | Bad - console.error only |
| alert() for feedback | 17 | Bad - outdated UX |
| Toast notifications | 11 | Good but inconsistent |
| Empty state handling | 35/54 | Mixed - 65% |
| Offline queue integration | 0/54 | Critical gap |

### Offline Infrastructure

| Component | Status |
|-----------|--------|
| offline.html page | Excellent |
| IndexedDB queue system | Excellent (612 lines, exponential backoff) |
| Network error detection | Excellent |
| Visual queue indicator | Good (orange badge) |
| Auto-retry on reconnect | Excellent |
| **Actual page integration** | **ZERO - not used anywhere** |

---

## DESIGN SYSTEM GAPS

### What's Consistent (Strengths)
- Brand colors: 100% consistent (pink, teal, yellow)
- Font loading: All pages load same Google Fonts
- Navigation CSS: Single source of truth, well-structured
- Login page aesthetic: Strong retro/brutalist identity
- Firebase integration: 84% of pages, consistent patterns

### What's Inconsistent (Gaps)
| Element | Variants Found | Should Be |
|---------|:--------------:|-----------|
| Border-radius | 12 values | 4-value scale |
| Box-shadow | 3 patterns mixed | Rules by element type |
| Button gradients | 180deg vs 135deg | Pick one per button type |
| Card borders | 4 patterns | 3 tiers (primary/secondary/event) |
| Bebas Neue fallback | `cursive` vs `sans-serif` | Standardize to `sans-serif` |
| Spacing | No system | 4px-based scale |
| Error feedback | 4 patterns | 2 patterns (toast + inline) |
| Loading indicators | 4 patterns | 2 patterns (global + CSS class) |
| Empty states | 3 tiers of quality | 1 standard component |

### Recommended Design Tokens
```
--radius-sm: 6px    (badges)
--radius-md: 10px   (buttons, inputs)
--radius-lg: 16px   (cards, panels)
--radius-xl: 24px   (modals)

--shadow-offset-md: 4px 4px 0 rgba(0,0,0,0.4)   (cards, buttons)
--shadow-blur-md: 0 8px 25px rgba(0,0,0,0.4)      (modals, dropdowns)
--shadow-glow-pink: 0 0 20px rgba(255,70,154,0.3)  (active states)
```

---

## MOBILE READINESS MATRIX

| Feature | Coverage | Target | Gap |
|---------|:--------:|:------:|:---:|
| user-scalable=no | 71% | 100% | 16 pages |
| 100dvh | 5% | 69% | 35 pages |
| Safe-area insets | 11% | 100% | 49 pages |
| Tap highlight fix | 45% | 100% | 30 pages |
| touch-action | 4% | 100% | 53 pages |
| 44px+ touch targets | 82% | 100% | 10 pages |

**Quick win:** Create `mobile-base.css` with all mobile fixes, include in all pages.

---

## USER JOURNEY HEALTH

### 10 Journeys Audited | 56 Friction Points Found

| Journey | Health | Critical Issues |
|---------|:------:|:---------------:|
| 1. Login & Dashboard | Good | Data loads before UI ready, no skeleton loaders |
| 2. View My League | Decent | All data loads upfront, no lazy tabs |
| **3. Match Night Flow** | **BROKEN** | **4 critical flow breakers - primary use case** |
| 4. Score a Pickup Game | Decent | Results not saved, no "Play Again" |
| 5. Check My Stats | OK | Client-calculated, no historical trends |
| 6. League Director Setup | Fair | No wizard progress, no templates, no save draft |
| 7. Messaging | Partial | No push notifications, no media support |
| 8. Captain Management | Partial | No substitute finder, lineup editor incomplete |
| 9. Trading/Marketplace | Stub | Not implemented |
| 10. Tournament Registration | Partial | No check-in, no bracket live updates |

### Match Night Flow (Journey 3) - MOST CRITICAL

```
CURRENT (BROKEN):
  match-confirm.html -> ??? -> x01-scorer.html -> ??? -> ??? -> ???

NEEDED:
  match-confirm.html
    -> [Captain finalizes lineup]
    -> x01-scorer.html?game=1
    -> match-transition.html?game=2
    -> league-cricket.html?game=2
    -> [repeat through game 9]
    -> match-hub.html?completed=true
```

---

## NAVIGATION MAP

```
index.html (login)
    |
    v
DASHBOARD (main hub)
    |
    +---> Scorer (game-setup -> x01/cricket)
    +---> Leagues (league-view -> match-hub -> team-profile)
    +---> Profile (player-profile -> my-stats)
    +---> Messages (messages -> conversation / chat-room)
    +---> Events (events-hub -> event-view -> matchmaker)
    +---> Tournaments (tournaments -> tournament-view -> bracket)
    +---> Trader (dart-trader -> listings)
    +---> Friends (friends -> player-profile)
    +---> Captain (captain-dashboard -> match-confirm)
    +---> Director (director-dashboard -> league-director)
    +---> Admin (admin -> bot-management)
```

**Dead ends:** roster.html, team-messages.html, settings.html, notification-settings.html (all 404)

---

## DUPLICATE FUNCTIONALITY TO RESOLVE

| Feature | Pages | Recommendation |
|---------|-------|----------------|
| Registration | signup.html (modern, 8-digit), register.html (photo, 4-digit), player-registration.html (stub) | Consolidate into signup.html |
| Bracket viewers | tournament-bracket.html, bracket.html | Remove bracket.html |
| Director tools | league-director.html (5,828 lines), director-dashboard.html (1,918 lines) | Clarify use cases or consolidate |
| Legacy scorers | scorers/x01.html, scorers/cricket.html | Delete entirely |

---

## PRIORITY ACTION PLAN

### Tier 1: Fix Now (Critical Blockers)
1. Fix x01 scorer bust detection (x01-scorer.html:3152)
2. Fix cricket scorer winning turn darts (confirmWinDarts)
3. Remove/stub 8 dead nav links in fb-nav.js
4. Create toast notification system (replace alert() everywhere)
5. Integrate offline queue into scorer pages (callWithQueue)
6. Add inputmode="numeric" to scorer inputs

### Tier 2: This Sprint (High Impact)
7. Build match night orchestrator flow (match-confirm -> scorer -> transition -> hub)
8. Create mobile-base.css (touch-action, safe-area, tap highlight)
9. Fix 16 missing viewport meta tags
10. Replace 100vh with 100dvh (33 pages)
11. Delete dead code: 6 duplicate pages, legacy scorers/ directory
12. Add user feedback to 42 silent error catch blocks

### Tier 3: Next Sprint (Structural)
13. Refactor 5 largest files into modular components
14. Standardize background colors (pick A or B)
15. Wrap tables in overflow containers (8 pages)
16. Add safe-area insets to all fixed headers/footers
17. Decide on 10 stub pages: complete or remove
18. Create empty state component and standardize across pages

### Tier 4: Future (Polish)
19. Create design token system (radius, shadow, spacing vars)
20. Standardize button gradients (180deg everywhere)
21. Add breadcrumbs to deep pages
22. Lazy load tabs in league-view and match-hub
23. Create settings.html and notification-settings.html
24. Replace confirm() dialogs with modal component
25. Complete messaging system (push notifications, media)
26. Add stats history tracking and trends
27. Build substitute finder for captains

---

## METRICS

| Metric | Value |
|--------|-------|
| Total pages audited | 61 |
| Total HTML lines | ~84,200 |
| Dead code to remove | ~9,500 lines (11%) |
| Oversized files (4000+ lines) | 5 (26,268 lines = 31%) |
| Friction points found | 56 |
| Critical flow breakers | 4 |
| Pages with silent errors | 42 |
| Pages using alert() | 17 |
| Pages missing empty states | 19 |
| Offline queue pages integrated | 0 |
| TODO/FIXME comments | 4 |

---

## SOURCE REPORTS

| # | Report | File | Key Metric |
|---|--------|------|------------|
| 1 | Navigation & Architecture | [NAVIGATION-AUDIT.md](NAVIGATION-AUDIT.md) | 7.5/10, 8 dead links, 24 orphans |
| 2 | Visual Design Consistency | [VISUAL_DESIGN_AUDIT_2026-02-04.md](VISUAL_DESIGN_AUDIT_2026-02-04.md) | 7/10, 2 bg-dark systems, 12 radius values |
| 3 | Mobile & Responsive UX | [MOBILE-UX-AUDIT-2026-02-04.md](MOBILE-UX-AUDIT-2026-02-04.md) | 75/100, 33 pages 100vh, missing inputmode |
| 4 | User Journey Flows | [USER-JOURNEY-AUDIT.md](USER-JOURNEY-AUDIT.md) | 6.5/10, 4 flow breakers, 56 friction points |
| 5 | Error & Empty States | [05-error-empty-states.md](05-error-empty-states.md) | 42 silent errors, offline queue unused |
| 6 | Page Inventory & Health | [PAGE-INVENTORY-2026-02-04.md](PAGE-INVENTORY-2026-02-04.md) | 61 pages, 41% complete, C+ grade |

---

**Generated:** 2026-02-04
**Reports synthesized:** 6 of 6
**Total findings:** 350+
**Critical items:** 15
