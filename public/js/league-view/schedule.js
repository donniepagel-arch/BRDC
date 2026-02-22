/**
 * League View - Schedule Module
 *
 * Handles schedule tab rendering and match card loading
 */

import { state, ensurePlayersLoaded, ensureStatsLoaded, ensureTeamRecordsCalculated, getTeamRoster, getTeamStanding } from '/js/league-view/app.js';
import { getOrdinal, getTeamName, getPlayerName, getTeamRecord } from '/js/league-view/helpers.js';
// get3DA and getMPR are globals from /js/stats-helpers.js (loaded via script tag)

// Common nickname → full name mappings
const NICKNAMES = {
    'matt': 'matthew', 'nate': 'nathan', 'jenn': 'jennifer', 'dave': 'david',
    'dom': 'dominick', 'steph': 'stephanie', 'mike': 'michael', 'ed': 'eddie',
    'chris': 'christopher', 'joe': 'joseph', 'josh': 'joshua', 'nick': 'nicholas',
    'dan': 'daniel', 'tony': 'anthony', 'bob': 'robert', 'bill': 'william'
};

/**
 * Fuzzy match a game-data name to a registered player.
 * Handles: exact match, nicknames (Matt→Matthew), abbreviations (Kevin Y→Kevin Yasenchak),
 * and minor typos (Olschanskey→Olschansky).
 */
function fuzzyMatchPlayer(gameName, players) {
    if (!gameName || !players.length) return null;
    const gn = gameName.trim().toLowerCase();

    // 1. Exact match
    const exact = players.find(p => p.name && p.name.toLowerCase() === gn);
    if (exact) return exact;

    const gParts = gn.split(/\s+/);
    const gFirst = gParts[0];
    const gLast = gParts.length > 1 ? gParts.slice(1).join(' ') : '';

    // Expand nickname for first name
    const gFirstExpanded = NICKNAMES[gFirst] || null;

    let bestMatch = null;
    let bestScore = 0;

    for (const p of players) {
        if (!p.name) continue;
        const pn = p.name.toLowerCase();
        const pParts = pn.split(/\s+/);
        const pFirst = pParts[0];
        const pLast = pParts.length > 1 ? pParts.slice(1).join(' ') : '';

        // 2. Nickname first name + last name match
        if (gLast && pLast) {
            // "Matt Wentz" → "Matthew Wentz": nickname match + exact last
            if (pLast === gLast && (gFirstExpanded === pFirst || (NICKNAMES[pFirst] && NICKNAMES[pFirst] === gFirst))) {
                return p; // Strong match
            }
        }

        // 3. Abbreviated last name: "Kevin Y" → "Kevin Yasenchak"
        if (gLast && gLast.length <= 2 && pLast && pLast.startsWith(gLast)) {
            if (pFirst === gFirst || pFirst.startsWith(gFirst) || gFirst.startsWith(pFirst) ||
                gFirstExpanded === pFirst || NICKNAMES[pFirst] === gFirst) {
                return p;
            }
        }

        // 4. First name match + last name starts-with (handles typos in last name)
        if (gLast && pLast && gLast.length >= 3 && pLast.length >= 3) {
            const firstMatch = pFirst === gFirst || pFirst.startsWith(gFirst) || gFirst.startsWith(pFirst) ||
                gFirstExpanded === pFirst || NICKNAMES[pFirst] === gFirst;
            if (firstMatch) {
                // Check if last names are close (one starts with the other, or differ by ≤2 chars)
                if (pLast.startsWith(gLast.substring(0, 3)) || gLast.startsWith(pLast.substring(0, 3))) {
                    const score = gLast.length + gFirst.length; // Longer match = better
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = p;
                    }
                }
            }
        }

        // 5. Single-word abbreviated name: "Eddie O" where gLast is just initial
        // Already handled in step 3 above
    }

    return bestMatch;
}

export function renderSchedule() {
    if (state.matches.length === 0) {
        return `<div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <div>Schedule not generated yet</div>
        </div>`;
    }

    // Group matches by week
    const weeks = {};
    state.matches.forEach(m => {
        const week = m.week || 1;
        if (!weeks[week]) weeks[week] = [];
        weeks[week].push(m);
    });

    // Calculate total weeks and find current/most recent week
    const totalWeeks = Math.max(...Object.keys(weeks).map(Number));

    // Find first upcoming week (has scheduled matches) or most recent completed
    let upcomingWeek = null;
    let lastCompletedWeek = 1;
    Object.keys(weeks).sort((a, b) => a - b).forEach(w => {
        const weekMatches = weeks[w];
        const hasScheduled = weekMatches.some(m => m.status === 'scheduled');
        const hasCompleted = weekMatches.some(m => m.status === 'completed');

        if (hasCompleted) {
            lastCompletedWeek = parseInt(w);
        }
        if (hasScheduled && upcomingWeek === null) {
            upcomingWeek = parseInt(w);
        }
    });

    // Default to upcoming week, or last completed if no upcoming
    const currentWeek = upcomingWeek || lastCompletedWeek;

    // Set initial selected week only on first render (when null)
    if (state.selectedWeek === null) {
        state.selectedWeek = currentWeek;
    }

    // Build week selector with dates
    const weekOptions = Object.keys(weeks).sort((a, b) => a - b).map(w => {
        const firstMatch = weeks[w][0];
        const rawDate = firstMatch?.match_date || firstMatch?.date || '';
        // Format date without year (e.g., "Jan 14" from "2026-01-14")
        let dateStr = '';
        if (rawDate) {
            const d = new Date(rawDate + 'T00:00:00'); // Add time to avoid timezone issues
            if (!isNaN(d.getTime())) {
                dateStr = ` - ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
        }
        return `<option value="${w}" ${parseInt(w) === state.selectedWeek ? 'selected' : ''}>Week ${w}${dateStr}</option>`;
    }).join('');

    // Build team selector
    const teamOptions = state.teams.map(t =>
        `<option value="${t.id}" ${t.id === state.selectedTeamFilter ? 'selected' : ''}>${getTeamName(t)}</option>`
    ).join('');

    // Get week date
    const weekMatches = weeks[state.selectedWeek] || [];
    const weekDate = weekMatches[0]?.match_date || '';

    const filtersHtml = `
        <div class="schedule-filters" role="group" aria-label="Schedule filters">
            <div class="filter-group">
                <label class="filter-label" for="weekSelector">WEEK</label>
                <select class="filter-select" id="weekSelector" onchange="changeWeek(this.value)" aria-label="Filter by week">
                    ${weekOptions}
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label" for="teamSelector">TEAM</label>
                <select class="filter-select" id="teamSelector" onchange="changeTeamFilter(this.value)" aria-label="Filter by team">
                    <option value="all" ${state.selectedTeamFilter === 'all' ? 'selected' : ''}>All Teams</option>
                    ${teamOptions}
                </select>
            </div>
        </div>
    `;

    // Filter by team if selected
    const filteredMatches = state.selectedTeamFilter === 'all'
        ? weekMatches
        : weekMatches.filter(m => m.home_team_id === state.selectedTeamFilter || m.away_team_id === state.selectedTeamFilter);

    // Detect bye teams for this week
    const weekTeamIds = new Set();
    weekMatches.forEach(m => {
        weekTeamIds.add(m.home_team_id);
        weekTeamIds.add(m.away_team_id);
    });
    const byeTeams = state.teams.filter(t => !weekTeamIds.has(t.id));

    // Check if selected team has a bye
    const selectedTeamHasBye = state.selectedTeamFilter !== 'all' && byeTeams.some(t => t.id === state.selectedTeamFilter);

    // Build match cards HTML
    let matchCardsHtml = '';
    if (filteredMatches.length === 0 && !selectedTeamHasBye) {
        matchCardsHtml = `<div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">No matches for selected filter</div>
        </div>`;
    } else {
        matchCardsHtml = filteredMatches.map((m, idx) => {
            return `<div class="match-card" id="matchCard${idx}" data-match-id="${m.id}" data-week="${state.selectedWeek}" data-total-weeks="${totalWeeks}">
                        <div class="skeleton-header" style="padding: 14px;">
                            <div class="skeleton skeleton-title" style="width: 40%;"></div>
                            <div class="skeleton skeleton-badge"></div>
                            <div class="skeleton skeleton-title" style="width: 40%;"></div>
                        </div>
                        <div class="skeleton skeleton-score" style="margin: 12px auto;"></div>
                        <div class="skeleton-roster" style="padding: 0 14px 14px;">
                            <div class="skeleton-player"><div class="skeleton skeleton-level"></div><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                            <div class="skeleton-player"><div class="skeleton skeleton-level"></div><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                            <div class="skeleton-player"><div class="skeleton skeleton-level"></div><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                        </div>
                    </div>`;
        }).join('');

        // Add bye cards when appropriate
        if (state.selectedTeamFilter === 'all' && byeTeams.length > 0) {
            // Show all bye teams in "all teams" view
            byeTeams.forEach((team, idx) => {
                matchCardsHtml += `<div class="bye-card" id="byeCard${idx}" data-team-id="${team.id}">
                    <div class="bye-card-header">
                        <div class="skeleton skeleton-title" style="width: 60%; margin: 0 auto;"></div>
                        <div class="skeleton skeleton-badge" style="margin: 8px auto 0;"></div>
                    </div>
                    <div class="bye-roster">
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                    </div>
                </div>`;
            });
        } else if (selectedTeamHasBye) {
            // Show single bye card for filtered team
            const byeTeam = byeTeams.find(t => t.id === state.selectedTeamFilter);
            if (byeTeam) {
                matchCardsHtml += `<div class="bye-card" id="byeCard0" data-team-id="${byeTeam.id}">
                    <div class="bye-card-header">
                        <div class="skeleton skeleton-title" style="width: 60%; margin: 0 auto;"></div>
                        <div class="skeleton skeleton-badge" style="margin: 8px auto 0;"></div>
                    </div>
                    <div class="bye-roster">
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                        <div class="skeleton-player"><div class="skeleton skeleton-name"></div><div class="skeleton skeleton-stats"></div></div>
                    </div>
                </div>`;
            }
        }
    }

    const weekHtml = `
        <div class="week-card" id="weekCard${state.selectedWeek}">
            <div class="week-header">
                <span class="week-title">WEEK ${state.selectedWeek} OF ${totalWeeks}</span>
                <span class="week-date">${weekDate}</span>
            </div>
            <div class="week-matches" id="weekMatches" role="region" aria-label="Matches for week ${state.selectedWeek}">
                ${matchCardsHtml}
            </div>
        </div>
    `;

    return filtersHtml + weekHtml;
}

export function reloadScheduleView() {
    const scheduleTab = document.getElementById('scheduleTab');
    if (scheduleTab) {
        scheduleTab.innerHTML = renderSchedule();
        loadAllMatchCards();
    }
}

// Load match cards for current week view
export async function loadAllMatchCards() {
    // Group matches by week
    const weeks = {};
    state.matches.forEach(m => {
        const week = m.week || 1;
        if (!weeks[week]) weeks[week] = [];
        weeks[week].push(m);
    });

    // Get matches for selected week
    const weekMatches = weeks[state.selectedWeek] || [];

    // Filter by team if selected
    const filteredMatches = state.selectedTeamFilter === 'all'
        ? weekMatches
        : weekMatches.filter(m => m.home_team_id === state.selectedTeamFilter || m.away_team_id === state.selectedTeamFilter);

    // Load each match card
    for (let idx = 0; idx < filteredMatches.length; idx++) {
        await loadLeagueMatchCard(idx, filteredMatches[idx]);
    }

    // Detect bye teams for this week
    const weekTeamIds = new Set();
    weekMatches.forEach(m => {
        weekTeamIds.add(m.home_team_id);
        weekTeamIds.add(m.away_team_id);
    });
    const byeTeams = state.teams.filter(t => !weekTeamIds.has(t.id));

    // Load bye cards
    if (state.selectedTeamFilter === 'all' && byeTeams.length > 0) {
        // Load all bye teams in "all teams" view
        for (let idx = 0; idx < byeTeams.length; idx++) {
            await loadByeCard(idx, byeTeams[idx]);
        }
    } else if (state.selectedTeamFilter !== 'all') {
        // Check if selected team has a bye
        const byeTeam = byeTeams.find(t => t.id === state.selectedTeamFilter);
        if (byeTeam) {
            await loadByeCard(0, byeTeam);
        }
    }
}

// Load a single match card for the league schedule view
export async function loadLeagueMatchCard(idx, match) {
    const cardEl = document.getElementById(`matchCard${idx}`);
    if (!cardEl) return;

    const matchId = match.id;
    const week = match.week || 1;
    const totalWeeks = parseInt(cardEl.dataset.totalWeeks) || 18;

    try {
        const homeTeamId = match.home_team_id;
        const awayTeamId = match.away_team_id;
        const matchStatus = match.status || 'scheduled';
        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;
        const homeLineup = match.home_lineup || [];
        const awayLineup = match.away_lineup || [];

        if (!homeTeamId || !awayTeamId) {
            cardEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);">Match info not available</div>';
            return;
        }

        // Find teams from loaded teams array
        const homeTeam = state.teams.find(t => t.id === homeTeamId) || {};
        const awayTeam = state.teams.find(t => t.id === awayTeamId) || {};

        // Use cached team records and standings
        ensureTeamRecordsCalculated();
        const homeRec = state.teamRecords[homeTeamId] || { wins: 0, losses: 0, ties: 0 };
        const awayRec = state.teamRecords[awayTeamId] || { wins: 0, losses: 0, ties: 0 };
        const homeRecord = getTeamRecord(homeRec);
        const awayRecord = getTeamRecord(awayRec);
        const homeStanding = getTeamStanding(homeTeamId);
        const awayStanding = getTeamStanding(awayTeamId);

        // Calculate Win% for each team
        const homeSetWins = homeRec.gamesWon || 0;
        const homeSetLosses = homeRec.gamesLost || 0;
        const homeWinPct = (homeSetWins + homeSetLosses) > 0 ? Math.round((homeSetWins / (homeSetWins + homeSetLosses)) * 100) + '%' : '-';

        const awaySetWins = awayRec.gamesWon || 0;
        const awaySetLosses = awayRec.gamesLost || 0;
        const awayWinPct = (awaySetWins + awaySetLosses) > 0 ? Math.round((awaySetWins / (awaySetWins + awaySetLosses)) * 100) + '%' : '-';

        // Use cached players
        await ensurePlayersLoaded();
        const homeRoster = getTeamRoster(homeTeamId);
        const awayRoster = getTeamRoster(awayTeamId);

        // Build display roster with fill-ins
        const homeDisplayRoster = [...homeRoster];
        const awayDisplayRoster = [...awayRoster];
        const homeOutPlayers = [];
        const awayOutPlayers = [];

        if (matchStatus === 'completed') {
            // Process home lineup for fill-ins
            homeLineup.forEach(lineupEntry => {
                if (lineupEntry.is_sub && lineupEntry.player_id && lineupEntry.replacing_player_id) {
                    const fillInPlayer = state.allPlayersById[lineupEntry.player_id];
                    if (fillInPlayer) {
                        const replacingIdx = homeDisplayRoster.findIndex(p => p.id === lineupEntry.replacing_player_id);
                        if (replacingIdx !== -1) {
                            const outPlayer = homeDisplayRoster[replacingIdx];
                            homeOutPlayers.push({ ...outPlayer, isOut: true });
                            homeDisplayRoster[replacingIdx] = {
                                ...fillInPlayer,
                                isFillIn: true,
                                position: outPlayer.position
                            };
                        }
                    }
                }
            });

            // Process away lineup for fill-ins
            awayLineup.forEach(lineupEntry => {
                if (lineupEntry.is_sub && lineupEntry.player_id && lineupEntry.replacing_player_id) {
                    const fillInPlayer = state.allPlayersById[lineupEntry.player_id];
                    if (fillInPlayer) {
                        const replacingIdx = awayDisplayRoster.findIndex(p => p.id === lineupEntry.replacing_player_id);
                        if (replacingIdx !== -1) {
                            const outPlayer = awayDisplayRoster[replacingIdx];
                            awayOutPlayers.push({ ...outPlayer, isOut: true });
                            awayDisplayRoster[replacingIdx] = {
                                ...fillInPlayer,
                                isFillIn: true,
                                position: outPlayer.position
                            };
                        }
                    }
                }
            });

            homeDisplayRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
            awayDisplayRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
        }

        // Auto-detect fill-ins from games data when no lineup arrays exist
        if (matchStatus === 'completed' && homeLineup.length === 0 && awayLineup.length === 0 && match.games && match.games.length > 0) {
            const allPlayers = Object.values(state.allPlayersById);
            const teamSize = state.leagueData?.team_size || 3;

            // Collect all player names who actually played for each side
            const homePlayedNames = new Set();
            const awayPlayedNames = new Set();
            match.games.forEach(game => {
                (game.home_players || []).forEach(p => {
                    const name = typeof p === 'string' ? p : (p && p.name);
                    if (name) homePlayedNames.add(name);
                });
                (game.away_players || []).forEach(p => {
                    const name = typeof p === 'string' ? p : (p && p.name);
                    if (name) awayPlayedNames.add(name);
                });
            });

            // Resolve each game-data name to a league player using fuzzy matching
            const resolvePlayedRoster = (playedNames, teamRoster, displayRoster, outPlayers) => {
                const rosterIds = new Set(teamRoster.map(p => p.id));
                const matchedRosterIds = new Set();
                const fillIns = [];

                playedNames.forEach(gameName => {
                    // Try to match against team roster first
                    const rosterMatch = fuzzyMatchPlayer(gameName, teamRoster);
                    if (rosterMatch) {
                        matchedRosterIds.add(rosterMatch.id);
                        return;
                    }
                    // Try to match against ALL league players (could be fill-in from another team or pool)
                    const leagueMatch = fuzzyMatchPlayer(gameName, allPlayers);
                    if (leagueMatch && !rosterIds.has(leagueMatch.id)) {
                        fillIns.push(leagueMatch);
                    }
                });

                // Determine which roster players did NOT play (weren't matched by any game name)
                const unmatchedRoster = teamRoster.filter(p => !matchedRosterIds.has(p.id));

                // For each fill-in, replace an unmatched roster player
                fillIns.forEach(fillIn => {
                    // Prefer replacing unmatched players with the same position
                    let outIdx = displayRoster.findIndex(p =>
                        unmatchedRoster.some(u => u.id === p.id)
                    );
                    if (outIdx !== -1) {
                        const outPlayer = displayRoster[outIdx];
                        outPlayers.push({ ...outPlayer, isOut: true });
                        displayRoster[outIdx] = { ...fillIn, isFillIn: true, position: outPlayer.position };
                        // Remove from unmatched so next fill-in picks a different one
                        const uIdx = unmatchedRoster.findIndex(u => u.id === outPlayer.id);
                        if (uIdx !== -1) unmatchedRoster.splice(uIdx, 1);
                    }
                });

                // If roster has more players than team_size and no fill-ins replaced them,
                // trim to only the players who actually played (for teams with alternates)
                if (displayRoster.length > teamSize && fillIns.length === 0 && matchedRosterIds.size > 0) {
                    // Keep only matched roster players, up to teamSize
                    const kept = displayRoster.filter(p => matchedRosterIds.has(p.id));
                    if (kept.length >= teamSize) {
                        displayRoster.length = 0;
                        kept.slice(0, teamSize).forEach(p => displayRoster.push(p));
                    }
                }
            };

            resolvePlayedRoster(homePlayedNames, homeRoster, homeDisplayRoster, homeOutPlayers);
            resolvePlayedRoster(awayPlayedNames, awayRoster, awayDisplayRoster, awayOutPlayers);

            homeDisplayRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
            awayDisplayRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
        }

        // Use cached stats
        await ensureStatsLoaded();
        const playerStats = {};
        const playerIds = [...homeDisplayRoster.map(p => p.id), ...awayDisplayRoster.map(p => p.id)].filter(Boolean);
        playerIds.forEach(playerId => {
            if (state.allStatsById[playerId]) {
                playerStats[playerId] = state.allStatsById[playerId];
            }
        });

        // Calculate team averages
        const calcTeam3DA = (roster) => {
            const avgs = roster.map(p => get3DA(playerStats[p.id] || {}) || 0).filter(v => v > 0);
            if (avgs.length === 0) return null;
            return avgs.reduce((a, b) => a + b, 0) / avgs.length;
        };
        const calcTeamMPR = (roster) => {
            const mprs = roster.map(p => getMPR(playerStats[p.id] || {}) || 0).filter(v => v > 0);
            if (mprs.length === 0) return null;
            return mprs.reduce((a, b) => a + b, 0) / mprs.length;
        };

        const homeTeam3DA = calcTeam3DA(homeDisplayRoster);
        const awayTeam3DA = calcTeam3DA(awayDisplayRoster);
        const homeTeamMPR = calcTeamMPR(homeDisplayRoster);
        const awayTeamMPR = calcTeamMPR(awayDisplayRoster);

        // Determine winner for completed matches
        const isCompleted = matchStatus === 'completed';
        const homeWon = isCompleted && homeScore > awayScore;
        const awayWon = isCompleted && awayScore > homeScore;

        // Compare stat values
        const compareValues = (leftVal, rightVal) => {
            if (!leftVal || !rightVal) return { left: '', right: '' };
            if (Math.abs(leftVal - rightVal) < 0.1) return { left: '', right: '' };
            return leftVal > rightVal ? { left: 'better', right: 'worse' } : { left: 'worse', right: 'better' };
        };

        const team3DACompare = compareValues(homeTeam3DA, awayTeam3DA);
        const teamMPRCompare = compareValues(homeTeamMPR, awayTeamMPR);

        // Format team averages
        const home3DADisplay = homeTeam3DA ? homeTeam3DA.toFixed(1) : '-';
        const away3DADisplay = awayTeam3DA ? awayTeam3DA.toFixed(1) : '-';
        const homeMPRDisplay = homeTeamMPR ? homeTeamMPR.toFixed(2) : '-';
        const awayMPRDisplay = awayTeamMPR ? awayTeamMPR.toFixed(2) : '-';

        const buildTeamAvgHtml = (da, mpr, winPct, daClass, mprClass) => {
            return `<div class="match-team-avg"><span class="${daClass}">${da}</span> / <span class="${mprClass}">${mpr}</span> / ${winPct}</div>`;
        };

        // Build roster rows
        const maxPlayers = Math.max(homeDisplayRoster.length, awayDisplayRoster.length, 3);
        let rosterRows = '';

        for (let i = 0; i < maxPlayers; i++) {
            const homePlayer = homeDisplayRoster[i];
            const awayPlayer = awayDisplayRoster[i];

            const homeName = homePlayer ? getPlayerName(homePlayer) : '';
            const awayName = awayPlayer ? getPlayerName(awayPlayer) : '';
            const homePlayerStats = homePlayer ? playerStats[homePlayer.id] || {} : {};
            const awayPlayerStats = awayPlayer ? playerStats[awayPlayer.id] || {} : {};
            const homeCaptain = homePlayer && (homePlayer.is_captain || homePlayer.position === 1);
            const awayCaptain = awayPlayer && (awayPlayer.is_captain || awayPlayer.position === 1);
            const homeFillIn = homePlayer && homePlayer.isFillIn;
            const awayFillIn = awayPlayer && awayPlayer.isFillIn;

            const home3DA = get3DA(homePlayerStats);
            const away3DA = get3DA(awayPlayerStats);
            const homeMPR = getMPR(homePlayerStats);
            const awayMPR = getMPR(awayPlayerStats);

            const daCompare = (homePlayer && awayPlayer) ? compareValues(home3DA, away3DA) : { left: '', right: '' };
            const mprCompare = (homePlayer && awayPlayer) ? compareValues(homeMPR, awayMPR) : { left: '', right: '' };

            const home3DAStr = home3DA != null ? home3DA.toFixed(1) : '-';
            const homeMPRStr = homeMPR != null ? homeMPR.toFixed(2) : '-';
            const away3DAStr = away3DA != null ? away3DA.toFixed(1) : '-';
            const awayMPRStr = awayMPR != null ? awayMPR.toFixed(2) : '-';

            const homeNameClass = `match-player-name${homeCaptain ? ' captain' : ''}${homeFillIn ? ' fill-in' : ''}`;
            const awayNameClass = `match-player-name${awayCaptain ? ' captain' : ''}${awayFillIn ? ' fill-in' : ''}`;

            const homeLevel = homePlayer?.level || '';
            const awayLevel = awayPlayer?.level || '';
            const homeLevelBadge = homeLevel ? `<span class="player-level-badge level-${homeLevel.toLowerCase()}">${homeLevel}</span> ` : '';
            const awayLevelBadge = awayLevel ? ` <span class="player-level-badge level-${awayLevel.toLowerCase()}">${awayLevel}</span>` : '';

            rosterRows += `
                <div class="match-row">
                    <div class="match-player-cell left">
                        ${homeLevelBadge}
                        <span class="${homeNameClass}">${homeFillIn ? '<span class="fill-in-badge">SUB</span> ' : ''}${homeName}</span>
                        <span class="match-player-stats"><span class="${daCompare.left}">${home3DAStr}</span> / <span class="${mprCompare.left}">${homeMPRStr}</span></span>
                    </div>
                    <div class="match-player-cell right">
                        <span class="match-player-stats"><span class="${daCompare.right}">${away3DAStr}</span> / <span class="${mprCompare.right}">${awayMPRStr}</span></span>
                        <span class="${awayNameClass}">${awayName}${awayFillIn ? ' <span class="fill-in-badge">SUB</span>' : ''}</span>
                        ${awayLevelBadge}
                    </div>
                </div>`;
        }

        // Add OUT player rows
        const maxOutPlayers = Math.max(homeOutPlayers.length, awayOutPlayers.length);
        for (let i = 0; i < maxOutPlayers; i++) {
            const homeOutPlayer = homeOutPlayers[i];
            const awayOutPlayer = awayOutPlayers[i];

            const homeOutName = homeOutPlayer ? getPlayerName(homeOutPlayer) : '';
            const awayOutName = awayOutPlayer ? getPlayerName(awayOutPlayer) : '';
            const homeOutStats = homeOutPlayer ? playerStats[homeOutPlayer.id] || {} : {};
            const awayOutStats = awayOutPlayer ? playerStats[awayOutPlayer.id] || {} : {};

            const homeOut3DA = homeOutPlayer ? get3DA(homeOutStats) : null;
            const homeOutMPR = homeOutPlayer ? getMPR(homeOutStats) : null;
            const awayOut3DA = awayOutPlayer ? get3DA(awayOutStats) : null;
            const awayOutMPR = awayOutPlayer ? getMPR(awayOutStats) : null;

            const homeOut3DAStr = homeOut3DA != null ? homeOut3DA.toFixed(1) : '-.-';
            const homeOutMPRStr = homeOutMPR != null ? homeOutMPR.toFixed(2) : '-.--';
            const awayOut3DAStr = awayOutPlayer ? (awayOut3DA != null ? awayOut3DA.toFixed(1) : '-.-') : '-.-';
            const awayOutMPRStr = awayOutPlayer ? (awayOutMPR != null ? awayOutMPR.toFixed(2) : '-.--') : '-.--';

            rosterRows += `
                <div class="match-row out-row">
                    <div class="match-player-cell left">
                        <span class="match-player-stats out-stats">${homeOutPlayer ? homeOut3DAStr : '-.-'} / ${homeOutPlayer ? homeOutMPRStr : '-.--'}</span>
                        <span class="match-player-name out">${homeOutPlayer ? '<span class="out-badge">OUT</span> ' : ''}${homeOutName}</span>
                    </div>
                    <div class="match-player-cell right">
                        <span class="match-player-name out">${awayOutName}${awayOutPlayer ? ' <span class="out-badge">OUT</span>' : ''}</span>
                        <span class="match-player-stats out-stats">${awayOutPlayer ? awayOut3DAStr : '-.-'} / ${awayOutPlayer ? awayOutMPRStr : '-.--'}</span>
                    </div>
                </div>`;
        }

        // Render the card - home team always on left for league view (no user context)
        const homeTeamName = getTeamName(homeTeam);
        const awayTeamName = getTeamName(awayTeam);
        const matchStatusText = isCompleted ? `Final: ${homeTeamName} ${homeScore}, ${awayTeamName} ${awayScore}` : `Scheduled: ${homeTeamName} vs ${awayTeamName}`;

        cardEl.innerHTML = `
            <div class="match-card-header${isCompleted ? ' completed' : ''}" role="status" aria-label="${matchStatusText}">
                ${isCompleted ? `<div class="winner-star-slot" aria-hidden="true">${homeWon ? '<span class="winner-star">★</span>' : ''}</div>` : ''}
                <div class="match-team-side left${homeWon ? ' winner' : ''}">
                    <div class="match-team-name">${homeTeamName}</div>
                    <div class="match-team-meta-row">${homeStanding ? `<span class="match-team-standing">${getOrdinal(homeStanding)}</span>` : ''}<span class="match-team-record">${homeRecord}</span></div>
                    ${buildTeamAvgHtml(home3DADisplay, homeMPRDisplay, homeWinPct, team3DACompare.left, teamMPRCompare.left)}
                </div>
                ${isCompleted ? `<span class="match-header-score${homeWon ? ' winner' : ''}">${homeScore}</span>` : ''}
                <div class="match-center">
                    ${isCompleted ? `<div class="match-status">FINAL</div>` : `<div class="match-vs">VS</div>`}
                </div>
                ${isCompleted ? `<span class="match-header-score${awayWon ? ' winner' : ''}">${awayScore}</span>` : ''}
                <div class="match-team-side right${awayWon ? ' winner' : ''}">
                    <div class="match-team-name">${awayTeamName}</div>
                    <div class="match-team-meta-row">${awayStanding ? `<span class="match-team-standing">${getOrdinal(awayStanding)}</span>` : ''}<span class="match-team-record">${awayRecord}</span></div>
                    ${buildTeamAvgHtml(away3DADisplay, awayMPRDisplay, awayWinPct, team3DACompare.right, teamMPRCompare.right)}
                </div>
                ${isCompleted ? `<div class="winner-star-slot" aria-hidden="true">${awayWon ? '<span class="winner-star">★</span>' : ''}</div>` : ''}
            </div>
            <div class="match-card-body">
                ${rosterRows}
            </div>
            <div class="match-card-footer">
                <a href="/pages/team-profile.html?league_id=${state.leagueId}&team_id=${homeTeamId}" class="match-card-link" style="background: rgba(255,255,255,0.1); color: var(--teal);" aria-label="View ${homeTeamName} team profile">Team Info</a>
                ${isCompleted
                ? `<a href="/pages/match-hub.html?league_id=${state.leagueId}&match_id=${matchId}" class="match-card-link" aria-label="View match report for ${homeTeamName} vs ${awayTeamName}">View Report</a>`
                : `<a href="/pages/match-hub.html?league_id=${state.leagueId}&match_id=${matchId}" class="match-card-link" aria-label="Go to match hub for ${homeTeamName} vs ${awayTeamName}">Match Hub</a>`
            }
                <a href="/pages/team-profile.html?league_id=${state.leagueId}&team_id=${awayTeamId}" class="match-card-link" style="background: rgba(255,255,255,0.1); color: var(--teal);" aria-label="View ${awayTeamName} team profile">Team Info</a>
            </div>
        `;
    } catch (error) {
        console.error('Error loading match card:', error);
        cardEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Error loading match</div>';
    }
}

// Load a bye week card
export async function loadByeCard(idx, team) {
    const cardEl = document.getElementById(`byeCard${idx}`);
    if (!cardEl) return;

    try {
        const teamId = team.id;
        const teamName = getTeamName(team);
        const totalWeeks = state.matches.length > 0 ? Math.max(...state.matches.map(m => m.week || 1)) : 18;

        await ensurePlayersLoaded();
        await ensureStatsLoaded();
        const roster = getTeamRoster(team.id);
        const playerStats = {};
        roster.forEach(player => {
            if (state.allStatsById[player.id]) {
                playerStats[player.id] = state.allStatsById[player.id];
            }
        });

        // Build roster HTML
        let rosterHtml = '';
        roster.forEach(player => {
            const stats = playerStats[player.id] || {};
            const avg = get3DA(stats);
            const mpr = getMPR(stats);
            const avgStr = avg != null ? avg.toFixed(1) : '-';
            const mprStr = mpr != null ? mpr.toFixed(2) : '-';
            const playerName = getPlayerName(player);

            rosterHtml += `
                <div class="bye-player-row">
                    <span class="bye-player-name">${playerName}</span>
                    <span class="bye-player-stats">${avgStr} / ${mprStr}</span>
                </div>`;
        });

        // Render the bye card
        cardEl.innerHTML = `
            <div class="bye-card-header" role="status" aria-label="${teamName} has a bye week ${state.selectedWeek}">
                <div class="bye-team-name">${teamName}<span class="bye-badge">BYE</span></div>
                <div class="bye-label">WEEK ${state.selectedWeek} OF ${totalWeeks}</div>
            </div>
            <div class="bye-roster">
                ${rosterHtml}
            </div>
            <div class="bye-card-footer">
                <a href="/pages/team-profile.html?league_id=${state.leagueId}&team_id=${teamId}" class="match-card-link" style="background: rgba(255,255,255,0.1); color: var(--teal);" aria-label="View ${teamName} team profile">Team Info</a>
            </div>
        `;
    } catch (error) {
        console.error('Error loading bye card:', error);
        cardEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Error loading bye card</div>';
    }
}
