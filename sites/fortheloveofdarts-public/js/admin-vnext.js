import { callFunction } from '/js/firebase-config.js';

const els = {
    status: document.getElementById('adminStatus'),
    leagues: document.getElementById('adminLeagues'),
    tournaments: document.getElementById('adminTournaments'),
    players: document.getElementById('adminPlayers'),
    leagueList: document.getElementById('adminLeagueList'),
    tournamentList: document.getElementById('adminTournamentList'),
    memberList: document.getElementById('adminMemberList'),
    health: document.getElementById('adminHealthGrid')
};

let state = {
    dashboard: null,
    members: []
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function card(kicker, heading, body, footer = '') {
    return `<article class="ves-card"><div><p class="ves-kicker">${escapeHtml(kicker)}</p><h2>${escapeHtml(heading)}</h2></div><p>${escapeHtml(body)}</p>${footer ? `<div class="ves-card-meta">${footer}</div>` : ''}</article>`;
}

function renderCounts() {
    const counts = state.dashboard?.counts || {};
    els.leagues.textContent = String(counts.leagues ?? state.dashboard?.leagues?.length ?? '-');
    els.tournaments.textContent = String(counts.tournaments ?? state.dashboard?.tournaments?.length ?? '-');
    els.players.textContent = String(counts.players ?? state.members.length ?? '-');
    els.status.textContent = 'Admin data loaded';
}

function renderLeagues() {
    const leagues = state.dashboard?.leagues || [];
    els.leagueList.innerHTML = leagues.length
        ? leagues.map(league => card(league.status || 'League', league.name || league.league_name || 'League', `Director: ${league.director_name || 'Not set'}`, `<a href="/rookies/pages/league-director-vnext.html?league_id=${encodeURIComponent(league.id)}">Director board</a><a href="/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(league.id)}">League hub</a>`)).join('')
        : '<div class="ves-empty">No leagues returned by admin dashboard.</div>';
}

function renderTournaments() {
    const tournaments = state.dashboard?.tournaments || [];
    els.tournamentList.innerHTML = tournaments.length
        ? tournaments.map(tournament => card(tournament.status || tournament.registration_status || 'Tournament', tournament.name || tournament.tournament_name || 'Tournament', tournament.format || tournament.game_type || 'Format TBD', `<a href="/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">Tournament page</a><a href="/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournament.id)}">Runtime</a>`)).join('')
        : '<div class="ves-empty">No tournaments returned by admin dashboard.</div>';
}

function renderMembers() {
    const members = state.members.slice(0, 40);
    els.memberList.innerHTML = members.length
        ? members.map(member => card(member.role || member.source_type || 'Member', member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email || 'Member', member.email || member.phone || 'No contact shown', `<span>${escapeHtml(member.status || member.account_status || 'active')}</span>`)).join('')
        : '<div class="ves-empty">Member function returned no rows or is unavailable.</div>';
}

function renderHealth() {
    const counts = state.dashboard?.counts || {};
    els.health.innerHTML = [
        card('Auth', 'Email account mode', 'Admin vnext uses signed-in Firebase auth and does not render legacy credential fields.', '<span>Active</span>'),
        card('Coverage', 'VNext pages', 'Home, league, team, profile, members, messages, captain, director, events, trader, scorer setup, and tournament pages have separate vnext routes.', '<span>Separate preview</span>'),
        card('Counts', 'Dashboard totals', `${counts.leagues ?? '-'} leagues, ${counts.tournaments ?? '-'} tournaments, ${counts.players ?? '-'} players, ${counts.bots ?? '-'} bots.`, '<span>Live function</span>')
    ].join('');
}

function renderAll() {
    renderCounts();
    renderLeagues();
    renderTournaments();
    renderMembers();
    renderHealth();
}

function wireTabs() {
    document.querySelectorAll('[data-admin-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.adminTarget;
            document.querySelectorAll('[data-admin-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-admin-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.adminPane === target));
        });
    });
}

async function load() {
    const [dashboardResult, membersResult] = await Promise.all([
        callFunction('adminGetDashboard', {}),
        callFunction('adminGetMembers', {}).catch(error => ({ success: false, error: error.message, members: [] }))
    ]);
    if (!dashboardResult?.success) throw new Error(dashboardResult?.error || 'Admin dashboard unavailable');
    state.dashboard = dashboardResult;
    state.members = membersResult?.success ? (membersResult.members || membersResult.players || []) : [];
}

wireTabs();
load().then(renderAll).catch(error => {
    console.error('[admin-vnext] failed:', error);
    els.status.textContent = 'Admin unavailable';
    els.leagueList.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load admin data')}</div>`;
});
