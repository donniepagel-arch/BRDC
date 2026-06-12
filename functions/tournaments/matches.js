/**
 * Submit Match Result Cloud Function
 * REFACTORED to work with new unified structure
 * Now includes stats aggregation for player leaderboards
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const { processTournamentMatchStats, recalculateTournamentStats } = require('./stats');
const { requireTournamentAccess, getTournamentContext, getRoleFromTournament } = require('../src/tournament-auth-helper');
const { verifyFirebaseAuth } = require('../src/firebase-auth-helper');
const { sendManagedSms, sendManagedEmail } = require('../src/messaging-config');

function cleanText(value) {
    const text = String(value || '').trim();
    return text || null;
}

function cleanUrl(value) {
    const text = cleanText(value);
    if (!text) return null;
    if (/^https?:\/\//i.test(text)) return text;
    return `https://${text}`;
}

function buildRoomPatch(input = {}) {
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(input, 'board')) {
        patch.board = input.board ? parseInt(input.board, 10) || null : null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'board_number')) {
        patch.board_number = input.board_number ? parseInt(input.board_number, 10) || null : null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'room_label')) {
        patch.room_label = cleanText(input.room_label);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'room_url')) {
        patch.room_url = cleanUrl(input.room_url);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'stream_url')) {
        patch.stream_url = cleanUrl(input.stream_url);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'archive_url')) {
        patch.archive_url = cleanUrl(input.archive_url);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'recording_url')) {
        patch.archive_url = cleanUrl(input.recording_url);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'room_notes')) {
        patch.room_notes = cleanText(input.room_notes);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'archive_notes')) {
        patch.archive_notes = cleanText(input.archive_notes);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'room_status')) {
        patch.room_status = cleanText(input.room_status);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'status')) {
        patch.status = cleanText(input.status);
    }

    return patch;
}

function buildScoringProgress(input = {}) {
    const progress = {};

    if (Object.prototype.hasOwnProperty.call(input, 'scorer_type')) {
        progress.scorer_type = cleanText(input.scorer_type);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'game_number')) {
        const gameNumber = parseInt(input.game_number, 10);
        progress.game_number = Number.isFinite(gameNumber) ? gameNumber : null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'team1_legs_won')) {
        const team1Legs = parseInt(input.team1_legs_won, 10);
        progress.team1_legs_won = Number.isFinite(team1Legs) ? team1Legs : 0;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'team2_legs_won')) {
        const team2Legs = parseInt(input.team2_legs_won, 10);
        progress.team2_legs_won = Number.isFinite(team2Legs) ? team2Legs : 0;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'player1_legs_won')) {
        const player1Legs = parseInt(input.player1_legs_won, 10);
        progress.player1_legs_won = Number.isFinite(player1Legs) ? player1Legs : 0;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'player2_legs_won')) {
        const player2Legs = parseInt(input.player2_legs_won, 10);
        progress.player2_legs_won = Number.isFinite(player2Legs) ? player2Legs : 0;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'winner')) {
        progress.winner = cleanText(input.winner);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'game_stats')) {
        progress.game_stats = input.game_stats || null;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'saved_from')) {
        progress.saved_from = cleanText(input.saved_from);
    }

    return progress;
}

function findDoubleElimMatch(bracket, matchId) {
    const winnersIndex = bracket?.winners?.findIndex(m => m.id === matchId) ?? -1;
    if (winnersIndex !== -1) {
        return { match: bracket.winners[winnersIndex], matchArrayName: 'winners', matchIndex: winnersIndex };
    }

    const losersIndex = bracket?.losers?.findIndex(m => m.id === matchId) ?? -1;
    if (losersIndex !== -1) {
        return { match: bracket.losers[losersIndex], matchArrayName: 'losers', matchIndex: losersIndex };
    }

    if (matchId === 'gf-1' && bracket?.grand_finals?.match1) {
        return { match: bracket.grand_finals.match1, matchArrayName: 'grand_finals_1', matchIndex: 0 };
    }
    if (matchId === 'gf-2' && bracket?.grand_finals?.match2) {
        return { match: bracket.grand_finals.match2, matchArrayName: 'grand_finals_2', matchIndex: 1 };
    }

    return null;
}

function applyDoubleElimMatchPatch(bracket, matchArrayName, matchIndex, patch) {
    if (matchArrayName === 'winners' || matchArrayName === 'losers') {
        bracket[matchArrayName][matchIndex] = { ...bracket[matchArrayName][matchIndex], ...patch };
        return bracket[matchArrayName][matchIndex];
    }
    if (matchArrayName === 'grand_finals_1') {
        bracket.grand_finals.match1 = { ...bracket.grand_finals.match1, ...patch };
        return bracket.grand_finals.match1;
    }
    if (matchArrayName === 'grand_finals_2') {
        bracket.grand_finals.match2 = { ...bracket.grand_finals.match2, ...patch };
        return bracket.grand_finals.match2;
    }
    return null;
}

function findSingleElimMatch(bracket, matchId) {
    const matchIndex = bracket?.matches?.findIndex(m => m.id === matchId) ?? -1;
    if (matchIndex === -1) return null;
    return { match: bracket.matches[matchIndex], matchIndex };
}

const MATCH_READY_STALE_MINUTES = 15;
const MATCH_PROGRESS_STALE_MINUTES = 45;
const RUNTIME_REMINDER_COOLDOWN_MINUTES = 30;

function normalizeValue(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function participantToEntry(participant, fallbackLabel = 'TBD') {
    if (!participant) {
        return { id: null, player_id: null, name: fallbackLabel, email: null, raw: participant };
    }

    if (typeof participant === 'string') {
        return { id: null, player_id: null, name: participant, email: null, raw: participant };
    }

    return {
        id: participant.id || participant.player_id || participant.playerId || null,
        player_id: participant.player_id || participant.playerId || participant.id || null,
        firebase_uid: participant.firebase_uid || null,
        email: participant.email || null,
        name: participant.name
            || participant.player_name
            || participant.playerName
            || participant.team_name
            || participant.label
            || fallbackLabel,
        raw: participant
    };
}

function collectViewerKeys(authPlayer, registration = null, tournamentPlayer = null) {
    const ids = new Set();
    const firebaseUids = new Set();
    const emails = new Set();
    const names = new Set();

    const addId = (value) => value && ids.add(String(value));
    const addUid = (value) => value && firebaseUids.add(String(value));
    const addEmail = (value) => {
        const normalized = normalizeValue(value);
        if (normalized) emails.add(normalized);
    };
    const addName = (value) => {
        const normalized = normalizeValue(value);
        if (normalized) names.add(normalized);
    };

    addId(authPlayer?.id);
    addUid(authPlayer?.firebase_uid);
    addEmail(authPlayer?.email);
    addName(authPlayer?.name);

    addId(registration?.player_id);
    addEmail(registration?.email);
    addName(registration?.full_name || registration?.name);

    addId(tournamentPlayer?.id);
    addId(tournamentPlayer?.player_id);
    addUid(tournamentPlayer?.firebase_uid);
    addEmail(tournamentPlayer?.email);
    addName(tournamentPlayer?.name || tournamentPlayer?.player_name);

    return { ids, firebaseUids, emails, names };
}

function entryMatchesViewer(entry, viewerKeys) {
    if (!entry) return false;

    const entryId = entry.id || entry.player_id || null;
    const entryFirebaseUid = entry.firebase_uid || null;
    const entryEmail = normalizeValue(entry.email);
    const entryName = normalizeValue(entry.name);

    return Boolean(
        (entryId && viewerKeys.ids.has(String(entryId)))
        || (entryFirebaseUid && viewerKeys.firebaseUids.has(String(entryFirebaseUid)))
        || (entryEmail && viewerKeys.emails.has(entryEmail))
        || (entryName && viewerKeys.names.has(entryName))
    );
}

function teamEntriesToParticipants(team) {
    if (!team) return [];

    if (team.player1 || team.player2) {
        return [
            participantToEntry(team.player1, 'Player 1'),
            participantToEntry(team.player2, 'Player 2')
        ].filter(entry => entry.id || entry.player_id || entry.email || entry.name);
    }

    return [participantToEntry(team, team?.team_name || team?.name || 'Participant')]
        .filter(entry => entry.id || entry.player_id || entry.email || entry.name);
}

function matchContainsViewer(match, viewerKeys, isDoubleElim = false) {
    if (!match) return false;

    if (isDoubleElim) {
        const participants = [
            ...teamEntriesToParticipants(match.team1),
            ...teamEntriesToParticipants(match.team2)
        ];
        return participants.some(entry => entryMatchesViewer(entry, viewerKeys));
    }

    return entryMatchesViewer(participantToEntry(match.player1, 'Player 1'), viewerKeys)
        || entryMatchesViewer(participantToEntry(match.player2, 'Player 2'), viewerKeys);
}

function getMatchViewerSide(match, viewerKeys, isDoubleElim = false) {
    if (!match) return null;

    if (isDoubleElim) {
        const side1Entries = teamEntriesToParticipants(match.team1);
        if (side1Entries.some(entry => entryMatchesViewer(entry, viewerKeys))) {
            return 'side1';
        }
        const side2Entries = teamEntriesToParticipants(match.team2);
        if (side2Entries.some(entry => entryMatchesViewer(entry, viewerKeys))) {
            return 'side2';
        }
        return null;
    }

    if (entryMatchesViewer(participantToEntry(match.player1, 'Player 1'), viewerKeys)) {
        return 'side1';
    }
    if (entryMatchesViewer(participantToEntry(match.player2, 'Player 2'), viewerKeys)) {
        return 'side2';
    }
    return null;
}

function normalizeReadyState(match = {}) {
    const ready = match.match_ready || {};
    return {
        side1: ready.side1 === true,
        side2: ready.side2 === true,
        updated_at: ready.updated_at || null,
        side1_at: ready.side1_at || null,
        side2_at: ready.side2_at || null,
        side1_by: ready.side1_by || null,
        side2_by: ready.side2_by || null
    };
}

function normalizeResultReview(match = {}) {
    const review = match.result_review || {};
    return {
        status: review.status || null,
        submitted_by_side: review.submitted_by_side || null,
        side1_confirmed: review.side1_confirmed === true,
        side2_confirmed: review.side2_confirmed === true,
        disputed_by_side: review.disputed_by_side || null,
        dispute_notes: review.dispute_notes || null,
        submitted_at: review.submitted_at || null,
        confirmed_at: review.confirmed_at || null,
        disputed_at: review.disputed_at || null,
        resolved_at: review.resolved_at || null,
        resolved_by: review.resolved_by || null,
        resolution_notes: review.resolution_notes || null
    };
}

function hasBothMatchSides(match, isDoubleElim = false) {
    if (!match) return false;
    if (isDoubleElim) {
        return Boolean(match.team1 && match.team2);
    }
    return Boolean(match.player1 && match.player2);
}

function isMatchReadyFlagged(match = {}) {
    const ready = normalizeReadyState(match);
    return ready.side1 && ready.side2;
}

function buildResultReviewForSubmission(match, viewerSide, actor) {
    const existing = normalizeResultReview(match);
    const submittedAt = admin.firestore.Timestamp.now();

    const review = {
        ...existing,
        status: 'pending_confirmation',
        submitted_by_side: viewerSide || existing.submitted_by_side || null,
        submitted_at: submittedAt,
        disputed_by_side: null,
        dispute_notes: null,
        disputed_at: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null
    };

    if (viewerSide === 'side1') {
        review.side1_confirmed = true;
        review.side2_confirmed = false;
    } else if (viewerSide === 'side2') {
        review.side2_confirmed = true;
        review.side1_confirmed = false;
    } else {
        review.side1_confirmed = existing.side1_confirmed === true;
        review.side2_confirmed = existing.side2_confirmed === true;
    }

    if (actor?.role && ['host', 'staff', 'admin'].includes(actor.role) && !viewerSide) {
        review.status = 'staff_recorded';
    }

    return review;
}

async function requireTournamentMatchAccess(req, tournamentId, matchId) {
    try {
        const access = await requireTournamentAccess(req, tournamentId);
        const bracket = access.tournament?.bracket || {};
        const matchLocation = bracket.type === 'double_elimination'
            ? findDoubleElimMatch(bracket, matchId)
            : findSingleElimMatch(bracket, matchId);

        if (!matchLocation?.match) {
            const err = new Error('Match not found');
            err.status = 404;
            throw err;
        }

        return { ...access, bracket, matchLocation };
    } catch (accessError) {
        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            throw accessError;
        }

        const context = await getTournamentContext(tournamentId);
        if (!context) {
            const err = new Error('Tournament not found');
            err.status = 404;
            throw err;
        }

        const bracket = context.tournament?.bracket || {};
        const isDoubleElim = bracket.type === 'double_elimination';
        const matchLocation = isDoubleElim
            ? findDoubleElimMatch(bracket, matchId)
            : findSingleElimMatch(bracket, matchId);

        if (!matchLocation?.match) {
            const err = new Error('Match not found');
            err.status = 404;
            throw err;
        }

        const viewerKeys = collectViewerKeys(authPlayer);
        if (!matchContainsViewer(matchLocation.match, viewerKeys, isDoubleElim)) {
            throw accessError;
        }

        return {
            ...context,
            authPlayer,
            access_mode: 'match_participant',
            role: 'player',
            bracket,
            matchLocation
        };
    }
}

function flattenTournamentMatches(bracket = {}) {
    if (bracket?.type === 'double_elimination') {
        const winners = (bracket.winners || []).map(match => ({
            ...match,
            bracket_segment: 'winners'
        }));
        const losers = (bracket.losers || []).map(match => ({
            ...match,
            bracket_segment: 'losers'
        }));
        const grandFinals = [];

        if (bracket?.grand_finals?.match1) {
            grandFinals.push({
                ...bracket.grand_finals.match1,
                id: bracket.grand_finals.match1.id || 'gf-1',
                bracket_segment: 'grand_finals'
            });
        }

        if (bracket?.grand_finals?.match2) {
            grandFinals.push({
                ...bracket.grand_finals.match2,
                id: bracket.grand_finals.match2.id || 'gf-2',
                bracket_segment: 'grand_finals_reset'
            });
        }

        return [...winners, ...losers, ...grandFinals];
    }

    return (bracket.matches || []).map(match => ({
        ...match,
        bracket_segment: 'main'
    }));
}

function buildTournamentMatchSummary(match, isDoubleElim = false) {
    const side1 = participantToEntry(isDoubleElim ? (match.team1 || match.player1) : match.player1, 'TBD');
    const side2 = participantToEntry(isDoubleElim ? (match.team2 || match.player2) : match.player2, 'TBD');
    const score1 = match?.scores?.team1 ?? match?.scores?.player1 ?? match?.score?.team1 ?? match?.score?.player1 ?? null;
    const score2 = match?.scores?.team2 ?? match?.scores?.player2 ?? match?.score?.team2 ?? match?.score?.player2 ?? null;

    const staleState = getMatchStaleState(match, isDoubleElim);

    return {
        id: match.id || match.match_id || null,
        round: match.round ?? null,
        position: match.position ?? null,
        bracket_segment: match.bracket_segment || null,
        status: match.status || 'waiting',
        side1,
        side2,
        score1,
        score2,
        winner_id: match.winner_id || match.winner?.id || match.winner || null,
        best_of: match.best_of || null,
        game_type: match.game_type || null,
        board: match.board || match.board_number || null,
        room_label: match.room_label || null,
        room_url: match.room_url || null,
        stream_url: match.stream_url || null,
        archive_url: match.archive_url || null,
        room_notes: match.room_notes || null,
        archive_notes: match.archive_notes || null,
        room_status: match.room_status || null,
        room_entity_id: match.room_entity_id || null,
        match_ready: normalizeReadyState(match),
        ready_to_start: isMatchReadyFlagged(match),
        result_review: normalizeResultReview(match),
        scoring_progress: match.scoring_progress || null,
        startedAt: match.startedAt || null,
        completedAt: match.completedAt || null,
        last_activity_at: staleState.last_activity_at,
        stale_state: staleState.state,
        stale_minutes: staleState.stale_minutes,
        reminder_sent_at: match.runtime_monitor?.last_reminder_sent_at || null
    };
}

function getMatchPriority(match) {
    if (match?.status === 'in_progress') return 1;
    if (match?.status === 'completed' && ['pending_confirmation', 'disputed', 'staff_recorded'].includes(match?.result_review?.status)) return 2;
    if (match?.status === 'ready') return 3;
    if (match?.status === 'pending') return 4;
    if (match?.status === 'waiting') return 5;
    if (match?.status === 'completed') return 6;
    return 7;
}

function shouldSurfaceAsRuntimeFocus(match) {
    return match?.status === 'in_progress'
        || match?.status === 'ready'
        || match?.status === 'pending'
        || (match?.status === 'completed' && ['pending_confirmation', 'disputed', 'staff_recorded'].includes(match?.result_review?.status));
}

function isCompletedMatchAwaitingReview(match) {
    return match?.status === 'completed'
        && ['pending_confirmation', 'disputed', 'staff_recorded'].includes(match?.result_review?.status);
}

function buildRuntimeAction(isRegistered, activeMatch, checkedIn = true, requireCheckIn = false) {
    if (!isRegistered) return 'register';
    if (requireCheckIn && !checkedIn) return 'check_in';
    if (!activeMatch) return 'await_assignment';
    if (activeMatch.status === 'in_progress') return 'continue_match';
    if (isCompletedMatchAwaitingReview(activeMatch)) return 'review_result';
    if ((activeMatch.status === 'pending' || activeMatch.status === 'ready') && !activeMatch.ready_to_start) return 'ready_up';
    if (activeMatch.status === 'ready' || activeMatch.status === 'pending') return 'launch_match';
    if (activeMatch.status === 'waiting') return 'await_opponent';
    return 'view_bracket';
}

function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function millisToTimestamp(millis) {
    return Number.isFinite(millis) ? admin.firestore.Timestamp.fromMillis(millis) : null;
}

function getMatchLastActivityMillis(match) {
    return [
        toMillis(match?.progress_updated_at),
        toMillis(match?.updated_at),
        toMillis(match?.completedAt),
        toMillis(match?.completed_at),
        toMillis(match?.startedAt),
        toMillis(match?.started_at),
        toMillis(match?.match_ready?.updated_at)
    ].find(value => Number.isFinite(value)) || null;
}

function getMatchStaleState(match, isDoubleElim = false) {
    const status = match?.status || 'waiting';
    const lastActivityMillis = getMatchLastActivityMillis(match);
    const lastActivityAt = millisToTimestamp(lastActivityMillis);
    if (!lastActivityMillis) {
        return {
            state: null,
            stale_minutes: null,
            last_activity_at: lastActivityAt
        };
    }

    const staleMinutes = Math.floor((Date.now() - lastActivityMillis) / 60000);
    const hasBothSides = hasBothMatchSides(match, isDoubleElim);

    if (status === 'in_progress' && staleMinutes >= MATCH_PROGRESS_STALE_MINUTES) {
        return {
            state: 'in_progress_idle',
            stale_minutes: staleMinutes,
            last_activity_at: lastActivityAt
        };
    }

    if (hasBothSides && (status === 'pending' || status === 'ready') && staleMinutes >= MATCH_READY_STALE_MINUTES) {
        return {
            state: 'awaiting_start',
            stale_minutes: staleMinutes,
            last_activity_at: lastActivityAt
        };
    }

    return {
        state: null,
        stale_minutes: staleMinutes,
        last_activity_at: lastActivityAt
    };
}

async function appendTournamentRuntimeAudit(tournamentRef, event = {}) {
    await tournamentRef.collection('runtime_audit').add({
        type: event.type || 'runtime_event',
        title: event.title || 'Tournament Runtime Update',
        body: event.body || '',
        tournament_id: event.tournament_id || tournamentRef.id,
        match_id: event.match_id || null,
        registration_id: event.registration_id || null,
        player_id: event.player_id || null,
        actor_id: event.actor_id || null,
        actor_name: event.actor_name || null,
        metadata: event.metadata || {},
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function upsertTournamentRuntimeRoom(tournamentRef, matchId, matchSnapshot = {}, patch = {}) {
    if (!matchId) return null;
    const roomRef = tournamentRef.collection('runtime_rooms').doc(matchId);
    const participantNames = [
        formatParticipantName(matchSnapshot.player1 || matchSnapshot.team1, 'Side 1'),
        formatParticipantName(matchSnapshot.player2 || matchSnapshot.team2, 'Side 2')
    ];
    const roomData = {
        id: matchId,
        match_id: matchId,
        room_label: patch.room_label || matchSnapshot.room_label || null,
        room_url: patch.room_url || matchSnapshot.room_url || null,
        stream_url: patch.stream_url || matchSnapshot.stream_url || null,
        archive_url: patch.archive_url || matchSnapshot.archive_url || null,
        room_notes: patch.room_notes || matchSnapshot.room_notes || null,
        archive_notes: patch.archive_notes || matchSnapshot.archive_notes || null,
        room_status: patch.room_status || matchSnapshot.room_status || 'open',
        board: patch.board || patch.board_number || matchSnapshot.board || matchSnapshot.board_number || null,
        participants: participantNames,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    if (roomData.room_status === 'open') {
        roomData.opened_at = admin.firestore.FieldValue.serverTimestamp();
        roomData.closed_at = null;
        roomData.archived_at = null;
    }
    if (roomData.room_status === 'closed') {
        roomData.closed_at = admin.firestore.FieldValue.serverTimestamp();
    }
    if (roomData.room_status === 'archived') {
        roomData.archived_at = admin.firestore.FieldValue.serverTimestamp();
    }

    await roomRef.set(roomData, { merge: true });
    return {
        ...roomData,
        room_entity_id: roomRef.id
    };
}

function shouldSendReminder(match, isDoubleElim = false) {
    const stale = getMatchStaleState(match, isDoubleElim);
    if (!stale.state) return false;
    const lastReminderMillis = toMillis(match?.runtime_monitor?.last_reminder_sent_at);
    if (!lastReminderMillis) return true;
    return ((Date.now() - lastReminderMillis) / 60000) >= RUNTIME_REMINDER_COOLDOWN_MINUTES;
}

async function syncMatchSubcollectionDoc(tournamentRef, matchId, patch, matchSnapshot = null) {
    if (!matchId) return;

    const matchRef = tournamentRef.collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();
    const existing = matchDoc.exists ? matchDoc.data() : {};
    const source = matchSnapshot || {};

    const team1Name = source.team1_name
        || source.team1?.team_name
        || source.team1?.name
        || existing.team1_name
        || 'Team 1';
    const team2Name = source.team2_name
        || source.team2?.team_name
        || source.team2?.name
        || existing.team2_name
        || 'Team 2';

    await matchRef.set({
        ...existing,
        ...patch,
        id: matchId,
        match_id: matchId,
        team1_name: team1Name,
        team2_name: team2Name,
        round: source.round ?? existing.round ?? null,
        bracket: source.bracket ?? existing.bracket ?? null,
        room_status: source.room_status ?? patch.room_status ?? existing.room_status ?? null,
        room_entity_id: source.room_entity_id ?? patch.room_entity_id ?? existing.room_entity_id ?? null,
        runtime_monitor: source.runtime_monitor ?? patch.runtime_monitor ?? existing.runtime_monitor ?? null,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function updateTournamentPlayerCheckInState(tournamentRef, tournament, authPlayer, checkedIn) {
    const [registrationsSnap, playersSnap] = await Promise.all([
        tournamentRef.collection('registrations').get().catch(() => null),
        tournamentRef.collection('players').get().catch(() => null)
    ]);

    const registrations = registrationsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
    const tournamentPlayers = playersSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

    const registration = registrations.find(item =>
        (item.player_id && item.player_id === authPlayer.id)
        || (item.email && normalizeValue(item.email) === normalizeValue(authPlayer.email))
        || (item.full_name && normalizeValue(item.full_name) === normalizeValue(authPlayer.name))
        || (item.name && normalizeValue(item.name) === normalizeValue(authPlayer.name))
    ) || null;

    const tournamentPlayer = tournamentPlayers.find(item =>
        item.id === authPlayer.id
        || (item.player_id && item.player_id === authPlayer.id)
        || (item.email && normalizeValue(item.email) === normalizeValue(authPlayer.email))
        || ((item.name || item.player_name) && normalizeValue(item.name || item.player_name) === normalizeValue(authPlayer.name))
    ) || null;

    if (!registration && !tournamentPlayer) {
        const err = new Error('Tournament registration not found for signed-in player');
        err.status = 404;
        throw err;
    }

    const batch = admin.firestore().batch();
    if (registration?.id) {
        batch.set(tournamentRef.collection('registrations').doc(registration.id), {
            checked_in: checkedIn,
            runtime_status: checkedIn ? 'active' : (registration.runtime_status || 'active'),
            checked_in_at: checkedIn ? admin.firestore.FieldValue.serverTimestamp() : null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    const tournamentPlayerId = tournamentPlayer?.id || registration?.player_id || authPlayer.id;
    if (tournamentPlayerId) {
        batch.set(tournamentRef.collection('players').doc(tournamentPlayerId), {
            checkedIn: checkedIn,
            checked_in: checkedIn,
            runtime_status: checkedIn ? 'active' : (tournamentPlayer?.runtime_status || 'active'),
            checked_in_at: checkedIn ? admin.firestore.FieldValue.serverTimestamp() : null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(tournamentRef, {
            players: {
                [tournamentPlayerId]: {
                    ...(tournament.players?.[tournamentPlayerId] || {}),
                    id: tournamentPlayerId,
                    player_id: tournamentPlayerId,
                    checkedIn: checkedIn,
                    checked_in: checkedIn,
                    runtime_status: checkedIn ? 'active' : (tournament.players?.[tournamentPlayerId]?.runtime_status || 'active')
                }
            }
        }, { merge: true });
    }

    await batch.commit();

    return {
        registration_id: registration?.id || null,
        player_id: tournamentPlayerId || null,
        checked_in: checkedIn
    };
}

async function updateSpecificTournamentCheckInState(tournamentRef, tournament, { registrationId = null, playerId = null }, checkedIn) {
    const [registrationsSnap, playersSnap] = await Promise.all([
        tournamentRef.collection('registrations').get().catch(() => null),
        tournamentRef.collection('players').get().catch(() => null)
    ]);

    const registrations = registrationsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
    const tournamentPlayers = playersSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

    const registration = registrationId
        ? registrations.find(item => item.id === registrationId) || null
        : (playerId ? registrations.find(item => item.player_id === playerId) || null : null);
    const tournamentPlayer = playerId
        ? tournamentPlayers.find(item => item.id === playerId || item.player_id === playerId) || null
        : (registration?.player_id ? tournamentPlayers.find(item => item.id === registration.player_id || item.player_id === registration.player_id) || null : null);

    if (!registration && !tournamentPlayer) {
        const err = new Error('Tournament participant not found');
        err.status = 404;
        throw err;
    }

    const batch = admin.firestore().batch();
    if (registration?.id) {
        batch.set(tournamentRef.collection('registrations').doc(registration.id), {
            checked_in: checkedIn,
            runtime_status: checkedIn ? 'active' : (registration.runtime_status || 'active'),
            checked_in_at: checkedIn ? admin.firestore.FieldValue.serverTimestamp() : null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    const tournamentPlayerId = tournamentPlayer?.id || registration?.player_id || playerId || null;
    if (tournamentPlayerId) {
        batch.set(tournamentRef.collection('players').doc(tournamentPlayerId), {
            checkedIn: checkedIn,
            checked_in: checkedIn,
            runtime_status: checkedIn ? 'active' : (tournamentPlayer?.runtime_status || 'active'),
            checked_in_at: checkedIn ? admin.firestore.FieldValue.serverTimestamp() : null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(tournamentRef, {
            players: {
                [tournamentPlayerId]: {
                    ...(tournament.players?.[tournamentPlayerId] || {}),
                    id: tournamentPlayerId,
                    player_id: tournamentPlayerId,
                    checkedIn: checkedIn,
                    checked_in: checkedIn,
                    runtime_status: checkedIn ? 'active' : (tournament.players?.[tournamentPlayerId]?.runtime_status || 'active')
                }
            }
        }, { merge: true });
    }

    await batch.commit();

    return {
        registration_id: registration?.id || null,
        player_id: tournamentPlayerId || null,
        checked_in: checkedIn
    };
}

async function updateTournamentParticipantAvailability(tournamentRef, tournament, { registrationId = null, playerId = null }, runtimeStatus = 'active') {
    const [registrationsSnap, playersSnap] = await Promise.all([
        tournamentRef.collection('registrations').get().catch(() => null),
        tournamentRef.collection('players').get().catch(() => null)
    ]);

    const registrations = registrationsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
    const tournamentPlayers = playersSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

    const registration = registrationId
        ? registrations.find(item => item.id === registrationId) || null
        : (playerId ? registrations.find(item => item.player_id === playerId) || null : null);
    const tournamentPlayer = playerId
        ? tournamentPlayers.find(item => item.id === playerId || item.player_id === playerId) || null
        : (registration?.player_id ? tournamentPlayers.find(item => item.id === registration.player_id || item.player_id === registration.player_id) || null : null);

    if (!registration && !tournamentPlayer) {
        const err = new Error('Tournament participant not found');
        err.status = 404;
        throw err;
    }

    const checkedIn = runtimeStatus === 'active'
        ? (registration?.checked_in === true || tournamentPlayer?.checkedIn === true)
        : false;
    const batch = admin.firestore().batch();

    if (registration?.id) {
        batch.set(tournamentRef.collection('registrations').doc(registration.id), {
            runtime_status: runtimeStatus,
            checked_in: checkedIn,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    const tournamentPlayerId = tournamentPlayer?.id || registration?.player_id || playerId || null;
    if (tournamentPlayerId) {
        batch.set(tournamentRef.collection('players').doc(tournamentPlayerId), {
            runtime_status: runtimeStatus,
            checkedIn: checkedIn,
            checked_in: checkedIn,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batch.set(tournamentRef, {
            players: {
                [tournamentPlayerId]: {
                    ...(tournament.players?.[tournamentPlayerId] || {}),
                    id: tournamentPlayerId,
                    player_id: tournamentPlayerId,
                    runtime_status: runtimeStatus,
                    checkedIn: checkedIn,
                    checked_in: checkedIn
                }
            }
        }, { merge: true });
    }

    await batch.commit();

    return {
        registration_id: registration?.id || null,
        player_id: tournamentPlayerId || null,
        runtime_status: runtimeStatus,
        checked_in: checkedIn,
        name: registration?.full_name || registration?.name || tournamentPlayer?.name || tournamentPlayer?.player_name || 'Player'
    };
}

function buildDefaultRoomLabel(match) {
    if (match?.board || match?.board_number) {
        return `Board ${match.board || match.board_number}`;
    }
    const round = match?.round ? `Round ${match.round}` : 'Match';
    const pos = Number.isFinite(match?.position) ? ` #${match.position + 1}` : '';
    return `${round}${pos}`;
}

async function sendTournamentRuntimeNotification(playerIds = [], payload = {}) {
    const uniqueIds = [...new Set((playerIds || []).filter(Boolean).map(String))];
    if (!uniqueIds.length) return;

    const {
        title = 'Tournament Update',
        body = '',
        type = 'tournament_update',
        tournament_id = null,
        match_id = null,
        link = '/pages/tournaments.html'
    } = payload;

    await Promise.all(uniqueIds.map(async (pid) => {
        try {
            const tokenDoc = await admin.firestore().collection('fcm_tokens').doc(pid).get();
            if (!tokenDoc.exists || !tokenDoc.data()?.token) return;

            const message = {
                token: tokenDoc.data().token,
                notification: { title, body },
                data: {
                    title,
                    body,
                    type,
                    tournament_id: tournament_id || '',
                    match_id: match_id || '',
                    link
                },
                webpush: {
                    notification: {
                        title,
                        body,
                        icon: '/images/gold_logo.png',
                        badge: '/images/gold_logo.png'
                    },
                    fcmOptions: { link }
                }
            };
            await admin.messaging().send(message);
        } catch (error) {
            console.log(`Tournament runtime notification failed for ${pid}:`, error.message);
        }
    }));
}

function getMatchParticipantIds(match, isDoubleElim = false) {
    const ids = new Set();
    const addTeamPlayerIds = (team) => {
        if (!Array.isArray(team?.players)) return;
        team.players.forEach(player => {
            if (player?.player_id) ids.add(String(player.player_id));
            else if (player?.id && !String(player.id).startsWith('draw_team_')) ids.add(String(player.id));
        });
    };

    if (isDoubleElim) {
        [match?.team1, match?.team2].forEach(team => {
            if (!team) return;
            if (team.player1?.player_id) ids.add(String(team.player1.player_id));
            if (team.player2?.player_id) ids.add(String(team.player2.player_id));
            if (team.player_id) ids.add(String(team.player_id));
            if (team.id && !String(team.id).startsWith('draw_team_')) ids.add(String(team.id));
            addTeamPlayerIds(team);
        });
    } else {
        if (match?.player1?.player_id) ids.add(String(match.player1.player_id));
        if (match?.player2?.player_id) ids.add(String(match.player2.player_id));
        if (match?.player1?.id && !String(match.player1.id).startsWith('draw_team_')) ids.add(String(match.player1.id));
        if (match?.player2?.id && !String(match.player2.id).startsWith('draw_team_')) ids.add(String(match.player2.id));
        addTeamPlayerIds(match?.player1);
        addTeamPlayerIds(match?.player2);
    }
    return [...ids];
}

function normalizeRuntimeNotificationPreference(contact = {}) {
    const preference = String(contact.notification_preference || '').trim().toLowerCase();
    if (['sms', 'email', 'both'].includes(preference)) return preference;
    return contact.sms_opt_in === false ? 'email' : 'both';
}

function formatPhoneE164(phone) {
    if (!phone) return null;
    const raw = String(phone).trim();
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
}

function getMatchParticipants(match, isDoubleElim = false) {
    return isDoubleElim
        ? [match?.team1, match?.team2].filter(Boolean)
        : [match?.player1, match?.player2].filter(Boolean);
}

function collectParticipantContactSeeds(participant) {
    if (!participant || typeof participant === 'string') return [];
    const seeds = [];
    if (Array.isArray(participant.players)) seeds.push(...participant.players);
    if (participant.player1) seeds.push(participant.player1);
    if (participant.player2) seeds.push(participant.player2);
    if (!seeds.length || participant.registration_id || participant.email || participant.phone) {
        seeds.push(participant);
    }
    return seeds.filter(Boolean);
}

function mergeRuntimeContact(seed = {}, registration = null, tournamentPlayer = null) {
    const data = {
        ...(seed || {}),
        ...(tournamentPlayer || {}),
        ...(registration || {})
    };
    const preference = normalizeRuntimeNotificationPreference(data);
    return {
        registration_id: data.registration_id || seed.registration_id || registration?.id || null,
        player_id: data.player_id || data.playerId || seed.player_id || null,
        name: data.full_name || data.name || data.player_name || seed.name || 'Player',
        email: data.email || null,
        phone: data.phone || null,
        phone_e164: formatPhoneE164(data.phone),
        notification_preference: preference,
        sms_opt_in: data.sms_opt_in !== false,
        email_opt_in: data.email_opt_in !== false,
        is_house: data.is_house === true
    };
}

async function collectTournamentMatchContacts(tournamentRef, match, isDoubleElim = false) {
    const contacts = [];
    const seen = new Set();
    const participants = getMatchParticipants(match, isDoubleElim);

    for (const participant of participants) {
        for (const seed of collectParticipantContactSeeds(participant)) {
            if (seed.is_house === true) continue;

            let registration = null;
            let tournamentPlayer = null;

            if (seed.registration_id) {
                try {
                    const regDoc = await tournamentRef.collection('registrations').doc(String(seed.registration_id)).get();
                    if (regDoc.exists) registration = { id: regDoc.id, ...regDoc.data() };
                } catch (error) {
                    console.log(`Registration contact lookup failed for ${seed.registration_id}:`, error.message);
                }
            }

            const playerId = seed.player_id || seed.playerId || registration?.player_id || null;
            if (playerId) {
                try {
                    const playerDoc = await tournamentRef.collection('players').doc(String(playerId)).get();
                    if (playerDoc.exists) tournamentPlayer = { id: playerDoc.id, ...playerDoc.data() };
                } catch (error) {
                    console.log(`Tournament player contact lookup failed for ${playerId}:`, error.message);
                }
            }

            const contact = mergeRuntimeContact(seed, registration, tournamentPlayer);
            const key = contact.registration_id
                || contact.player_id
                || contact.email
                || contact.phone_e164
                || contact.name;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            contacts.push(contact);
        }
    }

    return contacts;
}

function buildRuntimeDirectNotificationPlan(contacts = [], payload = {}) {
    const {
        title = 'Tournament Match Reminder',
        body = 'Your tournament match is ready to start. Please join now.',
        tournamentName = 'BRDC tournament',
        matchLabel = 'your match',
        link = 'https://brdc-v2.web.app/pages/tournaments.html'
    } = payload;

    const sms = [];
    const email = [];

    contacts.forEach(contact => {
        if (contact.is_house) return;
        const preference = normalizeRuntimeNotificationPreference(contact);
        if ((preference === 'sms' || preference === 'both') && contact.sms_opt_in !== false && contact.phone_e164) {
            sms.push({
                contact,
                to: contact.phone_e164,
                body: `BRDC: You're up for ${tournamentName}: ${matchLabel}. ${body} ${link}`.slice(0, 500)
            });
        }
        if ((preference === 'email' || preference === 'both') && contact.email_opt_in !== false && contact.email) {
            email.push({
                contact,
                to: contact.email,
                subject: title,
                body: `<p>${body}</p><p><strong>${matchLabel}</strong></p><p><a href="${link}">Open the tournament bracket</a></p>`
            });
        }
    });

    return { sms, email };
}

async function sendTournamentRuntimeDirectNotifications(tournamentRef, contacts, payload = {}) {
    const plan = buildRuntimeDirectNotificationPlan(contacts, payload);
    const db = admin.firestore();
    const results = [];

    for (const item of plan.sms) {
        const result = await sendManagedSms(item.to, item.body);
        results.push({ type: 'sms', to: item.to, success: result.success === true, simulated: result.simulated === true, error: result.error || null });
    }

    for (const item of plan.email) {
        const result = await sendManagedEmail(item.to, item.subject, item.body);
        results.push({ type: 'email', to: item.to, success: result.success === true, simulated: result.simulated === true, error: result.error || null });
    }

    await Promise.all(results.map(result => db.collection('notifications').add({
        ...result,
        context: 'tournament_runtime_reminder',
        tournament_id: payload.tournament_id || null,
        match_id: payload.match_id || null,
        status: result.success || result.simulated ? 'sent' : 'failed',
        sent_at: admin.firestore.FieldValue.serverTimestamp()
    }).catch(error => console.log('Runtime notification audit write failed:', error.message))));

    return {
        contact_count: contacts.length,
        sms_attempted: plan.sms.length,
        email_attempted: plan.email.length,
        sent: results.filter(result => result.success || result.simulated).length,
        failed: results.filter(result => !(result.success || result.simulated)).length,
        results
    };
}

function formatParticipantName(entry, fallback = 'Player') {
    return participantToEntry(entry, fallback).name || fallback;
}

exports.submitMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, player1_score, player2_score, game_stats } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        if (!match_id) {
            return res.status(400).json({ error: 'Missing match_id' });
        }

        if (player1_score === undefined || player2_score === undefined) {
            return res.status(400).json({ error: 'Missing scores' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament: tournamentData, bracket, matchLocation, authPlayer, role } = access;

        if (!bracket.matches) {
            return res.status(400).json({ error: 'No bracket generated' });
        }

        const matchIndex = matchLocation.matchIndex;
        const match = matchLocation.match;

        if (match.status === 'completed') {
            return res.json({
                success: true,
                match: match,
                status: 'already_completed',
                tournament_complete: tournamentData.completed === true
            });
        }

        const viewerKeys = collectViewerKeys(authPlayer);
        const viewerSide = getMatchViewerSide(match, viewerKeys, false);
        const resultReview = buildResultReviewForSubmission(match, viewerSide, { role });

        // Determine winner
        const winner = player1_score > player2_score ? match.player1 : match.player2;
        const winner_id = winner?.id || winner?.player_id || null;

        // Update match with comprehensive stats (DartConnect compatible)
        bracket.matches[matchIndex] = {
            ...match,
            score: {
                player1: player1_score,
                player2: player2_score
            },
            winner: winner,
            status: 'completed',
            completedAt: admin.firestore.Timestamp.now(),
            match_ready: normalizeReadyState(match),
            result_review: resultReview,
            scoring_progress: null,
            progress_updated_at: null,
            // Store comprehensive game stats if provided
            ...(game_stats && { stats: game_stats })
        };

        // Advance winner to next round if applicable
        if (match.round < bracket.totalRounds) {
            const nextRoundMatches = bracket.matches.filter(m => m.round === match.round + 1);
            const nextMatchPosition = Math.floor(match.position / 2);
            const nextMatch = nextRoundMatches[nextMatchPosition];

            if (nextMatch) {
                const nextMatchIndex = bracket.matches.findIndex(m => m.id === nextMatch.id);
                const isPlayer1Slot = match.position % 2 === 0;

                if (isPlayer1Slot) {
                    bracket.matches[nextMatchIndex].player1 = winner;
                } else {
                    bracket.matches[nextMatchIndex].player2 = winner;
                }

                // If both players are now set, make the match active
                if (bracket.matches[nextMatchIndex].player1 && bracket.matches[nextMatchIndex].player2) {
                    bracket.matches[nextMatchIndex].status = 'pending';
                }
            }
        }

        // Check if tournament is complete
        const allMatchesComplete = bracket.matches.every(m => m.status === 'completed');
        const finalMatch = bracket.matches.find(m => m.round === bracket.totalRounds);
        const tournamentComplete = finalMatch && finalMatch.status === 'completed';

        // Update tournament
        await tournamentRef.update({
            bracket: bracket,
            completed: tournamentComplete,
            ...(tournamentComplete && {
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                winner: finalMatch.winner
            })
        });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                status: 'completed',
                score: bracket.matches[matchIndex].score,
                winner: bracket.matches[matchIndex].winner,
                completedAt: bracket.matches[matchIndex].completedAt,
                result_review: resultReview,
                scoring_progress: admin.firestore.FieldValue.delete(),
                progress_updated_at: admin.firestore.FieldValue.delete()
            },
            bracket.matches[matchIndex]
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'result_submitted',
            title: 'Result submitted',
            body: `${formatParticipantName(match.player1)} vs ${formatParticipantName(match.player2)} was submitted ${player1_score}-${player2_score}.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { score: bracket.matches[matchIndex].score || null, winner_id }
        });

        if (tournamentData.enable_runtime_notifications === true || tournamentData.runtime_settings?.enable_runtime_notifications === true) {
            await sendTournamentRuntimeNotification(
                getMatchParticipantIds(bracket.matches[matchIndex], false),
                {
                    title: 'Tournament Result Submitted',
                    body: `${formatParticipantName(match.player1)} vs ${formatParticipantName(match.player2)} is awaiting confirmation.`,
                    type: 'tournament_result_submitted',
                    tournament_id,
                    match_id,
                    link: `/pages/tournament-view.html?tournament_id=${tournament_id}`
                }
            );
        }

        // Process stats if game_stats provided
        if (game_stats) {
            const format = game_stats.format || tournamentData.format || '501';
            await processTournamentMatchStats(
                tournament_id,
                bracket.matches[matchIndex],
                game_stats,
                format
            );
        }

        res.json({
            success: true,
            match: bracket.matches[matchIndex],
            tournament_complete: tournamentComplete,
            ...(tournamentComplete && { winner: finalMatch.winner })
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// =============================================================================
// DOUBLE ELIMINATION MATCH RESULT (Mixed Doubles Matchmaker Format)
// =============================================================================

/**
 * Submit match result for double-elimination tournaments
 * Handles advancement in both winners and losers brackets
 * Triggers the mingle flow when team loses in Winners Bracket
 *
 * POST /submitDoubleElimMatchResult
 */
exports.submitDoubleElimMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            tournament_id,
            match_id,
            team1_score,
            team2_score,
            game_stats
        } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        if (team1_score === undefined || team2_score === undefined) {
            return res.status(400).json({ success: false, error: 'Missing scores' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament, bracket, matchLocation, authPlayer, role } = access;

        if (!bracket || bracket.type !== 'double_elimination') {
            return res.status(400).json({ success: false, error: 'Not a double elimination bracket' });
        }

        // Validate bracket structure
        if (!bracket.winners || !bracket.losers || !bracket.grand_finals) {
            return res.status(500).json({
                success: false,
                error: 'Invalid bracket structure - missing required arrays'
            });
        }

        let match = matchLocation?.match || null;
        let matchArrayName = matchLocation?.matchArrayName || null;
        let matchIndex = matchLocation?.matchIndex ?? -1;

        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        // Validate match status - prevent resubmitting completed matches
        if (match.status === 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Match already completed',
                match: match
            });
        }

        // Validate match is ready to play
        if (match.status === 'waiting') {
            return res.status(400).json({
                success: false,
                error: 'Match not ready - waiting for teams',
                match: match
            });
        }

        const viewerKeys = collectViewerKeys(authPlayer);
        const viewerSide = getMatchViewerSide(match, viewerKeys, true);
        const resultReview = buildResultReviewForSubmission(match, viewerSide, { role });

        // Determine winner and loser
        const team1Won = team1_score > team2_score;
        const winner_id = team1Won ? match.team1_id : match.team2_id;
        const loser_id = team1Won ? match.team2_id : match.team1_id;
        const winner = team1Won ? match.team1 : match.team2;
        const loser = team1Won ? match.team2 : match.team1;

        // Update match result
        const updatedMatch = {
            ...match,
            scores: { team1: team1_score, team2: team2_score },
            winner_id,
            loser_id,
            status: 'completed',
            completed_at: admin.firestore.Timestamp.now(),
            match_ready: normalizeReadyState(match),
            result_review: resultReview,
            scoring_progress: null,
            progress_updated_at: null,
            ...(game_stats && { stats: game_stats })
        };

        // Track what actions to take
        let mingleTriggered = false;
        let teamEliminated = false;
        let advancedToNext = null;
        let droppedToLosers = null;
        let tournamentComplete = false;
        let tournamentChampion = null;

        // Handle advancement based on which bracket
        if (matchArrayName === 'winners') {
            // Winners Bracket: Winner advances in WC, loser goes to LC
            bracket.winners[matchIndex] = updatedMatch;

            // Advance winner in WC
            const advanceResult = advanceInWinnersBracket(bracket, match, winner_id, winner);
            advancedToNext = advanceResult.nextMatchId;

            // Check if this is WC Finals
            if (match.round === bracket.winners_rounds) {
                bracket.wc_champion_id = winner_id;
                bracket.wc_complete = true;

                // Place WC champion in Grand Finals
                bracket.grand_finals.match1.team1_id = winner_id;
                bracket.grand_finals.match1.team1 = winner;

                // Check if LC is also complete
                if (bracket.lc_champion_id) {
                    bracket.grand_finals.match1.team2_id = bracket.lc_champion_id;
                    // Get LC champion team data
                    const lcFinal = bracket.losers.find(m =>
                        m.round === bracket.losers_rounds && m.status === 'completed'
                    );
                    if (lcFinal) {
                        bracket.grand_finals.match1.team2 = lcFinal.winner_id === lcFinal.team1_id
                            ? lcFinal.team1 : lcFinal.team2;
                    }
                    bracket.grand_finals.match1.status = 'pending';
                }
            }

            // Drop loser to Losers Bracket (triggers mingle flow)
            const dropResult = dropToLosersBracket(bracket, match, loser_id, loser);
            droppedToLosers = dropResult.lcMatchId;
            mingleTriggered = true;

        } else if (matchArrayName === 'losers') {
            // Losers Bracket: Winner advances in LC, loser is ELIMINATED
            bracket.losers[matchIndex] = updatedMatch;

            // Advance winner in LC
            const advanceResult = advanceInLosersBracket(bracket, match, winner_id, winner);
            advancedToNext = advanceResult.nextMatchId;

            // Check if this is LC Finals
            if (match.round === bracket.losers_rounds) {
                bracket.lc_champion_id = winner_id;
                bracket.lc_complete = true;

                // Place LC champion in Grand Finals
                bracket.grand_finals.match1.team2_id = winner_id;
                bracket.grand_finals.match1.team2 = winner;

                // Check if WC champion is waiting
                if (bracket.wc_champion_id) {
                    bracket.grand_finals.match1.status = 'pending';
                }
            }

            // Loser is eliminated (2nd loss)
            teamEliminated = true;

        } else if (matchArrayName === 'grand_finals_1') {
            // Grand Finals Match 1
            bracket.grand_finals.match1 = updatedMatch;

            if (winner_id === bracket.wc_champion_id) {
                // WC Champion wins - Tournament over!
                tournamentComplete = true;
                tournamentChampion = winner;
                bracket.tournament_champion_id = winner_id;
            } else {
                // LC Champion wins - Bracket reset needed!
                // Both teams get one loss, must play again

                // Verify champions are set
                if (!bracket.wc_champion_id || !bracket.lc_champion_id) {
                    return res.status(500).json({
                        success: false,
                        error: 'Cannot create bracket reset - champions not properly set'
                    });
                }

                // Get team data from the match we just completed
                const wcChampTeam = winner_id === bracket.wc_champion_id ? winner : loser;
                const lcChampTeam = winner_id === bracket.lc_champion_id ? winner : loser;

                bracket.grand_finals.bracket_reset_needed = true;
                bracket.grand_finals.match2 = {
                    id: 'gf-2',
                    round: 'grand_finals_reset',
                    team1_id: bracket.wc_champion_id,
                    team2_id: bracket.lc_champion_id,
                    team1: wcChampTeam,
                    team2: lcChampTeam,
                    winner_id: null,
                    scores: null,
                    status: 'pending',
                    board: null,
                    game_type: tournament.winners_game_type || 'cricket',
                    best_of: tournament.winners_best_of || 3
                };
            }

        } else if (matchArrayName === 'grand_finals_2') {
            // Grand Finals Match 2 (Bracket Reset)
            bracket.grand_finals.match2 = updatedMatch;
            tournamentComplete = true;
            tournamentChampion = winner;
            bracket.tournament_champion_id = winner_id;
        }

        // Check if mingle period should end
        // Mingle ends when LAST WC R2 match STARTS (not ends)
        checkMingleStatus(bracket);

        // Save updated bracket
        await tournamentRef.update({
            bracket: bracket,
            completed: tournamentComplete,
            ...(tournamentComplete && {
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                champion: tournamentChampion,
                champion_id: bracket.tournament_champion_id
            })
        });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                status: 'completed',
                scores: updatedMatch.scores,
                winner_id: updatedMatch.winner_id,
                loser_id: updatedMatch.loser_id,
                completed_at: updatedMatch.completed_at,
                result_review: resultReview,
                scoring_progress: admin.firestore.FieldValue.delete(),
                progress_updated_at: admin.firestore.FieldValue.delete(),
                board_number: updatedMatch.board ?? updatedMatch.board_number ?? null,
                board: updatedMatch.board ?? updatedMatch.board_number ?? null
            },
            updatedMatch
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'result_submitted',
            title: 'Result submitted',
            body: `${updatedMatch.team1?.team_name || updatedMatch.team1?.name || 'Team 1'} vs ${updatedMatch.team2?.team_name || updatedMatch.team2?.name || 'Team 2'} was submitted.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { winner_id: updatedMatch.winner_id || null, loser_id: updatedMatch.loser_id || null }
        });

        if (tournament.enable_runtime_notifications === true || tournament.runtime_settings?.enable_runtime_notifications === true) {
            await sendTournamentRuntimeNotification(
                getMatchParticipantIds(updatedMatch, true),
                {
                    title: 'Tournament Result Submitted',
                    body: `${updatedMatch.team1?.team_name || updatedMatch.team1?.name || 'Team 1'} vs ${updatedMatch.team2?.team_name || updatedMatch.team2?.name || 'Team 2'} is awaiting confirmation.`,
                    type: 'tournament_result_submitted',
                    tournament_id,
                    match_id,
                    link: `/pages/tournament-bracket.html?tournament_id=${tournament_id}`
                }
            );
        }

        // Process stats if provided
        if (game_stats) {
            const format = matchArrayName === 'losers'
                ? (tournament.losers_game_type || '501')
                : (tournament.winners_game_type || 'cricket');

            await processTournamentMatchStats(tournament_id, updatedMatch, game_stats, format);
        }

        // Write heartbroken doc so mingle/bracket pages can find it
        // (Previously only triggered from director dashboard â€” now works from scorer too)
        if (mingleTriggered && loser && loser_id) {
            try {
                const heartbrokenRef = tournamentRef.collection('heartbroken').doc(loser_id);
                const existing = await heartbrokenRef.get();
                if (!existing.exists) {
                    // Find the winning team name for the "lost to" display
                    const winnerTeamName = winner?.team_name || winner?.name || 'Unknown';
                    await heartbrokenRef.set({
                        team_name: loser.team_name || loser.name || 'Unknown',
                        player1: loser.player1 || null,
                        player2: loser.player2 || null,
                        lost_to_team_name: winnerTeamName,
                        heartbroken_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                    console.log(`Heartbroken doc created for team ${loser_id}`);
                }
            } catch (hbErr) {
                console.error('Error creating heartbroken doc:', hbErr.message);
            }
        }

        // Send mingle notifications when team loses in Winners Bracket
        if (mingleTriggered && loser && loser_id) {
            const playerIds = [];
            if (loser.player1?.player_id) playerIds.push(loser.player1.player_id);
            if (loser.player2?.player_id) playerIds.push(loser.player2.player_id);

            if (playerIds.length > 0) {
                const title = 'Mingle decision needed';
                const body = 'Your team lost in the Winners Bracket. Time to decide whether to split up or stay together.';

                // Fire-and-forget: don't await, don't block response
                Promise.all(playerIds.map(async (pid) => {
                    try {
                        const tokenDoc = await admin.firestore().collection('fcm_tokens').doc(pid).get();
                        if (tokenDoc.exists && tokenDoc.data().token) {
                            const link = `/pages/matchmaker-mingle.html?id=${tournament_id}&player_id=${pid}&team_id=${loser_id}`;
                            const message = {
                                token: tokenDoc.data().token,
                                notification: { title, body },
                                data: { title, body, type: 'mingle_alert', tournament_id, team_id: loser_id, link },
                                webpush: {
                                    notification: {
                                        title, body,
                                        icon: '/images/gold_logo.png',
                                        badge: '/images/gold_logo.png',
                                        vibrate: [200, 100, 200, 100, 200]
                                    },
                                    fcmOptions: { link }
                                }
                            };
                            await admin.messaging().send(message);
                            console.log(`Mingle notification sent to player ${pid}`);
                        }
                    } catch (err) {
                        console.log(`Failed to notify losing team player ${pid}:`, err.message);
                    }
                })).catch(err => console.error('Mingle notification error:', err));
            }
        }

        res.json({
            success: true,
            match: updatedMatch,
            bracket_type: matchArrayName,
            winner_id,
            loser_id,
            mingle_triggered: mingleTriggered,
            team_eliminated: teamEliminated,
            advanced_to: advancedToNext,
            dropped_to_losers: droppedToLosers,
            tournament_complete: tournamentComplete,
            ...(tournamentChampion && { champion: tournamentChampion })
        });

    } catch (error) {
        console.error('Submit double elim match result error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Advance winner in Winners Bracket
 *
 * Winners bracket is standard single-elimination tree:
 * - Each match winner advances to next round
 * - Position is halved each round (matches pair up)
 * - Even positions (0,2,4...) go to team1 slot
 * - Odd positions (1,3,5...) go to team2 slot
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The completed match
 * @param {string} winnerId - ID of winning team
 * @param {Object} winner - Winning team data
 * @returns {Object} - { nextMatchId: string|null }
 */
function advanceInWinnersBracket(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.winners_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // Find next match
    const nextPosition = Math.floor(match.position / 2);
    const nextMatch = bracket.winners.find(m =>
        m.round === nextRound && m.position === nextPosition
    );

    if (nextMatch) {
        const isSlot1 = match.position % 2 === 0;
        const nextIdx = bracket.winners.indexOf(nextMatch);

        if (isSlot1) {
            bracket.winners[nextIdx].team1_id = winnerId;
            bracket.winners[nextIdx].team1 = winner;
        } else {
            bracket.winners[nextIdx].team2_id = winnerId;
            bracket.winners[nextIdx].team2 = winner;
        }

        // If both teams present, match is ready
        if (bracket.winners[nextIdx].team1_id && bracket.winners[nextIdx].team2_id) {
            bracket.winners[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    console.warn(`No next match found for WC R${match.round} pos ${match.position}`);
    return { nextMatchId: null };
}

/**
 * Drop loser to Losers Bracket
 * Called when a team loses in Winners Bracket (their first loss)
 *
 * Losers bracket follows a specific dropout pattern:
 * - LC R1: WC R1 losers pair up (adjacent positions)
 * - LC R2+: WC losers drop into team2 slot to face LC survivor
 *
 * The target LC round/position is pre-calculated during bracket generation
 * and stored in the WC match as loser_goes_to_lc_round/position
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The WC match that was just completed
 * @param {string} loserId - ID of losing team (going to LC)
 * @param {Object} loser - Losing team data
 * @returns {Object} - { lcMatchId: string|null }
 */
function dropToLosersBracket(bracket, match, loserId, loser) {
    const lcRound = match.loser_goes_to_lc_round || 1;
    const lcPosition = match.loser_goes_to_lc_position || match.position;

    // Find the LC match for this loser
    const lcMatch = bracket.losers.find(m =>
        m.round === lcRound && m.position === lcPosition
    );

    if (lcMatch) {
        const lcIdx = bracket.losers.indexOf(lcMatch);

        // Determine which slot to place in
        if (lcMatch.round === 1) {
            // LC R1: WC R1 losers pair up
            // Even position WC matches â†’ team1 slot
            // Odd position WC matches â†’ team2 slot
            const isSlot1 = match.position % 2 === 0;
            if (isSlot1) {
                bracket.losers[lcIdx].team1_id = loserId;
                bracket.losers[lcIdx].team1 = loser;
            } else {
                bracket.losers[lcIdx].team2_id = loserId;
                bracket.losers[lcIdx].team2 = loser;
            }
        } else {
            // LC R2+: WC loser drops into team2 slot (team1 is LC survivor)
            bracket.losers[lcIdx].team2_id = loserId;
            bracket.losers[lcIdx].team2 = loser;
        }

        // If both teams present, match is ready
        if (bracket.losers[lcIdx].team1_id && bracket.losers[lcIdx].team2_id) {
            bracket.losers[lcIdx].status = 'pending';
        }

        return { lcMatchId: lcMatch.id };
    }

    console.warn(`No LC match found for WC R${match.round} pos ${match.position} loser`);
    return { lcMatchId: null };
}

/**
 * Advance winner in Losers Bracket
 *
 * Losers bracket alternates between consolidation and dropout rounds:
 * - Consolidation rounds: LC survivors play each other, winners advance at same position
 * - Dropout rounds: LC survivors face WC dropouts, winners pair up for next consolidation
 *
 * Position calculation:
 * - After DROPOUT round â†’ divide position by 2 (winners pair up)
 * - After CONSOLIDATION round â†’ keep same position (wait for WC dropout)
 *
 * Winners from any LC match go to team1 slot of next match
 * (team2 slot is reserved for WC dropouts in dropout rounds)
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The completed LC match
 * @param {string} winnerId - ID of winning team
 * @param {Object} winner - Winning team data
 * @returns {Object} - { nextMatchId: string|null }
 */
function advanceInLosersBracket(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.losers_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // LC advancement depends on round type
    // After dropout round: winners pair up (divide by 2) for consolidation
    // After consolidation round: winners stay at same position (divide by 1) for dropout
    const isCurrentDropout = match.round_type === 'dropout';
    const nextMatch = bracket.losers.find(m =>
        m.round === nextRound && m.position === Math.floor(match.position / (isCurrentDropout ? 2 : 1))
    );

    if (nextMatch) {
        const nextIdx = bracket.losers.indexOf(nextMatch);

        // LC winners always go to team1 slot
        // (team2 slot reserved for WC dropouts)
        bracket.losers[nextIdx].team1_id = winnerId;
        bracket.losers[nextIdx].team1 = winner;

        // Match becomes ready when WC loser drops in (team2)
        if (bracket.losers[nextIdx].team2_id) {
            bracket.losers[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    console.warn(`No next LC match found for LC R${match.round} pos ${match.position}`);
    return { nextMatchId: null };
}

/**
 * Check and update mingle period status
 * Mingle ends when LAST WC R2 match STARTS (not when it ends)
 */
function checkMingleStatus(bracket) {
    if (!bracket.mingle_active) return;

    // Find all WC R2 matches
    const wcR2Matches = bracket.winners.filter(m => m.round === 2);

    // Check if ALL have started (status is 'in_progress' or 'completed')
    const allStarted = wcR2Matches.every(m =>
        m.status === 'in_progress' || m.status === 'completed'
    );

    if (allStarted) {
        bracket.mingle_active = false;
        bracket.mingle_ended_at = new Date().toISOString();
    }
}

exports.updateTournamentMatchRoom = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body;
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const access = await requireTournamentAccess(req, tournament_id);
        const { tournamentRef, tournament, authPlayer } = access;
        const bracket = tournament.bracket || {};
        const patch = buildRoomPatch(req.body);
        let updatedMatch = null;

        if (bracket.type === 'double_elimination') {
            const located = findDoubleElimMatch(bracket, match_id);
            if (!located) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }
            updatedMatch = applyDoubleElimMatchPatch(bracket, located.matchArrayName, located.matchIndex, patch);
        } else {
            const located = findSingleElimMatch(bracket, match_id);
            if (!located) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }
            bracket.matches[located.matchIndex] = {
                ...bracket.matches[located.matchIndex],
                ...patch
            };
            updatedMatch = bracket.matches[located.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(tournamentRef, match_id, patch, updatedMatch);
        await upsertTournamentRuntimeRoom(tournamentRef, match_id, updatedMatch, patch);
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'room_update',
            title: 'Match room updated',
            body: `${updatedMatch.room_label || 'Match room'} was updated.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: {
                room_label: updatedMatch.room_label || null,
                room_status: updatedMatch.room_status || 'open',
                board: updatedMatch.board || updatedMatch.board_number || null,
                archive_url: updatedMatch.archive_url || null
            }
        });

        if (tournament.enable_runtime_notifications === true || tournament.runtime_settings?.enable_runtime_notifications === true) {
            await sendTournamentRuntimeNotification(
                getMatchParticipantIds(updatedMatch, bracket.type === 'double_elimination'),
                {
                    title: 'Tournament Room Updated',
                    body: `${updatedMatch.room_label || 'Match room'} is ready${updatedMatch.stream_url ? ' with live video' : ''}.`,
                    type: 'tournament_room_update',
                    tournament_id,
                    match_id,
                    link: updatedMatch.room_url || `/pages/tournament-bracket.html?tournament_id=${tournament_id}`
                }
            );
        }

        res.json({ success: true, match_id, match: updatedMatch });
    } catch (error) {
        console.error('Update tournament match room error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.saveTournamentMatchProgress = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body || {};
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament, bracket, matchLocation, authPlayer } = access;
        const progress = buildScoringProgress(req.body || {});
        const patch = {
            status: 'in_progress',
            scoring_progress: progress,
            progress_updated_at: admin.firestore.Timestamp.now()
        };

        let updatedMatch = null;
        if (bracket.type === 'double_elimination') {
            if (matchLocation.match.status === 'completed') {
                return res.json({ success: true, match_id, status: 'already_completed', match: matchLocation.match });
            }
            updatedMatch = applyDoubleElimMatchPatch(bracket, matchLocation.matchArrayName, matchLocation.matchIndex, patch);
        } else {
            if (matchLocation.match.status === 'completed') {
                return res.json({ success: true, match_id, status: 'already_completed', match: matchLocation.match });
            }
            bracket.matches[matchLocation.matchIndex] = {
                ...bracket.matches[matchLocation.matchIndex],
                ...patch
            };
            updatedMatch = bracket.matches[matchLocation.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                status: 'in_progress',
                scoring_progress: progress,
                progress_updated_at: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedMatch
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'progress_saved',
            title: 'Match progress saved',
            body: `In-progress scoring was saved for ${formatParticipantName(updatedMatch.player1 || updatedMatch.team1)} vs ${formatParticipantName(updatedMatch.player2 || updatedMatch.team2)}.`,
            tournament_id,
            match_id,
            metadata: { scorer_type: progress.scorer_type || null, game_number: progress.game_number || null }
        });

        res.json({ success: true, match_id, status: 'in_progress', match: updatedMatch });
    } catch (error) {
        console.error('Save tournament match progress error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.getTournamentMatchProgress = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;
        const match_id = req.query.match_id || req.body.match_id;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const { bracket, matchLocation } = await requireTournamentMatchAccess(req, tournament_id, match_id);

        const match = matchLocation?.match || null;

        res.json({
            success: true,
            match_status: match.status || null,
            progress: match.scoring_progress || null
        });
    } catch (error) {
        console.error('Get tournament match progress error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.setTournamentMatchRoomLifecycle = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body || {};
        const lifecycleAction = cleanText(req.body.lifecycle_action) || 'open';
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }
        if (!['open', 'closed', 'archived'].includes(lifecycleAction)) {
            return res.status(400).json({ success: false, error: 'Unsupported lifecycle_action' });
        }

        const access = await requireTournamentAccess(req, tournament_id);
        const { tournamentRef, tournament, authPlayer } = access;
        const bracket = tournament.bracket || {};
        const patch = { room_status: lifecycleAction };
        let updatedMatch = null;

        if (bracket.type === 'double_elimination') {
            const located = findDoubleElimMatch(bracket, match_id);
            if (!located) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }
            updatedMatch = applyDoubleElimMatchPatch(bracket, located.matchArrayName, located.matchIndex, patch);
        } else {
            const located = findSingleElimMatch(bracket, match_id);
            if (!located) {
                return res.status(404).json({ success: false, error: 'Match not found' });
            }
            bracket.matches[located.matchIndex] = {
                ...bracket.matches[located.matchIndex],
                ...patch
            };
            updatedMatch = bracket.matches[located.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(tournamentRef, match_id, patch, updatedMatch);
        await upsertTournamentRuntimeRoom(tournamentRef, match_id, updatedMatch, patch);
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'room_lifecycle',
            title: `Room marked ${lifecycleAction}`,
            body: `${updatedMatch.room_label || 'Match room'} was marked ${lifecycleAction}.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { room_status: lifecycleAction }
        });

        return res.json({ success: true, match_id, room_status: lifecycleAction, match: updatedMatch });
    } catch (error) {
        console.error('Set tournament room lifecycle error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.getTournamentPlayerRuntime = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const context = await getTournamentContext(tournament_id);
        if (!context) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const { tournamentRef, tournament } = context;
        const role = getRoleFromTournament(tournament, authPlayer) || 'player';

        const [registrationsSnap, tournamentPlayersSnap, tournamentChatSnap, eventChatSnap] = await Promise.all([
            tournamentRef.collection('registrations').get().catch(() => null),
            tournamentRef.collection('players').get().catch(() => null),
            admin.firestore()
                .collection('chat_rooms')
                .where('tournament_id', '==', tournament_id)
                .where('type', '==', 'tournament')
                .limit(1)
                .get()
                .catch(() => null),
            admin.firestore()
                .collection('chat_rooms')
                .where('tournament_id', '==', tournament_id)
                .where('type', '==', 'tournament_event')
                .get()
                .catch(() => null)
        ]);

        const registrations = registrationsSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
        const tournamentPlayers = tournamentPlayersSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

        const registration = registrations.find(item =>
            (item.player_id && item.player_id === authPlayer.id)
            || (item.email && normalizeValue(item.email) === normalizeValue(authPlayer.email))
            || (item.full_name && normalizeValue(item.full_name) === normalizeValue(authPlayer.name))
            || (item.name && normalizeValue(item.name) === normalizeValue(authPlayer.name))
        ) || null;

        const tournamentPlayer = tournamentPlayers.find(item =>
            item.id === authPlayer.id
            || (item.player_id && item.player_id === authPlayer.id)
            || (item.email && normalizeValue(item.email) === normalizeValue(authPlayer.email))
            || ((item.name || item.player_name) && normalizeValue(item.name || item.player_name) === normalizeValue(authPlayer.name))
        ) || null;

        const viewerKeys = collectViewerKeys(authPlayer, registration, tournamentPlayer);
        const requireCheckIn = tournament.require_check_in === true
            || tournament.runtime_settings?.require_check_in === true;
        const flattenedMatches = flattenTournamentMatches(tournament.bracket || {});
        const relevantMatches = flattenedMatches
            .map(match => {
                const isDoubleElim = tournament?.bracket?.type === 'double_elimination';
                const summary = buildTournamentMatchSummary(match, isDoubleElim);
                summary.viewer_side = getMatchViewerSide(match, viewerKeys, isDoubleElim);
                return summary;
            })
            .filter(match => entryMatchesViewer(match.side1, viewerKeys) || entryMatchesViewer(match.side2, viewerKeys))
            .sort((a, b) => {
                const priority = getMatchPriority(a) - getMatchPriority(b);
                if (priority !== 0) return priority;
                return (a.round || 0) - (b.round || 0);
            });

        const activeMatch = relevantMatches.find(match => shouldSurfaceAsRuntimeFocus(match)) || null;

        const tournamentChat = tournamentChatSnap && !tournamentChatSnap.empty
            ? { id: tournamentChatSnap.docs[0].id, ...tournamentChatSnap.docs[0].data() }
            : null;
        const viewerEventIds = new Set([
            ...(Array.isArray(registration?.event_ids) ? registration.event_ids : []),
            ...(Array.isArray(tournamentPlayer?.event_ids) ? tournamentPlayer.event_ids : [])
        ].filter(Boolean));
        const eventChats = (eventChatSnap?.docs || [])
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(room => ['host', 'staff', 'admin'].includes(role) || !room.event_id || viewerEventIds.has(room.event_id))
            .map(room => ({
                id: room.id,
                event_id: room.event_id || null,
                name: room.name || 'Event Chat'
            }));
        const hostQueue = ['host', 'staff', 'admin'].includes(role)
            ? (() => {
                const uncheckedPlayers = registrations
                    .filter(item => item.runtime_status !== 'dropped' && item.checked_in !== true)
                    .map(item => ({
                        registration_id: item.id,
                        player_id: item.player_id || null,
                        name: item.full_name || item.name || item.email || 'Player',
                        email: item.email || null,
                        runtime_status: item.runtime_status || 'active'
                    }))
                    .slice(0, 25);

                const staleMatches = flattenedMatches
                    .map(match => buildTournamentMatchSummary(match, tournament?.bracket?.type === 'double_elimination'))
                    .filter(match => !!match.stale_state)
                    .sort((a, b) => (b.stale_minutes || 0) - (a.stale_minutes || 0))
                    .slice(0, 15);

                const roomAssignments = flattenedMatches
                    .filter(match => match.room_label || match.room_url || match.room_status)
                    .map(match => buildTournamentMatchSummary(match, tournament?.bracket?.type === 'double_elimination'))
                    .slice(0, 20);

                return {
                    unchecked_players: uncheckedPlayers,
                    stale_matches: staleMatches,
                    room_assignments: roomAssignments,
                    disputed_matches: flattenedMatches
                        .filter(match => normalizeResultReview(match).status === 'disputed')
                        .map(match => buildTournamentMatchSummary(match, tournament?.bracket?.type === 'double_elimination'))
                        .slice(0, 10)
                };
            })()
            : null;

        let recentAudit = [];
        let runtimeRooms = [];
        if (['host', 'staff', 'admin'].includes(role)) {
            const [auditSnap, roomSnap] = await Promise.all([
                tournamentRef.collection('runtime_audit').orderBy('created_at', 'desc').limit(20).get().catch(() => null),
                tournamentRef.collection('runtime_rooms').orderBy('updated_at', 'desc').limit(20).get().catch(() => null)
            ]);
            recentAudit = auditSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
            runtimeRooms = roomSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];
        }

        const viewerRegistrationStatus = registration?.runtime_status || tournamentPlayer?.runtime_status || 'active';

        return res.json({
            success: true,
            tournament: {
                id: tournament_id,
                name: tournament.tournament_name || tournament.name || 'Tournament',
                status: tournament.status || 'registration',
                format: tournament.format || null,
                game_type: tournament.game_type || null,
                matchmaker_enabled: !!tournament.matchmaker_enabled
            },
            viewer: {
                id: authPlayer.id,
                name: authPlayer.name || null,
                email: authPlayer.email || null,
                role,
                is_registered: !!registration,
                registration_id: registration?.id || null,
                checked_in: registration?.checked_in ?? tournamentPlayer?.checkedIn ?? false,
                registration_status: viewerRegistrationStatus
            },
            action: viewerRegistrationStatus === 'dropped'
                ? 'view_bracket'
                : (viewerRegistrationStatus === 'hold'
                    ? 'await_assignment'
                    : buildRuntimeAction(
                        !!registration,
                        activeMatch,
                        registration?.checked_in ?? tournamentPlayer?.checkedIn ?? false,
                        requireCheckIn
                    )),
            runtime_settings: {
                enable_tournament_chat: tournament.enable_tournament_chat === true || tournament.runtime_settings?.enable_tournament_chat === true,
                enable_player_challenges: tournament.enable_player_challenges === true || tournament.runtime_settings?.enable_player_challenges === true,
                auto_create_match_rooms: tournament.auto_create_match_rooms === true || tournament.runtime_settings?.auto_create_match_rooms === true,
                require_check_in: requireCheckIn,
                allow_player_self_report: tournament.allow_player_self_report !== false && tournament.runtime_settings?.allow_player_self_report !== false,
                show_tournament_runtime: tournament.show_tournament_runtime !== false && tournament.runtime_settings?.show_tournament_runtime !== false,
                enable_video_streaming: tournament.enable_video_streaming === true || tournament.runtime_settings?.enable_video_streaming === true,
                enable_score_assist: tournament.enable_score_assist === true || tournament.runtime_settings?.enable_score_assist === true,
                enable_runtime_notifications: tournament.enable_runtime_notifications !== false && tournament.runtime_settings?.enable_runtime_notifications !== false
            },
            tournament_chat: tournamentChat ? {
                id: tournamentChat.id,
                name: tournamentChat.name || `${tournament.tournament_name || tournament.name || 'Tournament'} Chat`
            } : null,
            event_chats: eventChats,
            host_queue: hostQueue,
            recent_audit: recentAudit,
            runtime_rooms: runtimeRooms,
            active_match: activeMatch,
            upcoming_matches: relevantMatches.filter(match => match.id !== activeMatch?.id && !isCompletedMatchAwaitingReview(match) && match.status !== 'completed').slice(0, 5),
            completed_matches: relevantMatches.filter(match => match.status === 'completed').slice(0, 10)
        });
    } catch (error) {
        console.error('Get tournament player runtime error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.setTournamentPlayerCheckIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body || {};
        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const context = await getTournamentContext(tournament_id);
        if (!context) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const checkedIn = req.body.checked_in !== false;
        const role = getRoleFromTournament(context.tournament, authPlayer) || 'player';
        const targetRegistrationId = cleanText(req.body.registration_id);
        const targetPlayerId = cleanText(req.body.player_id);

        let result;
        if ((targetRegistrationId || targetPlayerId) && ['host', 'staff', 'admin'].includes(role)) {
            result = await updateSpecificTournamentCheckInState(
                context.tournamentRef,
                context.tournament,
                { registrationId: targetRegistrationId, playerId: targetPlayerId },
                checkedIn
            );
        } else {
            result = await updateTournamentPlayerCheckInState(context.tournamentRef, context.tournament, authPlayer, checkedIn);
        }

        await appendTournamentRuntimeAudit(context.tournamentRef, {
            type: 'check_in',
            title: checkedIn ? 'Player checked in' : 'Player unchecked',
            body: `${authPlayer?.name || result.player_id || 'Player'} ${checkedIn ? 'checked in' : 'was unchecked'}.`,
            tournament_id,
            registration_id: result.registration_id,
            player_id: result.player_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { checked_in: checkedIn }
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Set tournament player check-in error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.setTournamentParticipantAvailability = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body || {};
        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const access = await requireTournamentAccess(req, tournament_id);
        const runtimeStatus = cleanText(req.body.runtime_status) || 'active';
        if (!['active', 'hold', 'dropped'].includes(runtimeStatus)) {
            return res.status(400).json({ success: false, error: 'Unsupported runtime_status' });
        }

        const registrationId = cleanText(req.body.registration_id);
        const playerId = cleanText(req.body.player_id);
        const result = await updateTournamentParticipantAvailability(
            access.tournamentRef,
            access.tournament,
            { registrationId, playerId },
            runtimeStatus
        );

        await appendTournamentRuntimeAudit(access.tournamentRef, {
            type: 'participant_availability',
            title: `Participant marked ${runtimeStatus}`,
            body: `${result.name} was marked ${runtimeStatus} by tournament staff.`,
            tournament_id,
            registration_id: result.registration_id,
            player_id: result.player_id,
            actor_id: access.authPlayer?.id || null,
            actor_name: access.authPlayer?.name || null,
            metadata: { runtime_status: runtimeStatus }
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        console.error('Set tournament participant availability error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.sendTournamentRuntimeReminder = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body || {};
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament, bracket, matchLocation, authPlayer } = access;
        const isDoubleElim = bracket.type === 'double_elimination';
        const stale = getMatchStaleState(matchLocation.match, isDoubleElim);
        const title = stale.state === 'in_progress_idle'
            ? 'Tournament Match Needs Attention'
            : 'Tournament Match Reminder';
        const body = stale.state === 'in_progress_idle'
            ? 'Your tournament match looks stalled. Rejoin the scorer or contact the host.'
            : 'Your tournament match is ready to start. Please join now.';
        const matchLabel = `${formatParticipantName(matchLocation.match.player1 || matchLocation.match.team1)} vs ${formatParticipantName(matchLocation.match.player2 || matchLocation.match.team2)}`;
        let directNotifications = null;

        await sendTournamentRuntimeNotification(
            getMatchParticipantIds(matchLocation.match, isDoubleElim),
            {
                title,
                body,
                type: 'tournament_runtime_reminder',
                tournament_id,
                match_id,
                link: `/pages/tournament-bracket.html?tournament_id=${tournament_id}`
            }
        );

        try {
            const contacts = await collectTournamentMatchContacts(tournamentRef, matchLocation.match, isDoubleElim);
            directNotifications = await sendTournamentRuntimeDirectNotifications(tournamentRef, contacts, {
                title,
                body,
                tournamentName: tournament.tournament_name || tournament.name || 'BRDC tournament',
                matchLabel,
                type: 'tournament_runtime_reminder',
                tournament_id,
                match_id,
                link: `https://brdc-v2.web.app/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournament_id)}`
            });
        } catch (error) {
            console.error('Direct tournament runtime notification error:', error);
            directNotifications = { error: error.message };
        }

        const reminderPatch = {
            runtime_monitor: {
                ...(matchLocation.match.runtime_monitor || {}),
                last_reminder_sent_at: admin.firestore.Timestamp.now(),
                last_reminder_sent_by: authPlayer?.id || 'system'
            }
        };
        let updatedMatch = null;
        if (isDoubleElim) {
            updatedMatch = applyDoubleElimMatchPatch(bracket, matchLocation.matchArrayName, matchLocation.matchIndex, reminderPatch);
        } else {
            bracket.matches[matchLocation.matchIndex] = {
                ...bracket.matches[matchLocation.matchIndex],
                ...reminderPatch
            };
            updatedMatch = bracket.matches[matchLocation.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(tournamentRef, match_id, { runtime_monitor: reminderPatch.runtime_monitor }, updatedMatch);
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'runtime_reminder',
            title: 'Runtime reminder sent',
            body: `${authPlayer?.name || 'Tournament staff'} sent a reminder for ${matchLabel}.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: {
                stale_state: stale.state || null,
                direct_notifications: directNotifications
            }
        });

        return res.json({ success: true, match_id, stale_state: stale.state || null, direct_notifications: directNotifications });
    } catch (error) {
        console.error('Send tournament runtime reminder error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.setTournamentMatchReady = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body || {};
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament, bracket, matchLocation, authPlayer } = access;
        const isDoubleElim = bracket.type === 'double_elimination';
        const viewerKeys = collectViewerKeys(authPlayer);
        const viewerSide = getMatchViewerSide(matchLocation.match, viewerKeys, isDoubleElim);

        if (!viewerSide) {
            return res.status(403).json({ success: false, error: 'Only assigned participants can update match readiness' });
        }

        const checkedInRequired = tournament.require_check_in === true || tournament.runtime_settings?.require_check_in === true;
        if (checkedInRequired) {
            await updateTournamentPlayerCheckInState(tournamentRef, tournament, authPlayer, true);
        }

        const ready = req.body.ready !== false;
        const currentReady = normalizeReadyState(matchLocation.match);
        const updatedReady = {
            ...currentReady,
            [viewerSide]: ready,
            [`${viewerSide}_at`]: admin.firestore.Timestamp.now(),
            [`${viewerSide}_by`]: authPlayer.id,
            updated_at: admin.firestore.Timestamp.now()
        };

        const patch = {
            match_ready: updatedReady
        };

        if (matchLocation.match.status !== 'completed' && matchLocation.match.status !== 'in_progress') {
            patch.status = updatedReady.side1 && updatedReady.side2
                ? 'ready'
                : (hasBothMatchSides(matchLocation.match, isDoubleElim) ? 'pending' : 'waiting');
        }

        let updatedMatch = null;
        if (isDoubleElim) {
            updatedMatch = applyDoubleElimMatchPatch(bracket, matchLocation.matchArrayName, matchLocation.matchIndex, patch);
        } else {
            bracket.matches[matchLocation.matchIndex] = {
                ...bracket.matches[matchLocation.matchIndex],
                ...patch
            };
            updatedMatch = bracket.matches[matchLocation.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                match_ready: updatedReady,
                ...(patch.status ? { status: patch.status } : {})
            },
            updatedMatch
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'match_ready',
            title: ready ? 'Player readied up' : 'Player marked not ready',
            body: `${authPlayer?.name || 'A player'} updated readiness for ${formatParticipantName(updatedMatch.player1 || updatedMatch.team1)} vs ${formatParticipantName(updatedMatch.player2 || updatedMatch.team2)}.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { ready, viewer_side: viewerSide, status: updatedMatch.status }
        });

        if (tournament.enable_runtime_notifications === true || tournament.runtime_settings?.enable_runtime_notifications === true) {
            const participantIds = getMatchParticipantIds(updatedMatch, isDoubleElim);
            const playerName = authPlayer?.name || 'A player';
            const stateText = updatedReady.side1 && updatedReady.side2 ? 'Both sides are ready. Match can start.' : `${playerName} updated their ready state.`;
            await sendTournamentRuntimeNotification(participantIds, {
                title: 'Tournament Match Ready Update',
                body: stateText,
                type: 'tournament_match_ready',
                tournament_id,
                match_id,
                link: `/pages/tournament-bracket.html?tournament_id=${tournament_id}`
            });
        }

        return res.json({
            success: true,
            match_id,
            status: updatedMatch.status,
            match_ready: updatedReady
        });
    } catch (error) {
        console.error('Set tournament match ready error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.respondTournamentMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, action, notes } = req.body || {};
        if (!tournament_id || !match_id || !action) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id, match_id, or action' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, bracket, matchLocation, authPlayer, role } = access;
        const isDoubleElim = bracket.type === 'double_elimination';
        const viewerKeys = collectViewerKeys(authPlayer);
        const viewerSide = getMatchViewerSide(matchLocation.match, viewerKeys, isDoubleElim);
        const currentReview = normalizeResultReview(matchLocation.match);

        if (matchLocation.match.status !== 'completed') {
            return res.status(400).json({ success: false, error: 'Match result is not available for review yet' });
        }

        const patch = {};
        const updatedReview = { ...currentReview };
        const now = admin.firestore.Timestamp.now();

        if (action === 'confirm') {
            if (!viewerSide && !['host', 'staff', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, error: 'Only participants or tournament staff can confirm results' });
            }

            if (viewerSide === 'side1') updatedReview.side1_confirmed = true;
            if (viewerSide === 'side2') updatedReview.side2_confirmed = true;
            if (!viewerSide && ['host', 'staff', 'admin'].includes(role)) {
                updatedReview.side1_confirmed = true;
                updatedReview.side2_confirmed = true;
                updatedReview.resolved_by = authPlayer.id;
                updatedReview.resolution_notes = cleanText(notes) || 'Confirmed by tournament staff';
                updatedReview.resolved_at = now;
            }

            updatedReview.status = (updatedReview.side1_confirmed && updatedReview.side2_confirmed)
                ? 'confirmed'
                : 'pending_confirmation';
            if (updatedReview.status === 'confirmed') {
                updatedReview.confirmed_at = now;
                updatedReview.disputed_by_side = null;
                updatedReview.dispute_notes = null;
                updatedReview.disputed_at = null;
            }
        } else if (action === 'dispute') {
            if (!viewerSide && !['host', 'staff', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, error: 'Only participants or tournament staff can dispute results' });
            }
            updatedReview.status = 'disputed';
            updatedReview.disputed_by_side = viewerSide || role;
            updatedReview.dispute_notes = cleanText(notes);
            updatedReview.disputed_at = now;
        } else if (action === 'resolve') {
            if (!['host', 'staff', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, error: 'Only tournament staff can resolve disputed results' });
            }
            updatedReview.status = 'confirmed';
            updatedReview.side1_confirmed = true;
            updatedReview.side2_confirmed = true;
            updatedReview.confirmed_at = now;
            updatedReview.resolved_by = authPlayer.id;
            updatedReview.resolution_notes = cleanText(notes) || 'Resolved by tournament staff';
            updatedReview.resolved_at = now;
            updatedReview.disputed_by_side = null;
            updatedReview.dispute_notes = null;
            updatedReview.disputed_at = null;
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported action' });
        }

        patch.result_review = updatedReview;

        let updatedMatch = null;
        if (isDoubleElim) {
            updatedMatch = applyDoubleElimMatchPatch(bracket, matchLocation.matchArrayName, matchLocation.matchIndex, patch);
        } else {
            bracket.matches[matchLocation.matchIndex] = {
                ...bracket.matches[matchLocation.matchIndex],
                ...patch
            };
            updatedMatch = bracket.matches[matchLocation.matchIndex];
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            { result_review: updatedReview },
            updatedMatch
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: action === 'dispute' ? 'result_disputed' : 'result_review',
            title: action === 'resolve' ? 'Result dispute resolved' : `Result ${action}ed`,
            body: `${authPlayer?.name || 'A user'} ${action}ed the recorded result.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { action, notes: cleanText(notes) || null, status: updatedReview.status }
        });

        if (access.tournament.enable_runtime_notifications === true || access.tournament.runtime_settings?.enable_runtime_notifications === true) {
            await sendTournamentRuntimeNotification(
                getMatchParticipantIds(updatedMatch, isDoubleElim),
                {
                    title: action === 'dispute' ? 'Tournament Result Disputed' : 'Tournament Result Updated',
                    body: action === 'dispute'
                        ? 'A player disputed the recorded result.'
                        : 'The recorded result review state was updated.',
                    type: action === 'dispute' ? 'tournament_result_disputed' : 'tournament_result_review',
                    tournament_id,
                    match_id,
                    link: `/pages/tournament-bracket.html?tournament_id=${tournament_id}`
                }
            );
        }

        return res.json({ success: true, match_id, result_review: updatedReview });
    } catch (error) {
        console.error('Respond tournament match result error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.startTournamentMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id } = req.body;
        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const { tournamentRef, tournament, bracket, matchLocation, authPlayer } = await requireTournamentMatchAccess(req, tournament_id, match_id);
        if (bracket.type === 'double_elimination') {
            return res.status(400).json({ success: false, error: 'Use startDoubleElimMatch for double elimination tournaments' });
        }

        if (hasBothMatchSides(matchLocation.match, false) && !isMatchReadyFlagged(matchLocation.match)) {
            return res.status(400).json({ success: false, error: 'Both sides must ready up before the match can start' });
        }

        const roomPatch = buildRoomPatch({ ...req.body, status: 'in_progress' });
        if (
            (tournament.auto_create_match_rooms === true || tournament.runtime_settings?.auto_create_match_rooms === true)
            && !roomPatch.room_label
            && !matchLocation.match?.room_label
        ) {
            roomPatch.room_label = buildDefaultRoomLabel(matchLocation.match);
        }
        const updatedMatch = {
            ...bracket.matches[matchLocation.matchIndex],
            ...roomPatch,
            startedAt: admin.firestore.Timestamp.now()
        };
        bracket.matches[matchLocation.matchIndex] = updatedMatch;

        const roomEntity = await upsertTournamentRuntimeRoom(
            tournamentRef,
            match_id,
            updatedMatch,
            { ...roomPatch, room_status: roomPatch.room_status || 'open' }
        );
        updatedMatch.room_entity_id = roomEntity?.room_entity_id || match_id;
        bracket.matches[matchLocation.matchIndex] = updatedMatch;

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                ...roomPatch,
                room_entity_id: updatedMatch.room_entity_id,
                room_status: roomPatch.room_status || 'open',
                startedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedMatch
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'match_started',
            title: 'Match started',
            body: `${formatParticipantName(updatedMatch.player1)} vs ${formatParticipantName(updatedMatch.player2)} was started.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { board: updatedMatch.board || updatedMatch.board_number || null, room_label: updatedMatch.room_label || null }
        });

        let directNotifications = null;
        try {
            const matchLabel = `${formatParticipantName(updatedMatch.player1)} vs ${formatParticipantName(updatedMatch.player2)}`;
            const contacts = await collectTournamentMatchContacts(tournamentRef, updatedMatch, false);
            directNotifications = await sendTournamentRuntimeDirectNotifications(tournamentRef, contacts, {
                title: 'Your Match Is Starting!',
                body: 'Your tournament match is ready to start. Please join now.',
                tournamentName: tournament.tournament_name || tournament.name || 'BRDC tournament',
                matchLabel,
                type: 'match_start',
                tournament_id,
                match_id,
                link: `https://brdc-v2.web.app/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournament_id)}`
            });
        } catch (error) {
            console.error('Direct tournament match start notification error:', error);
            directNotifications = { error: error.message };
        }

        res.json({ success: true, match_id, status: 'in_progress', match: updatedMatch, direct_notifications: directNotifications });
    } catch (error) {
        console.error('Start tournament match error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Start a match (for tracking mingle period end)
 */
exports.startDoubleElimMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, board } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const access = await requireTournamentMatchAccess(req, tournament_id, match_id);
        const { tournamentRef, tournament, bracket, matchLocation, authPlayer } = access;

        if (hasBothMatchSides(matchLocation.match, true) && !isMatchReadyFlagged(matchLocation.match)) {
            return res.status(400).json({ success: false, error: 'Both sides must ready up before the match can start' });
        }

        const roomPatch = buildRoomPatch({ ...req.body, status: 'in_progress' });
        if (
            (tournament.auto_create_match_rooms === true || tournament.runtime_settings?.auto_create_match_rooms === true)
            && !roomPatch.room_label
            && !matchLocation.match?.room_label
        ) {
            roomPatch.room_label = buildDefaultRoomLabel(matchLocation.match);
        }

        // Find and update match
        let mingleEnded = false;
        let matchData = null;
        const matchBracketType = matchLocation.matchArrayName;

        if (matchBracketType === 'winners' || matchBracketType === 'losers') {
            bracket[matchBracketType][matchLocation.matchIndex] = {
                ...bracket[matchBracketType][matchLocation.matchIndex],
                ...roomPatch,
                started_at: admin.firestore.Timestamp.now()
            };
            matchData = bracket[matchBracketType][matchLocation.matchIndex];

            if (matchBracketType === 'winners' && bracket[matchBracketType][matchLocation.matchIndex].round === 2) {
                checkMingleStatus(bracket);
                mingleEnded = !bracket.mingle_active;
            }
        } else if (matchBracketType === 'grand_finals_1') {
            bracket.grand_finals.match1 = {
                ...bracket.grand_finals.match1,
                ...roomPatch,
                started_at: admin.firestore.Timestamp.now()
            };
            matchData = bracket.grand_finals.match1;
        } else if (matchBracketType === 'grand_finals_2') {
            bracket.grand_finals.match2 = {
                ...bracket.grand_finals.match2,
                ...roomPatch,
                started_at: admin.firestore.Timestamp.now()
            };
            matchData = bracket.grand_finals.match2;
        }

        const roomEntity = await upsertTournamentRuntimeRoom(
            tournamentRef,
            match_id,
            matchData,
            { ...roomPatch, room_status: roomPatch.room_status || 'open' }
        );
        if (matchData) {
            matchData.room_entity_id = roomEntity?.room_entity_id || match_id;
            if (matchBracketType === 'winners' || matchBracketType === 'losers') {
                bracket[matchBracketType][matchLocation.matchIndex] = matchData;
            } else if (matchBracketType === 'grand_finals_1') {
                bracket.grand_finals.match1 = matchData;
            } else if (matchBracketType === 'grand_finals_2') {
                bracket.grand_finals.match2 = matchData;
            }
        }

        await tournamentRef.update({ bracket });
        await syncMatchSubcollectionDoc(
            tournamentRef,
            match_id,
            {
                ...roomPatch,
                room_entity_id: matchData?.room_entity_id || match_id,
                room_status: roomPatch.room_status || 'open',
                started_at: admin.firestore.FieldValue.serverTimestamp()
            },
            matchData
        );
        await appendTournamentRuntimeAudit(tournamentRef, {
            type: 'match_started',
            title: 'Match started',
            body: `${formatParticipantName(matchData.team1 || matchData.player1)} vs ${formatParticipantName(matchData.team2 || matchData.player2)} was started.`,
            tournament_id,
            match_id,
            actor_id: authPlayer?.id || null,
            actor_name: authPlayer?.name || null,
            metadata: { board: matchData.board || matchData.board_number || null, room_label: matchData.room_label || null }
        });

        // Send push notifications to players in the match (fire-and-forget)
        if (matchData) {
            const playerIds = [];
            [matchData.team1, matchData.team2].forEach(team => {
                if (!team) return;
                if (team.player1?.player_id) playerIds.push(team.player1.player_id);
                if (team.player2?.player_id) playerIds.push(team.player2.player_id);
            });

            if (playerIds.length > 0) {
                const gameType = matchBracketType === 'winners'
                    ? (tournament.winners_game_type || 'cricket').toUpperCase()
                    : (tournament.losers_game_type || '501').toUpperCase();
                const boardText = board ? ` â€” Board ${board}` : '';
                const team1Name = matchData.team1?.team_name || matchData.team1?.name || 'Team 1';
                const team2Name = matchData.team2?.team_name || matchData.team2?.name || 'Team 2';
                const bracketLabel = matchBracketType === 'winners' ? 'Winners' : 'Losers';

                const title = `Your Match Is Starting!`;
                const body = `${team1Name} vs ${team2Name}\n${bracketLabel} Bracket â€” ${gameType}${boardText}`;
                const link = tournament.matchmaker_enabled
                    ? `/pages/matchmaker-bracket.html?id=${tournament_id}`
                    : `/pages/tournament-bracket.html?id=${tournament_id}`;

                // Fire-and-forget: don't await, don't block response
                Promise.all(playerIds.map(async (pid) => {
                    try {
                        const tokenDoc = await admin.firestore().collection('fcm_tokens').doc(pid).get();
                        if (tokenDoc.exists && tokenDoc.data().token) {
                            const message = {
                                token: tokenDoc.data().token,
                                notification: { title, body },
                                data: { title, body, type: 'match_start', tournament_id, match_id, link },
                                webpush: {
                                    notification: {
                                        title, body,
                                        icon: '/images/gold_logo.png',
                                        badge: '/images/gold_logo.png',
                                        vibrate: [200, 100, 200, 100, 200]
                                    },
                                    fcmOptions: { link }
                                }
                            };
                            await admin.messaging().send(message);
                            console.log(`Match start notification sent to player ${pid}`);
                        }
                    } catch (err) {
                        console.log(`Failed to notify player ${pid}:`, err.message);
                    }
                })).catch(err => console.error('Notification batch error:', err));
            }
        }

        let directNotifications = null;
        if (matchData) {
            try {
                const matchLabel = `${formatParticipantName(matchData.team1 || matchData.player1)} vs ${formatParticipantName(matchData.team2 || matchData.player2)}`;
                const contacts = await collectTournamentMatchContacts(tournamentRef, matchData, true);
                directNotifications = await sendTournamentRuntimeDirectNotifications(tournamentRef, contacts, {
                    title: 'Your Match Is Starting!',
                    body: 'Your tournament match is ready to start. Please join now.',
                    tournamentName: tournament.tournament_name || tournament.name || 'BRDC tournament',
                    matchLabel,
                    type: 'match_start',
                    tournament_id,
                    match_id,
                    link: `https://brdc-v2.web.app/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournament_id)}`
                });
            } catch (error) {
                console.error('Direct double-elim match start notification error:', error);
                directNotifications = { error: error.message };
            }
        }

        res.json({
            success: true,
            match_id,
            status: 'in_progress',
            mingle_ended: mingleEnded,
            direct_notifications: directNotifications
        });

    } catch (error) {
        console.error('Start match error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

exports.runTournamentRuntimeReminders = functions.pubsub.schedule('every 15 minutes').onRun(async () => {
    const tournamentsSnap = await admin.firestore()
        .collection('tournaments')
        .where('status', 'in', ['active', 'in_progress'])
        .limit(50)
        .get();

    for (const tournamentDoc of tournamentsSnap.docs) {
        const tournament = tournamentDoc.data() || {};
        if (tournament.enable_runtime_notifications === false && tournament.runtime_settings?.enable_runtime_notifications === false) {
            continue;
        }

        const bracket = tournament.bracket || {};
        const isDoubleElim = bracket.type === 'double_elimination';
        const flattenedMatches = flattenTournamentMatches(bracket);
        const staleMatches = flattenedMatches.filter(match => shouldSendReminder(match, isDoubleElim));
        if (!staleMatches.length) continue;

        for (const staleMatch of staleMatches) {
            const stale = getMatchStaleState(staleMatch, isDoubleElim);
            if (!stale.state) continue;

            await sendTournamentRuntimeNotification(
                getMatchParticipantIds(staleMatch, isDoubleElim),
                {
                    title: stale.state === 'in_progress_idle' ? 'Tournament Match Needs Attention' : 'Tournament Match Reminder',
                    body: stale.state === 'in_progress_idle'
                        ? 'Your tournament match appears stalled. Rejoin the scorer or contact the host.'
                        : 'Your tournament match is ready to start. Please join now.',
                    type: 'tournament_runtime_reminder',
                    tournament_id: tournamentDoc.id,
                    match_id: staleMatch.id,
                    link: `/pages/tournament-bracket.html?tournament_id=${tournamentDoc.id}`
                }
            );

            let directNotifications = null;
            try {
                const title = stale.state === 'in_progress_idle' ? 'Tournament Match Needs Attention' : 'Tournament Match Reminder';
                const body = stale.state === 'in_progress_idle'
                    ? 'Your tournament match appears stalled. Rejoin the scorer or contact the host.'
                    : 'Your tournament match is ready to start. Please join now.';
                const matchLabel = `${formatParticipantName(staleMatch.player1 || staleMatch.team1)} vs ${formatParticipantName(staleMatch.player2 || staleMatch.team2)}`;
                const contacts = await collectTournamentMatchContacts(tournamentDoc.ref, staleMatch, isDoubleElim);
                directNotifications = await sendTournamentRuntimeDirectNotifications(tournamentDoc.ref, contacts, {
                    title,
                    body,
                    tournamentName: tournament.tournament_name || tournament.name || 'BRDC tournament',
                    matchLabel,
                    type: 'tournament_runtime_reminder',
                    tournament_id: tournamentDoc.id,
                    match_id: staleMatch.id,
                    link: `https://brdc-v2.web.app/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournamentDoc.id)}`
                });
            } catch (error) {
                console.error('Scheduled direct tournament runtime notification error:', error);
                directNotifications = { error: error.message };
            }

            const reminderPatch = {
                runtime_monitor: {
                    ...(staleMatch.runtime_monitor || {}),
                    last_reminder_sent_at: admin.firestore.Timestamp.now(),
                    last_reminder_sent_by: 'scheduler'
                }
            };

            let updatedMatch = null;
            if (isDoubleElim) {
                const located = findDoubleElimMatch(bracket, staleMatch.id);
                if (!located) continue;
                updatedMatch = applyDoubleElimMatchPatch(bracket, located.matchArrayName, located.matchIndex, reminderPatch);
            } else {
                const located = findSingleElimMatch(bracket, staleMatch.id);
                if (!located) continue;
                bracket.matches[located.matchIndex] = {
                    ...bracket.matches[located.matchIndex],
                    ...reminderPatch
                };
                updatedMatch = bracket.matches[located.matchIndex];
            }

            await tournamentDoc.ref.update({ bracket });
            await syncMatchSubcollectionDoc(tournamentDoc.ref, staleMatch.id, { runtime_monitor: reminderPatch.runtime_monitor }, updatedMatch);
            await appendTournamentRuntimeAudit(tournamentDoc.ref, {
                type: 'runtime_reminder',
                title: 'Scheduled runtime reminder sent',
                body: `A scheduled reminder was sent for ${formatParticipantName(staleMatch.player1 || staleMatch.team1)} vs ${formatParticipantName(staleMatch.player2 || staleMatch.team2)}.`,
                tournament_id: tournamentDoc.id,
                match_id: staleMatch.id,
                actor_id: 'scheduler',
                actor_name: 'scheduler',
                metadata: { stale_state: stale.state, direct_notifications: directNotifications }
            });
        }
    }

    return null;
});

/**
 * Recalculate all stats for a tournament
 * POST /recalculateTournamentStats
 * Body: { tournament_id: string }
 */
exports.recalculateTournamentStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        const result = await recalculateTournamentStats(tournament_id);

        res.json({
            success: true,
            matchesProcessed: result.matchesProcessed,
            playersUpdated: result.playersUpdated
        });

    } catch (error) {
        console.error('Error recalculating tournament stats:', error);
        res.status(500).json({ error: error.message });
    }
});

exports._test = {
    collectTournamentMatchContacts,
    buildRuntimeDirectNotificationPlan,
    formatPhoneE164,
    getMatchParticipantIds
};
