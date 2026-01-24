# Tournament Board Assignment System

## Status: COMPLETE (Not Deployed)

**Date:** 2026-01-24

## Summary

Added a board assignment system for multi-board tournament venues. Directors can now assign matches to specific dart boards, track board availability, and quickly assign pending matches to available boards.

## Changes Made

### 1. matchmaker-director.html

**New Tab: BOARDS**
- Board status overview showing all boards at venue (available/in-use/pending)
- Active matches list with board assignment dropdown
- Pending matches list with board assignment dropdown
- Quick assign buttons to assign next pending match to any available board
- Real-time updates via Firestore onSnapshot listener

**Settings Tab Updates:**
- Added "Number of Dart Boards" input field in Venue Setup section
- Saves as `venue_board_count` on tournament document

**New CSS Classes:**
- `.board-overview` - Grid layout for board status cards
- `.board-status-card` - Individual board status display
- `.board-status-card.available` / `.in-use` / `.pending` - Status variants
- `.board-number` - Large board number display
- `.match-list-item` - Match row in board management
- `.board-select` - Dropdown for board assignment
- `.board-badge` - Small badge showing assigned/unassigned status
- `.quick-assign-btn` - Button for quick board assignment

**New JavaScript Functions:**
- `loadMatches()` - Loads matches from Firestore
- `refreshBoardData()` - Refreshes all board-related UI
- `getBoardAssignments()` - Gets current board-to-match mapping
- `renderBoardOverview()` - Renders board status grid
- `renderActiveMatches()` - Renders in-progress matches list
- `renderPendingMatches()` - Renders ready/pending matches list
- `generateBoardOptions()` - Generates dropdown options
- `renderQuickAssignButtons()` - Renders quick assign buttons
- `assignBoard(matchId, boardNumber)` - Assigns board to match
- `quickAssign(boardNumber)` - Quick assigns next pending match
- `setupMatchesListener()` - Sets up real-time match updates

### 2. matchmaker-tv.html

**Bracket View Updates:**
- Added board badge on match cards (BOARD X)
- In-progress matches have yellow border with pulse animation
- Live score display for active matches

**Match Call View Updates:**
- Shows both ready AND in-progress matches
- Sorts by status (in_progress first) then by board number
- Live matches show "LIVE - BOARD X" with red pulsing badge
- Shows current score for in-progress matches

**New CSS:**
- `.bracket-match.in-progress` - Pulsing border for live matches
- `.bracket-board-badge` - Board badge positioned at top of match card
- `.bracket-score.live` - Pulsing score display
- `.call-match.in-progress` - Styling for live match call cards
- `.call-board.live` - Red pulsing board label

### 3. matchmaker-bracket.html

**Match Card Updates:**
- Board badges in match header (assigned/unassigned/live)
- Color-coded card borders (yellow=in-progress, green=has-board)
- Real scores from match data when available

**New CSS:**
- `.match-card.in-progress` - Yellow border for live matches
- `.match-card.has-board` - Green border for assigned matches
- `.board-badge.assigned` - Green badge
- `.board-badge.unassigned` - Gray badge
- `.board-badge.live` - Red pulsing badge

**New JavaScript Functions:**
- `loadMatches()` - Loads matches from Firestore
- `getMatchByTeams(team1Id, team2Id)` - Finds match by team IDs
- `getBoardBadgeHtml(match)` - Generates board badge HTML
- `getMatchCardClass(match)` - Returns CSS class based on match state

### 4. functions/matchmaker.js

**New Cloud Functions:**

#### `assignMatchBoard`
- Assigns a dart board to a match
- Validates board number against venue configuration
- Checks for conflicts with other active matches
- Updates match document with `board_number` and `board_assigned_at`

**Request:**
```javascript
{
  tournament_id: string,
  match_id: string,
  board_number: number | null,
  director_pin?: string
}
```

**Response:**
```javascript
{
  success: true,
  message: "Match assigned to Board X",
  match_id: string,
  board_number: number
}
```

#### `getBoardStatus`
- Returns current board assignments and availability
- Lists all boards with their status (available/in_use/assigned)
- Counts active, pending, and available boards

**Request:**
```javascript
{
  tournament_id: string
}
```

**Response:**
```javascript
{
  success: true,
  venue_board_count: number,
  boards: [{
    board_number: number,
    status: "available" | "in_use" | "assigned",
    match: { id, team1_name, team2_name, status, team1_score, team2_score } | null
  }],
  active_matches: number,
  pending_matches: number,
  available_boards: number
}
```

## Data Model Changes

### Tournament Document
```javascript
{
  venue_board_count: number  // New field - number of boards at venue
}
```

### Match Document
```javascript
{
  board_number: number | null,      // New field - assigned board (1-N)
  board_assigned_at: Timestamp      // New field - when board was assigned
}
```

## Testing Notes

1. Set up venue board count in Settings tab
2. Go to Boards tab to see board overview
3. Assign boards to pending matches via dropdown or quick assign
4. Check TV display to verify board numbers appear
5. Check bracket view for board badges

## Files Modified

- `/public/pages/matchmaker-director.html`
- `/public/pages/matchmaker-tv.html`
- `/public/pages/matchmaker-bracket.html`
- `/functions/matchmaker.js`

## Deployment Required

```bash
firebase deploy --only hosting,functions
```

## Future Enhancements

- Auto-assign boards when matches become ready
- Board utilization analytics
- Alert when all boards are occupied
- Estimated wait time for pending matches
