# BRDC Coding Rules

**CRITICAL RULES - READ THESE BEFORE WRITING ANY CODE**

These rules exist because we've had recurring bugs from not following them. Violating these rules has caused data mismatches, missing stats, and hours of debugging.

---

## Rule 1: ALWAYS Use Player ID for Lookups

**NEVER use player names for lookups. ALWAYS use the player's document ID.**

### Why This Rule Exists
Player names are inconsistent across different data sources:
- Players collection: "Jennifer Malek"
- Stats collection: "Jenn M"
- Games array: "Jenn M"
- DartConnect import: "J. Malek"

Name-based lookups WILL fail and cause missing stats.

### Correct Pattern
```javascript
// CORRECT: Use player ID
const statsDoc = await getDoc(doc(db, 'leagues', leagueId, 'stats', playerId));
const playerStats = statsDoc.data();

// CORRECT: Build lookup by ID
const playerStatsById = {};
statsSnap.forEach(doc => {
    playerStatsById[doc.id] = doc.data();
});
const stats = playerStatsById[player.id];
```

### WRONG Pattern (DO NOT USE)
```javascript
// WRONG: Using name-based lookup
const playersByName = {};
playersSnap.forEach(doc => {
    playersByName[doc.data().name.toLowerCase()] = doc;
});
const player = playersByName[nameFromGame.toLowerCase()]; // WILL FAIL!
```

### When You Must Use Names
If you absolutely must match by name (e.g., importing from external source):
1. Store the mapping in a dedicated collection
2. Create a function to normalize names
3. Log warnings for unmatched names
4. NEVER assume names will match

---

## Rule 2: Stats Are Stored By Player ID

Stats are stored in collections keyed by player document ID:
- `leagues/{leagueId}/stats/{playerId}` - Per-player stats
- `leagues/{leagueId}/aggregated_stats/{playerId}` - Aggregated stats

The document ID in these collections MUST match the player's document ID in `leagues/{leagueId}/players/{playerId}`.

### Correct Stats Lookup
```javascript
// Get player's stats using their ID
const player = { id: 'abc123', name: 'John Smith' };
const statsDoc = await getDoc(doc(db, 'leagues', leagueId, 'stats', player.id));
```

---

## Rule 3: Games Array Uses Names (Legacy Issue)

The `matches/{matchId}/games[]` array stores player names as strings (from DartConnect import):
```javascript
{
    home_players: ["Matt Pagel", "Joe Peters"],
    away_players: ["Donnie Pagel", "Jenn M"]
}
```

**DO NOT rely on these names to find player IDs.** Instead:
1. Get the team roster by `team_id`
2. Show roster players with their stats from `stats/{playerId}`
3. If you need to match game participants, create a separate mapping function

---

## Rule 4: Player Document Structure

The canonical player document in `leagues/{leagueId}/players/{playerId}`:
```javascript
{
    id: "auto-generated-firestore-id",  // Same as doc ID
    name: "Full Name",                   // Display name
    team_id: "team-doc-id",             // Reference to team
    position: 1,                         // 1=captain, 2=B, 3=C, etc.
    email: "email@example.com",
    phone: "555-1234",
    pin: "1234"
}
```

---

## Rule 5: When Displaying Player Stats

Always fetch stats by player ID, never by name:

```javascript
// Build roster from players collection
const roster = [];
playersSnap.forEach(doc => {
    roster.push({ id: doc.id, ...doc.data() });
});

// Fetch stats for each player BY ID
const playerStats = {};
for (const player of roster) {
    const statsDoc = await getDoc(doc(db, 'leagues', leagueId, 'stats', player.id));
    if (statsDoc.exists()) {
        playerStats[player.id] = statsDoc.data();
    }
}

// Display with stats
roster.forEach(player => {
    const stats = playerStats[player.id] || {};
    console.log(player.name, get3DA(stats), getMPR(stats));
});
```

---

## Summary

| Task | Use ID? | Use Name? |
|------|---------|-----------|
| Fetch player stats | YES | NO |
| Display player name | NO | YES |
| Match players across collections | YES | NO |
| Import from external source | Convert to ID first | Only for initial match |
| Store in database | YES | For display only |

**When in doubt: USE THE PLAYER ID.**
