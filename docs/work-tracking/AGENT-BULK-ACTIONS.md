# Bulk Player Actions for Directors

## Date: 2026-01-24

## Status: COMPLETE

## Summary
Implemented bulk player action capabilities for league directors to efficiently manage multiple players at once.

---

## Features Implemented

### 1. Backend Functions (functions/leagues/index.js)

#### bulkSetPlayerLevels
- **Purpose**: Update multiple players' skill levels (A/B/C) in a single operation
- **Parameters**:
  - `league_id` (string): League ID
  - `player_updates` (array): Array of `{player_id, level}` objects
  - `director_pin` (string): Director PIN for authentication
- **Features**:
  - Validates all levels before making changes
  - Uses Firestore batch writes for efficiency
  - Also updates player position (1/2/3) based on level
  - Returns detailed results including any errors

#### bulkMovePlayersToTeam
- **Purpose**: Move multiple players to a team or unassign them
- **Parameters**:
  - `league_id` (string): League ID
  - `player_ids` (array): Array of player IDs to move
  - `target_team_id` (string|null): Team ID to move to, or null to unassign
  - `director_pin` (string): Director PIN for authentication
- **Features**:
  - Validates target team exists
  - Handles team unassignment (pass null for target_team_id)
  - Uses Firestore batch writes for efficiency
  - Returns detailed results including any errors

#### bulkNotifyPlayers
- **Purpose**: Send notifications to multiple players via SMS, Email, or Push
- **Parameters**:
  - `league_id` (string): League ID
  - `player_ids` (array): Array of player IDs to notify
  - `message` (string): Message content
  - `channels` (array): Array of channels: ['sms', 'email', 'push']
  - `director_pin` (string): Director PIN for authentication
- **Features**:
  - Supports multiple channels simultaneously
  - Queues notifications to `notification_queue` collection for async processing
  - Handles missing contact info gracefully (skips with status)
  - Returns detailed per-player and per-channel results

### 2. Frontend UI (public/pages/league-director.html)

#### Selection Mode
- Checkbox on each player card for bulk selection
- "Select All Visible" button (selects all currently filtered players)
- "Deselect All" button
- Selection count badge in the selection bar

#### Bulk Action Bar
- Fixed bar that slides up from bottom when players are selected
- Shows count of selected players
- Buttons for each bulk action:
  - **Set Level** - Opens level picker modal
  - **Move to Team** - Opens team selector modal
  - **Send Message** - Opens message composer modal
  - **Clear Selection** - Deselects all players

#### Modals
- **Set Level Modal**: Shows affected players, level dropdown (A/B/C/Unassigned)
- **Move to Team Modal**: Shows affected players, team dropdown with "Unassign" option
- **Send Message Modal**: Shows affected players, message textarea, channel checkboxes (SMS/Email/Push)

#### Visual Feedback
- Selected players highlighted with pink border and background
- Player cards show level badges (color-coded: A=red, B=yellow, C=green)
- Real-time count updates in selection bar and action bar

---

## Files Modified

### Backend
- `/functions/leagues/index.js` - Added 3 new exported functions (~300 lines)

### Frontend
- `/public/pages/league-director.html`:
  - Added CSS for bulk action UI (~150 lines)
  - Added bulk selection bar HTML
  - Added bulk action bar HTML
  - Added 3 modal dialogs HTML
  - Added JavaScript functions for all bulk operations (~250 lines)
  - Modified `renderPlayers()` to include bulk checkboxes

---

## Testing Notes

### To Test Set Level:
1. Log in as league director
2. Go to Players tab
3. Click checkboxes on multiple players
4. Click "Set Level" in the action bar
5. Select a level and click "Apply Level"
6. Verify players now show the new level badge

### To Test Move to Team:
1. Select multiple unassigned players
2. Click "Move to Team"
3. Select a target team
4. Click "Move Players"
5. Verify players now show team assignment

### To Test Send Message:
1. Select multiple players
2. Click "Send Message"
3. Enter a message
4. Select notification channels
5. Click "Send Message"
6. Check `notification_queue` collection in Firestore for queued notifications

---

## Known Limitations

1. **Notification Delivery**: Notifications are queued but actual delivery requires:
   - Twilio integration for SMS
   - SendGrid/email service for Email
   - FCM setup for Push notifications
   Currently queued to `notification_queue` for async processing.

2. **Team Roster Limits**: Moving players to a team doesn't check roster limits. Directors should verify team capacity before bulk moves.

3. **Position Assignment**: When moving to team, position is not set automatically. Use Set Level to assign positions after moving.

---

## Deployment

Functions will be automatically exported through the existing `Object.assign(exports, leagueFunctions)` pattern in `functions/index.js`.

Deploy with:
```bash
firebase deploy --only functions
firebase deploy --only hosting
```
