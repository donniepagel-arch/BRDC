// Dashboard Schedule and Match Night Functions

import { callFunction, db } from '/js/firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { currentPlayer, dashboardData } from '/js/dashboard/dashboard-state.js';
import { getDateFromTimestamp, calculateTeamAvg } from '/js/dashboard/dashboard-utils.js';

// Helper to calculate team average from roster (local copy for roster display)
function calculateTeamAvg_local(roster) {
    if (!roster || roster.length === 0) return null;

    const validAvgs = roster
        .map(p => parseFloat(p.x01_three_dart_avg))
        .filter(avg => !isNaN(avg) && avg > 0);

    if (validAvgs.length === 0) return null;

    const avg = validAvgs.reduce((sum, a) => sum + a, 0) / validAvgs.length;
    return avg.toFixed(1);
}

// Helper to calculate team MPR from roster
function calculateTeamMPR_local(roster) {
    if (!roster || roster.length === 0) return null;

    const validMprs = roster
        .map(p => parseFloat(p.cricket_mpr))
        .filter(mpr => !isNaN(mpr) && mpr > 0);

    if (validMprs.length === 0) return null;

    const mpr = validMprs.reduce((sum, m) => sum + m, 0) / validMprs.length;
    return mpr.toFixed(2);
}

async function loadScheduleStories(roles) {
    const container = document.getElementById('scheduleStories');
    const events = [];

    // Get upcoming and recent matches from roles - fetch ALL in parallel
    if (roles && roles.playing) {
        const schedulePromises = roles.playing.map(team =>
            callFunction('getTeamScheduleEnhanced', {
                league_id: team.league_id || team.id,
                team_id: team.team_id,
                player_id: currentPlayer.id
            }).then(result => ({ team, result, error: null }))
              .catch(error => ({ team, result: null, error }))
        );

        const scheduleResults = await Promise.all(schedulePromises);

        for (const { team, result, error } of scheduleResults) {
            if (error) {
                console.error('Error loading team schedule:', error);
                continue;
            }

            if (result && result.success) {
                // Add all upcoming matches
                (result.upcoming || []).forEach(match => {
                    const matchDate = getDateFromTimestamp(match.match_date);

                    // Calculate team averages from rosters
                    const myRoster = match.my_team?.roster || [];
                    const oppRoster = match.opponent?.roster || [];

                    const myAvg = calculateTeamAvg(myRoster);
                    const oppAvg = calculateTeamAvg(oppRoster);
                    const myMPR = calculateTeamMPR_local(myRoster);
                    const oppMPR = calculateTeamMPR_local(oppRoster);

                    // Calculate win percentage from record (e.g., "(5-2)" -> 5/(5+2))
                    const calcWinPct = (record) => {
                        if (!record) return null;
                        const match = record.match(/\((\d+)-(\d+)\)/);
                        if (!match) return null;
                        const wins = parseInt(match[1]);
                        const losses = parseInt(match[2]);
                        if (wins + losses === 0) return null;
                        return ((wins / (wins + losses)) * 100).toFixed(0);
                    };

                    const myWinPct = calcWinPct(match.my_team?.record);
                    const oppWinPct = calcWinPct(match.opponent?.record);

                    events.push({
                        type: 'league',
                        date: matchDate,
                        week: match.week,
                        opponent: match.opponent?.name || 'TBD',
                        myTeam: match.my_team?.name || 'My Team',
                        myRecord: match.my_team?.record || '(0-0)',
                        oppRecord: match.opponent?.record || '(0-0)',
                        myStanding: match.my_team?.standing || '',
                        oppStanding: match.opponent?.standing || '',
                        myAvg: myAvg,
                        oppAvg: oppAvg,
                        myMPR: myMPR,
                        oppMPR: oppMPR,
                        myWinPct: myWinPct,
                        oppWinPct: oppWinPct,
                        myRoster: myRoster,
                        oppRoster: oppRoster,
                        id: match.id,
                        leagueId: team.league_id || team.id,
                        leagueName: formatLeagueName(team.league_name || team.name),
                        completed: false,
                        isHome: match.is_home
                    });
                });

                // Add recent completed matches
                (result.past || []).forEach(match => {
                    const matchDate = getDateFromTimestamp(match.match_date);

                    events.push({
                        type: 'league',
                        date: matchDate,
                        week: match.week,
                        opponent: match.opponent?.name || 'TBD',
                        myTeam: match.my_team?.name || 'My Team',
                        myRecord: match.my_team?.record || '(0-0)',
                        oppRecord: match.opponent?.record || '(0-0)',
                        myStanding: match.my_team?.standing || '',
                        oppStanding: match.opponent?.standing || '',
                        id: match.id,
                        leagueId: team.league_id || team.id,
                        leagueName: formatLeagueName(team.league_name || team.name),
                        completed: true,
                        won: match.won,
                        myScore: match.my_score ?? '-',
                        theirScore: match.their_score ?? '-',
                        isHome: match.is_home
                    });
                });
            }
        }
    }

    // Calculate isPast for each event based on actual date
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    events.forEach(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        event.isPast = eventDate < now;
    });

    // Sort: future events first (by date asc), then past events at end (by date desc)
    events.sort((a, b) => {
        if (a.isPast && !b.isPast) return 1;  // Past goes after future
        if (!a.isPast && b.isPast) return -1; // Future goes before past
        if (a.isPast && b.isPast) return b.date - a.date; // Most recent past first
        return a.date - b.date; // Earliest future first
    });

    // Check if there's a match tonight
    checkMatchNight(events);

    // Render story cards
    if (events.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        container.innerHTML = events.map(matchEvent => {
            const eventDate = new Date(matchEvent.date);
            eventDate.setHours(0, 0, 0, 0);
            const isToday = eventDate.getTime() === today.getTime();
            const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum = eventDate.getDate();
            const monthName = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

            // Determine status and past state
            const isPast = matchEvent.isPast;
            let statusClass = 'scheduled';
            let statusText = 'UPCOMING';
            if (matchEvent.completed) {
                statusClass = 'completed';
                statusText = matchEvent.won ? 'WIN' : 'LOSS';
            } else if (isToday) {
                statusClass = 'today-status';
                statusText = 'TODAY';
            } else if (isPast) {
                statusClass = 'past-status';
                statusText = 'PAST';
            }

            // Build card HTML
            if (matchEvent.completed) {
                // Completed match card - show score
                const myScoreClass = matchEvent.won ? 'winner' : 'loser';
                const theirScoreClass = matchEvent.won ? 'loser' : 'winner';

                return `
                    <div class="fb-story-card ${matchEvent.type} completed past" onclick="openStoryModal('${matchEvent.id || ''}', '${matchEvent.type || 'league'}', '${matchEvent.leagueId || ''}')">
                        <div class="fb-story-event">${formatLeagueName(matchEvent.leagueName)}</div>
                        <div class="fb-story-week">WEEK ${matchEvent.week || '?'}</div>
                        <div class="fb-story-date">${dayName} ${monthName} ${dayNum}</div>
                        <div class="fb-story-opponent">${matchEvent.isHome ? 'vs' : '@'} ${matchEvent.opponent}${matchEvent.oppStanding ? ` (${matchEvent.oppStanding})` : ''}</div>
                        <div class="fb-story-score">
                            <span class="${myScoreClass}">${matchEvent.myScore}</span>
                            <span style="color: var(--text-dim);">-</span>
                            <span class="${theirScoreClass}">${matchEvent.theirScore}</span>
                        </div>
                        <div class="fb-story-record">${matchEvent.myRecord} vs ${matchEvent.oppRecord}</div>
                        <div class="fb-story-status ${statusClass}">${statusText}</div>
                    </div>
                `;
            } else {
                // Non-completed match card - show stats preview
                const hasStats = matchEvent.myAvg || matchEvent.oppAvg;
                const cardClasses = ['fb-story-card', matchEvent.type];
                if (isToday) cardClasses.push('today');
                if (isPast) cardClasses.push('past');

                // Format stats display
                const myStats = matchEvent.myAvg && matchEvent.myMPR
                    ? `${matchEvent.myAvg} / ${matchEvent.myMPR}`
                    : (matchEvent.myAvg || '-');
                const oppStats = matchEvent.oppAvg && matchEvent.oppMPR
                    ? `${matchEvent.oppAvg} / ${matchEvent.oppMPR}`
                    : (matchEvent.oppAvg || '-');

                return `
                    <div class="${cardClasses.join(' ')}" onclick="openStoryModal('${matchEvent.id || ''}', '${matchEvent.type || 'league'}', '${matchEvent.leagueId || ''}')">
                        <div class="fb-story-event">${formatLeagueName(matchEvent.leagueName)}</div>
                        <div class="fb-story-week">WEEK ${matchEvent.week || '?'}</div>
                        <div class="fb-story-date">${dayName} ${monthName} ${dayNum}</div>
                        <div class="fb-story-opponent">${matchEvent.isHome ? 'vs' : '@'} ${matchEvent.opponent}${matchEvent.oppStanding ? ` (${matchEvent.oppStanding})` : ''}</div>
                        ${hasStats ? `
                            <div class="fb-story-stats">
                                <span class="home-avg">${myStats}</span>
                                <span style="color: var(--text-dim);"> vs </span>
                                <span class="away-avg">${oppStats}</span>
                            </div>
                        ` : ''}
                        <div class="fb-story-record">${matchEvent.myRecord} vs ${matchEvent.oppRecord}</div>
                        <div class="fb-story-status ${statusClass}">${statusText}</div>
                    </div>
                `;
            }
        }).join('');
    } else {
        container.innerHTML = `
            <div class="fb-story-card">
                <div class="fb-story-date">NO EVENTS</div>
                <div class="fb-story-day">-</div>
                <div class="fb-story-event">Check back later</div>
            </div>
        `;
    }
}

window.openStoryModal = async function(eventId, eventType, leagueId) {

    const modal = document.getElementById('storyModal');
    const content = document.getElementById('storyModalContent');

    if (!modal || !content) {
        console.error('Modal elements not found');
        return;
    }

    modal.classList.add('visible');
    modal.querySelector('.fb-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.A11y && A11y.initModal) {
        window._storyModalCleanup = A11y.initModal(modal, { label: 'Match details', onClose: closeStoryModal });
    }
    content.innerHTML = '<div class="fb-feed-loading">Loading match details...</div>';

    try {
        if (eventType === 'league') {
            // Find the match in our cached data
            const roles = dashboardData?.roles;
            let matchData = null;

            if (roles && roles.playing) {
                for (const team of roles.playing) {
                    if ((team.league_id || team.id) === leagueId) {
                        const result = await callFunction('getTeamScheduleEnhanced', {
                            league_id: leagueId,
                            team_id: team.team_id,
                            player_id: currentPlayer.id
                        });

                        if (result.success) {
                            // Check upcoming and past matches
                            const allMatches = [...(result.upcoming || []), ...(result.past || [])];
                            matchData = allMatches.find(m => m.id === eventId);
                            if (matchData) {
                                matchData.leagueName = formatLeagueName(result.league_name);
                                break;
                            }
                        }
                    }
                }
            }

            if (matchData) {
                content.innerHTML = renderMatchPreviewModal(matchData, leagueId);
            } else {
                // Fallback to direct navigation if match not found
                window.location.href = `/pages/match-hub.html?league_id=${leagueId}&match_id=${eventId}`;
            }
        } else {
            // Tournament or other event
            window.location.href = `/pages/event-view.html?id=${eventId}`;
        }
    } catch (error) {
        console.error('Error loading match details:', error);
        content.innerHTML = '<p style="text-align: center; color: var(--text-dim);">Error loading details</p>';
    }
};

// Render match preview modal content - matches league-view.html format
// Home team always on LEFT, away team always on RIGHT
function renderMatchPreviewModal(match, leagueId) {
    const matchDate = getDateFromTimestamp(match.match_date);
    const dateStr = matchDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const myTeam = match.my_team || {};
    const opponent = match.opponent || {};
    const isCompleted = match.completed || false;
    const isHome = match.is_home;

    // Determine home/away teams (home always on left, away always on right)
    const homeTeam = isHome ? myTeam : opponent;
    const awayTeam = isHome ? opponent : myTeam;
    const homeRoster = homeTeam.roster || [];
    const awayRoster = awayTeam.roster || [];

    // Calculate team averages
    const homeAvg = calculateTeamAvg_local(homeRoster);
    const awayAvg = calculateTeamAvg_local(awayRoster);

    // Calculate team MPR
    const calcTeamMPR = (roster) => {
        if (!roster || roster.length === 0) return null;
        const validMprs = roster.map(p => parseFloat(p.cricket_mpr)).filter(m => !isNaN(m) && m > 0);
        if (validMprs.length === 0) return null;
        return (validMprs.reduce((sum, m) => sum + m, 0) / validMprs.length).toFixed(2);
    };
    const homeMPR = calcTeamMPR(homeRoster);
    const awayMPR = calcTeamMPR(awayRoster);

    // Determine scores for completed matches
    const homeScore = isHome ? match.my_score : match.their_score;
    const awayScore = isHome ? match.their_score : match.my_score;
    const homeWon = isCompleted && homeScore > awayScore;
    const awayWon = isCompleted && awayScore > homeScore;

    // Build roster rows (side by side like league-view)
    const maxPlayers = Math.max(homeRoster.length, awayRoster.length, 3);
    let rosterRows = '';
    for (let i = 0; i < maxPlayers; i++) {
        const homePlayer = homeRoster[i];
        const awayPlayer = awayRoster[i];
        const homeName = homePlayer ? homePlayer.name : '';
        const awayName = awayPlayer ? awayPlayer.name : '';
        const home3DA = homePlayer ? (homePlayer.x01_three_dart_avg || '-') : '';
        const homePlayerMpr = homePlayer ? (homePlayer.cricket_mpr || '-') : '';
        const away3DA = awayPlayer ? (awayPlayer.x01_three_dart_avg || '-') : '';
        const awayPlayerMpr = awayPlayer ? (awayPlayer.cricket_mpr || '-') : '';

        rosterRows += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="flex: 1; text-align: right; padding-right: 8px;">
                    ${homePlayer ? `<span style="color: var(--text-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-right: 8px;">${home3DA} / ${homePlayerMpr}</span>` : ''}
                    <span style="color: var(--text-light); font-size: 13px;">${homeName}</span>
                </div>
                <div style="flex: 1; text-align: left; padding-left: 8px;">
                    <span style="color: var(--text-light); font-size: 13px;">${awayName}</span>
                    ${awayPlayer ? `<span style="color: var(--text-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-left: 8px;">${away3DA} / ${awayPlayerMpr}</span>` : ''}
                </div>
            </div>
        `;
    }

    // Build score section for completed matches
    let scoreSection = '';
    if (isCompleted) {
        scoreSection = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 16px; margin: 16px 0;">
                <div style="font-family: 'Bebas Neue', cursive; font-size: 48px; ${homeWon ? 'color: var(--yellow);' : 'color: var(--text-dim);'}">${homeScore}</div>
                <div style="font-family: 'Bebas Neue', cursive; font-size: 24px; color: var(--text-dim);">-</div>
                <div style="font-family: 'Bebas Neue', cursive; font-size: 48px; ${awayWon ? 'color: var(--yellow);' : 'color: var(--text-dim);'}">${awayScore}</div>
            </div>
            <div style="text-align: center; font-size: 12px; color: ${match.won ? 'var(--success)' : 'var(--danger)'}; text-transform: uppercase; font-weight: 700; margin-bottom: 12px;">
                ${match.won ? 'VICTORY' : 'DEFEAT'}
            </div>
        `;
    }

    return `
        <div style="padding: 0;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="font-size: 10px; color: var(--pink); text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                    ${formatLeagueName(match.leagueName)} - WEEK ${match.week || '?'}
                </div>
                <div style="font-size: 14px; color: var(--text-dim); margin-top: 4px;">
                    ${dateStr}
                </div>
            </div>

            <!-- Teams Header - Home on LEFT, Away on RIGHT -->
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; margin-bottom: 8px; align-items: start;">
                <!-- Home Team (Left) -->
                <div style="text-align: right;">
                    <div style="font-family: 'Bebas Neue', cursive; font-size: 22px; color: ${homeWon ? 'var(--yellow)' : 'white'}; line-height: 1;">
                        ${homeTeam.name || 'Home Team'}
                    </div>
                    <div style="margin-top: 4px;">
                        ${homeTeam.standing ? `<span style="color: var(--yellow); font-size: 11px; font-weight: 700;">${homeTeam.standing}</span>` : ''}
                        <span style="color: #888; font-size: 11px; margin-left: 4px;">${homeTeam.record || '0-0'}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; margin-top: 4px;">
                        ${homeAvg || '-'} / ${homeMPR || '-'}
                    </div>
                </div>

                <!-- Center -->
                <div style="text-align: center; padding-top: 6px;">
                    ${homeWon ? '<div style="color: var(--yellow); font-size: 20px; line-height: 1;">★</div>' : awayWon ? '<div style="color: var(--yellow); font-size: 20px; line-height: 1; opacity: 0;"> </div>' : ''}
                    <div style="font-family: 'Bebas Neue', cursive; font-size: 13px; color: var(--text-dim); margin-top: 2px;">
                        ${isCompleted ? 'FINAL' : (isHome ? 'VS' : '@')}
                    </div>
                </div>

                <!-- Away Team (Right) -->
                <div style="text-align: left;">
                    <div style="font-family: 'Bebas Neue', cursive; font-size: 22px; color: ${awayWon ? 'var(--yellow)' : 'white'}; line-height: 1;">
                        ${awayTeam.name || 'Away Team'}
                    </div>
                    <div style="margin-top: 4px;">
                        ${awayTeam.standing ? `<span style="color: var(--yellow); font-size: 11px; font-weight: 700;">${awayTeam.standing}</span>` : ''}
                        <span style="color: #888; font-size: 11px; margin-left: 4px;">${awayTeam.record || '0-0'}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; margin-top: 4px;">
                        ${awayAvg || '-'} / ${awayMPR || '-'}
                    </div>
                </div>
            </div>

            ${scoreSection}

            <!-- Rosters - Side by side like league-view -->
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 10px; color: ${isHome ? 'var(--pink)' : 'var(--teal)'}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                        ${isHome ? 'YOUR TEAM' : 'OPPONENT'} (HOME)
                    </div>
                    <div style="font-size: 10px; color: ${!isHome ? 'var(--pink)' : 'var(--teal)'}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                        ${!isHome ? 'YOUR TEAM' : 'OPPONENT'} (AWAY)
                    </div>
                </div>
                ${rosterRows || '<div style="color: var(--text-dim); font-size: 12px; text-align: center; padding: 12px;">No roster data available</div>'}
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <a href="/pages/league-view.html?league_id=${leagueId}" style="
                    flex: 1;
                    padding: 12px;
                    background: rgba(145, 215, 235, 0.15);
                    border: 2px solid var(--teal);
                    border-radius: 8px;
                    color: var(--teal);
                    font-family: 'Bebas Neue', cursive;
                    font-size: 16px;
                    letter-spacing: 1px;
                    cursor: pointer;
                    text-align: center;
                    text-decoration: none;
                ">VIEW LEAGUE</a>
                <button onclick="viewMatch('${match.id}', '${leagueId}')" style="
                    flex: 1;
                    padding: 12px;
                    background: linear-gradient(135deg, var(--pink), #d63384);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-family: 'Bebas Neue', cursive;
                    font-size: 16px;
                    letter-spacing: 1px;
                    cursor: pointer;
                ">${isCompleted ? 'VIEW REPORT' : 'VIEW MATCH HUB'}</button>
                ${!isCompleted ? `
                    <button onclick="confirmAttendance('${match.id}', '${leagueId}', 'confirmed')" style="
                        padding: 12px 16px;
                        background: rgba(34, 197, 94, 0.2);
                        border: 2px solid var(--success);
                        border-radius: 8px;
                        color: var(--success);
                        font-family: 'Bebas Neue', cursive;
                        font-size: 14px;
                        letter-spacing: 1px;
                        cursor: pointer;
                    ">CONFIRM</button>
                    <button onclick="confirmAttendance('${match.id}', '${leagueId}', 'unavailable')" style="
                        padding: 12px 16px;
                        background: rgba(239, 68, 68, 0.2);
                        border: 2px solid var(--danger);
                        border-radius: 8px;
                        color: var(--danger);
                        font-family: 'Bebas Neue', cursive;
                        font-size: 14px;
                        letter-spacing: 1px;
                        cursor: pointer;
                    ">CAN'T MAKE IT</button>
                ` : ''}
            </div>
        </div>
    `;
}

window.closeStoryModal = function() {
    if (window._storyModalCleanup) { window._storyModalCleanup(); window._storyModalCleanup = null; }
    const modal = document.getElementById('storyModal');
    modal.classList.remove('visible');
    modal.querySelector('.fb-modal').classList.remove('open');
    document.body.style.overflow = '';
};

// Confirm attendance handler
window.confirmAttendance = async function(matchId, leagueId, status) {
    try {
        const result = await callFunction('updatePlayerAvailability', {
            league_id: leagueId,
            match_id: matchId,
            player_id: currentPlayer.id,
            status: status
        });

        if (result.success) {
            const statusText = status === 'confirmed' ? 'confirmed' : 'marked as unavailable';
            toastSuccess(`Your attendance has been ${statusText}.`);
            closeStoryModal();
            // Refresh stories to show updated status
            loadScheduleStories(dashboardData?.roles);
        } else {
            toastError('Failed to update availability. Please try again.');
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        toastError('Failed to update availability. Please try again.');
    }
};

function checkMatchNight(events) {
    const banner = document.getElementById('matchNightBanner');
    if (!banner || !events || events.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's match (not completed)
    const todayMatch = events.find(e => {
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime() && !e.completed;
    });

    if (todayMatch) {
        showMatchNightBanner(todayMatch);
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
    const myStanding = match.myStanding || '';
    const oppStanding = match.oppStanding || '';

    const my3DA = match.myAvg ? (typeof match.myAvg === 'number' ? match.myAvg.toFixed(1) : match.myAvg) : null;
    const opp3DA = match.oppAvg ? (typeof match.oppAvg === 'number' ? match.oppAvg.toFixed(1) : match.oppAvg) : null;

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
        // Team header rows with standing, record, avg
        const myTeamHeader = `
            <div class="match-night-roster-team-header">
                ${myStanding ? `<span class="mn-standing-badge">${myStanding}</span>` : ''}
                <span class="mn-record">${myRecord}</span>
                ${my3DA ? `<span class="mn-avg">${my3DA}</span>` : ''}
            </div>`;
        const oppTeamHeader = `
            <div class="match-night-roster-team-header">
                ${opp3DA ? `<span class="mn-avg">${opp3DA}</span>` : ''}
                <span class="mn-record">${oppRecord}</span>
                ${oppStanding ? `<span class="mn-standing-badge">${oppStanding}</span>` : ''}
            </div>`;

        rosterHtml = '<div class="match-night-roster">';
        rosterHtml += `<div class="match-night-roster-left">${myTeamHeader}`;
        for (let i = 0; i < maxRows; i++) {
            const myPlayer = myRoster[i];
            const oppPlayer = oppRoster[i];

            if (myPlayer) {
                const p3DA = myPlayer.x01_three_dart_avg || myPlayer.avg_3da;
                const pMPR = myPlayer.cricket_mpr || myPlayer.mpr;
                const o3DA = oppPlayer?.x01_three_dart_avg || oppPlayer?.avg_3da;
                const oMPR = oppPlayer?.cricket_mpr || oppPlayer?.mpr;

                const daCompare = compareStats(p3DA, o3DA);
                const mprCompare = compareStats(pMPR, oMPR);

                const p3DAStr = p3DA ? parseFloat(p3DA).toFixed(1) : '-';
                const pMPRStr = pMPR ? parseFloat(pMPR).toFixed(2) : '-';

                rosterHtml += `
                    <div class="match-night-roster-player">
                        <span class="match-night-roster-name">${myPlayer.name}</span>
                        <span class="match-night-roster-stats">
                            <span class="${daCompare.left}">${p3DAStr}</span> / <span class="${mprCompare.left}">${pMPRStr}</span>
                        </span>
                    </div>`;
            } else {
                rosterHtml += '<div class="match-night-roster-player"></div>';
            }
        }
        rosterHtml += `</div><div class="match-night-roster-right">${oppTeamHeader}`;
        for (let i = 0; i < maxRows; i++) {
            const myPlayer = myRoster[i];
            const oppPlayer = oppRoster[i];

            if (oppPlayer) {
                const p3DA = myPlayer?.x01_three_dart_avg || myPlayer?.avg_3da;
                const pMPR = myPlayer?.cricket_mpr || myPlayer?.mpr;
                const o3DA = oppPlayer.x01_three_dart_avg || oppPlayer.avg_3da;
                const oMPR = oppPlayer.cricket_mpr || oppPlayer.mpr;

                const daCompare = compareStats(p3DA, o3DA);
                const mprCompare = compareStats(pMPR, oMPR);

                const o3DAStr = o3DA ? parseFloat(o3DA).toFixed(1) : '-';
                const oMPRStr = oMPR ? parseFloat(oMPR).toFixed(2) : '-';

                rosterHtml += `
                    <div class="match-night-roster-player">
                        <span class="match-night-roster-name">${oppPlayer.name}</span>
                        <span class="match-night-roster-stats">
                            <span class="${daCompare.right}">${o3DAStr}</span> / <span class="${mprCompare.right}">${oMPRStr}</span>
                        </span>
                    </div>`;
            } else {
                rosterHtml += '<div class="match-night-roster-player"></div>';
            }
        }
        rosterHtml += '</div></div>';
    }

    // Render content - match-hub style centered header + roster
    contentEl.innerHTML = `
        <div class="match-night-matchup-header">
            ${match.leagueName ? `<div class="match-night-league-label">${match.leagueName}</div>` : ''}
            <div class="match-night-matchup">
                ${myTeamName}
                <span class="match-night-matchup-vs"> ${vsText} </span>
                ${oppTeamName}
            </div>
            <div class="match-night-time">${matchTime}</div>
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

    // Show captain section if player is captain
    const captainSection = document.getElementById('matchNightCaptain');
    if (captainSection && currentPlayer && currentPlayer.is_captain) {
        // Load team availability status
        loadCaptainAvailabilityStatus(match, captainSection);
    }

    // Show banner
    banner.style.display = 'flex';
}

// Load and display team availability for captains
async function loadCaptainAvailabilityStatus(match, container) {
    try {
        // Get match availability data
        const result = await callFunction('getMatchAvailability', {
            league_id: match.leagueId,
            match_id: match.id
        });

        const availability = result.success ? (result.availability || {}) : {};
        const myRoster = match.myRoster || [];

        // Build status list
        let statusHtml = '<div class="match-night-captain-title">👔 TEAM STATUS</div>';
        statusHtml += '<div class="match-night-status-list">';

        for (const player of myRoster) {
            const playerId = player.id || player.player_id;
            const status = availability[playerId];
            let statusClass = 'pending';
            let statusIcon = '❓';

            if (status === 'available') {
                statusClass = 'confirmed';
                statusIcon = '✓';
            } else if (status === 'unavailable') {
                statusClass = 'declined';
                statusIcon = '✗';
            }

            const firstName = (player.name || '').split(' ')[0];
            statusHtml += `
                <div class="match-night-status-item ${statusClass}">
                    <span class="match-night-status-icon">${statusIcon}</span>
                    <span>${firstName}</span>
                </div>`;
        }

        statusHtml += '</div>';
        statusHtml += `<a href="/pages/captain-dashboard.html?league_id=${match.leagueId}" class="match-night-captain-btn">👔 CAPTAIN DASHBOARD</a>`;

        container.innerHTML = statusHtml;
        container.style.display = 'block';
    } catch (error) {
        console.error('Error loading availability status:', error);
        // Still show captain dashboard button even if availability fails
        container.innerHTML = `<a href="/pages/captain-dashboard.html?league_id=${match.leagueId}" class="match-night-captain-btn">👔 CAPTAIN DASHBOARD</a>`;
        container.style.display = 'block';
    }
}

async function confirmAvailability(status) {
    const match = window.currentMatchNight;
    if (!match) return;

    const confirmBtn = document.getElementById('confirmBtn');
    const cantMakeBtn = document.getElementById('cantMakeBtn');

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
            player_id: currentPlayer.id,
            league_id: match.leagueId,
            match_id: match.id,
            status: status
        });
        const msg = status === 'available' ? "You're confirmed for match night!" : "Got it — captain will be notified.";
        window.toastSuccess(msg);
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

// Expose confirmAvailability to global scope for inline onclick handlers
window.confirmAvailability = confirmAvailability;

// Navigation helpers
window.viewMatch = function(matchId, leagueId) {
    window.location.href = `/pages/match-hub.html?league_id=${leagueId}&match_id=${matchId}`;
};

window.goToProfile = function() {
    let url = `/pages/player-profile.html?player_id=${currentPlayer.id}`;
    if (currentPlayer.league_id) {
        url += `&league_id=${currentPlayer.league_id}`;
    }
    window.location.href = url;
};

export { loadScheduleStories, checkMatchNight, showMatchNightBanner };
