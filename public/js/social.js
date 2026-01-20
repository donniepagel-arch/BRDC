/**
 * BRDC Social Features - Frontend
 * Reactions, cheers, achievements, streaks
 */

(function() {
    // Allowed reaction emojis
    const REACTIONS = ['🎯', '🔥', '👏', '😂', '👍', '💯'];

    // Achievement tier colors
    const TIER_COLORS = {
        bronze: { bg: 'linear-gradient(135deg, #CD7F32, #8B4513)', text: 'white' },
        silver: { bg: 'linear-gradient(135deg, #C0C0C0, #808080)', text: 'black' },
        gold: { bg: 'linear-gradient(135deg, #FFD700, #DAA520)', text: 'black' },
        platinum: { bg: 'linear-gradient(135deg, #E5E4E2, #A9A9A9)', text: 'black', border: '#00BFFF' }
    };

    // ===========================================
    // REACTIONS
    // ===========================================

    /**
     * Toggle reaction on a message
     */
    async function toggleReaction(messageType, roomOrConvId, messageId, emoji) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { success: false, error: 'Not logged in' };

        try {
            const { callFunction } = await import('/js/firebase-config.js');

            // Check if already reacted
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            const existingReaction = messageElement?.querySelector(`.reaction-chip[data-emoji="${emoji}"].own`);

            if (existingReaction) {
                // Remove reaction
                const result = await callFunction('removeReaction', {
                    player_pin: playerPin,
                    message_type: messageType,
                    room_or_conversation_id: roomOrConvId,
                    message_id: messageId,
                    emoji: emoji
                });
                return result;
            } else {
                // Add reaction
                const result = await callFunction('addReaction', {
                    player_pin: playerPin,
                    message_type: messageType,
                    room_or_conversation_id: roomOrConvId,
                    message_id: messageId,
                    emoji: emoji
                });
                return result;
            }
        } catch (error) {
            console.error('Toggle reaction error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Render reactions for a message
     */
    function renderReactions(reactions, currentPlayerId) {
        if (!reactions || Object.keys(reactions).length === 0) {
            return '';
        }

        const chips = [];
        for (const [emoji, playerIds] of Object.entries(reactions)) {
            if (!Array.isArray(playerIds) || playerIds.length === 0) continue;

            const isOwn = playerIds.includes(currentPlayerId);
            chips.push(`
                <div class="reaction-chip ${isOwn ? 'own' : ''}" data-emoji="${emoji}">
                    <span class="reaction-emoji">${emoji}</span>
                    <span class="reaction-count">${playerIds.length}</span>
                </div>
            `);
        }

        if (chips.length === 0) return '';

        return `<div class="message-reactions">${chips.join('')}</div>`;
    }

    /**
     * Show reaction picker for a message
     */
    function showReactionPicker(messageElement, messageType, roomOrConvId, messageId) {
        // Remove existing picker
        document.querySelectorAll('.reaction-picker').forEach(el => el.remove());

        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = REACTIONS.map(emoji =>
            `<span class="reaction-option" data-emoji="${emoji}">${emoji}</span>`
        ).join('');

        // Position picker above message
        const rect = messageElement.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        picker.style.left = rect.left + 'px';
        picker.style.zIndex = '1000';

        // Handle reaction selection
        picker.addEventListener('click', async (e) => {
            const emoji = e.target.dataset.emoji;
            if (emoji) {
                await toggleReaction(messageType, roomOrConvId, messageId, emoji);
                picker.remove();
            }
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeHandler(e) {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closeHandler);
                }
            });
        }, 100);

        document.body.appendChild(picker);
    }

    // ===========================================
    // CHEERS
    // ===========================================

    /**
     * Send a cheer to a player
     */
    async function sendCheer(receiverId, context, message) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { success: false, error: 'Not logged in' };

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('sendCheer', {
                player_pin: playerPin,
                receiver_id: receiverId,
                context: context || 'general',
                message: message || ''
            });
            return result;
        } catch (error) {
            console.error('Send cheer error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load biggest fans for a player
     */
    async function loadBiggestFans(playerId) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return [];

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getBiggestFans', {
                player_pin: playerPin,
                player_id: playerId
            });
            return result.biggest_fans || [];
        } catch (error) {
            console.error('Load biggest fans error:', error);
            return [];
        }
    }

    /**
     * Load cheer history
     */
    async function loadCheerHistory(playerId, direction, limit) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return [];

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getPlayerCheers', {
                player_pin: playerPin,
                player_id: playerId,
                direction: direction || 'received',
                limit: limit || 20
            });
            return result.cheers || [];
        } catch (error) {
            console.error('Load cheer history error:', error);
            return [];
        }
    }

    /**
     * Create cheer button element
     */
    function createCheerButton(receiverId, onSuccess) {
        const btn = document.createElement('button');
        btn.className = 'cheer-btn';
        btn.innerHTML = '<span>👏</span> CHEER';

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<span>👏</span> Sending...';

            const result = await sendCheer(receiverId, 'profile');

            if (result.success) {
                btn.innerHTML = '<span>✓</span> Sent!';
                btn.classList.add('success');
                if (onSuccess) onSuccess();

                setTimeout(() => {
                    btn.innerHTML = '<span>👏</span> CHEER';
                    btn.classList.remove('success');
                    btn.disabled = false;
                }, 2000);
            } else {
                btn.innerHTML = '<span>👏</span> CHEER';
                btn.disabled = false;
            }
        });

        return btn;
    }

    /**
     * Render biggest fans section
     */
    function renderBiggestFans(fans) {
        if (!fans || fans.length === 0) {
            return '<div class="no-fans">No fans yet</div>';
        }

        const rankEmojis = ['🥇', '🥈', '🥉'];

        return `
            <div class="biggest-fans">
                ${fans.map((fan, i) => `
                    <div class="fan-item">
                        <span class="fan-rank">${rankEmojis[i] || ''}</span>
                        <div class="fan-avatar-placeholder">${fan.player_name.charAt(0)}</div>
                        <span class="fan-name">${fan.player_name}</span>
                        <span class="fan-count">${fan.cheer_count} 👏</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ===========================================
    // ACHIEVEMENTS
    // ===========================================

    /**
     * Load achievements for a player
     */
    async function loadPlayerAchievements(playerId) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { achievements: [], total_points: 0 };

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getPlayerAchievements', {
                player_pin: playerPin,
                player_id: playerId
            });
            return result;
        } catch (error) {
            console.error('Load achievements error:', error);
            return { achievements: [], total_points: 0 };
        }
    }

    /**
     * Render achievement badge
     */
    function renderAchievementBadge(achievement) {
        const tier = TIER_COLORS[achievement.tier] || TIER_COLORS.bronze;
        const unlockedClass = achievement.unlocked ? '' : 'locked';

        return `
            <div class="achievement-badge ${achievement.tier} ${unlockedClass}"
                 title="${achievement.description}"
                 style="background: ${tier.bg}; color: ${tier.text}; ${tier.border ? `border: 1px solid ${tier.border}` : ''}">
                <span class="achievement-icon">${achievement.icon}</span>
                <span class="achievement-name">${achievement.name}</span>
            </div>
        `;
    }

    /**
     * Render achievements showcase (top 3)
     */
    function renderAchievementsShowcase(achievements, showcaseIds) {
        if (!achievements || achievements.length === 0) {
            return '<div class="no-achievements">No achievements yet</div>';
        }

        // If showcase is defined, use those; otherwise use first 3 unlocked
        let showcaseAchievements;
        if (showcaseIds && showcaseIds.length > 0) {
            showcaseAchievements = showcaseIds
                .map(id => achievements.find(a => a.id === id))
                .filter(Boolean);
        } else {
            showcaseAchievements = achievements
                .filter(a => a.unlocked)
                .slice(0, 3);
        }

        if (showcaseAchievements.length === 0) {
            return '<div class="no-achievements">No achievements unlocked</div>';
        }

        return `
            <div class="achievements-showcase">
                ${showcaseAchievements.map(a => renderAchievementBadge(a)).join('')}
            </div>
        `;
    }

    /**
     * Render full achievements list
     */
    function renderAllAchievements(achievements) {
        if (!achievements || achievements.length === 0) {
            return '<div class="no-achievements">No achievements available</div>';
        }

        const byCategory = {};
        achievements.forEach(a => {
            if (!byCategory[a.category]) byCategory[a.category] = [];
            byCategory[a.category].push(a);
        });

        const categoryNames = {
            scoring: '🎯 Scoring',
            participation: '🎮 Participation',
            social: '👥 Social'
        };

        return Object.entries(byCategory).map(([cat, achs]) => `
            <div class="achievement-category">
                <h4>${categoryNames[cat] || cat}</h4>
                <div class="achievement-grid">
                    ${achs.map(a => renderAchievementBadge(a)).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Set showcase achievements
     */
    async function setShowcaseAchievements(achievementIds) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { success: false };

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('setShowcaseAchievements', {
                player_pin: playerPin,
                achievement_ids: achievementIds
            });
            return result;
        } catch (error) {
            console.error('Set showcase error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===========================================
    // STREAKS
    // ===========================================

    /**
     * Get hot streak badge HTML
     */
    function getHotStreakBadge(streakData) {
        if (!streakData || !streakData.is_hot) return '';

        return `
            <div class="hot-streak-badge">
                <span>🔥</span>
                <span>${streakData.current_win_streak} Win Streak</span>
            </div>
        `;
    }

    /**
     * Format streak display
     */
    function formatStreakDisplay(streakData) {
        if (!streakData) {
            return { current: 0, best: 0, isHot: false };
        }

        return {
            current: streakData.current_win_streak || 0,
            best: streakData.best_win_streak || 0,
            isHot: streakData.is_hot || false
        };
    }

    /**
     * Load hot players
     */
    async function loadHotPlayers(leagueId) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return [];

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getHotPlayers', {
                player_pin: playerPin,
                league_id: leagueId || null
            });
            return result.hot_players || [];
        } catch (error) {
            console.error('Load hot players error:', error);
            return [];
        }
    }

    /**
     * Render hot players list
     */
    function renderHotPlayers(hotPlayers) {
        if (!hotPlayers || hotPlayers.length === 0) {
            return '<div class="no-hot-players">No hot players right now</div>';
        }

        return `
            <div class="hot-players-list">
                ${hotPlayers.map(p => `
                    <div class="hot-player-item">
                        <span class="hot-icon">🔥</span>
                        <span class="hot-name">${p.name}</span>
                        <span class="hot-streak">${p.current_streak} wins</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Export to window
    window.brdcSocial = {
        // Reactions
        REACTIONS,
        toggleReaction,
        renderReactions,
        showReactionPicker,

        // Cheers
        sendCheer,
        loadBiggestFans,
        loadCheerHistory,
        createCheerButton,
        renderBiggestFans,

        // Achievements
        loadPlayerAchievements,
        renderAchievementBadge,
        renderAchievementsShowcase,
        renderAllAchievements,
        setShowcaseAchievements,
        TIER_COLORS,

        // Streaks
        getHotStreakBadge,
        formatStreakDisplay,
        loadHotPlayers,
        renderHotPlayers
    };
})();
