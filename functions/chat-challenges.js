/**
 * BRDC Chat System - Phase 3: Challenge System & Match Rooms
 *
 * Player Challenges, Casual Matches, Spectator Rooms, Leaderboards
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify player PIN and return player data
 */
async function verifyPlayerPin(pin) {
    if (!pin) return null;

    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;

    const doc = playersSnapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Get player name from player object
 */
function getPlayerName(player) {
    return player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown';
}

// ============================================================================
// CHALLENGE SYSTEM
// ============================================================================

/**
 * Send a challenge to another player
 * POST: { challenger_pin, challenged_player_id, game_type, race_to, message?, start_time? }
 */
exports.sendChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                challenger_pin,
                challenged_player_id,
                game_type = '501',
                race_to = 3,
                message = '',
                start_time = 'now'
            } = req.body;

            if (!challenger_pin || !challenged_player_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: challenger_pin, challenged_player_id'
                });
            }

            // Validate game type
            const validGameTypes = ['501', '301', 'cricket'];
            if (!validGameTypes.includes(game_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid game type. Must be: 501, 301, or cricket'
                });
            }

            // Validate race to
            const validRaceTo = [3, 5, 7, 9];
            if (!validRaceTo.includes(race_to)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid race_to. Must be: 3, 5, 7, or 9'
                });
            }

            // Verify challenger
            const challenger = await verifyPlayerPin(challenger_pin);
            if (!challenger) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Can't challenge yourself
            if (challenger.id === challenged_player_id) {
                return res.status(400).json({
                    success: false,
                    error: 'You cannot challenge yourself'
                });
            }

            // Verify challenged player exists
            const challengedDoc = await db.collection('players').doc(challenged_player_id).get();
            if (!challengedDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Challenged player not found'
                });
            }
            const challenged = { id: challengedDoc.id, ...challengedDoc.data() };

            // Check for existing pending challenge between these players
            const existingChallenge = await db.collection('challenges')
                .where('challenger_id', '==', challenger.id)
                .where('challenged_id', '==', challenged_player_id)
                .where('status', '==', 'pending')
                .limit(1)
                .get();

            if (!existingChallenge.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'You already have a pending challenge with this player'
                });
            }

            // Calculate expiry time (24 hours)
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // Create challenge
            const challengeRef = await db.collection('challenges').add({
                challenger_id: challenger.id,
                challenger_name: getPlayerName(challenger),
                challenged_id: challenged_player_id,
                challenged_name: getPlayerName(challenged),
                game_type: game_type,
                race_to: race_to,
                message: message.substring(0, 200), // Limit message length
                start_time: start_time,
                status: 'pending',
                match_id: null,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
            });

            // Send notification to challenged player
            await db.collection('message_notifications').add({
                recipient_id: challenged_player_id,
                recipient_phone: challenged.phone || null,
                recipient_email: challenged.email || null,
                source_type: 'challenge',
                source_id: challengeRef.id,
                source_name: 'Match Challenge',
                sender_id: challenger.id,
                sender_name: getPlayerName(challenger),
                message_preview: `${getPlayerName(challenger)} challenged you to ${game_type} (Race to ${race_to})`,
                notification_type: 'challenge',
                priority: 'high',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false
            });

            res.json({
                success: true,
                challenge_id: challengeRef.id,
                message: `Challenge sent to ${getPlayerName(challenged)}`
            });

        } catch (error) {
            console.error('Error sending challenge:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Respond to a challenge (accept/decline)
 * POST: { player_pin, challenge_id, response: 'accept'|'decline' }
 */
exports.respondToChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, challenge_id, response } = req.body;

            if (!player_pin || !challenge_id || !response) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, challenge_id, response'
                });
            }

            if (!['accept', 'decline'].includes(response)) {
                return res.status(400).json({
                    success: false,
                    error: 'Response must be "accept" or "decline"'
                });
            }

            // Verify player
            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get challenge
            const challengeDoc = await db.collection('challenges').doc(challenge_id).get();
            if (!challengeDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Challenge not found'
                });
            }

            const challenge = challengeDoc.data();

            // Verify player is the challenged one
            if (challenge.challenged_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the challenged player'
                });
            }

            // Check challenge is still pending
            if (challenge.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Challenge is already ${challenge.status}`
                });
            }

            // Check if expired
            const expiresAt = challenge.expires_at?.toDate?.() || new Date(0);
            if (expiresAt < new Date()) {
                await db.collection('challenges').doc(challenge_id).update({
                    status: 'expired'
                });
                return res.status(400).json({
                    success: false,
                    error: 'Challenge has expired'
                });
            }

            if (response === 'decline') {
                // Update challenge status
                await db.collection('challenges').doc(challenge_id).update({
                    status: 'declined',
                    responded_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // Notify challenger
                await db.collection('message_notifications').add({
                    recipient_id: challenge.challenger_id,
                    source_type: 'challenge_response',
                    source_id: challenge_id,
                    source_name: 'Challenge Declined',
                    sender_id: player.id,
                    sender_name: getPlayerName(player),
                    message_preview: `${getPlayerName(player)} declined your challenge`,
                    notification_type: 'challenge_declined',
                    priority: 'normal',
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    digest_sent: false
                });

                return res.json({
                    success: true,
                    message: 'Challenge declined'
                });
            }

            // Accept challenge - create casual match
            const matchId = `casual_${challenge.challenger_id}_${challenge.challenged_id}_${Date.now()}`;

            const matchData = {
                id: matchId,
                challenge_id: challenge_id,
                type: 'casual',
                game_type: challenge.game_type,
                race_to: challenge.race_to,
                starting_score: challenge.game_type === 'cricket' ? 0 : parseInt(challenge.game_type),

                player1: {
                    id: challenge.challenger_id,
                    name: challenge.challenger_name,
                    score: 0
                },
                player2: {
                    id: challenge.challenged_id,
                    name: challenge.challenged_name,
                    score: 0
                },

                status: 'pending', // waiting for both players to join
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                started_at: null,
                completed_at: null,
                winner_id: null
            };

            // Create match document
            await db.collection('casual_matches').doc(matchId).set(matchData);

            // Update challenge
            await db.collection('challenges').doc(challenge_id).update({
                status: 'accepted',
                match_id: matchId,
                responded_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Notify challenger
            await db.collection('message_notifications').add({
                recipient_id: challenge.challenger_id,
                source_type: 'challenge_response',
                source_id: challenge_id,
                source_name: 'Challenge Accepted!',
                sender_id: player.id,
                sender_name: getPlayerName(player),
                message_preview: `${getPlayerName(player)} accepted your challenge! Match is ready.`,
                notification_type: 'challenge_accepted',
                priority: 'high',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false
            });

            res.json({
                success: true,
                message: 'Challenge accepted',
                match_id: matchId,
                scorer_url: `/scorers/x01.html?match=${matchId}&type=casual`
            });

        } catch (error) {
            console.error('Error responding to challenge:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get player's challenges (sent and received)
 * POST: { player_pin, filter?: 'all'|'pending'|'active' }
 */
exports.getPlayerChallenges = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, filter = 'all' } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get challenges sent by player
            let sentQuery = db.collection('challenges')
                .where('challenger_id', '==', player.id)
                .orderBy('created_at', 'desc')
                .limit(20);

            // Get challenges received by player
            let receivedQuery = db.collection('challenges')
                .where('challenged_id', '==', player.id)
                .orderBy('created_at', 'desc')
                .limit(20);

            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                sentQuery.get(),
                receivedQuery.get()
            ]);

            const formatChallenge = (doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    challenger_id: data.challenger_id,
                    challenger_name: data.challenger_name,
                    challenged_id: data.challenged_id,
                    challenged_name: data.challenged_name,
                    game_type: data.game_type,
                    race_to: data.race_to,
                    message: data.message,
                    status: data.status,
                    match_id: data.match_id,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null,
                    expires_at: data.expires_at?.toDate?.()?.toISOString() || null
                };
            };

            let sent = sentSnapshot.docs.map(formatChallenge);
            let received = receivedSnapshot.docs.map(formatChallenge);

            // Apply filter
            if (filter === 'pending') {
                sent = sent.filter(c => c.status === 'pending');
                received = received.filter(c => c.status === 'pending');
            } else if (filter === 'active') {
                sent = sent.filter(c => c.status === 'accepted' && c.match_id);
                received = received.filter(c => c.status === 'accepted' && c.match_id);
            }

            res.json({
                success: true,
                sent: sent,
                received: received
            });

        } catch (error) {
            console.error('Error getting player challenges:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Cancel a pending challenge
 * POST: { player_pin, challenge_id }
 */
exports.cancelChallenge = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, challenge_id } = req.body;

            if (!player_pin || !challenge_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, challenge_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            const challengeDoc = await db.collection('challenges').doc(challenge_id).get();
            if (!challengeDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Challenge not found'
                });
            }

            const challenge = challengeDoc.data();

            // Only challenger can cancel
            if (challenge.challenger_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the challenger can cancel'
                });
            }

            // Only pending challenges can be cancelled
            if (challenge.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot cancel a ${challenge.status} challenge`
                });
            }

            await db.collection('challenges').doc(challenge_id).update({
                status: 'cancelled',
                cancelled_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Challenge cancelled'
            });

        } catch (error) {
            console.error('Error cancelling challenge:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// SPECTATOR MATCH ROOMS
// ============================================================================

/**
 * Create a spectator chat room for a match
 * POST: { player_pin, match_id, match_type: 'casual'|'league'|'tournament' }
 */
exports.createMatchRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id, match_type = 'casual' } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, match_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Check if match room already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('match_id', '==', match_id)
                .where('type', '==', 'spectator')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                return res.json({
                    success: true,
                    room_id: existingRoom.docs[0].id,
                    message: 'Match room already exists'
                });
            }

            // Get match data
            let matchData = null;
            let players = [];

            if (match_type === 'casual') {
                const matchDoc = await db.collection('casual_matches').doc(match_id).get();
                if (matchDoc.exists) {
                    matchData = matchDoc.data();
                    players = [matchData.player1.id, matchData.player2.id];
                }
            }

            if (!matchData) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            // Create spectator room
            const roomRef = await db.collection('chat_rooms').add({
                type: 'spectator',
                name: `${matchData.player1.name} vs ${matchData.player2.name}`,
                match_id: match_id,
                match_type: match_type,
                league_id: null,
                team_id: null,
                participants: players, // Start with just players
                participant_count: 2,
                admins: players, // Players can moderate
                spectator_count: 0,
                is_public: true, // Anyone can join
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_count: {},
                status: 'active',
                expires_at: null // Will be set when match ends
            });

            // Add system message
            await roomRef.collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: `Welcome to the match! ${matchData.player1.name} vs ${matchData.player2.name} - ${matchData.game_type} Race to ${matchData.race_to}`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: true
            });

            // Update match with chat room ID
            if (match_type === 'casual') {
                await db.collection('casual_matches').doc(match_id).update({
                    chat_room_id: roomRef.id
                });
            }

            res.json({
                success: true,
                room_id: roomRef.id
            });

        } catch (error) {
            console.error('Error creating match room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Join a spectator match room
 * POST: { player_pin, room_id }
 */
exports.joinMatchRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, room_id } = req.body;

            if (!player_pin || !room_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, room_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }

            const room = roomDoc.data();

            // Check if it's a public spectator room
            if (room.type !== 'spectator' || !room.is_public) {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot join this room'
                });
            }

            // Check if room is still active
            if (room.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'This match room has ended'
                });
            }

            // Add player to participants if not already
            if (!room.participants.includes(player.id)) {
                await db.collection('chat_rooms').doc(room_id).update({
                    participants: admin.firestore.FieldValue.arrayUnion(player.id),
                    spectator_count: admin.firestore.FieldValue.increment(1),
                    participant_count: admin.firestore.FieldValue.increment(1)
                });
            }

            res.json({
                success: true,
                room_id: room_id,
                room_name: room.name
            });

        } catch (error) {
            console.error('Error joining match room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get list of public match rooms
 * POST: { player_pin }
 */
exports.getPublicMatchRooms = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            const roomsSnapshot = await db.collection('chat_rooms')
                .where('type', '==', 'spectator')
                .where('is_public', '==', true)
                .where('status', '==', 'active')
                .orderBy('created_at', 'desc')
                .limit(20)
                .get();

            const rooms = roomsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    match_id: data.match_id,
                    match_type: data.match_type,
                    spectator_count: data.spectator_count || 0,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null
                };
            });

            res.json({
                success: true,
                rooms: rooms
            });

        } catch (error) {
            console.error('Error getting public match rooms:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// LEADERBOARDS & STATS
// ============================================================================

/**
 * Get casual match leaderboard
 * POST: { player_pin, category: 'most_wins'|'win_rate'|'win_streak'|'highest_ppd' }
 */
exports.getCasualLeaderboard = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, category = 'most_wins' } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get all players with casual match stats
            const playersSnapshot = await db.collection('players')
                .where('casual_stats.total_matches', '>', 0)
                .get();

            let leaders = [];

            playersSnapshot.forEach(doc => {
                const data = doc.data();
                const stats = data.casual_stats || {};

                // Skip players without enough matches for win rate
                if (category === 'win_rate' && (stats.total_matches || 0) < 10) {
                    return;
                }

                leaders.push({
                    player_id: doc.id,
                    name: getPlayerName(data),
                    total_matches: stats.total_matches || 0,
                    wins: stats.wins || 0,
                    losses: stats.losses || 0,
                    win_rate: stats.total_matches > 0 ? (stats.wins / stats.total_matches) : 0,
                    current_streak: stats.current_streak || 0,
                    longest_streak: stats.longest_streak || 0,
                    avg_ppd: stats.avg_ppd || 0,
                    high_checkout: stats.high_checkout || 0
                });
            });

            // Sort based on category
            switch (category) {
                case 'most_wins':
                    leaders.sort((a, b) => b.wins - a.wins);
                    break;
                case 'win_rate':
                    leaders.sort((a, b) => b.win_rate - a.win_rate);
                    break;
                case 'win_streak':
                    leaders.sort((a, b) => b.current_streak - a.current_streak);
                    break;
                case 'highest_ppd':
                    leaders.sort((a, b) => b.avg_ppd - a.avg_ppd);
                    break;
            }

            // Get top 20
            leaders = leaders.slice(0, 20);

            // Find current player's rank
            const playerRank = leaders.findIndex(l => l.player_id === player.id);

            res.json({
                success: true,
                category: category,
                leaders: leaders,
                player_rank: playerRank >= 0 ? playerRank + 1 : null
            });

        } catch (error) {
            console.error('Error getting casual leaderboard:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get head-to-head stats between two players
 * POST: { player_pin, opponent_id }
 */
exports.getHeadToHead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, opponent_id } = req.body;

            if (!player_pin || !opponent_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, opponent_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get opponent data
            const opponentDoc = await db.collection('players').doc(opponent_id).get();
            if (!opponentDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Opponent not found'
                });
            }
            const opponent = { id: opponentDoc.id, ...opponentDoc.data() };

            // Get all casual matches between these two players
            const matchesSnapshot = await db.collection('casual_matches')
                .where('status', '==', 'completed')
                .get();

            let playerWins = 0;
            let opponentWins = 0;
            const recentMatches = [];

            matchesSnapshot.forEach(doc => {
                const match = doc.data();

                // Check if both players are in this match
                const playerIsP1 = match.player1?.id === player.id;
                const playerIsP2 = match.player2?.id === player.id;
                const opponentIsP1 = match.player1?.id === opponent_id;
                const opponentIsP2 = match.player2?.id === opponent_id;

                if ((playerIsP1 && opponentIsP2) || (playerIsP2 && opponentIsP1)) {
                    if (match.winner_id === player.id) {
                        playerWins++;
                    } else if (match.winner_id === opponent_id) {
                        opponentWins++;
                    }

                    recentMatches.push({
                        match_id: doc.id,
                        winner_id: match.winner_id,
                        winner_name: match.winner_id === player.id ? getPlayerName(player) : getPlayerName(opponent),
                        player1_score: match.player1?.score || 0,
                        player2_score: match.player2?.score || 0,
                        game_type: match.game_type,
                        completed_at: match.completed_at?.toDate?.()?.toISOString() || null
                    });
                }
            });

            // Sort recent matches by date
            recentMatches.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

            const total = playerWins + opponentWins;

            res.json({
                success: true,
                player: {
                    id: player.id,
                    name: getPlayerName(player),
                    wins: playerWins
                },
                opponent: {
                    id: opponent_id,
                    name: getPlayerName(opponent),
                    wins: opponentWins
                },
                total_matches: total,
                leader: playerWins > opponentWins ? 'player' : (opponentWins > playerWins ? 'opponent' : 'tied'),
                recent_matches: recentMatches.slice(0, 5)
            });

        } catch (error) {
            console.error('Error getting head-to-head stats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player casual stats after a match
 * POST: { match_id }
 */
exports.updateCasualStats = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { match_id } = req.body;

            if (!match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: match_id'
                });
            }

            const matchDoc = await db.collection('casual_matches').doc(match_id).get();
            if (!matchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            const match = matchDoc.data();

            if (match.status !== 'completed' || !match.winner_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Match not completed'
                });
            }

            const winnerId = match.winner_id;
            const loserId = match.player1.id === winnerId ? match.player2.id : match.player1.id;

            // Update winner stats
            const winnerRef = db.collection('players').doc(winnerId);
            const winnerDoc = await winnerRef.get();
            const winnerStats = winnerDoc.data()?.casual_stats || {
                total_matches: 0,
                wins: 0,
                losses: 0,
                current_streak: 0,
                longest_streak: 0,
                avg_ppd: 0,
                high_checkout: 0
            };

            winnerStats.total_matches++;
            winnerStats.wins++;
            winnerStats.current_streak++;
            winnerStats.longest_streak = Math.max(winnerStats.longest_streak, winnerStats.current_streak);

            await winnerRef.update({ casual_stats: winnerStats });

            // Update loser stats
            const loserRef = db.collection('players').doc(loserId);
            const loserDoc = await loserRef.get();
            const loserStats = loserDoc.data()?.casual_stats || {
                total_matches: 0,
                wins: 0,
                losses: 0,
                current_streak: 0,
                longest_streak: 0,
                avg_ppd: 0,
                high_checkout: 0
            };

            loserStats.total_matches++;
            loserStats.losses++;
            loserStats.current_streak = 0; // Reset streak on loss

            await loserRef.update({ casual_stats: loserStats });

            res.json({
                success: true,
                message: 'Stats updated'
            });

        } catch (error) {
            console.error('Error updating casual stats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Send a rematch challenge
 * POST: { player_pin, match_id }
 */
exports.sendRematch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, match_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get original match
            const matchDoc = await db.collection('casual_matches').doc(match_id).get();
            if (!matchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            const match = matchDoc.data();

            // Determine opponent
            let opponentId;
            if (match.player1.id === player.id) {
                opponentId = match.player2.id;
            } else if (match.player2.id === player.id) {
                opponentId = match.player1.id;
            } else {
                return res.status(403).json({
                    success: false,
                    error: 'You were not in this match'
                });
            }

            // Create challenge with same settings
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            const challengeRef = await db.collection('challenges').add({
                challenger_id: player.id,
                challenger_name: getPlayerName(player),
                challenged_id: opponentId,
                challenged_name: match.player1.id === opponentId ? match.player1.name : match.player2.name,
                game_type: match.game_type,
                race_to: match.race_to,
                message: 'Rematch!',
                start_time: 'now',
                status: 'pending',
                match_id: null,
                is_rematch: true,
                original_match_id: match_id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
            });

            // Get opponent for notification
            const opponentDoc = await db.collection('players').doc(opponentId).get();
            const opponent = opponentDoc.data();

            // Send notification
            await db.collection('message_notifications').add({
                recipient_id: opponentId,
                recipient_phone: opponent?.phone || null,
                recipient_email: opponent?.email || null,
                source_type: 'challenge',
                source_id: challengeRef.id,
                source_name: 'Rematch Challenge',
                sender_id: player.id,
                sender_name: getPlayerName(player),
                message_preview: `${getPlayerName(player)} wants a rematch! (${match.game_type} Race to ${match.race_to})`,
                notification_type: 'challenge',
                priority: 'high',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false
            });

            res.json({
                success: true,
                challenge_id: challengeRef.id,
                message: 'Rematch challenge sent!'
            });

        } catch (error) {
            console.error('Error sending rematch:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
