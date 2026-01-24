/**
 * Populate Partlo vs Olschansky Match Data
 * Week 1 - 20 games total
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

const partloOlschanskyMetadata = {
    match_date: new Date('2026-01-14'),
    start_time: new Date('2026-01-14T19:33:00'),
    end_time: new Date('2026-01-14T22:01:00'),
    game_time_minutes: 129,
    match_length_minutes: 148,
    total_darts: 1400,
    total_games: 20,
    total_sets: 9,
    der: 87
};

const partloOlschanskyGames = [
    // SET 1 - Game 1.1 - 501 SIDO
    {
        set: 1, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dan Partlo', 'Joe Donley'], away_players: ['Eddie Olschansky', 'Jeff Boss'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 329,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 53.38, darts: 24, points: 427, remaining: 74 },
            away_stats: { three_dart_avg: 57.81, darts: 26, points: 501 },
            player_stats: {
                'Dan Partlo': { darts: 12, points: 242, three_dart_avg: 60.5 },
                'Joe Donley': { darts: 12, points: 185, three_dart_avg: 46.25 },
                'Eddie Olschansky': { darts: 14, points: 313, three_dart_avg: 67.07 },
                'Jeff Boss': { darts: 12, points: 188, three_dart_avg: 47.0 }
            },
            checkout: 33, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Dan Partlo', score: 11, remaining: 490 }, away: { player: 'Eddie Olschansky', score: 60, remaining: 441 } },
                { round: 2, home: { player: 'Joe Donley', score: 41, remaining: 449 }, away: { player: 'Jeff Boss', score: 43, remaining: 398 } },
                { round: 3, home: { player: 'Dan Partlo', score: 116, remaining: 333, notable: '116' }, away: { player: 'Eddie Olschansky', score: 96, remaining: 302, notable: '96' } },
                { round: 4, home: { player: 'Joe Donley', score: 57, remaining: 276 }, away: { player: 'Jeff Boss', score: 40, remaining: 262 } },
                { round: 5, home: { player: 'Dan Partlo', score: 76, remaining: 200 }, away: { player: 'Eddie Olschansky', score: 20, remaining: 242 } },
                { round: 6, home: { player: 'Joe Donley', score: 50, remaining: 150 }, away: { player: 'Jeff Boss', score: 81, remaining: 161 } },
                { round: 7, home: { player: 'Dan Partlo', score: 39, remaining: 111 }, away: { player: 'Eddie Olschansky', score: 97, remaining: 64, notable: '97' } },
                { round: 8, home: { player: 'Joe Donley', score: 37, remaining: 74 }, away: { player: 'Jeff Boss', score: 31, remaining: 33 } },
                { round: 9, home: null, away: { player: 'Eddie Olschansky', score: 33, remaining: 0, checkout: true, checkout_darts: 2 } }
            ]
        }]
    },
    // SET 1 - Game 1.2 - Cricket (Long game!)
    {
        set: 1, game_in_set: 2, format: 'cricket',
        home_players: ['Dan Partlo', 'Joe Donley'], away_players: ['Eddie Olschansky', 'Jeff Boss'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 869,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 23, closeout_darts: 2,
            home_stats: { mpr: 2.2, darts: 66, marks: 49, points: 605 },
            away_stats: { mpr: 2.6, darts: 68, marks: 59, points: 618 },
            player_stats: {
                'Dan Partlo': { darts: 33, marks: 26, mpr: 2.36 },
                'Joe Donley': { darts: 33, marks: 23, mpr: 2.09 },
                'Eddie Olschansky': { darts: 35, marks: 36, mpr: 3.09 },
                'Jeff Boss': { darts: 33, marks: 23, mpr: 2.09 }
            },
            throws: [
                { round: 1, home: { player: 'Dan Partlo', hit: 'T20, S20x2', marks: 5, notable: '5M' }, away: { player: 'Eddie Olschansky', hit: 'D19', marks: 2 } },
                { round: 2, home: { player: 'Joe Donley', hit: 'S19, S20', marks: 2, points: 60 }, away: { player: 'Jeff Boss', hit: 'T19, S17x2', marks: 5, notable: '5M', points: 38 } },
                { round: 3, home: { player: 'Dan Partlo', hit: 'S19', marks: 1, points: 60 }, away: { player: 'Eddie Olschansky', hit: 'T19, S19', marks: 4, points: 114 } },
                { round: 4, home: { player: 'Joe Donley', hit: 'S20x3', marks: 3, points: 120 }, away: { player: 'Jeff Boss', hit: 'S17, S16', marks: 2, points: 114 } },
                { round: 5, home: { player: 'Dan Partlo', hit: 'S17, S19, S20', marks: 3, points: 140 }, away: { player: 'Eddie Olschansky', hit: 'T17', marks: 3, points: 165 } },
                { round: 6, home: { player: 'Joe Donley', hit: 'S20x3', marks: 3, points: 200 }, away: { player: 'Jeff Boss', hit: 'T17', marks: 3, points: 216 } },
                { round: 7, home: { player: 'Dan Partlo', hit: 'S20x2', marks: 2, points: 240 }, away: { player: 'Eddie Olschansky', hit: 'D17', marks: 2, points: 250 } },
                { round: 8, home: { player: 'Joe Donley', hit: 'S17, S20', marks: 2, points: 260 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 250 } },
                { round: 9, home: { player: 'Dan Partlo', hit: 'T17, S18', marks: 4, points: 260 }, away: { player: 'Eddie Olschansky', hit: 'D16', marks: 2, points: 250 } },
                { round: 10, home: { player: 'Joe Donley', hit: 'S18x2', marks: 2, points: 260 }, away: { player: 'Jeff Boss', hit: 'S16x2', marks: 2, points: 282 } },
                { round: 11, home: { player: 'Dan Partlo', hit: 'S20x3', marks: 3, points: 320 }, away: { player: 'Eddie Olschansky', hit: 'T16', marks: 3, points: 330 } },
                { round: 12, home: { player: 'Joe Donley', hit: 'S20x2', marks: 2, points: 360 }, away: { player: 'Jeff Boss', hit: 'S16, T16', marks: 4, points: 394 } },
                { round: 13, home: { player: 'Dan Partlo', hit: 'S20x3', marks: 3, points: 420 }, away: { player: 'Eddie Olschansky', hit: 'T16', marks: 3, points: 442 } },
                { round: 14, home: { player: 'Joe Donley', hit: '-', marks: 0, points: 420 }, away: { player: 'Jeff Boss', hit: 'S20, T18', marks: 4, points: 442 } },
                { round: 15, home: { player: 'Dan Partlo', hit: 'S20x2', marks: 2, points: 460 }, away: { player: 'Eddie Olschansky', hit: 'T16', marks: 3, points: 490 } },
                { round: 16, home: { player: 'Joe Donley', hit: 'T20, S16', marks: 4, points: 520 }, away: { player: 'Jeff Boss', hit: 'S16', marks: 1, points: 506 } },
                { round: 17, home: { player: 'Dan Partlo', hit: '-', marks: 0, points: 520 }, away: { player: 'Eddie Olschansky', hit: 'T16, S20', marks: 4, points: 554 } },
                { round: 18, home: { player: 'Joe Donley', hit: 'S20x2', marks: 2, points: 560 }, away: { player: 'Jeff Boss', hit: 'S16', marks: 1, points: 570 } },
                { round: 19, home: { player: 'Dan Partlo', hit: '-', marks: 0, points: 560 }, away: { player: 'Eddie Olschansky', hit: 'S20, S15', marks: 2, points: 570 } },
                { round: 20, home: { player: 'Joe Donley', hit: 'S15x2', marks: 2, points: 560 }, away: { player: 'Jeff Boss', hit: 'S15', marks: 1, points: 570 } },
                { round: 21, home: { player: 'Dan Partlo', hit: 'S15, T15', marks: 4, points: 605 }, away: { player: 'Eddie Olschansky', hit: 'D16', marks: 2, points: 602 } },
                { round: 22, home: { player: 'Joe Donley', hit: 'S16', marks: 1, points: 605 }, away: { player: 'Jeff Boss', hit: 'T15, S16', marks: 4, points: 618 } },
                { round: 23, home: { player: 'Dan Partlo', hit: 'DB', marks: 2, points: 605 }, away: { player: 'Eddie Olschansky', hit: 'DB, SB', marks: 3, notable: '3B', closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 2 - Game 2.1 - Cricket (Singles: Kevin Mckelvey vs Mike Gonzales)
    {
        set: 2, game_in_set: 1, format: 'cricket',
        home_players: ['Kevin Mckelvey'], away_players: ['Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 270,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 10, closeout_darts: 3,
            home_stats: { mpr: 1.3, darts: 30, marks: 13, points: 46 },
            away_stats: { mpr: 2.8, darts: 30, marks: 28, points: 139 },
            player_stats: {
                'Kevin Mckelvey': { darts: 30, marks: 13, mpr: 1.3 },
                'Mike Gonzales': { darts: 30, marks: 28, mpr: 2.8 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0 }, away: { player: 'Mike Gonzales', hit: 'D20', marks: 2 } },
                { round: 3, home: { player: 'Kevin Mckelvey', hit: 'S19', marks: 1 }, away: { player: 'Mike Gonzales', hit: 'T19, S19, T20', marks: 7, notable: '7M', points: 79 } },
                { round: 4, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0 }, away: { player: 'Mike Gonzales', hit: 'T18, D17', marks: 5, notable: '5M', points: 79 } },
                { round: 5, home: { player: 'Kevin Mckelvey', hit: 'T16, S16', marks: 4, points: 16 }, away: { player: 'Mike Gonzales', hit: 'T16', marks: 3, points: 79 } },
                { round: 6, home: { player: 'Kevin Mckelvey', hit: 'T15, D15', marks: 5, notable: '5M', points: 46 }, away: { player: 'Mike Gonzales', hit: 'T15, S17', marks: 4, points: 79 } },
                { round: 7, home: { player: 'Kevin Mckelvey', hit: 'SB', marks: 1, points: 46 }, away: { player: 'Mike Gonzales', hit: 'SB, S20', marks: 2, points: 99 } },
                { round: 8, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0, points: 46 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 119 } },
                { round: 9, home: { player: 'Kevin Mckelvey', hit: 'S19', marks: 1, points: 46 }, away: { player: 'Mike Gonzales', hit: 'SB', marks: 1, points: 119 } },
                { round: 10, home: { player: 'Kevin Mckelvey', hit: 'S19', marks: 1, points: 46 }, away: { player: 'Mike Gonzales', hit: 'SB, S20', marks: 2, points: 139, closeout_darts: 3, closed_out: true } }
            ]
        }]
    },
    // SET 2 - Game 2.2 - Cricket
    {
        set: 2, game_in_set: 2, format: 'cricket',
        home_players: ['Kevin Mckelvey'], away_players: ['Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 344,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 13, closeout_darts: 2,
            home_stats: { mpr: 1.3, darts: 39, marks: 17, points: 84 },
            away_stats: { mpr: 2.1, darts: 38, marks: 26, points: 108 },
            player_stats: {
                'Kevin Mckelvey': { darts: 39, marks: 17, mpr: 1.31 },
                'Mike Gonzales': { darts: 38, marks: 26, mpr: 2.05 }
            },
            throws: [
                { round: 1, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0 }, away: { player: 'Mike Gonzales', hit: 'D20', marks: 2 } },
                { round: 2, home: { player: 'Kevin Mckelvey', hit: 'D20, S20', marks: 3 }, away: { player: 'Mike Gonzales', hit: 'S20, S19, S16', marks: 3 } },
                { round: 3, home: { player: 'Kevin Mckelvey', hit: 'S17x2', marks: 2 }, away: { player: 'Mike Gonzales', hit: 'T19', marks: 3, points: 19 } },
                { round: 4, home: { player: 'Kevin Mckelvey', hit: 'S17', marks: 1 }, away: { player: 'Mike Gonzales', hit: 'S19', marks: 1, points: 38 } },
                { round: 5, home: { player: 'Kevin Mckelvey', hit: 'S17x2', marks: 2, points: 34 }, away: { player: 'Mike Gonzales', hit: 'T17, S16', marks: 4, points: 38 } },
                { round: 6, home: { player: 'Kevin Mckelvey', hit: 'S18', marks: 1, points: 34 }, away: { player: 'Mike Gonzales', hit: 'T18', marks: 3, points: 38 } },
                { round: 7, home: { player: 'Kevin Mckelvey', hit: 'S15', marks: 1, points: 34 }, away: { player: 'Mike Gonzales', hit: 'S16, T15', marks: 4, points: 38 } },
                { round: 8, home: { player: 'Kevin Mckelvey', hit: 'SB', marks: 1, points: 34 }, away: { player: 'Mike Gonzales', hit: '-', marks: 0, points: 38 } },
                { round: 9, home: { player: 'Kevin Mckelvey', hit: 'SB', marks: 1, points: 34 }, away: { player: 'Mike Gonzales', hit: 'SB', marks: 1, points: 38 } },
                { round: 10, home: { player: 'Kevin Mckelvey', hit: 'S15', marks: 1, points: 34 }, away: { player: 'Mike Gonzales', hit: 'S15', marks: 1, points: 53 } },
                { round: 11, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0, points: 34 }, away: { player: 'Mike Gonzales', hit: 'SB, S18', marks: 2, points: 71 } },
                { round: 12, home: { player: 'Kevin Mckelvey', hit: 'S19, DB', marks: 3, points: 59 }, away: { player: 'Mike Gonzales', hit: 'S19', marks: 1, points: 90 } },
                { round: 13, home: { player: 'Kevin Mckelvey', hit: 'SB', marks: 1, points: 84 }, away: { player: 'Mike Gonzales', hit: 'S18, SB', marks: 2, points: 108, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 3 - Game 3.1 - Cricket (Dan Partlo vs Eddie)
    {
        set: 3, game_in_set: 1, format: 'cricket',
        home_players: ['Dan Partlo'], away_players: ['Eddie Olschansky'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 275,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 9, closeout_darts: 2,
            home_stats: { mpr: 2.0, darts: 24, marks: 16, points: 15 },
            away_stats: { mpr: 2.9, darts: 26, marks: 25, points: 79 },
            player_stats: {
                'Dan Partlo': { darts: 24, marks: 16, mpr: 2.0 },
                'Eddie Olschansky': { darts: 26, marks: 25, mpr: 2.88 }
            },
            throws: [
                { round: 1, home: { player: 'Dan Partlo', hit: 'S20x2', marks: 2 }, away: { player: 'Eddie Olschansky', hit: 'D20', marks: 2 } },
                { round: 2, home: { player: 'Dan Partlo', hit: 'S19, S20', marks: 2 }, away: { player: 'Eddie Olschansky', hit: 'S20', marks: 1 } },
                { round: 3, home: { player: 'Dan Partlo', hit: 'S18x3', marks: 3 }, away: { player: 'Eddie Olschansky', hit: 'T19, D19', marks: 5, notable: '5M', points: 38 } },
                { round: 4, home: { player: 'Dan Partlo', hit: 'S17x2', marks: 2 }, away: { player: 'Eddie Olschansky', hit: 'T18', marks: 3, points: 38 } },
                { round: 5, home: { player: 'Dan Partlo', hit: 'T15, S15', marks: 4, points: 15 }, away: { player: 'Eddie Olschansky', hit: 'S15, T17', marks: 4, points: 38 } },
                { round: 6, home: { player: 'Dan Partlo', hit: 'S16', marks: 1, points: 15 }, away: { player: 'Eddie Olschansky', hit: 'D15', marks: 2, points: 38 } },
                { round: 7, home: { player: 'Dan Partlo', hit: 'SB, S16', marks: 2, points: 15 }, away: { player: 'Eddie Olschansky', hit: 'T16, S16', marks: 4, points: 54 } },
                { round: 8, home: { player: 'Dan Partlo', hit: '-', marks: 0, points: 15 }, away: { player: 'Eddie Olschansky', hit: '-', marks: 0, points: 54 } },
                { round: 9, home: null, away: { player: 'Eddie Olschansky', hit: 'DBx2', marks: 4, notable: '4B', points: 79, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 3 - Game 3.2 - Cricket
    {
        set: 3, game_in_set: 2, format: 'cricket',
        home_players: ['Dan Partlo'], away_players: ['Eddie Olschansky'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 483,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 15, closeout_darts: 2,
            home_stats: { mpr: 3.0, darts: 45, marks: 45, points: 478 },
            away_stats: { mpr: 2.5, darts: 42, marks: 35, points: 440 },
            player_stats: {
                'Dan Partlo': { darts: 45, marks: 45, mpr: 3.0 },
                'Eddie Olschansky': { darts: 42, marks: 35, mpr: 2.5 }
            },
            throws: [
                { round: 1, home: { player: 'Dan Partlo', hit: 'T20x2', marks: 6, notable: '6M', points: 60 }, away: { player: 'Eddie Olschansky', hit: 'D20', marks: 2 } },
                { round: 2, home: { player: 'Dan Partlo', hit: 'T19, S19, T18', marks: 7, notable: '7M', points: 79 }, away: { player: 'Eddie Olschansky', hit: '-', marks: 0 } },
                { round: 3, home: { player: 'Dan Partlo', hit: 'S17x2', marks: 2, points: 79 }, away: { player: 'Eddie Olschansky', hit: 'T17, D17', marks: 5, notable: '5M', points: 34 } },
                { round: 4, home: { player: 'Dan Partlo', hit: 'T17', marks: 3, points: 79 }, away: { player: 'Eddie Olschansky', hit: 'D17', marks: 2, points: 68 } },
                { round: 5, home: { player: 'Dan Partlo', hit: 'S16x2', marks: 2, points: 79 }, away: { player: 'Eddie Olschansky', hit: 'S16', marks: 1, points: 68 } },
                { round: 6, home: { player: 'Dan Partlo', hit: 'S15, S16, T20', marks: 5, notable: '5M', points: 139 }, away: { player: 'Eddie Olschansky', hit: 'T16, S16', marks: 4, points: 100 } },
                { round: 7, home: { player: 'Dan Partlo', hit: 'T15, S19', marks: 4, points: 158 }, away: { player: 'Eddie Olschansky', hit: 'T15, S15', marks: 4, points: 115 } },
                { round: 8, home: { player: 'Dan Partlo', hit: '-', marks: 0, points: 158 }, away: { player: 'Eddie Olschansky', hit: 'DB, SB, S19', marks: 3, notable: '3B', points: 115 } },
                { round: 9, home: { player: 'Dan Partlo', hit: 'SB', marks: 1, points: 158 }, away: { player: 'Eddie Olschansky', hit: 'S18', marks: 1, points: 115 } },
                { round: 10, home: { player: 'Dan Partlo', hit: 'S20x3', marks: 3, points: 218 }, away: { player: 'Eddie Olschansky', hit: 'DB, SB', marks: 3, notable: '3B', points: 190 } },
                { round: 11, home: { player: 'Dan Partlo', hit: 'S20', marks: 1, points: 238 }, away: { player: 'Eddie Olschansky', hit: 'S19, DB', marks: 3, points: 240 } },
                { round: 12, home: { player: 'Dan Partlo', hit: 'T20, S20', marks: 4, points: 318 }, away: { player: 'Eddie Olschansky', hit: 'SB', marks: 1, points: 265 } },
                { round: 13, home: { player: 'Dan Partlo', hit: 'S20x2', marks: 2, points: 358 }, away: { player: 'Eddie Olschansky', hit: 'S18, SB', marks: 2, points: 290 } },
                { round: 14, home: { player: 'Dan Partlo', hit: 'T20x2', marks: 6, notable: '6M', points: 478 }, away: { player: 'Eddie Olschansky', hit: 'DB, SB', marks: 3, notable: '3B', points: 365 } },
                { round: 15, home: { player: 'Dan Partlo', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true }, away: { player: 'Eddie Olschansky', hit: 'DB, SB', marks: 3, notable: '3B', points: 440 } }
            ]
        }]
    },
    // SET 3 - Game 3.3 - Cricket (BO3)
    {
        set: 3, game_in_set: 3, format: 'cricket',
        home_players: ['Dan Partlo'], away_players: ['Eddie Olschansky'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 562,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 18, closeout_darts: 2,
            home_stats: { mpr: 2.5, darts: 54, marks: 45, points: 491 },
            away_stats: { mpr: 2.9, darts: 53, marks: 51, points: 533 },
            player_stats: {
                'Dan Partlo': { darts: 54, marks: 45, mpr: 2.5 },
                'Eddie Olschansky': { darts: 53, marks: 51, mpr: 2.89 }
            },
            throws: [
                { round: 1, home: { player: 'Dan Partlo', hit: 'S20x2', marks: 2 }, away: { player: 'Eddie Olschansky', hit: 'T20, S20', marks: 4, points: 20 } },
                { round: 2, home: { player: 'Dan Partlo', hit: 'T19x2', marks: 6, notable: '6M', points: 57 }, away: { player: 'Eddie Olschansky', hit: 'T20, D20', marks: 5, notable: '5M', points: 120 } },
                { round: 3, home: { player: 'Dan Partlo', hit: 'T19, S19', marks: 4, points: 133 }, away: { player: 'Eddie Olschansky', hit: 'S19, D20', marks: 3, points: 160 } },
                { round: 4, home: { player: 'Dan Partlo', hit: 'S19x2', marks: 2, points: 171 }, away: { player: 'Eddie Olschansky', hit: 'S20', marks: 1, points: 180 } },
                { round: 5, home: { player: 'Dan Partlo', hit: 'S19', marks: 1, points: 190 }, away: { player: 'Eddie Olschansky', hit: 'S20', marks: 1, points: 200 } },
                { round: 6, home: { player: 'Dan Partlo', hit: 'S19x2, S20', marks: 3, points: 228 }, away: { player: 'Eddie Olschansky', hit: 'D18', marks: 2, points: 200 } },
                { round: 7, home: { player: 'Dan Partlo', hit: 'S18, S19', marks: 2, points: 247 }, away: { player: 'Eddie Olschansky', hit: 'T18, D18', marks: 5, notable: '5M', points: 272 } },
                { round: 8, home: { player: 'Dan Partlo', hit: 'S19x3', marks: 3, points: 304 }, away: { player: 'Eddie Olschansky', hit: 'D18', marks: 2, points: 308 } },
                { round: 9, home: { player: 'Dan Partlo', hit: 'S19, S18x2', marks: 3, points: 323 }, away: { player: 'Eddie Olschansky', hit: 'T17', marks: 3, points: 308 } },
                { round: 10, home: { player: 'Dan Partlo', hit: 'T17, DB', marks: 5, notable: '5M', points: 323 }, away: { player: 'Eddie Olschansky', hit: 'S16', marks: 1, points: 308 } },
                { round: 11, home: { player: 'Dan Partlo', hit: 'S16x3', marks: 3, points: 323 }, away: { player: 'Eddie Olschansky', hit: 'T15, D15', marks: 5, notable: '5M', points: 338 } },
                { round: 12, home: { player: 'Dan Partlo', hit: 'T19, S15', marks: 4, points: 380 }, away: { player: 'Eddie Olschansky', hit: 'T15, S15', marks: 4, points: 398 } },
                { round: 13, home: { player: 'Dan Partlo', hit: 'S19', marks: 1, points: 399 }, away: { player: 'Eddie Olschansky', hit: 'D15, T15', marks: 5, notable: '5M', points: 473 } },
                { round: 14, home: { player: 'Dan Partlo', hit: 'S19', marks: 1, points: 418 }, away: { player: 'Eddie Olschansky', hit: 'D19, S15', marks: 3, points: 488 } },
                { round: 15, home: { player: 'Dan Partlo', hit: 'S16x3', marks: 3, points: 466 }, away: { player: 'Eddie Olschansky', hit: 'T15, D16', marks: 5, notable: '5M', points: 533 } },
                { round: 16, home: { player: 'Dan Partlo', hit: 'SB', marks: 1, points: 466 }, away: { player: 'Eddie Olschansky', hit: '-', marks: 0, points: 533 } },
                { round: 17, home: { player: 'Dan Partlo', hit: '-', marks: 0, points: 466 }, away: { player: 'Eddie Olschansky', hit: 'DB', marks: 2, points: 533 } },
                { round: 18, home: { player: 'Dan Partlo', hit: 'SB', marks: 1, points: 491 }, away: { player: 'Eddie Olschansky', hit: 'SB', marks: 1, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 4 - Game 4.1 - 501 SIDO (Doubles: Joe+Kevin vs Jeff+Mike)
    {
        set: 4, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Donley', 'Kevin Mckelvey'], away_players: ['Jeff Boss', 'Mike Gonzales'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 383,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 46.97, darts: 32, points: 501 },
            away_stats: { three_dart_avg: 40.70, darts: 30, points: 407, remaining: 94 },
            player_stats: {
                'Joe Donley': { darts: 18, points: 319, three_dart_avg: 53.17 },
                'Kevin Mckelvey': { darts: 14, points: 182, three_dart_avg: 39.0 },
                'Jeff Boss': { darts: 15, points: 202, three_dart_avg: 40.4 },
                'Mike Gonzales': { darts: 15, points: 205, three_dart_avg: 41.0 }
            },
            checkout: 69, checkout_darts: 2,
            throws: [
                { round: 1, home: { player: 'Joe Donley', score: 95, remaining: 406, notable: '95' }, away: { player: 'Jeff Boss', score: 24, remaining: 477 } },
                { round: 2, home: { player: 'Kevin Mckelvey', score: 23, remaining: 383 }, away: { player: 'Mike Gonzales', score: 71, remaining: 406 } },
                { round: 3, home: { player: 'Joe Donley', score: 57, remaining: 326 }, away: { player: 'Jeff Boss', score: 43, remaining: 363 } },
                { round: 4, home: { player: 'Kevin Mckelvey', score: 60, remaining: 266 }, away: { player: 'Mike Gonzales', score: 60, remaining: 303 } },
                { round: 5, home: { player: 'Joe Donley', score: 41, remaining: 225 }, away: { player: 'Jeff Boss', score: 26, remaining: 277 } },
                { round: 6, home: { player: 'Kevin Mckelvey', score: 20, remaining: 205 }, away: { player: 'Mike Gonzales', score: 60, remaining: 217 } },
                { round: 7, home: { player: 'Joe Donley', score: 57, remaining: 148 }, away: { player: 'Jeff Boss', score: 35, remaining: 182 } },
                { round: 8, home: { player: 'Kevin Mckelvey', score: 6, remaining: 142 }, away: { player: 'Mike Gonzales', score: 26, remaining: 156 } },
                { round: 9, home: { player: 'Joe Donley', score: 60, remaining: 82 }, away: { player: 'Jeff Boss', score: 30, remaining: 126 } },
                { round: 10, home: { player: 'Kevin Mckelvey', score: 13, remaining: 69 }, away: { player: 'Mike Gonzales', score: 32, remaining: 94 } },
                { round: 11, home: { player: 'Joe Donley', score: 69, remaining: 0, checkout: true, checkout_darts: 2 }, away: null }
            ]
        }]
    },
    // SET 4 - Game 4.2 - Cricket (Doubles)
    {
        set: 4, game_in_set: 2, format: 'cricket',
        home_players: ['Joe Donley', 'Kevin Mckelvey'], away_players: ['Jeff Boss', 'Mike Gonzales'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 547,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 17, closeout_darts: 2,
            home_stats: { mpr: 1.9, darts: 50, marks: 32, points: 186 },
            away_stats: { mpr: 1.6, darts: 48, marks: 26, points: 167 },
            player_stats: {
                'Joe Donley': { darts: 27, marks: 18, mpr: 2.0 },
                'Kevin Mckelvey': { darts: 23, marks: 14, mpr: 1.83 },
                'Jeff Boss': { darts: 24, marks: 15, mpr: 1.88 },
                'Mike Gonzales': { darts: 24, marks: 11, mpr: 1.38 }
            },
            throws: [
                { round: 1, home: { player: 'Joe Donley', hit: 'S20', marks: 1 }, away: { player: 'Jeff Boss', hit: 'S20x3', marks: 3 } },
                { round: 2, home: { player: 'Kevin Mckelvey', hit: 'T19', marks: 3 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 20 } },
                { round: 3, home: { player: 'Joe Donley', hit: '-', marks: 0 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 20 } },
                { round: 4, home: { player: 'Kevin Mckelvey', hit: 'S16', marks: 1 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 40 } },
                { round: 5, home: { player: 'Joe Donley', hit: 'T19, S19x2', marks: 5, notable: '5M', points: 95 }, away: { player: 'Jeff Boss', hit: 'S20x2', marks: 2, points: 80 } },
                { round: 6, home: { player: 'Kevin Mckelvey', hit: 'S20x2', marks: 2, points: 95 }, away: { player: 'Mike Gonzales', hit: 'D18', marks: 2, points: 80 } },
                { round: 7, home: { player: 'Joe Donley', hit: 'S18x2', marks: 2, points: 95 }, away: { player: 'Jeff Boss', hit: 'S18x2', marks: 2, points: 98 } },
                { round: 8, home: { player: 'Kevin Mckelvey', hit: 'S19', marks: 1, points: 114 }, away: { player: 'Mike Gonzales', hit: 'S18', marks: 1, points: 116 } },
                { round: 9, home: { player: 'Joe Donley', hit: 'S19, S18', marks: 2, points: 133 }, away: { player: 'Jeff Boss', hit: 'S17x3', marks: 3, points: 116 } },
                { round: 10, home: { player: 'Kevin Mckelvey', hit: 'S16x2', marks: 2, points: 133 }, away: { player: 'Mike Gonzales', hit: 'D17', marks: 2, points: 150 } },
                { round: 11, home: { player: 'Joe Donley', hit: 'S19x2, S17', marks: 3, points: 171 }, away: { player: 'Jeff Boss', hit: 'S17', marks: 1, points: 167 } },
                { round: 12, home: { player: 'Kevin Mckelvey', hit: 'S17x2', marks: 2, points: 171 }, away: { player: 'Mike Gonzales', hit: 'D15', marks: 2, points: 167 } },
                { round: 13, home: { player: 'Joe Donley', hit: 'S15x3', marks: 3, points: 171 }, away: { player: 'Jeff Boss', hit: 'S16', marks: 1, points: 167 } },
                { round: 14, home: { player: 'Kevin Mckelvey', hit: 'S15', marks: 1, points: 186 }, away: { player: 'Mike Gonzales', hit: 'SB, S19', marks: 2, points: 167 } },
                { round: 15, home: { player: 'Joe Donley', hit: 'DB', marks: 2, points: 186 }, away: { player: 'Jeff Boss', hit: 'SB', marks: 1, points: 167 } },
                { round: 16, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0, points: 186 }, away: { player: 'Mike Gonzales', hit: 'SB', marks: 1, points: 167 } },
                { round: 17, home: { player: 'Joe Donley', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 5 - Game 5.1 - Cricket (Singles: Joe vs Jeff)
    {
        set: 5, game_in_set: 1, format: 'cricket',
        home_players: ['Joe Donley'], away_players: ['Jeff Boss'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 572,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 18, closeout_darts: 1,
            home_stats: { mpr: 1.3, darts: 54, marks: 24, points: 133 },
            away_stats: { mpr: 1.8, darts: 54, marks: 32, points: 220 },
            player_stats: {
                'Joe Donley': { darts: 54, marks: 24, mpr: 1.33 },
                'Jeff Boss': { darts: 54, marks: 32, mpr: 1.78 }
            },
            throws: [
                { round: 1, home: { player: 'Joe Donley', hit: 'S19', marks: 1 }, away: { player: 'Jeff Boss', hit: 'T20, S20x2', marks: 5, notable: '5M', points: 40 } },
                { round: 2, home: { player: 'Joe Donley', hit: 'T19', marks: 3, points: 19 }, away: { player: 'Jeff Boss', hit: 'S20', marks: 1, points: 60 } },
                { round: 3, home: { player: 'Joe Donley', hit: 'S19x2', marks: 2, points: 57 }, away: { player: 'Jeff Boss', hit: 'S19, T17', marks: 4, points: 60 } },
                { round: 4, home: { player: 'Joe Donley', hit: 'S19x2', marks: 2, points: 95 }, away: { player: 'Jeff Boss', hit: 'S20', marks: 1, points: 80 } },
                { round: 5, home: { player: 'Joe Donley', hit: 'S19', marks: 1, points: 114 }, away: { player: 'Jeff Boss', hit: 'S20x3', marks: 3, points: 140 } },
                { round: 6, home: { player: 'Joe Donley', hit: 'S19', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'S19x2, S17', marks: 3, points: 157 } },
                { round: 7, home: { player: 'Joe Donley', hit: 'S18', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'S18x2', marks: 2, points: 157 } },
                { round: 8, home: { player: 'Joe Donley', hit: 'S18x2', marks: 2, points: 133 }, away: { player: 'Jeff Boss', hit: 'S18', marks: 1, points: 157 } },
                { round: 9, home: { player: 'Joe Donley', hit: 'S16x2', marks: 2, points: 133 }, away: { player: 'Jeff Boss', hit: 'S16, T16, S15', marks: 5, notable: '5M', points: 173 } },
                { round: 10, home: { player: 'Joe Donley', hit: 'S15', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'S15, D15', marks: 3, points: 188 } },
                { round: 11, home: { player: 'Joe Donley', hit: 'S15', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'S16', marks: 1, points: 204 } },
                { round: 12, home: { player: 'Joe Donley', hit: 'SB', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'SB', marks: 1, points: 204 } },
                { round: 13, home: { player: 'Joe Donley', hit: '-', marks: 0, points: 133 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 204 } },
                { round: 14, home: { player: 'Joe Donley', hit: '-', marks: 0, points: 133 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 204 } },
                { round: 15, home: { player: 'Joe Donley', hit: 'S20x3', marks: 3, points: 133 }, away: { player: 'Jeff Boss', hit: 'S16, SB', marks: 2, points: 220 } },
                { round: 16, home: { player: 'Joe Donley', hit: '-', marks: 0, points: 133 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 220 } },
                { round: 17, home: { player: 'Joe Donley', hit: 'DB', marks: 2, points: 133 }, away: { player: 'Jeff Boss', hit: '-', marks: 0, points: 220 } },
                { round: 18, home: { player: 'Joe Donley', hit: 'S17', marks: 1, points: 133 }, away: { player: 'Jeff Boss', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true } }
            ]
        }]
    },
    // SET 5 - Game 5.2 - Cricket
    {
        set: 5, game_in_set: 2, format: 'cricket',
        home_players: ['Joe Donley'], away_players: ['Jeff Boss'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 304,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 9, closeout_darts: 1,
            home_stats: { mpr: 3.0, darts: 25, marks: 25, points: 76 },
            away_stats: { mpr: 1.7, darts: 27, marks: 15, points: 51 },
            player_stats: {
                'Joe Donley': { darts: 25, marks: 25, mpr: 3.0 },
                'Jeff Boss': { darts: 27, marks: 15, mpr: 1.67 }
            },
            throws: [
                { round: 1, home: { player: 'Joe Donley', hit: 'T20, S19', marks: 4 }, away: { player: 'Jeff Boss', hit: 'S20', marks: 1 } },
                { round: 2, home: { player: 'Joe Donley', hit: 'S19x3', marks: 3, points: 19 }, away: { player: 'Jeff Boss', hit: 'T20', marks: 3 } },
                { round: 3, home: { player: 'Joe Donley', hit: '-', marks: 0, points: 19 }, away: { player: 'Jeff Boss', hit: 'S18x2', marks: 2 } },
                { round: 4, home: { player: 'Joe Donley', hit: 'S18x3', marks: 3, points: 19 }, away: { player: 'Jeff Boss', hit: 'S18', marks: 1 } },
                { round: 5, home: { player: 'Joe Donley', hit: 'T19, S17x2', marks: 5, notable: '5M', points: 76 }, away: { player: 'Jeff Boss', hit: 'S17x2, T17', marks: 5, notable: '5M', points: 34 } },
                { round: 6, home: { player: 'Joe Donley', hit: 'T15, S17', marks: 4, points: 76 }, away: { player: 'Jeff Boss', hit: 'S17', marks: 1, points: 51 } },
                { round: 7, home: { player: 'Joe Donley', hit: 'DB', marks: 2, points: 76 }, away: { player: 'Jeff Boss', hit: 'S19', marks: 1, points: 51 } },
                { round: 8, home: { player: 'Joe Donley', hit: 'T16', marks: 3, points: 76 }, away: { player: 'Jeff Boss', hit: 'S16', marks: 1, points: 51 } },
                { round: 9, home: { player: 'Joe Donley', hit: 'SB', marks: 1, closeout_darts: 1, closed_out: true }, away: { player: 'Jeff Boss', hit: 'SB', marks: 1, points: 51 } }
            ]
        }]
    },
    // SET 5 - Game 5.3 - Cricket (BO3)
    {
        set: 5, game_in_set: 3, format: 'cricket',
        home_players: ['Joe Donley'], away_players: ['Jeff Boss'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 274,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'home',
            winning_round: 9, closeout_darts: 3,
            home_stats: { mpr: 3.0, darts: 27, marks: 27, points: 104 },
            away_stats: { mpr: 0.9, darts: 24, marks: 7, points: 0 },
            player_stats: {
                'Joe Donley': { darts: 27, marks: 27, mpr: 3.0 },
                'Jeff Boss': { darts: 24, marks: 7, mpr: 0.88 }
            },
            throws: [
                { round: 1, home: { player: 'Joe Donley', hit: 'T20, S20', marks: 4 }, away: { player: 'Jeff Boss', hit: 'S19x2, S16', marks: 3 } },
                { round: 2, home: { player: 'Joe Donley', hit: 'S19x3', marks: 3, points: 20 }, away: { player: 'Jeff Boss', hit: 'S19, S18', marks: 2 } },
                { round: 3, home: { player: 'Joe Donley', hit: 'S18x3', marks: 3, points: 20 }, away: { player: 'Jeff Boss', hit: '-', marks: 0 } },
                { round: 4, home: { player: 'Joe Donley', hit: 'S17x3', marks: 3, points: 20 }, away: { player: 'Jeff Boss', hit: '-', marks: 0 } },
                { round: 5, home: { player: 'Joe Donley', hit: 'S16x3', marks: 3, points: 20 }, away: { player: 'Jeff Boss', hit: '-', marks: 0 } },
                { round: 6, home: { player: 'Joe Donley', hit: 'S15x2, D15', marks: 4, points: 35 }, away: { player: 'Jeff Boss', hit: '-', marks: 0 } },
                { round: 7, home: { player: 'Joe Donley', hit: 'SB, S18', marks: 2, points: 53 }, away: { player: 'Jeff Boss', hit: 'SB', marks: 1 } },
                { round: 8, home: { player: 'Joe Donley', hit: 'S20, SB', marks: 2, points: 73 }, away: { player: 'Jeff Boss', hit: 'S20', marks: 1 } },
                { round: 9, home: { player: 'Joe Donley', hit: 'S16, S15, SB', marks: 3, points: 104, closeout_darts: 3, closed_out: true }, away: null }
            ]
        }]
    },
    // SET 6 - Game 6.1 - 501 SIDO (Dan vs Eddie)
    {
        set: 6, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dan Partlo'], away_players: ['Eddie Olschansky'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 241,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 56.13, darts: 24, points: 449, remaining: 52 },
            away_stats: { three_dart_avg: 68.32, darts: 22, points: 501 },
            player_stats: {
                'Dan Partlo': { darts: 24, points: 449, three_dart_avg: 56.13 },
                'Eddie Olschansky': { darts: 22, points: 501, three_dart_avg: 68.32 }
            },
            checkout: 40, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Dan Partlo', score: 59, remaining: 442 }, away: { player: 'Eddie Olschansky', score: 57, remaining: 444 } },
                { round: 2, home: { player: 'Dan Partlo', score: 32, remaining: 410 }, away: { player: 'Eddie Olschansky', score: 58, remaining: 386 } },
                { round: 3, home: { player: 'Dan Partlo', score: 40, remaining: 370 }, away: { player: 'Eddie Olschansky', score: 81, remaining: 305 } },
                { round: 4, home: { player: 'Dan Partlo', score: 81, remaining: 289 }, away: { player: 'Eddie Olschansky', score: 100, remaining: 205, notable: '100' } },
                { round: 5, home: { player: 'Dan Partlo', score: 41, remaining: 248 }, away: { player: 'Eddie Olschansky', score: 46, remaining: 159 } },
                { round: 6, home: { player: 'Dan Partlo', score: 60, remaining: 188 }, away: { player: 'Eddie Olschansky', score: 80, remaining: 79 } },
                { round: 7, home: { player: 'Dan Partlo', score: 83, remaining: 105 }, away: { player: 'Eddie Olschansky', score: 39, remaining: 40 } },
                { round: 8, home: { player: 'Dan Partlo', score: 53, remaining: 52 }, away: { player: 'Eddie Olschansky', score: 40, remaining: 0, checkout: true, checkout_darts: 1 } }
            ]
        }]
    },
    // SET 6 - Game 6.2 - 501 SIDO
    {
        set: 6, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dan Partlo'], away_players: ['Eddie Olschansky'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 308,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 60.88, darts: 24, points: 487, remaining: 14 },
            away_stats: { three_dart_avg: 55.67, darts: 27, points: 501 },
            player_stats: {
                'Dan Partlo': { darts: 24, points: 487, three_dart_avg: 60.88 },
                'Eddie Olschansky': { darts: 27, points: 501, three_dart_avg: 55.67 }
            },
            checkout: 32, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Dan Partlo', score: 60, remaining: 441 }, away: { player: 'Eddie Olschansky', score: 28, remaining: 473 } },
                { round: 2, home: { player: 'Dan Partlo', score: 46, remaining: 395 }, away: { player: 'Eddie Olschansky', score: 61, remaining: 412 } },
                { round: 3, home: { player: 'Dan Partlo', score: 45, remaining: 350 }, away: { player: 'Eddie Olschansky', score: 59, remaining: 353 } },
                { round: 4, home: { player: 'Dan Partlo', score: 100, remaining: 250, notable: '100' }, away: { player: 'Eddie Olschansky', score: 45, remaining: 308 } },
                { round: 5, home: { player: 'Dan Partlo', score: 45, remaining: 205 }, away: { player: 'Eddie Olschansky', score: 68, remaining: 240 } },
                { round: 6, home: { player: 'Dan Partlo', score: 45, remaining: 160 }, away: { player: 'Eddie Olschansky', score: 125, remaining: 115, notable: '125' } },
                { round: 7, home: { player: 'Dan Partlo', score: 118, remaining: 42, notable: '118' }, away: { player: 'Eddie Olschansky', score: 50, remaining: 65 } },
                { round: 8, home: { player: 'Dan Partlo', score: 28, remaining: 14 }, away: { player: 'Eddie Olschansky', score: 33, remaining: 32 } },
                { round: 9, home: null, away: { player: 'Eddie Olschansky', score: 32, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    // SET 7 - Game 7.1 - 501 SIDO (Doubles)
    {
        set: 7, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Dan Partlo', 'Kevin Mckelvey'], away_players: ['Eddie Olschansky', 'Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 368,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 37.20, darts: 30, points: 372, remaining: 129 },
            away_stats: { three_dart_avg: 45.55, darts: 33, points: 501 },
            player_stats: {
                'Dan Partlo': { darts: 15, points: 275, three_dart_avg: 55.0 },
                'Kevin Mckelvey': { darts: 15, points: 97, three_dart_avg: 19.4 },
                'Eddie Olschansky': { darts: 18, points: 287, three_dart_avg: 47.83 },
                'Mike Gonzales': { darts: 15, points: 214, three_dart_avg: 42.8 }
            },
            checkout: 4, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Dan Partlo', score: 45, remaining: 456 }, away: { player: 'Eddie Olschansky', score: 43, remaining: 458 } },
                { round: 2, home: { player: 'Kevin Mckelvey', score: 4, remaining: 452 }, away: { player: 'Mike Gonzales', score: 24, remaining: 434 } },
                { round: 3, home: { player: 'Dan Partlo', score: 45, remaining: 407 }, away: { player: 'Eddie Olschansky', score: 140, remaining: 294, notable: '140' } },
                { round: 4, home: { player: 'Kevin Mckelvey', score: 52, remaining: 355 }, away: { player: 'Mike Gonzales', score: 100, remaining: 194, notable: '100' } },
                { round: 5, home: { player: 'Dan Partlo', score: 80, remaining: 275 }, away: { player: 'Eddie Olschansky', score: 34, remaining: 160 } },
                { round: 6, home: { player: 'Kevin Mckelvey', score: 27, remaining: 248 }, away: { player: 'Mike Gonzales', score: 70, remaining: 90 } },
                { round: 7, home: { player: 'Dan Partlo', score: 60, remaining: 188 }, away: { player: 'Eddie Olschansky', score: 70, remaining: 20 } },
                { round: 8, home: { player: 'Kevin Mckelvey', score: 9, remaining: 179 }, away: { player: 'Mike Gonzales', score: 6, remaining: 14 } },
                { round: 9, home: { player: 'Dan Partlo', score: 45, remaining: 134 }, away: { player: 'Eddie Olschansky', score: 10, remaining: 4 } },
                { round: 10, home: { player: 'Kevin Mckelvey', score: 5, remaining: 129 }, away: { player: 'Mike Gonzales', score: 0, remaining: 4 } },
                { round: 11, home: null, away: { player: 'Eddie Olschansky', score: 4, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    },
    // SET 7 - Game 7.2 - Cricket (Doubles)
    {
        set: 7, game_in_set: 2, format: 'cricket',
        home_players: ['Dan Partlo', 'Kevin Mckelvey'], away_players: ['Eddie Olschansky', 'Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 474,
        cork_winner: 'away',
        legs: [{
            leg_number: 1, format: 'cricket', winner: 'away',
            winning_round: 15, closeout_darts: 2,
            home_stats: { mpr: 2.1, darts: 42, marks: 29, points: 196 },
            away_stats: { mpr: 2.3, darts: 43, marks: 33, points: 240 },
            player_stats: {
                'Dan Partlo': { darts: 21, marks: 18, mpr: 2.57 },
                'Kevin Mckelvey': { darts: 21, marks: 11, mpr: 1.57 },
                'Eddie Olschansky': { darts: 22, marks: 21, mpr: 2.86 },
                'Mike Gonzales': { darts: 21, marks: 12, mpr: 1.71 }
            },
            throws: [
                { round: 1, home: { player: 'Dan Partlo', hit: 'T19, S19', marks: 4, points: 19 }, away: { player: 'Eddie Olschansky', hit: 'T20, S20', marks: 4 } },
                { round: 2, home: { player: 'Kevin Mckelvey', hit: 'S19x2', marks: 2, points: 57 }, away: { player: 'Mike Gonzales', hit: 'S19, T20', marks: 4, points: 80 } },
                { round: 3, home: { player: 'Dan Partlo', hit: 'S18x3', marks: 3, points: 57 }, away: { player: 'Eddie Olschansky', hit: 'S20, T19', marks: 4, points: 100 } },
                { round: 4, home: { player: 'Kevin Mckelvey', hit: 'S18x3', marks: 3, points: 111 }, away: { player: 'Mike Gonzales', hit: 'S18, T20', marks: 4, points: 160 } },
                { round: 5, home: { player: 'Dan Partlo', hit: 'S17x2', marks: 2, points: 111 }, away: { player: 'Eddie Olschansky', hit: 'T18, S20', marks: 4, points: 180 } },
                { round: 6, home: { player: 'Kevin Mckelvey', hit: 'T15', marks: 3, points: 111 }, away: { player: 'Mike Gonzales', hit: 'S17', marks: 1, points: 180 } },
                { round: 7, home: { player: 'Dan Partlo', hit: 'S15x2', marks: 2, points: 141 }, away: { player: 'Eddie Olschansky', hit: 'D17', marks: 2, points: 180 } },
                { round: 8, home: { player: 'Kevin Mckelvey', hit: 'S15x2', marks: 2, points: 171 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 200 } },
                { round: 9, home: { player: 'Dan Partlo', hit: 'S16', marks: 1, points: 171 }, away: { player: 'Eddie Olschansky', hit: 'T15', marks: 3, points: 200 } },
                { round: 10, home: { player: 'Kevin Mckelvey', hit: '-', marks: 0, points: 171 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 220 } },
                { round: 11, home: { player: 'Dan Partlo', hit: 'SB, S20', marks: 2, points: 171 }, away: { player: 'Eddie Olschansky', hit: 'T16', marks: 3, points: 220 } },
                { round: 12, home: { player: 'Kevin Mckelvey', hit: 'SB', marks: 1, points: 171 }, away: { player: 'Mike Gonzales', hit: '-', marks: 0, points: 220 } },
                { round: 13, home: { player: 'Dan Partlo', hit: 'SBx2', marks: 2, points: 196 }, away: { player: 'Eddie Olschansky', hit: 'DB', marks: 2, points: 220 } },
                { round: 14, home: { player: 'Kevin Mckelvey', hit: 'S17, S16', marks: 2, points: 196 }, away: { player: 'Mike Gonzales', hit: 'S20', marks: 1, points: 240 } },
                { round: 15, home: null, away: { player: 'Eddie Olschansky', hit: 'DB', marks: 2, closeout_darts: 2, closed_out: true } }
            ]
        }]
    },
    // SET 8 - Game 8.1 - 501 SIDO (Joe vs Jeff)
    {
        set: 8, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Donley'], away_players: ['Jeff Boss'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 340,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 53.68, darts: 28, points: 501 },
            away_stats: { three_dart_avg: 30.10, darts: 30, points: 301, remaining: 200 },
            player_stats: {
                'Joe Donley': { darts: 28, points: 501, three_dart_avg: 53.68 },
                'Jeff Boss': { darts: 30, points: 301, three_dart_avg: 30.1 }
            },
            checkout: 20, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Joe Donley', score: 57, remaining: 444 }, away: { player: 'Jeff Boss', score: 34, remaining: 467 } },
                { round: 2, home: { player: 'Joe Donley', score: 59, remaining: 385 }, away: { player: 'Jeff Boss', score: 21, remaining: 446 } },
                { round: 3, home: { player: 'Joe Donley', score: 95, remaining: 290, notable: '95' }, away: { player: 'Jeff Boss', score: 21, remaining: 425 } },
                { round: 4, home: { player: 'Joe Donley', score: 28, remaining: 262 }, away: { player: 'Jeff Boss', score: 33, remaining: 392 } },
                { round: 5, home: { player: 'Joe Donley', score: 57, remaining: 205 }, away: { player: 'Jeff Boss', score: 41, remaining: 351 } },
                { round: 6, home: { player: 'Joe Donley', score: 29, remaining: 176 }, away: { player: 'Jeff Boss', score: 22, remaining: 329 } },
                { round: 7, home: { player: 'Joe Donley', score: 17, remaining: 159 }, away: { player: 'Jeff Boss', score: 49, remaining: 280 } },
                { round: 8, home: { player: 'Joe Donley', score: 95, remaining: 64, notable: '95' }, away: { player: 'Jeff Boss', score: 34, remaining: 246 } },
                { round: 9, home: { player: 'Joe Donley', score: 44, remaining: 20 }, away: { player: 'Jeff Boss', score: 22, remaining: 224 } },
                { round: 10, home: { player: 'Joe Donley', score: 20, remaining: 0, checkout: true, checkout_darts: 1 }, away: { player: 'Jeff Boss', score: 24, remaining: 200 } }
            ]
        }]
    },
    // SET 8 - Game 8.2 - 501 SIDO
    {
        set: 8, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Joe Donley'], away_players: ['Jeff Boss'],
        winner: 'home', home_legs_won: 1, away_legs_won: 0, status: 'completed', duration_seconds: 284,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'home',
            home_stats: { three_dart_avg: 60.12, darts: 25, points: 501 },
            away_stats: { three_dart_avg: 36.13, darts: 24, points: 289, remaining: 212 },
            player_stats: {
                'Joe Donley': { darts: 25, points: 501, three_dart_avg: 60.12 },
                'Jeff Boss': { darts: 24, points: 289, three_dart_avg: 36.13 }
            },
            checkout: 20, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Joe Donley', score: 45, remaining: 456 }, away: { player: 'Jeff Boss', score: 39, remaining: 462 } },
                { round: 2, home: { player: 'Joe Donley', score: 81, remaining: 375 }, away: { player: 'Jeff Boss', score: 25, remaining: 437 } },
                { round: 3, home: { player: 'Joe Donley', score: 41, remaining: 334 }, away: { player: 'Jeff Boss', score: 30, remaining: 407 } },
                { round: 4, home: { player: 'Joe Donley', score: 60, remaining: 274 }, away: { player: 'Jeff Boss', score: 44, remaining: 363 } },
                { round: 5, home: { player: 'Joe Donley', score: 60, remaining: 214 }, away: { player: 'Jeff Boss', score: 26, remaining: 337 } },
                { round: 6, home: { player: 'Joe Donley', score: 60, remaining: 154 }, away: { player: 'Jeff Boss', score: 26, remaining: 311 } },
                { round: 7, home: { player: 'Joe Donley', score: 60, remaining: 94 }, away: { player: 'Jeff Boss', score: 58, remaining: 253 } },
                { round: 8, home: { player: 'Joe Donley', score: 74, remaining: 20 }, away: { player: 'Jeff Boss', score: 41, remaining: 212 } },
                { round: 9, home: { player: 'Joe Donley', score: 20, remaining: 0, checkout: true, checkout_darts: 1 }, away: null }
            ]
        }]
    },
    // SET 9 - Game 9.1 - 501 SIDO (Kevin vs Mike)
    {
        set: 9, game_in_set: 1, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Mckelvey'], away_players: ['Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 293,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 32.60, darts: 30, points: 326, remaining: 175 },
            away_stats: { three_dart_avg: 48.48, darts: 31, points: 501 },
            player_stats: {
                'Kevin Mckelvey': { darts: 30, points: 326, three_dart_avg: 32.6 },
                'Mike Gonzales': { darts: 31, points: 501, three_dart_avg: 48.48 }
            },
            checkout: 10, checkout_darts: 1,
            throws: [
                { round: 1, home: { player: 'Kevin Mckelvey', score: 40, remaining: 461 }, away: { player: 'Mike Gonzales', score: 37, remaining: 464 } },
                { round: 2, home: { player: 'Kevin Mckelvey', score: 7, remaining: 454 }, away: { player: 'Mike Gonzales', score: 22, remaining: 442 } },
                { round: 3, home: { player: 'Kevin Mckelvey', score: 20, remaining: 434 }, away: { player: 'Mike Gonzales', score: 140, remaining: 302, notable: '140' } },
                { round: 4, home: { player: 'Kevin Mckelvey', score: 48, remaining: 386 }, away: { player: 'Mike Gonzales', score: 7, remaining: 295 } },
                { round: 5, home: { player: 'Kevin Mckelvey', score: 27, remaining: 359 }, away: { player: 'Mike Gonzales', score: 60, remaining: 235 } },
                { round: 6, home: { player: 'Kevin Mckelvey', score: 26, remaining: 333 }, away: { player: 'Mike Gonzales', score: 85, remaining: 150 } },
                { round: 7, home: { player: 'Kevin Mckelvey', score: 32, remaining: 301 }, away: { player: 'Mike Gonzales', score: 39, remaining: 111 } },
                { round: 8, home: { player: 'Kevin Mckelvey', score: 37, remaining: 264 }, away: { player: 'Mike Gonzales', score: 44, remaining: 67 } },
                { round: 9, home: { player: 'Kevin Mckelvey', score: 30, remaining: 234 }, away: { player: 'Mike Gonzales', score: 47, remaining: 20 } },
                { round: 10, home: { player: 'Kevin Mckelvey', score: 59, remaining: 175 }, away: { player: 'Mike Gonzales', score: 10, remaining: 10 } },
                { round: 11, home: null, away: { player: 'Mike Gonzales', score: 10, remaining: 0, checkout: true, checkout_darts: 1 } }
            ]
        }]
    },
    // SET 9 - Game 9.2 - 501 SIDO
    {
        set: 9, game_in_set: 2, format: '501', in_rule: 'straight', checkout: 'double',
        home_players: ['Kevin Mckelvey'], away_players: ['Mike Gonzales'],
        winner: 'away', home_legs_won: 0, away_legs_won: 1, status: 'completed', duration_seconds: 209,
        cork_winner: 'home',
        legs: [{
            leg_number: 1, format: '501', winner: 'away',
            home_stats: { three_dart_avg: 21.86, darts: 21, points: 153, remaining: 348 },
            away_stats: { three_dart_avg: 62.63, darts: 24, points: 501 },
            player_stats: {
                'Kevin Mckelvey': { darts: 21, points: 153, three_dart_avg: 21.86 },
                'Mike Gonzales': { darts: 24, points: 501, three_dart_avg: 62.63 }
            },
            checkout: 68, checkout_darts: 3,
            throws: [
                { round: 1, home: { player: 'Kevin Mckelvey', score: 24, remaining: 477 }, away: { player: 'Mike Gonzales', score: 55, remaining: 446 } },
                { round: 2, home: { player: 'Kevin Mckelvey', score: 10, remaining: 467 }, away: { player: 'Mike Gonzales', score: 60, remaining: 386 } },
                { round: 3, home: { player: 'Kevin Mckelvey', score: 39, remaining: 428 }, away: { player: 'Mike Gonzales', score: 81, remaining: 305 } },
                { round: 4, home: { player: 'Kevin Mckelvey', score: 7, remaining: 421 }, away: { player: 'Mike Gonzales', score: 60, remaining: 245 } },
                { round: 5, home: { player: 'Kevin Mckelvey', score: 45, remaining: 376 }, away: { player: 'Mike Gonzales', score: 100, remaining: 145, notable: '100' } },
                { round: 6, home: { player: 'Kevin Mckelvey', score: 6, remaining: 370 }, away: { player: 'Mike Gonzales', score: 60, remaining: 85 } },
                { round: 7, home: { player: 'Kevin Mckelvey', score: 22, remaining: 348 }, away: { player: 'Mike Gonzales', score: 17, remaining: 68 } },
                { round: 8, home: null, away: { player: 'Mike Gonzales', score: 68, remaining: 0, checkout: true, checkout_darts: 3 } }
            ]
        }]
    }
];

// ==========================================
// Cloud Function to populate Partlo vs Olschansky match
// ==========================================
exports.populatePartloOlschanskyMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
            const matchId = req.query.matchId;

            if (!matchId) {
                return res.status(400).json({ error: 'matchId query parameter required' });
            }

            const matchRef = db.collection('leagues').doc(leagueId)
                .collection('matches').doc(matchId);

            const matchDoc = await matchRef.get();
            if (!matchDoc.exists) {
                return res.status(404).json({ error: 'Match not found' });
            }

            await matchRef.update({
                ...partloOlschanskyMetadata,
                games: partloOlschanskyGames,
                data_imported: true,
                data_import_timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Partlo vs Olschansky match data populated',
                matchId,
                gamesCount: partloOlschanskyGames.length
            });
        } catch (error) {
            console.error('Error populating match:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

module.exports.partloOlschanskyMetadata = partloOlschanskyMetadata;
module.exports.partloOlschanskyGames = partloOlschanskyGames;
