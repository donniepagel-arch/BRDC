// Deploying all org functions at once.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const twilio = require('twilio');

// Admin SDK is initialized in index.js, so we can just use it
const db = admin.firestore();

// Initialize Twilio client from environment variables
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient;
if (twilioAccountSid && twilioAuthToken) {
    twilioClient = new twilio(twilioAccountSid, twilioAuthToken);
} else {
    console.warn("Twilio credentials not found in environment variables. SMS functionality will not work.");
    // Create a mock client to avoid crashes if credentials are not set
    twilioClient = {
        messages: {
            create: () => Promise.resolve({ sid: 'mock_sid_for_logging' })
        }
    };
}


// Helper to check manager authentication
const verifyManager = async (orgId, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const managerDoc = await db.doc(`organizations/${orgId}/managers/${context.auth.uid}`).get();
    if (!managerDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Not a manager for this organization');
    }
};

// [START] Org Event Functions
const createOrgEvent = functions.https.onCall(async (data, context) => {
    const { orgId, eventData } = data;
    await verifyManager(orgId, context);
    const newEventRef = await db.collection(`organizations/${orgId}/events`).add({
        ...eventData,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { eventId: newEventRef.id };
});

const updateOrgEvent = functions.https.onCall(async (data, context) => {
    const { orgId, eventId, updates } = data;
    await verifyManager(orgId, context);
    await db.doc(`organizations/${orgId}/events/${eventId}`).update({
        ...updates,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

const deleteOrgEvent = functions.https.onCall(async (data, context) => {
    const { orgId, eventId } = data;
    await verifyManager(orgId, context);
    await db.doc(`organizations/${orgId}/events/${eventId}`).delete();
    return { success: true };
});

const registerForOrgEvent = functions.https.onCall(async (data, context) => {
    const { orgId, eventId, name, email, phone } = data;
    const registrationData = { name, email, phone, timestamp: new Date() };
    await db.collection(`organizations/${orgId}/events/${eventId}/registrations`).add(registrationData);
    return { success: true };
});
// [END] Org Event Functions

// [START] Org Player Functions
const addOrgPlayer = functions.https.onCall(async (data, context) => {
    const { orgId, playerData } = data;
    await verifyManager(orgId, context);
    const newPlayerRef = await db.collection(`organizations/${orgId}/players`).add({
        ...playerData,
        status: playerData.status || 'active',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { playerId: newPlayerRef.id };
});

const updateOrgPlayer = functions.https.onCall(async (data, context) => {
    const { orgId, playerId, updates } = data;
    await verifyManager(orgId, context);
    await db.doc(`organizations/${orgId}/players/${playerId}`).update({
        ...updates,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

const removeOrgPlayer = functions.https.onCall(async (data, context) => {
    const { orgId, playerId } = data;
    await verifyManager(orgId, context);
    await db.doc(`organizations/${orgId}/players/${playerId}`).update({ status: 'inactive' });
    return { success: true };
});

const importOrgPlayers = functions.https.onCall(async (data, context) => {
    const { orgId, players } = data;
    await verifyManager(orgId, context);

    const playersCollection = db.collection(`organizations/${orgId}/players`);
    const existingPlayersSnapshot = await playersCollection.get();
    const existingEmails = new Set(existingPlayersSnapshot.docs.map(doc => doc.data().email));

    const batch = db.batch();
    let importedCount = 0;

    players.forEach(player => {
        if (player.email && !existingEmails.has(player.email)) {
            const newPlayerRef = playersCollection.doc();
            batch.set(newPlayerRef, {
                ...player,
                source: 'imported',
                status: 'active',
                joined: new Date()
            });
            existingEmails.add(player.email); // Add to set to prevent duplicates within the same import
            importedCount++;
        }
    });

    await batch.commit();
    return { success: true, importedCount };
});

const approveOrgPlayer = functions.https.onCall(async (data, context) => {
    const { orgId, playerId } = data;
    await verifyManager(orgId, context);
    await db.doc(`organizations/${orgId}/players/${playerId}`).update({ status: 'active' });
    return { success: true };
});
// [END] Org Player Functions

// [START] Org Manager Functions
const addOrgManager = functions.https.onCall(async (data, context) => {
    const { orgId, email, name, role = 'league_manager' } = data;
    await verifyManager(orgId, context);

    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Manager email is required.');
    }

    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'That email does not have a Firebase Auth account yet.');
        }
        throw error;
    }

    await db.doc(`organizations/${orgId}/managers/${userRecord.uid}`).set({
        uid: userRecord.uid,
        email,
        name: name || userRecord.displayName || email,
        role,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, managerId: userRecord.uid };
});

const removeOrgManager = functions.https.onCall(async (data, context) => {
    const { orgId, managerId } = data;
    await verifyManager(orgId, context);

    if (!managerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Manager ID is required.');
    }
    if (context.auth.uid === managerId) {
        throw new functions.https.HttpsError('failed-precondition', 'You cannot remove your own manager access.');
    }

    await db.doc(`organizations/${orgId}/managers/${managerId}`).delete();
    return { success: true };
});
// [END] Org Manager Functions


// [START] Org Communication Functions
const sendOrgMessage = functions.https.onCall(async (data, context) => {
    const { orgId, audience, channel, message, title, eventId, playerIds } = data;
    await verifyManager(orgId, context);

    let playersToSend = [];
    const playersCollection = db.collection(`organizations/${orgId}/players`);

    if (audience === 'all') {
        const snapshot = await playersCollection.where('status', '==', 'active').get();
        snapshot.forEach(doc => playersToSend.push(doc.data()));
    } else if (audience === 'event' && eventId) {
        const snapshot = await db.collection(`organizations/${orgId}/events/${eventId}/registrations`).get();
        snapshot.forEach(doc => playersToSend.push(doc.data()));
    } else if (audience === 'custom' && playerIds && playerIds.length > 0) {
        const playerDocs = await Promise.all(playerIds.map(id => playersCollection.doc(id).get()));
        playersToSend = playerDocs.map(doc => doc.data()).filter(p => p); // filter out non-existent players
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid audience or missing required parameters.');
    }

    if (channel === 'sms') {
        if (!twilioPhoneNumber) {
            console.error("Twilio phone number not configured. Cannot send SMS.");
            throw new functions.https.HttpsError('internal', 'SMS sending is not configured.');
        }
        const smsPromises = playersToSend
            .filter(p => p.phone)
            .map(p => {
                return twilioClient.messages.create({
                    body: message,
                    from: twilioPhoneNumber,
                    to: p.phone
                });
            });
        await Promise.all(smsPromises);
    } else if (channel === 'push') {
        // Get FCM tokens from players' documents this time
        const playerIdsForPush = playersToSend.map(p => p.id || p.player_id).filter(id => id);
        if(playerIdsForPush.length === 0) {
            console.log("No player IDs found for push notifications.");
            return { success: true, recipients: 0, reason: "No player IDs" };
        }

        const tokens = [];
        const fcmTokensSnapshot = await db.collection('fcm_tokens').where('player_id', 'in', playerIdsForPush).get();
        fcmTokensSnapshot.forEach(doc => {
            if (doc.data().token) {
                tokens.push(doc.data().token);
            }
        });


        if (tokens.length > 0) {
            const pushMessage = {
                notification: {
                    title: title || 'Message from your Organization',
                    body: message,
                },
                tokens: [...new Set(tokens)], // Deduplicate tokens
            };
            await admin.messaging().sendEachForMulticast(pushMessage);
        }
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported channel type.');
    }

    // Log the message
    await db.collection(`organizations/${orgId}/message_log`).add({
        timestamp: new Date(),
        channel,
        audience,
        recipient_count: playersToSend.length,
        message,
        title,
        sent_by: context.auth.uid,
    });

    return { success: true, recipients: playersToSend.length };
});
// [END] Org Communication Functions

module.exports = {
    createOrgEvent,
    updateOrgEvent,
    deleteOrgEvent,
    registerForOrgEvent,
    addOrgPlayer,
    updateOrgPlayer,
    removeOrgPlayer,
    importOrgPlayers,
    approveOrgPlayer,
    addOrgManager,
    removeOrgManager,
    sendOrgMessage
};
