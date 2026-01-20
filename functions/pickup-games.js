/**
 * Pickup Games Module
 * Handles saving and stats aggregation for casual/pickup games
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Initialize empty stats object for pickup games
 * Full DartConnect-compatible stats schema
 */
function getEmptyPickupStats(playerId, playerName) {
    return {
        player_id: playerId,
        player_name: playerName,

        // ============================================
        // X01 STATS
        // ============================================

        // Core leg counts
        x01_legs_played: 0,
        x01_legs_won: 0,

        // Dart aggregates
        x01_total_darts: 0,
        x01_total_points: 0,

        // First 9 darts (for First9 Avg)
        x01_first9_darts: 0,
        x01_first9_points: 0,

        // First turn (for HSI - High Straight In)
        x01_first_turn_total: 0,
        x01_first_turn_count: 0,

        // Ton breakdown (DartConnect: T00, T20, T40, T60, T80)
        x01_tons: 0,                    // 100+ total
        x01_ton_00: 0,                  // 100-119
        x01_ton_20: 0,                  // 120-139
        x01_ton_40: 0,                  // 140-159
        x01_ton_60: 0,                  // 160-179
        x01_ton_80: 0,                  // 180
        x01_ton_forties: 0,             // 140+ combined (legacy)
        x01_ton_eighties: 0,            // 180s (legacy alias)
        x01_one_seventy_ones: 0,        // 171+ (special)
        x01_ton_points_total: 0,        // Sum of all 100+ turn scores (Ton Points)

        // Checkout counters
        x01_checkouts_hit: 0,
        x01_checkout_attempts: 0,       // Turns on a checkout opportunity
        x01_checkout_darts: 0,          // Individual darts at doubles
        x01_total_checkout_points: 0,   // Sum for AFin calculation
        x01_ton_plus_checkouts: 0,      // 100+ checkouts

        // Checkout % by range (DartConnect + User Requested)
        x01_co_80_attempts: 0,          // 80-119 outshot attempts
        x01_co_80_hits: 0,              // 80-119 outshot hits
        x01_co_120_attempts: 0,         // 120-139 outshot attempts
        x01_co_120_hits: 0,             // 120-139 outshot hits
        x01_co_140_attempts: 0,         // 140-160 outshot attempts
        x01_co_140_hits: 0,             // 140-160 outshot hits
        x01_co_161_attempts: 0,         // 161-170 outshot attempts (BIG finishes)
        x01_co_161_hits: 0,             // 161-170 outshot hits

        // With/Against Darts (throw order)
        x01_legs_with_darts: 0,         // Legs where player threw first (LWD)
        x01_legs_with_darts_won: 0,     // Legs won when throwing first
        x01_legs_against_darts: 0,      // Legs where opponent threw first (LAD)
        x01_legs_against_darts_won: 0,  // Legs won when throwing second

        // Opponent tracking (for O-3DA)
        x01_opponent_points_total: 0,
        x01_opponent_darts_total: 0,

        // Maximum stats
        x01_high_checkout: 0,           // HDO - High Double Out
        x01_high_score: 0,              // HTurn - High Turn
        x01_high_straight_in: 0,        // HSI - High Straight In

        // Minimum stats
        x01_best_leg: 999,              // Best leg in darts

        // ============================================
        // CRICKET STATS
        // ============================================

        // Core leg counts
        cricket_legs_played: 0,
        cricket_legs_won: 0,

        // Round/mark counts
        cricket_total_rounds: 0,
        cricket_total_marks: 0,
        cricket_total_darts: 0,

        // Dart quality
        cricket_missed_darts: 0,
        cricket_triple_bull_darts: 0,

        // Mark round counts (DartConnect: 5M+, 6M, 7M, 8M, 9M)
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

        // Special achievements
        cricket_hat_tricks: 0,
        cricket_white_horse: 0,
        cricket_three_in_bed: 0,

        // With/Against Darts
        cricket_legs_with_darts: 0,
        cricket_legs_with_darts_won: 0,
        cricket_legs_against_darts: 0,
        cricket_legs_against_darts_won: 0,

        // Maximum stats
        cricket_high_mark_round: 0,

        // Minimum stats
        cricket_low_rounds: 999,

        // ============================================
        // OVERALL STATS
        // ============================================
        games_played: 0,
        games_won: 0
    };
}

/**
 * Update player's pickup stats with leg data
 * Full DartConnect-compatible stats processing
 */
async function updatePickupPlayerStats(playerId, playerName, stats, format, isWinner, opponentStats = null) {
    if (!playerId) return;

    const statsRef = db.collection('players').doc(playerId)
        .collection('pickup_stats').doc('aggregate');

    const statsDoc = await statsRef.get();
    let playerStats = statsDoc.exists ? statsDoc.data() : getEmptyPickupStats(playerId, playerName);

    const isX01 = format === '501' || format === '301' || format === '701' ||
                  format === 'x01' || /^\d+$/.test(format);

    if (isX01) {
        // Core leg counts
        playerStats.x01_legs_played++;
        if (isWinner) playerStats.x01_legs_won++;

        // Dart aggregates
        playerStats.x01_total_darts += stats.darts_thrown || 0;
        playerStats.x01_total_points += stats.points_scored || 0;

        // First 9 stats
        playerStats.x01_first9_darts += stats.first9_darts || 0;
        playerStats.x01_first9_points += stats.first9_points || 0;

        // First turn (HSI) stats
        if (stats.first_turn_score !== undefined && stats.first_turn_score > 0) {
            playerStats.x01_first_turn_total += stats.first_turn_score;
            playerStats.x01_first_turn_count++;
            if (stats.first_turn_score > (playerStats.x01_high_straight_in || 0)) {
                playerStats.x01_high_straight_in = stats.first_turn_score;
            }
        }

        // Ton breakdown (DartConnect: T00, T20, T40, T60, T80)
        playerStats.x01_tons += stats.tons || 0;
        playerStats.x01_ton_00 += stats.ton_00 || 0;
        playerStats.x01_ton_20 += stats.ton_20 || 0;
        playerStats.x01_ton_40 += stats.ton_40 || 0;
        playerStats.x01_ton_60 += stats.ton_60 || 0;
        playerStats.x01_ton_80 += stats.ton_80 || 0;
        playerStats.x01_ton_forties += stats.ton_forties || (stats.ton_40 || 0) + (stats.ton_60 || 0) + (stats.ton_80 || 0);
        playerStats.x01_ton_eighties += stats.ton_eighties || stats.ton_80 || 0;
        playerStats.x01_one_seventy_ones += stats.one_seventyone || 0;

        // Ton points total (sum of all 100+ turn scores)
        playerStats.x01_ton_points_total += stats.ton_points || 0;

        // Checkout stats
        playerStats.x01_checkout_attempts += stats.checkout_attempts || 0;
        playerStats.x01_checkout_darts += stats.checkout_darts || 0;

        // Checkout % by range tracking
        playerStats.x01_co_80_attempts += stats.co_80_attempts || 0;
        playerStats.x01_co_80_hits += stats.co_80_hits || 0;
        playerStats.x01_co_120_attempts += stats.co_120_attempts || 0;
        playerStats.x01_co_120_hits += stats.co_120_hits || 0;
        playerStats.x01_co_140_attempts += stats.co_140_attempts || 0;
        playerStats.x01_co_140_hits += stats.co_140_hits || 0;
        playerStats.x01_co_161_attempts += stats.co_161_attempts || 0;
        playerStats.x01_co_161_hits += stats.co_161_hits || 0;

        // With/Against Darts tracking
        if (stats.threw_first === true) {
            playerStats.x01_legs_with_darts++;
            if (isWinner) playerStats.x01_legs_with_darts_won++;
        } else if (stats.threw_first === false) {
            playerStats.x01_legs_against_darts++;
            if (isWinner) playerStats.x01_legs_against_darts_won++;
        }

        // Opponent tracking (for O-3DA)
        if (opponentStats) {
            playerStats.x01_opponent_points_total += opponentStats.points_scored || 0;
            playerStats.x01_opponent_darts_total += opponentStats.darts_thrown || 0;
        }

        // High score (max)
        if ((stats.high_score || 0) > (playerStats.x01_high_score || 0)) {
            playerStats.x01_high_score = stats.high_score;
        }

        // Winner-specific checkout stats
        if (isWinner && stats.checkout) {
            playerStats.x01_checkouts_hit++;
            playerStats.x01_total_checkout_points += stats.checkout;
            if (stats.checkout >= 100) {
                playerStats.x01_ton_plus_checkouts++;
            }
            if (stats.checkout > (playerStats.x01_high_checkout || 0)) {
                playerStats.x01_high_checkout = stats.checkout;
            }
            const legDarts = stats.darts_thrown || 0;
            if (legDarts > 0 && legDarts < (playerStats.x01_best_leg || 999)) {
                playerStats.x01_best_leg = legDarts;
            }
        }
    } else if (format === 'cricket') {
        // Core leg counts
        playerStats.cricket_legs_played++;
        if (isWinner) playerStats.cricket_legs_won++;

        // Round/mark/dart counts
        playerStats.cricket_total_rounds += stats.rounds || 0;
        playerStats.cricket_total_marks += stats.marks || 0;
        playerStats.cricket_total_darts += stats.darts_thrown || 0;

        // Dart quality
        playerStats.cricket_missed_darts += stats.missed_darts || 0;
        playerStats.cricket_triple_bull_darts += stats.triple_bull_darts || 0;

        // Mark round counts (DartConnect: 5M+, 6M, 7M, 8M, 9M)
        playerStats.cricket_five_mark_rounds += stats.five_mark_rounds || 0;
        playerStats.cricket_six_mark_rounds += stats.six_mark_rounds || 0;
        playerStats.cricket_seven_mark_rounds += stats.seven_mark_rounds || 0;
        playerStats.cricket_eight_mark_rounds += stats.eight_mark_rounds || 0;
        playerStats.cricket_nine_mark_rounds += stats.nine_mark_rounds || 0;

        // Bull achievements
        playerStats.cricket_three_bulls += stats.three_bulls || 0;
        playerStats.cricket_four_bulls += stats.four_bulls || 0;
        playerStats.cricket_five_bulls += stats.five_bulls || 0;
        playerStats.cricket_six_bulls += stats.six_bulls || 0;

        // Special achievements
        playerStats.cricket_hat_tricks += stats.hat_tricks || 0;
        playerStats.cricket_white_horse += stats.white_horse || 0;
        playerStats.cricket_three_in_bed += stats.three_in_bed || 0;

        // With/Against Darts tracking
        if (stats.threw_first === true) {
            playerStats.cricket_legs_with_darts++;
            if (isWinner) playerStats.cricket_legs_with_darts_won++;
        } else if (stats.threw_first === false) {
            playerStats.cricket_legs_against_darts++;
            if (isWinner) playerStats.cricket_legs_against_darts_won++;
        }

        // High mark round (max)
        if ((stats.high_mark_round || 0) > (playerStats.cricket_high_mark_round || 0)) {
            playerStats.cricket_high_mark_round = stats.high_mark_round;
        }

        // Low rounds to close (min) - only when winner
        if (isWinner && stats.rounds > 0) {
            if (stats.rounds < (playerStats.cricket_low_rounds || 999)) {
                playerStats.cricket_low_rounds = stats.rounds;
            }
        }
    }

    await statsRef.set(playerStats, { merge: true });
}

/**
 * Update bot's game stats
 * Full DartConnect-compatible stats processing for bots
 */
async function updateBotStats(botId, stats, format, isWinner) {
    if (!botId) return;

    const botRef = db.collection('bots').doc(botId);
    const botDoc = await botRef.get();

    if (!botDoc.exists) {
        console.log(`Bot ${botId} not found, skipping stats update`);
        return;
    }

    const isX01 = format === '501' || format === '301' || format === '701' ||
                  format === 'x01' || /^\d+$/.test(format);

    const updates = {};
    const currentBotData = botDoc.data();

    if (isX01) {
        // Core leg counts
        updates['game_stats.x01.legs_played'] = admin.firestore.FieldValue.increment(1);
        if (isWinner) updates['game_stats.x01.legs_won'] = admin.firestore.FieldValue.increment(1);

        // Dart aggregates - accept both naming conventions
        const dartsThrown = stats.darts_thrown || stats.darts || 0;
        const pointsScored = stats.points_scored || stats.points || 0;
        updates['game_stats.x01.total_darts'] = admin.firestore.FieldValue.increment(dartsThrown);
        updates['game_stats.x01.total_points'] = admin.firestore.FieldValue.increment(pointsScored);

        // First 9 stats - accept both naming conventions
        const first9Darts = stats.first9_darts || stats.first9Darts || 0;
        const first9Points = stats.first9_points || stats.first9Points || 0;
        updates['game_stats.x01.first9_darts'] = admin.firestore.FieldValue.increment(first9Darts);
        updates['game_stats.x01.first9_points'] = admin.firestore.FieldValue.increment(first9Points);

        // Ton breakdown
        updates['game_stats.x01.tons'] = admin.firestore.FieldValue.increment(stats.tons || 0);
        updates['game_stats.x01.ton_00'] = admin.firestore.FieldValue.increment(stats.ton_00 || 0);
        updates['game_stats.x01.ton_20'] = admin.firestore.FieldValue.increment(stats.ton_20 || 0);
        updates['game_stats.x01.ton_40'] = admin.firestore.FieldValue.increment(stats.ton_40 || 0);
        updates['game_stats.x01.ton_60'] = admin.firestore.FieldValue.increment(stats.ton_60 || 0);
        updates['game_stats.x01.ton_80'] = admin.firestore.FieldValue.increment(stats.ton_80 || 0);
        updates['game_stats.x01.ton_eighties'] = admin.firestore.FieldValue.increment(stats.ton_80 || 0);
        updates['game_stats.x01.one_seventy_ones'] = admin.firestore.FieldValue.increment(stats.one_seventyone || 0);

        // Checkout stats
        updates['game_stats.x01.checkout_attempts'] = admin.firestore.FieldValue.increment(stats.checkout_attempts || 0);
        updates['game_stats.x01.checkout_darts'] = admin.firestore.FieldValue.increment(stats.checkout_darts || 0);

        // Checkout % by range
        updates['game_stats.x01.co_80_attempts'] = admin.firestore.FieldValue.increment(stats.co_80_attempts || 0);
        updates['game_stats.x01.co_80_hits'] = admin.firestore.FieldValue.increment(stats.co_80_hits || 0);
        updates['game_stats.x01.co_120_attempts'] = admin.firestore.FieldValue.increment(stats.co_120_attempts || 0);
        updates['game_stats.x01.co_120_hits'] = admin.firestore.FieldValue.increment(stats.co_120_hits || 0);
        updates['game_stats.x01.co_140_attempts'] = admin.firestore.FieldValue.increment(stats.co_140_attempts || 0);
        updates['game_stats.x01.co_140_hits'] = admin.firestore.FieldValue.increment(stats.co_140_hits || 0);
        updates['game_stats.x01.co_161_attempts'] = admin.firestore.FieldValue.increment(stats.co_161_attempts || 0);
        updates['game_stats.x01.co_161_hits'] = admin.firestore.FieldValue.increment(stats.co_161_hits || 0);

        // With/Against Darts
        if (stats.threw_first === true) {
            updates['game_stats.x01.legs_with_darts'] = admin.firestore.FieldValue.increment(1);
            if (isWinner) updates['game_stats.x01.legs_with_darts_won'] = admin.firestore.FieldValue.increment(1);
        } else if (stats.threw_first === false) {
            updates['game_stats.x01.legs_against_darts'] = admin.firestore.FieldValue.increment(1);
            if (isWinner) updates['game_stats.x01.legs_against_darts_won'] = admin.firestore.FieldValue.increment(1);
        }

        // Maximum stats (need to check current values)
        const currentX01Stats = currentBotData.game_stats?.x01 || {};

        if ((stats.high_score || 0) > (currentX01Stats.high_score || 0)) {
            updates['game_stats.x01.high_score'] = stats.high_score;
        }

        if ((stats.first_turn_score || 0) > (currentX01Stats.high_straight_in || 0)) {
            updates['game_stats.x01.high_straight_in'] = stats.first_turn_score;
        }

        // Winner-specific stats
        if (isWinner && stats.checkout) {
            updates['game_stats.x01.checkouts_hit'] = admin.firestore.FieldValue.increment(1);
            updates['game_stats.x01.total_checkout_points'] = admin.firestore.FieldValue.increment(stats.checkout);

            if (stats.checkout >= 100) {
                updates['game_stats.x01.ton_plus_checkouts'] = admin.firestore.FieldValue.increment(1);
            }
            if ((stats.checkout || 0) > (currentX01Stats.high_checkout || 0)) {
                updates['game_stats.x01.high_checkout'] = stats.checkout;
            }

            const legDarts = stats.darts_thrown || stats.darts || 0;
            if (legDarts > 0 && legDarts < (currentX01Stats.best_leg || 999)) {
                updates['game_stats.x01.best_leg'] = legDarts;
            }
        }
    } else if (format === 'cricket') {
        // Core leg counts
        updates['game_stats.cricket.legs_played'] = admin.firestore.FieldValue.increment(1);
        if (isWinner) updates['game_stats.cricket.legs_won'] = admin.firestore.FieldValue.increment(1);

        // Round/mark/dart counts - accept both naming conventions
        const cricketDarts = stats.darts_thrown || stats.darts || 0;
        updates['game_stats.cricket.total_marks'] = admin.firestore.FieldValue.increment(stats.marks || 0);
        updates['game_stats.cricket.total_rounds'] = admin.firestore.FieldValue.increment(stats.rounds || 0);
        updates['game_stats.cricket.total_darts'] = admin.firestore.FieldValue.increment(cricketDarts);

        // Dart quality
        updates['game_stats.cricket.missed_darts'] = admin.firestore.FieldValue.increment(stats.missed_darts || 0);
        updates['game_stats.cricket.triple_bull_darts'] = admin.firestore.FieldValue.increment(stats.triple_bull_darts || 0);

        // Mark round counts
        updates['game_stats.cricket.five_mark_rounds'] = admin.firestore.FieldValue.increment(stats.five_mark_rounds || 0);
        updates['game_stats.cricket.six_mark_rounds'] = admin.firestore.FieldValue.increment(stats.six_mark_rounds || 0);
        updates['game_stats.cricket.seven_mark_rounds'] = admin.firestore.FieldValue.increment(stats.seven_mark_rounds || 0);
        updates['game_stats.cricket.eight_mark_rounds'] = admin.firestore.FieldValue.increment(stats.eight_mark_rounds || 0);
        updates['game_stats.cricket.nine_mark_rounds'] = admin.firestore.FieldValue.increment(stats.nine_mark_rounds || 0);

        // Bull achievements
        updates['game_stats.cricket.three_bulls'] = admin.firestore.FieldValue.increment(stats.three_bulls || 0);
        updates['game_stats.cricket.four_bulls'] = admin.firestore.FieldValue.increment(stats.four_bulls || 0);
        updates['game_stats.cricket.five_bulls'] = admin.firestore.FieldValue.increment(stats.five_bulls || 0);
        updates['game_stats.cricket.six_bulls'] = admin.firestore.FieldValue.increment(stats.six_bulls || 0);
        updates['game_stats.cricket.hat_tricks'] = admin.firestore.FieldValue.increment(stats.hat_tricks || 0);

        // With/Against Darts
        if (stats.threw_first === true) {
            updates['game_stats.cricket.legs_with_darts'] = admin.firestore.FieldValue.increment(1);
            if (isWinner) updates['game_stats.cricket.legs_with_darts_won'] = admin.firestore.FieldValue.increment(1);
        } else if (stats.threw_first === false) {
            updates['game_stats.cricket.legs_against_darts'] = admin.firestore.FieldValue.increment(1);
            if (isWinner) updates['game_stats.cricket.legs_against_darts_won'] = admin.firestore.FieldValue.increment(1);
        }

        // Maximum stats
        const currentCricketStats = currentBotData.game_stats?.cricket || {};

        if ((stats.high_mark_round || 0) > (currentCricketStats.high_mark_round || 0)) {
            updates['game_stats.cricket.high_mark_round'] = stats.high_mark_round;
        }

        // Minimum stats (low rounds to close)
        if (isWinner && stats.rounds > 0) {
            if (stats.rounds < (currentCricketStats.low_rounds || 999)) {
                updates['game_stats.cricket.low_rounds'] = stats.rounds;
            }
        }
    }

    await botRef.update(updates);
}

/**
 * Look up player ID from PIN
 */
async function getPlayerIdFromPin(pin) {
    if (!pin) return null;

    // Check players collection
    const playerSnap = await db.collection('players')
        .where('pin', '==', pin.toUpperCase())
        .limit(1)
        .get();

    if (!playerSnap.empty) {
        return playerSnap.docs[0].id;
    }

    // Check bots collection
    const botSnap = await db.collection('bots')
        .where('pin', '==', pin.toUpperCase())
        .limit(1)
        .get();

    if (!botSnap.empty) {
        return botSnap.docs[0].id;
    }

    return null;
}

/**
 * Save a pickup game and update player stats
 */
exports.savePickupGame = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            game_type,      // '501', 'cricket', etc.
            players,        // [{ id, pin, name, is_bot }, { id, pin, name, is_bot }]
            winner_index,   // 0 or 1
            legs,           // Array of leg data
            match_config    // { bestOf, doubleOut, etc. }
        } = req.body;

        if (!game_type || !players || players.length < 2) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Resolve player IDs from PINs if needed
        for (const player of players) {
            if (!player.id && player.pin) {
                player.id = await getPlayerIdFromPin(player.pin);
            }
        }

        const winner = players[winner_index] || players[0];

        // Save the game record
        const gameRef = await db.collection('pickup_games').add({
            game_type,
            players,
            winner_id: winner.id || null,
            winner_name: winner.name,
            played_at: admin.firestore.FieldValue.serverTimestamp(),
            legs: legs || [],
            match_config: match_config || {},
            player_stats: {}
        });

        // Process leg stats for each player (humans and bots)
        if (legs && Array.isArray(legs)) {
            for (const leg of legs) {
                const player1Won = leg.winner === 0 || leg.winner === 'player1';

                // Player 1 stats (pass player2 stats as opponent for O-3DA)
                if (leg.player1_stats && players[0]?.id) {
                    if (players[0].is_bot) {
                        await updateBotStats(
                            players[0].id,
                            leg.player1_stats,
                            game_type,
                            player1Won
                        );
                    } else {
                        await updatePickupPlayerStats(
                            players[0].id,
                            players[0].name,
                            leg.player1_stats,
                            game_type,
                            player1Won,
                            leg.player2_stats  // opponent stats for O-3DA
                        );
                    }
                }

                // Player 2 stats (pass player1 stats as opponent for O-3DA)
                if (leg.player2_stats && players[1]?.id) {
                    if (players[1].is_bot) {
                        await updateBotStats(
                            players[1].id,
                            leg.player2_stats,
                            game_type,
                            !player1Won
                        );
                    } else {
                        await updatePickupPlayerStats(
                            players[1].id,
                            players[1].name,
                            leg.player2_stats,
                            game_type,
                            !player1Won,
                            leg.player1_stats  // opponent stats for O-3DA
                        );
                    }
                }
            }
        }

        // Update games played/won counts
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player.id) continue;

            const isWinner = i === winner_index;

            if (player.is_bot) {
                // Update bot match counts
                await db.collection('bots').doc(player.id).update({
                    'game_stats.matches_played': admin.firestore.FieldValue.increment(1),
                    'game_stats.matches_won': admin.firestore.FieldValue.increment(isWinner ? 1 : 0)
                });
            } else {
                // Update player pickup stats
                const statsRef = db.collection('players').doc(player.id)
                    .collection('pickup_stats').doc('aggregate');

                await statsRef.set({
                    games_played: admin.firestore.FieldValue.increment(1),
                    games_won: admin.firestore.FieldValue.increment(isWinner ? 1 : 0)
                }, { merge: true });
            }
        }

        res.json({
            success: true,
            game_id: gameRef.id,
            message: 'Game saved and stats updated'
        });

    } catch (error) {
        console.error('Error saving pickup game:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get a player's pickup game stats
 */
exports.getPickupStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const playerId = req.query.player_id;

        if (!playerId) {
            return res.status(400).json({ error: 'Missing player_id' });
        }

        const statsRef = db.collection('players').doc(playerId)
            .collection('pickup_stats').doc('aggregate');

        const statsDoc = await statsRef.get();

        if (!statsDoc.exists) {
            return res.json({
                success: true,
                stats: getEmptyPickupStats(playerId, 'Unknown'),
                has_data: false
            });
        }

        const stats = statsDoc.data();

        // Calculate derived stats
        const ppd = stats.x01_total_darts > 0
            ? (stats.x01_total_points / stats.x01_total_darts * 3)
            : 0;

        const mpr = stats.cricket_total_rounds > 0
            ? (stats.cricket_total_marks / stats.cricket_total_rounds)
            : 0;

        res.json({
            success: true,
            stats: {
                ...stats,
                x01_three_dart_avg: parseFloat(ppd.toFixed(2)),
                cricket_mpr: parseFloat(mpr.toFixed(2))
            },
            has_data: true
        });

    } catch (error) {
        console.error('Error getting pickup stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get recent pickup games for a player
 */
exports.getPickupGames = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const playerId = req.query.player_id;
        const limitCount = parseInt(req.query.limit) || 10;

        if (!playerId) {
            return res.status(400).json({ error: 'Missing player_id' });
        }

        // Query games where player is a participant
        const gamesSnap = await db.collection('pickup_games')
            .orderBy('played_at', 'desc')
            .limit(100)
            .get();

        const games = [];
        gamesSnap.forEach(doc => {
            const data = doc.data();
            // Check if player is in this game
            const isParticipant = data.players?.some(p => p.id === playerId);
            if (isParticipant && games.length < limitCount) {
                games.push({
                    id: doc.id,
                    ...data,
                    played_at: data.played_at?.toDate?.() || null
                });
            }
        });

        res.json({
            success: true,
            games
        });

    } catch (error) {
        console.error('Error getting pickup games:', error);
        res.status(500).json({ error: error.message });
    }
});
