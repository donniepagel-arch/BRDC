import { db, collection, doc, getDoc, getDocs } from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get('tournament_id') || params.get('id') || 'rookies-wing-it-wednesdays-2026-05-27';

const els = {
    status: document.getElementById('tournamentStatus'),
    title: document.getElementById('tournamentTitle'),
    meta: document.getElementById('tournamentMeta'),
    register: document.getElementById('registerLink'),
    runtime: document.getElementById('runtimeLink'),
    bracket: document.getElementById('bracketLink'),
    eventCount: document.getElementById('eventCount'),
    registrationCount: document.getElementById('registrationCount'),
    locationMode: document.getElementById('locationMode'),
    overview: document.getElementById('overviewPane'),
    events: document.getElementById('eventsPane'),
    registrations: document.getElementById('registrationsPane'),
    rooms: document.getElementById('roomsPane')
};

let state = { tournament: null, events: [], registrations: [] };

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    const date = new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : 'Date TBD';
}

function title() {
    return state.tournament?.name || state.tournament?.tournament_name || 'Tournament';
}

function modeLabel() {
    const raw = String(state.tournament?.location_mode || state.tournament?.venue_type || '').toLowerCase();
    if (raw.includes('online') || state.tournament?.is_online) return 'Online';
    if (raw.includes('flex')) return 'Flex';
    if (state.tournament?.venue_name || state.tournament?.location) return 'In person';
    return 'TBD';
}

function friendly(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const known = {
        single_elimination: 'Single elimination',
        double_elimination: 'Double elimination',
        round_robin: 'Round robin',
        corks_choice: "Cork's choice",
        blind_draw: 'Blind draw',
        blind_draw_team: 'Blind draw teams',
        mixed_doubles: 'Mixed doubles'
    };
    if (known[raw]) return known[raw];
    return raw
        .replaceAll('_', ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function formatLabel(item = state.tournament) {
    return [...new Set([item?.format || item?.game_format || item?.match_format, item?.game_type || item?.default_game, item?.bracket_type || item?.type]
        .filter(Boolean)
        .map(friendly))]
        .join(' - ') || 'Format TBD';
}

function card(kicker, heading, body, footer = '') {
    return `<article class="ves-card"><div><p class="ves-kicker">${escapeHtml(kicker)}</p><h2>${escapeHtml(heading)}</h2></div><p>${escapeHtml(body)}</p>${footer ? `<div class="ves-card-meta">${footer}</div>` : ''}</article>`;
}

function renderHeader() {
    const tournament = state.tournament || {};
    const isMatchmaker = tournament.matchmaker_enabled === true;
    const date = tournament.date || tournament.tournament_date || tournament.start_date || tournament.created_at;
    els.status.textContent = tournament.status || tournament.registration_status || 'Tournament';
    els.title.textContent = title();
    els.meta.textContent = isMatchmaker
        ? `${dateLabel(date)} - ${modeLabel()} - Mixed doubles matchmaker`
        : `${dateLabel(date)} - ${modeLabel()} - ${formatLabel(tournament)}`;
    els.eventCount.textContent = String(state.events.length || 1);
    els.registrationCount.textContent = String(state.registrations.length);
    els.locationMode.textContent = modeLabel();
    els.register.href = `/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.runtime.href = `/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.bracket.href = `/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    document.querySelectorAll('[data-matchmaker-link]').forEach(item => item.remove());
    if (isMatchmaker) {
        const mingle = document.createElement('a');
        mingle.className = 'ves-action';
        mingle.dataset.matchmakerLink = 'mingle';
        mingle.href = `/rookies/pages/matchmaker-mingle-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
        mingle.textContent = 'Mingle';
        const tv = document.createElement('a');
        tv.className = 'ves-action';
        tv.dataset.matchmakerLink = 'tv';
        tv.href = `/rookies/pages/matchmaker-tv-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
        tv.textContent = 'TV Display';
        els.bracket.insertAdjacentElement('afterend', tv);
        els.bracket.insertAdjacentElement('afterend', mingle);
    }
}

function renderOverview() {
    const t = state.tournament || {};
    const location = t.venue_name || t.location || t.address || modeLabel();
    const cards = [
        card('Format', formatLabel(t), t.description || t.summary || 'Tournament details are still being built.'),
        card('Where', location, modeLabel() === 'Online' ? 'Online room and match links should be managed from tournament runtime.' : 'Location and room details should be confirmed before event start.'),
        card('Status', t.status || 'Draft', `${state.registrations.length} registrations loaded.`, `<span>${escapeHtml(dateLabel(t.date || t.tournament_date || t.start_date || t.created_at))}</span>`)
    ];
    if (t.matchmaker_enabled === true) {
        const counts = t.registration_counts || {};
        cards.splice(1, 0, card(
            'Matchmaker',
            'Partner draw and mingle',
            `Winners bracket plays ${friendly(t.winners_game_type || 'cricket')}; losers bracket plays ${friendly(t.losers_game_type || '501')}.`,
            `<span>${escapeHtml(Number(counts.teams || 0))} pairs</span><span>${escapeHtml((Number(counts.singles_male || 0) + Number(counts.singles_female || 0)))} singles</span>`
        ));
    }
    els.overview.innerHTML = cards.join('');
}

function renderEvents() {
    const rows = state.events.length ? state.events : [state.tournament || {}];
    els.events.innerHTML = rows.map((event, index) => {
        const cap = Number(event.max_players || event.max_teams || event.capacity || 0);
        const count = Number(event.registration_count || event.registered_count || 0);
        return card(`Event ${index + 1}`, event.name || event.event_name || event.title || event.format || 'Tournament event', formatLabel(event), `<span>${escapeHtml(cap ? `${count}/${cap} signed up` : `${count || '-'} signed up`)}</span><span>${escapeHtml(event.status || 'Open')}</span>`);
    }).join('');
}

function renderRegistrations() {
    els.registrations.innerHTML = state.registrations.length
        ? state.registrations.map(reg => card(reg.status || 'Registered', reg.player_name || reg.name || reg.team_name || 'Registrant', reg.event_name || reg.event_id || 'Tournament registration', `<span>${escapeHtml(reg.email || reg.phone || '')}</span>`)).join('')
        : '<div class="ves-empty">No registrations found for this tournament yet.</div>';
}

function renderRooms() {
    const roomCount = Number(state.tournament?.chat_room_count || state.tournament?.room_count || 0);
    els.rooms.innerHTML = [
        card('Lobby', 'Tournament chat', 'Use messages for announcements, check-ins, and online match coordination.', '<span>Open from messages</span>'),
        card('Runtime', 'Match rooms', 'Runtime should own live match links, scorer launches, and result confirmations.', `<span>${roomCount || '-'} rooms</span>`)
    ].join('');
}

function renderAll() {
    renderHeader();
    renderOverview();
    renderEvents();
    renderRegistrations();
    renderRooms();
}

function initTabs() {
    document.querySelectorAll('[data-tv-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.tvTarget;
            document.querySelectorAll('[data-tv-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-tv-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.tvPane === target));
        });
    });
}

async function load() {
    if (!tournamentId) throw new Error('Missing tournament_id');
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const [tournamentSnap, eventsSnap, registrationsSnap] = await Promise.all([
        getDoc(tournamentRef),
        getDocs(collection(db, 'tournaments', tournamentId, 'events')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tournaments', tournamentId, 'registrations')).catch(() => ({ docs: [] }))
    ]);
    if (!tournamentSnap.exists()) throw new Error('Tournament not found');
    state.tournament = { id: tournamentSnap.id, ...tournamentSnap.data() };
    state.events = eventsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    state.registrations = registrationsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
}

initTabs();
load().then(renderAll).catch(error => {
    console.error('[tournament-view-vnext] failed:', error);
    els.status.textContent = 'Tournament unavailable';
    els.overview.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load tournament')}</div>`;
});
