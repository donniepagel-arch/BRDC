# Captain Dashboard Redesign - Complete

## Deployment
✅ **Deployed to:** https://brdc-v2.web.app/pages/captain-dashboard.html
⏰ **Completed:** February 13, 2026

---

## Changes Implemented

### 1. Header Redesign
**Before:** Large team name with record on the right
**After:** Compact header with standing badge, team averages, and minimal MESSAGE TEAM button

**New Elements:**
- Standing badge (1st, 2nd, 3rd, 4th, etc.) in pink
- Record badge (W-L format) in white
- Team 3DA and MPR stats in teal
- League name in dim text
- Smaller MESSAGE TEAM button in header-actions-row

**Removed:**
- `gamesRecord` element (was showing "Games: 7-2" - no longer needed)
- Large header layout

### 2. Matchup Section (Replaces Roster Strip)
**Before:** Simple roster list with 180s and high checkout columns
**After:** Position-based matchup view with opponent comparison

**New Features:**
- **Week-based title:** "WEEK 3 MATCHUP vs TEAM NAME (record)"
- **Position groups:** P1, P2, P3 labels separating player pairs
- **Interleaved rows:** Your player → Opponent player for each position
- **Side indicators:** Teal vertical bar for your players, pink for opponents
- **Stat highlighting:** Better stats shown in teal/bold, worse in dim
- **Win percentage:** Shows combined X01 + Cricket leg win %
- **Team averages:** Bottom rows showing YOUR AVG vs OPP AVG
- **Opponent opacity:** Opponent rows at 65% opacity for visual hierarchy

**Columns:**
1. Indicator (colored vertical bar)
2. Player name + level badge
3. 3DA
4. MPR
5. W% (win percentage)
6. Status (IN/OUT/—) with fill-in button

### 3. Level Badge Redesign
**Before:** Gold/Silver/Bronze gradient backgrounds
**After:** Subtle colored backgrounds matching team color scheme

- **Level A:** Pink background (rgba(255,70,154,0.25))
- **Level B:** Teal background (rgba(145,215,235,0.2))
- **Level C:** Yellow background (rgba(253,216,53,0.15))
- **Unknown:** Dim background (rgba(255,255,255,0.08))

Smaller size (9px font, 1px 6px padding) for cleaner look.

### 4. CSS Updates

**Added:**
- `.header-top-row` - Flex container for team name/standing/record
- `.header-team-info` - Group team name elements
- `.header-stats-row` - Row for league name and team stats
- `.header-stat` / `.header-stat-label` / `.header-stat-value` - Stat display
- `.standing-badge` - Pink standing indicator
- `.record-badge` - White record text
- `.matchup-section` - Container for matchup area
- `.matchup-header` / `.matchup-title` / `.matchup-vs-team` - Header elements
- `.matchup-group` - Container for position-based grouping
- `.matchup-pos-label` - P1/P2/P3 labels
- `.matchup-player-row` - Grid for player data
- `.matchup-indicator` - Colored vertical bars (yours/theirs)
- `.matchup-player-name` - Player name with level badge
- `.matchup-stat` - Stat cells with .better/.worse classes
- `.matchup-status` / `.matchup-status-dot` / `.matchup-status-label` - Status display
- `.matchup-team-avg` / `.matchup-avg-label` - Team average rows
- `.matchup-col-headers` - Column header row

**Removed/Replaced:**
- `.roster-strip` → `.matchup-section`
- `.roster-strip-header` → `.matchup-col-headers`
- `.roster-row` → `.matchup-player-row`
- `.roster-pos` → `.matchup-pos-label`
- `.roster-name` → `.matchup-player-name`
- `.roster-stat` → `.matchup-stat`
- `.roster-status` → `.matchup-status`
- `.roster-status-dot` → `.matchup-status-dot`
- `.roster-status-label` → `.matchup-status-label`

### 5. JavaScript Updates

**Function Changes:**
- `renderRoster(team, playerStats)` → `renderMatchup(team, playerStats, nextOpponent)`
- All calls to `renderRoster` updated to `renderMatchup` with `next_opponent` parameter

**New Logic in renderMatchup:**
- Checks for `nextOpponent` data from `getCaptainDashboard` function
- Updates matchup header with week number and opponent info
- Calculates win percentage from combined X01 + Cricket legs
- Compares player stats to highlight better/worse performance
- Renders opponent player rows interleaved with your players
- Shows team average comparison rows at bottom

**Data Flow:**
```javascript
dashboardData = {
    team: { team_3da, team_mpr, standing, wins, losses, ... },
    next_opponent: {
        match_week: 3,
        team: { name, record, team_3da, team_mpr },
        players: [
            { id, name, position, level, stats: { x01_three_dart_avg, cricket_mpr, ... } }
        ]
    }
}
```

---

## Backend Dependencies

**Cloud Function:** `getCaptainDashboard`
Must return:
- `team.standing` (1-based rank)
- `team.team_3da` (team average 3DA)
- `team.team_mpr` (team average MPR)
- `next_opponent` object with:
  - `match_week` (number)
  - `team` object (id, name, standing, record, team_3da, team_mpr)
  - `players` array with stats for each position

---

## Testing Checklist

### Visual Verification
- [ ] Header shows standing badge (e.g., "1st", "2nd")
- [ ] Header shows record badge (e.g., "5-1")
- [ ] Header shows team 3DA and MPR stats
- [ ] MESSAGE TEAM button is smaller and in header-actions-row
- [ ] Matchup section shows "WEEK X MATCHUP vs TEAM (record)"
- [ ] P1, P2, P3 labels appear above player pairs
- [ ] Your players have teal indicator bars
- [ ] Opponent players have pink indicator bars and 65% opacity
- [ ] Level badges use subtle colored backgrounds
- [ ] Better stats are highlighted in teal/bold
- [ ] Worse stats are dimmed
- [ ] Team average rows appear at bottom when opponent exists

### Functional Testing
- [ ] Status dots (IN/OUT/—) toggle correctly
- [ ] FILL-IN button appears when player is OUT
- [ ] Opponent data loads from `next_opponent` field
- [ ] Win percentages calculate correctly (combined X01 + Cricket)
- [ ] Stat comparisons highlight correct player
- [ ] Fallback to "ROSTER" title when no next opponent

### Edge Cases
- [ ] No next opponent → Shows "ROSTER" with no opponent rows
- [ ] Missing opponent for position → Shows only your player
- [ ] Missing stats → Shows "-" for stats
- [ ] No standing data → Shows "—" badge

---

## Files Modified

1. **`public/pages/captain-dashboard.html`**
   - Lines 160-268: CSS for header and matchup section
   - Lines 665-676: Level badge CSS
   - Lines 1232-1267: Header HTML
   - Lines 1269-1289: Matchup section HTML
   - Lines 1702-1744: `renderDashboard()` function
   - Lines 1847-1971: `renderMatchup()` function (replaced `renderRoster`)
   - Lines 2406, 2417: Updated `toggleRosterStatus` to call `renderMatchup`

---

## Design Notes

### Visual Hierarchy
1. **Team identity** (top): Name, standing, record
2. **League context** (second row): League name, team averages
3. **Action button** (third row): MESSAGE TEAM
4. **Matchup comparison** (section): Position-based player matchups

### Color Usage
- **Pink** (`#FF469A`): Standing badge, opponent indicator, opponent team name
- **Teal** (`#91D7EB`): Your indicator, better stats, team stats
- **Yellow** (`#FDD835`): Team name, stat values (neutral)
- **Dim** (`#8a8aa3`): League name, worse stats, labels

### Spacing
- Header padding: 16px 20px (compact)
- Header rows gap: 6-10px
- Matchup row padding: 6px 16px
- Position labels padding: 6px 16px 0 (top only)

---

## Next Steps

If backend returns `next_opponent` data correctly, the UI should automatically:
1. Show opponent players interleaved with yours
2. Highlight stat advantages/disadvantages
3. Display team average comparison
4. Show week number and opponent info in header

If `next_opponent` is null/missing:
1. Matchup section shows "ROSTER" title
2. Only your players appear (no opponent rows)
3. No team average comparison rows
4. Status functionality still works

---

## Deployment Commands

```bash
cd C:\Users\gcfrp\projects\brdc-firebase
firebase deploy --only hosting
```

**Live URL:** https://brdc-v2.web.app/pages/captain-dashboard.html

---

## Screenshots Needed

After testing, capture screenshots of:
1. Header with standing badge and team stats
2. Matchup section with opponent comparison
3. Mobile view responsiveness
4. Status toggle and fill-in button interaction

---

**Status:** ✅ Complete and deployed
