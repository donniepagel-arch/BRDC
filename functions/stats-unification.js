/**
 * BRDC Phase 7: Stats Unification
 * - Unified Average: Combine all match types
 * - Global Leaderboards: Rankings across all play
 * - Season Rankings: Historical season data
 * - Practice Mode: Track practice sessions
 */

const functions = require('firebase-functions');
// const { onSchedule } = require('firebase-functions/scheduler'); // DISABLED - v2 scheduler not compatible with v4
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// UNIFIED STATS
// ============================================

/**
 * Calculate unified stats across all match types
 */
exports.calculateUnifiedStats = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id } = req.query;

            if (!player_id) {
                return res.status(400).json({ error: 'player_id required' });
            }

            // Gather stats from all sources
            const [
                leagueStats,
                tournamentStats,
                onlineStats,
                miniTournamentStats,
                practiceStats
            ] = await Promise.all([
                getLeagueStats(player_id),
                getTournamentStats(player_id),
                getOnlineStats(player_id),
                getMiniTournamentStats(player_id),
                getPracticeStats(player_id)
            ]);

            // Calculate unified average (weighted by legs played)
            const allStats = [
                { ...leagueStats, weight: 1.0, type: 'league' },
                { ...tournamentStats, weight: 1.0, type: 'tournament' },
                { ...onlineStats, weight: 0.9, type: 'online' },
                { ...miniTournamentStats, weight: 0.8, type: 'mini' },
                { ...practiceStats, weight: 0.3, type: 'practice' }
            ];

            let totalWeightedScore = 0;
            let totalWeightedLegs = 0;
            let totalLegsWon = 0;
            let totalLegsLost = 0;
            let totalMatchWins = 0;
            let totalMatchLosses = 0;
            let total180s = 0;
            let totalTonPlus = 0;
            let highestCheckout = 0;
            let highestRound = 0;

            allStats.forEach(stat => {
                if (stat.legs_played > 0) {
                    totalWeightedScore += stat.total_score * stat.weight;
                    totalWeightedLegs += stat.legs_played * stat.weight;
                    totalLegsWon += stat.legs_won || 0;
                    totalLegsLost += stat.legs_lost || 0;
                    totalMatchWins += stat.matches_won || 0;
                    totalMatchLosses += stat.matches_lost || 0;
                    total180s += stat.max_180s || 0;
                    totalTonPlus += stat.ton_plus || 0;
                    if (stat.highest_checkout > highestCheckout) {
                        highestCheckout = stat.highest_checkout;
                    }
                    if (stat.highest_round > highestRound) {
                        highestRound = stat.highest_round;
                    }
                }
            });

            const unifiedAverage = totalWeightedLegs > 0
                ? totalWeightedScore / totalWeightedLegs
                : 0;

            const unifiedStats = {
                unified_average: parseFloat(unifiedAverage.toFixed(2)),

                // By type
                league: leagueStats,
                tournament: tournamentStats,
                online: onlineStats,
                mini_tournament: miniTournamentStats,
                practice: practiceStats,

                // Totals
                totals: {
                    legs_played: allStats.reduce((sum, s) => sum + (s.legs_played || 0), 0),
                    legs_won: totalLegsWon,
                    legs_lost: totalLegsLost,
                    matches_won: totalMatchWins,
                    matches_lost: totalMatchLosses,
                    win_rate: totalMatchWins + totalMatchLosses > 0
                        ? parseFloat(((totalMatchWins / (totalMatchWins + totalMatchLosses)) * 100).toFixed(1))
                        : 0,
                    max_180s: total180s,
                    ton_plus: totalTonPlus,
                    highest_checkout: highestCheckout,
                    highest_round: highestRound
                },

                calculated_at: new Date().toISOString()
            };

            // Save unified stats to player document
            await db.collection('players').doc(player_id).update({
                unified_stats: unifiedStats,
                unified_average: unifiedStats.unified_average,
                stats_updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                player_id,
                stats: unifiedStats
            });

        } catch (error) {
            console.error('Error calculating unified stats:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Helper functions to gather stats from each source
async function getLeagueStats(playerId) {
    const stats = {
        average: 0,
        total_score: 0,
        legs_played: 0,
        legs_won: 0,
        legs_lost: 0,
        matches_won: 0,
        matches_lost: 0,
        max_180s: 0,
        ton_plus: 0,
        highest_checkout: 0,
        highest_round: 0
    };

    // Get from player's existing stats
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (playerDoc.exists) {
        const player = playerDoc.data();
        if (player.stats) {
            stats.average = player.stats.career_average || player.average || 0;
            stats.legs_played = player.stats.total_legs || 0;
            stats.legs_won = player.stats.legs_won || 0;
            stats.legs_lost = player.stats.legs_lost || 0;
            stats.matches_won = player.stats.total_wins || 0;
            stats.matches_lost = player.stats.total_losses || 0;
            stats.max_180s = player.stats.max_180s || 0;
            stats.ton_plus = player.stats.ton_plus_rounds || 0;
            stats.highest_checkout = player.stats.highest_checkout || 0;
            stats.highest_round = player.stats.highest_round || 0;
            stats.total_score = stats.average * stats.legs_played;
        }
    }

    return stats;
}

async function getTournamentStats(playerId) {
    const stats = {
        average: 0,
        total_score: 0,
        legs_played: 0,
        legs_won: 0,
        legs_lost: 0,
        matches_won: 0,
        matches_lost: 0,
        max_180s: 0,
        ton_plus: 0,
        highest_checkout: 0,
        highest_round: 0,
        tournaments_won: 0,
        tournaments_played: 0
    };

    // Query tournament registrations
    const regsSnapshot = await db.collection('registrations')
        .where('player_id', '==', playerId)
        .get();

    stats.tournaments_played = regsSnapshot.size;

    // Aggregate tournament match stats
    // For now, use existing tournament stats from player doc
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (playerDoc.exists) {
        const player = playerDoc.data();
        if (player.tournament_stats) {
            Object.assign(stats, player.tournament_stats);
        }
    }

    return stats;
}

async function getOnlineStats(playerId) {
    const stats = {
        average: 0,
        total_score: 0,
        legs_played: 0,
        legs_won: 0,
        legs_lost: 0,
        matches_won: 0,
        matches_lost: 0,
        max_180s: 0,
        ton_plus: 0,
        highest_checkout: 0,
        highest_round: 0
    };

    // Query online matches
    const asPlayer1 = await db.collection('online_matches')
        .where('player1_id', '==', playerId)
        .where('status', '==', 'completed')
        .get();

    const asPlayer2 = await db.collection('online_matches')
        .where('player2_id', '==', playerId)
        .where('status', '==', 'completed')
        .get();

    const matches = [];
    asPlayer1.forEach(doc => matches.push({ ...doc.data(), was_player1: true }));
    asPlayer2.forEach(doc => matches.push({ ...doc.data(), was_player1: false }));

    matches.forEach(match => {
        const playerScore = match.was_player1 ? match.player1_score : match.player2_score;
        const opponentScore = match.was_player1 ? match.player2_score : match.player1_score;

        stats.legs_won += playerScore || 0;
        stats.legs_lost += opponentScore || 0;
        stats.legs_played += (playerScore || 0) + (opponentScore || 0);

        if (match.winner_id === playerId) {
            stats.matches_won++;
        } else if (match.winner_id) {
            stats.matches_lost++;
        }

        // Aggregate highlights
        if (match.stats) {
            const pStats = match.was_player1 ? match.stats.player1 : match.stats.player2;
            if (pStats) {
                stats.max_180s += pStats.max_180s || 0;
                stats.ton_plus += pStats.ton_plus || 0;
                if (pStats.highest_checkout > stats.highest_checkout) {
                    stats.highest_checkout = pStats.highest_checkout;
                }
                if (pStats.highest_round > stats.highest_round) {
                    stats.highest_round = pStats.highest_round;
                }
                if (pStats.average) {
                    stats.total_score += pStats.average * (pStats.legs || 1);
                }
            }
        }
    });

    stats.average = stats.legs_played > 0 ? stats.total_score / stats.legs_played : 0;

    return stats;
}

async function getMiniTournamentStats(playerId) {
    const stats = {
        average: 0,
        total_score: 0,
        legs_played: 0,
        legs_won: 0,
        legs_lost: 0,
        matches_won: 0,
        matches_lost: 0,
        max_180s: 0,
        ton_plus: 0,
        highest_checkout: 0,
        highest_round: 0,
        mini_tournaments_won: 0,
        mini_tournaments_played: 0
    };

    // Query mini tournament matches
    const matchesSnapshot = await db.collection('mini_tournament_matches')
        .where('players', 'array-contains', playerId)
        .get();

    const tournamentIds = new Set();

    matchesSnapshot.forEach(doc => {
        const match = doc.data();
        if (match.tournament_id) {
            tournamentIds.add(match.tournament_id);
        }

        if (match.status === 'completed') {
            const isPlayer1 = match.player1_id === playerId;
            const playerScore = isPlayer1 ? match.player1_score : match.player2_score;
            const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

            stats.legs_won += playerScore || 0;
            stats.legs_lost += opponentScore || 0;
            stats.legs_played += (playerScore || 0) + (opponentScore || 0);

            if (match.winner_id === playerId) {
                stats.matches_won++;
            } else if (match.winner_id) {
                stats.matches_lost++;
            }
        }
    });

    stats.mini_tournaments_played = tournamentIds.size;

    // Check for tournament wins
    for (const tid of tournamentIds) {
        const tDoc = await db.collection('mini_tournaments').doc(tid).get();
        if (tDoc.exists && tDoc.data().winner_id === playerId) {
            stats.mini_tournaments_won++;
        }
    }

    return stats;
}

async function getPracticeStats(playerId) {
    const stats = {
        average: 0,
        total_score: 0,
        legs_played: 0,
        legs_won: 0,
        legs_lost: 0,
        matches_won: 0,
        matches_lost: 0,
        max_180s: 0,
        ton_plus: 0,
        highest_checkout: 0,
        highest_round: 0,
        total_darts_thrown: 0,
        practice_sessions: 0
    };

    // Query practice sessions
    const sessionsSnapshot = await db.collection('practice_sessions')
        .where('player_id', '==', playerId)
        .orderBy('created_at', 'desc')
        .limit(100)
        .get();

    sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        stats.practice_sessions++;
        stats.legs_played += session.legs_completed || 0;
        stats.total_darts_thrown += session.darts_thrown || 0;

        if (session.average) {
            stats.total_score += session.average * (session.legs_completed || 1);
        }

        stats.max_180s += session.max_180s || 0;
        stats.ton_plus += session.ton_plus || 0;

        if (session.highest_checkout > stats.highest_checkout) {
            stats.highest_checkout = session.highest_checkout;
        }
        if (session.highest_round > stats.highest_round) {
            stats.highest_round = session.highest_round;
        }
    });

    stats.average = stats.legs_played > 0 ? stats.total_score / stats.legs_played : 0;

    return stats;
}

// ============================================
// GLOBAL LEADERBOARDS
// ============================================

/**
 * Get global leaderboard
 */
exports.getGlobalLeaderboard = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { category = 'average', limit = 50, min_legs = 10 } = req.query;

            let orderField;
            let orderDirection = 'desc';

            switch (category) {
                case 'average':
                    orderField = 'unified_average';
                    break;
                case 'wins':
                    orderField = 'unified_stats.totals.matches_won';
                    break;
                case 'win_rate':
                    orderField = 'unified_stats.totals.win_rate';
                    break;
                case '180s':
                    orderField = 'unified_stats.totals.max_180s';
                    break;
                case 'checkout':
                    orderField = 'unified_stats.totals.highest_checkout';
                    break;
                case 'legs_played':
                    orderField = 'unified_stats.totals.legs_played';
                    break;
                default:
                    orderField = 'unified_average';
            }

            // Query players with sufficient legs
            const snapshot = await db.collection('players')
                .where('unified_stats.totals.legs_played', '>=', parseInt(min_legs))
                .orderBy('unified_stats.totals.legs_played')
                .orderBy(orderField, orderDirection)
                .limit(parseInt(limit))
                .get();

            const leaderboard = [];
            let rank = 1;

            snapshot.forEach(doc => {
                const player = doc.data();
                leaderboard.push({
                    rank: rank++,
                    player_id: doc.id,
                    name: player.name,
                    unified_average: player.unified_average || 0,
                    stats: player.unified_stats?.totals || {},
                    league: player.unified_stats?.league?.average || 0,
                    online: player.unified_stats?.online?.average || 0
                });
            });

            // Re-sort by the actual category
            leaderboard.sort((a, b) => {
                let aVal, bVal;
                switch (category) {
                    case 'average':
                        aVal = a.unified_average;
                        bVal = b.unified_average;
                        break;
                    case 'wins':
                        aVal = a.stats.matches_won || 0;
                        bVal = b.stats.matches_won || 0;
                        break;
                    case 'win_rate':
                        aVal = a.stats.win_rate || 0;
                        bVal = b.stats.win_rate || 0;
                        break;
                    case '180s':
                        aVal = a.stats.max_180s || 0;
                        bVal = b.stats.max_180s || 0;
                        break;
                    case 'checkout':
                        aVal = a.stats.highest_checkout || 0;
                        bVal = b.stats.highest_checkout || 0;
                        break;
                    default:
                        aVal = a.unified_average;
                        bVal = b.unified_average;
                }
                return bVal - aVal;
            });

            // Re-assign ranks after sort
            leaderboard.forEach((entry, idx) => {
                entry.rank = idx + 1;
            });

            res.json({
                category,
                min_legs: parseInt(min_legs),
                leaderboard
            });

        } catch (error) {
            console.error('Error getting global leaderboard:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get player's rank in various categories
 */
exports.getPlayerRankings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id } = req.query;

            if (!player_id) {
                return res.status(400).json({ error: 'player_id required' });
            }

            const playerDoc = await db.collection('players').doc(player_id).get();

            if (!playerDoc.exists) {
                return res.status(404).json({ error: 'Player not found' });
            }

            const player = playerDoc.data();
            const rankings = {};

            // Get ranking for each category
            const categories = ['average', 'wins', 'win_rate', '180s', 'checkout'];

            for (const category of categories) {
                let field;
                switch (category) {
                    case 'average':
                        field = 'unified_average';
                        break;
                    case 'wins':
                        field = 'unified_stats.totals.matches_won';
                        break;
                    case 'win_rate':
                        field = 'unified_stats.totals.win_rate';
                        break;
                    case '180s':
                        field = 'unified_stats.totals.max_180s';
                        break;
                    case 'checkout':
                        field = 'unified_stats.totals.highest_checkout';
                        break;
                }

                // Count players ranked higher
                const playerValue = getNestedValue(player, field) || 0;

                const higherCount = await db.collection('players')
                    .where(field, '>', playerValue)
                    .count()
                    .get();

                rankings[category] = {
                    rank: higherCount.data().count + 1,
                    value: playerValue
                };
            }

            res.json({
                player_id,
                name: player.name,
                rankings
            });

        } catch (error) {
            console.error('Error getting player rankings:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Helper to get nested object value
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

// ============================================
// SEASON RANKINGS
// ============================================

/**
 * Create or update season snapshot
 */
exports.createSeasonSnapshot = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { season_id, season_name, start_date, end_date, admin_id } = req.body;

            // Verify admin
            const MASTER_ADMIN_ID = 'X2DMb9bP4Q8fy9yr5Fam';
            if (admin_id !== MASTER_ADMIN_ID) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            // Get all players with unified stats
            const playersSnapshot = await db.collection('players')
                .where('unified_stats.totals.legs_played', '>', 0)
                .get();

            const playerStats = [];
            playersSnapshot.forEach(doc => {
                const player = doc.data();
                playerStats.push({
                    player_id: doc.id,
                    name: player.name,
                    unified_average: player.unified_average || 0,
                    stats: player.unified_stats?.totals || {},
                    league_average: player.unified_stats?.league?.average || 0,
                    online_average: player.unified_stats?.online?.average || 0
                });
            });

            // Sort by unified average
            playerStats.sort((a, b) => b.unified_average - a.unified_average);

            // Assign ranks
            playerStats.forEach((p, idx) => {
                p.rank = idx + 1;
            });

            const seasonDoc = {
                season_id: season_id || `season_${Date.now()}`,
                season_name: season_name || `Season ${new Date().getFullYear()}`,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : new Date(),
                created_at: admin.firestore.FieldValue.serverTimestamp(),

                player_count: playerStats.length,
                top_10: playerStats.slice(0, 10),
                all_rankings: playerStats
            };

            await db.collection('season_rankings').doc(seasonDoc.season_id).set(seasonDoc);

            res.json({
                success: true,
                season_id: seasonDoc.season_id,
                player_count: playerStats.length,
                top_10: seasonDoc.top_10
            });

        } catch (error) {
            console.error('Error creating season snapshot:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get season rankings
 */
exports.getSeasonRankings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { season_id, limit = 50 } = req.query;

            if (!season_id) {
                // Get most recent season
                const recentSnapshot = await db.collection('season_rankings')
                    .orderBy('created_at', 'desc')
                    .limit(1)
                    .get();

                if (recentSnapshot.empty) {
                    return res.json({ seasons: [], message: 'No season data available' });
                }

                const season = recentSnapshot.docs[0].data();
                return res.json({
                    season_id: season.season_id,
                    season_name: season.season_name,
                    rankings: season.all_rankings.slice(0, parseInt(limit)),
                    total_players: season.player_count
                });
            }

            const seasonDoc = await db.collection('season_rankings').doc(season_id).get();

            if (!seasonDoc.exists) {
                return res.status(404).json({ error: 'Season not found' });
            }

            const season = seasonDoc.data();

            res.json({
                season_id: season.season_id,
                season_name: season.season_name,
                start_date: season.start_date,
                end_date: season.end_date,
                rankings: season.all_rankings.slice(0, parseInt(limit)),
                total_players: season.player_count
            });

        } catch (error) {
            console.error('Error getting season rankings:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get all seasons list
 */
exports.getAllSeasons = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const snapshot = await db.collection('season_rankings')
                .orderBy('created_at', 'desc')
                .get();

            const seasons = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                seasons.push({
                    season_id: data.season_id,
                    season_name: data.season_name,
                    start_date: data.start_date,
                    end_date: data.end_date,
                    player_count: data.player_count,
                    top_player: data.top_10?.[0] || null
                });
            });

            res.json({ seasons });

        } catch (error) {
            console.error('Error getting seasons:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// PRACTICE MODE
// ============================================

/**
 * Start a practice session
 */
exports.startPracticeSession = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, game_type, target_score, practice_type } = req.body;

            if (!player_id) {
                return res.status(400).json({ error: 'player_id required' });
            }

            const sessionDoc = {
                player_id,
                game_type: game_type || '501',
                target_score: target_score || 501,
                practice_type: practice_type || 'free_play', // 'free_play', 'checkout_drill', 'average_target'

                status: 'in_progress',
                started_at: admin.firestore.FieldValue.serverTimestamp(),
                ended_at: null,

                legs_completed: 0,
                darts_thrown: 0,
                total_score: 0,
                throws: [],

                max_180s: 0,
                ton_plus: 0,
                highest_checkout: 0,
                highest_round: 0,
                average: 0
            };

            const docRef = await db.collection('practice_sessions').add(sessionDoc);

            res.json({
                success: true,
                session_id: docRef.id,
                session: sessionDoc
            });

        } catch (error) {
            console.error('Error starting practice session:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Record a practice throw
 */
exports.recordPracticeThrow = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { session_id, score, darts, is_checkout, remaining } = req.body;

            if (!session_id || score === undefined) {
                return res.status(400).json({ error: 'session_id and score required' });
            }

            const sessionRef = db.collection('practice_sessions').doc(session_id);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const session = sessionDoc.data();

            const throwData = {
                score,
                darts: darts || 3,
                is_checkout: is_checkout || false,
                remaining: remaining || 0,
                timestamp: new Date().toISOString()
            };

            const updates = {
                throws: admin.firestore.FieldValue.arrayUnion(throwData),
                darts_thrown: admin.firestore.FieldValue.increment(darts || 3),
                total_score: admin.firestore.FieldValue.increment(score)
            };

            // Track highlights
            if (score >= 180) {
                updates.max_180s = admin.firestore.FieldValue.increment(1);
            }
            if (score >= 100) {
                updates.ton_plus = admin.firestore.FieldValue.increment(1);
            }
            if (score > (session.highest_round || 0)) {
                updates.highest_round = score;
            }
            if (is_checkout && score > (session.highest_checkout || 0)) {
                updates.highest_checkout = score;
            }

            // Check if leg completed
            if (remaining === 0 || is_checkout) {
                updates.legs_completed = admin.firestore.FieldValue.increment(1);
            }

            await sessionRef.update(updates);

            res.json({
                success: true,
                throw: throwData
            });

        } catch (error) {
            console.error('Error recording practice throw:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * End a practice session
 */
exports.endPracticeSession = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { session_id } = req.body;

            if (!session_id) {
                return res.status(400).json({ error: 'session_id required' });
            }

            const sessionRef = db.collection('practice_sessions').doc(session_id);
            const sessionDoc = await sessionRef.get();

            if (!sessionDoc.exists) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const session = sessionDoc.data();

            // Calculate final average
            const dartsThrown = session.darts_thrown || 0;
            const totalScore = session.total_score || 0;
            const average = dartsThrown > 0 ? (totalScore / dartsThrown) * 3 : 0;

            await sessionRef.update({
                status: 'completed',
                ended_at: admin.firestore.FieldValue.serverTimestamp(),
                average: parseFloat(average.toFixed(2))
            });

            // Update player's practice stats
            await db.collection('players').doc(session.player_id).update({
                'practice_stats.total_sessions': admin.firestore.FieldValue.increment(1),
                'practice_stats.total_darts': admin.firestore.FieldValue.increment(dartsThrown),
                'practice_stats.last_session': admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                session: {
                    ...session,
                    status: 'completed',
                    average: parseFloat(average.toFixed(2))
                }
            });

        } catch (error) {
            console.error('Error ending practice session:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get player's practice history
 */
exports.getPracticeHistory = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, limit = 20 } = req.query;

            if (!player_id) {
                return res.status(400).json({ error: 'player_id required' });
            }

            const snapshot = await db.collection('practice_sessions')
                .where('player_id', '==', player_id)
                .where('status', '==', 'completed')
                .orderBy('ended_at', 'desc')
                .limit(parseInt(limit))
                .get();

            const sessions = [];
            snapshot.forEach(doc => {
                sessions.push({ id: doc.id, ...doc.data() });
            });

            // Calculate practice trends
            const recentAverages = sessions.slice(0, 5).map(s => s.average || 0);
            const olderAverages = sessions.slice(5, 10).map(s => s.average || 0);

            const recentAvg = recentAverages.length > 0
                ? recentAverages.reduce((a, b) => a + b, 0) / recentAverages.length
                : 0;
            const olderAvg = olderAverages.length > 0
                ? olderAverages.reduce((a, b) => a + b, 0) / olderAverages.length
                : 0;

            const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) : 0;

            res.json({
                sessions,
                summary: {
                    total_sessions: sessions.length,
                    recent_average: parseFloat(recentAvg.toFixed(2)),
                    trend: parseFloat(trend),
                    trend_direction: parseFloat(trend) > 0 ? 'improving' : parseFloat(trend) < 0 ? 'declining' : 'stable'
                }
            });

        } catch (error) {
            console.error('Error getting practice history:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// SCHEDULED STATS UPDATE
// ============================================

/**
 * Recalculate all player unified stats (weekly)
 * DISABLED - v2 scheduler not compatible with v4
 */
// exports.weeklyStatsRecalculation = onSchedule('0 4 * * 0', async (event) => {
//         try {
//             console.log('Starting weekly stats recalculation...');
//
//             const playersSnapshot = await db.collection('players').get();
//             let processed = 0;
//
//             const batch = db.batch();
//
//             for (const doc of playersSnapshot.docs) {
//                 const playerId = doc.id;
//
//                 try {
//                     const [
//                         leagueStats,
//                         tournamentStats,
//                         onlineStats,
//                         miniTournamentStats,
//                         practiceStats
//                     ] = await Promise.all([
//                         getLeagueStats(playerId),
//                         getTournamentStats(playerId),
//                         getOnlineStats(playerId),
//                         getMiniTournamentStats(playerId),
//                         getPracticeStats(playerId)
//                     ]);
//
//                     // Calculate unified average
//                     const allStats = [
//                         { ...leagueStats, weight: 1.0 },
//                         { ...tournamentStats, weight: 1.0 },
//                         { ...onlineStats, weight: 0.9 },
//                         { ...miniTournamentStats, weight: 0.8 },
//                         { ...practiceStats, weight: 0.3 }
//                     ];
//
//                     let totalWeightedScore = 0;
//                     let totalWeightedLegs = 0;
//
//                     allStats.forEach(stat => {
//                         if (stat.legs_played > 0) {
//                             totalWeightedScore += stat.total_score * stat.weight;
//                             totalWeightedLegs += stat.legs_played * stat.weight;
//                         }
//                     });
//
//                     const unifiedAverage = totalWeightedLegs > 0
//                         ? totalWeightedScore / totalWeightedLegs
//                         : 0;
//
//                     batch.update(doc.ref, {
//                         unified_average: parseFloat(unifiedAverage.toFixed(2)),
//                         'unified_stats.league': leagueStats,
//                         'unified_stats.tournament': tournamentStats,
//                         'unified_stats.online': onlineStats,
//                         'unified_stats.mini_tournament': miniTournamentStats,
//                         'unified_stats.practice': practiceStats,
//                         'unified_stats.totals.legs_played': allStats.reduce((sum, s) => sum + (s.legs_played || 0), 0),
//                         'unified_stats.totals.matches_won': allStats.reduce((sum, s) => sum + (s.matches_won || 0), 0),
//                         'unified_stats.totals.matches_lost': allStats.reduce((sum, s) => sum + (s.matches_lost || 0), 0),
//                         stats_updated_at: admin.firestore.FieldValue.serverTimestamp()
//                     });
//
//                     processed++;
//
//                     // Commit in batches of 400
//                     if (processed % 400 === 0) {
//                         await batch.commit();
//                     }
//                 } catch (err) {
//                     console.error(`Error processing player ${playerId}:`, err);
//                 }
//             }
//
//             // Final commit
//             await batch.commit();
//
//             console.log(`Weekly stats recalculation complete. Processed ${processed} players.`);
//
//         } catch (error) {
//             console.error('Error in weekly stats recalculation:', error);
//         }
//     });
