/**
 * BRDC Chat System - Phase 3: Challenge System Component
 *
 * Send challenges, manage pending challenges, and track head-to-head stats.
 */

import { db, collection, query, where, onSnapshot, callFunction } from './firebase-config.js';
import { CHAT_FEATURES, CHALLENGE_CONFIG, LEADERBOARD_CONFIG } from './chat-config.js';

// ============================================================================
// CHALLENGE STATE
// ============================================================================

let playerPin = null;
let currentPlayerId = null;
let unsubscribeChallenges = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the challenge system
 */
export function initChallengeSystem() {
    if (!CHAT_FEATURES.CHALLENGE_SYSTEM) {
        return;
    }

    playerPin = localStorage.getItem('brdc_player_pin');
    currentPlayerId = localStorage.getItem('brdc_player_id');
}

// ============================================================================
// CHALLENGE MODAL
// ============================================================================

/**
 * Open the challenge modal for a specific player
 * @param {string} playerId - ID of the player to challenge
 * @param {string} playerName - Name of the player
 */
export async function openChallengeModal(playerId, playerName) {
    if (!CHAT_FEATURES.CHALLENGE_SYSTEM) {
        alert('Challenge system is not enabled');
        return;
    }

    if (!playerPin) {
        alert('Please log in to send challenges');
        return;
    }

    if (playerId === currentPlayerId) {
        alert('You cannot challenge yourself');
        return;
    }

    // Get head-to-head stats
    let h2hHtml = '';
    try {
        const result = await callFunction('getHeadToHead', {
            player_pin: playerPin,
            opponent_id: playerId
        });

        if (result.success && result.total_matches > 0) {
            h2hHtml = `
                <div class="challenge-h2h">
                    <h4>Head-to-Head Record</h4>
                    <div class="h2h-stats">
                        <div class="h2h-player">
                            <div class="h2h-name">You</div>
                            <div class="h2h-wins ${result.leader === 'player' ? 'leading' : ''}">${result.player.wins}</div>
                        </div>
                        <div class="h2h-vs">vs</div>
                        <div class="h2h-player">
                            <div class="h2h-name">${result.opponent.name.split(' ')[0]}</div>
                            <div class="h2h-wins ${result.leader === 'opponent' ? 'leading' : ''}">${result.opponent.wins}</div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        // Continue without H2H
    }

    // Create modal
    const existingModal = document.getElementById('challengeModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'challengeModal';
    modal.className = 'challenge-modal';
    modal.innerHTML = `
        <div class="challenge-modal-backdrop" onclick="window.brdcChallenge.closeChallengeModal()"></div>
        <div class="challenge-modal-content">
            <button class="challenge-modal-close" onclick="window.brdcChallenge.closeChallengeModal()">×</button>

            <div class="challenge-modal-header">
                <h3>🎯 Challenge ${playerName}</h3>
            </div>

            ${h2hHtml}

            <form id="challengeForm" onsubmit="window.brdcChallenge.submitChallenge(event)">
                <input type="hidden" name="challenged_player_id" value="${playerId}">

                <div class="challenge-form-group">
                    <label>Game Type</label>
                    <div class="challenge-options">
                        ${CHALLENGE_CONFIG.GAME_TYPES.map((type, i) =>
                            `<label class="challenge-option ${i === 0 ? 'selected' : ''}">
                                <input type="radio" name="game_type" value="${type}" ${i === 0 ? 'checked' : ''}>
                                <span>${type === 'cricket' ? 'Cricket' : type}</span>
                            </label>`
                        ).join('')}
                    </div>
                </div>

                <div class="challenge-form-group">
                    <label>Race To</label>
                    <div class="challenge-options">
                        ${CHALLENGE_CONFIG.RACE_TO_OPTIONS.map((num, i) =>
                            `<label class="challenge-option ${i === 0 ? 'selected' : ''}">
                                <input type="radio" name="race_to" value="${num}" ${i === 0 ? 'checked' : ''}>
                                <span>${num}</span>
                            </label>`
                        ).join('')}
                    </div>
                </div>

                <div class="challenge-form-group">
                    <label>Message (optional)</label>
                    <input type="text" name="message" placeholder="Let's play!" maxlength="200" class="challenge-input">
                </div>

                <button type="submit" class="challenge-submit-btn">
                    🎯 Send Challenge
                </button>
            </form>
        </div>
    `;

    addChallengeStyles();
    document.body.appendChild(modal);

    // Setup radio button selection styling
    modal.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const group = radio.closest('.challenge-options');
            group.querySelectorAll('.challenge-option').forEach(opt => {
                opt.classList.toggle('selected', opt.querySelector('input').checked);
            });
        });
    });
}

/**
 * Close the challenge modal
 */
export function closeChallengeModal() {
    const modal = document.getElementById('challengeModal');
    if (modal) modal.remove();
}

/**
 * Submit a challenge
 */
export async function submitChallenge(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const challengedPlayerId = formData.get('challenged_player_id');
    const gameType = formData.get('game_type');
    const raceTo = parseInt(formData.get('race_to'));
    const message = formData.get('message') || '';

    const submitBtn = form.querySelector('.challenge-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const result = await callFunction('sendChallenge', {
            challenger_pin: playerPin,
            challenged_player_id: challengedPlayerId,
            game_type: gameType,
            race_to: raceTo,
            message: message
        });

        if (result.success) {
            closeChallengeModal();
            showChallengeNotification('Challenge sent!', 'success');
        } else {
            showChallengeNotification(result.error || 'Failed to send challenge', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🎯 Send Challenge';
        }
    } catch (error) {
        console.error('Error sending challenge:', error);
        showChallengeNotification('Failed to send challenge', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '🎯 Send Challenge';
    }
}

// ============================================================================
// CHALLENGES LIST
// ============================================================================

/**
 * Open the challenges list panel
 */
export async function openChallengesList() {
    if (!playerPin) {
        alert('Please log in to view challenges');
        return;
    }

    const existingPanel = document.getElementById('challengesPanel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'challengesPanel';
    panel.className = 'challenges-panel';
    panel.innerHTML = `
        <div class="challenges-panel-backdrop" onclick="window.brdcChallenge.closeChallengesList()"></div>
        <div class="challenges-panel-content">
            <div class="challenges-panel-header">
                <h3>🎯 Challenges</h3>
                <button class="challenges-panel-close" onclick="window.brdcChallenge.closeChallengesList()">×</button>
            </div>

            <div class="challenges-tabs">
                <button class="challenges-tab active" data-tab="received" onclick="window.brdcChallenge.switchChallengesTab('received')">Received</button>
                <button class="challenges-tab" data-tab="sent" onclick="window.brdcChallenge.switchChallengesTab('sent')">Sent</button>
            </div>

            <div class="challenges-list" id="challengesList">
                <div class="challenges-loading">Loading...</div>
            </div>
        </div>
    `;

    addChallengeStyles();
    document.body.appendChild(panel);

    // Load challenges
    loadChallenges('received');

    // Start real-time listener
    startChallengesListener();
}

/**
 * Close the challenges list
 */
export function closeChallengesList() {
    const panel = document.getElementById('challengesPanel');
    if (panel) panel.remove();

    if (unsubscribeChallenges) {
        unsubscribeChallenges();
        unsubscribeChallenges = null;
    }
}

/**
 * Switch challenges tab
 */
export function switchChallengesTab(tab) {
    const panel = document.getElementById('challengesPanel');
    if (!panel) return;

    panel.querySelectorAll('.challenges-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    loadChallenges(tab);
}

/**
 * Load challenges
 */
async function loadChallenges(tab) {
    const listContainer = document.getElementById('challengesList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="challenges-loading">Loading...</div>';

    try {
        const result = await callFunction('getPlayerChallenges', {
            player_pin: playerPin,
            filter: 'pending'
        });

        if (result.success) {
            const challenges = tab === 'received' ? result.received : result.sent;
            renderChallengesList(challenges, tab);
        } else {
            listContainer.innerHTML = '<div class="challenges-error">Failed to load challenges</div>';
        }
    } catch (error) {
        console.error('Error loading challenges:', error);
        listContainer.innerHTML = '<div class="challenges-error">Failed to load challenges</div>';
    }
}

/**
 * Render challenges list
 */
function renderChallengesList(challenges, tab) {
    const listContainer = document.getElementById('challengesList');
    if (!listContainer) return;

    if (!challenges || challenges.length === 0) {
        listContainer.innerHTML = `
            <div class="challenges-empty">
                <div class="challenges-empty-icon">${tab === 'received' ? '📭' : '📤'}</div>
                <div class="challenges-empty-text">
                    ${tab === 'received' ? 'No pending challenges' : 'No sent challenges'}
                </div>
            </div>
        `;
        return;
    }

    let html = '';
    challenges.forEach(challenge => {
        const otherPlayer = tab === 'received' ? challenge.challenger_name : challenge.challenged_name;
        const expiresAt = challenge.expires_at ? new Date(challenge.expires_at) : null;
        const expiresIn = expiresAt ? formatTimeRemaining(expiresAt - Date.now()) : '';

        html += `
            <div class="challenge-card">
                <div class="challenge-card-header">
                    <span class="challenge-player">${otherPlayer}</span>
                    <span class="challenge-game-type">${challenge.game_type === 'cricket' ? 'Cricket' : challenge.game_type}</span>
                </div>
                <div class="challenge-card-details">
                    Race to ${challenge.race_to}
                    ${challenge.message ? `<span class="challenge-message">"${challenge.message}"</span>` : ''}
                </div>
                <div class="challenge-card-footer">
                    ${expiresIn ? `<span class="challenge-expires">Expires in ${expiresIn}</span>` : ''}
                </div>
                <div class="challenge-card-actions">
                    ${tab === 'received' ? `
                        <button class="challenge-action-btn accept" onclick="window.brdcChallenge.respondToChallenge('${challenge.id}', 'accept')">Accept</button>
                        <button class="challenge-action-btn decline" onclick="window.brdcChallenge.respondToChallenge('${challenge.id}', 'decline')">Decline</button>
                    ` : `
                        <button class="challenge-action-btn cancel" onclick="window.brdcChallenge.cancelChallenge('${challenge.id}')">Cancel</button>
                    `}
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

/**
 * Format time remaining
 */
function formatTimeRemaining(ms) {
    if (ms < 0) return 'Expired';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Respond to a challenge
 */
export async function respondToChallenge(challengeId, response) {
    try {
        const result = await callFunction('respondToChallenge', {
            player_pin: playerPin,
            challenge_id: challengeId,
            response: response
        });

        if (result.success) {
            if (response === 'accept') {
                showChallengeNotification('Challenge accepted! Ready to play.', 'success');
                closeChallengesList();

                // Open scorer if available
                if (result.scorer_url) {
                    window.location.href = result.scorer_url;
                }
            } else {
                showChallengeNotification('Challenge declined', 'info');
                loadChallenges('received');
            }
        } else {
            showChallengeNotification(result.error || 'Failed to respond', 'error');
        }
    } catch (error) {
        console.error('Error responding to challenge:', error);
        showChallengeNotification('Failed to respond', 'error');
    }
}

/**
 * Cancel a challenge
 */
export async function cancelChallenge(challengeId) {
    if (!confirm('Cancel this challenge?')) return;

    try {
        const result = await callFunction('cancelChallenge', {
            player_pin: playerPin,
            challenge_id: challengeId
        });

        if (result.success) {
            showChallengeNotification('Challenge cancelled', 'info');
            loadChallenges('sent');
        } else {
            showChallengeNotification(result.error || 'Failed to cancel', 'error');
        }
    } catch (error) {
        console.error('Error cancelling challenge:', error);
        showChallengeNotification('Failed to cancel', 'error');
    }
}

/**
 * Start real-time challenges listener
 */
function startChallengesListener() {
    if (unsubscribeChallenges) {
        unsubscribeChallenges();
    }

    if (!currentPlayerId) return;

    const challengesRef = collection(db, 'challenges');
    const receivedQuery = query(challengesRef,
        where('challenged_id', '==', currentPlayerId),
        where('status', '==', 'pending')
    );

    unsubscribeChallenges = onSnapshot(receivedQuery, () => {
        const activeTab = document.querySelector('.challenges-tab.active');
        if (activeTab) {
            loadChallenges(activeTab.dataset.tab);
        }
    });
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Open the casual leaderboard
 */
export async function openLeaderboard(category = 'most_wins') {
    if (!CHAT_FEATURES.LEADERBOARDS) {
        alert('Leaderboards are not enabled');
        return;
    }

    if (!playerPin) {
        alert('Please log in to view leaderboards');
        return;
    }

    const existingPanel = document.getElementById('leaderboardPanel');
    if (existingPanel) existingPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'leaderboardPanel';
    panel.className = 'leaderboard-panel';
    panel.innerHTML = `
        <div class="leaderboard-panel-backdrop" onclick="window.brdcChallenge.closeLeaderboard()"></div>
        <div class="leaderboard-panel-content">
            <div class="leaderboard-panel-header">
                <h3>🏆 Casual Leaderboard</h3>
                <button class="leaderboard-panel-close" onclick="window.brdcChallenge.closeLeaderboard()">×</button>
            </div>

            <div class="leaderboard-categories">
                ${LEADERBOARD_CONFIG.CATEGORIES.map(cat =>
                    `<button class="leaderboard-category ${cat.id === category ? 'active' : ''}"
                             data-category="${cat.id}"
                             onclick="window.brdcChallenge.switchLeaderboardCategory('${cat.id}')">
                        ${cat.icon} ${cat.label}
                    </button>`
                ).join('')}
            </div>

            <div class="leaderboard-list" id="leaderboardList">
                <div class="leaderboard-loading">Loading...</div>
            </div>
        </div>
    `;

    addChallengeStyles();
    document.body.appendChild(panel);

    loadLeaderboard(category);
}

/**
 * Close leaderboard
 */
export function closeLeaderboard() {
    const panel = document.getElementById('leaderboardPanel');
    if (panel) panel.remove();
}

/**
 * Switch leaderboard category
 */
export function switchLeaderboardCategory(category) {
    const panel = document.getElementById('leaderboardPanel');
    if (!panel) return;

    panel.querySelectorAll('.leaderboard-category').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    loadLeaderboard(category);
}

/**
 * Load leaderboard data
 */
async function loadLeaderboard(category) {
    const listContainer = document.getElementById('leaderboardList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="leaderboard-loading">Loading...</div>';

    try {
        const result = await callFunction('getCasualLeaderboard', {
            player_pin: playerPin,
            category: category
        });

        if (result.success) {
            renderLeaderboard(result.leaders, category, result.player_rank);
        } else {
            listContainer.innerHTML = '<div class="leaderboard-error">Failed to load leaderboard</div>';
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        listContainer.innerHTML = '<div class="leaderboard-error">Failed to load leaderboard</div>';
    }
}

/**
 * Render leaderboard
 */
function renderLeaderboard(leaders, category, playerRank) {
    const listContainer = document.getElementById('leaderboardList');
    if (!listContainer) return;

    if (!leaders || leaders.length === 0) {
        listContainer.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">📊</div>
                <div class="leaderboard-empty-text">No data yet. Play some casual matches!</div>
            </div>
        `;
        return;
    }

    const getValueDisplay = (leader) => {
        switch (category) {
            case 'most_wins': return leader.wins;
            case 'win_rate': return `${(leader.win_rate * 100).toFixed(1)}%`;
            case 'win_streak': return leader.current_streak;
            case 'highest_ppd': return leader.avg_ppd.toFixed(1);
            default: return leader.wins;
        }
    };

    let html = '';
    leaders.forEach((leader, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const isCurrentPlayer = leader.player_id === currentPlayerId;

        html += `
            <div class="leaderboard-row ${rankClass} ${isCurrentPlayer ? 'current-player' : ''}"
                 onclick="window.brdcChallenge.openChallengeModal('${leader.player_id}', '${leader.name.replace(/'/g, "\\'")}')">
                <div class="leaderboard-rank">
                    ${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                </div>
                <div class="leaderboard-player">
                    <div class="leaderboard-name">${leader.name}</div>
                    <div class="leaderboard-record">${leader.wins}W - ${leader.losses}L</div>
                </div>
                <div class="leaderboard-value">${getValueDisplay(leader)}</div>
            </div>
        `;
    });

    if (playerRank && playerRank > 20) {
        html += `
            <div class="leaderboard-your-rank">
                Your rank: #${playerRank}
            </div>
        `;
    }

    listContainer.innerHTML = html;
}

// ============================================================================
// REMATCH
// ============================================================================

/**
 * Send a rematch challenge
 */
export async function sendRematch(matchId) {
    if (!playerPin) {
        alert('Please log in to send rematch');
        return;
    }

    try {
        const result = await callFunction('sendRematch', {
            player_pin: playerPin,
            match_id: matchId
        });

        if (result.success) {
            showChallengeNotification('Rematch challenge sent!', 'success');
        } else {
            showChallengeNotification(result.error || 'Failed to send rematch', 'error');
        }
    } catch (error) {
        console.error('Error sending rematch:', error);
        showChallengeNotification('Failed to send rematch', 'error');
    }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Show a challenge notification toast
 */
function showChallengeNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.challenge-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `challenge-notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span class="notification-message">${message}</span>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================================
// CHALLENGE BUTTON COMPONENT
// ============================================================================

/**
 * Create a challenge button for a player
 * @returns {HTMLElement}
 */
export function createChallengeButton(playerId, playerName, options = {}) {
    if (!CHAT_FEATURES.CHALLENGE_SYSTEM) {
        return null;
    }

    const btn = document.createElement('button');
    btn.className = `challenge-btn ${options.className || ''}`;
    btn.innerHTML = options.icon || '🎯';
    btn.title = `Challenge ${playerName}`;
    btn.onclick = () => openChallengeModal(playerId, playerName);

    return btn;
}

// ============================================================================
// STYLES
// ============================================================================

/**
 * Add challenge system styles
 */
function addChallengeStyles() {
    if (document.getElementById('challenge-system-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'challenge-system-styles';
    styles.textContent = `
        /* Challenge Modal */
        .challenge-modal {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .challenge-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
        }

        .challenge-modal-content {
            position: relative;
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            border: 2px solid #91D7EB;
            border-radius: 16px;
            max-width: 400px;
            width: 100%;
            padding: 24px;
            color: #f0f0f0;
        }

        .challenge-modal-close {
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            color: #8a8aa3;
            font-size: 24px;
            cursor: pointer;
        }

        .challenge-modal-header h3 {
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            margin-bottom: 16px;
        }

        .challenge-h2h {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
        }

        .challenge-h2h h4 {
            font-size: 11px;
            color: #8a8aa3;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        .h2h-stats {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
        }

        .h2h-player {
            text-align: center;
        }

        .h2h-name {
            font-size: 13px;
            margin-bottom: 4px;
        }

        .h2h-wins {
            font-family: 'Bebas Neue', cursive;
            font-size: 32px;
        }

        .h2h-wins.leading {
            color: #91D7EB;
        }

        .h2h-vs {
            color: #8a8aa3;
            font-size: 16px;
        }

        .challenge-form-group {
            margin-bottom: 20px;
        }

        .challenge-form-group label {
            display: block;
            font-size: 12px;
            color: #8a8aa3;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .challenge-options {
            display: flex;
            gap: 8px;
        }

        .challenge-option {
            flex: 1;
            text-align: center;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .challenge-option:hover {
            border-color: rgba(145, 215, 235, 0.5);
        }

        .challenge-option.selected {
            border-color: #91D7EB;
            background: rgba(145, 215, 235, 0.1);
        }

        .challenge-option input {
            display: none;
        }

        .challenge-option span {
            font-size: 14px;
            font-weight: 600;
        }

        .challenge-input {
            width: 100%;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #f0f0f0;
            font-size: 14px;
        }

        .challenge-input:focus {
            outline: none;
            border-color: #91D7EB;
        }

        .challenge-submit-btn {
            width: 100%;
            padding: 14px;
            background: #FF469A;
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .challenge-submit-btn:hover:not(:disabled) {
            background: #91D7EB;
            color: #000;
        }

        .challenge-submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        /* Challenges Panel */
        .challenges-panel {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            justify-content: flex-end;
        }

        .challenges-panel-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
        }

        .challenges-panel-content {
            position: relative;
            width: 100%;
            max-width: 400px;
            height: 100%;
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            border-left: 2px solid #91D7EB;
            padding: 20px;
            overflow-y: auto;
        }

        .challenges-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .challenges-panel-header h3 {
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            color: #f0f0f0;
        }

        .challenges-panel-close {
            background: none;
            border: none;
            color: #8a8aa3;
            font-size: 28px;
            cursor: pointer;
        }

        .challenges-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }

        .challenges-tab {
            flex: 1;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            border: none;
            border-radius: 8px;
            color: #8a8aa3;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .challenges-tab.active {
            background: rgba(255, 70, 154, 0.2);
            color: #FF469A;
        }

        .challenge-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        }

        .challenge-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .challenge-player {
            font-weight: 600;
            font-size: 16px;
        }

        .challenge-game-type {
            font-size: 12px;
            background: rgba(145, 215, 235, 0.2);
            color: #91D7EB;
            padding: 4px 8px;
            border-radius: 4px;
        }

        .challenge-card-details {
            font-size: 13px;
            color: #8a8aa3;
            margin-bottom: 8px;
        }

        .challenge-message {
            display: block;
            font-style: italic;
            margin-top: 4px;
        }

        .challenge-expires {
            font-size: 11px;
            color: #FF469A;
        }

        .challenge-card-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .challenge-action-btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .challenge-action-btn.accept {
            background: #91D7EB;
            color: #000;
        }

        .challenge-action-btn.decline,
        .challenge-action-btn.cancel {
            background: rgba(255, 255, 255, 0.1);
            color: #f0f0f0;
        }

        .challenges-empty {
            text-align: center;
            padding: 40px 20px;
            color: #8a8aa3;
        }

        .challenges-empty-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }

        /* Leaderboard Panel */
        .leaderboard-panel {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .leaderboard-panel-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
        }

        .leaderboard-panel-content {
            position: relative;
            background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
            border: 2px solid #91D7EB;
            border-radius: 16px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .leaderboard-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .leaderboard-panel-header h3 {
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            color: #f0f0f0;
        }

        .leaderboard-panel-close {
            background: none;
            border: none;
            color: #8a8aa3;
            font-size: 28px;
            cursor: pointer;
        }

        .leaderboard-categories {
            display: flex;
            gap: 8px;
            padding: 12px 20px;
            overflow-x: auto;
        }

        .leaderboard-category {
            flex: 0 0 auto;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: none;
            border-radius: 20px;
            color: #8a8aa3;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }

        .leaderboard-category.active {
            background: rgba(255, 70, 154, 0.2);
            color: #FF469A;
        }

        .leaderboard-list {
            flex: 1;
            overflow-y: auto;
            padding: 0 20px 20px;
        }

        .leaderboard-row {
            display: flex;
            align-items: center;
            padding: 12px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .leaderboard-row:hover {
            background: rgba(145, 215, 235, 0.1);
        }

        .leaderboard-row.rank-1 {
            background: rgba(255, 215, 0, 0.1);
            border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .leaderboard-row.rank-2 {
            background: rgba(192, 192, 192, 0.1);
            border: 1px solid rgba(192, 192, 192, 0.3);
        }

        .leaderboard-row.rank-3 {
            background: rgba(205, 127, 50, 0.1);
            border: 1px solid rgba(205, 127, 50, 0.3);
        }

        .leaderboard-row.current-player {
            border: 2px solid #FF469A;
        }

        .leaderboard-rank {
            width: 36px;
            text-align: center;
            font-size: 18px;
        }

        .leaderboard-player {
            flex: 1;
            min-width: 0;
        }

        .leaderboard-name {
            font-weight: 600;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .leaderboard-record {
            font-size: 11px;
            color: #8a8aa3;
        }

        .leaderboard-value {
            font-family: 'Bebas Neue', cursive;
            font-size: 24px;
            color: #91D7EB;
            padding-left: 12px;
        }

        .leaderboard-your-rank {
            text-align: center;
            padding: 12px;
            color: #8a8aa3;
            font-size: 13px;
        }

        /* Challenge Notification */
        .challenge-notification {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #16213e;
            border: 2px solid #91D7EB;
            border-radius: 12px;
            padding: 12px 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 3000;
            animation: slideUp 0.3s ease;
        }

        .challenge-notification.success {
            border-color: #4CAF50;
        }

        .challenge-notification.error {
            border-color: #f44336;
        }

        .challenge-notification.fade-out {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
            transition: all 0.3s;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .notification-icon {
            font-size: 18px;
        }

        .notification-message {
            font-size: 14px;
            color: #f0f0f0;
        }

        /* Challenge Button */
        .challenge-btn {
            background: rgba(255, 70, 154, 0.2);
            border: 1px solid #FF469A;
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
        }

        .challenge-btn:hover {
            background: #FF469A;
            transform: scale(1.1);
        }
    `;

    document.head.appendChild(styles);
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

window.brdcChallenge = {
    openChallengeModal,
    closeChallengeModal,
    submitChallenge,
    openChallengesList,
    closeChallengesList,
    switchChallengesTab,
    respondToChallenge,
    cancelChallenge,
    openLeaderboard,
    closeLeaderboard,
    switchLeaderboardCategory,
    sendRematch
};
