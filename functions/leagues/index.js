/**
 * BRDC League System - Cloud Functions
 * Complete backend for Triples Draft League
 * 
 * Data Structure:
 * - leagues/{leagueId} - League settings and metadata
 * - leagues/{leagueId}/teams/{teamId} - Team roster and standings
 * - leagues/{leagueId}/players/{playerId} - Player registration and stats
 * - leagues/{leagueId}/matches/{matchId} - Weekly match records
 * - leagues/{leagueId}/matches/{matchId}/games/{gameId} - Individual game results
 * - leagues/{leagueId}/stats/{playerId} - Aggregated player statistics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ============================================================================
// MATCH FORMAT DEFINITION
// ============================================================================

const MATCH_FORMAT = [
    { game: 1, homePositions: [1, 2], awayPositions: [1, 2], type: 'doubles', format: 'choice', checkout: 'double' },
    { game: 2, homePositions: [3], awayPositions: [3], type: 'singles', format: 'cricket', checkout: null },
    { game: 3, homePositions: [1], awayPositions: [1], type: 'singles', format: 'cricket', checkout: null },
    { game: 4, homePositions: [2, 3], awayPositions: [2, 3], type: 'doubles', format: 'choice', checkout: 'double' },
    { game: 5, homePositions: [2], awayPositions: [2], type: 'singles', format: 'cricket', checkout: null },
    { game: 6, homePositions: [1], awayPositions: [1], type: 'singles', format: '501', checkout: 'double' },
    { game: 7, homePositions: [1, 3], awayPositions: [1, 3], type: 'doubles', format: 'choice', checkout: 'double' },
    { game: 8, homePositions: [2], awayPositions: [2], type: 'singles', format: '501', checkout: 'double' },
    { game: 9, homePositions: [3], awayPositions: [3], type: 'singles', format: '501', checkout: 'double' }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Master admin player ID (Donnie Pagel) - can access any league
const MASTER_ADMIN_PLAYER_ID = 'X2DMb9bP4Q8fy9yr5Fam';

// Check if a PIN grants access to a league (either league PIN or master admin)
async function checkLeagueAccess(league, pin) {
    // Check if PIN matches league admin or director PIN
    if (league.admin_pin === pin || league.director_pin === pin) {
        return true;
    }

    // Check if PIN belongs to master admin
    const masterCheck = await db.collection('players').where('pin', '==', pin).limit(1).get();
    if (!masterCheck.empty && masterCheck.docs[0].id === MASTER_ADMIN_PLAYER_ID) {
        return true;
    }

    return false;
}

function generatePin() {
    // 8-digit PIN for league admin access
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generatePlayerPin(phone = '') {
    // 8-digit PIN: last 4 digits of phone + 4 random digits
    // If no phone or phone too short, use 8 random digits
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    if (cleanPhone.length >= 4) {
        const lastFour = cleanPhone.slice(-4);
        const randomFour = Math.floor(1000 + Math.random() * 9000).toString();
        return lastFour + randomFour;
    }

    // Fallback to 8 random digits
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generateMatchPin() {
    // 6-digit numeric PIN for match access (100000-999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================================
// PLAYER STATS UPDATE HELPERS
// ============================================================================

/**
 * Update player stats from a completed match
 * Called after match finalization to increment player statistics
 *
 * @param {string} leagueId - League ID
 * @param {object} match - Full match document with games and legs
 * @returns {object} - Summary of stats updated
 */
async function updatePlayerStatsFromMatch(leagueId, match) {
    const playerStats = {}; // Accumulate stats by player ID

    // Process each game in the match
    for (const game of (match.games || [])) {
        if (game.status !== 'completed') continue;

        const isX01 = ['501', '301', '701', 'x01'].includes(game.format?.toLowerCase() || '501');
        const isCricket = game.format?.toLowerCase() === 'cricket';

        // Get player IDs from game
        const homePlayers = game.home_players || [];
        const awayPlayers = game.away_players || [];

        // Process each leg in the game
        for (const leg of (game.legs || [])) {
            const legWinner = leg.winner; // 'home' or 'away'

            // Process home player stats
            for (const player of homePlayers) {
                const pid = player.id;
                if (!pid) continue;

                if (!playerStats[pid]) {
                    playerStats[pid] = {
                        player_id: pid,
                        player_name: player.name || 'Unknown',
                        games_played: 0,
                        games_won: 0,
                        // X01 Stats
                        x01_legs_played: 0,
                        x01_legs_won: 0,
                        x01_total_darts: 0,
                        x01_total_points: 0,
                        x01_first9_darts: 0,
                        x01_first9_points: 0,
                        x01_first_turn_total: 0,
                        x01_first_turn_count: 0,
                        x01_tons: 0,
                        x01_ton_00: 0,
                        x01_ton_20: 0,
                        x01_ton_40: 0,
                        x01_ton_60: 0,
                        x01_ton_80: 0,
                        x01_ton_points_total: 0,
                        x01_high_checkout: 0,
                        x01_checkouts_hit: 0,
                        x01_checkout_attempts: 0,
                        x01_checkout_darts: 0,
                        x01_total_checkout_points: 0,
                        x01_high_score: 0,
                        x01_high_straight_in: 0,
                        x01_best_leg: 999,
                        // Checkout ranges
                        x01_co_80_attempts: 0, x01_co_80_hits: 0,
                        x01_co_120_attempts: 0, x01_co_120_hits: 0,
                        x01_co_140_attempts: 0, x01_co_140_hits: 0,
                        x01_co_161_attempts: 0, x01_co_161_hits: 0,
                        // With/Against Darts
                        x01_legs_with_darts: 0, x01_legs_with_darts_won: 0,
                        x01_legs_against_darts: 0, x01_legs_against_darts_won: 0,
                        // Opponent tracking
                        x01_opponent_points_total: 0, x01_opponent_darts_total: 0,
                        // Cricket Stats
                        cricket_legs_played: 0,
                        cricket_legs_won: 0,
                        cricket_total_marks: 0,
                        cricket_total_darts: 0,
                        cricket_total_rounds: 0,
                        cricket_missed_darts: 0,
                        cricket_triple_bull_darts: 0,
                        cricket_five_mark_rounds: 0,
                        cricket_six_mark_rounds: 0,
                        cricket_seven_mark_rounds: 0,
                        cricket_eight_mark_rounds: 0,
                        cricket_nine_mark_rounds: 0,
                        cricket_three_bulls: 0, cricket_four_bulls: 0,
                        cricket_five_bulls: 0, cricket_six_bulls: 0,
                        cricket_hat_tricks: 0,
                        cricket_legs_with_darts: 0, cricket_legs_with_darts_won: 0,
                        cricket_legs_against_darts: 0, cricket_legs_against_darts_won: 0,
                        cricket_high_mark_round: 0,
                        cricket_low_rounds: 999
                    };
                }

                // Use per-player stats if available (for doubles), otherwise fall back to aggregated
                const perPlayerStats = leg.player_stats || {};
                const playerName = player.name || '';
                const hasIndividualStats = perPlayerStats[playerName] && Object.keys(perPlayerStats[playerName]).length > 0;
                const stats = hasIndividualStats ? perPlayerStats[playerName] : (leg.home_stats || {});
                const oppStats = leg.away_stats || {};

                if (isX01) {
                    playerStats[pid].x01_legs_played++;
                    const isWinner = legWinner === 'home';
                    if (isWinner) playerStats[pid].x01_legs_won++;

                    // Basic stats
                    playerStats[pid].x01_total_darts += stats.darts_thrown || 0;
                    playerStats[pid].x01_total_points += stats.points_scored || 0;
                    playerStats[pid].x01_first9_darts += stats.first9_darts || 0;
                    playerStats[pid].x01_first9_points += stats.first9_points || 0;

                    // First turn (HSI)
                    if (stats.first_turn_score && stats.first_turn_score > 0) {
                        playerStats[pid].x01_first_turn_total += stats.first_turn_score;
                        playerStats[pid].x01_first_turn_count++;
                        if (stats.first_turn_score > playerStats[pid].x01_high_straight_in) {
                            playerStats[pid].x01_high_straight_in = stats.first_turn_score;
                        }
                    }

                    // Ton stats
                    playerStats[pid].x01_tons += stats.tons || 0;
                    playerStats[pid].x01_ton_00 += stats.ton_00 || 0;
                    playerStats[pid].x01_ton_20 += stats.ton_20 || 0;
                    playerStats[pid].x01_ton_40 += stats.ton_40 || 0;
                    playerStats[pid].x01_ton_60 += stats.ton_60 || 0;
                    playerStats[pid].x01_ton_80 += stats.ton_80 || 0;
                    playerStats[pid].x01_ton_points_total += stats.ton_points || 0;

                    // Checkout stats
                    playerStats[pid].x01_checkout_attempts += stats.checkout_attempts || 0;
                    playerStats[pid].x01_checkout_darts += stats.checkout_darts || 0;

                    // Checkout range tracking
                    playerStats[pid].x01_co_80_attempts += stats.co_80_attempts || 0;
                    playerStats[pid].x01_co_80_hits += stats.co_80_hits || 0;
                    playerStats[pid].x01_co_120_attempts += stats.co_120_attempts || 0;
                    playerStats[pid].x01_co_120_hits += stats.co_120_hits || 0;
                    playerStats[pid].x01_co_140_attempts += stats.co_140_attempts || 0;
                    playerStats[pid].x01_co_140_hits += stats.co_140_hits || 0;
                    playerStats[pid].x01_co_161_attempts += stats.co_161_attempts || 0;
                    playerStats[pid].x01_co_161_hits += stats.co_161_hits || 0;

                    // With/Against darts
                    if (stats.threw_first === true) {
                        playerStats[pid].x01_legs_with_darts++;
                        if (isWinner) playerStats[pid].x01_legs_with_darts_won++;
                    } else if (stats.threw_first === false) {
                        playerStats[pid].x01_legs_against_darts++;
                        if (isWinner) playerStats[pid].x01_legs_against_darts_won++;
                    }

                    // Opponent tracking
                    playerStats[pid].x01_opponent_points_total += oppStats.points_scored || 0;
                    playerStats[pid].x01_opponent_darts_total += oppStats.darts_thrown || 0;

                    // Winner-specific checkout stats
                    if (stats.checkout && stats.checkout > 0 && isWinner) {
                        playerStats[pid].x01_checkouts_hit++;
                        playerStats[pid].x01_total_checkout_points += stats.checkout;
                        if (stats.checkout > playerStats[pid].x01_high_checkout) {
                            playerStats[pid].x01_high_checkout = stats.checkout;
                        }
                        const legDarts = stats.darts_thrown || 0;
                        if (legDarts > 0 && legDarts < playerStats[pid].x01_best_leg) {
                            playerStats[pid].x01_best_leg = legDarts;
                        }
                    }

                    // High score
                    if (stats.high_score && stats.high_score > playerStats[pid].x01_high_score) {
                        playerStats[pid].x01_high_score = stats.high_score;
                    }
                } else if (isCricket) {
                    const cricketStats = leg.cricket_stats?.home || stats;
                    playerStats[pid].cricket_legs_played++;
                    const isWinner = legWinner === 'home';
                    if (isWinner) playerStats[pid].cricket_legs_won++;

                    // Basic stats
                    playerStats[pid].cricket_total_marks += cricketStats.total_marks || cricketStats.marks || 0;
                    playerStats[pid].cricket_total_darts += cricketStats.darts || stats.darts_thrown || 0;
                    playerStats[pid].cricket_total_rounds += cricketStats.rounds || stats.rounds || 0;

                    // Dart quality
                    playerStats[pid].cricket_missed_darts += cricketStats.missed_darts || stats.missed_darts || 0;
                    playerStats[pid].cricket_triple_bull_darts += cricketStats.triple_bull_darts || stats.triple_bull_darts || 0;

                    // Mark rounds
                    playerStats[pid].cricket_five_mark_rounds += cricketStats.five_mark_rounds || stats.five_mark_rounds || 0;
                    playerStats[pid].cricket_six_mark_rounds += cricketStats.six_mark_rounds || stats.six_mark_rounds || 0;
                    playerStats[pid].cricket_seven_mark_rounds += cricketStats.seven_mark_rounds || stats.seven_mark_rounds || 0;
                    playerStats[pid].cricket_eight_mark_rounds += cricketStats.eight_mark_rounds || stats.eight_mark_rounds || 0;
                    playerStats[pid].cricket_nine_mark_rounds += cricketStats.nine_mark_rounds || stats.nine_mark_rounds || 0;

                    // Bull achievements
                    playerStats[pid].cricket_three_bulls += cricketStats.three_bulls || stats.three_bulls || 0;
                    playerStats[pid].cricket_four_bulls += cricketStats.four_bulls || stats.four_bulls || 0;
                    playerStats[pid].cricket_five_bulls += cricketStats.five_bulls || stats.five_bulls || 0;
                    playerStats[pid].cricket_six_bulls += cricketStats.six_bulls || stats.six_bulls || 0;
                    playerStats[pid].cricket_hat_tricks += cricketStats.hat_tricks || stats.hat_tricks || 0;

                    // With/Against darts
                    if (stats.threw_first === true) {
                        playerStats[pid].cricket_legs_with_darts++;
                        if (isWinner) playerStats[pid].cricket_legs_with_darts_won++;
                    } else if (stats.threw_first === false) {
                        playerStats[pid].cricket_legs_against_darts++;
                        if (isWinner) playerStats[pid].cricket_legs_against_darts_won++;
                    }

                    // High mark round (max)
                    const highMark = cricketStats.high_mark_round || stats.high_mark_round || 0;
                    if (highMark > playerStats[pid].cricket_high_mark_round) {
                        playerStats[pid].cricket_high_mark_round = highMark;
                    }

                    // Low rounds (min) - only when winner
                    const rounds = cricketStats.rounds || stats.rounds || 0;
                    if (isWinner && rounds > 0 && rounds < playerStats[pid].cricket_low_rounds) {
                        playerStats[pid].cricket_low_rounds = rounds;
                    }
                }
            }

            // Process away player stats (same logic as home, but for away)
            for (const player of awayPlayers) {
                const pid = player.id;
                if (!pid) continue;

                if (!playerStats[pid]) {
                    playerStats[pid] = {
                        player_id: pid,
                        player_name: player.name || 'Unknown',
                        games_played: 0,
                        games_won: 0,
                        // X01 Stats
                        x01_legs_played: 0,
                        x01_legs_won: 0,
                        x01_total_darts: 0,
                        x01_total_points: 0,
                        x01_first9_darts: 0,
                        x01_first9_points: 0,
                        x01_first_turn_total: 0,
                        x01_first_turn_count: 0,
                        x01_tons: 0,
                        x01_ton_00: 0,
                        x01_ton_20: 0,
                        x01_ton_40: 0,
                        x01_ton_60: 0,
                        x01_ton_80: 0,
                        x01_ton_points_total: 0,
                        x01_high_checkout: 0,
                        x01_checkouts_hit: 0,
                        x01_checkout_attempts: 0,
                        x01_checkout_darts: 0,
                        x01_total_checkout_points: 0,
                        x01_high_score: 0,
                        x01_high_straight_in: 0,
                        x01_best_leg: 999,
                        x01_co_80_attempts: 0, x01_co_80_hits: 0,
                        x01_co_120_attempts: 0, x01_co_120_hits: 0,
                        x01_co_140_attempts: 0, x01_co_140_hits: 0,
                        x01_co_161_attempts: 0, x01_co_161_hits: 0,
                        x01_legs_with_darts: 0, x01_legs_with_darts_won: 0,
                        x01_legs_against_darts: 0, x01_legs_against_darts_won: 0,
                        x01_opponent_points_total: 0, x01_opponent_darts_total: 0,
                        // Cricket Stats
                        cricket_legs_played: 0,
                        cricket_legs_won: 0,
                        cricket_total_marks: 0,
                        cricket_total_darts: 0,
                        cricket_total_rounds: 0,
                        cricket_missed_darts: 0,
                        cricket_triple_bull_darts: 0,
                        cricket_five_mark_rounds: 0,
                        cricket_six_mark_rounds: 0,
                        cricket_seven_mark_rounds: 0,
                        cricket_eight_mark_rounds: 0,
                        cricket_nine_mark_rounds: 0,
                        cricket_three_bulls: 0, cricket_four_bulls: 0,
                        cricket_five_bulls: 0, cricket_six_bulls: 0,
                        cricket_hat_tricks: 0,
                        cricket_legs_with_darts: 0, cricket_legs_with_darts_won: 0,
                        cricket_legs_against_darts: 0, cricket_legs_against_darts_won: 0,
                        cricket_high_mark_round: 0,
                        cricket_low_rounds: 999
                    };
                }

                // Use per-player stats if available (for doubles), otherwise fall back to aggregated
                const perPlayerStats = leg.player_stats || {};
                const playerName = player.name || '';
                const hasIndividualStats = perPlayerStats[playerName] && Object.keys(perPlayerStats[playerName]).length > 0;
                const stats = hasIndividualStats ? perPlayerStats[playerName] : (leg.away_stats || {});
                const oppStats = leg.home_stats || {};

                if (isX01) {
                    playerStats[pid].x01_legs_played++;
                    const isWinner = legWinner === 'away';
                    if (isWinner) playerStats[pid].x01_legs_won++;

                    // Basic stats
                    playerStats[pid].x01_total_darts += stats.darts_thrown || 0;
                    playerStats[pid].x01_total_points += stats.points_scored || 0;
                    playerStats[pid].x01_first9_darts += stats.first9_darts || 0;
                    playerStats[pid].x01_first9_points += stats.first9_points || 0;

                    // First turn (HSI)
                    if (stats.first_turn_score && stats.first_turn_score > 0) {
                        playerStats[pid].x01_first_turn_total += stats.first_turn_score;
                        playerStats[pid].x01_first_turn_count++;
                        if (stats.first_turn_score > playerStats[pid].x01_high_straight_in) {
                            playerStats[pid].x01_high_straight_in = stats.first_turn_score;
                        }
                    }

                    // Ton stats
                    playerStats[pid].x01_tons += stats.tons || 0;
                    playerStats[pid].x01_ton_00 += stats.ton_00 || 0;
                    playerStats[pid].x01_ton_20 += stats.ton_20 || 0;
                    playerStats[pid].x01_ton_40 += stats.ton_40 || 0;
                    playerStats[pid].x01_ton_60 += stats.ton_60 || 0;
                    playerStats[pid].x01_ton_80 += stats.ton_80 || 0;
                    playerStats[pid].x01_ton_points_total += stats.ton_points || 0;

                    // Checkout stats
                    playerStats[pid].x01_checkout_attempts += stats.checkout_attempts || 0;
                    playerStats[pid].x01_checkout_darts += stats.checkout_darts || 0;

                    // Checkout range tracking
                    playerStats[pid].x01_co_80_attempts += stats.co_80_attempts || 0;
                    playerStats[pid].x01_co_80_hits += stats.co_80_hits || 0;
                    playerStats[pid].x01_co_120_attempts += stats.co_120_attempts || 0;
                    playerStats[pid].x01_co_120_hits += stats.co_120_hits || 0;
                    playerStats[pid].x01_co_140_attempts += stats.co_140_attempts || 0;
                    playerStats[pid].x01_co_140_hits += stats.co_140_hits || 0;
                    playerStats[pid].x01_co_161_attempts += stats.co_161_attempts || 0;
                    playerStats[pid].x01_co_161_hits += stats.co_161_hits || 0;

                    // With/Against darts
                    if (stats.threw_first === true) {
                        playerStats[pid].x01_legs_with_darts++;
                        if (isWinner) playerStats[pid].x01_legs_with_darts_won++;
                    } else if (stats.threw_first === false) {
                        playerStats[pid].x01_legs_against_darts++;
                        if (isWinner) playerStats[pid].x01_legs_against_darts_won++;
                    }

                    // Opponent tracking
                    playerStats[pid].x01_opponent_points_total += oppStats.points_scored || 0;
                    playerStats[pid].x01_opponent_darts_total += oppStats.darts_thrown || 0;

                    // Winner-specific checkout stats
                    if (stats.checkout && stats.checkout > 0 && isWinner) {
                        playerStats[pid].x01_checkouts_hit++;
                        playerStats[pid].x01_total_checkout_points += stats.checkout;
                        if (stats.checkout > playerStats[pid].x01_high_checkout) {
                            playerStats[pid].x01_high_checkout = stats.checkout;
                        }
                        const legDarts = stats.darts_thrown || 0;
                        if (legDarts > 0 && legDarts < playerStats[pid].x01_best_leg) {
                            playerStats[pid].x01_best_leg = legDarts;
                        }
                    }

                    // High score
                    if (stats.high_score && stats.high_score > playerStats[pid].x01_high_score) {
                        playerStats[pid].x01_high_score = stats.high_score;
                    }
                } else if (isCricket) {
                    const cricketStats = leg.cricket_stats?.away || stats;
                    playerStats[pid].cricket_legs_played++;
                    const isWinner = legWinner === 'away';
                    if (isWinner) playerStats[pid].cricket_legs_won++;

                    // Basic stats
                    playerStats[pid].cricket_total_marks += cricketStats.total_marks || cricketStats.marks || 0;
                    playerStats[pid].cricket_total_darts += cricketStats.darts || stats.darts_thrown || 0;
                    playerStats[pid].cricket_total_rounds += cricketStats.rounds || stats.rounds || 0;

                    // Dart quality
                    playerStats[pid].cricket_missed_darts += cricketStats.missed_darts || stats.missed_darts || 0;
                    playerStats[pid].cricket_triple_bull_darts += cricketStats.triple_bull_darts || stats.triple_bull_darts || 0;

                    // Mark rounds
                    playerStats[pid].cricket_five_mark_rounds += cricketStats.five_mark_rounds || stats.five_mark_rounds || 0;
                    playerStats[pid].cricket_six_mark_rounds += cricketStats.six_mark_rounds || stats.six_mark_rounds || 0;
                    playerStats[pid].cricket_seven_mark_rounds += cricketStats.seven_mark_rounds || stats.seven_mark_rounds || 0;
                    playerStats[pid].cricket_eight_mark_rounds += cricketStats.eight_mark_rounds || stats.eight_mark_rounds || 0;
                    playerStats[pid].cricket_nine_mark_rounds += cricketStats.nine_mark_rounds || stats.nine_mark_rounds || 0;

                    // Bull achievements
                    playerStats[pid].cricket_three_bulls += cricketStats.three_bulls || stats.three_bulls || 0;
                    playerStats[pid].cricket_four_bulls += cricketStats.four_bulls || stats.four_bulls || 0;
                    playerStats[pid].cricket_five_bulls += cricketStats.five_bulls || stats.five_bulls || 0;
                    playerStats[pid].cricket_six_bulls += cricketStats.six_bulls || stats.six_bulls || 0;
                    playerStats[pid].cricket_hat_tricks += cricketStats.hat_tricks || stats.hat_tricks || 0;

                    // With/Against darts
                    if (stats.threw_first === true) {
                        playerStats[pid].cricket_legs_with_darts++;
                        if (isWinner) playerStats[pid].cricket_legs_with_darts_won++;
                    } else if (stats.threw_first === false) {
                        playerStats[pid].cricket_legs_against_darts++;
                        if (isWinner) playerStats[pid].cricket_legs_against_darts_won++;
                    }

                    // High mark round (max)
                    const highMark = cricketStats.high_mark_round || stats.high_mark_round || 0;
                    if (highMark > playerStats[pid].cricket_high_mark_round) {
                        playerStats[pid].cricket_high_mark_round = highMark;
                    }

                    // Low rounds (min) - only when winner
                    const rounds = cricketStats.rounds || stats.rounds || 0;
                    if (isWinner && rounds > 0 && rounds < playerStats[pid].cricket_low_rounds) {
                        playerStats[pid].cricket_low_rounds = rounds;
                    }
                }
            }
        }

        // Track game wins (by looking at game.winner)
        if (game.winner) {
            for (const player of homePlayers) {
                if (player.id && playerStats[player.id]) {
                    playerStats[player.id].games_played++;
                    if (game.winner === 'home') playerStats[player.id].games_won++;
                }
            }
            for (const player of awayPlayers) {
                if (player.id && playerStats[player.id]) {
                    playerStats[player.id].games_played++;
                    if (game.winner === 'away') playerStats[player.id].games_won++;
                }
            }
        }
    }

    // Now update the stats in Firestore
    const batch = db.batch();
    const updatedPlayers = [];

    for (const [playerId, stats] of Object.entries(playerStats)) {
        // Update league stats
        const leagueStatsRef = db.collection('leagues').doc(leagueId)
            .collection('stats').doc(playerId);

        // Use increment for all numeric fields
        const leagueUpdate = {
            player_id: playerId,
            player_name: stats.player_name,
            games_played: admin.firestore.FieldValue.increment(stats.games_played),
            games_won: admin.firestore.FieldValue.increment(stats.games_won),
            // X01 Stats
            x01_legs_played: admin.firestore.FieldValue.increment(stats.x01_legs_played),
            x01_legs_won: admin.firestore.FieldValue.increment(stats.x01_legs_won),
            x01_total_darts: admin.firestore.FieldValue.increment(stats.x01_total_darts),
            x01_total_points: admin.firestore.FieldValue.increment(stats.x01_total_points),
            x01_first9_darts: admin.firestore.FieldValue.increment(stats.x01_first9_darts),
            x01_first9_points: admin.firestore.FieldValue.increment(stats.x01_first9_points),
            x01_first_turn_total: admin.firestore.FieldValue.increment(stats.x01_first_turn_total),
            x01_first_turn_count: admin.firestore.FieldValue.increment(stats.x01_first_turn_count),
            x01_tons: admin.firestore.FieldValue.increment(stats.x01_tons),
            x01_ton_00: admin.firestore.FieldValue.increment(stats.x01_ton_00),
            x01_ton_20: admin.firestore.FieldValue.increment(stats.x01_ton_20),
            x01_ton_40: admin.firestore.FieldValue.increment(stats.x01_ton_40),
            x01_ton_60: admin.firestore.FieldValue.increment(stats.x01_ton_60),
            x01_ton_80: admin.firestore.FieldValue.increment(stats.x01_ton_80),
            x01_ton_points_total: admin.firestore.FieldValue.increment(stats.x01_ton_points_total),
            x01_checkouts_hit: admin.firestore.FieldValue.increment(stats.x01_checkouts_hit),
            x01_checkout_attempts: admin.firestore.FieldValue.increment(stats.x01_checkout_attempts),
            x01_checkout_darts: admin.firestore.FieldValue.increment(stats.x01_checkout_darts),
            x01_total_checkout_points: admin.firestore.FieldValue.increment(stats.x01_total_checkout_points),
            // Checkout ranges
            x01_co_80_attempts: admin.firestore.FieldValue.increment(stats.x01_co_80_attempts),
            x01_co_80_hits: admin.firestore.FieldValue.increment(stats.x01_co_80_hits),
            x01_co_120_attempts: admin.firestore.FieldValue.increment(stats.x01_co_120_attempts),
            x01_co_120_hits: admin.firestore.FieldValue.increment(stats.x01_co_120_hits),
            x01_co_140_attempts: admin.firestore.FieldValue.increment(stats.x01_co_140_attempts),
            x01_co_140_hits: admin.firestore.FieldValue.increment(stats.x01_co_140_hits),
            x01_co_161_attempts: admin.firestore.FieldValue.increment(stats.x01_co_161_attempts),
            x01_co_161_hits: admin.firestore.FieldValue.increment(stats.x01_co_161_hits),
            // With/Against Darts
            x01_legs_with_darts: admin.firestore.FieldValue.increment(stats.x01_legs_with_darts),
            x01_legs_with_darts_won: admin.firestore.FieldValue.increment(stats.x01_legs_with_darts_won),
            x01_legs_against_darts: admin.firestore.FieldValue.increment(stats.x01_legs_against_darts),
            x01_legs_against_darts_won: admin.firestore.FieldValue.increment(stats.x01_legs_against_darts_won),
            // Opponent tracking
            x01_opponent_points_total: admin.firestore.FieldValue.increment(stats.x01_opponent_points_total),
            x01_opponent_darts_total: admin.firestore.FieldValue.increment(stats.x01_opponent_darts_total),
            // Cricket Stats
            cricket_legs_played: admin.firestore.FieldValue.increment(stats.cricket_legs_played),
            cricket_legs_won: admin.firestore.FieldValue.increment(stats.cricket_legs_won),
            cricket_total_marks: admin.firestore.FieldValue.increment(stats.cricket_total_marks),
            cricket_total_darts: admin.firestore.FieldValue.increment(stats.cricket_total_darts),
            cricket_total_rounds: admin.firestore.FieldValue.increment(stats.cricket_total_rounds),
            cricket_missed_darts: admin.firestore.FieldValue.increment(stats.cricket_missed_darts),
            cricket_triple_bull_darts: admin.firestore.FieldValue.increment(stats.cricket_triple_bull_darts),
            cricket_five_mark_rounds: admin.firestore.FieldValue.increment(stats.cricket_five_mark_rounds),
            cricket_six_mark_rounds: admin.firestore.FieldValue.increment(stats.cricket_six_mark_rounds),
            cricket_seven_mark_rounds: admin.firestore.FieldValue.increment(stats.cricket_seven_mark_rounds),
            cricket_eight_mark_rounds: admin.firestore.FieldValue.increment(stats.cricket_eight_mark_rounds),
            cricket_nine_mark_rounds: admin.firestore.FieldValue.increment(stats.cricket_nine_mark_rounds),
            cricket_three_bulls: admin.firestore.FieldValue.increment(stats.cricket_three_bulls),
            cricket_four_bulls: admin.firestore.FieldValue.increment(stats.cricket_four_bulls),
            cricket_five_bulls: admin.firestore.FieldValue.increment(stats.cricket_five_bulls),
            cricket_six_bulls: admin.firestore.FieldValue.increment(stats.cricket_six_bulls),
            cricket_hat_tricks: admin.firestore.FieldValue.increment(stats.cricket_hat_tricks),
            cricket_legs_with_darts: admin.firestore.FieldValue.increment(stats.cricket_legs_with_darts),
            cricket_legs_with_darts_won: admin.firestore.FieldValue.increment(stats.cricket_legs_with_darts_won),
            cricket_legs_against_darts: admin.firestore.FieldValue.increment(stats.cricket_legs_against_darts),
            cricket_legs_against_darts_won: admin.firestore.FieldValue.increment(stats.cricket_legs_against_darts_won),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(leagueStatsRef, leagueUpdate, { merge: true });

        // Handle high/low scores (need to read current and compare)
        // We'll do this outside the batch for simplicity
        updatedPlayers.push({ playerId, stats });
    }

    await batch.commit();

    // Update high/low scores separately (requires read first)
    for (const { playerId, stats } of updatedPlayers) {
        const leagueStatsRef = db.collection('leagues').doc(leagueId)
            .collection('stats').doc(playerId);
        const currentDoc = await leagueStatsRef.get();
        const current = currentDoc.data() || {};

        const maxMinUpdates = {};

        // X01 max stats
        if (stats.x01_high_checkout > (current.x01_high_checkout || 0)) {
            maxMinUpdates.x01_high_checkout = stats.x01_high_checkout;
        }
        if (stats.x01_high_score > (current.x01_high_score || 0)) {
            maxMinUpdates.x01_high_score = stats.x01_high_score;
        }
        if (stats.x01_high_straight_in > (current.x01_high_straight_in || 0)) {
            maxMinUpdates.x01_high_straight_in = stats.x01_high_straight_in;
        }
        // X01 min stats
        if (stats.x01_best_leg < 999 && stats.x01_best_leg < (current.x01_best_leg || 999)) {
            maxMinUpdates.x01_best_leg = stats.x01_best_leg;
        }

        // Cricket max stats
        if (stats.cricket_high_mark_round > (current.cricket_high_mark_round || 0)) {
            maxMinUpdates.cricket_high_mark_round = stats.cricket_high_mark_round;
        }
        // Cricket min stats
        if (stats.cricket_low_rounds < 999 && stats.cricket_low_rounds < (current.cricket_low_rounds || 999)) {
            maxMinUpdates.cricket_low_rounds = stats.cricket_low_rounds;
        }

        if (Object.keys(maxMinUpdates).length > 0) {
            await leagueStatsRef.update(maxMinUpdates);
        }

        // Also update global player stats
        const globalStatsRef = db.collection('players').doc(playerId);
        const globalDoc = await globalStatsRef.get();
        if (globalDoc.exists) {
            const globalUpdate = {
                'stats.matches_played': admin.firestore.FieldValue.increment(1),
                'stats.x01.legs_played': admin.firestore.FieldValue.increment(stats.x01_legs_played),
                'stats.x01.legs_won': admin.firestore.FieldValue.increment(stats.x01_legs_won),
                'stats.x01.total_darts': admin.firestore.FieldValue.increment(stats.x01_total_darts),
                'stats.x01.total_points': admin.firestore.FieldValue.increment(stats.x01_total_points),
                'stats.x01.ton_eighties': admin.firestore.FieldValue.increment(stats.x01_ton_80),
                'stats.cricket.legs_played': admin.firestore.FieldValue.increment(stats.cricket_legs_played),
                'stats.cricket.legs_won': admin.firestore.FieldValue.increment(stats.cricket_legs_won),
                'stats.cricket.total_marks': admin.firestore.FieldValue.increment(stats.cricket_total_marks),
                'stats.last_updated': admin.firestore.FieldValue.serverTimestamp()
            };
            await globalStatsRef.set(globalUpdate, { merge: true });
        }
    }

    return {
        playersUpdated: updatedPlayers.length,
        playerIds: updatedPlayers.map(p => p.playerId)
    };
}

/**
 * Recalculate all stats for a player from scratch by scanning all completed matches
 * @param {string} playerId - The global player ID
 * @param {string} leagueId - Optional: specific league to recalculate, or null for all leagues
 * @returns {Object} Summary of recalculated stats
 */
async function recalculatePlayerStatsFromMatches(playerId, leagueId = null) {
    // Initialize fresh stats
    const freshStats = {
        player_id: playerId,
        games_played: 0,
        games_won: 0,
        // X01
        x01_legs_played: 0,
        x01_legs_won: 0,
        x01_total_darts: 0,
        x01_total_points: 0,
        x01_tons: 0,
        x01_ton_00: 0,
        x01_ton_20: 0,
        x01_ton_40: 0,
        x01_ton_60: 0,
        x01_ton_80: 0,
        x01_high_checkout: 0,
        x01_checkouts_hit: 0,
        x01_checkout_attempts: 0,
        // Cricket
        cricket_legs_played: 0,
        cricket_legs_won: 0,
        cricket_total_marks: 0,
        cricket_total_darts: 0,
        cricket_nine_mark_rounds: 0,
        cricket_white_horse: 0
    };

    let matchesProcessed = 0;
    let leaguesProcessed = [];

    // Get leagues to process
    let leagueIds = [];
    if (leagueId) {
        leagueIds = [leagueId];
    } else {
        // Get all leagues the player has been in
        const leaguesSnap = await db.collection('leagues').get();
        leagueIds = leaguesSnap.docs.map(doc => doc.id);
    }

    // Process each league
    for (const lid of leagueIds) {
        // Get all completed matches in this league
        const matchesSnap = await db.collection('leagues').doc(lid)
            .collection('matches')
            .where('status', '==', 'completed')
            .get();

        let playerInLeague = false;

        for (const matchDoc of matchesSnap.docs) {
            const match = matchDoc.data();
            const games = match.games || [];

            for (const game of games) {
                if (game.status !== 'completed') continue;

                const isX01 = ['501', '301', '701', 'x01'].includes(game.format?.toLowerCase() || '501');
                const isCricket = game.format?.toLowerCase() === 'cricket';

                // Check if player is in this game
                const homePlayers = game.home_players || [];
                const awayPlayers = game.away_players || [];
                const isHome = homePlayers.some(p => p.id === playerId);
                const isAway = awayPlayers.some(p => p.id === playerId);

                if (!isHome && !isAway) continue;

                playerInLeague = true;
                const side = isHome ? 'home' : 'away';
                const oppSide = isHome ? 'away' : 'home';

                // Count game win
                freshStats.games_played++;
                if (game.winner === side) {
                    freshStats.games_won++;
                }

                // Process legs for detailed stats
                // For team games (doubles/triples), stats are shared among players on the side
                // So we divide by number of players on the team to get per-player stats
                const legs = game.legs || [];
                const playersOnSide = side === 'home' ? homePlayers.length : awayPlayers.length;
                const statsDivisor = playersOnSide > 0 ? playersOnSide : 1;

                for (const leg of legs) {
                    // Get player's stats from this leg based on which side they're on
                    const legStats = side === 'home' ? leg.home_stats : leg.away_stats;
                    const cricketStats = leg.cricket_stats?.[side];

                    // For X01 games - player was on this side so they get credit
                    if (isX01 && legStats) {
                        freshStats.x01_legs_played++;
                        if (leg.winner === side) {
                            freshStats.x01_legs_won++;
                        }

                        // For team games, divide stats among players
                        freshStats.x01_total_darts += Math.round((legStats.darts_thrown || 0) / statsDivisor);
                        freshStats.x01_total_points += Math.round((legStats.points_scored || 0) / statsDivisor);
                        freshStats.x01_tons += Math.round((legStats.tons || 0) / statsDivisor);
                        freshStats.x01_ton_00 += Math.round((legStats.ton_00 || 0) / statsDivisor);
                        freshStats.x01_ton_20 += Math.round((legStats.ton_20 || 0) / statsDivisor);
                        freshStats.x01_ton_40 += Math.round((legStats.ton_40 || 0) / statsDivisor);
                        freshStats.x01_ton_60 += Math.round((legStats.ton_60 || 0) / statsDivisor);
                        freshStats.x01_ton_80 += Math.round((legStats.ton_80 || 0) / statsDivisor);
                        freshStats.x01_checkouts_hit += legStats.checkout ? 1 : 0;
                        freshStats.x01_checkout_attempts += legStats.checkout_attempts || 0;

                        if (legStats.checkout && legStats.checkout > freshStats.x01_high_checkout) {
                            freshStats.x01_high_checkout = legStats.checkout;
                        }
                    }

                    // For Cricket games
                    if (isCricket && cricketStats) {
                        freshStats.cricket_legs_played++;
                        if (leg.winner === side) {
                            freshStats.cricket_legs_won++;
                        }

                        freshStats.cricket_total_marks += Math.round((cricketStats.total_marks || 0) / statsDivisor);
                        freshStats.cricket_total_darts += cricketStats.rounds ? Math.round((cricketStats.rounds * 3) / statsDivisor) : 0;
                        freshStats.cricket_nine_mark_rounds += Math.round((cricketStats.nine_mark_rounds || 0) / statsDivisor);
                        freshStats.cricket_white_horse += Math.round((cricketStats.white_horse || 0) / statsDivisor);
                    }
                }
            }

            if (playerInLeague) {
                matchesProcessed++;
            }
        }

        if (playerInLeague) {
            leaguesProcessed.push(lid);
        }
    }

    // Calculate derived averages
    if (freshStats.x01_total_darts > 0) {
        freshStats.x01_three_dart_avg = parseFloat((freshStats.x01_total_points / freshStats.x01_total_darts * 3).toFixed(2));
    }
    if (freshStats.cricket_total_darts > 0) {
        freshStats.cricket_mpr = parseFloat((freshStats.cricket_total_marks / freshStats.cricket_total_darts * 3).toFixed(2));
    }
    if (freshStats.x01_checkout_attempts > 0) {
        freshStats.x01_checkout_percentage = parseFloat((freshStats.x01_checkouts_hit / freshStats.x01_checkout_attempts * 100).toFixed(1));
    }

    freshStats.updated_at = admin.firestore.FieldValue.serverTimestamp();
    freshStats.recalculated_at = admin.firestore.FieldValue.serverTimestamp();

    // Write to appropriate location
    if (leagueId) {
        // Update specific league stats
        await db.collection('leagues').doc(leagueId)
            .collection('stats').doc(playerId)
            .set(freshStats, { merge: true });
    } else {
        // Update global player stats
        const playerRef = db.collection('players').doc(playerId);
        await playerRef.set({
            stats: {
                matches_played: freshStats.games_played,
                matches_won: freshStats.games_won,
                x01: {
                    legs_played: freshStats.x01_legs_played,
                    legs_won: freshStats.x01_legs_won,
                    total_darts: freshStats.x01_total_darts,
                    total_points: freshStats.x01_total_points,
                    three_dart_avg: freshStats.x01_three_dart_avg || 0,
                    tons: freshStats.x01_tons,
                    ton_eighties: freshStats.x01_ton_80,
                    high_checkout: freshStats.x01_high_checkout
                },
                cricket: {
                    legs_played: freshStats.cricket_legs_played,
                    legs_won: freshStats.cricket_legs_won,
                    total_marks: freshStats.cricket_total_marks,
                    cricket_mpr: freshStats.cricket_mpr || 0,
                    nine_mark_rounds: freshStats.cricket_nine_mark_rounds
                },
                last_updated: admin.firestore.FieldValue.serverTimestamp(),
                recalculated_at: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
    }

    return {
        playerId,
        matchesProcessed,
        leaguesProcessed,
        stats: freshStats
    };
}

/**
 * Cloud function to recalculate player stats
 */
exports.recalculatePlayerStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, league_id } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id is required' });
        }

        const result = await recalculatePlayerStatsFromMatches(player_id, league_id || null);

        res.json({
            success: true,
            message: `Stats recalculated from ${result.matchesProcessed} matches`,
            ...result
        });

    } catch (error) {
        console.error('Error recalculating player stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Recalculate league stats for all players in a league
 */
exports.recalculateLeagueStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id is required' });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (admin_pin && admin_pin !== league.admin_pin && admin_pin !== league.director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all players in this league
        const playersSnap = await db.collection('leagues').doc(league_id)
            .collection('players').get();

        const results = [];
        for (const playerDoc of playersSnap.docs) {
            const playerId = playerDoc.id;
            try {
                const result = await recalculatePlayerStatsFromMatches(playerId, league_id);
                results.push({ playerId, success: true, matchesProcessed: result.matchesProcessed });
            } catch (error) {
                results.push({ playerId, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            message: `Recalculated stats for ${results.length} players`,
            results
        });

    } catch (error) {
        console.error('Error recalculating league stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify league director PIN and return league data if valid
 */
exports.verifyLeaguePin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!pin || pin.length !== 8) {
            return res.status(400).json({ success: false, error: 'Invalid PIN format' });
        }

        let leagueDoc;
        let leagueId = league_id;

        if (league_id) {
            // Verify PIN for specific league
            leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (!leagueDoc.exists) {
                return res.status(404).json({ success: false, error: 'League not found' });
            }
        } else {
            // Find league by PIN
            let snap = await db.collection('leagues').where('admin_pin', '==', pin).get();
            if (snap.empty) {
                snap = await db.collection('leagues').where('director_pin', '==', pin).get();
            }
            if (snap.empty) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }
            leagueDoc = snap.docs[0];
            leagueId = leagueDoc.id;
        }

        const league = leagueDoc.data();

        // DEBUG logging
        console.log('verifyLeaguePin - league_id:', leagueId);
        console.log('verifyLeaguePin - entered pin:', pin, 'type:', typeof pin);
        console.log('verifyLeaguePin - stored admin_pin:', league.admin_pin, 'type:', typeof league.admin_pin);
        console.log('verifyLeaguePin - stored director_pin:', league.director_pin, 'type:', typeof league.director_pin);

        // Check PIN matches using helper function (includes master admin check)
        const hasAccess = await checkLeagueAccess(league, pin);
        console.log('verifyLeaguePin - access granted:', hasAccess);

        if (!hasAccess) {
            return res.status(401).json({
                success: false,
                error: 'Invalid PIN',
                debug: {
                    league_id_used: leagueId,
                    doc_exists: leagueDoc.exists,
                    all_keys: Object.keys(league),
                    entered: pin,
                    stored_admin: league.admin_pin,
                    stored_director: league.director_pin,
                    has_admin_key: 'admin_pin' in league,
                    has_director_key: 'director_pin' in league
                }
            });
        }

        // Return league data (excluding sensitive fields for safety)
        const safeLeague = { ...league };
        delete safeLeague.admin_pin;
        delete safeLeague.director_pin;

        res.json({
            success: true,
            league_id: leagueId,
            league: safeLeague
        });

    } catch (error) {
        console.error('Error verifying PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// LEAGUE MANAGEMENT
// ============================================================================

/**
 * Create a new league
 */
exports.createLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const data = req.body;

        // Validate required fields
        if (!data.league_name || !data.start_date || !data.venue_name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_name, start_date, venue_name'
            });
        }

        const playersPerTeam = parseInt(data.players_per_team) || 3;
        const gamesPerMatch = parseInt(data.games_per_match) || 9;

        // Determine league type from team size
        let leagueType = 'triples_draft';
        if (playersPerTeam === 2) leagueType = 'doubles';
        else if (playersPerTeam === 4) leagueType = 'quads';
        else if (playersPerTeam === 5) leagueType = 'fives';

        // Director info
        const directorName = data.director_first_name && data.director_last_name
            ? `${data.director_first_name} ${data.director_last_name}`
            : (data.full_name || '');
        const directorPlayerId = data.director_player_id || null;

        // The director's player PIN IS the league admin PIN - no separate PIN generation
        const directorPin = data.director_pin || null;

        if (!directorPin || directorPin.length !== 8) {
            return res.status(400).json({
                success: false,
                error: 'You must be signed in with your player PIN to create a league'
            });
        }

        // Both admin_pin and director_pin are the same - the player's PIN
        const adminPin = directorPin;

        console.log('createLeague - Using player PIN as admin_pin:', adminPin);

        const league = {
            league_name: data.league_name,
            season: data.season || 'Spring 2025',
            league_type: leagueType,

            // Schedule
            start_date: data.start_date,
            league_night: data.league_night || 'wednesday',
            start_time: data.start_time || '19:00',
            schedule_format: data.schedule_format || 'round_robin', // round_robin, double_round_robin

            // Venue
            venue_name: data.venue_name,
            venue_address: data.venue_address || '',

            // Structure
            num_teams: parseInt(data.num_teams) || 8,
            players_per_team: playersPerTeam,
            games_per_match: gamesPerMatch,
            legs_per_game: 3, // Best of 3 (default)

            // Custom match format (round-by-round)
            // Array of: { game_type, num_players, player_level, best_of, in_rule, out_rule, points }
            match_format: data.match_format || null,

            // Fees
            session_fee: parseFloat(data.session_fee) || 0,

            // Manager contact (for PIN recovery and notifications)
            manager_email: data.manager_email || '',
            manager_phone: data.manager_phone || '',

            // Director info
            director_name: directorName,
            director_player_id: directorPlayerId,
            director_pin: directorPin, // 8-digit player PIN for dashboard access

            // Auth
            admin_pin: adminPin,

            // Scoring & Rules
            point_system: data.point_system || 'game_based', // game_based, match_based
            tiebreakers: data.tiebreakers || ['head_to_head', 'point_diff', 'total_points'],
            cork_rule: data.cork_rule || 'cork_first_leg', // cork_first_leg, cork_every_leg, home_first, higher_seed
            level_rules: data.level_rules || 'play_up', // strict, play_up, flexible

            // Playoffs
            playoff_format: data.playoff_format || 'top_4_single', // none, top_4_single, top_4_double, top_6_single, top_8_single
            bye_points: data.bye_points || 'average', // average, fixed, none

            // Status
            status: data.status || 'registration', // registration, draft, active, playoffs, completed
            current_week: 0,
            total_weeks: 0, // Calculated after teams set

            // Metadata
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const leagueRef = await db.collection('leagues').add(league);

        // Update director's involvements - find by player_id or by PIN
        let actualDirectorPlayerId = directorPlayerId;

        // If no player_id provided but we have the PIN, look up the player
        if (!actualDirectorPlayerId && directorPin) {
            const playerByPin = await db.collection('players')
                .where('pin', '==', directorPin)
                .limit(1)
                .get();
            if (!playerByPin.empty) {
                actualDirectorPlayerId = playerByPin.docs[0].id;
                console.log('createLeague - Found player by PIN:', actualDirectorPlayerId);
            }
        }

        if (actualDirectorPlayerId) {
            try {
                const playerRef = db.collection('players').doc(actualDirectorPlayerId);
                const playerDoc = await playerRef.get();

                if (playerDoc.exists) {
                    await playerRef.update({
                        'involvements.directing': admin.firestore.FieldValue.arrayUnion({
                            id: leagueRef.id,
                            name: data.league_name,
                            type: 'league',
                            status: 'registration',
                            added_at: new Date().toISOString()
                        })
                    });
                    console.log('createLeague - Updated director involvements for player:', actualDirectorPlayerId);
                } else {
                    console.log('createLeague - Player document not found:', actualDirectorPlayerId);
                }
            } catch (involvementError) {
                console.error('Could not update director involvements:', involvementError.message);
                // Non-fatal - continue with success response
            }
        } else {
            console.log('createLeague - No director player ID or PIN found to update involvements');
        }

        res.json({
            success: true,
            league_id: leagueRef.id,
            admin_pin: adminPin,
            message: 'League created successfully'
        });

    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get league details (public info)
 */
exports.getLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        if (!leagueId) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueDoc = await db.collection('leagues').doc(leagueId).get();

        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Remove sensitive data
        delete league.admin_pin;

        res.json({
            success: true,
            league: { id: leagueId, ...league }
        });

    } catch (error) {
        console.error('Error getting league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Fix director involvements for existing leagues
 * REMOVED: One-time data fix function - already run
 */
// exports.fixDirectorInvolvements = functions.https.onRequest(async (req, res) => { ... });

/**
 * Delete a league and all its subcollections
 */
exports.deleteLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        if (!league_id || !admin_pin) {
            return res.status(400).json({ success: false, error: 'Missing league_id or admin_pin' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Accept either admin_pin, director_pin, or master admin
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        // Delete subcollections first
        const subcollections = ['teams', 'players', 'matches', 'stats'];
        for (const subcol of subcollections) {
            const snapshot = await db.collection('leagues').doc(league_id).collection(subcol).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            if (snapshot.docs.length > 0) await batch.commit();
        }

        // Remove from director's involvements if they have a player_id
        if (league.director_player_id) {
            try {
                const playerRef = db.collection('players').doc(league.director_player_id);
                const playerDoc = await playerRef.get();
                if (playerDoc.exists) {
                    const involvements = playerDoc.data().involvements?.directing || [];
                    const updated = involvements.filter(inv => inv.id !== league_id);
                    await playerRef.update({ 'involvements.directing': updated });
                }
            } catch (e) {
                console.log('Could not update director involvements:', e.message);
            }
        }

        // Delete the league document
        await db.collection('leagues').doc(league_id).delete();

        res.json({ success: true, message: 'League deleted successfully' });

    } catch (error) {
        console.error('Error deleting league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league status
 */
exports.updateLeagueStatus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, status } = req.body;

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const validStatuses = ['registration', 'draft', 'active', 'playoffs', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        await db.collection('leagues').doc(league_id).update({
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: `League status updated to ${status}` });

    } catch (error) {
        console.error('Error updating league status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league settings
 */
exports.updateLeagueSettings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, settings } = req.body;

        if (!league_id || !settings) {
            return res.status(400).json({ success: false, error: 'Missing league_id or settings' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Allowed fields that can be updated
        const allowedFields = [
            // League info
            'league_name', 'season', 'start_date', 'league_night', 'start_time',
            'venue_name', 'venue_address',
            // New fields from create-league form
            'league_mode', 'max_teams', 'entry_fee', 'registration_close_date',
            // Match format settings
            'format', 'game_format', 'checkout', 'in_rule', 'out_rule',
            'best_of', 'legs_per_game', 'games_per_match', 'rounds_per_match',
            // Rounds configuration (from format builder)
            'rounds',
            // Rules
            'point_system', 'cork_rule', 'level_rules',
            'session_fee', 'playoff_format', 'bye_points',
            // Tiebreakers
            'tiebreakers',
            // Cork & Start Rules
            'start_rules', 'cork_option', 'cork_winner_gets',
            // Team Configuration
            'min_players', 'max_roster', 'schedule_format', 'allow_fillins',
            // Fill-in configuration options
            'fillin_collect_501_avg', 'fillin_collect_cricket_avg', 'fillin_collect_level',
            // Additional Rules
            'league_rules'
        ];

        // Build update object with only allowed fields
        const updates = {};
        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                updates[field] = settings[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('leagues').doc(league_id).update(updates);

        // If start_date was updated, recalculate match dates
        if (updates.start_date) {
            const newStartDate = new Date(updates.start_date);
            const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();

            if (!matchesSnap.empty) {
                const matchBatch = db.batch();
                let matchesUpdated = 0;

                matchesSnap.forEach(doc => {
                    const match = doc.data();
                    const week = match.week || 1;
                    const matchDate = new Date(newStartDate);
                    matchDate.setDate(newStartDate.getDate() + (week - 1) * 7);

                    matchBatch.update(doc.ref, {
                        match_date: matchDate.toISOString().split('T')[0]
                    });
                    matchesUpdated++;
                });

                await matchBatch.commit();
                console.log(`Updated ${matchesUpdated} match dates based on new start_date`);
            }
        }

        res.json({
            success: true,
            message: 'League settings updated',
            updated_fields: Object.keys(updates).filter(k => k !== 'updated_at')
        });

    } catch (error) {
        console.error('Error updating league settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER REGISTRATION
// ============================================================================

/**
 * Register a player for the league
 */
exports.registerPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, name, email, phone, skill_level } = req.body;

        if (!league_id || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name, email'
            });
        }

        // Check league exists and is accepting registrations
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.status !== 'registration') {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        // Check for duplicate email
        const existingPlayer = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase())
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Check capacity
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const maxPlayers = league.num_teams * league.players_per_team;

        if (playersSnapshot.size >= maxPlayers) {
            return res.status(400).json({ success: false, error: 'League is full' });
        }

        // Generate unique 8-digit PIN for this player (last 4 of phone + 4 random)
        const playerPin = generatePlayerPin(phone);

        const player = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || '',
            skill_level: skill_level || 'intermediate', // beginner, intermediate, advanced, or A/B/C
            reported_average: parseFloat(req.body.average) || null, // Self-reported 501 average
            preferred_level: req.body.preferred_level || null, // A, B, or C preference
            team_id: null,
            position: null, // 1, 2, or 3 (P1/A = captain/advanced, P2/B = mid, P3/C = newer)
            level: null, // A, B, or C - assigned after draft
            is_captain: false,
            is_sub: false,
            pin: playerPin, // 8-digit unique PIN for login
            payment_status: 'pending',
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            player_pin: playerPin, // Include PIN for player to use for login
            message: 'Registration successful',
            spots_remaining: maxPlayers - playersSnapshot.size - 1
        });

    } catch (error) {
        console.error('Error registering player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all registered players
 */
exports.getPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const playersSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .orderBy('registered_at', 'asc')
            .get();

        const players = [];
        playersSnapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, players: players });

    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin add a single player (bypasses registration)
 */
exports.addPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, name, email, phone, skill_level, average, preferred_level } = req.body;

        if (!league_id || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check for duplicate email if provided
        if (email) {
            const existingPlayer = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', email.toLowerCase())
                .get();

            if (!existingPlayer.empty) {
                return res.status(400).json({ success: false, error: 'Email already registered' });
            }
        }

        // Generate unique 8-digit PIN for this player (last 4 of phone + 4 random)
        const playerPin = generatePlayerPin(phone);

        const player = {
            name: name.trim(),
            email: email ? email.toLowerCase().trim() : '',
            phone: phone || '',
            skill_level: skill_level || 'intermediate',
            reported_average: average ? parseFloat(average) : null,
            preferred_level: preferred_level || null,
            team_id: null,
            position: null,
            level: null,
            is_captain: false,
            is_sub: false,
            pin: playerPin,
            payment_status: 'pending',
            added_by_admin: true,
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            player_pin: playerPin,
            message: 'Player added successfully'
        });

    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add a bot to a league's player pool
 */
exports.addBotToLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, bot_id } = req.body;

        if (!league_id || !bot_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, bot_id'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get bot from global bots collection
        const botDoc = await db.collection('bots').doc(bot_id).get();
        if (!botDoc.exists) {
            return res.status(404).json({ success: false, error: 'Bot not found' });
        }

        const bot = botDoc.data();

        // Check if this bot is already in the league
        const existingBot = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('source_bot_id', '==', bot_id)
            .get();

        if (!existingBot.empty) {
            return res.status(400).json({ success: false, error: 'Bot already added to this league' });
        }

        // Add bot as a player in the league
        const player = {
            name: bot.name,
            email: '',
            phone: '',
            skill_level: bot.difficulty,
            reported_average: null,
            preferred_level: bot.difficulty,
            team_id: null,
            position: null,
            level: null,
            is_captain: false,
            is_sub: false,
            isBot: true,
            botDifficulty: bot.difficulty,
            source_bot_id: bot_id,
            pin: null, // Bots don't need PINs
            payment_status: 'paid', // Bots don't pay
            added_by_admin: true,
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            bot_name: bot.name,
            message: 'Bot added to league successfully'
        });

    } catch (error) {
        console.error('Error adding bot to league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin bulk add players
 */
exports.bulkAddPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, players } = req.body;

        if (!league_id || !players || !Array.isArray(players)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, players (array)'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get existing emails to check for duplicates
        const existingPlayersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const existingEmails = new Set();
        existingPlayersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) existingEmails.add(data.email.toLowerCase());
        });

        const results = {
            added: [],
            skipped: [],
            errors: []
        };

        const batch = db.batch();
        let batchCount = 0;

        for (const playerData of players) {
            if (!playerData.name || !playerData.name.trim()) {
                results.skipped.push({ name: playerData.name || 'unnamed', reason: 'No name provided' });
                continue;
            }

            // Check for duplicate email
            if (playerData.email && existingEmails.has(playerData.email.toLowerCase())) {
                results.skipped.push({ name: playerData.name, reason: 'Email already registered' });
                continue;
            }

            // Generate PIN (last 4 of phone + 4 random)
            const playerPin = generatePlayerPin(playerData.phone);

            const player = {
                name: playerData.name.trim(),
                email: playerData.email ? playerData.email.toLowerCase().trim() : '',
                phone: playerData.phone || '',
                skill_level: playerData.skill_level || 'intermediate',
                reported_average: playerData.average ? parseFloat(playerData.average) : null,
                preferred_level: playerData.preferred_level || null,
                team_id: null,
                position: null,
                level: null,
                is_captain: false,
                is_sub: false,
                pin: playerPin,
                payment_status: 'pending',
                added_by_admin: true,
                registered_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc();
            batch.set(playerRef, player);
            batchCount++;

            if (playerData.email) {
                existingEmails.add(playerData.email.toLowerCase());
            }

            results.added.push({
                id: playerRef.id,
                name: player.name,
                pin: playerPin
            });

            // Firestore batch limit is 500
            if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        res.json({
            success: true,
            added_count: results.added.length,
            skipped_count: results.skipped.length,
            results: results,
            message: `Added ${results.added.length} players, skipped ${results.skipped.length}`
        });

    } catch (error) {
        console.error('Error bulk adding players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin update player
 */
exports.updatePlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, player_id, updates } = req.body;

        if (!league_id || !player_id || !updates) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, player_id, updates'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check player exists
        const playerRef = db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Sanitize updates - only allow certain fields
        const allowedFields = ['name', 'email', 'phone', 'skill_level', 'reported_average', 'preferred_level', 'is_sub', 'payment_status', 'team_id', 'position', 'is_captain'];
        const sanitizedUpdates = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'email' && updates[field]) {
                    sanitizedUpdates[field] = updates[field].toLowerCase().trim();
                } else if (field === 'name' && updates[field]) {
                    sanitizedUpdates[field] = updates[field].trim();
                } else if (field === 'reported_average' && updates[field]) {
                    sanitizedUpdates[field] = parseFloat(updates[field]);
                } else if (field === 'position' && updates[field]) {
                    sanitizedUpdates[field] = parseInt(updates[field]);
                } else {
                    sanitizedUpdates[field] = updates[field];
                }
            }
        }

        sanitizedUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await playerRef.update(sanitizedUpdates);

        res.json({
            success: true,
            message: 'Player updated successfully'
        });

    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin delete player
 */
exports.deletePlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, player_id } = req.body;

        if (!league_id || !player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, player_id'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check player exists
        const playerRef = db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const playerData = playerDoc.data();

        // Check if player is on a team
        if (playerData.team_id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete player who is assigned to a team. Remove from team first.'
            });
        }

        await playerRef.delete();

        res.json({
            success: true,
            message: 'Player deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Bulk remove players from league
 */
exports.bulkRemovePlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, player_ids, player_names } = req.body;

        if (!league_id || (!player_ids && !player_names)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id and either player_ids or player_names'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all players
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();

        const results = { deleted: [], skipped: [], notFound: [] };
        let targetPlayers = [];

        if (player_ids && player_ids.length) {
            // Direct ID matching (from checkbox selection)
            playersSnapshot.forEach(doc => {
                if (player_ids.includes(doc.id)) {
                    targetPlayers.push({ id: doc.id, ...doc.data() });
                }
            });
        } else if (player_names && player_names.length) {
            // Name matching (from text input)
            const normalizedNames = player_names
                .map(n => n.toLowerCase().trim())
                .filter(n => n);

            const foundNames = [];
            playersSnapshot.forEach(doc => {
                const data = doc.data();
                const playerNameNorm = (data.name || '').toLowerCase().trim();
                if (normalizedNames.includes(playerNameNorm)) {
                    targetPlayers.push({ id: doc.id, ...data });
                    foundNames.push(playerNameNorm);
                }
            });

            // Track names not found
            normalizedNames.forEach(name => {
                if (!foundNames.includes(name)) {
                    results.notFound.push(name);
                }
            });
        }

        // Process deletions using batch
        const batch = db.batch();
        let batchCount = 0;

        for (const player of targetPlayers) {
            if (player.team_id) {
                results.skipped.push({
                    name: player.name,
                    reason: 'Assigned to team'
                });
                continue;
            }

            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc(player.id);
            batch.delete(playerRef);
            batchCount++;
            results.deleted.push({ id: player.id, name: player.name });

            // Firestore batch limit
            if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        res.json({
            success: true,
            deleted_count: results.deleted.length,
            skipped_count: results.skipped.length,
            not_found_count: results.notFound.length,
            results: results,
            message: `Deleted ${results.deleted.length} players, skipped ${results.skipped.length} (on teams), ${results.notFound.length} not found`
        });

    } catch (error) {
        console.error('Error bulk removing players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * Create teams manually (after draft)
 */
exports.createTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, team_name, player_ids } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        if (!player_ids || player_ids.length !== 3) {
            return res.status(400).json({ success: false, error: 'Team must have exactly 3 players' });
        }

        // Get player data
        const playerData = [];
        for (const playerId of player_ids) {
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId).get();
            if (!playerDoc.exists) {
                return res.status(400).json({ success: false, error: `Player ${playerId} not found` });
            }
            playerData.push({ id: playerId, ...playerDoc.data() });
        }

        // Create team
        const team = {
            team_name: team_name,
            players: player_ids.map((id, index) => ({
                id: id,
                name: playerData[index].name,
                position: index + 1, // P1, P2, P3
                isBot: playerData[index].isBot || false,
                botDifficulty: playerData[index].botDifficulty || null
            })),
            captain_id: player_ids[0], // P1 is captain

            // Standings (RULE 3 hierarchy: wins > sets > legs)
            wins: 0,
            losses: 0,
            ties: 0,
            games_won: 0,    // Sets won
            games_lost: 0,   // Sets lost
            legs_won: 0,     // Individual legs won (for tiebreakers)
            legs_lost: 0,    // Individual legs lost (for tiebreakers)
            points: 0,

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const teamRef = await db.collection('leagues').doc(league_id)
            .collection('teams').add(team);

        // Update players with team assignment
        // Position 1 = level A, Position 2 = level B, Position 3 = level C
        const positionToLevel = { 1: 'A', 2: 'B', 3: 'C' };
        const batch = db.batch();
        player_ids.forEach((playerId, index) => {
            const position = index + 1;
            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId);
            batch.update(playerRef, {
                team_id: teamRef.id,
                position: position,
                level: positionToLevel[position],  // Set level based on position
                is_captain: index === 0
            });
        });
        await batch.commit();

        res.json({
            success: true,
            team_id: teamRef.id,
            message: 'Team created successfully'
        });

    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create team with roster (assigns players to positions A/B/C)
 */
exports.createTeamWithPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin, team_name, player_a_id, player_b_id, player_c_id } = req.body;

        if (!league_id || !team_name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, team_name'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Create the team (RULE 3 hierarchy: wins > sets > legs)
        const teamRef = await db.collection('leagues').doc(league_id)
            .collection('teams').add({
                team_name: team_name.trim(),
                wins: 0,
                losses: 0,
                ties: 0,
                games_won: 0,    // Sets won
                games_lost: 0,   // Sets lost
                legs_won: 0,     // Individual legs won (for tiebreakers)
                legs_lost: 0,    // Individual legs lost (for tiebreakers)
                points_for: 0,
                points_against: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

        const teamId = teamRef.id;
        const batch = db.batch();
        const assignedPlayers = [];

        // Assign players to positions
        // Position 1 = level A, Position 2 = level B, Position 3 = level C
        const positionToLevel = { 1: 'A', 2: 'B', 3: 'C' };
        const playerAssignments = [
            { id: player_a_id, position: 1 },
            { id: player_b_id, position: 2 },
            { id: player_c_id, position: 3 }
        ];

        for (const assignment of playerAssignments) {
            if (assignment.id) {
                const playerRef = db.collection('leagues').doc(league_id)
                    .collection('players').doc(assignment.id);

                batch.update(playerRef, {
                    team_id: teamId,
                    position: assignment.position,
                    level: positionToLevel[assignment.position],  // Set level based on position
                    is_captain: assignment.position === 1
                });

                assignedPlayers.push(assignment.id);
            }
        }

        if (assignedPlayers.length > 0) {
            await batch.commit();
        }

        res.json({
            success: true,
            team_id: teamId,
            team_name: team_name,
            assigned_count: assignedPlayers.length,
            message: `Team created with ${assignedPlayers.length} player(s)`
        });

    } catch (error) {
        console.error('Error creating team with players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all teams with rosters
 */
exports.getTeams = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        // Get teams
        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams')
            .orderBy('team_name', 'asc')
            .get();

        // Get all players
        const playersSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .get();

        // Group players by team_id
        const playersByTeam = {};
        playersSnapshot.forEach(doc => {
            const player = { id: doc.id, ...doc.data() };
            if (player.team_id) {
                if (!playersByTeam[player.team_id]) {
                    playersByTeam[player.team_id] = [];
                }
                playersByTeam[player.team_id].push(player);
            }
        });

        // Build teams with players
        const teams = [];
        teamsSnapshot.forEach(doc => {
            const team = { id: doc.id, ...doc.data() };
            team.players = playersByTeam[doc.id] || [];
            // Sort players by position
            team.players.sort((a, b) => (a.position || 99) - (b.position || 99));
            teams.push(team);
        });

        res.json({ success: true, teams: teams });

    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get standings (sorted teams)
 */
exports.getStandings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams').get();

        const teams = [];
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            const totalMatches = (team.wins || 0) + (team.losses || 0) + (team.ties || 0);
            const winPct = totalMatches > 0 ? ((team.wins || 0) / totalMatches * 100).toFixed(1) : '0.0';
            const totalGames = (team.games_won || 0) + (team.games_lost || 0);
            const gamePct = totalGames > 0 ? ((team.games_won || 0) / totalGames * 100).toFixed(1) : '0.0';
            // RULE 3: Also track leg totals and percentages
            const totalLegs = (team.legs_won || 0) + (team.legs_lost || 0);
            const legPct = totalLegs > 0 ? ((team.legs_won || 0) / totalLegs * 100).toFixed(1) : '0.0';

            teams.push({
                id: doc.id,
                ...team,
                // Ensure these fields exist even if not in database yet
                legs_won: team.legs_won || 0,
                legs_lost: team.legs_lost || 0,
                total_matches: totalMatches,
                win_pct: parseFloat(winPct),
                total_games: totalGames,
                game_pct: parseFloat(gamePct),
                total_legs: totalLegs,
                leg_pct: parseFloat(legPct)
            });
        });

        // Sort by RULE 3 hierarchy: Match wins > Set wins > Leg wins > Head-to-head
        teams.sort((a, b) => {
            // 1. Match wins (nights won)
            if (b.wins !== a.wins) return b.wins - a.wins;
            // 2. Set wins (games_won = sets won within matches)
            if ((b.games_won || 0) !== (a.games_won || 0)) return (b.games_won || 0) - (a.games_won || 0);
            // 3. Leg wins (individual legs within sets)
            if ((b.legs_won || 0) !== (a.legs_won || 0)) return (b.legs_won || 0) - (a.legs_won || 0);
            // 4. Head-to-head (not implemented yet - would need match history lookup)
            return 0;
        });

        // Add rank
        teams.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.json({ success: true, standings: teams });

    } catch (error) {
        console.error('Error getting standings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// SCHEDULE & MATCH MANAGEMENT
// ============================================================================

/**
 * Generate round-robin schedule
 */
exports.generateSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get teams
        const teamsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('teams').get();

        if (teamsSnapshot.empty) {
            return res.status(400).json({ success: false, error: 'No teams found' });
        }

        const teams = [];
        teamsSnapshot.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams' });
        }

        // Generate round-robin (each team plays each other twice - home and away)
        const matches = [];
        const numTeams = teams.length;
        const teamsCopy = [...teams];

        // Add bye if odd number of teams
        if (numTeams % 2 !== 0) {
            teamsCopy.push({ id: 'BYE', team_name: 'BYE' });
        }

        const n = teamsCopy.length;
        const rounds = (n - 1) * 2; // Double round-robin
        const startDate = new Date(league.start_date);

        let week = 1;

        // First half - each team plays each other once
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[home];
                const awayTeam = teamsCopy[away];

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled', // scheduled, in_progress, completed
                        match_pin: null, // Generated when match starts
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Second half - reverse home/away
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[away]; // Swapped
                const awayTeam = teamsCopy[home]; // Swapped

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled',
                        match_pin: null,
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Save matches
        const batch = db.batch();
        matches.forEach(match => {
            const matchRef = db.collection('leagues').doc(league_id)
                .collection('matches').doc();
            batch.set(matchRef, match);
        });

        // Update league with total weeks
        batch.update(db.collection('leagues').doc(league_id), {
            total_weeks: week - 1,
            status: 'active',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({
            success: true,
            matches_created: matches.length,
            total_weeks: week - 1,
            message: 'Schedule generated successfully'
        });

    } catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Import custom schedule (replaces existing matches)
 */
exports.importSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, matches, start_date, play_day } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get teams for name lookup
        const teamsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('teams').get();

        const teamsById = {};
        teamsSnapshot.forEach(doc => {
            teamsById[doc.id] = doc.data();
        });

        // Delete existing matches
        const existingMatches = await db.collection('leagues').doc(league_id)
            .collection('matches').get();

        let deletedCount = 0;
        if (!existingMatches.empty) {
            const deleteBatch = db.batch();
            existingMatches.forEach(doc => {
                deleteBatch.delete(doc.ref);
                deletedCount++;
            });
            await deleteBatch.commit();
        }

        // Calculate dates for each week
        const scheduleStartDate = new Date(start_date);

        // Create new matches
        const createBatch = db.batch();
        let createdCount = 0;
        let totalWeeks = 0;

        for (const match of matches) {
            // Calculate match date based on week
            const matchDate = new Date(scheduleStartDate);
            matchDate.setDate(scheduleStartDate.getDate() + (match.week - 1) * 7);

            const homeTeam = teamsById[match.home_team_id];
            const awayTeam = teamsById[match.away_team_id];

            const matchRef = db.collection('leagues').doc(league_id)
                .collection('matches').doc();

            createBatch.set(matchRef, {
                week: match.week,
                match_date: matchDate.toISOString().split('T')[0],
                home_team_id: match.home_team_id,
                home_team_name: homeTeam ? homeTeam.team_name : match.home_team_name,
                away_team_id: match.away_team_id,
                away_team_name: awayTeam ? awayTeam.team_name : match.away_team_name,
                home_score: 0,
                away_score: 0,
                status: 'scheduled',
                match_pin: null,
                games: [],
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            createdCount++;
            if (match.week > totalWeeks) {
                totalWeeks = match.week;
            }
        }

        // Update league with total weeks
        createBatch.update(db.collection('leagues').doc(league_id), {
            total_weeks: totalWeeks,
            start_date: start_date,
            status: 'active',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await createBatch.commit();

        res.json({
            success: true,
            deleted_matches: deletedCount,
            matches_created: createdCount,
            total_weeks: totalWeeks,
            message: 'Custom schedule imported successfully'
        });

    } catch (error) {
        console.error('Error importing schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get schedule (all matches or by week)
 */
exports.getSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const week = req.query.week || req.body.week;

        let query = db.collection('leagues').doc(leagueId)
            .collection('matches')
            .orderBy('week', 'asc');

        if (week) {
            query = query.where('week', '==', parseInt(week));
        }

        const matchesSnapshot = await query.get();

        const matches = [];
        matchesSnapshot.forEach(doc => {
            matches.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, matches: matches });

    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start a match (generates PIN for tablet access)
 */
exports.startMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Generate match PIN
        const matchPin = generateMatchPin();

        let games;

        // Check if games are already pre-populated (singles leagues, custom formats)
        if (match.games && match.games.length > 0) {
            // Use existing games, just ensure they have required fields
            games = match.games.map((game, index) => ({
                ...game,
                game_number: game.game_number || index + 1,
                status: game.status || 'pending',
                winner: game.winner || null,
                legs: game.legs || [],
                home_legs_won: game.home_legs_won || 0,
                away_legs_won: game.away_legs_won || 0
            }));
        } else {
            // Team-based league: Get team rosters and build games from MATCH_FORMAT
            const homeTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.away_team_id).get();

            if (!homeTeamDoc.exists || !awayTeamDoc.exists) {
                return res.status(404).json({ success: false, error: 'Teams not found for this match' });
            }

            const homeTeam = homeTeamDoc.data();
            const awayTeam = awayTeamDoc.data();

            // Pre-populate the 9 games based on format
            games = MATCH_FORMAT.map(format => {
                const homePlayers = format.homePositions.map(pos =>
                    homeTeam.players.find(p => p.position === pos)
                );
                const awayPlayers = format.awayPositions.map(pos =>
                    awayTeam.players.find(p => p.position === pos)
                );

                return {
                    game_number: format.game,
                    type: format.type,
                    format: format.format,
                    checkout: format.checkout,
                    home_players: homePlayers,
                    away_players: awayPlayers,
                    status: 'pending',
                    winner: null,
                    legs: [],
                    home_legs_won: 0,
                    away_legs_won: 0
                };
            });
        }

        await matchRef.update({
            match_pin: matchPin,
            status: 'in_progress',
            games: games,
            started_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            match_pin: matchPin,
            games: games,
            message: 'Match started. Share the PIN with captains.'
        });

    } catch (error) {
        console.error('Error starting match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get match by PIN (for tablet access)
 */
exports.getMatchByPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.query.pin ? req.query : req.body;

        if (!pin) {
            return res.status(400).json({ success: false, error: 'Missing PIN' });
        }

        // Search all leagues for match with this PIN
        const leaguesSnapshot = await db.collection('leagues')
            .where('status', '==', 'active').get();

        let foundMatch = null;
        let foundLeagueId = null;
        let foundLeague = null;

        for (const leagueDoc of leaguesSnapshot.docs) {
            // Search for matches that are scheduled OR in_progress
            const matchesSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('matches')
                .where('match_pin', '==', pin.toUpperCase())
                .get();

            for (const matchDoc of matchesSnapshot.docs) {
                const matchData = matchDoc.data();
                // Accept scheduled or in_progress matches
                if (matchData.status === 'scheduled' || matchData.status === 'in_progress') {
                    foundMatch = { id: matchDoc.id, ...matchData };
                    foundLeagueId = leagueDoc.id;
                    foundLeague = { id: leagueDoc.id, ...leagueDoc.data() };
                    break;
                }
            }

            if (foundMatch) break;
        }

        if (!foundMatch) {
            return res.status(404).json({ success: false, error: 'Match not found or already completed' });
        }

        let homePlayers = [];
        let awayPlayers = [];
        let homeTeam = null;
        let awayTeam = null;

        // Check if this is a singles league (players embedded in games) or team league
        if (foundMatch.games && foundMatch.games.length > 0 && foundMatch.games[0].home_players) {
            // Singles/custom league - extract players from first game
            const firstGame = foundMatch.games[0];
            homePlayers = firstGame.home_players || [];
            awayPlayers = firstGame.away_players || [];
        } else {
            // Team-based league - get full team data
            const homeTeamDoc = await db.collection('leagues').doc(foundLeagueId)
                .collection('teams').doc(foundMatch.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(foundLeagueId)
                .collection('teams').doc(foundMatch.away_team_id).get();

            homeTeam = homeTeamDoc.exists ? { id: homeTeamDoc.id, ...homeTeamDoc.data() } : null;
            awayTeam = awayTeamDoc.exists ? { id: awayTeamDoc.id, ...awayTeamDoc.data() } : null;

            // Extract player arrays from teams (position A=1, B=2, C=3)
            homePlayers = (homeTeam?.players || []).map(p => ({
                id: p.player_id || p.id,
                name: p.name || p.player_name,
                position: p.position,
                isBot: p.isBot || false,
                botDifficulty: p.botDifficulty || null
            })).sort((a, b) => a.position - b.position);

            awayPlayers = (awayTeam?.players || []).map(p => ({
                id: p.player_id || p.id,
                name: p.name || p.player_name,
                position: p.position,
                isBot: p.isBot || false,
                botDifficulty: p.botDifficulty || null
            })).sort((a, b) => a.position - b.position);
        }

        // Use games from match if available, otherwise use default MATCH_FORMAT
        const matchFormat = foundMatch.games && foundMatch.games.length > 0
            ? foundMatch.games
            : MATCH_FORMAT;

        // Build comprehensive match response
        res.json({
            success: true,
            match: {
                match_id: foundMatch.id,
                league_id: foundLeagueId,
                league_name: foundLeague?.league_name || 'League Match',
                week: foundMatch.week,
                status: foundMatch.status,
                home_team_id: foundMatch.home_team_id,
                away_team_id: foundMatch.away_team_id,
                home_team_name: foundMatch.home_team_name || homeTeam?.team_name || 'Home Team',
                away_team_name: foundMatch.away_team_name || awayTeam?.team_name || 'Away Team',
                home_players: homePlayers,
                away_players: awayPlayers,
                match_pin: foundMatch.match_pin,
                admin_pin: foundMatch.admin_pin,
                match_date: foundMatch.match_date,
                venue: foundLeague?.venue_name,
                games: foundMatch.games || []
            },
            match_format: matchFormat
        });

    } catch (error) {
        console.error('Error getting match by PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GAME SCORING
// ============================================================================

/**
 * Start a game within a match
 */
exports.startGame = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;

        if (games[gameIndex].status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Game already started or completed' });
        }

        games[gameIndex].status = 'in_progress';
        games[gameIndex].started_at = new Date().toISOString();

        await matchRef.update({ games: games });

        res.json({
            success: true,
            game: games[gameIndex],
            message: `Game ${game_number} started`
        });

    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Record a leg result (called after each leg completes in scorer)
 */
exports.recordLeg = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number, leg_data } = req.body;

        /*
        leg_data structure for 501:
        {
            leg_number: 1,
            winner: 'home', // or 'away'
            home_stats: {
                darts_thrown: 45,
                points_scored: 501,
                three_dart_avg: 33.4,
                highest_score: 140,
                tons: 2,          // 100+
                ton_forties: 1,   // 140+
                ton_eighties: 0,  // 180
                one_seventyone: 0,
                checkout: 36,
                checkout_attempts: 3
            },
            away_stats: { ... same structure ... }
        }

        leg_data structure for Cricket:
        {
            leg_number: 1,
            winner: 'home',
            home_stats: {
                rounds: 12,
                marks: 52,
                mpr: 4.33,
                nine_mark_rounds: 2,
                eight_mark_rounds: 1,
                points_scored: 125
            },
            away_stats: { ... }
        }
        */

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;
        const game = games[gameIndex];

        // Add leg to game
        game.legs.push(leg_data);

        // Update leg counts
        if (leg_data.winner === 'home') {
            game.home_legs_won++;
        } else {
            game.away_legs_won++;
        }

        // Check if game is complete (best of 3 = first to 2)
        if (game.home_legs_won >= 2 || game.away_legs_won >= 2) {
            game.status = 'completed';
            game.winner = game.home_legs_won >= 2 ? 'home' : 'away';
            game.completed_at = new Date().toISOString();

            // Update match score
            if (game.winner === 'home') {
                match.home_score++;
            } else {
                match.away_score++;
            }
        }

        games[gameIndex] = game;

        await matchRef.update({
            games: games,
            home_score: match.home_score,
            away_score: match.away_score
        });

        // Update player stats
        await updatePlayerStats(league_id, game, leg_data);

        res.json({
            success: true,
            game: game,
            match_score: { home: match.home_score, away: match.away_score },
            game_complete: game.status === 'completed'
        });

    } catch (error) {
        console.error('Error recording leg:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Helper to update player statistics
 */
async function updatePlayerStats(leagueId, game, legData) {
    try {
        const updateStats = async (players, stats, isWinner) => {
            for (const player of players) {
                if (!player || !player.id) continue;

                const statsRef = db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(player.id);

                const statsDoc = await statsRef.get();
                let playerStats = statsDoc.exists ? statsDoc.data() : {
                    player_id: player.id,
                    player_name: player.name,
                    // 501 stats - DartConnect compatible
                    x01_legs_played: 0,
                    x01_legs_won: 0,
                    x01_total_darts: 0,
                    x01_total_points: 0,
                    // First 9 darts stats
                    x01_first9_darts: 0,
                    x01_first9_points: 0,
                    // Ton breakdown (DartConnect: T00, T20, T40, T60, T80)
                    x01_tons: 0,           // 100+ total
                    x01_ton_00: 0,         // 100-119
                    x01_ton_20: 0,         // 120-139
                    x01_ton_40: 0,         // 140-159 (ton_forties)
                    x01_ton_60: 0,         // 160-179
                    x01_ton_80: 0,         // 180s
                    x01_ton_forties: 0,    // Legacy: 140+
                    x01_ton_eighties: 0,   // Legacy: 180s
                    x01_one_seventy_ones: 0, // 171s
                    // Checkout stats
                    x01_high_checkout: 0,
                    x01_ton_plus_checkouts: 0,
                    x01_checkout_attempts: 0,    // Checkout turns
                    x01_checkout_darts: 0,       // Total darts at doubles
                    x01_checkouts_hit: 0,
                    x01_total_checkout_points: 0, // Sum of all checkouts for AFin
                    // Tiered checkout stats (for bot creation)
                    x01_checkout_attempts_low: 0,   // 2-80 attempts
                    x01_checkout_successes_low: 0,  // 2-80 successes
                    x01_checkout_attempts_81: 0,    // 81-100 attempts
                    x01_checkout_successes_81: 0,   // 81-100 successes
                    x01_checkout_attempts_101: 0,   // 101-140 attempts
                    x01_checkout_successes_101: 0,  // 101-140 successes
                    x01_checkout_attempts_141: 0,   // 141-170 attempts
                    x01_checkout_successes_141: 0,  // 141-170 successes
                    // Best leg
                    x01_best_leg: 999,
                    // High scores
                    x01_high_score: 0,
                    // Cricket stats - DartConnect compatible
                    cricket_legs_played: 0,
                    cricket_legs_won: 0,
                    cricket_total_rounds: 0,
                    cricket_total_marks: 0,
                    cricket_total_darts: 0,
                    cricket_missed_darts: 0,     // For Miss%
                    cricket_triple_bull_darts: 0, // For T&B%
                    // High mark rounds
                    cricket_five_mark_rounds: 0,  // 5M+
                    cricket_seven_mark_rounds: 0, // 7M+
                    cricket_nine_mark_rounds: 0,  // 9M
                    cricket_eight_mark_rounds: 0,
                    // Bull counts
                    cricket_three_bulls: 0,
                    cricket_four_bulls: 0,
                    cricket_five_bulls: 0,
                    cricket_six_bulls: 0,
                    cricket_hat_tricks: 0,
                    // Overall
                    games_played: 0,
                    games_won: 0
                };

                // Check if format is any X01 variant (301, 501, 701, or numeric x01)
                const isX01 = game.format === '501' || game.format === '301' || game.format === '701' ||
                              game.format === 'x01' || /^\d+$/.test(game.format);

                if (isX01) {
                    playerStats.x01_legs_played++;
                    if (isWinner) playerStats.x01_legs_won++;
                    playerStats.x01_total_darts += stats.darts_thrown || 0;
                    playerStats.x01_total_points += stats.points_scored || 0;

                    // First 9 stats
                    playerStats.x01_first9_darts += stats.first9_darts || 0;
                    playerStats.x01_first9_points += stats.first9_points || 0;

                    // Ton breakdown
                    playerStats.x01_tons += stats.tons || 0;
                    playerStats.x01_ton_00 += stats.ton_00 || 0;
                    playerStats.x01_ton_20 += stats.ton_20 || 0;
                    playerStats.x01_ton_40 += stats.ton_40 || 0;
                    playerStats.x01_ton_60 += stats.ton_60 || 0;
                    playerStats.x01_ton_80 += stats.ton_80 || 0;
                    // Legacy fields
                    playerStats.x01_ton_forties += stats.ton_forties || stats.ton_40 || 0;
                    playerStats.x01_ton_eighties += stats.ton_eighties || stats.ton_80 || 0;
                    playerStats.x01_one_seventy_ones += stats.one_seventyone || stats.ton_71 || 0;

                    // Checkout stats
                    playerStats.x01_checkout_attempts += stats.checkout_attempts || 0;
                    playerStats.x01_checkout_darts += stats.checkout_darts || 0;

                    // Tiered checkout attempts (if provided in leg data)
                    if (stats.checkout_attempts_low) playerStats.x01_checkout_attempts_low += stats.checkout_attempts_low;
                    if (stats.checkout_attempts_81) playerStats.x01_checkout_attempts_81 += stats.checkout_attempts_81;
                    if (stats.checkout_attempts_101) playerStats.x01_checkout_attempts_101 += stats.checkout_attempts_101;
                    if (stats.checkout_attempts_141) playerStats.x01_checkout_attempts_141 += stats.checkout_attempts_141;

                    // High score tracking
                    if ((stats.high_score || 0) > playerStats.x01_high_score) {
                        playerStats.x01_high_score = stats.high_score;
                    }

                    if (isWinner && stats.checkout) {
                        playerStats.x01_checkouts_hit++;
                        playerStats.x01_total_checkout_points += stats.checkout;
                        if (stats.checkout >= 100) {
                            playerStats.x01_ton_plus_checkouts++;
                        }
                        if (stats.checkout > playerStats.x01_high_checkout) {
                            playerStats.x01_high_checkout = stats.checkout;
                        }

                        // Tiered checkout successes - categorize by checkout score
                        const co = stats.checkout;
                        if (co >= 141) {
                            playerStats.x01_checkout_successes_141++;
                            // If no detailed attempt data, count success as an attempt too
                            if (!stats.checkout_attempts_141) playerStats.x01_checkout_attempts_141++;
                        } else if (co >= 101) {
                            playerStats.x01_checkout_successes_101++;
                            if (!stats.checkout_attempts_101) playerStats.x01_checkout_attempts_101++;
                        } else if (co >= 81) {
                            playerStats.x01_checkout_successes_81++;
                            if (!stats.checkout_attempts_81) playerStats.x01_checkout_attempts_81++;
                        } else {
                            playerStats.x01_checkout_successes_low++;
                            if (!stats.checkout_attempts_low) playerStats.x01_checkout_attempts_low++;
                        }

                        // Best leg tracking
                        const legDarts = stats.darts_thrown || 0;
                        if (legDarts > 0 && legDarts < playerStats.x01_best_leg) {
                            playerStats.x01_best_leg = legDarts;
                        }
                    }
                } else if (game.format === 'cricket') {
                    playerStats.cricket_legs_played++;
                    if (isWinner) playerStats.cricket_legs_won++;
                    playerStats.cricket_total_rounds += stats.rounds || 0;
                    playerStats.cricket_total_marks += stats.marks || 0;
                    playerStats.cricket_total_darts += stats.darts_thrown || 0;
                    playerStats.cricket_missed_darts += stats.missed_darts || 0;
                    playerStats.cricket_triple_bull_darts += stats.triple_bull_darts || 0;
                    // High mark rounds
                    playerStats.cricket_five_mark_rounds += stats.five_mark_rounds || 0;
                    playerStats.cricket_seven_mark_rounds += stats.seven_mark_rounds || 0;
                    playerStats.cricket_nine_mark_rounds += stats.nine_mark_rounds || 0;
                    playerStats.cricket_eight_mark_rounds += stats.eight_mark_rounds || 0;
                    // Bull counts
                    playerStats.cricket_three_bulls += stats.three_bulls || 0;
                    playerStats.cricket_four_bulls += stats.four_bulls || 0;
                    playerStats.cricket_five_bulls += stats.five_bulls || 0;
                    playerStats.cricket_six_bulls += stats.six_bulls || 0;
                    playerStats.cricket_hat_tricks += stats.hat_tricks || 0;
                }

                await statsRef.set(playerStats, { merge: true });
            }
        };

        const homeWon = legData.winner === 'home';
        await updateStats(game.home_players, legData.home_stats, homeWon);
        await updateStats(game.away_players, legData.away_stats, !homeWon);

    } catch (error) {
        console.error('Error updating player stats:', error);
        // Don't throw - stats update failure shouldn't break game recording
    }
}

/**
 * Helper to process all legs from a completed game and update stats
 */
async function processGameStats(leagueId, game, gameStats) {
    try {
        if (!gameStats || !gameStats.legs) return;

        // Process each leg
        for (const leg of gameStats.legs) {
            await updatePlayerStats(leagueId, game, leg);
        }

        // Update games played/won for all players
        const updateGamesCount = async (players, isGameWinner) => {
            for (const player of players) {
                if (!player || !player.id) continue;

                const statsRef = db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(player.id);

                await statsRef.set({
                    games_played: admin.firestore.FieldValue.increment(1),
                    games_won: admin.firestore.FieldValue.increment(isGameWinner ? 1 : 0)
                }, { merge: true });
            }
        };

        const homeWonGame = gameStats.winner === 'home';
        await updateGamesCount(game.home_players, homeWonGame);
        await updateGamesCount(game.away_players, !homeWonGame);

    } catch (error) {
        console.error('Error processing game stats:', error);
    }
}

/**
 * Finalize a match (called when all 9 games complete)
 */
exports.finalizeMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        // Verify all games are complete
        const incompleteGames = match.games.filter(g => g.status !== 'completed');
        if (incompleteGames.length > 0) {
            return res.status(400).json({
                success: false,
                error: `${incompleteGames.length} games not yet completed`
            });
        }

        // Determine match winner
        let matchWinner = null;
        if (match.home_score > match.away_score) {
            matchWinner = 'home';
        } else if (match.away_score > match.home_score) {
            matchWinner = 'away';
        } else {
            matchWinner = 'tie';
        }

        // Update match
        await matchRef.update({
            status: 'completed',
            winner: matchWinner,
            match_pin: null, // Clear PIN
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team standings
        const batch = db.batch();

        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);

        if (matchWinner === 'home') {
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        } else if (matchWinner === 'away') {
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
        } else {
            // Tie
            batch.update(homeTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        }

        await batch.commit();

        // Update player stats from the completed match
        let statsResult = { playersUpdated: 0 };
        try {
            statsResult = await updatePlayerStatsFromMatch(league_id, match);
            console.log(`Updated stats for ${statsResult.playersUpdated} players`);
        } catch (statsError) {
            // Log but don't fail the match finalization
            console.error('Error updating player stats:', statsError);
        }

        res.json({
            success: true,
            winner: matchWinner,
            final_score: { home: match.home_score, away: match.away_score },
            players_updated: statsResult.playersUpdated,
            message: 'Match finalized and standings updated'
        });

    } catch (error) {
        console.error('Error finalizing match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER STATS
// ============================================================================

/**
 * Get player stats
 */
exports.getPlayerStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const playerId = req.query.player_id || req.body.player_id;

        if (playerId) {
            // Get single player
            const statsDoc = await db.collection('leagues').doc(leagueId)
                .collection('stats').doc(playerId).get();

            if (!statsDoc.exists) {
                return res.json({ success: true, stats: null });
            }

            const stats = statsDoc.data();

            // Calculate averages - 3DA = (points/darts)*3, MPR = (marks/darts)*3
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2));
            }
            if (stats.cricket_total_darts > 0) {
                stats.cricket_mpr = parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2));
            }

            res.json({ success: true, stats: stats });

        } else {
            // Get all players' stats (leaderboard)
            const statsSnapshot = await db.collection('leagues').doc(leagueId)
                .collection('stats').get();

            const allStats = [];
            statsSnapshot.forEach(doc => {
                const stats = doc.data();

                // Calculate averages - 3DA = (points/darts)*3, MPR = (marks/darts)*3
                if (stats.x01_total_darts > 0) {
                    stats.x01_three_dart_avg = parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2));
                } else {
                    stats.x01_three_dart_avg = 0;
                }

                if (stats.cricket_total_darts > 0) {
                    stats.cricket_mpr = parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2));
                } else {
                    stats.cricket_mpr = 0;
                }

                allStats.push({ id: doc.id, ...stats });
            });

            res.json({ success: true, stats: allStats });
        }

    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get leaderboards
 */
exports.getLeaderboards = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const statsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('stats').get();

        const allStats = [];
        statsSnapshot.forEach(doc => {
            const stats = doc.data();

            // Calculate derived stats
            stats.x01_three_dart_avg = stats.x01_total_darts > 0
                ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                : 0;

            stats.cricket_mpr = stats.cricket_total_darts > 0
                ? parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2))
                : 0;

            stats.x01_checkout_pct = stats.x01_checkout_attempts > 0
                ? parseFloat((stats.x01_checkouts_hit / stats.x01_checkout_attempts * 100).toFixed(1))
                : 0;

            allStats.push({ id: doc.id, ...stats });
        });

        // Create various leaderboards
        const leaderboards = {
            x01_average: [...allStats]
                .filter(s => s.x01_legs_played >= 3)
                .sort((a, b) => b.x01_three_dart_avg - a.x01_three_dart_avg)
                .slice(0, 10),

            x01_180s: [...allStats]
                .sort((a, b) => b.x01_ton_eighties - a.x01_ton_eighties)
                .slice(0, 10),

            x01_171s: [...allStats]
                .sort((a, b) => b.x01_one_seventy_ones - a.x01_one_seventy_ones)
                .slice(0, 10),

            x01_high_checkout: [...allStats]
                .filter(s => s.x01_high_checkout > 0)
                .sort((a, b) => b.x01_high_checkout - a.x01_high_checkout)
                .slice(0, 10),

            x01_ton_plus_checkouts: [...allStats]
                .sort((a, b) => b.x01_ton_plus_checkouts - a.x01_ton_plus_checkouts)
                .slice(0, 10),

            cricket_mpr: [...allStats]
                .filter(s => s.cricket_legs_played >= 3)
                .sort((a, b) => b.cricket_mpr - a.cricket_mpr)
                .slice(0, 10),

            cricket_9_marks: [...allStats]
                .sort((a, b) => b.cricket_nine_mark_rounds - a.cricket_nine_mark_rounds)
                .slice(0, 10)
        };

        res.json({ success: true, leaderboards: leaderboards });

    } catch (error) {
        console.error('Error getting leaderboards:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Quick submit game result (for testing/manual entry)
 */
exports.submitGameResult = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number, winner, home_legs_won, away_legs_won, admin_pin, game_stats } = req.body;

        // Verify admin (optional - can also use match_pin)
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        if (admin_pin && !(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const games = match.games;
        const gameIndex = game_number - 1;

        if (gameIndex < 0 || gameIndex >= games.length) {
            return res.status(400).json({ success: false, error: 'Invalid game number' });
        }

        // Update game
        games[gameIndex].status = 'completed';
        games[gameIndex].winner = winner;
        games[gameIndex].home_legs_won = home_legs_won || (winner === 'home' ? 2 : 1);
        games[gameIndex].away_legs_won = away_legs_won || (winner === 'away' ? 2 : 1);
        games[gameIndex].completed_at = new Date().toISOString();

        // Store comprehensive game stats (DartConnect compatible)
        if (game_stats) {
            games[gameIndex].stats = game_stats;
        }

        // Update match score
        let homeScore = 0;
        let awayScore = 0;
        games.forEach(g => {
            if (g.status === 'completed') {
                if (g.winner === 'home') homeScore++;
                else if (g.winner === 'away') awayScore++;
            }
        });

        await matchRef.update({
            games: games,
            home_score: homeScore,
            away_score: awayScore
        });

        // Process player stats if game_stats includes leg data
        if (game_stats && game_stats.legs && game_stats.legs.length > 0) {
            const game = games[gameIndex];
            await processGameStats(league_id, game, { ...game_stats, winner });
        }

        res.json({
            success: true,
            game_number: game_number,
            winner: winner,
            match_score: { home: homeScore, away: awayScore },
            message: `Game ${game_number} result recorded`
        });

    } catch (error) {
        console.error('Error submitting game result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CAPTAIN & SUBSTITUTE MANAGEMENT
// ============================================================================

/**
 * Captain login - authenticate with email
 */
exports.captainLogin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, email } = req.body;

        if (!league_id || !email) {
            return res.status(400).json({ success: false, error: 'Missing league_id or email' });
        }

        // Find player by email
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase().trim())
            .get();

        if (playersSnapshot.empty) {
            return res.status(404).json({ success: false, error: 'Player not found with this email' });
        }

        const playerDoc = playersSnapshot.docs[0];
        const player = playerDoc.data();

        if (!player.is_captain) {
            return res.status(403).json({ success: false, error: 'You are not a team captain' });
        }

        // Get team info
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(player.team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Get upcoming matches for this team
        const matchesSnapshot = await db.collection('leagues').doc(league_id)
            .collection('matches')
            .where('status', 'in', ['scheduled', 'in_progress'])
            .get();

        const teamMatches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team.id || match.away_team_id === team.id) {
                teamMatches.push({ id: doc.id, ...match });
            }
        });

        // Sort by week
        teamMatches.sort((a, b) => a.week - b.week);

        // Generate a session token (simple for now - in production use JWT)
        const sessionToken = `CAP_${player.team_id}_${Date.now()}`;

        res.json({
            success: true,
            captain: { id: playerDoc.id, ...player },
            team: team,
            upcoming_matches: teamMatches,
            session_token: sessionToken
        });

    } catch (error) {
        console.error('Error in captain login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get captain's team info (with session token or email)
 */
exports.getCaptainTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const teamId = req.query.team_id || req.body.team_id;

        if (!leagueId || !teamId) {
            return res.status(400).json({ success: false, error: 'Missing league_id or team_id' });
        }

        // Get team
        const teamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(teamId).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Get all matches for this team
        const matchesSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('matches')
            .orderBy('week', 'asc')
            .get();

        const teamMatches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team.id || match.away_team_id === team.id) {
                teamMatches.push({
                    id: doc.id,
                    ...match,
                    is_home: match.home_team_id === team.id
                });
            }
        });

        // Get player stats for team members
        const playerStats = [];
        for (const player of team.players || []) {
            const statsDoc = await db.collection('leagues').doc(leagueId)
                .collection('stats').doc(player.id).get();
            if (statsDoc.exists) {
                const stats = statsDoc.data();
                stats.x01_three_dart_avg = stats.x01_total_darts > 0
                    ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                    : 0;
                stats.cricket_mpr = stats.cricket_total_rounds > 0
                    ? parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2))
                    : 0;
                playerStats.push({ player_id: player.id, ...stats });
            }
        }

        // Get available subs
        const subsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .where('is_sub', '==', true)
            .get();

        const availableSubs = [];
        subsSnapshot.forEach(doc => {
            availableSubs.push({ id: doc.id, ...doc.data() });
        });

        res.json({
            success: true,
            team: team,
            matches: teamMatches,
            player_stats: playerStats,
            available_subs: availableSubs
        });

    } catch (error) {
        console.error('Error getting captain team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register a substitute player
 */
exports.registerSubstitute = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, name, email, phone, skill_level } = req.body;

        if (!league_id || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name, email'
            });
        }

        // Check league exists
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        // Check for duplicate email
        const existingPlayer = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase())
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const sub = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || '',
            skill_level: skill_level || 'intermediate',
            team_id: null,
            position: null,
            is_captain: false,
            is_sub: true, // Mark as substitute
            sub_games_played: 0,
            payment_status: 'pending',
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const subRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(sub);

        res.json({
            success: true,
            player_id: subRef.id,
            message: 'Registered as substitute successfully'
        });

    } catch (error) {
        console.error('Error registering substitute:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get available substitutes for a league
 */
exports.getAvailableSubs = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const subsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .where('is_sub', '==', true)
            .get();

        const subs = [];
        subsSnapshot.forEach(doc => {
            subs.push({ id: doc.id, ...doc.data() });
        });

        // Sort by skill level
        const skillOrder = { advanced: 1, intermediate: 2, beginner: 3 };
        subs.sort((a, b) => (skillOrder[a.skill_level] || 2) - (skillOrder[b.skill_level] || 2));

        res.json({ success: true, substitutes: subs });

    } catch (error) {
        console.error('Error getting available subs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Set match lineup (captain can substitute players for specific match)
 */
exports.setMatchLineup = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, captain_email, lineup } = req.body;

        /*
        lineup format:
        [
            { position: 1, player_id: "abc123", player_name: "John Doe", is_sub: false },
            { position: 2, player_id: "def456", player_name: "Jane Smith", is_sub: true, original_player_id: "xyz789" },
            { position: 3, player_id: "ghi789", player_name: "Bob Wilson", is_sub: false }
        ]
        */

        if (!league_id || !match_id || !team_id || !lineup) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify captain
        if (captain_email) {
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('is_captain', '==', true)
                .where('team_id', '==', team_id)
                .get();

            if (captainSnapshot.empty) {
                return res.status(403).json({ success: false, error: 'Not authorized as captain for this team' });
            }
        }

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Determine if home or away
        const isHome = match.home_team_id === team_id;
        if (!isHome && match.away_team_id !== team_id) {
            return res.status(400).json({ success: false, error: 'Team is not part of this match' });
        }

        // Store lineup in match
        const lineupField = isHome ? 'home_lineup' : 'away_lineup';
        const updateData = {
            [lineupField]: lineup,
            [`${lineupField}_set_at`]: admin.firestore.FieldValue.serverTimestamp()
        };

        // If match has games, update player assignments in games
        if (match.games && match.games.length > 0) {
            const games = match.games;

            // Create player lookup from lineup
            const playerLookup = {};
            lineup.forEach(p => {
                playerLookup[p.position] = { id: p.player_id, name: p.player_name };
            });

            // Update each game's player assignments
            games.forEach(game => {
                if (isHome) {
                    game.home_players = game.home_players?.map((p, idx) => {
                        const pos = MATCH_FORMAT[games.indexOf(game)]?.homePositions?.[idx];
                        return playerLookup[pos] || p;
                    }) || game.home_players;
                } else {
                    game.away_players = game.away_players?.map((p, idx) => {
                        const pos = MATCH_FORMAT[games.indexOf(game)]?.awayPositions?.[idx];
                        return playerLookup[pos] || p;
                    }) || game.away_players;
                }
            });

            updateData.games = games;
        }

        await matchRef.update(updateData);

        // Log the substitution
        const subsUsed = lineup.filter(p => p.is_sub);
        if (subsUsed.length > 0) {
            await db.collection('leagues').doc(league_id)
                .collection('substitution_log').add({
                    match_id: match_id,
                    team_id: team_id,
                    substitutions: subsUsed,
                    set_by: captain_email || 'unknown',
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
        }

        res.json({
            success: true,
            message: 'Lineup set successfully',
            substitutes_used: subsUsed.length
        });

    } catch (error) {
        console.error('Error setting match lineup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Quick substitute - replace a player for a single match
 */
exports.quickSubstitute = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, position, sub_player_id, captain_email } = req.body;

        if (!league_id || !match_id || !team_id || !position || !sub_player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify captain (optional security)
        if (captain_email) {
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('is_captain', '==', true)
                .where('team_id', '==', team_id)
                .get();

            if (captainSnapshot.empty) {
                return res.status(403).json({ success: false, error: 'Not authorized' });
            }
        }

        // Get sub player info
        const subDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(sub_player_id).get();

        if (!subDoc.exists) {
            return res.status(404).json({ success: false, error: 'Substitute player not found' });
        }

        const sub = subDoc.data();

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        // Get team to find original player
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        const originalPlayer = team.players.find(p => p.position === position);

        // Determine if home or away
        const isHome = match.home_team_id === team_id;
        const lineupField = isHome ? 'home_lineup' : 'away_lineup';

        // Get or create lineup
        let lineup = match[lineupField] || team.players.map(p => ({
            position: p.position,
            player_id: p.id,
            player_name: p.name,
            is_sub: false
        }));

        // Update the specific position
        const lineupIndex = lineup.findIndex(p => p.position === position);
        if (lineupIndex >= 0) {
            lineup[lineupIndex] = {
                position: position,
                player_id: sub_player_id,
                player_name: sub.name,
                is_sub: true,
                original_player_id: originalPlayer?.id,
                original_player_name: originalPlayer?.name
            };
        }

        // Update games if they exist
        const updateData = {
            [lineupField]: lineup,
            [`${lineupField}_set_at`]: admin.firestore.FieldValue.serverTimestamp()
        };

        if (match.games && match.games.length > 0) {
            const games = match.games;

            games.forEach((game, gameIndex) => {
                const format = MATCH_FORMAT[gameIndex];
                const positions = isHome ? format.homePositions : format.awayPositions;
                const playersField = isHome ? 'home_players' : 'away_players';

                if (positions.includes(position)) {
                    const playerIndex = positions.indexOf(position);
                    if (game[playersField] && game[playersField][playerIndex]) {
                        game[playersField][playerIndex] = { id: sub_player_id, name: sub.name };
                    }
                }
            });

            updateData.games = games;
        }

        await matchRef.update(updateData);

        // Log substitution
        await db.collection('leagues').doc(league_id)
            .collection('substitution_log').add({
                match_id: match_id,
                team_id: team_id,
                position: position,
                original_player: originalPlayer,
                substitute: { id: sub_player_id, name: sub.name },
                set_by: captain_email || 'unknown',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

        res.json({
            success: true,
            message: `Substituted ${sub.name} for position ${position}`,
            lineup: lineup
        });

    } catch (error) {
        console.error('Error in quick substitute:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Report issue (captain can report problems during match)
 */
exports.reportIssue = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, issue_type, description, captain_email } = req.body;

        if (!league_id || !issue_type || !description) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const issue = {
            league_id: league_id,
            match_id: match_id || null,
            team_id: team_id || null,
            issue_type: issue_type, // 'scoring_dispute', 'player_conduct', 'technical', 'other'
            description: description,
            reported_by: captain_email || 'anonymous',
            status: 'pending', // pending, reviewed, resolved
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const issueRef = await db.collection('leagues').doc(league_id)
            .collection('issues').add(issue);

        res.json({
            success: true,
            issue_id: issueRef.id,
            message: 'Issue reported successfully. League director will review.'
        });

    } catch (error) {
        console.error('Error reporting issue:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// COMPLETE MATCH (from scorer hub flow)
// ============================================================================

/**
 * Complete a match from the scorer hub flow
 * Updates match score and finalizes standings
 */
exports.completeMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, home_score, away_score, games, admin_pin } = req.body;

        if (!league_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id or match_id' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Verify PIN - check match admin_pin or league director_pin
        if (admin_pin) {
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            const league = leagueDoc.exists ? leagueDoc.data() : {};
            const validPin = admin_pin === match.admin_pin ||
                            admin_pin === league.admin_pin ||
                            admin_pin === league.director_pin;
            if (!validPin) {
                return res.status(403).json({ success: false, error: 'Invalid PIN' });
            }
        }

        // Determine match winner
        let matchWinner = null;
        if (home_score > away_score) {
            matchWinner = 'home';
        } else if (away_score > home_score) {
            matchWinner = 'away';
        } else {
            matchWinner = 'tie';
        }

        // Update match with final scores
        await matchRef.update({
            status: 'completed',
            home_score: home_score,
            away_score: away_score,
            winner: matchWinner,
            games_data: games || [],
            match_pin: null, // Clear PIN
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Calculate total legs won/lost from games array (RULE 3: track legs for tiebreakers)
        let homeTotalLegsWon = 0;
        let awayTotalLegsWon = 0;
        if (games && Array.isArray(games)) {
            for (const game of games) {
                homeTotalLegsWon += game.home_legs_won || 0;
                awayTotalLegsWon += game.away_legs_won || 0;
            }
        }

        // Update team standings
        const batch = db.batch();

        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);

        if (matchWinner === 'home') {
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score),
                legs_won: admin.firestore.FieldValue.increment(homeTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(awayTotalLegsWon)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score),
                legs_won: admin.firestore.FieldValue.increment(awayTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(homeTotalLegsWon)
            });
        } else if (matchWinner === 'away') {
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score),
                legs_won: admin.firestore.FieldValue.increment(awayTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(homeTotalLegsWon)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score),
                legs_won: admin.firestore.FieldValue.increment(homeTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(awayTotalLegsWon)
            });
        } else {
            // Tie - each team gets 1 point
            batch.update(homeTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score),
                legs_won: admin.firestore.FieldValue.increment(homeTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(awayTotalLegsWon)
            });
            batch.update(awayTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score),
                legs_won: admin.firestore.FieldValue.increment(awayTotalLegsWon),
                legs_lost: admin.firestore.FieldValue.increment(homeTotalLegsWon)
            });
        }

        await batch.commit();

        // Update player stats from the completed match
        // Build match object with games for stats processing
        const matchForStats = {
            ...match,
            games: games || [],
            home_score: home_score,
            away_score: away_score
        };

        let statsResult = { playersUpdated: 0 };
        try {
            statsResult = await updatePlayerStatsFromMatch(league_id, matchForStats);
            console.log(`Updated stats for ${statsResult.playersUpdated} players`);
        } catch (statsError) {
            // Log but don't fail the match completion
            console.error('Error updating player stats:', statsError);
        }

        res.json({
            success: true,
            message: 'Match completed successfully',
            winner: matchWinner,
            final_score: {
                home: home_score,
                away: away_score
            },
            players_updated: statsResult.playersUpdated
        });

    } catch (error) {
        console.error('Error completing match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a test singles league (4 players, round robin, 501)
 * REMOVED: Test/debug function - uncomment if needed for testing
 */
// exports.createTestSinglesLeague = functions.https.onRequest(async (req, res) => { ... });

// Export match format for use in other modules
exports.MATCH_FORMAT = MATCH_FORMAT;

/**
 * Update league admin PIN (one-time utility)
 * Now supports master admin override for leagues with missing director_pin
 */
exports.updateLeagueAdminPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, new_pin, current_pin, new_admin_pin, director_pin } = req.body;

        // Support both old params (new_admin_pin, director_pin) and new params (new_pin, current_pin)
        const pinToSet = new_pin || new_admin_pin;
        const authPin = current_pin || director_pin;

        if (!league_id || !pinToSet) {
            return res.status(400).json({ success: false, error: 'league_id and new_pin required' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        // Check access - use checkLeagueAccess which includes master admin
        if (!(await checkLeagueAccess(league, authPin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Update both admin_pin and director_pin
        await db.collection('leagues').doc(league_id).update({
            admin_pin: pinToSet,
            director_pin: pinToSet,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'League PIN updated', admin_pin: pinToSet, director_pin: pinToSet });
    } catch (error) {
        console.error('Error updating league PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Setup Bot Battle Test League - One-time setup function
 * Adds 12 bot players and creates 4 teams with Week 1 schedule
 */
exports.setupBotLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const LEAGUE_ID = '9CM4w1LLp5AZvMYSkEif';

        // Bot players (from earlier creation)
        const bots = {
            A: [
                { id: 'bot_bullseye_bob', name: 'Bullseye Bob', pin: '35779300', avg: 90, difficulty: 'pro' },
                { id: 'bot_maximum_mike', name: 'Maximum Mike', pin: '71796272', avg: 90, difficulty: 'pro' },
                { id: 'bot_archer_andy', name: 'Archer Andy', pin: '44870323', avg: 90, difficulty: 'pro' },
                { id: 'bot_finish_frank', name: 'Finish Frank', pin: '66849218', avg: 90, difficulty: 'pro' }
            ],
            B: [
                { id: 'bot_triple_tony', name: 'Triple Tony', pin: '93728096', avg: 65, difficulty: 'league' },
                { id: 'bot_checkout_charlie', name: 'Checkout Charlie', pin: '20174480', avg: 65, difficulty: 'league' },
                { id: 'bot_shanghai_sam', name: 'Shanghai Sam', pin: '61599935', avg: 65, difficulty: 'league' },
                { id: 'bot_cork_carl', name: 'Cork Carl', pin: '22011523', avg: 65, difficulty: 'league' }
            ],
            C: [
                { id: 'bot_double_dave', name: 'Double Dave', pin: '67320011', avg: 55, difficulty: 'medium' },
                { id: 'bot_leg_larry', name: 'Leg Larry', pin: '40001052', avg: 55, difficulty: 'medium' },
                { id: 'bot_ton_tommy', name: 'Ton Tommy', pin: '10916817', avg: 55, difficulty: 'medium' },
                { id: 'bot_marker_marvin', name: 'Marker Marvin', pin: '47068084', avg: 55, difficulty: 'medium' }
            ]
        };

        // Teams composition
        const teams = [
            { name: 'Tungsten Thunder', A: 0, B: 0, C: 0 },
            { name: 'Steel City Shooters', A: 1, B: 1, C: 1 },
            { name: 'Flight Risk', A: 2, B: 2, C: 2 },
            { name: 'The Oche Boys', A: 3, B: 3, C: 3 }
        ];

        // 1. Add all bot players to the league's players subcollection
        const playerRefs = {};
        for (const level of ['A', 'B', 'C']) {
            for (const bot of bots[level]) {
                const playerData = {
                    name: bot.name,
                    isBot: true,
                    skill_level: level,
                    reported_average: bot.avg,
                    difficulty: bot.difficulty,
                    pin: bot.pin,
                    team_id: null,
                    position: null,
                    level: level,
                    payment_status: 'paid',
                    registered_at: admin.firestore.FieldValue.serverTimestamp()
                };

                const ref = await db.collection('leagues').doc(LEAGUE_ID)
                    .collection('players').add(playerData);
                playerRefs[bot.id] = ref.id;
            }
        }

        // 2. Create teams
        const teamRefs = [];
        for (const team of teams) {
            const aPlayer = bots.A[team.A];
            const bPlayer = bots.B[team.B];
            const cPlayer = bots.C[team.C];

            const aPlayerId = playerRefs[aPlayer.id];
            const bPlayerId = playerRefs[bPlayer.id];
            const cPlayerId = playerRefs[cPlayer.id];

            const teamData = {
                team_name: team.name,
                players: [
                    { id: aPlayerId, name: aPlayer.name, position: 1, level: 'A' },
                    { id: bPlayerId, name: bPlayer.name, position: 2, level: 'B' },
                    { id: cPlayerId, name: cPlayer.name, position: 3, level: 'C' }
                ],
                captain_id: aPlayerId,
                wins: 0, losses: 0, ties: 0,
                games_won: 0, games_lost: 0,
                legs_won: 0, legs_lost: 0,  // RULE 3: track legs for tiebreakers
                points: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const teamRef = await db.collection('leagues').doc(LEAGUE_ID)
                .collection('teams').add(teamData);
            teamRefs.push({ id: teamRef.id, name: team.name });

            // Update players with team assignment (position determines level: 1=A, 2=B, 3=C)
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(aPlayerId).update({ team_id: teamRef.id, position: 1, level: 'A' });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(bPlayerId).update({ team_id: teamRef.id, position: 2, level: 'B' });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(cPlayerId).update({ team_id: teamRef.id, position: 3, level: 'C' });
        }

        // 3. Create Week 1 schedule (round robin: 0v1, 2v3)
        const match1 = {
            week: 1, match_number: 1,
            home_team_id: teamRefs[0].id, away_team_id: teamRefs[1].id,
            home_team_name: teamRefs[0].name, away_team_name: teamRefs[1].name,
            status: 'scheduled', home_score: 0, away_score: 0, games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        const match1Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match1);

        const match2 = {
            week: 1, match_number: 2,
            home_team_id: teamRefs[2].id, away_team_id: teamRefs[3].id,
            home_team_name: teamRefs[2].name, away_team_name: teamRefs[3].name,
            status: 'scheduled', home_score: 0, away_score: 0, games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        const match2Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match2);

        // 4. Update league
        await db.collection('leagues').doc(LEAGUE_ID).update({
            total_weeks: 3,
            current_week: 1,
            status: 'active'
        });

        res.json({
            success: true,
            league_id: LEAGUE_ID,
            teams: teamRefs,
            matches: [
                { id: match1Ref.id, home: teamRefs[0].name, away: teamRefs[1].name },
                { id: match2Ref.id, home: teamRefs[2].name, away: teamRefs[3].name }
            ],
            message: 'Bot Battle Test League setup complete! Access with PIN: 39632911'
        });

    } catch (error) {
        console.error('Error setting up bot league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Import complete match data with throw-by-throw details
 * Used for importing historical data from DartConnect or other sources
 */
exports.importMatchData = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const body = req.body;

        // Support both nested (match_data) and flat structure
        const league_id = body.league_id;
        const match_id = body.match_id;
        const admin_pin = body.admin_pin;
        const match_data = body.match_data || {
            final_score: body.final_score,
            games: body.games,
            home_roster: body.home_roster,
            away_roster: body.away_roster
        };

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        /*
        match_data structure:
        {
            final_score: { home: 12, away: 9 },
            games: [
                {
                    game_number: 1,
                    format: "501",
                    home_player: { name: "Matt Pagel", position: "A" },
                    away_player: { name: "Donnie Pagel", position: "A" },
                    legs: [
                        {
                            leg_number: 1,
                            winner: "home",
                            throws: [
                                { player: "home", turn: 1, darts: ["T20", "T20", "S20"], score: 140, remaining: 361 },
                                { player: "away", turn: 1, darts: ["S20", "S20", "S20"], score: 60, remaining: 441 },
                                ...
                            ]
                        }
                    ],
                    result: { home_legs: 2, away_legs: 1 },
                    winner: "home"
                },
                ...
            ]
        }
        */

        // Calculate final score from games if not provided
        let homeScore = match_data.final_score?.home || 0;
        let awayScore = match_data.final_score?.away || 0;

        if (!match_data.final_score && match_data.games) {
            homeScore = match_data.games.filter(g => g.winner === 'home').length;
            awayScore = match_data.games.filter(g => g.winner === 'away').length;
        }

        // Build games array for match document
        const games = match_data.games.map((game, idx) => {
            // Determine format - use game.format if set, otherwise derive from legs
            let gameFormat = game.format;
            if (!gameFormat && game.legs && game.legs.length > 0) {
                const legFormats = [...new Set(game.legs.map(l => l.format))];
                gameFormat = legFormats.length === 1 ? legFormats[0] : 'mixed';
            }
            gameFormat = gameFormat || 'mixed';

            return {
                game_number: game.game_number || idx + 1,
                format: gameFormat,
                type: game.type || 'singles',
                home_players: game.home_players || [game.home_player],
                away_players: game.away_players || [game.away_player],
                home_legs_won: game.result?.home_legs || 0,
                away_legs_won: game.result?.away_legs || 0,
                winner: game.winner,
                status: 'completed',
                legs: game.legs || []
            };
        });

        // Update match document
        await matchRef.update({
            home_score: homeScore,
            away_score: awayScore,
            games: games,
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp(),
            imported_from: 'dartconnect',
            imported_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team standings
        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(matchDoc.data().home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(matchDoc.data().away_team_id);

        const homeWon = homeScore > awayScore;
        const awayWon = awayScore > homeScore;
        const tie = homeScore === awayScore;

        await homeTeamRef.update({
            wins: admin.firestore.FieldValue.increment(homeWon ? 1 : 0),
            losses: admin.firestore.FieldValue.increment(awayWon ? 1 : 0),
            ties: admin.firestore.FieldValue.increment(tie ? 1 : 0),
            points_for: admin.firestore.FieldValue.increment(homeScore),
            points_against: admin.firestore.FieldValue.increment(awayScore)
        });

        await awayTeamRef.update({
            wins: admin.firestore.FieldValue.increment(awayWon ? 1 : 0),
            losses: admin.firestore.FieldValue.increment(homeWon ? 1 : 0),
            ties: admin.firestore.FieldValue.increment(tie ? 1 : 0),
            points_for: admin.firestore.FieldValue.increment(awayScore),
            points_against: admin.firestore.FieldValue.increment(homeScore)
        });

        res.json({
            success: true,
            message: 'Match data imported successfully',
            final_score: { home: homeScore, away: awayScore },
            games_imported: games.length
        });

    } catch (error) {
        console.error('Error importing match data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Recalculate all player stats from completed matches
 * DartConnect-compatible stats including First 9, Checkout Efficiency, Ton Breakdown
 */
exports.recalculateLeagueStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const league_id = req.query.league_id || req.body.league_id;
        const admin_pin = req.query.admin_pin || req.body.admin_pin;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (admin_pin && !(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Clear existing stats
        const existingStats = await db.collection('leagues').doc(league_id)
            .collection('stats').get();
        const batch = db.batch();
        existingStats.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Get all completed matches
        const matchesSnapshot = await db.collection('leagues').doc(league_id)
            .collection('matches')
            .where('status', '==', 'completed')
            .get();

        let gamesProcessed = 0;
        let legsProcessed = 0;
        const playerStatsMap = {};

        // Helper to count marks from hit string (handles x2, x3 multipliers)
        const countMarks = (hit) => {
            if (!hit || hit === '-') return 0;
            let marks = 0;
            const parts = hit.split(',').map(p => p.trim());
            for (const part of parts) {
                const multMatch = part.match(/x(\d+)/i);
                const multiplier = multMatch ? parseInt(multMatch[1]) : 1;

                if (part.includes('DB') || part.includes('Double Bull')) {
                    marks += 2 * multiplier;
                } else if (part.includes('SB') || part.includes('Single Bull') || part === 'Bull') {
                    marks += 1 * multiplier;
                } else if (part.startsWith('T') || part.startsWith('t')) {
                    marks += 3 * multiplier;
                } else if (part.startsWith('D') || part.startsWith('d')) {
                    marks += 2 * multiplier;
                } else if (part.startsWith('S') || part.startsWith('s')) {
                    marks += 1 * multiplier;
                }
            }
            return marks;
        };

        // Process each match
        for (const matchDoc of matchesSnapshot.docs) {
            const match = matchDoc.data();
            const games = match.games || [];

            for (const game of games) {
                if (!game.legs || game.legs.length === 0) continue;
                gamesProcessed++;

                const gameFormat = game.format || '501';
                const homePlayers = (game.home_players || [game.home_player]).filter(Boolean);
                const awayPlayers = (game.away_players || [game.away_player]).filter(Boolean);

                for (const leg of game.legs) {
                    legsProcessed++;
                    const throws = leg.throws || [];
                    const legFormat = leg.format || gameFormat;
                    const isX01 = ['501', '301', '701'].includes(legFormat) || /^\d+$/.test(legFormat);
                    const isCricket = legFormat.toLowerCase().includes('cricket');

                    // Track stats for each player in this leg from throws
                    const legStats = {};

                    // Process detailed throws if available
                    throws.forEach((t, roundIdx) => {
                        ['home', 'away'].forEach(side => {
                            const throwData = t[side];
                            if (!throwData) return;

                            const playerName = throwData.player ||
                                (side === 'home' ? homePlayers[0]?.name : awayPlayers[0]?.name);
                            if (!playerName) return;

                            if (!legStats[playerName]) {
                                legStats[playerName] = {
                                    side,
                                    darts: 0,
                                    points: 0,
                                    rounds: 0,
                                    marks: 0,
                                    first9_points: 0,
                                    first9_darts: 0,
                                    tons_100: 0,
                                    tons_120: 0,
                                    tons_140: 0,
                                    tons_160: 0,
                                    tons_180: 0,
                                    high_turn: 0,
                                    checkout_opps: 0,
                                    marks_per_round: []
                                };
                            }

                            const pStats = legStats[playerName];
                            pStats.darts += 3;
                            pStats.rounds++;

                            if (isX01) {
                                const score = throwData.score || 0;
                                pStats.points += score;

                                // First 9 tracking (first 3 rounds = 9 darts per player)
                                if (pStats.rounds <= 3) {
                                    pStats.first9_points += score;
                                    pStats.first9_darts += 3;
                                }

                                // High turn
                                if (score > pStats.high_turn) pStats.high_turn = score;

                                // DartConnect-style ton breakdown
                                if (score >= 100 && score < 120) pStats.tons_100++;
                                else if (score >= 120 && score < 140) pStats.tons_120++;
                                else if (score >= 140 && score < 160) pStats.tons_140++;
                                else if (score >= 160 && score < 180) pStats.tons_160++;
                                else if (score === 180) pStats.tons_180++;

                                // Checkout opportunity (remaining <= 170)
                                const remaining = throwData.remaining;
                                if (remaining !== undefined && remaining <= 170 && remaining > 0) {
                                    pStats.checkout_opps++;
                                }
                            }

                            if (isCricket) {
                                const marks = throwData.marks || countMarks(throwData.hit);
                                pStats.marks += marks;
                                pStats.marks_per_round.push(marks);
                            }
                        });
                    });

                    // If no throws but we have player_stats, use those instead
                    if (throws.length === 0 && leg.player_stats) {
                        for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                            const isHomePlayer = homePlayers.some(p => p === playerName || p?.name === playerName);
                            const side = isHomePlayer ? 'home' : 'away';

                            if (!legStats[playerName]) {
                                legStats[playerName] = {
                                    side,
                                    darts: 0,
                                    points: 0,
                                    rounds: 0,
                                    marks: 0,
                                    first9_points: 0,
                                    first9_darts: 0,
                                    tons_100: 0,
                                    tons_120: 0,
                                    tons_140: 0,
                                    tons_160: 0,
                                    tons_180: 0,
                                    high_turn: 0,
                                    checkout_opps: 0,
                                    marks_per_round: []
                                };
                            }

                            const pStats = legStats[playerName];
                            pStats.darts = stats.darts || 0;
                            pStats.points = stats.points || 0;
                            pStats.marks = stats.marks || 0;
                            pStats.rounds = Math.ceil(pStats.darts / 3);

                            // Store checkout if winner
                            if (stats.checkout) {
                                pStats.checkout = stats.checkout;
                            }
                        }
                    }

                    const legWinner = leg.winner;

                    // Update cumulative stats
                    for (const [playerName, stats] of Object.entries(legStats)) {
                        if (!playerStatsMap[playerName]) {
                            playerStatsMap[playerName] = {
                                player_name: playerName,
                                x01_legs_played: 0,
                                x01_legs_won: 0,
                                x01_total_darts: 0,
                                x01_total_points: 0,
                                x01_first9_points: 0,
                                x01_first9_darts: 0,
                                x01_tons_100: 0,
                                x01_tons_120: 0,
                                x01_tons_140: 0,
                                x01_tons_160: 0,
                                x01_tons_180: 0,
                                x01_high_turn: 0,
                                x01_high_checkout: 0,
                                x01_checkouts: 0,
                                x01_checkout_opps: 0,
                                x01_checkout_totals: 0,
                                cricket_legs_played: 0,
                                cricket_legs_won: 0,
                                cricket_total_marks: 0,
                                cricket_total_rounds: 0,
                                cricket_5m_plus: 0,
                                cricket_high_marks: 0,
                                games_played: 0,
                                games_won: 0
                            };
                        }

                        const ps = playerStatsMap[playerName];
                        const isWinner = (stats.side === legWinner);

                        if (isX01) {
                            ps.x01_legs_played++;
                            if (isWinner) ps.x01_legs_won++;
                            ps.x01_total_darts += stats.darts;
                            ps.x01_total_points += stats.points;
                            ps.x01_first9_points += stats.first9_points;
                            ps.x01_first9_darts += stats.first9_darts;
                            ps.x01_tons_100 += stats.tons_100;
                            ps.x01_tons_120 += stats.tons_120;
                            ps.x01_tons_140 += stats.tons_140;
                            ps.x01_tons_160 += stats.tons_160;
                            ps.x01_tons_180 += stats.tons_180;
                            if (stats.high_turn > ps.x01_high_turn) ps.x01_high_turn = stats.high_turn;
                            ps.x01_checkout_opps += stats.checkout_opps;

                            // Handle checkout from leg.checkout or from player_stats checkout
                            if (isWinner) {
                                const co = stats.checkout || leg.checkout?.out || leg.checkout || 0;
                                if (co > 0) {
                                    ps.x01_checkouts++;
                                    ps.x01_checkout_totals += co;
                                    if (co > ps.x01_high_checkout) ps.x01_high_checkout = co;
                                }
                            }
                        } else if (isCricket) {
                            ps.cricket_legs_played++;
                            if (isWinner) ps.cricket_legs_won++;
                            ps.cricket_total_marks += stats.marks;
                            ps.cricket_total_rounds += stats.rounds;
                            const fivePlus = stats.marks_per_round.filter(m => m >= 5).length;
                            ps.cricket_5m_plus += fivePlus;
                            const maxMarks = Math.max(0, ...stats.marks_per_round);
                            if (maxMarks > ps.cricket_high_marks) ps.cricket_high_marks = maxMarks;
                        }
                    }
                }

                // Track games played/won
                const gameWinner = game.winner;
                for (const p of [...homePlayers, ...awayPlayers]) {
                    // Handle both string names and objects with .name
                    const playerName = typeof p === 'string' ? p : p?.name;
                    if (!playerName || !playerStatsMap[playerName]) continue;
                    playerStatsMap[playerName].games_played++;
                    const isHomePlayer = homePlayers.some(hp =>
                        (typeof hp === 'string' ? hp : hp?.name) === playerName
                    );
                    if ((gameWinner === 'home' && isHomePlayer) || (gameWinner === 'away' && !isHomePlayer)) {
                        playerStatsMap[playerName].games_won++;
                    }
                }
            }
        }

        // Calculate derived stats
        for (const stats of Object.values(playerStatsMap)) {
            if (stats.x01_checkouts > 0) {
                stats.x01_avg_checkout = Math.round(stats.x01_checkout_totals / stats.x01_checkouts * 100) / 100;
            }
            if (stats.x01_checkout_opps > 0) {
                stats.x01_checkout_efficiency = Math.round(stats.x01_checkouts / stats.x01_checkout_opps * 10000) / 100;
            } else {
                stats.x01_checkout_efficiency = 0;
            }
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = Math.round(stats.x01_total_points / stats.x01_total_darts * 300) / 100;
                stats.x01_ppd = Math.round(stats.x01_total_points / stats.x01_total_darts * 100) / 100;
            }
            if (stats.x01_first9_darts > 0) {
                stats.x01_first_9_avg = Math.round(stats.x01_first9_points / stats.x01_first9_darts * 300) / 100;
            }
            stats.x01_total_tons = stats.x01_tons_100 + stats.x01_tons_120 + stats.x01_tons_140 + stats.x01_tons_160 + stats.x01_tons_180;
            // Cricket darts (rounds * 3) for compatibility with existing stats display
            stats.cricket_total_darts = stats.cricket_total_rounds * 3;
            if (stats.cricket_total_rounds > 0) {
                stats.cricket_mpr = Math.round(stats.cricket_total_marks / stats.cricket_total_rounds * 100) / 100;
            }
            if (stats.games_played > 0) {
                stats.win_percentage = Math.round(stats.games_won / stats.games_played * 10000) / 100;
            }
            if (stats.x01_legs_played > 0) {
                stats.x01_leg_win_pct = Math.round(stats.x01_legs_won / stats.x01_legs_played * 10000) / 100;
            }
            if (stats.cricket_legs_played > 0) {
                stats.cricket_leg_win_pct = Math.round(stats.cricket_legs_won / stats.cricket_legs_played * 10000) / 100;
            }
        }

        // Look up global player IDs first, fall back to league player IDs
        const globalPlayersSnapshot = await db.collection('players').get();
        const globalPlayerIdMap = {};
        globalPlayersSnapshot.docs.forEach(doc => {
            const name = (doc.data().name || doc.data().full_name || '').toLowerCase().trim();
            if (name) globalPlayerIdMap[name] = doc.id;
        });

        // Also get league player IDs as fallback
        const leaguePlayersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const leaguePlayerIdMap = {};
        leaguePlayersSnapshot.docs.forEach(doc => {
            const name = (doc.data().name || '').toLowerCase().trim();
            if (name) leaguePlayerIdMap[name] = doc.id;
        });

        // Prefer global IDs over league IDs
        const playerIdMap = {};
        for (const [name, id] of Object.entries(leaguePlayerIdMap)) {
            playerIdMap[name] = globalPlayerIdMap[name] || id;
        }
        // Also add any global players not in league
        for (const [name, id] of Object.entries(globalPlayerIdMap)) {
            if (!playerIdMap[name]) playerIdMap[name] = id;
        }

        const writeBatch = db.batch();
        let statsWritten = 0;

        for (const [playerName, stats] of Object.entries(playerStatsMap)) {
            const normalizedName = playerName.toLowerCase().trim();
            const playerId = playerIdMap[normalizedName];
            if (!playerId) {
                console.log('No player ID found for:', playerName);
                continue;
            }

            stats.player_id = playerId;
            stats.updated_at = admin.firestore.FieldValue.serverTimestamp();

            // Add leaderboard-compatible computed fields
            // Total tons (100+)
            stats.x01_tons = (stats.x01_tons_100 || 0) + (stats.x01_tons_120 || 0) +
                            (stats.x01_tons_140 || 0) + (stats.x01_tons_160 || 0) + (stats.x01_tons_180 || 0);
            // 140+ (ton forties and above)
            stats.x01_ton_forties = (stats.x01_tons_140 || 0) + (stats.x01_tons_160 || 0) + (stats.x01_tons_180 || 0);
            // 180s
            stats.x01_ton_eighties = stats.x01_tons_180 || 0;

            // Computed averages
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = (stats.x01_total_points / stats.x01_total_darts) * 3;
            }
            if (stats.x01_first9_darts > 0) {
                stats.x01_first_9_avg = (stats.x01_first9_points / stats.x01_first9_darts) * 3;
            }
            if (stats.x01_checkouts > 0) {
                stats.x01_avg_checkout = stats.x01_checkout_totals / stats.x01_checkouts;
            }
            if (stats.cricket_total_rounds > 0) {
                stats.cricket_mpr = stats.cricket_total_marks / stats.cricket_total_rounds;
            }

            const statsRef = db.collection('leagues').doc(league_id)
                .collection('stats').doc(playerId);
            writeBatch.set(statsRef, stats);
            statsWritten++;
        }

        await writeBatch.commit();

        res.json({
            success: true,
            message: 'Stats recalculated with DartConnect-compatible metrics',
            matches_processed: matchesSnapshot.size,
            games_processed: gamesProcessed,
            legs_processed: legsProcessed,
            players_updated: statsWritten
        });

    } catch (error) {
        console.error('Error recalculating stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// IMPORT AGGREGATED STATS FROM PARSED MATCH DATA
// ============================================================================

/**
 * Import pre-aggregated stats from DartConnect parser
 * Accepts JSON object with player IDs as keys and stats objects as values
 */
exports.importAggregatedStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { league_id, stats } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }
        if (!stats || typeof stats !== 'object') {
            return res.status(400).json({ success: false, error: 'stats object required' });
        }

        const batch = db.batch();
        let imported = 0;
        let skipped = 0;

        for (const [playerId, playerStats] of Object.entries(stats)) {
            // Skip temp IDs
            if (playerId.startsWith('temp_')) {
                console.log(`Skipping temp ID: ${playerId}`);
                skipped++;
                continue;
            }

            const statsRef = db.collection('leagues').doc(league_id)
                .collection('stats').doc(playerId);

            const statsWithTimestamp = {
                ...playerStats,
                player_id: playerId,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(statsRef, statsWithTimestamp, { merge: true });
            imported++;
        }

        await batch.commit();

        res.json({
            success: true,
            message: 'Stats imported successfully',
            imported,
            skipped
        });

    } catch (error) {
        console.error('Error importing stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Assign player levels based on team position
 * Looks at team documents to get player positions and assigns A/B/C levels
 */
exports.assignPlayerLevels = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        // Verify league exists and check admin access
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (admin_pin && !(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        console.log(`Assigning player levels for league ${league_id}`);

        // Get all teams to build player-level mapping
        const teamsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('teams').get();

        const playerLevelMap = {};

        for (const teamDoc of teamsSnapshot.docs) {
            const team = teamDoc.data();

            if (team.players && Array.isArray(team.players)) {
                for (const player of team.players) {
                    if (player.id && player.level) {
                        playerLevelMap[player.id] = player.level;
                    } else if (player.id && player.position) {
                        const posMap = { 1: 'A', 2: 'B', 3: 'C' };
                        const derivedLevel = posMap[player.position];
                        if (derivedLevel) {
                            playerLevelMap[player.id] = derivedLevel;
                        }
                    }
                }
            }
        }

        // Get all players and update their level field
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();

        const batch = db.batch();
        let updateCount = 0;
        let skippedCount = 0;
        let notOnTeamCount = 0;
        const updates = [];

        for (const playerDoc of playersSnapshot.docs) {
            const player = playerDoc.data();
            const playerId = playerDoc.id;

            // Check if we have a level from the team map
            let newLevel = playerLevelMap[playerId];

            // If not in team map, try to derive from player's position field
            if (!newLevel && player.position) {
                const posMap = { 1: 'A', 2: 'B', 3: 'C' };
                newLevel = posMap[player.position];
            }

            // Also check preferred_level or skill_level
            if (!newLevel && player.preferred_level && ['A', 'B', 'C'].includes(player.preferred_level)) {
                newLevel = player.preferred_level;
            }

            if (!newLevel && player.skill_level && ['A', 'B', 'C'].includes(player.skill_level)) {
                newLevel = player.skill_level;
            }

            if (newLevel) {
                const currentLevel = player.level;
                if (currentLevel === newLevel) {
                    skippedCount++;
                } else {
                    const playerRef = db.collection('leagues').doc(league_id)
                        .collection('players').doc(playerId);
                    batch.update(playerRef, { level: newLevel });
                    updates.push({ name: player.name, from: currentLevel || '', to: newLevel });
                    updateCount++;
                }
            } else {
                notOnTeamCount++;
            }
        }

        if (updateCount > 0) {
            await batch.commit();
        }

        res.json({
            success: true,
            message: `Updated ${updateCount} player levels`,
            updated: updateCount,
            skipped: skippedCount,
            notOnTeam: notOnTeamCount,
            updates
        });

    } catch (error) {
        console.error('Error assigning player levels:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// DIRECTOR TOOLS - Match Corrections, Player Levels, Rescheduling
// ============================================================================

/**
 * Correct match result - Update scores for a completed match
 * Creates audit trail in corrections_log subcollection
 * Recalculates team standings after correction
 */
exports.correctMatchResult = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, home_score, away_score, reason, director_pin } = req.body;

        // Validate required fields
        if (!league_id || !match_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, match_id'
            });
        }

        if (home_score === undefined || away_score === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: home_score, away_score'
            });
        }

        // Verify league exists and check director access
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, director_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN - Director access required' });
        }

        // Get the match
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const matchData = matchDoc.data();
        const oldHomeScore = matchData.home_score || 0;
        const oldAwayScore = matchData.away_score || 0;

        // Determine new winner
        let newWinner = 'tie';
        if (home_score > away_score) newWinner = 'home';
        else if (away_score > home_score) newWinner = 'away';

        // Update match document
        await matchRef.update({
            home_score: parseInt(home_score),
            away_score: parseInt(away_score),
            winner: newWinner,
            corrected_at: admin.firestore.FieldValue.serverTimestamp(),
            correction_reason: reason || 'Score corrected by director'
        });

        // Log the correction
        const correctionLog = {
            match_id: match_id,
            corrected_at: admin.firestore.FieldValue.serverTimestamp(),
            corrected_by_pin: director_pin ? director_pin.substring(0, 4) + '****' : 'unknown',
            old_home_score: oldHomeScore,
            old_away_score: oldAwayScore,
            new_home_score: parseInt(home_score),
            new_away_score: parseInt(away_score),
            reason: reason || 'No reason provided'
        };

        await db.collection('leagues').doc(league_id)
            .collection('corrections_log').add(correctionLog);

        // Recalculate team standings
        await recalculateTeamStandings(league_id);

        res.json({
            success: true,
            message: 'Match result corrected successfully',
            correction: {
                old_score: `${oldHomeScore} - ${oldAwayScore}`,
                new_score: `${home_score} - ${away_score}`,
                winner: newWinner
            }
        });

    } catch (error) {
        console.error('Error correcting match result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Set player level - Update a player's level (A, B, C, or Unassigned)
 * Used by directors to manually adjust player skill levels
 */
exports.setPlayerLevel = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, player_id, level, director_pin } = req.body;

        // Validate required fields
        if (!league_id || !player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, player_id'
            });
        }

        // Validate level value
        const validLevels = ['A', 'B', 'C', ''];
        if (level !== undefined && !validLevels.includes(level)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid level. Must be A, B, C, or empty for unassigned'
            });
        }

        // Verify league exists and check director access
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, director_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN - Director access required' });
        }

        // Get and update the player
        const playerRef = db.collection('leagues').doc(league_id).collection('players').doc(player_id);
        const playerDoc = await playerRef.get();
        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const playerData = playerDoc.data();
        const oldLevel = playerData.level || 'Unassigned';

        // Update the player's level
        const updateData = {
            level: level || null,
            level_updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // If setting a level, also update position based on level
        if (level === 'A') updateData.position = 1;
        else if (level === 'B') updateData.position = 2;
        else if (level === 'C') updateData.position = 3;

        await playerRef.update(updateData);

        res.json({
            success: true,
            message: `Player level updated from ${oldLevel} to ${level || 'Unassigned'}`,
            player_name: playerData.name,
            old_level: oldLevel,
            new_level: level || 'Unassigned'
        });

    } catch (error) {
        console.error('Error setting player level:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reschedule match - Change the date of a match
 * Can optionally mark the match as a makeup match
 */
exports.rescheduleMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, new_date, is_makeup, notify_captains, director_pin } = req.body;

        // Validate required fields
        if (!league_id || !match_id || !new_date) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, match_id, new_date'
            });
        }

        // Verify league exists and check director access
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, director_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN - Director access required' });
        }

        // Get the match
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const matchData = matchDoc.data();
        const oldDate = matchData.match_date;

        // Parse the new date
        const newMatchDate = new Date(new_date);
        if (isNaN(newMatchDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid date format' });
        }

        // Update the match
        const updateData = {
            match_date: admin.firestore.Timestamp.fromDate(newMatchDate),
            rescheduled_at: admin.firestore.FieldValue.serverTimestamp(),
            is_makeup: is_makeup === true
        };

        // Store original date if this is the first reschedule
        if (!matchData.original_match_date) {
            updateData.original_match_date = oldDate;
        }

        await matchRef.update(updateData);

        // Get team names for response
        const homeTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(matchData.home_team_id).get();
        const awayTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(matchData.away_team_id).get();

        const homeTeamName = homeTeamDoc.exists ? homeTeamDoc.data().team_name : 'Unknown';
        const awayTeamName = awayTeamDoc.exists ? awayTeamDoc.data().team_name : 'Unknown';

        // Optionally notify captains (placeholder - would need notification system integration)
        let notificationSent = false;
        if (notify_captains) {
            // TODO: Integrate with notification system
            // This would send SMS/push notifications to team captains
            console.log(`Would notify captains of ${homeTeamName} and ${awayTeamName} about reschedule`);
            notificationSent = true;
        }

        res.json({
            success: true,
            message: 'Match rescheduled successfully',
            match: {
                home_team: homeTeamName,
                away_team: awayTeamName,
                week: matchData.week,
                old_date: oldDate?.toDate ? oldDate.toDate().toISOString() : oldDate,
                new_date: newMatchDate.toISOString(),
                is_makeup: is_makeup === true
            },
            notification_sent: notificationSent
        });

    } catch (error) {
        console.error('Error rescheduling match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Helper function to recalculate team standings after a match correction
 */
async function recalculateTeamStandings(leagueId) {
    // Get all teams
    const teamsSnapshot = await db.collection('leagues').doc(leagueId).collection('teams').get();
    const teamStats = {};

    teamsSnapshot.forEach(doc => {
        teamStats[doc.id] = {
            wins: 0,
            losses: 0,
            ties: 0,
            games_won: 0,
            games_lost: 0,
            legs_won: 0,
            legs_lost: 0,
            points: 0
        };
    });

    // Get all completed matches
    const matchesSnapshot = await db.collection('leagues').doc(leagueId)
        .collection('matches')
        .where('status', '==', 'completed')
        .get();

    matchesSnapshot.forEach(doc => {
        const match = doc.data();
        const homeId = match.home_team_id;
        const awayId = match.away_team_id;

        if (!teamStats[homeId] || !teamStats[awayId]) return;

        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;

        // Update games (sets) won/lost
        teamStats[homeId].games_won += homeScore;
        teamStats[homeId].games_lost += awayScore;
        teamStats[awayId].games_won += awayScore;
        teamStats[awayId].games_lost += homeScore;

        // Update legs if tracked
        if (match.home_legs !== undefined && match.away_legs !== undefined) {
            teamStats[homeId].legs_won += match.home_legs || 0;
            teamStats[homeId].legs_lost += match.away_legs || 0;
            teamStats[awayId].legs_won += match.away_legs || 0;
            teamStats[awayId].legs_lost += match.home_legs || 0;
        }

        // Determine match winner
        if (match.winner === 'home' || homeScore > awayScore) {
            teamStats[homeId].wins += 1;
            teamStats[awayId].losses += 1;
        } else if (match.winner === 'away' || awayScore > homeScore) {
            teamStats[awayId].wins += 1;
            teamStats[homeId].losses += 1;
        } else {
            teamStats[homeId].ties += 1;
            teamStats[awayId].ties += 1;
        }
    });

    // Update all teams with recalculated stats
    const batch = db.batch();
    for (const [teamId, stats] of Object.entries(teamStats)) {
        // Calculate points (typically: Win=2, Tie=1, Loss=0)
        stats.points = (stats.wins * 2) + (stats.ties * 1);

        const teamRef = db.collection('leagues').doc(leagueId).collection('teams').doc(teamId);
        batch.update(teamRef, stats);
    }

    await batch.commit();
    console.log(`Recalculated standings for league ${leagueId}: ${Object.keys(teamStats).length} teams updated`);
}
