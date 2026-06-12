import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    uploadImage,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    orderBy,
    limit
} from '/js/firebase-config.js';

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const TRIPLES_CACHE_KEY = `brdc:vnext:league:triples:${LEAGUE_ID}:v4`;
const TRIPLES_CACHE_TTL_MS = 5 * 60 * 1000;
// Persistent (cross-session) cache for INSTANT optimistic render of the
// above-the-fold standings + snapshot header. Stale-while-revalidate: the read
// ignores TTL, the real fetch still runs and overwrites with fresh data.
// (Same pattern as home-vnext.js IDENTITY_CACHE_KEY.)
const TRIPLES_LOCAL_SNAPSHOT_KEY = 'brdc:vnext:triples:snapshot:v1';
const els = {
    subtitle: document.getElementById('leagueSubtitle'),
    snapshot: document.getElementById('leagueSnapshot'),
    playoffs: document.getElementById('playoffBracket'),
    standings: document.getElementById('standingsList'),
    weekStrip: document.getElementById('weekStrip'),
    schedule: document.getElementById('scheduleList'),
    x01: document.getElementById('x01Leaders'),
    cricket: document.getElementById('cricketLeaders'),
    stats: document.getElementById('statsContainer'),
    teams: document.getElementById('teamGrid'),
    fillins: document.getElementById('fillinGrid'),
    manage: document.getElementById('leagueManageGrid'),
    fillinCount: document.getElementById('fillinCount'),
    fillinSignupModal: document.getElementById('fillinSignupModal'),
    fillinSignupForm: document.getElementById('fillinSignupForm'),
    fillinSignupStatus: document.getElementById('fillinSignupStatus'),
    submitFillinSignupBtn: document.getElementById('submitFillinSignupBtn')
};

// ---------------------------------------------------------------------------
// Stats view state and category definitions
// ---------------------------------------------------------------------------

const statsView = {
    mode: 'players',
    category: 'performance',
    game: 'x01',
    page: 0,
    level: '',
    sort: '',
    direction: 'desc',
    expandedTeams: new Set()
};

const STATS_CATEGORIES = {
    performance: {
        label: 'Performance',
        games: {
            x01: {
                label: '01',
                pages: [
                    { label: 'Averages', sort: 'threeDa', columns: [
                        { key: 'threeDa', label: '3DA', primary: true },
                        { key: 'first9', label: 'Fir9' },
                        { key: 'avgCheckout', label: 'AFin' },
                        { key: 'x01Legs', label: 'Legs', hideMobile: true },
                        { key: 'x01WinPct', label: 'Win%', hideMobile: true }
                    ] },
                    { label: 'Tons', sort: 'threeDa', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'tons', label: '100+', primary: true },
                        { key: 'ton40Plus', label: '140+' },
                        { key: 'ton80', label: '180', hideMobile: true },
                        { key: 'highScore', label: 'HTurn', hideMobile: true }
                    ] },
                    { label: 'Ton Breakdown', sort: 'threeDa', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'ton00', label: '100-119', primary: true },
                        { key: 'ton20', label: '120-139' },
                        { key: 'ton40', label: '140-159', hideMobile: true },
                        { key: 'ton60', label: '160-179', hideMobile: true },
                        { key: 'ton80', label: '180' }
                    ] },
                    { label: 'Checkouts', sort: 'checkoutPct', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'checkoutPct', label: 'CO%', primary: true },
                        { key: 'avgCheckout', label: 'AFin' },
                        { key: 'highCheckout', label: 'HCO', hideMobile: true },
                        { key: 'checkoutHits', label: 'Made', hideMobile: true },
                        { key: 'checkoutAttempts', label: 'Att', hideMobile: true }
                    ] }
                ]
            },
            cricket: {
                label: 'Cricket',
                pages: [
                    { label: 'Averages', sort: 'mpr', columns: [
                        { key: 'mpr', label: 'MPR', primary: true },
                        { key: 'highMark', label: 'HRnd' },
                        { key: 'cricketLegs', label: 'Legs', hideMobile: true },
                        { key: 'cricketWinPct', label: 'Win%', hideMobile: true }
                    ] },
                    { label: 'High Marks', sort: 'mark9', columns: [
                        { key: 'mpr', label: 'MPR' },
                        { key: 'mark9', label: '9M', primary: true },
                        { key: 'mark8', label: '8M' },
                        { key: 'mark7', label: '7M', hideMobile: true },
                        { key: 'mark6', label: '6M', hideMobile: true },
                        { key: 'mark5', label: '5M', hideMobile: true }
                    ] }
                ]
            }
        }
    },
    awards: {
        label: 'Awards',
        games: {
            x01: {
                label: '01',
                pages: [
                    { label: 'CO Range %', sort: 'co80Pct', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'co80Pct', label: '80+%', primary: true },
                        { key: 'co120Pct', label: '120+%' },
                        { key: 'co140Pct', label: '140+%', hideMobile: true },
                        { key: 'co161Pct', label: '161+%', hideMobile: true }
                    ] },
                    { label: 'CO Range Counts', sort: 'co80Made', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'co80Made', label: '80+', primary: true },
                        { key: 'co120Made', label: '120+' },
                        { key: 'co140Made', label: '140+', hideMobile: true },
                        { key: 'co161Made', label: '161+', hideMobile: true }
                    ] },
                    { label: 'Checkout Perf', sort: 'avgCheckout', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'avgCheckout', label: 'AFin', primary: true },
                        { key: 'checkoutPct', label: 'CO%' },
                        { key: 'highCheckout', label: 'HCO', hideMobile: true },
                        { key: 'bestLeg', label: 'Best', hideMobile: true }
                    ] }
                ]
            },
            cricket: {
                label: 'Cricket',
                pages: [
                    { label: 'High Marks', sort: 'mark9', columns: [
                        { key: 'mpr', label: 'MPR' },
                        { key: 'mark9', label: '9M', primary: true },
                        { key: 'mark8', label: '8M' },
                        { key: 'mark7', label: '7M', hideMobile: true },
                        { key: 'mark6', label: '6M', hideMobile: true },
                        { key: 'hatTricks', label: 'Hats', hideMobile: true }
                    ] }
                ]
            }
        }
    },
    leaderboard: {
        label: 'Leaderboard',
        games: {
            x01: {
                label: '01',
                pages: [
                    { label: 'Record', sort: 'x01WinPct', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'x01Wins', label: 'Won', primary: true },
                        { key: 'x01Legs', label: 'Legs' },
                        { key: 'x01WinPct', label: 'Win%' },
                        { key: 'bestLeg', label: 'Best', hideMobile: true }
                    ] },
                    { label: 'Start Record', sort: 'x01WithDartsPct', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'x01WithDartsPct', label: 'w/Darts%', primary: true },
                        { key: 'x01WithDartsLegs', label: 'w/Legs' },
                        { key: 'x01AgainstDartsPct', label: 'vs%', hideMobile: true },
                        { key: 'x01AgainstDartsLegs', label: 'vs Legs', hideMobile: true }
                    ] },
                    { label: 'CO Leaders', sort: 'highCheckout', columns: [
                        { key: 'threeDa', label: '3DA' },
                        { key: 'highCheckout', label: 'HCO', primary: true },
                        { key: 'avgCheckout', label: 'AFin' },
                        { key: 'checkoutPct', label: 'CO%', hideMobile: true },
                        { key: 'highScore', label: 'HTurn', hideMobile: true }
                    ] }
                ]
            },
            cricket: {
                label: 'Cricket',
                pages: [
                    { label: 'Record', sort: 'cricketWinPct', columns: [
                        { key: 'mpr', label: 'MPR' },
                        { key: 'cricketWins', label: 'Won', primary: true },
                        { key: 'cricketLegs', label: 'Legs' },
                        { key: 'cricketWinPct', label: 'Win%' },
                        { key: 'highMark', label: 'HRnd', hideMobile: true }
                    ] },
                    { label: 'Start Record', sort: 'cricketWithDartsPct', columns: [
                        { key: 'mpr', label: 'MPR' },
                        { key: 'cricketWithDartsPct', label: 'w/Darts%', primary: true },
                        { key: 'cricketWithDartsLegs', label: 'w/Legs' },
                        { key: 'cricketAgainstDartsPct', label: 'vs%', hideMobile: true },
                        { key: 'cricketAgainstDartsLegs', label: 'vs Legs', hideMobile: true }
                    ] }
                ]
            },
            combined: {
                label: 'All',
                pages: [
                    { label: 'Combined Record', sort: 'totalWins', columns: [
                        { key: 'totalWins', label: 'Won', primary: true },
                        { key: 'totalLegs', label: 'Played' },
                        { key: 'totalWinPct', label: 'Win%' },
                        { key: 'withDartsPct', label: 'w/Darts%', hideMobile: true },
                        { key: 'againstDartsPct', label: 'vs%', hideMobile: true }
                    ] }
                ]
            }
        }
    }
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function readCache(key, ttlMs) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) return null;
        return parsed.data || null;
    } catch {
        return null;
    }
}

function writeCache(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
        // Cache is best-effort only.
    }
}

// Persistent (cross-session) localStorage cache — survives a cold open so the
// standings + snapshot header paint instantly instead of waiting ~10s for cold
// Cloud Functions / the league snapshot query. Stale-while-revalidate: no TTL gate.
function readLocalCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw)?.data ?? null;
    } catch {
        return null;
    }
}

function writeLocalCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
        // optimization only
    }
}

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------

let state = {
    currentPlayer: null,
    myTeamIds: new Set(),
    teams: [],
    matches: [],
    players: [],
    statsById: {},
    league: null,
    playoff: null,
    isDirector: false,
    activeWeek: null,
    selectedFillinPhoto: null
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) {
            return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = asDate(value);
    if (!date) return 'Date TBD';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function finite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function statValue(player, key, fallbackKey, decimals) {
    const stats = state.statsById[player?.id] || {};
    const value = finite(player?.[key] ?? player?.[fallbackKey] ?? stats[key] ?? stats[fallbackKey]);
    return value == null || value <= 0 ? '-' : value.toFixed(decimals);
}

function rawStat(player, key, fallbackKey) {
    const stats = state.statsById[player?.id] || {};
    return finite(player?.[key] ?? player?.[fallbackKey] ?? stats[key] ?? stats[fallbackKey]);
}

function teamName(teamOrName) {
    const name = typeof teamOrName === 'string'
        ? teamOrName
        : (teamOrName?.team_name || teamOrName?.name || 'Team');
    return name;
}

function teamById(teamId) {
    return state.teams.find(team => team.id === teamId);
}

function isFillIn(player) {
    return player?.is_fill_in === true ||
        player?.is_fillin === true ||
        player?.is_sub === true ||
        ['fill_in', 'fill-in', 'fillin'].includes(String(player?.team_id || '').toLowerCase());
}

function hasDirectorRights(player) {
    return player?.is_director === true || player?.is_admin === true || player?.is_master_admin === true;
}

function playerLevel(player) {
    const raw = String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
    if (isFillIn(player)) return ['A', 'B', 'C'].includes(raw) ? raw : 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function activateView(target) {
    const pane = document.querySelector(`[data-view-pane="${CSS.escape(target)}"]`);
    if (!pane || pane.hidden) return false;
    document.querySelectorAll('[data-view-target]').forEach(item => item.classList.toggle('active', item.dataset.viewTarget === target));
    document.querySelectorAll('[data-view-pane]').forEach(item => item.classList.toggle('active', item.dataset.viewPane === target));
    return true;
}

function activateStandingsView(target) {
    document.querySelectorAll('[data-standings-target]').forEach(item => {
        const active = item.dataset.standingsTarget === target;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-standings-panel]').forEach(panel => {
        const active = panel.dataset.standingsPanel === target;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
}

function updateDirectorVisibility() {
    document.querySelectorAll('[data-director-only]').forEach(element => {
        element.hidden = !state.isDirector;
    });
    const hashTarget = String(location.hash || '').replace('#', '');
    if (state.isDirector && hashTarget === 'manage') {
        activateView('manage');
    }
    if (!state.isDirector && document.querySelector('[data-view-pane="manage"].active')) {
        activateView('standings');
        activateStandingsView('playoffs');
    }
}

function sortPlayersByLevel(a, b) {
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    const aOrder = order[playerLevel(a)] ?? 9;
    const bOrder = order[playerLevel(b)] ?? 9;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function normalizeName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getMyTeamIds(player, players) {
    const ids = new Set();
    const email = String(auth.currentUser?.email || player?.email || '').toLowerCase();
    const name = normalizeName(player?.name || '');
    players.forEach(leaguePlayer => {
        if (leaguePlayer.id === player?.id ||
            (email && String(leaguePlayer.email || '').toLowerCase() === email) ||
            (name && normalizeName(leaguePlayer.name) === name)) {
            if (leaguePlayer.team_id && !isFillIn(leaguePlayer)) ids.add(leaguePlayer.team_id);
        }
    });
    (player?.involvements?.leagues || []).forEach(league => {
        if (league.id === LEAGUE_ID && league.team_id && !String(league.team_id).startsWith('fill')) {
            ids.add(league.team_id);
        }
    });
    return ids;
}

function sortTeams(teams) {
    return [...teams].sort((a, b) => {
        const aw = Number(a.wins || 0);
        const bw = Number(b.wins || 0);
        const ap = Number(a.points ?? a.games_won ?? a.set_wins ?? 0);
        const bp = Number(b.points ?? b.games_won ?? b.set_wins ?? 0);
        const al = Number(a.losses || 0);
        const bl = Number(b.losses || 0);
        if (bw !== aw) return bw - aw;
        if (bp !== ap) return bp - ap;
        return al - bl;
    });
}

// ---------------------------------------------------------------------------
// Regular season standings derived from match results
// ---------------------------------------------------------------------------

function buildRegularSeasonStandings() {
    const rows = new Map(state.teams.map(team => [team.id, {
        ...team,
        wins: 0,
        losses: 0,
        points: 0,
        games_won: 0,
        games_lost: 0
    }]));

    state.matches
        .filter(match => match.status === 'completed' && !isPlayoffMatch(match))
        .forEach(match => {
            const home = rows.get(match.home_team_id);
            const away = rows.get(match.away_team_id);
            if (!home || !away) return;
            const homeScore = Number(match.home_score || 0);
            const awayScore = Number(match.away_score || 0);
            home.points += homeScore;
            home.games_won += homeScore;
            home.games_lost += awayScore;
            away.points += awayScore;
            away.games_won += awayScore;
            away.games_lost += homeScore;
            if (homeScore > awayScore) {
                home.wins += 1;
                away.losses += 1;
            } else if (awayScore > homeScore) {
                away.wins += 1;
                home.losses += 1;
            }
        });

    return [...rows.values()].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.points !== a.points) return b.points - a.points;
        if (b.games_won !== a.games_won) return b.games_won - a.games_won;
        return teamName(a).localeCompare(teamName(b));
    });
}

// ---------------------------------------------------------------------------
// Playoff helpers
// ---------------------------------------------------------------------------

function isPlayoffMatch(match) {
    return match?.season_phase === 'playoffs' ||
        match?.match_type === 'playoff' ||
        Boolean(match?.playoff_round || match?.playoff_match_key || match?.playoff_bracket_id);
}

function playoffStatusLabel(match) {
    if (!match) return 'Pending';
    if (match.status === 'completed') return 'Final';
    if (match.status === 'in_progress') return 'Live';
    if (match.status === 'pending' || !match.id) return 'Pending';
    return 'Scheduled';
}

function playoffRoundLabel(round) {
    const raw = String(round?.key || round?.round_key || round?.playoff_round || '').toLowerCase();
    if (raw.includes('quarter')) return 'Quarterfinals';
    if (raw.includes('semi')) return 'Semifinals';
    if (raw.includes('final')) return 'Final';
    return round?.label || `Round ${round?.round || round?.playoff_round_number || '?'}`;
}

function playoffRoundKind(round) {
    const raw = String(round?.key || round?.round_key || round?.playoff_round || '').toLowerCase();
    if (raw.includes('quarter')) return 'quarterfinal';
    if (raw.includes('semi')) return 'semifinal';
    if (raw.includes('final')) return 'final';
    return raw;
}

function sourceWinnerLabel(sourceKey, matchesByKey) {
    const source = matchesByKey.get(sourceKey);
    if (String(sourceKey || '').startsWith('loser_')) return 'TBD';
    if (!source) return `Winner of ${sourceKey || 'previous match'}`;
    const homeTeam = teamById(source.home_team_id);
    const awayTeam = teamById(source.away_team_id);
    const home = source.home_from
        ? sourceWinnerLabel(source.home_from, matchesByKey)
        : (source.home_team_name || source.home_label || (homeTeam ? teamName(homeTeam) : 'Home'));
    const away = source.away_from
        ? sourceWinnerLabel(source.away_from, matchesByKey)
        : (source.away_team_name || source.away_label || (awayTeam ? teamName(awayTeam) : 'Away'));
    return `Winner of ${home} / ${away}`;
}

function sourcePlayoffShortLabel(sourceKey, matchesByKey) {
    if (String(sourceKey || '').startsWith('sf_')) return 'TBD';
    if (String(sourceKey || '').startsWith('loser_sf_')) return 'TBD';
    const source = matchesByKey.get(sourceKey);
    if (source?.status === 'completed') {
        const winnerSide = source.winner || (Number(source.home_score || 0) > Number(source.away_score || 0) ? 'home' : 'away');
        const winnerTeam = teamById(source[`${winnerSide}_team_id`]);
        return source[`${winnerSide}_team_name`] || (winnerTeam ? teamName(winnerTeam) : 'TBD');
    }
    const labels = {
        qf_3v6: 'Winner 3/6',
        qf_4v5: 'Winner 4/5'
    };
    return labels[sourceKey] || 'TBD';
}

function teamPlayoffMeta(team) {
    if (!team?.id) return '';
    const wins = Number(team.wins || 0);
    const losses = Number(team.losses || 0);
    const roster = state.players.filter(player => player.team_id === team.id && !isFillIn(player));
    const x01Values = roster
        .map(player => rawStat(player, 'x01_three_dart_avg', 'avg_3da'))
        .filter(value => value != null && value > 0);
    const mprValues = roster
        .map(player => rawStat(player, 'cricket_mpr', 'mpr'))
        .filter(value => value != null && value > 0);
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const x01 = avg(x01Values);
    const mpr = avg(mprValues);
    const statText = x01 != null || mpr != null
        ? `${x01 != null ? x01.toFixed(1) : '-'} 3DA / ${mpr != null ? mpr.toFixed(2) : '-'} MPR`
        : 'Stats pending';
    return `${wins}-${losses} regular season • ${statText}`;
}

function seedLabel(teamId, explicitSeed) {
    if (explicitSeed) return `#${explicitSeed}`;
    const seed = (state.playoff?.seeds || []).find(row => row.team_id === teamId);
    return seed?.seed ? `#${seed.seed}` : '';
}

function normalizePlayoffEntrant(match, side, matchesByKey) {
    const teamId = match?.[`${side}_team_id`];
    const team = teamById(teamId);
    const seed = match?.[`${side}_seed`];
    const name = match?.[`${side}_team_name`] || (team ? teamName(team) : null);
    const from = match?.[`${side}_from`];
    return {
        name: name || (from ? sourcePlayoffShortLabel(from, matchesByKey) : 'TBD'),
        seed: seedLabel(teamId, seed),
        meta: team ? teamPlayoffMeta(team) : '',
        score: ['completed', 'in_progress'].includes(match?.status) && Number.isFinite(Number(match?.[`${side}_score`]))
            ? Number(match[`${side}_score`])
            : null,
        winner: match?.status === 'completed' && match?.winner === side
    };
}

function playoffMatchesByKey() {
    const byKey = new Map();
    state.matches.filter(isPlayoffMatch).forEach(match => {
        if (match.playoff_match_key) byKey.set(match.playoff_match_key, match);
        byKey.set(match.id, match);
    });
    return byKey;
}

function getPlayoffRoundMatches(round, matchesByKey) {
    const roundMatches = Array.isArray(round?.matches) ? round.matches : [];
    if (roundMatches.length) {
        return roundMatches.map(item => {
            const key = item.match_id || item.id || item.key || item.playoff_match_key;
            const docMatch = matchesByKey.get(key);
            return { ...item, ...(docMatch || {}), key };
        });
    }

    return state.matches
        .filter(match => isPlayoffMatch(match) && Number(match.playoff_round_number || 0) === Number(round?.round || round?.round_number || 0))
        .sort((a, b) => String(a.playoff_match_key || a.id).localeCompare(String(b.playoff_match_key || b.id)));
}

function playoffMatchKey(match) {
    return match?.playoff_match_key || match?.key || match?.match_id || match?.id || '';
}

function friendlyPlayoffMatchLabel(match) {
    if (match?.playoff_match_label || match?.label) return match.playoff_match_label || match.label;
    const key = playoffMatchKey(match);
    if (key === 'sf_1_vs_qf_4v5') return 'Semifinal: #1 seed vs #4/#5 winner';
    if (key === 'sf_2_vs_qf_3v6') return 'Semifinal: #2 seed vs #3/#6 winner';
    if (key === 'final') return 'Championship Final';
    if (key === 'third_place' || key === 'third-place' || key === 'third-place-placeholder') return '3rd / 4th';
    if (key === 'qf_3v6') return 'Quarterfinal: #3 vs #6';
    if (key === 'qf_4v5') return 'Quarterfinal: #4 vs #5';
    return key || 'Playoff match';
}

function isChampionshipPlayoffMatch(match) {
    const key = String(playoffMatchKey(match)).toLowerCase();
    const label = String(match?.playoff_match_label || match?.label || '').toLowerCase();
    return key === 'final' || key === 'final-placeholder' || label.includes('championship');
}

function isThirdPlacePlayoffMatch(match) {
    const text = `${playoffMatchKey(match)} ${match?.playoff_match_label || ''} ${match?.label || ''}`.toLowerCase();
    return text.includes('third') || text.includes('3rd') || text.includes('consolation') || text.includes('3-4') || text.includes('3_4');
}

function defaultPlayoffRounds(seeds, playoffMatches) {
    const seed = number => seeds.find(row => Number(row.seed) === number) || {};
    const qfMatches = playoffMatches
        .filter(match => Number(match.playoff_round_number || 0) === 1 || match.playoff_round === 'quarterfinal')
        .sort((a, b) => String(a.playoff_match_key || a.id).localeCompare(String(b.playoff_match_key || b.id)));

    return [
        {
            key: 'quarterfinal',
            round: 1,
            week: 19,
            target_date: qfMatches[0]?.scheduled_date || qfMatches[0]?.match_date || '2026-05-27',
            matches: qfMatches
        },
        {
            key: 'semifinal',
            round: 2,
            week: 20,
            target_date: '2026-06-03',
            matches: [
                {
                    key: 'sf_1_vs_qf_4v5',
                    home_seed: 1,
                    home_team_id: seed(1).team_id,
                    home_team_name: seed(1).team_name,
                    away_from: 'qf_4v5'
                },
                {
                    key: 'sf_2_vs_qf_3v6',
                    home_seed: 2,
                    home_team_id: seed(2).team_id,
                    home_team_name: seed(2).team_name,
                    away_from: 'qf_3v6'
                }
            ]
        },
        {
            key: 'final',
            round: 3,
            week: 21,
            target_date: '2026-06-10',
            matches: [
                {
                    key: 'final',
                    playoff_match_label: 'Championship',
                    home_from: 'sf_1_vs_qf_4v5',
                    away_from: 'sf_2_vs_qf_3v6'
                },
                {
                    key: 'third-place-placeholder',
                    playoff_match_label: '3rd / 4th',
                    home_from: 'loser_sf_1_vs_qf_4v5',
                    away_from: 'loser_sf_2_vs_qf_3v6'
                }
            ]
        }
    ];
}

function ensurePlayoffRounds(rounds, seeds, playoffMatches, includeThirdPlace) {
    const existing = Array.isArray(rounds) ? [...rounds] : [];
    const defaults = defaultPlayoffRounds(seeds, playoffMatches);
    const hasRound = key => existing.some(round => playoffRoundKind(round) === key);
    defaults.forEach(defaultRound => {
        if (!hasRound(defaultRound.key)) existing.push(defaultRound);
    });
    const finalRound = existing.find(round => playoffRoundKind(round) === 'final');
    const defaultFinalRound = defaults.find(round => round.key === 'final');
    if (finalRound && Array.isArray(finalRound.matches)) {
        if (!finalRound.matches.some(isChampionshipPlayoffMatch)) {
            finalRound.matches.push(defaultFinalRound.matches.find(isChampionshipPlayoffMatch));
        }
        if (includeThirdPlace && !finalRound.matches.some(isThirdPlacePlayoffMatch)) {
            finalRound.matches.push(defaultFinalRound.matches.find(isThirdPlacePlayoffMatch));
        }
    }
    // When the league has no 3rd/4th-place match, strip any 3rd-place placeholder/match
    // from every round (covers defaults, injected, or Firestore-sourced brackets).
    if (!includeThirdPlace) {
        existing.forEach(round => {
            if (Array.isArray(round.matches)) {
                round.matches = round.matches.filter(match => !isThirdPlacePlayoffMatch(match));
            }
        });
    }
    return existing.sort((a, b) => Number(a.round || a.round_number || 99) - Number(b.round || b.round_number || 99));
}

// ---------------------------------------------------------------------------
// Render: Playoffs
// ---------------------------------------------------------------------------

function renderPlayoffs() {
    if (!els.playoffs) return;
    const playoffMatches = state.matches.filter(isPlayoffMatch);
    const bracket = state.playoff || {};
    const seeds = Array.isArray(bracket.seeds) && bracket.seeds.length
        ? bracket.seeds
        : sortTeams(state.teams).slice(0, 6).map((team, index) => ({
            seed: index + 1,
            team_id: team.id,
            team_name: teamName(team),
            record: `${Number(team.wins || 0)}-${Number(team.losses || 0)}`
        }));
    const matchesByKey = playoffMatchesByKey();
    // Only show a 3rd/4th-place match when the league explicitly enables it.
    const includeThirdPlace = !!(state.league && (state.league.third_place_match === true
        || state.league.third_place_match === 'true' || state.league.playoff_third_place === true));
    const rounds = ensurePlayoffRounds(bracket.rounds, seeds, playoffMatches, includeThirdPlace);
    // Show final round first (most interesting), then earlier rounds
    const displayRounds = [...rounds].sort((a, b) => Number(b.round || b.round_number || 0) - Number(a.round || a.round_number || 0));
    rounds.forEach(round => {
        getPlayoffRoundMatches(round, matchesByKey).forEach(match => {
            const key = playoffMatchKey(match);
            if (key && !matchesByKey.has(key)) matchesByKey.set(key, match);
        });
    });

    if (!seeds.length && !playoffMatches.length) {
        els.playoffs.innerHTML = '<div class="tv-empty">Playoff bracket is not set up yet.</div>';
        return;
    }

    const completed = playoffMatches.filter(match => match.status === 'completed').length;
    const scheduled = playoffMatches.filter(match => match.status !== 'completed').length;

    els.playoffs.innerHTML = `
        <div class="tv-playoff-summary">
            <span class="tv-pill hot">${completed} final</span>
            <span class="tv-pill">${scheduled} open</span>
            <span class="tv-pill">Race to 5 sets</span>
        </div>

        <div class="tv-bracket-grid">
            ${displayRounds.map(round => {
                const matches = getPlayoffRoundMatches(round, matchesByKey);
                return `
                    <section class="tv-bracket-round">
                        <header>
                            <h3>${escapeHtml(playoffRoundLabel(round))}</h3>
                            <span>${[round.week ? `Week ${round.week}` : '', formatDate(round.target_date)].filter(Boolean).join(' - ')}</span>
                        </header>
                        <div class="tv-bracket-matches">
                            ${matches.map(match => renderPlayoffMatch(match, matchesByKey)).join('') || '<div class="tv-empty">Matchups pending.</div>'}
                        </div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}

function renderPlayoffMatch(match, matchesByKey) {
    const home = normalizePlayoffEntrant(match, 'home', matchesByKey);
    const away = normalizePlayoffEntrant(match, 'away', matchesByKey);
    const href = match.id && state.matches.some(row => row.id === match.id)
        ? `/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${encodeURIComponent(match.id)}`
        : '';
    const tag = href ? 'a' : 'article';
    const attrs = href ? `href="${escapeHtml(href)}"` : '';
    const status = playoffStatusLabel(match);
    const key = playoffMatchKey(match);
    const label = match.playoff_match_label || match.label || '';
    const statusClass = match.status === 'completed'
        ? 'is-completed'
        : match.status === 'in_progress'
            ? 'is-live'
            : href
                ? 'is-open'
                : 'is-pending';
    const finalClass = key === 'final' ? 'is-championship' : '';
    const actionLabel = href
        ? (match.status === 'completed' ? 'View result' : 'Open match')
        : 'Created after prior round';
    return `
        <${tag} class="tv-playoff-match ${statusClass} ${finalClass}" ${attrs}>
            <div class="tv-playoff-match-top ${label ? '' : 'status-only'}">
                ${label ? `<span>${escapeHtml(label)}</span>` : ''}
                <em>${escapeHtml(status)}</em>
            </div>
            ${renderPlayoffTeam(home)}
            ${renderPlayoffTeam(away)}
            <div class="tv-playoff-action ${href ? '' : 'muted'}">${escapeHtml(actionLabel)}</div>
        </${tag}>
    `;
}

function renderPlayoffTeam(team) {
    const score = team.score == null ? '' : `<em>${team.score}</em>`;
    return `
        <div class="tv-playoff-team ${team.winner ? 'winner' : ''}">
            <span>${escapeHtml(team.seed)}</span>
            <strong>
                ${escapeHtml(team.name)}
                ${team.meta ? `<small>${escapeHtml(team.meta)}</small>` : ''}
            </strong>
            ${score}
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Render: Snapshot
// ---------------------------------------------------------------------------

function renderSnapshot() {
    if (!els.snapshot) return;
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const scheduled = state.matches.filter(match => match.status !== 'completed').length;
    const fillins = state.players.filter(isFillIn).length;
    const myTeam = state.teams.find(team => state.myTeamIds.has(team.id));
    const sorted = sortTeams(state.teams);
    const myRank = myTeam ? sorted.findIndex(team => team.id === myTeam.id) + 1 : null;
    const nextMatch = [...state.matches]
        .filter(match => match.status !== 'completed')
        .sort((a, b) => (asDate(matchDate(a)) || 0) - (asDate(matchDate(b)) || 0))
        .find(match => state.myTeamIds.has(match.home_team_id) || state.myTeamIds.has(match.away_team_id)) ||
        [...state.matches]
            .filter(match => match.status !== 'completed')
            .sort((a, b) => (asDate(matchDate(a)) || 0) - (asDate(matchDate(b)) || 0))[0];
    const nextHref = nextMatch
        ? `/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${encodeURIComponent(nextMatch.id)}`
        : '/pages/messages-vnext.html';
    const nextLabel = nextMatch
        ? `${nextMatch.home_team_name || 'Home'} vs ${nextMatch.away_team_name || 'Away'}`
        : 'No scheduled match found';

    els.snapshot.innerHTML = `
        <div class="tv-now-main">
            <p class="tv-kicker">League snapshot</p>
            <h2 class="tv-now-title">2026 Triples League</h2>
            <div class="tv-now-meta">
                <span class="tv-pill hot">Top 6 playoffs</span>
                ${myTeam ? `<span class="tv-pill green">Your team: ${escapeHtml(teamName(myTeam))}</span>` : '<span class="tv-pill">Public preview</span>'}
                ${myRank ? `<span class="tv-pill">Rank #${myRank}</span>` : ''}
                <span class="tv-pill">${completed} completed</span>
                <span class="tv-pill">${scheduled} remaining</span>
            </div>
        </div>
        <a class="tv-next-match" href="${escapeHtml(nextHref)}">
            <span>${escapeHtml(nextMatch ? `Week ${nextMatch.week || nextMatch.match_week || '?'}` : 'Chat')}</span>
            <strong>${escapeHtml(nextLabel)}</strong>
            <em>${escapeHtml(nextMatch ? formatDate(matchDate(nextMatch)) : 'Open league chat')}</em>
        </a>
        <div class="tv-now-stats">
            <div class="tv-now-stat"><span>Teams</span><strong>${state.teams.length}</strong></div>
            <div class="tv-now-stat"><span>Players</span><strong>${state.players.filter(p => !isFillIn(p)).length}</strong></div>
            <div class="tv-now-stat"><span>Fill-ins</span><strong>${fillins}</strong></div>
        </div>
        <div class="tv-now-links">
            <button type="button" data-view-jump="fillins">Fill-in list</button>
            <button type="button" data-view-jump="chat">League talk</button>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Render: Standings (regular season, derived from match results)
// ---------------------------------------------------------------------------

function renderStandings() {
    const sorted = buildRegularSeasonStandings();
    els.standings.innerHTML = `
        <div class="tv-standing-row head">
            <span>#</span><strong>Team</strong><span>W-L</span><span>Pts</span><span>G%</span>
        </div>
        ${sorted.map((team, index) => {
            const wins = Number(team.wins || 0);
            const losses = Number(team.losses || 0);
            const points = Number(team.points ?? team.games_won ?? team.set_wins ?? 0);
            const gamesWon = Number(team.games_won ?? team.set_wins ?? points);
            const gamesLost = Number(team.games_lost ?? team.set_losses ?? 0);
            const pct = gamesWon + gamesLost ? `${Math.round((gamesWon / (gamesWon + gamesLost)) * 100)}%` : '-';
            return `
                <div class="tv-standing-row ${index < 6 ? 'playoff' : ''} ${state.myTeamIds.has(team.id) ? 'mine' : ''}">
                    <span>${index + 1}</span>
                    <strong>${escapeHtml(teamName(team))}</strong>
                    <span>${wins}-${losses}</span>
                    <span class="points">${points}</span>
                    <span>${pct}</span>
                </div>
            `;
        }).join('')}
    `;
}

// ---------------------------------------------------------------------------
// Render: Schedule
// ---------------------------------------------------------------------------

function matchDate(match) {
    return match.match_date || match.date || match.scheduled_date;
}

function renderWeekStrip() {
    const weeks = [...new Set(state.matches.map(match => Number(match.week || match.match_week)).filter(Boolean))].sort((a, b) => a - b);
    if (!state.activeWeek) {
        const firstUpcoming = state.matches
            .filter(match => match.status !== 'completed')
            .map(match => Number(match.week || match.match_week))
            .filter(Boolean)
            .sort((a, b) => a - b)[0];
        state.activeWeek = firstUpcoming || weeks.at(-1) || weeks[0] || 1;
    }
    els.weekStrip.innerHTML = weeks.map(week => {
        const weekMatch = state.matches
            .filter(match => Number(match.week || match.match_week) === week)
            .map(match => ({ match, date: asDate(matchDate(match)) }))
            .filter(row => row.date)
            .sort((a, b) => a.date - b.date)[0];
        const dateText = weekMatch?.date ? weekMatch.date.toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '';
        return `
            <button type="button" class="${week === state.activeWeek ? 'active' : ''}" data-week="${week}">
                <strong>W${week}</strong>
                ${dateText ? `<span>${escapeHtml(dateText)}</span>` : ''}
            </button>
        `;
    }).join('');
}

function renderSchedule() {
    renderWeekStrip();
    const weekMatches = state.matches
        .filter(match => Number(match.week || match.match_week) === state.activeWeek)
        .sort((a, b) => teamName(a.home_team_name).localeCompare(teamName(b.home_team_name)));

    if (!weekMatches.length) {
        els.schedule.innerHTML = '<div class="tv-empty">No matches found for this week.</div>';
        return;
    }

    els.schedule.innerHTML = weekMatches.map(match => {
        const isFinal = match.status === 'completed';
        const score = isFinal ? `${Number(match.home_score || 0)}-${Number(match.away_score || 0)}` : 'vs';
        return `
            <a class="tv-match-row" href="/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${escapeHtml(match.id)}">
                <span class="week">Week ${escapeHtml(match.week || match.match_week || '?')}</span>
                <span>
                    <strong>${escapeHtml(match.home_team_name || 'Home')} vs ${escapeHtml(match.away_team_name || 'Away')}</strong>
                    <span class="tv-muted">${escapeHtml(formatDate(matchDate(match)))} - ${escapeHtml(isFinal ? 'Final' : 'Scheduled')}</span>
                </span>
                <span class="score">${escapeHtml(score)}</span>
            </a>
        `;
    }).join('');
}

// ---------------------------------------------------------------------------
// Render: Stats (full interactive leaderboard system)
// ---------------------------------------------------------------------------

function getStatCategory() {
    return STATS_CATEGORIES[statsView.category] || STATS_CATEGORIES.performance;
}

function getStatGame() {
    const category = getStatCategory();
    if (!category.games[statsView.game]) statsView.game = Object.keys(category.games)[0];
    return category.games[statsView.game];
}

function getStatPage() {
    const game = getStatGame();
    if (statsView.page >= game.pages.length) statsView.page = 0;
    return game.pages[statsView.page] || game.pages[0];
}

function percent(wins, total) {
    return total > 0 ? (Number(wins || 0) / total) * 100 : 0;
}

function firstFinite(...values) {
    for (const value of values) {
        const num = finite(value);
        if (num != null) return num;
    }
    return null;
}

function playerStatRow(player) {
    const s = state.statsById[player.id] || {};
    const x01Legs = Number(s.x01_legs_played || 0);
    const cricketLegs = Number(s.cricket_legs_played || 0);
    const x01Darts = Number(s.x01_total_darts || 0);
    const x01Points = Number(s.x01_total_points || 0);
    const cricketRounds = Number(s.cricket_total_rounds || 0);
    const cricketMarks = Number(s.cricket_total_marks || 0);
    const checkoutHits = firstFinite(s.x01_checkouts_hit, s.x01_checkouts) || 0;
    const checkoutAttempts = firstFinite(s.x01_checkout_attempts, s.x01_checkout_opps) || 0;
    const checkoutTotal = firstFinite(s.x01_total_checkout_points, s.x01_checkout_totals) || 0;
    const avgCheckout = firstFinite(s.x01_avg_checkout, s.x01_avg_finish, s.avg_finish) ??
        (checkoutHits > 0 ? checkoutTotal / checkoutHits : 0);
    const threeDa = firstFinite(s.x01_three_dart_avg, s.avg_3da, player.x01_three_dart_avg, player.avg_3da) ??
        (x01Darts > 0 ? (x01Points / x01Darts) * 3 : 0);
    const mpr = firstFinite(s.cricket_mpr, s.mpr, player.cricket_mpr, player.mpr) ??
        (cricketRounds > 0 ? cricketMarks / cricketRounds : 0);
    const x01Wins = Number(s.x01_legs_won || 0);
    const cricketWins = Number(s.cricket_legs_won || 0);
    const x01WithLegs = Number(s.x01_legs_with_darts || 0);
    const x01AgainstLegs = Number(s.x01_legs_against_darts || 0);
    const cricketWithLegs = Number(s.cricket_legs_with_darts || 0);
    const cricketAgainstLegs = Number(s.cricket_legs_against_darts || 0);

    return {
        id: player.id,
        name: player.name || 'Player',
        teamId: player.team_id,
        teamName: teamName(teamById(player.team_id) || player.team_name || ''),
        level: playerLevel(player),
        fillIn: isFillIn(player),
        threeDa,
        first9: Number(s.x01_first9_darts || 0) > 0 ? (Number(s.x01_first9_points || 0) / Number(s.x01_first9_darts)) * 3 : 0,
        x01Legs,
        x01Wins,
        x01WinPct: percent(x01Wins, x01Legs),
        tons: Number(s.x01_tons || 0),
        ton00: Number(s.x01_ton_00 || 0),
        ton20: Number(s.x01_ton_20 || 0),
        ton40: Number(s.x01_ton_40 || 0),
        ton60: Number(s.x01_ton_60 || 0),
        ton80: Number(s.x01_ton_80 || 0),
        ton40Plus: Number(s.x01_ton_40 || 0) + Number(s.x01_ton_60 || 0) + Number(s.x01_ton_80 || 0),
        highScore: Number(s.x01_high_score || 0),
        bestLeg: Number(s.x01_best_leg || 0) > 0 && Number(s.x01_best_leg) < 900 ? Number(s.x01_best_leg) : 0,
        checkoutPct: percent(checkoutHits, checkoutAttempts),
        highCheckout: Number(s.x01_high_checkout || 0),
        avgCheckout,
        checkoutHits,
        checkoutAttempts,
        co80Pct: percent(s.x01_co_80_hits, Number(s.x01_co_80_attempts || 0)),
        co80Made: Number(s.x01_co_80_hits || 0),
        co120Pct: percent(s.x01_co_120_hits, Number(s.x01_co_120_attempts || 0)),
        co120Made: Number(s.x01_co_120_hits || 0),
        co140Pct: percent(s.x01_co_140_hits, Number(s.x01_co_140_attempts || 0)),
        co140Made: Number(s.x01_co_140_hits || 0),
        co161Pct: percent(s.x01_co_161_hits, Number(s.x01_co_161_attempts || 0)),
        co161Made: Number(s.x01_co_161_hits || 0),
        x01WithDartsPct: percent(s.x01_legs_with_darts_won, x01WithLegs),
        x01WithDartsLegs: x01WithLegs,
        x01AgainstDartsPct: percent(s.x01_legs_against_darts_won, x01AgainstLegs),
        x01AgainstDartsLegs: x01AgainstLegs,
        mpr,
        cricketLegs,
        cricketWins,
        cricketWinPct: percent(cricketWins, cricketLegs),
        // HRnd = best marks in a round. League recalc writes this as `cricket_high_marks`
        // (kept `cricket_high_mark_round` as a fallback for import-pipeline-sourced data).
        highMark: Number(s.cricket_high_marks ?? s.cricket_high_mark_round ?? 0),
        mark9: Number(s.cricket_nine_mark_rounds || 0),
        mark8: Number(s.cricket_eight_mark_rounds || 0),
        mark7: Number(s.cricket_seven_mark_rounds || 0),
        mark6: Number(s.cricket_six_mark_rounds || 0),
        mark5: Number(s.cricket_five_mark_rounds || 0),
        mark5plus: Number(s.cricket_5m_plus ?? s.cricket_five_mark_rounds ?? 0),
        hatTricks: Number(s.cricket_hat_tricks || 0),
        cricketWithDartsPct: percent(s.cricket_legs_with_darts_won, cricketWithLegs),
        cricketWithDartsLegs: cricketWithLegs,
        cricketAgainstDartsPct: percent(s.cricket_legs_against_darts_won, cricketAgainstLegs),
        cricketAgainstDartsLegs: cricketAgainstLegs,
        totalLegs: x01Legs + cricketLegs,
        totalWins: x01Wins + cricketWins,
        totalWinPct: percent(x01Wins + cricketWins, x01Legs + cricketLegs),
        withDartsPct: percent(Number(s.x01_legs_with_darts_won || 0) + Number(s.cricket_legs_with_darts_won || 0), x01WithLegs + cricketWithLegs),
        againstDartsPct: percent(Number(s.x01_legs_against_darts_won || 0) + Number(s.cricket_legs_against_darts_won || 0), x01AgainstLegs + cricketAgainstLegs)
    };
}

function formatStat(key, value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num === 0) return '-';
    if (key.includes('Pct')) return `${num.toFixed(1)}%`;
    if (['threeDa', 'first9', 'avgCheckout'].includes(key)) return num.toFixed(1);
    if (key === 'mpr') return num.toFixed(2);
    return String(Math.round(num));
}

function currentStatsRows() {
    let rows = state.players.filter(player => !isFillIn(player)).map(playerStatRow);
    if (statsView.level) rows = rows.filter(row => row.level === statsView.level);
    const page = getStatPage();
    const sortKey = statsView.sort || page.sort || page.columns[0].key;
    rows.sort((a, b) => {
        const diff = Number(b[sortKey] || 0) - Number(a[sortKey] || 0);
        return statsView.direction === 'asc' ? -diff : diff;
    });
    return rows;
}

function renderStats() {
    if (!els.stats) return;
    const category = getStatCategory();
    const game = getStatGame();
    const page = getStatPage();
    if (!statsView.sort) statsView.sort = page.sort || page.columns[0].key;
    const gameKeys = Object.keys(category.games);
    const controls = `
        <div class="tv-stats-controls">
            <div class="tv-stats-toggle" role="group" aria-label="Stats view">
                <button type="button" class="${statsView.mode === 'players' ? 'active' : ''}" data-stats-mode="players">Players</button>
                <button type="button" class="${statsView.mode === 'teams' ? 'active' : ''}" data-stats-mode="teams">Teams</button>
            </div>
            <div class="tv-stats-toggle compact" role="group" aria-label="Level filter">
                ${['', 'A', 'B', 'C'].map(level => `
                    <button type="button" class="${statsView.level === level ? 'active' : ''}" data-stats-level="${level}">${level || 'All'}</button>
                `).join('')}
            </div>
        </div>
        <div class="tv-stats-category-tabs">
            ${Object.entries(STATS_CATEGORIES).map(([key, item]) => `
                <button type="button" class="${statsView.category === key ? 'active' : ''}" data-stats-category="${key}">${escapeHtml(item.label)}</button>
            `).join('')}
        </div>
        ${gameKeys.length > 1 ? `<div class="tv-stats-subtabs">
            ${gameKeys.map(key => `
                <button type="button" class="${statsView.game === key ? 'active' : ''}" data-stats-game="${key}">${escapeHtml(category.games[key].label)}</button>
            `).join('')}
        </div>` : ''}
        <div class="tv-stats-page-nav">
            <button type="button" data-stats-page-delta="-1" ${statsView.page === 0 ? 'disabled' : ''}>Prev</button>
            <strong>${escapeHtml(page.label)}</strong>
            <button type="button" data-stats-page-delta="1" ${statsView.page >= game.pages.length - 1 ? 'disabled' : ''}>Next</button>
        </div>
    `;
    const table = statsView.mode === 'teams' ? renderStatsTeamTable(page) : renderStatsPlayerTable(page);
    els.stats.innerHTML = controls + table;
}

function renderStatsPlayerTable(page) {
    const rows = currentStatsRows();
    if (!rows.length) return '<div class="tv-empty">No stats found for that filter.</div>';
    const grouped = statsView.level ? [[statsView.level, rows]] : ['A', 'B', 'C'].map(level => [level, rows.filter(row => row.level === level)]);
    return `
        <div class="tv-stats-table-wrap">
            <table class="tv-stats-table">
                <thead>${renderStatsHeader(page, 'Player')}</thead>
                <tbody>
                    ${grouped.map(([level, levelRows]) => {
                        if (!levelRows.length) return '';
                        return `
                            ${!statsView.level ? `<tr><td colspan="${page.columns.length + 2}" class="tv-stats-level-row">${level} Level (${levelRows.length})</td></tr>` : ''}
                            ${levelRows.map((row, index) => renderStatsPlayerRow(row, index, page)).join('')}
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderStatsHeader(page, label) {
    return `<tr>
        <th class="rank">#</th>
        <th>${escapeHtml(label)}</th>
        ${page.columns.map(column => `
            <th class="${column.hideMobile ? 'hide-mobile' : ''} ${statsView.sort === column.key ? `sort-${statsView.direction}` : ''}" data-stats-sort="${column.key}">
                ${escapeHtml(column.label)}
            </th>
        `).join('')}
    </tr>`;
}

function renderStatsPlayerRow(row, index, page) {
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    return `<tr>
        <td class="rank ${rankClass}">${index + 1}</td>
        <td>
            <a class="tv-stats-name" href="/pages/player-profile-vnext.html?player_id=${escapeHtml(row.id)}&league_id=${LEAGUE_ID}">
                <span>${escapeHtml(row.level)}</span>
                <strong>${escapeHtml(row.name)}</strong>
                <em>${escapeHtml(row.teamName || '')}</em>
            </a>
        </td>
        ${page.columns.map(column => `<td class="${column.primary ? 'primary' : ''} ${column.hideMobile ? 'hide-mobile' : ''}">${escapeHtml(formatStat(column.key, row[column.key]))}</td>`).join('')}
    </tr>`;
}

function renderStatsTeamTable(page) {
    const playerRows = currentStatsRows();
    const rows = sortTeams(state.teams).map(team => {
        const teamPlayers = playerRows.filter(row => row.teamId === team.id);
        const teamRow = { id: team.id, name: teamName(team), players: teamPlayers };
        page.columns.forEach(column => {
            const values = teamPlayers.map(row => Number(row[column.key] || 0)).filter(value => value > 0);
            teamRow[column.key] = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        });
        return teamRow;
    }).filter(row => row.players.length);
    const sortKey = statsView.sort || page.sort || page.columns[0].key;
    rows.sort((a, b) => {
        const diff = Number(b[sortKey] || 0) - Number(a[sortKey] || 0);
        return statsView.direction === 'asc' ? -diff : diff;
    });
    if (!rows.length) return '<div class="tv-empty">No team stats found for that filter.</div>';
    return `
        <div class="tv-stats-table-wrap">
            <table class="tv-stats-table">
                <thead>${renderStatsHeader(page, 'Team')}</thead>
                <tbody>
                    ${rows.map((row, index) => renderStatsTeamRow(row, index, page)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderStatsTeamRow(row, index, page) {
    const expanded = statsView.expandedTeams.has(row.id);
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    const teamLine = `<tr class="tv-stats-team-row ${expanded ? 'expanded' : ''}" data-stats-team="${escapeHtml(row.id)}">
        <td class="rank ${rankClass}">${index + 1}</td>
        <td><span class="tv-team-expand">${expanded ? 'v' : '>'}</span><strong>${escapeHtml(row.name)}</strong></td>
        ${page.columns.map(column => `<td class="${column.primary ? 'primary' : ''} ${column.hideMobile ? 'hide-mobile' : ''}">${escapeHtml(formatStat(column.key, row[column.key]))}</td>`).join('')}
    </tr>`;
    const playerLines = row.players.map(player => `<tr class="tv-stats-player-subrow ${expanded ? '' : 'hidden'}">
        <td></td>
        <td><a class="tv-stats-name" href="/pages/player-profile-vnext.html?player_id=${escapeHtml(player.id)}&league_id=${LEAGUE_ID}"><span>${escapeHtml(player.level)}</span><strong>${escapeHtml(player.name)}</strong></a></td>
        ${page.columns.map(column => `<td class="${column.hideMobile ? 'hide-mobile' : ''}">${escapeHtml(formatStat(column.key, player[column.key]))}</td>`).join('')}
    </tr>`).join('');
    return teamLine + playerLines;
}

// ---------------------------------------------------------------------------
// Render: simple leaders (shown in stats pane header)
// ---------------------------------------------------------------------------

function renderLeaders() {
    const rosterPlayers = state.players.filter(player => !isFillIn(player));
    const x01 = rosterPlayers
        .map(player => ({ player, value: rawStat(player, 'x01_three_dart_avg', 'avg_3da') }))
        .filter(row => row.value != null && row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
    const cricket = rosterPlayers
        .map(player => ({ player, value: rawStat(player, 'cricket_mpr', 'mpr') }))
        .filter(row => row.value != null && row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

    if (els.x01) els.x01.innerHTML = renderLeaderRows(x01, 1);
    if (els.cricket) els.cricket.innerHTML = renderLeaderRows(cricket, 2);
}

function renderLeaderRows(rows, decimals) {
    if (!rows.length) return '<div class="tv-empty">No stats yet.</div>';
    return rows.map((row, index) => `
        <a class="tv-leader-row" href="/pages/player-profile-vnext.html?player_id=${escapeHtml(row.player.id)}&league_id=${LEAGUE_ID}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(row.player.name || 'Player')}</strong>
            <em>${row.value.toFixed(decimals)}</em>
        </a>
    `).join('');
}

// ---------------------------------------------------------------------------
// Render: Teams
// ---------------------------------------------------------------------------

function renderTeams() {
    const playersByTeam = new Map();
    state.players.filter(player => !isFillIn(player)).forEach(player => {
        if (!player.team_id) return;
        if (!playersByTeam.has(player.team_id)) playersByTeam.set(player.team_id, []);
        playersByTeam.get(player.team_id).push(player);
    });

    els.teams.innerHTML = sortTeams(state.teams).map(team => {
        const roster = (playersByTeam.get(team.id) || []).sort(sortPlayersByLevel);
        return `
            <article class="tv-team-card">
                <header>
                    <h3>${escapeHtml(teamName(team))}</h3>
                    <a class="tv-pill" href="/pages/league-team-vnext.html?league_id=${LEAGUE_ID}&team_id=${escapeHtml(team.id)}">Team page</a>
                </header>
                <div class="tv-roster-list">
                    ${roster.map(player => `
                        <span>
                            <strong>${escapeHtml(player.name || 'Player')}</strong>
                            <em class="tv-level-badge ${escapeHtml(playerLevel(player))}">${escapeHtml(playerLevel(player))}</em>
                        </span>
                    `).join('') || '<span>No roster attached.</span>'}
                </div>
            </article>
        `;
    }).join('');
}

// ---------------------------------------------------------------------------
// Render: Fill-ins (enhanced with group headers and avg stats)
// ---------------------------------------------------------------------------

function renderFillins() {
    const fillins = state.players.filter(isFillIn).sort((a, b) => {
        const levelCompare = String(playerLevel(a)).localeCompare(String(playerLevel(b)));
        if (levelCompare) return levelCompare;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
    els.fillinCount.textContent = `${fillins.length} available`;
    const groups = ['A', 'B', 'C', 'F'];
    els.fillins.innerHTML = groups.map(level => {
        const rows = fillins.filter(player => String(playerLevel(player) || 'F').toUpperCase() === level);
        if (!rows.length) return '';
        const avg3da = rows
            .map(player => rawStat(player, 'x01_three_dart_avg', 'avg_3da'))
            .filter(value => value != null && value > 0);
        const avgMpr = rows
            .map(player => rawStat(player, 'cricket_mpr', 'mpr'))
            .filter(value => value != null && value > 0);
        const group3da = avg3da.length ? (avg3da.reduce((sum, value) => sum + value, 0) / avg3da.length).toFixed(1) : '-';
        const groupMpr = avgMpr.length ? (avgMpr.reduce((sum, value) => sum + value, 0) / avgMpr.length).toFixed(2) : '-';
        return `
            <section class="tv-fillin-level">
                <header>
                    <div>
                        <span class="tv-level-badge ${escapeHtml(level)}">${escapeHtml(level)}</span>
                        <h3>${level} fill-ins</h3>
                    </div>
                    <em>${rows.length} listed · ${group3da} 3DA / ${groupMpr} MPR</em>
                </header>
                <div class="tv-fillin-list">
                ${rows.map(player => `
                    <a class="tv-fillin-row" href="/pages/player-profile-vnext.html?player_id=${escapeHtml(player.id)}&league_id=${LEAGUE_ID}">
                        <strong>${escapeHtml(player.name || 'Fill-in')}</strong>
                        <span>
                            <em>${escapeHtml(statValue(player, 'x01_three_dart_avg', 'avg_3da', 1))} 3DA</em>
                            <em>${escapeHtml(statValue(player, 'cricket_mpr', 'mpr', 2))} MPR</em>
                        </span>
                        <small>Profile</small>
                    </a>
                `).join('')}
                </div>
            </section>
        `;
    }).join('') || '<div class="tv-empty">No fill-ins listed.</div>';
}

// ---------------------------------------------------------------------------
// Render: Manage (director-only)
// ---------------------------------------------------------------------------

function renderManage() {
    if (!els.manage || !state.isDirector) return;
    const completed = state.matches.filter(match => match.status === 'completed').length;
    const openMatches = state.matches
        .filter(match => match.status !== 'completed')
        .sort((a, b) => {
            const playoffSort = Number(isPlayoffMatch(b)) - Number(isPlayoffMatch(a));
            if (playoffSort) return playoffSort;
            const aDate = asDate(matchDate(a));
            const bDate = asDate(matchDate(b));
            if (aDate && bDate) return aDate - bDate;
            return Number(a.week || 0) - Number(b.week || 0);
        });
    const fillins = state.players.filter(isFillIn).length;
    const leaguePlayers = state.players.filter(player => !isFillIn(player)).length;
    const playoffOpen = state.matches.filter(isPlayoffMatch).filter(match => match.status !== 'completed').length;
    const nextMatches = openMatches.slice(0, 4);
    const matchRows = nextMatches.map(match => `
        <a class="tv-manage-row ${isPlayoffMatch(match) ? 'is-hot' : ''}" href="/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${encodeURIComponent(match.id)}">
            <span>${escapeHtml(isPlayoffMatch(match) ? 'Playoff' : `Week ${match.week || match.match_week || '?'}`)}</span>
            <strong>${escapeHtml(match.home_team_name || 'Home')} vs ${escapeHtml(match.away_team_name || 'Away')}</strong>
            <em>${escapeHtml(formatDate(matchDate(match)))}</em>
        </a>
    `).join('') || '<div class="tv-empty compact">No open matches need league action.</div>';

    els.manage.innerHTML = `
        <section class="tv-manage-panel tv-manage-tonight">
            <div class="tv-manage-head">
                <div>
                    <p class="tv-kicker">Tonight</p>
                    <h3>League Operations</h3>
                </div>
                <span>${completed}/${state.matches.length} match nights final</span>
            </div>
            <div class="tv-manage-metrics">
                <span><strong>${openMatches.length}</strong> open matches</span>
                <span><strong>${playoffOpen}</strong> playoff matches</span>
                <span><strong>${state.teams.length}</strong> teams</span>
                <span><strong>${leaguePlayers}</strong> players</span>
                <span><strong>${fillins}</strong> fill-ins</span>
            </div>
            <div class="tv-manage-subhead">
                <strong>Needs attention</strong>
                <em>Open a match hub to run the night, launch scorers, or review context.</em>
            </div>
            <div class="tv-manage-list">${matchRows}</div>
        </section>

        <button class="tv-manage-panel tv-manage-action as-button" type="button" data-view-jump="teams">
            <p class="tv-kicker">Players</p>
            <h3>Teams & Rosters</h3>
            <p>Review team pages, player profiles, captain context, and roster balance.</p>
            <span>View teams</span>
        </button>

        <button class="tv-manage-panel tv-manage-action as-button" type="button" data-view-jump="fillins">
            <p class="tv-kicker">Players</p>
            <h3>Fill-ins</h3>
            <p>Check available fill-ins before match night substitutions or captain requests.</p>
            <span>View fill-ins</span>
        </button>
    `;
}

// ---------------------------------------------------------------------------
// Fill-in signup modal
// ---------------------------------------------------------------------------

function openFillinSignupModal() {
    const player = state.currentPlayer || {};
    document.getElementById('fillinName').value = player.name || '';
    document.getElementById('fillinEmail').value = player.email || auth.currentUser?.email || '';
    document.getElementById('fillinPhone').value = player.phone || '';
    document.getElementById('fillinLevel').value = ['A', 'B', 'C'].includes(String(player.preferred_level || player.skill_level || player.level || '').toUpperCase())
        ? String(player.preferred_level || player.skill_level || player.level).toUpperCase()
        : '';
    document.getElementById('fillin501').value = player.avg_501 || player.x01_three_dart_avg || '';
    document.getElementById('fillinCricket').value = player.avg_cricket || player.cricket_mpr || '';
    els.fillinSignupStatus.textContent = '';
    els.fillinSignupStatus.className = 'tv-modal-status';
    els.fillinSignupModal.classList.add('active');
    els.fillinSignupModal.setAttribute('aria-hidden', 'false');
}

function closeFillinSignupModal() {
    els.fillinSignupModal.classList.remove('active');
    els.fillinSignupModal.setAttribute('aria-hidden', 'true');
}

function setFillinStatus(message, type = '') {
    els.fillinSignupStatus.textContent = message;
    els.fillinSignupStatus.className = `tv-modal-status ${type}`.trim();
}

async function submitFillinSignup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    els.submitFillinSignupBtn.disabled = true;
    setFillinStatus('Signing up...');
    try {
        const formData = new FormData(form);
        let photoUrl = '';
        if (state.selectedFillinPhoto) {
            setFillinStatus('Uploading photo...');
            photoUrl = await uploadImage(state.selectedFillinPhoto, 'players');
        }
        const result = await callFunction('registerFillin', {
            league_id: LEAGUE_ID,
            full_name: String(formData.get('full_name') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            phone: String(formData.get('phone') || '').trim(),
            preferred_level: String(formData.get('preferred_level') || ''),
            avg_501: String(formData.get('avg_501') || ''),
            avg_cricket: String(formData.get('avg_cricket') || ''),
            sms_opt_in: formData.get('sms_opt_in') === 'on',
            photo_url: photoUrl,
            create_member: true,
            send_welcome_sms: false
        });
        if (!result?.success) throw new Error(result?.error || 'Fill-in signup failed');
        setFillinStatus('You are on the fill-in list.', 'success');
        state.selectedFillinPhoto = null;
        form.reset();
        await loadLeague();
        renderAll();
    } catch (error) {
        setFillinStatus(error.message || 'Fill-in signup failed.', 'error');
    } finally {
        els.submitFillinSignupBtn.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Tab / interaction initialization
// ---------------------------------------------------------------------------

function initViewTabs() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.viewTarget;
            if (!activateView(target)) return;
            history.replaceState(null, '', `#${target}`);
        });
    });

    document.querySelectorAll('[data-standings-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.standingsTarget;
            activateStandingsView(target);
            history.replaceState(null, '', target === 'regular' ? '#regular-season' : '#standings');
        });
    });

    // Stats controls and view-jump buttons via event delegation
    document.addEventListener('click', event => {
        const statsButton = event.target.closest('[data-stats-mode], [data-stats-level], [data-stats-category], [data-stats-game], [data-stats-page-delta], [data-stats-sort], [data-stats-team]');
        if (statsButton) {
            if (statsButton.dataset.statsMode) {
                statsView.mode = statsButton.dataset.statsMode;
                statsView.expandedTeams.clear();
            } else if ('statsLevel' in statsButton.dataset) {
                statsView.level = statsButton.dataset.statsLevel || '';
                statsView.expandedTeams.clear();
            } else if (statsButton.dataset.statsCategory) {
                statsView.category = statsButton.dataset.statsCategory;
                statsView.game = Object.keys(getStatCategory().games)[0];
                statsView.page = 0;
                statsView.sort = '';
                statsView.expandedTeams.clear();
            } else if (statsButton.dataset.statsGame) {
                statsView.game = statsButton.dataset.statsGame;
                statsView.page = 0;
                statsView.sort = '';
                statsView.expandedTeams.clear();
            } else if (statsButton.dataset.statsPageDelta) {
                const game = getStatGame();
                const nextPage = statsView.page + Number(statsButton.dataset.statsPageDelta);
                statsView.page = Math.max(0, Math.min(game.pages.length - 1, nextPage));
                statsView.sort = '';
            } else if (statsButton.dataset.statsSort) {
                const key = statsButton.dataset.statsSort;
                if (statsView.sort === key) {
                    statsView.direction = statsView.direction === 'desc' ? 'asc' : 'desc';
                } else {
                    statsView.sort = key;
                    statsView.direction = 'desc';
                }
            } else if (statsButton.dataset.statsTeam) {
                const teamId = statsButton.dataset.statsTeam;
                if (statsView.expandedTeams.has(teamId)) statsView.expandedTeams.delete(teamId);
                else statsView.expandedTeams.add(teamId);
            }
            renderStats();
            return;
        }

        const jumpButton = event.target.closest('[data-view-jump]');
        if (!jumpButton) return;
        const target = jumpButton.dataset.viewJump;
        if (!document.querySelector(`[data-view-pane="${CSS.escape(target)}"]`)) return;
        event.preventDefault();
        activateView(target);
        history.replaceState(null, '', `#${target}`);
        document.querySelector('[data-view-card="league"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Hash-based initial tab
    const hashTarget = String(location.hash || '').replace('#', '');
    if (hashTarget === 'playoffs') {
        activateView('standings');
        activateStandingsView('playoffs');
    } else if (hashTarget === 'regular' || hashTarget === 'regular-season') {
        activateView('standings');
        activateStandingsView('regular');
    } else if (hashTarget && document.querySelector(`[data-view-pane="${CSS.escape(hashTarget)}"]`)) {
        activateView(hashTarget);
    } else {
        activateView('standings');
        activateStandingsView('playoffs');
    }

    els.weekStrip.addEventListener('click', event => {
        const button = event.target.closest('[data-week]');
        if (!button) return;
        state.activeWeek = Number(button.dataset.week);
        renderSchedule();
    });

    document.getElementById('openFillinSignupBtn')?.addEventListener('click', openFillinSignupModal);
    document.getElementById('closeFillinSignupBtn')?.addEventListener('click', closeFillinSignupModal);
    document.getElementById('fillinPhoto')?.addEventListener('change', event => {
        state.selectedFillinPhoto = event.target.files?.[0] || null;
    });
    els.fillinSignupForm?.addEventListener('submit', submitFillinSignup);
    els.fillinSignupModal?.addEventListener('click', event => {
        if (event.target === els.fillinSignupModal) closeFillinSignupModal();
    });
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadSession() {
    await waitForAuthReady(3000);
    if (!auth.currentUser) return;
    try {
        const result = await callFunction('getPlayerSession', {});
        if (result?.success) {
            state.currentPlayer = result.player;
            state.isDirector = hasDirectorRights(result.player);
            updateDirectorVisibility();
        }
    } catch (error) {
        state.currentPlayer = null;
        state.isDirector = false;
        updateDirectorVisibility();
    }
}

async function fetchLeagueSnapshot() {
    const [leagueDoc, playoffDoc, teamsSnap, matchesSnap, playersSnap, statsSnap, feedSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', LEAGUE_ID)).catch(() => null),
        getDoc(doc(db, 'leagues', LEAGUE_ID, 'playoffs', 'current')).catch(() => null),
        getDocs(collection(db, 'leagues', LEAGUE_ID, 'teams')),
        getDocs(collection(db, 'leagues', LEAGUE_ID, 'matches')),
        getDocs(collection(db, 'leagues', LEAGUE_ID, 'players')),
        getDocs(collection(db, 'leagues', LEAGUE_ID, 'stats')).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'leagues', LEAGUE_ID, 'feed'), orderBy('created_at', 'desc'), limit(1))).catch(() => ({ docs: [] }))
    ]);

    return {
        league: leagueDoc?.exists?.() ? { id: leagueDoc.id, ...leagueDoc.data() } : null,
        playoff: playoffDoc?.exists?.() ? { id: playoffDoc.id, ...playoffDoc.data() } : null,
        teams: teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        matches: matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        players: playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        statsById: Object.fromEntries(statsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])),
        latestFeed: feedSnap.docs[0]?.data() || null
    };
}

function applyLeagueSnapshot(snapshot) {
    state.teams = snapshot?.teams || [];
    state.matches = snapshot?.matches || [];
    state.players = snapshot?.players || [];
    state.statsById = snapshot?.statsById || {};
    state.league = snapshot?.league || null;
    state.playoff = snapshot?.playoff || null;
    state.myTeamIds = getMyTeamIds(state.currentPlayer, state.players);

    const latest = snapshot?.latestFeed;
    if (latest?.title && els.subtitle) {
        els.subtitle.textContent = latest.title;
    }
}

// Slim the snapshot to only what the standings + snapshot header need so the
// persistent localStorage payload stays small (drops the large statsById map).
function slimSnapshotForLocalCache(snapshot) {
    if (!snapshot) return null;
    // Drop only the heavy per-match arrays (throw-by-throw games/throws/lineups) so the
    // cache fits the localStorage quota; keep all scalar match fields standings + the
    // bracket rely on (scores, ids, dates, status, playoff_* fields).
    const slimMatch = (m) => {
        const { games, throws, home_lineup, away_lineup, sets, leg_data, ...rest } = m;
        return rest;
    };
    return {
        league: snapshot.league || null,
        playoff: snapshot.playoff || null,
        teams: snapshot.teams || [],
        matches: (snapshot.matches || []).map(slimMatch),
        players: snapshot.players || [],
        latestFeed: snapshot.latestFeed || null
    };
}

function persistLocalSnapshot(snapshot) {
    writeLocalCache(TRIPLES_LOCAL_SNAPSHOT_KEY, slimSnapshotForLocalCache(snapshot));
}

async function loadLeague() {
    const cached = readCache(TRIPLES_CACHE_KEY, TRIPLES_CACHE_TTL_MS);
    if (cached) {
        applyLeagueSnapshot(cached);
        fetchLeagueSnapshot()
            .then(fresh => {
                writeCache(TRIPLES_CACHE_KEY, fresh);
                persistLocalSnapshot(fresh);
                applyLeagueSnapshot(fresh);
                renderAll();
            })
            .catch(error => console.warn('[triples-vnext] cache refresh failed:', error));
        return;
    }

    const fresh = await fetchLeagueSnapshot();
    writeCache(TRIPLES_CACHE_KEY, fresh);
    persistLocalSnapshot(fresh);
    applyLeagueSnapshot(fresh);
}

// ---------------------------------------------------------------------------
// Master render pass
// ---------------------------------------------------------------------------

function renderAll() {
    updateDirectorVisibility();
    renderSnapshot();
    renderPlayoffs();
    renderStandings();
    renderSchedule();
    renderStats();
    renderLeaders();
    renderTeams();
    renderFillins();
    renderManage();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function init() {
    initViewTabs();

    // ⚡ Optimistic paint: render the above-the-fold standings + snapshot header
    // INSTANTLY from the persistent localStorage cache, before auth resolves and
    // before the cold-start-prone league snapshot fetch returns. Purely additive —
    // the real loadLeague()/renderAll() below still runs and overwrites with fresh
    // data. "mine" highlighting fills in once the session + fresh snapshot land.
    const optimistic = readLocalCache(TRIPLES_LOCAL_SNAPSHOT_KEY);
    if (optimistic) {
        applyLeagueSnapshot(optimistic);
        try {
            renderSnapshot();
            renderStandings();
        } catch (error) {
            console.warn('[triples-vnext] optimistic render failed:', error);
        }
    }

    const leagueLoad = loadLeague()
        .then(renderAll)
        .catch(error => {
            console.error('[triples-vnext] league load failed:', error);
            if (els.playoffs) els.playoffs.innerHTML = '<div class="tv-empty">Could not load 2026 Triples League right now.</div>';
        });
    await loadSession();
    await leagueLoad;
    state.myTeamIds = getMyTeamIds(state.currentPlayer, state.players);
    renderAll();
}

init().catch(error => {
    console.error('[triples-vnext] failed:', error);
    if (els.playoffs) els.playoffs.innerHTML = '<div class="tv-empty">Could not load 2026 Triples League right now.</div>';
});
