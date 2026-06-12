import { db, collection, doc, getDoc, getDocs, callFunction } from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get('tournament_id') || params.get('id') || 'rookies-wing-it-wednesdays-2026-05-27';

const els = {
    status: document.getElementById('runtimeStatus'),
    title: document.getElementById('runtimeTitle'),
    meta: document.getElementById('runtimeMeta'),
    tournament: document.getElementById('tournamentLink'),
    register: document.getElementById('registerRuntimeLink'),
    bracket: document.getElementById('bracketRuntimeLink'),
    events: document.getElementById('runtimeEvents'),
    regs: document.getElementById('runtimeRegs'),
    rooms: document.getElementById('runtimeRooms'),
    grid: document.getElementById('runtimeGrid'),
    summary: document.getElementById('runtimeSummaryGrid')
};

const state = {
    tournament: null,
    events: [],
    registrations: [],
    rooms: [],
    matches: []
};

const DEFAULT_WING_VOTE_OPTIONS = [
    { id: 'blind_draw_doubles', label: 'Blind draw doubles' },
    { id: 'mixed_doubles_matchmaker', label: 'Mixed doubles matchmaker' },
    { id: '501_c_ch', label: '501/C/CH' },
    { id: 'cricket_luck_draw', label: 'Cricket luck draw' },
    { id: 'mystery_format', label: 'Mystery format' }
];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function title(data = state.tournament) {
    return data?.tournament_name || data?.name || 'Tournament Runtime';
}

function isWingItWednesday() {
    const raw = `${tournamentId} ${title()}`.toLowerCase();
    return raw.includes('wing-it-wednesdays') || raw.includes('wing it wednesday') || raw.includes('wing it wednesdays');
}

function voteOptions() {
    const configured = Array.isArray(state.tournament?.registration_vote_options)
        ? state.tournament.registration_vote_options
        : [];
    const normalized = configured
        .map((option, index) => typeof option === 'string'
            ? { id: `option_${index + 1}`, label: option }
            : { id: option.id || `option_${index + 1}`, label: option.label || option.name || option.id || `Option ${index + 1}` })
        .filter(option => option.label);
    return normalized.length ? normalized : DEFAULT_WING_VOTE_OPTIONS;
}

function votingEnabled() {
    if (state.tournament?.registration_voting_enabled === true) return true;
    if (state.tournament?.registration_voting_enabled === false) return false;
    return isWingItWednesday();
}

function normalizeFormat(value) {
    return String(value || 'single_elimination').toLowerCase().replace(/-/g, '_');
}

function friendly(value) {
    const raw = String(value || '').trim();
    const labels = {
        single_elimination: 'Single Elimination',
        double_elimination: 'Double Elimination',
        round_robin: 'Round Robin',
        corks_choice: "Cork's Choice",
        blind_draw: 'Blind Draw',
        blind_draw_team: 'Blind Draw Team'
    };
    return labels[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) || 'TBD';
}

function participantName(value, fallback = 'TBD') {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    return value.team_name || value.name || value.full_name || value.player_name || value.email || fallback;
}

function registrationName(reg) {
    if (reg.team_name) return reg.team_name;
    if (reg.player?.name) return reg.player.name;
    if (reg.player1?.name || reg.player2?.name) {
        return [reg.player1?.name, reg.player2?.name].filter(Boolean).join(' & ');
    }
    return reg.full_name || reg.name || reg.player_name || reg.team_name || reg.email || 'Player';
}

function registrationPlayerId(reg) {
    if (reg.player?.player_id) return reg.player.player_id;
    if (reg.player1?.player_id) return reg.player1.player_id;
    return reg.player_id || reg.playerId || reg.id || '';
}

function isCheckedIn(reg) {
    if (reg.player) return reg.player.checked_in === true;
    if (reg.player1 || reg.player2) return reg.player1?.checked_in === true && reg.player2?.checked_in === true;
    return reg.checked_in === true || reg.checkedIn === true;
}

function registrationContact(reg, key) {
    if (reg[key]) return reg[key];
    if (reg.player?.[key]) return reg.player[key];
    return [reg.player1?.[key], reg.player2?.[key]].filter(Boolean).join(' / ');
}

function runtimeStatus(reg) {
    return reg.runtime_status || reg.runtimeStatus || (reg.status === 'cancelled' ? 'dropped' : 'active');
}

function matchName(match) {
    return `${participantName(match.player1 || match.team1, 'TBD')} vs ${participantName(match.player2 || match.team2, 'TBD')}`;
}

function matchBoard(match) {
    return match.board_number || match.board || null;
}

function hasBothSides(match) {
    return Boolean((match.player1 || match.team1) && (match.player2 || match.team2));
}

function matchScore(match) {
    const score = match.score || match.scores || {};
    const side1 = score.player1 ?? score.team1 ?? match.player1_score ?? match.team1_score;
    const side2 = score.player2 ?? score.team2 ?? match.player2_score ?? match.team2_score;
    if (side1 === undefined || side2 === undefined) return '';
    return `${side1}-${side2}`;
}

function resultReviewLabel(match) {
    const review = match.result_review || {};
    return review.status ? `Result ${friendly(review.status)}` : '';
}

function isDoubleElim() {
    return state.tournament?.bracket?.type === 'double_elimination' || normalizeFormat(state.tournament?.format) === 'double_elimination';
}

function isMatchmaker() {
    return state.tournament?.matchmaker_enabled === true;
}

function eventGame(event = {}) {
    return event.game || event.game_type || event.default_game || state.tournament?.game_type || '501';
}

function eventFormat(event = {}) {
    return event.format || event.bracket_type || event.type || state.tournament?.format || 'Bracket';
}

function eventEntryType(event = {}) {
    return event.entry_type || state.tournament?.entry_type || '';
}

function flattenDoubleMatches(bracket = {}) {
    const mapDouble = (match, bracketType) => ({
        ...match,
        match_id: match.id,
        bracket_type: bracketType,
        player1: match.team1,
        player2: match.team2,
        player1_name: participantName(match.team1),
        player2_name: participantName(match.team2),
        round_label: bracketType === 'winners'
            ? `Winners Round ${match.round || '?'}`
            : bracketType === 'losers'
                ? `Losers Round ${match.round || '?'}`
                : 'Grand Finals',
        board_no: matchBoard(match)
    });

    return [
        ...(bracket.winners || []).map(match => mapDouble(match, 'winners')),
        ...(bracket.losers || []).map(match => mapDouble(match, 'losers')),
        ...(bracket.grand_finals?.match1 ? [mapDouble(bracket.grand_finals.match1, 'grand_finals')] : []),
        ...(bracket.grand_finals?.match2 ? [mapDouble(bracket.grand_finals.match2, 'grand_finals')] : [])
    ];
}

function flattenSingleMatches(bracket = {}) {
    return (bracket.matches || []).map(match => ({
        ...match,
        match_id: match.id,
        bracket_type: 'single',
        player1_name: participantName(match.player1),
        player2_name: participantName(match.player2),
        round_label: match.round ? `Round ${match.round}` : 'Match',
        board_no: matchBoard(match)
    }));
}

function flattenMatches(tournament) {
    const bracket = tournament?.bracket || {};
    if (bracket.type === 'double_elimination') return flattenDoubleMatches(bracket);
    return flattenSingleMatches(bracket);
}

function currentBoardData() {
    const count = Number(state.tournament?.venue_board_count || state.tournament?.boards_available || 0);
    const blocked = new Set((state.tournament?.unavailable_boards || state.tournament?.reserved_boards || [])
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value > 0));
    const boards = Array.from({ length: count }, (_, index) => ({
        board_number: index + 1,
        status: blocked.has(index + 1) ? 'unavailable' : 'available',
        match: null
    }));

    state.matches.forEach(match => {
        const board = Number(matchBoard(match));
        if (!board || !boards[board - 1]) return;
        if (!['pending', 'ready', 'in_progress'].includes(match.status)) return;
        if (blocked.has(board)) return;
        boards[board - 1] = {
            board_number: board,
            status: match.status === 'in_progress' ? 'in_use' : 'assigned',
            match
        };
    });

    return {
        count,
        boards,
        available: boards.filter(board => board.status === 'available'),
        blocked: boards.filter(board => board.status === 'unavailable'),
        active: state.matches.filter(match => match.status === 'in_progress'),
        pending: state.matches.filter(match => ['pending', 'ready'].includes(match.status) && hasBothSides(match))
    };
}

function voteCounts() {
    const counts = {};
    Object.entries(state.tournament?.registration_vote_counts || {}).forEach(([id, count]) => {
        counts[id] = Number(count) || 0;
    });
    if (Object.keys(counts).length) return counts;
    state.registrations.forEach(reg => {
        const id = reg.registration_vote?.option_id;
        if (!id) return;
        counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
}

function buildScorerUrl(match) {
    const gameType = String(match.game_type || state.tournament?.game_type || '501').toLowerCase();
    const bestOf = Number(match.best_of || state.tournament?.best_of || 3);
    const legsToWin = Math.max(1, Math.ceil(bestOf / 2));
    const page = gameType === 'cricket' ? 'league-cricket-vnext.html' : 'x01-scorer-vnext.html';
    const query = new URLSearchParams({
        tournament_id: tournamentId,
        tournament_match_id: match.match_id,
        tournament_type: isDoubleElim() ? 'double' : 'single',
        return_url: window.location.href,
        home_team_name: participantName(match.player1 || match.team1, 'Player 1'),
        away_team_name: participantName(match.player2 || match.team2, 'Player 2'),
        legs_to_win: String(legsToWin),
        cork: 'true'
    });
    if (gameType !== 'cricket') {
        query.set('starting_score', String(state.tournament?.x01_value || 501));
        query.set('format', '501');
        query.set('in_rule', state.tournament?.in_rule || 'straight');
        query.set('checkout', state.tournament?.checkout || state.tournament?.out_rule || 'double');
    }
    return `/rookies/pages/${page}?${query.toString()}`;
}

function buildCallText(match) {
    const board = matchBoard(match) ? `Board ${matchBoard(match)}` : 'Board TBD';
    const room = match.room_label || 'Room TBD';
    const url = match.room_url ? `\nRoom: ${match.room_url}` : '';
    const stream = match.stream_url ? `\nStream: ${match.stream_url}` : '';
    return `${matchName(match)}\n${match.round_label || 'Match'} - ${friendly(match.game_type || state.tournament?.game_type || '501')}\n${board} - ${room}${url}${stream}`;
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
}

function renderSettings() {
    const t = state.tournament || {};
    const firstEvent = state.events[0] || {};
    const eventOptions = state.events.length
        ? state.events.map(event => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.event_name || event.name || event.id)}</option>`).join('')
        : '<option value="">Main event</option>';
    const canUseSeedTools = Boolean(t.bracket?.winners?.length);

    return `
        <section class="ves-panel ves-runtime-settings">
            <p class="ves-kicker">Director controls</p>
            <h2>Setup</h2>
            <div class="ves-config-grid">
                <label>Name<input id="rtName" value="${escapeHtml(title(t))}"></label>
                <label>Status<select id="rtStatus">
                    ${['created', 'registration', 'registration_open', 'bracket_generated', 'in_progress', 'completed'].map(status => `<option value="${status}" ${String(t.status || '') === status ? 'selected' : ''}>${friendly(status)}</option>`).join('')}
                </select></label>
                <label>Format<select id="rtFormat">
                    ${['single_elimination', 'double_elimination', 'round_robin'].map(format => `<option value="${format}" ${normalizeFormat(t.format) === format ? 'selected' : ''}>${friendly(format)}</option>`).join('')}
                </select></label>
                <label>Game<select id="rtGame">
                    ${['501', '301', '701', 'cricket', 'corks_choice'].map(game => `<option value="${game}" ${String(t.game_type || firstEvent.game || '501') === game ? 'selected' : ''}>${friendly(game)}</option>`).join('')}
                </select></label>
                <label>Best of<input id="rtBestOf" type="number" min="1" step="2" value="${escapeHtml(t.best_of || firstEvent.best_of || 3)}"></label>
                <label>Max players<input id="rtMaxPlayers" type="number" min="2" value="${escapeHtml(t.max_players || 16)}"></label>
                <label>Entry fee<input id="rtEntryFee" type="number" min="0" step="0.01" value="${escapeHtml(t.entry_fee || 0)}"></label>
                <label>Boards<input id="rtBoards" type="number" min="0" value="${escapeHtml(t.venue_board_count || t.boards_available || 0)}"></label>
                <label>Unavailable boards<input id="rtUnavailableBoards" value="${escapeHtml((t.unavailable_boards || t.reserved_boards || []).join(', '))}" placeholder="Example: 1, 4, 7"></label>
            </div>
            <div class="ves-runtime-actions">
                <button class="ves-action primary" type="button" data-runtime-action="save-settings">Save settings</button>
                <a class="ves-action" href="/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournamentId)}">Open bracket</a>
                <a class="ves-action" href="/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}">Registration</a>
            </div>
            <div class="ves-runtime-draw">
                <div class="ves-config-grid">
                    <label>Draw event<select id="rtDrawEvent">${eventOptions}</select></label>
                    <label>House player<input id="rtHousePlayer" placeholder="Only if player count is odd"></label>
                </div>
                <label class="ves-inline-check"><input id="rtCheckedInOnly" type="checkbox"> Checked-in only</label>
                <label class="ves-inline-check"><input id="rtForceBracket" type="checkbox"> Force overwrite existing bracket</label>
                <div class="ves-runtime-actions">
                <button class="ves-action primary" type="button" data-runtime-action="generate-blind-draw">${eventEntryType(firstEvent) === 'blind_draw' ? 'Generate blind draw' : 'Generate blind draw doubles'}</button>
                <button class="ves-action" type="button" data-runtime-action="generate-bracket">Generate bracket from players</button>
            </div>
            </div>
            <div class="ves-runtime-draw">
                <p class="ves-kicker">Bracket operations</p>
                <div class="ves-config-grid">
                    <label>Swap seed position<input id="rtSwapPosition1" type="number" min="0" placeholder="0"></label>
                    <label>With position<input id="rtSwapPosition2" type="number" min="0" placeholder="1"></label>
                    <label>Bot ID<input id="rtBotId" placeholder="Optional house/bot ID"></label>
                </div>
                <div class="ves-runtime-actions">
                    <button class="ves-action" type="button" data-runtime-action="swap-positions" ${canUseSeedTools ? '' : 'disabled'}>Swap positions</button>
                    <button class="ves-action" type="button" data-runtime-action="regenerate-bracket" ${canUseSeedTools ? '' : 'disabled'}>Regenerate seeding</button>
                    <button class="ves-action" type="button" data-runtime-action="lock-bracket" ${canUseSeedTools && !t.bracket_locked ? '' : 'disabled'}>${t.bracket_locked ? 'Bracket locked' : 'Lock bracket'}</button>
                    <button class="ves-action" type="button" data-runtime-action="add-bot">Add bot</button>
                    <button class="ves-action" type="button" data-runtime-action="recalculate-stats">Recalculate stats</button>
                    <button class="ves-action danger" type="button" data-runtime-action="delete-tournament">Delete tournament</button>
                </div>
                <p class="ves-director-auth-copy">Seed swap/regenerate apply to double-elimination brackets before first-round play. Single-elimination can be rebuilt with force overwrite above.</p>
            </div>
            <div class="ves-form-status" id="runtimeActionStatus"></div>
        </section>
    `;
}

function renderBoards() {
    const boardData = currentBoardData();
    if (!boardData.count) {
        return `
            <section class="ves-panel">
                <p class="ves-kicker">Boards</p>
                <h2>Availability</h2>
                <p class="ves-director-auth-copy">Set the board count in Setup to enable board availability and quick assignment.</p>
            </section>
        `;
    }

    const boardCards = boardData.boards.map(board => `
        <div class="ves-board ${board.status}">
            <strong>${board.board_number}</strong>
            <span>${escapeHtml(friendly(board.status))}</span>
            <em>${escapeHtml(board.match ? matchName(board.match) : 'Open')}</em>
            ${board.status === 'available' ? `<button type="button" data-runtime-action="quick-assign" data-board="${board.board_number}">Assign next</button>` : ''}
        </div>
    `).join('');

    return `
        <section class="ves-panel">
            <p class="ves-kicker">Boards</p>
            <h2>Availability</h2>
            <div class="ves-board-grid">${boardCards}</div>
            <p class="ves-director-auth-copy">${boardData.available.length} available, ${boardData.blocked.length} unavailable, ${boardData.active.length} active, ${boardData.pending.length} waiting.</p>
        </section>
    `;
}

function renderVotingPanel() {
    if (!votingEnabled()) return '';
    const t = state.tournament || {};
    const options = voteOptions();
    const counts = voteCounts();
    const total = options.reduce((sum, option) => sum + (counts[option.id] || 0), 0);
    const locked = t.registration_vote_locked === true;
    const selectedLabel = t.registration_vote_selected_label || '';
    const rows = options.map(option => {
        const count = counts[option.id] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        return `
            <div class="ves-vote-row ${selectedLabel === option.label ? 'selected' : ''}">
                <div>
                    <strong>${escapeHtml(option.label)}</strong>
                    <span>${count} vote${count === 1 ? '' : 's'} / ${pct}%</span>
                </div>
                <meter min="0" max="${Math.max(total, 1)}" value="${count}"></meter>
            </div>
        `;
    }).join('');
    const suggestions = state.registrations
        .map(reg => reg.registration_vote?.suggestion)
        .filter(Boolean)
        .slice(0, 5);

    return `
        <section class="ves-panel ves-voting-runtime">
            <p class="ves-kicker">Wing It voting</p>
            <h2>${escapeHtml(t.registration_vote_question || 'What should we play this week?')}</h2>
            <div class="ves-runtime-list">${rows}</div>
            ${suggestions.length ? `<p class="ves-director-auth-copy">Suggestions: ${escapeHtml(suggestions.join(' / '))}</p>` : ''}
            <div class="ves-config-grid">
                <label>Final format<input id="rtVoteSelectedLabel" value="${escapeHtml(selectedLabel)}" placeholder="Example: 501/C/CH"></label>
                <label>Question<input id="rtVoteQuestion" value="${escapeHtml(t.registration_vote_question || 'What should we play this week?')}"></label>
                <label>Voting options<textarea id="rtVoteOptions" rows="4">${escapeHtml(options.map(option => option.label).join('\n'))}</textarea></label>
            </div>
            <div class="ves-runtime-actions">
                <label class="ves-inline-check"><input id="rtVoteEnabled" type="checkbox" ${votingEnabled() ? 'checked' : ''}> Voting enabled</label>
                <label class="ves-inline-check"><input id="rtVoteRequired" type="checkbox" ${t.registration_vote_required === false ? '' : 'checked'}> Required during registration</label>
                <label class="ves-inline-check"><input id="rtVoteLocked" type="checkbox" ${locked ? 'checked' : ''}> Lock final format</label>
                <button class="ves-action primary" type="button" data-runtime-action="save-voting-settings">Save voting</button>
            </div>
            <p class="ves-director-auth-copy">${locked ? 'Voting is locked. Registration will show the final format.' : 'Voting guides the director only; it does not change the bracket until you update event settings.'}</p>
        </section>
    `;
}

function renderMatchmakerPanel() {
    if (!isMatchmaker()) return '';
    const t = state.tournament || {};
    const counts = t.registration_counts || {};
    const waiting = Number(counts.singles_male || 0) + Number(counts.singles_female || 0);
    const teams = Number(counts.teams || 0);
    return `
        <section class="ves-panel ves-matchmaker-runtime">
            <p class="ves-kicker">Matchmaker</p>
            <h2>Mixed doubles flow</h2>
            <div class="ves-runtime-list">
                <div class="ves-runtime-row">
                    <strong>${teams} pairs</strong>
                    <span>${waiting} singles waiting</span>
                    <em>${Number(counts.singles_male || 0)} male / ${Number(counts.singles_female || 0)} female</em>
                </div>
                <div class="ves-runtime-row">
                    <strong>Winners: ${escapeHtml(friendly(t.winners_game_type || 'cricket'))}</strong>
                    <span>Best of ${escapeHtml(t.winners_best_of || 3)}</span>
                    <em>Losers: ${escapeHtml(friendly(t.losers_game_type || '501'))}, best of ${escapeHtml(t.losers_best_of || 1)}</em>
                </div>
                <div class="ves-runtime-row">
                    <strong>Mingle cutoff</strong>
                    <span>${escapeHtml(friendly(t.mingle_cutoff || 'wc_r2_last_start'))}</span>
                    <em>${t.breakup_enabled === false ? 'Breakups disabled' : 'Breakup/rematch enabled'}</em>
                </div>
            </div>
            <div class="ves-runtime-actions">
                <button class="ves-action primary" type="button" data-runtime-action="draw-matchmaker-partners">Draw partners</button>
                <button class="ves-action" type="button" data-runtime-action="start-mingle">Start mingle</button>
                <button class="ves-action" type="button" data-runtime-action="end-mingle">End mingle</button>
                <button class="ves-action" type="button" data-runtime-action="run-cupid-shuffle">Run Cupid Shuffle</button>
                <a class="ves-action" href="/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}">Register players</a>
                <a class="ves-action" href="/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournamentId)}">Bracket</a>
                <a class="ves-action" href="/rookies/pages/matchmaker-mingle-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}">Mingle page</a>
                <a class="ves-action" href="/rookies/pages/matchmaker-tv-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}">TV display</a>
            </div>
            <p class="ves-director-auth-copy">Use this panel for the matchmaker-specific pieces: partner draw, mingle window, breakup/rematch, and weekly event registration.</p>
        </section>
    `;
}

function renderRegistrations() {
    const rows = state.registrations.length
        ? state.registrations.map(reg => `
            <div class="ves-runtime-row rich">
                <div class="ves-row-main">
                    <strong>${escapeHtml(registrationName(reg))}</strong>
                    <span>${escapeHtml(registrationContact(reg, 'email'))}</span>
                    <span>${escapeHtml(registrationContact(reg, 'phone'))}</span>
                    <em>${escapeHtml(`${isCheckedIn(reg) ? 'Checked in' : 'Not checked in'} · ${friendly(runtimeStatus(reg))}`)}</em>
                </div>
                <div class="ves-row-tools">
                    <button type="button" data-runtime-action="set-check-in" data-registration-id="${escapeHtml(reg.id)}" data-player-id="${escapeHtml(registrationPlayerId(reg))}" data-checked-in="${isCheckedIn(reg) ? 'false' : 'true'}">${isCheckedIn(reg) ? 'Undo check-in' : 'Check in'}</button>
                    ${['active', 'hold', 'dropped'].map(status => `<button type="button" data-runtime-action="set-availability" data-registration-id="${escapeHtml(reg.id)}" data-player-id="${escapeHtml(registrationPlayerId(reg))}" data-runtime-status="${status}" ${runtimeStatus(reg) === status ? 'disabled' : ''}>${friendly(status)}</button>`).join('')}
                </div>
            </div>
        `).join('')
        : '<div class="ves-empty">No registrations yet.</div>';

    return `
        <section class="ves-panel">
            <p class="ves-kicker">Players</p>
            <h2>Registration</h2>
            <div class="ves-runtime-list">${rows}</div>
        </section>
    `;
}

function boardSelect(match) {
    const boardData = currentBoardData();
    const selected = Number(matchBoard(match) || 0);
    const options = ['<option value="">Board TBD</option>']
        .concat(boardData.boards.map(board => {
            const occupiedByOther = board.match && board.match.match_id !== match.match_id;
            const label = occupiedByOther ? `Board ${board.board_number} - ${matchName(board.match)}` : `Board ${board.board_number}`;
            return `<option value="${board.board_number}" ${selected === board.board_number ? 'selected' : ''} ${occupiedByOther ? 'disabled' : ''}>${escapeHtml(label)}</option>`;
        }));
    return `<select data-runtime-action="assign-board" data-match-id="${escapeHtml(match.match_id)}">${options.join('')}</select>`;
}

function renderMatches() {
    if (!state.matches.length) {
        return `
            <section class="ves-panel">
                <p class="ves-kicker">Matches</p>
                <h2>Runtime</h2>
                <div class="ves-empty">No bracket matches yet. Generate a bracket after registration closes.</div>
            </section>
        `;
    }

    const rows = state.matches.map(match => {
        const ready = hasBothSides(match) && match.status !== 'completed';
        const detail = [
            friendly(match.status || 'waiting'),
            matchBoard(match) ? `Board ${matchBoard(match)}` : 'Board TBD',
            match.room_label || 'Room TBD',
            matchScore(match),
            resultReviewLabel(match)
        ].filter(Boolean).join(' / ');
        return `
            <article class="ves-runtime-match ${escapeHtml(match.status || 'waiting')}">
                <div>
                    <p class="ves-kicker">${escapeHtml(match.round_label || 'Match')}</p>
                    <h2>${escapeHtml(matchName(match))}</h2>
                    <p>${escapeHtml(detail)}</p>
                </div>
                <div class="ves-runtime-match-tools">
                    ${boardSelect(match)}
                    <input class="ves-score-input" data-score-side="1" data-match-id="${escapeHtml(match.match_id)}" type="number" min="0" placeholder="1">
                    <input class="ves-score-input" data-score-side="2" data-match-id="${escapeHtml(match.match_id)}" type="number" min="0" placeholder="2">
                    <button type="button" data-runtime-action="submit-result" data-match-id="${escapeHtml(match.match_id)}" ${ready && match.status !== 'completed' ? '' : 'disabled'}>Submit result</button>
                    <button type="button" data-runtime-action="edit-room" data-match-id="${escapeHtml(match.match_id)}">Room</button>
                    <button type="button" data-runtime-action="copy-call" data-match-id="${escapeHtml(match.match_id)}" ${ready ? '' : 'disabled'}>Copy call</button>
                    <button type="button" data-runtime-action="call-match" data-match-id="${escapeHtml(match.match_id)}" ${ready ? '' : 'disabled'}>Call</button>
                    <button type="button" data-runtime-action="send-reminder" data-match-id="${escapeHtml(match.match_id)}" ${ready ? '' : 'disabled'}>Notify</button>
                    <button type="button" data-runtime-action="launch-scorer" data-match-id="${escapeHtml(match.match_id)}" ${ready ? '' : 'disabled'}>Scorer</button>
                    <button type="button" data-runtime-action="confirm-result" data-match-id="${escapeHtml(match.match_id)}" ${match.status === 'completed' ? '' : 'disabled'}>Confirm</button>
                    <button type="button" data-runtime-action="dispute-result" data-match-id="${escapeHtml(match.match_id)}" ${match.status === 'completed' ? '' : 'disabled'}>Dispute</button>
                    ${match.room_url ? `<button type="button" data-runtime-action="open-room" data-match-id="${escapeHtml(match.match_id)}">Open</button>` : ''}
                    <button type="button" data-runtime-action="close-room" data-match-id="${escapeHtml(match.match_id)}">Close</button>
                </div>
            </article>
        `;
    }).join('');

    return `
        <section class="ves-panel">
            <p class="ves-kicker">Matches</p>
            <h2>Boards & Calls</h2>
            <div class="ves-runtime-match-list">${rows}</div>
        </section>
    `;
}

function renderEvents() {
    const rows = state.events.length ? state.events : [{ id: 'main', event_name: title(), game: state.tournament?.game_type, format: state.tournament?.format }];
    return `
        <section class="ves-panel">
            <p class="ves-kicker">Events</p>
            <h2>Formats</h2>
            <div class="ves-runtime-list">
                ${rows.map(event => `
                    <div class="ves-runtime-row">
                        <strong>${escapeHtml(event.event_name || event.name || 'Event')}</strong>
                        <span>${escapeHtml(friendly(eventEntryType(event) || 'event'))}</span>
                        <span>${escapeHtml(friendly(eventGame(event)))}</span>
                        <em>${escapeHtml(friendly(eventFormat(event)))}</em>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

function setActionStatus(message, type = '') {
    const node = document.getElementById('runtimeActionStatus');
    if (!node) return;
    node.className = `ves-form-status ${type}`;
    node.textContent = message || '';
}

function renderAll() {
    const t = state.tournament || {};
    const boardData = currentBoardData();
    els.status.textContent = t.status || 'Runtime';
    els.title.textContent = title(t);
    els.meta.textContent = isMatchmaker()
        ? `Mixed doubles matchmaker / ${friendly(normalizeFormat(t.format))} / ${boardData.count || 0} boards`
        : `${friendly(normalizeFormat(t.format))} / ${friendly(t.game_type || '501')} / ${boardData.count || 0} boards`;
    els.tournament.href = `/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.register.href = `/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.bracket.href = `/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.events.textContent = String(state.events.length || 1);
    els.regs.textContent = String(state.registrations.length || t.registered_count || 0);
    els.rooms.textContent = String(boardData.available.length || 0);
    els.grid.innerHTML = [
        renderMatchmakerPanel(),
        renderSettings(),
        renderVotingPanel(),
        renderBoards(),
        renderMatches(),
        renderRegistrations(),
        renderEvents()
    ].join('');
}

async function load() {
    if (!tournamentId) throw new Error('Missing tournament_id');
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const [tournamentSnap, eventsSnap, regsSnap, runtimeRoomsSnap, matchRoomsSnap] = await Promise.all([
        getDoc(tournamentRef),
        getDocs(collection(db, 'tournaments', tournamentId, 'events')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tournaments', tournamentId, 'registrations')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tournaments', tournamentId, 'runtime_rooms')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tournaments', tournamentId, 'match_rooms')).catch(() => ({ docs: [] }))
    ]);
    if (!tournamentSnap.exists()) throw new Error('Tournament not found');
    state.tournament = { id: tournamentSnap.id, ...tournamentSnap.data() };
    state.events = eventsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    state.registrations = regsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    state.rooms = [
        ...runtimeRoomsSnap.docs.map(item => ({ id: item.id, ...item.data() })),
        ...matchRoomsSnap.docs.map(item => ({ id: item.id, ...item.data() }))
    ];
    state.matches = flattenMatches(state.tournament);
    renderAll();
}

function getMatch(matchId) {
    return state.matches.find(match => match.match_id === matchId || match.id === matchId);
}

function slugOption(value, index) {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return slug || `option_${index + 1}`;
}

function votingOptionsFromTextarea(value) {
    const seen = new Set();
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean)
        .map((label, index) => {
            let id = slugOption(label, index);
            let suffix = 2;
            while (seen.has(id)) {
                id = `${slugOption(label, index)}_${suffix}`;
                suffix += 1;
            }
            seen.add(id);
            return { id, label };
        });
}

async function saveSettings() {
    const unavailableBoards = String(document.getElementById('rtUnavailableBoards')?.value || '')
        .split(',')
        .map(value => parseInt(value.trim(), 10))
        .filter(value => Number.isFinite(value) && value > 0);
    const settings = {
        tournament_name: document.getElementById('rtName')?.value.trim(),
        status: document.getElementById('rtStatus')?.value,
        format: document.getElementById('rtFormat')?.value,
        game_type: document.getElementById('rtGame')?.value,
        best_of: parseInt(document.getElementById('rtBestOf')?.value, 10) || 3,
        max_players: parseInt(document.getElementById('rtMaxPlayers')?.value, 10) || 16,
        entry_fee: parseFloat(document.getElementById('rtEntryFee')?.value) || 0,
        venue_board_count: parseInt(document.getElementById('rtBoards')?.value, 10) || 0,
        unavailable_boards: [...new Set(unavailableBoards)]
    };

    if (!settings.tournament_name) throw new Error('Tournament name is required.');
    await callFunction('updateTournamentSettings', { tournament_id: tournamentId, settings });
    setActionStatus('Settings saved.', 'success');
    await load();
}

async function saveVotingSettings() {
    const options = votingOptionsFromTextarea(document.getElementById('rtVoteOptions')?.value || '');
    const settings = {
        registration_voting_enabled: document.getElementById('rtVoteEnabled')?.checked === true && options.length > 0,
        registration_vote_required: document.getElementById('rtVoteRequired')?.checked !== false,
        registration_vote_locked: document.getElementById('rtVoteLocked')?.checked === true,
        registration_vote_question: document.getElementById('rtVoteQuestion')?.value.trim() || 'What should we play this week?',
        registration_vote_selected_label: document.getElementById('rtVoteSelectedLabel')?.value.trim() || '',
        registration_vote_options: options
    };
    if (settings.registration_voting_enabled && !settings.registration_vote_options.length) {
        throw new Error('Add at least one voting option.');
    }
    await callFunction('updateTournamentSettings', { tournament_id: tournamentId, settings });
    setActionStatus('Voting settings saved.', 'success');
    await load();
}

async function generateBracket(useBlindDraw) {
    const force = document.getElementById('rtForceBracket')?.checked === true;
    if ((state.tournament?.bracketGenerated || state.tournament?.bracket) && !force) {
        throw new Error('Bracket already exists. Check force overwrite if you really want to rebuild it.');
    }

    if (useBlindDraw) {
        const eventId = document.getElementById('rtDrawEvent')?.value || state.events[0]?.id || '';
        await callFunction('generateBlindDrawBracket', {
            tournament_id: tournamentId,
            event_id: eventId,
            checked_in_only: document.getElementById('rtCheckedInOnly')?.checked === true,
            house_name: document.getElementById('rtHousePlayer')?.value.trim() || '',
            force
        });
    } else if (normalizeFormat(document.getElementById('rtFormat')?.value || state.tournament?.format) === 'double_elimination') {
        await callFunction('generateDoubleEliminationBracket', { tournament_id: tournamentId });
    } else {
        await callFunction('generateBracket', { tournament_id: tournamentId });
    }

    setActionStatus('Bracket generated.', 'success');
    await load();
}

async function drawMatchmakerPartners() {
    await callFunction('matchmakerDrawPartners', { tournament_id: tournamentId });
    setActionStatus('Matchmaker partners drawn.', 'success');
    await load();
}

async function startMingle() {
    await callFunction('startMinglePeriod', { tournament_id: tournamentId });
    setActionStatus('Mingle period started.', 'success');
    await load();
}

async function endMingle() {
    await callFunction('endMinglePeriod', { tournament_id: tournamentId });
    setActionStatus('Mingle period ended.', 'success');
    await load();
}

async function runCupidShuffle() {
    await callFunction('runCupidShuffle', { tournament_id: tournamentId });
    setActionStatus('Cupid Shuffle complete.', 'success');
    await load();
}

async function swapPositions() {
    const position1 = parseInt(document.getElementById('rtSwapPosition1')?.value, 10);
    const position2 = parseInt(document.getElementById('rtSwapPosition2')?.value, 10);
    if (!Number.isFinite(position1) || !Number.isFinite(position2)) {
        throw new Error('Enter two bracket seed positions to swap.');
    }
    await callFunction('swapBracketPositions', { tournament_id: tournamentId, position1, position2 });
    setActionStatus('Bracket positions swapped.', 'success');
    await load();
}

async function regenerateBracket() {
    if (!confirm('Regenerate bracket seeding? This clears unplayed advancement state.')) return;
    await callFunction('regenerateBracket', { tournament_id: tournamentId });
    setActionStatus('Bracket seeding regenerated.', 'success');
    await load();
}

async function lockBracket() {
    if (!confirm('Lock the bracket now? Seed edits will be disabled.')) return;
    await callFunction('lockBracket', { tournament_id: tournamentId });
    setActionStatus('Bracket locked.', 'success');
    await load();
}

async function addBot() {
    const bot_id = document.getElementById('rtBotId')?.value.trim();
    if (!bot_id) throw new Error('Enter a bot ID.');
    await callFunction('addBotToTournament', { tournament_id: tournamentId, bot_id });
    setActionStatus('Bot added.', 'success');
    await load();
}

async function recalculateStats() {
    await callFunction('recalculateTournamentStats', { tournament_id: tournamentId });
    setActionStatus('Tournament stats recalculated.', 'success');
    await load();
}

async function deleteTournament() {
    const typed = prompt(`Type DELETE to permanently remove ${title()}.`);
    if (typed !== 'DELETE') return;
    await callFunction('deleteTournament', { tournament_id: tournamentId });
    window.location.href = '/rookies/pages/events-vnext.html';
}

async function updateMatchRoom(matchId, patch) {
    await callFunction('updateTournamentMatchRoom', {
        tournament_id: tournamentId,
        match_id: matchId,
        ...patch
    });
    await load();
}

async function quickAssign(boardNumber) {
    const match = currentBoardData().pending.find(item => !matchBoard(item));
    if (!match) throw new Error('No waiting match without a board.');
    await updateMatchRoom(match.match_id, { board_number: boardNumber });
    setActionStatus(`${matchName(match)} assigned to Board ${boardNumber}.`, 'success');
}

async function editRoom(matchId) {
    const match = getMatch(matchId);
    if (!match) throw new Error('Match not found.');
    const room_label = prompt('Room label', match.room_label || '') ?? (match.room_label || '');
    const room_url = prompt('Room URL or board/location note', match.room_url || '') ?? (match.room_url || '');
    const stream_url = prompt('Stream URL', match.stream_url || '') ?? (match.stream_url || '');
    const room_notes = prompt('Room notes', match.room_notes || '') ?? (match.room_notes || '');
    const board_number = prompt('Board number', matchBoard(match) || '') ?? (matchBoard(match) || '');
    await updateMatchRoom(matchId, { room_label, room_url, stream_url, room_notes, board_number });
    setActionStatus('Match room updated.', 'success');
}

async function startMatch(matchId) {
    const match = getMatch(matchId);
    if (!match) throw new Error('Match not found.');
    await callFunction(isDoubleElim() ? 'startDoubleElimMatch' : 'startTournamentMatch', {
        tournament_id: tournamentId,
        match_id: matchId,
        board_number: matchBoard(match) || null,
        room_label: match.room_label || '',
        room_url: match.room_url || '',
        stream_url: match.stream_url || '',
        room_notes: match.room_notes || ''
    });
    await copyText(buildCallText(match));
    setActionStatus('Match called and copied.', 'success');
    await load();
}

async function setCheckIn(target) {
    await callFunction('setTournamentPlayerCheckIn', {
        tournament_id: tournamentId,
        registration_id: target.dataset.registrationId || '',
        player_id: target.dataset.playerId || '',
        checked_in: target.dataset.checkedIn !== 'false'
    });
    setActionStatus('Check-in updated.', 'success');
    await load();
}

async function setAvailability(target) {
    await callFunction('setTournamentParticipantAvailability', {
        tournament_id: tournamentId,
        registration_id: target.dataset.registrationId || '',
        player_id: target.dataset.playerId || '',
        runtime_status: target.dataset.runtimeStatus || 'active'
    });
    setActionStatus('Player availability updated.', 'success');
    await load();
}

async function submitResult(matchId) {
    const match = getMatch(matchId);
    if (!match) throw new Error('Match not found.');
    const side1 = parseInt(document.querySelector(`[data-score-side="1"][data-match-id="${CSS.escape(matchId)}"]`)?.value, 10);
    const side2 = parseInt(document.querySelector(`[data-score-side="2"][data-match-id="${CSS.escape(matchId)}"]`)?.value, 10);
    if (!Number.isFinite(side1) || !Number.isFinite(side2)) throw new Error('Enter both scores.');
    if (side1 === side2) throw new Error('Tournament match scores cannot tie.');
    if (!confirm(`Submit ${matchName(match)} as ${side1}-${side2}?`)) return;

    const payload = isDoubleElim()
        ? { tournament_id: tournamentId, match_id: matchId, team1_score: side1, team2_score: side2 }
        : { tournament_id: tournamentId, match_id: matchId, player1_score: side1, player2_score: side2 };
    await callFunction(isDoubleElim() ? 'submitDoubleElimMatchResult' : 'submitMatchResult', payload);
    setActionStatus('Result submitted.', 'success');
    await load();
}

async function respondResult(matchId, action) {
    const notes = action === 'dispute'
        ? (prompt('Dispute notes', '') || '')
        : '';
    await callFunction('respondTournamentMatchResult', {
        tournament_id: tournamentId,
        match_id: matchId,
        action,
        notes
    });
    setActionStatus(`Result ${action}d.`, 'success');
    await load();
}

async function handleAction(target) {
    const action = target.dataset.runtimeAction;
    const matchId = target.dataset.matchId;
    setActionStatus('');
    try {
        if (action === 'save-settings') await saveSettings();
        if (action === 'save-voting-settings') await saveVotingSettings();
        if (action === 'generate-bracket') await generateBracket(false);
        if (action === 'generate-blind-draw') await generateBracket(true);
        if (action === 'draw-matchmaker-partners') await drawMatchmakerPartners();
        if (action === 'start-mingle') await startMingle();
        if (action === 'end-mingle') await endMingle();
        if (action === 'run-cupid-shuffle') await runCupidShuffle();
        if (action === 'swap-positions') await swapPositions();
        if (action === 'regenerate-bracket') await regenerateBracket();
        if (action === 'lock-bracket') await lockBracket();
        if (action === 'add-bot') await addBot();
        if (action === 'recalculate-stats') await recalculateStats();
        if (action === 'delete-tournament') await deleteTournament();
        if (action === 'set-check-in') await setCheckIn(target);
        if (action === 'set-availability') await setAvailability(target);
        if (action === 'quick-assign') await quickAssign(parseInt(target.dataset.board, 10));
        if (action === 'assign-board') {
            await updateMatchRoom(matchId, { board_number: target.value || null });
            setActionStatus('Board updated.', 'success');
        }
        if (action === 'submit-result') await submitResult(matchId);
        if (action === 'edit-room') await editRoom(matchId);
        if (action === 'copy-call') {
            await copyText(buildCallText(getMatch(matchId)));
            setActionStatus('Match call copied.', 'success');
        }
        if (action === 'call-match') await startMatch(matchId);
        if (action === 'send-reminder') {
            await callFunction('sendTournamentRuntimeReminder', { tournament_id: tournamentId, match_id: matchId });
            setActionStatus('Reminder sent.', 'success');
        }
        if (action === 'launch-scorer') {
            await startMatch(matchId);
            window.location.href = buildScorerUrl(getMatch(matchId));
        }
        if (action === 'open-room') {
            const match = getMatch(matchId);
            if (!match?.room_url) throw new Error('No room URL set.');
            window.open(match.room_url, '_blank', 'noopener,noreferrer');
        }
        if (action === 'close-room') {
            await callFunction('setTournamentMatchRoomLifecycle', {
                tournament_id: tournamentId,
                match_id: matchId,
                lifecycle_action: 'closed'
            });
            setActionStatus('Room marked closed.', 'success');
            await load();
        }
        if (action === 'confirm-result') await respondResult(matchId, 'confirm');
        if (action === 'dispute-result') await respondResult(matchId, 'dispute');
    } catch (error) {
        setActionStatus(error.message || 'Action failed.', 'error');
        if (typeof window.toastError === 'function') window.toastError(error.message || 'Action failed.');
    }
}

els.grid.addEventListener('click', event => {
    const target = event.target.closest('[data-runtime-action]');
    if (!target || target.tagName === 'SELECT') return;
    handleAction(target);
});

els.grid.addEventListener('change', event => {
    const target = event.target.closest('[data-runtime-action="assign-board"]');
    if (target) handleAction(target);
});

requireDirectorLogin({
    mountAfter: document.querySelector('.ves-hero'),
    gatedElements: [els.summary, els.grid],
    statusEl: els.status,
    title: 'Tournament Director',
    copy: 'Director login is required for check-in, boards, bracket setup, and scorer launch controls.',
    readyText: 'Director mode'
}).then(player => {
    if (!player) return;
    return load();
}).catch(error => {
    console.error('[tournament-runtime-vnext] failed:', error);
    els.status.textContent = 'Runtime unavailable';
    els.grid.hidden = false;
    els.grid.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load runtime')}</div>`;
});
