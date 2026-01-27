# Match Data Import Guide

## ✅ USE THIS SCRIPT

**`import-match-from-rtf.js`** is the ONLY working importer.

## Quick Start

1. **Add your match to the MATCHES array:**
```javascript
const MATCHES = [
    {
        name: 'Team A v Team B (Week X)',
        matchId: 'FIRESTORE_MATCH_ID',  // Get from Firestore leagues/{leagueId}/matches
        rtfFile: 'trips league/week X/filename.rtf',  // Path relative to /temp
        homeTeam: 'Team A',
        awayTeam: 'Team B'
    }
];
```

2. **Add team rosters if new:**
```javascript
const TEAM_ROSTERS = {
    'Team A': ['Player 1', 'Player 2', 'Player 3'],
    'Team B': ['Player 4', 'Player 5', 'Player 6']
};
```

3. **Run it:**
```bash
cd C:\Users\gcfrp\projects\brdc-firebase\scripts
node import-match-from-rtf.js
```

## What It Does

✅ Parses RTF files from DartConnect exports
✅ Extracts `checkout_darts` from `DO (n)` markers
✅ Handles player name variations
✅ Maps players to correct teams
✅ Posts data to `importMatchData` cloud function
✅ Updates player stats via `updateImportedMatchStats`

## Output

```
=== Importing: Team A v Team B ===
Reading: C:\Users\gcfrp\projects\brdc-firebase\temp\trips league\week X\filename.rtf
Parsed 9 games
Converted to 9 sets, 21 legs
Score: Team A 4 - 5 Team B
Import result: { success: true, matchId: '...', games: 9, totalLegs: 21 }
Stats result: { success: true, playersUpdated: 5 }

=== SUMMARY ===
[OK] Team A v Team B
```

## Important Files

- **Parser**: `../temp/parse-rtf.js` - Extracts structured data from RTF
- **Importer**: `import-match-from-rtf.js` - Converts and uploads to Firestore
- **Cloud Function**: `importMatchData` - Stores match data
- **Cloud Function**: `updateImportedMatchStats` - Recalculates player stats

## Troubleshooting

**"No ID for player"** warnings:
- Add player name variations to TEAM_ROSTERS
- Example: `'Dillon Ulisses'` and `'Dillon U'` both map to same player

**"Teams swapped"**:
- Normal! The script auto-detects if RTF home/away differs from Firestore
- Data is corrected automatically

**Missing checkout_darts**:
- Check that `temp/parse-rtf.js` returns `checkout_darts` in parse501Leg()
- Check that `functions/import-matches.js` includes `checkout_darts` in baseLeg

## DO NOT USE

❌ `DEPRECATED-convert-rtf-to-match-json.js` - Output format incompatible with cloud function
❌ `functions/populate-*-match.js` - Old approach, not scalable
❌ Any scripts in `/temp/trips league/week X/` - Test files, use this one instead
