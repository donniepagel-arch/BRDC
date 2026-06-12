const admin = require('../../functions/node_modules/firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });

const db = admin.firestore();
const {
    collectTournamentMatchContacts,
    buildRuntimeDirectNotificationPlan,
    getMatchParticipantIds,
    formatPhoneE164
} = require('../../functions/tournaments/matches')._test;

const tournamentId = `qa-wing-it-notifications-${Date.now()}`;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function deleteCollection(collectionRef) {
    const snap = await collectionRef.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
}

async function main() {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    await tournamentRef.set({
        tournament_name: 'QA Wing It Notification Test',
        status: 'active',
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    const registrations = [
        { id: 'reg_both', full_name: 'QA Both', email: 'qa-both@example.com', phone: '216-555-0101', notification_preference: 'both', sms_opt_in: true, email_opt_in: true },
        { id: 'reg_sms', full_name: 'QA SMS', email: 'qa-sms@example.com', phone: '(216) 555-0102', notification_preference: 'sms', sms_opt_in: true, email_opt_in: false },
        { id: 'reg_email', full_name: 'QA Email', email: 'qa-email@example.com', phone: '216.555.0103', notification_preference: 'email', sms_opt_in: false, email_opt_in: true },
        { id: 'reg_legacy', full_name: 'QA Legacy', email: 'qa-legacy@example.com', phone: '12165550104' }
    ];

    const batch = db.batch();
    registrations.forEach(registration => {
        batch.set(tournamentRef.collection('registrations').doc(registration.id), registration);
    });
    await batch.commit();

    const match = {
        id: 'm-1',
        player1: {
            id: 'draw_team_01',
            name: 'QA Both / QA SMS',
            players: [
                { registration_id: 'reg_both', name: 'Stale Both', email: 'stale@example.com', phone: '000' },
                { registration_id: 'reg_sms', name: 'QA SMS' }
            ]
        },
        player2: {
            id: 'draw_team_02',
            name: 'QA Email / QA Legacy',
            players: [
                { registration_id: 'reg_email', name: 'QA Email' },
                { registration_id: 'reg_legacy', name: 'QA Legacy' }
            ]
        }
    };

    const contacts = await collectTournamentMatchContacts(tournamentRef, match, false);
    assert(contacts.length === 4, `Expected 4 contacts, found ${contacts.length}`);
    assert(contacts.find(contact => contact.registration_id === 'reg_both')?.email === 'qa-both@example.com', 'Registration data should override stale embedded data');
    assert(formatPhoneE164('216-555-0101') === '+12165550101', 'Phone formatter should normalize US numbers');

    const plan = buildRuntimeDirectNotificationPlan(contacts, {
        title: 'Tournament Match Reminder',
        body: 'Your tournament match is ready to start. Please join now.',
        tournamentName: 'QA Wing It Notification Test',
        matchLabel: 'QA Both / QA SMS vs QA Email / QA Legacy',
        link: 'https://brdc-v2.web.app/pages/tournament-bracket.html?tournament_id=qa'
    });

    assert(plan.sms.length === 3, `Expected 3 SMS routes, found ${plan.sms.length}`);
    assert(plan.email.length === 3, `Expected 3 email routes, found ${plan.email.length}`);
    assert(!plan.sms.some(item => item.contact.registration_id === 'reg_email'), 'Email-only player should not receive SMS');
    assert(!plan.email.some(item => item.contact.registration_id === 'reg_sms'), 'SMS-only player should not receive email');
    assert(!getMatchParticipantIds(match, false).some(id => id.startsWith('draw_team_')), 'Push IDs should not target draw team IDs');

    console.log(JSON.stringify({
        success: true,
        contacts: contacts.map(contact => ({
            registration_id: contact.registration_id,
            email: contact.email,
            phone_e164: contact.phone_e164,
            preference: contact.notification_preference
        })),
        sms_routes: plan.sms.length,
        email_routes: plan.email.length
    }, null, 2));
}

main()
    .finally(async () => {
        await deleteCollection(db.collection('tournaments').doc(tournamentId).collection('registrations')).catch(() => {});
        await db.collection('tournaments').doc(tournamentId).delete().catch(() => {});
    })
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
