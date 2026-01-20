# BRDC Statistics Tracking Guide

**Last Updated:** 2026-01-20

This document defines all statistics tracked in the BRDC system, sourced from DartConnect exports and internal match tracking.

---

## 1. X01 Statistics (501/301)

### Core Averages

| Statistic | Field Name | Description | Source |
|-----------|------------|-------------|--------|
| **3-Dart Average (3DA)** | `x01_three_dart_avg` | Points per 3 darts thrown | Calculated: `(total_points / total_darts) * 3` |
| **First 9 Average** | `x01_first_9_avg` | Average of first 9 darts per leg | Calculated from first 3 turns |
| **Points Per Dart (PPD)** | *derived* | Single dart average | `total_points / total_darts` |

### Checkout Statistics

| Statistic | Field Name | Description | Source |
|-----------|------------|-------------|--------|
| **Checkout Percentage** | `x01_checkout_pct` | % of checkout attempts converted | `checkouts_hit / checkout_attempts * 100` |
| **Average Checkout** | `x01_avg_checkout` | Average finish when checking out | `total_checkout_points / checkouts_hit` |
| **High Checkout** | `x01_high_checkout` | Highest successful checkout | Max of all successful checkouts |
| **Checkouts Hit** | `x01_checkouts_hit` | Total successful checkouts | Count |
| **Checkout Attempts** | `x01_checkout_attempts` | Total attempts at a checkout | Count |

### Checkout Percentage by Range

Track checkout success rates at different difficulty levels:

| Statistic | Field Name | Range | Description |
|-----------|------------|-------|-------------|
| **Easy Checkout %** | `x01_checkout_pct_easy` | 2-40 | Single-dart and simple finishes |
| **Medium Checkout %** | `x01_checkout_pct_medium` | 41-80 | Standard 2-dart finishes |
| **Hard Checkout %** | `x01_checkout_pct_hard` | 81-110 | Challenging setups |
| **Expert Checkout %** | `x01_checkout_pct_expert` | 111-160 | High-level finishes |
| **Bully Checkout %** | `x01_checkout_pct_bully` | 161-170 | Trip-trip-bull finishes (161, 164, 167, 170) |

**Component fields for calculation:**

| Field Name | Description |
|------------|-------------|
| `x01_checkout_attempts_easy` | Attempts on 2-40 |
| `x01_checkout_hits_easy` | Successful checkouts 2-40 |
| `x01_checkout_attempts_medium` | Attempts on 41-80 |
| `x01_checkout_hits_medium` | Successful checkouts 41-80 |
| `x01_checkout_attempts_hard` | Attempts on 81-110 |
| `x01_checkout_hits_hard` | Successful checkouts 81-110 |
| `x01_checkout_attempts_expert` | Attempts on 111-160 |
| `x01_checkout_hits_expert` | Successful checkouts 111-160 |
| `x01_checkout_attempts_bully` | Attempts on 161-170 (T-T-Bull) |
| `x01_checkout_hits_bully` | Successful checkouts 161-170 |

### Ton Counts (High Scores)

| Statistic | Field Name | Description | DartConnect Name |
|-----------|------------|-------------|------------------|
| **180s** | `x01_ton_80` | Count of maximum 180 scores | "180" |
| **171+** | `x01_ton_71_plus` | Scores 171-179 | "171+" |
| **140+** | `x01_ton_40_plus` | Scores 140-170 | "140+" |
| **100+** | `x01_tons` | Scores 100-139 | "100+" |
| **95+** | `x01_95_plus` | Scores 95-99 | "95+" |
| **100+ First Turn** | `x01_tons_first_turn` | 100+ on opening throw of leg | "100+ 1st Turn" |
| **High Score** | `x01_high_score` | Highest single turn | Max |

### Performance Metrics

| Statistic | Field Name | Description | Source |
|-----------|------------|-------------|--------|
| **Low Dart Game** | `x01_low_dart_game` | Fewest darts to complete a leg | Min darts in won leg |
| **Total Darts** | `x01_total_darts` | Total darts thrown | Sum |
| **Total Points** | `x01_total_points` | Total points scored | Sum |
| **Legs Played** | `x01_legs_played` | Total legs played | Count |
| **Legs Won** | `x01_legs_won` | Total legs won | Count |
| **Leg Win %** | `x01_leg_win_pct` | Win percentage | `legs_won / legs_played * 100` |

### First 9 Components (for calculation)

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **First 9 Points** | `x01_first9_points` | Sum of points in first 9 darts |
| **First 9 Count** | `x01_first9_darts` | Number of first-9 opportunities (usually = legs_played * 9) |

### Additional X01 Stats (BRDC Exclusive)

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Best Leg (Darts)** | `x01_best_leg_darts` | Fewest darts to win a leg |
| **9-Dart Finish** | `x01_nine_darters` | Count of 9-dart legs |
| **12-Dart Finish** | `x01_twelve_dart_legs` | Count of 12-dart legs |
| **15-Dart Finish** | `x01_fifteen_dart_legs` | Count of 15-dart legs |
| **Avg Darts Per Leg** | `x01_avg_darts_per_leg` | Average darts when winning | `total_winning_darts / legs_won` |
| **Double Attempts** | `x01_double_attempts` | Total attempts at doubles (for CO%) |
| **Double Hits** | `x01_double_hits` | Successful double hits |
| **Bust Count** | `x01_busts` | Times went over or hit wrong double |
| **Comeback Wins** | `x01_comeback_wins` | Legs won after opponent had checkout |
| **Break of Throw** | `x01_breaks` | Legs won when opponent threw first |
| **Holds** | `x01_holds` | Legs won when you threw first |
| **170 Finishes** | `x01_170_finishes` | Big fish count |
| **3-Dart Combos 100+** | `x01_combos_100_plus` | Count of 3-dart combinations scoring 100+ ending on a double |

### Streaks & Records

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Current Win Streak** | `x01_win_streak_current` | Consecutive legs won |
| **Best Win Streak** | `x01_win_streak_best` | Longest leg win streak |
| **Current Match Streak** | `match_win_streak_current` | Consecutive matches won |
| **Best Match Streak** | `match_win_streak_best` | Longest match win streak |
| **Tons in a Row** | `x01_consecutive_tons_best` | Most consecutive 100+ scores |

---

## 2. Cricket Statistics

### Core Metrics

| Statistic | Field Name | Description | Source |
|-----------|------------|-------------|--------|
| **Marks Per Round (MPR)** | `cricket_mpr` | Average marks per 3-dart round | `total_marks / total_rounds` |
| **Total Marks** | `cricket_total_marks` | Total marks scored | Sum |
| **Total Rounds** | `cricket_total_rounds` | Total rounds played | Count |
| **Total Darts** | `cricket_total_darts` | Total darts thrown | Sum |

### High Mark Rounds

| Statistic | Field Name | Description | DartConnect Name |
|-----------|------------|-------------|------------------|
| **9 Mark Round** | `cricket_9_mark` | Count of 9-mark rounds | "9M" |
| **8 Mark Round** | `cricket_8_mark` | Count of 8-mark rounds | "8M" |
| **7 Mark Round** | `cricket_7_mark` | Count of 7-mark rounds | "7M" |
| **6 Mark Round** | `cricket_6_mark` | Count of 6-mark rounds | "6M" |
| **5+ Mark Rounds** | `cricket_5_mark_plus` | Count of 5+ mark rounds | "5M+" |
| **High Round** | `cricket_high_round` | Highest marks in a single round | Max |

### Special Counts

| Statistic | Field Name | Description | DartConnect Name |
|-----------|------------|-------------|------------------|
| **Bulls Hit** | `cricket_bulls` | Total bullseyes hit | "Bulls" |
| **Triples Hit** | `cricket_triples` | Total triples hit | "Triples" |
| **Hat Tricks** | `cricket_hat_tricks` | 3 triples in one round | "Hat Tricks" |
| **White Horse** | `cricket_white_horse` | Triple on 3 different numbers in one round | "White Horse" |

### Win/Loss

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Legs Played** | `cricket_legs_played` | Total legs played |
| **Legs Won** | `cricket_legs_won` | Total legs won |
| **Leg Win %** | `cricket_leg_win_pct` | Win percentage |

### Additional Cricket Stats (BRDC Exclusive)

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Avg Rounds to Close** | `cricket_avg_rounds_to_close` | Average rounds to close all numbers |
| **Perfect Rounds** | `cricket_perfect_rounds` | Rounds with 9 marks |
| **First Round Avg** | `cricket_first_round_avg` | Average marks on opening round |
| **Points Scored** | `cricket_points_scored` | Total pointing runs |
| **Points Against** | `cricket_points_against` | Points opponent scored on you |
| **Point Differential** | `cricket_point_diff` | Points scored - points against |
| **Closeout %** | `cricket_closeout_pct` | % of legs closed out without opponent hitting bull |
| **Come from Behind Wins** | `cricket_comeback_wins` | Wins when behind 3+ marks |
| **3 Bulls in Round** | `cricket_3_bulls_round` | Count of rounds with 3 bulls |

### Per-Number Statistics (Optional Deep Tracking)

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **20s Hit** | `cricket_20s_marks` | Total marks on 20 |
| **19s Hit** | `cricket_19s_marks` | Total marks on 19 |
| **18s Hit** | `cricket_18s_marks` | Total marks on 18 |
| **17s Hit** | `cricket_17s_marks` | Total marks on 17 |
| **16s Hit** | `cricket_16s_marks` | Total marks on 16 |
| **15s Hit** | `cricket_15s_marks` | Total marks on 15 |
| **Bulls Hit** | `cricket_bulls_marks` | Total marks on bull |

---

## 3. Match-Level Statistics

### Timing

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Match Duration** | `match_duration_minutes` | Total match time in minutes |
| **Average Leg Time** | `avg_leg_time_seconds` | Average time per leg |
| **Game Start** | `started_at` | Timestamp when match started |
| **Game End** | `completed_at` | Timestamp when match ended |

### Results

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Home Score** | `home_score` | Games won by home team/player |
| **Away Score** | `away_score` | Games won by away team/player |
| **Winner** | `winner` | "home", "away", or "tie" |
| **Total Legs** | `total_legs` | Total legs played in match |

---

## 4. Head-to-Head Statistics

Track performance against specific opponents in `players/{id}/head_to_head/{opponentId}`:

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Matches Played** | `h2h_matches_played` | Total matches against this opponent |
| **Matches Won** | `h2h_matches_won` | Matches won vs this opponent |
| **Legs Played** | `h2h_legs_played` | Total legs vs this opponent |
| **Legs Won** | `h2h_legs_won` | Legs won vs this opponent |
| **Your Avg vs Them** | `h2h_your_avg` | Your 3DA when playing them |
| **Their Avg vs You** | `h2h_their_avg` | Their 3DA when playing you |
| **Last Played** | `h2h_last_played` | Timestamp of last matchup |

---

## 5. Comparative & Contextual Stats

### Performance Trends

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Season Avg** | `x01_season_avg` | Average for current season |
| **Last 10 Legs Avg** | `x01_last_10_avg` | Rolling average of last 10 legs |
| **Last 20 Legs Avg** | `x01_last_20_avg` | Rolling average of last 20 legs |
| **Last 100 Legs Avg** | `x01_last_100_avg` | Rolling average of last 100 legs |
| **Career High Avg (Match)** | `x01_career_high_match_avg` | Best single-match average |
| **Career High Avg (Leg)** | `x01_career_high_leg_avg` | Best single-leg average |

### Opponent-Adjusted Stats

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Avg vs Higher Rated** | `x01_avg_vs_higher` | Your avg vs players rated higher |
| **Avg vs Lower Rated** | `x01_avg_vs_lower` | Your avg vs players rated lower |
| **Avg vs Similar** | `x01_avg_vs_similar` | Your avg vs similarly rated players |
| **Opponent Avg Faced** | `x01_opp_avg_faced` | Average of opponents' ratings faced |

### Pressure Stats

| Statistic | Field Name | Description |
|-----------|------------|-------------|
| **Avg in Deciding Legs** | `x01_deciding_leg_avg` | Your 3DA in legs that decide match |
| **Deciding Leg Win %** | `x01_deciding_leg_win_pct` | Win % in deciding legs |
| **Checkout % Under Pressure** | `x01_checkout_pct_pressure` | CO% when opponent is on a finish |
| **Clutch Rating** | `x01_clutch_rating` | Performance in high-pressure situations |

---

## 7. Player Aggregated Statistics

### Stored in `leagues/{id}/aggregated_stats/{playerId}`

```javascript
{
  player_id: "abc123",
  player_name: "Donnie Pagel",

  // X01 Stats
  x01_three_dart_avg: 52.5,
  x01_first_9_avg: 58.2,
  x01_total_points: 15420,
  x01_total_darts: 892,
  x01_legs_played: 24,
  x01_legs_won: 15,
  x01_leg_win_pct: 62.5,
  x01_tons: 42,           // 100+
  x01_ton_40_plus: 18,    // 140+
  x01_ton_80: 3,          // 180s
  x01_high_score: 180,
  x01_high_checkout: 124,
  x01_avg_checkout: 68.5,
  x01_checkout_pct: 35.2,
  x01_checkouts_hit: 15,
  x01_checkout_attempts: 43,
  x01_low_dart_game: 15,

  // First 9 components
  x01_first9_points: 1254,
  x01_first9_darts: 216,  // 24 legs * 9

  // Cricket Stats
  cricket_mpr: 2.45,
  cricket_total_marks: 312,
  cricket_total_rounds: 127,
  cricket_total_darts: 381,
  cricket_legs_played: 18,
  cricket_legs_won: 11,
  cricket_leg_win_pct: 61.1,
  cricket_5_mark_plus: 28,
  cricket_6_mark: 12,
  cricket_7_mark: 5,
  cricket_8_mark: 2,
  cricket_9_mark: 0,
  cricket_high_round: 8,
  cricket_bulls: 45,
  cricket_triples: 89,
  cricket_hat_tricks: 2,

  // Match counts
  matches_played: 8,
  matches_won: 5,
  matches_lost: 3,

  // Timestamps
  last_updated: Timestamp,
  season: "Spring 2026"
}
```

---

## 8. DartConnect Import Mapping

When importing from DartConnect exports, map fields as follows:

### From playerperformance.rtf

| DartConnect Field | BRDC Field |
|-------------------|------------|
| DCA (3-Dart Avg) | `x01_three_dart_avg` |
| First 9 | `x01_first_9_avg` |
| PPD | *calculate from total* |
| Marks | `cricket_total_marks` (per leg) |
| MPR | `cricket_mpr` |
| Winners | `legs_won` |
| Rnds | `cricket_total_rounds` |

### From matchcounts.rtf

| DartConnect Section | BRDC Fields |
|---------------------|-------------|
| Check Out Performance | `x01_checkout_pct`, `x01_avg_checkout`, `x01_high_checkout` |
| 100+ 1st Turn | Track separately if needed |
| 140+ Turn | `x01_ton_40_plus` |
| 180 Turn | `x01_ton_80` |
| 100+ Turn | `x01_tons` |
| 95+ Turn | `x01_95_plus` |
| Cricket 5M+ Turn | `cricket_5_mark_plus` |
| Bulls | `cricket_bulls` |
| Triples | `cricket_triples` |

### From playerpage.rtf (Player Profile)

| DartConnect Field | BRDC Field |
|-------------------|------------|
| DCA | `x01_three_dart_avg` |
| PPR | `cricket_mpr` (points per round = marks per round for standard cricket) |
| All Time / Last 100 / Last 20 | Store with appropriate context |

---

## 9. Leaderboard Categories

Based on DartConnect leaderboards, track rankings for:

### X01 Leaderboards
1. **3-Dart Average** - Overall scoring ability
2. **First 9 Average** - Opening game strength
3. **Checkout %** - Finishing ability
4. **High Checkout** - Best single finish
5. **180 Count** - Maximum scores
6. **140+ Count** - High scores
7. **Low Dart Game** - Efficiency

### Cricket Leaderboards
1. **MPR** - Overall marking ability
2. **High Round** - Best single round
3. **5M+ Rounds** - Consistency of high marks
4. **Hat Tricks** - Triple mastery
5. **Bulls Count** - Bullseye accuracy

### Combined Leaderboards
1. **Leg Win %** - Overall win rate
2. **Matches Won** - Team contribution
3. **Games Won** - Individual games

---

## 10. Display Formatting

### Standard Formats

```javascript
// 3-Dart Average: 1 decimal place
format3DA(52.456) → "52.5"

// MPR: 2 decimal places
formatMPR(2.4567) → "2.46"

// Percentages: 1 decimal place with % symbol
formatPct(35.267) → "35.3%"

// Checkouts: No decimals
formatCheckout(124) → "124"

// Counts: No decimals, with commas for thousands
formatCount(1234) → "1,234"
```

### Compact Display

```javascript
// Player card: "3DA / MPR"
"52.5 / 2.46"

// Match stats: "Avg: X | CO%: Y"
"Avg: 52.5 | CO%: 35%"

// Cricket: "MPR: X | 5M+: Y"
"MPR: 2.46 | 5M+: 28"
```

---

## 11. Statistics Calculation Examples

### Updating Aggregated Stats After a Match

```javascript
// Add new leg stats to player aggregate
function updatePlayerStats(existing, newLegStats, gameType) {
  if (gameType === 'x01') {
    return {
      ...existing,
      x01_total_points: (existing.x01_total_points || 0) + newLegStats.points,
      x01_total_darts: (existing.x01_total_darts || 0) + newLegStats.darts,
      x01_legs_played: (existing.x01_legs_played || 0) + 1,
      x01_legs_won: (existing.x01_legs_won || 0) + (newLegStats.won ? 1 : 0),
      x01_tons: (existing.x01_tons || 0) + newLegStats.tons,
      x01_ton_40_plus: (existing.x01_ton_40_plus || 0) + newLegStats.ton40plus,
      x01_ton_80: (existing.x01_ton_80 || 0) + newLegStats.ton80,
      x01_high_score: Math.max(existing.x01_high_score || 0, newLegStats.highScore),
      x01_high_checkout: Math.max(existing.x01_high_checkout || 0, newLegStats.checkout || 0),
      // Recalculate averages
      x01_three_dart_avg: null, // Calculated on read
      x01_leg_win_pct: null     // Calculated on read
    };
  }
  // Similar for cricket...
}
```

### Reading Stats with Helper Functions

```javascript
// Always use helpers to read stats (handles legacy field names)
const avg = get3DA(playerStats);      // Returns number or null
const mpr = getMPR(playerStats);      // Returns number or null
const f9 = getFirst9Avg(playerStats); // Returns number or null

// Format for display
const display = `${format3DA(playerStats)} / ${formatMPR(playerStats)}`;
```

---

## 12. Data Sources

### Primary Sources
1. **Live Match Scoring** - Real-time data from x01.html and cricket.html scorers
2. **DartConnect Imports** - Historical data from RTF/CSV exports
3. **Manual Entry** - Director-entered results for paper matches

### Import Priority
When multiple sources have data for the same match:
1. Live scoring (most accurate, has dart-by-dart data)
2. DartConnect import (accurate aggregates)
3. Manual entry (basic results only)

---

## 13. Quick Reference

```
X01 STATS:
  3DA            = x01_three_dart_avg       (points/darts*3)
  First 9        = x01_first_9_avg          (first 3 turns avg)
  Checkout %     = x01_checkout_pct         (hits/attempts*100)
  Avg Checkout   = x01_avg_checkout         (total/hits)
  High Finish    = x01_high_checkout
  180s           = x01_ton_80
  140+           = x01_ton_40_plus
  100+           = x01_tons
  100+ 1st Turn  = x01_tons_first_turn
  Best Leg       = x01_best_leg_darts

CHECKOUT BY RANGE:
  Easy (2-40)    = x01_checkout_pct_easy
  Medium (41-80) = x01_checkout_pct_medium
  Hard (81-110)  = x01_checkout_pct_hard
  Expert (111-160) = x01_checkout_pct_expert
  Bully (161-170)  = x01_checkout_pct_bully   (T-T-Bull)

CRICKET STATS:
  MPR            = cricket_mpr              (marks/rounds)
  High Round     = cricket_high_round
  5M+ Rounds     = cricket_5_mark_plus
  Hat Tricks     = cricket_hat_tricks
  White Horse    = cricket_white_horse
  Bulls          = cricket_bulls
  Triples        = cricket_triples

WIN TRACKING:
  Legs Played    = {game}_legs_played
  Legs Won       = {game}_legs_won
  Leg Win %      = {game}_leg_win_pct

STREAKS:
  Win Streak     = x01_win_streak_current / x01_win_streak_best
  Match Streak   = match_win_streak_current / match_win_streak_best

HEAD TO HEAD:
  Stored in      = players/{id}/head_to_head/{opponentId}

PRESSURE STATS:
  Deciding Legs  = x01_deciding_leg_avg / x01_deciding_leg_win_pct
  Clutch Rating  = x01_clutch_rating
```
