import {
    db,
    collection,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'aOq4Y0ETxPZ66tM1uUtP';

const els = {
    status: document.getElementById('membersStatus'),
    memberCount: document.getElementById('memberCount'),
    playerCount: document.getElementById('playerCount'),
    fillinCount: document.getElementById('fillinCount'),
    search: document.getElementById('memberSearch'),
    filters: document.getElementById('memberFilters'),
    grid: document.getElementById('memberGrid')
};

let state = {
    players: [],
    teamsById: {},
    statsById: {},
    filter: 'all',
    search: ''
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

function sortMembers(a, b) {
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    const diff = (order[level(a)] ?? 9) - (order[level(b)] ?? 9);
    if (diff) return diff;
    return String(a.name || '').localeCompare(String(b.name || ''));
}

function teamName(player) {
    if (isFillIn(player)) return 'Fill-in';
    const team = state.teamsById[player.team_id] || {};
    return team.team_name || team.name || player.team_name || '-';
}

function playerStats(player) {
    const stats = state.statsById[player.id] || {};
    return {
        threeDa: player.x01_three_dart_avg ?? player.avg_3da ?? stats.x01_three_dart_avg ?? stats.avg_3da,
        mpr: player.cricket_mpr ?? player.mpr ?? stats.cricket_mpr ?? stats.mpr,
        wins: stats.games_won ?? player.games_won,
        played: stats.games_played ?? player.games_played
    };
}

function winPct(stats) {
    const won = finite(stats.wins) || 0;
    const played = finite(stats.played) || 0;
    return played > 0 ? `${Math.round((won / played) * 100)}%` : '-';
}

function memberText(player) {
    const stats = playerStats(player);
    return [
        player.name,
        teamName(player),
        level(player),
        stat(stats.threeDa, 1),
        stat(stats.mpr, 2),
        player.email,
        player.phone
    ].join(' ').toLowerCase();
}

function filteredMembers() {
    const search = state.search.trim().toLowerCase();
    return state.players
        .filter(player => state.filter === 'all' || level(player) === state.filter)
        .filter(player => !search || memberText(player).includes(search))
        .sort(sortMembers);
}

function renderCard(player) {
    const stats = playerStats(player);
    const lvl = level(player);
    const team = teamName(player);
    return `
        <a class="ves-member-card" href="/pages/player-profile-vnext.html?league_id=${encodeURIComponent(leagueId)}&player_id=${encodeURIComponent(player.id)}">
            <span class="ves-member-level ${lvl === 'F' ? 'fillin' : ''}">${escapeHtml(lvl)}</span>
            <span class="ves-member-main">
                <strong>${escapeHtml(player.name || 'Player')}</strong>
                <em>${escapeHtml(team)}</em>
            </span>
            <span class="ves-member-stats">
                <span><strong>${stat(stats.threeDa, 1)}</strong> 3DA</span>
                <span><strong>${stat(stats.mpr, 2)}</strong> MPR</span>
                <span><strong>${winPct(stats)}</strong> W%</span>
            </span>
        </a>
    `;
}

function render() {
    const members = filteredMembers();
    const leaguePlayers = state.players.filter(player => !isFillIn(player));
    const fillins = state.players.filter(isFillIn);
    els.memberCount.textContent = String(state.players.length);
    els.playerCount.textContent = String(leaguePlayers.length);
    els.fillinCount.textContent = String(fillins.length);
    els.status.textContent = `${members.length} shown`;
    els.grid.innerHTML = members.length
        ? members.map(renderCard).join('')
        : '<div class="ves-empty">No members match that filter.</div>';
}

async function load() {
    const [playersSnap, teamsSnap, statsSnap] = await Promise.all([
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]);
    state.players = playersSnap.docs.map(player => ({ id: player.id, ...player.data() }));
    state.teamsById = Object.fromEntries(teamsSnap.docs.map(team => [team.id, { id: team.id, ...team.data() }]));
    state.statsById = Object.fromEntries(statsSnap.docs.map(statDoc => [statDoc.id, { id: statDoc.id, ...statDoc.data() }]));
}

function wire() {
    els.search.addEventListener('input', () => {
        state.search = els.search.value;
        render();
    });
    els.filters.querySelectorAll('[data-member-filter]').forEach(button => {
        button.addEventListener('click', () => {
            state.filter = button.dataset.memberFilter;
            els.filters.querySelectorAll('[data-member-filter]').forEach(item => item.classList.toggle('active', item === button));
            render();
        });
    });
}

wire();
load().then(render).catch(error => {
    console.error('[members-vnext] failed:', error);
    els.status.textContent = 'Members unavailable';
    els.grid.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load members')}</div>`;
});
