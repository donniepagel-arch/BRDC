import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const TRIPLES_LEAGUE_ID = 'rookies-demo-2026-triples';
const NEXT_WING_ID = 'rookies-wing-it-wednesdays-2026-06-03';
const FIRST_WING_ID = 'rookies-wing-it-wednesdays-2026-05-27';
const WING_SERIES_HREF = '/rookies/pages/wing-it-wednesdays-vnext.html';

const els = {
    status: document.getElementById('directorHomeStatus'),
    leagueCount: document.getElementById('directorLeagueCount'),
    eventCount: document.getElementById('directorEventCount'),
    activeCount: document.getElementById('directorTonightCount'),
    leagueList: document.getElementById('directorLeagueList'),
    eventList: document.getElementById('directorEventList'),
    createModal: document.querySelector('[data-create-modal]')
};

const state = {
    leagues: [],
    events: []
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T12:00:00`);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
    const date = asDate(value);
    return date ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD';
}

function tournamentDate(tournament = {}) {
    return tournament.date || tournament.tournament_date || tournament.start_date || tournament.created_at;
}

function isCompletedEvent(event) {
    const raw = String(event.status || event.registration_status || '').toLowerCase();
    return raw.includes('complete') || raw.includes('ended') || raw.includes('cancel');
}

function isWingItWednesday(event = {}) {
    const id = String(event.id || '').toLowerCase();
    const name = String(event.name || event.tournament_name || event.fallbackName || '').toLowerCase();
    return id.includes('wing-it-wednesdays') || name.includes('wing it wednesday');
}

function nextUpcomingEvent(events = []) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sorted = [...events].sort((a, b) => {
        const aDate = asDate(tournamentDate(a));
        const bDate = asDate(tournamentDate(b));
        if (aDate && bDate) return aDate - bDate;
        if (aDate) return -1;
        if (bDate) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return sorted.find(event => {
        const date = asDate(tournamentDate(event));
        return !isCompletedEvent(event) && (!date || date >= now);
    }) || sorted[0] || null;
}

function leagueCard(league) {
    const name = league.name || league.league_name || 'League';
    const teamCount = Number(league.teamCount || 0);
    const matchCount = Number(league.matchCount || 0);
    const playerCount = Number(league.playerCount || 0);
    return `
        <article class="director-item-card director-league-card">
            <div>
                <p class="director-card-kicker">
                    <span>League</span>
                    <span>${escapeHtml(league.status || 'Active')}</span>
                </p>
                <h3>${escapeHtml(name)}</h3>
                <p>${teamCount} teams, ${playerCount} players, ${matchCount} match nights.</p>
            </div>
            <div class="director-item-actions">
                <a class="ves-action primary" href="/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(league.id)}#manage">Manage</a>
                <a class="ves-action" href="/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(league.id)}">View</a>
            </div>
        </article>
    `;
}

function eventCard(tournament) {
    const name = tournament.name || tournament.tournament_name || 'Event';
    const status = tournament.status || tournament.registration_status || 'Event';
    const date = dateLabel(tournamentDate(tournament));
    const registrations = Number(tournament.registrationCount || tournament.player_count || tournament.registrations_count || 0);
    return `
        <article class="director-item-card director-event-card">
            <div>
                <p class="director-card-kicker">
                    <span>Event</span>
                    <span>${escapeHtml(status)}</span>
                </p>
                <h3>${escapeHtml(name)}</h3>
                <p>${escapeHtml(date)} - ${registrations} registered.</p>
            </div>
            <div class="director-item-actions">
                <a class="ves-action primary" href="/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">Manage</a>
                <a class="ves-action" href="/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">View</a>
                <a class="ves-action" href="/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournament.id)}">Bracket</a>
            </div>
        </article>
    `;
}

function wingSeriesCard(weeks = []) {
    const next = nextUpcomingEvent(weeks);
    const totalRegs = weeks.reduce((sum, week) => {
        return sum + Number(week.registrationCount || week.player_count || week.registrations_count || 0);
    }, 0);
    const nextDate = next ? dateLabel(tournamentDate(next)) : 'Date TBD';
    const nextRegs = next ? Number(next.registrationCount || next.player_count || next.registrations_count || 0) : 0;
    const nextId = next?.id || NEXT_WING_ID;
    return `
        <article class="director-item-card director-event-card director-series-card">
            <div>
                <p class="director-card-kicker">
                    <span>Event</span>
                    <span>Summer series</span>
                </p>
                <h3>Wing It Wednesdays</h3>
                <p>${weeks.length} Wednesdays configured. Next: ${escapeHtml(nextDate)} - ${nextRegs} registered. ${totalRegs} total series registrations.</p>
            </div>
            <div class="director-item-actions">
                <a class="ves-action primary" href="${WING_SERIES_HREF}">Manage series</a>
                <a class="ves-action" href="/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(nextId)}">View</a>
            </div>
        </article>
    `;
}

function directorEventProducts() {
    const wingWeeks = state.events.filter(isWingItWednesday);
    const standalone = state.events.filter(event => !isWingItWednesday(event));
    return [
        ...(wingWeeks.length ? [{ type: 'wing-series', events: wingWeeks }] : []),
        ...standalone.map(event => ({ type: 'event', event }))
    ];
}

function renderEventProduct(product) {
    if (product.type === 'wing-series') return wingSeriesCard(product.events);
    return eventCard(product.event);
}

function render() {
    const eventProducts = directorEventProducts();
    const activeEventProducts = eventProducts.filter(product => {
        if (product.type === 'wing-series') return product.events.some(event => !isCompletedEvent(event));
        return !isCompletedEvent(product.event);
    });

    if (!els.status.textContent.includes('Staff mode')) {
        els.status.textContent = 'Rookies staff';
    }
    els.leagueCount.textContent = String(state.leagues.length);
    els.eventCount.textContent = String(eventProducts.length);
    els.activeCount.textContent = String(activeEventProducts.length + state.leagues.length);
    els.leagueList.innerHTML = state.leagues.length
        ? state.leagues.map(leagueCard).join('')
        : '<div class="ves-empty">No leagues yet.</div>';
    els.eventList.innerHTML = eventProducts.length
        ? eventProducts.map(renderEventProduct).join('')
        : '<div class="ves-empty">No events yet.</div>';
}

function openCreateModal() {
    if (!els.createModal) return;
    els.createModal.hidden = false;
    document.body.classList.add('director-modal-open');
    els.createModal.querySelector('a')?.focus();
}

function closeCreateModal() {
    if (!els.createModal) return;
    els.createModal.hidden = true;
    document.body.classList.remove('director-modal-open');
    document.querySelector('[data-create-open]')?.focus();
}

function initCreateModal() {
    document.querySelector('[data-create-open]')?.addEventListener('click', openCreateModal);
    document.querySelectorAll('[data-create-close]').forEach(item => {
        item.addEventListener('click', closeCreateModal);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !els.createModal?.hidden) closeCreateModal();
    });
}

async function hydrateLeague(id) {
    const [leagueSnap, teamsSnap, matchesSnap, playersSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', id)).catch(() => null),
        getDocs(collection(db, 'leagues', id, 'teams')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leagues', id, 'matches')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leagues', id, 'players')).catch(() => ({ docs: [] }))
    ]);
    return {
        id,
        ...(leagueSnap?.exists?.() ? leagueSnap.data() : { name: '2026 Triples League', status: 'Active league' }),
        teamCount: teamsSnap.docs.length,
        matchCount: matchesSnap.docs.length,
        playerCount: playersSnap.docs.length
    };
}

async function hydrateTournament(id, fallback = {}) {
    const [tournamentSnap, regsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', id)).catch(() => null),
        getDocs(collection(db, 'tournaments', id, 'registrations')).catch(() => ({ docs: [] }))
    ]);
    return {
        id,
        ...fallback,
        ...(tournamentSnap?.exists?.() ? tournamentSnap.data() : {}),
        registrationCount: regsSnap.docs.length
    };
}

async function load() {
    const [league, nextWing, firstWing] = await Promise.all([
        hydrateLeague(TRIPLES_LEAGUE_ID),
        hydrateTournament(NEXT_WING_ID, {
            name: 'Wing It Wednesdays',
            status: 'Next event',
            tournament_date: '2026-06-03'
        }),
        hydrateTournament(FIRST_WING_ID, {
            name: 'Wing It Wednesday 5-27',
            status: 'Completed',
            tournament_date: '2026-05-27'
        })
    ]);

    state.leagues = [league];
    state.events = [nextWing, firstWing].sort((a, b) => {
        const aDate = asDate(tournamentDate(a));
        const bDate = asDate(tournamentDate(b));
        if (aDate && bDate) return bDate - aDate;
        if (aDate) return -1;
        if (bDate) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

async function init() {
    const director = await requireDirectorLogin({
        gatedElements: [
            document.querySelector('.director-management-panel'),
            document.querySelector('.director-quick-counts'),
            document.querySelector('.ves-hero-actions')
        ],
        statusEl: els.status,
        title: 'Rookies Director Login',
        copy: 'Use Brian or another director account to manage Rookies leagues and events.',
        readyText: 'Staff mode'
    });
    if (!director) return;
    await load();
    render();
}

initCreateModal();

init().catch(error => {
    console.error('[director-home-vnext] failed:', error);
    els.status.textContent = 'Director home unavailable';
    els.leagueList.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load director home')}</div>`;
});
