import { db, doc, getDoc, collection, getDocs, onSnapshot } from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get('tournament_id') || params.get('id') || 'rookies-matchmaker-demo';
const validModes = new Set(['bracket', 'partner-reveal', 'match-call', 'mingle-alert']);
let currentMode = validModes.has(params.get('mode')) ? params.get('mode') : 'bracket';

const els = {
    status: document.getElementById('tvStatus'),
    title: document.getElementById('tvTitle'),
    meta: document.getElementById('tvMeta'),
    bracket: document.getElementById('tvBracketGrid'),
    partners: document.getElementById('tvPartnerGrid'),
    matches: document.getElementById('tvMatchGrid'),
    mingle: document.getElementById('tvMingleAlert')
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

function participant(value, fallback = 'TBD') {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    return value.team_name || value.name || value.full_name || value.player_name || fallback;
}

function matchScore(match) {
    const one = match.team1_score ?? match.player1_score ?? match.scores?.team1 ?? match.scores?.player1 ?? '-';
    const two = match.team2_score ?? match.player2_score ?? match.scores?.team2 ?? match.scores?.player2 ?? '-';
    return `${one}-${two}`;
}

function matches() {
    const bracket = state.tournament?.bracket || {};
    const withLabel = (items, label) => asArray(items).map(match => ({ ...match, bracket_label: match.bracket_label || label }));
    return [
        ...withLabel(bracket.winners, 'Winners'),
        ...withLabel(bracket.losers, 'Losers'),
        ...(bracket.grand_finals?.match1 ? [{ ...bracket.grand_finals.match1, bracket_label: 'Finals' }] : []),
        ...(bracket.grand_finals?.match2 ? [{ ...bracket.grand_finals.match2, bracket_label: 'Reset' }] : [])
    ];
}

function teamRows() {
    const fromRegs = state.registrations
        .filter(reg => reg.player1 || reg.player2 || reg.registration_type === 'team' || reg.type === 'team')
        .map(reg => ({
            id: reg.id,
            name: reg.team_name || [reg.player1?.name, reg.player2?.name].filter(Boolean).join(' & ') || 'Team',
            p1: participant(reg.player1 || reg.player),
            p2: participant(reg.player2 || { name: reg.partner_name }, '')
        }));
    const fromTournament = asArray(state.tournament?.teams).map((team, index) => ({
        id: team.id || `team-${index}`,
        name: team.team_name || team.name || `Team ${index + 1}`,
        p1: participant(team.player1),
        p2: participant(team.player2, '')
    }));
    const byId = new Map();
    [...fromRegs, ...fromTournament].forEach(team => byId.set(team.id || team.name, team));
    return [...byId.values()];
}

function statusText(value) {
    return String(value || 'pending').replaceAll('_', ' ');
}

function setMode(mode) {
    currentMode = validModes.has(mode) ? mode : 'bracket';
    document.querySelectorAll('[data-tv-mode]').forEach(link => {
        const active = link.dataset.tvMode === currentMode;
        link.classList.toggle('active', active);
        link.href = `/rookies/pages/matchmaker-tv-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}&mode=${encodeURIComponent(link.dataset.tvMode)}`;
    });
    document.querySelectorAll('[data-tv-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.tvPane === currentMode));
}

function renderHeader() {
    const t = state.tournament || {};
    const allMatches = matches();
    const live = allMatches.filter(match => match.status === 'in_progress').length;
    els.status.textContent = t.status || 'Live display';
    els.title.textContent = title();
    els.meta.textContent = `${allMatches.length} bracket matches - ${live} live - ${teamRows().length} teams`;
}

function renderBracket() {
    const allMatches = matches();
    els.bracket.innerHTML = allMatches.length ? allMatches.map(match => `
        <article class="mmtv-match ${escapeHtml(match.status || 'pending')}">
            <p>${escapeHtml(match.bracket_label)} ${escapeHtml(match.round ? `R${match.round}` : '')}</p>
            <strong>${escapeHtml(participant(match.team1 || match.player1))}</strong>
            <span>${escapeHtml(matchScore(match))}</span>
            <strong>${escapeHtml(participant(match.team2 || match.player2))}</strong>
            <em>${escapeHtml(statusText(match.status))}${match.board_number || match.board ? ` / Board ${escapeHtml(match.board_number || match.board)}` : ''}</em>
        </article>
    `).join('') : '<div class="mmtv-empty">Waiting for bracket generation.</div>';
}

function renderPartners() {
    const teams = teamRows();
    els.partners.innerHTML = teams.length ? teams.map(team => `
        <article class="mmtv-team">
            <span>Partner Reveal</span>
            <strong>${escapeHtml(team.name)}</strong>
            <em>${escapeHtml([team.p1, team.p2].filter(Boolean).join(' / '))}</em>
        </article>
    `).join('') : '<div class="mmtv-empty">Partner draw has not been published yet.</div>';
}

function renderMatchCalls() {
    const ready = matches().filter(match => ['ready', 'pending', 'in_progress'].includes(match.status || 'pending'));
    els.matches.innerHTML = ready.length ? ready.map(match => `
        <article class="mmtv-call ${match.status === 'in_progress' ? 'live' : ''}">
            <span>${escapeHtml(match.status === 'in_progress' ? 'Now playing' : 'On deck')}</span>
            <strong>${escapeHtml(participant(match.team1 || match.player1))} vs ${escapeHtml(participant(match.team2 || match.player2))}</strong>
            <em>${escapeHtml(match.round_label || match.bracket_label || 'Match')} / Board ${escapeHtml(match.board_number || match.board || 'TBD')}</em>
        </article>
    `).join('') : '<div class="mmtv-empty">No matches are ready yet.</div>';
}

function renderMingle() {
    const t = state.tournament || {};
    const active = t.mingle_period?.active || t.mingle_active || t.status === 'mingle';
    const breakups = asArray(t.breakups).length + asArray(t.mingle_breakups).length + asArray(t.heartbreaker_requests).length;
    els.mingle.innerHTML = `
        <span>${active ? 'Mingle is open' : 'Mingle standby'}</span>
        <strong>${escapeHtml(active ? 'Find your next partner' : 'Waiting for director')}</strong>
        <em>${escapeHtml(breakups ? `${breakups} breakup/rematch request${breakups === 1 ? '' : 's'} active` : `Cutoff: ${statusText(t.mingle_cutoff || 'director controlled')}`)}</em>
    `;
}

function renderAll() {
    renderHeader();
    renderBracket();
    renderPartners();
    renderMatchCalls();
    renderMingle();
    setMode(currentMode);
}

async function loadRegistrations() {
    const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'registrations')).catch(() => ({ docs: [] }));
    state.registrations = snap.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function init() {
    if (!tournamentId) throw new Error('Missing tournament_id');
    await loadRegistrations();
    const ref = doc(db, 'tournaments', tournamentId);
    const first = await getDoc(ref);
    if (!first.exists()) throw new Error('Tournament not found');
    state.tournament = { id: first.id, ...first.data() };
    renderAll();
    onSnapshot(ref, snapshot => {
        if (!snapshot.exists()) return;
        state.tournament = { id: snapshot.id, ...snapshot.data() };
        renderAll();
    }, error => {
        console.warn('[matchmaker-tv-vnext] realtime unavailable:', error?.message || error);
    });
}

document.querySelectorAll('[data-tv-mode]').forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        const mode = link.dataset.tvMode;
        const url = new URL(window.location.href);
        url.searchParams.set('mode', mode);
        history.replaceState(null, '', url.toString());
        setMode(mode);
    });
});

init().catch(error => {
    console.error('[matchmaker-tv-vnext] failed:', error);
    els.status.textContent = 'Display unavailable';
    els.bracket.innerHTML = `<div class="mmtv-empty">${escapeHtml(error.message || 'Could not load display')}</div>`;
});
