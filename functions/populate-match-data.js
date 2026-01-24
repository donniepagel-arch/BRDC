/**
 * Populate Match Data Cloud Function
 * Populates the Pagel v Pagel match with detailed turn-by-turn data
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// Match data extracted from DartConnect
const matchMetadata = {
    match_date: new Date('2026-01-14'),
    start_time: new Date('2026-01-14T19:33:00'),
    end_time: new Date('2026-01-14T22:45:00'),
    game_time_minutes: 157,
    match_length_minutes: 192,
    total_darts: 1505,
    total_games: 23,
    total_sets: 9,
    der: 82
};

// All 23 games with turn-by-turn data
const games = [
    // SET 1 - Game 1.1 - 501 SIDO
    {
        set: 1, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Matt Pagel', 'Joe Peters'], away_players: ['Donnie Pagel', 'Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 347,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 57.81, darts: 26, points: 501 },
            away_stats: { three_dart_avg: 45.44, darts: 27, points: 409, remaining: 92 },
            player_stats: {
                'Matt Pagel': { darts: 14, points: 280, three_dart_avg: 60.0 },
                'Joe Peters': { darts: 12, points: 221, three_dart_avg: 55.25 },
                'Donnie Pagel': { darts: 15, points: 157, three_dart_avg: 31.4 },
                'Christian Ketchem': { darts: 12, points: 252, three_dart_avg: 63.0 }
            },
            checkout: 43, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Matt Pagel', score: 60, remaining: 441 }, away: { player: 'Donnie Pagel', score: 30, remaining: 471 } },
                { round: 2, home: { player: 'Joe Peters', score: 45, remaining: 396 }, away: { player: 'Christian Ketchem', score: 140, remaining: 331, notable: '140' } },
                { round: 3, home: { player: 'Matt Pagel', score: 95, remaining: 301, notable: '95' }, away: { player: 'Donnie Pagel', score: 22, remaining: 309 } },
                { round: 4, home: { player: 'Joe Peters', score: 30, remaining: 271 }, away: { player: 'Christian Ketchem', score: 64, remaining: 245 } },
                { round: 5, home: { player: 'Matt Pagel', score: 41, remaining: 230 }, away: { player: 'Donnie Pagel', score: 45, remaining: 200 } },
                { round: 6, home: { player: 'Joe Peters', score: 45, remaining: 185 }, away: { player: 'Christian Ketchem', score: 23, remaining: 177 } },
                { round: 7, home: { player: 'Matt Pagel', score: 41, remaining: 144 }, away: { player: 'Donnie Pagel', score: 26, remaining: 151 } },
                { round: 8, home: { player: 'Joe Peters', score: 101, remaining: 43, notable: '101' }, away: { player: 'Christian Ketchem', score: 25, remaining: 126 } },
                { round: 9, home: { player: 'Matt Pagel', score: 43, remaining: 0, checkout: true, checkout_darts: 2 }, away: { player: 'Donnie Pagel', score: 34, remaining: 92 } }
            ]
        }]
    },
    // SET 1 - Game 1.2 - Cricket
    {
        set: 1, game_in_set: 2, format: 'cricket',
        home_players: ['Matt Pagel', 'Joe Peters'], away_players: ['Donnie Pagel', 'Christian Ketchem'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 615,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 17, closeout_darts: 2, // Donnie threw DBx2 = 2 darts to close
            home_stats: { mpr: 2.4, darts: 48, marks: 38, points: 326 },
            away_stats: { mpr: 2.4, darts: 51, marks: 40, points: 370 },
            player_stats: {
                'Matt Pagel': { darts: 24, marks: 15, mpr: 1.88 },
                'Joe Peters': { darts: 24, marks: 23, mpr: 2.88 },
                'Donnie Pagel': { darts: 27, marks: 28, mpr: 3.11 },
                'Christian Ketchem': { darts: 24, marks: 12, mpr: 1.5 }
            },
            throws: [
                { round: 1, home: { player: 'Matt Pagel', hit: 'S19', marks: 1 }, away: { player: 'Donnie Pagel', hit: 'S20, T20', marks: 4 } },
                { round: 2, home: { player: 'Joe Peters', hit: 'S19x2', marks: 2 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0, points: 20 } },
                { round: 3, home: { player: 'Matt Pagel', hit: 'S18x2', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'S19, T19', marks: 4 } },
                { round: 4, home: { player: 'Joe Peters', hit: 'S18, T18', marks: 4, points: 54 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 5, home: { player: 'Matt Pagel', hit: 'S18', marks: 1, points: 72 }, away: { player: 'Donnie Pagel', hit: 'S20x3', marks: 3, points: 80 } },
                { round: 6, home: { player: 'Joe Peters', hit: 'S20, T18, S18', marks: 5, points: 144, notable: '5M' }, away: { player: 'Christian Ketchem', hit: 'S20, T20', marks: 4, points: 160 } },
                { round: 7, home: { player: 'Matt Pagel', hit: 'S20', marks: 1 }, away: { player: 'Donnie Pagel', hit: 'S18, T20', marks: 4, points: 220 } },
                { round: 8, home: { player: 'Joe Peters', hit: 'T17, D17', marks: 5, points: 178, notable: '5M' }, away: { player: 'Christian Ketchem', hit: 'S18x2', marks: 2 } },
                { round: 9, home: { player: 'Matt Pagel', hit: 'T16', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S17, T17', marks: 4 } },
                { round: 10, home: { player: 'Joe Peters', hit: 'T16', marks: 3, points: 226 }, away: { player: 'Christian Ketchem', hit: 'S20', marks: 1, points: 240 } },
                { round: 11, home: { player: 'Matt Pagel', hit: 'S15x2', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'S16, T16, S20', marks: 5, points: 260 } },
                { round: 12, home: { player: 'Joe Peters', hit: 'SB', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'T15, S15', marks: 4, points: 275 } },
                { round: 13, home: { player: 'Matt Pagel', hit: 'DB, SB', marks: 3, points: 251, notable: '3B' }, away: { player: 'Donnie Pagel', hit: 'T20', marks: 3, points: 335 } },
                { round: 14, home: { player: 'Joe Peters', hit: 'DB, SB', marks: 3, points: 326, notable: '3B' }, away: { player: 'Christian Ketchem', hit: 'S15', marks: 1, points: 350 } },
                { round: 15, home: { player: 'Matt Pagel', hit: 'S15, S20', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'S20', marks: 1, points: 370 } },
                { round: 16, home: { player: 'Joe Peters', hit: '-', marks: 0 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 17, home: null, away: { player: 'Donnie Pagel', hit: 'DBx2', marks: 2, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 1 - Game 1.3 - 501 SIDO
    {
        set: 1, game_in_set: 3, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Matt Pagel', 'Joe Peters'], away_players: ['Donnie Pagel', 'Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 276,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 65.35, darts: 23, points: 501 },
            away_stats: { three_dart_avg: 44.86, darts: 21, points: 314, remaining: 187 },
            player_stats: {
                'Matt Pagel': { darts: 12, points: 266, three_dart_avg: 66.5 },
                'Joe Peters': { darts: 11, points: 235, three_dart_avg: 64.09 },
                'Donnie Pagel': { darts: 12, points: 225, three_dart_avg: 56.25 },
                'Christian Ketchem': { darts: 9, points: 89, three_dart_avg: 29.67 }
            },
            checkout: 46, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Matt Pagel', score: 41, remaining: 460 }, away: { player: 'Donnie Pagel', score: 58, remaining: 443 } },
                { round: 2, home: { player: 'Joe Peters', score: 43, remaining: 417 }, away: { player: 'Christian Ketchem', score: 22, remaining: 421 } },
                { round: 3, home: { player: 'Matt Pagel', score: 45, remaining: 372 }, away: { player: 'Donnie Pagel', score: 45, remaining: 376 } },
                { round: 4, home: { player: 'Joe Peters', score: 100, remaining: 272, notable: '100' }, away: { player: 'Christian Ketchem', score: 23, remaining: 353 } },
                { round: 5, home: { player: 'Matt Pagel', score: 100, remaining: 172, notable: '100' }, away: { player: 'Donnie Pagel', score: 22, remaining: 331 } },
                { round: 6, home: { player: 'Joe Peters', score: 46, remaining: 126 }, away: { player: 'Christian Ketchem', score: 44, remaining: 287 } },
                { round: 7, home: { player: 'Matt Pagel', score: 80, remaining: 46 }, away: { player: 'Donnie Pagel', score: 100, remaining: 187, notable: '100' } },
                { round: 8, home: { player: 'Joe Peters', score: 46, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // SET 2 - Games 2.1 & 2.2 (singles: John Linden vs Jenn M)
    {
        set: 2, game_in_set: 1, format: 'cricket',
        home_players: ['John Linden'], away_players: ['Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 444,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 12, closeout_darts: 1, // 12*3=36 expected, 34 actual, 36-34=2, so 3-2=1 dart to close
            home_stats: { mpr: 2.56, darts: 34, marks: 29 },
            away_stats: { mpr: 2.08, darts: 36, marks: 25, points: 100 },
            player_stats: { 'John Linden': { darts: 34, marks: 29, mpr: 2.56 }, 'Jenn M': { darts: 36, marks: 25, mpr: 2.08 } },
            throws: [
                { round: 1, home: { player: 'John Linden', hit: 'S20', marks: 1 }, away: { player: 'Jenn M', hit: 'T20', marks: 3 } },
                { round: 2, home: { player: 'John Linden', hit: 'S19x2', marks: 2 }, away: { player: 'Jenn M', hit: 'S20', marks: 1 } },
                { round: 3, home: { player: 'John Linden', hit: 'S18x3', marks: 3 }, away: { player: 'Jenn M', hit: 'T19', marks: 3 } },
                { round: 4, home: { player: 'John Linden', hit: 'D17, S17', marks: 3 }, away: { player: 'Jenn M', hit: 'T18', marks: 3 } },
                { round: 5, home: { player: 'John Linden', hit: 'T17, T19, S20', marks: 7, notable: '5M' }, away: { player: 'Jenn M', hit: 'S17', marks: 1 } },
                { round: 6, home: { player: 'John Linden', hit: 'S20', marks: 1 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 7, home: { player: 'John Linden', hit: 'T17, S17', marks: 4 }, away: { player: 'Jenn M', hit: 'T16, S16x2', marks: 5, notable: '5M' } },
                { round: 8, home: { player: 'John Linden', hit: 'T16, S15x2', marks: 5, notable: '5M' }, away: { player: 'Jenn M', hit: 'T16', marks: 3 } },
                { round: 9, home: { player: 'John Linden', hit: 'S15', marks: 1 }, away: { player: 'Jenn M', hit: 'S15', marks: 1 } },
                { round: 10, home: { player: 'John Linden', hit: 'SBx2', marks: 2 }, away: { player: 'Jenn M', hit: 'S17x2', marks: 2 } },
                { round: 11, home: { player: 'John Linden', hit: 'S15', marks: 1 }, away: { player: 'Jenn M', hit: 'S15, SB', marks: 2 } },
                { round: 12, home: { player: 'John Linden', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true }, away: { player: 'Jenn M', hit: 'SB', marks: 1 } }
            ]
        }]
    },
    {
        set: 2, game_in_set: 2, format: 'cricket',
        home_players: ['John Linden'], away_players: ['Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 405,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 12, closeout_darts: 2, // 12*3=36 expected, 35 actual, 36-35=1, so 3-1=2 darts to close
            home_stats: { mpr: 1.89, darts: 35, marks: 22, points: 20 },
            away_stats: { mpr: 1.55, darts: 33, marks: 17 },
            player_stats: { 'John Linden': { darts: 35, marks: 22, mpr: 1.89 }, 'Jenn M': { darts: 33, marks: 17, mpr: 1.55 } },
            throws: [
                { round: 1, home: { player: 'John Linden', hit: 'S20', marks: 1 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 2, home: { player: 'John Linden', hit: 'S20', marks: 1 }, away: { player: 'Jenn M', hit: 'S20x2', marks: 2 } },
                { round: 3, home: { player: 'John Linden', hit: 'S20x2', marks: 2, points: 20 }, away: { player: 'Jenn M', hit: 'S20', marks: 1 } },
                { round: 4, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'T19', marks: 3 } },
                { round: 5, home: { player: 'John Linden', hit: 'T19', marks: 3 }, away: { player: 'Jenn M', hit: 'T18', marks: 3 } },
                { round: 6, home: { player: 'John Linden', hit: 'S18x3', marks: 3 }, away: { player: 'Jenn M', hit: 'S17', marks: 1 } },
                { round: 7, home: { player: 'John Linden', hit: 'T17, S16', marks: 4 }, away: { player: 'Jenn M', hit: 'S16x2', marks: 2 } },
                { round: 8, home: { player: 'John Linden', hit: 'S16x2, S15', marks: 3 }, away: { player: 'Jenn M', hit: 'S15x2', marks: 2 } },
                { round: 9, home: { player: 'John Linden', hit: 'S15x2, SB', marks: 3 }, away: { player: 'Jenn M', hit: 'S17', marks: 1 } },
                { round: 10, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'S15', marks: 1 } },
                { round: 11, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'SB', marks: 1 } },
                { round: 12, home: { player: 'John Linden', hit: 'SBx2', marks: 2, closeout_darts: 2, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 3 - Games 3.1 & 3.2 (singles: Matt Pagel vs Donnie Pagel)
    {
        set: 3, game_in_set: 1, format: 'cricket',
        home_players: ['Matt Pagel'], away_players: ['Donnie Pagel'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 257,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 8, closeout_darts: 2, // 8*3=24 expected, 23 actual, 3-(24-23)=2
            home_stats: { mpr: 3.0, darts: 23, marks: 23, points: 30 },
            away_stats: { mpr: 1.13, darts: 24, marks: 9 },
            player_stats: { 'Matt Pagel': { darts: 23, marks: 23, mpr: 3.0 }, 'Donnie Pagel': { darts: 24, marks: 9, mpr: 1.13 } },
            throws: [
                { round: 1, home: { player: 'Matt Pagel', hit: 'T20', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Matt Pagel', hit: 'T16, S19', marks: 4 }, away: { player: 'Donnie Pagel', hit: 'S20', marks: 1 } },
                { round: 3, home: { player: 'Matt Pagel', hit: 'S19x2', marks: 2 }, away: { player: 'Donnie Pagel', hit: '-', marks: 0 } },
                { round: 4, home: { player: 'Matt Pagel', hit: 'T18', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S18', marks: 1 } },
                { round: 5, home: { player: 'Matt Pagel', hit: 'T17', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S17x3', marks: 3 } },
                { round: 6, home: { player: 'Matt Pagel', hit: 'S15x2', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'S15', marks: 1 } },
                { round: 7, home: { player: 'Matt Pagel', hit: 'T15, SB', marks: 4, points: 30 }, away: { player: 'Donnie Pagel', hit: 'S15', marks: 1 } },
                { round: 8, home: { player: 'Matt Pagel', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true }, away: { player: 'Donnie Pagel', hit: 'SB', marks: 1 } }
            ]
        }]
    },
    {
        set: 3, game_in_set: 2, format: 'cricket',
        home_players: ['Matt Pagel'], away_players: ['Donnie Pagel'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 431,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 13, closeout_darts: 3, // 13*3=39 expected, 39 actual, full round
            home_stats: { mpr: 2.62, darts: 39, marks: 34, points: 257 },
            away_stats: { mpr: 2.46, darts: 39, marks: 32, points: 244 },
            player_stats: { 'Matt Pagel': { darts: 39, marks: 34, mpr: 2.62 }, 'Donnie Pagel': { darts: 39, marks: 32, mpr: 2.46 } },
            throws: [
                { round: 1, home: { player: 'Matt Pagel', hit: 'S20', marks: 1 }, away: { player: 'Donnie Pagel', hit: '-', marks: 0 } },
                { round: 2, home: { player: 'Matt Pagel', hit: 'S19', marks: 1 }, away: { player: 'Donnie Pagel', hit: 'S20, T20', marks: 4 } },
                { round: 3, home: { player: 'Matt Pagel', hit: 'S19, T19', marks: 4, points: 38 }, away: { player: 'Donnie Pagel', hit: 'S19x2', marks: 2 } },
                { round: 4, home: { player: 'Matt Pagel', hit: 'T18', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S20x2, S19', marks: 3, points: 60 } },
                { round: 5, home: { player: 'Matt Pagel', hit: 'S17, T17', marks: 4, points: 55 }, away: { player: 'Donnie Pagel', hit: 'S18x3', marks: 3 } },
                { round: 6, home: { player: 'Matt Pagel', hit: 'S17', marks: 1, points: 72 }, away: { player: 'Donnie Pagel', hit: 'S17', marks: 1 } },
                { round: 7, home: { player: 'Matt Pagel', hit: 'T17, T20', marks: 6, points: 123, notable: '5M' }, away: { player: 'Donnie Pagel', hit: 'S16, S20x2', marks: 3, points: 100 } },
                { round: 8, home: { player: 'Matt Pagel', hit: 'S16, S17', marks: 2, points: 140 }, away: { player: 'Donnie Pagel', hit: 'S16x3', marks: 3, points: 116 } },
                { round: 9, home: { player: 'Matt Pagel', hit: 'S17', marks: 1, points: 157 }, away: { player: 'Donnie Pagel', hit: 'T16', marks: 3, points: 164 } },
                { round: 10, home: { player: 'Matt Pagel', hit: 'S15x2', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'S16, S17x2', marks: 3, points: 180 } },
                { round: 11, home: { player: 'Matt Pagel', hit: 'DBx2, SB', marks: 5, points: 207, notable: '5B' }, away: { player: 'Donnie Pagel', hit: 'S15x3', marks: 3 } },
                { round: 12, home: { player: 'Matt Pagel', hit: 'S15, SB', marks: 2, points: 232 }, away: { player: 'Donnie Pagel', hit: 'S16x2', marks: 2, points: 212 } },
                { round: 13, home: { player: 'Matt Pagel', hit: 'SB, D16', marks: 3, points: 257, closeout_darts: 3, closed_out: true }, away: { player: 'Donnie Pagel', hit: 'S16x2', marks: 2, points: 244 } }
            ]
        }]
    },
    // SET 4 - Games 4.1, 4.2, 4.3
    {
        set: 4, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Peters', 'John Linden'], away_players: ['Christian Ketchem', 'Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 338,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 55.67, darts: 27, points: 501 },
            away_stats: { three_dart_avg: 59.38, darts: 24, points: 475, remaining: 26 },
            player_stats: {
                'Joe Peters': { darts: 15, points: 288, three_dart_avg: 57.6 },
                'John Linden': { darts: 12, points: 213, three_dart_avg: 53.25 },
                'Christian Ketchem': { darts: 12, points: 275, three_dart_avg: 68.75 },
                'Jenn M': { darts: 12, points: 200, three_dart_avg: 50.0 }
            },
            checkout: 40, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Joe Peters', score: 41, remaining: 460 }, away: { player: 'Christian Ketchem', score: 83, remaining: 418 } },
                { round: 2, home: { player: 'John Linden', score: 29, remaining: 431 }, away: { player: 'Jenn M', score: 61, remaining: 357 } },
                { round: 3, home: { player: 'Joe Peters', score: 67, remaining: 364 }, away: { player: 'Christian Ketchem', score: 26, remaining: 331 } },
                { round: 4, home: { player: 'John Linden', score: 83, remaining: 281 }, away: { player: 'Jenn M', score: 41, remaining: 290 } },
                { round: 5, home: { player: 'Joe Peters', score: 60, remaining: 221 }, away: { player: 'Christian Ketchem', score: 100, remaining: 190, notable: '100' } },
                { round: 6, home: { player: 'John Linden', score: 83, remaining: 138 }, away: { player: 'Jenn M', score: 98, remaining: 92, notable: '98' } },
                { round: 7, home: { player: 'Joe Peters', score: 80, remaining: 58 }, away: { player: 'Christian Ketchem', score: 66, remaining: 26 } },
                { round: 8, home: { player: 'John Linden', score: 18, remaining: 40 }, away: { player: 'Jenn M', score: 0, remaining: 26 } },
                { round: 9, home: { player: 'Joe Peters', score: 40, remaining: 0, checkout: true, checkout_darts: 3 }, away: null }
            ]
        }]
    },
    {
        set: 4, game_in_set: 2, format: 'cricket',
        home_players: ['Joe Peters', 'John Linden'], away_players: ['Christian Ketchem', 'Jenn M'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 590,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 16, closeout_darts: 2, // Jenn threw 23 darts, 8 rounds × 3 = 24 expected, 23 actual = 2 darts to close
            home_stats: { mpr: 1.56, darts: 48, marks: 25, points: 86 },
            away_stats: { mpr: 1.66, darts: 47, marks: 26, points: 95 },
            player_stats: {
                'Joe Peters': { darts: 24, marks: 13, mpr: 1.63 },
                'John Linden': { darts: 24, marks: 12, mpr: 1.5 },
                'Christian Ketchem': { darts: 24, marks: 13, mpr: 1.63 },
                'Jenn M': { darts: 23, marks: 13, mpr: 1.70 }
            },
            throws: [
                { round: 1, home: { player: 'Joe Peters', hit: 'T20', marks: 3 }, away: { player: 'Christian Ketchem', hit: 'S18', marks: 1 } },
                { round: 2, home: { player: 'John Linden', hit: 'S19x2', marks: 2 }, away: { player: 'Jenn M', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 38 } },
                { round: 3, home: { player: 'Joe Peters', hit: '-', marks: 0 }, away: { player: 'Christian Ketchem', hit: 'T19, S20', marks: 4, points: 95 } },
                { round: 4, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'S20', marks: 1 } },
                { round: 5, home: { player: 'Joe Peters', hit: 'S20', marks: 1, points: 20 }, away: { player: 'Christian Ketchem', hit: 'S20', marks: 1 } },
                { round: 6, home: { player: 'John Linden', hit: 'D18', marks: 2 }, away: { player: 'Jenn M', hit: 'S18', marks: 1 } },
                { round: 7, home: { player: 'Joe Peters', hit: '-', marks: 0 }, away: { player: 'Christian Ketchem', hit: 'S18, S17', marks: 2 } },
                { round: 8, home: { player: 'John Linden', hit: 'T17', marks: 3 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 9, home: { player: 'Joe Peters', hit: 'T17', marks: 3, points: 71 }, away: { player: 'Christian Ketchem', hit: 'S17, T17', marks: 4 } },
                { round: 10, home: { player: 'John Linden', hit: 'S18, S19', marks: 2 }, away: { player: 'Jenn M', hit: 'S16', marks: 1 } },
                { round: 11, home: { player: 'Joe Peters', hit: 'S16x2', marks: 2 }, away: { player: 'Christian Ketchem', hit: 'S16x2', marks: 2 } },
                { round: 12, home: { player: 'John Linden', hit: 'S15, S16', marks: 2 }, away: { player: 'Jenn M', hit: 'S15x2', marks: 2 } },
                { round: 13, home: { player: 'Joe Peters', hit: 'T15', marks: 3, points: 86 }, away: { player: 'Christian Ketchem', hit: 'T15', marks: 3 } },
                { round: 14, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 15, home: { player: 'Joe Peters', hit: 'SB', marks: 1 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 16, home: { player: 'John Linden', hit: 'SB', marks: 1 }, away: { player: 'Jenn M', hit: 'DB, SB', marks: 3, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    {
        set: 4, game_in_set: 3, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Peters', 'John Linden'], away_players: ['Christian Ketchem', 'Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 392,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 55.67, darts: 27, points: 501 },
            away_stats: { three_dart_avg: 58.63, darts: 24, points: 469, remaining: 32 },
            player_stats: {
                'Joe Peters': { darts: 15, points: 324, three_dart_avg: 64.8 },
                'John Linden': { darts: 12, points: 177, three_dart_avg: 44.25 },
                'Christian Ketchem': { darts: 12, points: 192, three_dart_avg: 48.0 },
                'Jenn M': { darts: 12, points: 277, three_dart_avg: 69.25 }
            },
            checkout: 5, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Joe Peters', score: 60, remaining: 441 }, away: { player: 'Christian Ketchem', score: 97, remaining: 404, notable: '97' } },
                { round: 2, home: { player: 'John Linden', score: 29, remaining: 412 }, away: { player: 'Jenn M', score: 174, remaining: 230, notable: '174' } },
                { round: 3, home: { player: 'Joe Peters', score: 45, remaining: 367 }, away: { player: 'Christian Ketchem', score: 40, remaining: 190 } },
                { round: 4, home: { player: 'John Linden', score: 42, remaining: 325 }, away: { player: 'Jenn M', score: 52, remaining: 138 } },
                { round: 5, home: { player: 'Joe Peters', score: 100, remaining: 225, notable: '100' }, away: { player: 'Christian Ketchem', score: 42, remaining: 96 } },
                { round: 6, home: { player: 'John Linden', score: 71, remaining: 154 }, away: { player: 'Jenn M', score: 17, remaining: 79 } },
                { round: 7, home: { player: 'Joe Peters', score: 114, remaining: 40, notable: '114' }, away: { player: 'Christian Ketchem', score: 13, remaining: 66 } },
                { round: 8, home: { player: 'John Linden', score: 35, remaining: 5 }, away: { player: 'Jenn M', score: 34, remaining: 32 } },
                { round: 9, home: { player: 'Joe Peters', score: 5, remaining: 0, checkout: true, checkout_darts: 3 }, away: null }
            ]
        }]
    },
    // SET 5 - Games 5.1 & 5.2 (singles: Joe Peters vs Christian Ketchem)
    {
        set: 5, game_in_set: 1, format: 'cricket',
        home_players: ['Joe Peters'], away_players: ['Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 482,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 14, closeout_darts: 2, // 14*3=42 expected, 41 actual, 3-(42-41)=2
            home_stats: { mpr: 2.05, darts: 41, marks: 28, points: 128 },
            away_stats: { mpr: 1.15, darts: 39, marks: 15, points: 38 },
            player_stats: { 'Joe Peters': { darts: 41, marks: 28, mpr: 2.05 }, 'Christian Ketchem': { darts: 39, marks: 15, mpr: 1.15 } },
            throws: [
                { round: 1, home: { player: 'Joe Peters', hit: 'T20', marks: 3 }, away: { player: 'Christian Ketchem', hit: 'S19x2', marks: 2 } },
                { round: 2, home: { player: 'Joe Peters', hit: 'S19', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S19x2', marks: 2, points: 19 } },
                { round: 3, home: { player: 'Joe Peters', hit: 'S19, S20', marks: 2, points: 20 }, away: { player: 'Christian Ketchem', hit: 'S19, S16', marks: 2, points: 38 } },
                { round: 4, home: { player: 'Joe Peters', hit: 'S19, S20', marks: 2, points: 40 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 5, home: { player: 'Joe Peters', hit: 'S18', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S15', marks: 1 } },
                { round: 6, home: { player: 'Joe Peters', hit: 'T17, T18', marks: 6, points: 58, notable: '6M' }, away: { player: 'Christian Ketchem', hit: 'S16', marks: 1 } },
                { round: 7, home: { player: 'Joe Peters', hit: 'S16', marks: 1 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 8, home: { player: 'Joe Peters', hit: 'T15, D16', marks: 5, notable: '5M' }, away: { player: 'Christian Ketchem', hit: 'SB', marks: 1 } },
                { round: 9, home: { player: 'Joe Peters', hit: 'S17', marks: 1, points: 75 }, away: { player: 'Christian Ketchem', hit: 'S18x2', marks: 2 } },
                { round: 10, home: { player: 'Joe Peters', hit: 'SB', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S20', marks: 1 } },
                { round: 11, home: { player: 'Joe Peters', hit: 'SB, S17', marks: 2, points: 92 }, away: { player: 'Christian Ketchem', hit: 'S17', marks: 1 } },
                { round: 12, home: { player: 'Joe Peters', hit: '-', marks: 0 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 13, home: { player: 'Joe Peters', hit: 'S20', marks: 1, points: 112 }, away: { player: 'Christian Ketchem', hit: 'S20x2', marks: 2 } },
                { round: 14, home: { player: 'Joe Peters', hit: 'S16, SB', marks: 2, points: 128, closeout_darts: 2, closed_out: true }, away: null }
            ]
        }]
    },
    {
        set: 5, game_in_set: 2, format: 'cricket',
        home_players: ['Joe Peters'], away_players: ['Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 478,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 14, closeout_darts: 1, // 14*3=42 expected, 40 actual, 3-(42-40)=1
            home_stats: { mpr: 2.18, darts: 40, marks: 29, points: 144 },
            away_stats: { mpr: 1.5, darts: 42, marks: 21, points: 110 },
            player_stats: { 'Joe Peters': { darts: 40, marks: 29, mpr: 2.18 }, 'Christian Ketchem': { darts: 42, marks: 21, mpr: 1.5 } },
            throws: [
                { round: 1, home: { player: 'Joe Peters', hit: 'S19x2', marks: 2 }, away: { player: 'Christian Ketchem', hit: 'T20, S20x2', marks: 5, notable: '5M' } },
                { round: 2, home: { player: 'Joe Peters', hit: '-', marks: 0 }, away: { player: 'Christian Ketchem', hit: 'S20, S19', marks: 2, points: 60 } },
                { round: 3, home: { player: 'Joe Peters', hit: 'S19', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S19', marks: 1 } },
                { round: 4, home: { player: 'Joe Peters', hit: 'T20', marks: 3 }, away: { player: 'Christian Ketchem', hit: 'S19', marks: 1 } },
                { round: 5, home: { player: 'Joe Peters', hit: 'T18', marks: 3 }, away: { player: 'Christian Ketchem', hit: 'S18', marks: 1 } },
                { round: 6, home: { player: 'Joe Peters', hit: 'T18', marks: 3, points: 54 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 7, home: { player: 'Joe Peters', hit: 'D17, S18', marks: 3, points: 72 }, away: { player: 'Christian Ketchem', hit: 'T17', marks: 3 } },
                { round: 8, home: { player: 'Joe Peters', hit: 'S17, D18', marks: 3, points: 108 }, away: { player: 'Christian Ketchem', hit: 'S17x2', marks: 2, points: 94 } },
                { round: 9, home: { player: 'Joe Peters', hit: 'S16', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S16', marks: 1 } },
                { round: 10, home: { player: 'Joe Peters', hit: 'S16', marks: 1 }, away: { player: 'Christian Ketchem', hit: 'S16', marks: 1 } },
                { round: 11, home: { player: 'Joe Peters', hit: 'S15, S16, S18', marks: 3, points: 126 }, away: { player: 'Christian Ketchem', hit: 'S16x2', marks: 2, points: 110 } },
                { round: 12, home: { player: 'Joe Peters', hit: 'S15x2', marks: 2 }, away: { player: 'Christian Ketchem', hit: 'S15x2', marks: 2 } },
                { round: 13, home: { player: 'Joe Peters', hit: 'S18, DB', marks: 3, points: 144 }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } },
                { round: 14, home: { player: 'Joe Peters', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true }, away: { player: 'Christian Ketchem', hit: '-', marks: 0 } }
            ]
        }]
    },
    // SET 6 - Games 6.1 & 6.2 (singles: Matt Pagel vs Donnie Pagel)
    {
        set: 6, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Matt Pagel'], away_players: ['Donnie Pagel'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 291,
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 53.38, darts: 24, points: 427, remaining: 74 },
            away_stats: { three_dart_avg: 55.67, darts: 27, points: 501 },
            player_stats: { 'Matt Pagel': { darts: 24, points: 427, three_dart_avg: 53.38 }, 'Donnie Pagel': { darts: 27, points: 501, three_dart_avg: 55.67 } },
            checkout: 53, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Matt Pagel', score: 26, remaining: 475 }, away: { player: 'Donnie Pagel', score: 39, remaining: 462 } },
                { round: 2, home: { player: 'Matt Pagel', score: 41, remaining: 434 }, away: { player: 'Donnie Pagel', score: 100, remaining: 362, notable: '100' } },
                { round: 3, home: { player: 'Matt Pagel', score: 43, remaining: 391 }, away: { player: 'Donnie Pagel', score: 66, remaining: 296 } },
                { round: 4, home: { player: 'Matt Pagel', score: 45, remaining: 346 }, away: { player: 'Donnie Pagel', score: 38, remaining: 258 } },
                { round: 5, home: { player: 'Matt Pagel', score: 85, remaining: 261 }, away: { player: 'Donnie Pagel', score: 41, remaining: 217 } },
                { round: 6, home: { player: 'Matt Pagel', score: 60, remaining: 201 }, away: { player: 'Donnie Pagel', score: 59, remaining: 158 } },
                { round: 7, home: { player: 'Matt Pagel', score: 83, remaining: 118 }, away: { player: 'Donnie Pagel', score: 94, remaining: 64 } },
                { round: 8, home: { player: 'Matt Pagel', score: 44, remaining: 74 }, away: { player: 'Donnie Pagel', score: 11, remaining: 53 } },
                { round: 9, home: null, away: { player: 'Donnie Pagel', score: 53, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    {
        set: 6, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Matt Pagel'], away_players: ['Donnie Pagel'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 324,
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 52.78, darts: 27, points: 475, remaining: 26 },
            away_stats: { three_dart_avg: 50.1, darts: 30, points: 501 },
            player_stats: { 'Matt Pagel': { darts: 27, points: 475, three_dart_avg: 52.78 }, 'Donnie Pagel': { darts: 30, points: 501, three_dart_avg: 50.1 } },
            checkout: 10, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Matt Pagel', score: 52, remaining: 449 }, away: { player: 'Donnie Pagel', score: 100, remaining: 401, notable: '100' } },
                { round: 2, home: { player: 'Matt Pagel', score: 85, remaining: 364 }, away: { player: 'Donnie Pagel', score: 60, remaining: 341 } },
                { round: 3, home: { player: 'Matt Pagel', score: 30, remaining: 334 }, away: { player: 'Donnie Pagel', score: 24, remaining: 317 } },
                { round: 4, home: { player: 'Matt Pagel', score: 140, remaining: 194, notable: '140' }, away: { player: 'Donnie Pagel', score: 41, remaining: 276 } },
                { round: 5, home: { player: 'Matt Pagel', score: 40, remaining: 154 }, away: { player: 'Donnie Pagel', score: 28, remaining: 248 } },
                { round: 6, home: { player: 'Matt Pagel', score: 32, remaining: 122 }, away: { player: 'Donnie Pagel', score: 135, remaining: 113, notable: '135' } },
                { round: 7, home: { player: 'Matt Pagel', score: 76, remaining: 46 }, away: { player: 'Donnie Pagel', score: 57, remaining: 56 } },
                { round: 8, home: { player: 'Matt Pagel', score: 20, remaining: 26 }, away: { player: 'Donnie Pagel', score: 16, remaining: 40 } },
                { round: 9, home: { player: 'Matt Pagel', score: 0, remaining: 26 }, away: { player: 'Donnie Pagel', score: 30, remaining: 10 } },
                { round: 10, home: null, away: { player: 'Donnie Pagel', score: 10, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    // SET 7 - Games 7.1, 7.2, 7.3 (doubles)
    {
        set: 7, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Matt Pagel', 'John Linden'], away_players: ['Donnie Pagel', 'Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 417,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 50.1, darts: 30, points: 501 },
            away_stats: { three_dart_avg: 51.22, darts: 27, points: 461, remaining: 40 },
            player_stats: {
                'Matt Pagel': { darts: 15, points: 194, three_dart_avg: 38.8 },
                'John Linden': { darts: 15, points: 307, three_dart_avg: 61.4 },
                'Donnie Pagel': { darts: 15, points: 245, three_dart_avg: 49.0 },
                'Jenn M': { darts: 12, points: 216, three_dart_avg: 54.0 }
            },
            checkout: 18, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Matt Pagel', score: 45, remaining: 456 }, away: { player: 'Donnie Pagel', score: 55, remaining: 446 } },
                { round: 2, home: { player: 'John Linden', score: 121, remaining: 335, notable: '121' }, away: { player: 'Jenn M', score: 100, remaining: 346, notable: '100' } },
                { round: 3, home: { player: 'Matt Pagel', score: 41, remaining: 294 }, away: { player: 'Donnie Pagel', score: 58, remaining: 288 } },
                { round: 4, home: { player: 'John Linden', score: 45, remaining: 249 }, away: { player: 'Jenn M', score: 6, remaining: 282 } },
                { round: 5, home: { player: 'Matt Pagel', score: 26, remaining: 223 }, away: { player: 'Donnie Pagel', score: 66, remaining: 216 } },
                { round: 6, home: { player: 'John Linden', score: 79, remaining: 144 }, away: { player: 'Jenn M', score: 81, remaining: 135 } },
                { round: 7, home: { player: 'Matt Pagel', score: 58, remaining: 86 }, away: { player: 'Donnie Pagel', score: 46, remaining: 89 } },
                { round: 8, home: { player: 'John Linden', score: 44, remaining: 42 }, away: { player: 'Jenn M', score: 29, remaining: 60 } },
                { round: 9, home: { player: 'Matt Pagel', score: 24, remaining: 18 }, away: { player: 'Donnie Pagel', score: 20, remaining: 40 } },
                { round: 10, home: { player: 'John Linden', score: 18, remaining: 0, checkout: true, checkout_darts: 3 }, away: null }
            ]
        }]
    },
    {
        set: 7, game_in_set: 2, format: 'cricket',
        home_players: ['Matt Pagel', 'John Linden'], away_players: ['Donnie Pagel', 'Jenn M'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 471,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 13, closeout_darts: 2, // Donnie threw SBx2 = 2 darts to close
            home_stats: { mpr: 2.08, darts: 36, marks: 25, points: 119 },
            away_stats: { mpr: 2.15, darts: 39, marks: 28, points: 140 },
            player_stats: {
                'Matt Pagel': { darts: 18, marks: 21, mpr: 3.5 },
                'John Linden': { darts: 18, marks: 4, mpr: 0.67 },
                'Donnie Pagel': { darts: 21, marks: 22, mpr: 3.14 },
                'Jenn M': { darts: 18, marks: 6, mpr: 1.0 }
            },
            throws: [
                { round: 1, home: { player: 'Matt Pagel', hit: 'S19, T19', marks: 4, points: 19 }, away: { player: 'Donnie Pagel', hit: 'S20, T20', marks: 4 } },
                { round: 2, home: { player: 'John Linden', hit: 'S19', marks: 1, points: 38 }, away: { player: 'Jenn M', hit: 'S19, S20', marks: 2, points: 40 } },
                { round: 3, home: { player: 'Matt Pagel', hit: 'T18', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S19x2, T20', marks: 5, points: 100, notable: '5M' } },
                { round: 4, home: { player: 'John Linden', hit: 'S18', marks: 1, points: 56 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 5, home: { player: 'Matt Pagel', hit: 'S17x3', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S18x3', marks: 3 } },
                { round: 6, home: { player: 'John Linden', hit: 'S17', marks: 1, points: 73 }, away: { player: 'Jenn M', hit: 'S17', marks: 1 } },
                { round: 7, home: { player: 'Matt Pagel', hit: 'S16, T16', marks: 4, points: 89 }, away: { player: 'Donnie Pagel', hit: 'S17, T17', marks: 4 } },
                { round: 8, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'S16, S20', marks: 2, points: 120 } },
                { round: 9, home: { player: 'Matt Pagel', hit: 'S15, T15', marks: 4, points: 104 }, away: { player: 'Donnie Pagel', hit: 'S15, S16x2', marks: 3 } },
                { round: 10, home: { player: 'John Linden', hit: 'S15', marks: 1, points: 119 }, away: { player: 'Jenn M', hit: '-', marks: 0 } },
                { round: 11, home: { player: 'Matt Pagel', hit: 'T20', marks: 3 }, away: { player: 'Donnie Pagel', hit: 'S15x2, S20', marks: 3, points: 140 } },
                { round: 12, home: { player: 'John Linden', hit: '-', marks: 0 }, away: { player: 'Jenn M', hit: 'SB', marks: 1 } },
                { round: 13, home: null, away: { player: 'Donnie Pagel', hit: 'SBx2', marks: 2, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    {
        set: 7, game_in_set: 3, format: 'cricket',
        home_players: ['Matt Pagel', 'John Linden'], away_players: ['Donnie Pagel', 'Jenn M'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 527,
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 13, closeout_darts: 2, // Donnie threw SBx2 = 2 darts to close
            home_stats: { mpr: 2.5, darts: 36, marks: 30, points: 176 },
            away_stats: { mpr: 2.69, darts: 39, marks: 35, points: 222 },
            player_stats: {
                'Matt Pagel': { darts: 18, marks: 18, mpr: 3.0 },
                'John Linden': { darts: 18, marks: 12, mpr: 2.0 },
                'Donnie Pagel': { darts: 21, marks: 15, mpr: 2.14 },
                'Jenn M': { darts: 18, marks: 20, mpr: 3.33 }
            },
            throws: [
                { round: 1, home: { player: 'Matt Pagel', hit: 'S20, T20', marks: 4, points: 20 }, away: { player: 'Donnie Pagel', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'John Linden', hit: 'S19, T19', marks: 4, points: 39 }, away: { player: 'Jenn M', hit: 'S19', marks: 1 } },
                { round: 3, home: { player: 'Matt Pagel', hit: 'S17, T18', marks: 4 }, away: { player: 'Donnie Pagel', hit: 'S18x2, T18', marks: 5, points: 36, notable: '5M' } },
                { round: 4, home: { player: 'John Linden', hit: 'S17', marks: 1 }, away: { player: 'Jenn M', hit: 'S17x2, S19', marks: 3 } },
                { round: 5, home: { player: 'Matt Pagel', hit: 'S20, S17', marks: 2, points: 59 }, away: { player: 'Donnie Pagel', hit: 'S17x2', marks: 2, points: 53 } },
                { round: 6, home: { player: 'John Linden', hit: 'T19, S16', marks: 4, points: 116 }, away: { player: 'Jenn M', hit: 'T16x2, S16', marks: 7, points: 117, notable: '7M' } },
                { round: 7, home: { player: 'Matt Pagel', hit: 'S16x2, T20', marks: 5, points: 176, notable: '5M' }, away: { player: 'Donnie Pagel', hit: 'S19, S20', marks: 2 } },
                { round: 8, home: { player: 'John Linden', hit: 'S15', marks: 1 }, away: { player: 'Jenn M', hit: 'T15, S15', marks: 4, points: 132 } },
                { round: 9, home: { player: 'Matt Pagel', hit: 'S15', marks: 1 }, away: { player: 'Donnie Pagel', hit: 'S20, S15', marks: 2, points: 147 } },
                { round: 10, home: { player: 'John Linden', hit: 'SB', marks: 1 }, away: { player: 'Jenn M', hit: 'T15, S15', marks: 4, points: 207 } },
                { round: 11, home: { player: 'Matt Pagel', hit: 'DB', marks: 2 }, away: { player: 'Donnie Pagel', hit: 'SB', marks: 1 } },
                { round: 12, home: { player: 'John Linden', hit: 'S15', marks: 1 }, away: { player: 'Jenn M', hit: 'S15', marks: 1, points: 222 } },
                { round: 13, home: null, away: { player: 'Donnie Pagel', hit: 'SBx2', marks: 2, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 8 - Games 8.1, 8.2, 8.3 (singles: Joe Peters vs Christian Ketchem)
    {
        set: 8, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Peters'], away_players: ['Christian Ketchem'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 350,
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 51.22, darts: 27, points: 461, remaining: 40 },
            away_stats: { three_dart_avg: 51.83, darts: 29, points: 501 },
            player_stats: { 'Joe Peters': { darts: 27, points: 461, three_dart_avg: 51.22 }, 'Christian Ketchem': { darts: 29, points: 501, three_dart_avg: 51.83 } },
            checkout: 47, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Joe Peters', score: 100, remaining: 401, notable: '100' }, away: { player: 'Christian Ketchem', score: 83, remaining: 418 } },
                { round: 2, home: { player: 'Joe Peters', score: 26, remaining: 375 }, away: { player: 'Christian Ketchem', score: 50, remaining: 368 } },
                { round: 3, home: { player: 'Joe Peters', score: 41, remaining: 334 }, away: { player: 'Christian Ketchem', score: 39, remaining: 329 } },
                { round: 4, home: { player: 'Joe Peters', score: 11, remaining: 323 }, away: { player: 'Christian Ketchem', score: 85, remaining: 244 } },
                { round: 5, home: { player: 'Joe Peters', score: 43, remaining: 280 }, away: { player: 'Christian Ketchem', score: 41, remaining: 203 } },
                { round: 6, home: { player: 'Joe Peters', score: 95, remaining: 185, notable: '95' }, away: { player: 'Christian Ketchem', score: 41, remaining: 162 } },
                { round: 7, home: { player: 'Joe Peters', score: 45, remaining: 140 }, away: { player: 'Christian Ketchem', score: 80, remaining: 82 } },
                { round: 8, home: { player: 'Joe Peters', score: 64, remaining: 76 }, away: { player: 'Christian Ketchem', score: 10, remaining: 72 } },
                { round: 9, home: { player: 'Joe Peters', score: 36, remaining: 40 }, away: { player: 'Christian Ketchem', score: 25, remaining: 47 } },
                { round: 10, home: null, away: { player: 'Christian Ketchem', score: 47, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },
    {
        set: 8, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Peters'], away_players: ['Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 421,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 44.21, darts: 34, points: 501 },
            away_stats: { three_dart_avg: 41.82, darts: 33, points: 460, remaining: 41 },
            player_stats: { 'Joe Peters': { darts: 34, points: 501, three_dart_avg: 44.21 }, 'Christian Ketchem': { darts: 33, points: 460, three_dart_avg: 41.82 } },
            checkout: 10, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Joe Peters', score: 43, remaining: 458 }, away: { player: 'Christian Ketchem', score: 41, remaining: 460 } },
                { round: 2, home: { player: 'Joe Peters', score: 60, remaining: 398 }, away: { player: 'Christian Ketchem', score: 43, remaining: 417 } },
                { round: 3, home: { player: 'Joe Peters', score: 41, remaining: 357 }, away: { player: 'Christian Ketchem', score: 19, remaining: 398 } },
                { round: 4, home: { player: 'Joe Peters', score: 25, remaining: 332 }, away: { player: 'Christian Ketchem', score: 58, remaining: 340 } },
                { round: 5, home: { player: 'Joe Peters', score: 67, remaining: 265 }, away: { player: 'Christian Ketchem', score: 46, remaining: 294 } },
                { round: 6, home: { player: 'Joe Peters', score: 45, remaining: 220 }, away: { player: 'Christian Ketchem', score: 71, remaining: 223 } },
                { round: 7, home: { player: 'Joe Peters', score: 70, remaining: 150 }, away: { player: 'Christian Ketchem', score: 24, remaining: 199 } },
                { round: 8, home: { player: 'Joe Peters', score: 32, remaining: 118 }, away: { player: 'Christian Ketchem', score: 26, remaining: 173 } },
                { round: 9, home: { player: 'Joe Peters', score: 78, remaining: 40 }, away: { player: 'Christian Ketchem', score: 55, remaining: 118 } },
                { round: 10, home: { player: 'Joe Peters', score: 30, remaining: 10 }, away: { player: 'Christian Ketchem', score: 40, remaining: 78 } },
                { round: 11, home: { player: 'Joe Peters', score: 0, remaining: 10 }, away: { player: 'Christian Ketchem', score: 37, remaining: 41 } },
                { round: 12, home: { player: 'Joe Peters', score: 10, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    {
        set: 8, game_in_set: 3, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Peters'], away_players: ['Christian Ketchem'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 311,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 68.32, darts: 22, points: 501 },
            away_stats: { three_dart_avg: 51.14, darts: 21, points: 358, remaining: 143 },
            player_stats: { 'Joe Peters': { darts: 22, points: 501, three_dart_avg: 68.32 }, 'Christian Ketchem': { darts: 21, points: 358, three_dart_avg: 51.14 } },
            checkout: 16, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Joe Peters', score: 83, remaining: 418 }, away: { player: 'Christian Ketchem', score: 90, remaining: 411 } },
                { round: 2, home: { player: 'Joe Peters', score: 45, remaining: 373 }, away: { player: 'Christian Ketchem', score: 60, remaining: 351 } },
                { round: 3, home: { player: 'Joe Peters', score: 60, remaining: 313 }, away: { player: 'Christian Ketchem', score: 36, remaining: 315 } },
                { round: 4, home: { player: 'Joe Peters', score: 95, remaining: 218, notable: '95' }, away: { player: 'Christian Ketchem', score: 57, remaining: 258 } },
                { round: 5, home: { player: 'Joe Peters', score: 90, remaining: 128 }, away: { player: 'Christian Ketchem', score: 30, remaining: 228 } },
                { round: 6, home: { player: 'Joe Peters', score: 44, remaining: 84 }, away: { player: 'Christian Ketchem', score: 40, remaining: 188 } },
                { round: 7, home: { player: 'Joe Peters', score: 68, remaining: 16 }, away: { player: 'Christian Ketchem', score: 45, remaining: 143 } },
                { round: 8, home: { player: 'Joe Peters', score: 16, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    // SET 9 - Games 9.1, 9.2, 9.3 (singles: John Linden vs Jenn M)
    {
        set: 9, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['John Linden'], away_players: ['Jenn M'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 432,
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 44.64, darts: 33, points: 491, remaining: 10 },
            away_stats: { three_dart_avg: 45.55, darts: 33, points: 501 },
            player_stats: { 'John Linden': { darts: 33, points: 491, three_dart_avg: 44.64 }, 'Jenn M': { darts: 33, points: 501, three_dart_avg: 45.55 } },
            checkout: 45, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'John Linden', score: 9, remaining: 492 }, away: { player: 'Jenn M', score: 81, remaining: 420 } },
                { round: 2, home: { player: 'John Linden', score: 29, remaining: 463 }, away: { player: 'Jenn M', score: 60, remaining: 360 } },
                { round: 3, home: { player: 'John Linden', score: 56, remaining: 407 }, away: { player: 'Jenn M', score: 45, remaining: 315 } },
                { round: 4, home: { player: 'John Linden', score: 83, remaining: 324 }, away: { player: 'Jenn M', score: 5, remaining: 310 } },
                { round: 5, home: { player: 'John Linden', score: 67, remaining: 257 }, away: { player: 'Jenn M', score: 60, remaining: 250 } },
                { round: 6, home: { player: 'John Linden', score: 45, remaining: 212 }, away: { player: 'Jenn M', score: 29, remaining: 221 } },
                { round: 7, home: { player: 'John Linden', score: 95, remaining: 117, notable: '95' }, away: { player: 'Jenn M', score: 41, remaining: 180 } },
                { round: 8, home: { player: 'John Linden', score: 97, remaining: 20, notable: '97' }, away: { player: 'Jenn M', score: 45, remaining: 135 } },
                { round: 9, home: { player: 'John Linden', score: 10, remaining: 10 }, away: { player: 'Jenn M', score: 45, remaining: 90 } },
                { round: 10, home: { player: 'John Linden', score: 0, remaining: 10 }, away: { player: 'Jenn M', score: 45, remaining: 45 } },
                { round: 11, home: { player: 'John Linden', score: 0, remaining: 10 }, away: { player: 'Jenn M', score: 45, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    {
        set: 9, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['John Linden'], away_players: ['Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 405,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 44.21, darts: 34, points: 501 },
            away_stats: { three_dart_avg: 40.58, darts: 36, points: 487, remaining: 14 },
            player_stats: { 'John Linden': { darts: 34, points: 501, three_dart_avg: 44.21 }, 'Jenn M': { darts: 36, points: 487, three_dart_avg: 40.58 } },
            checkout: 32, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'John Linden', score: 41, remaining: 460 }, away: { player: 'Jenn M', score: 31, remaining: 470 } },
                { round: 2, home: { player: 'John Linden', score: 29, remaining: 431 }, away: { player: 'Jenn M', score: 43, remaining: 427 } },
                { round: 3, home: { player: 'John Linden', score: 49, remaining: 382 }, away: { player: 'Jenn M', score: 55, remaining: 372 } },
                { round: 4, home: { player: 'John Linden', score: 43, remaining: 339 }, away: { player: 'Jenn M', score: 60, remaining: 312 } },
                { round: 5, home: { player: 'John Linden', score: 29, remaining: 310 }, away: { player: 'Jenn M', score: 45, remaining: 267 } },
                { round: 6, home: { player: 'John Linden', score: 67, remaining: 243 }, away: { player: 'Jenn M', score: 85, remaining: 182 } },
                { round: 7, home: { player: 'John Linden', score: 41, remaining: 202 }, away: { player: 'Jenn M', score: 26, remaining: 156 } },
                { round: 8, home: { player: 'John Linden', score: 47, remaining: 155 }, away: { player: 'Jenn M', score: 21, remaining: 135 } },
                { round: 9, home: { player: 'John Linden', score: 71, remaining: 84 }, away: { player: 'Jenn M', score: 65, remaining: 70 } },
                { round: 10, home: { player: 'John Linden', score: 28, remaining: 56 }, away: { player: 'Jenn M', score: 30, remaining: 40 } },
                { round: 11, home: { player: 'John Linden', score: 24, remaining: 32 }, away: { player: 'Jenn M', score: 20, remaining: 20 } },
                { round: 12, home: { player: 'John Linden', score: 32, remaining: 0, checkout: true, checkout_darts: 1 }, away: { player: 'Jenn M', score: 6, remaining: 14 } }
            ]
        }]
    },
    {
        set: 9, game_in_set: 3, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['John Linden'], away_players: ['Jenn M'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 433,
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 44.21, darts: 34, points: 501 },
            away_stats: { three_dart_avg: 38.42, darts: 36, points: 461, remaining: 40 },
            player_stats: { 'John Linden': { darts: 34, points: 501, three_dart_avg: 44.21 }, 'Jenn M': { darts: 36, points: 461, three_dart_avg: 38.42 } },
            checkout: 18, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'John Linden', score: 83, remaining: 418 }, away: { player: 'Jenn M', score: 25, remaining: 476 } },
                { round: 2, home: { player: 'John Linden', score: 43, remaining: 375 }, away: { player: 'Jenn M', score: 46, remaining: 430 } },
                { round: 3, home: { player: 'John Linden', score: 83, remaining: 292 }, away: { player: 'Jenn M', score: 22, remaining: 408 } },
                { round: 4, home: { player: 'John Linden', score: 31, remaining: 261 }, away: { player: 'Jenn M', score: 85, remaining: 323 } },
                { round: 5, home: { player: 'John Linden', score: 33, remaining: 228 }, away: { player: 'Jenn M', score: 66, remaining: 257 } },
                { round: 6, home: { player: 'John Linden', score: 47, remaining: 181 }, away: { player: 'Jenn M', score: 5, remaining: 252 } },
                { round: 7, home: { player: 'John Linden', score: 95, remaining: 86, notable: '95' }, away: { player: 'Jenn M', score: 13, remaining: 239 } },
                { round: 8, home: { player: 'John Linden', score: 36, remaining: 50 }, away: { player: 'Jenn M', score: 100, remaining: 139, notable: '100' } },
                { round: 9, home: { player: 'John Linden', score: 32, remaining: 18 }, away: { player: 'Jenn M', score: 11, remaining: 128 } },
                { round: 10, home: { player: 'John Linden', score: 0, remaining: 18 }, away: { player: 'Jenn M', score: 37, remaining: 91 } },
                { round: 11, home: { player: 'John Linden', score: 0, remaining: 18 }, away: { player: 'Jenn M', score: 31, remaining: 60 } },
                { round: 12, home: { player: 'John Linden', score: 18, remaining: 0, checkout: true, checkout_darts: 1 }, away: { player: 'Jenn M', score: 20, remaining: 40 } }
            ]
        }]
    }
];

exports.populatePagelMatch = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
            const MATCH_ID = 'sgmoL4GyVUYP67aOS7wm';

            const matchRef = db.collection('leagues').doc(LEAGUE_ID)
                .collection('matches').doc(MATCH_ID);

            // Calculate final scores
            let homeScore = 0;
            let awayScore = 0;
            games.forEach(game => {
                if (game.winner === 'home') homeScore++;
                else if (game.winner === 'away') awayScore++;
            });

            const updateData = {
                ...matchMetadata,
                home_score: homeScore,
                away_score: awayScore,
                games: games,
                status: 'completed',
                winner: homeScore > awayScore ? 'home' : 'away',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            await matchRef.update(updateData);

            res.json({
                success: true,
                message: 'Match data populated successfully',
                home_score: homeScore,
                away_score: awayScore,
                total_games: games.length
            });
        } catch (error) {
            console.error('Error populating match:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

module.exports = { populatePagelMatch: exports.populatePagelMatch };
