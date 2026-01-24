/**
 * BRDC Chat System - Discord-like Channels
 * Handles channels, messages, reactions, and presence for a real-time chat experience
 *
 * Collections:
 * - /chat_channels/{channelId} - Channel metadata
 * - /chat_channels/{channelId}/messages/{messageId} - Messages in channel
 * - /chat_channels/{channelId}/members/{playerId} - Channel membership
 * - /chat_channels/{channelId}/typing/{playerId} - Typing indicators
 */

const functions = require('firebase-functions');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify player PIN and return player data
 * Uses ID-based lookup, never names
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
 * Check if player is a member of a channel
 */
async function isChannelMember(channelId, playerId) {
    const memberDoc = await db.collection('chat_channels')
        .doc(channelId)
        .collection('members')
        .doc(playerId)
        .get();

    return memberDoc.exists && memberDoc.data().status === 'active';
}

/**
 * Check if player has admin access to a channel
 */
async function hasChannelAdminAccess(channelId, playerId) {
    const channelDoc = await db.collection('chat_channels').doc(channelId).get();
    if (!channelDoc.exists) return false;

    const channel = channelDoc.data();

    // Check if player is the creator
    if (channel.created_by === playerId) return true;

    // Check if player is an admin
    if (channel.admins && channel.admins.includes(playerId)) return true;

    // For league channels, check if player is league director
    if (channel.type === 'league' && channel.league_id) {
        const leagueDoc = await db.collection('leagues').doc(channel.league_id).get();
        if (leagueDoc.exists) {
            const league = leagueDoc.data();
            if (league.director_id === playerId) return true;
        }
    }

    return false;
}

/**
 * Generate a unique channel ID based on type
 */
function generateChannelId(type, contextId) {
    if (type === 'dm') {
        // DM channels use sorted player IDs to ensure uniqueness
        return `dm_${contextId}`;
    }
    return `${type}_${contextId}_${Date.now()}`;
}

/**
 * Parse @mentions from message text
 * Returns array of player IDs that were mentioned
 */
async function parseMentions(text, channelId) {
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const mentions = [];
    let match;

    // Get channel members for matching
    const membersSnapshot = await db.collection('chat_channels')
        .doc(channelId)
        .collection('members')
        .where('status', '==', 'active')
        .get();

    const members = {};
    membersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.player_name) {
            members[data.player_name.toLowerCase()] = doc.id;
            // Also check first name only
            const firstName = data.player_name.split(' ')[0].toLowerCase();
            if (!members[firstName]) {
                members[firstName] = doc.id;
            }
        }
    });

    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionedName = match[1].toLowerCase();
        if (members[mentionedName]) {
            mentions.push(members[mentionedName]);
        }
    }

    return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Sanitize message content
 */
function sanitizeMessage(text) {
    if (!text || typeof text !== 'string') return '';
    // Trim, limit length, remove excessive whitespace
    return text.trim().slice(0, 2000).replace(/\s+/g, ' ');
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

/**
 * Create a chat channel
 * Types: 'league', 'team', 'match', 'dm', 'general'
 *
 * POST /createChatChannel
 * Body: {
 *   player_pin,
 *   type,
 *   name,
 *   league_id?,
 *   team_id?,
 *   match_id?,
 *   participant_ids? (for DMs),
 *   is_private?
 * }
 */
exports.createChatChannel = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                type,
                name,
                league_id,
                team_id,
                match_id,
                participant_ids,
                is_private = false,
                description = ''
            } = req.body;

            // Validate required fields
            if (!player_pin || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, type'
                });
            }

            // Verify player
            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Validate channel type
            const validTypes = ['league', 'team', 'match', 'dm', 'general'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid channel type. Must be: league, team, match, dm, or general'
                });
            }

            // For DM channels, check if one already exists between these participants
            if (type === 'dm') {
                if (!participant_ids || participant_ids.length !== 2) {
                    return res.status(400).json({
                        success: false,
                        error: 'DM channels require exactly 2 participant_ids'
                    });
                }

                // Ensure current player is one of the participants
                if (!participant_ids.includes(player.id)) {
                    return res.status(403).json({
                        success: false,
                        error: 'You must be a participant in the DM'
                    });
                }

                // Check for existing DM channel between these users
                const sortedIds = [...participant_ids].sort();
                const existingChannels = await db.collection('chat_channels')
                    .where('type', '==', 'dm')
                    .where('participant_ids_sorted', '==', sortedIds.join('_'))
                    .limit(1)
                    .get();

                if (!existingChannels.empty) {
                    const existingChannel = existingChannels.docs[0];
                    return res.json({
                        success: true,
                        channel_id: existingChannel.id,
                        already_exists: true
                    });
                }
            }

            // For league/team/match channels, verify context exists
            if (type === 'league' && league_id) {
                const leagueDoc = await db.collection('leagues').doc(league_id).get();
                if (!leagueDoc.exists) {
                    return res.status(404).json({ success: false, error: 'League not found' });
                }
            }

            if (type === 'team' && league_id && team_id) {
                const teamDoc = await db.collection('leagues').doc(league_id)
                    .collection('teams').doc(team_id).get();
                if (!teamDoc.exists) {
                    return res.status(404).json({ success: false, error: 'Team not found' });
                }
            }

            if (type === 'match' && league_id && match_id) {
                const matchDoc = await db.collection('leagues').doc(league_id)
                    .collection('matches').doc(match_id).get();
                if (!matchDoc.exists) {
                    return res.status(404).json({ success: false, error: 'Match not found' });
                }
            }

            // Generate channel ID
            let contextId;
            if (type === 'dm') {
                contextId = [...participant_ids].sort().join('_');
            } else if (type === 'league') {
                contextId = league_id;
            } else if (type === 'team') {
                contextId = `${league_id}_${team_id}`;
            } else if (type === 'match') {
                contextId = `${league_id}_${match_id}`;
            } else {
                contextId = Date.now().toString();
            }

            const channelId = generateChannelId(type, contextId);

            // Create channel document
            const channelData = {
                type,
                name: name || (type === 'dm' ? 'Direct Message' : `${type} Channel`),
                description: description.slice(0, 500),
                created_by: player.id,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                is_private,
                member_count: type === 'dm' ? 2 : 1,
                message_count: 0,
                last_message_at: null,
                last_message_preview: null,
                admins: [player.id]
            };

            // Add context-specific fields
            if (league_id) channelData.league_id = league_id;
            if (team_id) channelData.team_id = team_id;
            if (match_id) channelData.match_id = match_id;
            if (type === 'dm' && participant_ids) {
                channelData.participant_ids = participant_ids;
                channelData.participant_ids_sorted = [...participant_ids].sort().join('_');
            }

            // Use batch write for atomicity
            const batch = db.batch();

            // Create channel
            const channelRef = db.collection('chat_channels').doc(channelId);
            batch.set(channelRef, channelData);

            // Add creator as member
            const creatorMemberRef = channelRef.collection('members').doc(player.id);
            batch.set(creatorMemberRef, {
                player_id: player.id,
                player_name: player.name || `${player.first_name} ${player.last_name}`,
                joined_at: admin.firestore.FieldValue.serverTimestamp(),
                role: 'admin',
                status: 'active',
                unread_count: 0,
                last_read_at: admin.firestore.FieldValue.serverTimestamp(),
                notifications_enabled: true
            });

            // For DM channels, add the other participant
            if (type === 'dm' && participant_ids) {
                const otherParticipantId = participant_ids.find(id => id !== player.id);
                if (otherParticipantId) {
                    const otherPlayerDoc = await db.collection('players').doc(otherParticipantId).get();
                    if (otherPlayerDoc.exists) {
                        const otherPlayer = otherPlayerDoc.data();
                        const otherMemberRef = channelRef.collection('members').doc(otherParticipantId);
                        batch.set(otherMemberRef, {
                            player_id: otherParticipantId,
                            player_name: otherPlayer.name || `${otherPlayer.first_name} ${otherPlayer.last_name}`,
                            joined_at: admin.firestore.FieldValue.serverTimestamp(),
                            role: 'member',
                            status: 'active',
                            unread_count: 0,
                            last_read_at: null,
                            notifications_enabled: true
                        });
                    }
                }
            }

            await batch.commit();

            logger.info(`Channel created: ${channelId} by player ${player.id}`);

            res.json({
                success: true,
                channel_id: channelId,
                channel: {
                    id: channelId,
                    ...channelData,
                    created_at: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Error creating chat channel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Join a channel
 *
 * POST /joinChannel
 * Body: { player_pin, channel_id }
 */
exports.joinChannel = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Check if channel exists
            const channelDoc = await db.collection('chat_channels').doc(channel_id).get();
            if (!channelDoc.exists) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }

            const channel = channelDoc.data();

            // DM channels cannot be joined - they're created with participants
            if (channel.type === 'dm') {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot join DM channels directly'
                });
            }

            // Check if player is already a member
            const memberDoc = await db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id)
                .get();

            if (memberDoc.exists && memberDoc.data().status === 'active') {
                return res.json({
                    success: true,
                    already_member: true,
                    message: 'Already a member of this channel'
                });
            }

            // For private channels, check if player has access
            if (channel.is_private) {
                let hasAccess = false;

                // Check league membership
                if (channel.league_id) {
                    const leaguePlayerDoc = await db.collection('leagues')
                        .doc(channel.league_id)
                        .collection('players')
                        .doc(player.id)
                        .get();
                    if (leaguePlayerDoc.exists) hasAccess = true;
                }

                // Check team membership
                if (channel.team_id && channel.league_id) {
                    const leaguePlayerDoc = await db.collection('leagues')
                        .doc(channel.league_id)
                        .collection('players')
                        .doc(player.id)
                        .get();
                    if (leaguePlayerDoc.exists && leaguePlayerDoc.data().team_id === channel.team_id) {
                        hasAccess = true;
                    }
                }

                if (!hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: 'This is a private channel. You do not have access.'
                    });
                }
            }

            const batch = db.batch();

            // Add or reactivate membership
            const memberRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id);

            batch.set(memberRef, {
                player_id: player.id,
                player_name: player.name || `${player.first_name} ${player.last_name}`,
                joined_at: admin.firestore.FieldValue.serverTimestamp(),
                role: 'member',
                status: 'active',
                unread_count: 0,
                last_read_at: admin.firestore.FieldValue.serverTimestamp(),
                notifications_enabled: true
            }, { merge: true });

            // Increment member count
            const channelRef = db.collection('chat_channels').doc(channel_id);
            batch.update(channelRef, {
                member_count: admin.firestore.FieldValue.increment(1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            logger.info(`Player ${player.id} joined channel ${channel_id}`);

            res.json({
                success: true,
                message: 'Successfully joined channel',
                channel_id
            });

        } catch (error) {
            logger.error('Error joining channel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Leave a channel
 *
 * POST /leaveChannel
 * Body: { player_pin, channel_id }
 */
exports.leaveChannel = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const channelDoc = await db.collection('chat_channels').doc(channel_id).get();
            if (!channelDoc.exists) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }

            const channel = channelDoc.data();

            // Cannot leave DM channels - they persist
            if (channel.type === 'dm') {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot leave DM channels'
                });
            }

            // Check if player is a member
            const memberDoc = await db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id)
                .get();

            if (!memberDoc.exists || memberDoc.data().status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'Not a member of this channel'
                });
            }

            const batch = db.batch();

            // Mark membership as inactive (soft delete for history)
            const memberRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id);

            batch.update(memberRef, {
                status: 'left',
                left_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Decrement member count
            const channelRef = db.collection('chat_channels').doc(channel_id);
            batch.update(channelRef, {
                member_count: admin.firestore.FieldValue.increment(-1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();

            logger.info(`Player ${player.id} left channel ${channel_id}`);

            res.json({
                success: true,
                message: 'Successfully left channel'
            });

        } catch (error) {
            logger.error('Error leaving channel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// MESSAGING
// ============================================================================

/**
 * Send a message to a channel
 *
 * POST /sendChatMessage
 * Body: {
 *   player_pin,
 *   channel_id,
 *   content,
 *   reply_to_message_id?,
 *   attachments?
 * }
 */
exports.sendChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                channel_id,
                content,
                reply_to_message_id,
                attachments = []
            } = req.body;

            // Validate required fields
            if (!player_pin || !channel_id || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id, content'
                });
            }

            // Verify player
            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Check channel exists
            const channelDoc = await db.collection('chat_channels').doc(channel_id).get();
            if (!channelDoc.exists) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }

            // Check player is a member
            const isMember = await isChannelMember(channel_id, player.id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    error: 'You must be a member of this channel to send messages'
                });
            }

            // Sanitize content
            const sanitizedContent = sanitizeMessage(content);
            if (!sanitizedContent) {
                return res.status(400).json({
                    success: false,
                    error: 'Message content cannot be empty'
                });
            }

            // Parse mentions
            const mentions = await parseMentions(sanitizedContent, channel_id);

            // Validate reply_to if provided
            let replyToData = null;
            if (reply_to_message_id) {
                const replyToDoc = await db.collection('chat_channels')
                    .doc(channel_id)
                    .collection('messages')
                    .doc(reply_to_message_id)
                    .get();

                if (replyToDoc.exists) {
                    const replyTo = replyToDoc.data();
                    replyToData = {
                        message_id: reply_to_message_id,
                        sender_id: replyTo.sender_id,
                        sender_name: replyTo.sender_name,
                        content_preview: replyTo.content.slice(0, 100)
                    };
                }
            }

            // Create message document
            const messageId = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .doc().id;

            const messageData = {
                message_id: messageId,
                channel_id,
                sender_id: player.id,
                sender_name: player.name || `${player.first_name} ${player.last_name}`,
                content: sanitizedContent,
                mentions,
                attachments: attachments.slice(0, 10), // Max 10 attachments
                reactions: {},
                reply_to: replyToData,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                edited_at: null,
                is_edited: false,
                is_deleted: false
            };

            const batch = db.batch();

            // Create message
            const messageRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .doc(messageId);
            batch.set(messageRef, messageData);

            // Update channel metadata
            const contentPreview = sanitizedContent.slice(0, 50) + (sanitizedContent.length > 50 ? '...' : '');
            const channelRef = db.collection('chat_channels').doc(channel_id);
            batch.update(channelRef, {
                message_count: admin.firestore.FieldValue.increment(1),
                last_message_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message_preview: contentPreview,
                last_message_sender_id: player.id,
                last_message_sender_name: player.name || `${player.first_name} ${player.last_name}`,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update sender's last_read_at
            const senderMemberRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id);
            batch.update(senderMemberRef, {
                last_read_at: admin.firestore.FieldValue.serverTimestamp(),
                unread_count: 0
            });

            // Increment unread count for other members
            const membersSnapshot = await db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .where('status', '==', 'active')
                .get();

            membersSnapshot.forEach(doc => {
                if (doc.id !== player.id) {
                    batch.update(doc.ref, {
                        unread_count: admin.firestore.FieldValue.increment(1)
                    });
                }
            });

            // Clear typing indicator for sender
            const typingRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('typing')
                .doc(player.id);
            batch.delete(typingRef);

            await batch.commit();

            logger.info(`Message sent to channel ${channel_id} by player ${player.id}`);

            res.json({
                success: true,
                message_id: messageId,
                message: {
                    ...messageData,
                    created_at: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error('Error sending chat message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get messages from a channel with pagination
 *
 * POST /getChannelMessages
 * Body: { player_pin, channel_id, limit?, before_message_id?, after_message_id? }
 */
exports.getChannelMessages = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                channel_id,
                limit = 50,
                before_message_id,
                after_message_id
            } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Check player is a member
            const isMember = await isChannelMember(channel_id, player.id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    error: 'You must be a member of this channel to view messages'
                });
            }

            // Build query
            let query = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .where('is_deleted', '==', false)
                .orderBy('created_at', 'desc')
                .limit(Math.min(limit, 100)); // Max 100 messages per request

            // Pagination cursor
            if (before_message_id) {
                const beforeDoc = await db.collection('chat_channels')
                    .doc(channel_id)
                    .collection('messages')
                    .doc(before_message_id)
                    .get();

                if (beforeDoc.exists) {
                    query = query.startAfter(beforeDoc);
                }
            } else if (after_message_id) {
                const afterDoc = await db.collection('chat_channels')
                    .doc(channel_id)
                    .collection('messages')
                    .doc(after_message_id)
                    .get();

                if (afterDoc.exists) {
                    query = db.collection('chat_channels')
                        .doc(channel_id)
                        .collection('messages')
                        .where('is_deleted', '==', false)
                        .orderBy('created_at', 'asc')
                        .startAfter(afterDoc)
                        .limit(Math.min(limit, 100));
                }
            }

            const messagesSnapshot = await query.get();

            const messages = [];
            messagesSnapshot.forEach(doc => {
                const data = doc.data();
                messages.push({
                    id: doc.id,
                    ...data,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null,
                    edited_at: data.edited_at?.toDate?.()?.toISOString() || null
                });
            });

            // If we used after_message_id, results are in ascending order - reverse them
            if (after_message_id) {
                messages.reverse();
            }

            // Update last_read_at for the player
            await db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id)
                .update({
                    last_read_at: admin.firestore.FieldValue.serverTimestamp(),
                    unread_count: 0
                });

            res.json({
                success: true,
                messages,
                has_more: messages.length === Math.min(limit, 100)
            });

        } catch (error) {
            logger.error('Error getting channel messages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * React to a message with an emoji
 *
 * POST /reactToMessage
 * Body: { player_pin, channel_id, message_id, emoji, remove? }
 */
exports.reactToMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id, message_id, emoji, remove = false } = req.body;

            if (!player_pin || !channel_id || !message_id || !emoji) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id, message_id, emoji'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Check player is a member
            const isMember = await isChannelMember(channel_id, player.id);
            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    error: 'You must be a member of this channel to react to messages'
                });
            }

            // Validate emoji (basic check - single emoji or emoji shortcode)
            const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|^:\w+:$/u;
            if (!emojiRegex.test(emoji) && emoji.length > 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid emoji format'
                });
            }

            const messageRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .doc(message_id);

            const messageDoc = await messageRef.get();
            if (!messageDoc.exists) {
                return res.status(404).json({ success: false, error: 'Message not found' });
            }

            const message = messageDoc.data();
            const reactions = message.reactions || {};

            // Sanitize emoji key for Firestore (replace colons with underscores)
            const emojiKey = emoji.replace(/:/g, '_');

            if (remove) {
                // Remove reaction
                if (reactions[emojiKey] && reactions[emojiKey].includes(player.id)) {
                    reactions[emojiKey] = reactions[emojiKey].filter(id => id !== player.id);
                    if (reactions[emojiKey].length === 0) {
                        delete reactions[emojiKey];
                    }
                }
            } else {
                // Add reaction
                if (!reactions[emojiKey]) {
                    reactions[emojiKey] = [];
                }
                if (!reactions[emojiKey].includes(player.id)) {
                    reactions[emojiKey].push(player.id);
                }
            }

            await messageRef.update({ reactions });

            res.json({
                success: true,
                reactions,
                action: remove ? 'removed' : 'added'
            });

        } catch (error) {
            logger.error('Error reacting to message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// PRESENCE
// ============================================================================

/**
 * Update user presence (heartbeat)
 * Call every 60 seconds when user is active in chat
 *
 * POST /updateChatPresence
 * Body: { player_pin, channel_id?, status?, device_type? }
 */
exports.updateChatPresence = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id, status = 'online', device_type = 'unknown' } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const presenceStatus = ['online', 'away', 'dnd', 'offline'].includes(status) ? status : 'online';

            // Update global presence
            await db.collection('presence_heartbeats').doc(player.id).set({
                player_id: player.id,
                player_name: player.name || `${player.first_name} ${player.last_name}`,
                status: presenceStatus,
                last_heartbeat: now,
                current_page: channel_id ? `chat:${channel_id}` : 'chat',
                device_type,
                session_started: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Update player document
            await db.collection('players').doc(player.id).update({
                last_seen_at: now,
                'presence.status': presenceStatus,
                'presence.last_seen_at': now,
                'presence.device_type': device_type
            });

            // If in a specific channel, update channel-specific presence
            if (channel_id) {
                const memberRef = db.collection('chat_channels')
                    .doc(channel_id)
                    .collection('members')
                    .doc(player.id);

                const memberDoc = await memberRef.get();
                if (memberDoc.exists && memberDoc.data().status === 'active') {
                    await memberRef.update({
                        last_active_at: now
                    });
                }
            }

            res.json({ success: true, status: presenceStatus });

        } catch (error) {
            logger.error('Error updating chat presence:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Set typing indicator
 *
 * POST /setTypingIndicator
 * Body: { player_pin, channel_id, is_typing }
 */
exports.setTypingIndicator = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id, is_typing = true } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const typingRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('typing')
                .doc(player.id);

            if (is_typing) {
                await typingRef.set({
                    player_id: player.id,
                    player_name: player.name || `${player.first_name} ${player.last_name}`,
                    started_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await typingRef.delete();
            }

            res.json({ success: true, is_typing });

        } catch (error) {
            logger.error('Error setting typing indicator:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// CHANNEL QUERIES
// ============================================================================

/**
 * Get channels for a player
 *
 * POST /getPlayerChannels
 * Body: { player_pin, type?, league_id? }
 */
exports.getPlayerChannels = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, type, league_id } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get all channel memberships for this player
            const membershipQuery = await db.collectionGroup('members')
                .where('player_id', '==', player.id)
                .where('status', '==', 'active')
                .get();

            const channelIds = membershipQuery.docs.map(doc => {
                // Extract channel_id from path: chat_channels/{channelId}/members/{playerId}
                return doc.ref.parent.parent.id;
            });

            if (channelIds.length === 0) {
                return res.json({ success: true, channels: [] });
            }

            // Fetch channel details
            const channels = [];
            const membershipMap = {};

            // Create membership map for unread counts
            membershipQuery.docs.forEach(doc => {
                const channelId = doc.ref.parent.parent.id;
                membershipMap[channelId] = doc.data();
            });

            // Batch fetch channels (Firestore allows max 10 in 'in' query)
            const batches = [];
            for (let i = 0; i < channelIds.length; i += 10) {
                batches.push(channelIds.slice(i, i + 10));
            }

            for (const batch of batches) {
                const channelsSnapshot = await db.collection('chat_channels')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();

                channelsSnapshot.forEach(doc => {
                    const data = doc.data();

                    // Apply filters
                    if (type && data.type !== type) return;
                    if (league_id && data.league_id !== league_id) return;

                    const membership = membershipMap[doc.id] || {};

                    channels.push({
                        id: doc.id,
                        type: data.type,
                        name: data.name,
                        description: data.description,
                        league_id: data.league_id || null,
                        team_id: data.team_id || null,
                        match_id: data.match_id || null,
                        member_count: data.member_count || 0,
                        message_count: data.message_count || 0,
                        unread_count: membership.unread_count || 0,
                        last_message_at: data.last_message_at?.toDate?.()?.toISOString() || null,
                        last_message_preview: data.last_message_preview || null,
                        last_message_sender_name: data.last_message_sender_name || null,
                        is_private: data.is_private || false,
                        created_at: data.created_at?.toDate?.()?.toISOString() || null,
                        // For DMs, include participant info
                        participant_ids: data.participant_ids || null
                    });
                });
            }

            // Sort by last_message_at (most recent first)
            channels.sort((a, b) => {
                if (!a.last_message_at) return 1;
                if (!b.last_message_at) return -1;
                return new Date(b.last_message_at) - new Date(a.last_message_at);
            });

            res.json({ success: true, channels });

        } catch (error) {
            logger.error('Error getting player channels:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get channel details including members
 *
 * POST /getChannelDetails
 * Body: { player_pin, channel_id }
 */
exports.getChannelDetails = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, channel_id'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const channelDoc = await db.collection('chat_channels').doc(channel_id).get();
            if (!channelDoc.exists) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }

            const channel = channelDoc.data();

            // Check if player is a member
            const isMember = await isChannelMember(channel_id, player.id);
            if (!isMember && channel.is_private) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this channel'
                });
            }

            // Get members
            const membersSnapshot = await db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .where('status', '==', 'active')
                .get();

            const members = [];
            membersSnapshot.forEach(doc => {
                const data = doc.data();
                members.push({
                    player_id: doc.id,
                    player_name: data.player_name,
                    role: data.role,
                    joined_at: data.joined_at?.toDate?.()?.toISOString() || null,
                    last_active_at: data.last_active_at?.toDate?.()?.toISOString() || null
                });
            });

            // Get typing indicators
            const typingSnapshot = await db.collection('chat_channels')
                .doc(channel_id)
                .collection('typing')
                .get();

            const typing = [];
            const fiveSecondsAgo = new Date(Date.now() - 5000);

            typingSnapshot.forEach(doc => {
                const data = doc.data();
                const startedAt = data.started_at?.toDate?.();
                // Only include if started within last 5 seconds
                if (startedAt && startedAt > fiveSecondsAgo && doc.id !== player.id) {
                    typing.push({
                        player_id: doc.id,
                        player_name: data.player_name
                    });
                }
            });

            res.json({
                success: true,
                channel: {
                    id: channel_id,
                    type: channel.type,
                    name: channel.name,
                    description: channel.description,
                    league_id: channel.league_id || null,
                    team_id: channel.team_id || null,
                    match_id: channel.match_id || null,
                    member_count: channel.member_count || 0,
                    message_count: channel.message_count || 0,
                    is_private: channel.is_private || false,
                    created_by: channel.created_by,
                    admins: channel.admins || [],
                    created_at: channel.created_at?.toDate?.()?.toISOString() || null,
                    last_message_at: channel.last_message_at?.toDate?.()?.toISOString() || null
                },
                members,
                typing,
                is_member: isMember,
                is_admin: await hasChannelAdminAccess(channel_id, player.id)
            });

        } catch (error) {
            logger.error('Error getting channel details:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// PUSH NOTIFICATION TRIGGER
// ============================================================================

/**
 * Trigger when a new message is created
 * Sends push notifications to channel members
 */
exports.onChatMessageCreated = onDocumentCreated(
    'chat_channels/{channelId}/messages/{messageId}',
    async (event) => {
        const snap = event.data;
        if (!snap) return null;

        const message = snap.data();
        const { channelId, messageId } = event.params;

        try {
            // Get channel info
            const channelDoc = await db.collection('chat_channels').doc(channelId).get();
            if (!channelDoc.exists) return null;

            const channel = channelDoc.data();

            // Get all active members except the sender
            const membersSnapshot = await db.collection('chat_channels')
                .doc(channelId)
                .collection('members')
                .where('status', '==', 'active')
                .where('notifications_enabled', '==', true)
                .get();

            const tokensToNotify = [];
            const memberIds = [];

            for (const memberDoc of membersSnapshot.docs) {
                if (memberDoc.id === message.sender_id) continue; // Skip sender

                memberIds.push(memberDoc.id);

                // Get FCM tokens for this member
                const tokensSnapshot = await db.collection('players')
                    .doc(memberDoc.id)
                    .collection('fcm_tokens')
                    .get();

                tokensSnapshot.forEach(tokenDoc => {
                    tokensToNotify.push(tokenDoc.data().token);
                });
            }

            if (tokensToNotify.length === 0) {
                logger.info(`No FCM tokens to notify for message ${messageId}`);
                return null;
            }

            // Build notification
            const notification = {
                title: channel.type === 'dm'
                    ? message.sender_name
                    : `${message.sender_name} in ${channel.name}`,
                body: message.content.slice(0, 100) + (message.content.length > 100 ? '...' : '')
            };

            const data = {
                type: 'chat_message',
                channel_id: channelId,
                channel_type: channel.type,
                channel_name: channel.name,
                message_id: messageId,
                sender_id: message.sender_id,
                sender_name: message.sender_name,
                click_action: `/pages/messages.html?channel=${channelId}`
            };

            // Send to all tokens (batch send)
            const sendPromises = tokensToNotify.map(token =>
                admin.messaging().send({
                    token,
                    notification,
                    data,
                    webpush: {
                        fcmOptions: {
                            link: data.click_action
                        }
                    }
                }).catch(error => {
                    // Log but don't fail on individual token errors
                    logger.warn(`Failed to send to token: ${error.message}`);
                    return null;
                })
            );

            const results = await Promise.all(sendPromises);
            const successCount = results.filter(r => r !== null).length;

            logger.info(`Sent ${successCount}/${tokensToNotify.length} notifications for message ${messageId}`);

            // Also check for @mentions and send higher priority notifications
            if (message.mentions && message.mentions.length > 0) {
                for (const mentionedId of message.mentions) {
                    // Create a mention notification record
                    await db.collection('notifications').add({
                        type: 'chat_mention',
                        recipient_id: mentionedId,
                        channel_id: channelId,
                        channel_name: channel.name,
                        message_id: messageId,
                        sender_id: message.sender_id,
                        sender_name: message.sender_name,
                        content_preview: message.content.slice(0, 100),
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
                }
            }

            return null;

        } catch (error) {
            logger.error('Error in onChatMessageCreated:', error);
            return null;
        }
    }
);

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Delete a message (admin only or message owner)
 *
 * POST /deleteChatMessage
 * Body: { player_pin, channel_id, message_id }
 */
exports.deleteChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id, message_id } = req.body;

            if (!player_pin || !channel_id || !message_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const messageRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .doc(message_id);

            const messageDoc = await messageRef.get();
            if (!messageDoc.exists) {
                return res.status(404).json({ success: false, error: 'Message not found' });
            }

            const message = messageDoc.data();

            // Check permission: must be message owner or channel admin
            const isOwner = message.sender_id === player.id;
            const isAdmin = await hasChannelAdminAccess(channel_id, player.id);

            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to delete this message'
                });
            }

            // Soft delete - mark as deleted but keep for audit
            await messageRef.update({
                is_deleted: true,
                deleted_at: admin.firestore.FieldValue.serverTimestamp(),
                deleted_by: player.id,
                content: '[Message deleted]'
            });

            logger.info(`Message ${message_id} deleted by player ${player.id}`);

            res.json({ success: true, message: 'Message deleted' });

        } catch (error) {
            logger.error('Error deleting chat message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Edit a message (owner only)
 *
 * POST /editChatMessage
 * Body: { player_pin, channel_id, message_id, new_content }
 */
exports.editChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id, message_id, new_content } = req.body;

            if (!player_pin || !channel_id || !message_id || !new_content) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const messageRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('messages')
                .doc(message_id);

            const messageDoc = await messageRef.get();
            if (!messageDoc.exists) {
                return res.status(404).json({ success: false, error: 'Message not found' });
            }

            const message = messageDoc.data();

            // Only message owner can edit
            if (message.sender_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only edit your own messages'
                });
            }

            // Cannot edit deleted messages
            if (message.is_deleted) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot edit deleted messages'
                });
            }

            // Check 5-minute edit window
            const createdAt = message.created_at?.toDate?.() || new Date(0);
            const now = new Date();
            const fiveMinutesMs = 5 * 60 * 1000;
            if (now - createdAt > fiveMinutesMs) {
                return res.status(403).json({
                    success: false,
                    error: 'Messages can only be edited within 5 minutes of sending'
                });
            }

            const sanitizedContent = sanitizeMessage(new_content);
            if (!sanitizedContent) {
                return res.status(400).json({
                    success: false,
                    error: 'Message content cannot be empty'
                });
            }

            // Re-parse mentions
            const mentions = await parseMentions(sanitizedContent, channel_id);

            await messageRef.update({
                content: sanitizedContent,
                mentions,
                is_edited: true,
                edited_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Message edited',
                new_content: sanitizedContent
            });

        } catch (error) {
            logger.error('Error editing chat message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Mark messages as read
 *
 * POST /markChannelRead
 * Body: { player_pin, channel_id }
 */
exports.markChannelRead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, channel_id } = req.body;

            if (!player_pin || !channel_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const memberRef = db.collection('chat_channels')
                .doc(channel_id)
                .collection('members')
                .doc(player.id);

            const memberDoc = await memberRef.get();
            if (!memberDoc.exists || memberDoc.data().status !== 'active') {
                return res.status(403).json({
                    success: false,
                    error: 'Not a member of this channel'
                });
            }

            await memberRef.update({
                last_read_at: admin.firestore.FieldValue.serverTimestamp(),
                unread_count: 0
            });

            res.json({ success: true });

        } catch (error) {
            logger.error('Error marking channel read:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
