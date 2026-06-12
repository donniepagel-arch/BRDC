/**
 * Player Profile & Captain Management Functions
 * Handles player authentication, profiles, availability, and captain features
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

const db = admin.firestore();

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ============================================================================
// PLAYER AUTHENTICATION
// ============================================================================
// NOTE: exports.playerLogin (PIN-based) has been removed. Use Firebase Auth
// (getPlayerSession) for all new login flows.

/**
 * Reset/recover player PIN by email
 * Looks up player by email and sends their PIN (for recovery)
 */
exports.resetPlayerPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }

        const emailLower = email.toLowerCase().trim();

        // Find player by email across all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const playersSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('players')
                .where('email', '==', emailLower)
                .get();

            if (!playersSnapshot.empty) {
                const player = playersSnapshot.docs[0].data();
                const playerPin = player.pin;

                if (!playerPin) {
                    return res.status(400).json({ success: false, error: 'No PIN set for this player. Contact your league manager.' });
                }

                // Send PIN via email (queue notification)
                // In production, this would use SendGrid
                await db.collection('notifications_queue').add({
                    type: 'pin_recovery',
                    to_email: emailLower,
                    to_name: player.name,
                    pin: playerPin,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // Log for debugging
                console.log(`PIN recovery requested for ${emailLower}: PIN is ${playerPin}`);

                return res.json({
                    success: true,
                    message: 'PIN has been sent to your email'
                });
            }
        }

        res.status(404).json({ success: false, error: 'No player found with this email' });

    } catch (error) {
        console.error('PIN recovery error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER PROFILE
// ============================================================================

/**
 * Update player photo URL
 */
exports.updatePlayerPhoto = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, player_id, photo_url } = req.body;

        if (!player_id || !photo_url) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Always update global player doc (this is what playerLogin reads for photo_url)
        try {
            await db.collection('players').doc(player_id)
                .update({
                    photo_url: photo_url,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
        } catch (e) {
            console.log('Global player doc update skipped (may not exist):', e.message);
        }

        // Also update league player doc if league_id provided
        if (league_id) {
            try {
                await db.collection('leagues').doc(league_id)
                    .collection('players').doc(player_id)
                    .update({
                        photo_url: photo_url,
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    });
            } catch (e) {
                console.log('League player doc update skipped:', e.message);
            }
        }

        res.json({ success: true, message: 'Photo updated' });

    } catch (error) {
        console.error('Update photo error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get player profile with all stats across leagues
 */
exports.getPlayerProfile = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const playerId = req.query.player_id || req.body.player_id;
        const leagueId = req.query.league_id || req.body.league_id;

        if (!playerId) {
            return res.status(400).json({ success: false, error: 'Missing player_id' });
        }

        let player = null;
        let stats = null;
        let team = null;
        let league = null;

        if (leagueId) {
            // Get from specific league
            const playerDoc = await db.collection('leagues').doc(leagueId)
                .collection('players').doc(playerId).get();

            if (playerDoc.exists) {
                player = { id: playerDoc.id, ...playerDoc.data() };
                delete player.pin; // Don't expose PIN

                // Get stats
                const statsDoc = await db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(playerId).get();
                if (statsDoc.exists) {
                    const rawStats = statsDoc.data();

                    // Use pre-calculated values, or calculate from totals as fallback
                    stats = {
                        ...rawStats,
                        // X01 calculated fields (use stored or calculate)
                        x01_three_dart_avg: rawStats.x01_three_dart_avg ||
                            (rawStats.x01_total_darts > 0
                                ? parseFloat((rawStats.x01_total_points / rawStats.x01_total_darts * 3).toFixed(2))
                                : 0),
                        // Cricket calculated fields (use stored or calculate from darts)
                        cricket_mpr: rawStats.cricket_mpr ||
                            (rawStats.cricket_total_darts > 0
                                ? parseFloat((rawStats.cricket_total_marks / rawStats.cricket_total_darts * 3).toFixed(2))
                                : 0),
                        // Checkout percentage
                        checkout_pct: rawStats.x01_checkout_pct ||
                            (rawStats.x01_checkout_opportunities > 0
                                ? parseFloat((rawStats.x01_checkout_darts / rawStats.x01_checkout_opportunities * 100).toFixed(1))
                                : 0),
                        // Leg win percentages
                        x01_leg_win_pct: rawStats.x01_leg_win_pct ||
                            (rawStats.x01_legs_played > 0
                                ? parseFloat((rawStats.x01_legs_won / rawStats.x01_legs_played * 100).toFixed(1))
                                : 0),
                        cricket_leg_win_pct: rawStats.cricket_leg_win_pct ||
                            (rawStats.cricket_legs_played > 0
                                ? parseFloat((rawStats.cricket_legs_won / rawStats.cricket_legs_played * 100).toFixed(1))
                                : 0)
                    };
                }

                // Get team
                if (player.team_id) {
                    const teamDoc = await db.collection('leagues').doc(leagueId)
                        .collection('teams').doc(player.team_id).get();
                    if (teamDoc.exists) {
                        team = { id: teamDoc.id, ...teamDoc.data() };
                    }
                }

                // Get league info
                const leagueDoc = await db.collection('leagues').doc(leagueId).get();
                if (leagueDoc.exists) {
                    league = { id: leagueDoc.id, ...leagueDoc.data() };
                    delete league.admin_pin;
                }
            }
        }

        res.json({
            success: true,
            player,
            stats,
            team,
            league
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER AVAILABILITY
// ============================================================================

/**
 * Set player availability for a match
 */
exports.setPlayerAvailability = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, player_id, available } = req.body;

        if (!league_id || !match_id || !player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Update availability
        const playerAvailability = match.player_availability || {};
        playerAvailability[player_id] = available ? 'available' : 'unavailable';

        await matchRef.update({
            player_availability: playerAvailability,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // If marking unavailable, notify captain
        if (!available) {
            await notifyCaptainOfUnavailability(league_id, match, player_id);
        }

        res.json({
            success: true,
            message: available ? 'Marked as available' : 'Marked as unavailable'
        });

    } catch (error) {
        console.error('Set availability error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function notifyCaptainOfUnavailability(leagueId, match, playerId) {
    try {
        // Get player info
        const playerDoc = await db.collection('leagues').doc(leagueId)
            .collection('players').doc(playerId).get();

        if (!playerDoc.exists) return;
        const player = playerDoc.data();

        // Determine which team the player is on
        let teamId = player.team_id;
        if (!teamId) return;

        // Get team to find captain
        const teamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(teamId).get();

        if (!teamDoc.exists) return;
        const team = teamDoc.data();

        // Find captain
        const captainId = team.captain_id;
        if (!captainId) return;

        const captainDoc = await db.collection('leagues').doc(leagueId)
            .collection('players').doc(captainId).get();

        if (!captainDoc.exists) return;
        const captain = captainDoc.data();

        // Create notification
        await db.collection('leagues').doc(leagueId)
            .collection('notifications').add({
                type: 'player_unavailable',
                recipient_id: captainId,
                recipient_email: captain.email,
                recipient_phone: captain.phone,
                message: `${player.name} marked themselves unavailable for Week ${match.week} match`,
                match_id: match.id,
                player_id: playerId,
                player_name: player.name,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                sent: false
            });

        console.log(`Notification created for captain ${captain.name} about ${player.name}'s unavailability`);

    } catch (error) {
        console.error('Error notifying captain:', error);
    }
}

/**
 * Get team availability for a match (for captains)
 */
exports.getTeamAvailability = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id } = req.query.league_id ? req.query : req.body;

        if (!league_id || !match_id || !team_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const matchDoc = await db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id).get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const playerAvailability = match.player_availability || {};

        // Get team roster
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();
        const roster = team.players || [];

        // Build availability list
        const availability = roster.map(player => ({
            id: player.id,
            name: player.name,
            position: player.position,
            status: playerAvailability[player.id] || 'unknown'
        }));

        res.json({
            success: true,
            availability,
            match_week: match.week,
            match_date: match.match_date
        });

    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CAPTAIN DASHBOARD
// ============================================================================

/**
 * Get captain dashboard data
 */
exports.getCaptainDashboard = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_email, captain_id } = req.query.league_id ? req.query : req.body;

        if (!league_id || !team_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id or team_id' });
        }

        // Get team
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Verify captain authorization
        // Captain must be verified by any of:
        // 1. captain_id matching team.captain_id
        // 2. captain_id is a player on this team who is captain/level A
        // 3. captain_email matching a captain player on this team
        let isAuthorized = false;

        if (captain_id && team.captain_id === captain_id) {
            isAuthorized = true;
        }

        // Check if captain_id is a league player on this team with captain/A-level status
        if (!isAuthorized && captain_id) {
            // Try looking up by global player ID in league players
            const leaguePlayersSnap = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('team_id', '==', team_id)
                .get();

            for (const lpDoc of leaguePlayersSnap.docs) {
                const lp = lpDoc.data();
                // Match by doc ID, or by name/pin cross-reference from global player
                if (lpDoc.id === captain_id ||
                    lp.global_player_id === captain_id) {
                    if (lpDoc.id === team.captain_id ||
                        lp.is_captain === true ||
                        lp.skill_level === 'A' ||
                        lp.preferred_level === 'A' ||
                        lp.position === 1) {
                        isAuthorized = true;
                        break;
                    }
                }
            }

            // Also check if global player's name matches a captain/A-level player on this team
            if (!isAuthorized) {
                try {
                    const globalPlayerDoc = await db.collection('players').doc(captain_id).get();
                    if (globalPlayerDoc.exists) {
                        const globalPlayer = globalPlayerDoc.data();
                        const globalName = (globalPlayer.name || '').toLowerCase().trim();
                        const globalPin = globalPlayer.pin;

                        for (const lpDoc of leaguePlayersSnap.docs) {
                            const lp = lpDoc.data();
                            const lpName = (lp.name || '').toLowerCase().trim();
                            // Match by name or PIN
                            if (lpName === globalName || (globalPin && lp.pin === globalPin)) {
                                if (lpDoc.id === team.captain_id ||
                                    lp.is_captain === true ||
                                    lp.skill_level === 'A' ||
                                    lp.preferred_level === 'A' ||
                                    lp.position === 1) {
                                    isAuthorized = true;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log('Global player lookup for captain auth:', e.message);
                }
            }
        }

        if (!isAuthorized && captain_email) {
            // Check if email belongs to a captain on this team
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('team_id', '==', team_id)
                .limit(1)
                .get();

            if (!captainSnapshot.empty) {
                const captainPlayer = captainSnapshot.docs[0].data();
                // Check if this player is the captain or is level A (for triples leagues)
                if (captainSnapshot.docs[0].id === team.captain_id ||
                    captainPlayer.is_captain === true ||
                    captainPlayer.skill_level === 'A' ||
                    captainPlayer.preferred_level === 'A') {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            console.log('Captain auth failed:', { captain_id, captain_email, team_captain_id: team.captain_id, team_id });
            return res.status(403).json({
                success: false,
                error: 'Not authorized as captain for this team'
            });
        }

        // ============================================================================
        // PARALLEL DATA LOADING — all independent queries run simultaneously
        // ============================================================================

        const leagueRef = db.collection('leagues').doc(league_id);

        // Wave 1: All independent queries in parallel (fetch ALL league players for opponent data)
        const [leagueDoc, matchesSnapshot, allPlayersSnap, allTeamsSnap, fillinRequestsSnapshot] = await Promise.all([
            leagueRef.get(),
            leagueRef.collection('matches')
                .select(
                    'week',
                    'match_week',
                    'match_date',
                    'date',
                    'status',
                    'winner',
                    'home_team_id',
                    'away_team_id',
                    'home_team_name',
                    'away_team_name',
                    'home_score',
                    'away_score',
                    'player_availability'
                )
                .orderBy('week', 'asc')
                .get(),
            leagueRef.collection('players').get(),
            leagueRef.collection('teams')
                .select('team_name', 'name', 'captain_id', 'max_roster')
                .get(),
            leagueRef.collection('fillin_requests')
                .where('team_id', '==', team_id)
                .where('status', '==', 'pending')
                .get()
        ]);

        const league = leagueDoc.data();
        delete league.admin_pin;

        // Process matches
        const matches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team_id || match.away_team_id === team_id) {
                matches.push({
                    id: doc.id,
                    week: match.week || match.match_week || null,
                    match_date: match.match_date || match.date || null,
                    status: match.status || 'scheduled',
                    winner: match.winner || null,
                    home_team_id: match.home_team_id || null,
                    away_team_id: match.away_team_id || null,
                    home_team_name: match.home_team_name || null,
                    away_team_name: match.away_team_name || null,
                    home_score: Number(match.home_score || 0),
                    away_score: Number(match.away_score || 0),
                    is_home: match.home_team_id === team_id,
                    availability: match.player_availability || {}
                });
            }
        });

        // Process ALL league players
        const allLeaguePlayers = [];
        allPlayersSnap.forEach(doc => { allLeaguePlayers.push({ id: doc.id, ...doc.data() }); });

        const rosterLevel = (player) => String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
        const rosterSort = (a, b) => {
            const order = { A: 1, B: 2, C: 3 };
            const aLevel = order[rosterLevel(a)] || Number(a?.position || 99);
            const bLevel = order[rosterLevel(b)] || Number(b?.position || 99);
            if (aLevel !== bLevel) return aLevel - bLevel;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
        };
        const normalizeRosterPlayer = (player) => {
            const level = rosterLevel(player);
            const position = ({ A: 1, B: 2, C: 3 })[level] || Number(player?.position || 99);
            return {
                ...player,
                level: level || player.level,
                skill_level: level || player.skill_level,
                preferred_level: level || player.preferred_level,
                position
            };
        };

        // Team players (roster, exclude subs/fill-ins)
        const teamPlayers = allLeaguePlayers
            .filter(p => p.team_id === team_id && !p.is_sub && !p.is_fillin)
            .map(normalizeRosterPlayer)
            .sort(rosterSort);
        team.players = teamPlayers;

        // All roster players (for batch stats fetch)
        const allRosterPlayers = allLeaguePlayers
            .filter(p => p.team_id && !p.is_sub && !p.is_fillin)
            .map(normalizeRosterPlayer);

        // Group by team for opponent lookups
        const playersByTeam = {};
        allRosterPlayers.forEach(p => {
            if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = [];
            playersByTeam[p.team_id].push(p);
        });

        // Process all teams for standings
        const allTeams = [];
        allTeamsSnap.forEach(doc => { allTeams.push({ id: doc.id, ...doc.data() }); });

        // Subs / fill-ins
        // Older records used is_sub; newer league fill-ins may be tracked by
        // team_id="fill_in" or is_fillin. Captain dashboard should show all.
        const subs = [];
        allLeaguePlayers.forEach(p => {
            const isSub = p.is_sub === true ||
                p.is_fillin === true ||
                p.is_fill_in === true ||
                p.team_id === 'fill_in' ||
                p.team_id === 'fill-in' ||
                p.team_id === 'fillin';
            if (isSub) {
                const sub = { ...p };
                delete sub.pin;
                subs.push(sub);
            }
        });
        subs.sort((a, b) => {
            const levelA = String(a.skill_level || a.level || a.preferred_level || 'Z');
            const levelB = String(b.skill_level || b.level || b.preferred_level || 'Z');
            if (levelA !== levelB) return levelA.localeCompare(levelB);
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        // Wave 2: ALL player stats + notifications + free agents (parallel)
        const statsPlayers = [...allRosterPlayers, ...subs];
        const statsRefs = statsPlayers.map(p => leagueRef.collection('stats').doc(p.id));
        const wave2Promises = [
            statsRefs.length > 0 ? db.getAll(...statsRefs) : Promise.resolve([]),
            team.captain_id
                ? leagueRef.collection('notifications').where('recipient_id', '==', team.captain_id).get()
                : Promise.resolve(null),
            league.allow_free_agents !== false
                ? leagueRef.collection('registrations').where('status', '==', 'free_agent').get()
                : Promise.resolve(null)
        ];

        const [statsDocs, notificationsSnap, freeAgentSnap] = await Promise.all(wave2Promises);

        // Build stats map for ALL roster and fill-in players
        const calcStats = (stats) => {
            stats.x01_three_dart_avg = stats.x01_three_dart_avg ||
                (stats.x01_total_darts > 0 ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2)) : 0);
            stats.cricket_mpr = stats.cricket_mpr ||
                (stats.cricket_total_darts > 0 ? parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2)) : 0);
            return stats;
        };
        const allStatsMap = {};
        statsPlayers.forEach((player, i) => {
            if (statsDocs[i] && statsDocs[i].exists) {
                allStatsMap[player.id] = calcStats(statsDocs[i].data());
            }
        });

        subs.forEach(sub => {
            const stats = allStatsMap[sub.id] || {};
            sub.x01_three_dart_avg = Number(stats.x01_three_dart_avg || sub.x01_three_dart_avg || sub.avg_3da || 0);
            sub.cricket_mpr = Number(stats.cricket_mpr || sub.cricket_mpr || sub.mpr || 0);
            sub.x01_legs_played = Number(stats.x01_legs_played || 0);
            sub.x01_legs_won = Number(stats.x01_legs_won || 0);
            sub.cricket_legs_played = Number(stats.cricket_legs_played || 0);
            sub.cricket_legs_won = Number(stats.cricket_legs_won || 0);
        });

        // Build team player stats array
        const playerStats = teamPlayers.map(player => {
            const stats = allStatsMap[player.id] || {};
            return { player_id: player.id, player_name: player.name, x01_three_dart_avg: 0, cricket_mpr: 0, ...stats };
        });

        // Build notifications
        const notifications = [];
        if (notificationsSnap && notificationsSnap.forEach) {
            notificationsSnap.forEach(doc => { notifications.push({ id: doc.id, ...doc.data() }); });
        }
        notifications.sort((a, b) => {
            const aTime = a.created_at?.toMillis ? a.created_at.toMillis() : (new Date(a.created_at || 0).getTime() || 0);
            const bTime = b.created_at?.toMillis ? b.created_at.toMillis() : (new Date(b.created_at || 0).getTime() || 0);
            return bTime - aTime;
        });
        if (notifications.length > 10) notifications.length = 10;

        // Build free agents
        const freeAgents = [];
        if (freeAgentSnap && freeAgentSnap.forEach) {
            freeAgentSnap.forEach(doc => { const fa = doc.data(); delete fa.pin; freeAgents.push({ id: doc.id, ...fa }); });
        }

        // Wave 3: sub names (for fill-in requests)
        const allSubIds = new Set();
        fillinRequestsSnapshot.docs.forEach(doc => {
            (doc.data().sub_ids || []).forEach(id => allSubIds.add(id));
        });

        const subDocs = allSubIds.size > 0
            ? await db.getAll(...[...allSubIds].map(id => leagueRef.collection('players').doc(id)))
            : [];

        // Build sub name map
        const subNameMap = {};
        subDocs.forEach(doc => { if (doc.exists) subNameMap[doc.id] = doc.data().name; });

        // Build fill-in requests
        const pendingFillinRequests = [];
        fillinRequestsSnapshot.docs.forEach(doc => {
            const request = doc.data();
            const responses = request.responses || {};
            const interested = [], declined = [], pending = [];
            for (const subId of request.sub_ids || []) {
                const entry = { id: subId, name: subNameMap[subId] || 'Unknown' };
                const response = responses[subId];
                if (response?.interested === true) interested.push(entry);
                else if (response?.interested === false) declined.push(entry);
                else pending.push(entry);
            }
            pendingFillinRequests.push({ request_id: doc.id, match_id: request.match_id, match_week: request.match_week, status: request.status, interested, declined, pending });
        });
        pendingFillinRequests.sort((a, b) => {
            const aReq = fillinRequestsSnapshot.docs.find(doc => doc.id === a.request_id)?.data() || {};
            const bReq = fillinRequestsSnapshot.docs.find(doc => doc.id === b.request_id)?.data() || {};
            const aTime = aReq.created_at?.toMillis ? aReq.created_at.toMillis() : (new Date(aReq.created_at || 0).getTime() || 0);
            const bTime = bReq.created_at?.toMillis ? bReq.created_at.toMillis() : (new Date(bReq.created_at || 0).getTime() || 0);
            return bTime - aTime;
        });
        if (pendingFillinRequests.length > 5) pendingFillinRequests.length = 5;

        // ============================================================================
        // CALCULATE TEAM STANDINGS (from already-loaded data, no extra queries)
        // ============================================================================

        const teamRecords = {};
        allTeams.forEach(t => { teamRecords[t.id] = { wins: 0, losses: 0, set_wins: 0, set_losses: 0 }; });

        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.status === 'completed' && match.winner) {
                const homeId = match.home_team_id;
                const awayId = match.away_team_id;
                const homeScore = match.home_score || 0;
                const awayScore = match.away_score || 0;
                if (teamRecords[homeId]) { teamRecords[homeId].set_wins += homeScore; teamRecords[homeId].set_losses += awayScore; }
                if (teamRecords[awayId]) { teamRecords[awayId].set_wins += awayScore; teamRecords[awayId].set_losses += homeScore; }
                if (match.winner === 'home') {
                    if (teamRecords[homeId]) teamRecords[homeId].wins++;
                    if (teamRecords[awayId]) teamRecords[awayId].losses++;
                } else if (match.winner === 'away') {
                    if (teamRecords[awayId]) teamRecords[awayId].wins++;
                    if (teamRecords[homeId]) teamRecords[homeId].losses++;
                }
            }
        });

        const sortedTeams = allTeams.map(t => ({
            id: t.id, wins: teamRecords[t.id].wins, losses: teamRecords[t.id].losses,
            set_wins: teamRecords[t.id].set_wins, set_losses: teamRecords[t.id].set_losses
        })).sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.set_wins - a.set_wins);

        const currentTeamStanding = sortedTeams.findIndex(t => t.id === team_id) + 1;

        // Team averages
        let totalTeam3DA = 0, countTeam3DA = 0, totalTeamMPR = 0, countTeamMPR = 0;
        playerStats.forEach(stat => {
            if (stat.x01_three_dart_avg > 0) { totalTeam3DA += stat.x01_three_dart_avg; countTeam3DA++; }
            if (stat.cricket_mpr > 0) { totalTeamMPR += stat.cricket_mpr; countTeamMPR++; }
        });

        team.standing = currentTeamStanding;
        team.team_3da = countTeam3DA > 0 ? parseFloat((totalTeam3DA / countTeam3DA).toFixed(2)) : 0;
        team.team_mpr = countTeamMPR > 0 ? parseFloat((totalTeamMPR / countTeamMPR).toFixed(2)) : 0;
        const myRecord = teamRecords[team_id] || { wins: 0, losses: 0, set_wins: 0, set_losses: 0 };
        team.wins = myRecord.wins;
        team.losses = myRecord.losses;
        team.set_wins = myRecord.set_wins;
        team.set_losses = myRecord.set_losses;
        team.roster_count = teamPlayers.length;

        // ============================================================================
        // OPPONENT DATA — build for ALL opponent teams (from already-loaded data)
        // ============================================================================

        const all_opponents = {};
        for (const [oppTeamId, oppPlayers] of Object.entries(playersByTeam)) {
            if (oppTeamId === team_id) continue;
            const oppTeam = allTeams.find(t => t.id === oppTeamId);
            if (!oppTeam) continue;

            const oppRecord = teamRecords[oppTeamId] || { wins: 0, losses: 0 };
            const oppStanding = sortedTeams.findIndex(t => t.id === oppTeamId) + 1;

            let totalOpp3DA = 0, countOpp3DA = 0, totalOppMPR = 0, countOppMPR = 0;
            oppPlayers.forEach(p => {
                const stat = allStatsMap[p.id];
                if (stat) {
                    if (stat.x01_three_dart_avg > 0) { totalOpp3DA += stat.x01_three_dart_avg; countOpp3DA++; }
                    if (stat.cricket_mpr > 0) { totalOppMPR += stat.cricket_mpr; countOppMPR++; }
                }
            });

            const sortedOppPlayers = [...oppPlayers].map(normalizeRosterPlayer).sort(rosterSort);

            all_opponents[oppTeamId] = {
                team: {
                    id: oppTeamId,
                    name: oppTeam.team_name || oppTeam.name,
                    standing: oppStanding,
                    record: `${oppRecord.wins}-${oppRecord.losses}`,
                    set_wins: oppRecord.set_wins || 0,
                    set_losses: oppRecord.set_losses || 0,
                    team_3da: countOpp3DA > 0 ? parseFloat((totalOpp3DA / countOpp3DA).toFixed(2)) : 0,
                    team_mpr: countOppMPR > 0 ? parseFloat((totalOppMPR / countOppMPR).toFixed(2)) : 0
                },
                players: sortedOppPlayers.map(p => ({
                    id: p.id, name: p.name, position: p.position,
                    level: p.level || p.skill_level || p.preferred_level,
                    stats: {
                        x01_three_dart_avg: allStatsMap[p.id]?.x01_three_dart_avg || 0,
                        cricket_mpr: allStatsMap[p.id]?.cricket_mpr || 0,
                        x01_legs_won: allStatsMap[p.id]?.x01_legs_won || 0,
                        x01_legs_played: allStatsMap[p.id]?.x01_legs_played || 0,
                        cricket_legs_won: allStatsMap[p.id]?.cricket_legs_won || 0,
                        cricket_legs_played: allStatsMap[p.id]?.cricket_legs_played || 0
                    }
                }))
            };
        }

        // Build next_opponent for roster tab backward compat
        const nextMatch = matches.find(m => m.status === 'scheduled');
        const nextOppTeamId = nextMatch ? (nextMatch.is_home ? nextMatch.away_team_id : nextMatch.home_team_id) : null;
        const next_opponent = nextOppTeamId && all_opponents[nextOppTeamId] ? {
            match_id: nextMatch.id, match_week: nextMatch.week, is_home: nextMatch.is_home,
            ...all_opponents[nextOppTeamId]
        } : null;

        const responseTeam = {
            id: team.id,
            team_name: team.team_name || team.name || '',
            name: team.name || team.team_name || '',
            captain_id: team.captain_id || null,
            standing: team.standing,
            wins: team.wins,
            losses: team.losses,
            ties: team.ties || 0,
            set_wins: team.set_wins,
            set_losses: team.set_losses,
            team_3da: team.team_3da,
            team_mpr: team.team_mpr,
            roster_count: team.roster_count,
            max_roster: team.max_roster || 4,
            players: team.players
        };

        res.json({
            success: true,
            team: responseTeam,
            league: { id: league_id, ...league },
            matches,
            player_stats: playerStats,
            available_subs: subs,
            free_agents: freeAgents,
            notifications,
            pending_fillin_requests: pendingFillinRequests,
            next_opponent,
            all_opponents
        });

    } catch (error) {
        console.error('Get captain dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Permanent player replacement (drop player from team)
 */
exports.permanentReplacement = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, drop_player_id, new_player_id, captain_email, reason } = req.body;

        if (!league_id || !team_id || !drop_player_id || !new_player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify captain
        if (captain_email) {
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('is_captain', '==', true)
                .where('team_id', '==', team_id)
                .get();

            if (captainSnapshot.empty) {
                return res.status(403).json({ success: false, error: 'Not authorized as captain' });
            }
        }

        // Get dropped player
        const droppedPlayerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(drop_player_id).get();

        if (!droppedPlayerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Dropped player not found' });
        }

        const droppedPlayer = droppedPlayerDoc.data();
        const position = droppedPlayer.position;

        // Get new player
        const newPlayerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(new_player_id).get();

        if (!newPlayerDoc.exists) {
            return res.status(404).json({ success: false, error: 'New player not found' });
        }

        const newPlayer = newPlayerDoc.data();

        // Update team roster
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();
        const team = teamDoc.data();

        const newRoster = team.players.map(p => {
            if (p.id === drop_player_id) {
                return {
                    id: new_player_id,
                    name: newPlayer.name,
                    position: position
                };
            }
            return p;
        });

        // Batch update
        const batch = db.batch();

        // Update team
        batch.update(teamRef, {
            players: newRoster,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update dropped player
        batch.update(droppedPlayerDoc.ref, {
            team_id: null,
            position: null,
            is_captain: false,
            dropped: true,
            dropped_reason: reason || 'Replaced',
            dropped_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update new player
        batch.update(newPlayerDoc.ref, {
            team_id: team_id,
            position: position,
            is_sub: false,
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log the replacement
        const logRef = db.collection('leagues').doc(league_id)
            .collection('roster_changes').doc();
        batch.set(logRef, {
            team_id: team_id,
            team_name: team.team_name,
            type: 'permanent_replacement',
            dropped_player: { id: drop_player_id, name: droppedPlayer.name },
            new_player: { id: new_player_id, name: newPlayer.name },
            position: position,
            reason: reason || 'Replaced',
            performed_by: captain_email || 'unknown',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({
            success: true,
            message: `${droppedPlayer.name} replaced with ${newPlayer.name}`,
            new_roster: newRoster
        });

    } catch (error) {
        console.error('Permanent replacement error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PUBLIC STATS PORTAL
// ============================================================================

/**
 * Search players across all leagues
 */
exports.searchPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const query = (req.query.q || req.body.q || '').toLowerCase().trim();
        const limit = parseInt(req.query.limit || req.body.limit) || 50;

        if (!query || query.length < 2) {
            return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
        }

        const results = [];
        const seenEmails = new Set();

        // Search all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const league = leagueDoc.data();

            const playersSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('players').get();

            for (const playerDoc of playersSnapshot.docs) {
                const player = playerDoc.data();

                // Check if name matches
                if (player.name && player.name.toLowerCase().includes(query)) {
                    // Avoid duplicates by email
                    if (seenEmails.has(player.email)) continue;
                    seenEmails.add(player.email);

                    // Get stats
                    const statsDoc = await db.collection('leagues').doc(leagueDoc.id)
                        .collection('stats').doc(playerDoc.id).get();

                    let stats = null;
                    if (statsDoc.exists) {
                        const rawStats = statsDoc.data();
                        stats = {
                            x01_three_dart_avg: rawStats.x01_three_dart_avg ||
                                (rawStats.x01_total_darts > 0
                                    ? parseFloat((rawStats.x01_total_points / rawStats.x01_total_darts * 3).toFixed(2))
                                    : 0),
                            cricket_mpr: rawStats.cricket_mpr ||
                                (rawStats.cricket_total_darts > 0
                                    ? parseFloat((rawStats.cricket_total_marks / rawStats.cricket_total_darts * 3).toFixed(2))
                                    : 0),
                            x01_180s: rawStats.x01_tons_180 || 0,
                            high_checkout: rawStats.x01_high_checkout || 0,
                            checkout_pct: rawStats.x01_checkout_pct || 0,
                            first_9_avg: rawStats.x01_first_9_avg || 0
                        };
                    }

                    results.push({
                        id: playerDoc.id,
                        name: player.name,
                        photo_url: player.photo_url,
                        league_id: leagueDoc.id,
                        league_name: league.league_name,
                        team_name: player.team_name,
                        stats: stats
                    });

                    if (results.length >= limit) break;
                }
            }

            if (results.length >= limit) break;
        }

        res.json({ success: true, players: results, count: results.length });

    } catch (error) {
        console.error('Search players error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get global leaderboards across all leagues
 */
exports.getGlobalLeaderboards = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const allStats = [];

        // Collect stats from all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const league = leagueDoc.data();

            const statsSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('stats').get();

            for (const statDoc of statsSnapshot.docs) {
                const stats = statDoc.data();

                // Use pre-calculated averages or calculate from totals
                stats.x01_three_dart_avg = stats.x01_three_dart_avg ||
                    (stats.x01_total_darts > 0
                        ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                        : 0);
                stats.cricket_mpr = stats.cricket_mpr ||
                    (stats.cricket_total_darts > 0
                        ? parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2))
                        : 0);
                stats.checkout_pct = stats.x01_checkout_pct ||
                    (stats.x01_checkout_opportunities > 0
                        ? parseFloat((stats.x01_checkout_darts / stats.x01_checkout_opportunities * 100).toFixed(1))
                        : 0);

                allStats.push({
                    id: statDoc.id,
                    player_name: stats.player_name,
                    league_name: league.league_name,
                    league_id: leagueDoc.id,
                    ...stats
                });
            }
        }

        // Build leaderboards
        const leaderboards = {
            x01_average: [...allStats]
                .filter(s => (s.x01_legs_played || 0) >= 5)
                .sort((a, b) => (b.x01_three_dart_avg || 0) - (a.x01_three_dart_avg || 0))
                .slice(0, 20),

            x01_first_9: [...allStats]
                .filter(s => (s.x01_first_9_avg || 0) > 0)
                .sort((a, b) => (b.x01_first_9_avg || 0) - (a.x01_first_9_avg || 0))
                .slice(0, 20),

            x01_180s: [...allStats]
                .filter(s => (s.x01_tons_180 || 0) > 0)
                .sort((a, b) => (b.x01_tons_180 || 0) - (a.x01_tons_180 || 0))
                .slice(0, 20),

            x01_high_checkout: [...allStats]
                .filter(s => (s.x01_high_checkout || 0) > 0)
                .sort((a, b) => (b.x01_high_checkout || 0) - (a.x01_high_checkout || 0))
                .slice(0, 20),

            x01_checkout_pct: [...allStats]
                .filter(s => (s.x01_checkout_opportunities || 0) >= 10)
                .sort((a, b) => (b.checkout_pct || 0) - (a.checkout_pct || 0))
                .slice(0, 20),

            x01_tons_100: [...allStats]
                .filter(s => (s.x01_tons_100 || 0) > 0)
                .sort((a, b) => (b.x01_tons_100 || 0) - (a.x01_tons_100 || 0))
                .slice(0, 20),

            cricket_mpr: [...allStats]
                .filter(s => (s.cricket_legs_played || 0) >= 5)
                .sort((a, b) => (b.cricket_mpr || 0) - (a.cricket_mpr || 0))
                .slice(0, 20),

            cricket_bulls: [...allStats]
                .filter(s => (s.cricket_bulls || 0) > 0)
                .sort((a, b) => (b.cricket_bulls || 0) - (a.cricket_bulls || 0))
                .slice(0, 20),

            most_legs_won: [...allStats]
                .sort((a, b) => ((b.x01_legs_won || 0) + (b.cricket_legs_won || 0)) -
                    ((a.x01_legs_won || 0) + (a.cricket_legs_won || 0)))
                .slice(0, 20)
        };

        res.json({ success: true, leaderboards });

    } catch (error) {
        console.error('Get global leaderboards error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
