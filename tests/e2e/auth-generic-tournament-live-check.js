const { chromium } = require('playwright');
const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/service-account-key.json');

const SITE_ORIGIN = 'https://burningriverdarts.com';
const ADMIN_UID = 'guJR44IeFYPaqccsGy5k2ZVaXAk2';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
}, 'generic-tournament-live');
const db = admin.firestore(admin.app('generic-tournament-live'));

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function signInAsAdmin(page) {
    const customToken = await admin.auth(admin.app('generic-tournament-live')).createCustomToken(ADMIN_UID);

    await page.goto(`${SITE_ORIGIN}/pages/register.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const authState = await page.evaluate(async ({ customToken }) => {
        const config = await import('/js/firebase-config.js');
        const authModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const credential = await authModule.signInWithCustomToken(config.auth, customToken);
        await config.auth.currentUser.getIdToken(true);
        return {
            uid: credential.user.uid,
            email: credential.user.email || null,
        };
    }, { customToken });

    await wait(1500);
    return authState;
}

async function createGenericTournament(page) {
    return page.evaluate(async () => {
        const mod = await import('/js/firebase-config.js');
        const token = await mod.auth.currentUser.getIdToken(true);
        const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/createTournament', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                tournament_name: `Codex Singles Check ${Date.now()}`,
                tournament_date: new Date().toISOString(),
                tournament_time: '19:00',
                venue_name: 'Codex Smoke Venue',
                venue_address: '123 Test Lane',
                tournament_details: 'Generic singles corks-choice smoke test',
                full_name: 'Donnie Pagel',
                director_name: 'Donnie Pagel',
                email: mod.auth.currentUser.email,
                director_email: mod.auth.currentUser.email,
                director_player_id: null,
                max_players: 16,
                boards_available: 4,
                format: 'single_elimination',
                events: [
                    {
                        event_name: 'Open Singles 501 / Cricket Choice',
                        entry_type: 'individual',
                        format: 'single_elimination',
                        game: 'corks_choice',
                        best_of: 3,
                        cork_rules: 'cork_every_leg',
                        use_cork: true,
                        entry_fee: 0,
                        start_time: '19:00',
                        event_details: 'Singles corks-choice format',
                        num_legs: 3,
                        leg_mode: 'best-of',
                        num_sets: 0,
                        cork_order: 'winner',
                        cork_winner_gets: 'choice'
                    }
                ]
            }),
        });

        let body = {};
        try {
            body = await res.json();
        } catch (error) {
            body = { parseError: error.message };
        }

        return { status: res.status, body };
    });
}

async function createTestPlayers() {
    const suffix = Date.now();
    const names = ['Codex Singles One', 'Codex Singles Two'];
    const created = [];

    for (let index = 0; index < names.length; index += 1) {
        const name = names[index];
        const ref = db.collection('players').doc();
        const email = `codex.singles.${index + 1}.${suffix}@playwright.dev`;
        const pin = `88${String(suffix + index).slice(-6)}`;
        await ref.set({
            name,
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' '),
            email,
            pin,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            preferred_level: 'B',
            status: 'active',
        }, { merge: true });
        created.push({ player_id: ref.id, name, email, pin });
    }

    return created;
}

async function registerPlayers(page, tournamentId, eventId, players) {
    const results = [];
    for (const player of players) {
        const result = await page.evaluate(async ({ tournamentId, eventId, player }) => {
            const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/registerForTournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_id: tournamentId,
                    full_name: player.name,
                    email: player.email,
                    phone: '',
                    event_ids: [eventId],
                    sms_opt_in: false,
                    payment_method: 'free',
                    total_amount: 0,
                    member_pin: player.pin
                }),
            });

            let body = {};
            try {
                body = await res.json();
            } catch (error) {
                body = { parseError: error.message };
            }

            return { status: res.status, body };
        }, { tournamentId, eventId, player });

        results.push({ player, result });
    }

    return results;
}

async function createTournamentChats(page, tournamentId) {
    return page.evaluate(async ({ tournamentId }) => {
        const mod = await import('/js/firebase-config.js');
        const token = await mod.auth.currentUser.getIdToken(true);
        const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/createAllTournamentChatRooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ tournament_id: tournamentId }),
        });

        let body = {};
        try {
            body = await res.json();
        } catch (error) {
            body = { parseError: error.message };
        }

        return { status: res.status, body };
    }, { tournamentId });
}

async function inspectTournamentRoom(tournamentId) {
    const roomSnapshot = await db.collection('chat_rooms')
        .where('tournament_id', '==', tournamentId)
        .where('type', '==', 'tournament')
        .limit(1)
        .get();

    if (roomSnapshot.empty) {
        throw new Error(`No room for tournament ${tournamentId}`);
    }

    return {
        roomId: roomSnapshot.docs[0].id,
        room: roomSnapshot.docs[0].data()
    };
}

async function verifyTournamentView(page, tournamentId) {
    await page.goto(`${SITE_ORIGIN}/pages/tournament-view.html?tournament_id=${tournamentId}`, { waitUntil: 'domcontentloaded' });
    await wait(7000);

    return {
        title: await page.title(),
        bodyText: await page.textContent('body').catch(() => '')
    };
}

async function verifyDirectorDashboard(page, tournamentId) {
    await page.goto(`${SITE_ORIGIN}/pages/director-dashboard.html?tournament_id=${tournamentId}`, { waitUntil: 'domcontentloaded' });
    await wait(8000);

    return {
        title: await page.title(),
        hasDashboard: await page.locator('#mainDashboard').isVisible().catch(() => false),
        bodyText: await page.textContent('body').catch(() => '')
    };
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    try {
        const authState = await signInAsAdmin(page);
        console.log('Signed in as:', JSON.stringify(authState, null, 2));

        const createResult = await createGenericTournament(page);
        console.log('Create tournament response:', JSON.stringify(createResult, null, 2));

        if (createResult.status >= 400 || !createResult.body?.success || !createResult.body?.tournament_id) {
            throw new Error('Generic tournament creation failed.');
        }

        const tournamentId = createResult.body.tournament_id;
        console.log(`Created generic tournament ${tournamentId}`);

        const eventsSnapshot = await db.collection('tournaments').doc(tournamentId).collection('events').get();
        const eventId = eventsSnapshot.docs[0]?.id;
        if (!eventId) {
            throw new Error('No event created for generic tournament.');
        }
        console.log(`Created event ${eventId}`);

        const players = await createTestPlayers();
        console.log('Created players:', JSON.stringify(players, null, 2));

        const registrationResults = await registerPlayers(page, tournamentId, eventId, players);
        console.log('Registration results:', JSON.stringify(registrationResults, null, 2));

        const failedRegistration = registrationResults.find(entry => entry.result.status >= 400 || !entry.result.body?.success);
        if (failedRegistration) {
            throw new Error(`Registration failed for ${failedRegistration.player.name}`);
        }

        const chatCreateResult = await createTournamentChats(page, tournamentId);
        console.log('Chat setup response:', JSON.stringify(chatCreateResult, null, 2));
        if (chatCreateResult.status >= 400 || !chatCreateResult.body?.success) {
            throw new Error('Generic tournament chat setup failed.');
        }

        const room = await inspectTournamentRoom(tournamentId);
        console.log('Tournament room state:', JSON.stringify(room, null, 2));

        const tournamentView = await verifyTournamentView(page, tournamentId);
        console.log('Tournament view result:', JSON.stringify({
            title: tournamentView.title,
            hasEventName: tournamentView.bodyText.includes('Open Singles 501 / Cricket Choice'),
            hasRegister: tournamentView.bodyText.includes('REGISTER NOW')
        }, null, 2));

        const directorDashboard = await verifyDirectorDashboard(page, tournamentId);
        console.log('Director dashboard result:', JSON.stringify({
            title: directorDashboard.title,
            hasDashboard: directorDashboard.hasDashboard,
            hasTournamentName: directorDashboard.bodyText.includes('Codex Singles Check'),
            hasChatSetup: directorDashboard.bodyText.includes('Chat Setup')
        }, null, 2));
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
