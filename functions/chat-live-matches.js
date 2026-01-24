/**
 * BRDC Chat System - Phase 2: Live Match Features
 *
 * Live Match Ticker, Match Overlays, Auto-Posted Results
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
 * Build match result message for auto-posting
 */
function buildMatchResultMessage(match, stats) {
    const winner = match.winner || {};
    const loser = match.loser || {};
    const gameType = match.game_type || '501';

    let statsText = '';
    if (stats) {
        if (gameType === '501' || gameType === '301') {
            if (stats.topPPD) {
                statsText += `• Top PPD: ${stats.topPPD.player} (${stats.topPPD.value.toFixed(1)})\n`;
            }
            if (stats.highestCheckout) {
                statsText += `• Highest Checkout: ${stats.highestCheckout.player} (${stats.highestCheckout.value})\n`;
            }
            if (stats.mostTonPlus) {
                statsText += `• Most Ton+: ${stats.mostTonPlus.player} (${stats.mostTonPlus.count})\n`;
            }
            if (stats.bestLeg) {
                statsText += `• Best Leg: ${stats.bestLeg.player} (${stats.bestLeg.darts} darts)\n`;
            }
        } else if (gameType === 'cricket') {
            if (stats.topMPR) {
                statsText += `• Top MPR: ${stats.topMPR.player} (${stats.topMPR.value.toFixed(2)})\n`;
            }
            if (stats.mostMarks) {
                statsText += `• Most Marks: ${stats.mostMarks.player} (${stats.mostMarks.count})\n`;
            }
        }
    }

    return {
        type: 'match_result',
        text: `🎯 MATCH COMPLETE - ${match.event_name || 'Match'}\n` +
              `${winner.name || 'Winner'} defeated ${loser.name || 'Loser'} (${winner.score || 0}-${loser.score || 0})\n\n` +
              (statsText ? `📊 Match Stats:\n${statsText}` : ''),
        match_data: {
            match_id: match.id,
            event_id: match.event_id,
            event_name: match.event_name,
            game_type: gameType,
            winner: winner,
            loser: loser,
            stats: stats,
            scoresheet_url: `/pages/match-report.html?id=${match.id}`
        }
    };
}

// ============================================================================
// LIVE MATCHES TICKER
// ============================================================================

/**
 * Get all live matches for the ticker
 * POST: { player_pin, filter?: 'all'|'leagues'|'tournaments'|'following' }
 */
exports.getLiveMatches = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, filter = 'all' } = req.body;

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

            // Get live matches from the live_matches collection
            let query = db.collection('live_matches')
                .where('status', '==', 'live')
                .orderBy('started_at', 'desc')
                .limit(20);

            // Apply filter
            if (filter === 'leagues') {
                query = query.where('event_type', '==', 'league');
            } else if (filter === 'tournaments') {
                query = query.where('event_type', '==', 'tournament');
            }

            const snapshot = await query.get();

            const matches = [];
            snapshot.forEach(doc => {
                const data = doc.data();

                // If filter is 'following', check if player is involved or following
                if (filter === 'following') {
                    const allPlayers = [
                        ...(data.team1_player_ids || []),
                        ...(data.team2_player_ids || [])
                    ];
                    const following = player.following || [];

                    const isInvolved = allPlayers.includes(player.id);
                    const isFollowing = allPlayers.some(pid => following.includes(pid));

                    if (!isInvolved && !isFollowing) return;
                }

                matches.push({
                    id: doc.id,
                    match_id: data.match_id,
                    event_id: data.event_id,
                    event_name: data.event_name,
                    event_type: data.event_type,
                    round: data.round,
                    board_number: data.board_number,
                    game_type: data.game_type,
                    team1: {
                        name: data.team1_name,
                        player_names: data.team1_player_names,
                        games_won: data.team1_games_won || 0
                    },
                    team2: {
                        name: data.team2_name,
                        player_names: data.team2_player_names,
                        games_won: data.team2_games_won || 0
                    },
                    current_leg: data.current_leg || {},
                    spectator_count: data.spectator_count || 0,
                    started_at: data.started_at?.toDate?.()?.toISOString() || null,
                    last_update: data.last_update?.toDate?.()?.toISOString() || null
                });
            });

            res.json({
                success: true,
                matches: matches,
                count: matches.length
            });

        } catch (error) {
            console.error('Error getting live matches:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get detailed match data for overlay
 * POST: { player_pin, match_id }
 */
exports.getLiveMatchDetails = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, match_id'
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

            // Get live match
            const liveMatchDoc = await db.collection('live_matches').doc(match_id).get();

            if (!liveMatchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Live match not found'
                });
            }

            const data = liveMatchDoc.data();

            // Get shot history for current leg
            const shotHistory = [];
            if (data.current_leg?.throws) {
                data.current_leg.throws.forEach(t => {
                    shotHistory.push({
                        player_name: t.player_name,
                        score: t.score,
                        darts: t.darts,
                        is_ton_plus: t.score >= 100
                    });
                });
            }

            // Get player stats
            const playerStats = {};
            if (data.player_stats) {
                for (const [playerId, stats] of Object.entries(data.player_stats)) {
                    playerStats[playerId] = {
                        name: stats.name,
                        match_ppd: stats.match_ppd || 0,
                        match_mpr: stats.match_mpr || 0,
                        season_ppd: stats.season_ppd || 0,
                        season_mpr: stats.season_mpr || 0,
                        ton_plus_count: stats.ton_plus_count || 0,
                        high_checkout: stats.high_checkout || 0,
                        marks_count: stats.marks_count || 0
                    };
                }
            }

            // Increment spectator count
            await db.collection('live_matches').doc(match_id).update({
                spectator_count: admin.firestore.FieldValue.increment(1)
            });

            res.json({
                success: true,
                match: {
                    id: liveMatchDoc.id,
                    match_id: data.match_id,
                    event_id: data.event_id,
                    event_name: data.event_name,
                    event_type: data.event_type,
                    round: data.round,
                    board_number: data.board_number,
                    game_type: data.game_type,
                    race_to: data.race_to,
                    team1: {
                        id: data.team1_id,
                        name: data.team1_name,
                        player_ids: data.team1_player_ids,
                        player_names: data.team1_player_names,
                        games_won: data.team1_games_won || 0
                    },
                    team2: {
                        id: data.team2_id,
                        name: data.team2_name,
                        player_ids: data.team2_player_ids,
                        player_names: data.team2_player_names,
                        games_won: data.team2_games_won || 0
                    },
                    current_leg: {
                        leg_number: data.current_leg?.leg_number || 1,
                        team1_score: data.current_leg?.team1_score || data.starting_score || 501,
                        team2_score: data.current_leg?.team2_score || data.starting_score || 501,
                        team1_darts: data.current_leg?.team1_darts || 0,
                        team2_darts: data.current_leg?.team2_darts || 0,
                        throwing: data.current_leg?.throwing || 'team1',
                        marks: data.current_leg?.marks || {} // For cricket
                    },
                    shot_history: shotHistory.slice(-10), // Last 10 throws
                    player_stats: playerStats,
                    spectator_count: (data.spectator_count || 0) + 1,
                    chat_room_id: data.chat_room_id || null,
                    started_at: data.started_at?.toDate?.()?.toISOString() || null,
                    last_update: data.last_update?.toDate?.()?.toISOString() || null
                }
            });

        } catch (error) {
            console.error('Error getting live match details:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update a live match (called by scorer)
 * POST: { scorer_pin, match_id, update_data }
 */
exports.updateLiveMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { scorer_pin, match_id, update_data } = req.body;

            if (!scorer_pin || !match_id || !update_data) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: scorer_pin, match_id, update_data'
                });
            }

            // Verify scorer
            const scorer = await verifyPlayerPin(scorer_pin);
            if (!scorer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get live match
            const liveMatchRef = db.collection('live_matches').doc(match_id);
            const liveMatchDoc = await liveMatchRef.get();

            if (!liveMatchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Live match not found'
                });
            }

            // Build update object
            const updateObj = {
                last_update: admin.firestore.FieldValue.serverTimestamp()
            };

            // Update scores
            if (update_data.team1_games_won !== undefined) {
                updateObj.team1_games_won = update_data.team1_games_won;
            }
            if (update_data.team2_games_won !== undefined) {
                updateObj.team2_games_won = update_data.team2_games_won;
            }

            // Update current leg
            if (update_data.current_leg) {
                updateObj.current_leg = update_data.current_leg;
            }

            // Update player stats
            if (update_data.player_stats) {
                updateObj.player_stats = update_data.player_stats;
            }

            // Update status
            if (update_data.status) {
                updateObj.status = update_data.status;

                // If match completed, trigger result posting
                if (update_data.status === 'completed') {
                    updateObj.completed_at = admin.firestore.FieldValue.serverTimestamp();
                }
            }

            await liveMatchRef.update(updateObj);

            res.json({
                success: true,
                message: 'Live match updated'
            });

        } catch (error) {
            console.error('Error updating live match:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Start tracking a match as live (called when scorer opens)
 * POST: { scorer_pin, match_id, event_id, event_type, match_data }
 */
exports.startLiveMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { scorer_pin, match_id, event_id, event_type, match_data } = req.body;

            if (!scorer_pin || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: scorer_pin, match_id'
                });
            }

            // Verify scorer
            const scorer = await verifyPlayerPin(scorer_pin);
            if (!scorer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Check if already tracking
            const existingDoc = await db.collection('live_matches').doc(match_id).get();
            if (existingDoc.exists) {
                return res.json({
                    success: true,
                    live_match_id: match_id,
                    message: 'Match already live'
                });
            }

            // Create live match entry
            const liveMatchData = {
                match_id: match_id,
                event_id: event_id || null,
                event_name: match_data?.event_name || 'Match',
                event_type: event_type || 'casual',
                round: match_data?.round || null,
                board_number: match_data?.board_number || null,
                game_type: match_data?.game_type || '501',
                starting_score: match_data?.starting_score || 501,
                race_to: match_data?.race_to || 3,

                team1_id: match_data?.team1_id || null,
                team1_name: match_data?.team1_name || 'Team 1',
                team1_player_ids: match_data?.team1_player_ids || [],
                team1_player_names: match_data?.team1_player_names || [],
                team1_games_won: 0,

                team2_id: match_data?.team2_id || null,
                team2_name: match_data?.team2_name || 'Team 2',
                team2_player_ids: match_data?.team2_player_ids || [],
                team2_player_names: match_data?.team2_player_names || [],
                team2_games_won: 0,

                current_leg: {
                    leg_number: 1,
                    team1_score: match_data?.starting_score || 501,
                    team2_score: match_data?.starting_score || 501,
                    team1_darts: 0,
                    team2_darts: 0,
                    throwing: 'team1',
                    throws: []
                },

                player_stats: {},
                status: 'live',
                scorer_id: scorer.id,
                spectator_count: 0,
                viewer_count: 0,
                chat_room_id: null,
                started_at: admin.firestore.FieldValue.serverTimestamp(),
                last_update: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('live_matches').doc(match_id).set(liveMatchData);

            res.json({
                success: true,
                live_match_id: match_id
            });

        } catch (error) {
            console.error('Error starting live match:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * End live match tracking (called when match completes)
 * POST: { scorer_pin, match_id, result }
 */
exports.endLiveMatch = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { scorer_pin, match_id, result } = req.body;

            if (!scorer_pin || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: scorer_pin, match_id'
                });
            }

            // Verify scorer
            const scorer = await verifyPlayerPin(scorer_pin);
            if (!scorer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Get live match data before deleting
            const liveMatchDoc = await db.collection('live_matches').doc(match_id).get();

            if (!liveMatchDoc.exists) {
                return res.json({
                    success: true,
                    message: 'Match not found in live matches'
                });
            }

            const matchData = liveMatchDoc.data();

            // Auto-post result to relevant chat rooms
            if (result && matchData.event_id) {
                await postMatchResult(matchData, result);
            }

            // Update status to completed (keep for a few seconds for final updates)
            await db.collection('live_matches').doc(match_id).update({
                status: 'completed',
                result: result || null,
                completed_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Schedule deletion after 30 seconds
            setTimeout(async () => {
                try {
                    await db.collection('live_matches').doc(match_id).delete();
                } catch (e) {
                    console.error('Error deleting live match:', e);
                }
            }, 30000);

            res.json({
                success: true,
                message: 'Match ended'
            });

        } catch (error) {
            console.error('Error ending live match:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Post match result to relevant chat rooms
 */
async function postMatchResult(matchData, result) {
    try {
        const resultMessage = buildMatchResultMessage({
            id: matchData.match_id,
            event_id: matchData.event_id,
            event_name: matchData.event_name,
            game_type: matchData.game_type,
            winner: result.winner,
            loser: result.loser
        }, result.stats);

        // Find relevant chat rooms
        const chatRooms = [];

        // Get event main chat
        if (matchData.event_type === 'league' && matchData.event_id) {
            const leagueChatSnapshot = await db.collection('chat_rooms')
                .where('league_id', '==', matchData.event_id)
                .where('type', '==', 'league')
                .limit(1)
                .get();

            if (!leagueChatSnapshot.empty) {
                chatRooms.push(leagueChatSnapshot.docs[0].id);
            }

            // Get team chats
            if (matchData.team1_id) {
                const team1ChatSnapshot = await db.collection('chat_rooms')
                    .where('team_id', '==', matchData.team1_id)
                    .where('type', '==', 'team')
                    .limit(1)
                    .get();

                if (!team1ChatSnapshot.empty) {
                    chatRooms.push(team1ChatSnapshot.docs[0].id);
                }
            }

            if (matchData.team2_id) {
                const team2ChatSnapshot = await db.collection('chat_rooms')
                    .where('team_id', '==', matchData.team2_id)
                    .where('type', '==', 'team')
                    .limit(1)
                    .get();

                if (!team2ChatSnapshot.empty) {
                    chatRooms.push(team2ChatSnapshot.docs[0].id);
                }
            }
        }

        // Post to each chat room
        for (const roomId of chatRooms) {
            await db.collection('chat_rooms').doc(roomId).collection('messages').add({
                sender_id: 'system',
                sender_name: 'Match Bot',
                text: resultMessage.text,
                type: 'match_result',
                match_data: resultMessage.match_data,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                pinned: false
            });

            // Update room's last message
            await db.collection('chat_rooms').doc(roomId).update({
                last_message: {
                    text: `🎯 Match Complete: ${result.winner?.name || 'Winner'} won!`,
                    sender_id: 'system',
                    sender_name: 'Match Bot',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                },
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Notify all players in the match
        const allPlayerIds = [
            ...(matchData.team1_player_ids || []),
            ...(matchData.team2_player_ids || [])
        ];

        for (const playerId of allPlayerIds) {
            await db.collection('message_notifications').add({
                recipient_id: playerId,
                source_type: 'match_result',
                source_id: matchData.match_id,
                source_name: matchData.event_name,
                sender_name: 'Match Bot',
                message_preview: `Match Complete: ${result.winner?.name || 'Winner'} won ${result.winner?.score || 0}-${result.loser?.score || 0}`,
                notification_type: 'match_result',
                priority: 'normal',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                digest_sent: false
            });
        }

    } catch (error) {
        console.error('Error posting match result:', error);
    }
}

/**
 * Get or create a chat room for a live match (for viewers)
 * Any authenticated player can call this - creates room if doesn't exist
 * POST: { player_pin, league_id, match_id }
 */
exports.getOrCreateMatchChatRoom = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, league_id, match_id } = req.body;

            if (!player_pin || !league_id || !match_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, league_id, match_id'
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

            // Check if match chat already exists
            const existingRoom = await db.collection('chat_rooms')
                .where('match_id', '==', match_id)
                .where('type', '==', 'match')
                .limit(1)
                .get();

            if (!existingRoom.empty) {
                const roomDoc = existingRoom.docs[0];
                const roomData = roomDoc.data();

                // Add player to participants if not already there
                if (!roomData.participants?.includes(player.id)) {
                    await db.collection('chat_rooms').doc(roomDoc.id).update({
                        participants: admin.firestore.FieldValue.arrayUnion(player.id),
                        participant_count: admin.firestore.FieldValue.increment(1)
                    });
                }

                return res.json({
                    success: true,
                    room_id: roomDoc.id,
                    name: roomData.name,
                    created: false
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

            // Get team names
            const homeTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.away_team_id).get();

            const homeTeam = homeTeamDoc.exists ? homeTeamDoc.data() : {};
            const awayTeam = awayTeamDoc.exists ? awayTeamDoc.data() : {};

            // Get players from both teams
            const playersSnap = await db.collection('leagues').doc(league_id)
                .collection('players').get();

            const homePlayers = [];
            const awayPlayers = [];
            playersSnap.forEach(doc => {
                const p = doc.data();
                if (p.team_id === match.home_team_id) {
                    homePlayers.push(doc.id);
                } else if (p.team_id === match.away_team_id) {
                    awayPlayers.push(doc.id);
                }
            });

            const participantIds = [...homePlayers, ...awayPlayers, player.id];
            const uniqueParticipants = [...new Set(participantIds)];

            // Both captains are admins
            const adminIds = [homeTeam.captain_id, awayTeam.captain_id].filter(Boolean);

            const roomName = `Week ${match.week || '?'}: ${homeTeam.name || 'Home'} vs ${awayTeam.name || 'Away'}`;

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
                participants: uniqueParticipants,
                participant_count: uniqueParticipants.length,
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
                text: `Match chat started. Good luck to both teams!`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            // Update live match with chat room ID if it exists
            const liveMatchDoc = await db.collection('live_matches').doc(match_id).get();
            if (liveMatchDoc.exists) {
                await db.collection('live_matches').doc(match_id).update({
                    chat_room_id: roomRef.id
                });
            }

            res.json({
                success: true,
                room_id: roomRef.id,
                name: roomName,
                created: true,
                participant_count: uniqueParticipants.length
            });

        } catch (error) {
            console.error('Error getting/creating match chat room:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get player's ticker preferences
 * POST: { player_pin }
 */
exports.getTickerPreferences = functions.https.onRequest((req, res) => {
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

            const prefs = player.ticker_prefs || {
                collapsed: false,
                filter: 'all',
                dismissed_matches: [],
                following_players: []
            };

            res.json({
                success: true,
                preferences: prefs
            });

        } catch (error) {
            console.error('Error getting ticker preferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player's ticker preferences
 * POST: { player_pin, preferences }
 */
exports.updateTickerPreferences = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, preferences } = req.body;

            if (!player_pin || !preferences) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin, preferences'
                });
            }

            const player = await verifyPlayerPin(player_pin);
            if (!player) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid PIN'
                });
            }

            // Validate and sanitize preferences
            const validPrefs = {};

            if (typeof preferences.collapsed === 'boolean') {
                validPrefs.collapsed = preferences.collapsed;
            }
            if (['all', 'leagues', 'tournaments', 'following'].includes(preferences.filter)) {
                validPrefs.filter = preferences.filter;
            }
            if (Array.isArray(preferences.dismissed_matches)) {
                validPrefs.dismissed_matches = preferences.dismissed_matches.slice(0, 50); // Limit to 50
            }
            if (Array.isArray(preferences.following_players)) {
                validPrefs.following_players = preferences.following_players.slice(0, 100); // Limit to 100
            }

            await db.collection('players').doc(player.id).update({
                ticker_prefs: validPrefs
            });

            res.json({
                success: true,
                preferences: validPrefs
            });

        } catch (error) {
            console.error('Error updating ticker preferences:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
