import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'rookies-demo-2026-triples';
const matchId = params.get('match_id');

const CANONICAL_TRIPLES_FORMAT = [
    { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'AB', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
        { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
        { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
        { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
    ] },
    { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'C', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
    { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'A', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
    { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'BC', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
        { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
        { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
        { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
    ] },
    { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'B', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
    { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'A', in_rule: 'straight', out_rule: 'double', points: 1 },
    { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'AC', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
        { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
        { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
        { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
    ] },
    { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'B', in_rule: 'straight', out_rule: 'double', points: 1 },
    { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'C', in_rule: 'straight', out_rule: 'double', points: 1 }
];

const els = {
    hero: document.getElementById('matchHero'),
    score: document.getElementById('scoreCard'),
    sets: document.getElementById('setsList'),
    setCount: document.getElementById('setCountBadge'),
    performance: document.getElementById('performanceGrid'),
    rosters: document.getElementById('rosterGrid'),
    context: document.getElementById('contextList'),
    leagueMatchLink: document.getElementById('leagueMatchLink')
};

let state = {
    match: null,
    league: null,
    teamsById: {},
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
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactName(value) {
    const name = String(value || 'Team');
    if (/cleveland pagel co\.?/i.test(name)) return 'Cle Pagel Co.';
    if (/neon nightmares/i.test(name)) return 'Neon Nightmrs';
    return name;
}

function teamName(side) {
    const match = state.match || {};
    const id = match[`${side}_team_id`];
    const team = state.teamsById[id] || {};
    return compactName(team.team_name || team.name || match[`${side}_team_name`] || side);
}

function teamRecord(side) {
    const team = state.teamsById[state.match?.[`${side}_team_id`]] || {};
    const wins = finite(team.wins) ?? 0;
    const losses = finite(team.losses) ?? 0;
    return `${wins}-${losses}`;
}

function sideTeamId(side) {
    return state.match?.[`${side}_team_id`];
}

function oppositeSide(side) {
    return side === 'home' ? 'away' : 'home';
}

function playoffRoundLabel() {
    const match = state.match || {};
    const raw = String(match.playoff_round || match.round_name || match.bracket_round || match.round || '').trim();
    const id = String(match.id || matchId || '').toLowerCase();
    if (/semi|sf|semifinal/.test(raw.toLowerCase()) || /_sf_|semifinal/.test(id)) return 'Semifinals';
    if (/quarter|qf/.test(raw.toLowerCase()) || /_qf_|quarter/.test(id)) return 'Quarterfinals';
    if (/final/.test(raw.toLowerCase()) || /final/.test(id)) return 'Final';
    if (/third|3rd/.test(raw.toLowerCase()) || /third|3rd/.test(id)) return '3rd / 4th';
    return isPlayoffMatch() ? 'Playoffs' : `Week ${match.week || match.week_number || '?'}`;
}

function isPlayoffMatch() {
    const match = state.match || {};
    const type = String(match.match_type || match.type || '').toLowerCase();
    return type === 'playoff' || Boolean(match.playoff_round || match.is_playoff || match.playoff);
}

function setsToWinMatch() {
    const configured = finite(state.match?.sets_to_win)
        ?? finite(state.match?.match_sets_to_win)
        ?? finite(state.league?.playoff_sets_to_win);
    if (configured) return configured;
    const formatLength = getMatchFormatForRender().length || finite(state.league?.games_per_match) || 9;
    return Math.ceil(formatLength / 2);
}

function currentSetScore() {
    const games = state.match?.games || [];
    let home = finite(state.match?.home_score);
    let away = finite(state.match?.away_score);
    if (home == null || away == null) {
        home = 0;
        away = 0;
        games.forEach(game => {
            if (game?.status !== 'completed') return;
            if (game.winner === 'home') home += 1;
            if (game.winner === 'away') away += 1;
        });
    }
    return { home, away };
}

function matchIsDecided() {
    if (state.match?.status === 'completed') return true;
    if (!isPlayoffMatch()) return false;
    const score = currentSetScore();
    return Math.max(score.home, score.away) >= setsToWinMatch();
}

function hasMatchActivity() {
    return (state.match?.games || []).some(game => game?.status === 'completed' || game?.status === 'in_progress');
}

function isPreMatch() {
    return state.match?.status !== 'completed' && !hasMatchActivity();
}

function previousMeetings() {
    const homeId = sideTeamId('home');
    const awayId = sideTeamId('away');
    if (!homeId || !awayId) return [];
    return (state.matches || [])
        .filter(match => match.id !== state.match?.id)
        .filter(match => match.status === 'completed')
        .filter(match => {
            const same = match.home_team_id === homeId && match.away_team_id === awayId;
            const reverse = match.home_team_id === awayId && match.away_team_id === homeId;
            return same || reverse;
        })
        .sort((a, b) => (asDate(b.match_date || b.date || b.scheduled_date)?.getTime() || 0) - (asDate(a.match_date || a.date || a.scheduled_date)?.getTime() || 0));
}

function headToHeadSummary() {
    const meetings = previousMeetings();
    const totals = { homeWins: 0, awayWins: 0, homeSets: 0, awaySets: 0 };
    const homeId = sideTeamId('home');
    meetings.forEach(match => {
        const homeScore = Number(match.home_score || 0);
        const awayScore = Number(match.away_score || 0);
        const currentHomeScore = match.home_team_id === homeId ? homeScore : awayScore;
        const currentAwayScore = match.home_team_id === homeId ? awayScore : homeScore;
        totals.homeSets += currentHomeScore;
        totals.awaySets += currentAwayScore;
        if (currentHomeScore > currentAwayScore) totals.homeWins += 1;
        if (currentAwayScore > currentHomeScore) totals.awayWins += 1;
    });
    if (!meetings.length) return { meetings, label: 'No previous meetings', detail: 'First matchup this season' };
    const leader = totals.homeWins === totals.awayWins
        ? 'Series tied'
        : `${totals.homeWins > totals.awayWins ? teamName('home') : teamName('away')} leads`;
    return {
        meetings,
        label: `${leader} ${Math.max(totals.homeWins, totals.awayWins)}-${Math.min(totals.homeWins, totals.awayWins)}`,
        detail: `${totals.homeSets}-${totals.awaySets} sets across ${meetings.length} meetings`
    };
}

function level(player) {
    const raw = String(player?.skill_level || player?.preferred_level || player?.level || '').toUpperCase();
    const fill = player?.is_fill_in || player?.is_sub || String(player?.team_id || '').toLowerCase().includes('fill');
    if (fill) return 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function sortByLevel(a, b) {
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    const diff = (order[level(a)] ?? 9) - (order[level(b)] ?? 9);
    return diff || String(a?.name || '').localeCompare(String(b?.name || ''));
}

function getGamePlayers(game, side) {
    return (game?.[`${side}_players`] || [])
        .map(player => typeof player === 'string' ? { name: player } : player)
        .filter(player => player?.name);
}

function getRoster(side) {
    const match = state.match || {};
    const playersById = Object.fromEntries(state.players.map(player => [player.id, player]));
    const playersByName = Object.fromEntries(state.players.map(player => [normalizeName(player.name), player]));
    const lineup = match[`${side}_lineup`] || [];
    if (lineup.length) {
        return lineup.map(player => {
            const id = player.player_id || player.id;
            const name = player.player_name || player.name;
            const known = playersById[id] || playersByName[normalizeName(name)] || {};
            return {
                ...known,
                id,
                name,
                is_sub: player.is_sub || known.is_sub || known.is_fill_in,
                level: player.level || player.skill_level || known.level || known.skill_level || known.preferred_level
            };
        }).sort(sortByLevel);
    }

    const teamId = match[`${side}_team_id`];
    const roster = state.players.filter(player => player.team_id === teamId && !player.is_sub && !player.is_fill_in);
    if (roster.length) return roster.sort(sortByLevel);

    const fromGames = new Map();
    (match.games || []).forEach(game => getGamePlayers(game, side).forEach(player => {
        fromGames.set(normalizeName(player.name), player);
    }));
    return [...fromGames.values()].sort(sortByLevel);
}

function getPlayersForLevel(roster, playerLevel) {
    const levelMap = {
        A: [1],
        B: [2],
        C: [3],
        AB: [1, 2],
        AC: [1, 3],
        BC: [2, 3],
        ALL: [1, 2, 3]
    };
    const positions = levelMap[String(playerLevel || '').toUpperCase()] || [1];
    return positions
        .map(position => roster.find(player => Number(player.position || 0) === position))
        .filter(Boolean);
}

function gameTypeDisplay(round = {}) {
    if (round.game_type === 'cricket') return 'Cricket';
    if (round.game_type === 'corks_choice') return "Cork's Choice";
    if (round.game_type === 'mixed' && Array.isArray(round.legs)) {
        const label = round.legs.map(leg => {
            if (leg.game_type === 'cricket') return 'C';
            if (leg.game_type === 'corks_choice') return 'CH';
            return leg.x01_value || leg.game_type || '501';
        }).join('/');
        return round.set_format === 'custom' ? `Custom ${label}` : label;
    }
    if (round.game_type === 'x01') return round.x01_value || '501';
    return round.x01_value || round.game_type || '501';
}

function scorerPage(round = {}) {
    return round.game_type === 'cricket' ? 'league-cricket-vnext.html' : 'x01-scorer-vnext.html';
}

function scorerPlayerPayload(players) {
    return players.map(player => ({
        id: player.id,
        name: player.name || player.player_name || 'Player',
        level: level(player),
        position: player.position || null
    }));
}

function buildScorerUrl(round, index, homePlayers, awayPlayers) {
    const totalGames = getMatchFormatForRender().length || 9;
    const search = new URLSearchParams({
        league_id: leagueId,
        match_id: matchId,
        game_index: String(index),
        game_number: String(index + 1),
        from_match: 'true',
        total_games: String(totalGames),
        home_team_name: teamName('home'),
        away_team_name: teamName('away'),
        return_url: `/rookies/pages/match-hub-vnext.html?league_id=${encodeURIComponent(leagueId)}&match_id=${encodeURIComponent(matchId)}`
    });

    if (homePlayers.length) search.set('home_players', JSON.stringify(scorerPlayerPayload(homePlayers)));
    if (awayPlayers.length) search.set('away_players', JSON.stringify(scorerPlayerPayload(awayPlayers)));

    if (round.game_type === 'cricket') {
        search.set('game_type', 'cricket');
    } else {
        const startScore = round.game_type === 'x01'
            ? (round.x01_value || '501')
            : (Number.parseInt(round.game_type, 10) || round.x01_value || 501);
        search.set('starting_score', String(startScore));
        search.set('format', round.game_type === 'corks_choice' ? 'choice' : String(startScore));
        search.set('game_type', round.game_type === 'corks_choice' ? 'choice' : String(startScore));
        search.set('in_rule', round.in_rule || 'straight');
        search.set('out_rule', round.out_rule || 'double');
        search.set('checkout', round.out_rule || 'double');
    }

    search.set('legs_to_win', String(Math.ceil((Number(round.best_of) || 3) / 2)));
    if (isPlayoffMatch()) search.set('sets_to_win', String(setsToWinMatch()));
    search.set('cork', 'true');
    search.set('cork_rule', state.league?.cork_rule || 'cork_every_leg');
    search.set('cork_option', state.league?.cork_order || state.league?.cork_option || 'home');

    if (round.game_type === 'corks_choice' || round.game_type === 'mixed') {
        search.set('corks_choice', 'true');
        search.set('cork_winner_gets', state.league?.cork_winner_gets || 'choose-and-start');
    }
    if (round.game_type === 'mixed' && Array.isArray(round.legs)) {
        search.set('mixed', 'true');
        search.set('mixed_legs', JSON.stringify(round.legs));
    }

    return `/rookies/pages/${scorerPage(round)}?${search.toString()}`;
}

function isTriplesMatchFormat(format = []) {
    if (!Array.isArray(format) || format.length !== 9) return false;
    const levels = new Set(format.map(round => String(round?.player_level || '').toUpperCase()));
    return levels.has('AB') && levels.has('BC') && levels.has('AC');
}

function getMatchFormatForRender() {
    const format = state.league?.match_format || [];
    const hasRecordedSet = (state.match?.games || []).some(game => game?.status === 'completed' || game?.status === 'in_progress');
    if (!hasRecordedSet && isTriplesMatchFormat(format)) {
        return CANONICAL_TRIPLES_FORMAT;
    }
    return format;
}

function playerStatLine(player) {
    const stats = state.statsById[player.id] || {};
    const avg = finite(stats.x01_three_dart_avg) ?? finite(stats.x01_avg);
    const mpr = finite(stats.cricket_mpr);
    return `${avg == null ? '-' : avg.toFixed(1)} / ${mpr == null ? '-' : mpr.toFixed(2)}`;
}

function playerLeagueStats(player) {
    const stats = state.statsById[player?.id] || {};
    const x01Played = finite(stats.x01_legs_played) ?? finite(stats.x01_games_played) ?? 0;
    const x01Won = finite(stats.x01_legs_won) ?? finite(stats.x01_games_won) ?? 0;
    const cricketPlayed = finite(stats.cricket_legs_played) ?? finite(stats.cricket_games_played) ?? 0;
    const cricketWon = finite(stats.cricket_legs_won) ?? finite(stats.cricket_games_won) ?? 0;
    return {
        threeDa: finite(stats.x01_three_dart_avg) ?? finite(stats.x01_avg),
        mpr: finite(stats.cricket_mpr),
        x01Played,
        x01Won,
        cricketPlayed,
        cricketWon,
        totalPlayed: x01Played + cricketPlayed,
        totalWon: x01Won + cricketWon
    };
}

function leagueStatRow(player) {
    const stats = playerLeagueStats(player);
    const record = stats.totalPlayed ? `${stats.totalWon}-${Math.max(0, stats.totalPlayed - stats.totalWon)}` : '-';
    return `
        <div class="mhv-player-row mhv-player-row-stacked">
            <strong>${escapeHtml(player.name || player.player_name || 'Player')}<span class="mhv-level ${escapeHtml(level(player))}">${escapeHtml(level(player))}</span></strong>
            <em>
                <span>${stat(stats.threeDa, 1)} 3DA</span>
                <span>${stat(stats.mpr, 2)} MPR</span>
                <span>${escapeHtml(record)} legs</span>
            </em>
        </div>
    `;
}

function rosterAverages(side) {
    const roster = getRoster(side);
    const values = roster.reduce((acc, player) => {
        const stats = state.statsById[player.id] || {};
        const avg = finite(stats.x01_three_dart_avg) ?? finite(stats.x01_avg);
        const mpr = finite(stats.cricket_mpr);
        if (avg != null && avg > 0) acc.avg.push(avg);
        if (mpr != null && mpr > 0) acc.mpr.push(mpr);
        return acc;
    }, { avg: [], mpr: [] });
    const average = list => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
    return { threeDa: average(values.avg), mpr: average(values.mpr), rosterCount: roster.length };
}

function formatPlayers(players) {
    return players.map(player => escapeHtml(player.name || player.player_name || 'Player')).join(' / ');
}

function formatPlayerStats(players, reverse = false) {
    return players.map(player => {
        const statLine = escapeHtml(playerStatLine(player));
        const badge = escapeHtml(level(player));
        return reverse ? `${statLine} - ${badge}` : `${badge} - ${statLine}`;
    }).join('<br>');
}

function renderScheduledSet(round, index, gameData) {
    const homeRoster = getRoster('home');
    const awayRoster = getRoster('away');
    const homePlayers = getPlayersForLevel(homeRoster, round.player_level);
    const awayPlayers = getPlayersForLevel(awayRoster, round.player_level);
    const isCompleted = gameData?.status === 'completed';
    const isInProgress = gameData?.status === 'in_progress';
    const decided = matchIsDecided();
    const href = buildScorerUrl(round, index, homePlayers, awayPlayers);
    const homeLegs = finite(gameData?.home_legs_won) ?? 0;
    const awayLegs = finite(gameData?.away_legs_won) ?? 0;
    const action = isCompleted
        ? ''
        : decided
            ? '<span>Match complete</span>'
        : `<a class="mhv-start-set" href="${escapeHtml(href)}">${isInProgress ? 'Resume set' : 'Start set'}</a>`;
    const status = isCompleted ? 'Final' : decided ? 'Not needed' : isInProgress ? 'In progress' : 'Scheduled';
    const label = round.num_players === 2
        ? `${escapeHtml(round.player_level || '')} Doubles`
        : `Singles ${escapeHtml(round.player_level || '')}`;
    const legRows = (gameData?.legs || []).map(leg => {
        const cricket = isCricket(gameData, leg);
        const hs = cricket ? stat(leg.home_stats?.mpr, 2) : stat(leg.home_stats?.three_dart_avg, 1);
        const as = cricket ? stat(leg.away_stats?.mpr, 2) : stat(leg.away_stats?.three_dart_avg, 1);
        return `
            <div class="mhv-leg-row">
                <span>L${escapeHtml(leg.leg_number || '')}</span>
                <span class="${leg.winner === 'home' ? 'winner' : ''}">${escapeHtml(hs)} ${cricket ? 'MPR' : '3DA'}</span>
                <strong>${escapeHtml(leg.winner === 'home' ? 'H' : leg.winner === 'away' ? 'A' : '-')}</strong>
                <span class="away ${leg.winner === 'away' ? 'winner' : ''}">${escapeHtml(as)} ${cricket ? 'MPR' : '3DA'}</span>
            </div>
        `;
    }).join('');

    return `
        <article class="mhv-set-card mhv-launch-card ${isCompleted ? 'final' : isInProgress ? 'live' : ''}">
            <div class="mhv-set-launch-header">
                <div>
                    <span>Set ${escapeHtml(index + 1)}</span>
                    <strong>${escapeHtml(gameTypeDisplay(round))}</strong>
                    <em>${escapeHtml(label)} · Best of ${escapeHtml(round.best_of || 3)}</em>
                </div>
                <div class="mhv-set-launch-status">
                    <span>${escapeHtml(status)}</span>
                    ${isCompleted || isInProgress ? `<strong>${escapeHtml(`${homeLegs}-${awayLegs}`)}</strong>` : ''}
                    ${action}
                </div>
            </div>
            <div class="mhv-set-top">
                <div class="mhv-set-side">
                    <strong>${formatPlayers(homePlayers) || 'Home TBD'}</strong>
                    <span>${formatPlayerStats(homePlayers) || '&nbsp;'}</span>
                </div>
                <div class="mhv-set-side away">
                    <strong>${formatPlayers(awayPlayers) || 'Away TBD'}</strong>
                    <span>${formatPlayerStats(awayPlayers, true) || '&nbsp;'}</span>
                </div>
            </div>
            ${legRows ? `<div class="mhv-leg-list">${legRows}</div>` : ''}
        </article>
    `;
}

function isCricket(game, leg = {}) {
    const raw = String(leg.format || game?.format || game?.type || game?.game_type || '').toLowerCase();
    return raw.includes('cricket');
}

function legStats(leg, game) {
    const stored = leg?.player_stats || {};
    if (Object.keys(stored).length) return stored;

    const generated = {};
    (leg?.throws || []).forEach(turn => {
        ['home', 'away'].forEach(side => {
            const throwData = turn?.[side];
            const name = throwData?.player || throwData?.player_name;
            if (!name) return;
            if (!generated[name]) generated[name] = { darts: 0, points: 0, marks: 0 };
            const darts = Number(throwData.checkout_darts || throwData.closeout_darts || 3) || 3;
            generated[name].darts += darts;
            if (isCricket(game, leg)) {
                generated[name].marks += Number(throwData.marks) || 0;
            } else {
                generated[name].points += Number(throwData.score) || 0;
            }
        });
    });
    return generated;
}

function sideLookup(game) {
    const lookup = {};
    getGamePlayers(game, 'home').forEach(player => { lookup[normalizeName(player.name)] = 'home'; });
    getGamePlayers(game, 'away').forEach(player => { lookup[normalizeName(player.name)] = 'away'; });
    return lookup;
}

function aggregate() {
    const players = {};
    const teams = {
        home: { sets: 0, legs: 0, x01Points: 0, x01Darts: 0, cricketMarks: 0, cricketDarts: 0, emptyTurns: 0, turns: 0 },
        away: { sets: 0, legs: 0, x01Points: 0, x01Darts: 0, cricketMarks: 0, cricketDarts: 0, emptyTurns: 0, turns: 0 }
    };

    (state.match?.games || []).forEach(game => {
        const winner = game.winner;
        if (winner === 'home' || winner === 'away') teams[winner].sets += 1;
        teams.home.legs += Number(game.home_legs_won ?? game.result?.home_legs ?? 0) || 0;
        teams.away.legs += Number(game.away_legs_won ?? game.result?.away_legs ?? 0) || 0;
        const lookup = sideLookup(game);

        (game.legs || []).forEach(leg => {
            const cricket = isCricket(game, leg);
            Object.entries(legStats(leg, game)).forEach(([name, stats]) => {
                if (!name) return;
                const key = normalizeName(name);
                const side = stats.side || lookup[key];
                if (!players[key]) {
                    players[key] = {
                        name,
                        side,
                        x01Points: 0,
                        x01Darts: 0,
                        cricketMarks: 0,
                        cricketDarts: 0,
                        legs: 0,
                        wins: 0
                    };
                }
                const entry = players[key];
                if (!entry.side && side) entry.side = side;
                const darts = Number(stats.darts || stats.darts_thrown || 0) || 0;
                if (cricket) {
                    const marks = Number(stats.marks || stats.total_marks || 0) || 0;
                    entry.cricketDarts += darts;
                    entry.cricketMarks += marks;
                    if (side && teams[side]) {
                        teams[side].cricketDarts += darts;
                        teams[side].cricketMarks += marks;
                    }
                } else {
                    const points = Number(stats.points || stats.points_scored || 0) || 0;
                    entry.x01Darts += darts;
                    entry.x01Points += points;
                    if (side && teams[side]) {
                        teams[side].x01Darts += darts;
                        teams[side].x01Points += points;
                    }
                }
                entry.legs += 1;
                if (leg.winner && side === leg.winner) entry.wins += 1;
            });

            (leg.throws || []).forEach(turn => {
                ['home', 'away'].forEach(side => {
                    const t = turn?.[side];
                    if (!t || !teams[side]) return;
                    teams[side].turns += 1;
                    const empty = cricket
                        ? (Number(t.marks || 0) === 0)
                        : (Number(t.score || 0) === 0);
                    if (empty) teams[side].emptyTurns += 1;
                });
            });
        });
    });

    Object.values(players).forEach(player => {
        player.threeDa = player.x01Darts > 0 ? (player.x01Points / player.x01Darts) * 3 : null;
        player.mpr = player.cricketDarts > 0 ? player.cricketMarks / (player.cricketDarts / 3) : null;
    });
    Object.values(teams).forEach(team => {
        team.threeDa = team.x01Darts > 0 ? (team.x01Points / team.x01Darts) * 3 : null;
        team.mpr = team.cricketDarts > 0 ? team.cricketMarks / (team.cricketDarts / 3) : null;
        team.ms = team.turns > 0 ? Math.round((team.emptyTurns / team.turns) * 100) : null;
    });

    return { teams, players: Object.values(players) };
}

function renderHero(summary) {
    const match = state.match;
    const week = match.week || match.week_number || '?';
    const status = String(match.status || 'scheduled');
    const date = formatDate(match.match_date || match.date || match.scheduled_date);
    const phase = isPreMatch() ? 'Pre-match hub' : status === 'completed' ? 'Match report' : 'Match in progress';
    const h2h = headToHeadSummary();
    els.hero.innerHTML = `
        <div>
            <p class="mhv-kicker">${escapeHtml(state.league?.name || '2026 Triples League')}</p>
            <h1>${escapeHtml(teamName('home'))} vs. ${escapeHtml(teamName('away'))}</h1>
        </div>
        <div class="mhv-pill-row">
            <span class="mhv-pill hot">${escapeHtml(playoffRoundLabel())}</span>
            <span class="mhv-pill hot">${escapeHtml(phase)}</span>
            <span class="mhv-pill hot">Week ${escapeHtml(week)}</span>
            <span class="mhv-pill">${escapeHtml(date)}</span>
            <span class="mhv-pill ${status === 'completed' ? 'win' : 'gold'}">${escapeHtml(status)}</span>
            <span class="mhv-pill">First to ${escapeHtml(setsToWinMatch())}</span>
            <span class="mhv-pill">${escapeHtml(h2h.label)}</span>
        </div>
    `;
}

function renderScore(summary) {
    els.score.classList.toggle('pre-match', isPreMatch());
    const { teams } = summary;
    const homeSets = finite(state.match.home_score) ?? teams.home.sets;
    const awaySets = finite(state.match.away_score) ?? teams.away.sets;
    const winner = homeSets > awaySets ? 'home' : awaySets > homeSets ? 'away' : '';
    els.score.innerHTML = `
        ${renderTeamPanel('home', teams.home, winner === 'home')}
        <div class="mhv-score-center">
            <div class="mhv-score-main">${homeSets}-${awaySets}</div>
            <div class="mhv-score-label">sets</div>
        </div>
        ${renderTeamPanel('away', teams.away, winner === 'away')}
    `;
}

function renderTeamPanel(side, team, won) {
    const legTotal = finite(state.match?.[`${side}_legs_won`]) ?? team.legs;
    const pre = isPreMatch();
    const rosterStats = rosterAverages(side);
    const displayStats = pre ? rosterStats : team;
    const sub = pre
        ? `${teamRecord(side)} regular season · ${rosterStats.rosterCount || 0} players`
        : `${teamRecord(side)} - ${legTotal} legs`;
    return `
        <article class="mhv-team-panel ${side}">
            <div>
                <p class="mhv-kicker">${side === 'home' ? 'Home' : 'Away'} ${won ? 'winner' : 'team'}</p>
                <h2 class="mhv-team-name">${escapeHtml(teamName(side))}</h2>
                <div class="mhv-team-sub">${escapeHtml(sub)}</div>
            </div>
            <div class="mhv-stat-strip">
                <div class="mhv-stat"><span>${pre ? 'Roster 3DA' : '3DA'}</span><strong>${stat(displayStats.threeDa, 1)}</strong></div>
                <div class="mhv-stat"><span>${pre ? 'Roster MPR' : 'MPR'}</span><strong>${stat(displayStats.mpr, 2)}</strong></div>
                <div class="mhv-stat"><span>${pre ? 'Race' : 'MS%'}</span><strong>${pre ? setsToWinMatch() : team.ms == null ? '-' : `${team.ms}%`}</strong></div>
            </div>
        </article>
    `;
}

function renderSets() {
    const games = state.match?.games || [];
    const matchFormat = getMatchFormatForRender();
    const completed = games.filter(game => game?.status === 'completed').length;
    const decided = matchIsDecided();
    els.setCount.textContent = matchFormat.length
        ? `${completed} / ${matchFormat.length} sets${isPlayoffMatch() ? ` - first to ${setsToWinMatch()}` : ''}${decided ? ' - decided' : ''}`
        : (games.length ? `${games.length} sets` : 'No sets');
    if (matchFormat.length) {
        els.sets.innerHTML = matchFormat.map((round, index) => renderScheduledSet(round, index, games[index])).join('');
        return;
    }

    if (!games.length) {
        els.sets.innerHTML = '<div class="mhv-empty">No set data recorded yet. This match is still scheduled or has not been imported.</div>';
        return;
    }

    els.sets.innerHTML = games.map((game, index) => {
        const homePlayers = getGamePlayers(game, 'home').map(player => player.name).join(' / ') || teamName('home');
        const awayPlayers = getGamePlayers(game, 'away').map(player => player.name).join(' / ') || teamName('away');
        const homeLegs = finite(game.home_legs_won ?? game.result?.home_legs) ?? 0;
        const awayLegs = finite(game.away_legs_won ?? game.result?.away_legs) ?? 0;
        const type = game.type || game.format || game.game_type || 'Set';
        const legs = (game.legs || []).map(leg => {
            const cricket = isCricket(game, leg);
            const hs = cricket ? stat(leg.home_stats?.mpr, 2) : stat(leg.home_stats?.three_dart_avg, 1);
            const as = cricket ? stat(leg.away_stats?.mpr, 2) : stat(leg.away_stats?.three_dart_avg, 1);
            return `
                <div class="mhv-leg-row">
                    <span>L${escapeHtml(leg.leg_number || '')}</span>
                    <span class="${leg.winner === 'home' ? 'winner' : ''}">${escapeHtml(hs)} ${cricket ? 'MPR' : '3DA'}</span>
                    <strong>${escapeHtml(leg.winner === 'home' ? 'H' : leg.winner === 'away' ? 'A' : '-')}</strong>
                    <span class="away ${leg.winner === 'away' ? 'winner' : ''}">${escapeHtml(as)} ${cricket ? 'MPR' : '3DA'}</span>
                </div>
            `;
        }).join('');
        return `
            <article class="mhv-set-card ${homeLegs > awayLegs ? 'home-win' : awayLegs > homeLegs ? 'away-win' : 'draw'}">
                <div class="mhv-set-top">
                    <div class="mhv-set-side">
                        <strong>${escapeHtml(homePlayers)}</strong>
                        <span>${escapeHtml(type)}</span>
                    </div>
                    <div class="mhv-set-score">${homeLegs}-${awayLegs}</div>
                    <div class="mhv-set-side away">
                        <strong>${escapeHtml(awayPlayers)}</strong>
                        <span>Set ${escapeHtml(game.set || game.game || index + 1)}</span>
                    </div>
                </div>
                ${legs ? `<div class="mhv-leg-list">${legs}</div>` : ''}
            </article>
        `;
    }).join('');
}

function renderPerformance(summary) {
    if (isPreMatch()) {
        els.performance.innerHTML = ['home', 'away'].map(side => {
            const roster = getRoster(side);
            return `
                <article class="mhv-perf-card">
                    <h3>${escapeHtml(teamName(side))}</h3>
                    ${roster.map(player => leagueStatRow(player)).join('') || '<div class="mhv-empty">No league stats attached.</div>'}
                </article>
            `;
        }).join('');
        return;
    }

    const players = summary.players
        .filter(player => player.x01Darts || player.cricketDarts)
        .sort((a, b) => (b.threeDa || b.mpr || 0) - (a.threeDa || a.mpr || 0));
    if (!players.length) {
        els.performance.innerHTML = '<div class="mhv-empty">No player performance data recorded yet.</div>';
        return;
    }

    const home = players.filter(player => player.side === 'home');
    const away = players.filter(player => player.side === 'away');
    els.performance.innerHTML = ['home', 'away'].map(side => {
        const rows = side === 'home' ? home : away;
        return `
            <article class="mhv-perf-card">
                <h3>${escapeHtml(teamName(side))}</h3>
                ${rows.map(player => `
                    <div class="mhv-player-row">
                        <strong>${escapeHtml(player.name)}</strong>
                        <em><span>${stat(player.threeDa, 1)} 3DA</span><span>${stat(player.mpr, 2)} MPR</span></em>
                    </div>
                `).join('') || '<div class="mhv-empty">No tracked stats.</div>'}
            </article>
        `;
    }).join('');
}

function renderRosters() {
    els.rosters.innerHTML = ['home', 'away'].map(side => {
        const roster = getRoster(side);
        return `
            <article class="mhv-roster-card">
                <h3>${escapeHtml(teamName(side))}</h3>
                ${roster.map(player => `
                    <div class="mhv-player-row">
                        <strong>${escapeHtml(player.name || player.player_name || 'Player')}<span class="mhv-level ${escapeHtml(level(player))}">${escapeHtml(level(player))}</span></strong>
                        <em><span>${escapeHtml(playerStatLine(player))}</span>${player.is_sub ? '<span>fill-in</span>' : ''}</em>
                    </div>
                `).join('') || '<div class="mhv-empty">No roster attached.</div>'}
            </article>
        `;
    }).join('');
}

function renderContext(summary) {
    const match = state.match;
    if (els.leagueMatchLink) {
        els.leagueMatchLink.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    }
    const h2h = headToHeadSummary();
    const meetings = h2h.meetings.slice(0, 3);
    const completed = (match.games || []).filter(game => game?.status === 'completed').length;
    const matchFormat = getMatchFormatForRender();
    const items = [
        ['Round', playoffRoundLabel()],
        ['Matchup record', `${h2h.label} · ${h2h.detail}`],
        ['Week', match.week || match.week_number || '-'],
        ['Date', formatDate(match.match_date || match.date || match.scheduled_date)],
        ['Status', match.status || 'scheduled'],
        ['Race', `First to ${setsToWinMatch()} sets`],
        ['Sets', matchFormat.length ? `${completed} of ${matchFormat.length} recorded` : `${summary.setsPlayed || 0} recorded`],
        ['Score', `${currentSetScore().home}-${currentSetScore().away}`],
        ['League', state.league?.name || '2026 Triples League'],
        ['Previous meetings', meetings.length
            ? meetings.map(item => {
                const homeId = sideTeamId('home');
                const homeScore = item.home_team_id === homeId ? Number(item.home_score || 0) : Number(item.away_score || 0);
                const awayScore = item.home_team_id === homeId ? Number(item.away_score || 0) : Number(item.home_score || 0);
                return `Week ${item.week || '?'}: ${homeScore}-${awayScore}`;
            }).join(' · ')
            : 'No previous meetings this season']
    ];
    els.context.innerHTML = items.map(([label, value]) => `
        <div class="mhv-context-item">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');
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
    if (!matchId) throw new Error('Missing match_id');
    const [leagueSnap, matchSnap, matchesSnap, teamsSnap, playersSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)).catch(() => null),
        getDoc(doc(db, 'leagues', leagueId, 'matches', matchId)),
        getDocs(collection(db, 'leagues', leagueId, 'matches')),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]);
    if (!matchSnap.exists()) throw new Error('Match not found');
    state.league = leagueSnap?.exists?.() ? { id: leagueSnap.id, ...leagueSnap.data() } : null;
    state.match = { id: matchSnap.id, ...matchSnap.data() };
    state.matches = matchesSnap.docs.map(match => ({ id: match.id, ...match.data() }));
    state.teamsById = Object.fromEntries(teamsSnap.docs.map(team => [team.id, { id: team.id, ...team.data() }]));
    state.players = playersSnap.docs.map(player => ({ id: player.id, ...player.data() }));
    state.statsById = Object.fromEntries(statsSnap.docs.map(stats => [stats.id, stats.data()]));
}

function renderAll() {
    const summary = aggregate();
    summary.setsPlayed = (state.match?.games || []).length;
    document.body.classList.toggle('mhv-pre-match', isPreMatch());
    document.body.classList.toggle('mhv-report-match', !isPreMatch());
    renderHero(summary);
    renderScore(summary);
    renderSets();
    renderPerformance(summary);
    renderRosters();
    renderContext(summary);
}

async function init() {
    initTabs();
    try {
        await loadData();
        renderAll();
    } catch (error) {
        console.error('[match-hub-vnext] failed:', error);
        els.hero.innerHTML = `<div class="mhv-empty">${escapeHtml(error.message || 'Could not load match report.')}</div>`;
        els.score.innerHTML = '';
    }
}

init();
