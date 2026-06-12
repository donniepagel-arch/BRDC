import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'aOq4Y0ETxPZ66tM1uUtP';

const els = {
    status: document.getElementById('directorStatus'),
    title: document.getElementById('directorTitle'),
    teams: document.getElementById('directorTeams'),
    matches: document.getElementById('directorMatches'),
    players: document.getElementById('directorPlayers'),
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

function renderHeader() {
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const fillins = state.players.filter(isFillIn).length;
    els.status.textContent = `${completed}/${state.matches.length} matches completed`;
    els.title.textContent = state.league?.name || state.league?.league_name || '2026 Triples League';
    els.teams.textContent = String(state.teams.length);
    els.matches.textContent = String(state.matches.length);
    els.players.textContent = String(state.players.length);
    document.querySelectorAll('a[href="/pages/triples-vnext.html"]').forEach(link => {
        link.href = `/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    });
    document.querySelectorAll('a[href="/pages/captain-dashboard-vnext.html"]').forEach(link => {
        link.href = `/pages/captain-dashboard-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    });
    if (fillins) els.players.parentElement.querySelector('em').textContent = `${fillins} fill-ins included.`;
}

function renderStandings() {
    els.standings.innerHTML = sortTeams(state.teams).map((team, index) => {
        const points = Number(team.points ?? team.games_won ?? team.set_wins ?? 0);
        const gamesWon = Number(team.games_won ?? team.set_wins ?? points);
        const gamesLost = Number(team.games_lost ?? team.set_losses ?? 0);
        const pct = gamesWon + gamesLost ? `${Math.round((gamesWon / (gamesWon + gamesLost)) * 100)}%` : '-';
        return card(`#${index + 1}`, teamName(team), `${Number(team.wins || 0)}-${Number(team.losses || 0)} night record`, `<span>${points} pts</span><span>${pct} game win</span><span>${index < 6 ? 'Playoff line' : 'Chasing'}</span>`);
    }).join('');
}

function renderSchedule() {
    els.schedule.innerHTML = [...state.matches]
        .sort((a, b) => Number(a.week || 0) - Number(b.week || 0) || String(a.home_team_name || '').localeCompare(String(b.home_team_name || '')))
        .map(match => {
            const score = match.status === 'completed'
                ? `${Number(match.home_score || 0)}-${Number(match.away_score || 0)}`
                : 'scheduled';
            return card(`Week ${match.week || match.match_week || '?'}`, `${match.home_team_name || 'Home'} vs ${match.away_team_name || 'Away'}`, dateLabel(matchDate(match)), `<span>${escapeHtml(score)}</span><a href="/pages/match-hub-vnext.html?league_id=${encodeURIComponent(leagueId)}&match_id=${encodeURIComponent(match.id)}">Match hub</a>`);
        }).join('');
}

function renderTeams() {
    els.teamsGrid.innerHTML = sortTeams(state.teams).map(team => {
        const roster = teamRoster(team.id);
        return card(teamName(team), `${Number(team.wins || 0)}-${Number(team.losses || 0)}`, roster.map(player => `${level(player)} ${player.name}`).join(' / ') || 'No roster loaded', `<a href="/pages/league-team-vnext.html?league_id=${encodeURIComponent(leagueId)}&team_id=${encodeURIComponent(team.id)}">Team page</a>`);
    }).join('');
}

function renderPlayers() {
    els.playersGrid.innerHTML = state.players.sort(sortByLevel).slice(0, 80).map(player => {
        const stats = playerStats(player);
        const label = isFillIn(player) ? 'Fill-in' : (state.teams.find(team => team.id === player.team_id)?.team_name || 'Player');
        return card(level(player), player.name || 'Player', label, `<span>${stat(stats.threeDa, 1)} 3DA</span><span>${stat(stats.mpr, 2)} MPR</span><a href="/pages/player-profile-vnext.html?league_id=${encodeURIComponent(leagueId)}&player_id=${encodeURIComponent(player.id)}">Profile</a>`);
    }).join('');
}

function renderTools() {
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const scheduled = state.matches.length - completed;
    els.tools.innerHTML = [
        card('Match reports', 'Import reports', 'Use the vnext captain import bridge until the report importer is rebuilt directly into this director surface.', `<a href="/pages/captain-dashboard-vnext.html?league_id=${encodeURIComponent(leagueId)}">Open import reports</a>`),
        card('Coverage', 'Schedule audit', `${completed} completed and ${scheduled} still scheduled.`, `<a href="/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}">Open league hub</a>`),
        card('Communication', 'Rooms', 'League, team, and direct messages stay in the vnext chat surface.', '<a href="/pages/messages-vnext.html">Open messages</a>')
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

wireTabs();
load().then(renderAll).catch(error => {
    console.error('[league-director-vnext] failed:', error);
    els.status.textContent = 'Director board unavailable';
    els.standings.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load director board')}</div>`;
});
