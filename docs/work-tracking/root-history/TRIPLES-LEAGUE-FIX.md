# Triples League Dashboard Fix

## Problem
Players in triples draft leagues were not seeing their leagues on their dashboard because their global player records were missing the `involvements.leagues` array entries.

## Root Cause
When players were drafted into teams during the draft process:
- Their league-specific player record was updated with `team_id`
- Their global player record's `involvements.leagues` array was **NOT** updated
- The dashboard queries `involvements.leagues` to display leagues, so these players saw nothing

## Solution
Updated the draft system in `functions/draft.js`:

### 1. Draft Pick Fix (Line ~290)
When a player is drafted via `makeDraftPick`, the function now:
- Updates the league player record (existing behavior)
- **NEW:** Updates the global player's `involvements.leagues` array with league and team info
- Falls back gracefully if global player can't be found

### 2. Draft Completion Sync (Line ~750)
When a draft is completed via `completeDraft`, the function now:
- **NEW:** Calls `syncPlayerInvolvements()` to sync ALL players in the league
- Ensures no players are missed
- Updates draft status and league status

### 3. Manual Sync Function
Added new cloud function `syncLeaguePlayerInvolvements` that can be called to fix existing leagues.

## How to Fix Existing Leagues

### Option 1: Via Cloud Function (Recommended)
Call the `syncLeaguePlayerInvolvements` function:

```javascript
// Example using fetch/curl
const response = await fetch('https://YOUR-PROJECT.cloudfunctions.net/syncLeaguePlayerInvolvements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        league_id: 'YOUR_LEAGUE_ID',
        pin: 'DIRECTOR_8_DIGIT_PIN'
    })
});

const result = await response.json();
console.log(result); // { success: true, message: 'Player involvements synced successfully' }
```

### Option 2: Redeploy and Re-complete Draft
1. Deploy the updated functions
2. Have the league director go to the draft page
3. Click "Complete Draft" again (even if already completed)
4. This will trigger the sync automatically

## What Gets Updated
For each player in the league who has a `team_id`:

**Before:**
```javascript
{
    involvements: {
        leagues: [],  // EMPTY!
        tournaments: [],
        directing: [],
        captaining: []
    }
}
```

**After:**
```javascript
{
    involvements: {
        leagues: [
            {
                id: "league_abc123",
                name: "Wednesday Night Triples",
                team_id: "team_xyz789",
                team_name: "Bullseye Bandits",
                role: "player"
            }
        ],
        tournaments: [],
        directing: [],
        captaining: []
    }
}
```

## Deployment

```bash
# Deploy only the updated draft functions
firebase deploy --only functions:makeDraftPick,functions:completeDraft,functions:syncLeaguePlayerInvolvements

# Or deploy all functions
firebase deploy --only functions
```

## Testing
After deployment and sync:
1. Have a player from a triples league login with their PIN
2. They should now see their league on the dashboard
3. Schedule stories should show upcoming matches
4. Feed should show league activity

## Prevention
This fix ensures:
- Future draft picks automatically update involvements
- Draft completion syncs all players
- No more missing leagues on dashboards
