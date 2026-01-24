/**
 * Virtual Darts Achievements System
 * Tracks and rewards player accomplishments
 */

const AchievementSystem = (function() {
    // Storage key
    const STORAGE_KEY = 'virtualDartsAchievements';

    // Achievement definitions
    const ACHIEVEMENTS = {
        first_game: {
            id: 'first_game',
            name: 'First Game',
            description: 'Play your first game',
            icon: '🎮'
        },
        first_win: {
            id: 'first_win',
            name: 'First Win',
            description: 'Win your first game',
            icon: '🏆'
        },
        first_180: {
            id: 'first_180',
            name: 'First 180',
            description: 'Score a maximum 180',
            icon: '🎯'
        },
        ton_80_checkout: {
            id: 'ton_80_checkout',
            name: 'Ton-80 Checkout',
            description: 'Check out with 80 or more points',
            icon: '💫'
        },
        ten_games: {
            id: 'ten_games',
            name: '10 Games Played',
            description: 'Complete 10 games',
            icon: '🔟'
        },
        fifty_games: {
            id: 'fifty_games',
            name: '50 Games Played',
            description: 'Complete 50 games',
            icon: '5️⃣0️⃣'
        },
        beat_easy_bot: {
            id: 'beat_easy_bot',
            name: 'Beat Easy Bot',
            description: 'Win against Easy difficulty bot',
            icon: '🤖'
        },
        beat_medium_bot: {
            id: 'beat_medium_bot',
            name: 'Beat Medium Bot',
            description: 'Win against Medium difficulty bot',
            icon: '🤖'
        },
        beat_hard_bot: {
            id: 'beat_hard_bot',
            name: 'Beat Hard Bot',
            description: 'Win against Hard difficulty bot',
            icon: '🤖'
        },
        perfect_leg: {
            id: 'perfect_leg',
            name: 'Perfect Leg',
            description: 'Win a 501 leg in 12 darts or less',
            icon: '⭐'
        }
    };

    // Player progress data
    let playerData = {
        achievements: {},      // { achievementId: { unlocked: true, timestamp: Date } }
        stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            max180s: 0,
            highestCheckout: 0,
            bestLegDarts: Infinity
        }
    };

    /**
     * Initialize the achievement system
     */
    function init() {
        loadProgress();
        console.log('[Achievements] System initialized');
    }

    /**
     * Load progress from localStorage
     */
    function loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                playerData = {
                    achievements: parsed.achievements || {},
                    stats: {
                        gamesPlayed: parsed.stats?.gamesPlayed || 0,
                        gamesWon: parsed.stats?.gamesWon || 0,
                        max180s: parsed.stats?.max180s || 0,
                        highestCheckout: parsed.stats?.highestCheckout || 0,
                        bestLegDarts: parsed.stats?.bestLegDarts || Infinity
                    }
                };
            }
        } catch (e) {
            console.error('[Achievements] Error loading progress:', e);
        }
    }

    /**
     * Save progress to localStorage
     */
    function saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playerData));
        } catch (e) {
            console.error('[Achievements] Error saving progress:', e);
        }
    }

    /**
     * Check if an achievement is unlocked
     */
    function isUnlocked(achievementId) {
        return playerData.achievements[achievementId]?.unlocked === true;
    }

    /**
     * Unlock an achievement
     */
    function unlock(achievementId) {
        if (isUnlocked(achievementId)) {
            return false; // Already unlocked
        }

        const achievement = ACHIEVEMENTS[achievementId];
        if (!achievement) {
            console.warn('[Achievements] Unknown achievement:', achievementId);
            return false;
        }

        // Mark as unlocked
        playerData.achievements[achievementId] = {
            unlocked: true,
            timestamp: Date.now()
        };

        // Save progress
        saveProgress();

        // Show popup
        showUnlockPopup(achievement);

        console.log('[Achievements] Unlocked:', achievement.name);
        return true;
    }

    /**
     * Show the achievement unlock popup
     */
    function showUnlockPopup(achievement) {
        // Create popup container if it doesn't exist
        let container = document.getElementById('achievementPopupContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'achievementPopupContainer';
            document.body.appendChild(container);
        }

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-popup-content">
                <div class="achievement-popup-icon">${achievement.icon}</div>
                <div class="achievement-popup-text">
                    <div class="achievement-popup-title">Achievement Unlocked!</div>
                    <div class="achievement-popup-name">${achievement.name}</div>
                    <div class="achievement-popup-desc">${achievement.description}</div>
                </div>
            </div>
        `;

        container.appendChild(popup);

        // Trigger animation
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            popup.classList.remove('show');
            popup.classList.add('hide');
            setTimeout(() => {
                popup.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Record a game completion and check for achievements
     */
    function recordGameComplete(gameData) {
        const { gameType, won, dartsUsed, difficulty, checkoutScore, turnScores } = gameData;

        // Update stats
        playerData.stats.gamesPlayed++;

        if (won) {
            playerData.stats.gamesWon++;
        }

        // Check for 180s in turn scores
        if (turnScores && Array.isArray(turnScores)) {
            for (const score of turnScores) {
                if (score === 180) {
                    playerData.stats.max180s++;
                }
            }
        }

        // Update highest checkout
        if (checkoutScore && checkoutScore > playerData.stats.highestCheckout) {
            playerData.stats.highestCheckout = checkoutScore;
        }

        // Update best leg darts (for 501 only)
        if (gameType === '501' && won && dartsUsed < playerData.stats.bestLegDarts) {
            playerData.stats.bestLegDarts = dartsUsed;
        }

        // Save updated stats
        saveProgress();

        // Check achievements
        checkAchievements(gameData);
    }

    /**
     * Check all achievements based on current state
     */
    function checkAchievements(gameData = {}) {
        const { gameType, won, dartsUsed, difficulty, checkoutScore, turnScores } = gameData;

        // First Game
        if (playerData.stats.gamesPlayed >= 1) {
            unlock('first_game');
        }

        // First Win
        if (playerData.stats.gamesWon >= 1) {
            unlock('first_win');
        }

        // First 180
        if (playerData.stats.max180s >= 1) {
            unlock('first_180');
        }

        // Ton-80 Checkout (80+)
        if (playerData.stats.highestCheckout >= 80) {
            unlock('ton_80_checkout');
        }

        // 10 Games Played
        if (playerData.stats.gamesPlayed >= 10) {
            unlock('ten_games');
        }

        // 50 Games Played
        if (playerData.stats.gamesPlayed >= 50) {
            unlock('fifty_games');
        }

        // Beat Easy/Medium/Hard Bot
        if (won && difficulty) {
            const diffUpper = difficulty.toUpperCase();
            if (diffUpper === 'EASY') {
                unlock('beat_easy_bot');
            } else if (diffUpper === 'MEDIUM') {
                unlock('beat_medium_bot');
            } else if (diffUpper === 'HARD') {
                unlock('beat_hard_bot');
            }
        }

        // Perfect Leg (12 darts or less in 501)
        if (gameType === '501' && won && dartsUsed <= 12) {
            unlock('perfect_leg');
        }
    }

    /**
     * Record a turn score (for 180 tracking)
     */
    function recordTurnScore(score) {
        if (score === 180) {
            playerData.stats.max180s++;
            saveProgress();
            unlock('first_180');
        }
    }

    /**
     * Record a checkout
     */
    function recordCheckout(checkoutScore) {
        if (checkoutScore > playerData.stats.highestCheckout) {
            playerData.stats.highestCheckout = checkoutScore;
            saveProgress();
        }
        if (checkoutScore >= 80) {
            unlock('ton_80_checkout');
        }
    }

    /**
     * Get all achievements with unlock status
     */
    function getAllAchievements() {
        return Object.values(ACHIEVEMENTS).map(achievement => ({
            ...achievement,
            unlocked: isUnlocked(achievement.id),
            unlockedAt: playerData.achievements[achievement.id]?.timestamp || null
        }));
    }

    /**
     * Get unlocked achievements count
     */
    function getUnlockedCount() {
        return Object.keys(playerData.achievements).filter(id =>
            playerData.achievements[id]?.unlocked
        ).length;
    }

    /**
     * Get total achievements count
     */
    function getTotalCount() {
        return Object.keys(ACHIEVEMENTS).length;
    }

    /**
     * Get player stats
     */
    function getStats() {
        return { ...playerData.stats };
    }

    /**
     * Reset all progress (for testing)
     */
    function resetProgress() {
        playerData = {
            achievements: {},
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                max180s: 0,
                highestCheckout: 0,
                bestLegDarts: Infinity
            }
        };
        saveProgress();
        console.log('[Achievements] Progress reset');
    }

    // Public API
    return {
        init,
        unlock,
        isUnlocked,
        recordGameComplete,
        recordTurnScore,
        recordCheckout,
        getAllAchievements,
        getUnlockedCount,
        getTotalCount,
        getStats,
        resetProgress,
        ACHIEVEMENTS
    };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AchievementSystem.init();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementSystem;
}
