# Matchmaker Feature Assessment

## What is Matchmaker?

**Matchmaker** is a "blind draw" mixed doubles tournament feature with a unique twist: the ability to "break up" and get re-paired with a new partner during the tournament.

### Core Concept
1. **Mixed Doubles** - All teams consist of one male and one female player
2. **Partner Options**:
   - Register as a pre-formed couple ("We're a team")
   - Register solo and get randomly matched ("Find me a partner")
3. **Breakup Mechanic** - After losing in winners bracket:
   - Either player can trigger a "breakup"
   - Both players go to a re-matching pool
   - They get randomly paired with other "broken up" players
   - Continue in losers bracket with new partner
4. **Breakup Rules**:
   - Cutoff round (e.g., "through quarterfinals")
   - Odd number of breakups = can't re-match, stay together
   - Couples who pre-registered can also break up

---

## Page-by-Page Assessment

### 1. matchmaker-view.html - Public Tournament View

**Purpose**: Public landing page showing tournament details and registration status

**Status**: MOSTLY COMPLETE

**What Works**:
- Tournament info display (name, date, venue, time)
- Registration status counts (teams, male singles, female singles)
- Gender balance bar visualization
- "Need more [gender]" warning when unbalanced
- Format info display (game type, best-of, entry fee)
- "Breakup Rules" explanation
- Registered teams list
- Links to register and director pages

**What's Missing/Incomplete**:
- Hardcoded to tournament ID from URL param only
- No list of upcoming matchmaker tournaments
- Registration deadline not shown

**Cloud Functions Used**:
- `getMatchmakerStatus` - works
- `getMatchmakerTeams` - works

---

### 2. matchmaker-register.html - Player Registration

**Purpose**: Allow players to register solo or as a team

**Status**: COMPLETE

**What Works**:
- Toggle between "Find Me a Partner" (solo) and "We're a Team" (couple)
- Solo registration with name, gender, email, phone, player ID
- Team registration with both players' info
- Mixed doubles validation (rejects same-gender teams)
- Registration status display
- Balance warning display
- Success/error messaging

**What's Missing/Incomplete**:
- No duplicate registration check
- No email confirmation sent
- No way to cancel/modify registration

**Cloud Functions Used**:
- `getMatchmakerStatus` - works
- `matchmakerRegister` - works

---

### 3. matchmaker-director.html - Tournament Director Dashboard

**Purpose**: Admin panel for tournament director to manage registrations and run the event

**Status**: MOSTLY COMPLETE

**What Works**:
- PIN-based authentication (stored in session)
- Tabs: Overview, Registrations, Partner Draw, Breakups, Bracket, Settings
- Overview stats (teams, singles, total)
- All registrations list with badges (COUPLE, MATCHED, WAITING)
- Partner Draw: shows unmatched counts, "Draw Partners" button
- Breakup trigger UI (select team, select player)
- Re-match all breakups button
- Settings form (name, date, time, venue, game type, best-of settings)

**What's Missing/Incomplete**:
- "Generate Bracket" just shows "coming soon" message
- Bracket tab doesn't actually generate brackets
- No match scoring/reporting interface
- No way to manually edit teams or registrations
- No way to delete registrations
- Settings save uses `updateTournamentSettings` which may not exist

**Cloud Functions Used**:
- `getMatchmakerStatus` - works
- `getMatchmakerTeams` - works
- `matchmakerDrawPartners` - works
- `matchmakerBreakup` - works
- `matchmakerRematch` - works
- `updateTournamentSettings` - NOT VERIFIED (may not exist)

---

### 4. matchmaker-bracket.html - Tournament Bracket Display

**Purpose**: Show double elimination bracket with breakup prompts

**Status**: PARTIALLY COMPLETE (UI Scaffold)

**What Works**:
- Bracket toggle (Winners/Losers/Finals)
- Team rendering from registered teams
- Breakup modal UI (when clicking a team)
- Responsive bracket grid layout
- Champion display area (hidden until complete)

**What's Broken/Incomplete**:
- **NO ACTUAL BRACKET GENERATION** - just renders teams in round 1
- Bracket positions are hardcoded, not computed from tournament state
- No match result recording
- No advancement logic (winners don't move to next round)
- Breakup modal is demo only - shows for any click, not just after losses
- No real-time updates
- Losers bracket is stub only
- Finals bracket is stub only
- No seeding logic

**Cloud Functions Used**:
- `getMatchmakerTeams` - works (but no bracket data exists)

---

## Cloud Functions Assessment

**File**: `functions/matchmaker.js`

| Function | Status | Notes |
|----------|--------|-------|
| `createMatchmakerTournament` | WORKS | Creates tournament with matchmaker settings |
| `matchmakerRegister` | WORKS | Handles both team and single registration |
| `getMatchmakerStatus` | WORKS | Returns counts and balance info |
| `matchmakerDrawPartners` | WORKS | Randomly pairs unmatched singles |
| `matchmakerBreakup` | PARTIAL | Uses `teams` subcollection but registrations are in `registrations` |
| `matchmakerRematch` | PARTIAL | Same issue - looks in wrong collection |
| `getMatchmakerTeams` | WORKS | Returns all teams from registrations |
| `updateTournamentSettings` | NOT FOUND | Referenced in director page but doesn't exist |

### Data Model Issue
The `matchmakerBreakup` function looks for teams in:
```
tournaments/{id}/teams/{teamId}
```
But registrations are stored in:
```
tournaments/{id}/registrations/{regId}
```

This mismatch will cause breakup functionality to fail.

---

## Integration Status

| Integration Point | Status |
|-------------------|--------|
| Nav Menu | Linked (nav-menu.js line 11) |
| Dashboard | Quick link present (dashboard.html line 6803) |
| Tournaments List | Shows matchmaker badge, links to view page |
| Cloud Functions | Exported in index.js |
| callFunction() | Used for all API calls |

---

## Data Collections Used

```
tournaments/{tournamentId}
  - matchmaker_enabled: boolean
  - registration_counts: { teams, singles_male, singles_female }
  - breakup_cutoff: string
  - winners_best_of: number
  - losers_best_of: number
  - director_pin: string

tournaments/{tournamentId}/registrations/{regId}
  - type: "team" | "single" | "matched_team"
  - player / player1,player2: { name, gender, player_id }
  - matched: boolean
  - team_name: string (for teams)

tournaments/{tournamentId}/breakup_pool/{poolId}  // For breakups
  - player: object
  - original_team_id: string
  - matched: boolean

tournaments/{tournamentId}/teams/{teamId}  // NOT USED - mismatch!
```

---

## Summary

### What's Complete
1. Tournament creation with matchmaker settings
2. Public view page with all tournament info
3. Player registration (solo and team)
4. Gender balance tracking
5. Partner draw functionality
6. Director dashboard structure
7. Integration with nav and dashboard

### What's Incomplete

#### Critical
1. **Bracket generation** - No working bracket system
2. **Match reporting** - No way to record match results
3. **Breakup data model mismatch** - Looks in wrong collection
4. **`updateTournamentSettings`** - Function doesn't exist

#### Important
5. No bracket advancement logic
6. No seeding system
7. Breakup modal is demo-only
8. No real-time bracket updates

#### Nice to Have
9. No duplicate registration check
10. No email confirmations
11. No registration editing/deletion
12. No tournament search/listing for matchmaker tournaments

---

## Recommendation

**Feature Status: 60% Complete**

The registration flow works well. The main gap is the **bracket system** - which is essentially just a visual scaffold without actual tournament management.

### To Make Matchmaker Functional

1. **Fix data model** - Either:
   - Change `matchmakerBreakup` to use `registrations` collection
   - Or create separate `teams` collection when tournament starts

2. **Add bracket generation** - Create function to:
   - Take registered teams
   - Generate seeded bracket positions
   - Store bracket state in tournament document

3. **Add match reporting** - Simple interface to:
   - Record winner of each match
   - Advance winner to next bracket slot
   - Move loser to losers bracket (or trigger breakup prompt)

4. **Wire up breakup flow** - Connect losing team detection to breakup modal

5. **Add `updateTournamentSettings`** - Simple update function for director

### Priority Order
1. Fix breakup collection mismatch (quick fix)
2. Add `updateTournamentSettings` function (quick fix)
3. Create bracket generation logic (medium effort)
4. Add match reporting (medium effort)
5. Wire breakup flow to bracket state (complex)

---

## Quick Fixes Identified

None performed - awaiting direction on whether to implement fixes or just document.
