/**
 * League View - Match Night Banner Module
 *
 * Handles:
 * - Detecting if logged-in player has a match tonight
 * - Displaying match night banner with team info and rosters
 * - Availability confirmation
 */

import { state, ensurePlayersLoaded, ensureStatsLoaded } from './app.js';
import { callFunction } from '/js/firebase-config.js';
import { getOrdinal } from './helpers.js';

function calculateStandings(completedMatches) {
    const teamRecords = {};

    for (const match of completedMatches) {
        if (!match.home_team_id || !match.away_team_id) continue;

        if (!teamRecords[match.home_team_id]) {
            teamRecords[match.home_team_id] = { id: match.home_team_id, wins: 0, losses: 0, setsWon: 0 };
        }
        if (!teamRecords[match.away_team_id]) {
            teamRecords[match.away_team_id] = { id: match.away_team_id, wins: 0, losses: 0, setsWon: 0 };
        }

        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;

        teamRecords[match.home_team_id].setsWon += homeScore;
        teamRecords[match.away_team_id].setsWon += awayScore;

        if (homeScore > awayScore) {
            teamRecords[match.home_team_id].wins++;
            teamRecords[match.away_team_id].losses++;
        } else if (awayScore > homeScore) {
            teamRecords[match.away_team_id].wins++;
            teamRecords[match.home_team_id].losses++;
        }
    }

    const standings = Object.values(teamRecords);
    standings.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.setsWon - a.setsWon;
    });

    return standings;
}

export async function checkMatchNightForLeague(appState) {
    const banner = document.getElementById('matchNightBanner');
    if (!banner || !appState.isLoggedIn || !appState.matches || appState.matches.length === 0) {
        if (banner) banner.style.display = 'none';
        return;
    }

    // Get player info from session
    const session = localStorage.getItem('brdc_session');
    if (!session) {
        banner.style.display = 'none';
        return;
    }

    let playerId;
    try {
        const sessionData = JSON.parse(session);
        playerId = sessionData.player_id;
    } catch (e) {
        banner.style.display = 'none';
        return;
    }

    // Load player's team info for this league
    let playerTeamId = null;
    try {
        await ensurePlayersLoaded();
        const playerData = appState.allPlayersById[playerId];
        if (playerData) {
            playerTeamId = playerData.team_id;
        }
    } catch (e) {
        console.error('Error loading player team:', e);
        banner.style.display = 'none';
        return;
    }

    if (!playerTeamId) {
        banner.style.display = 'none';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's match for this player's team
    const todayMatch = appState.matches.find(m => {
        if (m.status === 'completed') return false;

        // Check if this team is playing
        if (m.home_team_id !== playerTeamId && m.away_team_id !== playerTeamId) {
            return false;
        }

        const matchDate = new Date(m.match_date || m.date);
        matchDate.setHours(0, 0, 0, 0);
        return matchDate.getTime() === today.getTime();
    });

    if (todayMatch) {
        const isHome = todayMatch.home_team_id === playerTeamId;
        const myTeam = appState.teams.find(t => t.id === playerTeamId);
        const oppTeam = appState.teams.find(t => t.id === (isHome ? todayMatch.away_team_id : todayMatch.home_team_id));

        // Load players and stats for both teams
        let myRoster = [];
        let oppRoster = [];
        try {
            await ensurePlayersLoaded();
            await ensureStatsLoaded();

            const oppTeamId = isHome ? todayMatch.away_team_id : todayMatch.home_team_id;

            Object.values(appState.allPlayersById).forEach(player => {
                const stats = appState.allStatsById[player.id] || {};
                const playerWithStats = {
                    ...player,
                    x01_three_dart_avg: stats.x01_three_dart_avg || null,
                    cricket_mpr: stats.cricket_mpr || null
                };

                if (player.team_id === playerTeamId) {
                    myRoster.push(playerWithStats);
                } else if (player.team_id === oppTeamId) {
                    oppRoster.push(playerWithStats);
                }
            });

            // Sort by position
            myRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
            oppRoster.sort((a, b) => (a.position || 99) - (b.position || 99));
        } catch (e) {
            console.error('Error loading rosters:', e);
        }

        // Calculate standings
        const standings = calculateStandings(appState.matches.filter(m => m.status === 'completed'));
        const myStanding = standings.findIndex(s => s.id === playerTeamId) + 1;
        const oppStanding = standings.findIndex(s => s.id === (isHome ? todayMatch.away_team_id : todayMatch.home_team_id)) + 1;
        const myRecord = standings.find(s => s.id === playerTeamId);
        const oppRecord = standings.find(s => s.id === (isHome ? todayMatch.away_team_id : todayMatch.home_team_id));

        // Calculate team averages
        const calcAvg = (roster) => {
            const validAvgs = roster.map(p => p.x01_three_dart_avg).filter(a => a != null && a > 0);
            return validAvgs.length > 0 ? validAvgs.reduce((sum, a) => sum + a, 0) / validAvgs.length : null;
        };

        showMatchNightBanner({
            id: todayMatch.id,
            week: todayMatch.week,
            opponent: oppTeam ? (oppTeam.name || oppTeam.team_name || 'TBD') : 'TBD',
            myTeam: myTeam ? (myTeam.name || myTeam.team_name || 'My Team') : 'My Team',
            myRecord: myRecord ? `(${myRecord.wins}-${myRecord.losses})` : '(0-0)',
            oppRecord: oppRecord ? `(${oppRecord.wins}-${oppRecord.losses})` : '(0-0)',
            myStanding: myStanding > 0 ? getOrdinal(myStanding) : '',
            oppStanding: oppStanding > 0 ? getOrdinal(oppStanding) : '',
            myAvg: calcAvg(myRoster),
            oppAvg: calcAvg(oppRoster),
            myRoster: myRoster,
            oppRoster: oppRoster,
            isHome: isHome,
            date: new Date(todayMatch.match_date || todayMatch.date),
            leagueId: appState.leagueId
        });
    } else {
        banner.style.display = 'none';
    }
}

function showMatchNightBanner(match) {
    const banner = document.getElementById('matchNightBanner');
    const contentEl = document.getElementById('matchNightContent');
    const weekEl = document.getElementById('matchWeek');
    const confirmBtn = document.getElementById('confirmBtn');
    const cantMakeBtn = document.getElementById('cantMakeBtn');

    if (!banner) return;

    // Set week
    weekEl.textContent = `WEEK ${match.week || '?'}`;

    // Get match time
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const matchTime = timeStr !== 'Invalid Date' && matchDate.getHours() !== 0 ? timeStr : '7:00 PM';

    // Build team info
    const myTeamName = match.myTeam || 'My Team';
    const oppTeamName = match.opponent || 'Opponent';
    const myRecord = match.myRecord || '(0-0)';
    const oppRecord = match.oppRecord || '(0-0)';
    const myStanding = match.myStanding ? `${match.myStanding} • ` : '';
    const oppStanding = match.oppStanding ? `${match.oppStanding} • ` : '';
    const myAvg = match.myAvg ? `${match.myAvg.toFixed(1)} avg` : '';
    const oppAvg = match.oppAvg ? `${match.oppAvg.toFixed(1)} avg` : '';
    const vsText = match.isHome ? 'VS' : '@';

    // Helper to compare stats
    const compareStats = (leftVal, rightVal) => {
        if (!leftVal || !rightVal) return { left: '', right: '' };
        if (Math.abs(leftVal - rightVal) < 0.1) return { left: '', right: '' };
        return leftVal > rightVal ? { left: 'better', right: 'worse' } : { left: 'worse', right: 'better' };
    };

    // Build roster HTML
    const myRoster = match.myRoster || [];
    const oppRoster = match.oppRoster || [];
    const maxRows = Math.max(myRoster.length, oppRoster.length);

    let rosterHtml = '';
    if (maxRows > 0) {
        rosterHtml = '<div class="match-night-roster">';
        rosterHtml += '<div class="match-night-roster-left">';
        for (let i = 0; i < maxRows; i++) {
            const myPlayer = myRoster[i];
            const oppPlayer = oppRoster[i];

            if (myPlayer) {
                const my3DA = myPlayer.x01_three_dart_avg;
                const myMPR = myPlayer.cricket_mpr;
                const opp3DA = oppPlayer?.x01_three_dart_avg;
                const oppMPR = oppPlayer?.cricket_mpr;

                const daCompare = compareStats(my3DA, opp3DA);
                const mprCompare = compareStats(myMPR, oppMPR);

                const my3DAStr = my3DA ? my3DA.toFixed(1) : '-';
                const myMPRStr = myMPR ? myMPR.toFixed(2) : '-';

                const isSub = myPlayer.is_sub;
                const subBadge = isSub ? '<span class="fill-in-badge">SUB</span> ' : '';

                rosterHtml += `
                    <div class="match-night-roster-player">
                        <span class="match-night-roster-stats">
                            <span class="${daCompare.left}">${my3DAStr}</span> / <span class="${mprCompare.left}">${myMPRStr}</span>
                        </span>
                        <span class="match-night-roster-name">${subBadge}${myPlayer.name}</span>
                    </div>`;
            } else {
                rosterHtml += '<div class="match-night-roster-player"></div>';
            }
        }
        rosterHtml += '</div><div>';
        for (let i = 0; i < maxRows; i++) {
            const myPlayer = myRoster[i];
            const oppPlayer = oppRoster[i];

            if (oppPlayer) {
                const my3DA = myPlayer?.x01_three_dart_avg;
                const myMPR = myPlayer?.cricket_mpr;
                const opp3DA = oppPlayer.x01_three_dart_avg;
                const oppMPR = oppPlayer.cricket_mpr;

                const daCompare = compareStats(my3DA, opp3DA);
                const mprCompare = compareStats(myMPR, oppMPR);

                const opp3DAStr = opp3DA ? opp3DA.toFixed(1) : '-';
                const oppMPRStr = oppMPR ? oppMPR.toFixed(2) : '-';

                const isSub = oppPlayer.is_sub;
                const subBadge = isSub ? ' <span class="fill-in-badge">SUB</span>' : '';

                rosterHtml += `
                    <div class="match-night-roster-player">
                        <span class="match-night-roster-name">${oppPlayer.name}${subBadge}</span>
                        <span class="match-night-roster-stats">
                            <span class="${daCompare.right}">${opp3DAStr}</span> / <span class="${mprCompare.right}">${oppMPRStr}</span>
                        </span>
                    </div>`;
            } else {
                rosterHtml += '<div class="match-night-roster-player"></div>';
            }
        }
        rosterHtml += '</div></div>';
    }

    // Render content
    contentEl.innerHTML = `
        <div class="match-night-header">
            <div class="match-night-team left">
                <div class="match-night-team-name">${myTeamName}</div>
                <div class="match-night-team-info">${myStanding}${myRecord}</div>
                ${myAvg ? `<div class="match-night-team-avg">${myAvg}</div>` : ''}
            </div>
            <div class="match-night-vs">${vsText}<br>${matchTime}</div>
            <div class="match-night-team right">
                <div class="match-night-team-name">${oppTeamName}</div>
                <div class="match-night-team-info">${oppStanding}${oppRecord}</div>
                ${oppAvg ? `<div class="match-night-team-avg">${oppAvg}</div>` : ''}
            </div>
        </div>
        ${rosterHtml}
    `;

    // Check if availability was already confirmed
    const availabilityKey = `match_availability_${match.leagueId}_${match.id}`;
    const savedAvailability = localStorage.getItem(availabilityKey);

    if (savedAvailability === 'available') {
        confirmBtn.classList.add('selected');
        cantMakeBtn.classList.remove('selected');
    } else if (savedAvailability === 'unavailable') {
        confirmBtn.classList.remove('selected');
        cantMakeBtn.classList.add('selected');
    } else {
        confirmBtn.classList.remove('selected');
        cantMakeBtn.classList.remove('selected');
    }

    // Store match data for confirmAvailability function
    window.currentMatchNight = match;

    // Show banner
    banner.style.display = 'flex';
}

export async function confirmAvailability(appState, status) {
    const match = window.currentMatchNight;
    if (!match) return;

    const confirmBtn = document.getElementById('confirmBtn');
    const cantMakeBtn = document.getElementById('cantMakeBtn');

    // Get player ID from session
    const session = localStorage.getItem('brdc_session');
    if (!session) return;

    let playerId;
    try {
        const sessionData = JSON.parse(session);
        playerId = sessionData.player_id;
    } catch (e) {
        return;
    }

    // Save previous state for rollback on error
    const previousState = {
        confirmSelected: confirmBtn.classList.contains('selected'),
        cantMakeSelected: cantMakeBtn.classList.contains('selected')
    };
    const availabilityKey = `match_availability_${match.leagueId}_${match.id}`;
    const previousStorageValue = localStorage.getItem(availabilityKey);

    // Update button states
    if (status === 'available') {
        confirmBtn.classList.add('selected');
        cantMakeBtn.classList.remove('selected');
    } else {
        confirmBtn.classList.remove('selected');
        cantMakeBtn.classList.add('selected');
    }

    // Save to localStorage
    localStorage.setItem(availabilityKey, status);

    // Call cloud function to update availability
    try {
        await callFunction('updatePlayerAvailability', {
            player_id: playerId,
            league_id: match.leagueId,
            match_id: match.id,
            status: status
        });
    } catch (error) {
        console.error('Error updating availability:', error);

        // Revert UI to previous state
        if (previousState.confirmSelected) {
            confirmBtn.classList.add('selected');
        } else {
            confirmBtn.classList.remove('selected');
        }
        if (previousState.cantMakeSelected) {
            cantMakeBtn.classList.add('selected');
        } else {
            cantMakeBtn.classList.remove('selected');
        }

        // Revert localStorage
        if (previousStorageValue !== null) {
            localStorage.setItem(availabilityKey, previousStorageValue);
        } else {
            localStorage.removeItem(availabilityKey);
        }

        // Show error to user
        toastError('Failed to update availability. Please try again.');
    }
}
