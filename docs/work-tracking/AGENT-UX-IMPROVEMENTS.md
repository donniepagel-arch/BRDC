# UX Improvements - Session Report

**Date:** 2026-01-24
**Task:** UX Improvements - Glossary, Breadcrumbs, Tooltips

---

## Completed Items

### 1. Glossary Page Created
**File:** `/public/pages/glossary.html`

Created a comprehensive glossary page with darts terminology including:
- **3DA** - Three Dart Average (points per 3 darts)
- **MPR** - Marks Per Round (cricket marks per 3 darts)
- **SIDO** - Single In, Double Out
- **DIDO** - Double In, Double Out
- **Cork** - Throw to determine who starts
- **Leg** - Single game
- **Set** - Group of legs
- **Match** - Complete contest between teams
- **Level** - Player skill rating (A/B/C)
- **Fill-in** - Substitute player
- **Checkout** - Finishing score in X01
- **Bust** - Going over 0 or leaving 1
- **Master Out** - Finish on double OR triple

Features:
- Alphabetical listing with letter navigation
- Search/filter functionality
- Category badges (Stats, Gameplay, Structure)
- Example text for each term
- Breadcrumb navigation back to dashboard
- Responsive mobile design

### 2. Breadcrumbs Added to Deep Pages

Added breadcrumb navigation to improve site navigation:

| Page | Breadcrumb Path |
|------|----------------|
| `match-hub.html` | Dashboard > [League Name] > Match Report |
| `player-profile.html` | Dashboard > Player Profile |
| `team-profile.html` | Dashboard > [League Name] > Team Profile |
| `league-view.html` | Dashboard > [League Name] |

Implementation details:
- CSS for breadcrumbs added to each page
- Dynamic league name populated from loaded data
- Links are functional and navigate correctly
- Consistent styling with site theme (teal links, dim separators)

### 3. Tooltip Hints for Stats Jargon

Added CSS-only tooltips to stat labels on key pages:

**Pages with tooltip CSS:**
- `dashboard.html`
- `match-hub.html`
- `league-view.html`
- `player-profile.html`

**Implementation:**
```css
[data-tooltip] {
    cursor: help;
    border-bottom: 1px dotted var(--text-dim);
}
[data-tooltip]:hover::after {
    content: attr(data-tooltip);
    /* positioned above element */
}
```

**Static tooltips added:**
- Dashboard profile stats: "3DA" -> "Three Dart Average - points per 3 darts"
- Dashboard profile stats: "MPR" -> "Marks Per Round - cricket marks per 3 darts"

The tooltip CSS is now available for use in dynamically generated content by adding `data-tooltip="description"` to any element.

---

## Not Completed (Deferred)

### Score My Match Button
**Status:** Deferred - requires deeper integration

The dashboard already has a "GO TO MATCH NIGHT" button for today's matches. Adding a general "Score Now" button for all upcoming matches requires:
1. Modifying JavaScript-generated match card templates
2. Adding sessionStorage preload handling to scorer pages
3. Complex state management for preloaded match data

**Recommendation:** The existing Match Hub -> Game Setup flow provides this functionality. Consider if direct scorer links are necessary.

### Preload Handling for Scorer Pages
**Status:** Deferred - dependent on Score My Match

The `league-501.html` and `league-cricket.html` pages are complex (2000+ lines each) and already support URL parameters for all game configuration. Adding sessionStorage preload would require:
1. New initialization checks at page load
2. State restoration logic
3. UI feedback for preloaded state

**Recommendation:** The current URL parameter approach works well. Preload via sessionStorage could be added later if direct dashboard -> scorer links are implemented.

---

## Files Modified

1. `/public/pages/glossary.html` - **NEW FILE**
2. `/public/pages/dashboard.html` - Added tooltip CSS and data-tooltip attributes
3. `/public/pages/match-hub.html` - Added breadcrumbs (CSS + HTML + JS), tooltip CSS
4. `/public/pages/player-profile.html` - Added breadcrumbs (CSS + HTML), tooltip CSS
5. `/public/pages/team-profile.html` - Added breadcrumbs (CSS + HTML + JS)
6. `/public/pages/league-view.html` - Added breadcrumbs (CSS + HTML + JS), tooltip CSS

---

## Testing Notes

1. **Glossary Page:** Navigate to `/pages/glossary.html` - verify search works and all terms display
2. **Breadcrumbs:** Visit each modified page and verify:
   - Breadcrumbs appear below header
   - Links navigate correctly
   - League names populate dynamically
3. **Tooltips:** Hover over "3DA" and "MPR" labels in dashboard profile section

---

## Next Steps

If Score My Match / Preload features are desired:
1. Add "SCORE NOW" button to dashboard match cards
2. Implement sessionStorage preload in scorer pages
3. Add toast notification for preloaded state

Consider adding glossary link to navigation menu or footer for discoverability.
