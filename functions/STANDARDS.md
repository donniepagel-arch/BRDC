# BRDC Coding Standards

## Field Naming Conventions

### Always Use Underscores (snake_case) for:
- Firestore document fields
- Function parameters
- API request/response fields

### Examples:
```javascript
// ✅ CORRECT
tournament_name
tournament_date
player_id
match_id
entry_fee
max_players

// ❌ WRONG
tournamentName
tournament-name
playerId
```

## Format Values

All tournament format values should use underscores internally:
```javascript
// ✅ CORRECT
'single_elimination'
'double_elimination'
'round_robin'
'swiss'

// Input normalization (accept both, store with underscore)
const normalizeFormat = (format) => {
    if (!format) return 'single_elimination';
    return format.toLowerCase().replace('-', '_');
};
```

## Tournament Data Structure
```javascript
{
    // Identity
    tournament_name: string,
    tournament_date: string,
    tournament_time: string,
    
    // Settings
    format: string, // normalized: single_elimination, double_elimination, round_robin, swiss
    max_players: number,
    entry_fee: number,
    game_type: string, // 501, 301, cricket
    
    // Director
    director_name: string,
    director_email: string,
    director_phone: string,
    director_pin: string,
    
    // Status
    status: string, // created, started, completed
    started: boolean,
    completed: boolean,
    bracketGenerated: boolean,
    
    // Data
    players: { [playerId]: { name, checkedIn, paid, ... } },
    bracket: { type, matches, ... },
    teams: [ { id, name, players, locked } ],
    
    // Timestamps
    created_at: Timestamp,
    bracketGeneratedAt: Timestamp,
    completedAt: Timestamp
}
```

## Player Data Structure
```javascript
{
    name: string,
    email: string,
    phone: string,
    checkedIn: boolean,
    checkInTime: Timestamp,
    paid: boolean,
    isWalkIn: boolean,
    registrationTime: Timestamp
}
```

## Match Data Structure
```javascript
{
    id: string,
    matchNumber: number,
    round: number,
    position: number,
    player1: { id, name },
    player2: { id, name },
    score: { player1: number, player2: number },
    winner: { id, name },
    status: string, // pending, in_progress, completed, waiting
    board: number,
    completedAt: Timestamp
}
```

## Function Naming
```javascript
// ✅ CORRECT
exports.checkInPlayer
exports.generateBracket
exports.submitMatchResult

// ❌ WRONG
exports.CheckInPlayer
exports.generate-bracket
```

## Error Response Format
```javascript
// ✅ CORRECT
res.status(400).json({ 
    success: false, 
    error: 'Missing tournament_id' 
});

// Success response
res.json({ 
    success: true, 
    data: {...},
    message: 'Operation successful'
});
```
