/**
 * BRDC Notification System
 * Handles match reminders, confirmations, and results notifications
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Configuration from .env file
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@brdc-darts.com';

// Initialize Twilio and SendGrid (when credentials are configured)
let twilioClient = null;
let sgMail = null;

try {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
} catch (e) {
    console.log('Twilio not configured');
}

try {
    if (SENDGRID_API_KEY) {
        sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_API_KEY);
    }
} catch (e) {
    console.log('SendGrid not configured');
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, body) {
    if (!twilioClient) {
        console.log('SMS (simulated):', { to, body });
        return { success: true, simulated: true };
    }

    try {
        const message = await twilioClient.messages.create({
            body,
            to,
            from: TWILIO_PHONE
        });
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error('SMS error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send Email via SendGrid
 */
async function sendEmail(to, subject, html, text) {
    if (!sgMail) {
        console.log('Email (simulated):', { to, subject });
        return { success: true, simulated: true };
    }

    try {
        await sgMail.send({
            to,
            from: FROM_EMAIL,
            subject,
            html,
            text
        });
        return { success: true };
    } catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Monday Match Reminder - Runs every Monday at 10 AM
 * Sends text and email to all players with upcoming matches this week
 */
exports.mondayMatchReminder = onSchedule('0 10 * * 1', async (event) => {
        console.log('Running Monday match reminders...');

        const today = new Date();
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);

        try {
            // Get all active leagues
            const leaguesSnap = await db.collection('leagues')
                .where('status', '==', 'active')
                .get();

            for (const leagueDoc of leaguesSnap.docs) {
                const league = leagueDoc.data();
                const leagueId = leagueDoc.id;

                // Find matches this week
                const upcomingMatches = (league.schedule || []).filter(match => {
                    if (match.completed) return false;
                    const matchDate = match.date?.toDate?.() || new Date(match.date);
                    return matchDate >= today && matchDate <= endOfWeek;
                });

                if (upcomingMatches.length === 0) continue;

                // Get all teams involved
                const teamIds = new Set();
                upcomingMatches.forEach(m => {
                    teamIds.add(m.home_team);
                    teamIds.add(m.away_team);
                });

                // Get players for these teams
                for (const teamId of teamIds) {
                    const team = league.teams?.[teamId];
                    if (!team) continue;

                    const match = upcomingMatches.find(m =>
                        m.home_team === teamId || m.away_team === teamId
                    );
                    if (!match) continue;

                    const opponent = match.home_team === teamId
                        ? league.teams?.[match.away_team]?.name
                        : league.teams?.[match.home_team]?.name;

                    const matchDate = match.date?.toDate?.() || new Date(match.date);
                    const dateStr = matchDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric'
                    });

                    const location = match.location || league.default_location || 'TBD';
                    const isHome = match.home_team === teamId;

                    // Notify each player
                    for (const player of (team.roster || [])) {
                        if (!player.phone && !player.email) continue;

                        const smsMessage = `BRDC Darts: You have a match ${dateStr} vs ${opponent} at ${location}. ` +
                            `Reply YES to confirm or NO if you can't make it.`;

                        const emailSubject = `Match Reminder: ${team.name} vs ${opponent}`;
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #FF469A;">Match Reminder</h2>
                                <p>Hi ${player.name},</p>
                                <p>You have an upcoming match:</p>
                                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <p><strong>Date:</strong> ${dateStr}</p>
                                    <p><strong>Opponent:</strong> ${opponent}</p>
                                    <p><strong>Location:</strong> ${location}</p>
                                    <p><strong>Home/Away:</strong> ${isHome ? 'HOME' : 'AWAY'}</p>
                                </div>
                                <p>Please confirm your availability by replying to this email or logging into your player profile.</p>
                                <p>Good luck!</p>
                                <p style="color: #666; font-size: 12px;">BRDC Dart League</p>
                            </div>
                        `;

                        // Send notifications
                        if (player.phone) {
                            await sendSMS(player.phone, smsMessage);
                        }
                        if (player.email) {
                            await sendEmail(player.email, emailSubject, emailHtml);
                        }

                        // Log notification
                        await db.collection('notifications').add({
                            type: 'monday_reminder',
                            league_id: leagueId,
                            match_id: match.id,
                            player_id: player.id,
                            player_name: player.name,
                            sent_at: admin.firestore.FieldValue.serverTimestamp(),
                            sms_sent: !!player.phone,
                            email_sent: !!player.email
                        });
                    }
                }
            }

            console.log('Monday reminders completed');
            return null;
        } catch (error) {
            console.error('Monday reminder error:', error);
            return null;
        }
    });

/**
 * Morning-of Match Reminder - Runs daily at 8 AM
 * Sends reminder to players with matches TODAY
 */
exports.morningMatchReminder = onSchedule('0 8 * * *', async (event) => {
        console.log('Running morning match reminders...');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        try {
            const leaguesSnap = await db.collection('leagues')
                .where('status', '==', 'active')
                .get();

            for (const leagueDoc of leaguesSnap.docs) {
                const league = leagueDoc.data();
                const leagueId = leagueDoc.id;

                // Find matches TODAY
                const todayMatches = (league.schedule || []).filter(match => {
                    if (match.completed) return false;
                    const matchDate = match.date?.toDate?.() || new Date(match.date);
                    matchDate.setHours(0, 0, 0, 0);
                    return matchDate.getTime() === today.getTime();
                });

                if (todayMatches.length === 0) continue;

                for (const match of todayMatches) {
                    const homeTeam = league.teams?.[match.home_team];
                    const awayTeam = league.teams?.[match.away_team];
                    if (!homeTeam || !awayTeam) continue;

                    const location = match.location || league.default_location || 'TBD';
                    const time = match.time || '7:00 PM';

                    // Notify all players on both teams
                    const allPlayers = [
                        ...(homeTeam.roster || []).map(p => ({ ...p, teamName: homeTeam.name, opponent: awayTeam.name })),
                        ...(awayTeam.roster || []).map(p => ({ ...p, teamName: awayTeam.name, opponent: homeTeam.name }))
                    ];

                    for (const player of allPlayers) {
                        if (!player.phone && !player.email) continue;

                        const smsMessage = `BRDC Darts: MATCH TODAY! ${player.teamName} vs ${player.opponent} at ${time}. ` +
                            `Location: ${location}. Good luck!`;

                        const emailSubject = `Match TODAY: ${player.teamName} vs ${player.opponent}`;
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #FF469A;">Match Day!</h2>
                                <p>Hi ${player.name},</p>
                                <p><strong>Your match is TODAY!</strong></p>
                                <div style="background: linear-gradient(135deg, #FF469A22, #91D7EB22); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF469A;">
                                    <p style="font-size: 18px; margin: 0;"><strong>${player.teamName} vs ${player.opponent}</strong></p>
                                    <p style="margin: 10px 0 0;"><strong>Time:</strong> ${time}</p>
                                    <p style="margin: 5px 0 0;"><strong>Location:</strong> ${location}</p>
                                </div>
                                <p>Good luck and throw well!</p>
                                <p style="color: #666; font-size: 12px;">BRDC Dart League</p>
                            </div>
                        `;

                        if (player.phone) {
                            await sendSMS(player.phone, smsMessage);
                        }
                        if (player.email) {
                            await sendEmail(player.email, emailSubject, emailHtml);
                        }

                        await db.collection('notifications').add({
                            type: 'morning_reminder',
                            league_id: leagueId,
                            match_id: match.id,
                            player_id: player.id,
                            sent_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            }

            console.log('Morning reminders completed');
            return null;
        } catch (error) {
            console.error('Morning reminder error:', error);
            return null;
        }
    });

/**
 * Send match results email after a match is completed
 * Triggered when match_results document is created
 */
exports.sendMatchResultsEmail = onDocumentCreated(
    'leagues/{leagueId}/match_results/{matchId}',
    async (event) => {
        const snap = event.data;
        if (!snap) return null;
        const result = snap.data();
        const { leagueId, matchId } = event.params;

        try {
            const leagueDoc = await db.collection('leagues').doc(leagueId).get();
            if (!leagueDoc.exists) return null;

            const league = leagueDoc.data();
            const homeTeam = league.teams?.[result.home_team];
            const awayTeam = league.teams?.[result.away_team];

            if (!homeTeam || !awayTeam) return null;

            const winnerName = result.home_score > result.away_score
                ? homeTeam.name
                : awayTeam.name;

            // Build results summary
            let gamesHtml = '';
            if (result.games && result.games.length > 0) {
                gamesHtml = `
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Game</th>
                            <th style="padding: 10px; text-align: center;">${homeTeam.name}</th>
                            <th style="padding: 10px; text-align: center;">${awayTeam.name}</th>
                        </tr>
                        ${result.games.map((game, i) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 10px;">${game.type || 'Game ' + (i + 1)}</td>
                                <td style="padding: 10px; text-align: center; ${game.home_win ? 'font-weight: bold; color: #28a745;' : ''}">${game.home_player || '-'}</td>
                                <td style="padding: 10px; text-align: center; ${!game.home_win ? 'font-weight: bold; color: #28a745;' : ''}">${game.away_player || '-'}</td>
                            </tr>
                        `).join('')}
                    </table>
                `;
            }

            const emailSubject = `Match Results: ${homeTeam.name} ${result.home_score} - ${result.away_score} ${awayTeam.name}`;
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF469A;">Match Results</h2>
                    <div style="background: linear-gradient(135deg, #0a1628, #0d1f35); color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0;">
                        <div style="display: flex; justify-content: space-around; align-items: center;">
                            <div>
                                <div style="font-size: 14px; opacity: 0.8;">HOME</div>
                                <div style="font-size: 20px; font-weight: bold;">${homeTeam.name}</div>
                            </div>
                            <div style="font-size: 36px; font-weight: bold; color: #91D7EB;">
                                ${result.home_score} - ${result.away_score}
                            </div>
                            <div>
                                <div style="font-size: 14px; opacity: 0.8;">AWAY</div>
                                <div style="font-size: 20px; font-weight: bold;">${awayTeam.name}</div>
                            </div>
                        </div>
                        <div style="margin-top: 20px; color: #FDD835; font-size: 18px;">
                            Winner: ${winnerName}
                        </div>
                    </div>
                    ${gamesHtml}
                    <p style="color: #666; font-size: 12px; text-align: center;">BRDC Dart League</p>
                </div>
            `;

            // Get all players from both teams
            const allPlayers = [
                ...(homeTeam.roster || []),
                ...(awayTeam.roster || [])
            ];

            // Also notify team captains
            if (homeTeam.captain?.email) {
                allPlayers.push(homeTeam.captain);
            }
            if (awayTeam.captain?.email) {
                allPlayers.push(awayTeam.captain);
            }

            // Send to unique emails
            const sentEmails = new Set();
            for (const player of allPlayers) {
                if (player.email && !sentEmails.has(player.email)) {
                    sentEmails.add(player.email);
                    await sendEmail(player.email, emailSubject, emailHtml);
                }
            }

            // Log notification
            await db.collection('notifications').add({
                type: 'match_results',
                league_id: leagueId,
                match_id: matchId,
                sent_at: admin.firestore.FieldValue.serverTimestamp(),
                recipients: sentEmails.size
            });

            console.log(`Match results sent to ${sentEmails.size} recipients`);
            return null;
        } catch (error) {
            console.error('Match results email error:', error);
            return null;
        }
    }
);

/**
 * Handle incoming SMS replies (Twilio webhook)
 * Players can reply YES/NO to confirm availability
 */
exports.handleSmsReply = functions.https.onRequest(async (req, res) => {
    const { From, Body } = req.body;
    const response = Body?.trim().toUpperCase();
    const phone = From;

    console.log('SMS Reply received:', { phone, response });

    try {
        // Find player by phone number
        const leaguesSnap = await db.collection('leagues')
            .where('status', '==', 'active')
            .get();

        let playerFound = false;
        let playerName = '';
        let matchInfo = null;

        for (const leagueDoc of leaguesSnap.docs) {
            const league = leagueDoc.data();
            const leagueId = leagueDoc.id;

            for (const [teamId, team] of Object.entries(league.teams || {})) {
                const player = (team.roster || []).find(p =>
                    p.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
                );

                if (player) {
                    playerFound = true;
                    playerName = player.name;

                    // Find upcoming match for this team
                    const today = new Date();
                    const upcomingMatch = (league.schedule || []).find(m => {
                        if (m.completed) return false;
                        if (m.home_team !== teamId && m.away_team !== teamId) return false;
                        const matchDate = m.date?.toDate?.() || new Date(m.date);
                        return matchDate >= today;
                    });

                    if (upcomingMatch && (response === 'YES' || response === 'NO')) {
                        const available = response === 'YES';

                        // Update availability
                        await db.collection('leagues').doc(leagueId).update({
                            [`availability.${upcomingMatch.id}.${player.id}`]: {
                                available,
                                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                                source: 'sms'
                            }
                        });

                        matchInfo = upcomingMatch;

                        // Notify captain if player can't make it
                        if (!available && team.captain?.phone) {
                            const opponent = upcomingMatch.home_team === teamId
                                ? league.teams?.[upcomingMatch.away_team]?.name
                                : league.teams?.[upcomingMatch.home_team]?.name;

                            await sendSMS(team.captain.phone,
                                `BRDC Alert: ${player.name} cannot make the match vs ${opponent}. ` +
                                `Please arrange a substitute.`
                            );
                        }
                    }
                    break;
                }
            }
            if (playerFound) break;
        }

        // Send reply confirmation
        let replyMessage = '';
        if (!playerFound) {
            replyMessage = 'Sorry, we could not find your player profile. Please contact your captain.';
        } else if (response === 'YES') {
            replyMessage = `Thanks ${playerName}! Your attendance is confirmed. Good luck!`;
        } else if (response === 'NO') {
            replyMessage = `Thanks ${playerName}. We've notified your captain that you can't make it.`;
        } else {
            replyMessage = `Hi ${playerName}! Reply YES to confirm or NO if you can't make the match.`;
        }

        // Twilio expects TwiML response
        res.set('Content-Type', 'text/xml');
        res.send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Message>${replyMessage}</Message>
            </Response>
        `);
    } catch (error) {
        console.error('SMS reply handling error:', error);
        res.set('Content-Type', 'text/xml');
        res.send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Message>Sorry, an error occurred. Please try again later.</Message>
            </Response>
        `);
    }
});

/**
 * Send PIN Recovery SMS
 */
exports.sendPinRecoverySMS = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { phone, pin, player_name } = req.body;

        if (!phone || !pin) {
            return res.status(400).json({ success: false, error: 'Phone and PIN required' });
        }

        try {
            const message = `BRDC Darts: Hi ${player_name || 'there'}! Your PIN is: ${pin}. Use this to log into your player profile.`;

            const result = await sendSMS(phone, message);

            if (result.success) {
                res.json({ success: true, message: 'PIN sent via SMS' });
            } else {
                res.status(500).json({ success: false, error: result.error || 'Failed to send SMS' });
            }
        } catch (error) {
            console.error('PIN recovery SMS error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Send general SMS notification
 */
exports.sendSMSNotification = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({ success: false, error: 'Phone and message required' });
        }

        try {
            const result = await sendSMS(phone, message);
            res.json({ success: result.success, sid: result.sid, error: result.error });
        } catch (error) {
            console.error('SMS notification error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Send match PIN to players via SMS
 */
exports.sendMatchPinSMS = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { phones, match_pin, team_names, match_date, location } = req.body;

        if (!phones || !match_pin) {
            return res.status(400).json({ success: false, error: 'Phones and match_pin required' });
        }

        try {
            const message = `BRDC Match Tonight! ${team_names || 'Your match'} at ${location || 'TBD'}. ` +
                `Enter PIN: ${match_pin} on the tablet to start scoring. Good luck!`;

            const results = [];
            for (const phone of phones) {
                if (phone) {
                    const result = await sendSMS(phone, message);
                    results.push({ phone, ...result });
                }
            }

            res.json({ success: true, sent: results.filter(r => r.success).length, results });
        } catch (error) {
            console.error('Match PIN SMS error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Notify all players that league has started
 * Sends PIN, dashboard link, team assignment, and first match info
 */
exports.notifyLeaguePlayers = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { league_id, admin_pin } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        try {
            // Get league data
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (!leagueDoc.exists) {
                return res.status(404).json({ success: false, error: 'League not found' });
            }

            const league = leagueDoc.data();

            // Verify admin PIN
            if (admin_pin !== league.admin_pin && admin_pin !== league.director_pin) {
                return res.status(403).json({ success: false, error: 'Invalid PIN' });
            }

            // Get all teams
            const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
            const teams = {};
            teamsSnap.forEach(doc => {
                teams[doc.id] = { id: doc.id, ...doc.data() };
            });

            // Get schedule to find first matches
            const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();
            const matches = [];
            matchesSnap.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));

            // Sort by week to get first matches
            matches.sort((a, b) => (a.week || 0) - (b.week || 0));

            // Get all players from registrations
            const regsSnap = await db.collection('leagues').doc(league_id).collection('registrations').get();
            const players = [];
            regsSnap.forEach(doc => {
                const data = doc.data();
                if (data.phone && !data.isBot) {
                    players.push({ id: doc.id, ...data, source: 'registrations' });
                }
            });

            // Also get players collection (for manually added players)
            const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
            playersSnap.forEach(doc => {
                const data = doc.data();
                if (data.phone && !data.isBot) {
                    players.push({ id: doc.id, ...data, source: 'players' });
                }
            });

            const results = { sent: 0, failed: 0, skipped: 0, details: [] };
            // Use shorter URL format - full URLs with https:// often trigger carrier spam filters
            const dashboardUrl = `brdc-v2.web.app`;

            for (const player of players) {
                // Skip if no phone
                if (!player.phone) {
                    results.skipped++;
                    continue;
                }

                // Find player's team
                let teamName = 'Unassigned';
                let firstMatch = null;

                if (player.team_id) {
                    const team = teams[player.team_id];
                    if (team) {
                        teamName = team.team_name || team.name || 'Your Team';

                        // Find first match for this team
                        firstMatch = matches.find(m =>
                            !m.completed &&
                            (m.home_team_id === player.team_id || m.away_team_id === player.team_id)
                        );
                    }
                }

                // Build message
                let message = `BRDC ${league.league_name}: You're in! `;
                message += `Team: ${teamName}. `;

                if (player.pin) {
                    message += `Your PIN: ${player.pin}. `;
                }

                if (firstMatch) {
                    const opponent = firstMatch.home_team_id === player.team_id
                        ? firstMatch.away_team_name
                        : firstMatch.home_team_name;
                    const matchDate = firstMatch.date || `Week ${firstMatch.week}`;
                    message += `First match: vs ${opponent} (${matchDate}). `;
                }

                message += `Dashboard: ${dashboardUrl}`;

                // Send SMS
                try {
                    const smsResult = await sendSMS(player.phone, message);
                    if (smsResult.success) {
                        results.sent++;
                        results.details.push({ name: player.full_name || player.name, phone: player.phone, status: 'sent' });
                    } else {
                        results.failed++;
                        results.details.push({ name: player.full_name || player.name, phone: player.phone, status: 'failed', error: smsResult.error });
                    }
                } catch (smsError) {
                    results.failed++;
                    results.details.push({ name: player.full_name || player.name, phone: player.phone, status: 'failed', error: smsError.message });
                }
            }

            // Log notification
            await db.collection('notifications').add({
                type: 'league_started',
                league_id: league_id,
                league_name: league.league_name,
                sent_at: admin.firestore.FieldValue.serverTimestamp(),
                results: {
                    sent: results.sent,
                    failed: results.failed,
                    skipped: results.skipped
                }
            });

            res.json({
                success: true,
                message: `Notified ${results.sent} players`,
                results
            });

        } catch (error) {
            console.error('Notify league players error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Manual notification trigger (for testing/admin use)
 */
exports.sendTestNotification = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { type, email, phone, message } = req.body;

        try {
            let result = {};

            if (type === 'email' && email) {
                result.email = await sendEmail(
                    email,
                    'BRDC Test Notification',
                    `<p>${message || 'This is a test notification from BRDC.'}</p>`
                );
            }

            if (type === 'sms' && phone) {
                result.sms = await sendSMS(
                    phone,
                    message || 'BRDC Test: This is a test notification.'
                );
            }

            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Notify captain when player marks unavailable
 */
exports.notifyCaptainUnavailable = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { league_id, team_id, player_name, match_id, captain_phone, captain_email, opponent_name, match_date } = req.body;

        try {
            const smsMessage = `BRDC Alert: ${player_name} cannot make the match vs ${opponent_name} on ${match_date}. Please arrange a substitute.`;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF469A;">Player Unavailable</h2>
                    <p><strong>${player_name}</strong> has marked themselves as unavailable for the upcoming match.</p>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <p style="margin: 0;"><strong>Match:</strong> vs ${opponent_name}</p>
                        <p style="margin: 5px 0 0;"><strong>Date:</strong> ${match_date}</p>
                    </div>
                    <p>Please log into your Captain Dashboard to arrange a substitute.</p>
                    <p style="color: #666; font-size: 12px;">BRDC Dart League</p>
                </div>
            `;

            const results = {};

            if (captain_phone) {
                results.sms = await sendSMS(captain_phone, smsMessage);
            }

            if (captain_email) {
                results.email = await sendEmail(
                    captain_email,
                    `Player Unavailable: ${player_name}`,
                    emailHtml
                );
            }

            // Log notification
            await db.collection('notifications').add({
                type: 'player_unavailable',
                league_id,
                team_id,
                match_id,
                player_name,
                sent_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Send Director Message - Bulk messaging for league directors
 * Sends SMS/email to multiple players based on target type (all, captains, alternates, level)
 */
exports.sendDirectorMessage = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const {
            league_id,
            director_id,
            recipient_ids,
            message,
            target_type,
            target_level
        } = req.body;

        if (!league_id || !director_id || !recipient_ids || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // Verify director access
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (!leagueDoc.exists) {
                return res.status(404).json({ error: 'League not found' });
            }

            const leagueData = leagueDoc.data();
            const isDirector = leagueData.director_id === director_id ||
                              leagueData.admin_pin === director_id ||
                              (leagueData.directors && leagueData.directors.includes(director_id));

            // Check master admin
            const playerDoc = await db.collection('players').doc(director_id).get();
            const isMasterAdmin = playerDoc.exists && playerDoc.data().master_admin === true;

            if (!isDirector && !isMasterAdmin) {
                return res.status(403).json({ error: 'Not authorized as league director' });
            }

            // Get recipient player data
            const playersRef = db.collection('leagues').doc(league_id).collection('players');
            const results = {
                sent: 0,
                failed: 0,
                details: []
            };

            // Process recipients in batches
            for (const playerId of recipient_ids) {
                try {
                    const playerDoc = await playersRef.doc(playerId).get();
                    let playerData = playerDoc.exists ? playerDoc.data() : null;

                    // Also check global players collection if not found in league
                    if (!playerData) {
                        const globalPlayerDoc = await db.collection('players').doc(playerId).get();
                        playerData = globalPlayerDoc.exists ? globalPlayerDoc.data() : null;
                    }

                    if (!playerData) {
                        results.failed++;
                        results.details.push({ playerId, error: 'Player not found' });
                        continue;
                    }

                    const phone = playerData.phone;
                    const email = playerData.email;
                    const playerName = playerData.name || playerData.player_name || 'Player';

                    let sentToPlayer = false;

                    // Send SMS if phone available
                    if (phone) {
                        const smsResult = await sendSMS(phone, message);
                        if (smsResult.success) {
                            sentToPlayer = true;
                        }
                    }

                    // Send email if available
                    if (email) {
                        const leagueName = leagueData.league_name || leagueData.name || 'League';
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #FF469A;">Message from League Director</h2>
                                <p style="color: #666; font-size: 14px;">${leagueName}</p>
                                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <p style="margin: 0; white-space: pre-wrap;">${message}</p>
                                </div>
                                <p style="color: #666; font-size: 12px;">BRDC Dart League</p>
                            </div>
                        `;

                        const emailResult = await sendEmail(
                            email,
                            `${leagueName} - Director Message`,
                            emailHtml,
                            message
                        );

                        if (emailResult.success) {
                            sentToPlayer = true;
                        }
                    }

                    if (sentToPlayer) {
                        results.sent++;
                    } else {
                        results.failed++;
                        results.details.push({ playerId, playerName, error: 'No contact info' });
                    }
                } catch (err) {
                    results.failed++;
                    results.details.push({ playerId, error: err.message });
                }
            }

            // Log the message
            await db.collection('director_messages').add({
                league_id,
                director_id,
                message,
                target_type,
                target_level: target_level || null,
                recipient_count: recipient_ids.length,
                sent_count: results.sent,
                failed_count: results.failed,
                sent_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                sent_count: results.sent,
                failed_count: results.failed,
                details: results.details
            });

        } catch (error) {
            console.error('Send director message error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Get unread notification count for a player
 */
exports.getUnreadNotificationCount = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const unreadSnap = await notificationsRef
                .where('read', '==', false)
                .count()
                .get();

            res.json({
                success: true,
                count: unreadSnap.data().count || 0
            });
        } catch (error) {
            console.error('Get unread notification count error:', error);
            res.json({ success: true, count: 0 });
        }
    });
});

/**
 * Get notifications for a player
 */
exports.getNotifications = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id, limit: queryLimit } = req.body;
        const playerId = player_id || player_pin;
        const limitNum = parseInt(queryLimit) || 20;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const notifSnap = await notificationsRef
                .orderBy('created_at', 'desc')
                .limit(limitNum)
                .get();

            const notifications = [];
            notifSnap.forEach(doc => {
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            res.json({
                success: true,
                notifications
            });
        } catch (error) {
            console.error('Get notifications error:', error);
            res.json({ success: true, notifications: [] });
        }
    });
});

/**
 * Mark a notification as read
 */
exports.markNotificationRead = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { notification_id, player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!notification_id || !playerId) {
            return res.status(400).json({ error: 'Notification ID and player ID required' });
        }

        try {
            await db.collection('players').doc(playerId)
                .collection('notifications').doc(notification_id)
                .update({ read: true, read_at: admin.firestore.FieldValue.serverTimestamp() });

            res.json({ success: true });
        } catch (error) {
            console.error('Mark notification read error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Mark all notifications as read for a player
 */
exports.markAllNotificationsRead = functions.https.onRequest((req, res) => {
    const cors = require('cors')({ origin: true });
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const unreadSnap = await notificationsRef.where('read', '==', false).get();

            const batch = db.batch();
            unreadSnap.forEach(doc => {
                batch.update(doc.ref, {
                    read: true,
                    read_at: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();

            res.json({ success: true, marked_count: unreadSnap.size });
        } catch (error) {
            console.error('Mark all notifications read error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
