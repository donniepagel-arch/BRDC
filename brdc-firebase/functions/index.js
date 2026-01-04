/**
 * BRDC Firebase Cloud Functions
 * Complete backend for tournament and league management
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Twilio Setup
const twilio = require('twilio');
const TWILIO_ACCOUNT_SID = functions.config().twilio.account_sid;
const TWILIO_AUTH_TOKEN = functions.config().twilio.auth_token;
const TWILIO_PHONE = functions.config().twilio.phone_number;
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// PayPal Setup
const PAYPAL_CLIENT_ID = functions.config().paypal.client_id;
const PAYPAL_SECRET = functions.config().paypal.secret;
const PAYPAL_API = 'https://api-m.paypal.com'; // Live mode

// Boss email for free SMS
const BOSS_EMAIL = 'donniepagel@gmail.com';

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===========================================
// TOURNAMENT CREATION
// ===========================================

exports.createTournament = functions.https.onCall(async (data, context) => {
  try {
    const {
      tournament_name,
      tournament_date,
      tournament_time,
      venue_name,
      venue_address,
      tournament_details,
      director_name,
      director_email,
      director_phone,
      events,
      sms_total,
      sms_is_boss
    } = data;

    // Generate PIN
    const pin = generatePIN();
    const tournament_id = generateId('t');

    // Create tournament
    const tournament = {
      tournament_id,
      tournament_name,
      tournament_date: admin.firestore.Timestamp.fromDate(new Date(tournament_date)),
      tournament_time: tournament_time || '',
      venue_name,
      venue_address: venue_address || '',
      tournament_details: tournament_details || '',
      director_name,
      director_email,
      director_phone: director_phone || '',
      director_pin: pin,
      status: 'draft',
      sms_total: sms_total || 0,
      sms_payment_status: sms_is_boss ? 'free_boss' : (sms_total > 0 ? 'pending' : 'none'),
      sms_transaction_id: '',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('tournaments').doc(tournament_id).set(tournament);

    // Create events
    const eventPromises = events.map(async (eventData) => {
      const event_id = generateId('e');
      
      const event = {
        event_id,
        tournament_id,
        event_name: eventData.event_name,
        game: eventData.game || '501',
        entry_type: eventData.entry_type || 'individual',
        team_size: eventData.team_size || 1,
        format: eventData.format || 'single_elim',
        entry_fee: eventData.entry_fee || 0,
        best_of: eventData.best_of || 3,
        legs_format: eventData.legs_format || 'best_of',
        total_legs: eventData.total_legs || null,
        cork_rules: eventData.cork_rules || 'alternate',
        start_time: eventData.start_time || '',
        max_players: eventData.max_players || 32,
        min_players: eventData.min_players || 4,
        status: 'pending',
        event_details: eventData.event_details || '',
        sms_enabled: eventData.sms_enabled || false,
        sms_paid: sms_is_boss ? true : false,
        legs: eventData.legs || [],
        payout_structure_name: eventData.payout_structure_name || 'top_3_split',
        house_fee_pct: eventData.house_fee_pct || 0,
        payout_1st_pct: eventData.payout_1st_pct || 50,
        payout_2nd_pct: eventData.payout_2nd_pct || 30,
        payout_3rd_pct: eventData.payout_3rd_pct || 20,
        payout_4th_pct: eventData.payout_4th_pct || 0,
        payout_5th_pct: eventData.payout_5th_pct || 0,
        payout_6th_pct: eventData.payout_6th_pct || 0,
        payout_7th_pct: eventData.payout_7th_pct || 0,
        payout_8th_pct: eventData.payout_8th_pct || 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      return db.collection('events').doc(event_id).set(event);
    });

    await Promise.all(eventPromises);

    // Send confirmation email
    // TODO: Implement email sending

    return {
      success: true,
      tournament_id,
      pin,
      events_created: events.length,
      message: 'Tournament created successfully!'
    };

  } catch (error) {
    console.error('Error creating tournament:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===========================================
// BRACKET GENERATION
// ===========================================

exports.generateBracket = functions.https.onCall(async (data, context) => {
  try {
    const { event_id } = data;

    const eventDoc = await db.collection('events').doc(event_id).get();
    if (!eventDoc.exists) {
      throw new Error('Event not found');
    }

    const event = eventDoc.data();

    // Get registrations
    const regsSnapshot = await db.collection('registrations')
      .where('event_id', '==', event_id)
      .where('status', '==', 'active')
      .get();

    const registrations = [];
    regsSnapshot.forEach(doc => registrations.push({id: doc.id, ...doc.data()}));

    if (registrations.length < 2) {
      throw new Error('Need at least 2 players');
    }

    let matches = [];

    // Route to correct bracket generator
    switch(event.format) {
      case 'single_elim':
        matches = await generateSingleElimBracket(event_id, event, registrations);
        break;
      case 'double_elim':
        matches = await generateDoubleElimBracket(event_id, event, registrations);
        break;
      case 'round_robin':
        matches = await generateRoundRobinBracket(event_id, event, registrations);
        break;
      case 'swiss':
        matches = await generateSwissBracket(event_id, event, registrations);
        break;
      default:
        throw new Error('Unknown format: ' + event.format);
    }

    // Update event status
    await db.collection('events').doc(event_id).update({
      status: 'in_progress',
      seeding_locked_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      matches_created: matches.length,
      message: 'Bracket generated successfully!'
    };

  } catch (error) {
    console.error('Error generating bracket:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Single Elimination Bracket Generator
async function generateSingleElimBracket(event_id, event, registrations) {
  const matches = [];
  const shuffled = shuffleArray([...registrations]);
  
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
  const rounds = Math.log2(bracketSize);

  // Round 1
  const r1Matches = bracketSize / 2;
  for (let i = 0; i < r1Matches; i++) {
    const p1 = shuffled[i * 2];
    const p2 = shuffled[i * 2 + 1];

    const match_id = `${event_id}_R1_m${i + 1}`;

    const match = {
      match_id,
      tournament_id: event.tournament_id,
      event_id,
      round: 'R1',
      match_no: i + 1,
      bracket: 'main',
      board_no: null,
      p1_player_id: p1 ? p1.player_id : null,
      p1_name: p1 ? p1.full_name_snapshot : 'BYE',
      p1_team_json: null,
      p2_player_id: p2 ? p2.player_id : null,
      p2_name: p2 ? p2.full_name_snapshot : 'BYE',
      p2_team_json: null,
      status: (p1 && p2) ? 'pending' : 'bye',
      winner_player_id: (!p1 || !p2) ? (p1 ? p1.player_id : (p2 ? p2.player_id : null)) : null,
      loser_player_id: null,
      best_of: event.best_of || 3,
      p1_legs_won: null,
      p2_legs_won: null,
      src1_match_id: null,
      src1_take: null,
      src2_match_id: null,
      src2_take: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('matches').doc(match_id).set(match);
    matches.push(match);
  }

  // Subsequent rounds
  let previousRoundMatchIds = matches.map(m => m.match_id);
  
  for (let round = 2; round <= rounds; round++) {
    const roundLabel = getRoundLabel(round, rounds);
    const matchesInRound = Math.pow(2, rounds - round);
    const currentRoundMatchIds = [];

    for (let i = 0; i < matchesInRound; i++) {
      const match_id = `${event_id}_${roundLabel}_m${i + 1}`;
      currentRoundMatchIds.push(match_id);

      const match = {
        match_id,
        tournament_id: event.tournament_id,
        event_id,
        round: roundLabel,
        match_no: i + 1,
        bracket: 'main',
        board_no: null,
        p1_player_id: null,
        p1_name: 'TBD',
        p1_team_json: null,
        p2_player_id: null,
        p2_name: 'TBD',
        p2_team_json: null,
        status: 'pending',
        winner_player_id: null,
        loser_player_id: null,
        best_of: event.best_of || 3,
        p1_legs_won: null,
        p2_legs_won: null,
        src1_match_id: previousRoundMatchIds[i * 2],
        src1_take: 'winner',
        src2_match_id: previousRoundMatchIds[i * 2 + 1],
        src2_take: 'winner',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('matches').doc(match_id).set(match);
      matches.push(match);
    }

    previousRoundMatchIds = currentRoundMatchIds;
  }

  return matches;
}

// Double Elimination - Simplified (you can expand this)
async function generateDoubleElimBracket(event_id, event, registrations) {
  // Simplified - just create winners bracket for now
  return await generateSingleElimBracket(event_id, event, registrations);
}

// Round Robin
async function generateRoundRobinBracket(event_id, event, registrations) {
  const matches = [];
  const players = [...registrations];

  if (players.length % 2 !== 0) {
    players.push({ player_id: null, full_name_snapshot: 'BYE' });
  }

  const rounds = players.length - 1;
  const matchesPerRound = players.length / 2;

  for (let round = 1; round <= rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = (round + match) % (players.length - 1);
      const away = (players.length - 1 - match + round) % (players.length - 1);

      const p1 = match === 0 ? players[players.length - 1] : players[home];
      const p2 = players[away];

      if (p1.player_id && p2.player_id) {
        const match_id = `${event_id}_RR_R${round}_m${matches.length + 1}`;

        const matchObj = {
          match_id,
          tournament_id: event.tournament_id,
          event_id,
          round: `RR_R${round}`,
          match_no: matches.length + 1,
          bracket: 'round_robin',
          board_no: null,
          p1_player_id: p1.player_id,
          p1_name: p1.full_name_snapshot,
          p1_team_json: null,
          p2_player_id: p2.player_id,
          p2_name: p2.full_name_snapshot,
          p2_team_json: null,
          status: 'pending',
          winner_player_id: null,
          loser_player_id: null,
          best_of: event.best_of || 3,
          p1_legs_won: null,
          p2_legs_won: null,
          src1_match_id: null,
          src1_take: null,
          src2_match_id: null,
          src2_take: null,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('matches').doc(match_id).set(matchObj);
        matches.push(matchObj);
      }
    }
  }

  return matches;
}

// Swiss System
async function generateSwissBracket(event_id, event, registrations) {
  // Simplified - just Round 1 for now
  const matches = [];
  const shuffled = shuffleArray([...registrations]);
  const half = Math.floor(shuffled.length / 2);

  for (let i = 0; i < half; i++) {
    const p1 = shuffled[i];
    const p2 = shuffled[half + i];

    const match_id = `${event_id}_SW_R1_m${i + 1}`;

    const match = {
      match_id,
      tournament_id: event.tournament_id,
      event_id,
      round: 'SW_R1',
      match_no: i + 1,
      bracket: 'swiss',
      board_no: null,
      p1_player_id: p1.player_id,
      p1_name: p1.full_name_snapshot,
      p1_team_json: null,
      p2_player_id: p2 ? p2.player_id : null,
      p2_name: p2 ? p2.full_name_snapshot : 'BYE',
      p2_team_json: null,
      status: p2 ? 'pending' : 'bye',
      winner_player_id: null,
      loser_player_id: null,
      best_of: event.best_of || 3,
      p1_legs_won: null,
      p2_legs_won: null,
      src1_match_id: null,
      src1_take: null,
      src2_match_id: null,
      src2_take: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('matches').doc(match_id).set(match);
    matches.push(match);
  }

  return matches;
}

function getRoundLabel(round, totalRounds) {
  if (round === totalRounds) return 'F';
  if (round === totalRounds - 1 && totalRounds >= 3) return 'SF';
  if (round === totalRounds - 2 && totalRounds >= 4) return 'QF';
  return `R${round}`;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===========================================
// MATCH RESULT SUBMISSION
// ===========================================

exports.submitMatchResult = functions.https.onCall(async (data, context) => {
  try {
    const { match_id, winner_player_id, p1_legs_won, p2_legs_won } = data;

    const matchDoc = await db.collection('matches').doc(match_id).get();
    if (!matchDoc.exists) {
      throw new Error('Match not found');
    }

    const match = matchDoc.data();

    if (match.status === 'completed') {
      throw new Error('Match already completed');
    }

    const loser_player_id = (winner_player_id === match.p1_player_id) 
      ? match.p2_player_id 
      : match.p1_player_id;

    // Update match
    await db.collection('matches').doc(match_id).update({
      winner_player_id,
      loser_player_id,
      p1_legs_won: p1_legs_won || 0,
      p2_legs_won: p2_legs_won || 0,
      status: 'completed',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Advance winner (for single elim)
    await advanceWinner(match, winner_player_id);

    return {
      success: true,
      message: 'Result submitted successfully'
    };

  } catch (error) {
    console.error('Error submitting result:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

async function advanceWinner(completedMatch, winner_player_id) {
  const matchesSnapshot = await db.collection('matches')
    .where('event_id', '==', completedMatch.event_id)
    .get();

  const allMatches = [];
  matchesSnapshot.forEach(doc => allMatches.push({id: doc.id, ...doc.data()}));

  const winnerName = (winner_player_id === completedMatch.p1_player_id) 
    ? completedMatch.p1_name 
    : completedMatch.p2_name;

  const nextMatches = allMatches.filter(m => 
    m.src1_match_id === completedMatch.match_id || 
    m.src2_match_id === completedMatch.match_id
  );

  if (nextMatches.length === 0) {
    // Tournament complete
    await db.collection('events').doc(completedMatch.event_id).update({
      status: 'completed'
    });
    return;
  }

  for (const nextMatch of nextMatches) {
    const updateData = {};

    if (nextMatch.src1_match_id === completedMatch.match_id) {
      updateData.p1_player_id = winner_player_id;
      updateData.p1_name = winnerName;
    } else if (nextMatch.src2_match_id === completedMatch.match_id) {
      updateData.p2_player_id = winner_player_id;
      updateData.p2_name = winnerName;
    }

    await db.collection('matches').doc(nextMatch.match_id).update(updateData);

    // Check if ready
    const updatedDoc = await db.collection('matches').doc(nextMatch.match_id).get();
    const updated = updatedDoc.data();
    
    if (updated.p1_player_id && updated.p2_player_id && 
        updated.p1_name !== 'TBD' && updated.p2_name !== 'TBD') {
      await db.collection('matches').doc(nextMatch.match_id).update({
        status: 'ready'
      });
    }
  }
}

// ===========================================
// PLAYER REGISTRATION
// ===========================================

exports.registerPlayer = functions.https.onCall(async (data, context) => {
  try {
    const {
      event_id,
      tournament_id,
      full_name,
      email,
      phone,
      sms_opt_in
    } = data;

    const reg_id = generateId('reg');
    const player_id = generateId('p');

    const registration = {
      reg_id,
      event_id,
      tournament_id,
      player_id,
      full_name_snapshot: full_name,
      email_snapshot: email,
      phone_snapshot: phone || '',
      sms_opt_in: sms_opt_in || false,
      status: 'active',
      paid: 0,
      payment_status: 'pending',
      transaction_id: '',
      payment_date: null,
      team_name: '',
      check_in_time: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('registrations').doc(reg_id).set(registration);

    return {
      success: true,
      reg_id,
      message: 'Registration successful!'
    };

  } catch (error) {
    console.error('Error registering player:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===========================================
// SMS NOTIFICATIONS
// ===========================================

exports.sendSMS = functions.https.onCall(async (data, context) => {
  try {
    const { to, message } = data;

    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: to
    });

    return { success: true };

  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// SMS Webhook for score reporting
exports.smsWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const { From, Body } = req.body;

    const response = await parseSMSScore(From, Body);

    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>${response}</Message></Response>`);

  } catch (error) {
    console.error('SMS webhook error:', error);
    res.status(500).send('Error processing SMS');
  }
});

async function parseSMSScore(phoneNumber, message) {
  // Find player by phone
  const regsSnapshot = await db.collection('registrations')
    .where('phone_snapshot', '==', phoneNumber)
    .limit(1)
    .get();

  if (regsSnapshot.empty) {
    return "❌ Phone number not registered";
  }

  const reg = regsSnapshot.docs[0].data();

  // Parse score (e.g., "3-1")
  const scoreMatch = message.match(/(\d+)[\s\-:]+(\d+)/);
  if (!scoreMatch) {
    return "❌ Invalid format. Text: 3-1 (your legs - opponent legs)";
  }

  const reporterLegs = parseInt(scoreMatch[1]);
  const opponentLegs = parseInt(scoreMatch[2]);

  // Find player's active match
  const matchesSnapshot = await db.collection('matches')
    .where('event_id', '==', reg.event_id)
    .where('status', '==', 'ready')
    .get();

  let playerMatch = null;
  matchesSnapshot.forEach(doc => {
    const match = doc.data();
    if (match.p1_player_id === reg.player_id || match.p2_player_id === reg.player_id) {
      playerMatch = { id: doc.id, ...match };
    }
  });

  if (!playerMatch) {
    return "❌ No active match found";
  }

  const isP1 = playerMatch.p1_player_id === reg.player_id;
  const winner_id = reporterLegs > opponentLegs ? reg.player_id : 
                    (isP1 ? playerMatch.p2_player_id : playerMatch.p1_player_id);

  const p1_legs = isP1 ? reporterLegs : opponentLegs;
  const p2_legs = isP1 ? opponentLegs : reporterLegs;

  // Update match as pending confirmation
  await db.collection('matches').doc(playerMatch.match_id).update({
    p1_legs_won: p1_legs,
    p2_legs_won: p2_legs,
    winner_player_id: winner_id,
    status: 'pending_confirmation',
    reported_by: reg.player_id,
    confirmation_deadline: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 60000) // 1 minute from now
    )
  });

  return `✅ Score recorded: ${p1_legs}-${p2_legs}. Waiting for confirmation (auto-confirms in 1 min)`;
}

// Auto-confirm expired matches (run every minute)
exports.autoConfirmMatches = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();

  const expiredSnapshot = await db.collection('matches')
    .where('status', '==', 'pending_confirmation')
    .where('confirmation_deadline', '<', now)
    .get();

  const batch = db.batch();

  expiredSnapshot.forEach(doc => {
    batch.update(doc.ref, {
      status: 'completed',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  console.log(`Auto-confirmed ${expiredSnapshot.size} matches`);
});
