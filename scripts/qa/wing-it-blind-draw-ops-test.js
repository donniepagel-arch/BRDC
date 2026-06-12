const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const admin = require('../../functions/node_modules/firebase-admin');

const execFileAsync = promisify(execFile);

if (!admin.apps.length) admin.initializeApp({ projectId: 'brdc-v2' });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const eventId = 'blind_draw_doubles';
const createdTournamentIds = [];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function deleteCollection(collectionRef, batchSize = 100) {
    while (true) {
        const snap = await collectionRef.limit(batchSize).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

async function cleanupTournament(tournamentId) {
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

async function cleanupAll() {
    for (const tournamentId of createdTournamentIds.reverse()) {
        await cleanupTournament(tournamentId).catch(() => null);
    }
}

async function createTournament(label, count) {
    const tournamentId = `qa-wing-it-ops-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    createdTournamentIds.push(tournamentId);
    const ref = db.collection('tournaments').doc(tournamentId);
    await ref.set({
        tournament_name: `Ops QA Wing It ${label}`,
        name: `Ops QA Wing It ${label}`,
        tournament_date: '2026-05-27',
        date: '2026-05-27',
        tournament_time: '19:00',
        location_mode: 'specific',
        venue_name: 'BRDC / Burning River Darts',
        format: 'single_elimination',
        bracket_type: 'single_elimination',
        entry_type: 'blind_draw',
        draw_type: 'blind_draw',
        team_size: 2,
        max_players: 64,
        entry_fee: 0,
        game_type: 'corks_choice',
        default_game: 'corks_choice',
        status: 'registration',
        registration_status: 'Registration open',
        bracketGenerated: false,
        started: false,
        completed: false,
        players: {},
        registered_count: count,
        event_count: 1,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
    });

    await ref.collection('events').doc(eventId).set({
        tournament_id: tournamentId,
        event_number: 1,
        event_name: 'Blind Draw Doubles',
        entry_type: 'blind_draw',
        draw_type: 'blind_draw',
        team_size: 2,
        format: 'single_elimination',
        game: 'corks_choice',
        best_of: 3,
        legs_to_win: 2,
        entry_fee: 0,
        max_players: 64,
        registered_count: count,
        status: 'open',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
    });

    const batch = db.batch();
    for (let i = 1; i <= count; i++) {
        const n = String(i).padStart(2, '0');
        const regRef = ref.collection('registrations').doc(`reg_${n}`);
        const reg = {
            full_name: `Ops QA Player ${n}`,
            name: `Ops QA Player ${n}`,
            email: `ops-qa-player-${n}@example.com`,
            phone: `55520010${n}`,
            event_ids: [eventId],
            status: 'active',
            checked_in: true,
            payment_status: 'paid',
            total_amount: 0,
            created_at: FieldValue.serverTimestamp()
        };
        batch.set(regRef, reg);
        batch.set(ref.collection('events').doc(eventId).collection('registrations').doc(regRef.id), {
            registration_id: regRef.id,
            full_name: reg.full_name,
            email: reg.email,
            checked_in: true,
            created_at: FieldValue.serverTimestamp()
        });
    }
    await batch.commit();
    return tournamentId;
}

async function runDraw(tournamentId, extraArgs = [], expectSuccess = true) {
    try {
        const { stdout, stderr } = await execFileAsync('node', [
            'scripts/wing-it-blind-draw.js',
            '--tournament', tournamentId,
            '--event', eventId,
            ...extraArgs
        ], { cwd: process.cwd(), maxBuffer: 1024 * 1024 });
        if (!expectSuccess) throw new Error(`Expected command to fail, but it succeeded: ${stdout}`);
        return { stdout, stderr, success: true };
    } catch (error) {
        if (expectSuccess) throw error;
        return { stdout: error.stdout || '', stderr: error.stderr || '', message: error.message, success: false };
    }
}

function parsedReport(stdout) {
    return JSON.parse(stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1));
}

async function getTournament(tournamentId) {
    const snap = await db.collection('tournaments').doc(tournamentId).get();
    return snap.data();
}

async function getDrawTeamCount(tournamentId) {
    const snap = await db.collection('tournaments').doc(tournamentId).collection('draw_teams').get();
    return snap.size;
}

async function testDryRun() {
    const tournamentId = await createTournament('dryrun', 8);
    const result = await runDraw(tournamentId, ['--seed', 'dry-run']);
    const report = parsedReport(result.stdout);
    const tournament = await getTournament(tournamentId);
    assert(report.mode === 'dry-run', 'Dry-run report did not say dry-run');
    assert(result.stdout.includes('Dry run only'), 'Dry-run output did not include clear warning');
    assert(tournament.bracketGenerated === false, 'Dry run mutated bracketGenerated');
    assert(await getDrawTeamCount(tournamentId) === 0, 'Dry run wrote draw teams');
    return { tournamentId, teams: report.teams.length };
}

async function testOddAndHouse() {
    const oddId = await createTournament('odd', 11);
    const odd = await runDraw(oddId, ['--seed', 'odd'], false);
    assert(/Odd player count/i.test(odd.stderr || odd.stdout || odd.message), 'Odd count did not fail with useful message');

    const house = await runDraw(oddId, ['--seed', 'odd', '--house', 'House Player', '--commit', '--generate-bracket']);
    const report = parsedReport(house.stdout);
    const tournament = await getTournament(oddId);
    assert(report.players === 12, 'House player did not make player count 12');
    assert(report.teams.length === 6, 'House player draw did not create 6 teams');
    assert(tournament.bracketGenerated === true, 'House player draw did not generate bracket');
    return { tournamentId: oddId, players: report.players, teams: report.teams.length };
}

async function testForceRegeneration() {
    const tournamentId = await createTournament('force', 8);
    const first = await runDraw(tournamentId, ['--seed', 'force-a', '--commit', '--generate-bracket']);
    const noForce = await runDraw(tournamentId, ['--seed', 'force-b', '--commit', '--generate-bracket'], false);
    assert(/already has a bracket/i.test(noForce.stderr || noForce.stdout || noForce.message), 'Second draw without --force did not refuse existing bracket');
    const forced = await runDraw(tournamentId, ['--seed', 'force-b', '--force', '--commit', '--generate-bracket']);
    const firstReport = parsedReport(first.stdout);
    const forcedReport = parsedReport(forced.stdout);
    assert(firstReport.teams.length === forcedReport.teams.length, 'Force changed team count');
    assert(await getDrawTeamCount(tournamentId) === 4, 'Force regeneration did not leave 4 draw teams');
    return { tournamentId, teams: forcedReport.teams.length };
}

function recordSingleElimResult(bracket, matchId, player1Score, player2Score) {
    const matchIndex = bracket.matches.findIndex(match => match.id === matchId);
    assert(matchIndex !== -1, `Match not found: ${matchId}`);
    const match = bracket.matches[matchIndex];
    const winner = player1Score > player2Score ? match.player1 : match.player2;
    bracket.matches[matchIndex] = {
        ...match,
        score: { player1: player1Score, player2: player2Score },
        winner,
        winner_id: winner?.id || null,
        status: 'completed',
        completedAt: admin.firestore.Timestamp.now()
    };

    if (match.round < bracket.totalRounds) {
        const nextMatch = bracket.matches.find(item => item.round === match.round + 1 && item.position === Math.floor(match.position / 2));
        assert(nextMatch, 'Next match not found for advancement');
        if (match.position % 2 === 0) nextMatch.player1 = winner;
        else nextMatch.player2 = winner;
        if (nextMatch.player1 && nextMatch.player2) nextMatch.status = 'pending';
    }
}

async function testAdvancement() {
    const tournamentId = await createTournament('advance', 8);
    await runDraw(tournamentId, ['--seed', 'advance', '--commit', '--generate-bracket']);
    const ref = db.collection('tournaments').doc(tournamentId);
    const tournament = await getTournament(tournamentId);
    const bracket = tournament.bracket;
    assert(bracket.matches.length === 3, '8 players / 4 teams should create 3 bracket matches');

    recordSingleElimResult(bracket, 'match-1', 2, 0);
    assert(bracket.matches.find(match => match.id === 'match-3').player1, 'Match 1 winner did not advance into final player1');
    assert(bracket.matches.find(match => match.id === 'match-3').status === 'waiting', 'Final should wait until both finalists are present');

    recordSingleElimResult(bracket, 'match-2', 1, 2);
    assert(bracket.matches.find(match => match.id === 'match-3').player2, 'Match 2 winner did not advance into final player2');
    assert(bracket.matches.find(match => match.id === 'match-3').status === 'pending', 'Final should become pending after both finalists advance');

    await ref.set({ bracket }, { merge: true });
    const after = await getTournament(tournamentId);
    assert(after.bracket.matches.find(match => match.id === 'match-3').status === 'pending', 'Persisted final is not pending');
    return { tournamentId, finalStatus: after.bracket.matches.find(match => match.id === 'match-3').status };
}

(async () => {
    try {
        const results = {
            dryRun: await testDryRun(),
            oddAndHouse: await testOddAndHouse(),
            forceRegeneration: await testForceRegeneration(),
            advancement: await testAdvancement()
        };
        console.log(JSON.stringify({ success: true, results }, null, 2));
    } finally {
        await cleanupAll();
    }
})().catch(error => {
    console.error(error.stack || error.message || error);
    cleanupAll().finally(() => process.exit(1));
});
