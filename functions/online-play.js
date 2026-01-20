/**
 * BRDC Online Play - Phase 4
 * Challenge system, match scheduling, rematch, online stats
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const db = admin.firestore();

// Helper: Verify player PIN
async function verifyPlayer(pin) {
    if (!pin) return null;
    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;
    return { id: playersSnapshot.docs[0].id, ...playersSnapshot.docs[0].data() };
}

// ===========================================
// CHALLENGES
// ===========================================

/**
 * Send a challenge to another player
 */
exports.sendChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, opponent_id, game_type, game_settings, message, scheduled_time } = req.body;

            if (!player_pin || !opponent_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Can't challenge yourself
            if (player.id === opponent_id) {
                return res.status(400).json({ success: false, error: 'Cannot challenge yourself' });
            }

            // Check opponent exists
            const opponentDoc = await db.collection('players').doc(opponent_id).get();
            if (!opponentDoc.exists) {
                return res.status(404).json({ success: false, error: 'Opponent not found' });
            }
            const opponent = opponentDoc.data();
            const opponentName = opponent.name || `${opponent.first_name} ${opponent.last_name}`;
            const playerName = player.name || `${player.first_name} ${player.last_name}`;

            // Create challenge
            const challengeRef = await db.collection('challenges').add({
                challenger_id: player.id,
                challenger_name: playerName,
                opponent_id: opponent_id,
                opponent_name: opponentName,
                game_type: game_type || '501',
                game_settings: game_settings || {
                    starting_score: 501,
                    legs_to_win: 3,
                    sets_to_win: 1
                },
                message: (message || '').slice(0, 200),
                scheduled_time: scheduled_time ? new Date(scheduled_time) : null,
                status: 'pending', // pending, accepted, declined, expired, completed
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                )
            });

            // Queue notification for opponent
            await db.collection('message_notifications').add({
                recipient_id: opponent_id,
                recipient_phone: opponent.phone,
                source_type: 'challenge',
                source_id: challengeRef.id,
                source_name: 'Challenge',
                message_preview: `${playerName} challenged you to ${game_type || '501'}`,
                sender_name: playerName,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false,
                priority: 'high'
            });

            res.json({
                success: true,
                challenge_id: challengeRef.id,
                message: 'Challenge sent!'
            });

        } catch (error) {
            console.error('Error sending challenge:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Respond to a challenge (accept/decline)
 */
exports.respondToChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, challenge_id, response } = req.body;

            if (!player_pin || !challenge_id || !response) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (!['accept', 'decline'].includes(response)) {
                return res.status(400).json({ success: false, error: 'Invalid response' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const challengeDoc = await db.collection('challenges').doc(challenge_id).get();
            if (!challengeDoc.exists) {
                return res.status(404).json({ success: false, error: 'Challenge not found' });
            }

            const challenge = challengeDoc.data();

            // Verify this player is the opponent
            if (challenge.opponent_id !== player.id) {
                return res.status(403).json({ success: false, error: 'Not your challenge' });
            }

            // Check if still pending
            if (challenge.status !== 'pending') {
                return res.status(400).json({ success: false, error: `Challenge already ${challenge.status}` });
            }

            if (response === 'accept') {
                // Create online match
                const matchRef = await db.collection('online_matches').add({
                    challenge_id: challenge_id,
                    player1_id: challenge.challenger_id,
                    player1_name: challenge.challenger_name,
                    player2_id: challenge.opponent_id,
                    player2_name: challenge.opponent_name,
                    game_type: challenge.game_type,
                    game_settings: challenge.game_settings,
                    status: 'waiting', // waiting, in_progress, completed, abandoned
                    current_set: 1,
                    current_leg: 1,
                    scores: {
                        player1_sets: 0,
                        player2_sets: 0,
                        player1_legs: 0,
                        player2_legs: 0
                    },
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    scheduled_time: challenge.scheduled_time
                });

                await challengeDoc.ref.update({
                    status: 'accepted',
                    match_id: matchRef.id,
                    responded_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // Notify challenger
                await db.collection('message_notifications').add({
                    recipient_id: challenge.challenger_id,
                    source_type: 'challenge_accepted',
                    source_id: matchRef.id,
                    message_preview: `${challenge.opponent_name} accepted your challenge!`,
                    sender_name: challenge.opponent_name,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    digest_sent: false,
                    priority: 'high'
                });

                res.json({
                    success: true,
                    match_id: matchRef.id,
                    message: 'Challenge accepted!'
                });

            } else {
                await challengeDoc.ref.update({
                    status: 'declined',
                    responded_at: admin.firestore.FieldValue.serverTimestamp()
                });

                res.json({ success: true, message: 'Challenge declined' });
            }

        } catch (error) {
            console.error('Error responding to challenge:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get pending challenges for a player
 */
exports.getPendingChallenges = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get challenges received
            const receivedSnapshot = await db.collection('challenges')
                .where('opponent_id', '==', player.id)
                .where('status', '==', 'pending')
                .orderBy('created_at', 'desc')
                .limit(20)
                .get();

            // Get challenges sent
            const sentSnapshot = await db.collection('challenges')
                .where('challenger_id', '==', player.id)
                .where('status', 'in', ['pending', 'accepted'])
                .orderBy('created_at', 'desc')
                .limit(20)
                .get();

            const received = receivedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate(),
                expires_at: doc.data().expires_at?.toDate()
            }));

            const sent = sentSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate(),
                expires_at: doc.data().expires_at?.toDate()
            }));

            res.json({ success: true, received, sent });

        } catch (error) {
            console.error('Error getting challenges:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get active online matches for a player
 */
exports.getActiveOnlineMatches = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get matches where player is participant
            const matchesSnapshot = await db.collection('online_matches')
                .where('status', 'in', ['waiting', 'in_progress'])
                .orderBy('created_at', 'desc')
                .limit(50)
                .get();

            const matches = matchesSnapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.player1_id === player.id || data.player2_id === player.id;
                })
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    created_at: doc.data().created_at?.toDate()
                }));

            res.json({ success: true, matches });

        } catch (error) {
            console.error('Error getting online matches:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Start an online match (both players ready)
 */
exports.startOnlineMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const matchDoc = await db.collection('online_matches').doc(match_id).get();
            if (!matchDoc.exists) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }

            const match = matchDoc.data();

            // Verify player is in match
            if (match.player1_id !== player.id && match.player2_id !== player.id) {
                return res.status(403).json({ success: false, error: 'Not your match' });
            }

            // Mark player as ready
            const readyField = match.player1_id === player.id ? 'player1_ready' : 'player2_ready';
            await matchDoc.ref.update({
                [readyField]: true
            });

            // Check if both ready
            const updatedDoc = await matchDoc.ref.get();
            const updated = updatedDoc.data();

            if (updated.player1_ready && updated.player2_ready) {
                // Generate match PIN for scorer
                const matchPin = Math.floor(100000 + Math.random() * 900000).toString();

                await matchDoc.ref.update({
                    status: 'in_progress',
                    match_pin: matchPin,
                    started_at: admin.firestore.FieldValue.serverTimestamp(),
                    current_thrower: match.player1_id // First player starts
                });

                res.json({
                    success: true,
                    started: true,
                    match_pin: matchPin,
                    message: 'Match started!'
                });
            } else {
                res.json({
                    success: true,
                    started: false,
                    message: 'Waiting for opponent to be ready'
                });
            }

        } catch (error) {
            console.error('Error starting online match:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Record online match leg result
 */
exports.recordOnlineLeg = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id, winner_id, leg_data } = req.body;

            if (!player_pin || !match_id || !winner_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const matchDoc = await db.collection('online_matches').doc(match_id).get();
            if (!matchDoc.exists) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }

            const match = matchDoc.data();

            // Verify player is in match
            if (match.player1_id !== player.id && match.player2_id !== player.id) {
                return res.status(403).json({ success: false, error: 'Not your match' });
            }

            const settings = match.game_settings;
            const scores = match.scores;

            // Update leg count
            const isPlayer1Winner = winner_id === match.player1_id;
            if (isPlayer1Winner) {
                scores.player1_legs++;
            } else {
                scores.player2_legs++;
            }

            // Store leg data
            const legRef = await db.collection('online_matches').doc(match_id)
                .collection('legs').add({
                    set: match.current_set,
                    leg: match.current_leg,
                    winner_id: winner_id,
                    leg_data: leg_data || {},
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

            // Check if set won
            let setWon = false;
            let matchWon = false;
            let winnerId = null;

            if (scores.player1_legs >= settings.legs_to_win) {
                scores.player1_sets++;
                scores.player1_legs = 0;
                scores.player2_legs = 0;
                setWon = true;

                if (scores.player1_sets >= settings.sets_to_win) {
                    matchWon = true;
                    winnerId = match.player1_id;
                }
            } else if (scores.player2_legs >= settings.legs_to_win) {
                scores.player2_sets++;
                scores.player1_legs = 0;
                scores.player2_legs = 0;
                setWon = true;

                if (scores.player2_sets >= settings.sets_to_win) {
                    matchWon = true;
                    winnerId = match.player2_id;
                }
            }

            const updates = {
                scores: scores,
                current_leg: setWon ? 1 : match.current_leg + 1,
                current_set: setWon && !matchWon ? match.current_set + 1 : match.current_set
            };

            if (matchWon) {
                updates.status = 'completed';
                updates.winner_id = winnerId;
                updates.completed_at = admin.firestore.FieldValue.serverTimestamp();

                // Update player stats and streaks
                await updateOnlineStats(match.player1_id, match.player2_id, winnerId, match, leg_data);
            }

            await matchDoc.ref.update(updates);

            res.json({
                success: true,
                scores: scores,
                set_won: setWon,
                match_won: matchWon,
                winner_id: winnerId
            });

        } catch (error) {
            console.error('Error recording online leg:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Helper: Update online match stats for both players
 */
async function updateOnlineStats(player1Id, player2Id, winnerId, match, legData) {
    try {
        const batch = db.batch();
        const loserId = winnerId === player1Id ? player2Id : player1Id;

        // Update winner stats
        const winnerRef = db.collection('players').doc(winnerId);
        batch.update(winnerRef, {
            'online_stats.matches_played': admin.firestore.FieldValue.increment(1),
            'online_stats.matches_won': admin.firestore.FieldValue.increment(1),
            'stats.matches_played': admin.firestore.FieldValue.increment(1),
            'stats.matches_won': admin.firestore.FieldValue.increment(1),
            'streaks.current_win_streak': admin.firestore.FieldValue.increment(1),
            'streaks.last_match_result': 'win',
            'streaks.last_match_date': admin.firestore.FieldValue.serverTimestamp()
        });

        // Update loser stats
        const loserRef = db.collection('players').doc(loserId);
        batch.update(loserRef, {
            'online_stats.matches_played': admin.firestore.FieldValue.increment(1),
            'stats.matches_played': admin.firestore.FieldValue.increment(1),
            'streaks.current_win_streak': 0,
            'streaks.last_match_result': 'loss',
            'streaks.last_match_date': admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // Check hot streak
        const winnerDoc = await winnerRef.get();
        const winnerData = winnerDoc.data();
        const currentStreak = winnerData.streaks?.current_win_streak || 0;

        if (currentStreak >= 3) {
            await winnerRef.update({
                'streaks.is_hot': true,
                'streaks.best_win_streak': Math.max(
                    currentStreak,
                    winnerData.streaks?.best_win_streak || 0
                )
            });
        }

        // Reset loser's hot streak
        await loserRef.update({ 'streaks.is_hot': false });

    } catch (error) {
        console.error('Error updating online stats:', error);
    }
}

/**
 * Request rematch after a completed match
 */
exports.requestRematch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const matchDoc = await db.collection('online_matches').doc(match_id).get();
            if (!matchDoc.exists) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }

            const match = matchDoc.data();

            // Verify player was in match
            if (match.player1_id !== player.id && match.player2_id !== player.id) {
                return res.status(403).json({ success: false, error: 'Not your match' });
            }

            // Determine opponent
            const opponentId = match.player1_id === player.id ? match.player2_id : match.player1_id;
            const opponentName = match.player1_id === player.id ? match.player2_name : match.player1_name;
            const playerName = player.name || `${player.first_name} ${player.last_name}`;

            // Create new challenge
            const challengeRef = await db.collection('challenges').add({
                challenger_id: player.id,
                challenger_name: playerName,
                opponent_id: opponentId,
                opponent_name: opponentName,
                game_type: match.game_type,
                game_settings: match.game_settings,
                message: 'Rematch request!',
                is_rematch: true,
                original_match_id: match_id,
                status: 'pending',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + 60 * 60 * 1000) // 1 hour for rematch
                )
            });

            res.json({
                success: true,
                challenge_id: challengeRef.id,
                message: 'Rematch request sent!'
            });

        } catch (error) {
            console.error('Error requesting rematch:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get match history for a player
 */
exports.getOnlineMatchHistory = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, limit: resultLimit } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const queryLimit = Math.min(resultLimit || 20, 50);

            // Get completed matches
            const matchesSnapshot = await db.collection('online_matches')
                .where('status', '==', 'completed')
                .orderBy('completed_at', 'desc')
                .limit(queryLimit * 2) // Get more to filter
                .get();

            const matches = matchesSnapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.player1_id === player.id || data.player2_id === player.id;
                })
                .slice(0, queryLimit)
                .map(doc => {
                    const data = doc.data();
                    const isPlayer1 = data.player1_id === player.id;
                    return {
                        id: doc.id,
                        opponent_name: isPlayer1 ? data.player2_name : data.player1_name,
                        game_type: data.game_type,
                        won: data.winner_id === player.id,
                        my_sets: isPlayer1 ? data.scores.player1_sets : data.scores.player2_sets,
                        opponent_sets: isPlayer1 ? data.scores.player2_sets : data.scores.player1_sets,
                        completed_at: data.completed_at?.toDate()
                    };
                });

            res.json({ success: true, matches });

        } catch (error) {
            console.error('Error getting match history:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Scheduled: Expire old pending challenges
 */
exports.expireChallenges = onSchedule('0 * * * *', async (event) => {
        console.log('Expiring old challenges...');

        try {
            const now = admin.firestore.Timestamp.now();

            const expiredSnapshot = await db.collection('challenges')
                .where('status', '==', 'pending')
                .where('expires_at', '<', now)
                .limit(100)
                .get();

            if (expiredSnapshot.empty) {
                console.log('No challenges to expire');
                return null;
            }

            const batch = db.batch();
            expiredSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'expired' });
            });

            await batch.commit();
            console.log(`Expired ${expiredSnapshot.size} challenges`);

            return null;

        } catch (error) {
            console.error('Error expiring challenges:', error);
            return null;
        }
    });
