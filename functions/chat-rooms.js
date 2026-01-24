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
 * Parse @mentions from message text
 * Returns array of player IDs that were mentioned
 */
async function parseMentions(text, participantIds) {
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
        const mentionedName = match[1].toLowerCase();

        // Try to match against participants
        for (const participantId of participantIds) {
            try {
                const playerDoc = await db.collection('players').doc(participantId).get();
                if (playerDoc.exists) {
                    const player = playerDoc.data();
                    const playerName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
                    const firstName = player.first_name || '';
                    const lastName = player.last_name || '';

                    // Match against full name, first name, or last name
                    if (playerName.toLowerCase().includes(mentionedName) ||
                        firstName.toLowerCase() === mentionedName ||
                        lastName.toLowerCase() === mentionedName ||
                        playerName.toLowerCase() === mentionedName) {
                        if (!mentions.includes(participantId)) {
                            mentions.push(participantId);
                        }
                        break;
                    }
                }
            } catch (e) {
                // Skip if player not found
            }
        }
    }

    return mentions;
}

/**
 * Queue notification for chat room message with smart notification logic
 */
async function queueChatRoomNotification(roomId, roomName, roomType, senderId, senderName, messagePreview, participantIds, mentions = []) {
    try {
        const batch = db.batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Get room for muted users and activity tracking
        const roomDoc = await db.collection('chat_rooms').doc(roomId).get();
        const room = roomDoc.exists ? roomDoc.data() : {};
        const mutedBy = room.muted_by || [];

        // Track room activity for "hot chat" detection
        const activityRef = db.collection('chat_rooms').doc(roomId).collection('activity').doc('recent');
        const activityDoc = await activityRef.get();
        let messageCount = 1;

        if (activityDoc.exists) {
            const activityData = activityDoc.data();
            const windowStart = activityData.window_start?.toDate?.() || new Date(0);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            if (windowStart > fiveMinutesAgo) {
                messageCount = (activityData.count || 0) + 1;
                await activityRef.update({
                    count: messageCount,
                    last_message: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Start new window
                await activityRef.set({
                    count: 1,
                    window_start: admin.firestore.FieldValue.serverTimestamp(),
                    last_message: admin.firestore.FieldValue.serverTimestamp()
                });
                messageCount = 1;
            }
        } else {
            await activityRef.set({
                count: 1,
                window_start: admin.firestore.FieldValue.serverTimestamp(),
                last_message: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        const isHotChat = messageCount >= 10; // 10+ messages in 5 min = hot chat

        for (const participantId of participantIds) {
            if (participantId === senderId) continue; // Skip sender

            // Skip if user muted this room
            if (mutedBy.includes(participantId)) continue;

            // Get participant data
            const participantDoc = await db.collection('players').doc(participantId).get();
            if (!participantDoc.exists) continue;

            const participant = participantDoc.data();
            const prefs = participant.notification_prefs || {};

            // Determine notification type and priority
            const isMentioned = mentions.includes(participantId);
            let shouldNotify = false;
            let priority = 'normal';
            let notificationType = 'chat';

            // @Mention - always notify (highest priority)
            if (isMentioned && prefs.mentions !== false) {
                shouldNotify = true;
                priority = 'high';
                notificationType = 'mention';
            }

            // Hot chat notification
            if (!shouldNotify && isHotChat && prefs.hot_chats !== false) {
                shouldNotify = true;
                priority = 'normal';
                notificationType = 'hot_chat';
            }

            // Check unread threshold
            if (!shouldNotify) {
                const unreadCount = room.unread_count?.[participantId] || 0;
                const threshold = prefs.unread_threshold || 20;

                if (unreadCount >= threshold) {
                    shouldNotify = true;
                    priority = 'normal';
                    notificationType = 'unread_threshold';
                }
            }

            // Skip if participant is online (unless mentioned)
            if (shouldNotify && !isMentioned) {
                const lastSeen = participant.last_seen_at?.toDate?.() || new Date(0);
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                if (lastSeen > fiveMinutesAgo) continue;
            }

            if (!shouldNotify) continue;

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
                notification_type: notificationType,
                is_mention: isMentioned,
                created_at: timestamp,
                digest_sent: false,
                priority: priority
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
            const leagueName = league.league_name || league.name || 'League';
            const roomRef = await db.collection('chat_rooms').add({
                type: 'league',
                name: `${leagueName} Chat`,
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
                text: `Welcome to ${leagueName} chat! This is where all league players can communicate.`,
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

/**
 * Create a tournament chat room
 * POST: { tournament_id, admin_pin }
 */
exports.createTournamentChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournament_id, admin_pin } = req.body;

            if (!tournament_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: tournament_id, admin_pin'
                });
            }

            // Verify admin
            const adminPlayer = await verifyPlayerPin(admin_pin);
            if (!adminPlayer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get tournament data
            const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
            if (!tournamentDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Tournament not found'
                });
            }
            const tournament = tournamentDoc.data();

            // Check if admin is the director
            const isDirector = tournament.director_id === adminPlayer.id ||
                               tournament.admin_pin === admin_pin ||
                               adminPlayer.isAdmin;

            if (!isDirector) {
                return res.status(401).json({
                    success: false,
                    error: 'You are not the tournament director'
                });
            }

            // Check if tournament chat already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('tournament_id', '==', tournament_id)
                .where('type', '==', 'tournament')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                return res.json({
                    success: true,
                    room_id: existingRoom.docs[0].id,
                    message: 'Tournament chat room already exists'
                });
            }

            // Get all registered players
            const registrationsSnapshot = await db.collection('tournaments').doc(tournament_id)
                .collection('registrations').get();

            const participantIds = registrationsSnapshot.docs
                .map(doc => doc.data().player_id)
                .filter(Boolean);

            // Add director as participant too
            if (!participantIds.includes(adminPlayer.id)) {
                participantIds.push(adminPlayer.id);
            }

            const tournamentName = tournament.tournament_name || tournament.name || 'Tournament';

            // Create chat room
            const roomRef = await db.collection('chat_rooms').add({
                type: 'tournament',
                name: `${tournamentName} Chat`,
                tournament_id: tournament_id,
                league_id: null,
                team_id: null,
                match_id: null,
                participants: participantIds,
                participant_count: participantIds.length,
                admins: [adminPlayer.id],
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
                text: `Welcome to ${tournamentName} chat! All registered players can communicate here.`,
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
            console.error('Error creating tournament chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Create all chat rooms for a tournament
 * POST: { tournament_id, admin_pin }
 */
exports.createAllTournamentChatRooms = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { tournament_id, admin_pin } = req.body;

            if (!tournament_id || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: tournament_id, admin_pin'
                });
            }

            // Verify admin
            const adminPlayer = await verifyPlayerPin(admin_pin);
            if (!adminPlayer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get tournament data
            const tournamentDoc = await db.collection('tournaments').doc(tournament_id).get();
            if (!tournamentDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Tournament not found'
                });
            }
            const tournament = tournamentDoc.data();

            // Check if admin is the director
            const isDirector = tournament.director_id === adminPlayer.id ||
                               tournament.admin_pin === admin_pin ||
                               adminPlayer.isAdmin;

            if (!isDirector) {
                return res.status(401).json({
                    success: false,
                    error: 'You are not the tournament director'
                });
            }

            const results = {
                tournament_chat: null,
                event_chats: []
            };

            // Get all registered players
            const registrationsSnapshot = await db.collection('tournaments').doc(tournament_id)
                .collection('registrations').get();
            const allPlayerIds = registrationsSnapshot.docs
                .map(doc => doc.data().player_id)
                .filter(Boolean);

            if (!allPlayerIds.includes(adminPlayer.id)) {
                allPlayerIds.push(adminPlayer.id);
            }

            const tournamentName = tournament.tournament_name || tournament.name || 'Tournament';

            // Create main tournament chat if doesn't exist
            const existingTournamentChat = await db.collection('chat_rooms')
                .where('tournament_id', '==', tournament_id)
                .where('type', '==', 'tournament')
                .limit(1)
                .get();

            if (existingTournamentChat.empty) {
                const tournamentChatRef = await db.collection('chat_rooms').add({
                    type: 'tournament',
                    name: `${tournamentName} Chat`,
                    tournament_id: tournament_id,
                    league_id: null,
                    team_id: null,
                    match_id: null,
                    participants: allPlayerIds,
                    participant_count: allPlayerIds.length,
                    admins: [adminPlayer.id],
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_message: null,
                    unread_count: {},
                    status: 'active'
                });

                await tournamentChatRef.collection('messages').add({
                    sender_id: 'system',
                    sender_name: 'System',
                    text: `Welcome to ${tournamentName} chat!`,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'system',
                    pinned: false
                });

                results.tournament_chat = tournamentChatRef.id;
            } else {
                results.tournament_chat = existingTournamentChat.docs[0].id;
            }

            // Create event chats if tournament has multiple events
            const eventsSnapshot = await db.collection('tournaments').doc(tournament_id)
                .collection('events').get();

            for (const eventDoc of eventsSnapshot.docs) {
                const event = eventDoc.data();
                const eventId = eventDoc.id;

                // Check if event chat exists
                const existingEventChat = await db.collection('chat_rooms')
                    .where('tournament_id', '==', tournament_id)
                    .where('event_id', '==', eventId)
                    .where('type', '==', 'tournament_event')
                    .limit(1)
                    .get();

                if (existingEventChat.empty) {
                    // Get event registrations
                    const eventRegsSnapshot = await db.collection('tournaments').doc(tournament_id)
                        .collection('events').doc(eventId)
                        .collection('registrations').get();

                    const eventPlayerIds = eventRegsSnapshot.docs
                        .map(doc => doc.data().player_id)
                        .filter(Boolean);

                    if (!eventPlayerIds.includes(adminPlayer.id)) {
                        eventPlayerIds.push(adminPlayer.id);
                    }

                    const eventName = event.event_name || event.name || 'Event';

                    const eventChatRef = await db.collection('chat_rooms').add({
                        type: 'tournament_event',
                        name: `${eventName} Chat`,
                        tournament_id: tournament_id,
                        event_id: eventId,
                        league_id: null,
                        team_id: null,
                        match_id: null,
                        participants: eventPlayerIds,
                        participant_count: eventPlayerIds.length,
                        admins: [adminPlayer.id],
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                        updated_at: admin.firestore.FieldValue.serverTimestamp(),
                        last_message: null,
                        unread_count: {},
                        status: 'active'
                    });

                    await eventChatRef.collection('messages').add({
                        sender_id: 'system',
                        sender_name: 'System',
                        text: `Welcome to ${eventName} chat!`,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'system',
                        pinned: false
                    });

                    results.event_chats.push({
                        event_id: eventId,
                        event_name: eventName,
                        room_id: eventChatRef.id
                    });
                } else {
                    results.event_chats.push({
                        event_id: eventId,
                        event_name: event.event_name || event.name,
                        room_id: existingEventChat.docs[0].id,
                        existing: true
                    });
                }
            }

            res.json({
                success: true,
                results: results
            });

        } catch (error) {
            console.error('Error creating tournament chat rooms:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Create chat rooms for ALL tournaments in the system
 * POST: { admin_pin }
 * Requires master admin privileges
 */
exports.createAllTournamentsChatRooms = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { admin_pin } = req.body;

            if (!admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: admin_pin'
                });
            }

            // Verify admin (must be master admin)
            const adminPlayer = await verifyPlayerPin(admin_pin);
            if (!adminPlayer || !adminPlayer.isAdmin) {
                return res.status(401).json({
                    success: false,
                    error: 'Requires master admin privileges'
                });
            }

            // Get all tournaments
            const tournamentsSnapshot = await db.collection('tournaments').get();

            const results = {
                created: [],
                existing: [],
                errors: []
            };

            for (const tournamentDoc of tournamentsSnapshot.docs) {
                const tournament = tournamentDoc.data();
                const tournamentId = tournamentDoc.id;
                const tournamentName = tournament.tournament_name || tournament.name || 'Tournament';

                try {
                    // Check if tournament chat exists
                    const existingChat = await db.collection('chat_rooms')
                        .where('tournament_id', '==', tournamentId)
                        .where('type', '==', 'tournament')
                        .limit(1)
                        .get();

                    if (existingChat.empty) {
                        // Get all registered players
                        const registrationsSnapshot = await db.collection('tournaments').doc(tournamentId)
                            .collection('registrations').get();
                        const playerIds = registrationsSnapshot.docs
                            .map(doc => doc.data().player_id)
                            .filter(Boolean);

                        // Add director if not in list
                        if (tournament.director_id && !playerIds.includes(tournament.director_id)) {
                            playerIds.push(tournament.director_id);
                        }

                        // Create tournament chat room
                        const chatRef = await db.collection('chat_rooms').add({
                            type: 'tournament',
                            tournament_id: tournamentId,
                            name: `${tournamentName} Chat`,
                            participants: playerIds,
                            participant_count: playerIds.length,
                            created_at: admin.firestore.FieldValue.serverTimestamp(),
                            updated_at: admin.firestore.FieldValue.serverTimestamp(),
                            last_message: null,
                            unread_count: {},
                            status: 'active'
                        });

                        // Add welcome message
                        await chatRef.collection('messages').add({
                            sender_id: 'system',
                            sender_name: 'System',
                            text: `Welcome to ${tournamentName} chat!`,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'system',
                            pinned: false
                        });

                        results.created.push({
                            tournament_id: tournamentId,
                            tournament_name: tournamentName,
                            room_id: chatRef.id,
                            participants: playerIds.length
                        });
                    } else {
                        results.existing.push({
                            tournament_id: tournamentId,
                            tournament_name: tournamentName,
                            room_id: existingChat.docs[0].id
                        });
                    }
                } catch (err) {
                    results.errors.push({
                        tournament_id: tournamentId,
                        tournament_name: tournamentName,
                        error: err.message
                    });
                }
            }

            res.json({
                success: true,
                total_tournaments: tournamentsSnapshot.size,
                results: results
            });

        } catch (error) {
            console.error('Error creating tournament chat rooms:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// CHAT ROOM MESSAGING
// ============================================================================

/**
 * Send a message to a chat room
 * POST: { room_id, sender_pin, text, reply_to? }
 */
exports.sendChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, sender_pin, text, reply_to } = req.body;

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

            // Parse @mentions
            const mentions = await parseMentions(text, room.participants);

            // Create message
            const messageData = {
                sender_id: sender.id,
                sender_name: senderName,
                sender_photo: sender.photo_url || null,
                text: text,
                timestamp: timestamp,
                type: 'text',
                pinned: false,
                mentions: mentions // Array of mentioned player IDs
            };

            // Handle reply
            if (reply_to && reply_to.message_id) {
                messageData.reply_to = {
                    message_id: reply_to.message_id,
                    sender_name: reply_to.sender_name || 'Unknown',
                    text: (reply_to.text || '').substring(0, 100) // Truncate for storage
                };
            }

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

            // Queue notifications (async) - includes @mentions, hot chat, and unread threshold logic
            queueChatRoomNotification(
                room_id,
                room.name,
                room.type,
                sender.id,
                senderName,
                text,
                room.participants,
                mentions
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
                match: [],
                tournament: [],
                tournament_event: []
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
                    tournament_id: data.tournament_id || null,
                    event_id: data.event_id || null,
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
                } else if (data.type === 'tournament') {
                    rooms.tournament.push(roomData);
                } else if (data.type === 'tournament_event') {
                    rooms.tournament_event.push(roomData);
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

// ============================================================================
// ROOM PARTICIPANTS
// ============================================================================

/**
 * Get detailed participant list for a chat room (for @mention autocomplete)
 * POST: { room_id, player_pin }
 */
exports.getChatRoomParticipants = functions.https.onRequest((req, res) => {
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

            const room = roomDoc.data();

            // Verify player is participant
            if (!room.participants.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Get all participant details
            const participants = [];
            for (const participantId of room.participants) {
                try {
                    const participantDoc = await db.collection('players').doc(participantId).get();
                    if (participantDoc.exists) {
                        const data = participantDoc.data();
                        participants.push({
                            id: participantId,
                            name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown',
                            first_name: data.first_name || '',
                            photo_url: data.photo_url || null,
                            is_admin: room.admins.includes(participantId)
                        });
                    }
                } catch (e) {
                    // Skip if participant not found
                }
            }

            res.json({
                success: true,
                participants: participants,
                current_player_id: player.id
            });

        } catch (error) {
            console.error('Error getting chat room participants:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// TYPING INDICATORS
// ============================================================================

/**
 * Set typing status in a chat room
 * POST: { room_id, player_pin, is_typing }
 */
exports.setTypingStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, player_pin, is_typing } = req.body;

            if (!room_id || !player_pin || typeof is_typing !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, player_pin, is_typing'
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

            const playerName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown';

            // Update typing status in a subcollection
            const typingRef = db.collection('chat_rooms').doc(room_id).collection('typing').doc(player.id);

            if (is_typing) {
                await typingRef.set({
                    player_id: player.id,
                    player_name: playerName,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await typingRef.delete();
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Error setting typing status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// MESSAGE REACTIONS
// ============================================================================

/**
 * Add/toggle a reaction on a message
 * POST: { room_id, message_id, player_pin, emoji }
 */
exports.addMessageReaction = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, message_id, player_pin, emoji } = req.body;

            if (!room_id || !message_id || !player_pin || !emoji) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, message_id, player_pin, emoji'
                });
            }

            // Validate emoji (only allow specific set)
            const allowedEmojis = ['👍', '❤️', '🔥', '🎯', '😂', '👀'];
            if (!allowedEmojis.includes(emoji)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid emoji'
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

            // Get message
            const messageRef = db.collection('chat_rooms').doc(room_id)
                .collection('messages').doc(message_id);
            const messageDoc = await messageRef.get();

            if (!messageDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Message not found'
                });
            }

            const message = messageDoc.data();
            const reactions = message.reactions || {};

            // Toggle reaction
            if (!reactions[emoji]) {
                reactions[emoji] = {};
            }

            const playerName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown';

            if (reactions[emoji][player.id]) {
                // Remove reaction
                delete reactions[emoji][player.id];
                // Clean up empty emoji
                if (Object.keys(reactions[emoji]).length === 0) {
                    delete reactions[emoji];
                }
            } else {
                // Add reaction
                reactions[emoji][player.id] = {
                    name: playerName,
                    timestamp: new Date().toISOString()
                };
            }

            // Update message
            await messageRef.update({ reactions: reactions });

            res.json({
                success: true,
                reactions: reactions
            });

        } catch (error) {
            console.error('Error adding message reaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// ROOM MUTE/NOTIFICATION CONTROLS
// ============================================================================

/**
 * Toggle mute status for a chat room
 * POST: { room_id, player_pin, muted }
 */
exports.toggleChatRoomMute = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, player_pin, muted } = req.body;

            if (!room_id || !player_pin || typeof muted !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, player_pin, muted'
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

            // Update muted_by array
            if (muted) {
                await db.collection('chat_rooms').doc(room_id).update({
                    muted_by: admin.firestore.FieldValue.arrayUnion(player.id)
                });
            } else {
                await db.collection('chat_rooms').doc(room_id).update({
                    muted_by: admin.firestore.FieldValue.arrayRemove(player.id)
                });
            }

            res.json({
                success: true,
                muted: muted
            });

        } catch (error) {
            console.error('Error toggling chat room mute:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update notification preferences for a player
 * POST: { player_pin, preferences }
 */
exports.updateNotificationPreferences = functions.https.onRequest((req, res) => {
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
            const validPrefs = {};
            if (typeof preferences.mentions === 'boolean') {
                validPrefs.mentions = preferences.mentions;
            }
            if (typeof preferences.hot_chats === 'boolean') {
                validPrefs.hot_chats = preferences.hot_chats;
            }
            if (typeof preferences.unread_threshold === 'number' && preferences.unread_threshold >= 0) {
                validPrefs.unread_threshold = preferences.unread_threshold;
            }
            if (['all', 'mentions_only', 'none'].includes(preferences.direct_messages)) {
                validPrefs.direct_messages = preferences.direct_messages;
            }

            // Update player
            await db.collection('players').doc(player.id).update({
                notification_prefs: validPrefs
            });

            res.json({
                success: true,
                preferences: validPrefs
            });

        } catch (error) {
            console.error('Error updating notification preferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// MESSAGE EDIT/DELETE
// ============================================================================

/**
 * Edit a message (only within 5 minutes of sending)
 * POST: { room_id, message_id, player_pin, new_text }
 */
exports.editChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, message_id, player_pin, new_text } = req.body;

            if (!room_id || !message_id || !player_pin || !new_text) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, message_id, player_pin, new_text'
                });
            }

            if (new_text.length > 2000) {
                return res.status(400).json({
                    success: false,
                    error: 'Message too long (max 2000 characters)'
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

            // Get message
            const messageRef = db.collection('chat_rooms').doc(room_id)
                .collection('messages').doc(message_id);
            const messageDoc = await messageRef.get();

            if (!messageDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Message not found'
                });
            }

            const message = messageDoc.data();

            // Verify sender is the player
            if (message.sender_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only edit your own messages'
                });
            }

            // Server-side validation: Check if within 5-minute edit window
            const messageCreatedAt = message.created_at?.toDate?.() || message.timestamp?.toDate?.() || new Date(0);
            const editWindowMs = 300000; // 5 minutes in milliseconds
            const timeSinceCreation = Date.now() - messageCreatedAt.getTime();

            if (timeSinceCreation > editWindowMs) {
                return res.status(400).json({
                    success: false,
                    error: 'Edit window expired. Messages can only be edited within 5 minutes.'
                });
            }

            // Update message
            await messageRef.update({
                text: new_text,
                edited: true,
                edited_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error editing message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Delete a message (soft delete)
 * POST: { room_id, message_id, player_pin }
 */
exports.deleteChatMessage = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, message_id, player_pin } = req.body;

            if (!room_id || !message_id || !player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, message_id, player_pin'
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

            // Get message
            const messageRef = db.collection('chat_rooms').doc(room_id)
                .collection('messages').doc(message_id);
            const messageDoc = await messageRef.get();

            if (!messageDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Message not found'
                });
            }

            const message = messageDoc.data();

            // Check if player can delete
            const isOwner = message.sender_id === player.id;
            const isAdmin = room.admins.includes(player.id);

            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own messages'
                });
            }

            // Soft delete
            await messageRef.update({
                text: '[Message deleted]',
                deleted: true,
                deleted_at: admin.firestore.FieldValue.serverTimestamp(),
                deleted_by: player.id
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error deleting message:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// CHAT ROOM MANAGEMENT
// ============================================================================

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
                const leagueChatName = league.league_name || league.name || 'League';
                const leagueChatRef = await db.collection('chat_rooms').add({
                    type: 'league',
                    name: `${leagueChatName} Chat`,
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
                    text: `Welcome to ${leagueChatName} chat!`,
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

/**
 * Fix chat room name (admin utility)
 * POST: { room_id, new_name, admin_pin }
 */
exports.fixChatRoomName = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { room_id, new_name, admin_pin } = req.body;

            if (!room_id || !new_name || !admin_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: room_id, new_name, admin_pin'
                });
            }

            // Verify admin
            const admin = await verifyPlayerPin(admin_pin);
            if (!admin || !admin.isAdmin) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid admin PIN'
                });
            }

            // Update room name
            const firebaseAdmin = require('firebase-admin');
            await db.collection('chat_rooms').doc(room_id).update({
                name: new_name,
                updated_at: firebaseAdmin.firestore.FieldValue.serverTimestamp()
            });

            // Also update the welcome message
            const messagesSnapshot = await db.collection('chat_rooms').doc(room_id)
                .collection('messages')
                .where('type', '==', 'system')
                .limit(1)
                .get();

            if (!messagesSnapshot.empty) {
                const msgDoc = messagesSnapshot.docs[0];
                const roomType = (await db.collection('chat_rooms').doc(room_id).get()).data()?.type || 'chat';

                let newText = `Welcome to ${new_name}!`;
                if (roomType === 'league') {
                    newText = `Welcome to ${new_name}! This is where all league players can communicate.`;
                } else if (roomType === 'team') {
                    newText = `Welcome to ${new_name}! Coordinate with your team here.`;
                }

                await msgDoc.ref.update({ text: newText });
            }

            res.json({
                success: true,
                message: `Room name updated to "${new_name}"`
            });

        } catch (error) {
            console.error('Error fixing chat room name:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
