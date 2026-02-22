/**
 * Player Profile - Social Module
 *
 * Handles:
 * - Loading social/profile data (friends, achievements, stats)
 * - Status message and bio
 * - Hot streak badge
 * - Social features
 */

import { callFunction } from '/js/firebase-config.js';

async function loadSocialData(state) {
    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;
    if (!playerId) return;

    // Skip social data for fill-in players (they don't have global player accounts)
    if (state.isFilInPlayer) {
        return;
    }

    // Social features require authentication
    const session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
    if (!session.player_id) {
        return;
    }

    try {
        // Load player's social data
        const result = await callFunction('getPlayerPublicProfile', {
            target_player_id: playerId
        });

        if (result.success && result.player) {
            const player = result.player;

            // Hot streak badge
            if (player.streaks?.is_hot) {
                const streakContainer = document.getElementById('hotStreakContainer');
                if (streakContainer && window.brdcSocial?.getHotStreakBadge) {
                    streakContainer.innerHTML = window.brdcSocial.getHotStreakBadge(player.streaks);
                }
            }

            // Status message
            if (player.profile?.status_message) {
                const statusContainer = document.getElementById('statusMessageContainer');
                if (statusContainer) {
                    statusContainer.innerHTML = `<div class="status-message">"${player.profile.status_message}"</div>`;
                }
            }

            // Streak stats
            const currentStreak = document.getElementById('currentStreak');
            const bestStreak = document.getElementById('bestStreak');
            if (currentStreak) currentStreak.textContent = player.streaks?.current_win_streak || 0;
            if (bestStreak) bestStreak.textContent = player.streaks?.best_win_streak || 0;

            // Pre-fill edit fields
            const editStatus = document.getElementById('editStatusMessage');
            const editBio = document.getElementById('editBio');
            const editFavoriteGame = document.getElementById('editFavoriteGame');
            const editHomeBar = document.getElementById('editHomeBar');

            if (editStatus) editStatus.value = player.profile?.status_message || '';
            if (editBio) editBio.value = player.profile?.bio || '';
            if (editFavoriteGame) editFavoriteGame.value = player.profile?.favorite_game || '';
            if (editHomeBar) editHomeBar.value = player.profile?.home_bar || '';

            // Load achievements
            try {
                const achResult = await callFunction('getPlayerAchievements', {
                    player_id: playerId
                });

                if (achResult.success && achResult.achievements) {
                    renderAchievements(achResult.achievements);
                }
            } catch (e) {
                console.error('Error loading achievements:', e);
            }

            // Load friends/social connections if available
            if (player.friends) {
                renderFriends(player.friends);
            }
        }
    } catch (error) {
        console.error('Error loading social data:', error);
    }
}

function renderAchievements(achievements) {
    const container = document.getElementById('achievementsContainer');
    if (!container) return;

    if (!achievements || achievements.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center;">No achievements yet</div>';
        return;
    }

    const html = achievements.map(ach => `
        <div class="achievement-card">
            <div class="achievement-icon">${ach.icon || '🏆'}</div>
            <div class="achievement-info">
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.description}</div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderFriends(friends) {
    const container = document.getElementById('friendsContainer');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = '<div style="color: #aaa; text-align: center;">No friends added yet</div>';
        return;
    }

    const html = friends.map(friend => `
        <div class="friend-card">
            <div class="friend-photo">${friend.photo_url ? `<img src="${friend.photo_url}" alt="${friend.name}">` : friend.name.charAt(0)}</div>
            <div class="friend-info">
                <div class="friend-name">${friend.name}</div>
                ${friend.team_name ? `<div class="friend-team">${friend.team_name}</div>` : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// ===== INITIALIZATION =====

function initSocialTab(state) {
    // Tab will load on first activation
}

// ===== EXPORTS =====

export {
    initSocialTab,
    loadSocialData,
    renderAchievements,
    renderFriends
};
