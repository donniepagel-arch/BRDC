/**
 * BRDC Phase 5, 6 & 7 Cloud Functions
 * League System + Notifications + PayPal Integration
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

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
            season: data.season || 'Spring 2025',
            start_date: data.start_date,
            end_date: endDate.toISOString(),
            venue_name: data.venue_name,
            venue_address: data.venue_address || '',
            
            // League settings
            total_weeks: matchWeeks,
            players_per_team: data.players_per_team || 3,
            max_teams: data.max_teams || 8,
            session_fee: data.session_fee || 30,
            match_frequency: data.match_frequency || 'weekly',
            rounds: rounds,
            league_night: data.league_night || 'thursday',
            
            // Draft settings
            draft_date: data.draft_date,
            draft_type: data.draft_type || 'snake',
            draft_status: 'pending',
            
            // Match format
            singles_format: 'best_of_3',
            doubles_format: 'best_of_3',
            total_sets: 9,
            points_per_set: 1,
            
            // Director info
            director_name: data.director_name,
            director_email: data.director_email,
            director_phone: data.director_phone || '',
            
            // Status
            status: 'registration_open',
            current_week: 0,
            registration_deadline: data.registration_deadline,
            
            created_at: admin.firestore.FieldValue.serverTimestamp()
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
 * Register player for league
 */
exports.registerForLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { league_id, full_name, email, phone, skill_level } = req.body;
        
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
            .where('status', '==', 'active')
            .get();
        
        if (!existingReg.empty) {
            return res.status(400).json({ success: false, error: 'Already registered' });
        }
        
        // Create registration
        const registration = {
            full_name,
            email,
            phone: phone || '',
            skill_level: skill_level || 'intermediate',
            team_id: null,
            position: null,
            paid: false,
            payment_status: 'pending',
            amount_owed: league.session_fee,
            status: 'active',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const regRef = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .add(registration);
        
        res.json({
            success: true,
            registration_id: regRef.id,
            message: 'Registration successful'
        });
        
    } catch (error) {
        console.error('Error registering for league:', error);
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
        
        // Get registrations
        const regsSnapshot = await admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('registrations')
            .where('status', '==', 'active')
            .get();
        
        const registrations = [];
        regsSnapshot.forEach(doc => registrations.push({ id: doc.id, ...doc.data() }));
        
        if (registrations.length < league.players_per_team) {
            return res.status(400).json({ success: false, error: 'Not enough players' });
        }
        
        // Shuffle players
        const shuffled = registrations.sort(() => Math.random() - 0.5);
        const playersPerTeam = league.players_per_team;
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
            
            const team = {
                team_number: i + 1,
                team_name: teamName,
                player_ids: teamPlayers.map(p => p.id),
                player_names: teamPlayers.map(p => p.full_name),
                wins: 0,
                losses: 0,
                points_for: 0,
                points_against: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };
            
            batch.set(teamRef, team);
            teams.push({ id: teamRef.id, ...team });
            
            // Update player registrations with team
            teamPlayers.forEach((player, pos) => {
                const playerRef = admin.firestore()
                    .collection('leagues').doc(league_id)
                    .collection('registrations').doc(player.id);
                batch.update(playerRef, {
                    team_id: teamRef.id,
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
 */
exports.sendSMS = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { to, message } = req.body;
        
        // TODO: Add Twilio configuration
        // const accountSid = functions.config().twilio.sid;
        // const authToken = functions.config().twilio.token;
        // const fromNumber = functions.config().twilio.from;
        
        // const client = require('twilio')(accountSid, authToken);
        
        // await client.messages.create({
        //     body: message,
        //     from: fromNumber,
        //     to: to
        // });
        
        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'sms',
            to: to,
            message: message,
            status: 'sent',
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            message: 'SMS sent successfully (Twilio integration pending)'
        });
        
    } catch (error) {
        console.error('Error sending SMS:', error);
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
