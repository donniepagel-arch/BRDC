# Tournament Check-in System Implementation

**Date:** 2026-01-24
**Status:** Complete

## Summary

Implemented a check-in system for tournaments that separates registration (done in advance) from check-in (done at the venue). This allows tournament directors to confirm who has physically arrived.

## Changes Made

### Backend (Cloud Functions)

**File:** `functions/matchmaker.js`

1. **Updated `matchmakerRegister` function**
   - Added `checked_in: false` and `checked_in_at: null` fields to both single and team registrations
   - Added `registered_at` timestamp for tracking when player registered

2. **Added `checkInPlayer` function**
   - Endpoint: `POST /checkInPlayer`
   - Parameters: `tournament_id`, `registration_id`, `player_number` (optional for teams), `director_pin` (optional)
   - Updates player's `checked_in` status to `true` and sets `checked_in_at` timestamp
   - Supports checking in individual team members or both at once

3. **Added `getCheckInStatus` function**
   - Endpoint: `GET/POST /getCheckInStatus`
   - Parameters: `tournament_id`
   - Returns all registrations with check-in status, counts, and percentage

4. **Added `markNoShow` function**
   - Endpoint: `POST /markNoShow`
   - Parameters: `tournament_id`, `registration_id`, `director_pin`, `reason` (optional)
   - Marks registration as no-show with timestamp and reason
   - Requires director PIN verification

5. **Added `findPlayerRegistration` function**
   - Endpoint: `GET/POST /findPlayerRegistration`
   - Parameters: `tournament_id`, `player_id` (PIN)
   - Allows players to look up their registration by PIN for self-check-in

### Frontend - Registration Page

**File:** `public/pages/matchmaker-register.html`

1. **Added PIN lookup section**
   - Players can enter their PIN to find their existing registration
   - Shows "FIND MY REGISTRATION" button

2. **Added check-in section**
   - Shows player name and team info
   - Displays registration status (REGISTERED / CHECKED IN / NO-SHOW)
   - "CHECK IN AT VENUE" button for self-check-in
   - Shows check-in timestamp when complete

3. **Added CSS styles**
   - `.checkin-card` - Main check-in container
   - `.checkin-status` - Status badge styling (registered, checked-in)
   - `.checkin-btn` - Large check-in button

4. **Added JavaScript functions**
   - `lookupRegistration()` - Finds player's registration by PIN
   - `showCheckinSection()` - Updates UI to show check-in state
   - `checkInPlayer()` - Calls check-in cloud function
   - `showRegistrationForm()` - Returns to registration form

### Frontend - Director Dashboard

**File:** `public/pages/matchmaker-director.html`

1. **Added CHECK-IN tab** (after Overview, before Registrations)

2. **Added stats row showing:**
   - Checked In count (green)
   - Registered count (yellow)
   - Check-in percentage
   - No-Show count (red)

3. **Added CHECK-IN QUEUE card**
   - Lists all registrations with check-in status
   - Shows check-in timestamp for checked-in players
   - For teams, shows individual player check-in status
   - CHECK IN buttons for director to manually check in players

4. **Added MARK AS NO-SHOW card**
   - Dropdown to select registration
   - Optional reason field
   - Confirmation dialog before marking

5. **Added CSS styles**
   - `.checkin-item` - Individual check-in list items
   - Status classes: `.checked-in`, `.not-checked-in`, `.no-show`
   - `.checkin-badge` - Status badges
   - `.checkin-btn-small` - Small check-in buttons

6. **Added JavaScript functions**
   - `refreshCheckInData()` - Loads check-in status from backend
   - `renderCheckInList()` - Renders the check-in queue
   - `populateNoShowSelect()` - Populates no-show dropdown
   - `checkInRegistration()` - Checks in a player (director action)
   - `markNoShow()` - Marks registration as no-show

## Data Structure

### Registration Document Fields (New)

```javascript
{
  // Existing fields...

  // For single registration
  player: {
    name: String,
    player_id: String,
    gender: String,
    checked_in: Boolean,      // NEW
    checked_in_at: Timestamp  // NEW
  },

  // For team registration
  player1: {
    name: String,
    player_id: String,
    gender: String,
    checked_in: Boolean,      // NEW
    checked_in_at: Timestamp  // NEW
  },
  player2: {
    name: String,
    player_id: String,
    gender: String,
    checked_in: Boolean,      // NEW
    checked_in_at: Timestamp  // NEW
  },

  // Registration-level fields
  registered_at: Timestamp,   // Existing
  no_show: Boolean,           // NEW
  no_show_at: Timestamp,      // NEW
  no_show_reason: String      // NEW
}
```

## Testing

Test the check-in system with these scenarios:

1. **Self-check-in flow:**
   - Go to matchmaker-register.html with a tournament ID
   - Enter your PIN in the check-in section
   - Click "FIND MY REGISTRATION"
   - Click "CHECK IN AT VENUE"

2. **Director check-in flow:**
   - Log into matchmaker-director.html
   - Go to CHECK-IN tab
   - Click CHECK IN button for any player
   - For teams, check in individual players or both

3. **No-show flow:**
   - In director dashboard, go to CHECK-IN tab
   - Select a registration in "Mark as No-Show" section
   - Add optional reason
   - Click "MARK AS NO-SHOW"

## Notes

- Check-in is separate from partner matching - a player can be checked in but not yet matched
- Directors can check in players without requiring the player's PIN
- Players can self-check-in if they know their player ID (PIN)
- No-show marking requires director PIN confirmation
- Check-in data auto-refreshes when main data refreshes
