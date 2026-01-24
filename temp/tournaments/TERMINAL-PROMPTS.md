# Heartbreaker Implementation - Terminal Prompts

**8 terminals, 8 phases. Run all in parallel.**

Note: Phases 1-2 already have partial code in `brackets.js` and `matches.js` from a previous (incorrect) direct coding session. Terminal agents should review, validate, and complete that work.

---

## TERMINAL 1: Double-Elimination Bracket Generator

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Complete Double-Elimination Bracket Generator

There's partial code already in `functions/tournaments/brackets.js` (generateDoubleEliminationBracket function). Review it, fix any issues, and ensure it works correctly.

### What Should Exist
1. `generateDoubleEliminationBracket(tournament_id, director_pin)` - HTTP function
2. Gets teams from `tournaments/{id}/registrations` (type = 'team' or 'matched_team')
3. Generates Winners Bracket with proper seeding
4. Generates Losers Bracket structure (empty initially)
5. Creates Grand Finals placeholder
6. Handles byes for non-power-of-2 team counts
7. Saves bracket to tournament document

### Data Structure Required
```javascript
bracket: {
    type: 'double_elimination',
    format: 'heartbreaker',
    winners: [{ id, round, position, team1_id, team2_id, team1, team2, winner_id, loser_id, status, board }],
    losers: [{ id, round, position, round_type, team1_id, team2_id, status }],
    grand_finals: { match1: {...}, match2: null, bracket_reset_needed: false },
    winners_rounds: number,
    losers_rounds: number,
    mingle_active: false,
    wc_champion_id: null,
    lc_champion_id: null,
    tournament_champion_id: null
}
```

### Files to Review/Modify
- `functions/tournaments/brackets.js` - Main file (has partial code)
- `functions/index.js` - Export the function

### Test
Create a test tournament with 8 teams and verify bracket structure is correct.

### When Done
- Deploy: `firebase deploy --only functions:generateDoubleEliminationBracket`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 2: Match Advancement Logic

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Complete Double-Elimination Match Result Handler

There's partial code already in `functions/tournaments/matches.js` (submitDoubleElimMatchResult, startDoubleElimMatch functions). Review it, fix any issues, and ensure it works correctly.

### What Should Exist
1. `submitDoubleElimMatchResult(tournament_id, match_id, team1_score, team2_score, game_stats)` - HTTP function
2. Finds match in winners, losers, or grand_finals
3. Records result and determines winner/loser
4. **Winners Bracket loss**: Advance winner in WC, drop loser to LC, return `heartbreaker_triggered: true`
5. **Losers Bracket loss**: Advance winner in LC, mark loser as ELIMINATED
6. **Grand Finals**: Handle bracket reset if LC champion wins match1
7. `startDoubleElimMatch(tournament_id, match_id, board)` - Marks match as in_progress

### Key Logic
- WC loser goes to specific LC round based on which WC round they lost in
- LC Round 1 = WC R1 losers play each other
- LC even rounds = WC dropouts join
- LC odd rounds = LC internal advancement
- Mingle ends when LAST WC R2 match STARTS (not ends)

### Files to Review/Modify
- `functions/tournaments/matches.js` - Main file (has partial code)
- `functions/index.js` - Export the functions

### Test
Simulate a match result and verify:
- Winner advances correctly
- Loser drops to correct LC position
- Mingle status updates correctly

### When Done
- Deploy: `firebase deploy --only functions:submitDoubleElimMatchResult,functions:startDoubleElimMatch`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 3: Heartbreaker System (Triggers, Savage Summary, Breakup)

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Implement Heartbreaker Trigger and Savage Summary System

Add functions to `functions/matchmaker.js` for the Heartbreaker mechanics.

### Functions to Create

1. `triggerHeartbreaker(tournament_id, team_id, match_stats)`
   - Called when a team loses in Winners Bracket
   - Waits 20 seconds (use client-side delay, return immediately)
   - Generates savage loss summary
   - Sends notification to both players
   - Adds team to "heartbroken" list

2. `generateSavageSummary(match_stats, player_id)`
   - Analyzes match stats to find partner's failures
   - Returns personalized summary highlighting what went wrong
   - Example output:
   ```javascript
   {
       headline: "Sorry, you lost.",
       savage_text: "Mike missed 3 darts at D20 to win after you hit 140 to set him up.",
       your_stats: { avg: 42.3, tons: 2 },
       partner_stats: { avg: 31.2, tons: 0 },
       missed_doubles: [{ target: 'D20', remaining: 40, context: 'match_point' }]
   }
   ```

3. `submitBreakupDecision(tournament_id, player_id, wants_breakup)`
   - Records anonymous decision (NEVER expose who opted in)
   - Does NOT notify partner
   - Adds to breakup pool if opted in
   - Only available during mingle period

4. `getHeartbrokenTeams(tournament_id)`
   - Returns list of other losing teams (for mingle UI)
   - Does NOT reveal who opted for breakup

### Database Structure
```
tournaments/{id}/heartbroken/{team_id}
  - team_name
  - player1, player2
  - lost_to_team_name
  - match_stats
  - savage_summary_player1
  - savage_summary_player2

tournaments/{id}/breakup_decisions/{decision_id}
  - player_id
  - wants_breakup: boolean
  - decided_at: timestamp
  - (NEVER expose this data to other players)
```

### Files to Modify
- `functions/matchmaker.js` - Add new functions
- `functions/index.js` - Export new functions

### Key Rules
- ANONYMITY IS ABSOLUTE - Never reveal breakup decisions
- Savage summaries are playful, not cruel
- Only available in Winners Bracket (not Losers)

### When Done
- Deploy: `firebase deploy --only functions`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 4: Nudge System

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Implement Anonymous Nudge System

Add nudge functions to `functions/matchmaker.js`.

### Functions to Create

1. `sendNudge(tournament_id, from_player_id, to_player_id)`
   - Check nudge limit (3 per mingle period per player)
   - Store nudge (NEVER expose sender)
   - Send notification: "Someone is interested in partnering with you 👀"
   - Return success/error

2. `getNudgeCount(tournament_id, player_id)`
   - Returns how many nudges this player has sent this mingle period
   - Returns how many nudges this player has received

3. `getAvailableNudgeTargets(tournament_id, player_id)`
   - Returns list of players who can be nudged
   - Excludes: current partner, already nudged players, players not in breakup pool

### Database Structure
```
tournaments/{id}/nudges/{nudge_id}
  - from_player_id (NEVER expose)
  - to_player_id
  - sent_at: timestamp
  - mingle_round: number
```

### Key Rules
- SENDER IS NEVER REVEALED
- Maximum 3 nudges per mingle period
- Only available during active mingle period
- Can only nudge players from OTHER heartbroken teams

### Files to Modify
- `functions/matchmaker.js` - Add nudge functions
- `functions/index.js` - Export new functions

### When Done
- Deploy: `firebase deploy --only functions`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 5: Mingle Period Management

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Implement Mingle Period Management

Add mingle period functions to `functions/matchmaker.js`.

### Functions to Create

1. `startMinglePeriod(tournament_id, director_pin)`
   - Set `bracket.mingle_active: true`
   - Record `bracket.mingle_started_at`
   - Increment `bracket.mingle_round`
   - Called after WC R1 completes

2. `endMinglePeriod(tournament_id)`
   - Set `bracket.mingle_active: false`
   - Record `bracket.mingle_ended_at`
   - Lock all breakup decisions
   - Called automatically when LAST WC R2 match STARTS

3. `runCupidShuffle(tournament_id, director_pin)`
   - Get all breakup opt-ins from `breakup_decisions`
   - Separate by gender
   - Random re-matching (must be opposite gender)
   - Create new team documents
   - Update registrations
   - Return new pairings for dramatic reveal:
   ```javascript
   {
       new_teams: [
           { player1: "Mike", player2: "Sarah", reveal_order: 1 },
           { player1: "John", player2: "Lisa", reveal_order: 2 }
       ],
       stayed_together: ["Team A", "Team B"],  // Opted in but no match available
       unmatched: ["Player X"]  // Odd number, stays with original
   }
   ```

4. `getMingleStatus(tournament_id)`
   - Returns mingle period status
   - Time remaining (estimate)
   - Number of heartbroken teams
   - Breakup pool count (NOT who's in it)

### Key Timing
- Mingle starts: After WC R1 completes (director triggers)
- Mingle ends: When LAST WC R2 match STARTS (automatic)
- Cupid Shuffle: Director triggers after mingle ends

### Files to Modify
- `functions/matchmaker.js` - Add mingle functions
- `functions/index.js` - Export new functions

### When Done
- Deploy: `firebase deploy --only functions`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 6: TV Display Page

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Create TV Display Page for Heartbreaker Tournament

Create `public/pages/matchmaker-tv.html` - a full-screen 1080p display for casting to TV.

### Display Modes

1. **Bracket View**
   - Live double-elimination bracket
   - Winners bracket on left, Losers on right
   - Grand Finals at bottom
   - Real-time updates via Firestore onSnapshot
   - Completed matches show scores
   - In-progress matches pulse/highlight

2. **Partner Reveal**
   - Dramatic animation for initial draw
   - Also used for Cupid Shuffle reveals
   - Names appear one at a time with suspenseful delay
   - Confetti or heart animations

3. **Match Call**
   - Shows board assignments
   - Team names large and readable
   - Which teams to which boards
   - Countdown timer optional

4. **Heartbreaker Alert**
   - "MINGLE PERIOD ACTIVE" banner
   - Countdown (estimate based on WC R2 progress)
   - Heartbroken team count
   - Pulse animation

### Technical Requirements
- No login required (public view)
- Auto-refresh via Firestore real-time listeners
- Works on 1920x1080 display
- Dark theme matching BRDC style
- URL params: `?tournament_id=XXX&mode=bracket`
- Director can switch modes via matchmaker-director.html

### Design Notes
- Use existing BRDC CSS variables
- Large, readable fonts (this is for a TV across the room)
- Bebas Neue for team names
- Pink for home/team1, Teal for away/team2
- Yellow for highlights and winners

### Files to Create
- `public/pages/matchmaker-tv.html`

### Files to Reference
- `public/pages/tournament-bracket.html` - Existing bracket display
- `public/css/styles.css` - BRDC theme

### When Done
- Deploy: `firebase deploy --only hosting`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 7: Update Existing Matchmaker Pages

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Update Existing Matchmaker Pages with Real Data

Update the existing matchmaker pages to work with real Firestore data.

### Files to Update

1. `public/pages/matchmaker-bracket.html`
   - Bind to real bracket data from tournament document
   - Show Winners and Losers brackets side by side
   - Real-time updates via onSnapshot
   - Clickable matches for score entry (director only)
   - Visual distinction between WC and LC

2. `public/pages/matchmaker-director.html`
   - Add "Start Mingle Period" button
   - Add "End Mingle Period" button (or show auto-end status)
   - Add "Run Cupid Shuffle" button
   - Show breakup pool count (director sees who opted in)
   - TV Display mode switcher
   - Board assignment interface

3. `public/pages/matchmaker-register.html`
   - Add Heartbreaker prompt UI (appears after loss in WC)
   - Add Nudge button for other heartbroken teams
   - Add savage loss summary display
   - Show mingle period status and countdown

### New UI Components Needed

**Heartbreaker Prompt (appears after WC loss):**
```html
<div class="heartbreaker-prompt">
    <h2>💔 Sorry, you lost.</h2>
    <div class="savage-summary">
        [Partner's name] missed 3 darts at D20...
    </div>
    <div class="breakup-options">
        <button class="btn-breakup">Request New Partner</button>
        <button class="btn-stay">Stay Together</button>
    </div>
    <p class="anonymous-note">Your choice is anonymous.</p>
</div>
```

**Mingle View (during mingle period):**
```html
<div class="mingle-view">
    <h2>Mingle Period Active</h2>
    <div class="heartbroken-teams">
        <!-- List of other losing teams -->
    </div>
    <button class="btn-nudge" data-player-id="XXX">
        👀 Nudge
    </button>
    <div class="nudge-count">2/3 nudges remaining</div>
</div>
```

### Files to Modify
- `public/pages/matchmaker-bracket.html`
- `public/pages/matchmaker-director.html`
- `public/pages/matchmaker-register.html`

### When Done
- Deploy: `firebase deploy --only hosting`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## TERMINAL 8: Heartbreaker Format Preset

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Add Heartbreaker Tournament Format Preset

Add a preset function to create Heartbreaker tournaments with all the right settings.

### Function to Create

`createHeartbreakerTournament(data)` in `functions/matchmaker.js`

Should set these defaults:
```javascript
{
    // Format
    format: 'double_elimination',
    entry_type: 'mixed_doubles',
    matchmaker_enabled: true,
    partner_matching: true,
    breakup_enabled: true,

    // Game types
    winners_game_type: 'cricket',
    winners_best_of: 3,
    losers_game_type: '501',
    losers_best_of: 1,

    // Heartbreaker specific
    mingle_cutoff: 'wc_r2_last_start',  // When last WC R2 match starts
    savage_summaries_enabled: true,
    nudge_limit: 3,

    // Venue defaults for Rookies
    venue_name: 'Rookies',
    boards_available: 12,

    // Other
    status: 'registration',
    started: false,
    completed: false
}
```

### Also Add

1. Update `public/pages/create-tournament.html` to include a "Heartbreaker" format option
2. When selected, auto-populate all the Heartbreaker-specific fields
3. Add explanatory text about the format

### Tournament Creation UI Addition
```html
<div class="format-option" data-format="heartbreaker">
    <h3>💔 Matchmaker, Heartbreaker</h3>
    <p>Valentine's mixed doubles chaos tournament</p>
    <ul>
        <li>Double elimination</li>
        <li>Winners: Cricket BO3</li>
        <li>Losers: 501 BO1</li>
        <li>Anonymous breakup mechanic</li>
        <li>Partner re-matching</li>
    </ul>
</div>
```

### Files to Modify
- `functions/matchmaker.js` - Add createHeartbreakerTournament
- `functions/index.js` - Export new function
- `public/pages/create-tournament.html` - Add format option

### When Done
- Deploy: `firebase deploy --only functions,hosting`
- Report to: `docs/work-tracking/HEARTBREAKER-PROGRESS.md`
```

---

## Coordination Notes

All 8 terminals can run in parallel. Dependencies:
- Terminal 1 (Brackets) and Terminal 2 (Match Advancement) work together but can run in parallel
- Terminal 3-5 (Heartbreaker, Nudge, Mingle) are independent
- Terminal 6-7 (TV Display, Update Pages) are frontend and independent
- Terminal 8 (Preset) is standalone

After all complete, run integration testing.
