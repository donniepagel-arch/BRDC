/**
 * Tournament Stats Module
 * Handles player stats aggregation for tournaments - mirrors league stats structure
 */

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Initialize empty stats object - DartConnect parity (same schema as leagues/pickup)
 */
function getEmptyStats(playerId, playerName) {
    return {
        player_id: playerId,
        player_name: playerName,

        // ===== X01 STATS - DartConnect Parity =====
        // Core leg counts
        x01_legs_played: 0,
        x01_legs_won: 0,
        x01_total_darts: 0,
        x01_total_points: 0,

        // First 9 darts (for First9 Avg)
        x01_first9_darts: 0,
        x01_first9_points: 0,

        // First turn (for HSI - High Straight In)
        x01_first_turn_total: 0,
        x01_first_turn_count: 0,

        // Ton breakdown (T00, T20, T40, T60, T80)
        x01_tons: 0,
        x01_ton_00: 0,
        x01_ton_20: 0,
        x01_ton_40: 0,
        x01_ton_60: 0,
        x01_ton_80: 0,
        x01_ton_forties: 0,    // Legacy alias for T40
        x01_ton_eighties: 0,   // Legacy alias for T80
        x01_one_seventy_ones: 0,
        x01_ton_points_total: 0,

        // Checkout counters
        x01_checkouts_hit: 0,
        x01_checkout_attempts: 0,
        x01_checkout_darts: 0,
        x01_total_checkout_points: 0,
        x01_ton_plus_checkouts: 0,

        // Checkout % by range
        x01_co_80_attempts: 0,
        x01_co_80_hits: 0,
        x01_co_120_attempts: 0,
        x01_co_120_hits: 0,
        x01_co_140_attempts: 0,
        x01_co_140_hits: 0,
        x01_co_161_attempts: 0,
        x01_co_161_hits: 0,

        // With/Against Darts
        x01_legs_with_darts: 0,
        x01_legs_with_darts_won: 0,
        x01_legs_against_darts: 0,
        x01_legs_against_darts_won: 0,

        // Opponent tracking (for O-3DA)
        x01_opponent_points_total: 0,
        x01_opponent_darts_total: 0,

        // Maximum stats
        x01_high_checkout: 0,
        x01_high_score: 0,
        x01_high_straight_in: 0,

        // Minimum stats
        x01_best_leg: 999,

        // ===== CRICKET STATS - DartConnect Parity =====
        // Core leg counts
        cricket_legs_played: 0,
        cricket_legs_won: 0,
        cricket_total_rounds: 0,
        cricket_total_marks: 0,
        cricket_total_darts: 0,

        // Dart quality
        cricket_missed_darts: 0,
        cricket_triple_bull_darts: 0,

        // Mark round counts (5M+, 6M, 7M, 8M, 9M)
        cricket_five_mark_rounds: 0,
        cricket_six_mark_rounds: 0,
        cricket_seven_mark_rounds: 0,
        cricket_eight_mark_rounds: 0,
        cricket_nine_mark_rounds: 0,

        // Bull achievements
        cricket_three_bulls: 0,
        cricket_four_bulls: 0,
        cricket_five_bulls: 0,
        cricket_six_bulls: 0,
        cricket_hat_tricks: 0,
        cricket_white_horse: 0,
        cricket_three_in_bed: 0,

        // With/Against Darts
        cricket_legs_with_darts: 0,
        cricket_legs_with_darts_won: 0,
        cricket_legs_against_darts: 0,
        cricket_legs_against_darts_won: 0,

        // Maximum/Minimum stats
        cricket_high_mark_round: 0,
        cricket_low_rounds: 999,

        // Tournament-specific
        matches_played: 0,
        matches_won: 0,
        round_reached: 0
    };
}

/**
 * Update a single player's leg stats - DartConnect parity
 * @param {object} opponentStats - Opponent's stats for this leg (for O-3DA tracking)
 */
async function updatePlayerLegStats(tournamentId, playerId, playerName, stats, format, isWinner, opponentStats = null) {
    if (!playerId) return;

    const statsRef = db.collection('tournaments').doc(tournamentId)
        .collection('stats').doc(playerId);

    const statsDoc = await statsRef.get();
    let playerStats = statsDoc.exists ? statsDoc.data() : getEmptyStats(playerId, playerName);

    // Check if format is X01
    const isX01 = format === '501' || format === '301' || format === '701' ||
                  format === 'x01' || /^\d+$/.test(format);

    if (isX01) {
        playerStats.x01_legs_played++;
        if (isWinner) playerStats.x01_legs_won++;
        playerStats.x01_total_darts += stats.darts_thrown || stats.darts || 0;
        playerStats.x01_total_points += stats.points_scored || stats.points || 0;

        // First 9 stats
        playerStats.x01_first9_darts += stats.first9_darts || stats.first9Darts || 0;
        playerStats.x01_first9_points += stats.first9_points || stats.first9Points || 0;

        // HSI (High Straight In) - first turn tracking
        const firstTurnScore = stats.first_turn_score || stats.firstTurnScore || 0;
        if (firstTurnScore > 0) {
            playerStats.x01_first_turn_total += firstTurnScore;
            playerStats.x01_first_turn_count++;
            if (firstTurnScore > playerStats.x01_high_straight_in) {
                playerStats.x01_high_straight_in = firstTurnScore;
            }
        }

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
        // Ton points
        playerStats.x01_ton_points_total += stats.ton_points || stats.tonPoints || 0;

        // Checkout stats
        playerStats.x01_checkout_attempts += stats.checkout_attempts || 0;
        playerStats.x01_checkout_darts += stats.checkout_darts || 0;

        // Checkout range tracking
        playerStats.x01_co_80_attempts += stats.co_80_attempts || 0;
        playerStats.x01_co_80_hits += stats.co_80_hits || 0;
        playerStats.x01_co_120_attempts += stats.co_120_attempts || 0;
        playerStats.x01_co_120_hits += stats.co_120_hits || 0;
        playerStats.x01_co_140_attempts += stats.co_140_attempts || 0;
        playerStats.x01_co_140_hits += stats.co_140_hits || 0;
        playerStats.x01_co_161_attempts += stats.co_161_attempts || 0;
        playerStats.x01_co_161_hits += stats.co_161_hits || 0;

        // With/Against Darts tracking
        const threwFirst = stats.threw_first || stats.threwFirst;
        if (threwFirst === true) {
            playerStats.x01_legs_with_darts++;
            if (isWinner) playerStats.x01_legs_with_darts_won++;
        } else if (threwFirst === false) {
            playerStats.x01_legs_against_darts++;
            if (isWinner) playerStats.x01_legs_against_darts_won++;
        }

        // Opponent tracking (for O-3DA)
        if (opponentStats) {
            const oppDarts = opponentStats.darts_thrown || opponentStats.darts || 0;
            const oppPoints = opponentStats.points_scored || opponentStats.points || 0;
            playerStats.x01_opponent_darts_total += oppDarts;
            playerStats.x01_opponent_points_total += oppPoints;
        }

        // High score tracking
        const highScore = stats.high_score || stats.highScore || 0;
        if (highScore > playerStats.x01_high_score) {
            playerStats.x01_high_score = highScore;
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
            // Best leg tracking
            const legDarts = stats.darts_thrown || stats.darts || 0;
            if (legDarts > 0 && legDarts < playerStats.x01_best_leg) {
                playerStats.x01_best_leg = legDarts;
            }
        }
    } else if (format === 'cricket') {
        playerStats.cricket_legs_played++;
        if (isWinner) playerStats.cricket_legs_won++;
        playerStats.cricket_total_rounds += stats.rounds || 0;
        playerStats.cricket_total_marks += stats.marks || 0;
        playerStats.cricket_total_darts += stats.darts_thrown || stats.darts || 0;
        playerStats.cricket_missed_darts += stats.missed_darts || stats.missedDarts || 0;
        playerStats.cricket_triple_bull_darts += stats.triple_bull_darts || stats.tripleBullDarts || 0;

        // Mark round counts
        playerStats.cricket_five_mark_rounds += stats.five_mark_rounds || stats.fiveMarkRounds || 0;
        playerStats.cricket_six_mark_rounds += stats.six_mark_rounds || stats.sixMarkRounds || 0;
        playerStats.cricket_seven_mark_rounds += stats.seven_mark_rounds || stats.sevenMarkRounds || 0;
        playerStats.cricket_eight_mark_rounds += stats.eight_mark_rounds || stats.eightMarkRounds || 0;
        playerStats.cricket_nine_mark_rounds += stats.nine_mark_rounds || stats.nineMarkRounds || 0;

        // Bull counts
        playerStats.cricket_three_bulls += stats.three_bulls || stats.threeBulls || 0;
        playerStats.cricket_four_bulls += stats.four_bulls || stats.fourBulls || 0;
        playerStats.cricket_five_bulls += stats.five_bulls || stats.fiveBulls || 0;
        playerStats.cricket_six_bulls += stats.six_bulls || stats.sixBulls || 0;
        playerStats.cricket_hat_tricks += stats.hat_tricks || stats.hatTricks || 0;
        playerStats.cricket_white_horse += stats.white_horse || stats.whiteHorse || 0;
        playerStats.cricket_three_in_bed += stats.three_in_bed || stats.threeInBed || 0;

        // With/Against Darts tracking
        const threwFirst = stats.threw_first || stats.threwFirst;
        if (threwFirst === true) {
            playerStats.cricket_legs_with_darts++;
            if (isWinner) playerStats.cricket_legs_with_darts_won++;
        } else if (threwFirst === false) {
            playerStats.cricket_legs_against_darts++;
            if (isWinner) playerStats.cricket_legs_against_darts_won++;
        }

        // High mark round tracking
        const highMarkRound = stats.high_mark_round || stats.highMarkRound || 0;
        if (highMarkRound > playerStats.cricket_high_mark_round) {
            playerStats.cricket_high_mark_round = highMarkRound;
        }

        // Low rounds tracking (best/fastest close)
        if (isWinner) {
            const rounds = stats.rounds || 0;
            if (rounds > 0 && rounds < playerStats.cricket_low_rounds) {
                playerStats.cricket_low_rounds = rounds;
            }
        }
    }

    await statsRef.set(playerStats, { merge: true });
}

/**
 * Process game stats from a tournament match - DartConnect parity
 * @param {string} tournamentId - Tournament ID
 * @param {object} match - Match object with player1, player2
 * @param {object} gameStats - Stats object with legs array and match info
 * @param {string} format - Game format (501, cricket, etc.)
 */
async function processTournamentMatchStats(tournamentId, match, gameStats, format) {
    try {
        if (!gameStats) return;

        const player1 = match.player1;
        const player2 = match.player2;

        if (!player1 || !player2) return;

        // Process leg-by-leg stats if available
        if (gameStats.legs && Array.isArray(gameStats.legs)) {
            for (const leg of gameStats.legs) {
                const player1Won = leg.winner === 'player1' || leg.winner === player1.id;

                // Get both players' stats for opponent tracking
                const p1Stats = leg.player1_stats || leg.home_stats;
                const p2Stats = leg.player2_stats || leg.away_stats;

                if (p1Stats) {
                    await updatePlayerLegStats(
                        tournamentId,
                        player1.id,
                        player1.name,
                        p1Stats,
                        format,
                        player1Won,
                        p2Stats  // Pass opponent stats for O-3DA
                    );
                }

                if (p2Stats) {
                    await updatePlayerLegStats(
                        tournamentId,
                        player2.id,
                        player2.name,
                        p2Stats,
                        format,
                        !player1Won,
                        p1Stats  // Pass opponent stats for O-3DA
                    );
                }
            }
        }

        // Update match counts
        const winnerId = match.winner?.id;
        const player1WonMatch = winnerId === player1.id;

        // Update player 1 match stats
        if (player1.id) {
            const stats1Ref = db.collection('tournaments').doc(tournamentId)
                .collection('stats').doc(player1.id);
            await stats1Ref.set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(player1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
        }

        // Update player 2 match stats
        if (player2.id) {
            const stats2Ref = db.collection('tournaments').doc(tournamentId)
                .collection('stats').doc(player2.id);
            await stats2Ref.set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(!player1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
        }

        console.log(`Tournament stats updated for match ${match.id}`);

    } catch (error) {
        console.error('Error processing tournament match stats:', error);
        // Don't throw - stats failure shouldn't break match recording
    }
}

/**
 * Get leaderboard for a tournament
 */
async function getTournamentLeaderboard(tournamentId, gameType = '501') {
    try {
        const statsRef = db.collection('tournaments').doc(tournamentId).collection('stats');
        const statsSnap = await statsRef.get();

        const players = [];
        statsSnap.forEach(doc => {
            const data = doc.data();

            // Calculate derived stats
            if (gameType === 'cricket') {
                const mpr = data.cricket_total_rounds > 0
                    ? (data.cricket_total_marks / data.cricket_total_rounds).toFixed(2)
                    : '0.00';
                players.push({
                    ...data,
                    cricket_mpr: parseFloat(mpr)
                });
            } else {
                const ppd = data.x01_total_darts > 0
                    ? (data.x01_total_points / data.x01_total_darts * 3).toFixed(2)
                    : '0.00';
                players.push({
                    ...data,
                    x01_three_dart_avg: parseFloat(ppd)
                });
            }
        });

        // Sort by x01_three_dart_avg/cricket_mpr descending
        const sortField = gameType === 'cricket' ? 'cricket_mpr' : 'x01_three_dart_avg';
        players.sort((a, b) => b[sortField] - a[sortField]);

        return players;

    } catch (error) {
        console.error('Error getting tournament leaderboard:', error);
        return [];
    }
}

/**
 * Recalculate all stats for a tournament from match data
 * @param {string} tournamentId - Tournament ID
 * @returns {object} - Result with success flag and stats
 */
async function recalculateTournamentStats(tournamentId) {
    try {
        console.log(`Recalculating stats for tournament ${tournamentId}`);

        // Get tournament document
        const tournamentRef = db.collection('tournaments').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            throw new Error('Tournament not found');
        }

        const tournamentData = tournamentDoc.data();
        const bracket = tournamentData.bracket || {};
        const matches = bracket.matches || [];
        const format = tournamentData.format || '501';

        // Delete all existing stats for this tournament
        const statsRef = db.collection('tournaments').doc(tournamentId).collection('stats');
        const existingStats = await statsRef.get();
        const batch = db.batch();
        existingStats.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${existingStats.size} existing stat documents`);

        // Process all completed matches
        let matchesProcessed = 0;
        let playersUpdated = new Set();

        for (const match of matches) {
            if (match.status !== 'completed') continue;
            if (!match.player1 || !match.player2) continue;

            const gameStats = match.stats;
            if (gameStats && gameStats.legs && Array.isArray(gameStats.legs)) {
                for (const leg of gameStats.legs) {
                    const player1Won = leg.winner === 'player1' || leg.winner === match.player1.id;

                    const p1Stats = leg.player1_stats || leg.home_stats;
                    const p2Stats = leg.player2_stats || leg.away_stats;

                    if (p1Stats) {
                        await updatePlayerLegStats(
                            tournamentId,
                            match.player1.id,
                            match.player1.name,
                            p1Stats,
                            format,
                            player1Won,
                            p2Stats
                        );
                        playersUpdated.add(match.player1.id);
                    }

                    if (p2Stats) {
                        await updatePlayerLegStats(
                            tournamentId,
                            match.player2.id,
                            match.player2.name,
                            p2Stats,
                            format,
                            !player1Won,
                            p1Stats
                        );
                        playersUpdated.add(match.player2.id);
                    }
                }
            }

            // Update match counts
            const winnerId = match.winner?.id;
            const player1WonMatch = winnerId === match.player1.id;

            if (match.player1.id) {
                const stats1Ref = statsRef.doc(match.player1.id);
                await stats1Ref.set({
                    matches_played: admin.firestore.FieldValue.increment(1),
                    matches_won: admin.firestore.FieldValue.increment(player1WonMatch ? 1 : 0),
                    round_reached: Math.max(match.round || 1, 1)
                }, { merge: true });
            }

            if (match.player2.id) {
                const stats2Ref = statsRef.doc(match.player2.id);
                await stats2Ref.set({
                    matches_played: admin.firestore.FieldValue.increment(1),
                    matches_won: admin.firestore.FieldValue.increment(!player1WonMatch ? 1 : 0),
                    round_reached: Math.max(match.round || 1, 1)
                }, { merge: true });
            }

            matchesProcessed++;
        }

        console.log(`Recalculated stats: ${matchesProcessed} matches, ${playersUpdated.size} players`);

        return {
            success: true,
            matchesProcessed,
            playersUpdated: playersUpdated.size
        };

    } catch (error) {
        console.error('Error recalculating tournament stats:', error);
        throw error;
    }
}

module.exports = {
    processTournamentMatchStats,
    getTournamentLeaderboard,
    getEmptyStats,
    recalculateTournamentStats
};
