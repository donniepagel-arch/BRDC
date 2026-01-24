# Cork Rules Validation and Feedback Implementation

**Date:** 2026-01-24
**File Modified:** `public/pages/create-league.html`

## Summary

Added comprehensive cork rules configuration with validation, tooltips, contextual visibility, and a dynamic preview panel to help league directors understand how their cork settings will work in practice.

## Changes Made

### 1. CSS Styles Added (Lines ~773-870)

New styles for:
- **Tooltip System**: Hover-triggered info tooltips with explanation text
- **Warning Box**: Yellow-bordered alert box for unusual combinations
- **Preview Panel**: Live example panel showing how settings work
- **Contextual Visibility**: Dimmed fields that become active based on context

### 2. Cork Fields Section Replaced (Match Format Step)

Previously: Only one visible "Cork Rules" dropdown with two hidden inputs for `cork_option` and `cork_winner_gets`.

Now: Three visible, properly labeled fields:

| Field | Purpose |
|-------|---------|
| **Start Rules** | Who throws first each leg (cork every leg, alternate, loser/winner starts) |
| **Cork Option Rules** | Who gets to choose throw order at the cork (alternate, winner, loser) |
| **Cork Winner Gets** | For Corks Choice games - does winner pick game AND start, or just game? |

Each field has:
- Info icon (?) with hover tooltip
- Clear label
- Dropdown with all valid options

### 3. Contextual Visibility for "Cork Winner Gets"

The "Cork Winner Gets" field is now:
- **Enabled (full opacity)** when at least one round has "Corks Choice" game type
- **Disabled (dimmed, non-interactive)** when no Corks Choice rounds exist
- Shows helper text: "Add a Corks Choice round to enable this setting"

### 4. Warning System

Yellow warning box appears for:
- **Confusing combination**: Winner starts + Loser chooses
- **Unusual setup**: Loser starts + Winner chooses (informational)
- **Efficiency tip**: Cork every leg with all single-leg sets (suggest Alternate)

### 5. Dynamic Preview Panel

Shows a live "How It Works" example based on current selections:

```
1. Players cork to start every leg
2. Players alternate who gets to choose throw order
3. In Corks Choice rounds: Cork winner picks the game AND throw order
```

Preview updates automatically when:
- Any cork dropdown changes
- Rounds are added/removed (Corks Choice detection)

## JavaScript Functions Added

| Function | Purpose |
|----------|---------|
| `hasCorkChoiceRounds()` | Returns true if any round has game_type = 'corks_choice' |
| `updateCorkWinnerGetsVisibility()` | Shows/hides Cork Winner Gets field based on format |
| `checkCorkWarnings()` | Evaluates settings and displays warnings |
| `updateCorkPreview()` | Rebuilds the preview panel with current selections |

The `renderRounds()` function was wrapped to also trigger cork updates when rounds change.

## Testing Notes

1. **Default state**: Cork Winner Gets field should be dimmed (no Corks Choice rounds by default)
2. **Add Corks Choice round**: Field should become active
3. **Select unusual combinations**: Warning should appear
4. **Preview updates**: Should reflect changes immediately

## Deployment

```bash
firebase deploy --only hosting
```

Live URL: https://brdc-v2.web.app/pages/create-league.html

## Related Rules

- RULE 21: League Creator Field Decisions
- RULE 22: Game Options Consistency
