import {
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'aOq4Y0ETxPZ66tM1uUtP';
const matchId = params.get('match_id');

const els = {
    hero: document.getElementById('matchHero'),
    score: document.getElementById('scoreCard'),
    sets: document.getElementById('setsList'),
    setCount: document.getElementById('setCountBadge'),
    expandAll: document.getElementById('setsExpandAll'),
    performance: document.getElementById('performanceGrid'),
    awards: document.getElementById('awardsContainer'),
    leaders: document.getElementById('leadersContainer'),
    rosters: document.getElementById('rosterGrid'),
    context: document.getElementById('contextList'),
    leagueMatchLink: document.getElementById('leagueMatchLink')
};

let state = {
    match: null,
    league: null,
    matches: [],
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
    const formatLength = (state.league?.match_format || []).length || finite(state.league?.games_per_match) || 9;
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
    const totalGames = (state.league?.match_format || []).length || 9;
    const search = new URLSearchParams({
        league_id: leagueId,
        match_id: matchId,
        game_index: String(index),
        game_number: String(index + 1),
        from_match: 'true',
        total_games: String(totalGames),
        home_team_name: teamName('home'),
        away_team_name: teamName('away'),
        return_url: `/pages/match-hub-vnext.html?league_id=${encodeURIComponent(leagueId)}&match_id=${encodeURIComponent(matchId)}`
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

    return `/pages/${scorerPage(round)}?${search.toString()}`;
}

function playerStatLine(player) {
    const stats = state.statsById[player.id] || {};
    const avg = finite(stats.x01_three_dart_avg) ?? finite(stats.x01_avg);
    const mpr = finite(stats.cricket_mpr);
    return `${avg == null ? '-' : avg.toFixed(1)} / ${mpr == null ? '-' : mpr.toFixed(2)}`;
}

// Returns league-season stats for a player from stats/{playerId} (source of truth per RULE 1/2)
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

    // RULE 17 post-match report: completed matches with recorded legs render as
    // SET cards grouped by `set` number with aggregated leg scores + RULE 20 badges.
    const hasLegData = games.some(game => (game.legs || []).length);
    if (state.match?.status === 'completed' && hasLegData) {
        renderReportSets(games);
        return;
    }
    if (els.expandAll) els.expandAll.hidden = true;

    const matchFormat = state.league?.match_format || [];
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

// ===================================================================
// Post-match report depth (ported from legacy match-hub.html)
// RULE 17: set-grouped cards · RULE 20: leg badges · RULE 18/19: awards
// ===================================================================

function playerByName(name) {
    if (!state._playersByName) {
        state._playersByName = {};
        state.players.forEach(player => {
            const key = normalizeName(player.name);
            if (key && !state._playersByName[key]) state._playersByName[key] = player;
        });
    }
    return state._playersByName[normalizeName(name)] || null;
}

// RULE 18 canonical checkout ranges
function getCheckoutRange(score) {
    if (score >= 161) return '161_plus';
    if (score >= 140) return '140_160';
    if (score >= 100) return '100_139';
    if (score >= 60) return '60_99';
    return null;
}

function dashVal(value) {
    return value ? escapeHtml(value) : '-';
}

function legWinCounts(games) {
    let home = 0;
    let away = 0;
    games.forEach(game => {
        const legs = game?.legs || [];
        if (legs.length) {
            legs.forEach(leg => {
                if (leg.winner === 'home') home += 1;
                else if (leg.winner === 'away') away += 1;
            });
        } else if (game?.result) {
            home += Number(game.result.home_legs) || 0;
            away += Number(game.result.away_legs) || 0;
        } else {
            home += Number(game?.home_legs_won) || 0;
            away += Number(game?.away_legs_won) || 0;
        }
    });
    return { home, away };
}

function setTypeLabel(setGames) {
    const homeNames = getGamePlayers(setGames[0], 'home').map(player => player.name);
    const posMap = { 1: 'A', 2: 'B', 3: 'C' };
    const letters = homeNames.map(name => posMap[Number(playerByName(name)?.position)] || null);
    const allMapped = letters.length > 0 && letters.every(Boolean);
    if (homeNames.length === 1) return `Singles${allMapped ? ` ${letters[0]}` : ''}`;
    if (homeNames.length === 2) return `Doubles${allMapped ? ` ${letters.sort().join('/')}` : ''}`;
    return homeNames.length ? 'Triples' : 'Set';
}

function setFormatLabel(setGames) {
    const firstGame = setGames[0] || {};
    const allLegs = setGames.flatMap(game => game.legs || []);
    const formats = allLegs.map(leg => String(leg.format || firstGame.format || '501').toLowerCase());
    const hasX01 = formats.some(format => !format.includes('cricket'));
    const hasCricket = formats.some(format => format.includes('cricket'));
    if (hasX01 && hasCricket) {
        const x01Val = allLegs.find(leg => !String(leg.format || firstGame.format || '').toLowerCase().includes('cricket'))?.format || firstGame.format || '501';
        return `${x01Val}/Crkt/Choice`;
    }
    if (hasCricket) return 'Cricket';
    const x01Val = firstGame.format || '501';
    const inLabel = (firstGame.in_rule || 'straight') === 'double' ? 'DI' : 'SI';
    const outLabel = (firstGame.checkout || 'double') === 'double' ? 'DO' : (firstGame.checkout === 'master' ? 'MO' : 'SO');
    return `${x01Val} ${inLabel}/${outLabel}`;
}

function calculateSetPlayerStats(setGames) {
    const totals = {};
    setGames.forEach(game => {
        (game.legs || []).forEach(leg => {
            const cricket = isCricket(game, leg);
            Object.entries(legStats(leg, game)).forEach(([name, stats]) => {
                if (!name || name === 'undefined') return;
                if (!totals[name]) totals[name] = { x01Darts: 0, x01Points: 0, cricketDarts: 0, cricketMarks: 0 };
                if (cricket) {
                    totals[name].cricketDarts += Number(stats.darts) || 0;
                    totals[name].cricketMarks += Number(stats.marks ?? stats.total_marks) || 0;
                } else {
                    totals[name].x01Darts += Number(stats.darts) || 0;
                    totals[name].x01Points += Number(stats.points ?? stats.points_scored) || 0;
                }
            });
        });
    });

    const display = name => {
        const t = totals[name];
        if (!t) return null;
        const has01 = t.x01Darts > 0;
        const hasCrk = t.cricketDarts > 0;
        const avg = has01 ? (t.x01Points / t.x01Darts) * 3 : 0;
        const mpr = hasCrk ? t.cricketMarks / (t.cricketDarts / 3) : 0;
        if (has01 && hasCrk) return { text: `${avg.toFixed(1)} / ${mpr.toFixed(2)}`, val: avg, cls: '' };
        if (has01) return { text: `${avg.toFixed(1)} 3DA`, val: avg, cls: '' };
        if (hasCrk) return { text: `${mpr.toFixed(2)} MPR`, val: mpr, cls: '' };
        return null;
    };

    const homePlayers = getGamePlayers(setGames[0], 'home').map(player => player.name);
    const awayPlayers = getGamePlayers(setGames[0], 'away').map(player => player.name);
    const home = homePlayers.map(display);
    const away = awayPlayers.map(display);
    for (let i = 0; i < Math.max(home.length, away.length); i += 1) {
        const h = home[i];
        const a = away[i];
        if (h && a && h.val && a.val) {
            if (h.val > a.val) { h.cls = 'mhv-stat-better'; a.cls = 'mhv-stat-worse'; }
            else if (a.val > h.val) { a.cls = 'mhv-stat-better'; h.cls = 'mhv-stat-worse'; }
        }
    }
    return { homePlayers, awayPlayers, home, away };
}

// RULE 20 detection: cork thrower, X01 checkout, cricket closeout, loser remaining
function legBadges(leg, game) {
    const cricket = isCricket(game, leg);
    const throwsArr = leg.throws || [];
    const firstThrow = throwsArr[0];
    const lastThrow = throwsArr.slice(-1)[0];
    const corkPlayer = firstThrow?.home?.player
        ? { side: 'home', name: firstThrow.home.player }
        : firstThrow?.away?.player
            ? { side: 'away', name: firstThrow.away.player }
            : null;

    let checkoutValue = null;
    let closeoutMarks = null;
    let loserRemaining = null;
    const winner = leg.winner === 'home' || leg.winner === 'away' ? leg.winner : null;
    if (winner && lastThrow) {
        const winData = lastThrow[winner] || {};
        const loseSide = winner === 'home' ? 'away' : 'home';
        if (!cricket) {
            checkoutValue = finite(winData.score) || finite(leg.checkout) || null;
            loserRemaining = finite(lastThrow[loseSide]?.remaining) || finite(leg[`${loseSide}_stats`]?.remaining) || null;
        } else if (winData.closed_out) {
            closeoutMarks = finite(winData.marks);
        }
    }
    return { cricket, corkPlayer, checkoutValue, closeoutMarks, loserRemaining, winner };
}

function renderLegRow(leg, game, legIdx) {
    const badges = legBadges(leg, game);
    const playerStats = legStats(leg, game);
    const homePlayers = getGamePlayers(game, 'home').map(player => player.name);
    const awayPlayers = getGamePlayers(game, 'away').map(player => player.name);
    const cricket = badges.cricket;
    const legFormat = String(leg.format || game.format || '501');
    let formatLabel = legFormat.toUpperCase();
    if (!cricket) {
        const inLabel = (game.in_rule || 'straight') === 'double' ? 'DI' : 'SI';
        const outLabel = (game.checkout || 'double') === 'double' ? 'DO' : (game.checkout === 'master' ? 'MO' : 'SO');
        formatLabel = `${legFormat} ${inLabel}/${outLabel}`;
    }

    const renderSide = side => {
        const names = side === 'home' ? homePlayers : awayPlayers;
        const won = badges.winner === side;
        const lost = Boolean(badges.winner) && badges.winner !== side;
        const rows = names.map(name => {
            const stats = playerStats[name] || {};
            let statText = '-';
            if (cricket) {
                const mpr = finite(stats.mpr) || (stats.darts ? ((Number(stats.marks) || 0) / (stats.darts / 3)) : null);
                if (mpr) statText = `${mpr.toFixed(2)} MPR`;
            } else {
                const avg = finite(stats.three_dart_avg) || (stats.darts ? ((Number(stats.points) || 0) / stats.darts) * 3 : null);
                if (avg) statText = `${avg.toFixed(1)} 3DA`;
            }
            const cork = badges.corkPlayer && badges.corkPlayer.side === side && normalizeName(badges.corkPlayer.name) === normalizeName(name)
                ? '<span class="mhv-cork-badge" title="Threw first (cork)">C</span>'
                : '';
            return `
                <div class="mhv-leg-player">
                    <strong>${escapeHtml(name)}${cork}</strong>
                    <em>${escapeHtml(statText)}</em>
                </div>
            `;
        }).join('');
        let flag = '';
        if (won) {
            if (!cricket && badges.checkoutValue) flag = `<span class="mhv-leg-flag">★ OUT: ${escapeHtml(badges.checkoutValue)}</span>`;
            else if (cricket && badges.closeoutMarks != null) flag = `<span class="mhv-leg-flag">★ CLOSED (${escapeHtml(badges.closeoutMarks)}M)</span>`;
            else flag = '<span class="mhv-leg-flag">★ WIN</span>';
        } else if (lost && !cricket && badges.loserRemaining) {
            flag = `<span class="mhv-leg-left">Left: ${escapeHtml(badges.loserRemaining)}</span>`;
        }
        return `
            <div class="mhv-leg-side ${side}">
                ${rows}
                ${flag ? `<div class="mhv-leg-flag-row">${flag}</div>` : ''}
            </div>
        `;
    };

    return `
        <div class="mhv-leg-card ${badges.winner === 'home' ? 'home-won' : badges.winner === 'away' ? 'away-won' : ''}">
            ${renderSide('home')}
            <div class="mhv-leg-mid">
                <span>Leg ${escapeHtml(leg.leg_number || legIdx + 1)}</span>
                <em>${escapeHtml(formatLabel)}</em>
            </div>
            ${renderSide('away')}
        </div>
    `;
}

function renderReportSets(games) {
    const groups = new Map();
    games.forEach((game, idx) => {
        const setNum = Number(game.set) || idx + 1;
        if (!groups.has(setNum)) groups.set(setNum, []);
        groups.get(setNum).push({ ...game, originalIdx: idx });
    });
    const setNumbers = [...groups.keys()].sort((a, b) => a - b);
    const totals = legWinCounts(games);
    els.setCount.textContent = `${setNumbers.length} sets · ${totals.home}-${totals.away} legs`;

    els.sets.innerHTML = setNumbers.map(setNum => {
        const setGames = groups.get(setNum);
        const score = legWinCounts(setGames);
        const stats = calculateSetPlayerStats(setGames);
        const bestOf = finite(state.league?.match_format?.[setGames[0].originalIdx]?.best_of)
            || setGames.reduce((sum, game) => sum + (game.legs || []).length, 0) || 3;
        const homeWon = score.home > score.away;
        const awayWon = score.away > score.home;

        const sideColumn = side => {
            const names = side === 'home' ? stats.homePlayers : stats.awayPlayers;
            const display = side === 'home' ? stats.home : stats.away;
            return names.map((name, idx2) => `
                <div class="mhv-report-player">
                    <strong>${escapeHtml(name)}</strong>
                    ${display[idx2] ? `<em class="${display[idx2].cls}">${escapeHtml(display[idx2].text)}</em>` : ''}
                </div>
            `).join('') || `<div class="mhv-report-player"><strong>${escapeHtml(teamName(side))}</strong></div>`;
        };

        const legRows = setGames
            .flatMap(game => (game.legs || []).map((leg, legIdx) => renderLegRow(leg, game, legIdx)))
            .join('');

        return `
            <article class="mhv-set-card mhv-report-set ${homeWon ? 'home-win' : awayWon ? 'away-win' : ''}" data-set-num="${setNum}">
                <header class="mhv-report-head">
                    <div>
                        <span class="mhv-report-kicker">Set ${setNum}</span>
                        <strong>${escapeHtml(setTypeLabel(setGames))}</strong>
                        <em>Best of ${escapeHtml(bestOf)} · ${escapeHtml(setFormatLabel(setGames))}</em>
                    </div>
                    <div class="mhv-report-score">
                        ${homeWon ? '<span class="mhv-report-star">★</span>' : ''}
                        <strong>${score.home} – ${score.away}</strong>
                        ${awayWon ? '<span class="mhv-report-star">★</span>' : ''}
                    </div>
                </header>
                <div class="mhv-report-top">
                    <div class="mhv-report-side home">${sideColumn('home')}</div>
                    <div class="mhv-report-side away">${sideColumn('away')}</div>
                </div>
                ${legRows ? `
                    <button type="button" class="mhv-set-toggle" data-set-toggle aria-expanded="false">Leg details ▾</button>
                    <div class="mhv-set-legs" hidden>${legRows}</div>
                ` : ''}
            </article>
        `;
    }).join('');

    if (els.expandAll) {
        els.expandAll.hidden = false;
        updateExpandAllLabel();
    }
}

function toggleSetCard(card, open) {
    const btn = card.querySelector('[data-set-toggle]');
    const legs = card.querySelector('.mhv-set-legs');
    if (!btn || !legs) return;
    legs.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = open ? 'Hide leg details ▴' : 'Leg details ▾';
}

function updateExpandAllLabel() {
    if (!els.expandAll) return;
    const panels = [...els.sets.querySelectorAll('.mhv-report-set .mhv-set-legs')];
    els.expandAll.textContent = panels.some(panel => panel.hidden) ? 'Expand all' : 'Collapse all';
}

function initSetToggles() {
    els.sets?.addEventListener('click', event => {
        const btn = event.target.closest('[data-set-toggle]');
        if (!btn) return;
        const card = btn.closest('.mhv-report-set');
        const legs = card?.querySelector('.mhv-set-legs');
        if (!legs) return;
        toggleSetCard(card, legs.hidden);
        updateExpandAllLabel();
    });
    els.expandAll?.addEventListener('click', () => {
        const cards = [...els.sets.querySelectorAll('.mhv-report-set')].filter(card => card.querySelector('.mhv-set-legs'));
        const anyClosed = cards.some(card => card.querySelector('.mhv-set-legs').hidden);
        cards.forEach(card => toggleSetCard(card, anyClosed));
        updateExpandAllLabel();
    });
}

// ===== Awards + Leaders shared throw iteration =====

function throwPlayerName(td) {
    const name = td?.player_name || td?.player || td?.name || td?.imported_player_label;
    if (!name) return null;
    const trimmed = String(name).trim();
    return trimmed && trimmed.toLowerCase() !== 'undefined' ? trimmed : null;
}

function forEachLegThrow(callback) {
    (state.match?.games || []).forEach(game => {
        const lookup = sideLookup(game);
        (game.legs || []).forEach((leg, legIdx) => {
            const cricket = isCricket(game, leg);
            const throwsArr = leg.throws || [];
            const legId = `${game.set || 0}-${legIdx}`;
            const seen = new Set();
            const first9Rounds = {};
            throwsArr.forEach((turn, turnIdx) => {
                ['home', 'away'].forEach(slot => {
                    const td = turn?.[slot];
                    if (!td) return;
                    const name = throwPlayerName(td);
                    if (!name) return;
                    const side = lookup[normalizeName(name)] || slot;
                    callback({
                        game, leg, legId, cricket, seen, first9Rounds,
                        td, name, side, slot,
                        round: turn.round,
                        isLastThrow: turnIdx === throwsArr.length - 1
                    });
                });
            });
        });
    });
}

// ===== AWARDS (port of legacy renderCounts) =====

function aggregateAwards() {
    const acc = {
        homeNames: new Set(),
        awayNames: new Set(),
        checkouts: {},
        checkoutPerf: {},
        opportunity: {},
        turns100: {},
        turns95: {},
        closeouts: {},
        markTurns: {},
        bulls: {},
        marksman: {}
    };

    forEachLegThrow(({ td, name, side, leg, legId, cricket, seen, first9Rounds, isLastThrow }) => {
        (side === 'home' ? acc.homeNames : acc.awayNames).add(name);

        if (!cricket) {
            if (!acc.opportunity[name]) acc.opportunity[name] = { x01Legs: 0, attempts: 0, successfulDarts: 0, trackedLegs: new Set() };
            const opp = acc.opportunity[name];
            if (!seen.has(name)) {
                seen.add(name);
                opp.x01Legs += 1;
                opp.trackedLegs.add(legId);
            }
            const score = Number(td.score) || 0;
            if (!acc.checkouts[name]) acc.checkouts[name] = { high: 0, total: 0, '60_99': 0, '100_139': 0, '140_160': 0, '161_plus': 0 };
            if (!acc.checkoutPerf[name]) acc.checkoutPerf[name] = { checkoutSum: 0, checkoutCount: 0, checkoutDarts: 0, totalOpportunities: 0, first9Points: 0, first9Darts: 0 };
            if (!acc.turns100[name]) acc.turns100[name] = { total: 0, pts: 0, high: 0, r100_119: 0, r120_139: 0, r140_159: 0, r160_179: 0, r180: 0 };
            if (!acc.turns95[name]) acc.turns95[name] = { total: 0, pts: 0, high: 0, r95_113: 0, r114_132: 0, r133_151: 0, r152_170: 0, r171_180: 0 };
            const checkouts = acc.checkouts[name];
            const perf = acc.checkoutPerf[name];
            const t100 = acc.turns100[name];
            const t95 = acc.turns95[name];

            // Checkout range tracking - only when remaining-before is a real checkout opportunity
            const remainingBefore = (td.remaining != null ? td.remaining : 0) + score;
            const isCheckout = td.checkout || td.remaining === 0;
            if (remainingBefore >= 60 && remainingBefore <= 170) {
                const range = getCheckoutRange(remainingBefore);
                if (range) {
                    perf.totalOpportunities += 1;
                    opp.attempts += 1;
                    if (isCheckout) {
                        checkouts[range] += 1;
                        checkouts.total += 1;
                        if (score >= 60 && score > checkouts.high) checkouts.high = score;
                        if (score >= 60) {
                            perf.checkoutSum += score;
                            perf.checkoutCount += 1;
                        }
                        const cDarts = td.checkout_darts || 3;
                        perf.checkoutDarts += cDarts;
                        opp.successfulDarts += cDarts;
                    }
                }
            } else if (remainingBefore >= 2 && remainingBefore < 60) {
                opp.attempts += 1;
                if (isCheckout) {
                    const cDarts = td.checkout_darts || 3;
                    perf.checkoutDarts += cDarts;
                    opp.successfulDarts += cDarts;
                }
            }

            // First 9 darts (player's first 3 rounds of the leg)
            first9Rounds[name] = (first9Rounds[name] || 0) + 1;
            if (first9Rounds[name] <= 3) {
                perf.first9Points += score;
                perf.first9Darts += 3;
            }

            if (score >= 100) {
                t100.total += 1;
                t100.pts += score;
                if (score > t100.high) t100.high = score;
                if (score >= 180) t100.r180 += 1;
                else if (score >= 160) t100.r160_179 += 1;
                else if (score >= 140) t100.r140_159 += 1;
                else if (score >= 120) t100.r120_139 += 1;
                else t100.r100_119 += 1;
            }
            if (score >= 95) {
                t95.total += 1;
                t95.pts += score;
                if (score > t95.high) t95.high = score;
                if (score >= 171) t95.r171_180 += 1;
                else if (score >= 152) t95.r152_170 += 1;
                else if (score >= 133) t95.r133_151 += 1;
                else if (score >= 114) t95.r114_132 += 1;
                else t95.r95_113 += 1;
            }
        } else {
            const marks = Number(td.marks) || 0;
            const hit = String(td.hit || '');
            const dbCount = (hit.match(/DB/g) || []).length;
            const sbCount = (hit.match(/SB/g) || []).length;
            const tripleCount = (hit.match(/T\d+/g) || []).length;
            if (!acc.markTurns[name]) acc.markTurns[name] = { totalThrows: 0, highMarkTotal: 0, count5plus: 0, m5: 0, m6: 0, m7: 0, m8: 0, m9: 0 };
            if (!acc.bulls[name]) acc.bulls[name] = { allBulls: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
            if (!acc.marksman[name]) acc.marksman[name] = { triples: 0, dBulls: 0, hatTricks: 0 };
            const markTurns = acc.markTurns[name];
            const bulls = acc.bulls[name];
            const marksman = acc.marksman[name];

            markTurns.totalThrows += 1;
            if (marks >= 5) {
                markTurns.count5plus += 1;
                if (marks > markTurns.highMarkTotal) markTurns.highMarkTotal = marks;
                if (marks >= 9) markTurns.m9 += 1;
                else if (marks >= 8) markTurns.m8 += 1;
                else if (marks >= 7) markTurns.m7 += 1;
                else if (marks >= 6) markTurns.m6 += 1;
                else markTurns.m5 += 1;
            }

            const bullDarts = dbCount + sbCount;
            bulls.allBulls += bullDarts;
            if (bullDarts >= 6) bulls.b6 += 1;
            else if (bullDarts >= 5) bulls.b5 += 1;
            else if (bullDarts >= 4) bulls.b4 += 1;
            else if (bullDarts >= 3) bulls.b3 += 1;

            marksman.triples += tripleCount;
            marksman.dBulls += dbCount;
            if (bullDarts >= 3) marksman.hatTricks += 1;

            // RULE 19 closeout tracking
            if (td.closed_out || (leg.winner === side && isLastThrow)) {
                if (marks >= 5 && marks <= 9) {
                    if (!acc.closeouts[name]) acc.closeouts[name] = { '5m': 0, '6m': 0, '7m': 0, '8m': 0, '9m': 0 };
                    acc.closeouts[name][`${marks}m`] += 1;
                }
            }
        }
    });

    acc.orderedNames = [...acc.homeNames, ...acc.awayNames];
    return acc;
}

function statTable(title, headers, rows) {
    if (!rows.length) return '';
    return `
        <section class="mhv-award-section">
            <div class="mhv-award-title">${escapeHtml(title)}</div>
            <div class="mhv-table-wrap">
                <table class="mhv-table">
                    <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        </section>
    `;
}

function nameCell(name, side) {
    return `<td class="mhv-pname ${side === 'home' ? 'home' : 'away'}">${escapeHtml(name)}</td>`;
}

function awardSide(acc, name) {
    return acc.homeNames.has(name) ? 'home' : 'away';
}

function renderAwards() {
    if (!els.awards) return;
    const games = state.match?.games || [];
    if (!games.some(game => (game.legs || []).length)) {
        els.awards.innerHTML = '<div class="mhv-empty">Awards populate once legs are recorded for this match.</div>';
        return;
    }
    const acc = aggregateAwards();

    const x01Sections = [];
    const checkoutNames = acc.orderedNames.filter(name => acc.checkouts[name]?.total > 0);
    x01Sections.push(statTable('60+ Double-Outs', ['Player', 'High', 'Count', '60-99', '100-139', '140-160', '161+'],
        checkoutNames.map(name => {
            const d = acc.checkouts[name];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.high)}</td><td>${dashVal(d.total)}</td><td>${dashVal(d['60_99'])}</td><td>${dashVal(d['100_139'])}</td><td>${dashVal(d['140_160'])}</td><td>${dashVal(d['161_plus'])}</td></tr>`;
        })));

    const perfNames = acc.orderedNames.filter(name => acc.checkoutPerf[name]?.totalOpportunities > 0);
    x01Sections.push(statTable('Checkout Performance', ['Player', 'Fir9', 'AFin', 'COD', 'COO', 'COE'],
        perfNames.map(name => {
            const perf = acc.checkoutPerf[name];
            const fir9 = perf.first9Darts > 0 ? ((perf.first9Points / perf.first9Darts) * 3).toFixed(1) : '-';
            const afin = perf.checkoutCount > 0 ? (perf.checkoutSum / perf.checkoutCount).toFixed(1) : '-';
            const coe = perf.totalOpportunities > 0 && perf.checkoutDarts > 0
                ? `${Math.round((perf.checkoutDarts / (perf.totalOpportunities * 3)) * 100)}%`
                : '-';
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${fir9}</td><td>${afin}</td><td>${dashVal(perf.checkoutDarts)}</td><td>${dashVal(perf.totalOpportunities)}</td><td>${coe}</td></tr>`;
        })));

    const oppNames = acc.orderedNames.filter(name => acc.opportunity[name]?.x01Legs > 0);
    x01Sections.push(statTable('Opportunity Tracking', ['Player', "'01 Legs", 'COA', 'COD', 'CO%', 'T-Legs'],
        oppNames.map(name => {
            const opp = acc.opportunity[name];
            const coPercent = opp.attempts > 0 ? `${Math.round((opp.successfulDarts / (opp.attempts * 3)) * 100)}%` : '-';
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(opp.x01Legs)}</td><td>${dashVal(opp.attempts)}</td><td>${dashVal(opp.successfulDarts)}</td><td>${coPercent}</td><td>${opp.trackedLegs.size}</td></tr>`;
        })));

    const t100Names = acc.orderedNames.filter(name => acc.turns100[name]?.total > 0);
    x01Sections.push(statTable("'01 100+ Turns", ['Player', 'Pts', 'Count', 'High', '100-119', '120-139', '140-159', '160-179', '180'],
        t100Names.map(name => {
            const d = acc.turns100[name];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.pts)}</td><td>${dashVal(d.total)}</td><td>${dashVal(d.high)}</td><td>${dashVal(d.r100_119)}</td><td>${dashVal(d.r120_139)}</td><td>${dashVal(d.r140_159)}</td><td>${dashVal(d.r160_179)}</td><td>${dashVal(d.r180)}</td></tr>`;
        })));

    const t95Names = acc.orderedNames.filter(name => acc.turns95[name]?.total > 0);
    x01Sections.push(statTable("'01 95+ Turns", ['Player', 'Pts', 'Count', 'High', '95-113', '114-132', '133-151', '152-170', '171-180'],
        t95Names.map(name => {
            const d = acc.turns95[name];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.pts)}</td><td>${dashVal(d.total)}</td><td>${dashVal(d.high)}</td><td>${dashVal(d.r95_113)}</td><td>${dashVal(d.r114_132)}</td><td>${dashVal(d.r133_151)}</td><td>${dashVal(d.r152_170)}</td><td>${dashVal(d.r171_180)}</td></tr>`;
        })));

    const cricketSections = [];
    const closeoutNames = acc.orderedNames.filter(name => acc.closeouts[name]);
    cricketSections.push(statTable('Cricket Closeouts', ['Player', '9M', '8M', '7M', '6M', '5M', 'Total 5M+'],
        closeoutNames.map(name => {
            const d = acc.closeouts[name];
            const total = d['5m'] + d['6m'] + d['7m'] + d['8m'] + d['9m'];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d['9m'])}</td><td>${dashVal(d['8m'])}</td><td>${dashVal(d['7m'])}</td><td>${dashVal(d['6m'])}</td><td>${dashVal(d['5m'])}</td><td>${dashVal(total)}</td></tr>`;
        })));

    const markNames = acc.orderedNames.filter(name => acc.markTurns[name]?.count5plus > 0);
    cricketSections.push(statTable('Cricket 5M+ Turns', ['Player', 'H Marks', 'Count', '5M+%', '5M', '6M', '7M', '8M', '9M'],
        markNames.map(name => {
            const d = acc.markTurns[name];
            const pct5plus = d.totalThrows > 0 ? `${Math.round((d.count5plus / d.totalThrows) * 100)}%` : '-';
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.highMarkTotal)}</td><td>${dashVal(d.count5plus)}</td><td>${pct5plus}</td><td>${dashVal(d.m5)}</td><td>${dashVal(d.m6)}</td><td>${dashVal(d.m7)}</td><td>${dashVal(d.m8)}</td><td>${dashVal(d.m9)}</td></tr>`;
        })));

    const bullNames = acc.orderedNames.filter(name => acc.bulls[name]?.allBulls > 0);
    cricketSections.push(statTable('Cricket Bulls', ['Player', 'All', '3 Bull', '4 Bull', '5 Bull', '6 Bull'],
        bullNames.map(name => {
            const d = acc.bulls[name];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.allBulls)}</td><td>${dashVal(d.b3)}</td><td>${dashVal(d.b4)}</td><td>${dashVal(d.b5)}</td><td>${dashVal(d.b6)}</td></tr>`;
        })));

    const marksmanNames = acc.orderedNames.filter(name => {
        const d = acc.marksman[name];
        return d && (d.triples > 0 || d.dBulls > 0 || d.hatTricks > 0);
    });
    cricketSections.push(statTable('Marksman Counts', ['Player', 'Triples', 'D. Bulls', 'Hat Tricks'],
        marksmanNames.map(name => {
            const d = acc.marksman[name];
            return `<tr>${nameCell(name, awardSide(acc, name))}<td>${dashVal(d.triples)}</td><td>${dashVal(d.dBulls)}</td><td>${dashVal(d.hatTricks)}</td></tr>`;
        })));

    const x01Html = x01Sections.join('') || '<div class="mhv-empty">No \'01 data recorded in this match.</div>';
    const cricketHtml = cricketSections.join('') || '<div class="mhv-empty">No cricket data recorded in this match.</div>';
    els.awards.innerHTML = `
        <div class="mhv-subtabs">
            <button type="button" class="active" data-subtab="x01">'01</button>
            <button type="button" data-subtab="cricket">Cricket</button>
        </div>
        <div class="mhv-subpane active" data-subpane="x01">${x01Html}</div>
        <div class="mhv-subpane" data-subpane="cricket">${cricketHtml}</div>
    `;
}

// ===== LEADERS (port of legacy aggregateLeaderStats core) =====

function aggregateLeaders() {
    const players = {};
    const homeNames = new Set();
    const awayNames = new Set();

    const ensure = name => {
        if (!players[name]) {
            players[name] = {
                name,
                x01: {
                    darts: 0, points: 0, legs: 0, wins: 0,
                    first9Points: 0, first9Legs: 0,
                    count180: 0, countT80: 0, countTonPlus: 0, countTon: 0, count95: 0,
                    bestScore: 0, tonPointsSum: 0,
                    checkoutHits: 0, checkoutAttempts: 0, highOut: 0,
                    ranges: {
                        '60_99': { c: 0, a: 0 },
                        '100_139': { c: 0, a: 0 },
                        '140_160': { c: 0, a: 0 },
                        '161_plus': { c: 0, a: 0 }
                    }
                },
                cricket: {
                    darts: 0, marks: 0, legs: 0, wins: 0,
                    totalRounds: 0, missRounds: 0,
                    m5: 0, m6: 0, m7: 0, m8: 0, m9: 0,
                    bulls3: 0, bulls4: 0, bulls5: 0, bulls6: 0,
                    hatTricks: 0,
                    co: { '5m': 0, '6m': 0, '7m': 0, '8m': 0, '9m': 0, total: 0 }
                }
            };
        }
        return players[name];
    };

    (state.match?.games || []).forEach(game => {
        const lookup = sideLookup(game);
        (game.legs || []).forEach(leg => {
            const cricket = isCricket(game, leg);
            Object.entries(legStats(leg, game)).forEach(([name, stats]) => {
                if (!name || name === 'undefined') return;
                const side = stats.side || lookup[normalizeName(name)];
                if (side === 'home') homeNames.add(name);
                else if (side === 'away') awayNames.add(name);
                const p = ensure(name);
                const isWinner = leg.winner === side;
                if (cricket) {
                    p.cricket.darts += Number(stats.darts) || 0;
                    p.cricket.marks += Number(stats.marks ?? stats.total_marks) || 0;
                    p.cricket.legs += 1;
                    if (isWinner) p.cricket.wins += 1;
                } else {
                    p.x01.darts += Number(stats.darts) || 0;
                    p.x01.points += Number(stats.points ?? stats.points_scored) || 0;
                    p.x01.legs += 1;
                    if (isWinner) p.x01.wins += 1;
                }
            });
        });
    });

    forEachLegThrow(({ td, name, side, cricket, round, leg, isLastThrow }) => {
        if (side === 'home') homeNames.add(name);
        else awayNames.add(name);
        const p = ensure(name);

        if (cricket) {
            const marks = Number(td.marks) || 0;
            p.cricket.totalRounds += 1;
            if (marks === 0) p.cricket.missRounds += 1;
            if (marks >= 9) p.cricket.m9 += 1;
            else if (marks >= 8) p.cricket.m8 += 1;
            else if (marks >= 7) p.cricket.m7 += 1;
            else if (marks >= 6) p.cricket.m6 += 1;
            else if (marks >= 5) p.cricket.m5 += 1;
            const bulls = Number(td.bulls) || 0;
            if (bulls >= 6) p.cricket.bulls6 += 1;
            else if (bulls >= 5) p.cricket.bulls5 += 1;
            else if (bulls >= 4) p.cricket.bulls4 += 1;
            else if (bulls >= 3) p.cricket.bulls3 += 1;
            if ((Number(td.triples) || 0) >= 3) p.cricket.hatTricks += 1;
            if (isLastThrow && leg.winner === side && marks >= 5 && marks <= 9) {
                p.cricket.co[`${marks}m`] += 1;
                p.cricket.co.total += 1;
            }
        } else {
            const score = Number(td.score) || 0;
            if (round != null && round <= 3) {
                p.x01.first9Points += score;
                if (round === 1) p.x01.first9Legs += 1;
            }
            if (score >= 180) p.x01.count180 += 1;
            else if (score >= 171) p.x01.countT80 += 1;
            else if (score >= 140) p.x01.countTonPlus += 1;
            else if (score >= 100) p.x01.countTon += 1;
            else if (score >= 95) p.x01.count95 += 1;
            if (score > p.x01.bestScore) p.x01.bestScore = score;
            if (score >= 100) p.x01.tonPointsSum += score;

            const remaining = td.remaining;
            if (remaining !== undefined && remaining !== null && score > 0) {
                const before = remaining + score;
                if (td.checkout || remaining === 0) {
                    p.x01.checkoutHits += 1;
                    if (score > p.x01.highOut) p.x01.highOut = score;
                }
                if (before >= 2 && before <= 170) p.x01.checkoutAttempts += 1;
                const range = getCheckoutRange(before);
                if (range) {
                    p.x01.ranges[range].a += 1;
                    if (td.checkout || remaining === 0) p.x01.ranges[range].c += 1;
                }
            }
        }
    });

    return { players: Object.values(players), homeNames, awayNames };
}

function leaderRows(players, cellsFn) {
    return players.map((p, idx) => {
        const rank = idx + 1;
        const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        return `<tr><td class="mhv-rank ${rankCls}">${rank}</td>${nameCell(p.name, p.side)}${cellsFn(p)}</tr>`;
    });
}

function renderLeaders() {
    if (!els.leaders) return;
    const games = state.match?.games || [];
    if (!games.some(game => (game.legs || []).length)) {
        els.leaders.innerHTML = '<div class="mhv-empty">Leaders populate once legs are recorded for this match.</div>';
        return;
    }

    const agg = aggregateLeaders();
    const withSide = agg.players.map(p => ({ ...p, side: agg.homeNames.has(p.name) ? 'home' : 'away' }));
    const x01Players = withSide.filter(p => p.x01.legs > 0);
    const cricketPlayers = withSide.filter(p => p.cricket.legs > 0);
    const get3da = p => (p.x01.darts > 0 ? (p.x01.points / p.x01.darts) * 3 : 0);
    const getMpr = p => (p.cricket.darts > 0 ? p.cricket.marks / (p.cricket.darts / 3) : 0);

    const x01Sections = [];
    if (x01Players.length) {
        const byAvg = [...x01Players].sort((a, b) => get3da(b) - get3da(a));
        x01Sections.push(statTable("'01 Leaders", ['#', 'Player', '3DA', 'F9', 'W-L', 'Darts', 'High', 'High Out'],
            leaderRows(byAvg, p => {
                const f9 = p.x01.first9Legs > 0 ? ((p.x01.first9Points / (p.x01.first9Legs * 9)) * 3).toFixed(1) : '-';
                return `<td>${get3da(p).toFixed(1)}</td><td>${f9}</td><td>${p.x01.wins}-${p.x01.legs - p.x01.wins}</td><td>${p.x01.darts}</td><td>${dashVal(p.x01.bestScore)}</td><td>${dashVal(p.x01.highOut)}</td>`;
            })));

        const tonTotal = p => p.x01.count180 + p.x01.countT80 + p.x01.countTonPlus + p.x01.countTon;
        const byTons = [...x01Players].sort((a, b) => (tonTotal(b) - tonTotal(a)) || (b.x01.tonPointsSum - a.x01.tonPointsSum));
        x01Sections.push(statTable("'01 Ton Counts", ['#', 'Player', '95+', 'Ton', 'Ton+', 'T80', '180', 'Ton Pts'],
            leaderRows(byTons, p => `<td>${dashVal(p.x01.count95)}</td><td>${dashVal(p.x01.countTon)}</td><td>${dashVal(p.x01.countTonPlus)}</td><td>${dashVal(p.x01.countT80)}</td><td>${dashVal(p.x01.count180)}</td><td>${dashVal(p.x01.tonPointsSum)}</td>`)));

        const byOuts = [...x01Players].sort((a, b) => (b.x01.checkoutHits - a.x01.checkoutHits) || (b.x01.highOut - a.x01.highOut));
        x01Sections.push(statTable("'01 Checkout Ranges", ['#', 'Player', 'Outs', 'Att', 'CO%', '60-99', '100-139', '140-160', '161+'],
            leaderRows(byOuts, p => {
                const coPct = p.x01.checkoutAttempts > 0 ? `${Math.round((p.x01.checkoutHits / p.x01.checkoutAttempts) * 100)}%` : '-';
                const rangeCell = key => (p.x01.ranges[key].a ? `${p.x01.ranges[key].c}/${p.x01.ranges[key].a}` : '-');
                return `<td>${dashVal(p.x01.checkoutHits)}</td><td>${dashVal(p.x01.checkoutAttempts)}</td><td>${coPct}</td><td>${rangeCell('60_99')}</td><td>${rangeCell('100_139')}</td><td>${rangeCell('140_160')}</td><td>${rangeCell('161_plus')}</td>`;
            })));
    }

    const cricketSections = [];
    if (cricketPlayers.length) {
        const byMpr = [...cricketPlayers].sort((a, b) => getMpr(b) - getMpr(a));
        cricketSections.push(statTable('Cricket Leaders', ['#', 'Player', 'MPR', 'W-L', 'Darts', 'Marks', 'Miss%'],
            leaderRows(byMpr, p => {
                const missPct = p.cricket.totalRounds > 0 ? `${Math.round((p.cricket.missRounds / p.cricket.totalRounds) * 100)}%` : '-';
                return `<td>${getMpr(p).toFixed(2)}</td><td>${p.cricket.wins}-${p.cricket.legs - p.cricket.wins}</td><td>${p.cricket.darts}</td><td>${p.cricket.marks}</td><td>${missPct}</td>`;
            })));

        const m5Total = p => p.cricket.m5 + p.cricket.m6 + p.cricket.m7 + p.cricket.m8 + p.cricket.m9;
        const by5m = [...cricketPlayers].sort((a, b) => m5Total(b) - m5Total(a));
        cricketSections.push(statTable('Cricket 5M+ Rounds', ['#', 'Player', '5M', '6M', '7M', '8M', '9M', 'Total'],
            leaderRows(by5m, p => `<td>${dashVal(p.cricket.m5)}</td><td>${dashVal(p.cricket.m6)}</td><td>${dashVal(p.cricket.m7)}</td><td>${dashVal(p.cricket.m8)}</td><td>${dashVal(p.cricket.m9)}</td><td>${dashVal(m5Total(p))}</td>`)));

        const byCloseouts = [...cricketPlayers].sort((a, b) => b.cricket.co.total - a.cricket.co.total);
        cricketSections.push(statTable('Cricket Closeouts', ['#', 'Player', '9M', '8M', '7M', '6M', '5M', 'Total'],
            leaderRows(byCloseouts, p => `<td>${dashVal(p.cricket.co['9m'])}</td><td>${dashVal(p.cricket.co['8m'])}</td><td>${dashVal(p.cricket.co['7m'])}</td><td>${dashVal(p.cricket.co['6m'])}</td><td>${dashVal(p.cricket.co['5m'])}</td><td>${dashVal(p.cricket.co.total)}</td>`)));

        const bullTotal = p => p.cricket.bulls3 + p.cricket.bulls4 + p.cricket.bulls5 + p.cricket.bulls6;
        const byBulls = [...cricketPlayers].sort((a, b) => (bullTotal(b) - bullTotal(a)) || (b.cricket.hatTricks - a.cricket.hatTricks));
        cricketSections.push(statTable('Cricket Bulls & Hat Tricks', ['#', 'Player', '3B', '4B', '5B', '6B', 'Hat Tricks'],
            leaderRows(byBulls, p => `<td>${dashVal(p.cricket.bulls3)}</td><td>${dashVal(p.cricket.bulls4)}</td><td>${dashVal(p.cricket.bulls5)}</td><td>${dashVal(p.cricket.bulls6)}</td><td>${dashVal(p.cricket.hatTricks)}</td>`)));
    }

    const x01Html = x01Sections.join('') || '<div class="mhv-empty">No \'01 legs recorded in this match.</div>';
    const cricketHtml = cricketSections.join('') || '<div class="mhv-empty">No cricket legs recorded in this match.</div>';
    els.leaders.innerHTML = `
        <div class="mhv-subtabs">
            <button type="button" class="active" data-subtab="x01">'01</button>
            <button type="button" data-subtab="cricket">Cricket</button>
        </div>
        <div class="mhv-subpane active" data-subpane="x01">${x01Html}</div>
        <div class="mhv-subpane" data-subpane="cricket">${cricketHtml}</div>
    `;
}

function initSubtabs(container) {
    container?.addEventListener('click', event => {
        const btn = event.target.closest('[data-subtab]');
        if (!btn) return;
        container.querySelectorAll('[data-subtab]').forEach(item => item.classList.toggle('active', item === btn));
        container.querySelectorAll('[data-subpane]').forEach(pane => pane.classList.toggle('active', pane.dataset.subpane === btn.dataset.subtab));
    });
}

function renderPerformance(summary) {
    // Pre-match: show league-season stats for each rostered player
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

    // Post-match: show match-aggregate stats from throws data
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
        els.leagueMatchLink.href = `/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    }
    const h2h = headToHeadSummary();
    const meetings = h2h.meetings.slice(0, 3);
    const completed = (match.games || []).filter(game => game?.status === 'completed').length;
    const matchFormat = state.league?.match_format || [];
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
    if (!matchId) throw new Error('No match selected — open a match from the schedule.');
    const [leagueSnap, matchSnap, matchesSnap, teamsSnap, playersSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)).catch(() => null),
        getDoc(doc(db, 'leagues', leagueId, 'matches', matchId)),
        getDocs(collection(db, 'leagues', leagueId, 'matches')).catch(() => ({ docs: [] })),
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
    renderAwards();
    renderLeaders();
    renderRosters();
    renderContext(summary);
}

async function init() {
    initTabs();
    initSetToggles();
    initSubtabs(els.awards);
    initSubtabs(els.leaders);
    try {
        await loadData();
        renderAll();
    } catch (error) {
        console[/^No (team|match|tournament) selected/.test(error?.message||'') ? 'info' : 'error']('[match-hub-vnext]:', error?.message || error);
        els.hero.innerHTML = `<div class="mhv-empty">${escapeHtml(error.message || 'Could not load match report.')}</div>`;
        els.score.innerHTML = '';
        // No-param state: hide the empty report tab shell so only the friendly card shows
        if (/^No (team|match|tournament) selected/.test(error?.message || '')) {
            document.querySelector('.mhv-view-card')?.setAttribute('hidden', '');
        }
    }
}

init();
