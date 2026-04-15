# BRDC Visual Design Consistency Audit
**Date:** 2026-02-04
**Scope:** All HTML pages in `public/pages/` directory (54 pages analyzed)
**Goal:** Identify visual inconsistencies and establish design standards

---

## Executive Summary

**Overall Assessment:** The BRDC app has a strong color foundation (pink #FF469A, teal #91D7EB, yellow #FDD835) that is **100% consistent** across all pages. However, there are **significant inconsistencies** in:
- Background color values (two competing standards)
- Border-radius values (at least 12 different values in use)
- Font family declarations for Bebas Neue
- Box-shadow patterns
- Button gradient directions
- Card/panel background colors

These inconsistencies create subtle visual friction and maintenance overhead.

---

## 1. COLOR VARIABLES ✅ CONSISTENT

### Brand Colors (Perfect Consistency)
All 54 pages use identical color values:

| Variable | Value | Usage |
|----------|-------|-------|
| `--pink` | `#FF469A` | Primary brand color, active states, headers |
| `--teal` | `#91D7EB` | Secondary brand color, links, badges |
| `--yellow` | `#FDD835` | Accent color, winners, highlights |

**Status:** ✅ **No action needed** - This is the foundation to build on.

### Utility Colors (Consistent)
| Variable | Value | Usage |
|----------|-------|-------|
| `--success` | `#22c55e` | Success states |
| `--danger` | `#ef4444` | Errors, destructive actions |

**Status:** ✅ Consistent

---

## 2. BACKGROUND COLORS ⚠️ MAJOR INCONSISTENCY

### Two Competing Standards

**Standard A: "Regular Pages" (38 pages)**
```css
--bg-dark: #1a1a2e;
--bg-panel: #16213e;
--bg-card: #1e2a47;
```
Used by: dashboard.html, league-view.html, match-hub.html, create-league.html, and most pages

**Standard B: "Dark Mode Pages" (6 pages)**
```css
--bg-dark: #0a0a1a;
--bg-panel: #12122a;
--bg-card: #1a1a3a;
```
Used by:
- x01-scorer.html
- league-cricket.html
- live-scoreboard.html
- signup.html
- (2 others)

### The Problem
- **Standard A** is warmer and more purple-tinted
- **Standard B** is darker and more blue-tinted
- Both are used inconsistently - there's no clear "scorer pages use dark, dashboard pages use regular" pattern
- `signup.html` uses dark mode colors but is a login page like `dashboard.html` (which uses regular colors)

### Recommendation
**Decision needed:**
1. **Option A:** Standardize on `#1a1a2e` family (most common) for ALL pages
2. **Option B:** Define clear contexts - scorers/live pages use `#0a0a1a`, admin/dashboard pages use `#1a1a2e`
3. **Option C:** Create a "dark mode toggle" that swaps between the two palettes

**Priority:** 🔴 **HIGH** - This affects every page

---

## 3. FONT FAMILY DECLARATIONS ⚠️ INCONSISTENT

### Bebas Neue Fallback Inconsistency

**Two patterns found:**

**Pattern 1:** `font-family: 'Bebas Neue', cursive;` (35 instances)
- Used in: dashboard.html, create-league.html, create-tournament.html, director-dashboard.html

**Pattern 2:** `font-family: 'Bebas Neue', sans-serif;` (12 instances)
- Used in: dart-trader-listing.html

### The Problem
- `cursive` is not an accurate fallback for Bebas Neue (which is a display/sans-serif font)
- Inconsistent fallbacks mean if Bebas Neue fails to load, different pages will look different
- `sans-serif` is more semantically correct

### Special Case: Rowdies Font
- `x01-scorer.html` uses `'Rowdies', cursive` for `.game-title`
- This is the ONLY page that uses Rowdies font
- No other page loads or references Rowdies

### Recommendation
1. Standardize on: `font-family: 'Bebas Neue', sans-serif;`
2. Document Rowdies as "scorer-specific" font OR remove it and use Bebas Neue for consistency
3. Search-and-replace all `, cursive` with `, sans-serif` for Bebas Neue

**Priority:** 🟡 **MEDIUM** - Cosmetic but easy to fix

---

## 4. BORDER-RADIUS VALUES ⚠️ HIGHLY INCONSISTENT

### Analysis
Found **12 different border-radius values** used across pages:
- `4px` - 47 instances
- `6px` - 84 instances
- `8px` - 217 instances (most common)
- `10px` - 37 instances
- `12px` - 142 instances (second most common)
- `14px` - 5 instances
- `16px` - 24 instances
- `20px` - 8 instances
- `22px` - 3 instances
- `24px` - 6 instances
- `26px` - 2 instances
- Various others: `18px`, `30px`

### Current Usage Patterns (No Clear System)
| Element Type | Observed Values | Notes |
|--------------|----------------|-------|
| Buttons | 6px, 8px, 10px, 12px | No consistency |
| Cards | 8px, 12px, 14px, 16px | Most use 12px |
| Modals | 12px, 16px | Larger modals tend toward 16px |
| Inputs | 6px, 8px, 10px | No pattern |
| Pills/Badges | 4px, 6px, 20px, 22px, 24px | Highly variable |

### Recommendation
Establish a **border-radius scale** in `:root`:
```css
:root {
    --radius-sm: 6px;    /* Small: badges, tags */
    --radius-md: 10px;   /* Medium: buttons, inputs */
    --radius-lg: 16px;   /* Large: cards, panels */
    --radius-xl: 24px;   /* Extra large: modals, hero sections */
    --radius-full: 9999px; /* Pills, circular buttons */
}
```

Then refactor all border-radius declarations to use these variables.

**Priority:** 🟡 **MEDIUM** - Large refactor but improves maintainability

---

## 5. BOX-SHADOW PATTERNS ⚠️ TWO COMPETING STYLES

### Pattern A: "Offset Shadow" (Retro/Brutalist Style)
```css
box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
box-shadow: 6px 6px 0 rgba(0,0,0,0.4);
box-shadow: 8px 8px 0 rgba(0,0,0,0.4);
```
- Hard-edged, no blur
- Used for: login boxes, primary buttons, card layouts
- **Signature BRDC style** (retro dart aesthetic)

**Hover variant:**
```css
transform: translate(-2px, -2px);
box-shadow: 6px 6px 0 rgba(0,0,0,0.4);
```

### Pattern B: "Blur Shadow" (Modern/Soft Style)
```css
box-shadow: 0 4px 20px rgba(0,0,0,0.4);
box-shadow: 0 8px 25px rgba(0,0,0,0.3);
box-shadow: 0 20px 60px rgba(0,0,0,0.5);
```
- Soft blur, no offset
- Used for: modals, dropdowns, floating elements
- **Modern UI convention**

### Glow Shadows (Brand Color Accents)
```css
box-shadow: 0 0 20px rgba(255,70,154,0.3); /* Pink glow */
box-shadow: 0 0 15px rgba(145,215,235,0.4); /* Teal glow */
box-shadow: 0 0 20px rgba(253,216,53,0.4); /* Yellow glow */
```
- Used for: active states, focus states, winners

### The Problem
Both patterns are used inconsistently on similar elements:
- Some buttons use offset shadows, others use blur shadows
- Some cards use offset, others use blur
- No clear rule for when to use which

### Recommendation
**Standardize by element purpose:**
- **Primary/CTA buttons:** Offset shadow (4px 4px 0)
- **Cards/Panels:** Offset shadow (4px 4px 0) - maintains retro aesthetic
- **Modals/Dropdowns:** Blur shadow (0 8px 25px) - helps with depth hierarchy
- **Floating/Temporary UI:** Blur shadow
- **Active/Focus states:** Add glow shadow (0 0 20px with brand color)

Define shadow utilities:
```css
:root {
    --shadow-offset-sm: 2px 2px 0 rgba(0,0,0,0.4);
    --shadow-offset-md: 4px 4px 0 rgba(0,0,0,0.4);
    --shadow-offset-lg: 8px 8px 0 rgba(0,0,0,0.4);
    --shadow-blur-sm: 0 2px 10px rgba(0,0,0,0.3);
    --shadow-blur-md: 0 8px 25px rgba(0,0,0,0.4);
    --shadow-blur-lg: 0 20px 60px rgba(0,0,0,0.5);
    --shadow-glow-pink: 0 0 20px rgba(255,70,154,0.3);
    --shadow-glow-teal: 0 0 20px rgba(145,215,235,0.3);
    --shadow-glow-yellow: 0 0 20px rgba(253,216,53,0.4);
}
```

**Priority:** 🟡 **MEDIUM** - Affects brand perception but not functionality

---

## 6. BUTTON STYLES ⚠️ GRADIENT DIRECTION INCONSISTENCY

### Primary Pink Buttons
**Three gradient patterns found:**

**Pattern A: 180deg (Vertical)**
```css
background: linear-gradient(180deg, var(--pink) 0%, #d63384 100%);
```
Used in: dashboard.html (login-btn), create-league.html, dart-trader-listing.html

**Pattern B: 135deg (Diagonal)**
```css
background: linear-gradient(135deg, var(--pink), #d63384);
```
Used in: create-tournament.html, captain-dashboard.html, create-league.html (some buttons)

**Pattern C: Pink-to-Teal Gradient**
```css
background: linear-gradient(135deg, var(--pink), var(--teal));
```
Used in: bot-management.html, chat-room.html, friends.html (avatars)

### The Problem
- Same semantic button (e.g., "Create" or "Submit") uses different gradient directions on different pages
- No clear rule for when to use 180deg vs 135deg
- Pink-to-teal is used for special cases but not documented

### Recommendation
Standardize button gradients:
```css
/* Primary pink button */
--btn-primary-bg: linear-gradient(180deg, var(--pink) 0%, #d63384 100%);

/* Secondary teal button */
--btn-secondary-bg: linear-gradient(180deg, var(--teal) 0%, #6bc4db 100%);

/* Special/Premium gradient (pink to teal) */
--btn-premium-bg: linear-gradient(135deg, var(--pink) 0%, var(--teal) 100%);
```

**Priority:** 🟡 **MEDIUM** - Visual polish issue

---

## 7. CARD/PANEL STYLING ⚠️ INCONSISTENT BORDERS

### Border Patterns Found

**Pattern A: Black Border (Retro Style)**
```css
border: 3px solid #000;
border-radius: 12px;
box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
```
Used in: dashboard.html (login-box), league-view.html (match cards)

**Pattern B: Subtle Border**
```css
border: 2px solid rgba(255,255,255,0.1);
border-radius: 12px;
box-shadow: 0 4px 20px rgba(0,0,0,0.4);
```
Used in: Various pages for less prominent cards

**Pattern C: No Border**
```css
border: none;
border-radius: 12px;
background: var(--bg-card);
```
Used in: Some list items, secondary cards

**Pattern D: Colored Border (Event/Match Cards)**
```css
border: 3px solid var(--teal);  /* League match */
border: 3px solid var(--yellow); /* Tournament */
border: 3px solid var(--pink);   /* Social event */
```
Used in: Calendar cards, match cards (per RULE 8)

### Recommendation
**Establish clear card hierarchy:**
```css
/* Primary card (important actions, login, etc.) */
.card-primary {
    background: var(--bg-panel);
    border: 3px solid #000;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-offset-md);
}

/* Secondary card (content display) */
.card-secondary {
    background: var(--bg-card);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-blur-sm);
}

/* Event card (colored border for type indication) */
.card-event {
    background: var(--bg-card);
    border: 3px solid var(--event-color); /* Dynamic */
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-offset-md);
}
```

**Priority:** 🟡 **MEDIUM** - Improves visual hierarchy

---

## 8. SPACING PATTERNS ⚠️ NO STANDARDIZATION

### Observations
- Padding values range from `4px` to `30px` with no clear scale
- Margin values similarly inconsistent
- No spacing variables defined in `:root`

### Common Spacing Values Found
- `4px`, `6px`, `8px`, `10px`, `12px`, `14px`, `16px`, `20px`, `24px`, `30px`, `40px`

### Recommendation
Establish a spacing scale (following 4px base):
```css
:root {
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;
    --space-16: 64px;
}
```

**Priority:** 🟢 **LOW** - Nice-to-have, large refactor

---

## 9. NAVIGATION STYLES ✅ EXCELLENT

### Shared Navigation CSS
Files: `public/css/brdc-navigation.css`

**Assessment:** This is the **best example of consistency** in the codebase.

**Strengths:**
- Single source of truth for navigation
- CSS variables used properly (`--nav-bg`, `--nav-border`, `--nav-active`)
- Responsive breakpoints clearly defined
- Mobile, tablet, and desktop patterns all in one file

**Status:** ✅ **No changes needed** - This is the model to follow for other components

---

## 10. SEARCH MODAL STYLES ✅ GOOD

### Shared Search CSS
Files: `public/css/brdc-search.css`

**Assessment:** Clean, self-contained, uses modern patterns.

**Minor note:**
- Search modal uses `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)` for background
- This hardcodes colors that could be CSS variables

**Recommendation:**
```css
/* Change this: */
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

/* To this: */
background: linear-gradient(135deg, var(--bg-dark) 0%, var(--bg-panel) 100%);
```

**Priority:** 🟢 **LOW** - Works fine as-is

---

## 11. LOGIN PAGE STYLES ✅ MOSTLY CONSISTENT

### Reference: dashboard.html Login (RULE 11)
This is the canonical login style per project rules.

**Key styles:**
```css
.login-box {
    background: var(--bg-panel);
    border: 3px solid #000;
    border-radius: 16px;
    box-shadow: 8px 8px 0 rgba(0,0,0,0.4);
}

.form-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 24px;
    color: var(--yellow);
    letter-spacing: 4px;
}

.login-btn {
    background: linear-gradient(180deg, var(--pink) 0%, #d63384 100%);
    border: 3px solid #000;
    box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
}
```

**Pages that should match:**
- ✅ dashboard.html (reference)
- ✅ stat-verification.html (matches)
- ⚠️ signup.html (uses different bg-dark value)

**Status:** Mostly consistent, but `signup.html` needs bg-dark correction

---

## 12. MATCH CARD STYLES ⚠️ NEEDS DOCUMENTATION

### Reference: dashboard.html + league-view.html

**Key patterns from RULE 9 & RULE 10:**
- Header grid: `1fr auto auto auto 1fr` (upcoming) or `1fr auto auto auto auto auto 1fr` (completed)
- Winner star: 36px font-size, in outer columns
- Team names: 22px Bebas Neue, teal color (yellow when winner)
- Standing badge: 10px font, pink background
- Record badge: 9px font, gray background (but note: not rendering correctly per RULE 9)

**Problem:** Record badge styling is documented as 9px but renders larger - CSS specificity issue not yet resolved.

**Status:** ⚠️ Needs debugging (separate from audit scope)

---

## 13. FONT LOADING ✅ CONSISTENT

### All pages load fonts consistently:
```html
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

**Fonts used:**
- **Inter**: Body text (all weights 400-800) - ✅ Universal
- **Bebas Neue**: Headers, titles, buttons - ✅ Universal
- **JetBrains Mono**: Monospace (PINs, codes) - ✅ Used appropriately
- **Rowdies**: Only on x01-scorer.html - ⚠️ Outlier

**Status:** ✅ Good, but Rowdies should be evaluated for removal

---

## PRIORITY MATRIX

### 🔴 High Priority (Fix Soon)
1. **Background color standardization** - Choose Standard A or Standard B, apply everywhere
2. **Document card/panel border patterns** - Create reusable classes

### 🟡 Medium Priority (Next Sprint)
3. **Bebas Neue fallback** - Change all `, cursive` to `, sans-serif`
4. **Button gradient standardization** - Pick 180deg or 135deg, document special cases
5. **Box-shadow utilities** - Create CSS variables for common shadows
6. **Border-radius scale** - Establish 4-value system and refactor

### 🟢 Low Priority (Future Cleanup)
7. **Spacing scale** - Create CSS variables for padding/margin
8. **Search modal background** - Use CSS variables instead of hardcoded colors

---

## RECOMMENDED ACTION PLAN

### Phase 1: Decision & Documentation (Week 1)
1. **Choose background color standard** (A or B)
2. **Document component patterns** (create a style guide doc)
3. **Define CSS variable expansion** (shadows, radii, spacing)

### Phase 2: Create Shared Utilities (Week 2)
1. Create `public/css/brdc-utilities.css` with:
   - Border-radius scale
   - Box-shadow utilities
   - Spacing scale
   - Button gradient classes

### Phase 3: Incremental Refactoring (Weeks 3-6)
1. Refactor pages in priority order:
   - Start with most-used pages (dashboard, league-view, match-hub)
   - Then login pages (dashboard, stat-verification, signup)
   - Then creation flows (create-league, create-tournament)
   - Finally, specialized pages (scorers, admin)

2. For each page:
   - Update background colors to standard
   - Replace hardcoded border-radius with variables
   - Replace gradients with CSS variables
   - Replace shadows with utility classes

### Phase 4: Testing & Validation
1. Visual regression testing on 5-10 key pages
2. Mobile device testing
3. Create automated CSS linting rules to prevent regression

---

## STRENGTHS TO PRESERVE

### What's Working Well ✅
1. **Brand colors** - Perfect consistency across all pages
2. **Navigation system** - Single source of truth, well-structured
3. **Login page aesthetic** - Strong retro/brutalist style with offset shadows
4. **Match card layouts** - Detailed specifications in RULE 9 & 10
5. **Mobile responsiveness** - Good use of media queries throughout

### Design Identity 🎨
The BRDC app has a **clear visual identity:**
- Retro/brutalist aesthetic with offset shadows
- Bold brand colors (pink, teal, yellow)
- Dart club/sports bar vibe
- High contrast and readability

**Recommendation:** During standardization, preserve this identity. The offset shadows and bold colors are differentiators - don't smooth them away into generic Material Design.

---

## CONCLUSION

The BRDC app has **excellent color consistency** (100% alignment) and a **strong visual identity**. The main issues are:

1. **Two competing background color systems** - Decision needed
2. **No design token system** - Leads to inconsistent border-radius, shadows, spacing
3. **Missing style documentation** - Patterns exist but aren't codified

These issues are **fixable** and don't require a redesign - just systematization of what already exists.

**Estimated effort:**
- Phase 1 (decisions): 2-4 hours
- Phase 2 (utilities file): 4-6 hours
- Phase 3 (refactoring): 20-30 hours across 54 pages
- Phase 4 (testing): 4-6 hours

**Total: ~30-40 hours** to achieve full design consistency.

---

## APPENDIX: FILE ANALYSIS SUMMARY

**Pages with :root variables:** 46/54 (85%)
**Pages using --bg-dark #1a1a2e:** 38 (70%)
**Pages using --bg-dark #0a0a1a:** 6 (11%)
**Pages with Bebas Neue, cursive:** 35 (65%)
**Pages with Bebas Neue, sans-serif:** 12 (22%)
**Border-radius values found:** 12 unique values
**Box-shadow patterns found:** 3 main types (offset, blur, glow)

---

**Report completed:** 2026-02-04
**Analyst:** Claude (Visual Design Consistency Specialist)
**Status:** ✅ RESEARCH COMPLETE - NO CODE MODIFIED
