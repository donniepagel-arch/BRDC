/**
 * BRDC Phase 6: Advanced Features
 * - Spectate Mode: Watch live matches
 * - Match Replay: Re-watch completed matches
 * - Handicap System: Level the playing field
 * - Challenge Board: Public challenges
 * - Bounty Board: High-stakes challenges
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// SPECTATE MODE
// ============================================

/**
 * Start spectating a live match
 */
exports.startSpectating = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, match_id, match_type } = req.body;

            if (!player_id || !match_id) {
                return res.status(400).json({ error: 'player_id and match_id required' });
            }

            // Get the match based on type
            const collection = match_type === 'online' ? 'online_matches' :
                              match_type === 'mini' ? 'mini_tournament_matches' : 'matches';

            const matchDoc = await db.collection(collection).doc(match_id).get();

            if (!matchDoc.exists) {
                return res.status(404).json({ error: 'Match not found' });
            }

            const matchData = matchDoc.data();

            // Check if match is live
            if (matchData.status !== 'in_progress') {
                return res.status(400).json({ error: 'Match is not live' });
            }

            // Check if spectating is allowed
            if (matchData.spectators_allowed === false) {
                return res.status(403).json({ error: 'Spectating not allowed for this match' });
            }

            // Add spectator to match
            await db.collection(collection).doc(match_id).update({
                spectators: admin.firestore.FieldValue.arrayUnion(player_id),
                spectator_count: admin.firestore.FieldValue.increment(1)
            });

            // Log spectate event
            await db.collection('spectate_logs').add({
                match_id,
                match_type: match_type || 'league',
                spectator_id: player_id,
                action: 'started',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                match: {
                    id: match_id,
                    ...matchData,
                    spectator_count: (matchData.spectator_count || 0) + 1
                }
            });

        } catch (error) {
            console.error('Error starting spectate:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Stop spectating a match
 */
exports.stopSpectating = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, match_id, match_type } = req.body;

            if (!player_id || !match_id) {
                return res.status(400).json({ error: 'player_id and match_id required' });
            }

            const collection = match_type === 'online' ? 'online_matches' :
                              match_type === 'mini' ? 'mini_tournament_matches' : 'matches';

            await db.collection(collection).doc(match_id).update({
                spectators: admin.firestore.FieldValue.arrayRemove(player_id),
                spectator_count: admin.firestore.FieldValue.increment(-1)
            });

            // Log spectate event
            await db.collection('spectate_logs').add({
                match_id,
                match_type: match_type || 'league',
                spectator_id: player_id,
                action: 'stopped',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error stopping spectate:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get live matches available to spectate
 */
exports.getLiveMatches = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id } = req.query;

            const liveMatches = [];

            // Get live league matches
            const leagueMatches = await db.collection('matches')
                .where('status', '==', 'in_progress')
                .where('spectators_allowed', '!=', false)
                .limit(20)
                .get();

            leagueMatches.forEach(doc => {
                liveMatches.push({
                    id: doc.id,
                    type: 'league',
                    ...doc.data()
                });
            });

            // Get live online matches
            const onlineMatches = await db.collection('online_matches')
                .where('status', '==', 'in_progress')
                .where('spectators_allowed', '!=', false)
                .limit(20)
                .get();

            onlineMatches.forEach(doc => {
                liveMatches.push({
                    id: doc.id,
                    type: 'online',
                    ...doc.data()
                });
            });

            // Get live mini tournament matches
            const miniMatches = await db.collection('mini_tournament_matches')
                .where('status', '==', 'in_progress')
                .limit(20)
                .get();

            miniMatches.forEach(doc => {
                liveMatches.push({
                    id: doc.id,
                    type: 'mini',
                    ...doc.data()
                });
            });

            // Sort by spectator count (most popular first)
            liveMatches.sort((a, b) => (b.spectator_count || 0) - (a.spectator_count || 0));

            res.json({
                live_matches: liveMatches,
                total: liveMatches.length
            });

        } catch (error) {
            console.error('Error getting live matches:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// MATCH REPLAY
// ============================================

/**
 * Save match for replay (call at match end)
 */
exports.saveMatchReplay = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { match_id, match_type, match_data, legs_data } = req.body;

            if (!match_id || !match_data) {
                return res.status(400).json({ error: 'match_id and match_data required' });
            }

            // Create replay document
            const replayDoc = {
                match_id,
                match_type: match_type || 'league',
                match_data,
                legs_data: legs_data || [],
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                view_count: 0,
                featured: false,

                // For search
                player1_id: match_data.player1_id,
                player2_id: match_data.player2_id,
                player1_name: match_data.player1_name,
                player2_name: match_data.player2_name,
                winner_id: match_data.winner_id,

                // Stats highlights
                highlights: extractHighlights(match_data, legs_data)
            };

            await db.collection('match_replays').doc(match_id).set(replayDoc);

            res.json({
                success: true,
                replay_id: match_id
            });

        } catch (error) {
            console.error('Error saving replay:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get match replay
 */
exports.getMatchReplay = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { replay_id } = req.query;

            if (!replay_id) {
                return res.status(400).json({ error: 'replay_id required' });
            }

            const replayDoc = await db.collection('match_replays').doc(replay_id).get();

            if (!replayDoc.exists) {
                return res.status(404).json({ error: 'Replay not found' });
            }

            // Increment view count
            await db.collection('match_replays').doc(replay_id).update({
                view_count: admin.firestore.FieldValue.increment(1)
            });

            const data = replayDoc.data();

            res.json({
                replay: {
                    id: replayDoc.id,
                    ...data,
                    view_count: (data.view_count || 0) + 1
                }
            });

        } catch (error) {
            console.error('Error getting replay:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get featured/popular replays
 */
exports.getFeaturedReplays = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { limit = 10 } = req.query;

            // Get featured replays
            const featuredSnapshot = await db.collection('match_replays')
                .where('featured', '==', true)
                .orderBy('created_at', 'desc')
                .limit(parseInt(limit))
                .get();

            const featured = [];
            featuredSnapshot.forEach(doc => {
                featured.push({ id: doc.id, ...doc.data() });
            });

            // Get most viewed replays
            const popularSnapshot = await db.collection('match_replays')
                .orderBy('view_count', 'desc')
                .limit(parseInt(limit))
                .get();

            const popular = [];
            popularSnapshot.forEach(doc => {
                popular.push({ id: doc.id, ...doc.data() });
            });

            res.json({
                featured,
                popular
            });

        } catch (error) {
            console.error('Error getting featured replays:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get player's match replays
 */
exports.getPlayerReplays = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, limit = 20, offset = 0 } = req.query;

            if (!player_id) {
                return res.status(400).json({ error: 'player_id required' });
            }

            // Get replays where player participated
            const asPlayer1 = await db.collection('match_replays')
                .where('player1_id', '==', player_id)
                .orderBy('created_at', 'desc')
                .limit(50)
                .get();

            const asPlayer2 = await db.collection('match_replays')
                .where('player2_id', '==', player_id)
                .orderBy('created_at', 'desc')
                .limit(50)
                .get();

            const replays = [];
            asPlayer1.forEach(doc => replays.push({ id: doc.id, ...doc.data() }));
            asPlayer2.forEach(doc => replays.push({ id: doc.id, ...doc.data() }));

            // Sort by date and paginate
            replays.sort((a, b) => {
                const dateA = a.created_at?.toDate?.() || new Date(0);
                const dateB = b.created_at?.toDate?.() || new Date(0);
                return dateB - dateA;
            });

            const paginated = replays.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

            res.json({
                replays: paginated,
                total: replays.length
            });

        } catch (error) {
            console.error('Error getting player replays:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Helper to extract highlights from match
function extractHighlights(matchData, legsData) {
    const highlights = {
        highest_checkout: 0,
        highest_round: 0,
        ton_plus_count: 0,
        ton_80_count: 0,
        max_180s: 0
    };

    if (legsData && Array.isArray(legsData)) {
        legsData.forEach(leg => {
            if (leg.throws) {
                leg.throws.forEach(t => {
                    const score = t.score || 0;
                    if (score > highlights.highest_round) {
                        highlights.highest_round = score;
                    }
                    if (score >= 100) highlights.ton_plus_count++;
                    if (score >= 180) {
                        highlights.max_180s++;
                        highlights.ton_80_count++;
                    }
                    if (t.checkout && t.checkout > highlights.highest_checkout) {
                        highlights.highest_checkout = t.checkout;
                    }
                });
            }
        });
    }

    return highlights;
}

// ============================================
// HANDICAP SYSTEM
// ============================================

/**
 * Calculate handicap for a player
 */
exports.calculateHandicap = functions.https.onRequest((req, res) => {
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
            const avg = player.stats?.career_average || player.average || 40;

            // Handicap formula: Higher average = lower handicap (fewer points)
            // Based on 501 starting score
            // A player with 60 avg gets 0 handicap
            // Each point below 60 avg adds 3 points handicap
            // Each point above 60 avg subtracts 2 points handicap (capped at -30)

            let handicap = 0;
            const baseline = 60;

            if (avg < baseline) {
                handicap = Math.round((baseline - avg) * 3);
            } else {
                handicap = Math.max(-30, Math.round((baseline - avg) * 2));
            }

            // Cap handicap at 90 points
            handicap = Math.min(90, handicap);

            // Update player's handicap
            await db.collection('players').doc(player_id).update({
                handicap: handicap,
                handicap_calculated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                player_id,
                average: avg,
                handicap,
                adjusted_start: 501 - handicap,
                description: handicap > 0
                    ? `Starts at ${501 - handicap} instead of 501`
                    : handicap < 0
                        ? `Opponent gets ${Math.abs(handicap)} point head start`
                        : 'No handicap applied'
            });

        } catch (error) {
            console.error('Error calculating handicap:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get handicap settings for a match between two players
 */
exports.getMatchHandicap = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player1_id, player2_id } = req.query;

            if (!player1_id || !player2_id) {
                return res.status(400).json({ error: 'player1_id and player2_id required' });
            }

            const [player1Doc, player2Doc] = await Promise.all([
                db.collection('players').doc(player1_id).get(),
                db.collection('players').doc(player2_id).get()
            ]);

            if (!player1Doc.exists || !player2Doc.exists) {
                return res.status(404).json({ error: 'One or both players not found' });
            }

            const p1 = player1Doc.data();
            const p2 = player2Doc.data();

            const p1Avg = p1.stats?.career_average || p1.average || 40;
            const p2Avg = p2.stats?.career_average || p2.average || 40;

            const avgDiff = Math.abs(p1Avg - p2Avg);

            // Calculate relative handicap (weaker player gets points)
            let p1Start = 501;
            let p2Start = 501;

            if (avgDiff > 5) { // Only apply if significant difference
                const handicapPoints = Math.min(60, Math.round(avgDiff * 2.5));

                if (p1Avg > p2Avg) {
                    p2Start = 501 - handicapPoints; // Player 2 is weaker, starts lower
                } else {
                    p1Start = 501 - handicapPoints; // Player 1 is weaker, starts lower
                }
            }

            res.json({
                player1: {
                    id: player1_id,
                    name: p1.name,
                    average: p1Avg,
                    start_score: p1Start
                },
                player2: {
                    id: player2_id,
                    name: p2.name,
                    average: p2Avg,
                    start_score: p2Start
                },
                handicap_applied: p1Start !== 501 || p2Start !== 501,
                average_difference: avgDiff.toFixed(1)
            });

        } catch (error) {
            console.error('Error getting match handicap:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// CHALLENGE BOARD
// ============================================

/**
 * Post a public challenge to the board
 */
exports.postPublicChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, challenge_type, game_type, legs_to_win, message, stakes } = req.body;

            if (!player_id || !challenge_type) {
                return res.status(400).json({ error: 'player_id and challenge_type required' });
            }

            const playerDoc = await db.collection('players').doc(player_id).get();

            if (!playerDoc.exists) {
                return res.status(404).json({ error: 'Player not found' });
            }

            const player = playerDoc.data();

            const challengeDoc = {
                challenger_id: player_id,
                challenger_name: player.name,
                challenger_average: player.stats?.career_average || player.average || 0,

                challenge_type, // 'open', 'skill_level', 'revenge', 'friendly'
                game_type: game_type || '501',
                legs_to_win: legs_to_win || 3,
                message: message || '',
                stakes: stakes || null, // For bounty board integration

                status: 'open',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours

                acceptor_id: null,
                acceptor_name: null
            };

            const docRef = await db.collection('challenge_board').add(challengeDoc);

            res.json({
                success: true,
                challenge_id: docRef.id,
                challenge: challengeDoc
            });

        } catch (error) {
            console.error('Error posting challenge:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get open challenges from the board
 */
exports.getChallengeBoard = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, challenge_type, limit = 20 } = req.query;

            let query = db.collection('challenge_board')
                .where('status', '==', 'open')
                .where('expires_at', '>', new Date())
                .orderBy('expires_at', 'asc')
                .orderBy('created_at', 'desc')
                .limit(parseInt(limit));

            if (challenge_type) {
                query = db.collection('challenge_board')
                    .where('status', '==', 'open')
                    .where('challenge_type', '==', challenge_type)
                    .where('expires_at', '>', new Date())
                    .limit(parseInt(limit));
            }

            const snapshot = await query.get();

            const challenges = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Don't show player's own challenges
                if (!player_id || data.challenger_id !== player_id) {
                    challenges.push({ id: doc.id, ...data });
                }
            });

            res.json({
                challenges,
                total: challenges.length
            });

        } catch (error) {
            console.error('Error getting challenge board:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Accept a challenge from the board
 */
exports.acceptBoardChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, challenge_id } = req.body;

            if (!player_id || !challenge_id) {
                return res.status(400).json({ error: 'player_id and challenge_id required' });
            }

            const challengeRef = db.collection('challenge_board').doc(challenge_id);
            const challengeDoc = await challengeRef.get();

            if (!challengeDoc.exists) {
                return res.status(404).json({ error: 'Challenge not found' });
            }

            const challenge = challengeDoc.data();

            if (challenge.status !== 'open') {
                return res.status(400).json({ error: 'Challenge is no longer available' });
            }

            if (challenge.challenger_id === player_id) {
                return res.status(400).json({ error: 'Cannot accept your own challenge' });
            }

            // Get acceptor info
            const acceptorDoc = await db.collection('players').doc(player_id).get();
            const acceptor = acceptorDoc.data();

            // Update challenge
            await challengeRef.update({
                status: 'accepted',
                acceptor_id: player_id,
                acceptor_name: acceptor.name,
                accepted_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Create the match
            const matchDoc = {
                player1_id: challenge.challenger_id,
                player1_name: challenge.challenger_name,
                player2_id: player_id,
                player2_name: acceptor.name,

                game_type: challenge.game_type,
                legs_to_win: challenge.legs_to_win,

                source: 'challenge_board',
                challenge_id: challenge_id,
                stakes: challenge.stakes,

                status: 'scheduled',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const matchRef = await db.collection('online_matches').add(matchDoc);

            res.json({
                success: true,
                match_id: matchRef.id,
                match: matchDoc
            });

        } catch (error) {
            console.error('Error accepting challenge:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// BOUNTY BOARD
// ============================================

/**
 * Post a bounty (challenge with stakes/rewards)
 */
exports.postBounty = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_id,
                target_id,  // Optional: specific player target
                bounty_type,
                reward_description,
                game_type,
                legs_to_win,
                message
            } = req.body;

            if (!player_id || !bounty_type || !reward_description) {
                return res.status(400).json({
                    error: 'player_id, bounty_type, and reward_description required'
                });
            }

            const playerDoc = await db.collection('players').doc(player_id).get();
            const player = playerDoc.data();

            let targetInfo = null;
            if (target_id) {
                const targetDoc = await db.collection('players').doc(target_id).get();
                if (targetDoc.exists) {
                    const target = targetDoc.data();
                    targetInfo = {
                        id: target_id,
                        name: target.name,
                        average: target.stats?.career_average || target.average || 0
                    };
                }
            }

            const bountyDoc = {
                poster_id: player_id,
                poster_name: player.name,
                poster_average: player.stats?.career_average || player.average || 0,

                target: targetInfo, // Null if open bounty
                bounty_type, // 'beat_me', 'beat_target', 'skill_challenge', 'high_score'
                reward_description,

                game_type: game_type || '501',
                legs_to_win: legs_to_win || 3,
                message: message || '',

                status: 'active',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days

                claimant_id: null,
                claimed_at: null
            };

            const docRef = await db.collection('bounty_board').add(bountyDoc);

            // Notify target if specific
            if (target_id) {
                await db.collection('notifications').add({
                    recipient_id: target_id,
                    type: 'bounty_posted',
                    title: 'Bounty on Your Head!',
                    message: `${player.name} has posted a bounty: ${reward_description}`,
                    bounty_id: docRef.id,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }

            res.json({
                success: true,
                bounty_id: docRef.id,
                bounty: bountyDoc
            });

        } catch (error) {
            console.error('Error posting bounty:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get active bounties
 */
exports.getBountyBoard = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, bounty_type, limit = 20 } = req.query;

            let query = db.collection('bounty_board')
                .where('status', '==', 'active')
                .where('expires_at', '>', new Date())
                .orderBy('expires_at', 'asc')
                .limit(parseInt(limit));

            const snapshot = await query.get();

            const bounties = [];
            snapshot.forEach(doc => {
                const data = doc.data();

                // Filter by type if specified
                if (bounty_type && data.bounty_type !== bounty_type) return;

                bounties.push({ id: doc.id, ...data });
            });

            // Separate bounties targeting the current player
            const targetingYou = bounties.filter(b => b.target?.id === player_id);
            const openBounties = bounties.filter(b => !b.target && b.poster_id !== player_id);
            const otherBounties = bounties.filter(b => b.target && b.target.id !== player_id && b.poster_id !== player_id);

            res.json({
                targeting_you: targetingYou,
                open_bounties: openBounties,
                other_bounties: otherBounties,
                total: bounties.length
            });

        } catch (error) {
            console.error('Error getting bounty board:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Claim a bounty (start the match)
 */
exports.claimBounty = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, bounty_id } = req.body;

            if (!player_id || !bounty_id) {
                return res.status(400).json({ error: 'player_id and bounty_id required' });
            }

            const bountyRef = db.collection('bounty_board').doc(bounty_id);
            const bountyDoc = await bountyRef.get();

            if (!bountyDoc.exists) {
                return res.status(404).json({ error: 'Bounty not found' });
            }

            const bounty = bountyDoc.data();

            if (bounty.status !== 'active') {
                return res.status(400).json({ error: 'Bounty is no longer active' });
            }

            if (bounty.poster_id === player_id) {
                return res.status(400).json({ error: 'Cannot claim your own bounty' });
            }

            // Check if bounty has a specific target
            if (bounty.target && bounty.target.id !== player_id) {
                return res.status(400).json({ error: 'This bounty is for a specific player' });
            }

            // Get claimant info
            const claimantDoc = await db.collection('players').doc(player_id).get();
            const claimant = claimantDoc.data();

            // Update bounty
            await bountyRef.update({
                status: 'claimed',
                claimant_id: player_id,
                claimant_name: claimant.name,
                claimed_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Create the match
            const matchDoc = {
                player1_id: bounty.poster_id,
                player1_name: bounty.poster_name,
                player2_id: player_id,
                player2_name: claimant.name,

                game_type: bounty.game_type,
                legs_to_win: bounty.legs_to_win,

                source: 'bounty_board',
                bounty_id: bounty_id,
                reward_description: bounty.reward_description,

                status: 'scheduled',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const matchRef = await db.collection('online_matches').add(matchDoc);

            // Notify the poster
            await db.collection('notifications').add({
                recipient_id: bounty.poster_id,
                type: 'bounty_claimed',
                title: 'Bounty Claimed!',
                message: `${claimant.name} has accepted your bounty challenge!`,
                bounty_id: bounty_id,
                match_id: matchRef.id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            res.json({
                success: true,
                match_id: matchRef.id,
                match: matchDoc
            });

        } catch (error) {
            console.error('Error claiming bounty:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Complete a bounty (after match ends)
 */
exports.completeBounty = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { bounty_id, winner_id, match_id } = req.body;

            if (!bounty_id || !winner_id) {
                return res.status(400).json({ error: 'bounty_id and winner_id required' });
            }

            const bountyRef = db.collection('bounty_board').doc(bounty_id);
            const bountyDoc = await bountyRef.get();

            if (!bountyDoc.exists) {
                return res.status(404).json({ error: 'Bounty not found' });
            }

            const bounty = bountyDoc.data();

            const claimantWon = winner_id === bounty.claimant_id;

            await bountyRef.update({
                status: 'completed',
                winner_id,
                winner_name: claimantWon ? bounty.claimant_name : bounty.poster_name,
                bounty_collected: claimantWon,
                completed_at: admin.firestore.FieldValue.serverTimestamp(),
                match_id
            });

            // Notify both parties
            const winnerNotification = {
                recipient_id: winner_id,
                type: 'bounty_completed',
                title: claimantWon ? 'Bounty Collected!' : 'Bounty Defended!',
                message: claimantWon
                    ? `You won the bounty: ${bounty.reward_description}`
                    : `You successfully defended against ${bounty.claimant_name}!`,
                bounty_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            };

            const loserId = claimantWon ? bounty.poster_id : bounty.claimant_id;
            const loserNotification = {
                recipient_id: loserId,
                type: 'bounty_completed',
                title: claimantWon ? 'Bounty Lost' : 'Bounty Failed',
                message: claimantWon
                    ? `${bounty.claimant_name} collected your bounty`
                    : `You couldn't collect the bounty from ${bounty.poster_name}`,
                bounty_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            };

            await Promise.all([
                db.collection('notifications').add(winnerNotification),
                db.collection('notifications').add(loserNotification)
            ]);

            res.json({
                success: true,
                bounty_collected: claimantWon,
                winner_id,
                winner_name: claimantWon ? bounty.claimant_name : bounty.poster_name
            });

        } catch (error) {
            console.error('Error completing bounty:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// ============================================
// SCHEDULED CLEANUP
// ============================================

/**
 * Clean up expired challenges and bounties (runs daily)
 */
exports.cleanupExpiredChallenges = onSchedule('0 3 * * *', async (event) => {
        try {
            const now = new Date();

            // Expire challenge board entries
            const expiredChallenges = await db.collection('challenge_board')
                .where('status', '==', 'open')
                .where('expires_at', '<', now)
                .get();

            const challengeBatch = db.batch();
            expiredChallenges.forEach(doc => {
                challengeBatch.update(doc.ref, { status: 'expired' });
            });
            await challengeBatch.commit();

            // Expire bounties
            const expiredBounties = await db.collection('bounty_board')
                .where('status', '==', 'active')
                .where('expires_at', '<', now)
                .get();

            const bountyBatch = db.batch();
            expiredBounties.forEach(doc => {
                bountyBatch.update(doc.ref, { status: 'expired' });
            });
            await bountyBatch.commit();

            console.log(`Expired ${expiredChallenges.size} challenges and ${expiredBounties.size} bounties`);

        } catch (error) {
            console.error('Error cleaning up expired challenges:', error);
        }
    });
