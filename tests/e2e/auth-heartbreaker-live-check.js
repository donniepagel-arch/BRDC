const path = require('path');
const { chromium } = require('playwright');
const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/service-account-key.json');

const SITE_ORIGIN = 'https://burningriverdarts.com';
const ADMIN_UID = 'guJR44IeFYPaqccsGy5k2ZVaXAk2';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function signInAsAdmin(page) {
    const customToken = await admin.auth().createCustomToken(ADMIN_UID);

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

    await wait(2000);
    return authState;
}

async function createTournament(page) {
    return page.evaluate(async () => {
        const mod = await import('/js/firebase-config.js');
        const token = await mod.auth.currentUser.getIdToken(true);
        const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/createMixedDoublesMatchmakerTournament', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                tournament_name: `Codex Live Auth Check ${Date.now()}`,
                tournament_date: new Date().toISOString(),
                email: mod.auth.currentUser.email,
                venue_name: 'Codex Smoke Venue',
                boards_available: 4,
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
    const players = [
        { name: 'Codex Male One', gender: 'M', email: `codex.m1.${suffix}@playwright.dev` },
        { name: 'Codex Female One', gender: 'F', email: `codex.f1.${suffix}@playwright.dev` },
        { name: 'Codex Male Two', gender: 'M', email: `codex.m2.${suffix}@playwright.dev` },
        { name: 'Codex Female Two', gender: 'F', email: `codex.f2.${suffix}@playwright.dev` },
    ];

    const created = [];
    for (let index = 0; index < players.length; index += 1) {
        const player = players[index];
        const ref = db.collection('players').doc();
        await ref.set({
            name: player.name,
            first_name: player.name.split(' ')[0],
            last_name: player.name.split(' ').slice(1).join(' '),
            email: player.email.toLowerCase(),
            pin: `99${String(suffix + index).slice(-6)}`,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            preferred_level: 'B',
            status: 'active',
        }, { merge: true });
        created.push({ ...player, player_id: ref.id });
    }

    return created;
}

async function registerSingles(page, tournamentId) {
    const registrations = await createTestPlayers();

    const results = [];
    for (const player of registrations) {
        const result = await page.evaluate(async ({ tournamentId, player }) => {
            const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/matchmakerRegister', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tournament_id: tournamentId,
                    registration_type: 'single',
                    player: {
                        name: player.name,
                        gender: player.gender,
                        email: player.email,
                        player_id: player.player_id,
                    },
                }),
            });

            let body = {};
            try {
                body = await res.json();
            } catch (error) {
                body = { parseError: error.message };
            }

            return { status: res.status, body };
        }, { tournamentId, player });

        results.push({ player, result });
    }

    return results;
}

async function armDirectorSession(page, tournamentId) {
    await page.evaluate((id) => {
        sessionStorage.setItem(`matchmaker_session_${id}`, '1');
    }, tournamentId);

    await page.goto(`${SITE_ORIGIN}/pages/matchmaker-director.html?id=${tournamentId}`, { waitUntil: 'domcontentloaded' });
    await wait(7000);

    const dashboardVisible = await page.locator('#dashboard').isVisible({ timeout: 3000 }).catch(() => false);
    if (dashboardVisible) {
        return;
    }

    const customToken = await admin.auth().createCustomToken(ADMIN_UID);
    await page.evaluate(async ({ customToken, tournamentId }) => {
        const config = await import('/js/firebase-config.js');
        const authModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        await authModule.signInWithCustomToken(config.auth, customToken);
        await config.auth.currentUser.getIdToken(true);
        sessionStorage.setItem(`matchmaker_session_${tournamentId}`, '1');
    }, { customToken, tournamentId });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await wait(7000);
}

async function clickIfVisible(page, selector, timeout = 5000) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout }).catch(() => false)) {
        await el.click();
        return true;
    }
    return false;
}

async function runUiFlow(page, tournamentId) {
    await armDirectorSession(page, tournamentId);

    const dashboardVisible = await page.locator('#dashboard').isVisible({ timeout: 10000 }).catch(() => false);
    if (!dashboardVisible) {
        throw new Error('Director dashboard did not auto-open from authenticated session.');
    }

    await page.locator(`[onclick="showTab('matching')"]`).click();
    await wait(1500);

    if (!await clickIfVisible(page, '#drawBtn')) {
        throw new Error('Partner draw button not visible.');
    }

    await wait(5000);

    const drawMessage = await page.locator('#drawMessage').textContent().catch(() => '');

    await page.locator(`[onclick="showTab('bracket')"]`).click();
    await wait(2000);

    if (await page.locator('#genBracketBtn').isVisible().catch(() => false)) {
        await page.locator('#genBracketBtn').click();
        await wait(8000);
    }

    const matchScoreCardVisible = await page.locator('#matchScoreCard').isVisible({ timeout: 5000 }).catch(() => false);
    const scoreCardCount = matchScoreCardVisible ? await page.locator('.score-match-card').count() : 0;

    return {
        drawMessage,
        matchScoreCardVisible,
        scoreCardCount,
        overviewTotal: await page.locator('#overviewTotal').textContent().catch(() => ''),
        bracketSummary: await page.locator('#matchScoreSummary').textContent().catch(() => ''),
    };
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
            body: JSON.stringify({
                tournament_id: tournamentId,
            }),
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

async function addTournamentEvent(page, tournamentId) {
    return page.evaluate(async ({ tournamentId }) => {
        const mod = await import('/js/firebase-config.js');
        const token = await mod.auth.currentUser.getIdToken(true);
        const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/addEventToTournament', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                tournament_id: tournamentId,
                event_name: 'Codex Side Event',
                format: 'singles',
                bracket_type: 'single_elimination',
                max_players: 16,
                entry_fee: 0,
                event_details: 'Smoke test event chat'
            }),
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

async function inspectTournamentChat(tournamentId) {
    const roomSnapshot = await admin.firestore()
        .collection('chat_rooms')
        .where('tournament_id', '==', tournamentId)
        .where('type', '==', 'tournament')
        .limit(1)
        .get();

    if (roomSnapshot.empty) {
        throw new Error(`No tournament chat room found for tournament ${tournamentId}`);
    }

    const roomDoc = roomSnapshot.docs[0];
    const messagesSnapshot = await roomDoc.ref.collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(5)
        .get();

    return {
        roomId: roomDoc.id,
        room: roomDoc.data(),
        messages: messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
}

async function inspectEventChats(tournamentId) {
    const roomSnapshot = await admin.firestore()
        .collection('chat_rooms')
        .where('tournament_id', '==', tournamentId)
        .where('type', '==', 'tournament_event')
        .get();

    return roomSnapshot.docs.map(doc => ({
        roomId: doc.id,
        room: doc.data(),
    }));
}

async function sendTournamentMessage(page, roomId, text) {
    return page.evaluate(async ({ roomId, text }) => {
        const mod = await import('/js/firebase-config.js');
        const token = await mod.auth.currentUser.getIdToken(true);
        const res = await fetch('https://us-central1-brdc-v2.cloudfunctions.net/sendChatMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                room_id: roomId,
                text
            }),
        });

        let body = {};
        try {
            body = await res.json();
        } catch (error) {
            body = { parseError: error.message };
        }

        return { status: res.status, body };
    }, { roomId, text });
}

async function verifyChatRoomPage(page, roomId) {
    await page.goto(`${SITE_ORIGIN}/pages/chat-room.html?id=${roomId}`, { waitUntil: 'domcontentloaded' });
    await wait(7000);

    return {
        title: await page.title(),
        header: await page.locator('#headerName').textContent().catch(() => ''),
        hasWelcome: await page.locator('.message-bubble.system').filter({ hasText: 'Welcome to' }).first().isVisible({ timeout: 5000 }).catch(() => false),
        visibleMessages: await page.locator('.message-bubble').count().catch(() => 0),
    };
}

async function verifyMessagesPageTournamentChannels(page, expectedNames = []) {
    await page.goto(`${SITE_ORIGIN}/pages/messages.html`, { waitUntil: 'domcontentloaded' });
    await wait(7000);

    const channelsBtn = page.locator('#channelsTabBtn, button[onclick*="channels"]').first();
    if (await channelsBtn.isVisible().catch(() => false)) {
        await channelsBtn.click();
        await wait(1500);
    }

    const tournamentVisible = await page.locator('#tournamentChannels').isVisible().catch(() => false);
    const bodyText = await page.textContent('body').catch(() => '');

    return {
        tournamentVisible,
        foundNames: expectedNames.filter(name => bodyText.includes(name))
    };
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    try {
        const authState = await signInAsAdmin(page);
        console.log('Signed in as:', JSON.stringify(authState, null, 2));

        const createResult = await createTournament(page);
        console.log('Create tournament response:', JSON.stringify(createResult, null, 2));

        if (createResult.status >= 400 || !createResult.body?.success || !createResult.body?.tournament_id) {
            throw new Error('Tournament creation failed.');
        }

        const tournamentId = createResult.body.tournament_id;
        console.log(`Created tournament ${tournamentId}`);

        const registrationResults = await registerSingles(page, tournamentId);
        console.log('Registration results:', JSON.stringify(registrationResults, null, 2));

        const failedRegistration = registrationResults.find(entry => entry.result.status >= 400 || !entry.result.body?.success);
        if (failedRegistration) {
            throw new Error(`Registration failed for ${failedRegistration.player.name}`);
        }

        const ui = await runUiFlow(page, tournamentId);
        console.log('UI flow result:', JSON.stringify(ui, null, 2));

        const chatCreateResult = await createTournamentChats(page, tournamentId);
        console.log('Chat setup response:', JSON.stringify(chatCreateResult, null, 2));

        if (chatCreateResult.status >= 400 || !chatCreateResult.body?.success) {
            throw new Error('Tournament chat setup failed.');
        }

        const chatData = await inspectTournamentChat(tournamentId);
        console.log('Tournament chat firestore state:', JSON.stringify(chatData, null, 2));

        const messageText = `Codex smoke message ${Date.now()}`;
        const sendResult = await sendTournamentMessage(page, chatData.roomId, messageText);
        console.log('Tournament chat send result:', JSON.stringify(sendResult, null, 2));
        if (sendResult.status >= 400 || !sendResult.body?.success) {
            throw new Error('Tournament chat message send failed.');
        }

        const chatPage = await verifyChatRoomPage(page, chatData.roomId);
        console.log('Tournament chat page result:', JSON.stringify(chatPage, null, 2));

        const eventCreateResult = await addTournamentEvent(page, tournamentId);
        console.log('Tournament event create result:', JSON.stringify(eventCreateResult, null, 2));
        if (eventCreateResult.status >= 400 || !eventCreateResult.body?.success) {
            throw new Error('Tournament event creation failed.');
        }

        const refreshedChatCreateResult = await createTournamentChats(page, tournamentId);
        console.log('Tournament chat refresh response:', JSON.stringify(refreshedChatCreateResult, null, 2));
        if (refreshedChatCreateResult.status >= 400 || !refreshedChatCreateResult.body?.success) {
            throw new Error('Tournament chat refresh failed.');
        }

        const eventChats = await inspectEventChats(tournamentId);
        console.log('Tournament event chat state:', JSON.stringify(eventChats, null, 2));

        const messagesSurface = await verifyMessagesPageTournamentChannels(page, [
            chatData.room.name,
            'Codex Side Event Chat'
        ]);
        console.log('Messages page tournament channels:', JSON.stringify(messagesSurface, null, 2));
    } finally {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
