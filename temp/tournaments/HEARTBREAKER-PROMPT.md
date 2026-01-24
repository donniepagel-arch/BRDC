Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

---

# Task: Implement Matchmaker/Heartbreaker Tournament System

## Context

Read the full spec first:
- `temp/tournaments/HEARTBREAKER-SPEC.md` - Complete tournament specification

The matchmaker infrastructure is 90% complete. The main pieces needed are:
1. Double-elimination bracket generation
2. Heartbreaker integration (breakup prompts, savage summaries)
3. Nudge system
4. TV Display page
5. Real-time updates

## Existing Code (DO NOT REBUILD)

- `functions/matchmaker.js` - Registration, partner draw, breakup pool, re-matching
- `public/pages/matchmaker-register.html` - Team/solo registration
- `public/pages/matchmaker-director.html` - Director dashboard
- `public/pages/matchmaker-bracket.html` - Bracket display shell
- `functions/tournaments/` - Tournament framework (single-elim only currently)

---

## Phase 1: Double-Elimination Bracket Engine

### File: `functions/tournaments/brackets.js`

Add `generateDoubleEliminationBracket(tournamentId)`:

1. **Create Winners Bracket**
   - Get all teams from tournament registration
   - Shuffle for random seeding
   - Calculate byes for power-of-2
   - Create match slots for all rounds through WC Finals

2. **Create Losers Bracket Structure**
   - Empty slots to receive WC losers
   - LC has more rounds than WC (losers from different WC rounds merge)
   - LC Final determines LC champion

3. **Create Grand Finals**
   - Match slot for WC Champion vs LC Champion
   - If LC wins, create bracket reset match

### Data Structure

```javascript
bracket: {
  type: 'double_elimination',
  winners: [
    { round: 1, matches: [{id, team1_id, team2_id, winner_id, scores, board}] },
    { round: 2, matches: [...] },
    // ... through finals
  ],
  losers: [
    { round: 1, matches: [...] },
    // ... through LC finals
  ],
  grand_finals: {
    match1: { team1_id: null, team2_id: null, winner_id: null },
    match2: null  // Created if LC wins match1
  },
  champion_id: null,
  mingle_active: false,
  mingle_ends_at: null
}
```

---

## Phase 2: Match Advancement Logic

### File: `functions/tournaments/matches.js`

Update `submitMatchResult` for double-elimination:

1. **Winners Bracket Win** → Advance in WC
2. **Winners Bracket Loss** → Move to appropriate LC round + trigger Heartbreaker
3. **Losers Bracket Win** → Advance in LC
4. **Losers Bracket Loss** → ELIMINATED (no more chances)
5. **Grand Finals** → Handle bracket reset logic

### Heartbreaker Trigger

When a team loses in Winners Bracket:
```javascript
// After recording the loss
await triggerHeartbreaker(tournamentId, losingTeamId, matchStats);
```

---

## Phase 3: Heartbreaker System

### File: `functions/matchmaker.js` (add to existing)

#### `triggerHeartbreaker(tournamentId, teamId, matchStats)`
- Wait 20 seconds (use Cloud Tasks or setTimeout in client)
- Generate savage loss summary from matchStats
- Send notification to both players on team
- Add team to "heartbroken" list (visible to other losers)

#### `generateSavageSummary(matchStats, playerId)`
Returns personalized summary highlighting partner's failures:
```javascript
{
  headline: "Sorry, you lost.",
  savage_text: "Mike missed 3 darts at D20 to win after you hit 140 to set him up.",
  your_stats: { avg: 42.3, tons: 2 },
  partner_stats: { avg: 31.2, tons: 0 },
  missed_doubles: [{ target: 'D20', remaining: 40, context: 'match_point' }]
}
```

#### `submitBreakupDecision(tournamentId, playerId, wantsBreakup)`
- Record anonymous decision
- Do NOT notify partner
- Add to breakup pool if opted in

#### `getHeartbrokenTeams(tournamentId)`
Returns list of other losing teams (for mingle UI):
```javascript
[
  { team_id, player1_name, player2_name, lost_to_team_name },
  ...
]
```

---

## Phase 4: Nudge System

### File: `functions/matchmaker.js` (add to existing)

#### `sendNudge(tournamentId, fromPlayerId, toPlayerId)`
- Check nudge limit (3 per mingle period)
- Store nudge (anonymous - never expose sender)
- Send notification to recipient: "Someone is interested in partnering with you 👀"

#### Database: `tournaments/{id}/nudges/{nudgeId}`
```javascript
{
  from_player_id: "...",  // Never expose
  to_player_id: "...",
  sent_at: Timestamp,
  mingle_round: 1
}
```

---

## Phase 5: Mingle Period Management

### File: `functions/matchmaker.js` (add to existing)

#### `startMinglePeriod(tournamentId)`
- Set `mingle_active: true`
- Record start time

#### `endMinglePeriod(tournamentId)`
- Triggered when last WC R2 match STARTS
- Set `mingle_active: false`
- Lock all breakup decisions
- Director can then run Cupid Shuffle

#### `runCupidShuffle(tournamentId)`
- Get all breakup opt-ins
- Random re-matching (opposite gender only)
- Update team assignments
- Return new pairings for dramatic reveal

---

## Phase 6: TV Display Page

### File: `public/pages/matchmaker-tv.html` (CREATE)

Full-screen 1080p display for casting to TV:

1. **Bracket View** - Live double-elimination bracket
2. **Partner Reveal** - Dramatic animation for initial draw and Cupid Shuffle
3. **Match Call** - Board assignments with team names
4. **Heartbreaker Alert** - "Mingle period active" with countdown

### Features
- Auto-refresh via Firestore onSnapshot
- No login required (public view)
- Director can switch modes via dashboard
- Animations for reveals (confetti, heartbeat pulse, etc.)

---

## Phase 7: Update Existing Pages

### `public/pages/matchmaker-bracket.html`
- Bind to real bracket data
- Show WC and LC side by side
- Real-time updates
- Clickable matches for score entry (director only)

### `public/pages/matchmaker-director.html`
- Add "Start Mingle Period" button
- Add "End Mingle Period" button
- Add "Run Cupid Shuffle" button
- Show breakup pool count (director only sees who opted in)
- TV Display mode switcher

### `public/pages/matchmaker-register.html`
- Add Heartbreaker prompt UI (after loss)
- Add Nudge button for other losing teams
- Add savage loss summary display

---

## Phase 8: Heartbreaker Format Preset

### File: `functions/matchmaker.js`

Add `createHeartbreakerTournament(data)`:
```javascript
{
  format: 'double_elimination',
  entry_type: 'mixed_doubles',
  winners_game_type: 'cricket',
  winners_best_of: 3,
  losers_game_type: '501',
  losers_best_of: 1,
  breakup_enabled: true,
  mingle_cutoff: 'wc_r2_last_start',  // When last WC R2 match starts
  partner_matching: true,
  venue: 'Rookies',
  boards_available: 12
}
```

---

## Testing Checklist

1. [ ] Register 8 teams (mix of couples and solo)
2. [ ] Run partner draw, verify reveals work
3. [ ] Generate double-elimination bracket
4. [ ] Submit WC R1 results
5. [ ] Verify Heartbreaker prompts appear (20s delay)
6. [ ] Verify savage summaries show real stats
7. [ ] Test nudge feature (send, receive, limit of 3)
8. [ ] Verify mingle period ends when last WC R2 match STARTS
9. [ ] Test Cupid Shuffle with various pool sizes
10. [ ] Verify LC: win = advance, lose = eliminated
11. [ ] Complete through Grand Finals
12. [ ] Test bracket reset if LC champion wins GF match 1

---

## Key Rules (Read Spec for Details)

- **Anonymous breakups** - Never reveal who opted in
- **Two losses = out** - No breakup option in Losers Bracket
- **Mingle ends at last WC R2 start** - Not when round ends
- **Savage summaries** - Playful, not cruel; based on real match data
- **12 boards at Rookies** - Can run all matches in a round simultaneously
- **WC Champion wait < 15-20 min** - Timing is critical

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `functions/tournaments/brackets.js` | ADD double-elim functions |
| `functions/tournaments/matches.js` | UPDATE for DE advancement |
| `functions/matchmaker.js` | ADD Heartbreaker, nudge, mingle functions |
| `public/pages/matchmaker-tv.html` | CREATE TV display page |
| `public/pages/matchmaker-bracket.html` | UPDATE for real data |
| `public/pages/matchmaker-director.html` | UPDATE with mingle controls |
| `public/js/matchmaker-heartbreaker.js` | CREATE client-side Heartbreaker UI |
| `public/js/savage-summary.js` | CREATE summary generator |

---

## Report Progress

When finished, append summary to:
`C:\Users\gcfrp\brdc-firebase\docs\work-tracking\HEARTBREAKER-PROGRESS.md`
