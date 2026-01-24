/**
 * BRDC Chat System - Phase 2: Live Match Ticker Component
 *
 * Horizontal ticker showing all active matches with real-time updates.
 * Click to open match overlay with live scoring details.
 */

import { db, collection, query, where, onSnapshot, callFunction } from './firebase-config.js';
import { CHAT_FEATURES, TICKER_CONFIG } from './chat-config.js';

// ============================================================================
// TICKER STATE
// ============================================================================

let tickerContainer = null;
let tickerContent = null;
let unsubscribeTicker = null;
let autoScrollInterval = null;
let isCollapsed = false;
let currentFilter = 'all';
let dismissedMatches = new Set();
let playerPin = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the live ticker on a page
 * @param {string} containerId - ID of the container element
 */
export function initLiveTicker(containerId = 'liveTicker') {
    if (!CHAT_FEATURES.LIVE_TICKER) {
        return;
    }

    playerPin = localStorage.getItem('brdc_player_pin');

    // Create ticker if container doesn't exist
    tickerContainer = document.getElementById(containerId);
    if (!tickerContainer) {
        tickerContainer = createTickerContainer();
        document.body.insertBefore(tickerContainer, document.body.firstChild);
    }

    tickerContent = tickerContainer.querySelector('.ticker-content');

    // Load preferences
    loadTickerPreferences();

    // Start listening to live matches
    startLiveMatchListener();

    // Setup auto-scroll
    if (TICKER_CONFIG.AUTO_SCROLL_INTERVAL > 0) {
        startAutoScroll();
    }
}

/**
 * Create the ticker container HTML
 */
function createTickerContainer() {
    const container = document.createElement('div');
    container.id = 'liveTicker';
    container.className = 'live-ticker';
    container.innerHTML = `
        <div class="ticker-header">
            <div class="ticker-label">
                <span class="ticker-live-dot"></span>
                <span class="ticker-live-text">LIVE</span>
                <span class="ticker-count">0</span>
            </div>
            <div class="ticker-controls">
                <button class="ticker-control-btn ticker-filter-btn" onclick="window.brdcTicker.showFilterMenu()" title="Filter matches">
                    <span class="ticker-filter-icon">⚙️</span>
                </button>
                <button class="ticker-control-btn ticker-collapse-btn" onclick="window.brdcTicker.toggleCollapse()" title="Collapse ticker">
                    <span class="ticker-collapse-icon">▲</span>
                </button>
            </div>
        </div>
        <div class="ticker-content">
            <div class="ticker-scroll">
                <!-- Match cards will be inserted here -->
            </div>
        </div>
        <div class="ticker-filter-menu" style="display: none;">
            <div class="ticker-filter-option ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Matches</div>
            <div class="ticker-filter-option ${currentFilter === 'leagues' ? 'active' : ''}" data-filter="leagues">Leagues Only</div>
            <div class="ticker-filter-option ${currentFilter === 'tournaments' ? 'active' : ''}" data-filter="tournaments">Tournaments Only</div>
            <div class="ticker-filter-option ${currentFilter === 'following' ? 'active' : ''}" data-filter="following">Following</div>
        </div>
    `;

    // Add styles
    addTickerStyles();

    return container;
}

/**
 * Add ticker CSS styles
 */
function addTickerStyles() {
    if (document.getElementById('live-ticker-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'live-ticker-styles';
    styles.textContent = `
        .live-ticker {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            border-bottom: 3px solid #91D7EB;
            z-index: 1000;
            transition: transform 0.3s ease;
        }

        .live-ticker.collapsed {
            transform: translateY(-100%);
        }

        .live-ticker.collapsed .ticker-header {
            transform: translateY(100%);
            background: rgba(22, 33, 62, 0.95);
            border-bottom: 2px solid #91D7EB;
            border-radius: 0 0 12px 12px;
        }

        .ticker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            transition: transform 0.3s ease;
        }

        .ticker-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Bebas Neue', cursive;
            font-size: 14px;
            color: #f0f0f0;
        }

        .ticker-live-dot {
            width: 8px;
            height: 8px;
            background: #ff4444;
            border-radius: 50%;
            animation: livePulse 1.5s infinite;
        }

        @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
        }

        .ticker-live-text {
            color: #ff4444;
            font-weight: bold;
        }

        .ticker-count {
            background: rgba(255, 70, 154, 0.3);
            color: #FF469A;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
        }

        .ticker-controls {
            display: flex;
            gap: 8px;
        }

        .ticker-control-btn {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            padding: 4px 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }

        .ticker-control-btn:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .ticker-content {
            overflow: hidden;
            padding: 0 16px 12px;
        }

        .ticker-scroll {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
        }

        .ticker-scroll::-webkit-scrollbar {
            height: 4px;
        }

        .ticker-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }

        .ticker-scroll::-webkit-scrollbar-thumb {
            background: #91D7EB;
            border-radius: 2px;
        }

        .ticker-card {
            flex: 0 0 auto;
            min-width: 220px;
            max-width: 280px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 10px 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .ticker-card:hover {
            background: rgba(145, 215, 235, 0.1);
            border-color: #91D7EB;
            transform: translateY(-2px);
        }

        .ticker-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .ticker-card-event {
            font-size: 10px;
            color: #8a8aa3;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px;
        }

        .ticker-card-board {
            font-size: 10px;
            color: #91D7EB;
            background: rgba(145, 215, 235, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
        }

        .ticker-card-matchup {
            font-size: 13px;
            color: #f0f0f0;
            font-weight: 600;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ticker-card-score {
            display: flex;
            justify-content: center;
            gap: 8px;
            font-family: 'Bebas Neue', cursive;
            font-size: 20px;
        }

        .ticker-card-score .team1 {
            color: #FF469A;
        }

        .ticker-card-score .vs {
            color: #8a8aa3;
            font-size: 14px;
        }

        .ticker-card-score .team2 {
            color: #91D7EB;
        }

        .ticker-card-leg {
            text-align: center;
            font-size: 10px;
            color: #8a8aa3;
            margin-top: 4px;
        }

        .ticker-card-dismiss {
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #8a8aa3;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            font-size: 10px;
            cursor: pointer;
            display: none;
        }

        .ticker-card:hover .ticker-card-dismiss {
            display: block;
        }

        .ticker-empty {
            padding: 12px 20px;
            text-align: center;
            color: #8a8aa3;
            font-size: 13px;
        }

        .ticker-filter-menu {
            position: absolute;
            top: 100%;
            right: 16px;
            background: #16213e;
            border: 2px solid #91D7EB;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 1001;
        }

        .ticker-filter-option {
            padding: 10px 16px;
            cursor: pointer;
            font-size: 13px;
            color: #f0f0f0;
            transition: background 0.2s;
        }

        .ticker-filter-option:hover {
            background: rgba(145, 215, 235, 0.2);
        }

        .ticker-filter-option.active {
            background: rgba(255, 70, 154, 0.2);
            color: #FF469A;
        }

        /* Adjust page content when ticker is visible */
        body.has-ticker {
            padding-top: 90px;
        }

        body.has-ticker.ticker-collapsed {
            padding-top: 40px;
        }
    `;

    document.head.appendChild(styles);
}

// ============================================================================
// REAL-TIME UPDATES
// ============================================================================

/**
 * Start listening to live matches
 */
function startLiveMatchListener() {
    if (unsubscribeTicker) {
        unsubscribeTicker();
    }

    const liveMatchesRef = collection(db, 'live_matches');
    const q = query(liveMatchesRef, where('status', '==', 'live'));

    unsubscribeTicker = onSnapshot(q, (snapshot) => {
        const matches = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Skip dismissed matches
            if (!dismissedMatches.has(doc.id)) {
                matches.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        // Apply filter
        const filteredMatches = applyFilter(matches);

        renderTickerCards(filteredMatches);
        updateTickerCount(filteredMatches.length);

        // Update body class
        if (filteredMatches.length > 0) {
            document.body.classList.add('has-ticker');
        } else {
            document.body.classList.remove('has-ticker');
        }
    });
}

/**
 * Apply current filter to matches
 */
function applyFilter(matches) {
    if (currentFilter === 'all') {
        return matches;
    }

    if (currentFilter === 'leagues') {
        return matches.filter(m => m.event_type === 'league');
    }

    if (currentFilter === 'tournaments') {
        return matches.filter(m => m.event_type === 'tournament');
    }

    if (currentFilter === 'following') {
        // Get following list from localStorage
        const following = JSON.parse(localStorage.getItem('brdc_following_players') || '[]');
        return matches.filter(m => {
            const allPlayers = [...(m.team1_player_ids || []), ...(m.team2_player_ids || [])];
            return allPlayers.some(pid => following.includes(pid));
        });
    }

    return matches;
}

/**
 * Render ticker cards
 */
function renderTickerCards(matches) {
    const scrollContainer = tickerContainer.querySelector('.ticker-scroll');

    if (!matches || matches.length === 0) {
        scrollContainer.innerHTML = `
            <div class="ticker-empty">
                No live matches right now
            </div>
        `;
        return;
    }

    let html = '';
    matches.forEach(match => {
        const team1Names = (match.team1_player_names || []).join('/') || match.team1_name || 'Team 1';
        const team2Names = (match.team2_player_names || []).join('/') || match.team2_name || 'Team 2';

        // Truncate names for display
        const displayTeam1 = truncateName(team1Names, 15);
        const displayTeam2 = truncateName(team2Names, 15);

        const currentLegInfo = match.current_leg ?
            `Leg ${match.current_leg.leg_number || 1}: ${match.current_leg.team1_score || match.starting_score || 501} - ${match.current_leg.team2_score || match.starting_score || 501}` :
            '';

        html += `
            <div class="ticker-card" data-match-id="${match.id}" onclick="window.brdcTicker.openMatchOverlay('${match.id}')">
                <button class="ticker-card-dismiss" onclick="event.stopPropagation(); window.brdcTicker.dismissMatch('${match.id}')" title="Dismiss">×</button>
                <div class="ticker-card-header">
                    <span class="ticker-card-event">${match.event_name || 'Match'}</span>
                    ${match.board_number ? `<span class="ticker-card-board">Board ${match.board_number}</span>` : ''}
                </div>
                <div class="ticker-card-matchup">${displayTeam1} vs ${displayTeam2}</div>
                <div class="ticker-card-score">
                    <span class="team1">${match.team1_games_won || 0}</span>
                    <span class="vs">-</span>
                    <span class="team2">${match.team2_games_won || 0}</span>
                </div>
                ${currentLegInfo ? `<div class="ticker-card-leg">${currentLegInfo}</div>` : ''}
            </div>
        `;
    });

    scrollContainer.innerHTML = html;
}

/**
 * Truncate a name for display
 */
function truncateName(name, maxLen) {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 2) + '...';
}

/**
 * Update the match count display
 */
function updateTickerCount(count) {
    const countEl = tickerContainer.querySelector('.ticker-count');
    if (countEl) {
        countEl.textContent = count;
    }
}

// ============================================================================
// USER INTERACTIONS
// ============================================================================

/**
 * Toggle ticker collapse state
 */
export function toggleCollapse() {
    isCollapsed = !isCollapsed;
    tickerContainer.classList.toggle('collapsed', isCollapsed);
    document.body.classList.toggle('ticker-collapsed', isCollapsed);

    const collapseIcon = tickerContainer.querySelector('.ticker-collapse-icon');
    if (collapseIcon) {
        collapseIcon.textContent = isCollapsed ? '▼' : '▲';
    }

    // Save preference
    saveTickerPreferences();
}

/**
 * Show filter menu
 */
export function showFilterMenu() {
    const menu = tickerContainer.querySelector('.ticker-filter-menu');
    const isVisible = menu.style.display !== 'none';

    menu.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        // Update active state
        menu.querySelectorAll('.ticker-filter-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.filter === currentFilter);
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', closeFilterMenuOnClickOutside, { once: true });
        }, 10);
    }
}

function closeFilterMenuOnClickOutside(e) {
    const menu = tickerContainer.querySelector('.ticker-filter-menu');
    if (!menu.contains(e.target) && !e.target.classList.contains('ticker-filter-btn')) {
        menu.style.display = 'none';
    }
}

/**
 * Set filter
 */
export function setFilter(filter) {
    currentFilter = filter;

    // Update menu
    const menu = tickerContainer.querySelector('.ticker-filter-menu');
    menu.querySelectorAll('.ticker-filter-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.filter === filter);
    });
    menu.style.display = 'none';

    // Refresh ticker
    startLiveMatchListener();

    // Save preference
    saveTickerPreferences();
}

/**
 * Dismiss a match from the ticker
 */
export function dismissMatch(matchId) {
    dismissedMatches.add(matchId);
    saveTickerPreferences();

    // Remove the card
    const card = tickerContainer.querySelector(`[data-match-id="${matchId}"]`);
    if (card) {
        card.remove();
    }

    // Update count
    const currentCount = parseInt(tickerContainer.querySelector('.ticker-count').textContent || '0');
    updateTickerCount(Math.max(0, currentCount - 1));
}

/**
 * Open match overlay
 */
export async function openMatchOverlay(matchId) {
    if (!CHAT_FEATURES.MATCH_OVERLAY) {
        // Fall back to match page
        window.location.href = `/pages/match-report.html?id=${matchId}`;
        return;
    }

    try {
        // Get match details
        const result = await callFunction('getLiveMatchDetails', {
            player_pin: playerPin,
            match_id: matchId
        });

        if (result.success) {
            showMatchOverlay(result.match);
        } else {
            console.error('Failed to get match details:', result.error);
        }
    } catch (error) {
        console.error('Error opening match overlay:', error);
    }
}

/**
 * Show the match overlay modal
 */
function showMatchOverlay(match) {
    // Remove existing overlay
    const existingOverlay = document.getElementById('matchOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const gameType = match.game_type || '501';
    const is501 = gameType === '501' || gameType === '301';

    let statsHtml = '';
    if (match.player_stats) {
        const statRows = Object.entries(match.player_stats).map(([id, stats]) => {
            if (is501) {
                return `
                    <tr>
                        <td>${stats.name}</td>
                        <td>${(stats.match_ppd || 0).toFixed(1)}</td>
                        <td>${(stats.season_ppd || 0).toFixed(1)}</td>
                        <td>${stats.ton_plus_count || 0}</td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${stats.name}</td>
                        <td>${(stats.match_mpr || 0).toFixed(2)}</td>
                        <td>${(stats.season_mpr || 0).toFixed(2)}</td>
                        <td>${stats.marks_count || 0}</td>
                    </tr>
                `;
            }
        }).join('');

        statsHtml = `
            <div class="overlay-stats">
                <h4>Match Stats</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>${is501 ? 'Match PPD' : 'Match MPR'}</th>
                            <th>${is501 ? 'Season PPD' : 'Season MPR'}</th>
                            <th>${is501 ? 'Ton+' : 'Marks'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    let historyHtml = '';
    if (match.shot_history && match.shot_history.length > 0) {
        const shots = match.shot_history.map(shot => {
            const tonClass = shot.is_ton_plus ? 'ton-plus' : '';
            return `<div class="shot-entry ${tonClass}">
                <span class="shot-player">${shot.player_name}:</span>
                <span class="shot-score">${shot.score}</span>
            </div>`;
        }).join('');

        historyHtml = `
            <div class="overlay-history">
                <h4>Recent Throws</h4>
                ${shots}
            </div>
        `;
    }

    const overlay = document.createElement('div');
    overlay.id = 'matchOverlay';
    overlay.className = 'match-overlay';
    overlay.innerHTML = `
        <div class="match-overlay-backdrop" onclick="window.brdcTicker.closeMatchOverlay()"></div>
        <div class="match-overlay-content">
            <button class="overlay-close" onclick="window.brdcTicker.closeMatchOverlay()">×</button>

            <div class="overlay-header">
                <div class="overlay-event">${match.event_name || 'Match'} | ${match.round || ''} ${match.board_number ? `| Board ${match.board_number}` : ''}</div>
                <div class="overlay-matchup">${match.team1.name || match.team1.player_names?.join('/') || 'Team 1'} vs ${match.team2.name || match.team2.player_names?.join('/') || 'Team 2'}</div>
                <div class="overlay-score">
                    <span class="score-team1">${match.team1.games_won}</span>
                    <span class="score-divider">-</span>
                    <span class="score-team2">${match.team2.games_won}</span>
                </div>
            </div>

            <div class="overlay-current-leg">
                <h4>Current Leg (Leg ${match.current_leg.leg_number || 1}) - ${match.current_leg.throwing === 'team1' ? 'Team 1' : 'Team 2'} Throwing</h4>
                <div class="leg-scores">
                    <div class="leg-score-box team1">
                        <div class="leg-team-name">${match.team1.player_names?.[0] || 'Team 1'}</div>
                        <div class="leg-score">${match.current_leg.team1_score}</div>
                        <div class="leg-darts">${match.current_leg.team1_darts} darts</div>
                    </div>
                    <div class="leg-score-box team2">
                        <div class="leg-team-name">${match.team2.player_names?.[0] || 'Team 2'}</div>
                        <div class="leg-score">${match.current_leg.team2_score}</div>
                        <div class="leg-darts">${match.current_leg.team2_darts} darts</div>
                    </div>
                </div>
            </div>

            ${historyHtml}
            ${statsHtml}

            <div class="overlay-actions">
                <a href="/pages/match-report.html?id=${match.match_id}" class="overlay-btn">View Full Scoresheet</a>
                ${match.chat_room_id ? `<a href="/pages/chat-room.html?id=${match.chat_room_id}" class="overlay-btn secondary">Jump to Match Chat</a>` : ''}
            </div>

            <div class="overlay-footer">
                <span class="spectator-count">👁 ${match.spectator_count} watching</span>
            </div>
        </div>
    `;

    // Add overlay styles
    addOverlayStyles();

    document.body.appendChild(overlay);

    // Setup real-time updates for the overlay
    setupOverlayUpdates(match.id);
}

/**
 * Close the match overlay
 */
export function closeMatchOverlay() {
    const overlay = document.getElementById('matchOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Setup real-time updates for the overlay
 */
function setupOverlayUpdates(matchId) {
    // This would use onSnapshot to update the overlay in real-time
    // For now, it will update when the ticker updates
}

/**
 * Add overlay CSS styles
 */
function addOverlayStyles() {
    if (document.getElementById('match-overlay-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'match-overlay-styles';
    styles.textContent = `
        .match-overlay {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 60px 20px 20px;
            overflow-y: auto;
        }

        .match-overlay-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
        }

        .match-overlay-content {
            position: relative;
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            border: 2px solid #91D7EB;
            border-radius: 16px;
            max-width: 600px;
            width: 100%;
            padding: 24px;
            color: #f0f0f0;
        }

        .overlay-close {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: #8a8aa3;
            font-size: 28px;
            cursor: pointer;
            padding: 0 8px;
        }

        .overlay-close:hover {
            color: #f0f0f0;
        }

        .overlay-header {
            text-align: center;
            margin-bottom: 24px;
        }

        .overlay-event {
            font-size: 12px;
            color: #8a8aa3;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .overlay-matchup {
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            margin-bottom: 12px;
        }

        .overlay-score {
            display: flex;
            justify-content: center;
            gap: 16px;
            font-family: 'Bebas Neue', cursive;
            font-size: 48px;
        }

        .overlay-score .score-team1 {
            color: #FF469A;
        }

        .overlay-score .score-team2 {
            color: #91D7EB;
        }

        .overlay-score .score-divider {
            color: #8a8aa3;
        }

        .overlay-current-leg {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .overlay-current-leg h4 {
            font-size: 12px;
            color: #91D7EB;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .leg-scores {
            display: flex;
            gap: 16px;
        }

        .leg-score-box {
            flex: 1;
            text-align: center;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }

        .leg-score-box.team1 {
            border: 2px solid rgba(255, 70, 154, 0.3);
        }

        .leg-score-box.team2 {
            border: 2px solid rgba(145, 215, 235, 0.3);
        }

        .leg-team-name {
            font-size: 12px;
            color: #8a8aa3;
            margin-bottom: 4px;
        }

        .leg-score {
            font-family: 'Bebas Neue', cursive;
            font-size: 36px;
        }

        .leg-darts {
            font-size: 11px;
            color: #8a8aa3;
        }

        .overlay-history {
            margin-bottom: 16px;
        }

        .overlay-history h4 {
            font-size: 12px;
            color: #91D7EB;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .shot-entry {
            display: flex;
            gap: 8px;
            font-size: 13px;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .shot-entry.ton-plus .shot-score {
            color: #FF469A;
            font-weight: bold;
        }

        .shot-player {
            color: #8a8aa3;
        }

        .overlay-stats {
            margin-bottom: 16px;
        }

        .overlay-stats h4 {
            font-size: 12px;
            color: #91D7EB;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .overlay-stats table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        .overlay-stats th, .overlay-stats td {
            padding: 8px;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .overlay-stats th {
            color: #8a8aa3;
            font-weight: normal;
        }

        .overlay-actions {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }

        .overlay-btn {
            flex: 1;
            padding: 12px 16px;
            background: #91D7EB;
            color: #000;
            text-align: center;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
        }

        .overlay-btn:hover {
            background: #FF469A;
        }

        .overlay-btn.secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #f0f0f0;
        }

        .overlay-footer {
            text-align: center;
            margin-top: 16px;
            color: #8a8aa3;
            font-size: 12px;
        }

        .spectator-count {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
    `;

    document.head.appendChild(styles);
}

// ============================================================================
// AUTO-SCROLL
// ============================================================================

/**
 * Start auto-scrolling the ticker
 */
function startAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }

    autoScrollInterval = setInterval(() => {
        if (isCollapsed) return;

        const scrollContainer = tickerContainer.querySelector('.ticker-scroll');
        if (!scrollContainer) return;

        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        if (maxScroll <= 0) return;

        const currentScroll = scrollContainer.scrollLeft;
        const cardWidth = 240; // approximate card width + gap

        if (currentScroll >= maxScroll - 10) {
            // Reset to start
            scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            // Scroll by one card
            scrollContainer.scrollBy({ left: cardWidth, behavior: 'smooth' });
        }
    }, TICKER_CONFIG.AUTO_SCROLL_INTERVAL);
}

// ============================================================================
// PREFERENCES
// ============================================================================

/**
 * Load ticker preferences
 */
async function loadTickerPreferences() {
    // Load from localStorage first
    const localPrefs = localStorage.getItem('brdc_ticker_prefs');
    if (localPrefs) {
        try {
            const prefs = JSON.parse(localPrefs);
            isCollapsed = prefs.collapsed || false;
            currentFilter = prefs.filter || 'all';
            dismissedMatches = new Set(prefs.dismissed || []);

            // Apply collapsed state
            if (isCollapsed) {
                tickerContainer.classList.add('collapsed');
                document.body.classList.add('ticker-collapsed');
            }
        } catch (e) {
            console.error('Error loading ticker prefs:', e);
        }
    }

    // Try to load from server if logged in
    if (playerPin) {
        try {
            const result = await callFunction('getTickerPreferences', {
                player_pin: playerPin
            });

            if (result.success && result.preferences) {
                const prefs = result.preferences;
                if (prefs.collapsed !== undefined) isCollapsed = prefs.collapsed;
                if (prefs.filter) currentFilter = prefs.filter;
                if (prefs.dismissed_matches) dismissedMatches = new Set(prefs.dismissed_matches);
            }
        } catch (e) {
            // Use local prefs
        }
    }
}

/**
 * Save ticker preferences
 */
async function saveTickerPreferences() {
    const prefs = {
        collapsed: isCollapsed,
        filter: currentFilter,
        dismissed: Array.from(dismissedMatches)
    };

    // Save locally
    localStorage.setItem('brdc_ticker_prefs', JSON.stringify(prefs));

    // Save to server if logged in
    if (playerPin) {
        try {
            await callFunction('updateTickerPreferences', {
                player_pin: playerPin,
                preferences: {
                    collapsed: isCollapsed,
                    filter: currentFilter,
                    dismissed_matches: Array.from(dismissedMatches)
                }
            });
        } catch (e) {
            // Local save is enough
        }
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup ticker resources
 */
export function destroyTicker() {
    if (unsubscribeTicker) {
        unsubscribeTicker();
    }
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }
    if (tickerContainer) {
        tickerContainer.remove();
    }
    document.body.classList.remove('has-ticker', 'ticker-collapsed');
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

// Make functions available globally for onclick handlers
window.brdcTicker = {
    toggleCollapse,
    showFilterMenu,
    setFilter,
    dismissMatch,
    openMatchOverlay,
    closeMatchOverlay
};

// Setup filter option click handlers after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('ticker-filter-option')) {
            setFilter(e.target.dataset.filter);
        }
    });
});
