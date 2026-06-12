import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

const execFileAsync = promisify(execFile);

const ADB = process.env.ADB || 'C:\\Users\\gcfrp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const BASE_URL = process.env.BRDC_BASE_URL || 'https://brdc-v2.web.app';
const CDP_URL = 'http://127.0.0.1:9222/json';

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const tournamentId = `qa-wing-it-android-${Date.now()}`;
const eventId = 'blind_draw_doubles';

const players = Array.from({ length: 12 }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return {
        name: `Android QA Wing ${n}`,
        email: `android-qa-wing-${n}-${Date.now()}@example.com`,
        phone: `55510010${n}`
    };
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function getText(url) {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function ensureCdpForward() {
    await execFileAsync(ADB, ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote']);
}

async function openAndroidUrl(url, waitMs = 7000) {
    const shellSafeUrl = url.replaceAll('&', '\\&');
    await execFileAsync(ADB, ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']).catch(() => null);
    await execFileAsync(ADB, ['shell', 'wm', 'dismiss-keyguard']).catch(() => null);
    await execFileAsync(ADB, [
        'shell',
        'am',
        'start',
        '-n',
        'com.android.chrome/com.google.android.apps.chrome.Main',
        '-a',
        'android.intent.action.VIEW',
        '-d',
        shellSafeUrl
    ]);
    await sleep(waitMs);
}

async function connectToTab(pathname) {
    const tabs = await getJson(CDP_URL);
    const tab = tabs.find(item => item.url && item.url.includes(pathname) && item.url.includes(tournamentId))
        || tabs.find(item => item.url && item.url.includes(pathname))
        || tabs.find(item => item.type === 'page');
    if (!tab) throw new Error(`No Android Chrome tab found for ${pathname}`);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();

    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
        }
    };

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    const send = (method, params = {}) => new Promise(resolve => {
        const callId = ++id;
        pending.set(callId, resolve);
        ws.send(JSON.stringify({ id: callId, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    return { ws, send };
}

async function evaluate(pathname, functionDeclaration) {
    const { ws, send } = await connectToTab(pathname);
    const result = await send('Runtime.evaluate', {
        expression: `(${functionDeclaration})()`,
        awaitPromise: true,
        returnByValue: true
    });
    ws.close();
    if (result?.result?.exceptionDetails) {
        throw new Error(result.result.exceptionDetails.text || JSON.stringify(result.result.exceptionDetails));
    }
    return result?.result?.result?.value;
}

async function waitFor(pathname, functionDeclaration, timeoutMs = 45000, intervalMs = 750) {
    const started = Date.now();
    let lastResult = null;
    while (Date.now() - started < timeoutMs) {
        try {
            lastResult = await evaluate(pathname, functionDeclaration);
            if (lastResult?.ready) return lastResult;
        } catch (error) {
            lastResult = { error: error.message };
        }
        await sleep(intervalMs);
    }
    throw new Error(`Timed out waiting for ${pathname}: ${JSON.stringify(lastResult)}`);
}

async function screenshot(pathname) {
    const { ws, send } = await connectToTab(pathname);
    const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    ws.close();
    return result?.result?.data || null;
}

async function closeDisposableAndroidTabs() {
    await ensureCdpForward();
    const tabs = await getJson(CDP_URL).catch(() => []);
    const disposable = tabs.filter(tab => {
        const url = tab.url || '';
        return url.includes('qa-wing-it-android')
            || url.includes('android-open-test')
            || url.includes('/pages/tournament-register-vnext.html?tournament_id=qa-wing-it')
            || url.includes('/pages/tournament-runtime-vnext.html?tournament_id=qa-wing-it')
            || url.includes('/pages/tournament-bracket.html?tournament_id=qa-wing-it');
    });
    for (const tab of disposable) {
        await getText(`${CDP_URL}/close/${encodeURIComponent(tab.id)}`).catch(() => null);
    }
    if (disposable.length) await sleep(1000);
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
        tournament_name: 'Android QA Wing It Wednesdays Blind Draw',
        name: 'Android QA Wing It Wednesdays Blind Draw',
        tournament_date: '2026-05-27',
        date: '2026-05-27',
        start_date: '2026-05-27',
        tournament_time: '19:00',
        start_time: '19:00',
        timezone: 'America/New_York',
        location_mode: 'specific',
        venue_name: 'BRDC / Burning River Darts',
        tournament_details: 'Disposable Android QA test for blind draw setup.',
        description: 'Disposable Android QA test for blind draw setup.',
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

async function registerPlayer(player) {
    let loaded = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        const url = `${BASE_URL}/pages/tournament-register-vnext.html?tournament_id=${tournamentId}&qa=${Date.now()}-${attempt}`;
        await openAndroidUrl(url, 6500);
        try {
            loaded = await waitFor('/pages/tournament-register-vnext.html', `async () => ({
                ready: !!document.querySelector('[data-event-id="${eventId}"]') && !!document.querySelector('#registerBtn'),
                title: document.querySelector('h1')?.innerText || '',
                body: document.body.innerText.slice(0, 300)
            })`, 30000);
            break;
        } catch (error) {
            lastError = error;
        }
    }
    if (!loaded?.ready) throw lastError || new Error('Registration page did not hydrate');

    return evaluate('/pages/tournament-register-vnext.html', `async () => {
        const setInput = (selector, value) => {
            const input = document.querySelector(selector);
            if (!input) throw new Error('Missing input ' + selector);
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setInput('#fullName', ${JSON.stringify(player.name)});
        setInput('#email', ${JSON.stringify(player.email)});
        setInput('#phone', ${JSON.stringify(player.phone)});

        const eventButton = document.querySelector('[data-event-id="${eventId}"]');
        if (!eventButton) throw new Error('Missing event button');
        eventButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));

        const button = document.querySelector('#registerBtn');
        if (!button) throw new Error('Missing register button');
        if (button.disabled) throw new Error('Register button is disabled after filling form');
        button.click();

        const started = Date.now();
        while (Date.now() - started < 30000) {
            const result = document.querySelector('#registerResult');
            const text = result?.innerText || '';
            if (text.includes('Registration saved')) {
                return { success: true, text, player: ${JSON.stringify(player.name)} };
            }
            if (result && !result.hidden && /failed|required|error/i.test(text)) {
                throw new Error(text);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        throw new Error('Timed out waiting for registration success');
    }`);
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
        '--seed', 'android-qa',
        '--commit',
        '--generate-bracket'
    ];
    const { stdout, stderr } = await execFileAsync('node', args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
    if (stderr.trim()) console.error(stderr);
    return stdout;
}

async function verifyAndroidPages() {
    await openAndroidUrl(`${BASE_URL}/pages/tournament-runtime-vnext.html?tournament_id=${tournamentId}&qa=${Date.now()}`, 6500);
    const runtime = await waitFor('/pages/tournament-runtime-vnext.html', `async () => ({
        ready: document.body.innerText.includes('Android QA Wing It Wednesdays Blind Draw') && document.body.innerText.includes('Open bracket'),
        h1: document.querySelector('h1')?.innerText || '',
        body: document.body.innerText.slice(0, 1000)
    })`, 45000);

    await openAndroidUrl(`${BASE_URL}/pages/tournament-bracket.html?tournament_id=${tournamentId}&qa=${Date.now()}`, 8000);
    const bracket = await waitFor('/pages/tournament-bracket.html', `async () => ({
        ready: document.body.innerText.includes('Round 1') && document.body.innerText.includes('Android QA Wing'),
        h1: document.querySelector('h1, #tournamentName')?.innerText || '',
        body: document.body.innerText.slice(0, 1500),
        round1: document.body.innerText.includes('Round 1'),
        teamText: [...document.querySelectorAll('.event-detail-value')].map(el => el.innerText).filter(text => text.includes('Android QA Wing')).slice(0, 10)
    })`, 60000);

    await openAndroidUrl(`${BASE_URL}/pages/scorer-setup-vnext.html?tournament_id=${tournamentId}&event_id=${eventId}&source=tournament_runtime_vnext&format=corks_choice&game_type=corks_choice&best_of=3&sets=1&qa=${Date.now()}`, 6500);
    const scorerSetup = await waitFor('/pages/scorer-setup-vnext.html', `async () => {
        const launchUrl = window.__BRDC_SCORER_VNEXT__?.buildLaunchUrl?.() || '';
        return {
            ready: launchUrl.includes('/pages/x01-scorer-vnext.html') && launchUrl.includes('game_type=choice') && launchUrl.includes('legs_to_win=2'),
            h1: document.querySelector('h1')?.innerText || '',
            activeFormat: document.querySelector('[data-format].active')?.dataset?.format || '',
            legsToWin: document.querySelector('#raceTo')?.value || '',
            launchUrl
        };
    }`, 45000);

    return { runtime, bracket, scorerSetup };
}

async function main() {
    await ensureCdpForward();
    await closeDisposableAndroidTabs();
    await createTournament();

    try {
        const registrationResults = [];
        for (const player of players) {
            registrationResults.push(await registerPlayer(player));
            console.log(`Registered ${registrationResults.length}/12: ${player.name}`);
        }

        const beforeDraw = await readCounts();
        assert(beforeDraw.registrations === 12, `Expected 12 registrations, found ${beforeDraw.registrations}`);
        assert(Number(beforeDraw.tournament.registered_count) === 12, `Expected tournament registered_count 12, found ${beforeDraw.tournament.registered_count}`);
        assert(Number(beforeDraw.event.registered_count) === 12, `Expected event registered_count 12, found ${beforeDraw.event.registered_count}`);

        const drawOutput = await runDrawScript();
        const afterDraw = await readCounts();
        const teamsSnap = await db.collection('tournaments').doc(tournamentId).collection('draw_teams').get();
        assert(teamsSnap.size === 6, `Expected 6 draw teams, found ${teamsSnap.size}`);
        assert(afterDraw.tournament.bracketGenerated === true, 'Bracket was not marked generated');
        assert(afterDraw.tournament.bracket?.matches?.length === 7, `Expected 7 bracket matches, found ${afterDraw.tournament.bracket?.matches?.length}`);
        const firstRound = afterDraw.tournament.bracket.matches.filter(match => match.round === 1);
        const completedByes = firstRound.filter(match => match.status === 'completed' && match.winner);
        const pendingRoundOne = firstRound.filter(match => match.status === 'pending');
        assert(completedByes.length === 2, `Expected 2 completed bye matches, found ${completedByes.length}`);
        assert(pendingRoundOne.length === 2, `Expected 2 pending round-one matches, found ${pendingRoundOne.length}`);
        const semiFinals = afterDraw.tournament.bracket.matches.filter(match => match.round === 2);
        assert(semiFinals.some(match => match.player1 || match.player2), 'Expected bye winners to be placed into semifinals');

        const pages = await verifyAndroidPages();
        console.log(JSON.stringify({
            success: true,
            tournamentId,
            registered: beforeDraw.registrations,
            teams: teamsSnap.size,
            bracketMatches: afterDraw.tournament.bracket.matches.length,
            bracketSize: afterDraw.tournament.bracket.bracketSize,
            rounds: afterDraw.tournament.bracket.totalRounds,
            drawOutput: JSON.parse(drawOutput.slice(drawOutput.indexOf('{'), drawOutput.lastIndexOf('}') + 1)),
            androidPageChecks: {
                runtimeH1: pages.runtime.h1,
                bracketH1: pages.bracket.h1,
                bracketHasRound1: pages.bracket.round1,
                visibleTeams: pages.bracket.teamText.length,
                scorerSetupH1: pages.scorerSetup.h1,
                scorerSetupFormat: pages.scorerSetup.activeFormat,
                scorerSetupLegsToWin: pages.scorerSetup.legsToWin,
                scorerLaunchUrl: pages.scorerSetup.launchUrl
            }
        }, null, 2));
    } finally {
        await cleanup();
        await closeDisposableAndroidTabs();
    }
}

main().catch(error => {
    console.error(error.stack || error.message || error);
    cleanup().finally(() => process.exit(1));
});
