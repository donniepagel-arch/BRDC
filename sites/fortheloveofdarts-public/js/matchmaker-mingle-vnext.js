import { db, collection, doc, getDoc, getDocs } from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get('tournament_id') || params.get('id') || 'rookies-matchmaker-demo';

const els = {
    status: document.getElementById('mingleStatus'),
    title: document.getElementById('mingleTitle'),
    meta: document.getElementById('mingleMeta'),
    event: document.getElementById('eventLink'),
    register: document.getElementById('registerLink'),
    runtime: document.getElementById('runtimeLink'),
    tv: document.getElementById('tvLink'),
    teamCount: document.getElementById('teamCount'),
    singleCount: document.getElementById('singleCount'),
    clock: document.getElementById('mingleClock'),
    board: document.getElementById('mingleBoard'),
    teams: document.getElementById('mingleTeams'),
    singles: document.getElementById('mingleSingles'),
    breakups: document.getElementById('mingleBreakups')
};

let state = { tournament: null, registrations: [] };

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function title(data = state.tournament) {
    return data?.tournament_name || data?.name || 'Mixed Doubles Matchmaker';
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function teamName(reg) {
    if (reg.team_name) return reg.team_name;
    const names = [reg.player1?.name, reg.player2?.name].filter(Boolean);
    return names.length ? names.join(' & ') : 'Team';
}

function playerName(player, fallback = 'Player') {
    return player?.name || player?.full_name || player?.player_name || fallback;
}

function playerGender(player) {
    return player?.gender || player?.preferred_gender || '';
}

function isCheckedIn(reg) {
    if (reg.player1 || reg.player2) return reg.player1?.checked_in === true && reg.player2?.checked_in === true;
    return reg.player?.checked_in === true || reg.checked_in === true || reg.checkedIn === true;
}

function isTeam(reg) {
    return reg.registration_type === 'team' || reg.type === 'team' || Boolean(reg.player1 || reg.player2 || reg.partner_name);
}

function isSingle(reg) {
    return !isTeam(reg);
}

function teams() {
    const fromRegs = state.registrations.filter(isTeam).map(reg => ({
        id: reg.id,
        name: teamName(reg),
        player1: reg.player1 || reg.player || { name: reg.full_name || reg.name },
        player2: reg.player2 || (reg.partner_name ? { name: reg.partner_name, gender: reg.partner_gender } : null),
        checkedIn: isCheckedIn(reg),
        status: reg.runtime_status || reg.status || 'active'
    }));
    const fromTournament = asArray(state.tournament?.teams).map((team, index) => ({
        id: team.id || `team-${index}`,
        name: team.team_name || team.name || `Team ${index + 1}`,
        player1: team.player1,
        player2: team.player2,
        checkedIn: team.checked_in !== false,
        status: team.status || 'active'
    }));
    const byId = new Map();
    [...fromRegs, ...fromTournament].forEach(team => byId.set(team.id || team.name, team));
    return [...byId.values()];
}

function singles() {
    return state.registrations.filter(isSingle).map(reg => ({
        id: reg.id,
        player: reg.player || {
            name: reg.full_name || reg.name || reg.player_name,
            gender: reg.gender,
            email: reg.email,
            phone: reg.phone,
            checked_in: reg.checked_in
        },
        checkedIn: isCheckedIn(reg),
        status: reg.runtime_status || reg.status || 'waiting'
    }));
}

function breakupRows() {
    return [
        ...asArray(state.tournament?.breakups),
        ...asArray(state.tournament?.mingle_breakups),
        ...asArray(state.tournament?.heartbreaker_requests)
    ];
}

function matches() {
    const bracket = state.tournament?.bracket || {};
    return [
        ...asArray(bracket.winners),
        ...asArray(bracket.losers),
        ...(bracket.grand_finals?.match1 ? [bracket.grand_finals.match1] : []),
        ...(bracket.grand_finals?.match2 ? [bracket.grand_finals.match2] : [])
    ];
}

function matchParticipant(value, fallback = 'TBD') {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    return value.team_name || value.name || fallback;
}

function statusLabel(value) {
    return String(value || 'pending').replaceAll('_', ' ');
}

function card(kicker, heading, body, meta = '') {
    return `
        <article class="ves-runtime-match">
            <div>
                <p class="ves-kicker">${escapeHtml(kicker)}</p>
                <h2>${escapeHtml(heading)}</h2>
                <p>${escapeHtml(body)}</p>
            </div>
            ${meta ? `<div class="ves-card-meta">${meta}</div>` : ''}
        </article>
    `;
}

function renderHeader() {
    const t = state.tournament || {};
    const teamTotal = teams().length;
    const singleTotal = singles().length;
    const active = t.mingle_period?.active || t.mingle_active || t.status === 'mingle';
    els.status.textContent = active ? 'Mingle open' : (t.status || 'Matchmaker');
    els.title.textContent = title();
    els.meta.textContent = `${teamTotal} pairs, ${singleTotal} singles waiting - cutoff ${statusLabel(t.mingle_cutoff || 'director controlled')}`;
    els.teamCount.textContent = String(teamTotal);
    els.singleCount.textContent = String(singleTotal);
    els.clock.textContent = active ? 'Open' : 'Ready';
    els.event.href = `/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.register.href = `/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.runtime.href = `/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.tv.href = `/rookies/pages/matchmaker-tv-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}&mode=mingle-alert`;
}

function renderBoard() {
    const ready = matches().filter(match => ['ready', 'pending', 'in_progress'].includes(match.status || 'pending'));
    const teamRows = teams().slice(0, 6).map(team => card(
        team.checkedIn ? 'Checked in' : 'Needs check-in',
        team.name,
        [playerName(team.player1), playerName(team.player2)].filter(Boolean).join(' / '),
        `<span>${escapeHtml(statusLabel(team.status))}</span>`
    ));
    const matchRows = ready.slice(0, 4).map(match => card(
        match.round_label || `Round ${match.round || '?'}`,
        `${matchParticipant(match.team1 || match.player1)} vs ${matchParticipant(match.team2 || match.player2)}`,
        `Board ${match.board_number || match.board || 'TBD'} - ${statusLabel(match.status)}`,
        `<span>${escapeHtml(statusLabel(match.game_type || 'match'))}</span>`
    ));
    els.board.innerHTML = [...matchRows, ...teamRows].join('') || '<div class="ves-empty">No mingle activity is ready yet.</div>';
}

function renderTeams() {
    els.teams.innerHTML = teams().map(team => card(
        team.checkedIn ? 'Ready pair' : 'Pair pending',
        team.name,
        [playerName(team.player1), playerName(team.player2)].filter(Boolean).join(' / '),
        `<span>${escapeHtml(playerGender(team.player1) || '-')}</span><span>${escapeHtml(playerGender(team.player2) || '-')}</span>`
    )).join('') || '<div class="ves-empty">No teams have been matched yet.</div>';
}

function renderSingles() {
    els.singles.innerHTML = singles().map(single => card(
        single.checkedIn ? 'Checked in' : 'Waiting',
        playerName(single.player),
        `${playerGender(single.player) || 'Gender TBD'} - ${statusLabel(single.status)}`,
        `<span>${escapeHtml(single.player?.email || single.player?.phone || '')}</span>`
    )).join('') || '<div class="ves-empty">No singles are waiting.</div>';
}

function renderBreakups() {
    const rows = breakupRows();
    els.breakups.innerHTML = rows.map((row, index) => card(
        statusLabel(row.status || 'request'),
        row.team_name || row.team || `Breakup request ${index + 1}`,
        row.reason || row.notes || 'Director can resolve this from Runtime.',
        `<span>${escapeHtml(row.created_by || row.player_name || '')}</span>`
    )).join('') || '<div class="ves-empty">No breakup or rematch requests are active.</div>';
}

function renderAll() {
    renderHeader();
    renderBoard();
    renderTeams();
    renderSingles();
    renderBreakups();
}

function initTabs() {
    document.querySelectorAll('[data-mm-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.mmTarget;
            document.querySelectorAll('[data-mm-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-mm-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.mmPane === target));
        });
    });
}

async function load() {
    if (!tournamentId) throw new Error('Missing tournament_id');
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const [tournamentSnap, regsSnap] = await Promise.all([
        getDoc(tournamentRef),
        getDocs(collection(db, 'tournaments', tournamentId, 'registrations')).catch(() => ({ docs: [] }))
    ]);
    if (!tournamentSnap.exists()) throw new Error('Tournament not found');
    state.tournament = { id: tournamentSnap.id, ...tournamentSnap.data() };
    state.registrations = regsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
}

initTabs();
load().then(renderAll).catch(error => {
    console.error('[matchmaker-mingle-vnext] failed:', error);
    els.status.textContent = 'Mingle unavailable';
    els.board.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load mingle')}</div>`;
});
