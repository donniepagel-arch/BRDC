import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ADB = process.env.ADB || 'C:\\Users\\gcfrp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const CDP_URL = 'http://127.0.0.1:9222/json';

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, response => {
            let data = '';
            response.on('data', chunk => { data += chunk; });
            response.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function ensureCdpForward() {
    await execFileAsync(ADB, ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote']);
}

async function openAndroidUrl(url, waitMs = 16000) {
    const shellSafeUrl = url.replaceAll('&', '\\&');
    await execFileAsync(ADB, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', shellSafeUrl]);
    await new Promise(resolve => setTimeout(resolve, waitMs));
}

async function connectToTab(pathname) {
    const tabs = await getJson(CDP_URL);
    const tab = tabs.find(item => item.url && item.url.includes(pathname));
    if (!tab) throw new Error(`No Chrome tab found for ${pathname}`);

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
    return { ws, send };
}

async function evaluate(pathname, functionDeclaration) {
    const { ws, send } = await connectToTab(pathname);
    const result = await send('Runtime.callFunctionOn', {
        functionDeclaration,
        executionContextId: 1,
        awaitPromise: true,
        returnByValue: true
    });
    ws.close();
    if (result.result.exceptionDetails) {
        throw new Error(result.result.exceptionDetails.text || 'Runtime evaluation failed');
    }
    return result.result.result.value;
}

async function waitFor(pathname, functionDeclaration, timeoutMs = 45000, intervalMs = 1000) {
    const started = Date.now();
    let lastResult;
    while (Date.now() - started < timeoutMs) {
        lastResult = await evaluate(pathname, functionDeclaration);
        if (lastResult?.ready) return lastResult;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Timed out waiting for ${pathname}: ${JSON.stringify(lastResult)}`);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function auditHomeVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/home-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/home-vnext.html', `async () => {
        const identity = document.querySelector('#identity3da')?.innerText + '/' + document.querySelector('#identityMpr')?.innerText;
        const match = document.querySelector('#matchNightCard')?.innerText || '';
        return {
            ready: !identity.includes('-/-') && match.includes('2026 Triples League'),
            identity,
            match: match.slice(0, 180)
        };
    }`);
    const result = await evaluate('/pages/home-vnext.html', `async () => {
        const panes = [];
        for (const name of ['league-standings','league-schedule','league-chat','community-chat','community-play','community-feed','events-tournaments','events-rooms']) {
            document.querySelector('[data-view-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-view-pane="' + name + '"]');
            panes.push({
                name,
                active: !!pane?.classList.contains('active'),
                chars: (pane?.innerText || '').trim().length,
                badText: /NaN|undefined|null/.test(pane?.innerText || '')
            });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('home-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('home-vnext.css')).map(entry => entry.name),
            identity: document.querySelector('#identity3da')?.innerText + '/' + document.querySelector('#identityMpr')?.innerText,
            match: document.querySelector('#matchNightCard')?.innerText || '',
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);

    assert(result.script.some(src => src.includes('home-vnext.js?v=')), 'home-vnext script cache version missing');
    assert(!result.badText, 'home-vnext contains NaN/undefined/null');
    assert(!result.identity.includes('-/-'), 'home-vnext identity stats did not populate');
    assert(result.match.includes('2026 Triples League'), 'home-vnext match night card did not populate');
    result.panes.forEach(pane => {
        assert(pane.active, `home-vnext pane did not activate: ${pane.name}`);
        assert(pane.chars > 0, `home-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `home-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditTriplesVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/triples-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/triples-vnext.html', `async () => {
        const snapshot = document.querySelector('#leagueSnapshot')?.innerText || '';
        return {
            ready: snapshot.includes('84 completed'),
            snapshot
        };
    }`);
    const result = await evaluate('/pages/triples-vnext.html', `async () => {
        const panes = [];
        for (const name of ['standings','schedule','stats','teams','fillins','chat']) {
            document.querySelector('[data-view-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-view-pane="' + name + '"]');
            panes.push({
                name,
                text: (pane?.innerText || '').slice(0, 900),
                active: !!pane?.classList.contains('active'),
                badText: /NaN|undefined|null/.test(pane?.innerText || '')
            });
        }
        document.querySelector('[data-view-target="fillins"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector('#openFillinSignupBtn')?.click();
        await new Promise(resolve => setTimeout(resolve, 250));
        const fillinModal = document.querySelector('#fillinSignupModal');
        const fillinSignup = {
            active: !!fillinModal?.classList.contains('active'),
            text: fillinModal?.innerText || '',
            hasName: !!document.querySelector('#fillinName'),
            hasEmail: !!document.querySelector('#fillinEmail'),
            hasPhone: !!document.querySelector('#fillinPhone'),
            hasLevel: !!document.querySelector('#fillinLevel')
        };
        document.querySelector('#closeFillinSignupBtn')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector('[data-view-target="schedule"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('triples-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('triples-vnext.css')).map(entry => entry.name),
            snapshot: document.querySelector('#leagueSnapshot')?.innerText || '',
            schedule: document.querySelector('[data-view-pane="schedule"]')?.innerText || '',
            fillinSignup,
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);

    assert(result.script.some(src => src.includes('triples-vnext.js?v=9')), 'triples-vnext script cache version is not v9');
    assert(result.css.some(src => src.includes('triples-vnext.css?v=5')), 'triples-vnext css cache version is not v8');
    assert(!result.badText, 'triples-vnext contains NaN/undefined/null');
    assert(result.snapshot.includes('84 completed'), 'triples-vnext snapshot did not populate');
    assert(result.schedule.includes('Wed, May 13') || result.schedule.includes('Wed, May 20'), 'triples-vnext schedule date is wrong or missing');
    const paneText = Object.fromEntries(result.panes.map(pane => [pane.name, pane.text]));
    assert(paneText.standings.includes('Cle Pagel Co.') && paneText.standings.includes('N. Mezlak'), 'triples-vnext standings missing expected teams');
    assert(paneText.schedule.includes('Week') && paneText.schedule.includes('vs'), 'triples-vnext schedule missing week/match rows');
    assert(/3DA|MPR|501/i.test(paneText.stats), 'triples-vnext stats pane missing stat labels');
    assert(/A|B|C/.test(paneText.teams), 'triples-vnext teams pane missing roster levels');
    assert(/Fill|F/.test(paneText.fillins), 'triples-vnext fill-ins pane missing fill-in data');
    assert(result.fillinSignup.active, 'triples-vnext fill-in signup modal did not open');
    assert(result.fillinSignup.hasName && result.fillinSignup.hasEmail && result.fillinSignup.hasPhone && result.fillinSignup.hasLevel, 'triples-vnext fill-in signup fields missing');
    assert(!/pin/i.test(result.fillinSignup.text), 'triples-vnext fill-in signup contains PIN language');
    result.panes.forEach(pane => {
        assert(pane.active, `triples-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `triples-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `triples-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditTeamVNext(cacheBust, teamId, expectedText) {
    await openAndroidUrl(`${BASE_URL}/pages/league-team-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&team_id=${teamId}&qa=${cacheBust}`, 8000);
    await waitFor('/pages/league-team-vnext.html', `async () => {
        const hero = document.querySelector('#teamHero')?.innerText || '';
        return {
            ready: hero.includes('${expectedText.replaceAll("'", "\\'")}'),
            hero
        };
    }`);
    const result = await evaluate('/pages/league-team-vnext.html', `async () => {
        const panes = [];
        for (const name of ['overview','matches','players','chat']) {
            document.querySelector('[data-view-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-view-pane="' + name + '"]');
            panes.push({ name, text: (pane?.innerText || '').slice(0, 900), active: !!pane?.classList.contains('active'), badText: /NaN|undefined|null/.test(pane?.innerText || '') });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('league-team-vnext.js')).map(entry => entry.name),
            hero: document.querySelector('#teamHero')?.innerText || '',
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|league-team\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('league-team-vnext.js?v=6')), 'league-team-vnext script cache version is not v6');
    assert(result.hero.includes(expectedText), `league-team-vnext hero missing ${expectedText}`);
    assert(!result.badText, 'league-team-vnext contains NaN/undefined/null');
    assert(result.classicLinks.length === 0, `league-team-vnext still links to classic team page: ${result.classicLinks.join(', ')}`);
    result.panes.forEach(pane => {
        assert(pane.active, `league-team-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `league-team-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `league-team-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditPlayerVNext(cacheBust, playerId, expectedText) {
    await openAndroidUrl(`${BASE_URL}/pages/player-profile-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&player_id=${playerId}&qa=${cacheBust}`, 8000);
    await waitFor('/pages/player-profile-vnext.html', `async () => {
        const hero = document.querySelector('#profileHero')?.innerText || '';
        return {
            ready: hero.includes('${expectedText.replaceAll("'", "\\'")}'),
            hero
        };
    }`);
    const result = await evaluate('/pages/player-profile-vnext.html', `async () => {
        const panes = [];
        for (const name of ['stats','matches','awards','profile']) {
            document.querySelector('[data-view-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-view-pane="' + name + '"]');
            panes.push({ name, text: (pane?.innerText || '').slice(0, 1200), active: !!pane?.classList.contains('active'), badText: /NaN|undefined|null/.test(pane?.innerText || '') });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('player-profile-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('player-profile-vnext.css')).map(entry => entry.name),
            hero: document.querySelector('#profileHero')?.innerText || '',
            ownSettings: !!document.querySelector('#profileSettingsForm'),
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|player-profile\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('player-profile-vnext.js?v=4')), 'player-profile-vnext script cache version is not v4');
    assert(result.css.some(src => src.includes('player-profile-vnext.css?v=3')), 'player-profile-vnext css cache version is not v8');
    assert(result.hero.includes(expectedText), `player-profile-vnext hero missing ${expectedText}`);
    if (expectedText === 'Donnie Pagel') {
        assert(result.ownSettings, 'player-profile-vnext own-profile settings form missing');
    }
    assert(!result.badText, 'player-profile-vnext contains NaN/undefined/null');
    assert(result.classicLinks.length === 0, `player-profile-vnext still links to classic profile: ${result.classicLinks.join(', ')}`);
    result.panes.forEach(pane => {
        assert(pane.active, `player-profile-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `player-profile-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `player-profile-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditMessagesVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/messages-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/messages-vnext.html', `async () => {
        const signedIn = document.querySelector('#authStatus')?.innerText.includes('Signed in');
        const direct = document.querySelector('#directCount')?.innerText || '-';
        const rooms = document.querySelector('#roomCount')?.innerText || '-';
        return {
            ready: signedIn && direct !== '-' && rooms !== '-',
            direct,
            rooms
        };
    }`);
    const result = await evaluate('/pages/messages-vnext.html', `async () => {
        const first = document.querySelector('#directList .mv-thread') || document.querySelector('#roomList .mv-thread');
        first?.click();
        for (let i = 0; i < 20; i++) {
            const text = document.querySelector('#messageList')?.innerText || '';
            if (text && text !== 'Loading...') break;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        document.querySelector('#challengeThreadBtn')?.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        const modalActive = document.querySelector('#challengeModal')?.classList.contains('active');
        document.querySelector('#closeChallengeBtn')?.click();
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('messages-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('messages-vnext.css')).map(entry => entry.name),
            authStatus: document.querySelector('#authStatus')?.innerText || '',
            direct: document.querySelector('#directCount')?.innerText || '',
            rooms: document.querySelector('#roomCount')?.innerText || '',
            challenges: document.querySelector('#challengeCount')?.innerText || '',
            online: document.querySelector('#onlineCount')?.innerText || '',
            active: document.querySelector('#activeThreadName')?.innerText || '',
            messages: document.querySelector('#messageList')?.innerText || '',
            inputDisabled: document.querySelector('#messageInput')?.disabled,
            challengeDisabled: document.querySelector('#challengeThreadBtn')?.disabled,
            modalActive,
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|conversation\\.html|chat-room\\.html|messages\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);

    assert(result.script.some(src => src.includes('messages-vnext.js?v=3')), 'messages-vnext script cache version is not v3');
    assert(result.css.some(src => src.includes('messages-vnext.css?v=2')), 'messages-vnext css cache version is not v8');
    assert(result.classicLinks.length === 0, `messages-vnext still links to classic chat: ${result.classicLinks.join(', ')}`);
    assert(result.authStatus.includes('Signed in'), 'messages-vnext did not authenticate');
    assert(!result.badText, 'messages-vnext contains NaN/undefined/null');
    assert(result.messages.trim().length > 0 && result.messages !== 'Loading...', 'messages-vnext did not load selected thread messages');
    assert(!result.inputDisabled, 'messages-vnext composer stayed disabled after selecting a thread');
    assert(!result.challengeDisabled, 'messages-vnext challenge button stayed disabled for direct thread');
    assert(result.modalActive, 'messages-vnext challenge modal did not open');
    return result;
}

async function auditCaptainVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/captain-dashboard-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/captain-dashboard-vnext.html', `async () => {
        const team = document.querySelector('#teamName')?.innerText || '';
        const match = document.querySelector('#matchNightCard')?.innerText || '';
        return {
            ready: !team.includes('Loading') && match.toLowerCase().includes('week'),
            team,
            match: match.slice(0, 200)
        };
    }`);
    const result = await evaluate('/pages/captain-dashboard-vnext.html', `async () => {
        document.querySelector('#openFillinBtn')?.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        const modalActive = document.querySelector('#fillinModal')?.classList.contains('active');
        document.querySelector('#closeFillinBtn')?.click();
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('captain-dashboard-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('captain-dashboard-vnext.css')).map(entry => entry.name),
            team: document.querySelector('#teamName')?.innerText || '',
            status: document.querySelector('#captainStatus')?.innerText || '',
            match: document.querySelector('#matchNightCard')?.innerText || '',
            roster: document.querySelector('#rosterList')?.innerText || '',
            subs: document.querySelector('#subsList')?.innerText || '',
            schedule: document.querySelector('#scheduleList')?.innerText || '',
            requests: document.querySelector('#requestsList')?.innerText || '',
            profile: document.querySelector('.cv-profile-card')?.innerText || '',
            modalActive,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);

    assert(result.script.some(src => src.includes('captain-dashboard-vnext.js?v=5')), 'captain-dashboard-vnext script cache version is not v5');
    assert(result.css.some(src => src.includes('captain-dashboard-vnext.css?v=3')), 'captain-dashboard-vnext css cache version is not v8');
    assert(!result.badText, 'captain-dashboard-vnext contains NaN/undefined/null');
    assert(!/Classic/i.test([result.match, result.schedule, result.profile].join(' ')), 'captain-dashboard-vnext still exposes generic classic wording');
    assert(result.team.trim().length > 0 && !result.team.includes('Loading'), 'captain-dashboard-vnext team did not populate');
    assert(result.match.toLowerCase().includes('week'), 'captain-dashboard-vnext match card did not populate');
    assert(result.roster.trim().length > 0, 'captain-dashboard-vnext roster did not populate');
    assert(result.subs.trim().length > 0, 'captain-dashboard-vnext fill-ins did not populate');
    assert(result.schedule.trim().length > 0, 'captain-dashboard-vnext schedule did not populate');
    assert(/TEAM PROFILE/i.test(result.profile) && /TEAM NAME/i.test(result.profile), 'captain-dashboard-vnext team profile editor missing');
    assert(result.modalActive, 'captain-dashboard-vnext fill-in modal did not open');
    return result;
}

async function auditTraderVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/dart-trader-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/dart-trader-vnext.html', `async () => {
        const status = document.querySelector('#traderStatus')?.innerText || '';
        const grid = document.querySelector('#listingGrid')?.innerText || '';
        return { ready: !status.includes('Loading') && grid.trim().length > 0, status, grid: grid.slice(0, 200) };
    }`);
    const result = await evaluate('/pages/dart-trader-vnext.html', `async () => ({
        script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('dart-trader-vnext.js')).map(entry => entry.name),
        css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
        createHref: document.querySelector('a[href*="dart-trader-create"]')?.href || '',
        listingHrefs: [...document.querySelectorAll('#listingGrid a')].map(link => link.href),
        status: document.querySelector('#traderStatus')?.innerText || '',
        grid: document.querySelector('#listingGrid')?.innerText || '',
        badText: /NaN|undefined|null/.test(document.body.innerText)
    })`);
    assert(result.script.some(src => src.includes('dart-trader-vnext.js?v=3')), 'dart-trader-vnext script cache version is not v3');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'shared vnext css cache version is not v8');
    assert(!result.badText, 'dart-trader-vnext contains NaN/undefined/null');
    assert(result.grid.trim().length > 0, 'dart-trader-vnext grid did not populate');
    assert(result.createHref.includes('/pages/dart-trader-create-vnext.html'), 'dart-trader create link did not stay on vnext');
    result.listingHrefs.forEach(href => assert(href.includes('/pages/dart-trader-listing-vnext.html'), 'dart-trader listing link did not stay on vnext'));
    return result;
}

async function auditTraderCreateVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/dart-trader-create-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/dart-trader-create-vnext.html', `async () => {
        const title = document.querySelector('#pageTitle')?.innerText || '';
        const form = document.querySelector('#listingForm')?.innerText || '';
        return { ready: title.toLowerCase().includes('create') && form.toLowerCase().includes('category'), title, form };
    }`);
    const result = await evaluate('/pages/dart-trader-create-vnext.html', `async () => ({
        script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('dart-trader-create-vnext.js')).map(entry => entry.name),
        css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
        title: document.querySelector('#pageTitle')?.innerText || '',
        form: document.querySelector('#listingForm')?.innerText || '',
        hasFields: ['category','condition','title','price','sellerName'].every(id => !!document.querySelector('#' + id)),
        badText: /NaN|undefined|null|PIN/.test(document.body.innerText)
    })`);
    assert(result.script.some(src => src.includes('dart-trader-create-vnext.js?v=1')), 'dart-trader-create-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'dart-trader-create-vnext css cache version is not v8');
    assert(result.hasFields, 'dart-trader-create-vnext form fields missing');
    assert(!result.badText, 'dart-trader-create-vnext contains bad text');
    return result;
}

async function auditTraderListingVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/dart-trader-listing-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/dart-trader-listing-vnext.html', `async () => {
        const title = document.querySelector('#listingTitle')?.innerText || '';
        const detail = document.querySelector('#listingDetail')?.innerText || '';
        return { ready: title.includes('Listing unavailable') && detail.includes('No listing ID'), title, detail };
    }`);
    const result = await evaluate('/pages/dart-trader-listing-vnext.html', `async () => ({
        script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('dart-trader-listing-vnext.js')).map(entry => entry.name),
        css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
        title: document.querySelector('#listingTitle')?.innerText || '',
        detail: document.querySelector('#listingDetail')?.innerText || '',
        badText: /NaN|undefined|null|PIN/.test(document.body.innerText)
    })`);
    assert(result.script.some(src => src.includes('dart-trader-listing-vnext.js?v=1')), 'dart-trader-listing-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'dart-trader-listing-vnext css cache version is not v8');
    assert(result.detail.includes('No listing ID'), 'dart-trader-listing-vnext empty state did not render');
    assert(!result.badText, 'dart-trader-listing-vnext contains bad text');
    return result;
}

async function auditEventsVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/events-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/events-vnext.html', `async () => {
        const status = document.querySelector('#eventsStatus')?.innerText || '';
        const grid = document.querySelector('#eventGrid')?.innerText || '';
        return { ready: !status.includes('Loading') && grid.trim().length > 0, status, grid: grid.slice(0, 200) };
    }`);
    const result = await evaluate('/pages/events-vnext.html', `async () => ({
        script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('events-vnext.js')).map(entry => entry.name),
        css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
        status: document.querySelector('#eventsStatus')?.innerText || '',
        grid: document.querySelector('#eventGrid')?.innerText || '',
        firstTournamentHref: [...document.querySelectorAll('#eventGrid a')]
            .map(link => link.href)
            .find(href => href.includes('/pages/tournament-view-vnext.html')) || '',
        classicLinks: [...document.querySelectorAll('a')]
            .filter(link => /classic|events-hub\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
            .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
        badText: /NaN|undefined|null/.test(document.body.innerText)
    })`);
    assert(result.script.some(src => src.includes('events-vnext.js?v=3')), 'events-vnext script cache version is not v3');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'events-vnext css cache version is not v8');
    assert(!result.badText, 'events-vnext contains NaN/undefined/null');
    assert(result.classicLinks.length === 0, `events-vnext still links to classic events: ${result.classicLinks.join(', ')}`);
    assert(result.grid.trim().length > 0, 'events-vnext grid did not populate');
    return result;
}

async function auditTournamentViewVNext(cacheBust, tournamentHref) {
    assert(tournamentHref, 'events-vnext did not expose a tournament vnext link');
    const url = new URL(tournamentHref);
    url.searchParams.set('qa', cacheBust);
    await openAndroidUrl(url.toString(), 8000);
    await waitFor('/pages/tournament-view-vnext.html', `async () => {
        const title = document.querySelector('#tournamentTitle')?.innerText || '';
        const status = document.querySelector('#tournamentStatus')?.innerText || '';
        const overview = document.querySelector('#overviewPane')?.innerText || '';
        return { ready: !status.includes('Loading') && overview.trim().length > 0, title, status, overview };
    }`);
    const result = await evaluate('/pages/tournament-view-vnext.html', `async () => {
        const panes = [];
        for (const name of ['overview','events','registrations','rooms']) {
            document.querySelector('[data-tv-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-tv-pane="' + name + '"]');
            panes.push({
                name,
                text: pane?.innerText || '',
                active: !!pane?.classList.contains('active'),
                badText: /NaN|undefined|null/.test(pane?.innerText || '')
            });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('tournament-view-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            title: document.querySelector('#tournamentTitle')?.innerText || '',
            meta: document.querySelector('#tournamentMeta')?.innerText || '',
            registerHref: document.querySelector('#registerLink')?.href || '',
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|tournament-view\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('tournament-view-vnext.js?v=3')), 'tournament-view-vnext script cache version is not v3');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'tournament-view-vnext css cache version is not v8');
    assert(result.title.trim().length > 0, 'tournament-view-vnext title did not populate');
    assert(result.registerHref.includes('/pages/tournament-register-vnext.html'), 'tournament-view-vnext register link did not stay on vnext');
    assert(result.classicLinks.length === 0, `tournament-view-vnext still links to classic tournament page: ${result.classicLinks.join(', ')}`);
    assert(!result.badText, 'tournament-view-vnext contains NaN/undefined/null');
    result.panes.forEach(pane => {
        assert(pane.active, `tournament-view-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `tournament-view-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `tournament-view-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditTournamentRegisterVNext(cacheBust, tournamentHref) {
    assert(tournamentHref, 'missing tournament href for registration audit');
    const inputUrl = new URL(tournamentHref);
    const tournamentId = inputUrl.searchParams.get('tournament_id') || inputUrl.searchParams.get('id');
    assert(tournamentId, 'missing tournament id for registration audit');
    await openAndroidUrl(`${BASE_URL}/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}&qa=${cacheBust}`, 8000);
    await waitFor('/pages/tournament-register-vnext.html', `async () => {
        const title = document.querySelector('#registerTitle')?.innerText || '';
        const events = document.querySelector('#eventOptions')?.innerText || '';
        return { ready: events.trim().length > 0, title, events };
    }`);
    const result = await evaluate('/pages/tournament-register-vnext.html', `async () => {
        const firstEvent = document.querySelector('.trv-event-option');
        firstEvent?.click();
        await new Promise(resolve => setTimeout(resolve, 150));
        const otherMode = document.querySelector('[data-register-mode="other"]');
        otherMode?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const selfMode = document.querySelector('[data-register-mode="self"]');
        selfMode?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('tournament-register-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            title: document.querySelector('#registerTitle')?.innerText || '',
            events: document.querySelector('#eventOptions')?.innerText || '',
            selected: document.querySelectorAll('.trv-event-option.selected').length,
            submitDisabled: document.querySelector('#registerBtn')?.disabled,
            modeText: document.querySelector('.trv-mode-row')?.innerText || '',
            badText: /NaN|undefined|null|PIN/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('tournament-register-vnext.js?v=1')), 'tournament-register-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'tournament-register-vnext css cache version is not v8');
    assert(result.title.trim().length > 0, 'tournament-register-vnext title did not populate');
    assert(result.events.trim().length > 0, 'tournament-register-vnext event options did not populate');
    assert(result.modeText.includes('Register myself') && result.modeText.includes('Register someone else'), 'tournament-register-vnext mode controls missing');
    assert(result.selected > 0, 'tournament-register-vnext event card did not select');
    assert(!result.badText, 'tournament-register-vnext contains bad text');
    return result;
}

async function auditTournamentRuntimeVNext(cacheBust, tournamentHref) {
    assert(tournamentHref, 'missing tournament href for runtime audit');
    const inputUrl = new URL(tournamentHref);
    const tournamentId = inputUrl.searchParams.get('tournament_id') || inputUrl.searchParams.get('id');
    assert(tournamentId, 'missing tournament id for runtime audit');
    await openAndroidUrl(`${BASE_URL}/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}&qa=${cacheBust}`, 8000);
    await waitFor('/pages/tournament-runtime-vnext.html', `async () => {
        const title = document.querySelector('#runtimeTitle')?.innerText || '';
        const grid = document.querySelector('#runtimeGrid')?.innerText || '';
        return { ready: !title.includes('Runtime') && grid.trim().length > 0, title, grid };
    }`);
    const result = await evaluate('/pages/tournament-runtime-vnext.html', `async () => ({
        script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('tournament-runtime-vnext.js')).map(entry => entry.name),
        css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
        title: document.querySelector('#runtimeTitle')?.innerText || '',
        grid: document.querySelector('#runtimeGrid')?.innerText || '',
        scorerHref: [...document.querySelectorAll('#runtimeGrid a')].map(link => link.href).find(href => href.includes('/pages/scorer-setup-vnext.html')) || '',
        classicLinks: [...document.querySelectorAll('a')]
            .filter(link => /classic|tournament-runtime\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
            .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
        badText: /NaN|undefined|null|safe preview|read-only in preview/i.test(document.body.innerText)
    })`);
    assert(result.script.some(src => src.includes('tournament-runtime-vnext.js?v=4')), 'tournament-runtime-vnext script cache version is not v4');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'tournament-runtime-vnext css cache version is not v8');
    assert(result.title.trim().length > 0, 'tournament-runtime-vnext title did not populate');
    assert(result.grid.trim().length > 0, 'tournament-runtime-vnext grid did not populate');
    assert(result.scorerHref.includes('/pages/scorer-setup-vnext.html'), 'tournament-runtime-vnext scorer setup link missing');
    assert(result.classicLinks.length === 0, `tournament-runtime-vnext still links to classic runtime: ${result.classicLinks.join(', ')}`);
    assert(!result.badText, 'tournament-runtime-vnext contains NaN/undefined/null');
    return result;
}

async function auditCreateTournamentVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/create-tournament-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/create-tournament-vnext.html', `async () => {
        const status = document.querySelector('#createStatus')?.innerText || '';
        const form = document.querySelector('#createTournamentForm')?.innerText || '';
        return { ready: !status.includes('Tournament builder') || form.includes('Runtime'), status, form };
    }`);
    const result = await evaluate('/pages/create-tournament-vnext.html', `async () => {
        document.querySelector('[data-location="flexible"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector('[data-location="specific"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        document.querySelector('[data-location="online"]')?.click();
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('create-tournament-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            status: document.querySelector('#createStatus')?.innerText || '',
            form: document.querySelector('#createTournamentForm')?.innerText || '',
            locationMode: document.querySelector('#locationMode')?.value || '',
            submitDisabled: document.querySelector('#createTournamentBtn')?.disabled || false,
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|create-tournament\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('create-tournament-vnext.js?v=2')), 'create-tournament-vnext script cache version is not v2');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'create-tournament-vnext css cache version is not v8');
    assert(result.form.includes('Runtime'), 'create-tournament-vnext runtime options missing');
    assert(result.locationMode === 'online', 'create-tournament-vnext location toggle failed');
    assert(result.classicLinks.length === 0, `create-tournament-vnext still links to classic builder: ${result.classicLinks.join(', ')}`);
    assert(!result.badText, 'create-tournament-vnext contains NaN/undefined/null');
    return result;
}

async function auditScorerSetupVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/scorer-setup-vnext.html?qa=${cacheBust}`, 8000);
    const result = await evaluate('/pages/scorer-setup-vnext.html', `async () => {
        document.querySelector('[data-format="cricket"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const cricketUrl = window.__BRDC_SCORER_VNEXT__?.buildLaunchUrl?.() || '';
        document.querySelector('[data-format="corks_choice"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const choiceUrl = window.__BRDC_SCORER_VNEXT__?.buildLaunchUrl?.() || '';
        document.querySelector('[data-format="501"]')?.click();
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('scorer-setup-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            title: document.body.innerText.slice(0, 300),
            activeFormat: document.querySelector('[data-format].active')?.dataset.format || '',
            launchText: document.querySelector('#launchScorerBtn')?.innerText || '',
            cricketUrl,
            choiceUrl,
            badText: /NaN|undefined|null|PIN/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('scorer-setup-vnext.js?v=3')), 'scorer-setup-vnext script cache version is not v3');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'scorer-setup-vnext css cache version is not v8');
    assert(!result.badText, 'scorer-setup-vnext contains bad text');
    assert(result.title.includes('Scorer Setup'), 'scorer-setup-vnext did not render');
    assert(result.activeFormat === '501', 'scorer-setup-vnext format toggle failed');
    assert(result.launchText.toLowerCase().includes('launch'), 'scorer-setup-vnext launch button missing');
    assert(result.cricketUrl.includes('/pages/league-cricket.html') && result.cricketUrl.includes('game_type=cricket'), 'scorer-setup-vnext cricket launch URL is wrong');
    assert(result.choiceUrl.includes('/pages/x01-scorer.html') && result.choiceUrl.includes('format=choice') && result.choiceUrl.includes('game_type=choice'), 'scorer-setup-vnext choice launch URL is wrong');
    return result;
}

async function auditMatchHubVNext(cacheBust, matchId, expectedText) {
    await openAndroidUrl(`${BASE_URL}/pages/match-hub-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=${matchId}&qa=${cacheBust}`, 8000);
    await waitFor('/pages/match-hub-vnext.html', `async () => {
        const hero = document.querySelector('#matchHero')?.innerText || '';
        return {
            ready: hero.includes('${expectedText.replaceAll("'", "\\'")}'),
            hero
        };
    }`);
    const result = await evaluate('/pages/match-hub-vnext.html', `async () => {
        const panes = [];
        for (const name of ['sets','performance','rosters','context']) {
            document.querySelector('[data-view-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-view-pane="' + name + '"]');
            panes.push({
                name,
                text: (pane?.innerText || '').slice(0, 900),
                active: !!pane?.classList.contains('active'),
                badText: /NaN|undefined|null/.test(pane?.innerText || '')
            });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('match-hub-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('match-hub-vnext.css')).map(entry => entry.name),
            hero: document.querySelector('#matchHero')?.innerText || '',
            score: document.querySelector('#scoreCard')?.innerText || '',
            classicLinks: [...document.querySelectorAll('a')]
                .filter(link => /classic|match-hub\\.html/i.test((link.innerText || '') + ' ' + (link.getAttribute('href') || '')))
                .map(link => (link.innerText || '') + '|' + (link.getAttribute('href') || '')),
            panes,
            badText: /NaN|undefined|null/.test(document.body.innerText)
        };
    }`);

    assert(result.script.some(src => src.includes('match-hub-vnext.js?v=4')), 'match-hub-vnext script cache version is not v4');
    assert(result.css.some(src => src.includes('match-hub-vnext.css?v=2')), 'match-hub-vnext css cache version is not v8');
    assert(!result.badText, `match-hub-vnext ${matchId} contains NaN/undefined/null`);
    assert(result.classicLinks.length === 0, `match-hub-vnext still links to classic report: ${result.classicLinks.join(', ')}`);
    assert(result.hero.includes(expectedText), `match-hub-vnext ${matchId} hero missing ${expectedText}`);
    result.panes.forEach(pane => {
        assert(pane.active, `match-hub-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `match-hub-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `match-hub-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditMembersVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/members-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&qa=${cacheBust}`, 8000);
    await waitFor('/pages/members-vnext.html', `async () => {
        const status = document.querySelector('#membersStatus')?.innerText || '';
        const grid = document.querySelector('#memberGrid')?.innerText || '';
        return { ready: !status.includes('Loading') && grid.trim().length > 0, status, grid: grid.slice(0, 200) };
    }`);
    const result = await evaluate('/pages/members-vnext.html', `async () => {
        document.querySelector('[data-member-filter="F"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 150));
        const fillinText = document.querySelector('#memberGrid')?.innerText || '';
        document.querySelector('[data-member-filter="all"]')?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const search = document.querySelector('#memberSearch');
        if (search) {
            search.value = 'donnie';
            search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise(resolve => setTimeout(resolve, 150));
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('members-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            status: document.querySelector('#membersStatus')?.innerText || '',
            counts: [
                document.querySelector('#memberCount')?.innerText || '',
                document.querySelector('#playerCount')?.innerText || '',
                document.querySelector('#fillinCount')?.innerText || ''
            ].join('/'),
            grid: document.querySelector('#memberGrid')?.innerText || '',
            fillinText,
            badText: /NaN|undefined|null|PIN|Classic/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('members-vnext.js?v=1')), 'members-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'members-vnext css cache version is not v8');
    assert(!result.badText, 'members-vnext contains bad text');
    assert(/Donnie Pagel/i.test(result.grid), 'members-vnext search did not find Donnie Pagel');
    assert(/Fill-in|Vince|F/i.test(result.fillinText), 'members-vnext fill-in filter did not show fill-in data');
    return result;
}

async function auditLeagueDirectorVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/league-director-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&qa=${cacheBust}`, 8000);
    await waitFor('/pages/league-director-vnext.html', `async () => {
        const status = document.querySelector('#directorStatus')?.innerText || '';
        const standings = document.querySelector('#directorStandings')?.innerText || '';
        return { ready: !status.includes('Loading') && standings.trim().length > 0, status, standings: standings.slice(0, 200) };
    }`);
    const result = await evaluate('/pages/league-director-vnext.html', `async () => {
        const panes = [];
        for (const name of ['standings','schedule','teams','players','tools']) {
            document.querySelector('[data-director-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-director-pane="' + name + '"]');
            panes.push({
                name,
                text: pane?.innerText || '',
                active: !!pane?.classList.contains('active'),
                badText: /NaN|undefined|null|PIN|Classic/.test(pane?.innerText || '')
            });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('league-director-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            title: document.querySelector('#directorTitle')?.innerText || '',
            status: document.querySelector('#directorStatus')?.innerText || '',
            counts: [
                document.querySelector('#directorTeams')?.innerText || '',
                document.querySelector('#directorMatches')?.innerText || '',
                document.querySelector('#directorPlayers')?.innerText || ''
            ].join('/'),
            panes,
            badText: /NaN|undefined|null|PIN|Classic/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('league-director-vnext.js?v=1')), 'league-director-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'league-director-vnext css cache version is not v8');
    assert(result.title.trim().length > 0, 'league-director-vnext title did not populate');
    assert(!result.badText, 'league-director-vnext contains bad text');
    result.panes.forEach(pane => {
        assert(pane.active, `league-director-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `league-director-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `league-director-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function auditAdminVNext(cacheBust) {
    await openAndroidUrl(`${BASE_URL}/pages/admin-vnext.html?qa=${cacheBust}`, 8000);
    await waitFor('/pages/admin-vnext.html', `async () => {
        const status = document.querySelector('#adminStatus')?.innerText || '';
        const leagues = document.querySelector('#adminLeagueList')?.innerText || '';
        return { ready: status.toLowerCase().includes('loaded') && leagues.trim().length > 0, status, leagues: leagues.slice(0, 200) };
    }`, 60000);
    const result = await evaluate('/pages/admin-vnext.html', `async () => {
        const panes = [];
        for (const name of ['leagues','tournaments','members','health']) {
            document.querySelector('[data-admin-target="' + name + '"]')?.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const pane = document.querySelector('[data-admin-pane="' + name + '"]');
            panes.push({
                name,
                text: pane?.innerText || '',
                active: !!pane?.classList.contains('active'),
                badText: /NaN|undefined|null|PIN|Classic/.test(pane?.innerText || '')
            });
        }
        return {
            script: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('admin-vnext.js')).map(entry => entry.name),
            css: [...performance.getEntriesByType('resource')].filter(entry => entry.name.includes('market-events-scorer-vnext.css')).map(entry => entry.name),
            status: document.querySelector('#adminStatus')?.innerText || '',
            counts: [
                document.querySelector('#adminLeagues')?.innerText || '',
                document.querySelector('#adminTournaments')?.innerText || '',
                document.querySelector('#adminPlayers')?.innerText || ''
            ].join('/'),
            panes,
            badText: /NaN|undefined|null|PIN|Classic/.test(document.body.innerText)
        };
    }`);
    assert(result.script.some(src => src.includes('admin-vnext.js?v=1')), 'admin-vnext script cache version is not v1');
    assert(result.css.some(src => src.includes('market-events-scorer-vnext.css?v=8')), 'admin-vnext css cache version is not v8');
    assert(result.status.toLowerCase().includes('loaded'), 'admin-vnext did not load admin data');
    assert(!result.badText, 'admin-vnext contains bad text');
    result.panes.forEach(pane => {
        assert(pane.active, `admin-vnext pane did not activate: ${pane.name}`);
        assert(pane.text.trim().length > 0, `admin-vnext pane empty: ${pane.name}`);
        assert(!pane.badText, `admin-vnext pane has bad text: ${pane.name}`);
    });
    return result;
}

async function main() {
    await ensureCdpForward();
    const cacheBust = Date.now();
    const home = await auditHomeVNext(cacheBust);
    const triples = await auditTriplesVNext(cacheBust + 1);
    const completedMatch = await auditMatchHubVNext(cacheBust + 2, '0lxEeuAa7fEDSVeY3uCG', 'E. O vs. D. Partlo');
    const scheduledMatch = await auditMatchHubVNext(cacheBust + 3, 'CPWJV8dfu3qCnKdsg2RZ', 'D. Russano vs. Cle Pagel Co.');
    const team = await auditTeamVNext(cacheBust + 4, 'U5ZEAT55xiNM9Otarafx', 'Cle Pagel Co.');
    const player = await auditPlayerVNext(cacheBust + 5, 'X2DMb9bP4Q8fy9yr5Fam', 'Donnie Pagel');
    const fillin = await auditPlayerVNext(cacheBust + 6, '1NkQgUfa2lvS7v8k1ctY', 'Vince Walker');
    const members = await auditMembersVNext(cacheBust + 7);
    const messages = await auditMessagesVNext(cacheBust + 8);
    const captain = await auditCaptainVNext(cacheBust + 9);
    const director = await auditLeagueDirectorVNext(cacheBust + 10);
    const admin = await auditAdminVNext(cacheBust + 11);
    const trader = await auditTraderVNext(cacheBust + 12);
    const traderCreate = await auditTraderCreateVNext(cacheBust + 13);
    const traderListing = await auditTraderListingVNext(cacheBust + 14);
    const events = await auditEventsVNext(cacheBust + 15);
    const tournament = await auditTournamentViewVNext(cacheBust + 16, events.firstTournamentHref);
    const registration = await auditTournamentRegisterVNext(cacheBust + 17, events.firstTournamentHref);
    const runtime = await auditTournamentRuntimeVNext(cacheBust + 18, events.firstTournamentHref);
    const createTournament = await auditCreateTournamentVNext(cacheBust + 19);
    const scorer = await auditScorerSetupVNext(cacheBust + 20);
    console.log(JSON.stringify({
        ok: true,
        baseUrl: BASE_URL,
        home: {
            identity: home.identity,
            match: home.match.split('\n').slice(0, 4).join(' | '),
            panes: home.panes.map(pane => pane.name)
        },
        triples: {
            snapshot: triples.snapshot.split('\n').slice(0, 5).join(' | '),
            panes: triples.panes.map(pane => pane.name)
        },
        matchHub: {
            completed: completedMatch.score.split('\n').slice(0, 7).join(' | '),
            scheduled: scheduledMatch.score.split('\n').slice(0, 7).join(' | ')
        },
        team: team.hero.split('\n').slice(0, 5).join(' | '),
        profiles: {
            player: player.hero.split('\n').slice(0, 5).join(' | '),
            fillin: fillin.hero.split('\n').slice(0, 5).join(' | ')
        },
        members: {
            counts: members.counts,
            search: members.grid.split('\n').slice(0, 5).join(' | ')
        },
        messages: {
            counts: `${messages.direct} direct / ${messages.rooms} rooms / ${messages.challenges} challenges / ${messages.online} online`,
            active: messages.active,
            preview: messages.messages.split('\n').slice(0, 5).join(' | ')
        },
        captain: {
            team: captain.team,
            match: captain.match.split('\n').slice(0, 6).join(' | '),
            roster: captain.roster.split('\n').slice(0, 6).join(' | ')
        },
        director: {
            title: director.title,
            counts: director.counts,
            panes: director.panes.map(pane => pane.name)
        },
        admin: {
            counts: admin.counts,
            panes: admin.panes.map(pane => pane.name)
        },
        remainingVNext: {
            trader: trader.status,
            traderCreate: traderCreate.title,
            traderListing: traderListing.title,
            events: events.status,
            tournament: tournament.title,
            registration: `${registration.selected} selected`,
            runtime: runtime.title,
            createTournament: createTournament.locationMode,
            scorer: scorer.activeFormat
        }
    }, null, 2));
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
