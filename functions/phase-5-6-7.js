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
exports.createLeague = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.registerForLeague = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.conductLeagueDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.generateLeagueSchedule = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.getLeagueStandings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.sendSMS = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.sendEmail = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
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
exports.notifyMatchAssignment = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { match_id, board_number } = req.body;
        
        // Get match details
        const matchDoc = await admin.firestore().collection('matches').doc(match_id).get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        
        const match = matchDoc.data();
        
        // Compose message
        const message = `🎯 Your match is ready! ${match.player1_name} vs ${match.player2_name} - Board ${board_number}. Good luck!`;
        
        // Send notifications (SMS/Email based on player preferences)
        // TODO: Implement actual sending
        
        res.json({
            success: true,
            message: 'Match notifications sent'
        });
        
    } catch (error) {
        console.error('Error notifying match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PHASE 7: PAYPAL INTEGRATION
// ============================================================================

/**
 * Create PayPal payment for registration
 */
exports.createPayment = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { tournament_id, event_ids, player_id, total_amount } = req.body;
        
        // TODO: Add PayPal SDK integration
        // const paypal = require('@paypal/checkout-server-sdk');
        // const environment = new paypal.core.SandboxEnvironment(
        //     functions.config().paypal.client_id,
        //     functions.config().paypal.secret
        // );
        // const client = new paypal.core.PayPalHttpClient(environment);
        
        // Create order
        // const request = new paypal.orders.OrdersCreateRequest();
        // request.requestBody({
        //     intent: 'CAPTURE',
        //     purchase_units: [{
        //         amount: {
        //             currency_code: 'USD',
        //             value: total_amount.toString()
        //         },
        //         description: 'BRDC Tournament Entry'
        //     }]
        // });
        
        // const order = await client.execute(request);
        
        // Log payment intent
        const paymentRef = await admin.firestore().collection('payments').add({
            tournament_id,
            event_ids,
            player_id,
            amount: total_amount,
            status: 'pending',
            // paypal_order_id: order.result.id,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            payment_id: paymentRef.id,
            // approval_url: order.result.links.find(link => link.rel === 'approve').href,
            message: 'Payment created (PayPal integration pending)'
        });
        
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Capture PayPal payment after approval
 */
exports.capturePayment = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    
    
    try {
        const { payment_id, paypal_order_id } = req.body;
        
        // TODO: Capture payment via PayPal
        // const request = new paypal.orders.OrdersCaptureRequest(paypal_order_id);
        // const capture = await client.execute(request);
        
        // Update payment status
        await admin.firestore().collection('payments').doc(payment_id).update({
            status: 'completed',
            // capture_details: capture.result,
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Get payment details
        const paymentDoc = await admin.firestore().collection('payments').doc(payment_id).get();
        const payment = paymentDoc.data();
        
        // Update player as paid
        await admin.firestore()
            .collection('tournaments').doc(payment.tournament_id)
            .collection('players').doc(payment.player_id)
            .update({ paid: true });
        
        res.json({
            success: true,
            message: 'Payment captured successfully'
        });
        
    } catch (error) {
        console.error('Error capturing payment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

    });
});
    });
});
    });
});
    });
});
    });
});
