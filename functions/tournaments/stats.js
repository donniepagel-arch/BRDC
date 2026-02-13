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

        // Checkout % by range (DartConnect-style)
        x01_co_80_attempts: 0,
        x01_co_80_hits: 0,
        x01_co_120_attempts: 0,
        x01_co_120_hits: 0,
        x01_co_140_attempts: 0,
        x01_co_140_hits: 0,
        x01_co_161_attempts: 0,
        x01_co_161_hits: 0,

        // Tiered checkout ranges (league-compatible)
        x01_checkout_attempts_low: 0,   // 2-80
        x01_checkout_successes_low: 0,
        x01_checkout_attempts_81: 0,    // 81-100
        x01_checkout_successes_81: 0,
        x01_checkout_attempts_101: 0,   // 101-140
        x01_checkout_successes_101: 0,
        x01_checkout_attempts_141: 0,   // 141-170
        x01_checkout_successes_141: 0,

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

        // Tiered checkout attempts (league-compatible ranges)
        if (stats.checkout_attempts_low) playerStats.x01_checkout_attempts_low += stats.checkout_attempts_low;
        if (stats.checkout_attempts_81) playerStats.x01_checkout_attempts_81 += stats.checkout_attempts_81;
        if (stats.checkout_attempts_101) playerStats.x01_checkout_attempts_101 += stats.checkout_attempts_101;
        if (stats.checkout_attempts_141) playerStats.x01_checkout_attempts_141 += stats.checkout_attempts_141;

        if (isWinner && stats.checkout) {
            playerStats.x01_checkouts_hit++;
            playerStats.x01_total_checkout_points += stats.checkout;
            if (stats.checkout >= 100) {
                playerStats.x01_ton_plus_checkouts++;
            }
            if (stats.checkout > playerStats.x01_high_checkout) {
                playerStats.x01_high_checkout = stats.checkout;
            }

            // Tiered checkout successes (league-compatible) - categorize by checkout score
            const co = stats.checkout;
            if (co >= 141) {
                playerStats.x01_checkout_successes_141 = (playerStats.x01_checkout_successes_141 || 0) + 1;
                if (!stats.checkout_attempts_141) playerStats.x01_checkout_attempts_141 = (playerStats.x01_checkout_attempts_141 || 0) + 1;
            } else if (co >= 101) {
                playerStats.x01_checkout_successes_101 = (playerStats.x01_checkout_successes_101 || 0) + 1;
                if (!stats.checkout_attempts_101) playerStats.x01_checkout_attempts_101 = (playerStats.x01_checkout_attempts_101 || 0) + 1;
            } else if (co >= 81) {
                playerStats.x01_checkout_successes_81 = (playerStats.x01_checkout_successes_81 || 0) + 1;
                if (!stats.checkout_attempts_81) playerStats.x01_checkout_attempts_81 = (playerStats.x01_checkout_attempts_81 || 0) + 1;
            } else {
                playerStats.x01_checkout_successes_low = (playerStats.x01_checkout_successes_low || 0) + 1;
                if (!stats.checkout_attempts_low) playerStats.x01_checkout_attempts_low = (playerStats.x01_checkout_attempts_low || 0) + 1;
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
 * Handles both single-elim (match.player1/player2) and double-elim (match.team1/team2)
 * @param {string} tournamentId - Tournament ID
 * @param {object} match - Match object
 * @param {object} gameStats - Stats object with legs array and match info
 * @param {string} format - Game format (501, cricket, etc.)
 */
async function processTournamentMatchStats(tournamentId, match, gameStats, format) {
    try {
        if (!gameStats) return;

        // Detect match type: single-elim has player1/player2, double-elim has team1/team2
        const isDoubleElim = !!(match.team1 || match.team2);

        if (isDoubleElim) {
            await processDoubleElimMatchStats(tournamentId, match, gameStats, format);
        } else {
            await processSingleElimMatchStats(tournamentId, match, gameStats, format);
        }

        console.log(`Tournament stats updated for match ${match.id}`);

    } catch (error) {
        console.error('Error processing tournament match stats:', error);
        // Don't throw - stats failure shouldn't break match recording
    }
}

/**
 * Process stats for single-elimination (1v1) matches
 */
async function processSingleElimMatchStats(tournamentId, match, gameStats, format) {
    const player1 = match.player1;
    const player2 = match.player2;

    if (!player1 || !player2) return;

    // Process leg-by-leg stats if available
    if (gameStats.legs && Array.isArray(gameStats.legs)) {
        for (const leg of gameStats.legs) {
            const player1Won = leg.winner === 'player1' || leg.winner === player1.id || leg.winner === 'home';

            // Get both players' stats for opponent tracking
            const p1Stats = leg.player1_stats || leg.home_stats;
            const p2Stats = leg.player2_stats || leg.away_stats;

            if (p1Stats) {
                await updatePlayerLegStats(
                    tournamentId, player1.id, player1.name,
                    p1Stats, format, player1Won, p2Stats
                );
            }

            if (p2Stats) {
                await updatePlayerLegStats(
                    tournamentId, player2.id, player2.name,
                    p2Stats, format, !player1Won, p1Stats
                );
            }
        }
    }

    // Update match counts
    const winnerId = match.winner?.id;
    const player1WonMatch = winnerId === player1.id;

    if (player1.id) {
        await db.collection('tournaments').doc(tournamentId)
            .collection('stats').doc(player1.id).set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(player1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
    }

    if (player2.id) {
        await db.collection('tournaments').doc(tournamentId)
            .collection('stats').doc(player2.id).set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(!player1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
    }
}

/**
 * Process stats for double-elimination (team doubles) matches
 * Teams have player1 and player2 inside them. The scorer sends:
 *   - leg.home_stats / leg.away_stats (team-level aggregates)
 *   - leg.player_stats = { "Player Name": { darts, points, ... } } (per-player)
 */
async function processDoubleElimMatchStats(tournamentId, match, gameStats, format) {
    const team1 = match.team1;
    const team2 = match.team2;

    if (!team1 || !team2) return;

    // Collect all players with IDs from both teams
    // team1 = home side, team2 = away side (as sent by scorer)
    const team1Players = [];
    const team2Players = [];

    if (team1.player1?.player_id) team1Players.push({ id: team1.player1.player_id, name: team1.player1.name });
    if (team1.player2?.player_id) team1Players.push({ id: team1.player2.player_id, name: team1.player2.name });
    if (team2.player1?.player_id) team2Players.push({ id: team2.player1.player_id, name: team2.player1.name });
    if (team2.player2?.player_id) team2Players.push({ id: team2.player2.player_id, name: team2.player2.name });

    const allPlayers = [...team1Players, ...team2Players];
    if (allPlayers.length === 0) {
        console.log('No players with IDs found in double-elim match - skipping stats');
        return;
    }

    // Process leg-by-leg stats
    if (gameStats.legs && Array.isArray(gameStats.legs)) {
        for (const leg of gameStats.legs) {
            const homeWon = leg.winner === 'home';
            const homeStats = leg.home_stats;
            const awayStats = leg.away_stats;
            const playerStats = leg.player_stats || {};

            // Process team1 (home side) players
            for (const player of team1Players) {
                // Try per-player stats first, fall back to team stats
                const individualStats = playerStats[player.name];
                const stats = individualStats
                    ? mapPlayerStatsToLegFormat(individualStats, homeStats)
                    : homeStats;

                if (stats) {
                    await updatePlayerLegStats(
                        tournamentId, player.id, player.name,
                        stats, format, homeWon, awayStats
                    );
                }
            }

            // Process team2 (away side) players
            for (const player of team2Players) {
                const individualStats = playerStats[player.name];
                const stats = individualStats
                    ? mapPlayerStatsToLegFormat(individualStats, awayStats)
                    : awayStats;

                if (stats) {
                    await updatePlayerLegStats(
                        tournamentId, player.id, player.name,
                        stats, format, !homeWon, homeStats
                    );
                }
            }
        }
    }

    // Update match counts for all players
    const team1WonMatch = match.winner_id === match.team1_id;

    for (const player of team1Players) {
        await db.collection('tournaments').doc(tournamentId)
            .collection('stats').doc(player.id).set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(team1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
    }

    for (const player of team2Players) {
        await db.collection('tournaments').doc(tournamentId)
            .collection('stats').doc(player.id).set({
                matches_played: admin.firestore.FieldValue.increment(1),
                matches_won: admin.firestore.FieldValue.increment(!team1WonMatch ? 1 : 0),
                round_reached: Math.max(match.round || 1, 1)
            }, { merge: true });
    }
}

/**
 * Map per-player stats from scorer's player_stats format to the leg stats format
 * that updatePlayerLegStats expects. Supplements with team-level stats for fields
 * that player_stats doesn't include (checkout ranges, threw_first, etc.)
 */
function mapPlayerStatsToLegFormat(playerStats, teamStats) {
    return {
        // Core stats from per-player data
        darts_thrown: playerStats.darts || 0,
        points_scored: playerStats.points || 0,
        darts: playerStats.darts || 0,
        points: playerStats.points || 0,

        // First 9 stats
        first9_darts: playerStats.first9_darts || playerStats.first9Darts || 0,
        first9_points: playerStats.first9_points || playerStats.first9Points || 0,

        // Ton breakdown
        tons: playerStats.tons || 0,
        ton_00: playerStats.ton_00 || 0,
        ton_20: playerStats.ton_20 || 0,
        ton_40: playerStats.ton_40 || 0,
        ton_60: playerStats.ton_60 || 0,
        ton_80: playerStats.ton_80 || 0,

        // Checkout (only the player who checked out will have this)
        checkout: playerStats.checkout || 0,
        high_score: playerStats.high_score || playerStats.highScore || 0,

        // Cricket marks (for cricket legs)
        rounds: playerStats.rounds || 0,
        marks: playerStats.marks || 0,
        missed_darts: playerStats.missed_darts || playerStats.missedDarts || 0,

        // Mark round counts from per-player
        five_mark_rounds: playerStats.five_mark_rounds || playerStats.fiveMarkRounds || 0,
        six_mark_rounds: playerStats.six_mark_rounds || playerStats.sixMarkRounds || 0,
        seven_mark_rounds: playerStats.seven_mark_rounds || playerStats.sevenMarkRounds || 0,
        eight_mark_rounds: playerStats.eight_mark_rounds || playerStats.eightMarkRounds || 0,
        nine_mark_rounds: playerStats.nine_mark_rounds || playerStats.nineMarkRounds || 0,

        // Team-level stats that can't be split per player in doubles
        // Use team stats as a supplement (these are shared team stats)
        checkout_attempts: teamStats?.checkout_attempts || 0,
        checkout_darts: teamStats?.checkout_darts || 0,
        threw_first: teamStats?.threw_first,
        first_turn_score: teamStats?.first_turn_score || 0,
        ton_points: teamStats?.ton_points || 0,

        // Checkout ranges from team stats
        co_80_attempts: teamStats?.co_80_attempts || 0,
        co_80_hits: teamStats?.co_80_hits || 0,
        co_120_attempts: teamStats?.co_120_attempts || 0,
        co_120_hits: teamStats?.co_120_hits || 0,
        co_140_attempts: teamStats?.co_140_attempts || 0,
        co_140_hits: teamStats?.co_140_hits || 0,
        co_161_attempts: teamStats?.co_161_attempts || 0,
        co_161_hits: teamStats?.co_161_hits || 0
    };
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
 * Handles both single-elim (bracket.matches) and double-elim (bracket.winners/losers/grand_finals)
 * @param {string} tournamentId - Tournament ID
 * @returns {object} - Result with success flag and stats
 */
async function recalculateTournamentStats(tournamentId) {
    try {
        console.log(`Recalculating stats for tournament ${tournamentId}`);

        const tournamentRef = db.collection('tournaments').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            throw new Error('Tournament not found');
        }

        const tournamentData = tournamentDoc.data();
        const bracket = tournamentData.bracket || {};

        // Delete all existing stats for this tournament
        const statsRef = db.collection('tournaments').doc(tournamentId).collection('stats');
        const existingStats = await statsRef.get();
        const batch = db.batch();
        existingStats.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${existingStats.size} existing stat documents`);

        // Collect all completed matches from the bracket
        const completedMatches = [];
        const isDoubleElim = bracket.type === 'double_elimination';

        if (isDoubleElim) {
            // Double elimination: collect from winners, losers, and grand finals
            const winnersFormat = tournamentData.winners_game_type || 'cricket';
            const losersFormat = tournamentData.losers_game_type || '501';

            if (bracket.winners) {
                for (const m of bracket.winners) {
                    if (m.status === 'completed') completedMatches.push({ match: m, format: winnersFormat });
                }
            }
            if (bracket.losers) {
                for (const m of bracket.losers) {
                    if (m.status === 'completed') completedMatches.push({ match: m, format: losersFormat });
                }
            }
            if (bracket.grand_finals) {
                if (bracket.grand_finals.match1?.status === 'completed') {
                    completedMatches.push({ match: bracket.grand_finals.match1, format: winnersFormat });
                }
                if (bracket.grand_finals.match2?.status === 'completed') {
                    completedMatches.push({ match: bracket.grand_finals.match2, format: winnersFormat });
                }
            }
        } else {
            // Single elimination: collect from bracket.matches
            const singleFormat = tournamentData.format || '501';
            const matches = bracket.matches || [];
            for (const m of matches) {
                if (m.status === 'completed') completedMatches.push({ match: m, format: singleFormat });
            }
        }

        // Process all completed matches using the existing processTournamentMatchStats
        let matchesProcessed = 0;
        let playersUpdated = new Set();

        for (const { match, format } of completedMatches) {
            const gameStats = match.stats;
            if (gameStats) {
                await processTournamentMatchStats(tournamentId, match, gameStats, format);

                // Track player IDs that were updated
                if (match.player1?.id) playersUpdated.add(match.player1.id);
                if (match.player2?.id) playersUpdated.add(match.player2.id);
                if (match.team1?.player1?.player_id) playersUpdated.add(match.team1.player1.player_id);
                if (match.team1?.player2?.player_id) playersUpdated.add(match.team1.player2.player_id);
                if (match.team2?.player1?.player_id) playersUpdated.add(match.team2.player1.player_id);
                if (match.team2?.player2?.player_id) playersUpdated.add(match.team2.player2.player_id);
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
