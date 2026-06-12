/**
 * BRDC Chat System - Phase 3: Challenge System & Match Rooms
 *
 * Player Challenges, Casual Matches, Spectator Rooms, Leaderboards
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { verifyFirebaseAuth } = require('./src/firebase-auth-helper');

const db = admin.firestore();

/**
 * Get player name from player object
 */
function getPlayerName(player) {
    return player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown';
}

function getConversationId(playerId1, playerId2) {
    return [String(playerId1), String(playerId2)].sort().join('_');
}

async function upsertConversationEvent({
    participantA,
    participantB,
    sender,
    text,
    type,
    payload = {},
    readBy = []
}) {
    const conversationId = getConversationId(participantA.id, participantB.id);
    const conversationRef = db.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const messageData = {
        sender_id: sender.id,
        sender_name: getPlayerName(sender),
        sender_photo: sender.photo_url || sender.photo || null,
        text,
        timestamp,
        read_by: readBy.length ? readBy : [sender.id],
        type,
        ...payload
    };

    const batch = db.batch();
    const messageRef = conversationRef.collection('messages').doc();
    batch.set(messageRef, messageData);

    const participantAName = getPlayerName(participantA);
    const participantBName = getPlayerName(participantB);

    if (conversationDoc.exists) {
        const currentUnread = conversationDoc.data().unread_count || {};
        const recipientId = String(sender.id) === String(participantA.id) ? String(participantB.id) : String(participantA.id);
        batch.update(conversationRef, {
            last_message: {
                text,
                sender_id: sender.id,
                sender_name: getPlayerName(sender),
                timestamp,
                type
            },
            [`unread_count.${recipientId}`]: (currentUnread[recipientId] || 0) + 1,
            updated_at: timestamp
        });
    } else {
        batch.set(conversationRef, {
            participants: [String(participantA.id), String(participantB.id)].sort(),
            participant_names: {
                [participantA.id]: participantAName,
                [participantB.id]: participantBName
            },
            participant_photos: {
                [participantA.id]: participantA.photo_url || participantA.photo || null,
                [participantB.id]: participantB.photo_url || participantB.photo || null
            },
            last_message: {
                text,
                sender_id: sender.id,
                sender_name: getPlayerName(sender),
                timestamp,
                type
            },
            unread_count: {
                [participantA.id]: String(sender.id) === String(participantA.id) ? 0 : 1,
                [participantB.id]: String(sender.id) === String(participantB.id) ? 0 : 1
            },
            created_at: timestamp,
            updated_at: timestamp
        });
    }

    await batch.commit();
    return { conversationId, messageId: messageRef.id };
}

async function sendChallengePushNotification(recipientId, payload = {}) {
    try {
        const playerDoc = await db.collection('players').doc(recipientId).get();
        if (!playerDoc.exists) return false;

        const player = playerDoc.data() || {};
        const prefs = player.messaging_preferences || {};
        if (prefs.dm_notifications === 'none' && prefs.chat_notifications === 'none') {
            return false;
        }

        const lastSeen = player.last_seen_at?.toDate?.() || new Date(0);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastSeen > fiveMinutesAgo) {
            return false;
        }

        const tokenDoc = await db.collection('fcm_tokens').doc(String(recipientId)).get();
        const token = tokenDoc.exists ? tokenDoc.data()?.token : null;
        if (!token) return false;

        const title = payload.title || 'New Challenge';
        const body = payload.body || 'You received a new challenge on BRDC.';
        const link = payload.link || '/pages/messages.html?tab=lobby';

        await admin.messaging().send({
            token,
            notification: { title, body },
            data: {
                title,
                body,
                type: 'challenge',
                link
            },
            webpush: {
                notification: {
                    title,
                    body,
                    icon: '/images/gold_logo.png',
                    badge: '/images/gold_logo.png'
                },
                fcmOptions: { link }
            }
        });

        return true;
    } catch (error) {
        console.log(`Challenge push notification failed for ${recipientId}:`, error.message);
        return false;
    }
}

function buildCasualScorerUrl(matchId, matchData, roomId) {
    const params = new URLSearchParams();
    const gameType = String(matchData?.game_type || '501').toLowerCase();
    const settings = matchData?.game_settings || {};
    const isCricket = gameType === 'cricket';
    const isCorksChoice = gameType === 'corks_choice';
    const pagePath = isCricket ? '/pages/league-cricket.html' : '/pages/x01-scorer.html';

    params.set('match_id', matchId);
    params.set('casual', 'true');
    params.set('origin', 'casual');
    params.set('home_team_name', matchData?.player1?.name || 'Player 1');
    params.set('away_team_name', matchData?.player2?.name || 'Player 2');
    params.set('home_players', JSON.stringify([{
        id: matchData?.player1?.id || '',
        name: matchData?.player1?.name || 'Player 1'
    }]));
    params.set('away_players', JSON.stringify([{
        id: matchData?.player2?.id || '',
        name: matchData?.player2?.name || 'Player 2'
    }]));
    params.set('legs_to_win', String(matchData?.race_to || 3));
    params.set('cork', settings.use_cork === false ? 'false' : 'true');

    if (settings.cork_rule) params.set('cork_rule', settings.cork_rule);
    if (settings.cork_order) params.set('cork_order', settings.cork_order);
    if (settings.cork_winner_gets) params.set('cork_winner_gets', settings.cork_winner_gets);
    if (settings.default_starter === 'away') {
        params.set('cork_rule', 'away_first');
        params.set('cork', 'false');
    } else if (settings.default_starter === 'home') {
        params.set('cork_rule', 'home_first');
        params.set('cork', 'false');
    }

    if (isCorksChoice) {
        params.set('corks_choice', 'true');
        params.set('starting_score', '501');
        params.set('in_rule', 'straight');
        params.set('out_rule', 'double');
        params.set('checkout', 'double');
    } else if (!isCricket) {
        const startingScore = parseInt(settings.starting_score, 10) || parseInt(matchData?.game_type, 10) || 501;
        const inRule = settings.in_rule || 'straight';
        const outRule = settings.out_rule || 'double';
        params.set('starting_score', String(startingScore));
        params.set('in_rule', inRule);
        params.set('out_rule', outRule);
        params.set('checkout', outRule);
    }

    if (roomId) {
        params.set('return_url', `/pages/chat-room.html?id=${encodeURIComponent(roomId)}`);
    } else {
        params.set('return_url', '/pages/messages.html');
    }

    return `${pagePath}?${params.toString()}`;
}

async function ensureCasualMatchRoom(matchId, matchData) {
    const existingRoom = await db.collection('chat_rooms')
        .where('match_id', '==', matchId)
        .where('type', '==', 'spectator')
        .limit(1)
        .get();

    if (!existingRoom.empty) {
        return existingRoom.docs[0].id;
    }

    const players = [matchData.player1.id, matchData.player2.id].filter(Boolean);
    const roomRef = await db.collection('chat_rooms').add({
        type: 'spectator',
        name: `${matchData.player1.name} vs ${matchData.player2.name}`,
        match_id: matchId,
        match_type: 'casual',
        league_id: null,
        team_id: null,
        participants: players,
        participant_count: players.length,
        admins: players,
        spectator_count: 0,
        is_public: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        last_message: null,
        unread_count: {},
        status: 'active',
        expires_at: null
    });

    await roomRef.collection('messages').add({
        sender_id: 'system',
        sender_name: 'System',
        text: `Welcome to the match room. ${matchData.player1.name} vs ${matchData.player2.name} - ${matchData.game_type} race to ${matchData.race_to}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: 'system',
        pinned: true
    });

    await db.collection('casual_matches').doc(matchId).set({
        chat_room_id: roomRef.id
    }, { merge: true });

    return roomRef.id;
}

async function applyCasualStatsIfNeeded(matchId, match) {
    if (match?.stats_applied_at) {
        return false;
    }

    const winnerId = match?.winner_id;
    const loserId = match?.player1?.id === winnerId ? match?.player2?.id : match?.player1?.id;

    if (!winnerId || !loserId) {
        return false;
    }

    const winnerRef = db.collection('players').doc(winnerId);
    const loserRef = db.collection('players').doc(loserId);

    const [winnerDoc, loserDoc] = await Promise.all([
        winnerRef.get(),
        loserRef.get()
    ]);

    const winnerStats = winnerDoc.data()?.casual_stats || {
        total_matches: 0,
        wins: 0,
        losses: 0,
        current_streak: 0,
        longest_streak: 0,
        avg_ppd: 0,
        high_checkout: 0
    };

    const loserStats = loserDoc.data()?.casual_stats || {
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

    loserStats.total_matches++;
    loserStats.losses++;
    loserStats.current_streak = 0;

    await Promise.all([
        winnerRef.set({ casual_stats: winnerStats }, { merge: true }),
        loserRef.set({ casual_stats: loserStats }, { merge: true }),
        db.collection('casual_matches').doc(matchId).set({
            stats_applied_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
    ]);

    return true;
}

async function postCasualMatchResultIfNeeded(matchId, match) {
    if (!match?.chat_room_id || match?.result_posted_at) {
        return false;
    }

    const winner = match?.winner_id === match?.player1?.id ? match?.player1 : match?.player2;
    const loser = match?.winner_id === match?.player1?.id ? match?.player2 : match?.player1;

    if (!winner?.name || !loser?.name) {
        return false;
    }

    const winnerScore = match?.winner_id === match?.player1?.id ? (match?.player1?.score ?? 0) : (match?.player2?.score ?? 0);
    const loserScore = match?.winner_id === match?.player1?.id ? (match?.player2?.score ?? 0) : (match?.player1?.score ?? 0);
    const summary = `Match complete: ${winner.name} defeated ${loser.name} ${winnerScore}-${loserScore}.`;
    const roomRef = db.collection('chat_rooms').doc(match.chat_room_id);

    await Promise.all([
        roomRef.collection('messages').add({
            sender_id: 'system',
            sender_name: 'System',
            text: summary,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system'
        }),
        roomRef.set({
            last_message: summary,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }),
        db.collection('casual_matches').doc(matchId).set({
            result_posted_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
    ]);

    return true;
}

async function requireCasualMatchParticipant(req, matchId) {
    const player = await verifyFirebaseAuth(req);
    if (!player) {
        return { errorStatus: 401, error: 'Unauthorized' };
    }

    const matchRef = db.collection('casual_matches').doc(matchId);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
        return { errorStatus: 404, error: 'Match not found' };
    }

    const match = matchDoc.data();
    const participantIds = [match?.player1?.id, match?.player2?.id].filter(Boolean);
    if (!participantIds.includes(player.id)) {
        return { errorStatus: 403, error: 'You are not a participant in this match' };
    }

    return { player, matchRef, match };
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
                challenged_player_id,
                game_type = '501',
                race_to = 3,
                message = '',
                start_time = 'now',
                game_settings = {}
            } = req.body;

            if (!challenged_player_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: challenged_player_id'
                });
            }

            // Validate game type
            const validGameTypes = ['501', '301', '701', 'cricket', 'corks_choice'];
            if (!validGameTypes.includes(game_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid game type. Must be: 501, 301, 701, cricket, or corks_choice'
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
            const challenger = await verifyFirebaseAuth(req);
            if (!challenger) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
            const conversationId = getConversationId(challenger.id, challenged_player_id);

            const normalizedSettings = {
                starting_score: parseInt(game_settings.starting_score, 10) || parseInt(game_type, 10) || 501,
                in_rule: game_settings.in_rule || 'straight',
                out_rule: game_settings.out_rule || 'double',
                use_cork: game_settings.use_cork !== false,
                cork_rule: game_settings.cork_rule || 'cork_every_leg',
                cork_order: game_settings.cork_order || 'alternate-random',
                cork_winner_gets: game_settings.cork_winner_gets || 'choose-and-start',
                default_starter: game_settings.default_starter || 'home'
            };

            // Create challenge
            const challengeRef = await db.collection('challenges').add({
                challenger_id: challenger.id,
                challenger_name: getPlayerName(challenger),
                challenged_id: challenged_player_id,
                challenged_name: getPlayerName(challenged),
                game_type: game_type,
                race_to: race_to,
                game_settings: normalizedSettings,
                message: message.substring(0, 200), // Limit message length
                start_time: start_time,
                status: 'pending',
                match_id: null,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
            });

            await upsertConversationEvent({
                participantA: challenger,
                participantB: challenged,
                sender: challenger,
                text: `${getPlayerName(challenger)} sent a ${game_type === 'corks_choice' ? "Cork's Choice" : game_type} challenge`,
                type: 'challenge',
                payload: {
                    challenge_id: challengeRef.id,
                    challenge_status: 'pending',
                    challenge: {
                        challenger_id: challenger.id,
                        challenger_name: getPlayerName(challenger),
                        challenged_id: challenged_player_id,
                        challenged_name: getPlayerName(challenged),
                        game_type,
                        race_to,
                        message: message.substring(0, 200),
                        game_settings: normalizedSettings,
                        expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
                    }
                },
                readBy: [challenger.id]
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
                message_preview: `${getPlayerName(challenger)} challenged you to ${game_type === 'corks_choice' ? "Cork's Choice" : game_type} (Race to ${race_to})`,
                notification_type: 'challenge',
                priority: 'high',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false
            });

            await sendChallengePushNotification(challenged_player_id, {
                title: `${getPlayerName(challenger)} challenged you`,
                body: `${game_type === 'corks_choice' ? "Cork's Choice" : game_type} · Race to ${race_to}`,
                link: `/pages/conversation.html?id=${conversationId}&from=direct`
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
            const { challenge_id, response } = req.body;

            if (!challenge_id || !response) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: challenge_id, response'
                });
            }

            if (!['accept', 'decline'].includes(response)) {
                return res.status(400).json({
                    success: false,
                    error: 'Response must be "accept" or "decline"'
                });
            }

            // Verify player
            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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

                await upsertConversationEvent({
                    participantA: { id: challenge.challenger_id, name: challenge.challenger_name },
                    participantB: { id: challenge.challenged_id, name: challenge.challenged_name },
                    sender: player,
                    text: `${getPlayerName(player)} declined the challenge`,
                    type: 'challenge_response',
                    payload: {
                        challenge_id,
                        challenge_status: 'declined',
                        challenge_response: {
                            response: 'declined'
                        }
                    },
                    readBy: [player.id]
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
                starting_score: challenge.game_type === 'cricket' ? 0 : (challenge.game_settings?.starting_score || parseInt(challenge.game_type) || 501),
                game_settings: challenge.game_settings || {},

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
            const roomId = await ensureCasualMatchRoom(matchId, matchData);

            // Update challenge
            await db.collection('challenges').doc(challenge_id).update({
                status: 'accepted',
                match_id: matchId,
                room_id: roomId,
                responded_at: admin.firestore.FieldValue.serverTimestamp()
            });

            const scorerUrl = buildCasualScorerUrl(matchId, matchData, roomId);

            await upsertConversationEvent({
                participantA: { id: challenge.challenger_id, name: challenge.challenger_name },
                participantB: { id: challenge.challenged_id, name: challenge.challenged_name },
                sender: player,
                text: `${getPlayerName(player)} accepted the challenge`,
                type: 'challenge_response',
                payload: {
                    challenge_id,
                    challenge_status: 'accepted',
                    challenge_response: {
                        response: 'accepted',
                        match_id: matchId,
                        room_id: roomId,
                        scorer_url: scorerUrl,
                        room_url: `/pages/chat-room.html?id=${encodeURIComponent(roomId)}`
                    }
                },
                readBy: [player.id]
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
                room_id: roomId,
                room_url: `/pages/chat-room.html?id=${encodeURIComponent(roomId)}`,
                scorer_url: scorerUrl
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
async function computePlayerChallenges(playerId, filter = 'all') {
    // Keep these queries index-free. Sorting is done in memory so the
    // challenge drawer works without waiting on Firestore composite indexes.
    let sentQuery = db.collection('challenges')
        .where('challenger_id', '==', playerId)
        .limit(20);

    let receivedQuery = db.collection('challenges')
        .where('challenged_id', '==', playerId)
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

    const newestFirst = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
    sent.sort(newestFirst);
    received.sort(newestFirst);

    // Apply filter
    if (filter === 'pending') {
        sent = sent.filter(c => c.status === 'pending');
        received = received.filter(c => c.status === 'pending');
    } else if (filter === 'active') {
        sent = sent.filter(c => c.status === 'accepted' && c.match_id);
        received = received.filter(c => c.status === 'accepted' && c.match_id);
    }

    return {
        success: true,
        sent: sent,
        received: received
    };
}

exports.computePlayerChallenges = computePlayerChallenges;

exports.getPlayerChallenges = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { filter = 'all' } = req.body;

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            const result = await computePlayerChallenges(player.id, filter);
            res.json(result);

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
            const { challenge_id } = req.body;

            if (!challenge_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: challenge_id'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
            const { match_id, match_type = 'casual' } = req.body;

            if (!match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: match_id'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            // Get match data
            let matchData = null;

            if (match_type === 'casual') {
                const matchDoc = await db.collection('casual_matches').doc(match_id).get();
                if (matchDoc.exists) {
                    matchData = matchDoc.data();
                }
            }

            if (!matchData) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            const roomId = await ensureCasualMatchRoom(match_id, matchData);

            res.json({
                success: true,
                room_id: roomId,
                room_url: `/pages/chat-room.html?id=${encodeURIComponent(roomId)}`,
                scorer_url: buildCasualScorerUrl(match_id, matchData, roomId)
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
            const { room_id } = req.body;

            if (!room_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
            const { category = 'most_wins' } = req.body;

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
            const { opponent_id } = req.body;

            if (!opponent_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: opponent_id'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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

            const applied = await applyCasualStatsIfNeeded(match_id, match);

            res.json({
                success: true,
                message: applied ? 'Stats updated' : 'Stats already applied'
            });

        } catch (error) {
            console.error('Error updating casual stats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Save in-progress challenge match legs for crash/tablet recovery.
 * POST: { match_id, game_type, legs, match_config, progress }
 */
exports.saveCasualChallengeProgress = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { match_id, game_type, legs = [], match_config = {}, progress = {} } = req.body || {};

            if (!match_id || !game_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: match_id, game_type'
                });
            }

            const access = await requireCasualMatchParticipant(req, match_id);
            if (access.error) {
                return res.status(access.errorStatus).json({ success: false, error: access.error });
            }

            if (access.match?.status === 'completed') {
                return res.json({
                    success: true,
                    status: 'already_completed'
                });
            }

            await access.matchRef.set({
                status: 'in_progress',
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                progress_saved_at: admin.firestore.FieldValue.serverTimestamp(),
                progress: {
                    ...progress,
                    scorer_type: progress?.scorer_type || String(game_type).toLowerCase(),
                    game_type,
                    match_config
                },
                game_stats: {
                    ...(access.match?.game_stats || {}),
                    game_type,
                    legs: Array.isArray(legs) ? legs : []
                }
            }, { merge: true });

            return res.json({
                success: true,
                match_id,
                status: 'in_progress'
            });
        } catch (error) {
            console.error('Error saving casual challenge progress:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get in-progress challenge match legs for crash/tablet recovery.
 * POST: { match_id }
 */
exports.getCasualChallengeProgress = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { match_id } = req.body || {};

            if (!match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: match_id'
                });
            }

            const access = await requireCasualMatchParticipant(req, match_id);
            if (access.error) {
                return res.status(access.errorStatus).json({ success: false, error: access.error });
            }

            const match = access.match || {};
            return res.json({
                success: true,
                status: match.status || null,
                progress: match.progress || null,
                legs: Array.isArray(match?.game_stats?.legs) ? match.game_stats.legs : [],
                game_type: match?.game_stats?.game_type || match.game_type || null,
                match_config: match?.progress?.match_config || {}
            });
        } catch (error) {
            console.error('Error getting casual challenge progress:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Complete a challenge-created casual match and post the result into its room
 * POST: { match_id, winner_id, home_score, away_score, game_stats? }
 */
exports.completeCasualChallengeMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { match_id, winner_id, home_score, away_score, game_stats = null } = req.body;

            if (!match_id || !winner_id || typeof home_score !== 'number' || typeof away_score !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: match_id, winner_id, home_score, away_score'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            }

            const matchRef = db.collection('casual_matches').doc(match_id);
            const matchDoc = await matchRef.get();

            if (!matchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            const match = matchDoc.data();
            const participantIds = [match?.player1?.id, match?.player2?.id].filter(Boolean);

            if (!participantIds.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not a participant in this match'
                });
            }

            if (!participantIds.includes(winner_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Winner must be one of the match participants'
                });
            }

            if (match.status === 'completed' && match.winner_id) {
                return res.json({
                    success: true,
                    already_completed: true,
                    room_id: match.chat_room_id || null,
                    room_url: match.chat_room_id ? `/pages/chat-room.html?id=${encodeURIComponent(match.chat_room_id)}` : '/pages/messages.html',
                    message: 'Match already completed'
                });
            }

            const updatedMatch = {
                ...match,
                status: 'completed',
                winner_id,
                completed_at: admin.firestore.FieldValue.serverTimestamp(),
                progress: admin.firestore.FieldValue.delete(),
                progress_saved_at: admin.firestore.FieldValue.delete(),
                game_stats,
                player1: {
                    ...(match.player1 || {}),
                    score: home_score
                },
                player2: {
                    ...(match.player2 || {}),
                    score: away_score
                }
            };

            await matchRef.set(updatedMatch, { merge: true });

            if (match.challenge_id) {
                await db.collection('challenges').doc(match.challenge_id).set({
                    status: 'completed',
                    completed_at: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            await applyCasualStatsIfNeeded(match_id, updatedMatch);
            await postCasualMatchResultIfNeeded(match_id, updatedMatch);

            return res.json({
                success: true,
                room_id: updatedMatch.chat_room_id || null,
                room_url: updatedMatch.chat_room_id ? `/pages/chat-room.html?id=${encodeURIComponent(updatedMatch.chat_room_id)}` : '/pages/messages.html',
                message: 'Match completed'
            });
        } catch (error) {
            console.error('Error completing casual challenge match:', error);
            return res.status(500).json({ success: false, error: error.message });
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
            const { match_id } = req.body;

            if (!match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: match_id'
                });
            }

            const player = await verifyFirebaseAuth(req);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
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
