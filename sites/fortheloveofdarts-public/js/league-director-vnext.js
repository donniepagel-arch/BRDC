import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'rookies-demo-2026-triples';

const els = {
    status: document.getElementById('directorStatus'),
    title: document.getElementById('directorTitle'),
    teams: document.getElementById('directorTeams'),
    matches: document.getElementById('directorMatches'),
    players: document.getElementById('directorPlayers'),
    open: document.getElementById('directorOpen'),
    standings: document.getElementById('directorStandings'),
    schedule: document.getElementById('directorSchedule'),
    teamsGrid: document.getElementById('directorTeamsGrid'),
    playersGrid: document.getElementById('directorPlayersGrid'),
    tools: document.getElementById('directorTools')
};

let state = {
    league: null,
    teams: [],
    matches: [],
    players: [],
    statsById: {}
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function finite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function stat(value, decimals = 1) {
    const num = finite(value);
    return num == null || num <= 0 ? '-' : num.toFixed(decimals);
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
    const date = asDate(value);
    return date ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD';
}

function isFillIn(player) {
    return player?.is_fill_in === true ||
        player?.is_fillin === true ||
        player?.is_sub === true ||
        ['fill_in', 'fill-in', 'fillin'].includes(String(player?.team_id || '').toLowerCase());
}

function level(player) {
    const raw = String(player?.skill_level || player?.preferred_level || player?.level || '').toUpperCase();
    if (isFillIn(player)) return 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function sortByLevel(a, b) {
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    return ((order[level(a)] ?? 9) - (order[level(b)] ?? 9)) || String(a.name || '').localeCompare(String(b.name || ''));
}

function teamName(team) {
    return team?.team_name || team?.name || 'Team';
}

function matchDate(match) {
    return match.match_date || match.date || match.scheduled_date;
}

function sortTeams(teams) {
    return [...teams].sort((a, b) => {
        const aw = Number(a.wins || 0);
        const bw = Number(b.wins || 0);
        const ap = Number(a.points ?? a.games_won ?? a.set_wins ?? 0);
        const bp = Number(b.points ?? b.games_won ?? b.set_wins ?? 0);
        if (bw !== aw) return bw - aw;
        if (bp !== ap) return bp - ap;
        return Number(a.losses || 0) - Number(b.losses || 0);
    });
}

function teamRoster(teamId) {
    return state.players.filter(player => player.team_id === teamId && !isFillIn(player)).sort(sortByLevel);
}

function playerStats(player) {
    const stats = state.statsById[player.id] || {};
    return {
        threeDa: player.x01_three_dart_avg ?? player.avg_3da ?? stats.x01_three_dart_avg ?? stats.avg_3da,
        mpr: player.cricket_mpr ?? player.mpr ?? stats.cricket_mpr ?? stats.mpr
    };
}

function card(kicker, heading, body, footer = '') {
    return `<article class="ves-card"><div><p class="ves-kicker">${escapeHtml(kicker)}</p><h2>${escapeHtml(heading)}</h2></div><p>${escapeHtml(body)}</p>${footer ? `<div class="ves-card-meta">${footer}</div>` : ''}</article>`;
}

function statusClass(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'completed') return 'is-complete';
    if (raw === 'in_progress') return 'is-live';
    if (raw === 'scheduled') return 'is-open';
    return 'is-pending';
}

function renderHeader() {
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const open = state.matches.length - completed;
    const fillins = state.players.filter(isFillIn).length;
    els.status.textContent = `${completed}/${state.matches.length} matches completed`;
    els.title.textContent = state.league?.name || state.league?.league_name || '2026 Triples League';
    els.teams.textContent = String(state.teams.length);
    els.matches.textContent = String(state.matches.length);
    els.players.textContent = String(state.players.length);
    els.open.textContent = String(open);
    document.querySelectorAll('a[href="/rookies/pages/triples-vnext.html"]').forEach(link => {
        link.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    });
    document.querySelectorAll('a[href="/rookies/pages/captain-dashboard-vnext.html"]').forEach(link => {
        link.href = `/rookies/pages/captain-dashboard-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    });
    document.querySelectorAll('a[href="/rookies/pages/contact-center-vnext.html"]').forEach(link => {
        link.href = `/rookies/pages/contact-center-vnext.html?audience=league&league_id=${encodeURIComponent(leagueId)}`;
    });
    if (fillins) els.players.parentElement.querySelector('em').textContent = `${fillins} fill-ins included.`;
    els.open.parentElement.querySelector('em').textContent = open ? 'Needs result or playoff action.' : 'Season results are complete.';
}

function renderStandings() {
    els.standings.innerHTML = `<div class="director-table director-standings-table">
        ${sortTeams(state.teams).map((team, index) => {
        const points = Number(team.points ?? team.games_won ?? team.set_wins ?? 0);
        const gamesWon = Number(team.games_won ?? team.set_wins ?? points);
        const gamesLost = Number(team.games_lost ?? team.set_losses ?? 0);
        const pct = gamesWon + gamesLost ? `${Math.round((gamesWon / (gamesWon + gamesLost)) * 100)}%` : '-';
        return `
            <article class="director-row ${index < 6 ? 'is-playoff' : ''}">
                <span class="director-rank">#${index + 1}</span>
                <span class="director-main">
                    <strong>${escapeHtml(teamName(team))}</strong>
                    <em>${Number(team.wins || 0)}-${Number(team.losses || 0)} night record</em>
                </span>
                <span>${points} pts</span>
                <span>${pct} game win</span>
                <span class="director-chip">${index < 6 ? 'Playoff line' : 'Chasing'}</span>
            </article>
        `;
    }).join('')}</div>`;
}

function renderSchedule() {
    const sorted = [...state.matches]
        .sort((a, b) => {
            const aDone = a.status === 'completed' ? 1 : 0;
            const bDone = b.status === 'completed' ? 1 : 0;
            if (aDone !== bDone) return aDone - bDone;
            return Number(a.week || 0) - Number(b.week || 0) || String(a.home_team_name || '').localeCompare(String(b.home_team_name || ''));
        });
    els.schedule.innerHTML = `<div class="director-table director-schedule-table">
        ${sorted
        .map(match => {
            const score = match.status === 'completed'
                ? `${Number(match.home_score || 0)}-${Number(match.away_score || 0)}`
                : 'scheduled';
            return `
                <article class="director-row ${statusClass(match.status)}">
                    <span class="director-chip">Week ${escapeHtml(match.week || match.match_week || '?')}</span>
                    <span class="director-main">
                        <strong>${escapeHtml(match.home_team_name || 'Home')} vs ${escapeHtml(match.away_team_name || 'Away')}</strong>
                        <em>${escapeHtml(dateLabel(matchDate(match)))}</em>
                    </span>
                    <span>${escapeHtml(score)}</span>
                    <a href="/rookies/pages/match-hub-vnext.html?league_id=${encodeURIComponent(leagueId)}&match_id=${encodeURIComponent(match.id)}">Match hub</a>
                </article>
            `;
        }).join('')}</div>`;
}

function renderTeams() {
    els.teamsGrid.innerHTML = sortTeams(state.teams).map((team, index) => {
        const roster = teamRoster(team.id);
        return `<article class="ves-card director-team-card">
            <div>
                <p class="ves-kicker">#${index + 1} Team</p>
                <h2>${escapeHtml(teamName(team))}</h2>
            </div>
            <p>${Number(team.wins || 0)}-${Number(team.losses || 0)} night record</p>
            <div class="director-roster-list">${roster.map(player => `<span><strong>${escapeHtml(level(player))}</strong>${escapeHtml(player.name || 'Player')}</span>`).join('') || '<span>No roster loaded</span>'}</div>
            <div class="ves-card-meta"><a href="/rookies/pages/league-team-vnext.html?league_id=${encodeURIComponent(leagueId)}&team_id=${encodeURIComponent(team.id)}">Team page</a></div>
        </article>`;
    }).join('');
}

function renderPlayers() {
    els.playersGrid.innerHTML = state.players.sort(sortByLevel).slice(0, 80).map(player => {
        const stats = playerStats(player);
        const label = isFillIn(player) ? 'Fill-in' : (state.teams.find(team => team.id === player.team_id)?.team_name || 'Player');
        return card(level(player), player.name || 'Player', label, `<span>${stat(stats.threeDa, 1)} 3DA</span><span>${stat(stats.mpr, 2)} MPR</span><a href="/rookies/pages/player-profile-vnext.html?league_id=${encodeURIComponent(leagueId)}&player_id=${encodeURIComponent(player.id)}">Profile</a>`);
    }).join('');
}

function renderTools() {
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const scheduled = state.matches.length - completed;
    els.tools.innerHTML = [
        card('Match reports', 'Import Reports', 'Use the import bridge for DartConnect reports and post-match cleanup.', `<a href="/rookies/pages/league-import-vnext.html?league_id=${encodeURIComponent(leagueId)}">Open import reports</a>`),
        card('Coverage', 'Schedule Audit', `${completed} completed and ${scheduled} still scheduled.`, `<a href="/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}">Open league hub</a>`),
        card('Communication', 'Contact Players', 'Send a logged league broadcast by site message, text, or email.', `<a href="/rookies/pages/contact-center-vnext.html?audience=league&league_id=${encodeURIComponent(leagueId)}">Open contact center</a>`)
    ].join('');
}

function renderAll() {
    renderHeader();
    renderStandings();
    renderSchedule();
    renderTeams();
    renderPlayers();
    renderTools();
}

function wireTabs() {
    document.querySelectorAll('[data-director-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.directorTarget;
            document.querySelectorAll('[data-director-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-director-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.directorPane === target));
        });
    });
}

async function load() {
    const [leagueSnap, teamsSnap, matchesSnap, playersSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)).catch(() => null),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'matches')),
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]);
    state.league = leagueSnap?.exists?.() ? { id: leagueSnap.id, ...leagueSnap.data() } : null;
    state.teams = teamsSnap.docs.map(team => ({ id: team.id, ...team.data() }));
    state.matches = matchesSnap.docs.map(match => ({ id: match.id, ...match.data() }));
    state.players = playersSnap.docs.map(player => ({ id: player.id, ...player.data() }));
    state.statsById = Object.fromEntries(statsSnap.docs.map(statDoc => [statDoc.id, { id: statDoc.id, ...statDoc.data() }]));
}

async function init() {
    wireTabs();
    const director = await requireDirectorLogin({
        gatedElements: [
            document.querySelector('.ves-summary-grid'),
            document.querySelector('.ves-filters'),
            els.standings,
            els.schedule,
            els.teamsGrid,
            els.playersGrid,
            els.tools
        ],
        statusEl: els.status,
        title: 'Rookies Director Login',
        copy: 'Use Brian or another director account to manage this league.',
        readyText: 'Staff mode'
    });
    if (!director) return;
    await load();
    renderAll();
}

init().catch(error => {
    console.error('[league-director-vnext] failed:', error);
    els.status.textContent = 'Director board unavailable';
    els.standings.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load director board')}</div>`;
});
