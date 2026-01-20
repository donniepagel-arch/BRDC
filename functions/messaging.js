/**
 * BRDC Messaging System - Direct Messages
 * Handles player-to-player messaging with real-time updates
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
 * Generate conversation ID from two player IDs (sorted for consistency)
 */
function getConversationId(playerId1, playerId2) {
    return [playerId1, playerId2].sort().join('_');
}

/**
 * Queue notification for offline player
 */
async function queueMessageNotification(recipientId, senderId, senderName, messagePreview, conversationId) {
    try {
        // Get recipient data
        const recipientDoc = await db.collection('players').doc(recipientId).get();
        if (!recipientDoc.exists) return;

        const recipient = recipientDoc.data();

        // Check recipient's messaging preferences
        const prefs = recipient.messaging_preferences || {};
        if (prefs.dm_notifications === 'none') return;

        // Check if recipient is online (active in last 5 minutes)
        const lastSeen = recipient.last_seen_at?.toDate?.() || new Date(0);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        if (lastSeen > fiveMinutesAgo) {
            // User is online, skip notification
            return;
        }

        // Queue notification
        await db.collection('message_notifications').add({
            recipient_id: recipientId,
            recipient_phone: recipient.phone || null,
            recipient_email: recipient.email || null,
            source_type: 'dm',
            source_id: conversationId,
            source_name: senderName,
            sender_id: senderId,
            sender_name: senderName,
            message_preview: messagePreview.substring(0, 100),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            digest_sent: false,
            priority: 'normal'
        });
    } catch (error) {
        console.error('Error queueing notification:', error);
    }
}

// ============================================================================
// DIRECT MESSAGE FUNCTIONS
// ============================================================================

/**
 * Send a direct message to another player
 * POST: { sender_pin, recipient_id, text }
 */
exports.sendDirectMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { sender_pin, recipient_id, text } = req.body;

            // Validate required fields
            if (!sender_pin || !recipient_id || !text) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: sender_pin, recipient_id, text'
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

            // Prevent self-messaging
            if (sender.id === recipient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot send message to yourself'
                });
            }

            // Verify recipient exists
            const recipientDoc = await db.collection('players').doc(recipient_id).get();
            if (!recipientDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Recipient not found'
                });
            }
            const recipient = recipientDoc.data();

            // Get or create conversation
            const conversationId = getConversationId(sender.id, recipient_id);
            const conversationRef = db.collection('conversations').doc(conversationId);
            const conversationDoc = await conversationRef.get();

            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const senderName = sender.name || `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Unknown';
            const recipientName = recipient.name || `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || 'Unknown';

            // Create message
            const messageData = {
                sender_id: sender.id,
                sender_name: senderName,
                sender_photo: sender.photo_url || null,
                text: text,
                timestamp: timestamp,
                read_by: [sender.id],
                type: 'text'
            };

            // Use batch for atomic operations
            const batch = db.batch();

            // Add message to subcollection
            const messageRef = conversationRef.collection('messages').doc();
            batch.set(messageRef, messageData);

            // Update or create conversation
            if (conversationDoc.exists) {
                // Update existing conversation
                const currentUnread = conversationDoc.data().unread_count || {};
                batch.update(conversationRef, {
                    last_message: {
                        text: text,
                        sender_id: sender.id,
                        sender_name: senderName,
                        timestamp: timestamp
                    },
                    [`unread_count.${recipient_id}`]: (currentUnread[recipient_id] || 0) + 1,
                    updated_at: timestamp
                });
            } else {
                // Create new conversation
                batch.set(conversationRef, {
                    participants: [sender.id, recipient_id].sort(),
                    participant_names: {
                        [sender.id]: senderName,
                        [recipient_id]: recipientName
                    },
                    participant_photos: {
                        [sender.id]: sender.photo_url || null,
                        [recipient_id]: recipient.photo_url || null
                    },
                    last_message: {
                        text: text,
                        sender_id: sender.id,
                        sender_name: senderName,
                        timestamp: timestamp
                    },
                    unread_count: {
                        [sender.id]: 0,
                        [recipient_id]: 1
                    },
                    created_at: timestamp,
                    updated_at: timestamp
                });
            }

            await batch.commit();

            // Queue notification for offline recipient (async, don't wait)
            queueMessageNotification(recipient_id, sender.id, senderName, text, conversationId);

            res.json({
                success: true,
                message_id: messageRef.id,
                conversation_id: conversationId
            });

        } catch (error) {
            console.error('Error sending direct message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get all conversations for a player
 * POST: { player_pin }
 */
exports.getConversations = functions.https.onRequest((req, res) => {
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

            // Get conversations where player is a participant
            const conversationsSnapshot = await db.collection('conversations')
                .where('participants', 'array-contains', player.id)
                .orderBy('updated_at', 'desc')
                .limit(50)
                .get();

            const conversations = conversationsSnapshot.docs.map(doc => {
                const data = doc.data();

                // Find the other participant
                const otherParticipantId = data.participants.find(p => p !== player.id);

                return {
                    id: doc.id,
                    other_participant: {
                        id: otherParticipantId,
                        name: data.participant_names?.[otherParticipantId] || 'Unknown',
                        photo: data.participant_photos?.[otherParticipantId] || null
                    },
                    last_message: data.last_message || null,
                    unread_count: data.unread_count?.[player.id] || 0,
                    updated_at: data.updated_at?.toDate?.()?.toISOString() || null
                };
            });

            // Update player's last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                conversations: conversations,
                player_id: player.id
            });

        } catch (error) {
            console.error('Error getting conversations:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get messages for a specific conversation
 * POST: { player_pin, conversation_id, limit?, before_timestamp? }
 */
exports.getConversationMessages = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, conversation_id, limit = 50, before_timestamp } = req.body;

            if (!player_pin || !conversation_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, conversation_id'
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

            // Verify player is participant in conversation
            const conversationDoc = await db.collection('conversations').doc(conversation_id).get();
            if (!conversationDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }

            const conversationData = conversationDoc.data();
            if (!conversationData.participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Build query
            let query = db.collection('conversations').doc(conversation_id)
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

            // Mark conversation as read for this player
            await db.collection('conversations').doc(conversation_id).update({
                [`unread_count.${player.id}`]: 0
            });

            // Update player's last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Get other participant info
            const otherParticipantId = conversationData.participants.find(p => p !== player.id);

            res.json({
                success: true,
                messages: messages.reverse(), // Return in chronological order
                conversation: {
                    id: conversation_id,
                    other_participant: {
                        id: otherParticipantId,
                        name: conversationData.participant_names?.[otherParticipantId] || 'Unknown',
                        photo: conversationData.participant_photos?.[otherParticipantId] || null
                    }
                },
                has_more: messages.length === parseInt(limit)
            });

        } catch (error) {
            console.error('Error getting conversation messages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Mark a conversation as read
 * POST: { player_pin, conversation_id }
 */
exports.markConversationRead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, conversation_id } = req.body;

            if (!player_pin || !conversation_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, conversation_id'
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
            const conversationDoc = await db.collection('conversations').doc(conversation_id).get();
            if (!conversationDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }

            if (!conversationDoc.data().participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Mark as read
            await db.collection('conversations').doc(conversation_id).update({
                [`unread_count.${player.id}`]: 0
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error marking conversation as read:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Start a new conversation (or get existing)
 * POST: { initiator_pin, recipient_id }
 */
exports.startConversation = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { initiator_pin, recipient_id } = req.body;

            if (!initiator_pin || !recipient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: initiator_pin, recipient_id'
                });
            }

            // Verify initiator
            const initiator = await verifyPlayerPin(initiator_pin);
            if (!initiator) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Prevent self-conversation
            if (initiator.id === recipient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot start conversation with yourself'
                });
            }

            // Verify recipient exists
            const recipientDoc = await db.collection('players').doc(recipient_id).get();
            if (!recipientDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Recipient not found'
                });
            }
            const recipient = recipientDoc.data();

            // Check if conversation already exists
            const conversationId = getConversationId(initiator.id, recipient_id);
            const conversationRef = db.collection('conversations').doc(conversationId);
            const conversationDoc = await conversationRef.get();

            if (conversationDoc.exists) {
                // Return existing conversation
                const data = conversationDoc.data();
                return res.json({
                    success: true,
                    conversation_id: conversationId,
                    is_new: false,
                    recipient: {
                        id: recipient_id,
                        name: data.participant_names?.[recipient_id] || 'Unknown',
                        photo: data.participant_photos?.[recipient_id] || null
                    }
                });
            }

            // Create new conversation (without any messages yet)
            const initiatorName = initiator.name || `${initiator.first_name || ''} ${initiator.last_name || ''}`.trim() || 'Unknown';
            const recipientName = recipient.name || `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || 'Unknown';

            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            await conversationRef.set({
                participants: [initiator.id, recipient_id].sort(),
                participant_names: {
                    [initiator.id]: initiatorName,
                    [recipient_id]: recipientName
                },
                participant_photos: {
                    [initiator.id]: initiator.photo_url || null,
                    [recipient_id]: recipient.photo_url || null
                },
                last_message: null,
                unread_count: {
                    [initiator.id]: 0,
                    [recipient_id]: 0
                },
                created_at: timestamp,
                updated_at: timestamp
            });

            res.json({
                success: true,
                conversation_id: conversationId,
                is_new: true,
                recipient: {
                    id: recipient_id,
                    name: recipientName,
                    photo: recipient.photo_url || null
                }
            });

        } catch (error) {
            console.error('Error starting conversation:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get total unread message count for a player
 * POST: { player_pin }
 */
exports.getUnreadCount = functions.https.onRequest((req, res) => {
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

            // Get all conversations for this player
            const conversationsSnapshot = await db.collection('conversations')
                .where('participants', 'array-contains', player.id)
                .get();

            let totalUnread = 0;
            conversationsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                totalUnread += data.unread_count?.[player.id] || 0;
            });

            // Also check chat rooms
            const chatRoomsSnapshot = await db.collection('chat_rooms')
                .where('participants', 'array-contains', player.id)
                .where('status', '==', 'active')
                .get();

            let chatRoomUnread = 0;
            chatRoomsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                chatRoomUnread += data.unread_count?.[player.id] || 0;
            });

            res.json({
                success: true,
                dm_unread: totalUnread,
                chat_room_unread: chatRoomUnread,
                total_unread: totalUnread + chatRoomUnread
            });

        } catch (error) {
            console.error('Error getting unread count:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Search players to start a conversation with
 * POST: { player_pin, search_query, league_id? }
 */
exports.searchPlayersForChat = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, search_query, league_id } = req.body;

            if (!player_pin || !search_query) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, search_query'
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

            const searchLower = search_query.toLowerCase();
            let players = [];

            if (league_id) {
                // Search within league players
                const leaguePlayersSnapshot = await db.collection('leagues').doc(league_id)
                    .collection('players').get();

                players = leaguePlayersSnapshot.docs
                    .filter(doc => {
                        const data = doc.data();
                        const name = (data.name || '').toLowerCase();
                        return name.includes(searchLower) && doc.id !== player.id;
                    })
                    .map(doc => ({
                        id: doc.id,
                        name: doc.data().name,
                        photo: doc.data().photo_url || null,
                        team_name: doc.data().team_name || null
                    }))
                    .slice(0, 20);
            } else {
                // Search global players
                const globalPlayersSnapshot = await db.collection('players')
                    .limit(200)
                    .get();

                players = globalPlayersSnapshot.docs
                    .filter(doc => {
                        const data = doc.data();
                        const name = (data.name || `${data.first_name || ''} ${data.last_name || ''}`).toLowerCase();
                        return name.includes(searchLower) && doc.id !== player.id;
                    })
                    .map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                            photo: data.photo_url || null
                        };
                    })
                    .slice(0, 20);
            }

            res.json({
                success: true,
                players: players
            });

        } catch (error) {
            console.error('Error searching players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player's messaging preferences
 * POST: { player_pin, preferences }
 */
exports.updateMessagingPreferences = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, preferences } = req.body;

            if (!player_pin || !preferences) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, preferences'
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

            // Validate preferences
            const validDmOptions = ['all', 'digest_only', 'none'];
            const validChatOptions = ['all', 'mentions_only', 'digest_only', 'none'];
            const validDigestFrequency = ['daily', 'weekly', 'off'];

            const cleanPrefs = {};

            if (preferences.dm_notifications && validDmOptions.includes(preferences.dm_notifications)) {
                cleanPrefs.dm_notifications = preferences.dm_notifications;
            }
            if (preferences.chat_notifications && validChatOptions.includes(preferences.chat_notifications)) {
                cleanPrefs.chat_notifications = preferences.chat_notifications;
            }
            if (preferences.digest_frequency && validDigestFrequency.includes(preferences.digest_frequency)) {
                cleanPrefs.digest_frequency = preferences.digest_frequency;
            }
            if (typeof preferences.sms_enabled === 'boolean') {
                cleanPrefs.sms_enabled = preferences.sms_enabled;
            }

            // Update player document
            await db.collection('players').doc(player.id).update({
                messaging_preferences: cleanPrefs,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                preferences: cleanPrefs
            });

        } catch (error) {
            console.error('Error updating messaging preferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
