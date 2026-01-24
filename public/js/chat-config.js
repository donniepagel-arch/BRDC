/**
 * BRDC Chat System - Phase Configuration
 *
 * Controls which chat features are enabled.
 * Increment CHAT_PHASE_LEVEL to unlock new features.
 *
 * PHASE 1 (MVP) - COMPLETE:
 *   - Chat rooms (league, team, match)
 *   - Real-time messaging
 *   - @Mentions with autocomplete
 *   - Message reactions (6 emojis)
 *   - Message replies (threading)
 *   - Typing indicators
 *   - Edit/Delete messages
 *   - Room mute toggle
 *   - Smart notifications
 *
 * PHASE 2 - Live Match Features:
 *   - Live Match Ticker (horizontal bar showing active matches)
 *   - Match Overlay (click ticker to see live match details)
 *   - Auto-posted Match Results (rich embeds when match completes)
 *
 * PHASE 3 - Challenge System & Match Rooms:
 *   - Challenge System (challenge players to matches)
 *   - Casual Match Scoring
 *   - Spectator Match Rooms
 *   - Leaderboards & Head-to-Head Stats
 *
 * PHASE 4+ (Future):
 *   - Voice channels
 *   - Image/GIF uploads
 *   - Auto-moderation
 *   - Multi-language support
 */

// ============================================================================
// PHASE CONFIGURATION - Change this to enable/disable features
// ============================================================================

export const CHAT_PHASE_LEVEL = 2; // Set to 1, 2, or 3

// ============================================================================
// FEATURE FLAGS - Automatically set based on phase level
// ============================================================================

export const CHAT_FEATURES = {
    // Phase 1 features (always enabled when phase >= 1)
    CHAT_ROOMS: CHAT_PHASE_LEVEL >= 1,
    MENTIONS: CHAT_PHASE_LEVEL >= 1,
    REACTIONS: CHAT_PHASE_LEVEL >= 1,
    REPLIES: CHAT_PHASE_LEVEL >= 1,
    TYPING_INDICATORS: CHAT_PHASE_LEVEL >= 1,
    EDIT_DELETE: CHAT_PHASE_LEVEL >= 1,
    MUTE_TOGGLE: CHAT_PHASE_LEVEL >= 1,
    SMART_NOTIFICATIONS: CHAT_PHASE_LEVEL >= 1,

    // Phase 2 features (enabled when phase >= 2)
    LIVE_TICKER: CHAT_PHASE_LEVEL >= 2,
    MATCH_OVERLAY: CHAT_PHASE_LEVEL >= 2,
    AUTO_POST_RESULTS: CHAT_PHASE_LEVEL >= 2,

    // Phase 3 features (enabled when phase >= 3)
    CHALLENGE_SYSTEM: CHAT_PHASE_LEVEL >= 3,
    CASUAL_MATCHES: CHAT_PHASE_LEVEL >= 3,
    SPECTATOR_ROOMS: CHAT_PHASE_LEVEL >= 3,
    LEADERBOARDS: CHAT_PHASE_LEVEL >= 3,
    HEAD_TO_HEAD: CHAT_PHASE_LEVEL >= 3
};

// ============================================================================
// TICKER CONFIGURATION
// ============================================================================

export const TICKER_CONFIG = {
    // How often to auto-scroll ticker (ms)
    AUTO_SCROLL_INTERVAL: 5000,

    // Maximum matches to show in ticker
    MAX_TICKER_ITEMS: 20,

    // Filter options
    FILTERS: {
        ALL: 'all',
        LEAGUES_ONLY: 'leagues',
        TOURNAMENTS_ONLY: 'tournaments',
        FOLLOWING: 'following'
    },

    // Default collapsed state
    DEFAULT_COLLAPSED: false
};

// ============================================================================
// CHALLENGE CONFIGURATION
// ============================================================================

export const CHALLENGE_CONFIG = {
    // Available game types for challenges
    GAME_TYPES: ['501', '301', 'cricket'],

    // Available race-to options
    RACE_TO_OPTIONS: [3, 5, 7, 9],

    // Challenge expiry time (ms) - 24 hours
    EXPIRY_TIME: 24 * 60 * 60 * 1000,

    // How long match room stays open after completion (ms) - 30 min
    POST_MATCH_ROOM_DURATION: 30 * 60 * 1000
};

// ============================================================================
// LEADERBOARD CONFIGURATION
// ============================================================================

export const LEADERBOARD_CONFIG = {
    // Minimum matches required for win rate ranking
    MIN_MATCHES_FOR_RANKING: 10,

    // Categories
    CATEGORIES: [
        { id: 'most_wins', label: 'Most Wins', icon: '🏆' },
        { id: 'win_rate', label: 'Highest Win Rate', icon: '📈' },
        { id: 'win_streak', label: 'Win Streak', icon: '🔥' },
        { id: 'highest_ppd', label: 'Highest PPD', icon: '🎯' }
    ]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(featureName) {
    return CHAT_FEATURES[featureName] === true;
}

/**
 * Get current phase level
 */
export function getCurrentPhase() {
    return CHAT_PHASE_LEVEL;
}

/**
 * Get list of enabled features
 */
export function getEnabledFeatures() {
    return Object.entries(CHAT_FEATURES)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name);
}

/**
 * Log current phase configuration (for debugging)
 */
export function logPhaseConfig() {
    // Debug logging removed for production
}

// Auto-log on import in development
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    logPhaseConfig();
}
