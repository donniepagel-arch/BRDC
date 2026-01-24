# League Draft System Implementation

**Date:** 2026-01-24
**Status:** COMPLETED

---

## Overview

Implemented a complete real-time League Draft System for BRDC. This allows league directors to conduct live player drafts where team captains take turns selecting players from an available pool.

---

## Files Created

### 1. `public/pages/draft-room.html`
Complete draft room page with the following features:

- **PIN-based authentication** for captains and directors
- **Real-time draft board** using Firebase Firestore listeners
- **Available player pool** with sortable columns (Name, Level, 3DA, MPR)
- **Current picker indicator** with countdown timer
- **Pick history log** showing all picks in order
- **Team rosters** showing players drafted to each team
- **Director controls**: Pause/Resume, Undo Last Pick, Force Pick

**Key UI Components:**
- Login overlay with PIN entry
- Three-column layout: Pick history | Draft board | Team rosters
- Timer display with visual warning when low (< 10 seconds)
- Player cards with level badges and stats
- Real-time status updates

### 2. `functions/draft.js`
Backend cloud functions for draft operations:

| Function | Purpose |
|----------|---------|
| `initializeDraft` | Creates draft state, generates pick order, sets first deadline |
| `makeDraftPick` | Records a pick, assigns player to team, advances draft |
| `autoPick` | Auto-selects best available player when timer expires |
| `getDraftState` | Returns current draft state for loading/refreshing |
| `pauseDraft` | Pauses draft and preserves remaining time |
| `resumeDraft` | Resumes paused draft with new deadline |
| `undoDraftPick` | Removes last pick and rolls back draft state |
| `completeDraft` | Finalizes draft and updates league status |

**Pick Order Generation:**
- Snake draft (default): 1-2-3-3-2-1 pattern for fairness
- Standard draft: 1-2-3-1-2-3 pattern
- Random order generation based on team count

---

## Files Modified

### 1. `functions/index.js`
Added export for draft functions:
```javascript
const draftFunctions = require('./draft');
Object.assign(exports, draftFunctions);
```

### 2. `public/pages/create-league.html`
Added draft configuration section visible when "Draft" league type is selected:

- **Draft Order**: Random, By Previous Record, Manual
- **Time Per Pick**: 30s, 60s, 90s, 2 minutes, Unlimited
- **Draft Style**: Snake (1-2-3-3-2-1) or Standard (1-2-3-1-2-3)
- **Auto-pick Toggle**: Enable/disable automatic picks when timer expires

Updated `setLeagueType()` function to show/hide draft options.
Added `draft_settings` object to form submission data.

### 3. `public/pages/league-director.html`
Added Draft Controls section in the sidebar (visible for draft leagues):

**HTML Components:**
- Draft status badge (PENDING, IN PROGRESS, PAUSED, COMPLETED)
- Progress display with pick count and current team
- Progress bar visualization
- "Open Draft Room" button
- "View Draft Results" button (shown when completed)
- Draft settings summary (Order, Time, Style, Auto-pick)

**JavaScript Functions:**
- `initDraftControls()` - Initialize display for draft leagues
- `updateDraftStatusDisplay(draftState)` - Update UI based on draft state
- `openDraftRoom()` - Open draft room in new tab
- `viewDraftResults()` - Display draft results summary

Added call to `initDraftControls()` in `initDashboard()` for draft leagues.

---

## Draft Data Structure

### Firestore: `leagues/{leagueId}/draft/current`

```javascript
{
  status: 'pending' | 'active' | 'paused' | 'completed',
  teams: [{ id, name, captain_id, captain_name }],
  available_players: [{ id, name, level, stats }],
  pick_order: ['team1_id', 'team2_id', ...],  // Full pick sequence
  current_pick: 1,  // Current pick number (1-indexed)
  total_picks: 24,  // Total picks to make
  current_deadline: Timestamp,  // When current pick expires
  time_per_pick: 60,  // Seconds per pick
  auto_pick_enabled: true,
  is_snake: true,  // Snake draft format
  picks: [  // Completed picks
    {
      pick_number: 1,
      team_id: 'xxx',
      team_name: 'Team A',
      player_id: 'yyy',
      player_name: 'John Doe',
      player_level: 'A',
      picked_at: Timestamp,
      was_auto_pick: false
    }
  ],
  paused_at: Timestamp | null,
  remaining_time: 45,  // Seconds remaining when paused
  created_at: Timestamp,
  updated_at: Timestamp,
  completed_at: Timestamp | null
}
```

---

## Usage Flow

### Director Flow:
1. Create league with "Draft" type selected
2. Configure draft settings (order, time, style, auto-pick)
3. Add players to league (registrations)
4. Create teams with captains assigned
5. Go to League Director dashboard
6. Click "Open Draft Room" to start draft
7. Monitor progress, use controls as needed (pause, undo)
8. Draft completes automatically when all picks made

### Captain Flow:
1. Receive link to draft room
2. Login with PIN
3. Wait for their turn (shown by timer and "YOUR PICK" indicator)
4. Browse available players (sort by level, stats)
5. Click player to select, confirm pick
6. Repeat until roster is full

### Auto-Pick Logic:
When timer expires and `auto_pick_enabled` is true:
1. Get available players
2. Sort by level (A > B > C) then by stats (3DA, MPR)
3. Select top player for the picking team
4. Record as auto-pick in history

---

## Testing

### Test League:
- League ID: `aOq4Y0ETxPZ66tM1uUtP` (Winter Triple Draft)

### Manual Test Steps:
1. Create new draft league or update existing league to draft type
2. Verify draft settings appear in create-league form
3. Verify draft controls appear in league-director dashboard
4. Open draft room and test login with captain PIN
5. Test pick selection and timer functionality
6. Test director controls (pause/resume/undo)
7. Complete draft and verify results

---

## Known Limitations

1. **No real-time notifications** - Captains must keep draft room open
2. **Single draft per league** - No support for multiple draft rounds
3. **Results in alert()** - View Draft Results uses simple alert, could be modal
4. **No trade feature** - Post-draft trades not implemented

---

## Future Enhancements

- Push notifications for pick turns
- Trade system for post-draft moves
- Draft lottery for order determination
- Keeper league support
- Draft history/replay feature
- Export draft results to PDF
