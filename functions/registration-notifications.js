/**
 * Registration Confirmation Notifications
 * Sends email and SMS confirmations for league/tournament registrations
 */

const admin = require('firebase-admin');

// Environment variables for Twilio and SendGrid
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@brdc-darts.com';

let twilioClient = null;
let sgMail = null;

try {
    if (TWILIO_SID && TWILIO_TOKEN) {
        twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
    }
} catch (e) { console.log('Twilio not configured'); }

try {
    if (SENDGRID_KEY) {
        sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_KEY);
    }
} catch (e) { console.log('SendGrid not configured'); }

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, body) {
    if (!twilioClient) {
        console.log('SMS (simulated):', { to, body });
        return { success: true, simulated: true };
    }
    try {
        const msg = await twilioClient.messages.create({ body, to, from: TWILIO_PHONE });
        return { success: true, sid: msg.sid };
    } catch (err) {
        console.error('SMS error:', err);
        return { success: false, error: err.message };
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
        await sgMail.send({ to, from: FROM_EMAIL, subject, html, text });
        return { success: true };
    } catch (err) {
        console.error('Email error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Send registration confirmation for league
 */
async function sendLeagueRegistrationConfirmation(registration, league) {
    const { full_name, email, phone, pin, sms_opt_in, waitlist, payment_status, amount_owed } = registration;
    const leagueName = league.league_name || league.name;
    const venueName = league.venue_name || 'TBD';
    const startDate = league.start_date ? new Date(league.start_date).toLocaleDateString() : 'TBD';
    const results = { email: null, sms: null };

    // Payment message
    const paymentMsg = amount_owed > 0
        ? (payment_status === 'paid' ? 'Payment received. Thank you!' : `$${amount_owed.toFixed(2)} due at event or via PayPal.`)
        : 'No payment required.';

    // Send Email
    if (email) {
        const emailSubject = waitlist
            ? `Waitlist Confirmation: ${leagueName}`
            : `Registration Confirmed: ${leagueName}`;

        const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:30px;border-radius:12px;">
                <div style="text-align:center;margin-bottom:30px;">
                    <h1 style="color:#FF469A;margin:0;">BRDC</h1>
                    <p style="color:#91D7EB;margin:5px 0;">Burning River Dart Club</p>
                </div>
                <h2 style="color:${waitlist ? '#FDD835' : '#10b981'};text-align:center;">
                    ${waitlist ? 'Added to Waitlist' : 'Registration Confirmed!'}
                </h2>
                <p>Hi ${full_name},</p>
                <p>${waitlist
                    ? 'You have been added to the waitlist. We will notify you if a spot becomes available.'
                    : 'Thank you for registering! Your spot is confirmed.'}</p>
                <div style="background:rgba(255,255,255,0.1);padding:20px;border-radius:8px;margin:20px 0;">
                    <h3 style="color:#FF469A;margin-top:0;">League Details</h3>
                    <p style="margin:8px 0;"><strong>League:</strong> ${leagueName}</p>
                    <p style="margin:8px 0;"><strong>Venue:</strong> ${venueName}</p>
                    <p style="margin:8px 0;"><strong>Start Date:</strong> ${startDate}</p>
                </div>
                <div style="background:linear-gradient(135deg,#FF469A22,#91D7EB22);padding:20px;border-radius:8px;border-left:4px solid #FF469A;margin:20px 0;">
                    <h3 style="color:#FDD835;margin-top:0;">Your Player PIN</h3>
                    <p style="font-size:32px;font-weight:bold;text-align:center;color:#91D7EB;letter-spacing:8px;margin:10px 0;">${pin}</p>
                    <p style="font-size:12px;text-align:center;color:#a0a0b0;">Use this PIN to log in and access your player profile</p>
                </div>
                <p><strong>Payment Status:</strong> ${paymentMsg}</p>
                <hr style="border:1px solid rgba(255,255,255,0.1);margin:30px 0;">
                <p style="color:#a0a0b0;font-size:12px;text-align:center;">Burning River Dart Club | Cleveland, OH</p>
            </div>
        `;

        const textVersion = `BRDC - ${waitlist ? 'Waitlist' : 'Registration'} Confirmed\n\nHi ${full_name},\n\n${waitlist ? 'You are on the waitlist for' : 'You are registered for'} ${leagueName}.\n\nVenue: ${venueName}\nStart Date: ${startDate}\n\nYour Player PIN: ${pin}\n\nPayment: ${paymentMsg}`;

        results.email = await sendEmail(email, emailSubject, emailHtml, textVersion);

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'registration_confirmation_email',
            to: email,
            registration_type: 'league',
            league_name: leagueName,
            waitlist: waitlist || false,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    // Send SMS if opted in
    if (phone && sms_opt_in !== false) {
        const smsMessage = waitlist
            ? `BRDC: Hi ${full_name}! You're on the waitlist for ${leagueName}. Your PIN: ${pin}. We'll notify you if a spot opens!`
            : `BRDC: Hi ${full_name}! Registration confirmed for ${leagueName}. Your PIN: ${pin}. ${paymentMsg}`;

        results.sms = await sendSMS(phone, smsMessage);

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'registration_confirmation_sms',
            to: phone,
            registration_type: 'league',
            league_name: leagueName,
            waitlist: waitlist || false,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return results;
}

/**
 * Send registration confirmation for tournament
 */
async function sendTournamentRegistrationConfirmation(registration, tournament, eventNames) {
    const { full_name, email, phone, pin, sms_opt_in, payment_status, total_amount } = registration;
    const tournamentName = tournament.name || tournament.tournament_name;
    const venueName = tournament.venue_name || tournament.venue || 'TBD';
    const eventDate = tournament.date ? new Date(tournament.date).toLocaleDateString() : 'TBD';
    const results = { email: null, sms: null };

    // Payment message
    const paymentMsg = total_amount > 0
        ? (payment_status === 'paid' ? 'Payment received. Thank you!' : `$${total_amount.toFixed(2)} due at event or via PayPal.`)
        : 'No payment required.';

    const eventsListHtml = eventNames.map(e => `<li style="margin:5px 0;">${e}</li>`).join('');

    // Send Email
    if (email) {
        const emailSubject = `Tournament Registration: ${tournamentName}`;

        const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:30px;border-radius:12px;">
                <div style="text-align:center;margin-bottom:30px;">
                    <h1 style="color:#FF469A;margin:0;">BRDC</h1>
                    <p style="color:#91D7EB;margin:5px 0;">Burning River Dart Club</p>
                </div>
                <h2 style="color:#10b981;text-align:center;">Registration Confirmed!</h2>
                <p>Hi ${full_name},</p>
                <p>Thank you for registering for ${tournamentName}!</p>
                <div style="background:rgba(255,255,255,0.1);padding:20px;border-radius:8px;margin:20px 0;">
                    <h3 style="color:#91D7EB;margin-top:0;">Tournament Details</h3>
                    <p style="margin:8px 0;"><strong>Tournament:</strong> ${tournamentName}</p>
                    <p style="margin:8px 0;"><strong>Venue:</strong> ${venueName}</p>
                    <p style="margin:8px 0;"><strong>Date:</strong> ${eventDate}</p>
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:20px;border-radius:8px;margin:20px 0;">
                    <h3 style="color:#FDD835;margin-top:0;">Events Registered</h3>
                    <ul style="margin:0;padding-left:20px;">${eventsListHtml}</ul>
                </div>
                <div style="background:linear-gradient(135deg,#FF469A22,#91D7EB22);padding:20px;border-radius:8px;border-left:4px solid #FF469A;margin:20px 0;">
                    <h3 style="color:#FDD835;margin-top:0;">Your Player PIN</h3>
                    <p style="font-size:32px;font-weight:bold;text-align:center;color:#91D7EB;letter-spacing:8px;margin:10px 0;">${pin}</p>
                    <p style="font-size:12px;text-align:center;color:#a0a0b0;">Use this PIN to check in at the tournament</p>
                </div>
                <p><strong>Payment Status:</strong> ${paymentMsg}</p>
                <hr style="border:1px solid rgba(255,255,255,0.1);margin:30px 0;">
                <p style="color:#a0a0b0;font-size:12px;text-align:center;">Burning River Dart Club | Cleveland, OH</p>
            </div>
        `;

        const textVersion = `BRDC - Tournament Registration Confirmed\n\nHi ${full_name},\n\nYou are registered for ${tournamentName}.\n\nVenue: ${venueName}\nDate: ${eventDate}\n\nEvents: ${eventNames.join(', ')}\n\nYour Player PIN: ${pin}\n\nPayment: ${paymentMsg}`;

        results.email = await sendEmail(email, emailSubject, emailHtml, textVersion);

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'registration_confirmation_email',
            to: email,
            registration_type: 'tournament',
            tournament_name: tournamentName,
            events_count: eventNames.length,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    // Send SMS if opted in
    if (phone && sms_opt_in !== false) {
        const smsMessage = `BRDC: Hi ${full_name}! Registration confirmed for ${tournamentName} (${eventNames.length} events). Your PIN: ${pin}. ${paymentMsg}`;

        results.sms = await sendSMS(phone, smsMessage);

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'registration_confirmation_sms',
            to: phone,
            registration_type: 'tournament',
            tournament_name: tournamentName,
            events_count: eventNames.length,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return results;
}

module.exports = {
    sendLeagueRegistrationConfirmation,
    sendTournamentRegistrationConfirmation
};
