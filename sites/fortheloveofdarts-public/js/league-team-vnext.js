import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'rookies-demo-2026-triples';
const teamId = params.get('team_id');

const els = {
    hero: document.getElementById('teamHero'),
    rank: document.getElementById('teamRankBadge'),
    overview: document.getElementById('overviewGrid'),
    matches: document.getElementById('matchList'),
    players: document.getElementById('playerList'),
    chat: document.getElementById('chatPanel'),
    leagueTeamLink: document.getElementById('leagueTeamLink'),
    teamChat: document.getElementById('teamChatLink')
};

let state = {
    team: null,
    league: null,
    teams: [],
    matches: [],
    players: [],
    statsById: {}
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
    if (typeof value === 'string') {
        const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = asDate(value);
    if (!date) return 'Date TBD';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function compactName(value) {
    const name = String(value || 'Team');
    if (/cleveland pagel co\.?/i.test(name)) return 'Cle Pagel Co.';
    if (/neon nightmares/i.test(name)) return 'Neon Nightmrs';
    return name;
}

function teamName(team = state.team) {
    return compactName(team?.team_name || team?.name || 'Team');
}

function level(player) {
    const raw = String(player?.skill_level || player?.preferred_level || player?.level || '').toUpperCase();
    const fill = player?.is_fill_in || player?.is_sub || String(player?.team_id || '').toLowerCase().includes('fill');
    if (fill) return 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function sortByLevel(a, b) {
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    return ((order[level(a)] ?? 9) - (order[level(b)] ?? 9)) || String(a.name || '').localeCompare(String(b.name || ''));
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

function teamRank() {
    return sortTeams(state.teams).findIndex(team => team.id === teamId) + 1;
}

function teamMatches() {
    return state.matches
        .filter(match => match.home_team_id === teamId || match.away_team_id === teamId)
        .sort((a, b) => {
            const aw = Number(a.week || a.match_week || 0);
            const bw = Number(b.week || b.match_week || 0);
            return aw - bw;
        });
}

function getOpponent(match) {
    const home = match.home_team_id === teamId;
    return {
        mySide: home ? 'home' : 'away',
        opponentSide: home ? 'away' : 'home',
        name: compactName(home ? match.away_team_name : match.home_team_name)
    };
}

function getRoster() {
    return state.players
        .filter(player => player.team_id === teamId && !player.is_fill_in && !player.is_sub)
        .sort(sortByLevel);
}

function playerStats(player) {
    const stats = state.statsById[player.id] || {};
    return {
        threeDa: player.x01_three_dart_avg ?? player.avg_3da ?? stats.x01_three_dart_avg ?? stats.avg_3da,
        mpr: player.cricket_mpr ?? player.mpr ?? stats.cricket_mpr ?? stats.mpr
    };
}

function renderHero() {
    const rank = teamRank();
    const matches = teamMatches();
    const next = matches.find(match => match.status !== 'completed');
    els.hero.innerHTML = `
        ${state.team?.photo_url ? `<img class="ltv-team-photo" src="${escapeHtml(state.team.photo_url)}" alt="${escapeHtml(teamName())} photo">` : ''}
        <div>
            <p class="ltv-kicker">${escapeHtml(state.league?.name || '2026 Triples League')}</p>
            <h1>${escapeHtml(teamName())}</h1>
            ${state.team?.motto ? `<p class="ltv-motto">${escapeHtml(state.team.motto)}</p>` : ''}
        </div>
        <div class="ltv-pill-row">
            <span class="ltv-pill hot">Rank #${rank || '-'}</span>
            <span class="ltv-pill green">${Number(state.team?.wins || 0)}-${Number(state.team?.losses || 0)}</span>
            <span class="ltv-pill">${Number(state.team?.points ?? state.team?.games_won ?? 0)} pts</span>
            <span class="ltv-pill">${next ? `Next: W${next.week || '?'}` : 'Schedule complete'}</span>
        </div>
    `;
    els.rank.textContent = `#${rank || '-'} in standings`;
}

function renderOverview() {
    const roster = getRoster();
    const matches = teamMatches();
    const completed = matches.filter(match => match.status === 'completed').length;
    const next = matches.find(match => match.status !== 'completed');
    const gamesWon = Number(state.team?.games_won ?? state.team?.set_wins ?? state.team?.points ?? 0);
    const gamesLost = Number(state.team?.games_lost ?? state.team?.set_losses ?? 0);
    const pct = gamesWon + gamesLost ? `${Math.round((gamesWon / (gamesWon + gamesLost)) * 100)}%` : '-';
    els.overview.innerHTML = [
        ['Record', `${Number(state.team?.wins || 0)}-${Number(state.team?.losses || 0)}`],
        ['Points', Number(state.team?.points ?? state.team?.games_won ?? 0)],
        ['Game %', pct],
        ['Roster', roster.length],
        ['Completed', completed],
        ['Next', next ? `W${next.week || '?'}` : '-']
    ].map(([label, value]) => `
        <div class="ltv-metric"><span>${escapeHtml(label)}</span><strong class="ltv-number">${escapeHtml(value)}</strong></div>
    `).join('');
}

function renderMatches() {
    const rows = teamMatches();
    if (!rows.length) {
        els.matches.innerHTML = '<div class="ltv-empty">No matches attached to this team.</div>';
        return;
    }
    els.matches.innerHTML = rows.map(match => {
        const { mySide, opponentSide, name } = getOpponent(match);
        const myScore = Number(match[`${mySide}_score`] || 0);
        const oppScore = Number(match[`${opponentSide}_score`] || 0);
        const final = match.status === 'completed';
        const resultClass = final ? (myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw') : 'upcoming';
        const location = mySide === 'home' ? 'Home' : 'Away';
        return `
            <a class="ltv-match-row ${resultClass}" href="/rookies/pages/match-hub-vnext.html?league_id=${leagueId}&match_id=${escapeHtml(match.id)}">
                <span class="week">W${escapeHtml(match.week || match.match_week || '?')}</span>
                <span class="team">${escapeHtml(teamName())}<small>${escapeHtml(location)} - ${escapeHtml(formatDate(match.match_date || match.date || match.scheduled_date))}</small></span>
                <span class="score">${final ? `${myScore}-${oppScore}` : 'vs'}</span>
                <span class="team opponent">${escapeHtml(name)}<small>${escapeHtml(final ? resultClass : 'Scheduled')}</small></span>
            </a>
        `;
    }).join('');
}

function renderPlayers() {
    const roster = getRoster();
    if (!roster.length) {
        els.players.innerHTML = '<div class="ltv-empty">No roster attached.</div>';
        return;
    }
    els.players.innerHTML = roster.map(player => {
        const stats = playerStats(player);
        return `
            <a class="ltv-player-row" href="/rookies/pages/player-profile-vnext.html?player_id=${escapeHtml(player.id)}&league_id=${leagueId}">
                <span class="ltv-level ${escapeHtml(level(player))}">${escapeHtml(level(player))}</span>
                <span><strong>${escapeHtml(player.name || 'Player')}</strong><span>${escapeHtml(teamName())}</span></span>
                <em>${stat(stats.threeDa, 1)} / ${stat(stats.mpr, 2)}</em>
            </a>
        `;
    }).join('');
}

function renderChat() {
    els.teamChat.href = `/rookies/pages/messages-vnext.html?league_id=${encodeURIComponent(leagueId)}&team_id=${encodeURIComponent(teamId)}`;
    els.chat.innerHTML = `
        <strong>${escapeHtml(teamName())} room</strong>
        <span>Lineups, fill-ins, rides, and match-night plans belong here.</span>
        <a href="${els.teamChat.href}">Open team chat</a>
    `;
}

function initTabs() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.viewTarget;
            document.querySelectorAll('[data-view-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-view-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.viewPane === target));
        });
    });
}

async function loadData() {
    if (!teamId) throw new Error('Missing team_id');
    const [leagueSnap, teamSnap, teamsSnap, matchesSnap, playersSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)).catch(() => null),
        getDoc(doc(db, 'leagues', leagueId, 'teams', teamId)),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'matches')),
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]);
    if (!teamSnap.exists()) throw new Error('Team not found');
    state.league = leagueSnap?.exists?.() ? { id: leagueSnap.id, ...leagueSnap.data() } : null;
    state.team = { id: teamSnap.id, ...teamSnap.data() };
    state.teams = teamsSnap.docs.map(team => ({ id: team.id, ...team.data() }));
    state.matches = matchesSnap.docs.map(match => ({ id: match.id, ...match.data() }));
    state.players = playersSnap.docs.map(player => ({ id: player.id, ...player.data() }));
    state.statsById = Object.fromEntries(statsSnap.docs.map(statDoc => [statDoc.id, { id: statDoc.id, ...statDoc.data() }]));
}

function renderAll() {
    if (els.leagueTeamLink) {
        els.leagueTeamLink.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    }
    renderHero();
    renderOverview();
    renderMatches();
    renderPlayers();
    renderChat();
}

async function init() {
    initTabs();
    try {
        await loadData();
        renderAll();
    } catch (error) {
        console.error('[league-team-vnext] failed:', error);
        els.hero.innerHTML = `<div class="ltv-empty">${escapeHtml(error.message || 'Could not load team.')}</div>`;
    }
}

init();
