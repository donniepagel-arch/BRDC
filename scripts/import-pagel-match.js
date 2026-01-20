/**
 * Script to import Pagel vs Pagel match data
 * Parsed from DartConnect RTF file
 */

const admin = require('firebase-admin');

// Use application default credentials (requires GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
admin.initializeApp({
    projectId: 'brdc-b3a27'
});

const db = admin.firestore();

// Player ID mapping
const PLAYER_IDS = {
    'Matt Pagel': 'G1lL2V3f3aQLQfBTfXkDXqUHZJo1',
    'Joe Peters': 'JqWH5tOwcbS4iIXuwb2lnVpkH7B2',
    'John Linden': 'I3VUoEyqhPhJRSCcowq3CHTJrxI2',
    'Donnie Pagel': 'Tq35P9nPiXgLJgRwfOOqJRJvEqJ3',
    'Christian Ketchem': '89RkfFLOhvUwV83ZS5J4',
    'Jenn M': 'tYMrfHzKRfWgGwujFiQOK3jx0n33',
    'Jennifer Malek': 'tYMrfHzKRfWgGwujFiQOK3jx0n33'
};

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = 'sgmoL4GyVUYP67aOS7wm';

// Parsed match data from RTF file
const matchData = {
    home_team: 'Team 10',
    away_team: 'Team 5',
    final_score: { home: 7, away: 2 },
    total_darts: 1505,
    total_legs: 23,
    games: [
        // Set 1: Matt/Joe vs Donnie/Christian - Home wins 2-1
        {
            game_number: 1,
            type: 'mixed',
            format: '501/cricket',
            home_players: ['Matt Pagel', 'Joe Peters'],
            away_players: ['Donnie Pagel', 'Christian Ketchem'],
            result: { home_legs: 2, away_legs: 1 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 26,
                        three_dart_avg: 57.81,
                        checkout: 43,
                        checkout_darts: 2
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 26,
                        three_dart_avg: 45.44,
                        remaining: 92
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 14, points: 280, checkout: 43, checkout_darts: 2 },
                        'Joe Peters': { darts: 12, points: 221 },
                        'Donnie Pagel': { darts: 14, points: 247 },
                        'Christian Ketchem': { darts: 12, points: 162 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'away',
                    home_stats: {
                        marks: 48,
                        darts_thrown: 48,
                        mpr: 2.4,
                        points: 326
                    },
                    away_stats: {
                        marks: 51,
                        darts_thrown: 51,
                        mpr: 2.4,
                        points: 370
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 30, marks: 24, mpr: 2.4, points: 163 },
                        'Joe Peters': { darts: 18, marks: 24, mpr: 4.0, points: 163 },
                        'Donnie Pagel': { darts: 27, marks: 27, mpr: 3.0, points: 185 },
                        'Christian Ketchem': { darts: 24, marks: 24, mpr: 3.0, points: 185 }
                    }
                },
                {
                    leg_number: 3,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 23,
                        three_dart_avg: 65.35,
                        checkout: 46,
                        checkout_darts: 2
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 21,
                        three_dart_avg: 44.86,
                        remaining: 187
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 11, points: 229, checkout: 0 },
                        'Joe Peters': { darts: 12, points: 272, checkout: 46, checkout_darts: 2 },
                        'Donnie Pagel': { darts: 12, points: 192 },
                        'Christian Ketchem': { darts: 9, points: 122 }
                    }
                }
            ]
        },
        // Set 2: John vs Jenn - Home wins 2-0
        {
            game_number: 2,
            type: 'cricket',
            format: 'cricket',
            home_players: ['John Linden'],
            away_players: ['Jenn M'],
            result: { home_legs: 2, away_legs: 0 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 30,
                        darts_thrown: 34,
                        mpr: 2.6,
                        points: 134
                    },
                    away_stats: {
                        marks: 24,
                        darts_thrown: 34,
                        mpr: 2.1,
                        points: 100
                    },
                    player_stats: {
                        'John Linden': { darts: 34, marks: 30, mpr: 2.6, points: 134 },
                        'Jenn M': { darts: 34, marks: 24, mpr: 2.1, points: 100 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 22,
                        darts_thrown: 35,
                        mpr: 1.9,
                        points: 20
                    },
                    away_stats: {
                        marks: 19,
                        darts_thrown: 33,
                        mpr: 1.6,
                        points: 0
                    },
                    player_stats: {
                        'John Linden': { darts: 35, marks: 22, mpr: 1.9, points: 20 },
                        'Jenn M': { darts: 33, marks: 19, mpr: 1.6, points: 0 }
                    }
                }
            ]
        },
        // Set 3: Matt vs Donnie - Home wins 2-0
        {
            game_number: 3,
            type: 'cricket',
            format: 'cricket',
            home_players: ['Matt Pagel'],
            away_players: ['Donnie Pagel'],
            result: { home_legs: 2, away_legs: 0 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 23,
                        darts_thrown: 23,
                        mpr: 3.0,
                        points: 30
                    },
                    away_stats: {
                        marks: 9,
                        darts_thrown: 24,
                        mpr: 1.1,
                        points: 0
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 23, marks: 23, mpr: 3.0, points: 30 },
                        'Donnie Pagel': { darts: 24, marks: 9, mpr: 1.1, points: 0 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 34,
                        darts_thrown: 39,
                        mpr: 2.6,
                        points: 257
                    },
                    away_stats: {
                        marks: 32,
                        darts_thrown: 39,
                        mpr: 2.5,
                        points: 244
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 39, marks: 34, mpr: 2.6, points: 257 },
                        'Donnie Pagel': { darts: 39, marks: 32, mpr: 2.5, points: 244 }
                    }
                }
            ]
        },
        // Set 4: Joe/John vs Christian/Jenn - Home wins 2-1
        {
            game_number: 4,
            type: 'mixed',
            format: '501/cricket',
            home_players: ['Joe Peters', 'John Linden'],
            away_players: ['Christian Ketchem', 'Jenn M'],
            result: { home_legs: 2, away_legs: 1 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 55.67,
                        checkout: 40,
                        checkout_darts: 3
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 26,
                        three_dart_avg: 59.38,
                        remaining: 26
                    },
                    player_stats: {
                        'Joe Peters': { darts: 15, points: 289, checkout: 40, checkout_darts: 3 },
                        'John Linden': { darts: 12, points: 172 },
                        'Christian Ketchem': { darts: 14, points: 288 },
                        'Jenn M': { darts: 12, points: 187 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'away',
                    home_stats: {
                        marks: 26,
                        darts_thrown: 47,
                        mpr: 1.6,
                        points: 86
                    },
                    away_stats: {
                        marks: 27,
                        darts_thrown: 47,
                        mpr: 1.7,
                        points: 95
                    },
                    player_stats: {
                        'Joe Peters': { darts: 24, marks: 14, mpr: 1.75, points: 43 },
                        'John Linden': { darts: 23, marks: 12, mpr: 1.57, points: 43 },
                        'Christian Ketchem': { darts: 24, marks: 14, mpr: 1.75, points: 48 },
                        'Jenn M': { darts: 23, marks: 13, mpr: 1.70, points: 47 }
                    }
                },
                {
                    leg_number: 3,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 55.67,
                        checkout: 5,
                        checkout_darts: 3
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 58.63,
                        remaining: 32
                    },
                    player_stats: {
                        'Joe Peters': { darts: 15, points: 324, checkout: 5, checkout_darts: 3 },
                        'John Linden': { darts: 12, points: 172 },
                        'Christian Ketchem': { darts: 15, points: 266 },
                        'Jenn M': { darts: 12, points: 203 }
                    }
                }
            ]
        },
        // Set 5: Joe vs Christian - Home wins 2-0
        {
            game_number: 5,
            type: 'cricket',
            format: 'cricket',
            home_players: ['Joe Peters'],
            away_players: ['Christian Ketchem'],
            result: { home_legs: 2, away_legs: 0 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 29,
                        darts_thrown: 41,
                        mpr: 2.1,
                        points: 128
                    },
                    away_stats: {
                        marks: 16,
                        darts_thrown: 39,
                        mpr: 1.2,
                        points: 38
                    },
                    player_stats: {
                        'Joe Peters': { darts: 41, marks: 29, mpr: 2.1, points: 128 },
                        'Christian Ketchem': { darts: 39, marks: 16, mpr: 1.2, points: 38 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'home',
                    home_stats: {
                        marks: 29,
                        darts_thrown: 40,
                        mpr: 2.2,
                        points: 144
                    },
                    away_stats: {
                        marks: 20,
                        darts_thrown: 39,
                        mpr: 1.5,
                        points: 110
                    },
                    player_stats: {
                        'Joe Peters': { darts: 40, marks: 29, mpr: 2.2, points: 144 },
                        'Christian Ketchem': { darts: 39, marks: 20, mpr: 1.5, points: 110 }
                    }
                }
            ]
        },
        // Set 6: Matt vs Donnie - Away wins 2-0
        {
            game_number: 6,
            type: 'x01',
            format: '501',
            home_players: ['Matt Pagel'],
            away_players: ['Donnie Pagel'],
            result: { home_legs: 0, away_legs: 2 },
            winner: 'away',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'away',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 26,
                        three_dart_avg: 53.38,
                        remaining: 74
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 55.67,
                        checkout: 53,
                        checkout_darts: 3
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 26, points: 427, remaining: 74 },
                        'Donnie Pagel': { darts: 27, points: 501, checkout: 53, checkout_darts: 3 }
                    }
                },
                {
                    leg_number: 2,
                    format: '501',
                    winner: 'away',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 52.78,
                        remaining: 26
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 30,
                        three_dart_avg: 50.10,
                        checkout: 10,
                        checkout_darts: 3
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 27, points: 475, remaining: 26 },
                        'Donnie Pagel': { darts: 30, points: 501, checkout: 10, checkout_darts: 3 }
                    }
                }
            ]
        },
        // Set 7: Matt/John vs Donnie/Jenn - Away wins 2-1
        {
            game_number: 7,
            type: 'mixed',
            format: '501/cricket',
            home_players: ['Matt Pagel', 'John Linden'],
            away_players: ['Donnie Pagel', 'Jenn M'],
            result: { home_legs: 1, away_legs: 2 },
            winner: 'away',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 30,
                        three_dart_avg: 50.10,
                        checkout: 18,
                        checkout_darts: 3
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 51.22,
                        remaining: 40
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 15, points: 239 },
                        'John Linden': { darts: 15, points: 262, checkout: 18, checkout_darts: 3 },
                        'Donnie Pagel': { darts: 15, points: 245 },
                        'Jenn M': { darts: 12, points: 216 }
                    }
                },
                {
                    leg_number: 2,
                    format: 'cricket',
                    winner: 'away',
                    home_stats: {
                        marks: 26,
                        darts_thrown: 36,
                        mpr: 2.1,
                        points: 119
                    },
                    away_stats: {
                        marks: 29,
                        darts_thrown: 39,
                        mpr: 2.2,
                        points: 140
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 18, marks: 14, mpr: 2.33, points: 60 },
                        'John Linden': { darts: 18, marks: 12, mpr: 2.0, points: 59 },
                        'Donnie Pagel': { darts: 21, marks: 16, mpr: 2.29, points: 75 },
                        'Jenn M': { darts: 18, marks: 13, mpr: 2.17, points: 65 }
                    }
                },
                {
                    leg_number: 3,
                    format: 'cricket',
                    winner: 'away',
                    home_stats: {
                        marks: 31,
                        darts_thrown: 36,
                        mpr: 2.5,
                        points: 176
                    },
                    away_stats: {
                        marks: 35,
                        darts_thrown: 39,
                        mpr: 2.7,
                        points: 222
                    },
                    player_stats: {
                        'Matt Pagel': { darts: 18, marks: 16, mpr: 2.67, points: 88 },
                        'John Linden': { darts: 18, marks: 15, mpr: 2.5, points: 88 },
                        'Donnie Pagel': { darts: 21, marks: 18, mpr: 2.57, points: 111 },
                        'Jenn M': { darts: 18, marks: 17, mpr: 2.83, points: 111 }
                    }
                }
            ]
        },
        // Set 8: Joe vs Christian - Home wins 2-1
        {
            game_number: 8,
            type: 'x01',
            format: '501',
            home_players: ['Joe Peters'],
            away_players: ['Christian Ketchem'],
            result: { home_legs: 2, away_legs: 1 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'away',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 27,
                        three_dart_avg: 51.22,
                        remaining: 40
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 29,
                        three_dart_avg: 51.83,
                        checkout: 47,
                        checkout_darts: 2
                    },
                    player_stats: {
                        'Joe Peters': { darts: 27, points: 461, remaining: 40 },
                        'Christian Ketchem': { darts: 29, points: 501, checkout: 47, checkout_darts: 2 }
                    }
                },
                {
                    leg_number: 2,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 34,
                        three_dart_avg: 44.21,
                        checkout: 10,
                        checkout_darts: 1
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 33,
                        three_dart_avg: 41.82,
                        remaining: 41
                    },
                    player_stats: {
                        'Joe Peters': { darts: 34, points: 501, checkout: 10, checkout_darts: 1 },
                        'Christian Ketchem': { darts: 33, points: 460, remaining: 41 }
                    }
                },
                {
                    leg_number: 3,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 22,
                        three_dart_avg: 68.32,
                        checkout: 16,
                        checkout_darts: 1
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 21,
                        three_dart_avg: 51.14,
                        remaining: 143
                    },
                    player_stats: {
                        'Joe Peters': { darts: 22, points: 501, checkout: 16, checkout_darts: 1 },
                        'Christian Ketchem': { darts: 21, points: 358, remaining: 143 }
                    }
                }
            ]
        },
        // Set 9: John vs Jenn - Home wins 2-1
        {
            game_number: 9,
            type: 'x01',
            format: '501',
            home_players: ['John Linden'],
            away_players: ['Jenn M'],
            result: { home_legs: 2, away_legs: 1 },
            winner: 'home',
            legs: [
                {
                    leg_number: 1,
                    format: '501',
                    winner: 'away',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 33,
                        three_dart_avg: 44.64,
                        remaining: 10
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 33,
                        three_dart_avg: 45.55,
                        checkout: 45,
                        checkout_darts: 3
                    },
                    player_stats: {
                        'John Linden': { darts: 33, points: 491, remaining: 10 },
                        'Jenn M': { darts: 33, points: 501, checkout: 45, checkout_darts: 3 }
                    }
                },
                {
                    leg_number: 2,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 34,
                        three_dart_avg: 44.21,
                        checkout: 32,
                        checkout_darts: 1
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 33,
                        three_dart_avg: 40.58,
                        remaining: 14
                    },
                    player_stats: {
                        'John Linden': { darts: 34, points: 501, checkout: 32, checkout_darts: 1 },
                        'Jenn M': { darts: 33, points: 487, remaining: 14 }
                    }
                },
                {
                    leg_number: 3,
                    format: '501',
                    winner: 'home',
                    home_stats: {
                        starting_score: 501,
                        darts_thrown: 34,
                        three_dart_avg: 44.21,
                        checkout: 18,
                        checkout_darts: 1
                    },
                    away_stats: {
                        starting_score: 501,
                        darts_thrown: 33,
                        three_dart_avg: 38.42,
                        remaining: 40
                    },
                    player_stats: {
                        'John Linden': { darts: 34, points: 501, checkout: 18, checkout_darts: 1 },
                        'Jenn M': { darts: 33, points: 461, remaining: 40 }
                    }
                }
            ]
        }
    ]
};

async function importMatch() {
    console.log('Starting match import...');
    console.log(`League: ${LEAGUE_ID}`);
    console.log(`Match: ${MATCH_ID}`);

    const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(MATCH_ID);
    const matchDoc = await matchRef.get();

    if (!matchDoc.exists) {
        console.error('Match not found!');
        process.exit(1);
    }

    const existingMatch = matchDoc.data();
    console.log(`Found match: ${existingMatch.home_team_name} vs ${existingMatch.away_team_name}`);

    // Convert games to Firestore format
    const firestoreGames = matchData.games.map(game => {
        const legs = game.legs.map(leg => ({
            leg_number: leg.leg_number,
            format: leg.format,
            winner: leg.winner,
            home_stats: leg.home_stats,
            away_stats: leg.away_stats,
            player_stats: leg.player_stats
        }));

        return {
            game: game.game_number,
            type: game.type,
            format: game.format,
            home_players: game.home_players.map(name => ({
                name,
                id: PLAYER_IDS[name] || null
            })),
            away_players: game.away_players.map(name => ({
                name,
                id: PLAYER_IDS[name] || null
            })),
            home_legs_won: game.result.home_legs,
            away_legs_won: game.result.away_legs,
            winner: game.winner,
            status: 'completed',
            legs
        };
    });

    const updateData = {
        games: firestoreGames,
        home_score: matchData.final_score.home,
        away_score: matchData.final_score.away,
        total_darts: matchData.total_darts,
        total_legs: matchData.total_legs,
        status: 'completed',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        import_source: 'dartconnect_parsed',
        played_at: admin.firestore.Timestamp.fromDate(new Date('2026-01-14T19:33:00'))
    };

    console.log('Updating match with game data...');
    await matchRef.update(updateData);

    console.log('Match updated successfully!');
    console.log(`Final Score: Home ${matchData.final_score.home} - Away ${matchData.final_score.away}`);
    console.log(`Total Legs: ${matchData.total_legs}`);
    console.log(`Total Darts: ${matchData.total_darts}`);

    // Now update player stats
    await updatePlayerStats();

    process.exit(0);
}

async function updatePlayerStats() {
    console.log('\nUpdating player stats...');

    const playerStats = {};

    // Aggregate stats from all games/legs
    for (const game of matchData.games) {
        for (const leg of game.legs) {
            for (const [playerName, stats] of Object.entries(leg.player_stats || {})) {
                const playerId = PLAYER_IDS[playerName];
                if (!playerId) continue;

                if (!playerStats[playerId]) {
                    playerStats[playerId] = {
                        player_id: playerId,
                        player_name: playerName,
                        x01_legs_played: 0,
                        x01_legs_won: 0,
                        x01_total_darts: 0,
                        x01_total_points: 0,
                        x01_tons: 0,
                        x01_ton_40: 0,
                        x01_ton_80: 0,
                        x01_high_checkout: 0,
                        cricket_legs_played: 0,
                        cricket_legs_won: 0,
                        cricket_total_marks: 0,
                        cricket_total_darts: 0,
                        matches_played: 1,
                        games_played: 0
                    };
                }

                const ps = playerStats[playerId];

                if (leg.format === '501') {
                    ps.x01_legs_played++;
                    ps.x01_total_darts += stats.darts || 0;
                    ps.x01_total_points += stats.points || 0;

                    // Check if this player won the leg
                    const isHome = game.home_players.includes(playerName);
                    const isWinner = (leg.winner === 'home' && isHome) || (leg.winner === 'away' && !isHome);
                    if (isWinner && stats.checkout) {
                        ps.x01_legs_won++;
                        if (stats.checkout > ps.x01_high_checkout) {
                            ps.x01_high_checkout = stats.checkout;
                        }
                    }
                } else if (leg.format === 'cricket') {
                    ps.cricket_legs_played++;
                    ps.cricket_total_marks += stats.marks || 0;
                    ps.cricket_total_darts += stats.darts || 0;

                    // Check if this player won the leg
                    const isHome = game.home_players.includes(playerName);
                    const isWinner = (leg.winner === 'home' && isHome) || (leg.winner === 'away' && !isHome);
                    if (isWinner) {
                        ps.cricket_legs_won++;
                    }
                }
            }
        }
    }

    // Write stats to league stats collection
    const statsRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats');

    for (const [playerId, stats] of Object.entries(playerStats)) {
        // Calculate averages
        if (stats.x01_total_darts > 0) {
            stats.x01_three_dart_avg = ((stats.x01_total_points / stats.x01_total_darts) * 3).toFixed(2);
        }
        if (stats.cricket_total_darts > 0) {
            stats.cricket_mpr = ((stats.cricket_total_marks / stats.cricket_total_darts) * 3).toFixed(2);
        }

        console.log(`Updating stats for ${stats.player_name}: 501 avg=${stats.x01_three_dart_avg || 0}, Cricket MPR=${stats.cricket_mpr || 0}`);

        // Check if stats doc exists
        const existingStats = await statsRef.doc(playerId).get();

        if (existingStats.exists) {
            // Merge with existing stats
            const existing = existingStats.data();
            const merged = {
                x01_legs_played: (existing.x01_legs_played || 0) + stats.x01_legs_played,
                x01_legs_won: (existing.x01_legs_won || 0) + stats.x01_legs_won,
                x01_total_darts: (existing.x01_total_darts || 0) + stats.x01_total_darts,
                x01_total_points: (existing.x01_total_points || 0) + stats.x01_total_points,
                x01_high_checkout: Math.max(existing.x01_high_checkout || 0, stats.x01_high_checkout),
                cricket_legs_played: (existing.cricket_legs_played || 0) + stats.cricket_legs_played,
                cricket_legs_won: (existing.cricket_legs_won || 0) + stats.cricket_legs_won,
                cricket_total_marks: (existing.cricket_total_marks || 0) + stats.cricket_total_marks,
                cricket_total_darts: (existing.cricket_total_darts || 0) + stats.cricket_total_darts,
                matches_played: (existing.matches_played || 0) + 1,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            // Recalculate averages
            if (merged.x01_total_darts > 0) {
                merged.x01_three_dart_avg = ((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2);
            }
            if (merged.cricket_total_darts > 0) {
                merged.cricket_mpr = ((merged.cricket_total_marks / merged.cricket_total_darts) * 3).toFixed(2);
            }

            await statsRef.doc(playerId).update(merged);
        } else {
            // Create new stats doc
            stats.created_at = admin.firestore.FieldValue.serverTimestamp();
            stats.updated_at = admin.firestore.FieldValue.serverTimestamp();
            await statsRef.doc(playerId).set(stats);
        }
    }

    console.log('Player stats updated!');
}

importMatch().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
