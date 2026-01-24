/**
 * Populate Mezlak vs Russano Match Data
 * Week 1: Team 3 (N. Mezlak) vs Team 1 (D. Russano)
 *
 * Match: 18 games across 9 sets
 * Team 3: Nick Mezlak, Cory Jacobs, Dillon Ulisses
 * Team 1: Danny Russano, Chris Russano, Eric Duale
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// Match metadata from DartConnect
const mezlakRussanoMetadata = {
    match_date: new Date('2026-01-14'),
    start_time: new Date('2026-01-14T19:35:00'),
    end_time: new Date('2026-01-14T22:19:00'),
    game_time_minutes: 16 + 17 + 11 + 16 + 14 + 6 + 22 + 13 + 17, // All segments
    match_length_minutes: 164,
    total_darts: 160 + 183 + 142 + 143 + 144 + 78 + 221 + 107 + 148,
    total_games: 18,
    total_sets: 9,
    der: 96
};

// All 18 games with turn-by-turn data
const mezlakRussanoGames = [
    // ==========================================
    // SET 1 - Doubles: Russano/Russano vs Jacobs/Mezlak
    // ==========================================
    // Game 1.1 - 501 SIDO - HOME WIN (0-12)
    {
        set: 1, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Danny Russano', 'Chris Russano'], away_players: ['Cory Jacobs', 'Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 248,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 75.15, darts: 20, points: 501 },
            away_stats: { three_dart_avg: 81.5, darts: 18, points: 489, remaining: 12 },
            player_stats: {
                'Danny Russano': { darts: 11, points: 291, three_dart_avg: 79.36 },
                'Chris Russano': { darts: 9, points: 210, three_dart_avg: 70.0 },
                'Cory Jacobs': { darts: 9, points: 196, three_dart_avg: 65.33 },
                'Nick Mezlak': { darts: 9, points: 293, three_dart_avg: 97.67 }
            },
            checkout: 19, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Danny Russano', score: 60, remaining: 441 }, away: { player: 'Nick Mezlak', score: 96, remaining: 405, notable: '96' } },
                { round: 2, home: { player: 'Chris Russano', score: 85, remaining: 356 }, away: { player: 'Cory Jacobs', score: 60, remaining: 345 } },
                { round: 3, home: { player: 'Danny Russano', score: 83, remaining: 273 }, away: { player: 'Nick Mezlak', score: 140, remaining: 205, notable: '140' } },
                { round: 4, home: { player: 'Chris Russano', score: 41, remaining: 232 }, away: { player: 'Cory Jacobs', score: 43, remaining: 162 } },
                { round: 5, home: { player: 'Danny Russano', score: 129, remaining: 103, notable: '129' }, away: { player: 'Nick Mezlak', score: 58, remaining: 104 } },
                { round: 6, home: { player: 'Chris Russano', score: 84, remaining: 19 }, away: { player: 'Cory Jacobs', score: 92, remaining: 12 } },
                { round: 7, home: { player: 'Danny Russano', score: 19, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // Game 1.2 - Cricket - HOME WIN (676-665)
    {
        set: 1, game_in_set: 2, format: 'cricket',
        home_players: ['Danny Russano', 'Chris Russano'], away_players: ['Cory Jacobs', 'Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 720,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 21, closeout_darts: 1,
            home_stats: { mpr: 2.8, darts: 62, marks: 58, points: 676 },
            away_stats: { mpr: 2.7, darts: 60, marks: 53, points: 665 },
            player_stats: {
                'Danny Russano': { darts: 32, marks: 33, mpr: 3.09 },
                'Chris Russano': { darts: 30, marks: 25, mpr: 2.5 },
                'Cory Jacobs': { darts: 30, marks: 20, mpr: 2.0 },
                'Nick Mezlak': { darts: 30, marks: 33, mpr: 3.3 }
            },
            throws: [
                { round: 1, home: { player: 'Danny Russano', hit: 'T20, S20', marks: 4 }, away: { player: 'Nick Mezlak', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 38 } },
                { round: 2, home: { player: 'Chris Russano', hit: 'T20', marks: 3, points: 80 }, away: { player: 'Cory Jacobs', hit: 'S19', marks: 1, points: 57 } },
                { round: 3, home: { player: 'Danny Russano', hit: 'T20', marks: 3, points: 140 }, away: { player: 'Nick Mezlak', hit: 'T19x2', marks: 6, notable: '6M', points: 171 } },
                { round: 4, home: { player: 'Chris Russano', hit: 'D20', marks: 2, points: 180 }, away: { player: 'Cory Jacobs', hit: 'T19, S19', marks: 4, points: 247 } },
                { round: 5, home: { player: 'Danny Russano', hit: 'S20', marks: 1, points: 200 }, away: { player: 'Nick Mezlak', hit: 'T20', marks: 3, points: 247 } },
                { round: 6, home: { player: 'Chris Russano', hit: 'S18', marks: 1, points: 200 }, away: { player: 'Cory Jacobs', hit: 'S18, S19', marks: 2, points: 266 } },
                { round: 7, home: { player: 'Danny Russano', hit: 'S18', marks: 1, points: 200 }, away: { player: 'Nick Mezlak', hit: 'S19', marks: 1, points: 285 } },
                { round: 8, home: { player: 'Chris Russano', hit: 'T18', marks: 3, points: 236 }, away: { player: 'Cory Jacobs', hit: 'S18', marks: 1, points: 285 } },
                { round: 9, home: { player: 'Danny Russano', hit: 'T18', marks: 3, points: 290 }, away: { player: 'Nick Mezlak', hit: 'S19, S18', marks: 2, points: 304 } },
                { round: 10, home: { player: 'Chris Russano', hit: 'D17', marks: 2, points: 290 }, away: { player: 'Cory Jacobs', hit: 'S19', marks: 1, points: 323 } },
                { round: 11, home: { player: 'Danny Russano', hit: 'S17x2', marks: 2, points: 307 }, away: { player: 'Nick Mezlak', hit: 'T19, T17', marks: 6, notable: '6M', points: 380 } },
                { round: 12, home: { player: 'Chris Russano', hit: 'T16, S16', marks: 4, points: 323 }, away: { player: 'Cory Jacobs', hit: 'S16', marks: 1, points: 380 } },
                { round: 13, home: { player: 'Danny Russano', hit: 'T16', marks: 3, points: 371 }, away: { player: 'Nick Mezlak', hit: 'T16, S15', marks: 4, points: 380 } },
                { round: 14, home: { player: 'Chris Russano', hit: 'T15x2, S15', marks: 7, notable: '7M', points: 431 }, away: { player: 'Cory Jacobs', hit: 'T19', marks: 3, points: 437 } },
                { round: 15, home: { player: 'Danny Russano', hit: 'T15', marks: 3, points: 476 }, away: { player: 'Nick Mezlak', hit: 'T19, S19, S15', marks: 5, notable: '5M', points: 513 } },
                { round: 16, home: { player: 'Chris Russano', hit: 'D15', marks: 2, points: 506 }, away: { player: 'Cory Jacobs', hit: '-', marks: 0, points: 513 } },
                { round: 17, home: { player: 'Danny Russano', hit: 'T15', marks: 3, points: 551 }, away: { player: 'Nick Mezlak', hit: 'T19, S19, S15', marks: 5, notable: '5M', points: 589 } },
                { round: 18, home: { player: 'Chris Russano', hit: 'DBx2, SB', marks: 5, notable: '5B', points: 601 }, away: { player: 'Cory Jacobs', hit: 'S19', marks: 1, points: 608 } },
                { round: 19, home: { player: 'Danny Russano', hit: 'SB, S19', marks: 2, points: 626 }, away: { player: 'Nick Mezlak', hit: 'T19', marks: 3, points: 665 } },
                { round: 20, home: { player: 'Chris Russano', hit: 'D19', marks: 2, points: 626 }, away: { player: 'Cory Jacobs', hit: '-', marks: 0, points: 665 } },
                { round: 21, home: { player: 'Danny Russano', hit: 'DB', marks: 2, points: 676, closeout_darts: 1, closed_out: true }, away: null }
            ]
        }]
    },

    // ==========================================
    // SET 2 - Singles: Eric Duale vs Dillon Ulisses (Cricket x2)
    // ==========================================
    // Game 2.1 - Cricket - AWAY WIN (114-197)
    {
        set: 2, game_in_set: 1, format: 'cricket',
        home_players: ['Eric Duale'], away_players: ['Dillon Ulisses'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 468,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 15, closeout_darts: 1,
            home_stats: { mpr: 1.8, darts: 42, marks: 25, points: 114 },
            away_stats: { mpr: 2.1, darts: 44, marks: 31, points: 197 },
            player_stats: {
                'Eric Duale': { darts: 42, marks: 25, mpr: 1.79 },
                'Dillon Ulisses': { darts: 44, marks: 31, mpr: 2.11 }
            },
            throws: [
                { round: 1, home: { player: 'Eric Duale', hit: '-', marks: 0 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Eric Duale', hit: 'S19x2', marks: 2 }, away: { player: 'Dillon Ulisses', hit: 'S20x2', marks: 2 } },
                { round: 3, home: { player: 'Eric Duale', hit: 'T18, S18x2', marks: 5, notable: '5M', points: 36 }, away: { player: 'Dillon Ulisses', hit: 'T19', marks: 3 } },
                { round: 4, home: { player: 'Eric Duale', hit: 'S18', marks: 1, points: 54 }, away: { player: 'Dillon Ulisses', hit: 'T20', marks: 3, points: 60 } },
                { round: 5, home: { player: 'Eric Duale', hit: 'S17x2', marks: 2, points: 54 }, away: { player: 'Dillon Ulisses', hit: 'T18', marks: 3, points: 60 } },
                { round: 6, home: { player: 'Eric Duale', hit: 'S19, T16', marks: 4, points: 54 }, away: { player: 'Dillon Ulisses', hit: 'T17', marks: 3, points: 60 } },
                { round: 7, home: { player: 'Eric Duale', hit: 'T15', marks: 3, points: 54 }, away: { player: 'Dillon Ulisses', hit: 'T16', marks: 3, points: 60 } },
                { round: 8, home: { player: 'Eric Duale', hit: 'S15x2, S17', marks: 3, points: 84 }, away: { player: 'Dillon Ulisses', hit: 'S17, T20', marks: 4, points: 137 } },
                { round: 9, home: { player: 'Eric Duale', hit: 'S15x2, S17', marks: 3, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1, points: 157 } },
                { round: 10, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'S15x2', marks: 2, points: 157 } },
                { round: 11, home: { player: 'Eric Duale', hit: 'SB', marks: 1, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'S15, S20', marks: 2, points: 177 } },
                { round: 12, home: { player: 'Eric Duale', hit: 'DB', marks: 2, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'SB', marks: 1, points: 177 } },
                { round: 13, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'SB', marks: 1, points: 177 } },
                { round: 14, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 114 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1, points: 197 } },
                { round: 15, home: null, away: { player: 'Dillon Ulisses', hit: 'DB', marks: 2, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },
    // Game 2.2 - Cricket - AWAY WIN (196-242)
    {
        set: 2, game_in_set: 2, format: 'cricket',
        home_players: ['Eric Duale'], away_players: ['Dillon Ulisses'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 539,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 17, closeout_darts: 3,
            home_stats: { mpr: 1.8, darts: 48, marks: 29, points: 196 },
            away_stats: { mpr: 2.2, darts: 49, marks: 36, points: 242 },
            player_stats: {
                'Eric Duale': { darts: 48, marks: 29, mpr: 1.81 },
                'Dillon Ulisses': { darts: 49, marks: 36, mpr: 2.2 }
            },
            throws: [
                { round: 1, home: { player: 'Eric Duale', hit: 'D20', marks: 2 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Eric Duale', hit: 'S19, D20', marks: 3, points: 20 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1 } },
                { round: 3, home: { player: 'Eric Duale', hit: 'T19, D20', marks: 5, points: 60 }, away: { player: 'Dillon Ulisses', hit: 'T19, S19', marks: 4, points: 19 } },
                { round: 4, home: { player: 'Eric Duale', hit: 'S18x2', marks: 2, points: 60 }, away: { player: 'Dillon Ulisses', hit: 'S18', marks: 1, points: 19 } },
                { round: 5, home: { player: 'Eric Duale', hit: 'S18', marks: 1, points: 60 }, away: { player: 'Dillon Ulisses', hit: 'T18', marks: 3, points: 37 } },
                { round: 6, home: { player: 'Eric Duale', hit: 'S17x2', marks: 2, points: 60 }, away: { player: 'Dillon Ulisses', hit: 'T17, S17', marks: 4, points: 54 } },
                { round: 7, home: { player: 'Eric Duale', hit: 'D20x2', marks: 4, points: 140 }, away: { player: 'Dillon Ulisses', hit: 'T17', marks: 3, points: 105 } },
                { round: 8, home: { player: 'Eric Duale', hit: 'S17', marks: 1, points: 140 }, away: { player: 'Dillon Ulisses', hit: 'S17', marks: 1, points: 122 } },
                { round: 9, home: { player: 'Eric Duale', hit: 'S20, T16, S16', marks: 5, notable: '5M', points: 176 }, away: { player: 'Dillon Ulisses', hit: 'S16x2', marks: 2, points: 122 } },
                { round: 10, home: { player: 'Eric Duale', hit: 'S20', marks: 1, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'S15x2', marks: 2, points: 122 } },
                { round: 11, home: { player: 'Eric Duale', hit: 'S15', marks: 1, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'S15', marks: 1, points: 122 } },
                { round: 12, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'T15, S15', marks: 4, points: 182 } },
                { round: 13, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'S15, S16, S20', marks: 3, points: 197 } },
                { round: 14, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'S15', marks: 1, points: 212 } },
                { round: 15, home: { player: 'Eric Duale', hit: 'SBx2', marks: 2, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'S15', marks: 1, points: 227 } },
                { round: 16, home: { player: 'Eric Duale', hit: '-', marks: 0, points: 196 }, away: { player: 'Dillon Ulisses', hit: 'DB, S15', marks: 3, points: 242 } },
                { round: 17, home: null, away: { player: 'Dillon Ulisses', hit: 'SB', marks: 1, closeout_darts: 3, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 3 - Singles: Danny Russano vs Nick Mezlak (Cricket x2)
    // ==========================================
    // Game 3.1 - Cricket - HOME WIN (229-194)
    {
        set: 3, game_in_set: 1, format: 'cricket',
        home_players: ['Danny Russano'], away_players: ['Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 307,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 11, closeout_darts: 1,
            home_stats: { mpr: 2.9, darts: 32, marks: 31, points: 229 },
            away_stats: { mpr: 2.6, darts: 32, marks: 28, points: 194 },
            player_stats: {
                'Danny Russano': { darts: 32, marks: 31, mpr: 2.91 },
                'Nick Mezlak': { darts: 32, marks: 28, mpr: 2.63 }
            },
            throws: [
                { round: 1, home: { player: 'Danny Russano', hit: 'T19', marks: 3 }, away: { player: 'Nick Mezlak', hit: 'T20, S20', marks: 4 } },
                { round: 2, home: { player: 'Danny Russano', hit: 'T18, S18x2', marks: 5, notable: '5M', points: 36 }, away: { player: 'Nick Mezlak', hit: 'T19', marks: 3, points: 20 } },
                { round: 3, home: { player: 'Danny Russano', hit: 'S18', marks: 1, points: 54 }, away: { player: 'Nick Mezlak', hit: 'D20, S18', marks: 3, points: 80 } },
                { round: 4, home: { player: 'Danny Russano', hit: 'S16x2', marks: 2, points: 54 }, away: { player: 'Nick Mezlak', hit: 'S20, S18x2', marks: 3, points: 80 } },
                { round: 5, home: { player: 'Danny Russano', hit: 'S16', marks: 1, points: 54 }, away: { player: 'Nick Mezlak', hit: 'S16, T17', marks: 4, points: 80 } },
                { round: 6, home: { player: 'Danny Russano', hit: 'SBx2', marks: 2, points: 54 }, away: { player: 'Nick Mezlak', hit: 'S16x2, T15', marks: 5, notable: '5M', points: 80 } },
                { round: 7, home: { player: 'Danny Russano', hit: 'DBx2', marks: 4, notable: '4B', points: 129 }, away: { player: 'Nick Mezlak', hit: '-', marks: 0, points: 80 } },
                { round: 8, home: { player: 'Danny Russano', hit: 'SBx2', marks: 2, points: 179 }, away: { player: 'Nick Mezlak', hit: 'T20', marks: 3, points: 140 } },
                { round: 9, home: { player: 'Danny Russano', hit: 'DB', marks: 2, points: 229 }, away: { player: 'Nick Mezlak', hit: '-', marks: 0, points: 140 } },
                { round: 10, home: { player: 'Danny Russano', hit: 'T20', marks: 3, points: 229 }, away: { player: 'Nick Mezlak', hit: 'S20', marks: 1, points: 160 } },
                { round: 11, home: { player: 'Danny Russano', hit: 'T15, T17', marks: 6, notable: '6M', closeout_darts: 1, closed_out: true }, away: { player: 'Nick Mezlak', hit: 'D17', marks: 2, points: 194 } }
            ]
        }]
    },
    // Game 3.2 - Cricket - HOME WIN (362-322)
    {
        set: 3, game_in_set: 2, format: 'cricket',
        home_players: ['Danny Russano'], away_players: ['Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 373,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 13, closeout_darts: 3,
            home_stats: { mpr: 3.2, darts: 38, marks: 40, points: 362 },
            away_stats: { mpr: 2.8, darts: 38, marks: 36, points: 322 },
            player_stats: {
                'Danny Russano': { darts: 38, marks: 40, mpr: 3.16 },
                'Nick Mezlak': { darts: 38, marks: 36, mpr: 2.84 }
            },
            throws: [
                { round: 1, home: { player: 'Danny Russano', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 38 }, away: { player: 'Nick Mezlak', hit: 'T20x2', marks: 6, notable: '6M', points: 80 } },
                { round: 2, home: { player: 'Danny Russano', hit: 'S18x2', marks: 2, points: 38 }, away: { player: 'Nick Mezlak', hit: 'S20, T19, S17', marks: 5, notable: '5M', points: 80 } },
                { round: 3, home: { player: 'Danny Russano', hit: 'S18x2', marks: 2, points: 56 }, away: { player: 'Nick Mezlak', hit: 'D17', marks: 2, points: 80 } },
                { round: 4, home: { player: 'Danny Russano', hit: 'S18, T18', marks: 4, points: 128 }, away: { player: 'Nick Mezlak', hit: 'S18x2', marks: 2, points: 80 } },
                { round: 5, home: { player: 'Danny Russano', hit: 'T18x2', marks: 6, notable: '6M', points: 236 }, away: { player: 'Nick Mezlak', hit: 'S20', marks: 1, points: 100 } },
                { round: 6, home: { player: 'Danny Russano', hit: 'T20, S18', marks: 4, points: 254 }, away: { player: 'Nick Mezlak', hit: 'D20', marks: 2, points: 140 } },
                { round: 7, home: { player: 'Danny Russano', hit: 'S17x2', marks: 2, points: 254 }, away: { player: 'Nick Mezlak', hit: 'T17, S17x2', marks: 5, notable: '5M', points: 225 } },
                { round: 8, home: { player: 'Danny Russano', hit: 'S18, S17', marks: 2, points: 272 }, away: { player: 'Nick Mezlak', hit: 'S17', marks: 1, points: 242 } },
                { round: 9, home: { player: 'Danny Russano', hit: 'T18, S18', marks: 4, points: 344 }, away: { player: 'Nick Mezlak', hit: 'T16, S16x2', marks: 5, notable: '5M', points: 274 } },
                { round: 10, home: { player: 'Danny Russano', hit: 'T16', marks: 3, points: 344 }, away: { player: 'Nick Mezlak', hit: 'T16', marks: 3, points: 322 } },
                { round: 11, home: { player: 'Danny Russano', hit: 'S15x2', marks: 2, points: 344 }, away: { player: 'Nick Mezlak', hit: '-', marks: 0, points: 322 } },
                { round: 12, home: { player: 'Danny Russano', hit: 'SB, S15, S18', marks: 3, points: 362 }, away: { player: 'Nick Mezlak', hit: 'T15', marks: 3, points: 322 } },
                { round: 13, home: { player: 'Danny Russano', hit: 'SBx2', marks: 2, closeout_darts: 3, closed_out: true }, away: { player: 'Nick Mezlak', hit: 'S18', marks: 1, points: 322 } }
            ]
        }]
    },

    // ==========================================
    // SET 4 - Doubles: Russano/Duale vs Jacobs/Ulisses
    // ==========================================
    // Game 4.1 - 501 SIDO - AWAY WIN (148-0)
    {
        set: 4, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Chris Russano', 'Eric Duale'], away_players: ['Cory Jacobs', 'Dillon Ulisses'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 328,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 44.13, darts: 24, points: 353, remaining: 148 },
            away_stats: { three_dart_avg: 62.63, darts: 24, points: 501 },
            player_stats: {
                'Chris Russano': { darts: 12, points: 173, three_dart_avg: 43.25 },
                'Eric Duale': { darts: 12, points: 180, three_dart_avg: 45.0 },
                'Cory Jacobs': { darts: 12, points: 269, three_dart_avg: 67.25 },
                'Dillon Ulisses': { darts: 12, points: 232, three_dart_avg: 58.0 }
            },
            checkout: 62, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Chris Russano', score: 23, remaining: 478 }, away: { player: 'Cory Jacobs', score: 100, remaining: 401, notable: '100' } },
                { round: 2, home: { player: 'Eric Duale', score: 41, remaining: 437 }, away: { player: 'Dillon Ulisses', score: 43, remaining: 358 } },
                { round: 3, home: { player: 'Chris Russano', score: 46, remaining: 391 }, away: { player: 'Cory Jacobs', score: 62, remaining: 296 } },
                { round: 4, home: { player: 'Eric Duale', score: 38, remaining: 353 }, away: { player: 'Dillon Ulisses', score: 45, remaining: 251 } },
                { round: 5, home: { player: 'Chris Russano', score: 25, remaining: 328 }, away: { player: 'Cory Jacobs', score: 80, remaining: 171 } },
                { round: 6, home: { player: 'Eric Duale', score: 41, remaining: 287 }, away: { player: 'Dillon Ulisses', score: 45, remaining: 126 } },
                { round: 7, home: { player: 'Chris Russano', score: 100, remaining: 187, notable: '100' }, away: { player: 'Cory Jacobs', score: 64, remaining: 62 } },
                { round: 8, home: { player: 'Eric Duale', score: 39, remaining: 148 }, away: { player: 'Dillon Ulisses', score: 62, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    // Game 4.2 - Cricket - AWAY WIN (352-358)
    {
        set: 4, game_in_set: 2, format: 'cricket',
        home_players: ['Chris Russano', 'Eric Duale'], away_players: ['Cory Jacobs', 'Dillon Ulisses'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 626,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 16, closeout_darts: 2,
            home_stats: { mpr: 2.4, darts: 48, marks: 39, points: 352 },
            away_stats: { mpr: 2.6, darts: 47, marks: 40, points: 358 },
            player_stats: {
                'Chris Russano': { darts: 24, marks: 19, mpr: 2.38 },
                'Eric Duale': { darts: 24, marks: 20, mpr: 2.5 },
                'Cory Jacobs': { darts: 24, marks: 27, mpr: 3.38 },
                'Dillon Ulisses': { darts: 23, marks: 13, mpr: 1.7 }
            },
            throws: [
                { round: 1, home: { player: 'Chris Russano', hit: 'T20, D20', marks: 5, notable: '5M' }, away: { player: 'Cory Jacobs', hit: 'T19x2, S19', marks: 7, notable: '7M', points: 76 } },
                { round: 2, home: { player: 'Eric Duale', hit: 'S20x2', marks: 2, points: 80 }, away: { player: 'Dillon Ulisses', hit: 'T19, S19', marks: 4, points: 152 } },
                { round: 3, home: { player: 'Chris Russano', hit: 'S20', marks: 1, points: 100 }, away: { player: 'Cory Jacobs', hit: 'T20', marks: 3, points: 152 } },
                { round: 4, home: { player: 'Eric Duale', hit: 'S18x2', marks: 2, points: 100 }, away: { player: 'Dillon Ulisses', hit: 'S18x2', marks: 2, points: 152 } },
                { round: 5, home: { player: 'Chris Russano', hit: 'T18, D18', marks: 5, notable: '5M', points: 172 }, away: { player: 'Cory Jacobs', hit: 'S19x2, S18', marks: 3, points: 190 } },
                { round: 6, home: { player: 'Eric Duale', hit: 'S17', marks: 1, points: 172 }, away: { player: 'Dillon Ulisses', hit: '-', marks: 0, points: 190 } },
                { round: 7, home: { player: 'Chris Russano', hit: '-', marks: 0, points: 172 }, away: { player: 'Cory Jacobs', hit: 'S17x2', marks: 2, points: 190 } },
                { round: 8, home: { player: 'Eric Duale', hit: 'S19, S17x2', marks: 3, points: 172 }, away: { player: 'Dillon Ulisses', hit: 'T17', marks: 3, points: 190 } },
                { round: 9, home: { player: 'Chris Russano', hit: 'D16', marks: 2, points: 172 }, away: { player: 'Cory Jacobs', hit: 'T16', marks: 3, points: 190 } },
                { round: 10, home: { player: 'Eric Duale', hit: 'S15', marks: 1, points: 172 }, away: { player: 'Dillon Ulisses', hit: 'S19', marks: 1, points: 209 } },
                { round: 11, home: { player: 'Chris Russano', hit: 'T15x3', marks: 9, notable: '9M', points: 277 }, away: { player: 'Cory Jacobs', hit: 'S16, S19x2', marks: 3, points: 263 } },
                { round: 12, home: { player: 'Eric Duale', hit: 'S19', marks: 1, points: 277 }, away: { player: 'Dillon Ulisses', hit: 'S19x2', marks: 2, points: 301 } },
                { round: 13, home: { player: 'Chris Russano', hit: 'S15x2', marks: 2, points: 307 }, away: { player: 'Cory Jacobs', hit: 'S19, S15', marks: 2, points: 320 } },
                { round: 14, home: { player: 'Eric Duale', hit: 'S15x2', marks: 2, points: 337 }, away: { player: 'Dillon Ulisses', hit: 'S19x2', marks: 2, points: 358 } },
                { round: 15, home: { player: 'Chris Russano', hit: 'S15', marks: 1, points: 352 }, away: { player: 'Cory Jacobs', hit: 'S15x2', marks: 2, points: 358 } },
                { round: 16, home: { player: 'Eric Duale', hit: 'S16, S19', marks: 2, points: 352 }, away: { player: 'Dillon Ulisses', hit: 'SB, DB', marks: 3, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 5 - Singles: Cory Jacobs vs Chris Russano (Cricket x2)
    // ==========================================
    // Game 5.1 - Cricket - AWAY WIN (105-228)
    {
        set: 5, game_in_set: 1, format: 'cricket',
        home_players: ['Cory Jacobs'], away_players: ['Chris Russano'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 558,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 16, closeout_darts: 2,
            home_stats: { mpr: 1.6, darts: 47, marks: 25, points: 105 },
            away_stats: { mpr: 2.2, darts: 47, marks: 34, points: 228 },
            player_stats: {
                'Cory Jacobs': { darts: 47, marks: 25, mpr: 1.6 },
                'Chris Russano': { darts: 47, marks: 34, mpr: 2.17 }
            },
            throws: [
                { round: 1, home: { player: 'Cory Jacobs', hit: 'T20', marks: 3 }, away: { player: 'Chris Russano', hit: 'S19x2', marks: 2 } },
                { round: 2, home: { player: 'Cory Jacobs', hit: 'T19', marks: 3 }, away: { player: 'Chris Russano', hit: 'D18x2', marks: 4 } },
                { round: 3, home: { player: 'Cory Jacobs', hit: 'S20, S18', marks: 2, points: 20 }, away: { player: 'Chris Russano', hit: 'S18, T20, S19', marks: 5, notable: '5M', points: 36 } },
                { round: 4, home: { player: 'Cory Jacobs', hit: 'S17x2', marks: 2, points: 20 }, away: { player: 'Chris Russano', hit: 'T18, S17', marks: 4, points: 90 } },
                { round: 5, home: { player: 'Cory Jacobs', hit: 'T17, S17x2', marks: 5, notable: '5M', points: 88 }, away: { player: 'Chris Russano', hit: 'T18', marks: 3, points: 144 } },
                { round: 6, home: { player: 'Cory Jacobs', hit: 'S17', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: 'D17', marks: 2, points: 144 } },
                { round: 7, home: { player: 'Cory Jacobs', hit: 'S16', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: 'T16', marks: 3, points: 144 } },
                { round: 8, home: { player: 'Cory Jacobs', hit: 'S15', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: 'D15', marks: 2, points: 144 } },
                { round: 9, home: { player: 'Cory Jacobs', hit: 'S15x2', marks: 2, points: 105 }, away: { player: 'Chris Russano', hit: 'S15', marks: 1, points: 144 } },
                { round: 10, home: { player: 'Cory Jacobs', hit: 'SB', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: 'S18', marks: 1, points: 162 } },
                { round: 11, home: { player: 'Cory Jacobs', hit: 'S18', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: 'S18', marks: 1, points: 180 } },
                { round: 12, home: { player: 'Cory Jacobs', hit: 'S18', marks: 1, points: 105 }, away: { player: 'Chris Russano', hit: '-', marks: 0, points: 180 } },
                { round: 13, home: { player: 'Cory Jacobs', hit: '-', marks: 0, points: 105 }, away: { player: 'Chris Russano', hit: 'S16, SB', marks: 2, points: 196 } },
                { round: 14, home: { player: 'Cory Jacobs', hit: '-', marks: 0, points: 105 }, away: { player: 'Chris Russano', hit: '-', marks: 0, points: 196 } },
                { round: 15, home: { player: 'Cory Jacobs', hit: 'SBx2, S16', marks: 3, points: 105 }, away: { player: 'Chris Russano', hit: 'SB, S16', marks: 2, points: 212 } },
                { round: 16, home: { player: 'Cory Jacobs', hit: '-', marks: 0, points: 105 }, away: { player: 'Chris Russano', hit: 'S16, SB', marks: 2, points: 228, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // Game 5.2 - Cricket - AWAY WIN (25-143)
    {
        set: 5, game_in_set: 2, format: 'cricket',
        home_players: ['Cory Jacobs'], away_players: ['Chris Russano'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 299,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 9, closeout_darts: 3,
            home_stats: { mpr: 1.8, darts: 24, marks: 14, points: 25 },
            away_stats: { mpr: 3.5, darts: 25, marks: 29, points: 143 },
            player_stats: {
                'Cory Jacobs': { darts: 24, marks: 14, mpr: 1.75 },
                'Chris Russano': { darts: 25, marks: 29, mpr: 3.48 }
            },
            throws: [
                { round: 1, home: { player: 'Cory Jacobs', hit: 'S20x2', marks: 2 }, away: { player: 'Chris Russano', hit: 'D20', marks: 2 } },
                { round: 2, home: { player: 'Cory Jacobs', hit: 'T19', marks: 3 }, away: { player: 'Chris Russano', hit: 'S18, S20, T20', marks: 5, notable: '5M', points: 60 } },
                { round: 3, home: { player: 'Cory Jacobs', hit: 'S17x2', marks: 2 }, away: { player: 'Chris Russano', hit: 'D18, S18, T19', marks: 6, notable: '6M', points: 78 } },
                { round: 4, home: { player: 'Cory Jacobs', hit: 'S15x2', marks: 2 }, away: { player: 'Chris Russano', hit: 'T17, T16, S15', marks: 7, notable: '7M', points: 78 } },
                { round: 5, home: { player: 'Cory Jacobs', hit: 'SB', marks: 1 }, away: { player: 'Chris Russano', hit: 'D15', marks: 2, points: 78 } },
                { round: 6, home: { player: 'Cory Jacobs', hit: '-', marks: 0 }, away: { player: 'Chris Russano', hit: 'S16, SB', marks: 2, points: 94 } },
                { round: 7, home: { player: 'Cory Jacobs', hit: 'S20, SB', marks: 2 }, away: { player: 'Chris Russano', hit: 'S15, SB', marks: 2, points: 109 } },
                { round: 8, home: { player: 'Cory Jacobs', hit: 'DB', marks: 2, points: 25 }, away: { player: 'Chris Russano', hit: 'D17', marks: 2, points: 143 } },
                { round: 9, home: null, away: { player: 'Chris Russano', hit: 'SB', marks: 1, closeout_darts: 3, closed_out: true } }
            ]
        }]
    },

    // ==========================================
    // SET 6 - Singles: Nick Mezlak vs Danny Russano (501 x2)
    // ==========================================
    // Game 6.1 - 501 SIDO - HOME WIN (0-267)
    {
        set: 6, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Nick Mezlak'], away_players: ['Danny Russano'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 168,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 75.15, darts: 20, points: 501 },
            away_stats: { three_dart_avg: 39.0, darts: 18, points: 234, remaining: 267 },
            player_stats: {
                'Nick Mezlak': { darts: 20, points: 501, three_dart_avg: 75.15 },
                'Danny Russano': { darts: 18, points: 234, three_dart_avg: 39.0 }
            },
            checkout: 20, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Nick Mezlak', score: 56, remaining: 445 }, away: { player: 'Danny Russano', score: 36, remaining: 465 } },
                { round: 2, home: { player: 'Nick Mezlak', score: 85, remaining: 360 }, away: { player: 'Danny Russano', score: 41, remaining: 424 } },
                { round: 3, home: { player: 'Nick Mezlak', score: 60, remaining: 300 }, away: { player: 'Danny Russano', score: 26, remaining: 398 } },
                { round: 4, home: { player: 'Nick Mezlak', score: 97, remaining: 203, notable: '97' }, away: { player: 'Danny Russano', score: 46, remaining: 352 } },
                { round: 5, home: { player: 'Nick Mezlak', score: 139, remaining: 64, notable: '139' }, away: { player: 'Danny Russano', score: 30, remaining: 322 } },
                { round: 6, home: { player: 'Nick Mezlak', score: 44, remaining: 20 }, away: { player: 'Danny Russano', score: 55, remaining: 267 } },
                { round: 7, home: { player: 'Nick Mezlak', score: 20, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // Game 6.2 - 501 SIDO - HOME WIN (0-140)
    {
        set: 6, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Nick Mezlak'], away_players: ['Danny Russano'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 214,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 79.11, darts: 19, points: 501 },
            away_stats: { three_dart_avg: 51.57, darts: 21, points: 361, remaining: 140 },
            player_stats: {
                'Nick Mezlak': { darts: 19, points: 501, three_dart_avg: 79.11 },
                'Danny Russano': { darts: 21, points: 361, three_dart_avg: 51.57 }
            },
            checkout: 20, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Nick Mezlak', score: 100, remaining: 401, notable: '100' }, away: { player: 'Danny Russano', score: 30, remaining: 471 } },
                { round: 2, home: { player: 'Nick Mezlak', score: 81, remaining: 320 }, away: { player: 'Danny Russano', score: 32, remaining: 439 } },
                { round: 3, home: { player: 'Nick Mezlak', score: 100, remaining: 220, notable: '100' }, away: { player: 'Danny Russano', score: 83, remaining: 356 } },
                { round: 4, home: { player: 'Nick Mezlak', score: 60, remaining: 160 }, away: { player: 'Danny Russano', score: 36, remaining: 320 } },
                { round: 5, home: { player: 'Nick Mezlak', score: 85, remaining: 75 }, away: { player: 'Danny Russano', score: 80, remaining: 240 } },
                { round: 6, home: { player: 'Nick Mezlak', score: 55, remaining: 20 }, away: { player: 'Danny Russano', score: 45, remaining: 195 } },
                { round: 7, home: { player: 'Nick Mezlak', score: 20, remaining: 0, checkout: true, checkout_darts: 1 }, away: { player: 'Danny Russano', score: 55, remaining: 140 } }
            ]
        }]
    },

    // ==========================================
    // SET 7 - Doubles: Russano/Duale vs Ulisses/Mezlak
    // ==========================================
    // Game 7.1 - 501 SIDO - HOME WIN (0-95)
    {
        set: 7, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Danny Russano', 'Eric Duale'], away_players: ['Dillon Ulisses', 'Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 384,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 55.67, darts: 27, points: 501 },
            away_stats: { three_dart_avg: 50.75, darts: 24, points: 406, remaining: 95 },
            player_stats: {
                'Danny Russano': { darts: 15, points: 307, three_dart_avg: 61.4 },
                'Eric Duale': { darts: 12, points: 194, three_dart_avg: 48.5 },
                'Dillon Ulisses': { darts: 12, points: 166, three_dart_avg: 41.5 },
                'Nick Mezlak': { darts: 12, points: 240, three_dart_avg: 60.0 }
            },
            checkout: 34, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Danny Russano', score: 60, remaining: 441 }, away: { player: 'Dillon Ulisses', score: 56, remaining: 445 } },
                { round: 2, home: { player: 'Eric Duale', score: 41, remaining: 400 }, away: { player: 'Nick Mezlak', score: 62, remaining: 383 } },
                { round: 3, home: { player: 'Danny Russano', score: 26, remaining: 374 }, away: { player: 'Dillon Ulisses', score: 41, remaining: 342 } },
                { round: 4, home: { player: 'Eric Duale', score: 80, remaining: 294 }, away: { player: 'Nick Mezlak', score: 95, remaining: 247, notable: '95' } },
                { round: 5, home: { player: 'Danny Russano', score: 95, remaining: 199, notable: '95' }, away: { player: 'Dillon Ulisses', score: 60, remaining: 187 } },
                { round: 6, home: { player: 'Eric Duale', score: 41, remaining: 158 }, away: { player: 'Nick Mezlak', score: 44, remaining: 143 } },
                { round: 7, home: { player: 'Danny Russano', score: 45, remaining: 113 }, away: { player: 'Dillon Ulisses', score: 9, remaining: 134 } },
                { round: 8, home: { player: 'Eric Duale', score: 32, remaining: 81 }, away: { player: 'Nick Mezlak', score: 39, remaining: 95 } },
                { round: 9, home: { player: 'Danny Russano', score: 47, remaining: 34 }, away: null },
                { round: 10, home: { player: 'Eric Duale', score: 34, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // Game 7.2 - Cricket - HOME WIN (306-310)
    {
        set: 7, game_in_set: 2, format: 'cricket',
        home_players: ['Danny Russano', 'Eric Duale'], away_players: ['Dillon Ulisses', 'Nick Mezlak'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 540,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 15, closeout_darts: 2,
            home_stats: { mpr: 2.5, darts: 44, marks: 37, points: 306 },
            away_stats: { mpr: 2.4, darts: 45, marks: 36, points: 310 },
            player_stats: {
                'Danny Russano': { darts: 23, marks: 20, mpr: 2.61 },
                'Eric Duale': { darts: 21, marks: 17, mpr: 2.43 },
                'Dillon Ulisses': { darts: 23, marks: 14, mpr: 1.83 },
                'Nick Mezlak': { darts: 22, marks: 22, mpr: 3.0 }
            },
            throws: [
                { round: 1, home: { player: 'Danny Russano', hit: 'T20', marks: 3 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Eric Duale', hit: 'T19, S19', marks: 4, points: 38 }, away: { player: 'Nick Mezlak', hit: 'T20, S20', marks: 4, points: 20 } },
                { round: 3, home: { player: 'Danny Russano', hit: 'S19', marks: 1, points: 57 }, away: { player: 'Dillon Ulisses', hit: 'S20x2', marks: 2, points: 20 } },
                { round: 4, home: { player: 'Eric Duale', hit: 'T18', marks: 3, points: 57 }, away: { player: 'Nick Mezlak', hit: 'T20', marks: 3, points: 80 } },
                { round: 5, home: { player: 'Danny Russano', hit: 'S18, T17', marks: 4, points: 57 }, away: { player: 'Dillon Ulisses', hit: 'T19', marks: 3, points: 80 } },
                { round: 6, home: { player: 'Eric Duale', hit: 'T17, S16', marks: 4, points: 57 }, away: { player: 'Nick Mezlak', hit: 'T19, S18x2', marks: 5, notable: '5M', points: 80 } },
                { round: 7, home: { player: 'Danny Russano', hit: 'T16', marks: 3, points: 105 }, away: { player: 'Dillon Ulisses', hit: 'S18', marks: 1, points: 98 } },
                { round: 8, home: { player: 'Eric Duale', hit: 'T15', marks: 3, points: 135 }, away: { player: 'Nick Mezlak', hit: 'T17, S17', marks: 4, points: 149 } },
                { round: 9, home: { player: 'Danny Russano', hit: 'S15x2', marks: 2, points: 165 }, away: { player: 'Dillon Ulisses', hit: 'S17', marks: 1, points: 166 } },
                { round: 10, home: { player: 'Eric Duale', hit: 'S15', marks: 1, points: 180 }, away: { player: 'Nick Mezlak', hit: 'T16, S16x2', marks: 5, notable: '5M', points: 214 } },
                { round: 11, home: { player: 'Danny Russano', hit: 'SBx2', marks: 2, points: 230 }, away: { player: 'Dillon Ulisses', hit: 'S16', marks: 1, points: 230 } },
                { round: 12, home: { player: 'Eric Duale', hit: 'SB, S15', marks: 2, points: 260 }, away: { player: 'Nick Mezlak', hit: 'S15', marks: 1, points: 245 } },
                { round: 13, home: { player: 'Danny Russano', hit: 'SB, S15', marks: 2, points: 290 }, away: { player: 'Dillon Ulisses', hit: 'S15x2', marks: 2, points: 275 } },
                { round: 14, home: { player: 'Eric Duale', hit: 'S16', marks: 1, points: 306 }, away: { player: 'Nick Mezlak', hit: 'SBx2, S15', marks: 3, points: 310 } },
                { round: 15, home: null, away: { player: 'Dillon Ulisses', hit: 'SB, DB', marks: 3, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // Game 7.3 - Cricket - HOME WIN (396-391)
    {
        set: 7, game_in_set: 3, format: 'cricket',
        home_players: ['Danny Russano', 'Eric Duale'], away_players: ['Dillon Ulisses', 'Nick Mezlak'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 474,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 14, closeout_darts: 2,
            home_stats: { mpr: 3.0, darts: 42, marks: 42, points: 396 },
            away_stats: { mpr: 2.6, darts: 41, marks: 34, points: 391 },
            player_stats: {
                'Danny Russano': { darts: 21, marks: 24, mpr: 3.43 },
                'Eric Duale': { darts: 21, marks: 18, mpr: 2.57 },
                'Dillon Ulisses': { darts: 21, marks: 11, mpr: 1.57 },
                'Nick Mezlak': { darts: 20, marks: 23, mpr: 3.45 }
            },
            throws: [
                { round: 1, home: { player: 'Danny Russano', hit: 'T19', marks: 3 }, away: { player: 'Dillon Ulisses', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Eric Duale', hit: 'T20', marks: 3, points: 57 }, away: { player: 'Nick Mezlak', hit: 'T20, S20', marks: 4, points: 20 } },
                { round: 3, home: { player: 'Danny Russano', hit: 'T20, S20', marks: 4, points: 137 }, away: { player: 'Dillon Ulisses', hit: 'S19', marks: 1, points: 20 } },
                { round: 4, home: { player: 'Eric Duale', hit: 'T18', marks: 3, points: 137 }, away: { player: 'Nick Mezlak', hit: 'T19x2', marks: 6, notable: '6M', points: 77 } },
                { round: 5, home: { player: 'Danny Russano', hit: 'T18', marks: 3, points: 191 }, away: { player: 'Dillon Ulisses', hit: 'S18, S19', marks: 2, points: 77 } },
                { round: 6, home: { player: 'Eric Duale', hit: 'S17, T17', marks: 4, points: 225 }, away: { player: 'Nick Mezlak', hit: 'T18, S18', marks: 4, points: 113 } },
                { round: 7, home: { player: 'Danny Russano', hit: 'T20', marks: 3, points: 285 }, away: { player: 'Dillon Ulisses', hit: 'S17', marks: 1, points: 130 } },
                { round: 8, home: { player: 'Eric Duale', hit: 'S16, S17', marks: 2, points: 302 }, away: { player: 'Nick Mezlak', hit: 'S17x2, T16', marks: 5, notable: '5M', points: 178 } },
                { round: 9, home: { player: 'Danny Russano', hit: 'T16', marks: 3, points: 350 }, away: { player: 'Dillon Ulisses', hit: 'S16', marks: 1, points: 194 } },
                { round: 10, home: { player: 'Eric Duale', hit: 'S15x2', marks: 2, points: 350 }, away: { player: 'Nick Mezlak', hit: 'S15x2', marks: 2, points: 209 } },
                { round: 11, home: { player: 'Danny Russano', hit: 'T15, S15', marks: 4, points: 395 }, away: { player: 'Dillon Ulisses', hit: 'S15', marks: 1, points: 224 } },
                { round: 12, home: { player: 'Eric Duale', hit: 'SB', marks: 1, points: 396 }, away: { player: 'Nick Mezlak', hit: 'S15', marks: 1, points: 239 } },
                { round: 13, home: { player: 'Danny Russano', hit: 'T15, DB', marks: 5, notable: '5M', points: 396 }, away: { player: 'Dillon Ulisses', hit: 'S15x2', marks: 2, points: 269 } },
                { round: 14, home: { player: 'Eric Duale', hit: 'SBx2', marks: 2, closeout_darts: 2, closed_out: true }, away: { player: 'Nick Mezlak', hit: 'T15x2, S15x2', marks: 8, notable: '8M', points: 391 } }
            ]
        }]
    },

    // ==========================================
    // SET 8 - Singles: Chris Russano vs Cory Jacobs (501 x2)
    // ==========================================
    // Game 8.1 - 501 SIDO - HOME WIN (0-30)
    {
        set: 8, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Chris Russano'], away_players: ['Cory Jacobs'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 467,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 45.55, darts: 33, points: 501 },
            away_stats: { three_dart_avg: 47.1, darts: 30, points: 471, remaining: 30 },
            player_stats: {
                'Chris Russano': { darts: 33, points: 501, three_dart_avg: 45.55 },
                'Cory Jacobs': { darts: 30, points: 471, three_dart_avg: 47.1 }
            },
            checkout: 40, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Chris Russano', score: 41, remaining: 460 }, away: { player: 'Cory Jacobs', score: 22, remaining: 479 } },
                { round: 2, home: { player: 'Chris Russano', score: 83, remaining: 377 }, away: { player: 'Cory Jacobs', score: 25, remaining: 454 } },
                { round: 3, home: { player: 'Chris Russano', score: 57, remaining: 320 }, away: { player: 'Cory Jacobs', score: 81, remaining: 373 } },
                { round: 4, home: { player: 'Chris Russano', score: 47, remaining: 273 }, away: { player: 'Cory Jacobs', score: 80, remaining: 293 } },
                { round: 5, home: { player: 'Chris Russano', score: 57, remaining: 216 }, away: { player: 'Cory Jacobs', score: 61, remaining: 232 } },
                { round: 6, home: { player: 'Chris Russano', score: 51, remaining: 165 }, away: { player: 'Cory Jacobs', score: 43, remaining: 189 } },
                { round: 7, home: { player: 'Chris Russano', score: 29, remaining: 136 }, away: { player: 'Cory Jacobs', score: 40, remaining: 149 } },
                { round: 8, home: { player: 'Chris Russano', score: 68, remaining: 68 }, away: { player: 'Cory Jacobs', score: 81, remaining: 68 } },
                { round: 9, home: { player: 'Chris Russano', score: 28, remaining: 40 }, away: { player: 'Cory Jacobs', score: 23, remaining: 45 } },
                { round: 10, home: { player: 'Chris Russano', score: 0, remaining: 40 }, away: { player: 'Cory Jacobs', score: 15, remaining: 30 } },
                { round: 11, home: { player: 'Chris Russano', score: 40, remaining: 0, checkout: true, checkout_darts: 3 }, away: null }
            ]
        }]
    },
    // Game 8.2 - 501 SIDO - HOME WIN (0-60)
    {
        set: 8, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Chris Russano'], away_players: ['Cory Jacobs'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 303,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 65.35, darts: 23, points: 501 },
            away_stats: { three_dart_avg: 63.0, darts: 21, points: 441, remaining: 60 },
            player_stats: {
                'Chris Russano': { darts: 23, points: 501, three_dart_avg: 65.35 },
                'Cory Jacobs': { darts: 21, points: 441, three_dart_avg: 63.0 }
            },
            checkout: 10, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Chris Russano', score: 95, remaining: 406, notable: '95' }, away: { player: 'Cory Jacobs', score: 80, remaining: 421 } },
                { round: 2, home: { player: 'Chris Russano', score: 45, remaining: 361 }, away: { player: 'Cory Jacobs', score: 60, remaining: 361 } },
                { round: 3, home: { player: 'Chris Russano', score: 98, remaining: 263, notable: '98' }, away: { player: 'Cory Jacobs', score: 41, remaining: 320 } },
                { round: 4, home: { player: 'Chris Russano', score: 45, remaining: 218 }, away: { player: 'Cory Jacobs', score: 60, remaining: 260 } },
                { round: 5, home: { player: 'Chris Russano', score: 98, remaining: 120, notable: '98' }, away: { player: 'Cory Jacobs', score: 60, remaining: 200 } },
                { round: 6, home: { player: 'Chris Russano', score: 80, remaining: 40 }, away: { player: 'Cory Jacobs', score: 40, remaining: 160 } },
                { round: 7, home: { player: 'Chris Russano', score: 30, remaining: 10 }, away: { player: 'Cory Jacobs', score: 100, remaining: 60, notable: '100' } },
                { round: 8, home: { player: 'Chris Russano', score: 10, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },

    // ==========================================
    // SET 9 - Singles: Dillon Ulisses vs Eric Duale (501 x2)
    // ==========================================
    // Game 9.1 - 501 SIDO - HOME WIN (0-2)
    {
        set: 9, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dillon Ulisses'], away_players: ['Eric Duale'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 502,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 40.62, darts: 37, points: 501 },
            away_stats: { three_dart_avg: 38.38, darts: 39, points: 499, remaining: 2 },
            player_stats: {
                'Dillon Ulisses': { darts: 37, points: 501, three_dart_avg: 40.62 },
                'Eric Duale': { darts: 39, points: 499, three_dart_avg: 38.38 }
            },
            checkout: 20, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Dillon Ulisses', score: 12, remaining: 489 }, away: { player: 'Eric Duale', score: 27, remaining: 474 } },
                { round: 2, home: { player: 'Dillon Ulisses', score: 22, remaining: 467 }, away: { player: 'Eric Duale', score: 14, remaining: 460 } },
                { round: 3, home: { player: 'Dillon Ulisses', score: 60, remaining: 407 }, away: { player: 'Eric Duale', score: 45, remaining: 415 } },
                { round: 4, home: { player: 'Dillon Ulisses', score: 80, remaining: 327 }, away: { player: 'Eric Duale', score: 63, remaining: 352 } },
                { round: 5, home: { player: 'Dillon Ulisses', score: 18, remaining: 309 }, away: { player: 'Eric Duale', score: 62, remaining: 290 } },
                { round: 6, home: { player: 'Dillon Ulisses', score: 41, remaining: 268 }, away: { player: 'Eric Duale', score: 24, remaining: 266 } },
                { round: 7, home: { player: 'Dillon Ulisses', score: 66, remaining: 202 }, away: { player: 'Eric Duale', score: 34, remaining: 232 } },
                { round: 8, home: { player: 'Dillon Ulisses', score: 80, remaining: 122 }, away: { player: 'Eric Duale', score: 62, remaining: 170 } },
                { round: 9, home: { player: 'Dillon Ulisses', score: 25, remaining: 97 }, away: { player: 'Eric Duale', score: 52, remaining: 118 } },
                { round: 10, home: { player: 'Dillon Ulisses', score: 41, remaining: 56 }, away: { player: 'Eric Duale', score: 23, remaining: 95 } },
                { round: 11, home: { player: 'Dillon Ulisses', score: 0, remaining: 56 }, away: { player: 'Eric Duale', score: 43, remaining: 52 } },
                { round: 12, home: { player: 'Dillon Ulisses', score: 36, remaining: 20 }, away: { player: 'Eric Duale', score: 44, remaining: 8 } },
                { round: 13, home: { player: 'Dillon Ulisses', score: 20, remaining: 0, checkout: true, checkout_darts: 1 }, away: { player: 'Eric Duale', score: 6, remaining: 2 } }
            ]
        }]
    },
    // Game 9.2 - 501 SIDO - HOME WIN (0-9)
    {
        set: 9, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dillon Ulisses'], away_players: ['Eric Duale'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 496,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 41.75, darts: 36, points: 501 },
            away_stats: { three_dart_avg: 41.0, darts: 36, points: 492, remaining: 9 },
            player_stats: {
                'Dillon Ulisses': { darts: 36, points: 501, three_dart_avg: 41.75 },
                'Eric Duale': { darts: 36, points: 492, three_dart_avg: 41.0 }
            },
            checkout: 20, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Dillon Ulisses', score: 47, remaining: 454 }, away: { player: 'Eric Duale', score: 61, remaining: 440 } },
                { round: 2, home: { player: 'Dillon Ulisses', score: 15, remaining: 439 }, away: { player: 'Eric Duale', score: 80, remaining: 360 } },
                { round: 3, home: { player: 'Dillon Ulisses', score: 45, remaining: 394 }, away: { player: 'Eric Duale', score: 54, remaining: 306 } },
                { round: 4, home: { player: 'Dillon Ulisses', score: 85, remaining: 309 }, away: { player: 'Eric Duale', score: 60, remaining: 246 } },
                { round: 5, home: { player: 'Dillon Ulisses', score: 41, remaining: 268 }, away: { player: 'Eric Duale', score: 23, remaining: 223 } },
                { round: 6, home: { player: 'Dillon Ulisses', score: 76, remaining: 192 }, away: { player: 'Eric Duale', score: 57, remaining: 166 } },
                { round: 7, home: { player: 'Dillon Ulisses', score: 26, remaining: 166 }, away: { player: 'Eric Duale', score: 23, remaining: 143 } },
                { round: 8, home: { player: 'Dillon Ulisses', score: 42, remaining: 124 }, away: { player: 'Eric Duale', score: 68, remaining: 75 } },
                { round: 9, home: { player: 'Dillon Ulisses', score: 56, remaining: 68 }, away: { player: 'Eric Duale', score: 30, remaining: 45 } },
                { round: 10, home: { player: 'Dillon Ulisses', score: 28, remaining: 40 }, away: { player: 'Eric Duale', score: 36, remaining: 9 } },
                { round: 11, home: { player: 'Dillon Ulisses', score: 20, remaining: 20 }, away: { player: 'Eric Duale', score: 0, remaining: 9 } },
                { round: 12, home: { player: 'Dillon Ulisses', score: 20, remaining: 0, checkout: true, checkout_darts: 3 }, away: { player: 'Eric Duale', score: 0, remaining: 9 } }
            ]
        }]
    }
];

// Cloud function to populate this match
exports.populateMezlakRussanoMatch = functions.https.onRequest((req, res) => {
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
                ...mezlakRussanoMetadata,
                games: mezlakRussanoGames,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Mezlak vs Russano match data populated',
                games_count: mezlakRussanoGames.length
            });
        } catch (error) {
            console.error('Error populating match:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
