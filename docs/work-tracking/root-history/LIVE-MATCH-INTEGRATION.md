# Live Match Integration - X01 and Cricket Scorers

## Summary

Successfully wired the X01 and Cricket scorers to the existing live match cloud functions (`startLiveMatch`, `updateLiveMatch`, `endLiveMatch`). All integrations are non-blocking and failure-tolerant to avoid disrupting the scoring experience.

## Changes Made

### 1. Created Live Match Helper (`/public/js/live-match-helper.js`)

A reusable utility module that handles all live match API calls:

- **`LiveMatch.start(matchData)`** - Starts live match tracking
- **`LiveMatch.update(stateData)`** - Updates match state (throttled to max 1/sec)
- **`LiveMatch.end(finalData)`** - Ends live match tracking

**Key Features:**
- Fire-and-forget updates (non-blocking)
- Automatic throttling (1 update per second max)
- Silent error handling (logs but doesn't throw)
- Can be disabled for casual/pickup games

### 2. X01 Scorer (`/public/pages/x01-scorer.html`)

**Added script import:**
```html
<script src="/js/live-match-helper.js"></script>
```

**Replaced raw cloud function calls:**

**Line ~2384** - On match start:
- Old: Direct `callFunction('startLiveMatch', ...)`
- New: `LiveMatch.start({ match_id, event_id, ... })`

**Line ~3654** - After each throw/team switch:
- Added: `LiveMatch.update({ team1_games_won, team2_games_won, current_leg: { ... } })`
- Updates: leg number, remaining scores, darts thrown, whose turn

**Line ~4035** - After leg completion:
- Added: `LiveMatch.update(...)` when leg winner modal shows
- Includes final leg state before next leg starts

**Line ~5210** - On match end:
- Old: Direct `callFunction('endLiveMatch', ...)`
- New: `LiveMatch.end({ winner, loser, stats })`
- Includes match stats (high checkout, etc.)

### 3. Cricket Scorer (`/public/pages/league-cricket.html`)

**Added script import:**
```html
<script src="/js/live-match-helper.js"></script>
```

**Replaced raw cloud function calls:**

**Line ~1797** - On match start:
- Old: Direct `callFunction('startLiveMatch', ...)`
- New: `LiveMatch.start({ match_id, event_id, game_type: 'cricket', ... })`

**Line ~2279** - After each player turn:
- Added: `LiveMatch.update({ team1_games_won, team2_games_won, current_leg: { ... } })`
- Updates: leg number, scores, darts (rounds * 3), whose turn, marks by number

**Line ~2766** - After leg completion:
- Added: `LiveMatch.update(...)` when leg winner modal shows
- Includes marks state for cricket-specific tracking

**Line ~3565** - On match end:
- Old: Direct `callFunction('endLiveMatch', ...)`
- New: `LiveMatch.end({ winner, loser, stats })`
- Includes match stats (top MPR, most marks, etc.)

## Data Flow

### On Match Start
```
Scorer loads → LiveMatch.start() →
  Cloud Function creates live_matches/{match_id} doc →
  Ticker can now display this match
```

### During Play
```
Player throws → Score changes → switchTeam() →
  LiveMatch.update() (throttled) →
  Cloud Function updates live_matches/{match_id} →
  Ticker updates in real-time
```

### On Match End
```
Final leg completes → LiveMatch.end() →
  Cloud Function:
    - Posts result to chat rooms
    - Notifies all players
    - Deletes live_matches doc after 30s
```

## State Data Structure

### X01 Updates
```javascript
{
  team1_games_won: 2,
  team2_games_won: 1,
  current_leg: {
    leg_number: 4,
    team1_score: 287,  // remaining
    team2_score: 301,  // remaining
    team1_darts: 15,
    team2_darts: 12,
    throwing: 'team1'
  }
}
```

### Cricket Updates
```javascript
{
  team1_games_won: 1,
  team2_games_won: 1,
  current_leg: {
    leg_number: 3,
    team1_score: 45,   // points scored
    team2_score: 60,
    team1_darts: 24,   // rounds * 3
    team2_darts: 27,
    throwing: 'team2',
    marks: {
      home: { 20: 3, 19: 2, 18: 3, 17: 1, ... },
      away: { 20: 3, 19: 3, 18: 2, 17: 3, ... }
    }
  }
}
```

## Error Handling

All live match operations use try/catch and silent failure:

```javascript
// Example from helper
async update(stateData) {
    if (!this.enabled || !this.liveMatchId) {
        return;  // Silently skip if not tracking
    }

    try {
        fetch(...).catch(err => {
            console.warn('[LiveMatch] Update failed (non-fatal):', err.message);
        });
    } catch (error) {
        console.warn('[LiveMatch] Error updating (non-fatal):', error.message);
    }
}
```

**Scoring flow is never interrupted** - if live match fails, the game continues normally.

## Testing Checklist

### X01 Scorer
- [ ] Match start creates live_matches doc
- [ ] Ticker shows match after first throw
- [ ] Scores update in real-time on ticker
- [ ] Leg completion updates ticker
- [ ] Match end removes from ticker
- [ ] Match end posts to chat rooms
- [ ] Casual/pickup games don't call live match APIs

### Cricket Scorer
- [ ] Match start creates live_matches doc
- [ ] Ticker shows marks/scores updating
- [ ] Player turns switch correctly in ticker
- [ ] Leg completion updates ticker
- [ ] Match end removes from ticker
- [ ] Match end posts to chat rooms

### Error Scenarios
- [ ] Network failure during update doesn't break scorer
- [ ] Missing scorer PIN skips live tracking gracefully
- [ ] Rapid score changes are throttled (1/sec max)
- [ ] Browser reload mid-match doesn't crash

## Future Enhancements

1. **Better Stats in End Call:**
   - Calculate topPPD/topMPR from player stats
   - Include high checkout ranges (161+, 140-160, etc.)
   - Add cricket closeout marks (9M, 8M, etc.)

2. **Player-Level Stats:**
   - Track individual player performance in `player_stats` object
   - Send per-player averages, ton counts, marks

3. **Spectator Count:**
   - Display viewer count on scorer (optional)
   - Show who's watching (friends, teammates)

4. **Match Chat Integration:**
   - Show chat messages in scorer sidebar (optional)
   - Quick chat buttons ("Good shot!", "Nice checkout!")

5. **Leg History:**
   - Send throw-by-throw data for leg replays
   - Enable live "shot tracker" in ticker overlay

## Cloud Function URLs

```
https://us-central1-brdc-v2.cloudfunctions.net/startLiveMatch
https://us-central1-brdc-v2.cloudfunctions.net/updateLiveMatch
https://us-central1-brdc-v2.cloudfunctions.net/endLiveMatch
https://us-central1-brdc-v2.cloudfunctions.net/getLiveMatches
https://us-central1-brdc-v2.cloudfunctions.net/getLiveMatchDetails
```

## Files Modified

1. `/public/js/live-match-helper.js` (NEW)
2. `/public/pages/x01-scorer.html`
3. `/public/pages/league-cricket.html`

## Deployment

```bash
firebase deploy --only hosting
```

Live match cloud functions are already deployed (from Phase 2).
