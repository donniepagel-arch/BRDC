# BRDC Field Naming Standards

**Last Updated:** 2026-01-19

This document defines the canonical field names used throughout the BRDC codebase. All new code should follow these standards, and existing code should be migrated to match.

---

## 1. Player Stats Fields

### X01 (501/301) Stats

| Canonical Field | Type | Description | Aliases to Deprecate |
|-----------------|------|-------------|---------------------|
| `x01_three_dart_avg` | number | 3-dart average (3DA) - total points / total darts * 3 | `x01_3da`, `x01_avg`, `three_dart_avg`, `ppd`, `avg` |
| `x01_first_9_avg` | number | First 9 darts average | `x01_first9_avg`, `first_9_avg` |
| `x01_total_points` | number | Total points scored | |
| `x01_total_darts` | number | Total darts thrown | |
| `x01_legs_played` | number | Total legs played | |
| `x01_legs_won` | number | Total legs won | |
| `x01_leg_win_pct` | number | Leg win percentage (0-100) | |
| `x01_tons` | number | Count of 100+ scores | |
| `x01_ton_80` | number | Count of 180s | |
| `x01_high_score` | number | Highest single turn score | |
| `x01_high_checkout` | number | Highest checkout | |
| `x01_avg_checkout` | number | Average checkout | `x01_avg_finish`, `avg_finish` |
| `x01_checkout_pct` | number | Checkout percentage (0-100) | |
| `x01_first9_points` | number | Component: total points in first 9 darts | |
| `x01_first9_darts` | number | Component: count of first-9 opportunities | |

### Cricket Stats

| Canonical Field | Type | Description | Aliases to Deprecate |
|-----------------|------|-------------|---------------------|
| `cricket_mpr` | number | Marks per round | `mpr` (as storage field) |
| `cricket_total_marks` | number | Total marks scored | |
| `cricket_total_rounds` | number | Total rounds played | |
| `cricket_total_darts` | number | Total darts thrown | |
| `cricket_legs_played` | number | Total legs played | |
| `cricket_legs_won` | number | Total legs won | |
| `cricket_leg_win_pct` | number | Leg win percentage (0-100) | |
| `cricket_high_round` | number | Highest marks in single round | `cricket_high_marks` |

### Derived Stats (Calculated, Not Stored)

These are calculated on-demand for display, not stored in the database:

```javascript
// Calculate 3DA from components
const x01_three_dart_avg = x01_total_darts > 0
    ? (x01_total_points / x01_total_darts) * 3
    : null;

// Calculate MPR from components
const cricket_mpr = cricket_total_rounds > 0
    ? cricket_total_marks / cricket_total_rounds
    : null;

// Calculate first 9 avg from components
const x01_first_9_avg = x01_first9_darts > 0
    ? (x01_first9_points / x01_first9_darts) * 3
    : null;
```

---

## 2. Player Identity Fields

| Canonical Field | Type | Where Used | Description |
|-----------------|------|------------|-------------|
| `id` | string | Document ID | Firestore document ID (never stored as field) |
| `player_id` | string | References | When referencing a player from another document |
| `name` | string | Player doc | Full display name (e.g., "Donnie Pagel") |
| `first_name` | string | Player doc | First name component |
| `last_name` | string | Player doc | Last name component |
| `player_name` | string | Stats docs | Denormalized name in stats/match records |
| `pin` | string | Player doc | 8-digit login PIN |
| `phone` | string | Player doc | Phone number (E.164 format) |
| `email` | string | Player doc | Email address |

### Name Usage Rules

1. **Player document**: Store `name`, `first_name`, `last_name`
2. **Stats documents**: Include `player_name` for display without joins
3. **Match records**: Include `player_name` in game/leg data
4. **References**: Use `player_id` to link to player

```javascript
// Player document structure
{
  name: "Donnie Pagel",
  first_name: "Donnie",
  last_name: "Pagel",
  pin: "39638489",
  phone: "+12165551234",
  email: "donnie@example.com"
}

// Stats document structure
{
  player_id: "X2DMb9bP4Q8fy9yr5Fam",
  player_name: "Donnie Pagel",  // Denormalized for display
  x01_three_dart_avg: 52.5,
  cricket_mpr: 2.45
}
```

---

## 3. Team Fields

| Canonical Field | Type | Description | Aliases to Deprecate |
|-----------------|------|-------------|---------------------|
| `team_name` | string | Team display name | `name` (on team docs) |
| `team_id` | string | Reference to team | |
| `captain_id` | string | Player ID of captain | |
| `captain_name` | string | Denormalized captain name | |
| `wins` | number | Match wins | `w` |
| `losses` | number | Match losses | `l` |
| `ties` | number | Match ties | `t` |
| `points` | number | League points | |
| `games_won` | number | Individual games won | |
| `games_lost` | number | Individual games lost | |

### Team Member Structure

Use `player_ids` array for member references, with optional denormalized data:

```javascript
// Team document structure
{
  team_name: "D. Pagel",
  captain_id: "X2DMb9bP4Q8fy9yr5Fam",
  captain_name: "Donnie Pagel",
  player_ids: ["X2DMb9bP4Q8fy9yr5Fam", "abc123", "def456"],
  wins: 1,
  losses: 0,
  ties: 0,
  points: 2,
  games_won: 5,
  games_lost: 2
}
```

### League Player Document

Players in a league are stored in `leagues/{leagueId}/players/{playerId}`:

```javascript
{
  player_id: "X2DMb9bP4Q8fy9yr5Fam",  // Reference to global player
  name: "Donnie Pagel",               // Denormalized
  team_id: "U5ZEAT55xiNM9Otarafx",    // Team assignment
  position: 1,                         // 1=Captain, 2=B, 3=C
  is_captain: true,
  preferred_level: "A"
}
```

---

## 4. Match Fields

| Canonical Field | Type | Description |
|-----------------|------|-------------|
| `match_id` | string | Reference to match |
| `home_team_id` | string | Home team reference |
| `away_team_id` | string | Away team reference |
| `home_team_name` | string | Denormalized home team name |
| `away_team_name` | string | Denormalized away team name |
| `home_score` | number | Home team games won |
| `away_score` | number | Away team games won |
| `winner` | string | "home", "away", or "tie" |
| `status` | string | "scheduled", "in_progress", "completed" |
| `week` | number | League week number |
| `date` | string | Match date (YYYY-MM-DD) |

---

## 5. Bot Fields

Bots use the same stats schema as players, plus:

| Canonical Field | Type | Description |
|-----------------|------|-------------|
| `is_bot` | boolean | Always `true` for bots |
| `difficulty` | string | "easy", "medium", "hard", "expert" |
| `skills.x01_three_dart_avg` | number | Target 3DA for simulation |
| `skills.cricket_mpr` | number | Target MPR for simulation |
| `skills.checkout_pct` | number | Overall checkout percentage |

---

## 6. API Response Format

When returning data via API/cloud functions, use **camelCase** for JSON responses:

| Database Field | API Response Field |
|----------------|-------------------|
| `x01_three_dart_avg` | `x01ThreeDartAvg` or `x01Avg` |
| `cricket_mpr` | `cricketMpr` or `mpr` |
| `player_name` | `playerName` |
| `team_name` | `teamName` |

---

## 7. Frontend Display Helpers

Standard helper functions for reading stats with fallbacks:

```javascript
// Get 3-dart average from any stats object
function get3DA(stats) {
    if (!stats) return null;

    // Try canonical field first
    if (stats.x01_three_dart_avg) return stats.x01_three_dart_avg;

    // Calculate from components
    if (stats.x01_total_darts > 0) {
        return (stats.x01_total_points / stats.x01_total_darts) * 3;
    }

    // Legacy fallbacks
    return stats.x01_3da || stats.x01_avg || stats.three_dart_avg || stats.ppd || null;
}

// Get MPR from any stats object
function getMPR(stats) {
    if (!stats) return null;

    // Try canonical field first
    if (stats.cricket_mpr) return stats.cricket_mpr;

    // Calculate from components
    if (stats.cricket_total_rounds > 0) {
        return stats.cricket_total_marks / stats.cricket_total_rounds;
    }

    // Legacy fallback
    return stats.mpr || null;
}

// Get player name from any object
function getPlayerName(obj) {
    return obj.name || obj.player_name ||
           (obj.first_name && obj.last_name ? `${obj.first_name} ${obj.last_name}` : null) ||
           'Unknown';
}

// Get team name from any object
function getTeamName(obj) {
    return obj.team_name || obj.name || 'Unknown Team';
}

// Format stats for display
function formatStats(stats) {
    const threeDartAvg = get3DA(stats);
    const mpr = getMPR(stats);

    const avgStr = threeDartAvg ? threeDartAvg.toFixed(1) : '-';
    const mprStr = mpr ? mpr.toFixed(2) : '-';

    return `${avgStr} / ${mprStr}`;
}
```

---

## 8. Migration Notes

### Phase 1: Add Helper Functions (No Breaking Changes)
- Add `get3DA()`, `getMPR()`, etc. helper functions
- Update frontend to use helpers instead of direct field access
- Helpers support both old and new field names

### Phase 2: Standardize New Code
- All new code uses canonical field names
- Cloud functions write canonical fields
- Old fields continue to work via helpers

### Phase 3: Data Migration (Future)
- Script to migrate old documents to new field names
- Remove deprecated field fallbacks from helpers
- Clean up legacy code paths

---

## Quick Reference Card

```
STATS:
  3DA:  x01_three_dart_avg  (calc: points/darts*3)
  MPR:  cricket_mpr         (calc: marks/rounds)

NAMES:
  Player doc:  name, first_name, last_name
  Stats doc:   player_name (denormalized)
  Team doc:    team_name

RECORDS:
  wins, losses, ties (full words, always)

TEAM MEMBERS:
  player_ids[]  (array of player IDs)

REFERENCES:
  player_id, team_id, league_id, match_id
```
