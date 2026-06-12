import {
    db,
    auth,
    waitForAuthReady,
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from '/js/firebase-config.js';

const LEAGUE_ID = 'rookies-demo-2026-triples';
const DEMO_TOURNAMENT_ID = 'rookies-wing-it-wednesdays-2026-05-27';
const els = {
    status: document.getElementById('eventsStatus'),
    grid: document.getElementById('eventGrid'),
    leagueCount: document.getElementById('leagueEventCount'),
    tournamentCount: document.getElementById('tournamentEventCount'),
    myCount: document.getElementById('myEventCount')
};

let events = [];
let activeFilter = 'all';

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
    const date = value.toDate ? value.toDate() : new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date) : 'TBD';
}

function hrefFor(event) {
    if (event.type === 'league') return `/rookies/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${encodeURIComponent(event.id)}`;
    if (event.type === 'tournament') return `/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(event.id)}`;
    return event.href || '/rookies/pages/events-vnext.html';
}

function updateSummary() {
    const league = events.filter(event => event.type === 'league').length;
    const tournament = events.filter(event => event.type === 'tournament').length;
    const mine = events.filter(event => event.mine).length;
    if (els.leagueCount) els.leagueCount.textContent = String(league);
    if (els.tournamentCount) els.tournamentCount.textContent = String(tournament);
    if (els.myCount) els.myCount.textContent = String(mine || (auth.currentUser ? 0 : events.length));
}

function render() {
    const currentUser = auth.currentUser;
    const filtered = events.filter(event => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'mine') return event.mine || !currentUser;
        if (activeFilter === 'online') return event.online;
        return event.type === activeFilter;
    });

    updateSummary();
    els.status.textContent = `${filtered.length} event${filtered.length === 1 ? '' : 's'} shown`;
    if (!filtered.length) {
        els.grid.innerHTML = '<div class="ves-empty">No events found for this filter.</div>';
        return;
    }

    els.grid.innerHTML = filtered.map(event => `
        <article class="ves-card">
            <div>
                <p class="ves-kicker">${escapeHtml(event.type)} - ${escapeHtml(dateLabel(event.date))}</p>
                <h2>${escapeHtml(event.title)}</h2>
            </div>
            <p>${escapeHtml(event.detail || '')}</p>
            <div class="ves-card-meta">
                ${event.online ? '<span>Online</span>' : '<span>In person / flex</span>'}
                ${event.mine ? '<span>Your schedule</span>' : ''}
            </div>
            <a href="${escapeHtml(hrefFor(event))}">Open event</a>
        </article>
    `).join('');
}

async function loadEvents() {
    await waitForAuthReady(4500);
    const [matchesSnap, tournamentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'leagues', LEAGUE_ID, 'matches'), orderBy('week', 'asc'))),
        getDocs(query(collection(db, 'tournaments'), limit(50)))
    ]);

    const leagueEvents = matchesSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            type: 'league',
            title: `${data.home_team_name || 'Home'} vs ${data.away_team_name || 'Away'}`,
            date: data.match_date || data.date,
            detail: `2026 Triples League - Week ${data.week || data.match_week || '-'}`,
            mine: true,
            online: false
        };
    });

    const tournamentEvents = tournamentsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(data => data.demo_tenant === 'rookies' || data.id === DEMO_TOURNAMENT_ID)
        .map(data => {
            return {
                id: data.id,
                type: 'tournament',
                title: data.name || data.tournament_name || 'Tournament',
                date: data.date || data.tournament_date || data.start_date || data.created_at,
                detail: data.venue_name || data.location_mode || data.status || 'Tournament',
                mine: false,
                online: data.is_online === true || data.location_mode === 'online'
            };
        });

    events = [...leagueEvents, ...tournamentEvents].sort((a, b) => (asDate(a.date)?.getTime() || 0) - (asDate(b.date)?.getTime() || 0));
    render();
}

document.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
        activeFilter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
        render();
    });
});

loadEvents().catch(error => {
    console.error('[events-vnext] failed:', error);
    els.status.textContent = 'Events unavailable.';
    els.grid.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load events')}</div>`;
});
