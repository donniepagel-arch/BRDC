import {
    db,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

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

function isCompletedLeague(league) {
    const raw = String(league.status || '').toLowerCase();
    return raw.includes('complete') || raw.includes('ended') || raw.includes('cancel') || raw.includes('archived');
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
                <a class="ves-action primary" href="/pages/league-director-vnext.html?league_id=${encodeURIComponent(league.id)}">Manage</a>
                <a class="ves-action" href="/pages/triples-vnext.html?league_id=${encodeURIComponent(league.id)}">View</a>
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
                <a class="ves-action primary" href="/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">Manage</a>
                <a class="ves-action" href="/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">View</a>
                <a class="ves-action" href="/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(tournament.id)}">Bracket</a>
            </div>
        </article>
    `;
}

function render() {
    const activeLeagues = state.leagues.filter(league => !isCompletedLeague(league));
    const activeEvents = state.events.filter(event => !isCompletedEvent(event));

    els.leagueCount.textContent = String(state.leagues.length);
    els.eventCount.textContent = String(state.events.length);
    els.activeCount.textContent = String(activeLeagues.length + activeEvents.length);

    els.leagueList.innerHTML = state.leagues.length
        ? state.leagues.map(leagueCard).join('')
        : '<div class="ves-empty">No leagues yet.</div>';

    els.eventList.innerHTML = state.events.length
        ? state.events.map(eventCard).join('')
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
    document.addEventListener('keydown', evt => {
        if (evt.key === 'Escape' && !els.createModal?.hidden) closeCreateModal();
    });
}

async function hydrateLeague(id, baseData = {}) {
    const [leagueSnap, teamsSnap, matchesSnap, playersSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', id)).catch(() => null),
        getDocs(collection(db, 'leagues', id, 'teams')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leagues', id, 'matches')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leagues', id, 'players')).catch(() => ({ docs: [] }))
    ]);
    return {
        id,
        ...baseData,
        ...(leagueSnap?.exists?.() ? leagueSnap.data() : {}),
        teamCount: teamsSnap.docs.length,
        matchCount: matchesSnap.docs.length,
        playerCount: playersSnap.docs.length
    };
}

async function hydrateTournament(id, baseData = {}) {
    const [tournamentSnap, regsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', id)).catch(() => null),
        getDocs(collection(db, 'tournaments', id, 'registrations')).catch(() => ({ docs: [] }))
    ]);
    return {
        id,
        ...baseData,
        ...(tournamentSnap?.exists?.() ? tournamentSnap.data() : {}),
        registrationCount: regsSnap.docs.length
    };
}

async function load() {
    const [leaguesSnap, tournamentsSnap] = await Promise.all([
        getDocs(collection(db, 'leagues')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tournaments')).catch(() => ({ docs: [] }))
    ]);

    const leagueIds = leaguesSnap.docs.map(d => d.id);
    const tournamentIds = tournamentsSnap.docs.map(d => d.id);

    const [leagues, events] = await Promise.all([
        Promise.all(leagueIds.map(id => {
            const base = { id, ...leaguesSnap.docs.find(d => d.id === id)?.data() };
            return hydrateLeague(id, base);
        })),
        Promise.all(tournamentIds.map(id => {
            const base = { id, ...tournamentsSnap.docs.find(d => d.id === id)?.data() };
            return hydrateTournament(id, base);
        }))
    ]);

    state.leagues = leagues.sort((a, b) => {
        const aActive = !isCompletedLeague(a) ? 0 : 1;
        const bActive = !isCompletedLeague(b) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    state.events = events.sort((a, b) => {
        const aActive = !isCompletedEvent(a) ? 0 : 1;
        const bActive = !isCompletedEvent(b) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
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
        title: 'BRDC Director Login',
        copy: 'Use a director or admin account to manage BRDC leagues and events.',
        readyText: 'Director mode'
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
