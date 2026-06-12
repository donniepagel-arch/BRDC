const { chromium } = require('@playwright/test');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const admin = require('../../functions/node_modules/firebase-admin');

const execFileAsync = promisify(execFile);

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const BASE_URL = process.env.BRDC_BASE_URL || 'https://brdc-v2.web.app';
const tournamentId = `qa-wing-it-${Date.now()}`;
const eventId = 'blind_draw_doubles';

const players = [
    { name: 'QA Wing Alpha', email: `qa-wing-alpha-${Date.now()}@example.com`, phone: '5550001001' },
    { name: 'QA Wing Bravo', email: `qa-wing-bravo-${Date.now()}@example.com`, phone: '5550001002' },
    { name: 'QA Wing Charlie', email: `qa-wing-charlie-${Date.now()}@example.com`, phone: '5550001003' },
    { name: 'QA Wing Delta', email: `qa-wing-delta-${Date.now()}@example.com`, phone: '5550001004' }
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function deleteCollection(collectionRef, batchSize = 50) {
    while (true) {
        const snap = await collectionRef.limit(batchSize).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

async function cleanup() {
    const ref = db.collection('tournaments').doc(tournamentId);
    const events = await ref.collection('events').get();
    for (const eventDoc of events.docs) {
        await deleteCollection(eventDoc.ref.collection('registrations'));
        await deleteCollection(eventDoc.ref.collection('draw_teams'));
        await eventDoc.ref.delete();
    }
    await deleteCollection(ref.collection('registrations'));
    await deleteCollection(ref.collection('players'));
    await deleteCollection(ref.collection('draw_teams'));
    await deleteCollection(ref.collection('matches'));
    await deleteCollection(ref.collection('stats'));
    await ref.delete();
}

async function createTournament() {
    const ref = db.collection('tournaments').doc(tournamentId);
    await ref.set({
        tournament_name: 'QA Wing It Wednesdays Blind Draw',
        name: 'QA Wing It Wednesdays Blind Draw',
        tournament_date: '2026-05-27',
        date: '2026-05-27',
        start_date: '2026-05-27',
        tournament_time: '19:00',
        start_time: '19:00',
        timezone: 'America/New_York',
        location_mode: 'specific',
        venue_name: 'BRDC / Burning River Darts',
        tournament_details: 'Disposable Chromium QA test for blind draw setup.',
        description: 'Disposable Chromium QA test for blind draw setup.',
        format: 'single_elimination',
        bracket_type: 'single_elimination',
        entry_type: 'blind_draw',
        draw_type: 'blind_draw',
        team_size: 2,
        max_players: 64,
        entry_fee: 0,
        game_type: 'corks_choice',
        default_game: 'corks_choice',
        is_online: false,
        allow_remote_play: false,
        require_check_in: true,
        allow_player_self_report: true,
        show_tournament_runtime: true,
        status: 'registration',
        registration_status: 'Registration open',
        started: false,
        completed: false,
        bracketGenerated: false,
        players: {},
        registered_count: 0,
        event_count: 1,
        public_registration: true,
        registration_open: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
    });

    await ref.collection('events').doc(eventId).set({
        tournament_id: tournamentId,
        event_number: 1,
        event_name: 'Blind Draw Doubles',
        name: 'Blind Draw Doubles',
        entry_type: 'blind_draw',
        draw_type: 'blind_draw',
        team_size: 2,
        format: 'single_elimination',
        bracket_type: 'single_elimination',
        game: 'corks_choice',
        game_type: 'corks_choice',
        best_of: 3,
        num_legs: 3,
        num_sets: 1,
        leg_mode: 'best-of',
        legs_to_win: 2,
        cork_rules: 'cork_every_leg',
        start_rule: 'cork_every_leg',
        cork_option: 'winner_chooses',
        cork_winner_gets: 'choice',
        use_cork: true,
        in_option: 'straight',
        out_option: 'double',
        x01_value: 501,
        entry_fee: 0,
        start_time: '19:00',
        event_details: 'Players register individually. Partners are drawn blind at the venue before bracket play.',
        max_players: 64,
        registered_count: 0,
        player_count: 0,
        status: 'open',
        public_registration: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
    });
}

async function registerPlayersInChromium(page) {
    const errors = [];
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    for (const player of players) {
        await page.goto(`${BASE_URL}/pages/tournament-register-vnext.html?tournament_id=${tournamentId}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(`[data-event-id="${eventId}"]`, { timeout: 20000 });
        await page.fill('#fullName', player.name);
        await page.fill('#email', player.email);
        await page.fill('#phone', player.phone);
        await page.click(`[data-event-id="${eventId}"]`);
        await page.waitForFunction(() => !document.querySelector('#registerBtn')?.disabled, null, { timeout: 10000 });
        await page.click('#registerBtn');
        await page.waitForSelector('#registerResult:not([hidden])', { timeout: 30000 });
        const resultText = await page.locator('#registerResult').innerText();
        assert(/Registration saved/i.test(resultText), `Registration failed for ${player.name}: ${resultText}`);
    }

    return errors.filter(text => !/getConversations|Unauthorized|getPlayerChatRooms/i.test(text));
}

async function readCounts() {
    const ref = db.collection('tournaments').doc(tournamentId);
    const [tournamentSnap, eventSnap, regsSnap] = await Promise.all([
        ref.get(),
        ref.collection('events').doc(eventId).get(),
        ref.collection('registrations').get()
    ]);
    return {
        tournament: tournamentSnap.data(),
        event: eventSnap.data(),
        registrations: regsSnap.size
    };
}

async function runDrawScript() {
    const args = [
        'scripts/wing-it-blind-draw.js',
        '--tournament', tournamentId,
        '--event', eventId,
        '--seed', 'chromium-qa',
        '--commit',
        '--generate-bracket'
    ];
    const { stdout, stderr } = await execFileAsync('node', args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
    if (stderr.trim()) console.error(stderr);
    return stdout;
}

async function verifyPages(page) {
    const urls = {
        view: `${BASE_URL}/pages/tournament-view-vnext.html?tournament_id=${tournamentId}`,
        runtime: `${BASE_URL}/pages/tournament-runtime-vnext.html?tournament_id=${tournamentId}`,
        bracket: `${BASE_URL}/pages/tournament-bracket.html?tournament_id=${tournamentId}`
    };
    const state = {};
    for (const [key, url] of Object.entries(urls)) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);
        state[key] = await page.evaluate(() => ({
            h1: document.querySelector('h1, #tournamentName')?.textContent?.replace(/\s+/g, ' ').trim() || '',
            body: document.body.innerText,
            errors: [...document.querySelectorAll('.error,[role="alert"]')].map(el => el.textContent.trim()).filter(Boolean)
        }));
    }
    assert(state.view.body.includes('QA Wing It Wednesdays Blind Draw'), 'Tournament view did not show QA tournament');
    assert(state.runtime.body.includes('Open bracket'), 'Runtime did not expose bracket link/card');
    assert(state.bracket.body.includes('Round 1'), 'Bracket page did not render Round 1');
    assert(state.bracket.body.includes('QA Wing'), 'Bracket page did not render drawn teams');
    return state;
}

(async () => {
    let browser;
    try {
        await createTournament();
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

        const registrationConsoleErrors = await registerPlayersInChromium(page);
        assert(registrationConsoleErrors.length === 0, `Console errors during registration: ${registrationConsoleErrors.join('\n')}`);

        const beforeDraw = await readCounts();
        assert(beforeDraw.registrations === 4, `Expected 4 registrations, found ${beforeDraw.registrations}`);
        assert(Number(beforeDraw.tournament.registered_count) === 4, `Expected tournament registered_count 4, found ${beforeDraw.tournament.registered_count}`);
        assert(Number(beforeDraw.event.registered_count) === 4, `Expected event registered_count 4, found ${beforeDraw.event.registered_count}`);

        const drawOutput = await runDrawScript();
        const afterDraw = await readCounts();
        const teamsSnap = await db.collection('tournaments').doc(tournamentId).collection('draw_teams').get();
        assert(teamsSnap.size === 2, `Expected 2 draw teams, found ${teamsSnap.size}`);
        assert(afterDraw.tournament.bracketGenerated === true, 'Bracket was not marked generated');
        assert(afterDraw.tournament.bracket?.matches?.length >= 1, 'Bracket matches were not written');

        const pageState = await verifyPages(page);

        console.log(JSON.stringify({
            success: true,
            tournamentId,
            registered: beforeDraw.registrations,
            teams: teamsSnap.size,
            bracketMatches: afterDraw.tournament.bracket.matches.length,
            drawOutput: JSON.parse(drawOutput.slice(drawOutput.indexOf('{'), drawOutput.lastIndexOf('}') + 1)),
            pageChecks: {
                viewH1: pageState.view.h1,
                runtimeH1: pageState.runtime.h1,
                bracketH1: pageState.bracket.h1,
                bracketHasRound1: pageState.bracket.body.includes('Round 1')
            }
        }, null, 2));
    } finally {
        if (browser) await browser.close();
        await cleanup();
    }
})().catch(error => {
    console.error(error.stack || error.message || error);
    cleanup().finally(() => process.exit(1));
});
