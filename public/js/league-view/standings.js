/**
 * League View - Standings Module
 *
 * Handles standings tab rendering and team expansion
 */

import { state, ensurePlayersLoaded, ensureStatsLoaded, ensureTeamRecordsCalculated, getTeamRoster } from '/js/league-view/app.js';

export async function initStandings() {
    const tabPanel = document.getElementById('standingsTab');
    if (!tabPanel) return;
    // Ensure container exists and clear any loading spinners
    if (!document.getElementById('standingsContainer')) {
        tabPanel.innerHTML = '<div id="standingsContainer"></div>';
    }
    let container = document.getElementById('standingsContainer');

    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Loading standings...</div></div>';
    // Remove any sibling loading spinners
    const spinner = tabPanel.querySelector('.tab-content-loading');
    if (spinner) spinner.remove();

    ensureTeamRecordsCalculated();
    await ensurePlayersLoaded();
    await ensureStatsLoaded();

    // Populate standingsData from cached data
    state.standingsData.leaguePlayers = { ...state.allPlayersById };
    state.standingsData.playerStats = { ...state.allStatsById };
    state.standingsData.teamStats = {};

    // Build teamStats from cached teamRecords
    state.teams.forEach(team => {
        const rec = state.teamRecords[team.id] || { wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 };
        state.standingsData.teamStats[team.id] = rec;
    });

    renderStandingsTable();
}

export function renderStandingsTable() {
    const container = document.getElementById('standingsContainer');
    if (!container) return;

    if (state.teams.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">🏆</div>
            <div>No standings available yet</div>
        </div>`;
        return;
    }

    // Build team data with stats
    const teamsWithStats = state.teams.map(t => {
        const rec = state.standingsData.teamStats[t.id] || { wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 };
        const players = getTeamPlayers(t);

        // Calculate team averages from player stats
        let totalMPR = 0, totalAvg = 0, playerCount = 0;
        players.forEach(p => {
            const stats = state.standingsData.playerStats[p.id];
            if (stats) {
                const mpr = getMPR(stats);
                const avg = get3DA(stats);
                if (mpr > 0) totalMPR += mpr;
                if (avg > 0) totalAvg += avg;
                if (mpr > 0 || avg > 0) playerCount++;
            }
        });

        const teamMPR = playerCount > 0 ? totalMPR / playerCount : 0;
        const teamAvg = playerCount > 0 ? totalAvg / playerCount : 0;

        return {
            ...t,
            ...rec,
            mpr: teamMPR,
            avg: teamAvg,
            players: players
        };
    });

    // Sort teams
    const sorted = sortTeams(teamsWithStats);

    // Assign ranks
    sorted.forEach((t, i) => t.rank = i + 1);

    // Render team standings
    renderByTeamView(container, sorted);
}

export function sortTeams(teamsArray) {
    const col = state.standingsData.sortColumn;
    const dir = state.standingsData.sortDirection === 'asc' ? 1 : -1;

    return [...teamsArray].sort((a, b) => {
        let aVal, bVal;

        switch (col) {
            case 'rank':
            case 'wins':
                // Default sort: wins desc, losses asc
                if (b.wins !== a.wins) return (b.wins - a.wins);
                if (a.losses !== b.losses) return (a.losses - b.losses);
                return (b.gamesWon - a.gamesWon);
            case 'losses':
                aVal = a.losses; bVal = b.losses;
                break;
            case 'sets':
                aVal = a.gamesWon || 0; bVal = b.gamesWon || 0;
                break;
            case 'mpr':
                aVal = a.mpr; bVal = b.mpr;
                break;
            case 'avg':
                aVal = a.avg; bVal = b.avg;
                break;
            case 'team':
                aVal = a.team_name?.toLowerCase() || '';
                bVal = b.team_name?.toLowerCase() || '';
                return dir * aVal.localeCompare(bVal);
            default:
                return 0;
        }

        return dir * (bVal - aVal);
    });
}

export function getTeamPlayers(team) {
    // First, try to get players from standingsData.leaguePlayers by team_id
    const playersFromLeague = Object.values(state.standingsData.leaguePlayers)
        .filter(p => p.team_id === team.id && !p.is_sub)
        .sort((a, b) => (a.position || 99) - (b.position || 99))
        .map(p => ({
            id: p.id,
            name: p.name || 'Unknown',
            level: p.level || '',
            isCaptain: team.captain_id === p.id
        }));

    if (playersFromLeague.length > 0) {
        return playersFromLeague;
    }

    // Fallback: check if team has embedded players array
    if (team.players?.length) {
        return team.players.map(p => ({
            id: p.id,
            name: p.name || 'Unknown',
            level: p.level || '',
            isCaptain: team.captain_id === p.id
        }));
    }

    // Fallback: use player_ids and player_names arrays
    const playerIds = team.player_ids || [];
    const playerNames = team.player_names || [];
    return playerIds.map((id, i) => ({
        id,
        name: playerNames[i] || 'Unknown',
        level: '',
        isCaptain: team.captain_id === id || i === 0
    }));
}

export function renderByTeamView(container, sortedTeams) {
    const expandAllActive = state.standingsData.expandAll;

    const headerHtml = `
        <div class="standings-controls">
            <button type="button" class="standings-toggle ${expandAllActive ? 'active' : ''}" onclick="toggleExpandAll()" aria-expanded="${expandAllActive}" aria-label="${expandAllActive ? 'Collapse all teams' : 'Expand all teams'}">
                <span class="standings-toggle-icon" aria-hidden="true">${expandAllActive ? '▼' : '▶'}</span>
                <span>${expandAllActive ? 'Collapse All' : 'Expand All'}</span>
            </button>
        </div>
    `;

    const getSortIcon = (col) => {
        if (state.standingsData.sortColumn === col) {
            return `<span class="sort-icon">${state.standingsData.sortDirection === 'asc' ? '▲' : '▼'}</span>`;
        }
        return '<span class="sort-icon">⬍</span>';
    };

    const tableHtml = `
        <div class="standings-section">
            <table class="standings-table" id="standingsTable" role="table" aria-label="Team standings">
                <caption class="sr-only">Team standings table with wins, losses, sets, MPR and 3DA statistics</caption>
                <thead>
                    <tr>
                        <th scope="col" style="width: 50px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'rank' ? 'sorted' : ''}" onclick="sortStandings('rank')">
                            <button type="button" class="sort-btn" aria-label="Sort by rank"># <span aria-hidden="true">${getSortIcon('rank')}</span></button>
                        </th>
                        <th scope="col" class="sortable ${state.standingsData.sortColumn === 'team' ? 'sorted' : ''}" onclick="sortStandings('team')">
                            <button type="button" class="sort-btn" aria-label="Sort by team name">Team <span aria-hidden="true">${getSortIcon('team')}</span></button>
                        </th>
                        <th scope="col" style="width: 50px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'wins' ? 'sorted' : ''}" onclick="sortStandings('wins')">
                            <button type="button" class="sort-btn" aria-label="Sort by wins">W <span aria-hidden="true">${getSortIcon('wins')}</span></button>
                        </th>
                        <th scope="col" style="width: 50px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'losses' ? 'sorted' : ''}" onclick="sortStandings('losses')">
                            <button type="button" class="sort-btn" aria-label="Sort by losses">L <span aria-hidden="true">${getSortIcon('losses')}</span></button>
                        </th>
                        <th scope="col" style="width: 60px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'sets' ? 'sorted' : ''}" onclick="sortStandings('sets')" title="Total Sets Won (1st Tiebreaker)">
                            <button type="button" class="sort-btn" aria-label="Sort by sets won">Sets <span aria-hidden="true">${getSortIcon('sets')}</span></button>
                        </th>
                        <th scope="col" style="width: 70px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'mpr' ? 'sorted' : ''}" onclick="sortStandings('mpr')">
                            <button type="button" class="sort-btn" aria-label="Sort by marks per round">MPR <span aria-hidden="true">${getSortIcon('mpr')}</span></button>
                        </th>
                        <th scope="col" style="width: 70px; text-align: center;" class="sortable ${state.standingsData.sortColumn === 'avg' ? 'sorted' : ''}" onclick="sortStandings('avg')">
                            <button type="button" class="sort-btn" aria-label="Sort by three dart average">3DA <span aria-hidden="true">${getSortIcon('avg')}</span></button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedTeams.map((t, idx) => renderTeamRow(t, idx)).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = headerHtml + tableHtml;
}

export function renderTeamRow(team, idx = 0) {
    const isExpanded = state.standingsData.expandAll || state.standingsData.expandedTeams.has(team.id);
    const rankClass = team.rank === 1 ? 'first' : team.rank === 2 ? 'second' : team.rank === 3 ? 'third' : '';
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

    const teamRowHtml = `
        <tr class="standings-team-row ${isExpanded ? 'expanded' : ''} ${rowClass}" data-team-id="${team.id}" onclick="toggleTeamExpand('${team.id}', event)">
            <th scope="row" class="standings-rank ${rankClass}">${team.rank}</th>
            <td>
                <div class="team-name-cell">
                    <button type="button" class="team-expand-btn" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${team.team_name} roster" onclick="toggleTeamExpand('${team.id}', event)">
                        <span class="team-expand-icon" aria-hidden="true">▶</span>
                    </button>
                    <a href="/pages/team-profile.html?team_id=${team.id}&league_id=${state.leagueId}" class="team-name-link" onclick="event.stopPropagation()">${team.team_name}</a>
                </div>
            </td>
            <td class="stat-value wins" style="text-align: center;">${team.wins}</td>
            <td class="stat-value losses" style="text-align: center;">${team.losses}</td>
            <td class="stat-value sets" style="text-align: center;">${team.gamesWon || 0}</td>
            <td class="stat-value mpr" style="text-align: center;">${team.mpr > 0 ? team.mpr.toFixed(2) : '-'}</td>
            <td class="stat-value avg" style="text-align: center;">${team.avg > 0 ? team.avg.toFixed(1) : '-'}</td>
        </tr>
    `;

    // Player rows
    const playerRowsHtml = `
        <tbody class="standings-player-rows ${isExpanded ? 'expanded' : ''}" data-team-players="${team.id}">
            ${team.players.map(p => {
        const stats = state.standingsData.playerStats[p.id] || {};
        const mpr = getMPR(stats);
        const avg = get3DA(stats);
        const wins = stats.league_wins || stats.wins || 0;
        const losses = stats.league_losses || stats.losses || 0;
        const levelClass = p.level ? `level-${p.level.toLowerCase()}` : '';

        return `
                    <tr class="standings-player-row">
                        <td></td>
                        <th scope="row">
                            <div class="player-name-cell">
                                <a href="/pages/player-profile.html?id=${p.id}" class="player-name-link" onclick="event.stopPropagation()">${p.name}</a>
                                ${p.level ? `<span class="player-level-badge ${levelClass}" aria-label="Level ${p.level}">${p.level}</span>` : ''}
                            </div>
                        </th>
                        <td class="stat-value wins" style="text-align: center; font-size: 14px;">${wins}</td>
                        <td class="stat-value losses" style="text-align: center; font-size: 14px;">${losses}</td>
                        <td class="stat-value sets" style="text-align: center; font-size: 14px;">-</td>
                        <td class="stat-value mpr" style="text-align: center; font-size: 14px;">${mpr > 0 ? mpr.toFixed(2) : '-'}</td>
                        <td class="stat-value avg" style="text-align: center; font-size: 14px;">${avg > 0 ? avg.toFixed(1) : '-'}</td>
                    </tr>
                `;
    }).join('')}
        </tbody>
    `;

    return teamRowHtml + playerRowsHtml;
}

export function toggleTeamExpand(teamId, event) {
    // Don't toggle if clicking on a link
    if (event.target.tagName === 'A') return;

    if (state.standingsData.expandedTeams.has(teamId)) {
        state.standingsData.expandedTeams.delete(teamId);
    } else {
        state.standingsData.expandedTeams.add(teamId);
    }

    // Update just the affected row without full re-render
    const row = document.querySelector(`tr[data-team-id="${teamId}"]`);
    const playerRows = document.querySelector(`tbody[data-team-players="${teamId}"]`);

    if (row && playerRows) {
        const isExpanded = state.standingsData.expandedTeams.has(teamId);
        row.classList.toggle('expanded', isExpanded);
        playerRows.classList.toggle('expanded', isExpanded);
    }
}

export function toggleExpandAll() {
    state.standingsData.expandAll = !state.standingsData.expandAll;

    if (state.standingsData.expandAll) {
        state.teams.forEach(t => state.standingsData.expandedTeams.add(t.id));
    } else {
        state.standingsData.expandedTeams.clear();
    }

    renderStandingsTable();
}

export function sortStandingsColumn(column) {
    if (state.standingsData.sortColumn === column) {
        state.standingsData.sortDirection = state.standingsData.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.standingsData.sortColumn = column;
        state.standingsData.sortDirection = 'desc'; // Default to descending for stats
    }
    renderStandingsTable();
}

// Expose functions for inline onclick handlers
window.toggleTeamExpand = toggleTeamExpand;
window.toggleExpandAll = toggleExpandAll;
window.sortStandings = sortStandingsColumn;
