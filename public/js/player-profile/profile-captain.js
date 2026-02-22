/**
 * Player Profile - Captain Module
 *
 * Handles:
 * - Captain dashboard features
 * - Managing fill-ins for matches
 * - Team management
 * - Upcoming matches
 */

import { callFunction, db, doc, getDoc, collection, getDocs } from '/js/firebase-config.js';

// Module state
let teamPlayers = [];
let availableFillins = [];
let upcomingMatches = [];
let captainLeagueId = null;
let captainTeamId = null;

async function loadCaptainContent(state) {
    // Use captainingTeams array instead of checking currentPlayer properties
    if (!state.captainingTeams || state.captainingTeams.length === 0) {
        return;
    }

    try {
        // Use the first captaining team (or could loop through all)
        const captainTeam = state.captainingTeams[0];
        const leagueId = captainTeam.league_id;
        const teamId = captainTeam.team_id;

        // Store context for other captain functions
        captainLeagueId = leagueId;
        captainTeamId = teamId;

        // Load team players - support both new and old formats
        const teamDoc = await getDoc(doc(db, 'leagues', leagueId, 'teams', teamId));
        if (teamDoc.exists()) {
            const team = teamDoc.data();
            if (team.players?.length) {
                teamPlayers = team.players.map(p => ({
                    id: p.id,
                    name: p.name || 'Unknown',
                    level: p.level || null
                }));
            } else {
                teamPlayers = team.player_ids?.map((id, i) => ({
                    id,
                    name: team.player_names?.[i] || 'Unknown',
                    level: team.player_levels?.[i] || null
                })) || [];
            }
        }

        // Load fillins
        const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
        const league = leagueDoc.data();

        if (league.allow_fillins) {
            const fillinsSnap = await getDocs(collection(db, 'leagues', leagueId, 'fillins'));
            availableFillins = fillinsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Load upcoming matches for this team
        const result = await callFunction('getSchedule', { league_id: leagueId });
        if (result.success) {
            upcomingMatches = result.matches.filter(m =>
                (m.home_team_id === teamId || m.away_team_id === teamId) &&
                m.status !== 'completed'
            ).slice(0, 5);
        }

        renderCaptainContent(state);
    } catch (error) {
        console.error('Error loading captain content:', error);
    }
}

function renderCaptainContent(state) {
    const container = document.getElementById('captainContent');
    if (!container) return;

    // Render team roster
    const rosterHTML = teamPlayers.map(p => `
        <div class="roster-player">
            <span>${p.name}${p.level ? ` (Level ${p.level})` : ''}</span>
        </div>
    `).join('');

    // Render fillins list
    const fillinsHTML = availableFillins.length > 0
        ? availableFillins.map(f => `
            <div class="fillin-card">
                <span>${f.name}${f.level ? ` (Level ${f.level})` : ''}</span>
                <span class="fillin-stats">${f.x01_avg || '-'} / ${f.cricket_mpr || '-'}</span>
            </div>
          `).join('')
        : '<div style="color: #aaa;">No fill-ins available</div>';

    // Render upcoming matches
    const matchesHTML = upcomingMatches.length > 0
        ? upcomingMatches.map(m => {
            const matchDate = m.match_date?.toDate ? m.match_date.toDate() : new Date(m.match_date);
            return `
                <div class="match-card">
                    <div class="match-date">${matchDate.toLocaleDateString()}</div>
                    <div class="match-teams">${m.home_team_name} vs ${m.away_team_name}</div>
                    <button class="action-btn" onclick="manageFillins('${m.id}')">Manage Fill-ins</button>
                </div>
            `;
          }).join('')
        : '<div style="color: #aaa;">No upcoming matches</div>';

    container.innerHTML = `
        <div class="captain-section">
            <h3>Team Roster</h3>
            <div class="roster-list">${rosterHTML}</div>
        </div>
        <div class="captain-section">
            <h3>Available Fill-ins</h3>
            <div class="fillins-list">${fillinsHTML}</div>
        </div>
        <div class="captain-section">
            <h3>Upcoming Matches</h3>
            <div class="matches-list">${matchesHTML}</div>
        </div>
    `;
}

window.manageFillins = function(matchId) {
    // Open fill-in management modal/page
    window.location.href = `/pages/captain-dashboard.html?league_id=${captainLeagueId}&match_id=${matchId}`;
};

window.toggleFillin = function(matchId, fillinId) {
    // Toggle fill-in for a specific match
    console.log('Toggle fillin', fillinId, 'for match', matchId);
    // Implementation would call a cloud function to add/remove fill-in
};

// ===== INITIALIZATION =====

function initCaptainTab(state) {
    // Tab will load on first activation
}

// ===== EXPORTS =====

export {
    initCaptainTab,
    loadCaptainContent,
    renderCaptainContent
};
