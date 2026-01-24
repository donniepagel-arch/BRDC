# Double Elimination Bracket Structure

## Overview
The `generateDoubleEliminationBracket` function creates a complete double-elimination tournament bracket with:
- Winners Bracket (WC)
- Losers Bracket (LC)
- Grand Finals

## Bracket Calculations

### For N teams:
- **Bracket Size**: Next power of 2 ≥ N
- **Byes**: Bracket Size - N
- **WC Rounds**: log₂(Bracket Size)
- **LC Rounds**: 2 × (WC Rounds - 1)

### Examples:
| Teams | Bracket Size | Byes | WC Rounds | LC Rounds |
|-------|--------------|------|-----------|-----------|
| 3     | 4            | 1    | 2         | 2         |
| 8     | 8            | 0    | 3         | 4         |
| 6     | 8            | 2    | 3         | 4         |
| 16    | 16           | 0    | 4         | 6         |

## Winners Bracket Structure

### Round 1
- Teams placed directly into matches
- Byes auto-advance to Round 2
- Each match loser goes to Losers Bracket
- **Mapping**: Two adjacent WC R1 matches feed one LC R1 match
  - WC matches 0,1 → LC R1 position 0
  - WC matches 2,3 → LC R1 position 1
  - etc.

### Subsequent Rounds
- Empty initially (waiting for winners)
- Each match has `feeder1` and `feeder2` pointing to previous round matches
- Losers go to corresponding LC dropout rounds
  - WC R2 losers → LC R2
  - WC R3 losers → LC R4
  - WC R4 losers → LC R6
  - Pattern: LC round = 2 × (WC round - 1)

## Losers Bracket Structure

### Round Types
Alternates between:
1. **Consolidation Rounds** (odd rounds): LC players vs LC players
2. **Dropout Rounds** (even rounds): WC losers join and face LC winners

### Match Count Pattern
- **R1**: bracketSize / 4 matches (consolidation)
- **R2**: Same as R1 (dropout - WC R2 losers enter)
- **R3**: R2 / 2 (consolidation)
- **R4**: Same as R3 (dropout - WC R3 losers enter)
- Continues halving on consolidation rounds until 1 match remains

### Example: 8 Teams
```
LC R1: 2 matches (WC R1's 4 losers → 2 winners)
LC R2: 2 matches (2 LC R1 winners + 2 WC R2 losers → 2 winners)
LC R3: 1 match   (2 LC R2 winners → 1 winner)
LC R4: 1 match   (1 LC R3 winner + 1 WC R3 loser → LC Champion)
```

## Grand Finals

### Structure
```javascript
grand_finals: {
    match1: {
        team1_id: null,  // WC Champion
        team2_id: null,  // LC Champion
        ...
    },
    match2: null,  // Created only if LC Champion wins match1
    bracket_reset_needed: false
}
```

### Bracket Reset
- If LC Champion wins match1, they force a bracket reset
- match2 is created for the deciding game
- WC Champion needs 1 win, LC Champion needs 2 wins (already has 1 loss)

## Match Data Structure

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

    status: 'pending',  // 'pending', 'bye', 'in_progress', 'completed', 'waiting'
    board: null,

    // Feeders (R2+ only)
    feeder1: 'wc-1',
    feeder2: 'wc-2',

    // Where loser goes
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

    team1_id: null,  // Populated when WC losers drop down
    team2_id: null,
    team1: null,
    team2: null,

    winner_id: null,
    loser_id: null,  // This team is ELIMINATED (2nd loss)
    scores: null,

    status: 'waiting',
    board: null
}
```

## Byes Handling

### Auto-Advancement
- Round 1 matches with null opponent are marked as 'bye'
- `autoAdvanceByes()` function marks them as completed with winner
- Winner automatically advances to Round 2
- No loser is sent to Losers Bracket (no match occurred)

### Edge Case: Odd Teams
For 3 teams in a 4-team bracket:
- Match 0: Team A vs Team B → loser to LC R1
- Match 1: Team C vs BYE → Team C advances, no loser
- LC R1 Match 0 receives only 1 loser initially
- Match waits for second team (from WC R2 or another LC R1 loser)

## Implementation Notes

### Fixed Bug (2026-01-22)
**Issue**: Line 222 had `loser_goes_to_lc_position: i` which didn't account for LC having half the matches of WC R1.

**Fix**: Changed to `Math.floor(i / 2)` to correctly map two WC R1 matches to each LC R1 match.

### Seeding Strategy
- Random shuffle of teams for "Heartbreaker" format
- Could be modified for skill-based seeding in other formats

### Match Advancement
- Bracket generation only creates structure
- Separate functions handle match completion and team advancement
- Uses `feeder1`/`feeder2` and `loser_goes_to_*` metadata for routing

## Testing
Run `node test-bracket-logic.js` to verify bracket calculations for various team counts.
