/**
 * Populate Week 1 Match Data Cloud Functions
 * Populates the remaining 4 Week 1 matches with detailed turn-by-turn data
 *
 * Matches:
 * 1. Yasenchak (Team 9) vs Kull (Team 6) - 19 games
 * 2. Partlo (Team 2) vs Olschansky (Team 8) - 20 games
 * 3. Massimiani (Team 4) vs Ragnoni (Team 7) - 6+ games
 * 4. Mezlak (Team 3) vs Russano (Team 1) - multiple sets
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// ==========================================
// MATCH 1: YASENCHAK vs KULL
// ==========================================
const yasenchakKullMetadata = {
    match_date: new Date('2026-01-14'),
    start_time: new Date('2026-01-14T19:32:00'),
    end_time: new Date('2026-01-14T22:25:00'),
    game_time_minutes: 138,
    match_length_minutes: 173,
    total_darts: 1313,
    total_games: 19,
    total_sets: 9,
    der: 80
};

const yasenchakKullGames = [
    // SET 1 - Game 1.1 - 501 SIDO
    {
        set: 1, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Yasenchak', 'Brian Smith'], away_players: ['Nate Kull', 'Michael Jarvis'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 359,
        cork_winner: 'home', // Green text for Kevin Y = home had first turn
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 54.78, darts: 27, points: 493, remaining: 8 },
            away_stats: { three_dart_avg: 51.83, darts: 29, points: 501 },
            player_stats: {
                'Kevin Yasenchak': { darts: 15, points: 335, three_dart_avg: 67.0 },
                'Brian Smith': { darts: 12, points: 158, three_dart_avg: 39.5 },
                'Nate Kull': { darts: 15, points: 196, three_dart_avg: 39.2 },
                'Michael Jarvis': { darts: 14, points: 305, three_dart_avg: 65.36 }
            },
            checkout: 46, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', score: 38, remaining: 463 }, away: { player: 'Nate Kull', score: 30, remaining: 471 } },
                { round: 2, home: { player: 'Brian Smith', score: 40, remaining: 423 }, away: { player: 'Michael Jarvis', score: 47, remaining: 424 } },
                { round: 3, home: { player: 'Kevin Yasenchak', score: 140, remaining: 283, notable: '140' }, away: { player: 'Nate Kull', score: 85, remaining: 339 } },
                { round: 4, home: { player: 'Brian Smith', score: 61, remaining: 222 }, away: { player: 'Michael Jarvis', score: 95, remaining: 244, notable: '95' } },
                { round: 5, home: { player: 'Kevin Yasenchak', score: 58, remaining: 164 }, away: { player: 'Nate Kull', score: 3, remaining: 241 } },
                { round: 6, home: { player: 'Brian Smith', score: 55, remaining: 109 }, away: { player: 'Michael Jarvis', score: 38, remaining: 203 } },
                { round: 7, home: { player: 'Kevin Yasenchak', score: 22, remaining: 87 }, away: { player: 'Nate Kull', score: 100, remaining: 103, notable: '100' } },
                { round: 8, home: { player: 'Brian Smith', score: 62, remaining: 25 }, away: { player: 'Michael Jarvis', score: 26, remaining: 77 } },
                { round: 9, home: { player: 'Kevin Yasenchak', score: 17, remaining: 8 }, away: { player: 'Nate Kull', score: 31, remaining: 46 } },
                { round: 10, home: null, away: { player: 'Michael Jarvis', score: 46, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },
    // SET 1 - Game 1.2 - Cricket
    {
        set: 1, game_in_set: 2, format: 'cricket',
        home_players: ['Kevin Yasenchak', 'Brian Smith'], away_players: ['Nate Kull', 'Michael Jarvis'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 507,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 14, closeout_darts: 3,
            home_stats: { mpr: 2.4, darts: 40, marks: 32, points: 223 },
            away_stats: { mpr: 2.3, darts: 42, marks: 32, points: 171 },
            player_stats: {
                'Kevin Yasenchak': { darts: 21, marks: 20, mpr: 2.86 },
                'Brian Smith': { darts: 19, marks: 12, mpr: 1.89 },
                'Nate Kull': { darts: 21, marks: 14, mpr: 2.0 },
                'Michael Jarvis': { darts: 21, marks: 18, mpr: 2.57 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', hit: 'S19x2', marks: 2 }, away: { player: 'Nate Kull', hit: 'T20, S20x2', marks: 5, notable: '5M', points: 40 } },
                { round: 2, home: { player: 'Brian Smith', hit: 'D19, S19', marks: 3, points: 38 }, away: { player: 'Michael Jarvis', hit: 'T19, S20', marks: 4, points: 60 } },
                { round: 3, home: { player: 'Kevin Yasenchak', hit: 'T17, S20, S17', marks: 5, notable: '5M', points: 55 }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 60 } },
                { round: 4, home: { player: 'Brian Smith', hit: 'S20x2, S17', marks: 3, points: 72 }, away: { player: 'Michael Jarvis', hit: 'T18', marks: 3, points: 60 } },
                { round: 5, home: { player: 'Kevin Yasenchak', hit: 'S18x3', marks: 3, points: 72 }, away: { player: 'Nate Kull', hit: 'T16, S16', marks: 4, points: 76 } },
                { round: 6, home: { player: 'Brian Smith', hit: 'S17', marks: 1, points: 89 }, away: { player: 'Michael Jarvis', hit: 'T16, S16', marks: 4, points: 140 } },
                { round: 7, home: { player: 'Kevin Yasenchak', hit: 'S17x2', marks: 2, points: 123 }, away: { player: 'Nate Kull', hit: 'T17', marks: 3, points: 140 } },
                { round: 8, home: { player: 'Brian Smith', hit: 'S15x2', marks: 2, points: 123 }, away: { player: 'Michael Jarvis', hit: 'T15, SBx2', marks: 5, notable: '5M', points: 140 } },
                { round: 9, home: { player: 'Kevin Yasenchak', hit: 'DB, SB', marks: 3, notable: '3B', points: 123 }, away: { player: 'Nate Kull', hit: 'S15', marks: 1, points: 155 } },
                { round: 10, home: { player: 'Brian Smith', hit: '-', marks: 0, points: 123 }, away: { player: 'Michael Jarvis', hit: '-', marks: 0, points: 155 } },
                { round: 11, home: { player: 'Kevin Yasenchak', hit: 'SB', marks: 1, points: 148 }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 155 } },
                { round: 12, home: { player: 'Brian Smith', hit: 'SB', marks: 1, points: 173 }, away: { player: 'Michael Jarvis', hit: 'S16', marks: 1, points: 171 } },
                { round: 13, home: { player: 'Kevin Yasenchak', hit: 'T16, DB', marks: 5, notable: '5M', points: 223 }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 171 } },
                { round: 14, home: { player: 'Brian Smith', hit: 'S15', marks: 1, closeout_darts: 3, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 1 - Game 1.3 - Cricket
    {
        set: 1, game_in_set: 3, format: 'cricket',
        home_players: ['Kevin Yasenchak', 'Brian Smith'], away_players: ['Nate Kull', 'Michael Jarvis'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 453,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 9, closeout_darts: 2,
            home_stats: { mpr: 3.1, darts: 27, marks: 28, points: 131 },
            away_stats: { mpr: 1.3, darts: 24, marks: 10, points: 18 },
            player_stats: {
                'Kevin Yasenchak': { darts: 15, marks: 17, mpr: 3.4 },
                'Brian Smith': { darts: 12, marks: 11, mpr: 2.75 },
                'Nate Kull': { darts: 12, marks: 5, mpr: 1.25 },
                'Michael Jarvis': { darts: 12, marks: 5, mpr: 1.25 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', hit: 'S20x3', marks: 3 }, away: { player: 'Nate Kull', hit: 'S19', marks: 1 } },
                { round: 2, home: { player: 'Brian Smith', hit: 'S19x2', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S19', marks: 1 } },
                { round: 3, home: { player: 'Kevin Yasenchak', hit: 'S19, T17', marks: 4 }, away: { player: 'Nate Kull', hit: 'S18x2', marks: 2 } },
                { round: 4, home: { player: 'Brian Smith', hit: 'S18x2', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S18x2', marks: 2, points: 18 } },
                { round: 5, home: { player: 'Kevin Yasenchak', hit: 'S15, S18', marks: 2 }, away: { player: 'Nate Kull', hit: 'S16x2', marks: 2, points: 18 } },
                { round: 6, home: { player: 'Brian Smith', hit: 'T20, T16', marks: 6, notable: '6M', points: 60 }, away: { player: 'Michael Jarvis', hit: 'S15', marks: 1, points: 18 } },
                { round: 7, home: { player: 'Kevin Yasenchak', hit: 'T15, S20', marks: 4, points: 95 }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 18 } },
                { round: 8, home: { player: 'Brian Smith', hit: 'SB, S20', marks: 2, points: 115 }, away: { player: 'Michael Jarvis', hit: 'S19', marks: 1, points: 18 } },
                { round: 9, home: { player: 'Kevin Yasenchak', hit: 'DB, S16', marks: 3, points: 131, closeout_darts: 2, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 2 - Game 2.1 - Cricket (Singles: Cesar A vs Steph Kull)
    {
        set: 2, game_in_set: 1, format: 'cricket',
        home_players: ['Cesar Andino'], away_players: ['Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 293,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 9, closeout_darts: 1,
            home_stats: { mpr: 2.5, darts: 26, marks: 22, points: 20 },
            away_stats: { mpr: 1.4, darts: 24, marks: 11, points: 0 },
            player_stats: {
                'Cesar Andino': { darts: 26, marks: 22, mpr: 2.54 },
                'Stephanie Kull': { darts: 24, marks: 11, mpr: 1.38 }
            },
            throws: [
                { round: 1, home: { player: 'Cesar Andino', hit: 'S20', marks: 1 }, away: { player: 'Stephanie Kull', hit: 'D20', marks: 2 } },
                { round: 2, home: { player: 'Cesar Andino', hit: 'S20', marks: 1 }, away: { player: 'Stephanie Kull', hit: 'S18', marks: 1 } },
                { round: 3, home: { player: 'Cesar Andino', hit: 'S20x2', marks: 2, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S19', marks: 1 } },
                { round: 4, home: { player: 'Cesar Andino', hit: 'T19, S18x2', marks: 5, notable: '5M' }, away: { player: 'Stephanie Kull', hit: 'D18', marks: 2 } },
                { round: 5, home: { player: 'Cesar Andino', hit: 'S18, S17', marks: 2 }, away: { player: 'Stephanie Kull', hit: 'S17', marks: 1 } },
                { round: 6, home: { player: 'Cesar Andino', hit: 'D17', marks: 2 }, away: { player: 'Stephanie Kull', hit: 'S16', marks: 1 } },
                { round: 7, home: { player: 'Cesar Andino', hit: 'T16', marks: 3 }, away: { player: 'Stephanie Kull', hit: 'D15', marks: 2 } },
                { round: 8, home: { player: 'Cesar Andino', hit: 'T15, DB', marks: 5, notable: '5M' }, away: { player: 'Stephanie Kull', hit: 'S19', marks: 1 } },
                { round: 9, home: { player: 'Cesar Andino', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 2 - Game 2.2 - Cricket (Singles: Cesar A vs Steph Kull)
    {
        set: 2, game_in_set: 2, format: 'cricket',
        home_players: ['Cesar Andino'], away_players: ['Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 606,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 21, closeout_darts: 1,
            home_stats: { mpr: 1.5, darts: 61, marks: 31, points: 190 },
            away_stats: { mpr: 0.6, darts: 60, marks: 12, points: 0 },
            player_stats: {
                'Cesar Andino': { darts: 61, marks: 31, mpr: 1.52 },
                'Stephanie Kull': { darts: 60, marks: 12, mpr: 0.6 }
            },
            throws: [
                { round: 1, home: { player: 'Cesar Andino', hit: 'T20, S20, S19', marks: 5, notable: '5M' }, away: { player: 'Stephanie Kull', hit: 'S16', marks: 1 } },
                { round: 2, home: { player: 'Cesar Andino', hit: 'S19x2, S16', marks: 3, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S18', marks: 1 } },
                { round: 3, home: { player: 'Cesar Andino', hit: 'S16', marks: 1, points: 20 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 4, home: { player: 'Cesar Andino', hit: 'S16', marks: 1, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S15', marks: 1 } },
                { round: 5, home: { player: 'Cesar Andino', hit: 'S17x2', marks: 2, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S19, S18', marks: 2 } },
                { round: 6, home: { player: 'Cesar Andino', hit: 'S15, S17', marks: 2, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S15', marks: 1 } },
                { round: 7, home: { player: 'Cesar Andino', hit: '-', marks: 0, points: 20 }, away: { player: 'Stephanie Kull', hit: 'S15', marks: 1 } },
                { round: 8, home: { player: 'Cesar Andino', hit: 'T15', marks: 3, points: 20 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 9, home: { player: 'Cesar Andino', hit: 'S18, S20', marks: 2, points: 40 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 10, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 40 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 11, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 40 }, away: { player: 'Stephanie Kull', hit: 'S17', marks: 1 } },
                { round: 12, home: { player: 'Cesar Andino', hit: 'S19', marks: 1, points: 59 }, away: { player: 'Stephanie Kull', hit: 'D17', marks: 2 } },
                { round: 13, home: { player: 'Cesar Andino', hit: '-', marks: 0, points: 59 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 14, home: { player: 'Cesar Andino', hit: 'S16', marks: 1, points: 75 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 15, home: { player: 'Cesar Andino', hit: 'SB', marks: 1, points: 75 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 16, home: { player: 'Cesar Andino', hit: '-', marks: 0, points: 75 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 17, home: { player: 'Cesar Andino', hit: 'S19x2, S20', marks: 3, points: 133 }, away: { player: 'Stephanie Kull', hit: 'S20, SB', marks: 2 } },
                { round: 18, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 151 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 19, home: { player: 'Cesar Andino', hit: 'S20', marks: 1, points: 171 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 20, home: { player: 'Cesar Andino', hit: 'S19, SB', marks: 2, points: 190 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 21, home: { player: 'Cesar Andino', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 3 - Game 3.1 - Cricket (Kevin Y vs Nate Kull singles)
    {
        set: 3, game_in_set: 1, format: 'cricket',
        home_players: ['Kevin Yasenchak'], away_players: ['Nate Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 336,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 10, closeout_darts: 2,
            home_stats: { mpr: 3.4, darts: 29, marks: 33, points: 199 },
            away_stats: { mpr: 2.3, darts: 30, marks: 23, points: 190 },
            player_stats: {
                'Kevin Yasenchak': { darts: 29, marks: 33, mpr: 3.41 },
                'Nate Kull': { darts: 30, marks: 23, mpr: 2.3 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', hit: 'T20, S20x2', marks: 5, notable: '5M', points: 40 }, away: { player: 'Nate Kull', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Kevin Yasenchak', hit: 'T18, S18, S19', marks: 5, notable: '5M', points: 58 }, away: { player: 'Nate Kull', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 38 } },
                { round: 3, home: { player: 'Kevin Yasenchak', hit: 'S17x2, T17', marks: 5, notable: '5M', points: 92 }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 38 } },
                { round: 4, home: { player: 'Kevin Yasenchak', hit: 'S16x2', marks: 2, points: 92 }, away: { player: 'Nate Kull', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 133 } },
                { round: 5, home: { player: 'Kevin Yasenchak', hit: 'S15x3', marks: 3, points: 92 }, away: { player: 'Nate Kull', hit: 'T20, S19, S18', marks: 4, points: 152 } },
                { round: 6, home: { player: 'Kevin Yasenchak', hit: 'S16', marks: 1, points: 92 }, away: { player: 'Nate Kull', hit: 'S18', marks: 1, points: 152 } },
                { round: 7, home: { player: 'Kevin Yasenchak', hit: 'S17, S19', marks: 2, points: 109 }, away: { player: 'Nate Kull', hit: 'S18', marks: 1, points: 152 } },
                { round: 8, home: { player: 'Kevin Yasenchak', hit: 'S19', marks: 1, points: 109 }, away: { player: 'Nate Kull', hit: 'S19x2', marks: 2, points: 190 } },
                { round: 9, home: { player: 'Kevin Yasenchak', hit: 'T15x2, SB', marks: 7, notable: '7M', points: 199 }, away: { player: 'Nate Kull', hit: 'T17', marks: 3, points: 190 } },
                { round: 10, home: { player: 'Kevin Yasenchak', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true }, away: { player: 'Nate Kull', hit: 'SB', marks: 1, points: 190 } }
            ]
        }]
    },
    // SET 3 - Game 3.2 - Cricket
    {
        set: 3, game_in_set: 2, format: 'cricket',
        home_players: ['Kevin Yasenchak'], away_players: ['Nate Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 281,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 9, closeout_darts: 1,
            home_stats: { mpr: 3.1, darts: 26, marks: 27, points: 104 },
            away_stats: { mpr: 2.6, darts: 27, marks: 23, points: 99 },
            player_stats: {
                'Kevin Yasenchak': { darts: 26, marks: 27, mpr: 3.12 },
                'Nate Kull': { darts: 27, marks: 23, mpr: 2.56 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', hit: 'S18', marks: 1 }, away: { player: 'Nate Kull', hit: 'T20, S20x2', marks: 5, notable: '5M' } },
                { round: 2, home: { player: 'Kevin Yasenchak', hit: 'S18x2', marks: 2 }, away: { player: 'Nate Kull', hit: 'T19, S19', marks: 4, points: 59 } },
                { round: 3, home: { player: 'Kevin Yasenchak', hit: 'S17x3', marks: 3 }, away: { player: 'Nate Kull', hit: 'T18', marks: 3, points: 59 } },
                { round: 4, home: { player: 'Kevin Yasenchak', hit: 'T15, S16', marks: 4 }, away: { player: 'Nate Kull', hit: 'S17x2', marks: 2, points: 59 } },
                { round: 5, home: { player: 'Kevin Yasenchak', hit: 'S15, S20', marks: 2, points: 15 }, away: { player: 'Nate Kull', hit: 'S17, S15', marks: 2, points: 59 } },
                { round: 6, home: { player: 'Kevin Yasenchak', hit: 'T16, S16x2', marks: 5, notable: '5M', points: 63 }, away: { player: 'Nate Kull', hit: 'S15x2', marks: 2, points: 59 } },
                { round: 7, home: { player: 'Kevin Yasenchak', hit: 'S16, S19, S20', marks: 3, points: 79 }, away: { player: 'Nate Kull', hit: 'S20', marks: 1, points: 79 } },
                { round: 8, home: { player: 'Kevin Yasenchak', hit: 'T19, S20', marks: 4, points: 79 }, away: { player: 'Nate Kull', hit: 'T16, S20', marks: 4, points: 99 } },
                { round: 9, home: { player: 'Kevin Yasenchak', hit: 'DBx2', marks: 4, notable: '4B', points: 104, closeout_darts: 1, closed_out: true }, away: { player: 'Nate Kull', hit: '-', marks: 0, points: 99 } }
            ]
        }]
    },
    // SET 4 - Game 4.1 - Cricket (Brian vs Michael singles)
    {
        set: 4, game_in_set: 1, format: 'cricket',
        home_players: ['Brian Smith'], away_players: ['Michael Jarvis'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 400,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 11, closeout_darts: 2,
            home_stats: { mpr: 1.6, darts: 30, marks: 16, points: 101 },
            away_stats: { mpr: 2.6, darts: 32, marks: 28, points: 126 },
            player_stats: {
                'Brian Smith': { darts: 30, marks: 16, mpr: 1.6 },
                'Michael Jarvis': { darts: 32, marks: 28, mpr: 2.63 }
            },
            throws: [
                { round: 1, home: { player: 'Brian Smith', hit: '-', marks: 0 }, away: { player: 'Michael Jarvis', hit: 'T20', marks: 3 } },
                { round: 2, home: { player: 'Brian Smith', hit: 'S20', marks: 1 }, away: { player: 'Michael Jarvis', hit: 'T19, D19', marks: 5, notable: '5M', points: 38 } },
                { round: 3, home: { player: 'Brian Smith', hit: 'T17, S17x2', marks: 5, notable: '5M', points: 34 }, away: { player: 'Michael Jarvis', hit: 'T18', marks: 3, points: 38 } },
                { round: 4, home: { player: 'Brian Smith', hit: 'T17', marks: 3, points: 85 }, away: { player: 'Michael Jarvis', hit: 'S17', marks: 1, points: 38 } },
                { round: 5, home: { player: 'Brian Smith', hit: 'S16', marks: 1, points: 85 }, away: { player: 'Michael Jarvis', hit: 'T17', marks: 3, points: 38 } },
                { round: 6, home: { player: 'Brian Smith', hit: 'S16x2', marks: 2, points: 85 }, away: { player: 'Michael Jarvis', hit: 'S19', marks: 1, points: 57 } },
                { round: 7, home: { player: 'Brian Smith', hit: 'S19x3', marks: 3, points: 85 }, away: { player: 'Michael Jarvis', hit: 'S19', marks: 1, points: 76 } },
                { round: 8, home: { player: 'Brian Smith', hit: 'S16', marks: 1, points: 101 }, away: { player: 'Michael Jarvis', hit: 'S16, S20', marks: 2, points: 96 } },
                { round: 9, home: { player: 'Brian Smith', hit: '-', marks: 0, points: 101 }, away: { player: 'Michael Jarvis', hit: 'S16x2', marks: 2, points: 96 } },
                { round: 10, home: { player: 'Brian Smith', hit: '-', marks: 0, points: 101 }, away: { player: 'Michael Jarvis', hit: 'T15, D15', marks: 5, notable: '5M', points: 126 } },
                { round: 11, home: null, away: { player: 'Michael Jarvis', hit: 'SB, DB', marks: 3, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 4 - Game 4.2 - Cricket
    {
        set: 4, game_in_set: 2, format: 'cricket',
        home_players: ['Brian Smith'], away_players: ['Michael Jarvis'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 243,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 8, closeout_darts: 1,
            home_stats: { mpr: 1.1, darts: 21, marks: 8, points: 0 },
            away_stats: { mpr: 3.4, darts: 22, marks: 25, points: 80 },
            player_stats: {
                'Brian Smith': { darts: 21, marks: 8, mpr: 1.14 },
                'Michael Jarvis': { darts: 22, marks: 25, mpr: 3.41 }
            },
            throws: [
                { round: 1, home: { player: 'Brian Smith', hit: '-', marks: 0 }, away: { player: 'Michael Jarvis', hit: 'T20, S20', marks: 4 } },
                { round: 2, home: { player: 'Brian Smith', hit: '-', marks: 0 }, away: { player: 'Michael Jarvis', hit: '-', marks: 0, points: 20 } },
                { round: 3, home: { player: 'Brian Smith', hit: 'S19x2', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S19x2', marks: 2, points: 20 } },
                { round: 4, home: { player: 'Brian Smith', hit: 'D18', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S19, S18, S17', marks: 3, points: 20 } },
                { round: 5, home: { player: 'Brian Smith', hit: 'S16', marks: 1 }, away: { player: 'Michael Jarvis', hit: 'T18, T17', marks: 6, notable: '6M', points: 55 } },
                { round: 6, home: { player: 'Brian Smith', hit: 'S15', marks: 1 }, away: { player: 'Michael Jarvis', hit: 'T16, D15', marks: 5, notable: '5M', points: 55 } },
                { round: 7, home: { player: 'Brian Smith', hit: 'SB, S16', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S15, DB', marks: 3, points: 55 } },
                { round: 8, home: null, away: { player: 'Michael Jarvis', hit: 'DB', marks: 2, points: 80, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },
    // SET 5 - Game 5.1 - 501 SIDO (Doubles)
    {
        set: 5, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Brian Smith', 'Cesar Andino'], away_players: ['Michael Jarvis', 'Stephanie Kull'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 807,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 28.88, darts: 51, points: 491, remaining: 10 },
            away_stats: { three_dart_avg: 30.06, darts: 50, points: 501 },
            player_stats: {
                'Brian Smith': { darts: 27, points: 251, three_dart_avg: 27.89 },
                'Cesar Andino': { darts: 24, points: 240, three_dart_avg: 30.0 },
                'Michael Jarvis': { darts: 27, points: 317, three_dart_avg: 35.22 },
                'Stephanie Kull': { darts: 23, points: 184, three_dart_avg: 24.0 }
            },
            checkout: 27, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Brian Smith', score: 26, remaining: 475 }, away: { player: 'Michael Jarvis', score: 13, remaining: 488 } },
                { round: 2, home: { player: 'Cesar Andino', score: 40, remaining: 435 }, away: { player: 'Stephanie Kull', score: 6, remaining: 482 } },
                { round: 3, home: { player: 'Brian Smith', score: 20, remaining: 415 }, away: { player: 'Michael Jarvis', score: 17, remaining: 465 } },
                { round: 4, home: { player: 'Cesar Andino', score: 18, remaining: 397 }, away: { player: 'Stephanie Kull', score: 35, remaining: 430 } },
                { round: 5, home: { player: 'Brian Smith', score: 26, remaining: 371 }, away: { player: 'Michael Jarvis', score: 35, remaining: 395 } },
                { round: 6, home: { player: 'Cesar Andino', score: 29, remaining: 342 }, away: { player: 'Stephanie Kull', score: 20, remaining: 375 } },
                { round: 7, home: { player: 'Brian Smith', score: 85, remaining: 257 }, away: { player: 'Michael Jarvis', score: 29, remaining: 346 } },
                { round: 8, home: { player: 'Cesar Andino', score: 60, remaining: 197 }, away: { player: 'Stephanie Kull', score: 7, remaining: 339 } },
                { round: 9, home: { player: 'Brian Smith', score: 7, remaining: 190 }, away: { player: 'Michael Jarvis', score: 94, remaining: 245 } },
                { round: 10, home: { player: 'Cesar Andino', score: 30, remaining: 160 }, away: { player: 'Stephanie Kull', score: 36, remaining: 209 } },
                { round: 11, home: { player: 'Brian Smith', score: 40, remaining: 120 }, away: { player: 'Michael Jarvis', score: 41, remaining: 168 } },
                { round: 12, home: { player: 'Cesar Andino', score: 60, remaining: 60 }, away: { player: 'Stephanie Kull', score: 6, remaining: 162 } },
                { round: 13, home: { player: 'Brian Smith', score: 47, remaining: 13 }, away: { player: 'Michael Jarvis', score: 58, remaining: 104 } },
                { round: 14, home: { player: 'Cesar Andino', score: 0, remaining: 13 }, away: { player: 'Stephanie Kull', score: 14, remaining: 90 } },
                { round: 15, home: { player: 'Brian Smith', score: 0, remaining: 13 }, away: { player: 'Michael Jarvis', score: 24, remaining: 66 } },
                { round: 16, home: { player: 'Cesar Andino', score: 3, remaining: 10 }, away: { player: 'Stephanie Kull', score: 39, remaining: 27 } },
                { round: 17, home: { player: 'Brian Smith', score: 0, remaining: 10 }, away: { player: 'Michael Jarvis', score: 27, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },
    // SET 5 - Game 5.2 - Cricket (Doubles)
    {
        set: 5, game_in_set: 2, format: 'cricket',
        home_players: ['Brian Smith', 'Cesar Andino'], away_players: ['Michael Jarvis', 'Stephanie Kull'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 781,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 20, closeout_darts: 3,
            home_stats: { mpr: 1.6, darts: 57, marks: 30, points: 216 },
            away_stats: { mpr: 1.8, darts: 59, marks: 36, points: 233 },
            player_stats: {
                'Brian Smith': { darts: 30, marks: 15, mpr: 1.5 },
                'Cesar Andino': { darts: 27, marks: 15, mpr: 1.67 },
                'Michael Jarvis': { darts: 30, marks: 23, mpr: 2.3 },
                'Stephanie Kull': { darts: 29, marks: 13, mpr: 1.34 }
            },
            // Round data continues for this long cricket game...
            throws: [
                { round: 1, home: { player: 'Brian Smith', hit: 'S20x2', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'T20', marks: 3 } },
                { round: 2, home: { player: 'Cesar Andino', hit: 'S20', marks: 1 }, away: { player: 'Stephanie Kull', hit: 'S19', marks: 1 } },
                { round: 3, home: { player: 'Brian Smith', hit: 'S19x2', marks: 2 }, away: { player: 'Michael Jarvis', hit: 'S19x2', marks: 2 } },
                { round: 4, home: { player: 'Cesar Andino', hit: 'T18, S18, S19', marks: 5, notable: '5M', points: 18 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0 } },
                { round: 5, home: { player: 'Brian Smith', hit: 'D18', marks: 2, points: 54 }, away: { player: 'Michael Jarvis', hit: 'T17x2', marks: 6, notable: '6M', points: 51 } },
                { round: 6, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 72 }, away: { player: 'Stephanie Kull', hit: 'S16', marks: 1, points: 51 } },
                { round: 7, home: { player: 'Brian Smith', hit: 'S17x2', marks: 2, points: 72 }, away: { player: 'Michael Jarvis', hit: 'S17', marks: 1, points: 68 } },
                { round: 8, home: { player: 'Cesar Andino', hit: 'S17', marks: 1, points: 72 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0, points: 68 } },
                { round: 9, home: { player: 'Brian Smith', hit: 'S16x2', marks: 2, points: 72 }, away: { player: 'Michael Jarvis', hit: 'S16', marks: 1, points: 68 } },
                { round: 10, home: { player: 'Cesar Andino', hit: 'S16', marks: 1, points: 72 }, away: { player: 'Stephanie Kull', hit: 'S18, D15', marks: 3, points: 68 } },
                { round: 11, home: { player: 'Brian Smith', hit: 'D18', marks: 2, points: 108 }, away: { player: 'Michael Jarvis', hit: 'T15, S15', marks: 4, points: 113 } },
                { round: 12, home: { player: 'Cesar Andino', hit: 'T18, S18', marks: 4, points: 180 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0, points: 113 } },
                { round: 13, home: { player: 'Brian Smith', hit: 'S15', marks: 1, points: 180 }, away: { player: 'Michael Jarvis', hit: 'S15', marks: 1, points: 128 } },
                { round: 14, home: { player: 'Cesar Andino', hit: '-', marks: 0, points: 180 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0, points: 128 } },
                { round: 15, home: { player: 'Brian Smith', hit: '-', marks: 0, points: 180 }, away: { player: 'Michael Jarvis', hit: 'T15x2', marks: 6, notable: '6M', points: 218 } },
                { round: 16, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 198 }, away: { player: 'Stephanie Kull', hit: 'S18', marks: 1, points: 218 } },
                { round: 17, home: { player: 'Brian Smith', hit: 'S18', marks: 1, points: 216 }, away: { player: 'Michael Jarvis', hit: 'S15, S16, S18', marks: 3, points: 233 } },
                { round: 18, home: { player: 'Cesar Andino', hit: 'DB', marks: 2, points: 216 }, away: { player: 'Stephanie Kull', hit: '-', marks: 0, points: 233 } },
                { round: 19, home: { player: 'Brian Smith', hit: '-', marks: 0, points: 216 }, away: { player: 'Michael Jarvis', hit: 'SBx2', marks: 2, points: 233 } },
                { round: 20, home: { player: 'Cesar Andino', hit: 'S15x2', marks: 2, points: 216 }, away: { player: 'Stephanie Kull', hit: 'SB', marks: 1, closeout_darts: 3, closed_out: true } }
            ]
        }]
    },
    // SET 6 - Game 6.1 - 501 SIDO (Kevin vs Nate)
    {
        set: 6, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Yasenchak'], away_players: ['Nate Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 241,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 79.11, darts: 19, points: 501 },
            away_stats: { three_dart_avg: 78.17, darts: 18, points: 469, remaining: 32 },
            player_stats: {
                'Kevin Yasenchak': { darts: 19, points: 501, three_dart_avg: 79.11 },
                'Nate Kull': { darts: 18, points: 469, three_dart_avg: 78.17 }
            },
            checkout: 18, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', score: 100, remaining: 401, notable: '100' }, away: { player: 'Nate Kull', score: 180, remaining: 321, notable: '180' } },
                { round: 2, home: { player: 'Kevin Yasenchak', score: 58, remaining: 343 }, away: { player: 'Nate Kull', score: 41, remaining: 280 } },
                { round: 3, home: { player: 'Kevin Yasenchak', score: 75, remaining: 268 }, away: { player: 'Nate Kull', score: 60, remaining: 220 } },
                { round: 4, home: { player: 'Kevin Yasenchak', score: 81, remaining: 187 }, away: { player: 'Nate Kull', score: 45, remaining: 175 } },
                { round: 5, home: { player: 'Kevin Yasenchak', score: 121, remaining: 66, notable: '121' }, away: { player: 'Nate Kull', score: 121, remaining: 54, notable: '121' } },
                { round: 6, home: { player: 'Kevin Yasenchak', score: 48, remaining: 18 }, away: { player: 'Nate Kull', score: 22, remaining: 32 } },
                { round: 7, home: { player: 'Kevin Yasenchak', score: 18, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    // SET 6 - Game 6.2 - 501 SIDO (Kevin vs Nate)
    {
        set: 6, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Yasenchak'], away_players: ['Nate Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 324,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 60.12, darts: 25, points: 501 },
            away_stats: { three_dart_avg: 46.38, darts: 24, points: 371, remaining: 130 },
            player_stats: {
                'Kevin Yasenchak': { darts: 25, points: 501, three_dart_avg: 60.12 },
                'Nate Kull': { darts: 24, points: 371, three_dart_avg: 46.38 }
            },
            checkout: 6, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', score: 180, remaining: 321, notable: '180' }, away: { player: 'Nate Kull', score: 41, remaining: 460 } },
                { round: 2, home: { player: 'Kevin Yasenchak', score: 22, remaining: 299 }, away: { player: 'Nate Kull', score: 41, remaining: 419 } },
                { round: 3, home: { player: 'Kevin Yasenchak', score: 30, remaining: 269 }, away: { player: 'Nate Kull', score: 41, remaining: 378 } },
                { round: 4, home: { player: 'Kevin Yasenchak', score: 77, remaining: 192 }, away: { player: 'Nate Kull', score: 30, remaining: 348 } },
                { round: 5, home: { player: 'Kevin Yasenchak', score: 41, remaining: 151 }, away: { player: 'Nate Kull', score: 64, remaining: 284 } },
                { round: 6, home: { player: 'Kevin Yasenchak', score: 57, remaining: 94 }, away: { player: 'Nate Kull', score: 85, remaining: 199 } },
                { round: 7, home: { player: 'Kevin Yasenchak', score: 77, remaining: 17 }, away: { player: 'Nate Kull', score: 42, remaining: 157 } },
                { round: 8, home: { player: 'Kevin Yasenchak', score: 11, remaining: 6 }, away: { player: 'Nate Kull', score: 27, remaining: 130 } },
                { round: 9, home: { player: 'Kevin Yasenchak', score: 6, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    // SET 7 - Game 7.1 - 501 SIDO (Doubles)
    {
        set: 7, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Yasenchak', 'Cesar Andino'], away_players: ['Nate Kull', 'Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 483,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 36.66, darts: 41, points: 501 },
            away_stats: { three_dart_avg: 34.92, darts: 39, points: 454, remaining: 47 },
            player_stats: {
                'Kevin Yasenchak': { darts: 21, points: 302, three_dart_avg: 43.14 },
                'Cesar Andino': { darts: 20, points: 199, three_dart_avg: 29.85 },
                'Nate Kull': { darts: 21, points: 269, three_dart_avg: 38.43 },
                'Stephanie Kull': { darts: 18, points: 185, three_dart_avg: 30.83 }
            },
            checkout: 19, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', score: 47, remaining: 454 }, away: { player: 'Nate Kull', score: 41, remaining: 460 } },
                { round: 2, home: { player: 'Cesar Andino', score: 6, remaining: 448 }, away: { player: 'Stephanie Kull', score: 39, remaining: 421 } },
                { round: 3, home: { player: 'Kevin Yasenchak', score: 59, remaining: 389 }, away: { player: 'Nate Kull', score: 60, remaining: 361 } },
                { round: 4, home: { player: 'Cesar Andino', score: 40, remaining: 349 }, away: { player: 'Stephanie Kull', score: 20, remaining: 341 } },
                { round: 5, home: { player: 'Kevin Yasenchak', score: 60, remaining: 289 }, away: { player: 'Nate Kull', score: 41, remaining: 300 } },
                { round: 6, home: { player: 'Cesar Andino', score: 59, remaining: 230 }, away: { player: 'Stephanie Kull', score: 22, remaining: 278 } },
                { round: 7, home: { player: 'Kevin Yasenchak', score: 40, remaining: 190 }, away: { player: 'Nate Kull', score: 40, remaining: 238 } },
                { round: 8, home: { player: 'Cesar Andino', score: 43, remaining: 147 }, away: { player: 'Stephanie Kull', score: 16, remaining: 222 } },
                { round: 9, home: { player: 'Kevin Yasenchak', score: 68, remaining: 79 }, away: { player: 'Nate Kull', score: 41, remaining: 181 } },
                { round: 10, home: { player: 'Cesar Andino', score: 0, remaining: 79 }, away: { player: 'Stephanie Kull', score: 34, remaining: 147 } },
                { round: 11, home: { player: 'Kevin Yasenchak', score: 19, remaining: 60 }, away: { player: 'Nate Kull', score: 47, remaining: 100 } },
                { round: 12, home: { player: 'Cesar Andino', score: 20, remaining: 40 }, away: { player: 'Stephanie Kull', score: 28, remaining: 72 } },
                { round: 13, home: { player: 'Kevin Yasenchak', score: 21, remaining: 19 }, away: { player: 'Nate Kull', score: 25, remaining: 47 } },
                { round: 14, home: { player: 'Cesar Andino', score: 19, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // SET 7 - Game 7.2 - Cricket (Doubles)
    {
        set: 7, game_in_set: 2, format: 'cricket',
        home_players: ['Kevin Yasenchak', 'Cesar Andino'], away_players: ['Nate Kull', 'Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 224,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 7, closeout_darts: 2,
            home_stats: { mpr: 3.8, darts: 19, marks: 24, points: 49 },
            away_stats: { mpr: 1.5, darts: 18, marks: 9, points: 0 },
            player_stats: {
                'Kevin Yasenchak': { darts: 12, marks: 16, mpr: 4.0 },
                'Cesar Andino': { darts: 7, marks: 8, mpr: 3.43 },
                'Nate Kull': { darts: 9, marks: 5, mpr: 1.67 },
                'Stephanie Kull': { darts: 9, marks: 4, mpr: 1.33 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Yasenchak', hit: 'T19, S17', marks: 4 }, away: { player: 'Nate Kull', hit: 'S20x2', marks: 2 } },
                { round: 2, home: { player: 'Cesar Andino', hit: 'T20, S18x2', marks: 5, notable: '5M' }, away: { player: 'Stephanie Kull', hit: 'S15, S18', marks: 2 } },
                { round: 3, home: { player: 'Kevin Yasenchak', hit: 'S15, S17x2', marks: 3 }, away: { player: 'Nate Kull', hit: 'S18', marks: 1 } },
                { round: 4, home: { player: 'Cesar Andino', hit: 'S18, S16', marks: 2 }, away: { player: 'Stephanie Kull', hit: 'S15', marks: 1 } },
                { round: 5, home: { player: 'Kevin Yasenchak', hit: 'SB, T15, T16', marks: 7, notable: '7M', points: 31 }, away: { player: 'Nate Kull', hit: 'S15', marks: 1 } },
                { round: 6, home: { player: 'Cesar Andino', hit: 'S18', marks: 1, points: 49 }, away: { player: 'Stephanie Kull', hit: 'S16, S19', marks: 2 } },
                { round: 7, home: { player: 'Kevin Yasenchak', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 8 - Game 8.1 - 501 SIDO (Brian vs Michael singles)
    {
        set: 8, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Brian Smith'], away_players: ['Michael Jarvis'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 423,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 36.73, darts: 33, points: 404, remaining: 97 },
            away_stats: { three_dart_avg: 44.21, darts: 34, points: 501 },
            player_stats: {
                'Brian Smith': { darts: 33, points: 404, three_dart_avg: 36.73 },
                'Michael Jarvis': { darts: 34, points: 501, three_dart_avg: 44.21 }
            },
            checkout: 4, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Brian Smith', score: 45, remaining: 456 }, away: { player: 'Michael Jarvis', score: 71, remaining: 430 } },
                { round: 2, home: { player: 'Brian Smith', score: 35, remaining: 421 }, away: { player: 'Michael Jarvis', score: 21, remaining: 409 } },
                { round: 3, home: { player: 'Brian Smith', score: 30, remaining: 391 }, away: { player: 'Michael Jarvis', score: 41, remaining: 368 } },
                { round: 4, home: { player: 'Brian Smith', score: 60, remaining: 331 }, away: { player: 'Michael Jarvis', score: 13, remaining: 355 } },
                { round: 5, home: { player: 'Brian Smith', score: 35, remaining: 296 }, away: { player: 'Michael Jarvis', score: 57, remaining: 298 } },
                { round: 6, home: { player: 'Brian Smith', score: 66, remaining: 230 }, away: { player: 'Michael Jarvis', score: 58, remaining: 240 } },
                { round: 7, home: { player: 'Brian Smith', score: 25, remaining: 205 }, away: { player: 'Michael Jarvis', score: 62, remaining: 178 } },
                { round: 8, home: { player: 'Brian Smith', score: 30, remaining: 175 }, away: { player: 'Michael Jarvis', score: 58, remaining: 120 } },
                { round: 9, home: { player: 'Brian Smith', score: 2, remaining: 173 }, away: { player: 'Michael Jarvis', score: 90, remaining: 30 } },
                { round: 10, home: { player: 'Brian Smith', score: 6, remaining: 167 }, away: { player: 'Michael Jarvis', score: 26, remaining: 4 } },
                { round: 11, home: { player: 'Brian Smith', score: 70, remaining: 97 }, away: { player: 'Michael Jarvis', score: 0, remaining: 4 } },
                { round: 12, home: null, away: { player: 'Michael Jarvis', score: 4, remaining: 0, checkout: true, checkout_darts: 1 } }
            ]
        }]
    },
    // SET 8 - Game 8.2 - 501 SIDO (Brian vs Michael singles)
    {
        set: 8, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Brian Smith'], away_players: ['Michael Jarvis'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 515,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 35.25, darts: 36, points: 423, remaining: 78 },
            away_stats: { three_dart_avg: 40.62, darts: 37, points: 501 },
            player_stats: {
                'Brian Smith': { darts: 36, points: 423, three_dart_avg: 35.25 },
                'Michael Jarvis': { darts: 37, points: 501, three_dart_avg: 40.62 }
            },
            checkout: 40, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Brian Smith', score: 30, remaining: 471 }, away: { player: 'Michael Jarvis', score: 25, remaining: 476 } },
                { round: 2, home: { player: 'Brian Smith', score: 22, remaining: 449 }, away: { player: 'Michael Jarvis', score: 67, remaining: 409 } },
                { round: 3, home: { player: 'Brian Smith', score: 65, remaining: 384 }, away: { player: 'Michael Jarvis', score: 41, remaining: 368 } },
                { round: 4, home: { player: 'Brian Smith', score: 21, remaining: 363 }, away: { player: 'Michael Jarvis', score: 43, remaining: 325 } },
                { round: 5, home: { player: 'Brian Smith', score: 40, remaining: 323 }, away: { player: 'Michael Jarvis', score: 57, remaining: 268 } },
                { round: 6, home: { player: 'Brian Smith', score: 21, remaining: 302 }, away: { player: 'Michael Jarvis', score: 45, remaining: 223 } },
                { round: 7, home: { player: 'Brian Smith', score: 39, remaining: 263 }, away: { player: 'Michael Jarvis', score: 29, remaining: 194 } },
                { round: 8, home: { player: 'Brian Smith', score: 36, remaining: 227 }, away: { player: 'Michael Jarvis', score: 29, remaining: 165 } },
                { round: 9, home: { player: 'Brian Smith', score: 43, remaining: 184 }, away: { player: 'Michael Jarvis', score: 31, remaining: 134 } },
                { round: 10, home: { player: 'Brian Smith', score: 26, remaining: 158 }, away: { player: 'Michael Jarvis', score: 76, remaining: 58 } },
                { round: 11, home: { player: 'Brian Smith', score: 36, remaining: 122 }, away: { player: 'Michael Jarvis', score: 18, remaining: 40 } },
                { round: 12, home: { player: 'Brian Smith', score: 44, remaining: 78 }, away: { player: 'Michael Jarvis', score: 0, remaining: 40 } },
                { round: 13, home: null, away: { player: 'Michael Jarvis', score: 40, remaining: 0, checkout: true, checkout_darts: 1 } }
            ]
        }]
    },
    // SET 9 - Game 9.1 - 501 SIDO (Cesar vs Steph)
    {
        set: 9, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Cesar Andino'], away_players: ['Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 401,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 42.94, darts: 35, points: 501 },
            away_stats: { three_dart_avg: 29.83, darts: 36, points: 358, remaining: 143 },
            player_stats: {
                'Cesar Andino': { darts: 35, points: 501, three_dart_avg: 42.94 },
                'Stephanie Kull': { darts: 36, points: 358, three_dart_avg: 29.83 }
            },
            checkout: 16, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Cesar Andino', score: 100, remaining: 401, notable: '100' }, away: { player: 'Stephanie Kull', score: 30, remaining: 471 } },
                { round: 2, home: { player: 'Cesar Andino', score: 60, remaining: 341 }, away: { player: 'Stephanie Kull', score: 30, remaining: 441 } },
                { round: 3, home: { player: 'Cesar Andino', score: 54, remaining: 287 }, away: { player: 'Stephanie Kull', score: 15, remaining: 426 } },
                { round: 4, home: { player: 'Cesar Andino', score: 45, remaining: 242 }, away: { player: 'Stephanie Kull', score: 45, remaining: 381 } },
                { round: 5, home: { player: 'Cesar Andino', score: 26, remaining: 216 }, away: { player: 'Stephanie Kull', score: 29, remaining: 352 } },
                { round: 6, home: { player: 'Cesar Andino', score: 30, remaining: 186 }, away: { player: 'Stephanie Kull', score: 19, remaining: 333 } },
                { round: 7, home: { player: 'Cesar Andino', score: 14, remaining: 172 }, away: { player: 'Stephanie Kull', score: 14, remaining: 319 } },
                { round: 8, home: { player: 'Cesar Andino', score: 30, remaining: 142 }, away: { player: 'Stephanie Kull', score: 25, remaining: 294 } },
                { round: 9, home: { player: 'Cesar Andino', score: 21, remaining: 121 }, away: { player: 'Stephanie Kull', score: 41, remaining: 253 } },
                { round: 10, home: { player: 'Cesar Andino', score: 38, remaining: 83 }, away: { player: 'Stephanie Kull', score: 43, remaining: 210 } },
                { round: 11, home: { player: 'Cesar Andino', score: 67, remaining: 16 }, away: { player: 'Stephanie Kull', score: 12, remaining: 198 } },
                { round: 12, home: { player: 'Cesar Andino', score: 16, remaining: 0, checkout: true, checkout_darts: 2 }, away: { player: 'Stephanie Kull', score: 55, remaining: 143 } }
            ]
        }]
    },
    // SET 9 - Game 9.2 - 501 SIDO (Cesar vs Steph)
    {
        set: 9, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Cesar Andino'], away_players: ['Stephanie Kull'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 617,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 27.83, darts: 54, points: 501 },
            away_stats: { three_dart_avg: 29.35, darts: 51, points: 499, remaining: 2 },
            player_stats: {
                'Cesar Andino': { darts: 54, points: 501, three_dart_avg: 27.83 },
                'Stephanie Kull': { darts: 51, points: 499, three_dart_avg: 29.35 }
            },
            checkout: 10, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Cesar Andino', score: 50, remaining: 451 }, away: { player: 'Stephanie Kull', score: 53, remaining: 448 } },
                { round: 2, home: { player: 'Cesar Andino', score: 60, remaining: 391 }, away: { player: 'Stephanie Kull', score: 45, remaining: 403 } },
                { round: 3, home: { player: 'Cesar Andino', score: 60, remaining: 331 }, away: { player: 'Stephanie Kull', score: 21, remaining: 382 } },
                { round: 4, home: { player: 'Cesar Andino', score: 7, remaining: 324 }, away: { player: 'Stephanie Kull', score: 25, remaining: 357 } },
                { round: 5, home: { player: 'Cesar Andino', score: 81, remaining: 243 }, away: { player: 'Stephanie Kull', score: 3, remaining: 354 } },
                { round: 6, home: { player: 'Cesar Andino', score: 25, remaining: 218 }, away: { player: 'Stephanie Kull', score: 26, remaining: 328 } },
                { round: 7, home: { player: 'Cesar Andino', score: 21, remaining: 197 }, away: { player: 'Stephanie Kull', score: 35, remaining: 293 } },
                { round: 8, home: { player: 'Cesar Andino', score: 34, remaining: 163 }, away: { player: 'Stephanie Kull', score: 46, remaining: 247 } },
                { round: 9, home: { player: 'Cesar Andino', score: 23, remaining: 140 }, away: { player: 'Stephanie Kull', score: 13, remaining: 234 } },
                { round: 10, home: { player: 'Cesar Andino', score: 60, remaining: 80 }, away: { player: 'Stephanie Kull', score: 115, remaining: 119, notable: '115' } },
                { round: 11, home: { player: 'Cesar Andino', score: 20, remaining: 60 }, away: { player: 'Stephanie Kull', score: 30, remaining: 89 } },
                { round: 12, home: { player: 'Cesar Andino', score: 20, remaining: 40 }, away: { player: 'Stephanie Kull', score: 27, remaining: 62 } },
                { round: 13, home: { player: 'Cesar Andino', score: 30, remaining: 10 }, away: { player: 'Stephanie Kull', score: 20, remaining: 42 } },
                { round: 14, home: { player: 'Cesar Andino', score: 0, remaining: 10 }, away: { player: 'Stephanie Kull', score: 37, remaining: 5 } },
                { round: 15, home: { player: 'Cesar Andino', score: 0, remaining: 10 }, away: { player: 'Stephanie Kull', score: 3, remaining: 2 } },
                { round: 16, home: { player: 'Cesar Andino', score: 0, remaining: 10 }, away: { player: 'Stephanie Kull', score: 0, remaining: 2 } },
                { round: 17, home: { player: 'Cesar Andino', score: 0, remaining: 10 }, away: { player: 'Stephanie Kull', score: 0, remaining: 2 } },
                { round: 18, home: { player: 'Cesar Andino', score: 10, remaining: 0, checkout: true, checkout_darts: 3 }, away: null }
            ]
        }]
    }
];

// ==========================================
// Cloud Function to populate Yasenchak vs Kull match
// ==========================================
exports.populateYasenchakKullMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            // League and match IDs - replace with actual IDs
            const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
            const matchId = req.query.matchId;

            if (!matchId) {
                return res.status(400).json({ error: 'matchId query parameter required' });
            }

            const matchRef = db.collection('leagues').doc(leagueId)
                .collection('matches').doc(matchId);

            // Verify match exists
            const matchDoc = await matchRef.get();
            if (!matchDoc.exists) {
                return res.status(404).json({ error: 'Match not found' });
            }

            // Update match with detailed data
            await matchRef.update({
                ...yasenchakKullMetadata,
                games: yasenchakKullGames,
                data_imported: true,
                data_import_timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Yasenchak vs Kull match data populated',
                matchId,
                gamesCount: yasenchakKullGames.length
            });
        } catch (error) {
            console.error('Error populating match:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Export the data for local testing
module.exports.yasenchakKullMetadata = yasenchakKullMetadata;
module.exports.yasenchakKullGames = yasenchakKullGames;
