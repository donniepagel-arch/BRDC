import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ID = 'brdc-v2';
const API_KEY = 'AIzaSyDN1aYhoVt3OX5EafsNTVB09i8VFx7QM1U';
const FUNCTION_BASE = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1`;
const KEEP = process.argv.includes('--keep');
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const PASSWORD = 'BRDC-QA-role-test-2026!';

const report = {
    run_id: RUN_ID,
    project_id: PROJECT_ID,
    keep_test_data: KEEP,
    started_at: new Date().toISOString(),
    tournament_id: null,
    event_id: 'main',
    match_id: null,
    checks: [],
    cleanup: []
};

function record(name, ok, details = {}) {
    report.checks.push({ name, ok, ...details });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${details.summary ? ` - ${details.summary}` : ''}`);
}

function assertCheck(condition, name, details = {}) {
    record(name, !!condition, details);
    if (!condition) {
        const error = new Error(`${name} failed`);
        error.details = details;
        throw error;
    }
}

async function authRequest(endpoint, body) {
    const response = await fetch(`${AUTH_BASE}/${endpoint}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: 'https://burningriverdarts.com',
            Referer: 'https://burningriverdarts.com/'
        },
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
}

async function signUpOrSignIn(email, password, displayName) {
    let result = await authRequest('accounts:signUp', {
        email,
        password,
        displayName,
        returnSecureToken: true
    });

    if (!result.response.ok && result.payload?.error?.message === 'EMAIL_EXISTS') {
        result = await authRequest('accounts:signInWithPassword', {
            email,
            password,
            returnSecureToken: true
        });
    }

    if (!result.response.ok || !result.payload?.idToken) {
        throw new Error(`Auth failed for ${email}: ${result.payload?.error?.message || result.response.status}`);
    }

    return {
        uid: result.payload.localId,
        email: result.payload.email || email,
        token: result.payload.idToken
    };
}

async function callFunction(name, body = {}, idToken = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const response = await fetch(`${FUNCTION_BASE}/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        payload = { raw: text };
    }

    if (!response.ok || payload.success === false || payload.error) {
        const error = new Error(`${name} failed (${response.status}): ${payload.error || text}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

async function ensurePlayer(role, firstName, lastName, phoneSuffix) {
    const email = `qa.online.${role}@burningriverdarts.com`;
    const name = `${firstName} ${lastName}`;
    const auth = await signUpOrSignIn(email, PASSWORD, name);

    let profile;
    try {
        profile = await callFunction('registerNewPlayerV2', {
            first_name: firstName,
            last_name: lastName,
            email: auth.email,
            phone: `216555${phoneSuffix}`,
            firebase_uid: auth.uid
        });
    } catch (error) {
        if (!String(error.message || '').includes('already exists')) throw error;
        const session = await callFunction('getPlayerSession', {}, auth.token);
        profile = {
            player_id: session.player?.id,
            name: session.player?.name,
            player: session.player
        };
    }

    assertCheck(!!profile.player_id, `${name} has BRDC player profile`, {
        player_id: profile.player_id
    });

    return {
        role,
        id: profile.player_id,
        uid: auth.uid,
        email: auth.email,
        name,
        token: auth.token
    };
}

function findPlayableMatch(bracket) {
    return (bracket?.matches || []).find(match => match.player1 && match.player2) || null;
}

async function writeReport(suffix = '') {
    report.completed_at = new Date().toISOString();
    await mkdir(path.resolve('reports'), { recursive: true });
    const reportPath = path.resolve('reports', `online-tournament-role-test-${RUN_ID}${suffix}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`REPORT ${reportPath}`);
}

async function cleanup(tournamentId, hostToken) {
    if (!tournamentId || KEEP) return;
    try {
        const result = await callFunction('deleteTournament', { tournament_id: tournamentId }, hostToken);
        report.cleanup.push(result.message || `Deleted tournament ${tournamentId}`);
    } catch (error) {
        report.cleanup.push(`Tournament cleanup failed: ${error.message}`);
    }
}

async function main() {
    const host = await ensurePlayer('host', 'QA', 'Host', '0101');
    const player1 = await ensurePlayer('player1', 'QA', 'PlayerOne', '0102');
    const player2 = await ensurePlayer('player2', 'QA', 'PlayerTwo', '0103');
    const spectator = await ensurePlayer('spectator', 'QA', 'Spectator', '0104');

    const createResult = await callFunction('createTournament', {
        tournament_name: `QA Online Role Test ${RUN_ID}`,
        tournament_date: new Date().toISOString().slice(0, 10),
        tournament_time: '19:00',
        location_mode: 'online',
        venue_name: 'Online / Virtual',
        tournament_details: 'Automated online tournament role test. Safe to delete.',
        full_name: host.name,
        email: host.email,
        phone: '',
        director_player_id: host.id,
        max_players: 8,
        format: 'single_elimination',
        game: 'corks_choice',
        is_online: true,
        allow_remote_play: true,
        enable_tournament_chat: true,
        enable_player_challenges: true,
        auto_create_match_rooms: true,
        require_check_in: true,
        allow_player_self_report: true,
        show_tournament_runtime: true,
        enable_video_streaming: true,
        enable_score_assist: true,
        enable_runtime_notifications: false,
        events: [{
            event_name: 'Open Singles 501 / Cricket / Choice',
            entry_type: 'individual',
            format: 'single_elimination',
            game: 'corks_choice',
            best_of: 3,
            use_cork: true,
            cork_rules: 'cork_every_leg',
            cork_option: 'winner_chooses',
            cork_winner_gets: 'choice',
            num_legs: 3,
            leg_mode: 'best-of',
            in_option: 'straight',
            out_option: 'double',
            entry_fee: 0
        }]
    }, host.token);

    const tournamentId = createResult.tournament_id;
    report.tournament_id = tournamentId;
    assertCheck(!!tournamentId, 'host can create online tournament', { tournament_id: tournamentId });

    for (const player of [player1, player2]) {
        const registration = await callFunction('registerForTournament', {
            tournament_id: tournamentId,
            full_name: player.name,
            email: player.email,
            phone: '',
            event_ids: ['main'],
            sms_opt_in: false,
            payment_method: 'free',
            total_amount: 0
        });
        assertCheck(!!registration.registration_id, `${player.name} can register`, {
            registration_id: registration.registration_id,
            player_id: registration.player_id || null,
            checked_in: registration.checked_in
        });
    }

    const roomResult = await callFunction('createAllTournamentChatRooms', { tournament_id: tournamentId }, host.token);
    assertCheck(roomResult.success === true || Number(roomResult.rooms_created || 0) >= 0, 'host can create tournament chat rooms', {
        rooms_created: roomResult.rooms_created ?? null
    });

    for (const player of [player1, player2]) {
        const checkIn = await callFunction('setTournamentPlayerCheckIn', {
            tournament_id: tournamentId,
            checked_in: true
        }, player.token);
        assertCheck(checkIn.checked_in === true || checkIn.checkedIn === true, `${player.name} can check in`, {
            player_id: checkIn.player_id || null
        });
    }

    const preRuntime = {
        host: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, host.token),
        player1: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, player1.token),
        player2: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, player2.token),
        spectator: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, spectator.token)
    };
    assertCheck(preRuntime.host.viewer.role === 'host', 'host runtime sees host role', { action: preRuntime.host.action });
    assertCheck(preRuntime.player1.viewer.is_registered === true, 'player 1 runtime sees registered state', { action: preRuntime.player1.action });
    assertCheck(preRuntime.player2.viewer.is_registered === true, 'player 2 runtime sees registered state', { action: preRuntime.player2.action });
    assertCheck(preRuntime.spectator.viewer.is_registered === false, 'spectator runtime can view but is not registered', { action: preRuntime.spectator.action });

    const bracketResult = await callFunction('generateBracket', { tournament_id: tournamentId }, host.token);
    assertCheck(bracketResult.success === true && bracketResult.matches_created >= 1, 'host can generate bracket', {
        matches_created: bracketResult.matches_created,
        players: bracketResult.players
    });

    let match = findPlayableMatch(bracketResult.bracket);
    assertCheck(!!match, 'bracket has a playable match', {
        match_id: match?.id,
        player1: match?.player1?.name,
        player2: match?.player2?.name
    });
    report.match_id = match.id;

    const matchPlayerIds = new Set([match.player1?.id, match.player2?.id].filter(Boolean));
    assertCheck(matchPlayerIds.has(player1.id) && matchPlayerIds.has(player2.id), 'playable match uses both registered players', {
        match_player_ids: [...matchPlayerIds]
    });

    for (const player of [player1, player2]) {
        const runtime = await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, player.token);
        assertCheck(runtime.active_match?.id === match.id, `${player.name} sees active match`, {
            action: runtime.action,
            active_match: runtime.active_match?.id
        });

        const ready = await callFunction('setTournamentMatchReady', {
            tournament_id: tournamentId,
            match_id: match.id,
            ready: true
        }, player.token);
        assertCheck(ready.success === true, `${player.name} can ready up`, {
            status: ready.status,
            side1: ready.match_ready?.side1,
            side2: ready.match_ready?.side2
        });
    }

    const start = await callFunction('startTournamentMatch', {
        tournament_id: tournamentId,
        match_id: match.id,
        room_label: 'QA Board 1',
        room_url: 'https://meet.example.test/brdc-qa',
        stream_url: 'https://stream.example.test/brdc-qa'
    }, host.token);
    assertCheck(start.status === 'in_progress', 'host can start ready match', { room_label: start.match?.room_label });
    match = start.match;

    const submitter = match.player1?.id === player1.id ? player1 : player2;
    const opponent = submitter.id === player1.id ? player2 : player1;
    const result = await callFunction('submitMatchResult', {
        tournament_id: tournamentId,
        match_id: match.id,
        player1_score: 2,
        player2_score: 1,
        game_stats: {
            format: 'corks_choice',
            source: 'qa_online_tournament_role_test',
            legs: []
        }
    }, submitter.token);
    assertCheck(result.success === true && result.match?.status === 'completed', 'participant can submit match result', {
        review_status: result.match?.result_review?.status,
        score: result.match?.score
    });

    const opponentResponse = await callFunction('respondTournamentMatchResult', {
        tournament_id: tournamentId,
        match_id: match.id,
        action: 'dispute',
        notes: 'QA dispute path test'
    }, opponent.token);
    assertCheck(opponentResponse.result_review?.status === 'disputed', 'opponent can dispute submitted result', {
        disputed_by_side: opponentResponse.result_review?.disputed_by_side
    });

    const hostResolve = await callFunction('respondTournamentMatchResult', {
        tournament_id: tournamentId,
        match_id: match.id,
        action: 'resolve',
        notes: 'QA host resolution test'
    }, host.token);
    assertCheck(hostResolve.result_review?.status === 'confirmed', 'host can resolve disputed result', {
        resolved_by: hostResolve.result_review?.resolved_by
    });

    const postRuntime = {
        host: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, host.token),
        player1: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, player1.token),
        player2: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, player2.token),
        spectator: await callFunction('getTournamentPlayerRuntime', { tournament_id: tournamentId }, spectator.token)
    };
    assertCheck(postRuntime.host.host_queue?.disputed_matches?.length === 0, 'host queue clears resolved dispute');
    assertCheck(postRuntime.player1.completed_matches?.some(item => item.id === match.id), 'player 1 sees completed match');
    assertCheck(postRuntime.player2.completed_matches?.some(item => item.id === match.id), 'player 2 sees completed match');
    assertCheck(postRuntime.spectator.viewer.is_registered === false, 'spectator remains non-registered after match');

    await cleanup(tournamentId, host.token);
    await writeReport();
}

main().catch(async error => {
    report.error = {
        message: error.message,
        details: error.details || error.payload || null
    };
    try {
        await writeReport('-failed');
    } catch (reportError) {
        console.error(`Report write failed: ${reportError.message}`);
    }
    console.error(error);
    process.exitCode = 1;
});
