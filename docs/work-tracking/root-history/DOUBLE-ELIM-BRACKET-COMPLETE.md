# Double Elimination Bracket Generator - Complete ✓

## Status: READY FOR USE

The `generateDoubleEliminationBracket` function is now complete and ready for deployment.

## What Was Fixed

### Bug Fixed (Line 222)
**Issue**: Losers from Winners Bracket Round 1 were mapped to incorrect Losers Bracket positions.

**Original Code**:
```javascript
loser_goes_to_lc_position: i  // 0, 1, 2, 3 for 8 teams
```

**Problem**: With 8 teams, WC R1 has 4 matches but LC R1 only has 2 matches. Positions 2 and 3 don't exist in LC R1.

**Fixed Code**:
```javascript
loser_goes_to_lc_position: Math.floor(i / 2)  // 0, 0, 1, 1 for 8 teams
```

**Result**: Two adjacent WC R1 matches now correctly feed into each LC R1 match.

### Export Added (index.js)
Added `generateDoubleEliminationBracket` to the exports so it can be called via Cloud Functions.

## Function Signature

```javascript
POST https://us-central1-brdc-v2.cloudfunctions.net/generateDoubleEliminationBracket

Body:
{
    "tournament_id": "abc123",
    "director_pin": "12345678"  // optional
}

Response:
{
    "success": true,
    "message": "Double elimination bracket generated",
    "team_count": 8,
    "bracket_size": 8,
    "bye_count": 0,
    "winners_matches": 7,
    "losers_matches": 6,
    "byes_advanced": 0,
    "wc_rounds": 3,
    "lc_rounds": 4
}
```

## What It Does

1. **Gets Teams**: Fetches teams from `tournaments/{id}/registrations` where type is 'team' or 'matched_team'
2. **Validates**: Checks for minimum 2 teams, verifies director PIN if provided
3. **Calculates Structure**: Determines bracket size (next power of 2), rounds, and byes
4. **Generates Winners Bracket**: Creates all WC matches with proper seeding and feeder references
5. **Generates Losers Bracket**: Creates LC structure with dropout/consolidation rounds
6. **Creates Grand Finals**: Sets up GF placeholder with bracket reset support
7. **Auto-Advances Byes**: Marks bye matches as complete and advances teams
8. **Saves to Firestore**: Stores complete bracket in `tournaments/{id}/bracket`

## Bracket Structure Saved

```javascript
{
    type: 'double_elimination',
    format: 'heartbreaker',
    team_count: 8,
    bracket_size: 8,
    bye_count: 0,

    // Winners Bracket
    winners: [...],  // Array of match objects
    winners_rounds: 3,

    // Losers Bracket
    losers: [...],   // Array of match objects
    losers_rounds: 4,

    // Grand Finals
    grand_finals: {
        match1: { ... },
        match2: null,
        bracket_reset_needed: false
    },

    // Champions
    wc_champion_id: null,
    lc_champion_id: null,
    tournament_champion_id: null,

    // Heartbreaker Mingle
    mingle_active: false,
    mingle_round: 0,

    // Progress
    current_wc_round: 1,
    current_lc_round: 0,
    wc_complete: false,
    lc_complete: false
}
```

## Match Object Structure

### Winners Bracket Match
```javascript
{
    id: 'wc-1',
    matchNumber: 1,
    round: 1,
    position: 0,
    bracket: 'winners',
    team1_id: 'team123',
    team2_id: 'team456',
    team1: { id, team_name, player1, player2 },
    team2: { id, team_name, player1, player2 },
    winner_id: null,
    loser_id: null,
    scores: null,
    status: 'pending',  // or 'bye', 'in_progress', 'completed', 'waiting'
    board: null,
    feeder1: 'wc-1',  // R2+ only
    feeder2: 'wc-2',  // R2+ only
    loser_goes_to_lc_round: 1,
    loser_goes_to_lc_position: 0
}
```

### Losers Bracket Match
```javascript
{
    id: 'lc-1',
    matchNumber: 1,
    round: 1,
    position: 0,
    bracket: 'losers',
    round_type: 'consolidation',  // or 'dropout'
    team1_id: null,
    team2_id: null,
    team1: null,
    team2: null,
    winner_id: null,
    loser_id: null,  // This team is ELIMINATED
    scores: null,
    status: 'waiting',
    board: null
}
```

## Example Bracket Sizes

| Teams | Bracket Size | Byes | WC Rounds | LC Rounds | Total Matches |
|-------|--------------|------|-----------|-----------|---------------|
| 2     | 2            | 0    | 1         | 0         | 1 + GF        |
| 3     | 4            | 1    | 2         | 2         | 3 + 2 + GF    |
| 4     | 4            | 0    | 2         | 2         | 3 + 2 + GF    |
| 6     | 8            | 2    | 3         | 4         | 7 + 6 + GF    |
| 8     | 8            | 0    | 3         | 4         | 7 + 6 + GF    |
| 16    | 16           | 0    | 4         | 6         | 15 + 14 + GF  |

## Testing

### Verification Test
Run `functions/tournaments/test-bracket-logic.js` to verify calculations:
```bash
cd functions/tournaments
node test-bracket-logic.js
```

### Manual Test
```bash
curl -X POST https://us-central1-brdc-v2.cloudfunctions.net/generateDoubleEliminationBracket \
  -H "Content-Type: application/json" \
  -d '{
    "tournament_id": "YOUR_TOURNAMENT_ID",
    "director_pin": "YOUR_PIN"
  }'
```

## Next Steps

1. **Deploy**: Run `firebase deploy --only functions` to deploy the updated function
2. **Test**: Create a test tournament and generate a bracket
3. **Integrate**: Connect the frontend UI to call this function
4. **Match Flow**: Implement match completion handlers that advance winners and place losers

## Documentation

- `functions/tournaments/BRACKET-STRUCTURE.md` - Detailed bracket structure documentation
- `functions/tournaments/test-bracket-logic.js` - Test suite for bracket calculations

## Notes

- Seeding is randomized (shuffle) for Heartbreaker format
- Byes are automatically advanced in Round 1
- Losers Bracket is created as empty structure (populated as matches complete)
- Grand Finals supports bracket reset if LC Champion wins match1
- Compatible with Heartbreaker mingle periods (tracked in bracket object)
