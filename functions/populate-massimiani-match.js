/**
 * Populate Massimiani vs Ragnoni Match Data
 * Week 1: Team 4 (T. Massimiani) vs Team 7 (J. Ragnoni)
 *
 * Main Match: 6 games across 3 sets (1-1, 3-0, 2-0)
 * Plus additional singles/doubles sets
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// Match metadata from DartConnect
const massimianRagnoniMetadata = {
    match_date: new Date('2026-01-14'),
    start_time: new Date('2026-01-14T19:33:00'),
    end_time: new Date('2026-01-14T22:01:00'),
    game_time_minutes: 63 + 11 + 25 + 13 + 4 + 7 + 6 + 7 + 6, // All segments
    match_length_minutes: 148,
    total_darts: 542 + 95 + 234 + 97 + 63 + 95 + 33 + 33 + 35, // All segments
    total_games: 17,
    total_sets: 9,
    der: 86
};

// Main match games
const massimianRagnoniGames = [
    // ==========================================
    // SET 1 - Doubles: Massimiani/Benco vs Fess/Tate
    // ==========================================
    // Game 1.1 - 501 SIDO - HOME WIN (DO 1 at round 15)
    {
        set: 1, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Tony Massimiani', 'Chris Benco'], away_players: ['Derek Fess', 'Marc Tate'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 648,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 34.95, darts: 43, points: 501 },
            away_stats: { three_dart_avg: 35.64, darts: 44, points: 499, remaining: 2 },
            player_stats: {
                'Tony Massimiani': { darts: 24, points: 239, three_dart_avg: 29.88 },
                'Chris Benco': { darts: 19, points: 262, three_dart_avg: 41.37 },
                'Derek Fess': { darts: 23, points: 245, three_dart_avg: 31.96 },
                'Marc Tate': { darts: 21, points: 254, three_dart_avg: 36.29 }
            },
            checkout: 4, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', score: 36, remaining: 465 }, away: { player: 'Derek Fess', score: 28, remaining: 473 } },
                { round: 2, home: { player: 'Chris Benco', score: 77, remaining: 388 }, away: { player: 'Marc Tate', score: 60, remaining: 413 } },
                { round: 3, home: { player: 'Tony Massimiani', score: 100, remaining: 288, notable: '100' }, away: { player: 'Derek Fess', score: 15, remaining: 398 } },
                { round: 4, home: { player: 'Chris Benco', score: 140, remaining: 148, notable: '140' }, away: { player: 'Marc Tate', score: 41, remaining: 357 } },
                { round: 5, home: { player: 'Tony Massimiani', score: 24, remaining: 124 }, away: { player: 'Derek Fess', score: 66, remaining: 291 } },
                { round: 6, home: { player: 'Chris Benco', score: 25, remaining: 99 }, away: { player: 'Marc Tate', score: 45, remaining: 246 } },
                { round: 7, home: { player: 'Tony Massimiani', score: 75, remaining: 24 }, away: { player: 'Derek Fess', score: 24, remaining: 222 } },
                { round: 8, home: { player: 'Chris Benco', score: 0, remaining: 24 }, away: { player: 'Marc Tate', score: 60, remaining: 162 } },
                { round: 9, home: { player: 'Tony Massimiani', score: 0, remaining: 24 }, away: { player: 'Derek Fess', score: 42, remaining: 120 } },
                { round: 10, home: { player: 'Chris Benco', score: 10, remaining: 14 }, away: { player: 'Marc Tate', score: 32, remaining: 88 } },
                { round: 11, home: { player: 'Tony Massimiani', score: 0, remaining: 14 }, away: { player: 'Derek Fess', score: 81, remaining: 7 } },
                { round: 12, home: { player: 'Chris Benco', score: 10, remaining: 4 }, away: { player: 'Marc Tate', score: 5, remaining: 2 } },
                { round: 13, home: { player: 'Tony Massimiani', score: 0, remaining: 4 }, away: { player: 'Derek Fess', score: 0, remaining: 2 } },
                { round: 14, home: { player: 'Chris Benco', score: 0, remaining: 4 }, away: { player: 'Marc Tate', score: 0, remaining: 2 } },
                { round: 15, home: { player: 'Tony Massimiani', score: 4, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    // Game 1.2 - Cricket - HOME WIN (403-388)
    {
        set: 1, game_in_set: 2, format: 'cricket',
        home_players: ['Tony Massimiani', 'Chris Benco'], away_players: ['Derek Fess', 'Marc Tate'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 785,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 17, closeout_darts: 2,
            home_stats: { mpr: 2.5, darts: 51, marks: 43, points: 403 },
            away_stats: { mpr: 2.4, darts: 51, marks: 41, points: 388 },
            player_stats: {
                'Tony Massimiani': { darts: 27, marks: 22, mpr: 2.44 },
                'Chris Benco': { darts: 24, marks: 21, mpr: 2.63 },
                'Derek Fess': { darts: 27, marks: 23, mpr: 2.56 },
                'Marc Tate': { darts: 24, marks: 18, mpr: 2.25 }
            },
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', hit: 'T19', marks: 3 }, away: { player: 'Derek Fess', hit: 'T20, S20x2', marks: 5, notable: '5M' } },
                { round: 2, home: { player: 'Chris Benco', hit: 'S17, S19x2', marks: 3, points: 38 }, away: { player: 'Marc Tate', hit: 'S19x2', marks: 2 } },
                { round: 3, home: { player: 'Tony Massimiani', hit: 'S18x2', marks: 2, points: 38 }, away: { player: 'Derek Fess', hit: 'S18, S19', marks: 2, points: 40 } },
                { round: 4, home: { player: 'Chris Benco', hit: 'S18x2', marks: 2, points: 56 }, away: { player: 'Marc Tate', hit: 'S18', marks: 1, points: 40 } },
                { round: 5, home: { player: 'Tony Massimiani', hit: 'T17', marks: 3, points: 73 }, away: { player: 'Derek Fess', hit: 'S20, S18', marks: 2, points: 60 } },
                { round: 6, home: { player: 'Chris Benco', hit: 'T17, S17', marks: 4, points: 141 }, away: { player: 'Marc Tate', hit: 'T20, S20', marks: 4, points: 140 } },
                { round: 7, home: { player: 'Tony Massimiani', hit: 'T17, S17', marks: 4, points: 209 }, away: { player: 'Derek Fess', hit: 'S17, S20x2', marks: 3, points: 180 } },
                { round: 8, home: { player: 'Chris Benco', hit: 'S17x2, S15', marks: 3, points: 243 }, away: { player: 'Marc Tate', hit: 'T20, S20', marks: 4, points: 260 } },
                { round: 9, home: { player: 'Tony Massimiani', hit: 'T20', marks: 3, points: 243 }, away: { player: 'Derek Fess', hit: 'S17x2', marks: 2, points: 260 } },
                { round: 10, home: { player: 'Chris Benco', hit: 'T15, S15', marks: 4, points: 273 }, away: { player: 'Marc Tate', hit: 'S16x2', marks: 2, points: 260 } },
                { round: 11, home: { player: 'Tony Massimiani', hit: '-', marks: 0, points: 273 }, away: { player: 'Derek Fess', hit: 'S16', marks: 1, points: 260 } },
                { round: 12, home: { player: 'Chris Benco', hit: 'S15x2', marks: 2, points: 303 }, away: { player: 'Marc Tate', hit: 'T16', marks: 3, points: 308 } },
                { round: 13, home: { player: 'Tony Massimiani', hit: 'DB', marks: 2, points: 303 }, away: { player: 'Derek Fess', hit: 'T15', marks: 3, points: 308 } },
                { round: 14, home: { player: 'Chris Benco', hit: 'DB', marks: 2, points: 328 }, away: { player: 'Marc Tate', hit: 'S16', marks: 1, points: 324 } },
                { round: 15, home: { player: 'Tony Massimiani', hit: 'DB', marks: 2, points: 378 }, away: { player: 'Derek Fess', hit: 'S16x2', marks: 2, points: 356 } },
                { round: 16, home: { player: 'Chris Benco', hit: 'S16', marks: 1, points: 378 }, away: { player: 'Marc Tate', hit: 'S16', marks: 1, points: 372 } },
                { round: 17, home: { player: 'Tony Massimiani', hit: 'SB, S16x2', marks: 3, points: 403, closeout_darts: 2, closed_out: true }, away: { player: 'Derek Fess', hit: 'S16, SB', marks: 2, points: 388 } }
            ]
        }]
    },

    // ==========================================
    // SET 2 - Singles: Dom Russano vs Josh Kelly
    // ==========================================
    // Game 2.1 - Cricket - AWAY WIN (0-56)
    {
        set: 2, game_in_set: 1, format: 'cricket',
        home_players: ['Dom Russano'], away_players: ['Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 337,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 11, closeout_darts: 1,
            home_stats: { mpr: 1.0, darts: 30, marks: 10, points: 0 },
            away_stats: { mpr: 2.3, darts: 31, marks: 24, points: 56 },
            player_stats: {
                'Dom Russano': { darts: 30, marks: 10, mpr: 1.0 },
                'Josh Kelly': { darts: 31, marks: 24, mpr: 2.32 }
            },
            throws: [
                { round: 1, home: { player: 'Dom Russano', hit: 'S20', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S20x2', marks: 2 } },
                { round: 2, home: { player: 'Dom Russano', hit: '-', marks: 0 }, away: { player: 'Josh Kelly', hit: 'S20x2', marks: 2, points: 20 } },
                { round: 3, home: { player: 'Dom Russano', hit: 'S19', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S19x2', marks: 2 } },
                { round: 4, home: { player: 'Dom Russano', hit: 'S18', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S19, S18', marks: 2 } },
                { round: 5, home: { player: 'Dom Russano', hit: '-', marks: 0 }, away: { player: 'Josh Kelly', hit: 'S18x2, S17', marks: 3 } },
                { round: 6, home: { player: 'Dom Russano', hit: 'S16', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S17x2', marks: 2 } },
                { round: 7, home: { player: 'Dom Russano', hit: 'S17, S15x2', marks: 3 }, away: { player: 'Josh Kelly', hit: 'S16x3', marks: 3 } },
                { round: 8, home: { player: 'Dom Russano', hit: 'S15', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S15x2', marks: 2 } },
                { round: 9, home: { player: 'Dom Russano', hit: 'S20', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S17, S15', marks: 2, points: 37 } },
                { round: 10, home: { player: 'Dom Russano', hit: 'SB', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S19, SB', marks: 2, points: 56 } },
                { round: 11, home: null, away: { player: 'Josh Kelly', hit: 'DB', marks: 2, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },
    // Game 2.2 - Cricket - AWAY WIN (0-114)
    {
        set: 2, game_in_set: 2, format: 'cricket',
        home_players: ['Dom Russano'], away_players: ['Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 418,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 13, closeout_darts: 2,
            home_stats: { mpr: 1.4, darts: 36, marks: 17, points: 0 },
            away_stats: { mpr: 2.1, darts: 38, marks: 27, points: 114 },
            player_stats: {
                'Dom Russano': { darts: 36, marks: 17, mpr: 1.42 },
                'Josh Kelly': { darts: 38, marks: 27, mpr: 2.13 }
            },
            throws: [
                { round: 1, home: { player: 'Dom Russano', hit: 'S20x2', marks: 2 }, away: { player: 'Josh Kelly', hit: 'S20x3', marks: 3 } },
                { round: 2, home: { player: 'Dom Russano', hit: 'D18', marks: 2 }, away: { player: 'Josh Kelly', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 38 } },
                { round: 3, home: { player: 'Dom Russano', hit: 'S18', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S18x2', marks: 2, points: 38 } },
                { round: 4, home: { player: 'Dom Russano', hit: 'D16', marks: 2 }, away: { player: 'Josh Kelly', hit: 'S18, T17, S17', marks: 5, notable: '5M', points: 55 } },
                { round: 5, home: { player: 'Dom Russano', hit: 'S15x3', marks: 3 }, away: { player: 'Josh Kelly', hit: 'S15, T16', marks: 4 } },
                { round: 6, home: { player: 'Dom Russano', hit: 'S17', marks: 1 }, away: { player: 'Josh Kelly', hit: 'S15', marks: 1 } },
                { round: 7, home: { player: 'Dom Russano', hit: '-', marks: 0 }, away: { player: 'Josh Kelly', hit: 'S15', marks: 1 } },
                { round: 8, home: { player: 'Dom Russano', hit: 'T16, S20, S19', marks: 4 }, away: { player: 'Josh Kelly', hit: 'SB', marks: 1 } },
                { round: 9, home: { player: 'Dom Russano', hit: 'S19', marks: 1 }, away: { player: 'Josh Kelly', hit: '-', marks: 0, points: 55 } },
                { round: 10, home: { player: 'Dom Russano', hit: 'SB', marks: 1 }, away: { player: 'Josh Kelly', hit: '-', marks: 0, points: 55 } },
                { round: 11, home: { player: 'Dom Russano', hit: '-', marks: 0 }, away: { player: 'Josh Kelly', hit: 'D17', marks: 2, points: 89 } },
                { round: 12, home: { player: 'Dom Russano', hit: 'SB', marks: 1 }, away: { player: 'Josh Kelly', hit: '-', marks: 0, points: 89 } },
                { round: 13, home: null, away: { player: 'Josh Kelly', hit: 'DB, SB', marks: 3, notable: '3B', points: 114, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 3 - Doubles: Benco/Russano vs Tate/Kelly
    // ==========================================
    // Game 3.1 - 501 SIDO - AWAY WIN (50-0)
    {
        set: 3, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Chris Benco', 'Dom Russano'], away_players: ['Marc Tate', 'Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 384,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 56.38, darts: 24, points: 451, remaining: 50 },
            away_stats: { three_dart_avg: 57.81, darts: 26, points: 501 },
            player_stats: {
                'Chris Benco': { darts: 12, points: 294, three_dart_avg: 73.5 },
                'Dom Russano': { darts: 12, points: 157, three_dart_avg: 39.25 },
                'Marc Tate': { darts: 14, points: 283, three_dart_avg: 60.64 },
                'Josh Kelly': { darts: 12, points: 218, three_dart_avg: 54.5 }
            },
            checkout: 50, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Chris Benco', score: 56, remaining: 445 }, away: { player: 'Marc Tate', score: 83, remaining: 418 } },
                { round: 2, home: { player: 'Dom Russano', score: 45, remaining: 400 }, away: { player: 'Josh Kelly', score: 45, remaining: 373 } },
                { round: 3, home: { player: 'Chris Benco', score: 66, remaining: 334 }, away: { player: 'Marc Tate', score: 26, remaining: 347 } },
                { round: 4, home: { player: 'Dom Russano', score: 22, remaining: 312 }, away: { player: 'Josh Kelly', score: 100, remaining: 247, notable: '100' } },
                { round: 5, home: { player: 'Chris Benco', score: 26, remaining: 286 }, away: { player: 'Marc Tate', score: 55, remaining: 192 } },
                { round: 6, home: { player: 'Dom Russano', score: 25, remaining: 261 }, away: { player: 'Josh Kelly', score: 43, remaining: 149 } },
                { round: 7, home: { player: 'Chris Benco', score: 140, remaining: 121, notable: '140' }, away: { player: 'Marc Tate', score: 59, remaining: 90 } },
                { round: 8, home: { player: 'Dom Russano', score: 71, remaining: 50 }, away: { player: 'Josh Kelly', score: 40, remaining: 50 } },
                { round: 9, home: null, away: { player: 'Marc Tate', score: 50, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },
    // Game 3.2 - Cricket - AWAY WIN (450-479)
    {
        set: 3, game_in_set: 2, format: 'cricket',
        home_players: ['Chris Benco', 'Dom Russano'], away_players: ['Marc Tate', 'Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 1192,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 29, closeout_darts: 1,
            home_stats: { mpr: 1.4, darts: 84, marks: 39, points: 450 },
            away_stats: { mpr: 1.7, darts: 86, marks: 49, points: 479 },
            player_stats: {
                'Chris Benco': { darts: 42, marks: 23, mpr: 1.64 },
                'Dom Russano': { darts: 42, marks: 16, mpr: 1.14 },
                'Marc Tate': { darts: 44, marks: 28, mpr: 1.91 },
                'Josh Kelly': { darts: 42, marks: 21, mpr: 1.5 }
            },
            throws: [
                { round: 1, home: { player: 'Chris Benco', hit: 'T20', marks: 3 }, away: { player: 'Marc Tate', hit: '-', marks: 0 } },
                { round: 2, home: { player: 'Dom Russano', hit: 'S20x2', marks: 2, points: 40 }, away: { player: 'Josh Kelly', hit: 'S19x2', marks: 2 } },
                { round: 3, home: { player: 'Chris Benco', hit: 'S19x2', marks: 2, points: 40 }, away: { player: 'Marc Tate', hit: 'T19', marks: 3, points: 38 } },
                { round: 4, home: { player: 'Dom Russano', hit: '-', marks: 0, points: 40 }, away: { player: 'Josh Kelly', hit: 'S19x3', marks: 3, points: 95 } },
                { round: 5, home: { player: 'Chris Benco', hit: 'T20, S20', marks: 4, points: 120 }, away: { player: 'Marc Tate', hit: 'S19', marks: 1, points: 114 } },
                { round: 6, home: { player: 'Dom Russano', hit: 'S20', marks: 1, points: 140 }, away: { player: 'Josh Kelly', hit: 'S19', marks: 1, points: 133 } },
                { round: 7, home: { player: 'Chris Benco', hit: '-', marks: 0, points: 140 }, away: { player: 'Marc Tate', hit: 'S19', marks: 1, points: 152 } },
                { round: 8, home: { player: 'Dom Russano', hit: 'S20', marks: 1, points: 160 }, away: { player: 'Josh Kelly', hit: 'S19', marks: 1, points: 171 } },
                { round: 9, home: { player: 'Chris Benco', hit: 'S20, S19', marks: 2, points: 180 }, away: { player: 'Marc Tate', hit: 'S20x2', marks: 2, points: 171 } },
                { round: 10, home: { player: 'Dom Russano', hit: 'S20', marks: 1, points: 200 }, away: { player: 'Josh Kelly', hit: 'S18x2', marks: 2, points: 171 } },
                { round: 11, home: { player: 'Chris Benco', hit: 'S20', marks: 1, points: 220 }, away: { player: 'Marc Tate', hit: 'S18', marks: 1, points: 171 } },
                { round: 12, home: { player: 'Dom Russano', hit: 'S18', marks: 1, points: 220 }, away: { player: 'Josh Kelly', hit: 'S18', marks: 1, points: 189 } },
                { round: 13, home: { player: 'Chris Benco', hit: 'D18, S17', marks: 3, points: 220 }, away: { player: 'Marc Tate', hit: 'S18', marks: 1, points: 207 } },
                { round: 14, home: { player: 'Dom Russano', hit: 'S17', marks: 1, points: 220 }, away: { player: 'Josh Kelly', hit: 'S17x2', marks: 2, points: 207 } },
                { round: 15, home: { player: 'Chris Benco', hit: 'S20, S17, S16', marks: 3, points: 240 }, away: { player: 'Marc Tate', hit: 'S17x2', marks: 2, points: 224 } },
                { round: 16, home: { player: 'Dom Russano', hit: 'S16x2, S20', marks: 3, points: 260 }, away: { player: 'Josh Kelly', hit: 'S16x3', marks: 3, points: 224 } },
                { round: 17, home: { player: 'Chris Benco', hit: 'S20', marks: 1, points: 280 }, away: { player: 'Marc Tate', hit: 'T15, S15x2', marks: 5, notable: '5M', points: 254 } },
                { round: 18, home: { player: 'Dom Russano', hit: 'S15, S20', marks: 2, points: 300 }, away: { player: 'Josh Kelly', hit: 'S15', marks: 1, points: 269 } },
                { round: 19, home: { player: 'Chris Benco', hit: '-', marks: 0, points: 300 }, away: { player: 'Marc Tate', hit: 'S15', marks: 1, points: 284 } },
                { round: 20, home: { player: 'Dom Russano', hit: '-', marks: 0, points: 300 }, away: { player: 'Josh Kelly', hit: 'S15x2', marks: 2, points: 314 } },
                { round: 21, home: { player: 'Chris Benco', hit: '-', marks: 0, points: 300 }, away: { player: 'Marc Tate', hit: 'T20', marks: 3, points: 314 } },
                { round: 22, home: { player: 'Dom Russano', hit: '-', marks: 0, points: 300 }, away: { player: 'Josh Kelly', hit: 'S15', marks: 1, points: 329 } },
                { round: 23, home: { player: 'Chris Benco', hit: 'SB', marks: 1, points: 300 }, away: { player: 'Marc Tate', hit: 'S15', marks: 1, points: 344 } },
                { round: 24, home: { player: 'Dom Russano', hit: 'SBx2, DB', marks: 4, notable: '4B', points: 350 }, away: { player: 'Josh Kelly', hit: 'SB', marks: 1, points: 344 } },
                { round: 25, home: { player: 'Chris Benco', hit: 'SBx2', marks: 2, points: 400 }, away: { player: 'Marc Tate', hit: 'T15', marks: 3, points: 389 } },
                { round: 26, home: { player: 'Dom Russano', hit: '-', marks: 0, points: 400 }, away: { player: 'Josh Kelly', hit: 'S15x2', marks: 2, points: 419 } },
                { round: 27, home: { player: 'Chris Benco', hit: 'DB', marks: 2, points: 450 }, away: { player: 'Marc Tate', hit: 'S15', marks: 1, points: 434 } },
                { round: 28, home: { player: 'Dom Russano', hit: '-', marks: 0, points: 450 }, away: { player: 'Josh Kelly', hit: 'S15x3', marks: 3, points: 479 } },
                { round: 29, home: null, away: { player: 'Marc Tate', hit: 'DB', marks: 2, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 4 - Singles: Chris Benco vs Marc Tate (Cricket x2)
    // ==========================================
    // Game 4.1 - Cricket - AWAY WIN (0-92)
    {
        set: 4, game_in_set: 1, format: 'cricket',
        home_players: ['Chris Benco'], away_players: ['Marc Tate'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 385,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 10, closeout_darts: 1,
            home_stats: { mpr: 2.0, darts: 27, marks: 18, points: 0 },
            away_stats: { mpr: 2.7, darts: 29, marks: 26, points: 92 },
            player_stats: {
                'Chris Benco': { darts: 27, marks: 18, mpr: 2.0 },
                'Marc Tate': { darts: 29, marks: 26, mpr: 2.69 }
            },
            throws: [
                { round: 1, home: { player: 'Chris Benco', hit: 'S20x2', marks: 2 }, away: { player: 'Marc Tate', hit: 'S20, S18', marks: 2 } },
                { round: 2, home: { player: 'Chris Benco', hit: 'T18', marks: 3 }, away: { player: 'Marc Tate', hit: 'S20x2', marks: 2 } },
                { round: 3, home: { player: 'Chris Benco', hit: 'S20', marks: 1 }, away: { player: 'Marc Tate', hit: 'T20', marks: 3, points: 60 } },
                { round: 4, home: { player: 'Chris Benco', hit: 'S19', marks: 1 }, away: { player: 'Marc Tate', hit: 'S18x2, S19', marks: 3, points: 60 } },
                { round: 5, home: { player: 'Chris Benco', hit: 'S19x2', marks: 2 }, away: { player: 'Marc Tate', hit: 'S19', marks: 1, points: 60 } },
                { round: 6, home: { player: 'Chris Benco', hit: 'T17', marks: 3 }, away: { player: 'Marc Tate', hit: 'S19', marks: 1, points: 60 } },
                { round: 7, home: { player: 'Chris Benco', hit: 'S16', marks: 1 }, away: { player: 'Marc Tate', hit: 'T17, S16', marks: 4, points: 60 } },
                { round: 8, home: { player: 'Chris Benco', hit: 'S15x2', marks: 2 }, away: { player: 'Marc Tate', hit: 'S16, T16, S15', marks: 5, notable: '5M', points: 92 } },
                { round: 9, home: { player: 'Chris Benco', hit: 'SBx2, S15', marks: 3 }, away: { player: 'Marc Tate', hit: 'S15x2, SB', marks: 3, points: 92 } },
                { round: 10, home: null, away: { player: 'Marc Tate', hit: 'DB', marks: 2, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },
    // Game 4.2 - Cricket - AWAY WIN (54-96)
    {
        set: 4, game_in_set: 2, format: 'cricket',
        home_players: ['Chris Benco'], away_players: ['Marc Tate'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 282,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 7, closeout_darts: 2,
            home_stats: { mpr: 1.5, darts: 18, marks: 9, points: 54 },
            away_stats: { mpr: 3.7, darts: 21, marks: 26, points: 96 },
            player_stats: {
                'Chris Benco': { darts: 18, marks: 9, mpr: 1.5 },
                'Marc Tate': { darts: 21, marks: 26, mpr: 3.71 }
            },
            throws: [
                { round: 1, home: { player: 'Chris Benco', hit: 'S20, S18', marks: 2 }, away: { player: 'Marc Tate', hit: 'S20x2', marks: 2 } },
                { round: 2, home: { player: 'Chris Benco', hit: 'S18x3', marks: 3, points: 18 }, away: { player: 'Marc Tate', hit: 'T20, T19, T17', marks: 9, notable: '9M', points: 40 } },
                { round: 3, home: { player: 'Chris Benco', hit: 'S18x2', marks: 2, points: 54 }, away: { player: 'Marc Tate', hit: 'S18, S20', marks: 2, points: 60 } },
                { round: 4, home: { player: 'Chris Benco', hit: 'S16', marks: 1, points: 54 }, away: { player: 'Marc Tate', hit: 'T18, T15, S16', marks: 6, notable: '6M', points: 60 } },
                { round: 5, home: { player: 'Chris Benco', hit: 'S16', marks: 1, points: 54 }, away: { player: 'Marc Tate', hit: 'S20', marks: 1, points: 80 } },
                { round: 6, home: { player: 'Chris Benco', hit: '-', marks: 0, points: 54 }, away: { player: 'Marc Tate', hit: 'T16', marks: 3, points: 96 } },
                { round: 7, home: null, away: { player: 'Marc Tate', hit: 'DB, SB', marks: 3, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 5 - Singles: Tony Massimiani vs Derek Fess (Cricket x2)
    // ==========================================
    // Game 5.1 - Cricket - AWAY WIN (183-190)
    {
        set: 5, game_in_set: 1, format: 'cricket',
        home_players: ['Tony Massimiani'], away_players: ['Derek Fess'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 265,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 8, closeout_darts: 3,
            home_stats: { mpr: 2.8, darts: 22, marks: 21, points: 183 },
            away_stats: { mpr: 4.2, darts: 22, marks: 31, points: 190 },
            player_stats: {
                'Tony Massimiani': { darts: 22, marks: 21, mpr: 2.86 },
                'Derek Fess': { darts: 22, marks: 31, mpr: 4.23 }
            },
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', hit: 'S20x2', marks: 2 }, away: { player: 'Derek Fess', hit: 'T20x2', marks: 6, notable: '6M', points: 60 } },
                { round: 2, home: { player: 'Tony Massimiani', hit: 'T19x2', marks: 6, notable: '6M', points: 57 }, away: { player: 'Derek Fess', hit: 'S19x2, T20', marks: 5, notable: '5M', points: 120 } },
                { round: 3, home: { player: 'Tony Massimiani', hit: 'S20, T19, S19', marks: 5, notable: '5M', points: 133 }, away: { player: 'Derek Fess', hit: 'S18, S19', marks: 2, points: 120 } },
                { round: 4, home: { player: 'Tony Massimiani', hit: '-', marks: 0, points: 133 }, away: { player: 'Derek Fess', hit: 'T18, T17', marks: 6, notable: '6M', points: 138 } },
                { round: 5, home: { player: 'Tony Massimiani', hit: 'S16x2', marks: 2, points: 133 }, away: { player: 'Derek Fess', hit: 'T16, T15, S16', marks: 7, notable: '7M', points: 154 } },
                { round: 6, home: { player: 'Tony Massimiani', hit: 'DB, S15', marks: 3, points: 133 }, away: { player: 'Derek Fess', hit: 'S18x2, SB', marks: 3, points: 190 } },
                { round: 7, home: { player: 'Tony Massimiani', hit: 'S17, SB', marks: 2, points: 133 }, away: { player: 'Derek Fess', hit: 'SB', marks: 1, points: 190 } },
                { round: 8, home: { player: 'Tony Massimiani', hit: 'SBx2', marks: 2, points: 183 }, away: { player: 'Derek Fess', hit: 'SB', marks: 1, closeout_darts: 3, closed_out: true } }
            ]
        }]
    },
    // Game 5.2 - Cricket - AWAY WIN (259-273)
    {
        set: 5, game_in_set: 2, format: 'cricket',
        home_players: ['Tony Massimiani'], away_players: ['Derek Fess'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 423,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 14, closeout_darts: 2,
            home_stats: { mpr: 2.2, darts: 41, marks: 30, points: 259 },
            away_stats: { mpr: 2.7, darts: 41, marks: 37, points: 273 },
            player_stats: {
                'Tony Massimiani': { darts: 41, marks: 30, mpr: 2.2 },
                'Derek Fess': { darts: 41, marks: 37, mpr: 2.71 }
            },
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', hit: 'T20, S20', marks: 4 }, away: { player: 'Derek Fess', hit: 'S19, S20', marks: 2 } },
                { round: 2, home: { player: 'Tony Massimiani', hit: 'T19, S19', marks: 4, points: 39 }, away: { player: 'Derek Fess', hit: 'T18', marks: 3 } },
                { round: 3, home: { player: 'Tony Massimiani', hit: 'S18', marks: 1, points: 39 }, away: { player: 'Derek Fess', hit: 'S18x2', marks: 2, points: 36 } },
                { round: 4, home: { player: 'Tony Massimiani', hit: 'S18x2', marks: 2, points: 39 }, away: { player: 'Derek Fess', hit: 'T17, S17x2', marks: 5, notable: '5M', points: 70 } },
                { round: 5, home: { player: 'Tony Massimiani', hit: 'T20, S17x2', marks: 5, notable: '5M', points: 99 }, away: { player: 'Derek Fess', hit: 'S17x2', marks: 2, points: 104 } },
                { round: 6, home: { player: 'Tony Massimiani', hit: 'S17', marks: 1, points: 99 }, away: { player: 'Derek Fess', hit: 'S19x2', marks: 2, points: 104 } },
                { round: 7, home: { player: 'Tony Massimiani', hit: 'T20', marks: 3, points: 159 }, away: { player: 'Derek Fess', hit: 'T16', marks: 3, points: 104 } },
                { round: 8, home: { player: 'Tony Massimiani', hit: '-', marks: 0, points: 159 }, away: { player: 'Derek Fess', hit: 'T16, S16x2', marks: 5, notable: '5M', points: 184 } },
                { round: 9, home: { player: 'Tony Massimiani', hit: 'T20, S20', marks: 4, points: 239 }, away: { player: 'Derek Fess', hit: 'T16, S16', marks: 4, points: 248 } },
                { round: 10, home: { player: 'Tony Massimiani', hit: 'S20, T16', marks: 4, points: 259 }, away: { player: 'Derek Fess', hit: 'S20x2', marks: 2, points: 248 } },
                { round: 11, home: { player: 'Tony Massimiani', hit: 'S15', marks: 1, points: 259 }, away: { player: 'Derek Fess', hit: 'S15', marks: 1, points: 248 } },
                { round: 12, home: { player: 'Tony Massimiani', hit: 'S15', marks: 1, points: 259 }, away: { player: 'Derek Fess', hit: 'S15x2', marks: 2, points: 248 } },
                { round: 13, home: { player: 'Tony Massimiani', hit: 'S15', marks: 1, points: 259 }, away: { player: 'Derek Fess', hit: 'DB', marks: 2, points: 248 } },
                { round: 14, home: { player: 'Tony Massimiani', hit: '-', marks: 0, points: 259 }, away: { player: 'Derek Fess', hit: 'SBx2', marks: 2, points: 273, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 6 - Singles: Tony Massimiani vs Derek Fess (501 x2)
    // ==========================================
    // Game 6.1 - 501 SIDO - AWAY WIN (10-0)
    {
        set: 6, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Tony Massimiani'], away_players: ['Derek Fess'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 413,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 44.64, darts: 32, points: 476, remaining: 25 },
            away_stats: { three_dart_avg: 45.55, darts: 33, points: 501 },
            player_stats: {
                'Tony Massimiani': { darts: 32, points: 476, three_dart_avg: 44.63 },
                'Derek Fess': { darts: 33, points: 501, three_dart_avg: 45.55 }
            },
            checkout: 4, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', score: 85, remaining: 416 }, away: { player: 'Derek Fess', score: 45, remaining: 456 } },
                { round: 2, home: { player: 'Tony Massimiani', score: 45, remaining: 371 }, away: { player: 'Derek Fess', score: 81, remaining: 375 } },
                { round: 3, home: { player: 'Tony Massimiani', score: 100, remaining: 271, notable: '100' }, away: { player: 'Derek Fess', score: 66, remaining: 309 } },
                { round: 4, home: { player: 'Tony Massimiani', score: 95, remaining: 176, notable: '95' }, away: { player: 'Derek Fess', score: 81, remaining: 228 } },
                { round: 5, home: { player: 'Tony Massimiani', score: 125, remaining: 51, notable: '125' }, away: { player: 'Derek Fess', score: 59, remaining: 169 } },
                { round: 6, home: { player: 'Tony Massimiani', score: 11, remaining: 40 }, away: { player: 'Derek Fess', score: 7, remaining: 162 } },
                { round: 7, home: { player: 'Tony Massimiani', score: 0, remaining: 40 }, away: { player: 'Derek Fess', score: 60, remaining: 102 } },
                { round: 8, home: { player: 'Tony Massimiani', score: 0, remaining: 40 }, away: { player: 'Derek Fess', score: 76, remaining: 26 } },
                { round: 9, home: { player: 'Tony Massimiani', score: 0, remaining: 40 }, away: { player: 'Derek Fess', score: 16, remaining: 10 } },
                { round: 10, home: { player: 'Tony Massimiani', score: 20, remaining: 20 }, away: { player: 'Derek Fess', score: 6, remaining: 4 } },
                { round: 11, home: { player: 'Tony Massimiani', score: 10, remaining: 10 }, away: { player: 'Derek Fess', score: 4, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    // Game 6.2 - 501 SIDO - AWAY WIN (10-0)
    {
        set: 6, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Tony Massimiani'], away_players: ['Derek Fess'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 386,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 49.10, darts: 30, points: 491, remaining: 10 },
            away_stats: { three_dart_avg: 46.97, darts: 32, points: 501 },
            player_stats: {
                'Tony Massimiani': { darts: 30, points: 491, three_dart_avg: 49.1 },
                'Derek Fess': { darts: 32, points: 501, three_dart_avg: 46.97 }
            },
            checkout: 2, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Tony Massimiani', score: 7, remaining: 494 }, away: { player: 'Derek Fess', score: 68, remaining: 433 } },
                { round: 2, home: { player: 'Tony Massimiani', score: 41, remaining: 453 }, away: { player: 'Derek Fess', score: 123, remaining: 310, notable: '123' } },
                { round: 3, home: { player: 'Tony Massimiani', score: 31, remaining: 422 }, away: { player: 'Derek Fess', score: 81, remaining: 229 } },
                { round: 4, home: { player: 'Tony Massimiani', score: 60, remaining: 362 }, away: { player: 'Derek Fess', score: 43, remaining: 186 } },
                { round: 5, home: { player: 'Tony Massimiani', score: 30, remaining: 332 }, away: { player: 'Derek Fess', score: 24, remaining: 162 } },
                { round: 6, home: { player: 'Tony Massimiani', score: 100, remaining: 232, notable: '100' }, away: { player: 'Derek Fess', score: 19, remaining: 143 } },
                { round: 7, home: { player: 'Tony Massimiani', score: 45, remaining: 187 }, away: { player: 'Derek Fess', score: 97, remaining: 46, notable: '97' } },
                { round: 8, home: { player: 'Tony Massimiani', score: 80, remaining: 107 }, away: { player: 'Derek Fess', score: 37, remaining: 9 } },
                { round: 9, home: { player: 'Tony Massimiani', score: 87, remaining: 20 }, away: { player: 'Derek Fess', score: 6, remaining: 3 } },
                { round: 10, home: { player: 'Tony Massimiani', score: 10, remaining: 10 }, away: { player: 'Derek Fess', score: 1, remaining: 2 } },
                { round: 11, home: null, away: { player: 'Derek Fess', score: 2, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },

    // ==========================================
    // SET 7 - Singles: Dom Russano vs Josh Kelly (501 x3)
    // ==========================================
    // Game 7.1 - 501 SIDO - AWAY WIN (60-0)
    {
        set: 7, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dom Russano'], away_players: ['Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 432,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 40.09, darts: 33, points: 441, remaining: 60 },
            away_stats: { three_dart_avg: 44.21, darts: 34, points: 501 },
            player_stats: {
                'Dom Russano': { darts: 33, points: 441, three_dart_avg: 40.09 },
                'Josh Kelly': { darts: 34, points: 501, three_dart_avg: 44.21 }
            },
            checkout: 4, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Dom Russano', score: 60, remaining: 441 }, away: { player: 'Josh Kelly', score: 64, remaining: 437 } },
                { round: 2, home: { player: 'Dom Russano', score: 21, remaining: 420 }, away: { player: 'Josh Kelly', score: 76, remaining: 361 } },
                { round: 3, home: { player: 'Dom Russano', score: 90, remaining: 330 }, away: { player: 'Josh Kelly', score: 57, remaining: 304 } },
                { round: 4, home: { player: 'Dom Russano', score: 26, remaining: 304 }, away: { player: 'Josh Kelly', score: 41, remaining: 263 } },
                { round: 5, home: { player: 'Dom Russano', score: 11, remaining: 293 }, away: { player: 'Josh Kelly', score: 60, remaining: 203 } },
                { round: 6, home: { player: 'Dom Russano', score: 25, remaining: 268 }, away: { player: 'Josh Kelly', score: 41, remaining: 162 } },
                { round: 7, home: { player: 'Dom Russano', score: 25, remaining: 243 }, away: { player: 'Josh Kelly', score: 40, remaining: 122 } },
                { round: 8, home: { player: 'Dom Russano', score: 98, remaining: 145, notable: '98' }, away: { player: 'Josh Kelly', score: 100, remaining: 22, notable: '100' } },
                { round: 9, home: { player: 'Dom Russano', score: 22, remaining: 123 }, away: { player: 'Josh Kelly', score: 14, remaining: 8 } },
                { round: 10, home: { player: 'Dom Russano', score: 26, remaining: 97 }, away: { player: 'Josh Kelly', score: 0, remaining: 8 } },
                { round: 11, home: { player: 'Dom Russano', score: 37, remaining: 60 }, away: { player: 'Josh Kelly', score: 4, remaining: 4 } },
                { round: 12, home: null, away: { player: 'Josh Kelly', score: 4, remaining: 0, checkout: true, checkout_darts: 1 } }
            ]
        }]
    },
    // Game 7.2 - 501 SIDO - HOME WIN (0-6)
    {
        set: 7, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dom Russano'], away_players: ['Josh Kelly'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 356,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 45.55, darts: 33, points: 501 },
            away_stats: { three_dart_avg: 45.0, darts: 33, points: 495, remaining: 6 },
            player_stats: {
                'Dom Russano': { darts: 33, points: 501, three_dart_avg: 45.55 },
                'Josh Kelly': { darts: 33, points: 495, three_dart_avg: 45.0 }
            },
            checkout: 74, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Dom Russano', score: 30, remaining: 471 }, away: { player: 'Josh Kelly', score: 95, remaining: 406, notable: '95' } },
                { round: 2, home: { player: 'Dom Russano', score: 41, remaining: 430 }, away: { player: 'Josh Kelly', score: 95, remaining: 311, notable: '95' } },
                { round: 3, home: { player: 'Dom Russano', score: 44, remaining: 386 }, away: { player: 'Josh Kelly', score: 82, remaining: 229 } },
                { round: 4, home: { player: 'Dom Russano', score: 21, remaining: 365 }, away: { player: 'Josh Kelly', score: 57, remaining: 172 } },
                { round: 5, home: { player: 'Dom Russano', score: 28, remaining: 337 }, away: { player: 'Josh Kelly', score: 57, remaining: 115 } },
                { round: 6, home: { player: 'Dom Russano', score: 27, remaining: 310 }, away: { player: 'Josh Kelly', score: 45, remaining: 70 } },
                { round: 7, home: { player: 'Dom Russano', score: 43, remaining: 267 }, away: { player: 'Josh Kelly', score: 57, remaining: 13 } },
                { round: 8, home: { player: 'Dom Russano', score: 80, remaining: 187 }, away: { player: 'Josh Kelly', score: 1, remaining: 12 } },
                { round: 9, home: { player: 'Dom Russano', score: 78, remaining: 109 }, away: { player: 'Josh Kelly', score: 0, remaining: 12 } },
                { round: 10, home: { player: 'Dom Russano', score: 35, remaining: 74 }, away: { player: 'Josh Kelly', score: 0, remaining: 12 } },
                { round: 11, home: { player: 'Dom Russano', score: 74, remaining: 0, checkout: true, checkout_darts: 3 }, away: { player: 'Josh Kelly', score: 6, remaining: 6 } }
            ]
        }]
    },
    // Game 7.3 - 501 SIDO - AWAY WIN (4-0)
    {
        set: 7, game_in_set: 3, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dom Russano'], away_players: ['Josh Kelly'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 389,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 41.42, darts: 35, points: 483, remaining: 18 },
            away_stats: { three_dart_avg: 42.94, darts: 35, points: 501 },
            player_stats: {
                'Dom Russano': { darts: 35, points: 483, three_dart_avg: 41.42 },
                'Josh Kelly': { darts: 35, points: 501, three_dart_avg: 42.94 }
            },
            checkout: 30, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Dom Russano', score: 76, remaining: 425 }, away: { player: 'Josh Kelly', score: 45, remaining: 456 } },
                { round: 2, home: { player: 'Dom Russano', score: 65, remaining: 360 }, away: { player: 'Josh Kelly', score: 32, remaining: 424 } },
                { round: 3, home: { player: 'Dom Russano', score: 41, remaining: 319 }, away: { player: 'Josh Kelly', score: 40, remaining: 384 } },
                { round: 4, home: { player: 'Dom Russano', score: 40, remaining: 279 }, away: { player: 'Josh Kelly', score: 76, remaining: 308 } },
                { round: 5, home: { player: 'Dom Russano', score: 9, remaining: 270 }, away: { player: 'Josh Kelly', score: 43, remaining: 265 } },
                { round: 6, home: { player: 'Dom Russano', score: 90, remaining: 180 }, away: { player: 'Josh Kelly', score: 40, remaining: 225 } },
                { round: 7, home: { player: 'Dom Russano', score: 120, remaining: 60, notable: '120' }, away: { player: 'Josh Kelly', score: 41, remaining: 184 } },
                { round: 8, home: { player: 'Dom Russano', score: 34, remaining: 26 }, away: { player: 'Josh Kelly', score: 41, remaining: 143 } },
                { round: 9, home: { player: 'Dom Russano', score: 18, remaining: 8 }, away: { player: 'Josh Kelly', score: 22, remaining: 121 } },
                { round: 10, home: { player: 'Dom Russano', score: 0, remaining: 8 }, away: { player: 'Josh Kelly', score: 25, remaining: 96 } },
                { round: 11, home: { player: 'Dom Russano', score: 4, remaining: 4 }, away: { player: 'Josh Kelly', score: 66, remaining: 30 } },
                { round: 12, home: { player: 'Dom Russano', score: 0, remaining: 4 }, away: { player: 'Josh Kelly', score: 30, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    }
];

// Cloud function to populate this match
exports.populateMassimianRagnoniMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const leagueId = req.body.leagueId || 'aOq4Y0ETxPZ66tM1uUtP';
            const matchId = req.body.matchId;

            if (!matchId) {
                return res.status(400).json({ error: 'matchId is required' });
            }

            const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);

            // Update match with game data
            await matchRef.update({
                ...massimianRagnoniMetadata,
                games: massimianRagnoniGames,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Massimiani vs Ragnoni match data populated',
                games_count: massimianRagnoniGames.length
            });
        } catch (error) {
            console.error('Error populating match:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
