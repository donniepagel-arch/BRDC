# BRDC Triples League System - Deployment Guide

## What's New

### Backend (Firebase Cloud Functions)
New file: `functions/leagues/index.js` - Complete league management system

**New Functions:**
- `createLeague` - Create a new league
- `getLeague` - Get league details
- `updateLeagueStatus` - Change league status (registration/draft/active/playoffs/completed)
- `registerPlayer` - Register a player for league
- `getPlayers` - Get all registered players
- `createTeam` - Create a team with 3 players
- `getTeams` - Get all teams
- `getStandings` - Get sorted standings
- `generateSchedule` - Generate round-robin schedule
- `getSchedule` - Get matches (all or by week)
- `startMatch` - Start a match and generate PIN
- `getMatchByPin` - Load match by PIN (for tablets)
- `startGame` - Start a game within a match
- `recordLeg` - Record leg results with stats
- `finalizeMatch` - Finalize match and update standings
- `getPlayerStats` - Get individual player stats
- `getLeaderboards` - Get all leaderboards

### Frontend (New Pages)
1. **league-director.html** - Director dashboard with PIN authentication
   - View/manage weekly matches
   - Start matches (generates PINs)
   - View standings, teams, stats
   - League settings

2. **match-hub.html** - Tablet interface for match night
   - Enter match PIN to load match
   - Shows 9-game grid with player assignments
   - Tap game to launch scorer

3. **league-501.html** - Complete 501 scorer for league play
   - Full stat tracking (3DA, 180s, 171s, ton+ outs)
   - Best of 3 legs
   - Auto-saves to Firebase on completion

4. **league-cricket.html** - Complete Cricket scorer for league play
   - MPR tracking, 9-mark rounds
   - Visual mark board
   - Auto-saves to Firebase on completion

---

## Deployment Steps

### 1. Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

This will deploy all the new league functions.

### 2. Push Frontend to GitHub

```bash
git add .
git commit -m "Add complete league management system"
git push origin main
```

Cloudflare Pages will auto-deploy from GitHub.

### 3. Verify Deployment

Test URLs after deployment:
- League Director: `https://brdc-v2.web.app/pages/league-director.html`
- Match Hub: `https://brdc-v2.web.app/pages/match-hub.html`

---

## How to Use

### Setting Up a League

1. Go to `/pages/create-league.html`
2. Fill in league details
3. Get your admin PIN
4. Go to `/pages/league-director.html`
5. Enter PIN to access dashboard

### Setting Up Teams (After Draft)

Since you've already done the draft, you'll need to create teams manually:

```javascript
// Call createTeam for each team
await callFunction('createTeam', {
    league_id: 'YOUR_LEAGUE_ID',
    admin_pin: 'YOUR_PIN',
    team_name: 'Team 1',
    player_ids: ['player_id_1', 'player_id_2', 'player_id_3']
});
```

Or use the Firebase Console to add teams directly to:
`leagues/{leagueId}/teams`

### Generate Schedule

1. Open League Director
2. Go to Settings tab
3. Click "Generate Schedule"

### Match Night Workflow

1. **Director starts matches** in League Director dashboard
2. **Captains get PINs** - share with each match
3. **Tablets at boards** - go to `/pages/match-hub.html`
4. **Enter PIN** - loads match with all 9 games
5. **Tap game to score** - opens 501 or Cricket scorer
6. **Score auto-saves** - when game completes
7. **Director finalizes** - updates standings

---

## Data Structure

```
leagues/{leagueId}
  ├── league_name, season, status, etc.
  ├── players/{playerId} - registered players
  ├── teams/{teamId} - teams with rosters
  ├── matches/{matchId} - weekly matches
  │     └── games[] - 9 games per match
  └── stats/{playerId} - player statistics
```

---

## Match Format Reference

| Game | Home | Away | Type | Format |
|------|------|------|------|--------|
| 1 | P1+P2 | P1+P2 | Doubles | 501 C/CH |
| 2 | P3 | P3 | Singles | Cricket |
| 3 | P1 | P1 | Singles | Cricket |
| 4 | P2+P3 | P2+P3 | Doubles | 501 C/CH |
| 5 | P2 | P2 | Singles | Cricket |
| 6 | P1 | P1 | Singles | 501 DO |
| 7 | P1+P3 | P1+P3 | Doubles | 501 C/CH |
| 8 | P2 | P2 | Singles | 501 DO |
| 9 | P3 | P3 | Singles | 501 DO |

---

## Troubleshooting

**Functions not working?**
- Check Firebase console for deployment status
- Check function logs for errors

**Match PIN not found?**
- Verify match status is "in_progress"
- PIN is only valid while match is active

**Stats not saving?**
- Check browser console for errors
- Verify league_id and match_id are correct

---

## Next Steps

1. Deploy and test with real data
2. Add any missing features as needed
3. Consider adding:
   - Sub player management
   - Makeup match scheduling
   - Playoff bracket generation
   - SMS/email notifications
