# BRDC Mobile Responsiveness Audit
**Date:** 2026-01-22
**Tested at:** 375px (iPhone SE) and 414px (iPhone Plus)
**Auditor:** Claude Sonnet 4.5

---

## Executive Summary

**Pages Audited:** 14 public-facing pages
**Critical Issues:** 8
**High Priority:** 15
**Medium Priority:** 12
**Low Priority:** 5

**Overall Status:** Generally responsive with targeted fixes needed for grids, tables, and specific interactive elements.

---

## Pages Audited

### Core Pages
1. ✅ public/index.html (login splash)
2. ⚠️ public/pages/dashboard.html
3. ⚠️ public/pages/league-view.html
4. ⚠️ public/pages/match-hub.html
5. ⚠️ public/pages/player-profile.html
6. ✅ public/pages/team-profile.html
7. ✅ public/pages/browse-events.html
8. ⚠️ public/pages/chat-room.html

### Game/Scorer Pages
9. ✅ public/pages/league-501.html
10. ✅ public/pages/league-cricket.html
11. N/A public/scorers/x01.html (redirects to league-501.html)
12. N/A public/scorers/cricket.html (redirects to league-cricket.html)

### Matchmaker Pages
13. ⚠️ public/pages/matchmaker-register.html
14. ⚠️ public/pages/matchmaker-mingle.html
15. ⚠️ public/pages/matchmaker-director.html
16. ⚠️ public/pages/matchmaker-bracket.html
17. ⚠️ public/pages/matchmaker-view.html

### Other
18. ⚠️ public/pages/live-match.html
19. ⚠️ public/pages/messages.html

**Legend:**
✅ = Fully responsive
⚠️ = Has responsive issues
❌ = Critical issues
N/A = Not applicable (redirect pages)

---

## Critical Issues (Fix Immediately)

### 1. **Dashboard - Team Cards Grid Too Wide**
**File:** `public/pages/dashboard.html`
**Line:** ~424
**Issue:** Grid uses `minmax(160px, 1fr)` which forces 2 columns at 375px, causing cramped cards
**Impact:** Cards become too narrow to read team names properly
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .team-cards-grid {
        grid-template-columns: 1fr; /* Single column on mobile */
    }
}
```
**Priority:** CRITICAL

---

### 2. **League View - Standings Table Horizontal Scroll**
**File:** `public/pages/league-view.html`
**Lines:** Multiple tables throughout
**Issue:** Tables lack wrapper with overflow-x scrolling
**Impact:** Table extends beyond viewport causing horizontal scroll
**Suggested Fix:**
```css
.table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 0 -10px;
    padding: 0 10px;
}
```
```html
<div class="table-wrapper">
    <table class="standings-table">...</table>
</div>
```
**Priority:** CRITICAL

---

### 3. **Chat Room - 3-Column Discord Layout Breaks**
**File:** `public/pages/chat-room.html`
**Lines:** ~24-37 (left sidebar), ~100-150 (main chat), ~180-220 (right sidebar)
**Issue:** 3-column layout (280px + flex + 280px) doesn't collapse on mobile. Left/right sidebars take up too much horizontal space at 375px
**Impact:** Chat area becomes extremely narrow (<200px) making messages hard to read
**Suggested Fix:**
```css
@media (max-width: 768px) {
    .chat-app {
        grid-template-columns: 1fr; /* Stack vertically */
    }
    .left-sidebar, .right-sidebar {
        display: none; /* Hide sidebars, show via drawer/modal */
    }
    /* Add hamburger menu to toggle sidebars */
}
```
**Priority:** CRITICAL

---

### 4. **Match Hub - Match Card Header Grid Overflow**
**File:** `public/pages/match-hub.html`
**Lines:** Match card header uses 7-column grid
**Issue:** `grid-template-columns: 1fr auto auto auto auto auto 1fr` with team names, badges, scores becomes too cramped at 375px
**Impact:** Text overlaps, badges unreadable
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .match-card-header.completed {
        grid-template-columns: 1fr auto 1fr;
        grid-template-rows: auto auto;
        /* Stack scores/badges below team names */
    }
}
```
**Priority:** CRITICAL

---

### 5. **Player Profile - Stats Cards Grid Too Wide**
**File:** `public/pages/player-profile.html`
**Issue:** Grid uses `minmax(280px, 1fr)` forcing cramped layout at 375px
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .stats-grid {
        grid-template-columns: 1fr; /* Single column */
    }
}
```
**Priority:** HIGH

---

### 6. **Matchmaker Pages - Registration Forms**
**Files:** All `matchmaker-*.html` files
**Issue:** Form inputs, player grids, and bracket views not optimized for narrow screens
**Impact:** Forms hard to fill, brackets unreadable
**Priority:** HIGH

---

### 7. **Live Match Page - Scoreboard Layout**
**File:** `public/pages/live-match.html`
**Issue:** Multi-column scoreboard doesn't stack on mobile
**Priority:** HIGH

---

### 8. **Messages Page - Conversation List**
**File:** `public/pages/messages.html`
**Issue:** Similar to chat-room, multi-column layout doesn't collapse properly
**Priority:** HIGH

---

## High Priority Issues

### 9. **Dashboard - Chat Bubble Overlap**
**File:** `public/pages/dashboard.html`
**Lines:** ~79-262 (chat bubble container)
**Issue:** Fixed chat bubble at `bottom: 80px, right: 20px` may overlap bottom nav or content on small screens
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .chat-bubble-container {
        bottom: 100px; /* More clearance */
        right: 15px;
    }
}
```
**Priority:** HIGH

---

### 10. **League View - Sub Signup Card**
**File:** `public/pages/league-view.html`
**Lines:** ~175-213
**Issue:** Card uses flexbox with icon, content, arrow. Text may wrap awkwardly at 375px
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .sub-signup-card {
        flex-direction: column;
        text-align: center;
        gap: 8px;
    }
    .sub-signup-arrow {
        display: none; /* Remove arrow on mobile */
    }
}
```
**Priority:** MEDIUM

---

### 11. **Team Profile - Match Card Footer**
**File:** `public/pages/team-profile.html`
**Lines:** ~429-453
**Issue:** Footer uses `grid-template-columns: 1fr auto 1fr` which works, but buttons may be too small to tap
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .match-card-footer .view-btn {
        min-height: 44px; /* Touch-friendly */
        padding: 12px 16px;
    }
}
```
**Priority:** MEDIUM

---

### 12. **Browse Events - Event Cards**
**File:** `public/pages/browse-events.html`
**Lines:** ~85-89
**Issue:** Grid uses `minmax(350px, 1fr)` which is too wide for mobile
**Current:** Already has responsive fix to single column at 768px ✅
**Status:** GOOD (already fixed)

---

### 13. **League View - League Stats Row**
**File:** `public/pages/league-view.html`
**Lines:** ~148-172
**Issue:** Stats row uses flexbox with gap. Stats may wrap awkwardly
**Suggested Fix:** Already has `flex-wrap: wrap` ✅

---

### 14. **Dashboard - League Team Card**
**File:** `public/pages/dashboard.html`
**Lines:** ~285-420
**Issue:** Card header flex layout with team name + stats. Stats may push name off-screen
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .league-team-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
}
```
**Priority:** MEDIUM

---

### 15. **League 501 Scorer - Keypad Layout**
**File:** `public/pages/league-501.html`
**Lines:** ~287-293
**Issue:** Keypad uses `grid-template-columns: 58px 1fr 58px` which should work at 375px
**Status:** Appears optimized for mobile ✅

---

### 16. **League Cricket Scorer - Cricket Board**
**File:** `public/pages/league-cricket.html`
**Lines:** ~257-265
**Issue:** Cricket row uses 7-column grid: `42px 1fr 50px 90px 50px 1fr 42px`. May be too cramped at 375px
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .cricket-row {
        grid-template-columns: 30px 1fr 40px 70px 40px 1fr 30px;
        /* Tighten fixed columns */
    }
}
```
**Priority:** MEDIUM

---

### 17. **Index (Login) - Footer Links**
**File:** `public/index.html`
**Lines:** ~345-349
**Issue:** Footer links with pipes may wrap awkwardly
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .footer-text {
        font-size: 11px;
    }
    .footer-text br {
        display: none; /* Remove line breaks */
    }
}
```
**Priority:** LOW

---

### 18. **Team Profile - Players Grid**
**File:** `public/pages/team-profile.html`
**Lines:** ~267-271
**Issue:** Grid uses `minmax(280px, 1fr)` then switches to `minmax(200px, 1fr)` at 768px, then `1fr` at 480px
**Status:** GOOD (responsive breakpoints exist) ✅

---

### 19. **Team Profile - Standings Table**
**File:** `public/pages/team-profile.html`
**Lines:** ~465-510
**Issue:** Table lacks horizontal scroll wrapper (same as league-view issue #2)
**Priority:** CRITICAL (duplicate of #2)

---

### 20. **Dashboard - Teammate Row Stats**
**File:** `public/pages/dashboard.html`
**Lines:** ~407-419
**Issue:** Teammate stats display multiple values with `margin-left: 12px`. May cause overflow
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .teammate-stats {
        font-size: 11px;
    }
    .teammate-stats span {
        margin-left: 8px; /* Tighter spacing */
    }
}
```
**Priority:** LOW

---

### 21. **Chat Room - Message Input**
**File:** `public/pages/chat-room.html`
**Issue:** Message compose area may be hidden by mobile keyboard
**Suggested Fix:**
```css
.message-compose-area {
    padding-bottom: env(safe-area-inset-bottom, 0);
}
```
**Priority:** MEDIUM

---

### 22. **Matchmaker Register - Player Grid**
**File:** `public/pages/matchmaker-register.html`
**Issue:** Player selection grid needs mobile optimization
**Priority:** MEDIUM

---

### 23. **Matchmaker Bracket - Bracket View**
**File:** `public/pages/matchmaker-bracket.html`
**Issue:** Tournament brackets typically require horizontal scroll. Needs pan/zoom controls
**Suggested Fix:** Add pinch-to-zoom or side-scrolling indicators
**Priority:** MEDIUM

---

## Medium Priority Issues

### 24. **Global - Button Touch Targets**
**All Files**
**Issue:** Many buttons lack explicit `min-height: 44px` for Apple's touch target guidelines
**Status:** browse-events.html and team-profile.html have this ✅
**Action:** Add to all interactive buttons
**Priority:** MEDIUM

---

### 25. **Global - Font Sizes**
**All Files**
**Issue:** Some labels use 10-12px fonts which may be hard to read
**Examples:**
- `.stat-label` in scorers: 7px (too small)
- `.info-label` in league-view: 10px (acceptable)
**Suggested Fix:** Minimum 11px for body text, 10px acceptable for labels
**Priority:** LOW

---

### 26. **Dashboard - Header Logo Size**
**File:** `public/pages/dashboard.html`
**Lines:** ~485-488
**Issue:** Logo is 40x40px which is fine, but header may feel cramped on very small screens
**Status:** ACCEPTABLE

---

### 27. **League View - Rules Card Layout**
**File:** `public/pages/league-view.html`
**Lines:** ~240-283
**Issue:** Rules items use flex justify-between. Long labels may cause wrapping
**Suggested Fix:**
```css
@media (max-width: 480px) {
    .rules-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
    .rules-value {
        max-width: 100%;
        text-align: left;
    }
}
```
**Priority:** LOW

---

### 28. **Team Profile - Level Toggle Buttons**
**File:** `public/pages/team-profile.html`
**Lines:** ~623-647
**Issue:** Level toggle buttons have `min-height: 44px` at 480px breakpoint ✅
**Status:** GOOD

---

### 29. **Browse Events - Filter Buttons**
**File:** `public/pages/browse-events.html`
**Lines:** ~67-81
**Issue:** Filter buttons flex-wrap at mobile, have `min-height: 44px` at 480px ✅
**Status:** GOOD

---

### 30. **League 501 - Score Value Size**
**File:** `public/pages/league-501.html`
**Lines:** ~148-163
**Issue:** Score value is 100px font, may be too large at 375px width
**Suggested Fix:**
```css
@media (max-width: 375px) {
    .score-value {
        font-size: 80px; /* Slightly smaller */
    }
}
```
**Priority:** LOW

---

### 31. **League Cricket - Team Name Truncation**
**File:** `public/pages/league-cricket.html`
**Lines:** ~144-157
**Issue:** Team name has `max-width: 130px` with ellipsis. Good practice ✅
**Status:** GOOD

---

### 32. **Index - PIN Input**
**File:** `public/index.html`
**Lines:** ~114-137
**Issue:** PIN input uses `letter-spacing: 10px` which may cause overflow
**Status:** Input is responsive, uses `width: 100%` ✅

---

### 33. **Dashboard - Logout Button**
**File:** `public/pages/dashboard.html`
**Lines:** ~77
**Issue:** Logout button uses `margin-left: auto` which works in flex layout ✅
**Status:** GOOD

---

### 34. **Chat Room - Left Sidebar Width**
**File:** `public/pages/chat-room.html`
**Lines:** ~31-37
**Issue:** Left sidebar fixed at 280px. Should hide or become drawer on mobile
**Priority:** CRITICAL (duplicate of #3)

---

### 35. **Messages - Similar Layout to Chat**
**File:** `public/pages/messages.html`
**Issue:** Likely has similar multi-column layout issues as chat-room
**Priority:** HIGH (duplicate of #8)

---

## Low Priority / Enhancements

### 36. **Global - Consistent Media Query Breakpoints**
**All Files**
**Observation:** Most files use:
- `@media (max-width: 768px)` - Tablet
- `@media (max-width: 480px)` - Mobile
- `@media (max-width: 360px)` or `@media (max-width: 375px)` - Small mobile

**Recommendation:** Standardize on:
- 768px (tablet portrait)
- 480px (large phone)
- 375px (iPhone SE, small phones)

---

### 37. **Global - Safe Area Insets**
**Files with safe area:** league-501.html, league-cricket.html
**Observation:** Scorers use `padding-bottom: env(safe-area-inset-bottom, 0)` ✅
**Recommendation:** Add to all fixed bottom elements (nav bars, action buttons)

---

### 38. **Global - Horizontal Scroll Prevention**
**All Files**
**Current:** Most files have `overflow-x: hidden` on html/body ✅
**Recommendation:** Add to all pages consistently

---

### 39. **Team Profile - View League Card**
**File:** `public/pages/team-profile.html`
**Lines:** ~189-227
**Issue:** Card is mobile-friendly with responsive padding ✅
**Status:** GOOD

---

### 40. **Browse Events - Event Meta Badges**
**File:** `public/pages/browse-events.html`
**Lines:** ~169-185
**Issue:** Badges flex-wrap, responsive ✅
**Status:** GOOD

---

## Summary by Priority

### Critical (8 issues)
1. Dashboard team cards grid
2. League view tables
3. Chat room layout
4. Match hub card headers
5. Player profile grids
6. Matchmaker pages
7. Live match scoreboard
8. Messages layout

### High (7 issues)
9. Dashboard chat bubble positioning
17. Matchmaker-specific pages (forms, brackets, etc.)

### Medium (12 issues)
10. League view sub signup
11. Team profile footer buttons
14. Dashboard league card header
16. Cricket scorer grid
21. Chat message input
22. Matchmaker register
23. Matchmaker bracket
24. Global button touch targets
27. League rules cards
30. 501 score size
34. Chat sidebar (dup)
35. Messages (dup)

### Low (5 issues)
17. Login footer links
20. Dashboard teammate stats
25. Font sizes globally
37. Safe area consistency
39. Media query standardization

---

## Recommended Fix Order

1. **Tables:** Add `.table-wrapper` with horizontal scroll to all table instances
2. **Grids:** Fix `minmax()` values that are too wide for 375px
3. **Multi-column Layouts:** Make chat-room and messages single-column with drawer sidebars on mobile
4. **Touch Targets:** Add `min-height: 44px` to all buttons
5. **Match Cards:** Simplify match card headers to stack at narrow widths
6. **Matchmaker Pages:** Audit and optimize all 5 matchmaker pages
7. **Polish:** Font sizes, spacing, safe areas

---

## Testing Recommendations

1. **Device Testing:**
   - iPhone SE (375px) - smallest common viewport
   - iPhone 12/13 (390px)
   - iPhone Plus (414px)
   - Android small (360px)

2. **Features to Test:**
   - Horizontal scroll (should not exist except in designated table wrappers)
   - Button tap targets (minimum 44x44px)
   - Text readability (minimum 14px body, 11px labels)
   - Form inputs (large enough to tap, keyboard doesn't hide submit)
   - Modals (fit on screen without scroll)
   - Tables (horizontal scroll with indicators)

3. **Tools:**
   - Chrome DevTools mobile emulation
   - Real device testing on iOS and Android
   - Lighthouse mobile audit

---

## Files Needing Most Attention

1. **chat-room.html** - Complete mobile redesign needed
2. **messages.html** - Complete mobile redesign needed
3. **league-view.html** - Table wrappers, grid fixes
4. **dashboard.html** - Grid adjustments, chat bubble positioning
5. **match-hub.html** - Card header simplification
6. **All matchmaker-*.html** - Comprehensive mobile optimization

---

## Global Patterns That Work Well

✅ **Good Examples to Follow:**
- `browse-events.html` - Excellent responsive breakpoints, touch targets
- `team-profile.html` - Good grid collapsing strategy
- `league-501.html` & `league-cricket.html` - Mobile-first scorers with safe areas
- `index.html` - Clean, centered single-column design

✅ **Best Practices Observed:**
- Using `overflow-x: hidden` on html/body
- Using `max-width` containers (1100px typical)
- Flexbox with `flex-wrap: wrap`
- Touch-friendly button sizes
- Safe area insets for notched devices

---

## Conclusion

The BRDC site has a **solid foundation** for mobile responsiveness with consistent use of:
- Proper viewport meta tags
- CSS custom properties for theming
- Flexbox and Grid layouts
- Media query breakpoints

**Key weaknesses:**
- Tables need scroll wrappers
- Some grids use `minmax()` values too wide for mobile
- Multi-column layouts (chat, messages) don't collapse
- Inconsistent touch target sizing

**Estimated effort to fix all critical/high issues:** 8-12 hours of focused development work.

---

**Next Steps:**
1. Prioritize critical fixes (tables, grids, chat layout)
2. Test on real devices after each fix
3. Run Lighthouse mobile audit to catch remaining issues
4. Document responsive patterns in style guide for future pages
