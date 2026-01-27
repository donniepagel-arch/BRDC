/**
 * BRDC Phase 5, 6 & 7 Cloud Functions
 * League System + Notifications + PayPal Integration
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const { sendLeagueRegistrationConfirmation, sendTournamentRegistrationConfirmation } = require('./registration-notifications');
// ============================================================================
// PHASE 5: LEAGUE MANAGEMENT SYSTEM
// ============================================================================

/**
 * Create a new league
 */
exports.createLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const data = req.body;
        
        // Calculate total weeks
        const maxTeams = data.max_teams || 8;
        const rounds = data.rounds || 2;
        const teamsForCalc = maxTeams % 2 === 0 ? maxTeams : maxTeams + 1;
        const matchWeeks = (teamsForCalc - 1) * rounds;
        
        // Calculate end date
        const startDate = new Date(data.start_date);
        const endDate = new Date(startDate);
        const weeksMultiplier = data.match_frequency === 'biweekly' ? 2 : 1;
        endDate.setDate(endDate.getDate() + (matchWeeks * 7 * weeksMultiplier));
        
        const league = {
            league_name: data.league_name,
            league_type: data.league_type || 'triples_draft',
            league_mode: data.league_mode || 'draft', // 'draft' or 'team'
            allow_free_agents: data.allow_free_agents || false,
            season: data.season || 'Spring 2025',
            start_date: data.start_date,
            start_time: data.start_time || '19:00',
            end_date: endDate.toISOString(),
            venue_name: data.venue_name,
            venue_address: data.venue_address || '',

            // Team settings
            max_teams: data.max_teams || null,
            min_players: data.min_players || data.players_per_team || 3,
            max_roster: data.max_roster || data.min_players || data.players_per_team || 4,
            players_per_team: data.players_per_team || data.min_players || 3, // Backwards compat

            // League settings
            total_weeks: matchWeeks,
            session_fee: data.session_fee || 0,
            match_frequency: data.match_frequency || 'weekly',
            schedule_format: data.schedule_format || 'round_robin',
            rounds: rounds,
            league_night: data.league_night || 'thursday',

            // Match format
            games_per_match: data.games_per_match || 9,
            match_format: data.match_format || null,

            // Scoring & Rules
            point_system: data.point_system || 'game_based',
            tiebreakers: data.tiebreakers || ['head_to_head', 'point_diff', 'total_points'],
            cork_rule: data.cork_rule || 'alternate_cork_first_deciding',
            cork_order: data.cork_order || 'home',
            level_rules: data.level_rules || 'play_up',
            league_rules: data.league_rules || '',

            // Playoffs
            playoff_format: data.playoff_format || 'none',
            bye_points: data.bye_points || 'average',

            // Fill-in settings
            allow_fillins: data.allow_fillins || false,
            fillin_settings: data.fillin_settings || null,

            // Draft settings
            draft_date: data.draft_date || null,
            draft_type: data.draft_type || 'snake',
            draft_status: 'pending',

            // Director info
            director_first_name: data.director_first_name || '',
            director_last_name: data.director_last_name || '',
            director_name: data.director_name || `${data.director_first_name || ''} ${data.director_last_name || ''}`.trim(),
            director_email: data.director_email || data.manager_email || '',
            director_phone: data.director_phone || data.manager_phone || '',
            director_player_id: data.director_player_id || null,

            // Status
            status: data.status || 'registration',
            current_week: 0,
            registration_deadline: data.registration_deadline || null,
            registration_close_date: data.registration_close_date || null,
            blackout_dates: data.blackout_dates || [],

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const leagueRef = await admin.firestore().collection('leagues').add(league);
        
        res.json({
            success: true,
            league_id: leagueRef.id,
            message: 'League created successfully'
        });
        
    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Generate unique 8-digit PIN
 */
async function generateUniquePin() {
    let pin;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
        pin = Math.floor(10000000 + Math.random() * 90000000).toString();

        // Check if PIN exists in any player collection
        const existingPlayer = await admin.firestore()
            .collectionGroup('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        const existingReg = await admin.firestore()
            .collectionGroup('registrations')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        if (existingPlayer.empty && existingReg.empty) {
            return pin;
        }
        attempts++;
    }

    throw new Error('Could not generate unique PIN');
}

/**
 * Register player for league
 */
exports.registerForLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, full_name, email, phone, skill_level, sms_opt_in, payment_method, member_pin, photo_url } = req.body;

        // Check if league exists
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (league.status === 'completed') {
            return res.status(400).json({ success: false, error: 'League has ended' });
        }

        // Check if already registered
        const existingReg = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .where('email', '==', email)
            .get();

        if (!existingReg.empty) {
            return res.status(400).json({ success: false, error: 'Already registered for this league' });
        }

        // Check total spots and waitlist
        const totalSpots = (league.num_teams || league.max_teams || 8) * (league.team_size || league.players_per_team || 3);
        const allRegsSnap = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .get();

        const currentCount = allRegsSnap.size;
        const isWaitlist = currentCount >= totalSpots;

        // Generate PIN for new players (or use existing member PIN)
        let playerPin = member_pin || await generateUniquePin();

        // Determine payment status
        const entryFee = parseFloat(league.entry_fee) || parseFloat(league.session_fee) || 0;
        let paymentStatus = 'pending';
        if (entryFee === 0 || payment_method === 'free') {
            paymentStatus = 'paid';
        } else if (payment_method === 'paypal') {
            paymentStatus = 'awaiting_payment';
        }

        // Create registration
        const registration = {
            full_name,
            name: full_name, // alias
            email,
            phone: phone || '',
            skill_level: skill_level || null,
            preferred_level: skill_level || null,
            sms_opt_in: sms_opt_in || false,
            pin: playerPin,
            team_id: null,
            position: null,
            payment_method: payment_method || 'event',
            payment_status: paymentStatus,
            amount_owed: entryFee,
            waitlist: isWaitlist,
            status: 'active',
            photo_url: photo_url || null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const regRef = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .add(registration);
        // Send confirmation email/SMS
        try {
            await sendLeagueRegistrationConfirmation(registration, league);
        } catch (notifyErr) {
            console.error("Notification error:", notifyErr);
        }

        res.json({
            success: true,
            registration_id: regRef.id,
            player_pin: playerPin,
            waitlist: isWaitlist,
            payment_status: paymentStatus,
            message: isWaitlist ? 'Added to waitlist' : 'Registration successful'
        });

    } catch (error) {
        console.error('Error registering for league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register a team for a team league
 */
exports.registerTeam = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_name, roster, captain_index } = req.body;

        if (!league_id || !roster || !Array.isArray(roster)) {
            return res.status(400).json({ success: false, error: 'league_id and roster array required' });
        }

        const db = admin.firestore();

        // Check if league exists
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (league.status === 'completed' || league.registration_closed) {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        // Validate roster size
        const minPlayers = league.min_players || 3;
        if (roster.length < minPlayers) {
            return res.status(400).json({ success: false, error: `Minimum ${minPlayers} players required` });
        }

        // Check for duplicate emails in existing registrations
        for (const player of roster) {
            const existingReg = await db
                .collection('leagues').doc(league_id)
                .collection('registrations')
                .where('email', '==', player.email.toLowerCase())
                .limit(1)
                .get();

            if (!existingReg.empty) {
                return res.status(400).json({
                    success: false,
                    error: `${player.email} is already registered in this league`
                });
            }
        }

        // Determine captain
        const captainIdx = captain_index >= 0 && captain_index < roster.length ? captain_index : 0;
        const captain = roster[captainIdx];

        // Check if captain is the registrant (has player_id) or needs approval
        const captainNeedsApproval = !captain.player_id;

        // Create team document
        const teamData = {
            name: team_name || null,
            status: captainNeedsApproval ? 'pending_captain' : 'forming',
            captain_email: captain.email.toLowerCase(),
            captain_name: captain.name,
            captain_player_id: captain.player_id || null,
            roster_count: roster.length,
            min_players: minPlayers,
            max_roster: league.max_roster || 4,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const teamRef = await db.collection('leagues').doc(league_id).collection('teams').add(teamData);

        // Create registration entries for each player
        const registrations = [];
        for (let i = 0; i < roster.length; i++) {
            const player = roster[i];
            const isCaptain = i === captainIdx;

            // Generate PIN if player doesn't have one
            let playerPin = player.player_id ? null : await generateUniquePin();

            const regData = {
                type: 'team_member',
                team_id: teamRef.id,
                full_name: player.name,
                name: player.name,
                email: player.email.toLowerCase(),
                phone: player.phone || '',
                skill_level: player.level || null,
                is_captain: isCaptain,
                pin: playerPin,
                player_id: player.player_id || null,
                status: player.player_id ? 'confirmed' : 'pending',
                needs_registration: !player.player_id,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const regRef = await db.collection('leagues').doc(league_id).collection('registrations').add(regData);
            registrations.push({ id: regRef.id, ...regData });
        }

        // TODO: Send notifications to players
        // - Captain confirmation if needed
        // - Registration links for new players

        res.json({
            success: true,
            team_id: teamRef.id,
            team_name: team_name || '(Unnamed Team)',
            pending_captain: captainNeedsApproval,
            registrations: registrations.map(r => ({
                name: r.full_name,
                is_captain: r.is_captain,
                pin: r.pin,
                status: r.status
            })),
            message: captainNeedsApproval
                ? 'Team registered. Captain approval pending.'
                : 'Team registered successfully!'
        });

    } catch (error) {
        console.error('Error registering team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register as free agent for a team league
 */
exports.registerFreeAgent = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, full_name, email, phone, level, note, player_id } = req.body;

        if (!league_id || !full_name || !email) {
            return res.status(400).json({ success: false, error: 'league_id, full_name, and email required' });
        }

        const db = admin.firestore();

        // Check if league exists and allows free agents
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (league.status === 'completed' || league.registration_closed) {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        if (league.allow_free_agents === false) {
            return res.status(400).json({ success: false, error: 'This league does not allow free agent signups' });
        }

        // Check for duplicate registration
        const existingReg = await db
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .where('email', '==', email.toLowerCase())
            .limit(1)
            .get();

        if (!existingReg.empty) {
            return res.status(400).json({ success: false, error: 'Already registered in this league' });
        }

        // Generate PIN if needed
        let playerPin = player_id ? null : await generateUniquePin();

        // Create free agent registration
        const regData = {
            type: 'free_agent',
            team_id: null,
            full_name: full_name,
            name: full_name,
            email: email.toLowerCase(),
            phone: phone || '',
            skill_level: level || null,
            note: note || null,
            is_captain: false,
            pin: playerPin,
            player_id: player_id || null,
            status: 'available',
            invites_sent: [],
            invites_received: [],
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const regRef = await db.collection('leagues').doc(league_id).collection('registrations').add(regData);

        // TODO: Send confirmation notification

        res.json({
            success: true,
            registration_id: regRef.id,
            pin: playerPin,
            message: 'Added to free agent pool!'
        });

    } catch (error) {
        console.error('Error registering free agent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update team name (captain only)
 */
exports.updateTeamName = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_id, captain_email, team_name } = req.body;

        if (!league_id || !team_id || !team_name) {
            return res.status(400).json({ success: false, error: 'league_id, team_id, and team_name required' });
        }

        const db = admin.firestore();
        const teamRef = db.collection('leagues').doc(league_id).collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();

        // Verify captain authorization - check multiple sources
        let isCaptain = false;

        // Check 1: team.captain_id matches
        if (captain_id && team.captain_id === captain_id) {
            isCaptain = true;
        }

        // Check 2: captain_email matches
        if (!isCaptain && captain_email && team.captain_email === captain_email.toLowerCase()) {
            isCaptain = true;
        }

        // Check 3: Check players collection for is_captain or position 1
        if (!isCaptain && captain_id) {
            const playersCheck = await db.collection('leagues').doc(league_id).collection('players')
                .where('player_id', '==', captain_id)
                .where('team_id', '==', team_id)
                .limit(1).get();

            if (!playersCheck.empty) {
                const playerData = playersCheck.docs[0].data();
                if (playerData.is_captain === true || playerData.position === 1 || playerData.preferred_level === 'A') {
                    isCaptain = true;
                }
            }

            // Check by name if player_id check failed
            if (!isCaptain) {
                const globalPlayer = await db.collection('players').doc(captain_id).get();
                if (globalPlayer.exists) {
                    const playerName = globalPlayer.data().name;
                    const playersCheckByName = await db.collection('leagues').doc(league_id).collection('players')
                        .where('name', '==', playerName)
                        .where('team_id', '==', team_id)
                        .limit(1).get();

                    if (!playersCheckByName.empty) {
                        const playerData = playersCheckByName.docs[0].data();
                        if (playerData.is_captain === true || playerData.position === 1 || playerData.preferred_level === 'A') {
                            isCaptain = true;
                        }
                    }
                }
            }
        }

        // Check 4: team.players array
        if (!isCaptain && captain_id && team.players) {
            const playerInTeam = team.players.find(p => p.id === captain_id);
            if (playerInTeam && (playerInTeam.is_captain || playerInTeam.position === 1)) {
                isCaptain = true;
            }
        }

        if (!isCaptain) {
            return res.status(403).json({ success: false, error: 'Only the captain can update team name' });
        }

        await teamRef.update({
            team_name: team_name,
            name: team_name,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Team name updated' });

    } catch (error) {
        console.error('Error updating team name:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send team invite to a free agent
 */
exports.sendTeamInvite = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_email, free_agent_id } = req.body;

        if (!league_id || !team_id || !free_agent_id) {
            return res.status(400).json({ success: false, error: 'league_id, team_id, and free_agent_id required' });
        }

        const db = admin.firestore();

        // Get team
        const teamDoc = await db.collection('leagues').doc(league_id).collection('teams').doc(team_id).get();
        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();

        // Verify captain
        if (captain_email && team.captain_email !== captain_email.toLowerCase()) {
            return res.status(403).json({ success: false, error: 'Only the captain can send invites' });
        }

        // Get free agent registration
        const faRef = db.collection('leagues').doc(league_id).collection('registrations').doc(free_agent_id);
        const faDoc = await faRef.get();

        if (!faDoc.exists || faDoc.data().type !== 'free_agent') {
            return res.status(404).json({ success: false, error: 'Free agent not found' });
        }

        const freeAgent = faDoc.data();

        // Check if already invited
        if (freeAgent.invites_received?.includes(team_id)) {
            return res.status(400).json({ success: false, error: 'Already invited this player' });
        }

        // Add invite to free agent's record
        await faRef.update({
            invites_received: admin.firestore.FieldValue.arrayUnion(team_id),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add to team's sent invites
        await teamDoc.ref.update({
            invites_sent: admin.firestore.FieldValue.arrayUnion(free_agent_id),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // TODO: Send notification to free agent (email/SMS)

        res.json({
            success: true,
            message: `Invite sent to ${freeAgent.name}`
        });

    } catch (error) {
        console.error('Error sending team invite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Respond to team invite (free agent accepts/declines)
 */
exports.respondToTeamInvite = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, registration_id, team_id, accept, pin } = req.body;

        if (!league_id || !registration_id || !team_id || accept === undefined) {
            return res.status(400).json({ success: false, error: 'league_id, registration_id, team_id, and accept required' });
        }

        const db = admin.firestore();

        // Get registration
        const regRef = db.collection('leagues').doc(league_id).collection('registrations').doc(registration_id);
        const regDoc = await regRef.get();

        if (!regDoc.exists) {
            return res.status(404).json({ success: false, error: 'Registration not found' });
        }

        const reg = regDoc.data();

        // Verify PIN if provided
        if (pin && reg.pin !== pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check if invite exists
        if (!reg.invites_received?.includes(team_id)) {
            return res.status(400).json({ success: false, error: 'No invite from this team' });
        }

        if (accept) {
            // Add to team
            const teamRef = db.collection('leagues').doc(league_id).collection('teams').doc(team_id);
            const teamDoc = await teamRef.get();

            if (!teamDoc.exists) {
                return res.status(404).json({ success: false, error: 'Team not found' });
            }

            const team = teamDoc.data();

            // Check roster space
            if ((team.roster_count || 0) >= (team.max_roster || 4)) {
                return res.status(400).json({ success: false, error: 'Team roster is full' });
            }

            // Update registration
            await regRef.update({
                type: 'team_member',
                team_id: team_id,
                status: 'confirmed',
                invites_received: [],
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update team roster count
            await teamRef.update({
                roster_count: admin.firestore.FieldValue.increment(1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, message: 'You have joined the team!' });

        } else {
            // Decline - remove invite
            await regRef.update({
                invites_received: admin.firestore.FieldValue.arrayRemove(team_id),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, message: 'Invite declined' });
        }

    } catch (error) {
        console.error('Error responding to invite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Verify director PIN for league management
 */
exports.verifyDirectorPin = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'league_id and pin required' });
        }

        const db = admin.firestore();
        const leagueDoc = await db.collection('leagues').doc(league_id).get();

        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        // Check if PIN matches director or admin
        const isDirector = league.director_player_id && (
            await db.collection('players').doc(league.director_player_id).get()
        ).data()?.pin === pin;

        const isAdmin = pin === '39632911' || pin === '3963-2911';

        // Also check if the PIN matches the player who created the league
        let isCreator = false;
        const playerSnap = await db.collection('players').where('pin', '==', pin).limit(1).get();
        if (!playerSnap.empty) {
            const playerId = playerSnap.docs[0].id;
            isCreator = league.director_player_id === playerId;
        }

        if (!isDirector && !isAdmin && !isCreator) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

        res.json({ success: true, message: 'Authorized' });

    } catch (error) {
        console.error('Error verifying director PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create team manually (director)
 */
exports.createTeamManual = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin, team_name, captain_email, captain_name } = req.body;

        if (!league_id || !captain_email || !captain_name) {
            return res.status(400).json({ success: false, error: 'league_id, captain_email, and captain_name required' });
        }

        const db = admin.firestore();

        // Create team
        const teamData = {
            name: team_name || null,
            status: 'forming',
            captain_email: captain_email.toLowerCase(),
            captain_name: captain_name,
            roster_count: 1,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const teamRef = await db.collection('leagues').doc(league_id).collection('teams').add(teamData);

        // Create captain registration
        const playerPin = await generateUniquePin();
        const regData = {
            type: 'team_member',
            team_id: teamRef.id,
            full_name: captain_name,
            name: captain_name,
            email: captain_email.toLowerCase(),
            is_captain: true,
            pin: playerPin,
            status: 'confirmed',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('leagues').doc(league_id).collection('registrations').add(regData);

        res.json({
            success: true,
            team_id: teamRef.id,
            captain_pin: playerPin
        });

    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add player to team (director)
 */
exports.addPlayerToTeam = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, player_name, player_email, player_phone, player_level } = req.body;

        if (!league_id || !team_id || !player_name || !player_email) {
            return res.status(400).json({ success: false, error: 'league_id, team_id, player_name, and player_email required' });
        }

        const db = admin.firestore();

        // Check team exists
        const teamRef = db.collection('leagues').doc(league_id).collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();
        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        // Check if player already registered
        const existingReg = await db.collection('leagues').doc(league_id).collection('registrations')
            .where('email', '==', player_email.toLowerCase())
            .limit(1)
            .get();

        if (!existingReg.empty) {
            return res.status(400).json({ success: false, error: 'Player already registered in this league' });
        }

        // Create registration
        const playerPin = await generateUniquePin();
        const regData = {
            type: 'team_member',
            team_id: team_id,
            full_name: player_name,
            name: player_name,
            email: player_email.toLowerCase(),
            phone: player_phone || '',
            skill_level: player_level || null,
            is_captain: false,
            pin: playerPin,
            status: 'confirmed',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('leagues').doc(league_id).collection('registrations').add(regData);

        // Update team roster count
        await teamRef.update({
            roster_count: admin.firestore.FieldValue.increment(1)
        });

        res.json({ success: true, player_pin: playerPin });

    } catch (error) {
        console.error('Error adding player to team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Assign free agent to team (director)
 */
exports.assignFreeAgentToTeam = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, registration_id, team_id } = req.body;

        if (!league_id || !registration_id || !team_id) {
            return res.status(400).json({ success: false, error: 'league_id, registration_id, and team_id required' });
        }

        const db = admin.firestore();

        // Get registration
        const regRef = db.collection('leagues').doc(league_id).collection('registrations').doc(registration_id);
        const regDoc = await regRef.get();

        if (!regDoc.exists || regDoc.data().type !== 'free_agent') {
            return res.status(404).json({ success: false, error: 'Free agent not found' });
        }

        // Update registration
        await regRef.update({
            type: 'team_member',
            team_id: team_id,
            status: 'confirmed',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team roster count
        await db.collection('leagues').doc(league_id).collection('teams').doc(team_id).update({
            roster_count: admin.firestore.FieldValue.increment(1)
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Error assigning free agent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update player skill level (director)
 */
exports.updatePlayerLevel = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, registration_id, level } = req.body;

        if (!league_id || !registration_id || !level) {
            return res.status(400).json({ success: false, error: 'league_id, registration_id, and level required' });
        }

        const db = admin.firestore();

        await db.collection('leagues').doc(league_id).collection('registrations').doc(registration_id).update({
            skill_level: level,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });

    } catch (error) {
        console.error('Error updating player level:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Toggle league registration open/closed (director)
 */
exports.toggleLeagueRegistration = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, close } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        const db = admin.firestore();

        await db.collection('leagues').doc(league_id).update({
            registration_closed: close === true,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, registration_closed: close === true });

    } catch (error) {
        console.error('Error toggling registration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register as fill-in for league
 * Also creates/updates BRDC member if create_member is true
 */
exports.registerFillin = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, full_name, email, phone, preferred_level, avg_501, avg_cricket, sms_opt_in, member_pin, photo_url, create_member, send_welcome_sms } = req.body;

        // Check if league exists and allows fill-ins
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (!league.allow_fillins) {
            return res.status(400).json({ success: false, error: 'This league does not allow fill-in signups' });
        }

        if (league.status === 'completed') {
            return res.status(400).json({ success: false, error: 'League has ended' });
        }

        // Check if already signed up as fill-in
        const existingFillin = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('fillins')
            .where('email', '==', email)
            .get();

        if (!existingFillin.empty) {
            return res.status(400).json({ success: false, error: 'Already signed up as fill-in for this league' });
        }

        // Check if player already exists by email or PIN
        let playerPin = member_pin;
        let existingMember = null;
        let isNewMember = false;

        if (member_pin) {
            // Check if PIN exists
            const memberByPin = await admin.firestore().collection('players')
                .where('pin', '==', member_pin).get();
            if (!memberByPin.empty) {
                existingMember = { id: memberByPin.docs[0].id, ...memberByPin.docs[0].data() };
                playerPin = member_pin;
            }
        }

        if (!existingMember) {
            // Check by email
            const memberByEmail = await admin.firestore().collection('players')
                .where('email', '==', email).get();
            if (!memberByEmail.empty) {
                existingMember = { id: memberByEmail.docs[0].id, ...memberByEmail.docs[0].data() };
                playerPin = existingMember.pin;
            }
        }

        // Create new member if needed and create_member flag is set
        if (!existingMember && create_member) {
            playerPin = await generateUniquePin();
            isNewMember = true;

            const memberData = {
                name: full_name,
                email: email,
                phone: phone || '',
                pin: playerPin,
                preferred_level: preferred_level || null,
                avg_501: avg_501 || null,
                avg_cricket: avg_cricket || null,
                sms_opt_in: true, // Default to true for subs
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                source: 'sub_signup'
            };

            await admin.firestore().collection('players').add(memberData);
        } else if (!existingMember) {
            // Generate PIN even if not creating full member record
            playerPin = await generateUniquePin();
        }

        // Create fill-in registration
        const fillinData = {
            full_name,
            name: full_name,
            email,
            phone: phone || '',
            preferred_level: preferred_level || null,
            avg_501: avg_501 || null,
            avg_cricket: avg_cricket || null,
            sms_opt_in: true, // Always opt in for subs
            pin: playerPin,
            status: 'available',
            times_filled_in: 0,
            photo_url: photo_url || null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const fillinRef = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('fillins')
            .add(fillinData);

        // Send welcome SMS if requested and this is a new signup
        if (send_welcome_sms && phone) {
            try {
                const twilioClient = require('twilio')(
                    functions.config().twilio?.sid,
                    functions.config().twilio?.token
                );
                const formattedPhone = phone.replace(/\D/g, '');
                const e164Phone = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;

                await twilioClient.messages.create({
                    body: `Welcome to BRDC! You're signed up as a sub for ${league.league_name || league.name}. Your PIN is ${playerPin}. Captains will text you when they need a fill-in.`,
                    from: functions.config().twilio?.phone,
                    to: e164Phone
                });
            } catch (smsError) {
                console.error('Failed to send welcome SMS:', smsError);
                // Don't fail the registration if SMS fails
            }
        }

        res.json({
            success: true,
            fillin_id: fillinRef.id,
            player_pin: isNewMember ? playerPin : (existingMember ? null : playerPin), // Only return PIN for new members
            is_new_member: isNewMember,
            message: 'Fill-in signup successful'
        });

    } catch (error) {
        console.error('Error registering fill-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Request fill-ins for a match (captain action)
 * Sends SMS to fill-ins in priority order with 1-hour timeout
 */
exports.requestFillins = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, captain_name, fillin_ids } = req.body;

        if (!fillin_ids || fillin_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'No fill-ins selected' });
        }

        // Get league and match info
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        const matchDoc = await admin.firestore().collection('leagues').doc(league_id).collection('matches').doc(match_id).get();

        if (!leagueDoc.exists || !matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'League or match not found' });
        }

        const league = leagueDoc.data();
        const match = matchDoc.data();

        // Get fill-in details
        const fillins = [];
        for (const id of fillin_ids) {
            const fillinDoc = await admin.firestore()
                .collection('leagues').doc(league_id)
                .collection('fillins').doc(id).get();
            if (fillinDoc.exists) {
                fillins.push({ id, ...fillinDoc.data() });
            }
        }

        if (fillins.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fill-ins found' });
        }

        // Create fill-in request record
        const requestRef = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('fillin_requests').add({
                match_id,
                team_id,
                captain_name,
                priority_queue: fillin_ids,
                current_index: 0,
                status: 'pending', // pending, filled, expired
                filled_by: null,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                expires_at: null, // Will be set when SMS is sent
                match_date: match.match_date,
                match_week: match.week
            });

        // Send SMS to first person in queue
        const firstFillin = fillins[0];
        const matchDate = match.match_date ? new Date(match.match_date).toLocaleDateString() : 'TBD';

        // Create unique response code
        const responseCode = requestRef.id.substring(0, 8).toUpperCase();

        const smsMessage = `BRDC Fill-In Request: ${captain_name} needs a fill-in for ${league.league_name} on ${matchDate}. Reply YES to accept or NO to decline. Code: ${responseCode}`;

        // Send SMS using Twilio (if configured)
        let smsSent = false;
        if (firstFillin.phone && firstFillin.sms_opt_in !== false) {
            try {
                const { sendSMS } = require('./registration-notifications');
                if (sendSMS) {
                    await sendSMS(firstFillin.phone, smsMessage);
                    smsSent = true;
                }
            } catch (smsError) {
                console.log('SMS not sent (Twilio not configured):', smsError.message);
            }
        }

        // Update request with expiry (1 hour from now)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await requestRef.update({
            expires_at: expiresAt,
            current_fillin_id: firstFillin.id,
            current_fillin_name: firstFillin.full_name,
            response_code: responseCode,
            sms_sent: smsSent
        });

        // Log the request
        await admin.firestore().collection('notifications').add({
            type: 'fillin_request_sent',
            league_id,
            match_id,
            request_id: requestRef.id,
            sent_to: firstFillin.full_name,
            sent_to_phone: firstFillin.phone,
            captain_name,
            sms_sent: smsSent,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            request_id: requestRef.id,
            message: smsSent ? 'Fill-in request sent via SMS' : 'Fill-in request created (SMS not configured)'
        });

    } catch (error) {
        console.error('Error requesting fill-ins:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Handle fill-in response (YES/NO)
 */
exports.handleFillinResponse = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { response_code, response, from_phone } = req.body;

        // Find the request by response code
        const requestsSnap = await admin.firestore()
            .collectionGroup('fillin_requests')
            .where('response_code', '==', response_code.toUpperCase())
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (requestsSnap.empty) {
            return res.json({ success: false, error: 'Request not found or already processed' });
        }

        const requestDoc = requestsSnap.docs[0];
        const request = requestDoc.data();
        const requestRef = requestDoc.ref;

        // Get league path from parent
        const leagueId = requestRef.parent.parent.id;

        if (response.toUpperCase() === 'YES') {
            // Accept - mark request as filled
            await requestRef.update({
                status: 'filled',
                filled_by: request.current_fillin_id,
                filled_by_name: request.current_fillin_name,
                filled_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update the match with fill-in info
            await admin.firestore()
                .collection('leagues').doc(leagueId)
                .collection('matches').doc(request.match_id)
                .update({
                    [`fillins.${request.team_id}`]: admin.firestore.FieldValue.arrayUnion({
                        fillin_id: request.current_fillin_id,
                        fillin_name: request.current_fillin_name,
                        confirmed_at: new Date().toISOString()
                    })
                });

            // Send confirmation to fill-in
            const fillinDoc = await admin.firestore()
                .collection('leagues').doc(leagueId)
                .collection('fillins').doc(request.current_fillin_id).get();

            if (fillinDoc.exists) {
                const fillin = fillinDoc.data();
                if (fillin.phone) {
                    try {
                        const { sendSMS } = require('./registration-notifications');
                        if (sendSMS) {
                            await sendSMS(fillin.phone, `BRDC: Thanks! You're confirmed as fill-in for Week ${request.match_week} on ${request.match_date}. See you there!`);
                        }
                    } catch (e) { console.log('SMS confirm not sent'); }
                }

                // Update fill-in stats
                await fillinDoc.ref.update({
                    times_filled_in: admin.firestore.FieldValue.increment(1)
                });
            }

            return res.json({ success: true, message: 'Confirmed! Thanks for filling in.' });

        } else if (response.toUpperCase() === 'NO') {
            // Decline - move to next person in queue
            const nextIndex = request.current_index + 1;

            if (nextIndex >= request.priority_queue.length) {
                // No more people in queue
                await requestRef.update({
                    status: 'expired',
                    expired_at: admin.firestore.FieldValue.serverTimestamp()
                });
                return res.json({ success: true, message: 'Thanks for letting us know. Request expired - no more fill-ins in queue.' });
            }

            // Get next fill-in
            const nextFillinId = request.priority_queue[nextIndex];
            const nextFillinDoc = await admin.firestore()
                .collection('leagues').doc(leagueId)
                .collection('fillins').doc(nextFillinId).get();

            if (nextFillinDoc.exists) {
                const nextFillin = nextFillinDoc.data();

                // Update request
                await requestRef.update({
                    current_index: nextIndex,
                    current_fillin_id: nextFillinId,
                    current_fillin_name: nextFillin.full_name,
                    expires_at: new Date(Date.now() + 60 * 60 * 1000)
                });

                // Send SMS to next person
                if (nextFillin.phone && nextFillin.sms_opt_in !== false) {
                    try {
                        const leagueDoc = await admin.firestore().collection('leagues').doc(leagueId).get();
                        const league = leagueDoc.data();
                        const { sendSMS } = require('./registration-notifications');
                        if (sendSMS) {
                            await sendSMS(nextFillin.phone, `BRDC Fill-In Request: ${request.captain_name} needs a fill-in for ${league.league_name} on ${request.match_date}. Reply YES to accept or NO to decline. Code: ${response_code}`);
                        }
                    } catch (e) { console.log('SMS not sent to next person'); }
                }
            }

            return res.json({ success: true, message: 'Thanks for letting us know. Request sent to next person.' });
        }

        return res.json({ success: false, error: 'Invalid response. Reply YES or NO.' });

    } catch (error) {
        console.error('Error handling fill-in response:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Check and advance expired fill-in requests (run periodically)
 */
exports.processExpiredFillinRequests = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        const now = new Date();
        const expiredRequests = await admin.firestore()
            .collectionGroup('fillin_requests')
            .where('status', '==', 'pending')
            .where('expires_at', '<', now)
            .get();

        let processed = 0;

        for (const doc of expiredRequests.docs) {
            const request = doc.data();
            const requestRef = doc.ref;
            const leagueId = requestRef.parent.parent.id;

            const nextIndex = request.current_index + 1;

            if (nextIndex >= request.priority_queue.length) {
                // No more people - expire the request
                await requestRef.update({
                    status: 'expired',
                    expired_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Move to next person
                const nextFillinId = request.priority_queue[nextIndex];
                const nextFillinDoc = await admin.firestore()
                    .collection('leagues').doc(leagueId)
                    .collection('fillins').doc(nextFillinId).get();

                if (nextFillinDoc.exists) {
                    const nextFillin = nextFillinDoc.data();

                    await requestRef.update({
                        current_index: nextIndex,
                        current_fillin_id: nextFillinId,
                        current_fillin_name: nextFillin.full_name,
                        expires_at: new Date(Date.now() + 60 * 60 * 1000)
                    });

                    // Send SMS
                    if (nextFillin.phone && nextFillin.sms_opt_in !== false) {
                        try {
                            const leagueDoc = await admin.firestore().collection('leagues').doc(leagueId).get();
                            const league = leagueDoc.data();
                            const { sendSMS } = require('./registration-notifications');
                            if (sendSMS) {
                                await sendSMS(nextFillin.phone, `BRDC Fill-In Request: ${request.captain_name} needs a fill-in for ${league.league_name} on ${request.match_date}. Reply YES to accept or NO to decline. Code: ${request.response_code}`);
                            }
                        } catch (e) { console.log('SMS not sent'); }
                    }
                }
            }
            processed++;
        }

        res.json({ success: true, processed });

    } catch (error) {
        console.error('Error processing expired requests:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register player for tournament events
 */
exports.registerForTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, full_name, email, phone, event_ids, sms_opt_in, payment_method, total_amount, member_pin } = req.body;

        // Check if tournament exists
        const tournamentDoc = await admin.firestore().collection('tournaments').doc(tournament_id).get();
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        if (!event_ids || event_ids.length === 0) {
            return res.status(400).json({ success: false, error: 'Please select at least one event' });
        }

        // Generate PIN for new players
        let playerPin = member_pin || await generateUniquePin();

        // Determine payment status
        let paymentStatus = 'pending';
        if (total_amount === 0 || payment_method === 'free') {
            paymentStatus = 'paid';
        } else if (payment_method === 'paypal') {
            paymentStatus = 'awaiting_payment';
        }

        // Create master registration
        const registrationData = {
            full_name,
            name: full_name,
            email,
            phone: phone || '',
            sms_opt_in: sms_opt_in || false,
            pin: playerPin,
            event_ids: event_ids,
            payment_method: payment_method || 'event',
            payment_status: paymentStatus,
            total_amount: total_amount || 0,
            status: 'active',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // Add to tournament registrations
        const regRef = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('registrations')
            .add(registrationData);

        // Also add to each event's registrations subcollection
        const batch = admin.firestore().batch();
        for (const eventId of event_ids) {
            const eventRegRef = admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('events').doc(eventId)
                .collection('registrations').doc(regRef.id);

            batch.set(eventRegRef, {
                registration_id: regRef.id,
                full_name,
                email,
                pin: playerPin,
                payment_status: paymentStatus,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        // Send confirmation email/SMS
        try {
            // Get event names for the confirmation
            const eventNames = [];
            if (tournament.events && Array.isArray(tournament.events)) {
                for (const eid of event_ids) {
                    const evt = tournament.events.find(e => e.id === eid);
                    if (evt) eventNames.push(evt.name || evt.event_name || "Event");
                }
            }
            if (eventNames.length === 0) eventNames.push(`${event_ids.length} events`);
            await sendTournamentRegistrationConfirmation(registrationData, tournament, eventNames);
        } catch (notifyErr) {
            console.error("Notification error:", notifyErr);
        }

        res.json({
            success: true,
            registration_id: regRef.id,
            player_pin: playerPin,
            events_registered: event_ids.length,
            payment_status: paymentStatus,
            message: 'Registration successful'
        });

    } catch (error) {
        console.error('Error registering for tournament:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Conduct league draft and create teams
 */
exports.conductLeagueDraft = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id } = req.body;

        // Get league
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        // Get registrations (human players)
        const regsSnapshot = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .where('status', '==', 'active')
            .get();

        const registrations = [];
        regsSnapshot.forEach(doc => {
            const data = doc.data();
            // Only include players not already on a team
            if (!data.team_id) {
                registrations.push({ id: doc.id, ...data, source: 'registrations' });
            }
        });

        // Also get players (including bots) not on teams
        const playersSnapshot = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('players')
            .get();

        playersSnapshot.forEach(doc => {
            const data = doc.data();
            // Only include players not already on a team
            if (!data.team_id) {
                registrations.push({
                    id: doc.id,
                    ...data,
                    full_name: data.name || data.full_name,
                    source: 'players'
                });
            }
        });

        const playersPerTeam = league.players_per_team || league.min_players || 4;

        if (registrations.length < playersPerTeam * 2) {
            return res.status(400).json({ success: false, error: `Not enough players. Have ${registrations.length}, need at least ${playersPerTeam * 2} for 2 teams.` });
        }
        
        // Shuffle players
        const shuffled = registrations.sort(() => Math.random() - 0.5);
        const numTeams = Math.floor(shuffled.length / playersPerTeam);

        // Create teams
        const batch = admin.firestore().batch();
        const teams = [];

        for (let i = 0; i < numTeams; i++) {
            const teamPlayers = shuffled.slice(i * playersPerTeam, (i + 1) * playersPerTeam);
            const teamName = `Team ${i + 1}`;

            const teamRef = admin.firestore()
                .collection('leagues').doc(league_id)
                .collection('teams').doc();

            // Build players array for the team
            const players = teamPlayers.map((p, idx) => ({
                id: p.id,
                name: p.full_name || p.name,
                position: idx + 1,
                isBot: p.isBot || false,
                botDifficulty: p.botDifficulty || null
            }));

            const team = {
                team_number: i + 1,
                team_name: teamName,
                players: players,
                player_ids: teamPlayers.map(p => p.id),
                player_names: teamPlayers.map(p => p.full_name || p.name),
                wins: 0,
                losses: 0,
                ties: 0,
                points_for: 0,
                points_against: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(teamRef, team);
            teams.push({ id: teamRef.id, ...team });

            // Update players with team assignment (handle both collections)
            teamPlayers.forEach((player, pos) => {
                const collectionName = player.source || 'registrations';
                const playerRef = admin.firestore()
                    .collection('leagues').doc(league_id)
                    .collection(collectionName).doc(player.id);
                batch.update(playerRef, {
                    team_id: teamRef.id,
                    team_name: teamName,
                    position: pos + 1
                });
            });
        }
        
        // Update league
        batch.update(leagueDoc.ref, {
            draft_status: 'completed',
            draft_completed_at: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            teams_created: numTeams,
            teams: teams,
            message: 'Draft completed successfully'
        });
        
    } catch (error) {
        console.error('Error conducting draft:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Generate league schedule
 */
exports.generateLeagueSchedule = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { league_id } = req.body;
        
        // Get league
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();
        
        // Get teams
        const teamsSnapshot = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('teams')
            .get();
        
        const teams = [];
        teamsSnapshot.forEach(doc => teams.push({ id: doc.id, ...doc.data() }));
        
        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams' });
        }
        
        // Generate round robin schedule
        const matches = generateRoundRobinSchedule(league_id, teams, league);
        
        // Save matches
        const batch = admin.firestore().batch();
        matches.forEach(match => {
            const matchRef = admin.firestore()
                .collection('leagues').doc(league_id)
                .collection('matches').doc();
            batch.set(matchRef, match);
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: matches.length,
            message: 'Schedule generated successfully'
        });
        
    } catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function generateRoundRobinSchedule(league_id, teams, league) {
    const matches = [];
    let teamList = [...teams];
    
    // Add bye if odd number
    if (teamList.length % 2 !== 0) {
        teamList.push({ id: 'bye', team_name: 'BYE' });
    }
    
    const numTeams = teamList.length;
    const rounds = league.rounds || 2;
    
    const startDate = new Date(league.start_date);
    let currentWeek = 1;
    
    for (let round = 0; round < rounds; round++) {
        for (let week = 0; week < numTeams - 1; week++) {
            const weekMatches = [];
            
            for (let match = 0; match < numTeams / 2; match++) {
                let home, away;
                
                if (match === 0) {
                    home = 0;
                    away = week + 1;
                } else {
                    home = week + 1 - match;
                    away = week + 1 + match;
                    
                    if (home < 1) home += numTeams - 1;
                    if (away >= numTeams) away -= numTeams - 1;
                }
                
                const homeTeam = teamList[home];
                const awayTeam = teamList[away];
                
                if (homeTeam.id === 'bye' || awayTeam.id === 'bye') continue;
                
                const matchDate = new Date(startDate);
                matchDate.setDate(startDate.getDate() + ((currentWeek - 1) * 7));
                
                matches.push({
                    week: currentWeek,
                    match_date: matchDate.toISOString(),
                    home_team_id: homeTeam.id,
                    home_team_name: homeTeam.team_name,
                    away_team_id: awayTeam.id,
                    away_team_name: awayTeam.team_name,
                    home_score: null,
                    away_score: null,
                    status: 'scheduled',
                    board_no: null,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            currentWeek++;
        }
    }
    
    return matches;
}

/**
 * Get league standings
 */
exports.getLeagueStandings = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { league_id } = req.body;
        
        // Get teams
        const teamsSnapshot = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('teams')
            .get();
        
        const teams = [];
        teamsSnapshot.forEach(doc => teams.push({ id: doc.id, ...doc.data() }));
        
        // Sort by wins, then point differential
        teams.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return (b.points_for - b.points_against) - (a.points_for - a.points_against);
        });
        
        // Add rankings
        teams.forEach((team, index) => {
            team.rank = index + 1;
        });
        
        res.json({
            success: true,
            standings: teams
        });
        
    } catch (error) {
        console.error('Error getting standings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PHASE 6: NOTIFICATIONS (SMS & EMAIL)
// ============================================================================

/**
 * Send SMS notification via Twilio
 * Configure with: firebase functions:config:set twilio.sid="ACxxxxx" twilio.token="xxxxx" twilio.from="+1234567890"
 */
exports.sendSMS = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { to, message, test_mode } = req.body;

        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'Missing to or message' });
        }

        // Get Twilio config from environment
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        let twilioResult = null;
        let status = 'pending';

        // Only send if Twilio is configured and not in test mode
        if (accountSid && authToken && fromNumber && !test_mode) {
            const twilio = require('twilio');
            const client = twilio(accountSid, authToken);

            twilioResult = await client.messages.create({
                body: message,
                from: fromNumber,
                to: to
            });
            status = 'sent';
            console.log('SMS sent via Twilio:', twilioResult.sid);
        } else {
            status = test_mode ? 'test_mode' : 'twilio_not_configured';
            console.log('SMS not sent - ' + status);
        }

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'sms',
            to: to,
            message: message,
            status: status,
            twilio_sid: twilioResult?.sid || null,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            status: status,
            message_sid: twilioResult?.sid || null,
            message: status === 'sent' ? 'SMS sent successfully' : 'SMS logged (Twilio: ' + status + ')'
        });

    } catch (error) {
        console.error('Error sending SMS:', error);

        // Log failed attempt
        await admin.firestore().collection('notifications').add({
            type: 'sms',
            to: req.body?.to,
            message: req.body?.message,
            status: 'failed',
            error: error.message,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send bulk SMS notifications for league/tournament updates
 */
exports.sendBulkSMS = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { recipients, message, league_id, tournament_id } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ success: false, error: 'Recipients array required' });
        }

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message required' });
        }

        // Get Twilio config from environment
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        let client = null;
        if (accountSid && authToken && fromNumber) {
            const twilio = require('twilio');
            client = twilio(accountSid, authToken);
        }

        const results = [];
        const batchId = `bulk_${Date.now()}`;

        for (const recipient of recipients) {
            // Skip if no phone or opted out
            if (!recipient.phone || recipient.sms_opt_in === false) {
                results.push({ phone: recipient.phone, status: 'skipped', reason: 'no_phone_or_opted_out' });
                continue;
            }

            try {
                let status = 'pending';
                let messageSid = null;

                if (client) {
                    const result = await client.messages.create({
                        body: message,
                        from: fromNumber,
                        to: recipient.phone
                    });
                    messageSid = result.sid;
                    status = 'sent';
                } else {
                    status = 'twilio_not_configured';
                }

                results.push({ phone: recipient.phone, status, message_sid: messageSid });

            } catch (sendError) {
                console.error('Error sending to', recipient.phone, sendError.message);
                results.push({ phone: recipient.phone, status: 'failed', error: sendError.message });
            }
        }

        // Log bulk notification
        await admin.firestore().collection('notifications').add({
            type: 'bulk_sms',
            batch_id: batchId,
            league_id: league_id || null,
            tournament_id: tournament_id || null,
            message: message,
            recipient_count: recipients.length,
            sent_count: results.filter(r => r.status === 'sent').length,
            failed_count: results.filter(r => r.status === 'failed').length,
            results: results,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            batch_id: batchId,
            total: recipients.length,
            sent: results.filter(r => r.status === 'sent').length,
            failed: results.filter(r => r.status === 'failed').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            results: results
        });

    } catch (error) {
        console.error('Error in bulk SMS:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Notify all players that league has started
 * Sends PIN, dashboard link, team assignment, and first match info via SMS
 */
exports.notifyLeaguePlayers = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        // Get league data
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        // Verify admin PIN
        if (admin_pin && admin_pin !== league.admin_pin && admin_pin !== league.director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all teams
        const teamsSnap = await admin.firestore().collection('leagues').doc(league_id).collection('teams').get();
        const teams = {};
        teamsSnap.forEach(doc => {
            teams[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Get schedule to find first matches
        const matchesSnap = await admin.firestore().collection('leagues').doc(league_id).collection('matches').get();
        const matches = [];
        matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        matches.sort((a, b) => (a.week || 0) - (b.week || 0));

        // Get all players from registrations
        const regsSnap = await admin.firestore().collection('leagues').doc(league_id).collection('registrations').get();
        const players = [];
        regsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.isBot) {
                players.push({ id: doc.id, ...data, source: 'registrations' });
            }
        });

        // Also get players collection
        const playersSnap = await admin.firestore().collection('leagues').doc(league_id).collection('players').get();
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (!data.isBot) {
                players.push({ id: doc.id, ...data, source: 'players' });
            }
        });

        const results = { sent: 0, failed: 0, skipped: 0, details: [] };
        // Use shorter URL format - full URLs with https:// often trigger carrier spam filters
        const dashboardUrl = `brdc-v2.web.app`;

        // Initialize Twilio
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        let twilioClient = null;
        if (twilioSid && twilioToken) {
            const twilio = require('twilio');
            twilioClient = twilio(twilioSid, twilioToken);
        }

        // Helper to format phone to E.164
        function formatPhoneE164(phone) {
            if (!phone) return null;
            // Remove all non-digits
            const digits = phone.replace(/\D/g, '');
            // If 10 digits, assume US and add +1
            if (digits.length === 10) {
                return '+1' + digits;
            }
            // If 11 digits starting with 1, add +
            if (digits.length === 11 && digits.startsWith('1')) {
                return '+' + digits;
            }
            // If already has +, return as-is
            if (phone.startsWith('+')) {
                return phone;
            }
            // Otherwise return with + prefix
            return '+' + digits;
        }

        for (const player of players) {
            if (!player.phone) {
                results.skipped++;
                continue;
            }

            const formattedPhone = formatPhoneE164(player.phone);
            if (!formattedPhone || formattedPhone.length < 10) {
                results.skipped++;
                results.details.push({ name: player.full_name || player.name, status: 'skipped', error: 'Invalid phone' });
                continue;
            }

            // Find player's team
            let teamName = 'Unassigned';
            let firstMatch = null;

            if (player.team_id) {
                const team = teams[player.team_id];
                if (team) {
                    teamName = team.team_name || team.name || 'Your Team';
                    firstMatch = matches.find(m =>
                        !m.completed &&
                        (m.home_team_id === player.team_id || m.away_team_id === player.team_id)
                    );
                }
            }

            // Build message
            let message = `BRDC ${league.league_name || 'League'}: You're in! `;
            message += `Team: ${teamName}. `;

            if (player.pin) {
                message += `PIN: ${player.pin}. `;
            }

            if (firstMatch) {
                const opponent = firstMatch.home_team_id === player.team_id
                    ? firstMatch.away_team_name
                    : firstMatch.home_team_name;
                message += `1st match: vs ${opponent}. `;
            }

            message += dashboardUrl;

            // Send SMS
            try {
                if (twilioClient) {
                    await twilioClient.messages.create({
                        body: message,
                        to: formattedPhone,
                        from: twilioPhone
                    });
                    results.sent++;
                    results.details.push({ name: player.full_name || player.name, phone: formattedPhone, status: 'sent' });
                } else {
                    console.log('SMS (simulated):', { to: formattedPhone, message });
                    results.sent++;
                    results.details.push({ name: player.full_name || player.name, phone: formattedPhone, status: 'simulated' });
                }
            } catch (smsError) {
                results.failed++;
                results.details.push({ name: player.full_name || player.name, phone: formattedPhone, status: 'failed', error: smsError.message });
            }
        }

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'league_started',
            league_id: league_id,
            league_name: league.league_name,
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
            results: { sent: results.sent, failed: results.failed, skipped: results.skipped }
        });

        res.json({
            success: true,
            message: `Notified ${results.sent} players`,
            results
        });

    } catch (error) {
        console.error('Error notifying league players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send custom message to filtered league players
 * Supports variable replacement: [first_name], [last_name], [full_name], [pin], [team_name], [dashboard_link], [league_name], [next_match_date]
 */
exports.sendCustomLeagueMessage = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, message, filters } = req.body;

        if (!league_id || !message) {
            return res.status(400).json({ success: false, error: 'league_id and message required' });
        }

        // Get league data
        const leagueDoc = await admin.firestore().collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        // Verify admin PIN
        if (admin_pin && admin_pin !== league.admin_pin && admin_pin !== league.director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all teams
        const teamsSnap = await admin.firestore().collection('leagues').doc(league_id).collection('teams').get();
        const teams = {};
        teamsSnap.forEach(doc => {
            teams[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Get schedule to find next matches
        const matchesSnap = await admin.firestore().collection('leagues').doc(league_id).collection('matches').get();
        const matches = [];
        matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        matches.sort((a, b) => (a.week || 0) - (b.week || 0));

        // Get all players
        const players = [];
        const regsSnap = await admin.firestore().collection('leagues').doc(league_id).collection('registrations').get();
        regsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.isBot) {
                players.push({ id: doc.id, ...data, source: 'registrations' });
            }
        });

        const playersSnap = await admin.firestore().collection('leagues').doc(league_id).collection('players').get();
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (!data.isBot) {
                players.push({ id: doc.id, ...data, source: 'players' });
            }
        });

        // Filter players based on criteria
        const { captains, levelA, levelB, levelC, alternates, individual_player_ids } = filters || {};
        const filteredPlayers = players.filter(p => {
            if (!p.phone) return false; // Must have phone

            // Check if in individual list
            if (individual_player_ids && individual_player_ids.includes(p.id)) return true;

            // Check filters
            if (captains && p.is_captain) return true;
            if (levelA && p.preferred_level === 'A') return true;
            if (levelB && p.preferred_level === 'B') return true;
            if (levelC && p.preferred_level === 'C') return true;
            if (alternates && p.is_sub) return true;

            return false;
        });

        const results = { sent: 0, failed: 0, skipped: 0, details: [] };
        // Use shorter URL format - full URLs with https:// often trigger carrier spam filters
        const dashboardUrl = `brdc-v2.web.app`;

        // Initialize Twilio
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        let twilioClient = null;
        if (twilioSid && twilioToken) {
            const twilio = require('twilio');
            twilioClient = twilio(twilioSid, twilioToken);
        }

        // Helper to format phone to E.164
        function formatPhoneE164(phone) {
            if (!phone) return null;
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                return '+1' + digits;
            }
            if (digits.length === 11 && digits.startsWith('1')) {
                return '+' + digits;
            }
            if (phone.startsWith('+')) {
                return phone;
            }
            return '+' + digits;
        }

        for (const player of filteredPlayers) {
            const formattedPhone = formatPhoneE164(player.phone);
            if (!formattedPhone || formattedPhone.length < 10) {
                results.skipped++;
                results.details.push({ name: player.full_name || player.name, status: 'skipped', error: 'Invalid phone' });
                continue;
            }

            // Get player's team info
            let teamName = 'Unassigned';
            let nextMatch = null;

            if (player.team_id) {
                const team = teams[player.team_id];
                if (team) {
                    teamName = team.team_name || team.name || 'Your Team';
                    nextMatch = matches.find(m =>
                        !m.completed &&
                        (m.home_team_id === player.team_id || m.away_team_id === player.team_id)
                    );
                }
            }

            // Parse player name
            const fullName = player.full_name || player.name || 'Player';
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Format next match date
            let nextMatchDate = 'TBD';
            let nextMatchPin = 'N/A';
            if (nextMatch) {
                if (nextMatch.match_date) {
                    const dateObj = nextMatch.match_date.toDate ? nextMatch.match_date.toDate() : new Date(nextMatch.match_date);
                    nextMatchDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                }
                if (nextMatch.match_pin) {
                    nextMatchPin = nextMatch.match_pin;
                }
            }

            // Replace variables in message
            let personalizedMessage = message
                .replace(/\[first_name\]/gi, firstName)
                .replace(/\[last_name\]/gi, lastName)
                .replace(/\[full_name\]/gi, fullName)
                .replace(/\[pin\]/gi, player.pin || 'N/A')
                .replace(/\[team_name\]/gi, teamName)
                .replace(/\[dashboard_link\]/gi, dashboardUrl)
                .replace(/\[league_name\]/gi, league.league_name || 'League')
                .replace(/\[next_match_date\]/gi, nextMatchDate)
                .replace(/\[next_match_pin\]/gi, nextMatchPin);

            // Send SMS
            try {
                if (twilioClient) {
                    await twilioClient.messages.create({
                        body: personalizedMessage,
                        to: formattedPhone,
                        from: twilioPhone
                    });
                    results.sent++;
                    results.details.push({ name: fullName, phone: formattedPhone, status: 'sent' });
                } else {
                    console.log('SMS (simulated):', { to: formattedPhone, message: personalizedMessage });
                    results.sent++;
                    results.details.push({ name: fullName, phone: formattedPhone, status: 'simulated' });
                }
            } catch (smsError) {
                results.failed++;
                results.details.push({ name: fullName, phone: formattedPhone, status: 'failed', error: smsError.message });
            }
        }

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'custom_message',
            league_id: league_id,
            league_name: league.league_name,
            message_template: message,
            filters: filters,
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
            results: { sent: results.sent, failed: results.failed, skipped: results.skipped }
        });

        res.json({
            success: true,
            message: `Sent ${results.sent} messages`,
            results
        });

    } catch (error) {
        console.error('Error sending custom league message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get team schedule for a player with their availability status
 */
exports.getTeamSchedule = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, player_id } = req.body;

        if (!league_id || !team_id) {
            return res.status(400).json({ success: false, error: 'league_id and team_id required' });
        }

        const db = admin.firestore();

        // Get all matches for this team
        const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('home_team_id', '==', team_id).get();
        const awayMatchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('away_team_id', '==', team_id).get();

        const matches = [];
        matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        awayMatchesSnap.forEach(doc => {
            if (!matches.find(m => m.id === doc.id)) {
                matches.push({ id: doc.id, ...doc.data() });
            }
        });

        // Sort by week
        matches.sort((a, b) => (a.week || 0) - (b.week || 0));

        // Format schedule with player's availability
        const schedule = matches.map(m => {
            const isHome = m.home_team_id === team_id;
            const opponentName = isHome ? m.away_team_name : m.home_team_name;

            // Get player's availability for this match
            const availability = m.player_availability || {};
            const playerAvail = player_id ? (availability[player_id] || 'unknown') : 'unknown';

            return {
                id: m.id,
                week: m.week,
                match_date: m.match_date ? (m.match_date.toDate ? m.match_date.toDate().toISOString() : m.match_date) : null,
                opponent_name: opponentName,
                is_home: isHome,
                completed: m.completed || false,
                in_progress: m.in_progress || false,
                home_score: m.home_score || 0,
                away_score: m.away_score || 0,
                player_availability: playerAvail
            };
        });

        res.json({ success: true, schedule, league_id });

    } catch (error) {
        console.error('Error getting team schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Enhanced team schedule with rosters and player stats
 */
exports.getTeamScheduleEnhanced = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, player_id } = req.body;

        if (!league_id || !team_id) {
            return res.status(400).json({ success: false, error: 'league_id and team_id required' });
        }

        const db = admin.firestore();

        // Get league info
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.exists ? leagueDoc.data() : {};

        // Get all teams with their rosters
        const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
        const teamsMap = {};
        const teamsArray = [];
        teamsSnap.forEach(doc => {
            const team = { id: doc.id, ...doc.data() };
            teamsMap[doc.id] = team;
            teamsArray.push(team);
        });

        // Calculate standings - sort by wins desc, then by points desc
        teamsArray.sort((a, b) => {
            const aWins = a.wins || 0;
            const bWins = b.wins || 0;
            if (bWins !== aWins) return bWins - aWins;
            return (b.points || 0) - (a.points || 0);
        });

        // Assign position strings (1st, 2nd, 3rd, etc.)
        const standingsMap = {};
        teamsArray.forEach((team, idx) => {
            const pos = idx + 1;
            const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
            standingsMap[team.id] = `${pos}${suffix}`;
        });

        // Get stats for all players in the league
        const statsSnap = await db.collection('leagues').doc(league_id).collection('stats').get();
        const statsMap = {};
        statsSnap.forEach(doc => {
            statsMap[doc.id] = doc.data();
        });

        // Get all players in the league (for teams that don't have player_ids array)
        const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
        const playersMap = {};
        const playersByTeam = {};
        playersSnap.forEach(doc => {
            const player = { id: doc.id, ...doc.data() };
            playersMap[doc.id] = player;
            const tid = player.team_id;
            if (tid) {
                if (!playersByTeam[tid]) playersByTeam[tid] = [];
                playersByTeam[tid].push(player);
            }
        });

        // Helper to build roster with stats
        const buildRosterWithStats = (team) => {
            if (!team) return [];

            // First try: use player_ids/player_names arrays if they exist on team doc
            let playerIds = team.player_ids || [];
            let playerNames = team.player_names || [];
            let playerLevels = team.player_levels || [];

            // Fallback: get players from the players collection by team_id
            if (playerIds.length === 0 && playersByTeam[team.id]) {
                const teamPlayers = playersByTeam[team.id].sort((a, b) => (a.position || 99) - (b.position || 99));
                playerIds = teamPlayers.map(p => p.id);
                playerNames = teamPlayers.map(p => p.name || p.full_name || 'Unknown');
                playerLevels = teamPlayers.map(p => p.level || '');
            }

            return playerIds.map((pid, idx) => {
                const stats = statsMap[pid] || {};
                const x01Avg = stats.x01_total_darts > 0
                    ? (stats.x01_total_points / stats.x01_total_darts * 3).toFixed(1)
                    : '-';
                const mpr = stats.cricket_total_rounds > 0
                    ? (stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2)
                    : '-';

                return {
                    id: pid,
                    name: playerNames[idx] || 'Unknown',
                    level: playerLevels[idx] || '',
                    x01_three_dart_avg: x01Avg,
                    cricket_mpr: mpr
                };
            });
        };

        // Get your team data
        const myTeam = teamsMap[team_id];
        const myTeamRoster = buildRosterWithStats(myTeam);
        const myTeamRecord = myTeam ? `(${myTeam.wins || 0}-${myTeam.losses || 0})` : '(0-0)';
        const myTeamStanding = standingsMap[team_id] || '';

        // Get all matches for this team
        const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('home_team_id', '==', team_id).get();
        const awayMatchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('away_team_id', '==', team_id).get();

        const matches = [];
        matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        awayMatchesSnap.forEach(doc => {
            if (!matches.find(m => m.id === doc.id)) {
                matches.push({ id: doc.id, ...doc.data() });
            }
        });

        // Sort by week
        matches.sort((a, b) => (a.week || 0) - (b.week || 0));

        // Separate into upcoming and past
        const upcoming = [];
        const past = [];

        for (const m of matches) {
            const isHome = m.home_team_id === team_id;
            const opponentId = isHome ? m.away_team_id : m.home_team_id;
            const opponentTeam = teamsMap[opponentId];
            const opponentRoster = buildRosterWithStats(opponentTeam);
            const opponentRecord = opponentTeam ? `(${opponentTeam.wins || 0}-${opponentTeam.losses || 0})` : '(0-0)';
            const opponentStanding = standingsMap[opponentId] || '';

            // Get all player availability for this match
            const availability = m.player_availability || {};

            // Build availability map for my team
            const myTeamAvailability = {};
            myTeamRoster.forEach(p => {
                myTeamAvailability[p.id] = availability[p.id] || 'unknown';
            });

            const matchData = {
                id: m.id,
                week: m.week,
                match_date: m.match_date ? (m.match_date.toDate ? m.match_date.toDate().toISOString() : m.match_date) : null,
                is_home: isHome,
                completed: m.completed || false,
                in_progress: m.in_progress || false,
                my_team: {
                    id: team_id,
                    name: myTeam?.team_name || 'My Team',
                    record: myTeamRecord,
                    standing: myTeamStanding,
                    roster: myTeamRoster,
                    availability: myTeamAvailability
                },
                opponent: {
                    id: opponentId,
                    name: opponentTeam?.team_name || 'TBD',
                    record: opponentRecord,
                    standing: opponentStanding,
                    roster: opponentRoster
                },
                my_availability: player_id ? (availability[player_id] || 'unknown') : 'unknown',
                home_score: m.home_score || 0,
                away_score: m.away_score || 0,
                // For completed matches, include match stats if available
                match_stats: m.completed ? (m.player_stats || null) : null
            };

            if (m.completed) {
                // Calculate if we won
                const myScore = isHome ? m.home_score : m.away_score;
                const theirScore = isHome ? m.away_score : m.home_score;
                matchData.won = myScore > theirScore;
                matchData.my_score = myScore;
                matchData.their_score = theirScore;
                past.push(matchData);
            } else {
                upcoming.push(matchData);
            }
        }

        res.json({
            success: true,
            league_id,
            league_name: league.league_name || 'League',
            my_team: {
                id: team_id,
                name: myTeam?.team_name || 'My Team',
                record: myTeamRecord
            },
            upcoming,
            past
        });

    } catch (error) {
        console.error('Error getting enhanced team schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update player availability for a match and notify captain if unavailable
 */
exports.updatePlayerAvailability = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, player_id, status } = req.body;

        if (!league_id || !match_id || !player_id || !status) {
            return res.status(400).json({ success: false, error: 'All fields required' });
        }

        const db = admin.firestore();

        // Update match with player availability
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);
        await matchRef.update({
            [`player_availability.${player_id}`]: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // If player is unavailable, notify captain
        if (status === 'unavailable') {
            // Get player info
            const playerDoc = await db.collection('global_players').doc(player_id).get();
            const playerName = playerDoc.exists ? playerDoc.data().name : 'A player';

            // Get match info to find the team
            const matchDoc = await matchRef.get();
            const matchData = matchDoc.data();

            // Find which team this player is on
            let teamId = null;
            const homeTeamSnap = await db.collection('leagues').doc(league_id).collection('teams').doc(matchData.home_team_id).get();
            const homeTeam = homeTeamSnap.data();
            if (homeTeam && homeTeam.player_ids && homeTeam.player_ids.includes(player_id)) {
                teamId = matchData.home_team_id;
            } else {
                teamId = matchData.away_team_id;
            }

            // Get captain
            if (teamId) {
                const teamSnap = await db.collection('leagues').doc(league_id).collection('teams').doc(teamId).get();
                const team = teamSnap.data();
                const captainId = team?.captain_id;

                if (captainId) {
                    // Get captain's phone
                    const captainSnap = await db.collection('leagues').doc(league_id).collection('registrations')
                        .where('player_id', '==', captainId).limit(1).get();

                    let captainPhone = null;
                    let captainName = 'Captain';
                    if (!captainSnap.empty) {
                        const captainData = captainSnap.docs[0].data();
                        captainPhone = captainData.phone;
                        captainName = captainData.name || captainData.full_name;
                    }

                    // Send SMS notification to captain
                    if (captainPhone) {
                        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
                        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
                        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

                        if (twilioSid && twilioToken) {
                            const twilio = require('twilio');
                            const client = twilio(twilioSid, twilioToken);

                            // Format phone
                            const digits = captainPhone.replace(/\D/g, '');
                            const formattedPhone = digits.length === 10 ? '+1' + digits : '+' + digits;

                            const dateStr = matchData.match_date
                                ? new Date(matchData.match_date.toDate ? matchData.match_date.toDate() : matchData.match_date)
                                    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                : 'upcoming match';

                            await client.messages.create({
                                body: `BRDC Alert: ${playerName} can't make the ${dateStr} match. Please find a substitute.`,
                                to: formattedPhone,
                                from: twilioPhone
                            });
                        }
                    }
                }
            }
        }

        res.json({ success: true, message: 'Availability updated' });

    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get captain's team data (roster, schedule, subs, match format)
 */
exports.getCaptainTeamData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_id } = req.body;

        if (!league_id || !team_id) {
            return res.status(400).json({ success: false, error: 'league_id and team_id required' });
        }

        const db = admin.firestore();

        // Get league info
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        // Get team
        const teamDoc = await db.collection('leagues').doc(league_id).collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        // Verify captain (optional) - check multiple sources
        if (captain_id && team.captain_id !== captain_id) {
            let isCaptain = false;
            const debugInfo = { captain_id, team_id, team_captain_id: team.captain_id };

            // Check 1: registrations collection with is_captain flag
            const regCheck = await db.collection('leagues').doc(league_id).collection('registrations')
                .where('player_id', '==', captain_id)
                .where('team_id', '==', team_id)
                .where('is_captain', '==', true)
                .limit(1).get();
            if (!regCheck.empty) isCaptain = true;
            debugInfo.regCheck = !regCheck.empty;

            // Check 2: players collection with is_captain flag or position 1 (by player_id)
            if (!isCaptain) {
                const playersCheck = await db.collection('leagues').doc(league_id).collection('players')
                    .where('player_id', '==', captain_id)
                    .where('team_id', '==', team_id)
                    .limit(1).get();

                if (!playersCheck.empty) {
                    const playerData = playersCheck.docs[0].data();
                    debugInfo.playerData = { is_captain: playerData.is_captain, position: playerData.position, preferred_level: playerData.preferred_level };
                    if (playerData.is_captain === true || playerData.position === 1 || playerData.preferred_level === 'A') {
                        isCaptain = true;
                    }
                }
                debugInfo.playersCheckById = !playersCheck.empty;
            }

            // Check 2b: players collection by name match (fallback)
            if (!isCaptain) {
                // Get player name from global players collection
                const globalPlayer = await db.collection('players').doc(captain_id).get();
                if (globalPlayer.exists) {
                    const playerName = globalPlayer.data().name;
                    debugInfo.playerName = playerName;

                    const playersCheckByName = await db.collection('leagues').doc(league_id).collection('players')
                        .where('name', '==', playerName)
                        .where('team_id', '==', team_id)
                        .limit(1).get();

                    if (!playersCheckByName.empty) {
                        const playerData = playersCheckByName.docs[0].data();
                        debugInfo.playerDataByName = { is_captain: playerData.is_captain, position: playerData.position, preferred_level: playerData.preferred_level };
                        if (playerData.is_captain === true || playerData.position === 1 || playerData.preferred_level === 'A') {
                            isCaptain = true;
                        }
                    }
                    debugInfo.playersCheckByName = !playersCheckByName.empty;
                }
            }

            // Check 3: team.players array for captain
            if (!isCaptain && team.players) {
                const playerInTeam = team.players.find(p => p.id === captain_id);
                if (playerInTeam && (playerInTeam.is_captain || playerInTeam.position === 1)) {
                    isCaptain = true;
                }
                debugInfo.teamPlayersCheck = !!playerInTeam;
            }

            if (!isCaptain) {
                console.log('Captain auth failed:', debugInfo);
                return res.status(403).json({ success: false, error: 'Not authorized as captain for this team', debug: debugInfo });
            }
        }

        // Get roster (players on this team) - check multiple sources
        const roster = [];
        const addedPlayerIds = new Set();

        // Get stats from stats collection for roster players
        const rosterStatsSnap = await db.collection('leagues').doc(league_id).collection('stats').get();
        const rosterStatsMap = {};
        rosterStatsSnap.forEach(doc => {
            rosterStatsMap[doc.id] = doc.data();
        });

        // Helper to calculate stats from stats collection or embedded data
        const getPlayerStats = (playerId, embeddedStats) => {
            const stats = rosterStatsMap[playerId] || embeddedStats || {};
            let x01Avg = '-';
            let mpr = '-';

            if (stats.x01_total_darts > 0) {
                x01Avg = ((stats.x01_total_points / stats.x01_total_darts) * 3).toFixed(1);
            } else if (stats.x01?.total_darts > 0) {
                x01Avg = ((stats.x01.total_points / stats.x01.total_darts) * 3).toFixed(1);
            }

            if (stats.cricket_total_rounds > 0) {
                mpr = (stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2);
            } else if (stats.cricket?.total_rounds > 0) {
                mpr = (stats.cricket.total_marks / stats.cricket.total_rounds).toFixed(2);
            }

            return { x01_three_dart_avg: x01Avg, cricket_mpr: mpr };
        };

        // Source 1: registrations collection
        const rosterSnap = await db.collection('leagues').doc(league_id).collection('registrations')
            .where('team_id', '==', team_id).get();

        rosterSnap.forEach(doc => {
            const p = doc.data();
            const playerId = p.player_id || doc.id;
            if (!p.isBot && !p.is_sub && !addedPlayerIds.has(playerId)) {
                addedPlayerIds.add(playerId);
                const playerStats = getPlayerStats(playerId, p.stats);
                roster.push({
                    id: playerId,
                    name: p.full_name || p.name,
                    position: p.position || 0,
                    is_captain: p.is_captain || false,
                    phone: p.phone,
                    email: p.email,
                    preferred_level: p.preferred_level,
                    x01_three_dart_avg: playerStats.x01_three_dart_avg,
                    cricket_mpr: playerStats.cricket_mpr
                });
            }
        });

        // Source 2: players collection (fallback)
        if (roster.length === 0) {
            const playersSnap = await db.collection('leagues').doc(league_id).collection('players')
                .where('team_id', '==', team_id).get();

            playersSnap.forEach(doc => {
                const p = doc.data();
                const playerId = p.player_id || doc.id;
                if (!addedPlayerIds.has(playerId)) {
                    addedPlayerIds.add(playerId);
                    const playerStats = getPlayerStats(playerId, p.stats);
                    roster.push({
                        id: playerId,
                        name: p.name || p.full_name,
                        position: p.position || 0,
                        is_captain: p.is_captain || false,
                        phone: p.phone,
                        email: p.email,
                        preferred_level: p.preferred_level,
                        x01_three_dart_avg: playerStats.x01_three_dart_avg,
                        cricket_mpr: playerStats.cricket_mpr
                    });
                }
            });
        }

        // Source 3: team.players array (fallback)
        if (roster.length === 0 && team.players && team.players.length > 0) {
            for (const p of team.players) {
                const playerId = p.id || p.player_id;
                if (!addedPlayerIds.has(playerId)) {
                    addedPlayerIds.add(playerId);
                    const playerStats = getPlayerStats(playerId, null);
                    roster.push({
                        id: playerId,
                        name: p.name,
                        position: p.position || 0,
                        is_captain: p.is_captain || false,
                        preferred_level: p.level || p.preferred_level,
                        x01_three_dart_avg: playerStats.x01_three_dart_avg,
                        cricket_mpr: playerStats.cricket_mpr
                    });
                }
            }
        }

        roster.sort((a, b) => (a.position || 0) - (b.position || 0));

        // Check for push notification capability (FCM token) for each roster player
        for (const player of roster) {
            const globalPlayerDoc = await db.collection('players').doc(player.id).get();
            player.has_push_enabled = globalPlayerDoc.exists && !!globalPlayerDoc.data().fcm_token;
        }

        // Get subs for this team/league
        const subsSnap = await db.collection('leagues').doc(league_id).collection('registrations')
            .where('is_sub', '==', true).get();

        const subs = [];
        subsSnap.forEach(doc => {
            const s = doc.data();
            if (!s.isBot) {
                subs.push({
                    id: s.player_id || doc.id,
                    name: s.full_name || s.name,
                    phone: s.phone,
                    preferred_level: s.preferred_level
                });
            }
        });

        // Get schedule with availability summary
        const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('home_team_id', '==', team_id).get();
        const awayMatchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('away_team_id', '==', team_id).get();

        const matches = [];
        matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
        awayMatchesSnap.forEach(doc => {
            if (!matches.find(m => m.id === doc.id)) {
                matches.push({ id: doc.id, ...doc.data() });
            }
        });

        matches.sort((a, b) => (a.week || 0) - (b.week || 0));

        // Get all teams for opponent roster lookup
        const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
        const teamsMap = {};
        teamsSnap.forEach(doc => { teamsMap[doc.id] = { id: doc.id, ...doc.data() }; });

        // Get all players in league for opponent rosters
        const allPlayersSnap = await db.collection('leagues').doc(league_id).collection('players').get();

        // Also get stats from the stats collection
        const statsSnap = await db.collection('leagues').doc(league_id).collection('stats').get();
        const statsMap = {};
        statsSnap.forEach(doc => {
            statsMap[doc.id] = doc.data();
        });

        const playersByTeam = {};
        allPlayersSnap.forEach(doc => {
            const p = doc.data();
            const tid = p.team_id;
            const playerId = p.player_id || doc.id;

            // Get stats from stats collection (preferred) or embedded stats
            const playerStats = statsMap[playerId] || p.stats || {};

            if (tid) {
                if (!playersByTeam[tid]) playersByTeam[tid] = [];

                // Calculate X01 average
                let x01Avg = '-';
                if (playerStats.x01_total_darts > 0) {
                    x01Avg = ((playerStats.x01_total_points / playerStats.x01_total_darts) * 3).toFixed(1);
                } else if (playerStats.x01?.total_darts > 0) {
                    x01Avg = ((playerStats.x01.total_points / playerStats.x01.total_darts) * 3).toFixed(1);
                }

                // Calculate MPR
                let mpr = '-';
                if (playerStats.cricket_total_rounds > 0) {
                    mpr = (playerStats.cricket_total_marks / playerStats.cricket_total_rounds).toFixed(2);
                } else if (playerStats.cricket?.total_rounds > 0) {
                    mpr = (playerStats.cricket.total_marks / playerStats.cricket.total_rounds).toFixed(2);
                }

                playersByTeam[tid].push({
                    id: playerId,
                    name: p.name || p.full_name,
                    position: p.position || 0,
                    is_captain: p.is_captain || false,
                    preferred_level: p.preferred_level,
                    x01_three_dart_avg: x01Avg,
                    cricket_mpr: mpr
                });
            }
        });

        // Sort each team's roster by position
        Object.values(playersByTeam).forEach(players => {
            players.sort((a, b) => (a.position || 0) - (b.position || 0));
        });

        const schedule = matches.map(m => {
            const isHome = m.home_team_id === team_id;
            const opponentTeamId = isHome ? m.away_team_id : m.home_team_id;
            const opponentName = isHome ? m.away_team_name : m.home_team_name;

            // Calculate availability summary
            const availability = m.player_availability || {};
            const summary = { confirmed: 0, unavailable: 0, unknown: 0 };
            roster.forEach(p => {
                const status = availability[p.id] || 'unknown';
                summary[status] = (summary[status] || 0) + 1;
            });

            // Get lineup data - use stored lineup if exists, otherwise use roster
            const homeTeamId = m.home_team_id;
            const awayTeamId = m.away_team_id;

            // Build home lineup with availability/sub status
            let homeLineup = m.home_lineup || playersByTeam[homeTeamId] || [];
            homeLineup = homeLineup.map(p => {
                const avail = availability[p.id] || (homeTeamId === team_id ? 'unknown' : null);
                return {
                    ...p,
                    availability: avail,
                    is_sub: p.is_sub || false,
                    needs_fillin: avail === 'unavailable'
                };
            });

            // Build away lineup with availability/sub status
            let awayLineup = m.away_lineup || playersByTeam[awayTeamId] || [];
            awayLineup = awayLineup.map(p => {
                const avail = availability[p.id] || (awayTeamId === team_id ? 'unknown' : null);
                return {
                    ...p,
                    availability: avail,
                    is_sub: p.is_sub || false,
                    needs_fillin: avail === 'unavailable'
                };
            });

            return {
                id: m.id,
                week: m.week,
                match_date: m.match_date ? (m.match_date.toDate ? m.match_date.toDate().toISOString() : m.match_date) : null,
                home_team_name: m.home_team_name || teamsMap[homeTeamId]?.team_name || 'Home',
                away_team_name: m.away_team_name || teamsMap[awayTeamId]?.team_name || 'Away',
                opponent_name: opponentName,
                is_home: isHome,
                completed: m.completed || false,
                in_progress: m.in_progress || false,
                availability_summary: summary,
                format: m.format || league.match_format,
                home_lineup: homeLineup,
                away_lineup: awayLineup
            };
        });

        // Check push notification capability for subs too
        for (const sub of subs) {
            const globalPlayerDoc = await db.collection('players').doc(sub.id).get();
            sub.has_push_enabled = globalPlayerDoc.exists && !!globalPlayerDoc.data().fcm_token;
        }

        res.json({
            success: true,
            team_name: team.team_name || team.name,
            roster,
            subs,
            schedule,
            match_format: league.match_format || [],
            // New fields for captain portal
            goto_subs: team.goto_subs || { A: [], B: [], C: [] },
            availability_grid: team.availability_grid || {},
            sub_playlists: team.sub_playlists || [],
            team_settings: {
                photo_url: team.photo_url || null,
                motto: team.motto || '',
                auto_reminders: team.auto_reminders !== undefined ? team.auto_reminders : true
            }
        });

    } catch (error) {
        console.error('Error getting captain team data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send message from captain to team players
 */
exports.sendCaptainMessage = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_id, message, recipients, send_sms } = req.body;

        if (!league_id || !team_id || !message) {
            return res.status(400).json({ success: false, error: 'league_id, team_id, and message required' });
        }

        const db = admin.firestore();

        // Get team to verify captain
        const teamDoc = await db.collection('leagues').doc(league_id).collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        // Get players to message
        let players = [];

        if (recipients?.all_players) {
            const rosterSnap = await db.collection('leagues').doc(league_id).collection('registrations')
                .where('team_id', '==', team_id).get();
            rosterSnap.forEach(doc => {
                const p = doc.data();
                if (!p.isBot && p.phone) {
                    players.push(p);
                }
            });
        }

        if (recipients?.subs_only) {
            const subsSnap = await db.collection('leagues').doc(league_id).collection('registrations')
                .where('is_sub', '==', true).get();
            subsSnap.forEach(doc => {
                const p = doc.data();
                if (!p.isBot && p.phone && !players.find(x => x.phone === p.phone)) {
                    players.push(p);
                }
            });
        }

        // Get next match for variable replacement
        const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches')
            .where('home_team_id', '==', team_id)
            .where('completed', '==', false)
            .orderBy('week')
            .limit(1).get();

        let nextMatchDate = 'TBD';
        if (!matchesSnap.empty) {
            const m = matchesSnap.docs[0].data();
            if (m.match_date) {
                const dateObj = m.match_date.toDate ? m.match_date.toDate() : new Date(m.match_date);
                nextMatchDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
        }

        // Initialize Twilio
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        let twilioClient = null;
        if (twilioSid && twilioToken) {
            const twilio = require('twilio');
            twilioClient = twilio(twilioSid, twilioToken);
        }

        let sent = 0;
        let failed = 0;
        let smsSent = 0;

        // Get captain info for the message
        const captainDoc = await db.collection('players').doc(captain_id).get();
        const captainData = captainDoc.exists ? captainDoc.data() : { name: 'Captain' };
        const captainName = captainData.name || 'Captain';

        // Try to find or create team chat room for in-app messages
        let teamChatRoomId = null;
        const chatRoomsSnap = await db.collection('chat_rooms')
            .where('type', '==', 'team')
            .where('team_id', '==', team_id)
            .where('league_id', '==', league_id)
            .limit(1).get();

        if (!chatRoomsSnap.empty) {
            teamChatRoomId = chatRoomsSnap.docs[0].id;
        }

        // Send in-app message to team chat room if it exists
        if (teamChatRoomId) {
            const chatMessage = message
                .replace(/\[first_name\]/gi, 'Team')
                .replace(/\[full_name\]/gi, 'Team')
                .replace(/\[next_match_date\]/gi, nextMatchDate);

            await db.collection('chat_rooms').doc(teamChatRoomId).collection('messages').add({
                sender_id: captain_id,
                sender_name: captainName,
                text: chatMessage,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'announcement'
            });

            // Update room's last_message
            await db.collection('chat_rooms').doc(teamChatRoomId).update({
                last_message: {
                    text: chatMessage.substring(0, 100),
                    sender_id: captain_id,
                    sender_name: captainName,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                },
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Send to individual players
        for (const player of players) {
            // Replace variables
            const fullName = player.full_name || player.name || 'Player';
            const firstName = fullName.split(' ')[0];

            const personalizedMsg = message
                .replace(/\[first_name\]/gi, firstName)
                .replace(/\[full_name\]/gi, fullName)
                .replace(/\[next_match_date\]/gi, nextMatchDate);

            sent++; // Count as sent (in-app via chat room)

            // Only send SMS if requested
            if (send_sms && player.phone && twilioClient) {
                const digits = player.phone.replace(/\D/g, '');
                const formattedPhone = digits.length === 10 ? '+1' + digits : '+' + digits;

                try {
                    await twilioClient.messages.create({
                        body: personalizedMsg,
                        to: formattedPhone,
                        from: twilioPhone
                    });
                    smsSent++;
                } catch (smsError) {
                    console.error('SMS error:', smsError);
                    failed++;
                }
            }
        }

        res.json({ success: true, sent, smsSent, failed });

    } catch (error) {
        console.error('Error sending captain message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send email notification
 */
exports.sendEmail = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { to, subject, body } = req.body;
        
        // TODO: Add SendGrid or similar email service
        // const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(functions.config().sendgrid.key);
        
        // await sgMail.send({
        //     to: to,
        //     from: 'noreply@burningriverdarts.com',
        //     subject: subject,
        //     html: body
        // });
        
        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'email',
            to: to,
            subject: subject,
            body: body,
            status: 'sent',
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            message: 'Email sent successfully (SendGrid integration pending)'
        });
        
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Notify players of match assignment
 */
/**
 * Notify players of board assignment
 */
exports.notifyMatchAssignment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, match_id } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};
        const match = bracket.matches?.find(m => m.id === match_id);

        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        // Get player contact info
        const players = tournamentData.players || {};
        const p1 = players[match.player1?.id];
        const p2 = players[match.player2?.id];

        const notifications = [];

        if (p1?.phone) {
            notifications.push({
                type: 'sms',
                to: p1.phone,
                message: `Your match is on Board ${match.board}! vs ${match.player2?.name}`
            });
        }

        if (p2?.phone) {
            notifications.push({
                type: 'sms',
                to: p2.phone,
                message: `Your match is on Board ${match.board}! vs ${match.player1?.name}`
            });
        }

        res.json({
            success: true,
            notifications_sent: notifications.length,
            message: 'Match assignment notifications sent (Twilio integration pending)',
            notifications: notifications
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create PayPal payment
 */
exports.createPayment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, player_id, amount, description } = req.body;

        if (!tournament_id || !player_id || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const payment = {
            tournament_id: tournament_id,
            player_id: player_id,
            amount: parseFloat(amount),
            description: description || 'Tournament Entry Fee',
            status: 'pending',
            payment_method: 'paypal',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const paymentRef = await admin.firestore().collection('payments').add(payment);

        res.json({
            success: true,
            payment_id: paymentRef.id,
            message: 'Payment created (PayPal integration pending)'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Capture PayPal payment
 */
exports.capturePayment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, payment_id, player_id } = req.body;

        if (!tournament_id || !payment_id || !player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await admin.firestore().collection('payments').doc(payment_id).update({
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        await tournamentRef.update({
            [`players.${player_id}.paid`]: true,
            [`players.${player_id}.payment_id`]: payment_id
        });

        res.json({
            success: true,
            message: 'Payment captured successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// MATCH PIN SYSTEM FOR LEAGUE NIGHTS
// ============================================================================

/**
 * Generate a unique 5-digit match PIN for a league match
 */
exports.generateMatchPIN = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id } = req.body;

        if (!league_id || !match_id) {
            return res.status(400).json({ success: false, error: 'league_id and match_id required' });
        }

        const db = admin.firestore();
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // If match already has a PIN, return it
        if (match.match_pin) {
            return res.json({
                success: true,
                match_pin: match.match_pin,
                message: 'Existing PIN returned'
            });
        }

        // Generate unique 5-digit PIN (10000-99999)
        let pin;
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            pin = Math.floor(10000 + Math.random() * 90000).toString();

            // Check if PIN is already in use
            const existingMatch = await db.collectionGroup('matches')
                .where('match_pin', '==', pin)
                .where('status', '!=', 'completed')
                .limit(1)
                .get();

            if (existingMatch.empty) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            return res.status(500).json({ success: false, error: 'Could not generate unique PIN' });
        }

        // Save PIN to match
        await matchRef.update({
            match_pin: pin,
            pin_generated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            match_pin: pin,
            message: 'Match PIN generated'
        });

    } catch (error) {
        console.error('Error generating match PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Look up a match by its 5-digit PIN
 */
exports.getMatchByPIN = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { match_pin } = req.body;

        if (!match_pin || match_pin.length !== 5) {
            return res.status(400).json({ success: false, error: 'Valid 5-digit match PIN required' });
        }

        const db = admin.firestore();

        // Find match by PIN
        const matchesSnapshot = await db.collectionGroup('matches')
            .where('match_pin', '==', match_pin)
            .limit(1)
            .get();

        if (matchesSnapshot.empty) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const matchDoc = matchesSnapshot.docs[0];
        const match = matchDoc.data();
        const leagueId = matchDoc.ref.parent.parent.id;

        // Get league info
        const leagueDoc = await db.collection('leagues').doc(leagueId).get();
        const league = leagueDoc.data();

        // Get team rosters
        const homeTeamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(match.home_team_id).get();
        const awayTeamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(match.away_team_id).get();

        const homeTeam = homeTeamDoc.exists ? homeTeamDoc.data() : null;
        const awayTeam = awayTeamDoc.exists ? awayTeamDoc.data() : null;

        res.json({
            success: true,
            match: {
                id: matchDoc.id,
                ...match,
                league_id: leagueId
            },
            league: {
                id: leagueId,
                name: league.league_name || league.name,
                match_format: league.match_format,
                games_per_match: league.games_per_match
            },
            home_team: homeTeam,
            away_team: awayTeam
        });

    } catch (error) {
        console.error('Error getting match by PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all rounds/games for a league match night
 * Returns the format, players, and status for each round
 */
exports.getMatchNightData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, captain_pin } = req.body;

        if (!league_id || !match_id) {
            return res.status(400).json({ success: false, error: 'league_id and match_id required' });
        }

        const db = admin.firestore();

        // Get league
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }
        const league = leagueDoc.data();

        // Get match
        const matchDoc = await db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id).get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        const match = matchDoc.data();

        // Get teams with rosters
        const homeTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id).get();
        const awayTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id).get();

        const homeTeam = homeTeamDoc.exists ? { id: homeTeamDoc.id, ...homeTeamDoc.data() } : null;
        const awayTeam = awayTeamDoc.exists ? { id: awayTeamDoc.id, ...awayTeamDoc.data() } : null;

        // Build rounds from match format
        const matchFormat = league.match_format || [];
        const rounds = match.rounds || [];

        // If rounds don't exist yet, initialize them from format
        const roundsData = matchFormat.map((format, index) => {
            const existingRound = rounds[index] || {};
            return {
                round_number: index + 1,
                game_type: format.game_type || format.type || '501',
                format_label: format.label || format.game_type || '501',
                description: format.description || '',
                players_per_team: format.players_per_team || 1,
                home_players: existingRound.home_players || [],
                away_players: existingRound.away_players || [],
                status: existingRound.status || 'not_started',
                home_score: existingRound.home_score || null,
                away_score: existingRound.away_score || null,
                legs: format.legs || 3,
                leg_mode: format.leg_mode || 'best-of'
            };
        });

        res.json({
            success: true,
            league: {
                id: league_id,
                name: league.league_name || league.name,
                is_locked_level: league.is_locked_level || false
            },
            match: {
                id: match_id,
                week: match.week,
                match_date: match.match_date,
                status: match.status,
                home_score: match.home_score,
                away_score: match.away_score
            },
            home_team: homeTeam,
            away_team: awayTeam,
            rounds: roundsData
        });

    } catch (error) {
        console.error('Error getting match night data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Save a round result
 */
exports.saveRoundResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, round_number, home_players, away_players, home_score, away_score, game_stats } = req.body;

        if (!league_id || !match_id || round_number === undefined) {
            return res.status(400).json({ success: false, error: 'league_id, match_id, and round_number required' });
        }

        const db = admin.firestore();
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);

        // Get current match data
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const rounds = match.rounds || [];

        // Update or add the round
        const roundIndex = round_number - 1;
        while (rounds.length <= roundIndex) {
            rounds.push({});
        }

        rounds[roundIndex] = {
            ...rounds[roundIndex],
            home_players: home_players || [],
            away_players: away_players || [],
            home_score: home_score,
            away_score: away_score,
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp(),
            game_stats: game_stats || null
        };

        // Calculate total match score
        let totalHome = 0;
        let totalAway = 0;
        rounds.forEach(r => {
            if (r.status === 'completed') {
                totalHome += r.home_score || 0;
                totalAway += r.away_score || 0;
            }
        });

        // Update match
        await matchRef.update({
            rounds: rounds,
            home_score: totalHome,
            away_score: totalAway,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Round result saved',
            total_score: { home: totalHome, away: totalAway }
        });

    } catch (error) {
        console.error('Error saving round result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start a round - mark it as in progress and optionally swap players
 */
exports.startRound = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, round_number, home_players, away_players } = req.body;

        if (!league_id || !match_id || round_number === undefined) {
            return res.status(400).json({ success: false, error: 'league_id, match_id, and round_number required' });
        }

        const db = admin.firestore();
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);

        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const rounds = match.rounds || [];
        const roundIndex = round_number - 1;

        while (rounds.length <= roundIndex) {
            rounds.push({});
        }

        rounds[roundIndex] = {
            ...rounds[roundIndex],
            home_players: home_players || rounds[roundIndex].home_players || [],
            away_players: away_players || rounds[roundIndex].away_players || [],
            status: 'in_progress',
            started_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await matchRef.update({
            rounds: rounds,
            status: 'in_progress',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Round started',
            round: rounds[roundIndex]
        });

    } catch (error) {
        console.error('Error starting round:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
