# Match Settings Reference

This document defines the canonical field names and values for match/game settings across the BRDC system. The master spec is based on `game-setup.html` and should be used consistently across all pages that create or edit match settings.

## Pages That Use These Settings

| Page | Purpose | Settings Used |
|------|---------|---------------|
| `game-setup.html` | Master spec - individual game setup | All fields |
| `create-league.html` | League creation with default match settings | All fields |
| `create-tournament.html` | Tournament creation with match settings | All fields |
| `league-director.html` | League management and settings editing | All fields |
| `director-dashboard.html` | Tournament management | All fields |

---

## Match Structure Fields

### `game_type`
The type of dart game being played.

| Value | Display Name |
|-------|--------------|
| `501` | 501 |
| `301` | 301 |
| `701` | 701 |
| `x01` | Custom X01 |
| `cricket` | Cricket |
| `corks_choice` | Corks Choice |
| `mixed` | Mixed Format |

### `x01_target`
Custom starting score for X01 games. Only applicable when `game_type` is `x01`.

- **Range**: 101 - 1001
- **Step**: 100
- **Default**: 501

### `legs`
Number of legs per set (or per match if sets = 0).

- **Range**: 1 - 21
- **Default**: 1

### `leg_mode`
How legs are counted toward winning a set.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `best_of` | Best Of | First to win majority of legs wins the set |
| `play_all` | Play All | All legs are played regardless of score |

### `sets`
Number of sets in the match. Set to 0 for legs-only format.

- **Range**: 0 - 11
- **Default**: 0 (legs only)

### `set_mode`
How sets are counted toward winning the match. Only applicable when `sets` > 0.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `best_of` | Best Of | First to win majority of sets wins the match |
| `play_all` | Play All | All sets are played regardless of score |

### `in_rule`
How a player must start scoring in X01 games.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `straight_in` | Straight In | Any dart starts scoring |
| `double_in` | Double In | Must hit a double to begin scoring |

### `out_rule`
How a player must finish an X01 game.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `double_out` | Double Out | Must finish on a double |
| `straight_out` | Straight Out | Any dart can finish the game |
| `master_out` | Master Out | Must finish on a double or triple |

---

## Start/Cork Rules

These fields determine how the first thrower is decided for each game.

### `start_rule`
Determines when and how the starting player is decided.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `cork_every` | Cork Every Game | Players cork (diddle) at the start of every game |
| `alternate_cork` | Alternate After Cork | Cork first game, then alternate who starts |
| `loser_starts` | Loser Starts | Loser of previous game throws first |
| `winner_starts` | Winner Starts | Winner of previous game throws first |
| `select_starter` | Select Starter | Manually select who starts each game |

### `cork_option`
Determines who gets to choose who throws first at the cork.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `alternate_random` | Alternate (Random First) | Alternate cork option, random for first game |
| `random_every` | Random Every Game | Randomly decide cork option each game |
| `home_option` | Home Team Option | Home team always chooses |
| `away_option` | Away Team Option | Away team always chooses |
| `loser_option` | Loser Gets Option | Loser of previous game chooses |
| `winner_option` | Winner Gets Option | Winner of previous game chooses |

### `cork_winner_gets`
For Corks Choice games, what does winning the cork give you? Only applicable when `game_type` is `corks_choice` or `mixed`.

| Value | Display Name | Description |
|-------|--------------|-------------|
| `choose_and_start` | Choose Game & Start | Cork winner picks the game AND throws first |
| `choose_or_start` | Choose Game OR Start | Cork winner picks either the game OR to throw first |

---

## Field Validation Summary

| Field | Type | Required | Range/Values |
|-------|------|----------|--------------|
| `game_type` | string | Yes | See game_type values |
| `x01_target` | number | Only if game_type=x01 | 101-1001, step 100 |
| `legs` | number | Yes | 1-21 |
| `leg_mode` | string | Yes | best_of, play_all |
| `sets` | number | Yes | 0-11 |
| `set_mode` | string | Only if sets > 0 | best_of, play_all |
| `in_rule` | string | Yes for X01 | straight_in, double_in |
| `out_rule` | string | Yes for X01 | double_out, straight_out, master_out |
| `start_rule` | string | Yes | See start_rule values |
| `cork_option` | string | Yes | See cork_option values |
| `cork_winner_gets` | string | Only for corks_choice/mixed | choose_and_start, choose_or_start |

---

## Implementation Notes

1. **Underscore Convention**: All field values use underscores (e.g., `double_out`, not `double-out`)

2. **Conditional Fields**:
   - `x01_target` only shown/required when `game_type` is `x01`
   - `set_mode` only shown/required when `sets` > 0
   - `cork_winner_gets` only shown/required when `game_type` is `corks_choice` or `mixed`
   - `in_rule` and `out_rule` only applicable to X01 game types

3. **Default Values for New Leagues/Tournaments**:
   ```javascript
   {
     game_type: '501',
     legs: 3,
     leg_mode: 'best_of',
     sets: 0,
     in_rule: 'straight_in',
     out_rule: 'double_out',
     start_rule: 'cork_every',
     cork_option: 'alternate_random'
   }
   ```

4. **Database Storage**: All settings should be stored exactly as defined here to ensure consistency across the application.
