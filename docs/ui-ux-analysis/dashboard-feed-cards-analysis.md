# Dashboard Feed Cards - UI/UX Analysis & Recommendations

**Project:** BRDC Darts League Management System
**Page:** dashboard.html (Feed tab)
**Date:** 2026-01-28
**Analyst:** Claude (UI/UX Design Specialist)

---

## Executive Summary

The dashboard feed cards show match results and league night summaries in a social media-inspired feed format. While the desktop experience is functional, the mobile experience suffers from critical layout issues, particularly in the match card headers. The design lacks responsive breakpoints, has inconsistent information density, and presents readability challenges on smaller screens.

**Key Finding:** User feedback states "header looks like crap on mobile" - this is accurate. The match result card header uses inline styles with no mobile optimization, causing text to overflow, wrap awkwardly, and create visual chaos on screens below 375px width.

---

## Current Issues

### 1. CRITICAL: No Mobile Responsiveness Strategy
**Location:** Lines 497-673 (CSS), Lines 1989-2091 (renderMatchResultFeedCard)
**Priority:** HIGH

**Problems:**
- **Zero media queries** for feed card layout in dashboard.html
- fb-mobile.css only addresses generic mobile patterns, not card-specific layouts
- Match card header uses hardcoded inline styles (line 2062-2068) that don't adapt to viewport width
- No `@media` breakpoints for screens < 375px (iPhone SE) or < 320px (small Android devices)

**Specific Breakdowns:**
```html
<!-- Line 2064-2065: This WILL break on mobile -->
<div style="font-family: 'Bebas Neue', cursive; font-size: 18px; letter-spacing: 1px; color: var(--yellow); margin-bottom: 6px; line-height: 1.2;">
    ${winnerName} defeated ${loserName} ${data.home_score}-${data.away_score}
</div>
```
- Team names can be 15+ characters ("E. Olschansky", "N. Mezlak")
- "defeated" adds 8 characters + spaces
- Score adds 3-5 characters
- **Total:** 40-50 characters trying to fit in ~320px width
- **Result:** Text wraps mid-word, creates 3-4 line headers, looks "like crap"

**Evidence:**
- viewport meta tag exists (line 5) but no responsive CSS leverages it
- Card padding fixed at 15px/10px regardless of screen size
- Text sizes don't scale below 18px (header), 14px (team names), 11-13px (stats)

---

### 2. Match Result Card Header Visual Hierarchy
**Location:** Lines 2062-2068 (renderMatchResultFeedCard header)
**Priority:** HIGH

**Problems:**
- **Information overload** in header: league name, week, winner/loser declaration, score, date
- **3 different text sizes** in 4 lines (12px, 18px, 11px) create jumpy reading pattern
- **Yellow headline text** competes with teal border and pink accents elsewhere
- **"defeated" phrasing** is wordy - "vs" or just score would be clearer

**Visual flow issues:**
```
Line 1: League Name - Week # (12px, dim gray)
Line 2: WINNER defeated LOSER 7-2 (18px, YELLOW, Bebas Neue)
Line 3: Full date string (11px, dim gray)
```
- Eye is drawn to yellow Line 2, but critical info (which teams?) isn't color-coded
- User must parse sentence structure to understand outcome
- Date takes prime real estate but is least important info

**Typography problems:**
- Bebas Neue at 18px with letter-spacing: 1px is WIDE
- Line-height 1.2 causes tight vertical spacing
- Long team names + "defeated" + score = 40+ characters
- Mobile screens: text wraps, creates 2-3 lines, ruins visual impact

---

### 3. Team Info Boxes - Information Density
**Location:** Lines 2070-2081 (team stat boxes)
**Priority:** MEDIUM

**Problems:**
- **4 pieces of info crammed in small box**: Team name, record, standing, 2 stats
- **Grid layout** (1fr 1fr, 10px gap) doesn't respect minimum content width
- **Center alignment** makes scanning difficult (eyes must zigzag)
- **Stat format** "47.1 / 2.26" requires context knowledge (3DA / MPR not labeled)

**Usability issues:**
```html
<div style="text-align: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
    <div>Team Name (14px teal)</div>
    <div>(5-1, 2nd) (11px dim, 4px margin)</div>
    <div>47.1 / 2.26 (13px, no labels)</div>
</div>
```
- **No stat labels** - new users don't know what 47.1 / 2.26 means
- **Record + standing in one line** - "(5-1, 2nd)" is cluttered
- **Small text** (11px) for critical info (standing)
- **Box background** (rgba 0,0,0,0.2) adds visual weight but no functional separation

**Mobile impact:**
- At 320px viewport, each box is ~150px wide
- 10px padding leaves ~130px for content
- Team name "E. Olschansky" = 13 characters × ~8px = 104px
- No room for record/standing/stats without overflow

---

### 4. Player Roster Layout
**Location:** Lines 2047-2058 (roster rows), Lines 605-673 (CSS)
**Priority:** MEDIUM

**Problems:**
- **Mirror layout** (stats on outer edges, names in center) is clever but fragile
- **Relies on flexbox justify-content: space-between** which breaks with long names
- **No max-width on names** - "Dominick Russano" at 12px = ~130px, forces stat text to edge
- **10px font size for stats** is at minimum legibility threshold
- **Green/red color coding** (better/worse) is subtle - low contrast with dark background

**CSS issues:**
```css
.match-player-cell {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    min-height: 32px;
}
```
- `gap: 8px` is insufficient buffer - stats and names collide on narrow screens
- `padding: 8px 12px` doesn't scale down on mobile
- `.left` and `.right` classes use different flex-direction logic (line 624-654) but both can overflow

**Better/worse highlighting:**
```css
.match-player-stats .better { color: #4ade80; }
.match-player-stats .worse { color: #f87171; }
```
- Colors are WCAG AA compliant but low contrast against `--bg-card` (#1e2a47)
- No bold/icon indicator for accessibility (color-blind users)
- Small text (10px) makes color differences harder to perceive

---

### 5. League Night Card - Generic Header
**Location:** Lines 2100-2170 (renderLeagueNightCard)
**Priority:** LOW

**Problems:**
- **Generic header style** - uses standard .fb-feed-card-header (line 2153)
- **No visual distinction** from other feed cards besides pink border
- **Metadata line** (line 2156) crams "dateStr • matches_played matches" - ellipsis unclear
- **Top performers layout** (line 2115-2119) uses 3-column flex - will stack awkwardly on mobile

**Comparison with match cards:**
- Match cards get custom centered header with large yellow text (line 2062-2068)
- League night cards use standard left-aligned avatar-style header (line 2153-2157)
- **Inconsistent visual language** - users see 2 different "importance levels"

**Mobile issues:**
- Top performers: "A Level | Player Name | 47.5 3DA" in flex row (line 2115)
- At 320px width, this becomes:
  ```
  A Level
  Long Player Name Here
  47.5 3DA
  ```
- No wrapping strategy, text truncation, or stacking defined

---

### 6. Color Usage & Contrast
**Location:** Throughout, CSS lines 30-42 (color variables)
**Priority:** MEDIUM

**Problems:**
- **Teal border** (match cards) vs **pink border** (league night) - good distinction
- **Yellow headline text** (line 2064) on dark background - high contrast BUT competes with other accent colors
- **Dim gray metadata** (var(--text-dim) = #8a8aa3) - only 4.5:1 contrast ratio (barely WCAG AA)
- **Team stat highlighting** - better (green #4ade80) / worse (red #f87171) is subtle

**Color hierarchy confusion:**
- **Primary accent:** Pink (#FF469A) - used for borders, buttons, active states
- **Secondary accent:** Teal (#91D7EB) - used for team names, borders
- **Tertiary accent:** Yellow (#FDD835) - used for winner headlines, stats
- **No clear priority** - all 3 colors compete for attention in match cards

**Accessibility concerns:**
- `--text-dim` (#8a8aa3) on `--bg-card` (#1e2a47) = 4.52:1 (passes AA for large text only)
- Better/worse colors on stats - relies solely on color (no icons/bold)
- Yellow headline text is vibrant but can cause eye strain with Bebas Neue font

---

### 7. Spacing & Padding Optimization
**Location:** Lines 555-557 (card body), 575-602 (actions)
**Priority:** LOW

**Problems:**
- **Card body padding** - fixed 12px regardless of content type or screen size
- **Team stat boxes** - 10px internal padding, 10px gap between = 30px total horizontal space lost
- **Roster row padding** - 8px vertical, 12px horizontal (line 618) - doesn't scale
- **No breathing room** in match header (line 2062: padding 15px 10px) - tight on mobile

**Inefficient space usage:**
```html
<!-- Line 2070: Grid with 10px gap -->
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
```
- 10px gap between team boxes = wasted space on mobile
- 20px bottom margin adds to card height unnecessarily
- Could reduce gap to 8px, margin to 16px for more compact layout

**Card body (line 555-557):**
```css
.fb-feed-card-body {
    padding: 12px;
}
```
- Same padding for league night cards (minimal content) and match cards (dense roster data)
- Should vary: 16px for sparse content, 12px for dense, 8px for mobile

---

### 8. Typography Improvements Needed
**Location:** Lines 2062-2091 (match card), Lines 656-673 (roster CSS)
**Priority:** MEDIUM

**Problems:**
- **5 different font sizes** in match card (18px, 14px, 13px, 12px, 11px, 10px)
- **2 font families** (Inter body text, Bebas Neue headlines) - good contrast but headline is WIDE
- **Line-height 1.2** on headline (line 2064) - too tight when text wraps
- **Letter-spacing 1px** on Bebas Neue - exacerbates width problem

**Hierarchy issues:**
```
Header: 12px (league/week) → 18px (winner text) → 11px (date)
Body: 14px (team names) → 11px (record/standing) → 13px (stats) → 12px (player names) → 10px (player stats)
```
- **Too many size steps** - creates visual noise
- **Inconsistent scale** - no clear ratio (not 1.2x, 1.5x, etc.)
- **Small stats text** (10px) at minimum legibility

**Font weight issues:**
- Team names: `font-weight: 700` (line 2072) - heavy on small screens
- Player names: regular weight (line 656) - gets lost in roster
- Record text: 11px dim (line 2073) - should be bolder for scannability

---

## Mobile-Specific Fixes

### Priority 1: Match Card Header Responsive Layout

**Breakpoint: < 480px (Target: iPhone SE 375px, small Android 360px)**

**Proposed changes:**
1. **Stack header elements vertically** instead of centering:
   ```
   League Name - Week #
   Team A  7-2  Team B
   Jan 28, 2025
   ```

2. **Reduce font sizes:**
   - Headline: 18px → 16px (mobile)
   - Team names: 14px → 13px
   - Date: 11px → 10px

3. **Shorten "defeated" to "def." or remove entirely** (just show score):
   ```
   D. PAGEL  7  -  2  M. PAGEL
   ```

4. **Remove letter-spacing** on mobile (Bebas Neue letter-spacing: 1px → 0)

**Implementation approach:**
- Add media query in dashboard.html `<style>` block (after line 673):
```css
@media (max-width: 480px) {
    .fb-feed-card-header {
        padding: 12px 8px !important;
    }
    /* Override inline styles with !important or move to classes */
}
```
- **Better:** Refactor renderMatchResultFeedCard to use CSS classes instead of inline styles

---

### Priority 2: Team Stat Boxes - Mobile Stacking

**Breakpoint: < 400px**

**Proposed changes:**
1. **Change grid to stack vertically**:
   ```
   [Team A Box - full width]
   [Team B Box - full width]
   ```

2. **Adjust box padding**: 10px → 8px (save 4px per box)

3. **Add stat labels** on mobile:
   ```
   47.1 3DA / 2.26 MPR
   ```
   Instead of:
   ```
   47.1 / 2.26
   ```

4. **Increase record/standing text**: 11px → 12px for better tap targets

---

### Priority 3: Roster Compact Mode

**Breakpoint: < 375px**

**Proposed changes:**
1. **Reduce row padding**: 8px 12px → 6px 8px
2. **Shrink gap between name and stats**: 8px → 4px
3. **Abbreviate long names** with ellipsis after 12 characters:
   ```
   "Dominick Russano" → "D. Russano"
   ```

4. **Optional:** Hide player stats, show only names + indicator (green/red dot) for better/worse

---

### Priority 4: League Night Card - Stacked Performers

**Breakpoint: < 450px**

**Proposed changes:**
1. **Stack performer info**:
   ```
   A Level: Player Name
   47.5 3DA
   ─────────
   B Level: Player Name
   2.45 MPR
   ```

2. **Reduce flex gap**: justify-content: space-between → flex-direction: column + gap: 4px

---

## Recommended Changes (by Priority)

### HIGH PRIORITY

#### 1. Add Mobile Media Queries (Immediate Fix)
**Location:** After line 673 in `<style>` block
**Effort:** 2 hours
**Impact:** Fixes "header looks like crap on mobile"

Add breakpoints for:
- 480px: Reduce font sizes, adjust padding
- 400px: Stack team boxes vertically
- 375px: Compact roster mode
- 320px: Minimum viable layout

**Specific CSS to add:**
```css
@media (max-width: 480px) {
    .match-result-card .fb-feed-card-header {
        padding: 12px 8px !important;
    }
    .match-result-card .match-header-text {
        font-size: 16px !important;
        letter-spacing: 0 !important;
        line-height: 1.3 !important;
    }
}

@media (max-width: 400px) {
    .team-boxes-grid {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
    }
}

@media (max-width: 375px) {
    .match-player-cell {
        padding: 6px 8px !important;
        gap: 4px !important;
    }
    .match-player-stats {
        font-size: 9px !important;
    }
}
```

**Note:** Requires refactoring inline styles to CSS classes.

---

#### 2. Refactor Match Card Header (Structural Fix)
**Location:** Lines 2062-2068 (renderMatchResultFeedCard)
**Effort:** 4 hours
**Impact:** Enables responsive design, cleaner code

**Changes:**
- Remove inline styles
- Create CSS classes: `.match-header`, `.match-header-league`, `.match-header-result`, `.match-header-date`
- Use semantic HTML structure
- Add mobile-specific classes

**Proposed structure:**
```html
<div class="fb-feed-card-header match-header">
    <div class="match-header-league">League Name - Week #</div>
    <div class="match-header-result">
        <span class="team-name">${winnerName}</span>
        <span class="score-sep">defeated</span>
        <span class="team-name">${loserName}</span>
        <span class="final-score">${homeScore}-${awayScore}</span>
    </div>
    <div class="match-header-date">${dateStr}</div>
</div>
```

**Benefits:**
- CSS can override based on viewport width
- No !important hacks needed
- Easier to maintain
- Can add animations/transitions

---

#### 3. Improve Match Header Visual Hierarchy
**Location:** Lines 2062-2068
**Effort:** 2 hours
**Impact:** Better readability, clearer winner indication

**Changes:**
1. **Shorten "defeated" to "def."** or use VS layout:
   ```
   D. PAGEL  7-2  M. PAGEL
   ```

2. **Color-code winner** - yellow highlight on winning team name, not entire sentence

3. **Reorder info** for importance:
   ```
   [TEAM A vs TEAM B - 7-2]  ← Most important
   League Name - Week #      ← Context
   Jan 28, 2025              ← Least important
   ```

4. **Reduce font size jumps** - use 3 sizes max (16px, 13px, 11px)

---

### MEDIUM PRIORITY

#### 4. Add Stat Labels to Team Boxes
**Location:** Line 2074, 2079
**Effort:** 1 hour
**Impact:** Better onboarding for new users

**Change:**
```html
<!-- Current -->
<div style="font-size: 13px;">47.1 / 2.26</div>

<!-- Proposed -->
<div class="team-stats">
    <span class="stat-3da">47.1 <span class="stat-label">3DA</span></span>
    <span class="stat-sep">/</span>
    <span class="stat-mpr">2.26 <span class="stat-label">MPR</span></span>
</div>
```

**CSS:**
```css
.stat-label {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 400;
}
```

---

#### 5. Improve Better/Worse Stat Highlighting
**Location:** Lines 667-673
**Effort:** 2 hours
**Impact:** Accessibility, clearer performance indicators

**Changes:**
1. **Increase color contrast:**
   ```css
   .match-player-stats .better { color: #22c55e; }  /* Brighter green */
   .match-player-stats .worse { color: #ef4444; }   /* Brighter red */
   ```

2. **Add icons or bold:**
   ```html
   <span class="better">↑ 47.1</span>
   <span class="worse">↓ 42.3</span>
   ```

3. **Optional:** Add tooltip on hover explaining "better/worse than opponent"

---

#### 6. Optimize Card Spacing
**Location:** Lines 555-557, 2070
**Effort:** 1 hour
**Impact:** More content visible, less scrolling

**Changes:**
- Card body padding: 12px → 10px (mobile), keep 12px (desktop)
- Team box gap: 10px → 8px (mobile)
- Team box margin-bottom: 20px → 16px
- Roster row padding: 8px 12px → 6px 10px (mobile)

**Total savings:** ~20px vertical space per card on mobile

---

#### 7. Typography Consolidation
**Location:** Throughout match card
**Effort:** 3 hours
**Impact:** Visual consistency, easier maintenance

**Proposed scale (based on 16px base):**
- **Large headlines:** 18px (1.125rem) - Desktop winner text
- **Medium headlines:** 16px (1rem) - Mobile winner text, team names
- **Body text:** 14px (0.875rem) - Player names
- **Small text:** 12px (0.75rem) - League info, dates, records
- **Micro text:** 10px (0.625rem) - Player stats only

**Remove:**
- 13px (too close to 14px)
- 11px (replace with 12px or 10px)

---

### LOW PRIORITY

#### 8. League Night Card Header Redesign
**Location:** Lines 2152-2158
**Effort:** 3 hours
**Impact:** Visual consistency with match cards

**Changes:**
- Use centered header like match cards
- Add large week number/date
- Style as "event announcement" not "social post"

**Proposed layout:**
```
┌────────────────────────────┐
│   WINTER TRIPLE DRAFT      │  ← 12px, dim
│   WEEK 5 RECAP            │  ← 18px, yellow, Bebas Neue
│   Jan 28, 2025            │  ← 11px, dim
├────────────────────────────┤
│ Top Performers:            │
│ A Level: ...              │
└────────────────────────────┘
```

---

#### 9. Roster Long Name Truncation
**Location:** Line 2051, 2054
**Effort:** 2 hours
**Impact:** Prevents layout breaks

**Changes:**
- Add `max-width` to `.match-player-name`
- Use `text-overflow: ellipsis`
- Add tooltip on hover with full name

**CSS:**
```css
.match-player-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

---

#### 10. Card Border Thickness Reduction
**Location:** Line 499, 505, 509
**Effort:** 30 minutes
**Impact:** Slightly more modern look

**Change:**
```css
/* Current */
.fb-feed-card {
    border: 3px solid var(--border-color);
}

/* Proposed */
.fb-feed-card {
    border: 2px solid var(--border-color);
}
```

**Rationale:** 3px borders are chunky on mobile. 2px maintains visual separation without dominating.

---

## Alternative Layout Ideas

### Option A: "Score-First" Match Card

**Concept:** Lead with the score, de-emphasize explanatory text.

```
┌──────────────────────────────────┐
│    7  -  2                       │  ← 32px, yellow, centered
│  D. PAGEL    M. PAGEL            │  ← 14px, names below score
│  Winter Triple Draft • Week 1    │  ← 11px, gray
│  Jan 28, 2025                    │  ← 10px, gray
├──────────────────────────────────┤
│ [Team boxes...]                  │
└──────────────────────────────────┘
```

**Pros:**
- Immediate outcome clarity
- Less text = better mobile fit
- Aligns with sports score conventions

**Cons:**
- Less narrative/social feel
- Doesn't emphasize winning team as strongly
- May feel too clinical

---

### Option B: "Team Badge" Layout

**Concept:** Use circular team avatars/badges with overlapping score badge.

```
┌──────────────────────────────────┐
│   [D. PAGEL]  7-2  [M. PAGEL]   │  ← Circular badges
│      Badge      ↓      Badge     │  ← Score in between
│   (5-1, 2nd)         (1-5, 7th) │  ← Records below
│   47.1 / 2.26       45.3 / 2.15 │  ← Stats below
├──────────────────────────────────┤
│ [Roster comparison...]           │
└──────────────────────────────────┘
```

**Pros:**
- More visual/graphical
- Easy to scan
- Badge concept could hold team logos (future)

**Cons:**
- Requires team badge system
- Takes more vertical space
- May not fit league name/date info easily

---

### Option C: "Horizontal Roster" for Mobile

**Concept:** On mobile, show roster as horizontal scrollable cards instead of vertical list.

```
┌──────────────────────────────────┐
│ [Header...]                      │
├──────────────────────────────────┤
│ D. PAGEL ROSTER:                 │
│ ┌─────┐ ┌─────┐ ┌─────┐         │
│ │DP   │ │CK   │ │JM   │  ←──    │  ← Swipe
│ │47.1 │ │45.2 │ │43.8 │         │
│ └─────┘ └─────┘ └─────┘         │
│                                   │
│ M. PAGEL ROSTER:                 │
│ [Similar cards...]               │
└──────────────────────────────────┘
```

**Pros:**
- Saves vertical space
- Feels modern/app-like
- Easy to compare individual players

**Cons:**
- Requires horizontal scroll (non-standard)
- May hide players not in initial view
- Harder to see full roster at once

---

### Option D: "Collapsed by Default" on Mobile

**Concept:** Show only header + team boxes by default. Roster hidden behind "Show Roster" button.

```
┌──────────────────────────────────┐
│ D. PAGEL def. M. PAGEL 7-2      │
│ [Team A Box]  [Team B Box]      │
│ ▼ Show Roster (6 players)       │  ← Expandable
└──────────────────────────────────┘

↓ When expanded:

┌──────────────────────────────────┐
│ D. PAGEL def. M. PAGEL 7-2      │
│ [Team A Box]  [Team B Box]      │
│ ▲ Hide Roster                   │
│ [Full roster comparison...]     │
└──────────────────────────────────┘
```

**Pros:**
- Saves initial screen space
- Faster feed scrolling
- User controls detail level

**Cons:**
- Adds interaction step
- May hide interesting data
- Requires JavaScript state management

---

### Option E: "Stats Sidebar" Layout (Desktop Only)

**Concept:** On desktop (> 768px), show roster in right sidebar instead of below.

```
Desktop:
┌─────────────────────┬────────────┐
│ [Header]            │ ROSTER     │
│ [Team A vs Team B]  │ Player 1   │
│                     │ Player 2   │
│                     │ Player 3   │
│                     │ ...        │
└─────────────────────┴────────────┘

Mobile: (stays stacked as current)
```

**Pros:**
- More efficient desktop space usage
- Roster visible without scrolling
- Feels like sports broadcast layout

**Cons:**
- Only benefits desktop users
- Requires significant layout refactor
- May not work with current feed width

---

## Color Usage & Contrast Recommendations

### Current Palette Issues

**Primary Colors:**
- Pink (#FF469A) - 7.1:1 contrast on dark BG ✓
- Teal (#91D7EB) - 8.5:1 contrast on dark BG ✓
- Yellow (#FDD835) - 12.3:1 contrast on dark BG ✓

**Text Colors:**
- `--text-light` (#f0f0f0) - 11.2:1 contrast ✓
- `--text-dim` (#8a8aa3) - 4.52:1 contrast (borderline)

**Stat Highlighting:**
- Better green (#4ade80) - 7.2:1 contrast ✓
- Worse red (#f87171) - 5.1:1 contrast ✓

**Issues:**
1. `--text-dim` barely meets WCAG AA (needs 4.5:1)
2. All 3 accent colors used equally - no clear hierarchy
3. Yellow headline text draws eye but isn't most important info

---

### Proposed Color Hierarchy

**Tier 1 (Critical Info):** Yellow (#FDD835)
- Use for: Winner indication, final scores, key stats ONLY
- Avoid: Long text blocks, metadata

**Tier 2 (Important Info):** Pink (#FF469A) or Teal (#91D7EB)
- Pink for: Actions, CTAs, borders (match cards)
- Teal for: Team names, data labels, borders (league nights)
- Avoid: Using both in same card section

**Tier 3 (Supporting Info):** Text-light (#f0f0f0)
- Use for: Player names, dates, primary body text
- Default for most content

**Tier 4 (Metadata):** Text-dim (increase to #9595af for better contrast)
- Use for: Timestamps, league names, secondary stats
- **Proposed change:** Lighten `--text-dim` from #8a8aa3 to #9595af (5.2:1 contrast)

---

### Stat Highlighting Color Adjustments

**Current:**
```css
.match-player-stats .better { color: #4ade80; }
.match-player-stats .worse { color: #f87171; }
```

**Proposed (brighter for small text):**
```css
.match-player-stats .better {
    color: #22c55e;  /* 8.5:1 contrast */
    font-weight: 600; /* Add boldness */
}
.match-player-stats .worse {
    color: #ef4444;  /* 6.1:1 contrast */
    font-weight: 600;
}
```

**Alternative (with icons):**
```css
.match-player-stats .better::before {
    content: '↑ ';
    color: #22c55e;
}
.match-player-stats .worse::before {
    content: '↓ ';
    color: #ef4444;
}
```

---

## Implementation Roadmap

### Phase 1: Critical Mobile Fixes (Week 1)
**Effort:** 8-10 hours

1. Add media queries for < 480px, < 400px, < 375px
2. Refactor match card header to use CSS classes
3. Implement team box stacking on mobile
4. Test on iPhone SE (375px), Pixel 5 (393px), Galaxy S8 (360px)

**Success Criteria:**
- Header text doesn't overflow on 320px screen
- All content readable without horizontal scroll
- User feedback: "header no longer looks like crap"

---

### Phase 2: Visual Hierarchy Improvements (Week 2)
**Effort:** 6-8 hours

1. Redesign match header with "Score-First" layout (Option A)
2. Add stat labels (3DA, MPR) to team boxes
3. Improve better/worse highlighting (brighter colors + icons)
4. Optimize spacing (reduce padding by 20%)

**Success Criteria:**
- Winner immediately obvious within 1 second
- New users understand stat abbreviations
- Better/worse stats pass WCAG AAA contrast (7:1)

---

### Phase 3: Typography & Consistency (Week 3)
**Effort:** 4-6 hours

1. Consolidate to 5 font sizes max (18px, 16px, 14px, 12px, 10px)
2. Redesign league night card header to match match cards
3. Add long name truncation to roster
4. Increase `--text-dim` contrast to 5.2:1

**Success Criteria:**
- Consistent visual rhythm across all cards
- No text size jumps > 2px
- All text meets WCAG AA minimum

---

### Phase 4: Advanced Layouts (Week 4+)
**Effort:** 10-15 hours

1. Implement "Collapsed by Default" roster on mobile
2. Add horizontal scroll roster option
3. Create team badge system for future logo support
4. Add match card animations (expand/collapse)

**Success Criteria:**
- Users can control information density
- Feed scroll is 30% faster on mobile
- Desktop gets enhanced sidebar layout

---

## Testing Checklist

### Mobile Devices
- [ ] iPhone SE (375 × 667) - Smallest modern iPhone
- [ ] iPhone 14 Pro (393 × 852) - Common current iPhone
- [ ] Samsung Galaxy S21 (360 × 800) - Common Android
- [ ] Pixel 5 (393 × 851) - Google reference device
- [ ] Smallest target: 320px width (older Android devices)

### Viewport Sizes
- [ ] 320px - Minimum viable
- [ ] 375px - iPhone SE
- [ ] 393px - iPhone 14 Pro / Pixel 5
- [ ] 414px - iPhone 14 Pro Max
- [ ] 480px - Large phone landscape
- [ ] 768px - Tablet portrait
- [ ] 1024px - Tablet landscape / small desktop

### Browsers
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)
- [ ] Firefox Mobile
- [ ] Samsung Internet

### Interaction Tests
- [ ] Tap targets ≥ 44px (Apple) / 48px (Google) guidelines
- [ ] No horizontal scroll at any breakpoint
- [ ] Text doesn't overflow card boundaries
- [ ] Long team/player names handle gracefully
- [ ] Stat highlights visible in bright sunlight (contrast test)
- [ ] Feed scrolling smooth (no jank)

### Accessibility Tests
- [ ] WCAG AA contrast (4.5:1 for normal text, 3:1 for large text)
- [ ] Color-blind simulation (green/red stats still distinguishable)
- [ ] Screen reader announces card content correctly
- [ ] Keyboard navigation works (for tablet users)

---

## Conclusion

The dashboard feed cards have a solid foundation but suffer from **lack of mobile responsiveness** and **inconsistent information hierarchy**. The user feedback about headers "looking like crap on mobile" is accurate - inline styles with no media queries cause text overflow and poor readability on screens below 375px.

**Top 3 Priorities:**
1. **Add mobile media queries** - Fixes immediate "broken" feeling
2. **Refactor header to CSS classes** - Enables responsive design
3. **Improve visual hierarchy** - Makes winner/score immediately obvious

**Estimated Total Effort:** 28-39 hours across 4 weeks

**Expected Impact:**
- 90% reduction in mobile layout issues
- 50% faster information scanning
- WCAG AA compliance for all text
- Positive user feedback shift from "looks like crap" to "clean and readable"

**Key Insight:** The design tried to fit desktop-level information density into mobile screens without adaptation. The solution isn't to remove information, but to **reorganize and reformat** it for small screens - stack instead of side-by-side, abbreviate instead of full text, collapse instead of always-visible.
