/**
 * Captain Portal Functions
 * Handles captain-specific features:
 * - Player availability management
 * - Go-to subs management
 * - Fill-in request workflow
 * - Team settings and communication
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================================
// PLAYER AVAILABILITY
// ============================================================================

/**
 * Update a player's season availability (week-based grid)
 * POST /updateSeasonAvailability
 * Body: { league_id, team_id, player_id, week, available (bool), captain_id }
 */
exports.updateSeasonAvailability = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, player_id, week, available, captain_id } = req.body;

        if (!league_id || !team_id || !player_id || week === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, player_id, week'
            });
        }

        // Get team document to update availability grid
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();

        // Update the availability grid
        // Structure: { player_id: { week1: true, week2: false, ... } }
        const availabilityGrid = team.availability_grid || {};
        if (!availabilityGrid[player_id]) {
            availabilityGrid[player_id] = {};
        }
        availabilityGrid[player_id][`week${week}`] = available;

        await teamRef.update({
            availability_grid: availabilityGrid,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Also update match-specific availability if there's a match for this week
        const matchesSnap = await db.collection('leagues').doc(league_id)
            .collection('matches')
            .where('week', '==', week)
            .get();

        for (const matchDoc of matchesSnap.docs) {
            const match = matchDoc.data();
            // Only update if this team is in the match
            if (match.home_team_id === team_id || match.away_team_id === team_id) {
                const playerAvailability = match.player_availability || {};
                playerAvailability[player_id] = available ? 'available' : 'unavailable';

                await matchDoc.ref.update({
                    player_availability: playerAvailability
                });
            }
        }

        res.json({
            success: true,
            message: `Updated availability for week ${week}`,
            player_id,
            week,
            available
        });

    } catch (error) {
        console.error('Error updating player availability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GO-TO SUBS MANAGEMENT
// ============================================================================

/**
 * Add a player to captain's go-to subs list for a level
 * POST /addGotoSub
 * Body: { league_id, team_id, sub_player_id, level, captain_id }
 */
exports.addGotoSub = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, sub_player_id, level, captain_id } = req.body;

        if (!league_id || !team_id || !sub_player_id || !level) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, sub_player_id, level'
            });
        }

        // Get team document
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();

        // Get sub player info
        const subPlayerRef = db.collection('leagues').doc(league_id)
            .collection('players').doc(sub_player_id);
        let subPlayerDoc = await subPlayerRef.get();

        // If not in league players, check registrations
        if (!subPlayerDoc.exists) {
            const regSnap = await db.collection('leagues').doc(league_id)
                .collection('registrations')
                .where('player_id', '==', sub_player_id)
                .limit(1).get();

            if (!regSnap.empty) {
                subPlayerDoc = regSnap.docs[0];
            }
        }

        if (!subPlayerDoc || !subPlayerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Sub player not found' });
        }

        const subPlayer = subPlayerDoc.data();

        // Update go-to subs
        // Structure: { A: [{id, name, phone}], B: [...], C: [...] }
        const gotoSubs = team.goto_subs || { A: [], B: [], C: [] };
        if (!gotoSubs[level]) {
            gotoSubs[level] = [];
        }

        // Check if already in list
        if (gotoSubs[level].some(s => s.id === sub_player_id)) {
            return res.json({
                success: true,
                message: 'Player already in go-to list',
                goto_subs: gotoSubs
            });
        }

        // Add to list
        gotoSubs[level].push({
            id: sub_player_id,
            name: subPlayer.name || subPlayer.full_name,
            phone: subPlayer.phone,
            added_at: new Date().toISOString()
        });

        await teamRef.update({
            goto_subs: gotoSubs,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: `Added ${subPlayer.name || subPlayer.full_name} to ${level} level go-to subs`,
            goto_subs: gotoSubs
        });

    } catch (error) {
        console.error('Error adding go-to sub:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Remove a player from captain's go-to subs list
 * POST /removeGotoSub
 * Body: { league_id, team_id, sub_player_id, level, captain_id }
 */
exports.removeGotoSub = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, sub_player_id, level, captain_id } = req.body;

        if (!league_id || !team_id || !sub_player_id || !level) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, sub_player_id, level'
            });
        }

        // Get team document
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();
        const gotoSubs = team.goto_subs || { A: [], B: [], C: [] };

        if (!gotoSubs[level]) {
            return res.json({ success: true, message: 'Level not found', goto_subs: gotoSubs });
        }

        // Remove from list
        const removedName = gotoSubs[level].find(s => s.id === sub_player_id)?.name || 'Player';
        gotoSubs[level] = gotoSubs[level].filter(s => s.id !== sub_player_id);

        await teamRef.update({
            goto_subs: gotoSubs,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: `Removed ${removedName} from ${level} level go-to subs`,
            goto_subs: gotoSubs
        });

    } catch (error) {
        console.error('Error removing go-to sub:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Save a sub playlist (named group of go-to subs)
 * POST /saveSubPlaylist
 * Body: { league_id, team_id, playlist_name, sub_ids, level, captain_id }
 */
exports.saveSubPlaylist = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, playlist_name, sub_ids, level, captain_id } = req.body;

        if (!league_id || !team_id || !playlist_name || !sub_ids || !level) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, playlist_name, sub_ids, level'
            });
        }

        // Get team document
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();
        const playlists = team.sub_playlists || [];

        // Check if playlist name already exists
        const existingIndex = playlists.findIndex(p => p.name === playlist_name);

        const playlistEntry = {
            name: playlist_name,
            level,
            sub_ids,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            playlists[existingIndex] = { ...playlists[existingIndex], ...playlistEntry };
        } else {
            playlists.push(playlistEntry);
        }

        await teamRef.update({
            sub_playlists: playlists,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: `Saved playlist "${playlist_name}"`,
            playlists
        });

    } catch (error) {
        console.error('Error saving sub playlist:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// FILL-IN REQUEST WORKFLOW
// ============================================================================

/**
 * Send fill-in requests to selected subs via SMS
 * POST /sendFillinRequests
 * Body: { league_id, team_id, match_id, sub_ids, message, deadline, captain_id }
 */
exports.sendFillinRequests = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, match_id, sub_ids, message, deadline, captain_id } = req.body;

        if (!league_id || !team_id || !match_id || !sub_ids || sub_ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, match_id, sub_ids[]'
            });
        }

        // Get match info
        const matchDoc = await db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id).get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Get team info
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        // Create fill-in request record
        const fillinRequestRef = await db.collection('leagues').doc(league_id)
            .collection('fillin_requests').add({
                team_id,
                team_name: team.team_name || team.name,
                match_id,
                match_week: match.week,
                match_date: match.match_date,
                sub_ids,
                message: message || `Need a fill-in for Week ${match.week}. Reply YES if interested.`,
                deadline: deadline || null,
                captain_id,
                status: 'pending',
                responses: {},
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

        // Get sub player info and queue SMS messages
        const sentTo = [];
        const failed = [];

        for (const subId of sub_ids) {
            // Try to find sub in various collections
            let subPlayer = null;

            // Check league players
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(subId).get();
            if (playerDoc.exists) {
                subPlayer = playerDoc.data();
            }

            // Check registrations
            if (!subPlayer) {
                const regSnap = await db.collection('leagues').doc(league_id)
                    .collection('registrations')
                    .where('player_id', '==', subId)
                    .limit(1).get();
                if (!regSnap.empty) {
                    subPlayer = regSnap.docs[0].data();
                }
            }

            // Check global players
            if (!subPlayer) {
                const globalDoc = await db.collection('players').doc(subId).get();
                if (globalDoc.exists) {
                    subPlayer = globalDoc.data();
                }
            }

            if (!subPlayer || !subPlayer.phone) {
                failed.push({ id: subId, reason: 'No phone number' });
                continue;
            }

            // Format the SMS message
            const matchDate = match.match_date ?
                (match.match_date.toDate ? match.match_date.toDate() : new Date(match.match_date)) :
                null;
            const dateStr = matchDate ? matchDate.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
            }) : `Week ${match.week}`;

            const smsMessage = message ||
                `BRDC: ${team.team_name || 'Team'} needs a fill-in for ${dateStr}. ` +
                `Reply YES if interested. ${deadline ? `Deadline: ${deadline}` : ''}`;

            // Queue SMS (using your existing SMS system)
            await db.collection('sms_queue').add({
                to: subPlayer.phone,
                message: smsMessage,
                type: 'fillin_request',
                fillin_request_id: fillinRequestRef.id,
                player_id: subId,
                player_name: subPlayer.name || subPlayer.full_name,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                sent: false
            });

            sentTo.push({
                id: subId,
                name: subPlayer.name || subPlayer.full_name,
                phone: subPlayer.phone
            });
        }

        res.json({
            success: true,
            message: `Fill-in requests queued for ${sentTo.length} subs`,
            request_id: fillinRequestRef.id,
            sent_to: sentTo,
            failed
        });

    } catch (error) {
        console.error('Error sending fill-in requests:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get responses to a fill-in request
 * POST /getFillinResponses
 * Body: { league_id, request_id }
 */
exports.getFillinResponses = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, request_id } = req.body;

        if (!league_id || !request_id) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, request_id'
            });
        }

        const requestDoc = await db.collection('leagues').doc(league_id)
            .collection('fillin_requests').doc(request_id).get();

        if (!requestDoc.exists) {
            return res.status(404).json({ success: false, error: 'Fill-in request not found' });
        }

        const request = requestDoc.data();
        const responses = request.responses || {};

        // Build response list with player info
        const interested = [];
        const declined = [];
        const pending = [];

        for (const subId of request.sub_ids) {
            const response = responses[subId];

            // Get player info
            let playerName = 'Unknown';
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(subId).get();
            if (playerDoc.exists) {
                playerName = playerDoc.data().name;
            }

            const entry = {
                id: subId,
                name: playerName,
                responded_at: response?.responded_at || null
            };

            if (response?.interested === true) {
                interested.push(entry);
            } else if (response?.interested === false) {
                declined.push(entry);
            } else {
                pending.push(entry);
            }
        }

        res.json({
            success: true,
            request_id,
            status: request.status,
            deadline: request.deadline,
            interested,
            declined,
            pending,
            confirmed_sub: request.confirmed_sub || null
        });

    } catch (error) {
        console.error('Error getting fill-in responses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Record a fill-in response (called when sub replies YES/NO)
 * POST /recordFillinResponse
 * Body: { league_id, request_id, player_id, interested (bool) }
 */
exports.recordFillinResponse = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, request_id, player_id, interested } = req.body;

        if (!league_id || !request_id || !player_id || interested === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, request_id, player_id, interested'
            });
        }

        const requestRef = db.collection('leagues').doc(league_id)
            .collection('fillin_requests').doc(request_id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ success: false, error: 'Fill-in request not found' });
        }

        // Update response
        await requestRef.update({
            [`responses.${player_id}`]: {
                interested,
                responded_at: admin.firestore.FieldValue.serverTimestamp()
            }
        });

        // Get player name for confirmation
        let playerName = 'Player';
        const playerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id).get();
        if (playerDoc.exists) {
            playerName = playerDoc.data().name;
        }

        res.json({
            success: true,
            message: interested ?
                `${playerName} is interested in filling in!` :
                `${playerName} is not available.`,
            player_id,
            interested
        });

    } catch (error) {
        console.error('Error recording fill-in response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Share interested subs with team via push notification + SMS
 * POST /shareFillinInterestWithTeam
 * Body: { league_id, team_id, request_id, interested_sub_ids, captain_id }
 */
exports.shareFillinInterestWithTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, request_id, interested_sub_ids, captain_id } = req.body;

        if (!league_id || !team_id || !request_id) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, request_id'
            });
        }

        // Get request info
        const requestDoc = await db.collection('leagues').doc(league_id)
            .collection('fillin_requests').doc(request_id).get();

        if (!requestDoc.exists) {
            return res.status(404).json({ success: false, error: 'Fill-in request not found' });
        }

        const request = requestDoc.data();

        // Get team roster
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        // Get interested subs info
        const interestedNames = [];
        for (const subId of (interested_sub_ids || [])) {
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(subId).get();
            if (playerDoc.exists) {
                interestedNames.push(playerDoc.data().name);
            }
        }

        // Build message
        const message = `BRDC ${team.team_name || 'Team'}: ` +
            `${interestedNames.length} sub(s) interested in filling in for Week ${request.match_week}: ` +
            `${interestedNames.join(', ')}. ` +
            `Discuss in team chat!`;

        // Get team members
        const playersSnap = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('team_id', '==', team_id)
            .get();

        const notified = [];

        for (const playerDoc of playersSnap.docs) {
            const player = playerDoc.data();
            const playerId = player.player_id || playerDoc.id;

            // Don't notify the captain who sent this
            if (playerId === captain_id) continue;

            // Check for FCM token (push notification capability)
            const globalPlayerDoc = await db.collection('players').doc(playerId).get();
            const hasPush = globalPlayerDoc.exists && globalPlayerDoc.data().fcm_token;

            // Queue push notification if available
            if (hasPush) {
                await db.collection('push_queue').add({
                    token: globalPlayerDoc.data().fcm_token,
                    title: 'Fill-in Candidates',
                    body: message,
                    data: {
                        type: 'fillin_interest',
                        league_id,
                        team_id,
                        request_id
                    },
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    sent: false
                });
            }

            // Always queue SMS as backup
            if (player.phone) {
                await db.collection('sms_queue').add({
                    to: player.phone,
                    message,
                    type: 'fillin_team_notification',
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    sent: false
                });
            }

            notified.push({
                id: playerId,
                name: player.name,
                has_push: hasPush
            });
        }

        // Update request to mark as shared
        await requestDoc.ref.update({
            shared_with_team: true,
            shared_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: `Notified ${notified.length} team members`,
            notified
        });

    } catch (error) {
        console.error('Error sharing fill-in interest:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Confirm a fill-in for a match
 * POST /confirmFillin
 * Body: { league_id, team_id, match_id, request_id, sub_player_id, replacing_player_id, captain_id }
 */
exports.confirmFillin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, match_id, request_id, sub_player_id, replacing_player_id, captain_id } = req.body;

        if (!league_id || !team_id || !match_id || !sub_player_id) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, match_id, sub_player_id'
            });
        }

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Get sub player info
        let subPlayer = null;
        const subPlayerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(sub_player_id).get();
        if (subPlayerDoc.exists) {
            subPlayer = subPlayerDoc.data();
        } else {
            // Check registrations
            const regSnap = await db.collection('leagues').doc(league_id)
                .collection('registrations')
                .where('player_id', '==', sub_player_id)
                .limit(1).get();
            if (!regSnap.empty) {
                subPlayer = regSnap.docs[0].data();
            }
        }

        if (!subPlayer) {
            return res.status(404).json({ success: false, error: 'Sub player not found' });
        }

        // Update match lineup
        const isHome = match.home_team_id === team_id;
        const lineupField = isHome ? 'home_lineup' : 'away_lineup';
        let lineup = match[lineupField] || [];

        // Add sub to lineup
        const lineupEntry = {
            player_id: sub_player_id,
            player_name: subPlayer.name || subPlayer.full_name,
            is_sub: true,
            replacing_player_id: replacing_player_id || null,
            position: 'S'
        };

        // Check if already in lineup
        if (!lineup.some(p => p.player_id === sub_player_id)) {
            lineup.push(lineupEntry);
        }

        await matchRef.update({
            [lineupField]: lineup,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update fill-in request if exists
        if (request_id) {
            await db.collection('leagues').doc(league_id)
                .collection('fillin_requests').doc(request_id)
                .update({
                    status: 'confirmed',
                    confirmed_sub: {
                        id: sub_player_id,
                        name: subPlayer.name || subPlayer.full_name
                    },
                    confirmed_at: admin.firestore.FieldValue.serverTimestamp()
                });
        }

        // Send confirmation SMS to sub
        if (subPlayer.phone) {
            const teamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(team_id).get();
            const team = teamDoc.data();

            const matchDate = match.match_date ?
                (match.match_date.toDate ? match.match_date.toDate() : new Date(match.match_date)) :
                null;
            const dateStr = matchDate ? matchDate.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric'
            }) : `Week ${match.week}`;

            await db.collection('sms_queue').add({
                to: subPlayer.phone,
                message: `BRDC: You're confirmed as fill-in for ${team.team_name || 'Team'} on ${dateStr}! ` +
                    `Check the app for details. Thanks!`,
                type: 'fillin_confirmation',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                sent: false
            });
        }

        res.json({
            success: true,
            message: `${subPlayer.name || subPlayer.full_name} confirmed as fill-in`,
            sub: {
                id: sub_player_id,
                name: subPlayer.name || subPlayer.full_name
            }
        });

    } catch (error) {
        console.error('Error confirming fill-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// TEAM SETTINGS
// ============================================================================

/**
 * Update team settings (photo, name, motto, auto-reminders)
 * POST /updateTeamSettings
 * Body: { league_id, team_id, settings: { photo_url, team_name, motto, auto_reminders }, captain_id }
 */
exports.updateTeamSettings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, settings, captain_id } = req.body;

        if (!league_id || !team_id || !settings) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, settings'
            });
        }

        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        // Build update object
        const updateData = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (settings.photo_url !== undefined) {
            updateData.photo_url = settings.photo_url;
        }
        if (settings.team_name !== undefined) {
            updateData.team_name = settings.team_name;
        }
        if (settings.motto !== undefined) {
            updateData.motto = settings.motto;
        }
        if (settings.auto_reminders !== undefined) {
            updateData.auto_reminders = settings.auto_reminders;
        }

        await teamRef.update(updateData);

        res.json({
            success: true,
            message: 'Team settings updated',
            updated: Object.keys(settings)
        });

    } catch (error) {
        console.error('Error updating team settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CAPTAIN COMMUNICATION
// ============================================================================

/**
 * Send message from captain to selected recipients
 * POST /sendCaptainMessage
 * Body: { league_id, team_id, captain_id, recipients[], channels[], message, template_id? }
 */
exports.sendCaptainMessageV2 = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_id, recipients, channels, message, subject } = req.body;

        if (!league_id || !team_id || !message || !recipients || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, team_id, message, recipients[]'
            });
        }

        const sentResults = [];
        const channelsToUse = channels || ['sms'];

        for (const recipientId of recipients) {
            // Get recipient info
            let recipient = null;

            // Check league players
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(recipientId).get();
            if (playerDoc.exists) {
                recipient = playerDoc.data();
            }

            // Check global players for additional info
            const globalDoc = await db.collection('players').doc(recipientId).get();
            if (globalDoc.exists) {
                recipient = { ...recipient, ...globalDoc.data() };
            }

            if (!recipient) {
                sentResults.push({ id: recipientId, status: 'failed', reason: 'Recipient not found' });
                continue;
            }

            const result = { id: recipientId, name: recipient.name, channels: [] };

            // SMS
            if (channelsToUse.includes('sms') && recipient.phone) {
                await db.collection('sms_queue').add({
                    to: recipient.phone,
                    message,
                    type: 'captain_message',
                    from_captain_id: captain_id,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    sent: false
                });
                result.channels.push('sms');
            }

            // Email
            if (channelsToUse.includes('email') && recipient.email) {
                await db.collection('email_queue').add({
                    to: recipient.email,
                    subject: subject || 'Message from your team captain',
                    body: message,
                    type: 'captain_message',
                    from_captain_id: captain_id,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    sent: false
                });
                result.channels.push('email');
            }

            // In-app DM
            if (channelsToUse.includes('dm')) {
                await db.collection('messages').add({
                    from_id: captain_id,
                    to_id: recipientId,
                    message,
                    type: 'captain_dm',
                    league_id,
                    team_id,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
                result.channels.push('dm');
            }

            result.status = result.channels.length > 0 ? 'queued' : 'no_channels';
            sentResults.push(result);
        }

        res.json({
            success: true,
            message: `Message queued for ${sentResults.filter(r => r.status === 'queued').length} recipients`,
            results: sentResults
        });

    } catch (error) {
        console.error('Error sending captain message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get captain message templates
 * GET/POST /getCaptainMessageTemplates
 */
exports.getCaptainMessageTemplates = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        // Return default templates
        const templates = [
            {
                id: 'match_reminder',
                name: 'Match Reminder',
                message: 'Hey [first_name]! Quick reminder - we have a match on [match_date] against [opponent] at [venue]. See you there!'
            },
            {
                id: 'confirm_attendance',
                name: 'Confirm Attendance',
                message: 'Hi [first_name], please confirm if you can make it to our Week [week] match on [match_date]. Reply YES or NO. Thanks!'
            },
            {
                id: 'need_fillin',
                name: 'Need Fill-in',
                message: 'Hey [first_name], we need a fill-in for our Week [week] match on [match_date]. Are you available? Reply YES if interested!'
            },
            {
                id: 'schedule_change',
                name: 'Schedule Change',
                message: 'Important: Our Week [week] match has been rescheduled to [match_date]. Please update your calendar!'
            },
            {
                id: 'custom',
                name: 'Custom Message',
                message: ''
            }
        ];

        res.json({ success: true, templates });

    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
