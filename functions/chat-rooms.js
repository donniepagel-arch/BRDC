/**
 * BRDC Chat Rooms System
 * Handles league, team, and match chat rooms with group messaging
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
 * Check if PIN has admin access to a league
 */
async function checkLeagueAdminAccess(leagueId, pin) {
    const leagueDoc = await db.collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) return false;

    const league = leagueDoc.data();
    return league.admin_pin === pin || league.director_pin === pin;
}

/**
 * Queue notification for chat room message
 */
async function queueChatRoomNotification(roomId, roomName, roomType, senderId, senderName, messagePreview, participantIds) {
    try {
        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        for (const participantId of participantIds) {
            if (participantId === senderId) continue; // Skip sender

            // Get participant data
            const participantDoc = await db.collection('players').doc(participantId).get();
            if (!participantDoc.exists) continue;

            const participant = participantDoc.data();
            const prefs = participant.messaging_preferences || {};

            // Check preferences
            if (prefs.chat_notifications === 'none') continue;

            // Check if participant is online
            const lastSeen = participant.last_seen_at?.toDate?.() || new Date(0);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (lastSeen > fiveMinutesAgo) continue;

            // Queue notification
            const notifRef = db.collection('message_notifications').doc();
            batch.set(notifRef, {
                recipient_id: participantId,
                recipient_phone: participant.phone || null,
                recipient_email: participant.email || null,
                source_type: `${roomType}_chat`,
                source_id: roomId,
                source_name: roomName,
                sender_id: senderId,
                sender_name: senderName,
                message_preview: messagePreview.substring(0, 100),
                created_at: timestamp,
                digest_sent: false,
                priority: roomType === 'match' ? 'high' : 'normal'
            });
        }

        await batch.commit();
    } catch (error) {
        console.error('Error queueing chat room notifications:', error);
    }
}

// ============================================================================
// CHAT ROOM CREATION
// ============================================================================

/**
 * Create a league-wide chat room
 * POST: { league_id, admin_pin }
 */
exports.createLeagueChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, admin_pin } = req.body;

            if (!league_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: league_id, admin_pin'
                });
            }

            // Verify admin access
            if (!await checkLeagueAdminAccess(league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            // Get league data
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            const league = leagueDoc.data();

            // Check if league chat already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('league_id', '==', league_id)
                .where('type', '==', 'league')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                return res.json({
                    success: true,
                    room_id: existingRoom.docs[0].id,
                    message: 'League chat room already exists'
                });
            }

            // Get all league players
            const playersSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players').get();

            const participantIds = playersSnapshot.docs.map(doc => doc.id);

            // Get director player ID
            const adminPlayer = await verifyPlayerPin(admin_pin);
            const adminIds = adminPlayer ? [adminPlayer.id] : [];

            // Create chat room
            const roomRef = await db.collection('chat_rooms').add({
                type: 'league',
                name: `${league.name} Chat`,
                league_id: league_id,
                team_id: null,
                match_id: null,
                participants: participantIds,
                participant_count: participantIds.length,
                admins: adminIds,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_count: {},
                status: 'active'
            });

            // Add system message
            await roomRef.collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: `Welcome to ${league.name} chat! This is where all league players can communicate.`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            res.json({
                success: true,
                room_id: roomRef.id,
                participant_count: participantIds.length
            });

        } catch (error) {
            console.error('Error creating league chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Create a team chat room
 * POST: { league_id, team_id, admin_pin }
 */
exports.createTeamChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, team_id, admin_pin } = req.body;

            if (!league_id || !team_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: league_id, team_id, admin_pin'
                });
            }

            // Verify admin access
            if (!await checkLeagueAdminAccess(league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            // Get team data
            const teamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(team_id).get();

            if (!teamDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Team not found'
                });
            }
            const team = teamDoc.data();

            // Check if team chat already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('league_id', '==', league_id)
                .where('team_id', '==', team_id)
                .where('type', '==', 'team')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                return res.json({
                    success: true,
                    room_id: existingRoom.docs[0].id,
                    message: 'Team chat room already exists'
                });
            }

            // Get team player IDs
            const participantIds = team.player_ids || [];
            if (team.captain_id && !participantIds.includes(team.captain_id)) {
                participantIds.push(team.captain_id);
            }

            // Captain is admin of team chat
            const adminIds = team.captain_id ? [team.captain_id] : [];

            // Create chat room
            const roomRef = await db.collection('chat_rooms').add({
                type: 'team',
                name: `${team.name} Team Chat`,
                league_id: league_id,
                team_id: team_id,
                match_id: null,
                participants: participantIds,
                participant_count: participantIds.length,
                admins: adminIds,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_count: {},
                status: 'active'
            });

            // Add system message
            await roomRef.collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: `Welcome to ${team.name} team chat! Coordinate with your teammates here.`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            res.json({
                success: true,
                room_id: roomRef.id,
                participant_count: participantIds.length
            });

        } catch (error) {
            console.error('Error creating team chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Create a match chat room
 * POST: { league_id, match_id, admin_pin }
 */
exports.createMatchChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, match_id, admin_pin } = req.body;

            if (!league_id || !match_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: league_id, match_id, admin_pin'
                });
            }

            // Verify admin access
            if (!await checkLeagueAdminAccess(league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            // Get match data
            const matchDoc = await db.collection('leagues').doc(league_id)
                .collection('matches').doc(match_id).get();

            if (!matchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }
            const match = matchDoc.data();

            // Check if match chat already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('match_id', '==', match_id)
                .where('type', '==', 'match')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                return res.json({
                    success: true,
                    room_id: existingRoom.docs[0].id,
                    message: 'Match chat room already exists'
                });
            }

            // Get players from both teams
            const homeTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.away_team_id).get();

            const homeTeam = homeTeamDoc.exists ? homeTeamDoc.data() : {};
            const awayTeam = awayTeamDoc.exists ? awayTeamDoc.data() : {};

            const participantIds = [
                ...(homeTeam.player_ids || []),
                ...(awayTeam.player_ids || [])
            ];

            // Both captains are admins
            const adminIds = [homeTeam.captain_id, awayTeam.captain_id].filter(Boolean);

            const roomName = `Week ${match.week}: ${homeTeam.name || 'Home'} vs ${awayTeam.name || 'Away'}`;

            // Create chat room
            const roomRef = await db.collection('chat_rooms').add({
                type: 'match',
                name: roomName,
                league_id: league_id,
                team_id: null,
                match_id: match_id,
                week: match.week,
                home_team_id: match.home_team_id,
                away_team_id: match.away_team_id,
                participants: participantIds,
                participant_count: participantIds.length,
                admins: adminIds,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_count: {},
                status: 'active'
            });

            // Add system message
            await roomRef.collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: `Match chat for ${roomName}. Good luck to both teams!`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            res.json({
                success: true,
                room_id: roomRef.id,
                participant_count: participantIds.length
            });

        } catch (error) {
            console.error('Error creating match chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// CHAT ROOM MESSAGING
// ============================================================================

/**
 * Send a message to a chat room
 * POST: { room_id, sender_pin, text }
 */
exports.sendChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, sender_pin, text } = req.body;

            if (!room_id || !sender_pin || !text) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, sender_pin, text'
                });
            }

            // Validate text length
            if (text.length > 2000) {
                return res.status(400).json({
                    success: false,
                    error: 'Message too long (max 2000 characters)'
                });
            }

            // Verify sender
            const sender = await verifyPlayerPin(sender_pin);
            if (!sender) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            const room = roomDoc.data();

            // Verify sender is participant
            if (!room.participants.includes(sender.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not a participant in this chat room'
                });
            }

            // Check room is active
            if (room.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'This chat room is archived'
                });
            }

            const senderName = sender.name || `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Unknown';
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            // Create message
            const messageData = {
                sender_id: sender.id,
                sender_name: senderName,
                sender_photo: sender.photo_url || null,
                text: text,
                timestamp: timestamp,
                type: 'text',
                pinned: false
            };

            // Use batch for atomic operations
            const batch = db.batch();

            // Add message
            const messageRef = db.collection('chat_rooms').doc(room_id).collection('messages').doc();
            batch.set(messageRef, messageData);

            // Update room with last message and increment unread for all other participants
            const unreadUpdates = {};
            room.participants.forEach(participantId => {
                if (participantId !== sender.id) {
                    unreadUpdates[`unread_count.${participantId}`] = admin.firestore.FieldValue.increment(1);
                }
            });

            batch.update(db.collection('chat_rooms').doc(room_id), {
                last_message: {
                    text: text,
                    sender_id: sender.id,
                    sender_name: senderName,
                    timestamp: timestamp
                },
                ...unreadUpdates,
                updated_at: timestamp
            });

            await batch.commit();

            // Queue notifications (async)
            queueChatRoomNotification(
                room_id,
                room.name,
                room.type,
                sender.id,
                senderName,
                text,
                room.participants
            );

            res.json({
                success: true,
                message_id: messageRef.id
            });

        } catch (error) {
            console.error('Error sending chat message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get messages from a chat room
 * POST: { room_id, player_pin, limit?, before_timestamp? }
 */
exports.getChatRoomMessages = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, player_pin, limit = 50, before_timestamp } = req.body;

            if (!room_id || !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, player_pin'
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

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            const room = roomDoc.data();

            // Verify player is participant
            if (!room.participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Build query
            let query = db.collection('chat_rooms').doc(room_id)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(parseInt(limit));

            if (before_timestamp) {
                query = query.startAfter(new Date(before_timestamp));
            }

            const messagesSnapshot = await query.get();

            const messages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
                is_own: doc.data().sender_id === player.id
            }));

            // Mark room as read for this player
            await db.collection('chat_rooms').doc(room_id).update({
                [`unread_count.${player.id}`]: 0
            });

            // Update player's last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                messages: messages.reverse(),
                room: {
                    id: room_id,
                    name: room.name,
                    type: room.type,
                    participant_count: room.participant_count,
                    status: room.status
                },
                has_more: messages.length === parseInt(limit)
            });

        } catch (error) {
            console.error('Error getting chat room messages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get all chat rooms for a player
 * POST: { player_pin }
 */
exports.getPlayerChatRooms = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
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

            // Get all rooms player is participant in
            const roomsSnapshot = await db.collection('chat_rooms')
                .where('participants', 'array-contains', player.id)
                .orderBy('updated_at', 'desc')
                .get();

            // Group by type
            const rooms = {
                league: [],
                team: [],
                match: []
            };

            roomsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                const roomData = {
                    id: doc.id,
                    name: data.name,
                    type: data.type,
                    league_id: data.league_id,
                    team_id: data.team_id,
                    match_id: data.match_id,
                    week: data.week || null,
                    participant_count: data.participant_count,
                    unread_count: data.unread_count?.[player.id] || 0,
                    last_message: data.last_message || null,
                    status: data.status,
                    updated_at: data.updated_at?.toDate?.()?.toISOString() || null
                };

                if (data.type === 'league') {
                    rooms.league.push(roomData);
                } else if (data.type === 'team') {
                    rooms.team.push(roomData);
                } else if (data.type === 'match') {
                    // Only show active match chats
                    if (data.status === 'active') {
                        rooms.match.push(roomData);
                    }
                }
            });

            // Update player's last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                rooms: rooms,
                player_id: player.id
            });

        } catch (error) {
            console.error('Error getting player chat rooms:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Mark a chat room as read
 * POST: { room_id, player_pin }
 */
exports.markChatRoomRead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, player_pin } = req.body;

            if (!room_id || !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, player_pin'
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

            // Verify player is participant
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            if (!roomDoc.data().participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Mark as read
            await db.collection('chat_rooms').doc(room_id).update({
                [`unread_count.${player.id}`]: 0
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error marking chat room as read:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Archive a chat room (for completed matches)
 * POST: { room_id, admin_pin }
 */
exports.archiveChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, admin_pin } = req.body;

            if (!room_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, admin_pin'
                });
            }

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            const room = roomDoc.data();

            // Verify admin access
            if (!await checkLeagueAdminAccess(room.league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            // Archive the room
            await db.collection('chat_rooms').doc(room_id).update({
                status: 'archived',
                archived_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Add system message
            await db.collection('chat_rooms').doc(room_id).collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: 'This chat has been archived. You can still view messages but cannot send new ones.',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            res.json({
                success: true,
                message: 'Chat room archived'
            });

        } catch (error) {
            console.error('Error archiving chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Pin/unpin a message in a chat room (admins only)
 * POST: { room_id, message_id, player_pin, pinned }
 */
exports.pinChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, message_id, player_pin, pinned } = req.body;

            if (!room_id || !message_id || !player_pin || typeof pinned !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, message_id, player_pin, pinned'
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

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            const room = roomDoc.data();

            // Verify player is admin of room
            if (!room.admins.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Only room admins can pin messages'
                });
            }

            // Update message
            await db.collection('chat_rooms').doc(room_id)
                .collection('messages').doc(message_id)
                .update({ pinned: pinned });

            res.json({
                success: true,
                pinned: pinned
            });

        } catch (error) {
            console.error('Error pinning message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get pinned messages for a chat room
 * POST: { room_id, player_pin }
 */
exports.getPinnedMessages = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, player_pin } = req.body;

            if (!room_id || !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, player_pin'
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

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            // Verify player is participant
            if (!roomDoc.data().participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Get pinned messages
            const pinnedSnapshot = await db.collection('chat_rooms').doc(room_id)
                .collection('messages')
                .where('pinned', '==', true)
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            const pinnedMessages = pinnedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null
            }));

            res.json({
                success: true,
                pinned_messages: pinnedMessages
            });

        } catch (error) {
            console.error('Error getting pinned messages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update chat room participants (when roster changes)
 * POST: { room_id, admin_pin, action: 'add'|'remove', player_ids: [] }
 */
exports.updateRoomParticipants = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, admin_pin, action, player_ids } = req.body;

            if (!room_id || !admin_pin || !action || !player_ids || !Array.isArray(player_ids)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, admin_pin, action, player_ids'
                });
            }

            if (!['add', 'remove'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be "add" or "remove"'
                });
            }

            // Get room
            const roomDoc = await db.collection('chat_rooms').doc(room_id).get();
            if (!roomDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Chat room not found'
                });
            }

            const room = roomDoc.data();

            // Verify admin access
            if (!await checkLeagueAdminAccess(room.league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            let updateData = {};

            if (action === 'add') {
                updateData.participants = admin.firestore.FieldValue.arrayUnion(...player_ids);
                updateData.participant_count = admin.firestore.FieldValue.increment(player_ids.length);
            } else {
                updateData.participants = admin.firestore.FieldValue.arrayRemove(...player_ids);
                updateData.participant_count = admin.firestore.FieldValue.increment(-player_ids.length);
            }

            updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

            await db.collection('chat_rooms').doc(room_id).update(updateData);

            res.json({
                success: true,
                action: action,
                player_ids: player_ids
            });

        } catch (error) {
            console.error('Error updating room participants:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Create all chat rooms for a league (league + teams)
 * POST: { league_id, admin_pin }
 */
exports.createAllLeagueChatRooms = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, admin_pin } = req.body;

            if (!league_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: league_id, admin_pin'
                });
            }

            // Verify admin access
            if (!await checkLeagueAdminAccess(league_id, admin_pin)) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            const results = {
                league_chat: null,
                team_chats: []
            };

            // Get league data
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            const league = leagueDoc.data();

            // Get all league players
            const playersSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players').get();
            const allPlayerIds = playersSnapshot.docs.map(doc => doc.id);

            // Get admin player ID
            const adminPlayer = await verifyPlayerPin(admin_pin);
            const adminIds = adminPlayer ? [adminPlayer.id] : [];

            // Create league chat if doesn't exist
            const existingLeagueChat = await db.collection('chat_rooms')
                .where('league_id', '==', league_id)
                .where('type', '==', 'league')
                .limit(1)
                .get();

            if (existingLeagueChat.empty) {
                const leagueChatRef = await db.collection('chat_rooms').add({
                    type: 'league',
                    name: `${league.name} Chat`,
                    league_id: league_id,
                    team_id: null,
                    match_id: null,
                    participants: allPlayerIds,
                    participant_count: allPlayerIds.length,
                    admins: adminIds,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_message: null,
                    unread_count: {},
                    status: 'active'
                });

                await leagueChatRef.collection('messages').add({
                    sender_id: 'system',
                    sender_name: 'System',
                    text: `Welcome to ${league.name} chat!`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'system',
                    pinned: false
                });

                results.league_chat = leagueChatRef.id;
            } else {
                results.league_chat = existingLeagueChat.docs[0].id;
            }

            // Create team chats
            const teamsSnapshot = await db.collection('leagues').doc(league_id)
                .collection('teams').get();

            for (const teamDoc of teamsSnapshot.docs) {
                const team = teamDoc.data();
                const teamId = teamDoc.id;

                // Check if team chat exists
                const existingTeamChat = await db.collection('chat_rooms')
                    .where('league_id', '==', league_id)
                    .where('team_id', '==', teamId)
                    .where('type', '==', 'team')
                    .limit(1)
                    .get();

                if (existingTeamChat.empty) {
                    const participantIds = team.player_ids || [];
                    if (team.captain_id && !participantIds.includes(team.captain_id)) {
                        participantIds.push(team.captain_id);
                    }

                    const teamChatRef = await db.collection('chat_rooms').add({
                        type: 'team',
                        name: `${team.name} Team Chat`,
                        league_id: league_id,
                        team_id: teamId,
                        match_id: null,
                        participants: participantIds,
                        participant_count: participantIds.length,
                        admins: team.captain_id ? [team.captain_id] : [],
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                        updated_at: admin.firestore.FieldValue.serverTimestamp(),
                        last_message: null,
                        unread_count: {},
                        status: 'active'
                    });

                    await teamChatRef.collection('messages').add({
                        sender_id: 'system',
                        sender_name: 'System',
                        text: `Welcome to ${team.name} team chat!`,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'system',
                        pinned: false
                    });

                    results.team_chats.push({
                        team_id: teamId,
                        team_name: team.name,
                        room_id: teamChatRef.id
                    });
                } else {
                    results.team_chats.push({
                        team_id: teamId,
                        team_name: team.name,
                        room_id: existingTeamChat.docs[0].id,
                        existing: true
                    });
                }
            }

            res.json({
                success: true,
                results: results
            });

        } catch (error) {
            console.error('Error creating league chat rooms:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
