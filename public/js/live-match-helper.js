/**
 * Live Match Integration Helper
 *
 * Handles live match tracking for scorers without disrupting the scoring flow.
 * All operations are non-blocking and failure-tolerant.
 */

const LiveMatch = {
    // State
    liveMatchId: null,
    enabled: false,
    lastUpdate: 0,
    THROTTLE_MS: 1000, // Max 1 update per second

    // Config
    CLOUD_FUNCTION_BASE: 'https://us-central1-brdc-v2.cloudfunctions.net',

    async getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };

        try {
            const { auth } = await import('/js/firebase-config.js');
            const user = auth?.currentUser;
            if (!user) return null;

            const token = await user.getIdToken();
            headers.Authorization = `Bearer ${token}`;
            return headers;
        } catch (error) {
            console.warn('[LiveMatch] Could not get auth token:', error.message);
            return null;
        }
    },

    /**
     * Start tracking a live match
     * @param {Object} matchData - Match metadata
     * @param {string} matchData.match_id - Match document ID
     * @param {string} matchData.event_id - League/tournament ID
     * @param {string} matchData.event_name - Display name
     * @param {string} matchData.event_type - 'league' or 'tournament'
     * @param {string} matchData.game_type - '501', '301', 'cricket', etc.
     * @param {number} matchData.starting_score - Starting score (for X01)
     * @param {number} matchData.race_to - Number of legs to win
     * @param {string} matchData.team1_name - Home team name
     * @param {string} matchData.team2_name - Away team name
     * @param {Array<string>} matchData.team1_player_names - Home player names
     * @param {Array<string>} matchData.team2_player_names - Away player names
     * @param {Array<string>} matchData.team1_player_ids - Home player IDs (optional)
     * @param {Array<string>} matchData.team2_player_ids - Away player IDs (optional)
     * @param {string} matchData.team1_id - Home team ID (optional)
     * @param {string} matchData.team2_id - Away team ID (optional)
     * @param {number} matchData.board_number - Board number (optional)
     * @param {string} matchData.round - Tournament round (optional)
     */
    async start(matchData) {
        try {
            const scorerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!scorerId || !matchData.match_id) {
                return;
            }

            const headers = await this.getAuthHeaders();
            if (!headers) {
                return;
            }

            const response = await fetch(`${this.CLOUD_FUNCTION_BASE}/startLiveMatch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scorer_id: scorerId,
                    match_id: matchData.match_id,
                    event_id: matchData.event_id || null,
                    event_type: matchData.event_type || 'casual',
                    match_data: matchData
                })
            });

            const result = await response.json();

            if (result.success) {
                this.liveMatchId = result.live_match_id;
                this.enabled = true;
            } else {
                console.warn('[LiveMatch] Failed to start:', result.error);
            }
        } catch (error) {
            console.warn('[LiveMatch] Error starting (non-fatal):', error.message);
        }
    },

    /**
     * Update live match state
     * Throttled to max 1 update per second
     * @param {Object} stateData - Current match state
     * @param {number} stateData.team1_games_won - Home legs won
     * @param {number} stateData.team2_games_won - Away legs won
     * @param {Object} stateData.current_leg - Current leg state
     * @param {number} stateData.current_leg.leg_number - Current leg number
     * @param {number} stateData.current_leg.team1_score - Home remaining (X01) or marks (cricket)
     * @param {number} stateData.current_leg.team2_score - Away remaining (X01) or marks (cricket)
     * @param {number} stateData.current_leg.team1_darts - Home darts thrown
     * @param {number} stateData.current_leg.team2_darts - Away darts thrown
     * @param {string} stateData.current_leg.throwing - 'team1' or 'team2'
     * @param {Array} stateData.current_leg.throws - Recent throws (optional)
     * @param {Object} stateData.current_leg.marks - Cricket marks by number (optional)
     */
    async update(stateData) {
        if (!this.enabled || !this.liveMatchId) {
            return;
        }

        // Throttle updates
        const now = Date.now();
        if (now - this.lastUpdate < this.THROTTLE_MS) {
            return;
        }
        this.lastUpdate = now;

        try {
            const scorerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!scorerId) return;
            const headers = await this.getAuthHeaders();
            if (!headers) return;

            // Fire and forget - don't await
            fetch(`${this.CLOUD_FUNCTION_BASE}/updateLiveMatch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scorer_id: scorerId,
                    match_id: this.liveMatchId,
                    update_data: stateData
                })
            }).catch(err => {
                // Silently ignore errors - scoring continues
                console.warn('[LiveMatch] Update failed (non-fatal):', err.message);
            });

        } catch (error) {
            console.warn('[LiveMatch] Error updating (non-fatal):', error.message);
        }
    },

    /**
     * End live match tracking
     * @param {Object} finalData - Final match result
     * @param {Object} finalData.winner - Winner info
     * @param {string} finalData.winner.name - Winner name
     * @param {number} finalData.winner.score - Winner legs won
     * @param {Object} finalData.loser - Loser info
     * @param {string} finalData.loser.name - Loser name
     * @param {number} finalData.loser.score - Loser legs won
     * @param {Object} finalData.stats - Match stats (optional)
     */
    async end(finalData) {
        if (!this.enabled || !this.liveMatchId) {
            return;
        }

        try {
            const scorerId = JSON.parse(localStorage.getItem('brdc_session') || '{}').player_id;
            if (!scorerId) return;
            const headers = await this.getAuthHeaders();
            if (!headers) return;

            await fetch(`${this.CLOUD_FUNCTION_BASE}/endLiveMatch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scorer_id: scorerId,
                    match_id: this.liveMatchId,
                    result: finalData
                })
            });


        } catch (error) {
            console.warn('[LiveMatch] Error ending (non-fatal):', error.message);
        } finally {
            // Always reset state
            this.enabled = false;
            this.liveMatchId = null;
        }
    },

    /**
     * Disable live match tracking (for casual/pickup games)
     */
    disable() {
        this.enabled = false;
        this.liveMatchId = null;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.LiveMatch = LiveMatch;
}
