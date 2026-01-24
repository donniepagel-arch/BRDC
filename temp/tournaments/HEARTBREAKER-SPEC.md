# MATCHMAKER, HEARTBREAKER — Complete Tournament Specification

## Overview

A Valentine's-themed mixed doubles darts tournament designed for maximum drama, social chaos, and entertainment. Teams can be created, dissolved, and re-formed during the event through the anonymous "Heartbreaker" mechanic.

**Core Philosophy:** Love can flourish... but couples aren't safe. Revenge is possible. Chaos is encouraged.

---

## Tournament Structure

### Format
- **Double Elimination** (two losses = eliminated)
- **Mixed Doubles Only** (1 man + 1 woman per team)
- **Entry:** $10 per player
- **Registration:** Couples or Solo (matched via blind draw)

### Brackets

| Bracket | Game Type | Format | Tone |
|---------|-----------|--------|------|
| **Winners Bracket** | Cricket | Best-of-3 | Cooperative, "love can flourish" |
| **Losers Bracket** | 501 | Best-of-1 | Chaotic, high-stakes, revenge potential |
| **Grand Finals** | Cricket | Best-of-3 | Epic showdown |

---

## Complete Tournament Flow

### Phase 1: Registration & Partner Draw

1. **Registration Opens**
   - Couples register together (locked as team)
   - Solo players enter the Matchmaker Pool
   - System tracks gender for pairing

2. **Partner Draw** (Director-triggered)
   - Solo players randomly matched (opposite gender)
   - All teams announced simultaneously
   - Dramatic reveal on TV Display

### Phase 2: Winners Bracket

3. **WC Round 1**
   - All teams compete
   - Cricket, best-of-3
   - Teams stay together while winning

4. **After Each WC R1 Match Ends**
   - Winners advance to WC R2
   - Losers receive **Heartbreaker Prompt** (20-second delay)
   - Losers enter **Mingle Period**

### Phase 3: The Mingle Period

5. **Heartbreaker Prompt Appears**
   - Shows **Savage Loss Summary** (partner's failures)
   - Lists **Other Losing Teams** (encourages mingling)
   - Offers anonymous **Breakup Opt-In** button
   - Shows **Nudge** feature (signal interest to other losers)

6. **Mingle Activities**
   - Players can physically approach other losing teams
   - Send anonymous **Nudges** through the app
   - Scope out potential new partners
   - No one knows who's opted for breakup

7. **Mingle Period Ends**
   - Triggered when **LAST match of WC Round 2 STARTS**
   - All breakup decisions locked
   - Director runs **Cupid Shuffle**

   > ⚠️ **TIMING NOTE:** Run simulation agents to test bracket pacing. WC Champions should NOT be waiting forever getting stale while LC catches up. The mingle period must be long enough for social interaction but not so long that it kills tournament momentum.

### Phase 4: Cupid Shuffle & Losers Bracket

8. **Cupid Shuffle** (Director-triggered)
   - All breakup opt-ins processed
   - Random re-matching of available players
   - New teams announced dramatically on TV Display
   - Players who didn't opt-in stay together

9. **LC Round 1 Begins**
   - 501, best-of-1 (high stakes, fast games)
   - Win = advance in Losers Bracket
   - Lose = **ELIMINATED** (dunzo, no more chances)

### Phase 5: Bracket Progression

10. **Winners Bracket Continues**
    - WC R2, WC R3, etc. through WC Finals
    - Losers drop to appropriate LC round
    - Heartbreaker prompts after each WC loss
    - Mingle periods between WC rounds

11. **Losers Bracket Continues**
    - Single elimination within LC
    - NO breakup option (you're in survival mode)
    - Second loss = out of tournament

### Phase 6: Grand Finals

12. **Grand Finals**
    - WC Champion vs LC Champion
    - Cricket, best-of-3
    - If LC wins: **Bracket Reset** (must win again)
    - If WC wins: Tournament complete

---

## The Heartbreaker Mechanic

### Trigger Condition
A team loses a match in the **Winners Bracket**.

### The Prompt (appears 20 seconds after loss)

```
┌─────────────────────────────────────────────────────────────────┐
│                    💔 HEARTBREAKER 💔                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Sorry, you lost.                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           😈 SAVAGE LOSS SUMMARY 😈                      │   │
│  │                                                          │   │
│  │  Mike missed 3 darts at D20 to win after you hit 140    │   │
│  │  to set him up. He also missed D16 twice when you       │   │
│  │  left him on 32. Just saying.                           │   │
│  │                                                          │   │
│  │  Your stats: 42.3 avg, 2 tons                           │   │
│  │  Mike's stats: 31.2 avg, 0 tons                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           👀 OTHER HEARTBROKEN TEAMS 👀                  │   │
│  │                                                          │   │
│  │  • Sarah & Tom (Lost to Team Phoenix)                   │   │
│  │  • Jessica & Dave (Lost to Team Thunder)                │   │
│  │  • Amanda & Chris (Lost to Team Lightning)              │   │
│  │                                                          │   │
│  │  Maybe go say hi? See if anyone's... interested?        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │   💔 BREAK UP        │  │   💕 STAY TOGETHER   │            │
│  │   (Anonymous)        │  │                      │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                 │
│  Your choice is completely anonymous. Neither your partner     │
│  nor anyone else will know what you chose.                     │
│                                                                 │
│  ⏰ Mingle period ends when Winners Bracket R2 starts          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Rules

1. **Anonymous Opt-In**
   - Either partner can trigger breakup
   - Only ONE opt-in needed
   - The other partner is NOT notified
   - System NEVER reveals who chose

2. **Breakup Pool**
   - All opted-in players enter the pool
   - Re-matching happens at Cupid Shuffle
   - Not guaranteed a new partner (depends on pool composition)

3. **No Breakups in Losers Bracket**
   - You're in survival mode
   - Lose again = eliminated
   - No second chances

---

## The Nudge Feature

### Purpose
Anonymous interest signals between losing teams during Mingle Period.

### How It Works

1. **View Other Losers**
   - See list of other heartbroken teams
   - Each player shown separately (for potential new match)

2. **Send a Nudge**
   - Tap "Nudge" button next to a player
   - They receive anonymous notification:
   ```
   "Someone from another losing team is interested in partnering with you 👀"
   ```

3. **Nudge Rules**
   - Limited to 3 nudges per mingle period
   - Completely anonymous (no reveal of who nudged)
   - Creates social intrigue and encourages mingling
   - Does NOT guarantee matching (still random at Cupid Shuffle)

### Nudge Notifications

**Sender sees:**
```
"Nudge sent to Sarah. They won't know it was you."
```

**Receiver sees:**
```
"👀 Someone from another losing team just nudged you.
They might be interested in a new partnership.
Go mingle and find out who!"
```

---

## Savage Loss Summary

### Purpose
Playfully highlight partner's failures to fuel the drama and justify breakup consideration.

### Data Points Tracked

**X01 Games:**
- Missed doubles (especially on match-winning attempts)
- Setup throws not capitalized on
- Busts at critical moments
- 3-dart average comparison
- Ton count comparison

**Cricket Games:**
- Missed closes (especially bulls)
- MPR comparison
- Times left partner hanging
- Key numbers where partner struggled

### Example Summaries

**X01 Example:**
```
"Mike missed 3 darts at D20 to win after you hit 140 to set him up.
He also busted from 32 when you'd just hit a ton."
```

**Cricket Example:**
```
"Sarah went 0-for-6 on bulls while you closed 20s, 19s, and 18s.
She left you stranded on the bull for 4 rounds."
```

**Balanced Example (both struggled):**
```
"It wasn't pretty for either of you.
You averaged 29.1, Mike averaged 31.2.
Combined: 4 missed doubles, 0 tons.
Maybe a fresh start would help you both?"
```

### Tone Guidelines
- Playful, not cruel
- Factual (based on real match data)
- Fuel for drama, not personal attacks
- Always offer perspective on both players' performance

---

## TV Display Page

### Purpose
Dramatic visual display for tournament bracket, team reveals, and announcements.

### Technical Specs
- **Resolution:** 1920x1080 (Full HD, landscape)
- **Delivery:** Cast/mirror to TV, Roku, Chromecast
- **URL:** `/pages/matchmaker-tv.html`

### Display Modes

#### 1. Bracket View
```
┌─────────────────────────────────────────────────────────────────┐
│                    MATCHMAKER, HEARTBREAKER                      │
│                    💔 Valentine's Tournament 💔                  │
├───────────────────────────────────────┬─────────────────────────┤
│         WINNERS BRACKET               │    LOSERS BRACKET       │
│                                       │                         │
│   Round 1          Round 2    Finals  │  Round 1       Finals   │
│  ┌───────┐       ┌───────┐  ┌──────┐ │ ┌───────┐    ┌──────┐   │
│  │Team A │──┐    │       │  │      │ │ │       │──┐ │      │   │
│  └───────┘  │    │       │  │      │ │ └───────┘  │ │      │   │
│  ┌───────┐  ├───▶│Team A │─▶│ WC   │ │ ┌───────┐  ├▶│ LC   │   │
│  │Team B │──┘    │       │  │Champ │ │ │       │──┘ │Champ │   │
│  └───────┘       └───────┘  │      │ │ └───────┘    │      │   │
│  ┌───────┐       ┌───────┐  │      │ │ ┌───────┐    │      │   │
│  │Team C │──┐    │       │──┘      │ │ │       │──┐ └──────┘   │
│  └───────┘  │    │       │         │ │ └───────┘  │            │
│  ┌───────┐  ├───▶│Team C │         │ │ ┌───────┐  │            │
│  │Team D │──┘    │       │         │ │ │       │──┘            │
│  └───────┘       └───────┘         │ │ └───────┘               │
├───────────────────────────────────────┴─────────────────────────┤
│                      GRAND FINALS                                │
│                   WC Champion vs LC Champion                     │
│                      ┌───────────────┐                          │
│                      │    ???        │                          │
│                      └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Partner Reveal Mode
Dramatic reveal animation for initial partner draw or Cupid Shuffle results.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    💘 CUPID HAS SPOKEN 💘                       │
│                                                                 │
│              ┌─────────────────────────────────┐                │
│              │                                 │                │
│              │    SARAH        +      MIKE     │                │
│              │                                 │                │
│              │         NEW PARTNERS!           │                │
│              │                                 │                │
│              └─────────────────────────────────┘                │
│                                                                 │
│                    Team Name: [Random Gen]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Match Call Mode
Announce next match with board assignment.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    🎯 NOW PLAYING 🎯                            │
│                                                                 │
│                       BOARD 2                                   │
│                                                                 │
│              TEAM PHOENIX   vs   TEAM THUNDER                   │
│              (Sarah & Mike)      (Jess & Dave)                  │
│                                                                 │
│                  LOSERS BRACKET - ROUND 1                       │
│                       501 - B.O.1                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Heartbreaker Alert Mode
Show when Heartbreaker period is active.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              💔 HEARTBREAKER PERIOD ACTIVE 💔                   │
│                                                                 │
│                 Mingle time remaining: 4:32                     │
│                                                                 │
│              Teams considering their options:                   │
│                                                                 │
│                    Sarah & Mike                                 │
│                    Jessica & Dave                               │
│                    Amanda & Chris                               │
│                    Lauren & Tom                                 │
│                                                                 │
│              Cupid Shuffle coming soon...                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Animation Ideas
- Heartbeat pulse on heartbreak elements
- Cupid arrow animation on reveals
- Confetti burst on champion announcement
- Dramatic "envelope opening" for partner reveals

---

## Director Dashboard Controls

### Match Management
- Start/end matches
- Enter scores
- Override results if needed

### Heartbreaker Controls
- View who's opted for breakup (director only)
- Trigger Cupid Shuffle
- Manually adjust pool if needed
- Force end mingle period

### Display Controls
- Switch TV display modes
- Trigger partner reveals
- Make board calls
- Show bracket updates

### Pool Status
- Current breakup pool count (men/women)
- Nudge activity monitor (anonymized)
- Mingle period timer

---

## Database Structure

### Tournament Document
```javascript
tournaments/{tournamentId}: {
  name: "Matchmaker, Heartbreaker 2025",
  format: "double_elimination",
  entry_type: "mixed_doubles",
  winners_game_type: "cricket",
  winners_best_of: 3,
  losers_game_type: "501",
  losers_best_of: 1,
  breakup_enabled: true,
  mingle_active: false,
  mingle_ends_at: Timestamp,
  status: "in_progress"
}
```

### Teams Collection
```javascript
tournaments/{tournamentId}/teams/{teamId}: {
  name: "Team Phoenix",
  player1_id: "...",
  player2_id: "...",
  is_couple: false,  // Registered together
  formed_at: Timestamp,
  dissolved_at: null,
  bracket: "winners",  // or "losers" or "eliminated"
  current_round: 2
}
```

### Breakup Pool
```javascript
tournaments/{tournamentId}/breakup_pool/{odaterId}: {
  player_id: "...",
  from_team_id: "...",
  opted_at: Timestamp,
  matched: false,
  new_team_id: null
}
```

### Nudges (Anonymous)
```javascript
tournaments/{tournamentId}/nudges/{nudgeId}: {
  from_player_id: "...",  // Never exposed
  to_player_id: "...",
  sent_at: Timestamp,
  round: 1
}
```

### Match Stats (for Savage Summary)
```javascript
tournaments/{tournamentId}/matches/{matchId}: {
  // ... standard match data
  player_stats: {
    [playerId]: {
      three_dart_avg: 42.3,
      tons: 2,
      missed_doubles: [
        { target: "D20", remaining: 40, context: "match_point" },
        { target: "D16", remaining: 32, context: "setup" }
      ],
      checkout_attempts: 5,
      checkout_successes: 0
    }
  }
}
```

---

## Messaging Standards

### Language Rules

**NEVER say:**
- "Your partner chose to leave"
- "Mike opted for breakup"
- "You were dumped"

**ALWAYS frame as:**
- "Random draw results"
- "Cupid's decision"
- "Matchmaker results"
- "Availability and random selection"

### Notification Templates

**After WC Loss:**
```
"Tough luck! You're heading to the Losers Bracket.
Check your app for Heartbreaker options. 💔"
```

**Nudge Received:**
```
"👀 Someone from another losing team just nudged you.
Go mingle and see who's interested in a new partnership!"
```

**Cupid Shuffle Results (New Partner):**
```
"💘 Cupid has spoken!
Your new partner is: Sarah
Team Name: Team Destiny
Good luck in the Losers Bracket!"
```

**Cupid Shuffle Results (Same Partner):**
```
"💕 Cupid kept you together!
You and Mike will continue as partners.
Clearly meant to be... or no one else was available. 😏"
```

**Eliminated:**
```
"😢 Two losses means you're out!
Thanks for playing Matchmaker, Heartbreaker.
Better luck next year!"
```

---

## Edge Cases

### Uneven Gender Counts
- Some players may stay with original partner
- System prioritizes matching opposite genders
- Director can manually adjust if needed

### Only One Team Breaks Up
- If only one player from one team opts in:
  - They stay with current partner
  - No re-matching possible without matching partner

### Late Arrivals
- Added to waitlist at director discretion
- Can enter pool during mingle period if balanced

### Player No-Shows
- Partner can continue solo (forfeit) or request sub
- Director discretion on re-matching

### Couples Who Both Opt In
- Treated same as any breakup
- Both enter pool, may or may not end up together again

---

## Implementation Phases

### Phase 1: Double-Elimination Bracket Engine
- `functions/tournaments/brackets.js` - Generate DE bracket structure
- Losers bracket progression logic
- Grand finals with bracket reset

### Phase 2: Heartbreaker Integration
- Connect breakup flow to bracket advancement
- Mingle period timer
- Cupid Shuffle trigger

### Phase 3: Savage Loss Summary
- Match stat extraction
- Missed double tracking
- Summary text generation

### Phase 4: Nudge System
- Anonymous nudge storage
- Notification delivery
- Rate limiting (3 per period)

### Phase 5: TV Display Page
- Bracket visualization
- Partner reveal animations
- Match call display
- Heartbreaker alert mode

### Phase 6: Real-Time Updates
- WebSocket for live bracket
- Nudge notifications
- Mingle period countdown

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `functions/tournaments/brackets.js` | MODIFY | Add double-elimination generation |
| `functions/tournaments/matches.js` | MODIFY | Handle bracket advancement |
| `functions/matchmaker.js` | MODIFY | Add Heartbreaker preset, nudge system |
| `public/pages/matchmaker-bracket.html` | MODIFY | Real data binding |
| `public/pages/matchmaker-tv.html` | CREATE | TV display page |
| `public/js/matchmaker-heartbreaker.js` | CREATE | Heartbreaker prompt, nudge UI |
| `public/js/savage-summary.js` | CREATE | Generate loss summaries |

---

## Testing Checklist

1. [ ] Register 8 teams (mix of couples and matched singles)
2. [ ] Run partner draw, verify TV reveal
3. [ ] Generate double-elimination bracket
4. [ ] Complete WC Round 1 matches
5. [ ] Verify Heartbreaker prompts appear (20s delay)
6. [ ] Verify savage loss summaries show real stats
7. [ ] Test nudge feature (send, receive, limit)
8. [ ] Verify mingle period ends when last WC R2 match STARTS
9. [ ] Test Cupid Shuffle with various pool compositions
10. [ ] Verify LC advancement (win = advance, lose = eliminated)
11. [ ] Complete tournament through Grand Finals
12. [ ] Test bracket reset if LC champion wins first GF match

---

## Bracket Timing Simulation

### Why This Matters
The WC Champions could be sitting around for ages while the LC catches up. This kills tournament energy. We need to simulate and validate timing.

### Variables to Test
| Variable | Range to Test |
|----------|---------------|
| Number of teams | 8, 12, 16, 24, 32 |
| Average match duration (Cricket BO3) | 15-25 min |
| Average match duration (501 BO1) | 5-10 min |
| Mingle period duration | 5-15 min |
| Cupid Shuffle + reveal time | 3-5 min |

### Simulation Goals
1. **WC Champion wait time < 15-20 min** after winning WC Finals (HARD REQUIREMENT)
2. **LC pacing** should allow breaks but not drag
3. **Mingle period** long enough for social interaction (5-10 min minimum)
4. **Total tournament time** reasonable for a bar event (4-6 hours for 16 teams)

### Simulation Agent Task
```
Run bracket timing simulation for Heartbreaker tournament:
1. Model match durations with realistic variance
2. Track WC Champion idle time
3. Identify bottlenecks in bracket progression
4. Recommend optimal mingle period duration
5. Test with 8, 16, and 24 team brackets
```

### Potential Optimizations
- **Parallel boards**: Run multiple LC matches simultaneously (LIKELY REQUIRED)
- **Staggered starts**: Don't wait for all WC R1 to finish before starting LC R1
- **Dynamic mingle**: Shorten mingle if bracket is running long
- **WC entertainment**: Keep WC Champions engaged (exhibition games, commentary duty)
- **Shorter LC format**: 501 BO1 is already fast (~7 min avg), keep it tight
- **Board count**: Plan for 2-3 boards minimum for 16+ team events

### Critical Timing Math (Back of Napkin)

**Venue: Rookies - 12 BOARDS AVAILABLE** 🎯

**Assumptions:**
- Cricket BO3: ~20 min average
- 501 BO1: ~7 min average
- Cupid Shuffle + reveal: ~5 min
- Mingle period: ~10 min

**With 12 boards, we can run ALL matches in a round simultaneously!**

**16 Team Bracket:**
- WC R1: 8 matches, all at once = 20 min
- WC R2: 4 matches, all at once = 20 min
- WC SF: 2 matches, all at once = 20 min
- WC Finals: 1 match = 20 min
- **WC Champion crowned at: ~80 min**

- LC R1: 4 matches at once (WC R1 losers) = 7 min + mingle/shuffle = 22 min
- LC R2: 4 matches at once = 7 min
- LC SF: 2 matches at once = 7 min
- LC Finals: 1 match = 7 min
- **LC Champion crowned at: ~43 min after LC starts**

**Total timeline:** WC finishes at ~80 min, LC finishes at ~103 min = **WC Champion wait: ~23 min**

**24 Team Bracket:**
- WC R1: 12 matches, all at once = 20 min ✅ (exactly 12 boards!)
- WC R2: 6 matches = 20 min
- WC QF: 3 matches = 20 min (bye for highest seed)
- WC SF: 2 matches = 20 min
- WC Finals: 1 match = 20 min
- **WC Champion crowned at: ~100 min**

- LC R1: 6 matches at once = 7 min
- LC R2: 6 matches at once = 7 min
- LC R3: 3 matches = 7 min
- LC SF: 2 matches = 7 min
- LC Finals: 1 match = 7 min
- **LC Champion crowned at: ~35 min after LC starts**

**Total timeline:** WC ~100 min + LC ~50 min (including mingle) = **WC Champion wait: ~15 min** ✅

**32 Team Bracket:**
- WC R1: 16 matches, run in 2 waves of 8 = 40 min
- (or run 12 + 4 = 20 min + 20 min = 40 min)
- WC R2: 8 matches at once = 20 min
- WC QF: 4 matches = 20 min
- WC SF: 2 matches = 20 min
- WC Finals: 1 match = 20 min
- **WC Champion crowned at: ~120 min**

- LC runs very fast with 12 boards
- **WC Champion wait: ~15-20 min** ✅

### Capacity Sweet Spots
| Teams | Boards Needed | Fits in 12? | WC Champion Wait |
|-------|---------------|-------------|------------------|
| 8 | 4 | ✅ Easy | ~5 min |
| 12 | 6 | ✅ Easy | ~8 min |
| 16 | 8 | ✅ Easy | ~15 min |
| 24 | 12 | ✅ PERFECT | ~15 min |
| 32 | 16 | ⚠️ 2 waves | ~15-20 min |
| 48 | 24 | ⚠️ 2 waves | ~20 min |

**Recommendation:** 24 teams is the sweet spot for 12 boards - every WC R1 match runs simultaneously!

---

**Event Tagline:**
*"Love can flourish... but couples aren't safe. Revenge is possible. Chaos is encouraged."*
