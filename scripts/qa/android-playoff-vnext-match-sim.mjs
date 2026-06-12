import http from 'node:http';
import https from 'node:https';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADB = process.env.ADB || 'C:\\Users\\gcfrp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const BASE_URL = process.env.BRDC_BASE_URL || 'https://brdc-v2.web.app';
const CDP_URL = 'http://127.0.0.1:9222/json';
const LEAGUE_ID = process.env.LEAGUE_ID || 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = process.env.MATCH_ID || 'playoff_2026_qf_3v6';
const TURN_DELAY_MS = Number(process.env.TURN_DELAY_MS || 5000);
const FAST_UI_DELAY_MS = Number(process.env.FAST_UI_DELAY_MS || 650);
const RESTORE_AT_END = process.env.RESTORE_AT_END !== 'false';
const STOP_FILE = path.join(__dirname, 'android-playoff-vnext-match-sim.stop');
const SNAPSHOT_FILE = path.join(__dirname, 'android-playoff-vnext-match-sim.snapshot.json');

const PLAYER_STRENGTH = {
    'SwnH8GUBmrcdmOAs07Vp': { name: 'John Ragnoni', x01: 54.21, mpr: 2.47 },
    'ZwdiN0qfmIY5MMCOLJps': { name: 'Marc Tate', x01: 47.05, mpr: 2.12 },
    'YHCbJsXKYjFMPk5Wk7kd': { name: 'Anthony Donley', x01: 48.09, mpr: 2.11 },
    'X2DMb9bP4Q8fy9yr5Fam': { name: 'Donnie Pagel', x01: 53.0, mpr: 2.47 },
    'TJ3uwMdslbtpjtq17xW4': { name: 'Matthew Wentz', x01: 45.77, mpr: 1.97 },
    '7Hj4KWNpm0GviTYbwfbM': { name: 'Jennifer Malek', x01: 40.39, mpr: 1.7 }
};

const SET_PLAN = [
    { set: 1, winner: 'home', legs: ['home', 'away', 'home'], note: 'C cricket: Anthony edges Jennifer 2-1' },
    { set: 2, winner: 'home', legs: ['home', 'away', 'home'], choice: '501', note: 'AB mixed: J. Ragnoni/Marc win the decider' },
    { set: 3, winner: 'away', legs: ['away', 'away'], note: 'C cricket: Jennifer gets a clean response set' },
    { set: 4, winner: 'away', legs: ['away', 'home', 'away'], note: 'A cricket: Donnie takes a tight third leg' },
    { set: 5, winner: 'home', legs: ['home', 'away', 'home'], choice: 'cricket', note: 'BC mixed: Marc/Anthony win choice leg in cricket' },
    { set: 6, winner: 'home', legs: ['away', 'home', 'home'], note: 'B 501: Marc comes back 2-1' },
    { set: 7, winner: 'away', legs: ['away', 'home', 'away'], note: 'B 501: Matthew takes the deciding leg' },
    { set: 8, winner: 'home', legs: ['home', 'away', 'home'], choice: '501', note: 'AC mixed: John/Anthony close it in 501' },
    { set: 9, winner: 'home', legs: ['home', 'away', 'home'], note: 'C 501: Anthony closes the night' }
];
const START_SET = Number(process.env.START_SET || 1);
const MAX_SETS = Number(process.env.MAX_SETS || SET_PLAN.length);

let seed = 20260527;
function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
}
function pick(items) {
    return items[Math.floor(rand() * items.length)];
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}
async function stopIfRequested() {
    try {
        await readFile(STOP_FILE, 'utf8');
        throw new Error(`Stop requested via ${STOP_FILE}`);
    } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
    }
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
async function ensureCdpForward() {
    await execFileAsync(ADB, ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote']);
}
async function openAndroidUrl(url, waitMs = 5000) {
    const shellSafeUrl = url.replaceAll('&', '\\&');
    await execFileAsync(ADB, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', shellSafeUrl]);
    await sleep(waitMs);
}
async function connectToTab(pathname) {
    const tabs = await getJson(CDP_URL);
    const tab = tabs.find(item => item.url && item.url.includes(pathname)) || tabs.find(item => item.type === 'page');
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
    const result = await send('Runtime.evaluate', {
        expression: `(${functionDeclaration})()`,
        awaitPromise: true,
        returnByValue: true
    });
    ws.close();
    if (!result?.result?.result) {
        throw new Error(`Runtime evaluation returned no result for ${pathname}`);
    }
    if (result.result.exceptionDetails) {
        throw new Error(result.result.exceptionDetails.text || JSON.stringify(result.result.exceptionDetails));
    }
    return result.result.result.value;
}
async function waitFor(pathname, functionDeclaration, timeoutMs = 45000, intervalMs = 750) {
    const started = Date.now();
    let lastResult;
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

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

function serializeFirestore(value) {
    if (!value || typeof value !== 'object') return value;
    if (typeof value.toMillis === 'function') return { __timestamp: value.toMillis() };
    if (Array.isArray(value)) return value.map(serializeFirestore);
    const out = {};
    for (const [key, entry] of Object.entries(value)) out[key] = serializeFirestore(entry);
    return out;
}
function deserializeFirestore(value) {
    if (!value || typeof value !== 'object') return value;
    if (Object.keys(value).length === 1 && value.__timestamp != null) {
        return admin.firestore.Timestamp.fromMillis(value.__timestamp);
    }
    if (Array.isArray(value)) return value.map(deserializeFirestore);
    const out = {};
    for (const [key, entry] of Object.entries(value)) out[key] = deserializeFirestore(entry);
    return out;
}
async function getMatchBundle() {
    const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(MATCH_ID);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) throw new Error(`Match not found: ${MATCH_ID}`);
    const match = matchDoc.data();
    const [leagueDoc, teamsSnap, playersSnap, statsSnap] = await Promise.all([
        db.collection('leagues').doc(LEAGUE_ID).get(),
        db.collection('leagues').doc(LEAGUE_ID).collection('teams').get(),
        db.collection('leagues').doc(LEAGUE_ID).collection('players').get(),
        db.collection('leagues').doc(LEAGUE_ID).collection('stats').get()
    ]);
    const teams = Object.fromEntries(teamsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const stats = Object.fromEntries(statsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    const matchPlayers = players.filter(p => [match.home_team_id, match.away_team_id].includes(p.team_id));
    return { league: { id: leagueDoc.id, ...leagueDoc.data() }, matchRef, match: { id: matchDoc.id, ...match }, teams, players: matchPlayers, stats };
}
async function snapshotForRestore() {
    const bundle = await getMatchBundle();
    const playerIds = bundle.players.map(p => p.id);
    const teamIds = [bundle.match.home_team_id, bundle.match.away_team_id];
    const data = {
        created_at: new Date().toISOString(),
        league_id: LEAGUE_ID,
        match_id: MATCH_ID,
        match: serializeFirestore(bundle.match),
        teams: {},
        stats: {}
    };
    for (const teamId of teamIds) data.teams[teamId] = serializeFirestore(bundle.teams[teamId]);
    for (const playerId of playerIds) data.stats[playerId] = serializeFirestore(bundle.stats[playerId] || null);
    await mkdir(__dirname, { recursive: true });
    await writeFile(SNAPSHOT_FILE, JSON.stringify(data, null, 2));
    log(`Snapshot saved: ${SNAPSHOT_FILE}`);
    return data;
}
async function restoreSnapshot(snapshot) {
    const batch = db.batch();
    const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(MATCH_ID);
    const matchData = deserializeFirestore(snapshot.match);
    delete matchData.id;
    batch.set(matchRef, matchData, { merge: false });
    for (const [teamId, raw] of Object.entries(snapshot.teams)) {
        const data = deserializeFirestore(raw);
        delete data.id;
        batch.set(db.collection('leagues').doc(LEAGUE_ID).collection('teams').doc(teamId), data, { merge: false });
    }
    for (const [playerId, raw] of Object.entries(snapshot.stats)) {
        const ref = db.collection('leagues').doc(LEAGUE_ID).collection('stats').doc(playerId);
        if (!raw) batch.delete(ref);
        else {
            const data = deserializeFirestore(raw);
            delete data.id;
            batch.set(ref, data, { merge: false });
        }
    }
    await batch.commit();
    log('Core match/team/player stat docs restored from snapshot.');
    await recalculateLeagueStats();
}
async function recalculateLeagueStats() {
    const body = JSON.stringify({ leagueId: LEAGUE_ID, league_id: LEAGUE_ID });
    await new Promise((resolve, reject) => {
        const req = https.request('https://us-central1-brdc-v2.cloudfunctions.net/recalculateAllLeagueStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error(`recalculateAllLeagueStats ${res.statusCode}: ${data}`));
                else {
                    log(`Stats rebuild response: ${data.slice(0, 220)}`);
                    resolve();
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function hubLinks() {
    const hubUrl = `${BASE_URL}/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}&qa=${Date.now()}`;
    await openAndroidUrl(hubUrl, 7000);
    await waitFor('/pages/match-hub-vnext.html', `async () => {
        const text = document.body.innerText || '';
        return {
            ready: document.querySelectorAll('a.mhv-start-set').length > 0,
            links: document.querySelectorAll('a.mhv-start-set').length,
            badText: /NaN|undefined|null/.test(text)
        };
    }`);
    return evaluate('/pages/match-hub-vnext.html', `async () => {
        return Array.from(document.querySelectorAll('a.mhv-start-set')).map(a => ({
            href: a.href,
            text: (a.closest('.mhv-launch-card')?.innerText || a.innerText || '').slice(0, 400)
        }));
    }`);
}
async function getNextLink(setNumber) {
    const links = await hubLinks();
    const link = links.find(item => new URL(item.href).searchParams.get('game_number') === String(setNumber));
    if (!link) throw new Error(`No vnext scorer link found for set ${setNumber}. Links: ${JSON.stringify(links, null, 2)}`);
    return link.href;
}
function pagePathFromUrl(url) {
    return new URL(url).pathname;
}
async function waitForScorer(pathname) {
    return waitFor(pathname, `async () => {
        const text = document.body.innerText || '';
        const isX01 = location.pathname.includes('x01-scorer');
        const isCricket = location.pathname.includes('league-cricket');
        return {
            ready: (((isX01 && typeof window.submitScore === 'function') || (isCricket && typeof window.addHit === 'function')) && typeof window.__BRDC_QA_STATE === 'function'),
            url: location.href,
            badText: /NaN|undefined|null/.test(text),
            body: text.slice(0, 250)
        };
    }`, 180000);
}
async function pageState(pathname) {
    return evaluate(pathname, `async () => {
        try {
            const state = typeof window.__BRDC_QA_STATE === 'function' ? window.__BRDC_QA_STATE() : {};
            return { url: location.href, ...state };
        } catch (error) {
            return { error: String(error), url: location.href };
        }
    }`);
}
async function waitForSubmitReady(pathname) {
    const started = Date.now();
    let state = await pageState(pathname);
    while (state.submitLocked && Date.now() - started < 3000) {
        await sleep(100);
        state = await pageState(pathname);
    }
    return state;
}
async function chooseStarter(pathname, winnerSide = 'home') {
    let state = await pageState(pathname);
    if (!state.starterModal) return state;
    const started = Date.now();
    while (state.starterModal && !state.corkSection && !(state.starterReady && state.pendingStarter !== null) && Date.now() - started < 5000) {
        await sleep(250);
        state = await pageState(pathname);
    }
    const winnerIdx = winnerSide === 'away' ? 1 : 0;
    await evaluate(pathname, `async () => {
        const visible = id => {
            const el = document.getElementById(id);
            if (!el) return false;
            const style = getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        };
        if (visible('corkSection') || visible('corkPlayerColumns') || visible('corkWinnerButtons')) {
            window.corkSetWinner(${winnerIdx});
            window.corkStart();
        } else if (typeof window.confirmStarter === 'function' && window.__BRDC_QA_STATE?.().pendingStarter !== null) {
            window.confirmStarter();
        }
        return true;
    }`);
    await sleep(FAST_UI_DELAY_MS);
    state = await pageState(pathname);
    return state;
}
async function handleChoiceIfNeeded(pathname, setPlan) {
    let state = await pageState(pathname);
    if (state.doublesChoice) {
        const choice = setPlan.choice || '501';
        log(`Set ${setPlan.set}: doubles choice selected ${choice}.`);
        await evaluate(pathname, `async () => { window.selectDoublesChoice(${JSON.stringify(choice)}); return location.href; }`);
        await sleep(2500);
        return pagePathFromUrl(await currentAndroidUrl());
    }
    if (state.corksChoice || state.gameOrStart || state.opponentPicks) {
        const choice = setPlan.choice || '501';
        log(`Set ${setPlan.set}: cork's choice selected ${choice}.`);
        await evaluate(pathname, `async () => {
            if (document.getElementById('corksChoicePhase') && getComputedStyle(document.getElementById('corksChoicePhase')).display !== 'none') {
                window.selectCorksChoiceGame(${JSON.stringify(choice === '501' ? '501' : 'cricket')});
            } else if (document.getElementById('gameOrStartPhase') && getComputedStyle(document.getElementById('gameOrStartPhase')).display !== 'none') {
                window.gameOrStartPickGame(${JSON.stringify(choice === '501' ? '501' : 'cricket')});
            } else if (document.getElementById('opponentPicksGamePhase') && getComputedStyle(document.getElementById('opponentPicksGamePhase')).display !== 'none') {
                window.opponentSelectGame(${JSON.stringify(choice === '501' ? '501' : 'cricket')});
            }
            return location.href;
        }`);
        await sleep(2500);
    }
    return pagePathFromUrl(await currentAndroidUrl());
}
async function currentAndroidUrl() {
    const tabs = await getJson(CDP_URL);
    const page = tabs.find(item => item.type === 'page' && item.url?.includes(BASE_URL.replace('https://', '').replace('http://', ''))) || tabs.find(item => item.type === 'page');
    return page?.url || '';
}

function x01ScoreForTurn(score, targetAvg, isWinner, turnsRemaining) {
    if (score <= 170 && score !== 169 && score !== 168 && score !== 166 && score !== 165 && score !== 163 && score !== 162 && score !== 159) {
        return { score, checkout: true, darts: score <= 40 && score % 2 === 0 ? pick([1, 2, 3]) : pick([2, 3]) };
    }
    const base = targetAvg + (rand() - 0.5) * 34 + (isWinner ? 5 : -1);
    const options = [26, 30, 35, 41, 45, 50, 55, 60, 66, 70, 81, 85, 95, 100, 121, 125, 140];
    let candidate = options.reduce((best, current) => Math.abs(current - base) < Math.abs(best - base) ? current : best, 45);
    if (rand() < 0.06 && targetAvg >= 50) candidate = pick([100, 121, 140]);
    if (rand() < 0.04 && targetAvg < 45) candidate = pick([11, 26, 30]);
    const impossibleRemainders = new Set([1, 159, 162, 163, 165, 166, 168, 169]);
    while (candidate >= score || impossibleRemainders.has(score - candidate)) {
        candidate -= 5;
        if (candidate < 2) candidate = 0;
    }
    return { score: Math.max(0, candidate), checkout: false, darts: 3 };
}
async function playX01Leg(pathname, winnerSide, setLabel) {
    await chooseStarter(pathname, winnerSide);
    pathname = await handleChoiceIfNeeded(pathname, { set: setLabel, choice: '501' });
    if (pathname.includes('league-cricket')) return playCricketLeg(pathname, winnerSide, setLabel);
    await chooseStarter(pathname, winnerSide);

    let turn = 0;
    while (true) {
        await stopIfRequested();
        let state = await pageState(pathname);
        if (state.legModal || state.confirmGameModal || state.gameModal || state.matchComplete) return pathname;
        state = await waitForSubmitReady(pathname);
        if (state.legModal || state.confirmGameModal || state.gameModal || state.matchComplete) return pathname;
        const active = state.activeTeam;
        const side = active === 0 ? 'home' : 'away';
        const score = state.scores[active];
        const playerIds = new URL(state.url).searchParams.get(active === 0 ? 'home_players' : 'away_players');
        let avg = 48;
        try {
            const roster = JSON.parse(playerIds || '[]');
            avg = roster.reduce((sum, p) => sum + (PLAYER_STRENGTH[p.id]?.x01 || 46), 0) / Math.max(1, roster.length);
        } catch {}
        const action = x01ScoreForTurn(score, avg, side === winnerSide, 12 - Math.floor(turn / 2));
        log(`${setLabel} X01 turn ${turn + 1}: ${state.names[active]} ${score} -> ${Math.max(0, score - action.score)} (${action.score}${action.checkout ? ` out/${action.darts}` : ''})`);
        await evaluate(pathname, `async () => {
            window.submitScore(${action.score});
            return true;
        }`);
        await sleep(FAST_UI_DELAY_MS);
        if (action.checkout) {
            await evaluate(pathname, `async () => {
                if (document.getElementById('scoreInput')?.classList.contains('checkout-mode')) {
                    window.completeCheckoutQuick(${action.darts});
                }
                return true;
            }`);
            await sleep(FAST_UI_DELAY_MS);
        }
        const nextState = await pageState(pathname);
        if (!nextState.legModal && !nextState.confirmGameModal && !nextState.gameModal && !nextState.matchComplete) {
            const sameActive = nextState.activeTeam === active;
            const sameScore = Number(nextState.scores?.[active]) === Number(score);
            if (sameActive && sameScore) {
                throw new Error(`${setLabel} X01 turn ${turn + 1} did not advance. active=${active}, score=${score}, submitLocked=${nextState.submitLocked}, lockAge=${nextState.submitLockAge}`);
            }
        }
        turn++;
        await sleep(TURN_DELAY_MS);
    }
}
function cricketTargetForState(state, sideIdx, skillMpr) {
    const own = state.marks[sideIdx];
    const other = state.marks[1 - sideIdx];
    const score = state.scores[sideIdx] || 0;
    const oppScore = state.scores[1 - sideIdx] || 0;
    const targets = ['20', '19', '18', '17', '16', '15', 'BULL'];
    const scoringTarget = targets.find(t => (own[t] || 0) >= 3 && (other[t] || 0) < 3);
    if (scoringTarget && score <= oppScore + (skillMpr >= 2.3 ? 20 : 8) && rand() < 0.45) return scoringTarget;
    return targets.find(t => (own[t] || 0) < 3) || scoringTarget || 'BULL';
}
function cricketDartsForTurn(target, skillMpr) {
    const darts = [];
    const hitChance = Math.min(0.82, Math.max(0.45, 0.28 + skillMpr / 4));
    const tripleChance = Math.min(0.26, Math.max(0.08, (skillMpr - 1.5) / 5));
    const doubleChance = Math.min(0.28, Math.max(0.10, (skillMpr - 1.2) / 4));
    for (let i = 0; i < 3; i++) {
        if (rand() > hitChance) darts.push({ target: null, mult: 0 });
        else if (rand() < tripleChance) darts.push({ target, mult: target === 'BULL' ? 2 : 3 });
        else if (rand() < doubleChance) darts.push({ target, mult: 2 });
        else darts.push({ target, mult: 1 });
    }
    return darts;
}
async function playCricketLeg(pathname, winnerSide, setLabel) {
    await chooseStarter(pathname, winnerSide);
    let turn = 0;
    while (true) {
        await stopIfRequested();
        const state = await pageState(pathname);
        if (state.legModal || state.winModal || state.matchComplete) return pathname;
        if (state.dartsModal) {
            await evaluate(pathname, `async () => { window.confirmWinDarts(3); return true; }`);
            await sleep(FAST_UI_DELAY_MS);
            continue;
        }
        const active = state.activeTeam;
        const side = active === 0 ? 'home' : 'away';
        const playerIds = new URL(state.url).searchParams.get(active === 0 ? 'home_players' : 'away_players');
        let mpr = 2.0;
        try {
            const roster = JSON.parse(playerIds || '[]');
            mpr = roster.reduce((sum, p) => sum + (PLAYER_STRENGTH[p.id]?.mpr || 2), 0) / Math.max(1, roster.length);
            if (side === winnerSide) mpr += 0.18;
        } catch {}
        const target = cricketTargetForState(state, active, mpr);
        const darts = cricketDartsForTurn(target, mpr);
        const summary = darts.map(d => d.target ? `${d.mult}x${d.target}` : 'miss').join(', ');
        log(`${setLabel} cricket turn ${turn + 1}: ${state.names[active]} shoots ${target}: ${summary}`);
        await evaluate(pathname, `async () => {
            for (const dart of ${JSON.stringify(darts)}) {
                if (!dart.target) window.addMiss();
                else window.addHit(String(dart.target), Number(dart.mult));
                await new Promise(resolve => setTimeout(resolve, 80));
                if (document.getElementById('dartsModal')?.classList.contains('active')) break;
            }
            if (document.getElementById('dartsModal')?.classList.contains('active')) {
                window.confirmWinDarts(Math.max(1, ${JSON.stringify(darts)}.filter(d => d.target).length));
            } else {
                window.nextPlayer();
            }
            return true;
        }`);
        turn++;
        await sleep(TURN_DELAY_MS);
    }
}
async function advanceAfterLegOrSet(pathname, setPlan) {
    let state = await pageState(pathname);
    if (state.type === 'x01' && state.confirmGameModal) {
        await evaluate(pathname, `async () => { window.confirmGameWin(); return true; }`);
        await sleep(FAST_UI_DELAY_MS);
        state = await pageState(pathname);
    }
    if (state.type === 'x01' && state.gameModal) {
        log(`Set ${setPlan.set}: saving X01 set result.`);
        await evaluate(pathname, `async () => { await window.saveGame(); return true; }`);
        await sleep(4500);
        return 'set-saved';
    }
    if (state.type === 'cricket' && state.winModal) {
        log(`Set ${setPlan.set}: saving cricket set result.`);
        await evaluate(pathname, `async () => { await window.saveAndExit(); return true; }`);
        await sleep(4500);
        return 'set-saved';
    }
    if (state.legModal) {
        await evaluate(pathname, `async () => { window.nextLeg(); return true; }`);
        await sleep(2500);
        return 'next-leg';
    }
    if (state.matchComplete) return 'match-complete';
    return 'continue';
}
async function playSet(setPlan) {
    const rawLink = await getNextLink(setPlan.set);
    const linkUrl = new URL(rawLink);
    linkUrl.searchParams.set('qa', String(Date.now()));
    const link = linkUrl.toString();
    log(`Opening set ${setPlan.set}: ${setPlan.note}`);
    await openAndroidUrl(link, 8000);
    let pathname = pagePathFromUrl(link);
    await waitForScorer(pathname);

    let legIndex = 0;
    while (true) {
        await stopIfRequested();
        pathname = pagePathFromUrl(await currentAndroidUrl());
        await waitForScorer(pathname);
        let state = await chooseStarter(pathname, setPlan.legs[Math.min(legIndex, setPlan.legs.length - 1)]);
        pathname = pagePathFromUrl(await currentAndroidUrl());
        state = await pageState(pathname);
        if (state.doublesChoice || state.corksChoice || state.gameOrStart || state.opponentPicks) {
            pathname = await handleChoiceIfNeeded(pathname, setPlan);
            await waitForScorer(pathname);
            await chooseStarter(pathname, setPlan.legs[Math.min(legIndex, setPlan.legs.length - 1)]);
        }
        const winnerSide = setPlan.legs[Math.min(legIndex, setPlan.legs.length - 1)];
        if (pathname.includes('league-cricket')) await playCricketLeg(pathname, winnerSide, `S${setPlan.set} L${legIndex + 1}`);
        else await playX01Leg(pathname, winnerSide, `S${setPlan.set} L${legIndex + 1}`);

        pathname = pagePathFromUrl(await currentAndroidUrl());
        const action = await advanceAfterLegOrSet(pathname, setPlan);
        if (action === 'set-saved' || action === 'match-complete') break;
        legIndex++;
        if (legIndex > 3) throw new Error(`Set ${setPlan.set} exceeded expected leg count.`);
    }
    const bundle = await getMatchBundle();
    log(`After set ${setPlan.set}: match ${bundle.match.home_score || 0}-${bundle.match.away_score || 0}, status ${bundle.match.status}, games ${(bundle.match.games || []).length}.`);
}

async function main() {
    await rm(STOP_FILE, { force: true });
    await ensureCdpForward();
    await execFileAsync(ADB, ['devices']);
    const snapshot = await snapshotForRestore();
    const initial = await getMatchBundle();
    if ((initial.match.games || []).length || initial.match.status !== 'scheduled') {
        throw new Error(`Refusing to start: match is not clean. status=${initial.match.status}, games=${(initial.match.games || []).length}`);
    }

    log(`Starting vnext Android match simulation at ${TURN_DELAY_MS}ms per turn.`);
    const plans = SET_PLAN.filter(plan => plan.set >= START_SET).slice(0, MAX_SETS);
    for (const plan of plans) {
        await playSet(plan);
        const bundle = await getMatchBundle();
        if (bundle.match.status === 'completed') {
            log(`Match completed after set ${plan.set}; stopping remaining set simulation.`);
            break;
        }
    }

    const completed = await getMatchBundle();
    log(`Simulation completed: ${completed.match.home_score}-${completed.match.away_score}, status=${completed.match.status}, winner=${completed.match.winner || '-'}`);
    if (RESTORE_AT_END) await restoreSnapshot(snapshot);
    log('Done.');
}

main().catch(async error => {
    console.error(`[FATAL] ${error.stack || error.message}`);
    try {
        const raw = await readFile(SNAPSHOT_FILE, 'utf8');
        if (RESTORE_AT_END) await restoreSnapshot(JSON.parse(raw));
    } catch (restoreError) {
        console.error(`[RESTORE FAILED] ${restoreError.stack || restoreError.message}`);
    }
    process.exit(1);
});
