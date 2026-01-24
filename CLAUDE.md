# BRDC Development Rules

---

# 🚨 CRITICAL: CORRECT WORKING DIRECTORY 🚨

**The BRDC project folder is located at:**
```
C:\Users\gcfrp\projects\brdc-firebase
```

**DO NOT use `C:\Users\gcfrp\brdc-firebase`** - That's an OLD DUPLICATE that should be deleted.

**Always:**
- Work from `C:\Users\gcfrp\projects\brdc-firebase`
- Run `firebase deploy` from that directory
- Reference that path in all terminal prompts

---

# 🚨 RULE #1: OPUS DOES NOT CODE 🚨

**THIS IS THE MOST IMPORTANT RULE. READ IT FIRST. FOLLOW IT ALWAYS.**

## Before Writing ANY Code, ASK:

1. **"Should I write prompts for the terminal agents instead?"** - The answer is almost always YES
2. **"How many terminals are available?"** - Plan work to maximize parallelization

**Current terminal capacity: 8 terminals available**

Use them wisely. Break work into 8 parallel streams when possible.

---

## You Are The Project Coordinator

**VS Code Claude (Opus) = PROJECT MANAGER.** You do NOT write code directly. You:

1. **Plan** - Break down tasks into parallelizable work (up to 8 streams!)
2. **Write prompts** - Create detailed, self-contained prompts for terminal agents
3. **Coordinate** - Track progress, handle blockers, ensure quality
4. **Research** - Read files, explore codebase, understand context

**Terminal Claudes (Sonnet/Haiku) = CODERS.** They receive your prompts and execute.

## Prompt Format (REQUIRED)

Every prompt you write for terminal agents MUST include:

```
Working directory: C:\Users\gcfrp\projects\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

---

## Task: [Clear description]

[Detailed instructions...]

## Files to Modify
- [specific files]

## Test Data
- League ID: aOq4Y0ETxPZ66tM1uUtP
- Match ID: sgmoL4GyVUYP67aOS7wm

## When Done
- Deploy: `firebase deploy --only hosting` (for frontend)
- Deploy: `firebase deploy --only functions` (for backend)
- Report to: [docs/work-tracking/FILENAME.md]
```

### Why Permissions Matter
Without explicit permissions, terminal agents get blocked by approval prompts constantly. The user has to keep clicking "allow". Including permissions in every prompt prevents this.

### Model Selection
Include in your prompt:
- **Model: Sonnet** - For most coding tasks (fast, capable)
- **Model: Haiku** - For simple/repetitive tasks (fastest, cheapest)
- **Model: Opus** - Only for complex architectural decisions

## Violation = Wasted Time

If you (Opus) start writing code directly:
- You're doing terminal work at Opus prices
- You're blocking parallel execution
- You're violating the #1 efficiency rule

**STOP. Write a prompt instead. Give it to the user to run in a terminal.**

---

## SESSION CONTINUITY

**Before starting new work:**

1. **Check recent session files:** `docs/work-tracking/SESSION-*.md`
   - What was completed
   - Known issues and bugs
   - Priority roadmap
   - Reference data (test league/match IDs)

2. **Check the ideas backlog:** `docs/work-tracking/IDEAS-BACKLOG.md`
   - Features discussed but not yet implemented
   - Ideas to explore
   - Things to remember

3. **Check user feedback:** Review bug reports from the feedback widget
   - Firestore collection: `feedback`
   - Bring up any new reports at session start

**Acknowledge pending items** at the start of a session so nothing gets forgotten.

---

## RULE: CAPTURE IDEAS IMMEDIATELY

**Any time we discuss:**
- A feature to implement later
- A new idea to explore
- Something to remember or revisit
- A bug to fix that we're not fixing now

**Immediately add it to:** `docs/work-tracking/IDEAS-BACKLOG.md`

Format:
```markdown
### [YYYY-MM-DD] - Brief Title
Description of the idea/task
Context: Why it came up
Priority: High/Medium/Low
```

**Why:** Conversation memory is volatile. After compaction, undocumented ideas are lost forever. If it's worth mentioning, it's worth writing down.

---

## RULE 0: ALWAYS DEPLOY FOR TESTING

**The user NEVER tests locally.** Local hosting buttons don't work for testing.

After making any frontend changes (HTML, CSS, JS in `/public`), **always deploy**:
```bash
firebase deploy --only hosting
```

The live site is: https://brdc-v2.web.app

---

## RULE 1: IDs ONLY - NEVER NAMES

**Backend code ALWAYS uses document IDs. NEVER use player names, team names, or any display text for lookups.**

```javascript
// CORRECT
const stats = await getDoc(doc(db, 'leagues', leagueId, 'stats', player.id));
const team = await getDoc(doc(db, 'leagues', leagueId, 'teams', player.team_id));

// WRONG - NEVER DO THIS
const player = playersByName[someName.toLowerCase()]; // NO!
const stats = statsCollection.find(s => s.player_name === name); // NO!
```

**Why**: Names are inconsistent ("Jennifer Malek" vs "Jenn M" vs "J. Malek"). IDs are unique and immutable.

**Display names are for the UI only.** Store them, display them, but never use them to find data.

---

## RULE 2: ONE STATS SOURCE

Player stats are stored in ONE place:

```
leagues/{leagueId}/stats/{playerId}
```

**That's it.** No fallbacks, no checking multiple collections.

- `aggregated_stats` collection is deprecated/empty - don't use it
- Player documents may have embedded stats for display convenience, but the source of truth is `stats/{playerId}`

```javascript
// CORRECT - Single source
const statsDoc = await getDoc(doc(db, 'leagues', leagueId, 'stats', playerId));

// WRONG - Don't do fallback chains
let stats = await getDoc(doc(db, 'aggregated_stats', id));
if (!stats.exists()) stats = await getDoc(doc(db, 'stats', id)); // NO!
```

---

## RULE 3: CANONICAL FIELD NAMES

### Matches
| Field | Type | Description |
|-------|------|-------------|
| `match_date` | Timestamp | When the match is scheduled |
| `home_team_id` | string | Document ID of home team |
| `away_team_id` | string | Document ID of away team |
| `home_score` | number | Sets won by home (main score) |
| `away_score` | number | Sets won by away (main score) |
| `status` | string | "scheduled", "in_progress", "completed" |
| `week` | number | Week number in season |
| `winner` | string | "home", "away", or "tie" |

### League Scoring Hierarchy (Triples Draft)
Standings are determined in this order:
1. **Match wins** (nights won)
2. **Set wins** (games won, e.g., 7-2 in a night)
3. **Leg wins** (individual legs within sets)
4. **Head-to-head** (tiebreaker)

Display format: `(15)7-2(8)` = home won 7 sets with 15 total legs, away won 2 sets with 8 total legs

### Global Players (`/players/{playerId}`)
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `email` | string | Contact email |
| `phone` | string | Contact phone |
| `pin` | string | 8-digit login PIN |
| `stats` | object | Lifetime aggregated stats |
| `involvements` | object | Links to leagues/tournaments |

### League Players (`/leagues/{leagueId}/players/{playerId}`)
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (denormalized) |
| `team_id` | string | Document ID of their team |
| `position` | number | 1, 2, or 3 (roster slot) |
| `level` | string | Assigned level: "A", "B", or "C" |
| `preferred_level` | string | Player's requested level at registration |
| `is_captain` | boolean | True if team captain |

### Teams
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (for UI only) |
| `captain_id` | string | Document ID of captain player |

### Stats (in `stats/{playerId}`)
| Field | Type | Description |
|-------|------|-------------|
| `x01_three_dart_avg` | number | 3-dart average |
| `cricket_mpr` | number | Marks per round |
| `x01_legs_played` | number | Total X01 legs |
| `x01_legs_won` | number | X01 legs won |
| `cricket_legs_played` | number | Total cricket legs |
| `cricket_legs_won` | number | Cricket legs won |

Use `stats-helpers.js` functions (`get3DA()`, `getMPR()`) which handle legacy field names.

---

## RULE 4: GETTING TEAM PLAYERS

To get players on a team, query by `team_id`:

```javascript
// CORRECT
const playersSnap = await getDocs(collection(db, 'leagues', leagueId, 'players'));
const teamPlayers = [];
playersSnap.forEach(doc => {
    const player = { id: doc.id, ...doc.data() };
    if (player.team_id === teamId) {
        teamPlayers.push(player);
    }
});
```

**NEVER** try to extract player identity from the `games` array in match documents. That array stores names (for display), not IDs.

---

## RULE 5: MISSING DATA

When data is missing, show a placeholder. Don't try to be clever.

```javascript
// Stats missing? Show dash
const threeDartAvg = get3DA(stats);
const display = threeDartAvg != null ? threeDartAvg.toFixed(1) : '-';

// Player missing? Show "Unknown"
const name = player?.name || 'Unknown';

// Team missing? Show "Unknown Team"
const teamName = team?.name || 'Unknown Team';
```

Log errors for debugging but don't break the UI.

---

## RULE 6: DATE HANDLING

Always use `match_date` for matches. Parse Firebase Timestamps correctly:

```javascript
// Firebase Timestamp to JS Date
const date = matchData.match_date?.toDate ? matchData.match_date.toDate() : new Date(matchData.match_date);

// For display
const dateStr = date.toLocaleDateString();
```

---

## RULE 7: BEFORE WRITING CODE

1. **Read this file**
2. **Check what collections/fields already exist** - don't invent new ones
3. **Use IDs for all lookups** - names are display only
4. **Use `stats-helpers.js`** for reading stats - it handles legacy fields
5. **Test with real data** - Jenn M, Christian K, etc. have stats

---

## Current Data Structure

```
leagues/{leagueId}/
├── teams/{teamId}
│   └── { name, captain_id }
├── players/{playerId}
│   └── { name, team_id, position, email, phone, pin }
├── stats/{playerId}
│   └── { x01_three_dart_avg, cricket_mpr, ... }
├── matches/{matchId}
│   └── { match_date, home_team_id, away_team_id, status, week, ... }
└── [aggregated_stats/] - DEPRECATED, DO NOT USE
```

---

## Quick Reference

| To get... | Use... |
|-----------|--------|
| Player's stats | `stats/{player.id}` |
| Team's players | Query players where `team_id === teamId` |
| Match teams | `teams/{match.home_team_id}`, `teams/{match.away_team_id}` |
| Player's team | `teams/{player.team_id}` |

**ALWAYS IDs. NEVER NAMES.**

---

## RULE 8: MATCH CARD STYLING

Match cards have a single colored border that matches the calendar legend event type:

| Event Type | Border Color |
|------------|--------------|
| League Match | teal (`var(--teal)`) |
| Tournament | yellow (`var(--yellow)`) |
| Upcoming Tournament | orange (`#FF9800`) |
| Deadline | red (`#e53935`) |
| Social/Casual | pink (`var(--pink)`) |

**Container elements (like `.single-day-view`) should NOT have their own border** - only the match card itself gets the colored border.

This keeps the visual hierarchy clean and avoids doubled borders.

---

## RULE 9: MATCH CARD LAYOUT (Dashboard Schedule)

The match card on the dashboard schedule tab has a specific layout that must be preserved. This is the template for all league match cards.

### Header Layout (Completed Match)
```
[star] (0-1) 4th D. PAGEL  2  |  WEEK 1/18  |  7  M. PAGEL 2nd (1-0) [star]
              47.1 / 2.26     |    FINAL    |     52.4 / 2.26
```

- **Grid**: `1fr auto auto auto auto auto 1fr` (7 columns when completed with scores)
- **Grid (upcoming)**: `1fr auto auto auto 1fr` (5 columns, no score elements)
- **Left team info**: Record + Standing + Name (right-aligned toward center)
- **Right team info**: Name + Standing + Record (left-aligned toward center)
- **Scores**: Large (42px) between team info and center, yellow for winner
- **Winner star**: 36px, in outer `1fr` columns with pulse animation
- **Team averages**: Below team name, dim gray text (3DA / MPR)

### Header Element Order (Left to Right for Completed Match)
1. Winner star slot (left)
2. Left team side: record badge, standing badge, team name, team averages
3. Left score
4. Center (WEEK X/Y, FINAL/VS/@)
5. Right score
6. Right team side: team name, standing badge, record badge, team averages
7. Winner star slot (right)

### Badge Styling
- **Standing badge**: Pink background (`var(--pink)`), dark text, 10px font
- **Record badge**: Dark gray background (`#333`), gray text (`#888`), 9px font (smaller than standing)
- **Team name**: Teal color (`var(--teal)`), 22px Bebas Neue font, yellow when winner

### Roster Layout
- **Row structure**: Stats on outer edges, names in center meeting each other
- **Left cell order**: Stats first, then name (HTML order)
- **Right cell order**: Name first, then stats (HTML order)
- **Cell styling**: `display: flex; justify-content: space-between; width: 100%`
- **Name styling**: `flex: 0 0 auto` (NOT `flex: 1` which causes bunching)
- **Fill-in players**: Show "SUB" badge, appear in correct roster position
- **OUT players**: Dim gray, shown at bottom of roster

### Footer Layout
- **Grid**: `1fr auto 1fr` to keep View League centered regardless of button widths
- **Button order**: Confirm (left), View League (center), Can't Make It (right)
- **First/last child**: `justify-self: start` / `justify-self: end`

### Key CSS Classes
```css
.match-card-header { grid-template-columns: 1fr auto auto auto 1fr; }
.match-card-header.completed { grid-template-columns: 1fr auto auto auto auto auto 1fr; }
.match-team-side.left { text-align: right; }
.match-team-side.right { text-align: left; }
.match-team-name { font-size: 22px; color: var(--teal); }
.match-team-standing { font-size: 10px; background: var(--pink); }
.match-team-record { font-size: 9px; background: #333; color: #888; }
.match-header-score { font-size: 42px; }
.match-header-score.winner { color: var(--yellow); }
.winner-star-slot { display: grid; place-items: center; }
.winner-star { font-size: 36px; color: #FFD700; }
.match-player-cell { display: flex; justify-content: space-between; width: 100%; }
.match-player-name { flex: 0 0 auto; }
.match-card-footer { display: grid; grid-template-columns: 1fr auto 1fr; }
```

### TODO: Record Badge Fix
The record badge `(0-1)` is still rendering larger than the standing badge `4th` despite being set to 9px. Need to investigate why the CSS change isn't taking effect - may be a caching issue or CSS specificity problem.

---

## RULE 10: LEAGUE SCHEDULE CARD

The League Schedule Card appears on the **league-view.html** page in the Schedule tab. It shows a neutral view of all matches (home team always left, away team always right - no user context).

**Location**: `public/pages/league-view.html`
**Function**: `loadLeagueMatchCard(idx, match)`
**Container ID**: `matchCard{idx}`

### Key Differences from Dashboard Match Card (RULE 9)
| Aspect | Dashboard Card | League Schedule Card |
|--------|---------------|---------------------|
| Team orientation | User's team always LEFT | Home team always LEFT |
| Footer buttons | Confirm / View League / Can't Make It | View Match (centered) |
| Context | Personalized to logged-in user | Neutral/public view |
| Records calculation | From user's team perspective | Calculated from all matches |

### Header Layout (Same as RULE 9)
```
[star] (0-1) 4th TEAM A  2  |  WEEK 1/18  |  7  TEAM B 2nd (1-0) [star]
              47.1 / 2.26    |    FINAL    |     52.4 / 2.26
```

- **Grid (completed)**: `1fr auto auto auto auto auto 1fr` (7 columns)
- **Grid (upcoming)**: `1fr auto auto auto 1fr` (5 columns)
- **Home team**: Always on LEFT side
- **Away team**: Always on RIGHT side

### Card Container Styling
```css
.match-card {
    background: var(--bg-card);
    border: 3px solid #000;
    border-radius: 12px;
    box-shadow: 4px 4px 0 rgba(0,0,0,0.3);
    margin-bottom: 12px;
    overflow: hidden;
}
```

### Footer Layout
```css
.match-card-footer {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    padding: 10px 14px;
    background: rgba(0,0,0,0.3);
}
```
- Single centered "View Match" button
- Links to `/pages/match-hub.html?league_id={}&match_id={}`

### Data Flow
1. `renderSchedule()` creates placeholder cards grouped by week
2. `loadAllMatchCards()` iterates through matches and calls `loadLeagueMatchCard()` for each
3. `loadLeagueMatchCard()` fetches:
   - Teams from `teams` array (already loaded)
   - Players from `leagues/{leagueId}/players`
   - Stats from `leagues/{leagueId}/stats/{playerId}`
4. Records and standings calculated from completed matches in the `matches` array

### Fill-in Player Handling
- Checks `match.home_lineup` and `match.away_lineup` arrays
- Looks for entries with `is_sub: true` and `replacing_player_id`
- Shows SUB badge for fill-ins, OUT badge for replaced players

---

## RULE 11: LOGIN PAGE STYLING

**The dashboard login (`dashboard.html`) is THE standard login style.** All pages requiring login must match this exact style.

**Location**: `public/pages/dashboard.html`
**Classes**: `.login-page`, `.login-logo`, `.login-title`, `.login-box`, `.login-form-title`, `.form-group`, `.form-label`, `.form-input`, `.login-btn`, `.login-error`, `.login-links`

### Key Elements
```html
<div class="login-page">
    <img src="/images/gold_logo.png" alt="BRDC" class="login-logo">
    <h1 class="login-title">PAGE TITLE</h1>

    <div class="login-box">
        <div class="login-form-title">LOGIN</div>
        <div class="login-error hidden" id="loginError"></div>
        <div class="form-group">
            <label class="form-label">Your 8-Digit PIN</label>
            <input type="password" class="form-input" id="pinInput" placeholder="••••••••" maxlength="8" inputmode="numeric">
        </div>
        <button class="login-btn" onclick="login()">LOGIN</button>
        <div class="login-links">...</div>
    </div>
</div>
```

### Critical CSS Properties
- `.login-box`: `background: var(--bg-panel)`, `border: 3px solid #000`, `border-radius: 16px`, `box-shadow: 8px 8px 0 rgba(0,0,0,0.4)`
- `.form-input`: `font-family: 'JetBrains Mono'`, `font-size: 24px`, `color: var(--yellow)`, `letter-spacing: 4px`
- `.login-btn`: `background: linear-gradient(180deg, var(--pink) 0%, #d63384 100%)`, `box-shadow: 4px 4px 0 rgba(0,0,0,0.4)`

### Pages Using This Style
- `dashboard.html` - Main player dashboard
- `stat-verification.html` - Stats verification process
- Any new page requiring PIN login

---

## RULE 12: FIRESTORE DATA MAP

**Complete reference for where all data lives. USE THIS FIRST before digging through code.**

### Top-Level Collections

```
/players/{playerId}                    - Global player profiles (PIN login, contact info)
/leagues/{leagueId}                    - League configuration and settings
/tournaments/{tournamentId}            - Tournament configuration
```

### League Subcollections

```
/leagues/{leagueId}/teams/{teamId}           - Teams in this league
/leagues/{leagueId}/players/{playerId}       - Players registered to this league (has team_id)
/leagues/{leagueId}/matches/{matchId}        - Match schedule and results
/leagues/{leagueId}/stats/{playerId}         - Player stats for this league ⭐ SOURCE OF TRUTH
/leagues/{leagueId}/registrations/{regId}    - Registration records (pre-draft)
```

### Tournament Subcollections

```
/tournaments/{tournamentId}/players/{playerId}   - Players registered to tournament
/tournaments/{tournamentId}/matches/{matchId}    - Tournament bracket matches
```

### Player Subcollections

```
/players/{playerId}/verification/current     - Current verified stats (3DA, MPR)
/players/{playerId}/verification/history     - Historical verification attempts
```

---

### How Data Connects

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LEAGUE CONTEXT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  leagues/{leagueId}/teams/{teamId}                                  │
│      └── captain_id → points to a player in /players/{playerId}     │
│      └── team_name (display only)                                   │
│                                                                      │
│  leagues/{leagueId}/players/{playerId}                              │
│      └── team_id → points to team in this league                    │
│      └── name (display only, denormalized)                          │
│      └── level (A/B/C - ASSIGNED after league formation)            │
│      └── preferred_level (player's request at registration)         │
│      └── position (1, 2, or 3 - roster slot on team)                │
│                                                                      │
│  leagues/{leagueId}/stats/{playerId}                                │
│      └── x01_three_dart_avg, cricket_mpr, etc.                      │
│      └── Use get3DA() and getMPR() helpers!                         │
│                                                                      │
│  leagues/{leagueId}/matches/{matchId}                               │
│      └── home_team_id, away_team_id → team IDs                      │
│      └── home_score, away_score                                     │
│      └── home_lineup[], away_lineup[] (for fill-ins)                │
│      └── games[] (individual game results with player names)        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Common Data Loading Patterns

**Load a league with all its data:**
```javascript
// 1. League config
const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
const leagueData = leagueDoc.data();

// 2. Teams
const teamsSnap = await getDocs(collection(db, 'leagues', leagueId, 'teams'));
const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// 3. Players (with team_id for roster building)
const playersSnap = await getDocs(collection(db, 'leagues', leagueId, 'players'));
const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

// 4. Stats
const statsSnap = await getDocs(collection(db, 'leagues', leagueId, 'stats'));
const statsById = {};
statsSnap.forEach(d => { statsById[d.id] = d.data(); });

// 5. Matches
const matchesSnap = await getDocs(collection(db, 'leagues', leagueId, 'matches'));
const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
```

**Get players on a specific team:**
```javascript
const teamPlayers = players.filter(p => p.team_id === teamId)
    .sort((a, b) => (a.position || 99) - (b.position || 99));
```

**Get a player's stats:**
```javascript
const stats = statsById[playerId] || {};
const avg = get3DA(stats);  // Use helper!
const mpr = getMPR(stats);  // Use helper!
```

**Look up global player by PIN (login):**
```javascript
const playerQuery = await getDocs(
    query(collection(db, 'players'), where('pin', '==', enteredPin))
);
if (!playerQuery.empty) {
    const player = { id: playerQuery.docs[0].id, ...playerQuery.docs[0].data() };
}
```

---

### Key Gotchas

1. **Two player collections!**
   - `/players/{id}` = Global profiles (PIN, email, phone, lifetime stats)
   - `/leagues/{leagueId}/players/{id}` = League-specific (team_id, level, position)
   - Same player ID in both, but different data
   - `preferred_level` = player's request at registration (input)
   - `level` = assigned level after league formation (A/B/C, determined by draft/stats)

2. **Stats are league-specific**
   - `/leagues/{leagueId}/stats/{playerId}` - NOT a global stats collection
   - Each league tracks its own stats

3. **team_id lives on the player, not player_ids on the team**
   - To get team roster: filter players by `team_id`
   - Teams don't store arrays of player IDs

4. **Match games[] array uses names, not IDs**
   - `games[]` is for display/history only
   - Never use it to look up player data

---

## RULE 13: REFERENCE DATA FOR TESTING

**Always use Pagel v Pagel (Week 1) as the reference match for development/testing.**

### Reference IDs
| Item | ID |
|------|-----|
| League (Winter Triple Draft) | `aOq4Y0ETxPZ66tM1uUtP` |
| Match (Pagel v Pagel, Week 1) | `sgmoL4GyVUYP67aOS7wm` |
| Home Team (M. Pagel) | `mgR4e3zldLsM9tAnXmK8` |
| Away Team (D. Pagel) | `U5ZEAT55xiNM9Otarafx` |

### Reference URLs
```
League View:  /pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP
Match Hub:    /pages/match-hub.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=sgmoL4GyVUYP67aOS7wm
```

### Database Path for Matches
```
leagues/{leagueId}/matches/{matchId}
```
All league matches are stored in this collection. Use `getSchedule` cloud function to query matches.

### Other Week 1 Matches
| Match | match_id |
|-------|----------|
| N. Kull vs K. Yasenchak | `JqiWABEBS7Bqk8n7pKxD` |
| E. Olschansky vs D. Partlo | `0lxEeuAa7fEDSVeY3uCG` |

---

## RULE 14: MATCH-HUB DESIGN REQUIREMENTS

**Reference:** DartConnect match reports in `temp/dc/league/`

### Match Header (Always Visible)
Static match metadata at top of page (like DC's Match Report header):
- Date
- Start time
- End time
- Match duration (game time)
- Total matches/games count
- Total darts thrown

**IMPORTANT:** Always track timing data for ALL game types (league, tournament, social). This data is critical for future planning (estimating event duration, scheduling, etc.).

### Tab 1: Games (Summary + Detail Combined)
- Each game displayed as a card (league-view schedule card styling)
- Card shows summary info:
  - Game type (501/Cricket), format (SIDO, etc.)
  - Players on each side with levels
  - Winner indicator
  - Key stats (3DA for 501, MPR for Cricket)
  - Score
- **Each card has toggle to expand** → shows throw-by-throw detail (like DC Game Detail)
- **"Expand All / Collapse All"** button at top

### Tab 2: Player Performance
- All 01 Legs detail with individual stats
- All Cricket Legs detail
- High Points Per Round
- High Marks Per Round

### Tab 3: Match Counts
- 60+ Double-ins, 80+ Double-outs
- Checkout Performance tracking
- Opportunity Tracking (doubles attempts)
- 01 100+ Turns and 95+ Turns breakdown
- Cricket 5M+ Turns
- Cricket Bulls counts
- Marksman Counts (high marks per round)

### Tab 4: Leaderboards (Match-Specific)
- Same leaderboard stats from league Stats tab, but filtered to THIS MATCH only
- 501 Leaders, Cricket Leaders
- "Who shined in this match" view

### Design Notes
- Use league-view schedule card styling
- Team colors (pink for home, teal for away)
- Tabbed interface for navigation
- Shareable/printable reports
- Clean visual hierarchy

---

## RULE 15: MATCH DATA IMPORT SYSTEM

**DartConnect match data is stored in RTF files in `temp/trips league/`**

### Data Files for Winter Triple Draft League
| Match | RTF File | Status |
|-------|----------|--------|
| Pagel v Pagel | `pagel v pagel MATCH.rtf` + `pagel v pagel performance.rtf` | ✅ IMPORTED |
| Yasenchak v Kull | `yasenchak v kull.rtf` + `yasenchak v kull performance.rtf` | PENDING |
| Partlo v Olschansky | `partlo v olschansky.rtf` + `partlo v olschansky performance.rtf` | PENDING |
| Massimiani v Ragnoni | `massimiani v ragnoni.rtf` + `massimiani v ragnoni performance.rtf` | PENDING |
| Mezlak v Russano | `mezlak v russano.rtf` + `mezlak v russano performance.rtf` | PENDING |

### Import System
- Cloud function: `populatePagelMatch` (example for Pagel v Pagel)
- Template file: `functions/populate-match-data.js`
- Call URL: `https://us-central1-brdc-v2.cloudfunctions.net/populatePagelMatch`

### Data Structure for Import
Each match needs:
```javascript
{
    // Match metadata
    match_date: Date,
    start_time: Date,
    end_time: Date,
    game_time_minutes: number,
    match_length_minutes: number,
    total_darts: number,
    total_games: number,
    total_sets: number,

    // Games array (one per game in match)
    games: [{
        set: number,
        game_in_set: number,
        format: '501' | 'cricket',
        home_players: string[],
        away_players: string[],
        winner: 'home' | 'away',
        home_legs_won: number,
        away_legs_won: number,
        duration_seconds: number,
        legs: [{
            leg_number: number,
            format: string,
            winner: 'home' | 'away',
            home_stats: { three_dart_avg, darts, points, mpr, marks },
            away_stats: { three_dart_avg, darts, points, mpr, marks },
            player_stats: { [playerName]: { darts, points, three_dart_avg, mpr, marks } },
            checkout: number,
            checkout_darts: number,
            throws: [{
                round: number,
                home: { player, score, remaining, hit, marks, notable, checkout },
                away: { player, score, remaining, hit, marks, notable, checkout }
            }]
        }]
    }]
}
```

### RTF Parsing Notes
- RTF files use `\\tab` for tab separators
- Special character `\\u8709?` = empty/miss (∅)
- Notable scores are indicated with labels like `140`, `100`, `95`, `5M`, `3B`
- Winner indicated by `WIN` marker or checkmark
- Checkout shown as `DO (2)` = double out in 2 darts

---

## RULE 16: STAT CALCULATION - CHECKOUT DARTS

**CRITICAL: Checkout darts are essential for accurate 3-dart average calculation.**

### Why It Matters
DartConnect tracks how many darts were used on the checkout turn:
- `DO (1)` = First dart checkout
- `DO (2)` = Second dart checkout
- `DO (3)` = Third dart (full turn) checkout

If a player checks out with their first dart, they only threw 1 dart that round, not 3. Without tracking this, all averages would be slightly wrong.

### Correct 3DA Calculation
```javascript
// Total darts = (full rounds * 3) - (3 - checkout_darts) for winner
// Example: Player throws 8 full rounds, checks out on 2nd dart of round 9
// Total darts = 8*3 + 2 = 26 (NOT 27)
```

### Data Structure
Each leg stores:
```javascript
{
    checkout: 43,           // Points scored on checkout
    checkout_darts: 2,      // Darts used for checkout (1, 2, or 3)
    throws: [
        // ...
        { round: 9, home: { score: 43, remaining: 0, checkout: true, checkout_darts: 2 } }
    ]
}
```

### Notable Throw Categories
When parsing RTF or recording games, track these notable events:

**X01 Notable Throws:**
| Indicator | Meaning |
|-----------|---------|
| `180` | Maximum (180) |
| `140`-`179` | Ton-40 to Ton-79 |
| `100`-`139` | Ton or Ton+ |
| `95`-`99` | Near-ton |
| `DO (n)` | Double out in n darts |

**Cricket Notable Throws:**
| Indicator | Meaning |
|-----------|---------|
| `9M` | 9 marks (maximum) |
| `6M`-`8M` | 6+ marks |
| `5M` | 5 marks |
| `3B` | 3 bulls (SB, SB, DB or similar) |
| `5B` | 5 bulls (e.g., DB, DB, SB) |

### Cricket Dart Count Notes
**Cricket DOES track partial closeout rounds** - same as X01, the winner may close with 1, 2, or 3 darts.

**How to determine closeout_darts for cricket:**

1. **From RTF hit notation**: Count the dart hits in the closeout throw
   - `SBx2` = 2 darts (2 single bulls)
   - `DB, SB` = 2 darts visible, but check if there was a miss (could be 3)
   - `DB` alone = 1 dart (closed with first dart)

2. **From dart count calculation (singles cricket):**
   ```javascript
   const expectedDarts = rounds * 3;
   const closeout_darts = 3 - (expectedDarts - actualDarts);
   // Example: 3 - (36 - 35) = 2 darts to close
   ```

3. **Doubles cricket complication:**
   - Players alternate rounds, so dart counts are per player
   - Calculate from the closing player's darts vs their rounds thrown
   - Or simply read from the hit notation in the closing throw

**Data structure includes:**
```javascript
{
    // Leg level
    winning_round: 13,        // Round number when game closed
    closeout_darts: 2,        // Darts used in closing round

    // Also on the closing throw
    throws: [
        { round: 13, away: { hit: 'SBx2', marks: 2, closeout_darts: 2, closed_out: true } }
    ]
}
```

**MPR Calculation:**
```javascript
// Correct MPR uses actual darts thrown (including partial closeout)
const mpr = total_marks / (total_darts / 3);
// This is automatically correct if dart count includes partial round
```

### Highlighting in UI
Notable throws should be highlighted with yellow color (`var(--yellow)`) in the throws detail view. The `notable` field on each throw object contains the indicator to display.

---

## RULE 17: MATCH DATA HIERARCHY - SETS vs LEGS

**CRITICAL: Understand the correct hierarchy for match display.**

### Terminology
| Term | Definition |
|------|------------|
| **Match** | Full night of play between two teams |
| **Set** | A grouping of legs between specific player(s) - usually best-of-3 |
| **Leg** | A single game (501, Cricket, etc.) |

### Data Structure
Each "game" in `matchData.games[]` is actually a **LEG** with a `set` property:

```javascript
matchData.games = [
    { set: 1, game_in_set: 1, format: '501', winner: 'home', ... },   // Set 1, Leg 1
    { set: 1, game_in_set: 2, format: 'cricket', winner: 'away', ... }, // Set 1, Leg 2
    { set: 1, game_in_set: 3, format: '501', winner: 'home', ... },   // Set 1, Leg 3
    { set: 2, game_in_set: 1, format: 'cricket', winner: 'home', ... }, // Set 2, Leg 1
    { set: 2, game_in_set: 2, format: 'cricket', winner: 'home', ... }, // Set 2, Leg 2
    // ... more sets
]
```

### UI Display Rules
**The Games tab in match-hub.html must:**
1. **Group games by `set` number** - Don't show each leg as a separate card
2. **Show SET card with aggregated score** - Count home wins vs away wins within that set
3. **Expand to show individual legs** - Each leg shows format, player stats, turn-by-turn

**Example:**
- Set 1 has 3 legs: home won leg 1, away won leg 2, home won leg 3
- SET card shows: "2 - 1" (home won 2 legs, away won 1)
- Expanding shows: Leg 1 (501), Leg 2 (Cricket), Leg 3 (501)

**WRONG:** Each leg as a card showing "1-0" or "0-1" individually
**CORRECT:** Set as a card showing aggregated "2-1" with expandable legs

### Key Fields
| Field | Location | Purpose |
|-------|----------|---------|
| `set` | game object | Which set this leg belongs to (1-9) |
| `game_in_set` | game object | Leg number within the set (1, 2, 3) |
| `winner` | game object | Who won this leg ('home' or 'away') |
| `home_legs_won` | game object | Always 1 or 0 (per leg, not per set) |
| `away_legs_won` | game object | Always 1 or 0 (per leg, not per set) |

### Match-Level Scores
- `matchData.home_score` / `away_score` = Total SETS won (main match score)
- Sum of leg wins = Total LEGS won (secondary stat, shown in parentheses)

---

## RULE 18: CHECKOUT AND DOUBLE-IN CATEGORIES

**CRITICAL: These are the canonical ranges for tracking checkouts and double-ins across the entire system.**

### Checkout Categories (Double-Out)
| Range | Label | Description |
|-------|-------|-------------|
| 60-99 | Standard Out | Common double-out range |
| 100-139 | Ton Out | Checkouts requiring 100+ points |
| 140-160 | Ton-40+ Out | High checkouts, still achievable without bull |
| 161+ | Big Out | **Requires hitting the bull** - special skill |

### Valid 161+ Checkouts
Only 4 possible checkouts at 161+:
- **161** = T20, T17, Bull (or variations)
- **164** = T20, T18, Bull (or variations)
- **167** = T20, T19, Bull (or variations)
- **170** = T20, T20, Bull (maximum checkout)

**Why separate 161+?** These checkouts REQUIRE hitting the bullseye, making them fundamentally different from other high checkouts. It's a specific skill worth tracking separately.

### Double-In Categories
Same ranges apply for double-in tracking (DIDO games):
| Range | Label |
|-------|-------|
| 60-99 | Standard In |
| 100-139 | Ton In |
| 140-160 | Ton-40+ In |
| 161+ | Big In |

### Data Structure
Track **count**, **attempts**, and **percentage** for each range:

```javascript
// In player stats
checkout_ranges: {
    '60_99': { count: 5, attempts: 12, percentage: 41.7 },
    '100_139': { count: 2, attempts: 8, percentage: 25.0 },
    '140_160': { count: 1, attempts: 5, percentage: 20.0 },
    '161_plus': { count: 0, attempts: 2, percentage: 0 }
},
doublein_ranges: {
    '60_99': { count: 3, attempts: 6, percentage: 50.0 },
    '100_139': { count: 1, attempts: 4, percentage: 25.0 },
    '140_160': { count: 0, attempts: 2, percentage: 0 },
    '161_plus': { count: 0, attempts: 1, percentage: 0 }
}
```

### Tracking Attempts
**Attempt** = When a player has that checkout/double-in opportunity (remaining points fall within the range).

For checkouts:
- Track when player is on a checkout in that range (even if they don't hit a double)
- Each visit to that range counts as an attempt
- Successful checkout increments both `count` and `attempts`
- Failed attempt (missed double, busted, etc.) increments only `attempts`

For double-ins:
- In DIDO games, track when player is attempting to double-in with score in range
- Each round attempting to double-in is an attempt
- Successful double-in increments both `count` and `attempts`

### UI Display Requirements
These stats should appear in:
1. **Performance Tab** - Player's checkout/double-in breakdown with percentages
2. **Leaders Tab** - Leaderboards for each checkout range
3. **Counts Tab** - Aggregate counts across the match

### Helper Functions (to be added to stats-helpers.js)
```javascript
function getCheckoutRange(score) {
    if (score >= 161) return '161_plus';
    if (score >= 140) return '140_160';
    if (score >= 100) return '100_139';
    if (score >= 60) return '60_99';
    return null; // Below 60, not tracked in ranges
}

function formatCheckoutRange(rangeKey) {
    const labels = {
        '60_99': '60-99',
        '100_139': '100-139',
        '140_160': '140-160',
        '161_plus': '161+'
    };
    return labels[rangeKey] || rangeKey;
}
```

---

## RULE 19: CRICKET CLOSEOUT CATEGORIES

**Track cricket closeout performance by the number of marks scored on the closing round.**

### Closeout Mark Categories
| Marks | Label | Description |
|-------|-------|-------------|
| 9M | Max Closeout | Perfect closeout (9 marks = maximum possible) |
| 8M | Excellent Closeout | 8 marks on final round |
| 7M | Great Closeout | 7 marks on final round |
| 6M | Good Closeout | 6 marks on final round |
| 5M | Standard Closeout | 5 marks on final round (minimum tracked) |

### Why Track Closeouts?
Unlike X01 where checkout percentage tracks success/failure, cricket closeouts measure *quality* of the closing round. A 9M closeout shows dominance, while a 5M closeout still wins but with less margin.

### Data Structure
Track **count** for each closeout category:

```javascript
// In player stats
cricket_closeouts: {
    '9m': 0,
    '8m': 0,
    '7m': 0,
    '6m': 0,
    '5m': 0
}
```

### Detection Logic
A closeout is identified when:
1. The leg is cricket format
2. It's the final throw of the leg
3. The winning side's throw has marks >= 5

```javascript
// In throw processing
if (isLastThrow && leg.winner === side) {
    const marks = throwData.marks || 0;
    if (marks >= 5 && marks <= 9) {
        playerCricketCloseouts[playerName][`${marks}m`]++;
    }
}
```

### UI Display Requirements
These stats should appear in:
1. **Performance Tab** - Player's closeout breakdown table
2. **Leaders Tab** - "Most 5M+ Closeouts" leaderboard with breakdown
3. **Counts Tab** - Team closeout counts (9M, 8M, 7M, 6M, 5M)

---

## RULE 20: LEG CARD DISPLAY ENHANCEMENTS

**Canonical display elements for leg/game cards showing match results.**

### Cork Indicator (Who Threw First)
Shows which player/team had the cork (threw first in the leg).

**Detection:**
```javascript
const firstThrow = (leg.throws || [])[0];
const homeCork = firstThrow && firstThrow.home && firstThrow.home.player;
const awayCork = firstThrow && firstThrow.away && firstThrow.away.player;
```

**Display:**
- Yellow "C" badge next to the player who threw first
- Positioned in the leg header near the player name

**CSS:**
```css
.cork-badge {
    display: inline-block;
    background: var(--yellow);
    color: var(--bg-dark);
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    vertical-align: middle;
}
```

### Checkout Value Display (X01 Winner)
Shows the checkout score for the winning player in X01 legs.

**Detection:**
```javascript
const lastThrow = (leg.throws || []).slice(-1)[0];
if (homeWon && lastThrow && lastThrow.home?.checkout) {
    checkoutValue = lastThrow.home.score || leg.checkout;
}
```

**Display:**
- Format: `★ OUT: 43`
- Yellow color (`var(--yellow)`)
- Star icon indicates the winner
- Only shown for X01 games (not cricket)

### Cricket Closeout Display (Cricket Winner)
Shows the closeout marks for the winning player in cricket legs.

**Detection:**
```javascript
const lastThrow = (leg.throws || []).slice(-1)[0];
if (homeWon && lastThrow && lastThrow.home?.closed_out) {
    closeoutMarks = lastThrow.home.marks;
}
```

**Display:**
- Format: `★ CLOSED (7M)`
- Yellow color (`var(--yellow)`)
- Star icon indicates the winner
- Shows marks on the closing round (5M-9M)

### Loser's Remaining Score (X01 Only)
Shows how many points the losing player had left when the game ended.

**Detection:**
```javascript
if (homeWon) {
    loserRemaining = lastThrow?.away?.remaining || leg.away_stats?.remaining;
} else {
    loserRemaining = lastThrow?.home?.remaining || leg.home_stats?.remaining;
}
```

**Display:**
- Format: `Left: 32`
- Dim gray color (`var(--text-dim)`)
- Only shown for X01 games (not cricket)
- Positioned on the losing side's info area

### Combined Leg Card Layout
```
┌─────────────────────────────────────────────────┐
│  [C] Player A  ★ OUT: 43  │  2-1  │  Player B   │
│      42.5 avg             │       │  Left: 32   │
└─────────────────────────────────────────────────┘
```

Or for cricket:
```
┌─────────────────────────────────────────────────┐
│  Player A  ★ CLOSED (7M) │  2-1  │  [C] Player B│
│    2.45 mpr              │       │    2.12 mpr  │
└─────────────────────────────────────────────────┘
```

### Usage Locations
These display elements should be used in:
1. **Match Hub - Games Tab** - Individual leg cards within set expansions
2. **Live Scoreboard** - Real-time leg results
3. **Match Reports** - Printable/shareable match summaries
4. **Player Profile** - Recent legs history

### Key Notes
- Cork badge always goes on the player who threw first, regardless of who won
- Winner indicators (★ OUT / ★ CLOSED) only appear for the winning side
- Remaining score only applies to X01 (cricket doesn't have a "remaining" concept)
- All detection relies on `throws` array data being populated

---

## RULE 21: LEAGUE CREATOR FIELD DECISIONS

**Reference for create-league.html field structure and rationale.**

### Cork Rules (3 Separate Fields - Keep All Three)
These are distinct concepts that all need to be configurable:

| Field | Purpose |
|-------|---------|
| **Start Rules** | Determines who throws first each leg (cork every leg, alternate, loser starts, winner starts) |
| **Cork Option Rules** | Who gets to CHOOSE whether to throw first or second at the cork (some prefer throwing second) |
| **Cork Winner Gets** | For Corks Choice legs only - does winner pick game AND start, or just pick game? |

**Change needed:** "Cork Winner Gets" should appear contextually next to legs configured as "Corks Choice" in the Match Format Builder, not as a standalone field in Scoring & Rules.

### Roster Fields
| Field | Meaning |
|-------|---------|
| **Min Players Needed** | Minimum to avoid forfeit or play shorthanded |
| **Max Roster Spots** | Total allowed on roster (difference allows for subs) |

### Fields to Add
1. **Number of Weeks** - Optional override; if nil, calculated from teams + schedule format
2. **Match Frequency** - Weekly, bi-weekly, etc.
3. **Board/Table Count** - Number of dart boards at venue (affects parallel scheduling)
4. **Forfeit Rules** - Grace period minutes, points awarded for forfeit win
5. **Sub Restrictions** - Can fill-ins play for multiple teams per week? Max fill-in appearances per season?
6. **Divisions/Flights** - For larger leagues with skill-based groupings

### Fields to Remove
- **Bye Week Points** - Was in Playoffs section but unclear if this is standard. Remove unless confirmed needed.

### Fields That Are Fine As-Is
- Stats tracking options - assumed to track everything
- Mixed game type per-leg config - necessary for complex formats, only shows when Mixed is selected

### Default Values
- Cork rules should default to sensible presets (e.g., "Cork every leg" for Start Rules)

---

## RULE 22: GAME OPTIONS CONSISTENCY

**Ensure create-league.html, create-tournament.html, and x01.html (scorer) have consistent game options.**

### Current State (All Three Pages)
| Option | create-league | create-tournament | x01.html (scorer) |
|--------|:-------------:|:-----------------:|:-----------------:|
| 501, 301, 701 | ✅ | ✅ | ✅ |
| X01 (Custom) | ✅ | ✅ | ✅ |
| Cricket | ✅ | ✅ | ❌ (separate cricket.html) |
| Corks Choice | ✅ | ✅ (as "Player's Choice") | ✅ |
| Mixed Format | ✅ | ✅ | ✅ |
| Straight/Free In | ✅ | ✅ | ✅ |
| Double In | ✅ | ✅ | ✅ |
| Double Out | ✅ | ✅ | ✅ |
| Straight/Free Out | ✅ | ✅ | ✅ |
| **Master Out** | ✅ | ✅ | ❌ **MISSING** |

### Naming Inconsistency
- create-league & create-tournament use: `straight`, `double`, `master`
- x01.html uses: `free`, `double` (no master)

These mean the same thing but should be standardized to: `straight`, `double`, `master`

### TODO
1. **Add Master Out to x01.html** - Currently if a league is created with Master Out rules, the scorer won't enforce it correctly. Master Out = can finish on double OR triple.
2. **Standardize naming** - Use `straight` everywhere instead of `free`

---

## RULE 23: ONCLICK HANDLER EVENT PARAMETER GOTCHA

**CRITICAL: Never use `event` as an onclick parameter when iterating over data named `event`.**

### The Problem
When iterating over data (like matches or calendar events) using a variable named `event`, passing `event` in an onclick handler creates a conflict:

```javascript
// WRONG - Variable shadowing bug
filteredEvents.forEach((event, idx) => {
    cardEl.innerHTML = `
        <button onclick="toggleCard(${idx}, '${event.id}', event)">
            Click
        </button>
    `;
});

// The `event` in the onclick refers to the JavaScript click Event object,
// NOT your data object. But when the click handler runs, your loop's
// `event` variable is out of scope, causing errors like:
// "TypeError: clickEvent.stopPropagation is not a function"
```

### Solutions

**Option 1: Don't pass the click event (preferred if not needed)**
```javascript
// CORRECT - Remove event parameter entirely
onclick="toggleCard(${idx}, '${event.id}')"
```

**Option 2: Use a different iterator variable name**
```javascript
// CORRECT - Use descriptive name like `match`, `item`, `cardData`
filteredEvents.forEach((match, idx) => {
    cardEl.innerHTML = `
        <button onclick="handleClick(${idx}, '${match.id}', event)">
            Click
        </button>
    `;
});
```

**Option 3: Use addEventListener instead of inline onclick**
```javascript
// CORRECT - Attach listener after creating element
const btn = cardEl.querySelector('.toggle-btn');
btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCard(idx, event.id);  // Closure captures the correct `event`
});
```

### Why This Happens
- In inline `onclick="..."`, JavaScript keywords like `event` have special meaning
- `event` in onclick context refers to the DOM Event object
- Your loop variable `event` is shadowed/overwritten by this builtin
- When the handler runs, JavaScript looks for `event` in the global/Event context

### Common Symptoms
- `TypeError: X.stopPropagation is not a function`
- `TypeError: Cannot read property 'id' of undefined`
- Functions receiving unexpected `MouseEvent` or `PointerEvent` objects

### Best Practice
Use descriptive iterator variable names instead of generic `event`:
- `match` for match data
- `item` for generic items
- `calendarEvent` for calendar events
- `cardData` for card data

---

## RULE 24: DARTCONNECT RTF PARSING

**Location:** `temp/parse-rtf.js` - Core RTF parsing logic
**Import Script:** `temp/import-week1-matches.js` - Converts parsed data to Firestore format

### Key Parsing Challenges

**1. Home/Away Position Varies Per Game**
The RTF "home" and "away" positions do NOT consistently map to the same team across games. **Always use player names** to determine team membership, not the RTF's home/away designation.

```javascript
// WRONG - RTF home/away varies per game
winner = throw.side; // Could be 'home' but player is on away team!

// CORRECT - Map player name to actual team
winner = getTeamForPlayer(throw.player, homeTeam, awayTeam);
```

**2. Team Rosters Required**
Maintain a `TEAM_ROSTERS` mapping for each match to correctly identify which team each player belongs to:

```javascript
const TEAM_ROSTERS = {
    'M. Pagel': ['Matt Pagel', 'Joe Peters', 'John Linden'],
    'D. Pagel': ['Donnie Pagel', 'Christian Ketchem', 'Jenn M', 'Jennifer Malek'],
    'N. Kull': ['Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Stephanie Kull'],
    'K. Yasenchak': ['Kevin Yasenchak', 'Brian Smith', 'Cesar Andino'],
    'D. Partlo': ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
    'E. Olschansky': ['Eddie Olschansky', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzales'],
    'T. Massimiani': ['Tony Massimiani', 'Dominick Russano', 'Dom Russano', 'Chris Benco'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner', 'Derek Fess', 'Josh Kelly'],
    'N. Mezlak': ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U'],
    'D. Russano': ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric']
};
```

**3. Set Numbers May Be Wrong or Duplicated**
Some RTF files have incorrect or duplicate set numbers. If sets appear out of order, use player combinations to reorder:

```javascript
// Expected player order for a match (from user)
const expectedOrder = ['tony/chris', 'dom', 'tony', 'chris/dom', 'chris', 'tony', 'tony/dom', 'chris', 'dom'];

// Reorder parsed games to match expected sequence
games = reorderGames(games, expectedOrder, homeTeam, awayTeam);
```

**4. Game Numbers All Same (e.g., "Game 1.x" format)**
Some RTF files label all games as "Game 1.1", "Game 1.2", etc. Detect and assign sequential numbers:

```javascript
const gameNumbers = parsedGames.map(g => g.gameNumber);
const allSameGameNum = gameNumbers.every(n => n === gameNumbers[0]);
if (allSameGameNum && parsedGames.length > 1) {
    parsedGames.forEach((g, idx) => { g.gameNumber = idx + 1; });
}
```

### Winner Detection

**501 Games:**
1. Check throws for `remaining === 0` (checkout)
2. Fallback: Check if player's total points === 501

**Cricket Games:**
1. Use `leg.winner` from parser (based on final scores in RTF header)
2. Higher final score wins
3. Fallback: Check for `isClosingThrow` marker

### Match Format (Triples League)

- **9 sets per match** (best of 3 legs each)
- **Player combinations**: Singles (1v1) and Doubles (2v2)
- **Each unique player combination plays only once** per match
- **Typical order**: Varies per match, user must provide if RTF is out of order

### Debugging Tips

1. Run `debug-winners.js` or similar to trace winner detection per leg
2. Check player name spelling variations (e.g., "Dom Russano" vs "Dominick Russano")
3. Verify set count matches expected (should be 9 for triples league)
4. Check for missing sets if total is < 9

### Import Process

1. Parse RTF with `parseRTFMatch(rtfPath)`
2. Reorder games if needed (by player pattern)
3. Convert to Firestore format with `convertToFirestoreFormat(games, homeTeam, awayTeam)`
4. POST to `importMatchData` cloud function
5. POST to `updateImportedMatchStats` to update player stats
