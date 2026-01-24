# Director Tools Implementation

**Date:** 2026-01-24
**Status:** COMPLETED

## Summary

Added three new director tools to the league-director.html page for managing match results, player levels, and match scheduling.

## Changes Made

### Backend Functions (functions/leagues/index.js)

Added three new cloud functions at the end of the file:

#### 1. `correctMatchResult`
- **Purpose:** Correct scores for completed matches
- **Endpoint:** `POST /correctMatchResult`
- **Parameters:**
  - `league_id` (required)
  - `match_id` (required)
  - `home_score` (required)
  - `away_score` (required)
  - `reason` (optional but recommended)
  - `director_pin` (required for authorization)
- **Features:**
  - Validates director access via PIN
  - Updates match scores and winner
  - Logs correction to `corrections_log` subcollection for audit trail
  - Recalculates team standings automatically
  - Returns old and new scores in response

#### 2. `setPlayerLevel`
- **Purpose:** Update a player's skill level (A, B, C, or Unassigned)
- **Endpoint:** `POST /setPlayerLevel`
- **Parameters:**
  - `league_id` (required)
  - `player_id` (required)
  - `level` (required: 'A', 'B', 'C', or empty string)
  - `director_pin` (required for authorization)
- **Features:**
  - Validates level is one of the allowed values
  - Updates player's level in leagues/{id}/players/{id}
  - Also updates position based on level (A=1, B=2, C=3)
  - Returns old and new level in response

#### 3. `rescheduleMatch`
- **Purpose:** Change the date of a match
- **Endpoint:** `POST /rescheduleMatch`
- **Parameters:**
  - `league_id` (required)
  - `match_id` (required)
  - `new_date` (required: ISO date string)
  - `is_makeup` (optional: boolean)
  - `notify_captains` (optional: boolean - placeholder for future notification)
  - `director_pin` (required for authorization)
- **Features:**
  - Validates date format
  - Preserves original_match_date on first reschedule
  - Sets is_makeup flag if requested
  - Returns match details including team names

### Helper Function

Added `recalculateTeamStandings(leagueId)` helper function that:
- Iterates through all completed matches
- Recalculates wins, losses, ties, games_won, games_lost, legs_won, legs_lost, points
- Batch updates all team documents

### Frontend (public/pages/league-director.html)

#### New Tab
- Added "Director Tools" tab with wrench icon to the tab navigation

#### CSS Additions (lines 679-831)
- Modal overlay styles (`.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer`)
- Director tool card styles (`.director-card`, `.director-card-header`, `.director-card-title`)
- Score display/input styles (`.score-display`, `.score-input-group`)
- Level badge styles (`.level-badge`, `.level-a`, `.level-b`, `.level-c`, `.level-unassigned`)
- Match row styles (`.match-row`, `.match-teams`, `.match-score`, `.match-meta`)
- Makeup badge style (`.makeup-badge`)

#### Tab Content (toolsTab)
Contains three sections:

1. **Match Corrections Section**
   - Filter by week and status (completed/all)
   - Lists matches with current scores
   - Edit button opens correction modal
   - Shows CORRECTED badge for previously corrected matches

2. **Player Level Management Section**
   - Search players by name
   - Filter by level (All/A/B/C/Unassigned)
   - Each player row shows current level badge and dropdown to change
   - Changes are saved immediately on dropdown change

3. **Match Rescheduling Section**
   - Filter by week and status (scheduled/all)
   - Lists matches with dates
   - Shows MAKEUP and RESCHEDULED badges
   - Reschedule button opens modal with date picker

#### Modals
1. **Correction Modal** (`#correctionModal`)
   - Shows current teams and score
   - Input fields for new home/away scores
   - Textarea for correction reason (required)
   - Cancel and Save Correction buttons

2. **Reschedule Modal** (`#rescheduleModal`)
   - Shows match teams and week
   - Displays current date
   - Date/time picker for new date
   - Checkboxes for makeup match and notify captains
   - Cancel and Reschedule buttons

#### JavaScript Functions (lines 4040-4334)
- `loadDirectorTools()` - Initializes the tab
- `loadToolsStats()` - Updates correction/reschedule counts
- `populateCorrectionWeekFilter()` / `populateRescheduleWeekFilter()` - Populate dropdowns
- `filterCorrectionMatches()` / `filterLevelPlayers()` / `filterRescheduleMatches()` - Filter handlers
- `renderCorrectionMatches()` - Renders match list for corrections
- `renderLevelPlayers()` - Renders player list with level controls
- `renderRescheduleMatches()` - Renders match list for rescheduling
- `formatMatchDate()` - Helper for date formatting
- `updatePlayerLevel()` - Calls setPlayerLevel API
- `openCorrectionModal()` / `closeCorrectionModal()` / `submitCorrection()` - Correction modal handlers
- `openRescheduleModal()` / `closeRescheduleModal()` / `submitReschedule()` - Reschedule modal handlers

## Data Structure Changes

### New Subcollection
```
leagues/{leagueId}/corrections_log/{correctionId}
  - match_id: string
  - corrected_at: timestamp
  - corrected_by_pin: string (masked: "1234****")
  - old_home_score: number
  - old_away_score: number
  - new_home_score: number
  - new_away_score: number
  - reason: string
```

### Match Document Updates
```
matches/{matchId}
  - corrected_at: timestamp (new)
  - correction_reason: string (new)
  - rescheduled_at: timestamp (new)
  - original_match_date: timestamp (new, preserved on first reschedule)
  - is_makeup: boolean (new)
```

### Player Document Updates
```
players/{playerId}
  - level_updated_at: timestamp (new)
```

## Testing

Test with the reference league:
- League ID: `aOq4Y0ETxPZ66tM1uUtP`
- Match ID (Pagel v Pagel): `sgmoL4GyVUYP67aOS7wm`

URL: `/pages/league-director.html?league_id=aOq4Y0ETxPZ66tM1uUtP`

## Files Modified
- `functions/leagues/index.js` - Added 3 new functions and helper
- `public/pages/league-director.html` - Added tab, modals, CSS, and JavaScript

## Deployment
Ready for deployment with:
```bash
firebase deploy --only functions,hosting
```
