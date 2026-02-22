/**
 * Player Profile - Leagues Module
 *
 * Handles:
 * - Loading leagues player is part of
 * - Rendering league cards with team rosters
 * - Team stats display
 */

import { callFunction, db, doc, getDoc, collection, getDocs } from '/js/firebase-config.js';

// Store league/team data for other modules to use
let playerLeagues = [];

async function loadLeagues(state) {
    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    const container = document.getElementById('leaguesContent');

    try {
        // Get leagues from dashboard data (already fetched roles)
        const result = await callFunction('getDashboardData', {
            player_id: playerId,
            source_type: 'global'
        });

        if (result.success && result.dashboard?.roles) {
            const { playing_on, captaining } = result.dashboard.roles;
            // Combine teams from both playing and captaining
            const allTeams = [...(playing_on || []), ...(captaining || [])];

            // Deduplicate by team_id
            const uniqueTeams = [];
            const seenTeamIds = new Set();
            for (const team of allTeams) {
                if (!seenTeamIds.has(team.team_id)) {
                    seenTeamIds.add(team.team_id);
                    uniqueTeams.push(team);
                }
            }

            if (uniqueTeams.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">Not on any league teams</div>';
                return;
            }

            playerLeagues = uniqueTeams;
            state.playerLeagues = playerLeagues; // Make available to other modules

            // Render league cards
            let html = '';
            for (const team of uniqueTeams) {
                html += await renderLeagueCard(team, playerId);
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">No leagues found</div>';
        }
    } catch (error) {
        console.error('Error loading leagues:', error);
        container.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">Error loading leagues</div>';
    }
}

async function renderLeagueCard(team, currentPlayerId) {
    const cardId = `league-${team.league_id}-${team.team_id}`;

    // Get team details with player stats
    let teammates = [];
    try {
        const teamDoc = await getDoc(doc(db, 'leagues', team.league_id, 'teams', team.team_id));
        if (teamDoc.exists()) {
            const teamData = teamDoc.data();

            // Support both new (players array of objects) and old (parallel arrays) formats
            let normalizedPlayers = [];
            if (teamData.players?.length) {
                normalizedPlayers = teamData.players.map(p => ({
                    id: p.id,
                    name: p.name || 'Unknown',
                    level: p.level || ''
                }));
            } else {
                const playerIds = teamData.player_ids || [];
                const playerNames = teamData.player_names || [];
                const playerLevels = teamData.player_levels || [];
                normalizedPlayers = playerIds.map((id, i) => ({
                    id,
                    name: playerNames[i] || 'Unknown',
                    level: playerLevels[i] || ''
                }));
            }

            // Get stats for each player
            for (const player of normalizedPlayers) {
                let stats = { x01_three_dart_avg: '-', cricket_mpr: '-' };
                try {
                    const statsDoc = await getDoc(doc(db, 'leagues', team.league_id, 'stats', player.id));
                    if (statsDoc.exists()) {
                        const s = statsDoc.data();
                        // Calculate 3DA from components if available
                        if (s.x01_total_darts > 0) {
                            stats.x01_three_dart_avg = (s.x01_total_points / s.x01_total_darts * 3).toFixed(1);
                        } else if (s.x01_three_dart_avg != null) {
                            stats.x01_three_dart_avg = Number(s.x01_three_dart_avg).toFixed(1);
                        } else if (s.x01_avg != null) {
                            stats.x01_three_dart_avg = Number(s.x01_avg).toFixed(1);
                        }
                        // Calculate MPR from components if available
                        if (s.cricket_total_rounds > 0) {
                            stats.cricket_mpr = (s.cricket_total_marks / s.cricket_total_rounds).toFixed(2);
                        } else if (s.cricket_mpr != null) {
                            stats.cricket_mpr = Number(s.cricket_mpr).toFixed(2);
                        } else if (s.mpr != null) {
                            stats.cricket_mpr = Number(s.mpr).toFixed(2);
                        }
                    }
                } catch (e) { /* ignore */ }

                teammates.push({
                    ...player,
                    ...stats
                });
            }
        }
    } catch (e) {
        console.error('Error loading team data:', e);
    }

    // Build roster HTML
    let rosterHTML = teammates.map(p => `
        <div class="roster-player">
            <span class="player-name ${p.id === currentPlayerId ? 'current' : ''}">${p.name}${p.level ? ` (${p.level})` : ''}</span>
            <span class="player-stats">${p.x01_three_dart_avg} / ${p.cricket_mpr}</span>
        </div>
    `).join('');

    return `
        <div class="league-card" id="${cardId}">
            <div class="league-card-header" onclick="toggleLeagueCard('${cardId}')">
                <div>
                    <h3>${team.league_name || 'Unnamed League'}</h3>
                    <div class="team-name">${team.team_name || 'Unknown Team'}</div>
                </div>
                <button class="toggle-btn">▼</button>
            </div>
            <div class="league-card-body">
                <div class="roster-section">
                    <h4>Team Roster</h4>
                    ${rosterHTML || '<div style="color: #aaa;">No players found</div>'}
                </div>
                <div class="league-actions">
                    <a href="/pages/league-view.html?league_id=${team.league_id}" class="action-btn">View League</a>
                    <a href="/pages/league-team.html?league_id=${team.league_id}&team_id=${team.team_id}" class="action-btn">Team Page</a>
                </div>
            </div>
        </div>
    `;
}

window.toggleLeagueCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('expanded');
    const btn = card.querySelector('.toggle-btn');
    if (btn) {
        btn.textContent = card.classList.contains('expanded') ? '▲' : '▼';
    }
};

// ===== INITIALIZATION =====

function initLeaguesTab(state) {
    // Tab will load on first activation
}

// ===== EXPORTS =====

export {
    initLeaguesTab,
    loadLeagues,
    renderLeagueCard,
    playerLeagues
};
