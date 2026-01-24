/**
 * BRDC Stats Helper Functions
 *
 * Standard functions for reading stats with fallbacks for legacy field names.
 * See docs/FIELD-STANDARDS.md for full documentation.
 */

/**
 * Get 3-dart average from any stats object
 * Canonical field: x01_three_dart_avg
 */
function get3DA(stats) {
    if (!stats) return null;

    // Try canonical field first
    if (stats.x01_three_dart_avg != null) return Number(stats.x01_three_dart_avg);

    // Calculate from components if available
    if (stats.x01_total_darts > 0 && stats.x01_total_points != null) {
        return (stats.x01_total_points / stats.x01_total_darts) * 3;
    }

    // Legacy fallbacks (in order of preference)
    if (stats.x01_3da != null) return Number(stats.x01_3da);
    if (stats.x01_avg != null) return Number(stats.x01_avg);
    if (stats.three_dart_avg != null) return Number(stats.three_dart_avg);
    if (stats.ppd != null) return Number(stats.ppd);
    if (stats.avg != null) return Number(stats.avg);

    return null;
}

/**
 * Get marks per round from any stats object
 * Canonical field: cricket_mpr
 */
function getMPR(stats) {
    if (!stats) return null;

    // Try canonical field first
    if (stats.cricket_mpr != null) return Number(stats.cricket_mpr);

    // Calculate from components if available
    if (stats.cricket_total_rounds > 0 && stats.cricket_total_marks != null) {
        return stats.cricket_total_marks / stats.cricket_total_rounds;
    }

    // Legacy fallback
    if (stats.mpr != null) return Number(stats.mpr);

    return null;
}

/**
 * Get first 9 average from any stats object
 * Canonical field: x01_first_9_avg
 */
function getFirst9Avg(stats) {
    if (!stats) return null;

    // Try canonical field first
    if (stats.x01_first_9_avg != null) return Number(stats.x01_first_9_avg);

    // Calculate from components if available
    if (stats.x01_first9_darts > 0 && stats.x01_first9_points != null) {
        return (stats.x01_first9_points / stats.x01_first9_darts) * 3;
    }

    // Legacy fallbacks
    if (stats.x01_first9_avg != null) return Number(stats.x01_first9_avg);
    if (stats.first_9_avg != null) return Number(stats.first_9_avg);

    return null;
}

/**
 * Get checkout average from any stats object
 * Canonical field: x01_avg_checkout
 */
function getAvgCheckout(stats) {
    if (!stats) return null;

    // Try canonical fields
    if (stats.x01_avg_checkout != null) return Number(stats.x01_avg_checkout);
    if (stats.x01_avg_finish != null) return Number(stats.x01_avg_finish);
    if (stats.avg_finish != null) return Number(stats.avg_finish);

    // Calculate from components if available
    if (stats.x01_checkouts_hit > 0 && stats.x01_total_checkout_points != null) {
        return stats.x01_total_checkout_points / stats.x01_checkouts_hit;
    }

    return null;
}

/**
 * Get player name from any object
 * Canonical field: name (on player doc), player_name (in stats)
 */
function getPlayerName(obj) {
    if (!obj) return 'Unknown';

    // Try all possible name fields
    if (obj.name) return obj.name;
    if (obj.player_name) return obj.player_name;
    if (obj.first_name && obj.last_name) return `${obj.first_name} ${obj.last_name}`;
    if (obj.first_name) return obj.first_name;
    if (obj.display_name) return obj.display_name;

    return 'Unknown';
}

/**
 * Get team name from any object
 * Canonical field: team_name
 */
function getTeamName(obj) {
    if (!obj) return 'Unknown Team';

    // Try all possible name fields
    if (obj.team_name) return obj.team_name;
    if (obj.name) return obj.name;

    return 'Unknown Team';
}

/**
 * Get team record from team object or calculated records
 * @param {Object} team - Team object or calculated record
 * @returns {string} Formatted record like "(1-0)" or "(1-0-1)" with ties
 */
function getTeamRecord(team) {
    if (!team) return '(0-0)';

    const wins = team.wins ?? team.w ?? 0;
    const losses = team.losses ?? team.l ?? 0;
    const ties = team.ties ?? team.t ?? 0;

    if (ties > 0) {
        return `(${wins}-${losses}-${ties})`;
    }
    return `(${wins}-${losses})`;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 * @param {number} n - The number
 * @returns {string} Number with ordinal suffix
 */
function getOrdinal(n) {
    if (!n || n < 1) return '';
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Format stats for compact display (e.g., "52.3 / 2.45")
 * @param {Object} stats - Stats object
 * @returns {string} Formatted string "3DA / MPR"
 */
function formatStats(stats) {
    const threeDartAvg = get3DA(stats);
    const mpr = getMPR(stats);

    const avgStr = threeDartAvg != null ? threeDartAvg.toFixed(1) : '-';
    const mprStr = mpr != null ? mpr.toFixed(2) : '-';

    return `${avgStr} / ${mprStr}`;
}

/**
 * Format 3DA for display
 * @param {Object} stats - Stats object
 * @param {number} decimals - Decimal places (default 1)
 * @returns {string} Formatted 3DA or "-"
 */
function format3DA(stats, decimals = 1) {
    const val = get3DA(stats);
    return val != null ? val.toFixed(decimals) : '-';
}

/**
 * Format MPR for display
 * @param {Object} stats - Stats object
 * @param {number} decimals - Decimal places (default 2)
 * @returns {string} Formatted MPR or "-"
 */
function formatMPR(stats, decimals = 2) {
    const val = getMPR(stats);
    return val != null ? val.toFixed(decimals) : '-';
}

/**
 * Get leg win percentage
 * Canonical field: x01_leg_win_pct or cricket_leg_win_pct
 */
function getLegWinPct(stats, gameType = 'x01') {
    if (!stats) return null;

    const prefix = gameType === 'cricket' ? 'cricket_' : 'x01_';

    // Try canonical field
    if (stats[`${prefix}leg_win_pct`] != null) {
        return Number(stats[`${prefix}leg_win_pct`]);
    }

    // Calculate from components
    const played = stats[`${prefix}legs_played`];
    const won = stats[`${prefix}legs_won`];
    if (played > 0 && won != null) {
        return (won / played) * 100;
    }

    return null;
}

// Export for module systems (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        get3DA,
        getMPR,
        getFirst9Avg,
        getAvgCheckout,
        getPlayerName,
        getTeamName,
        getTeamRecord,
        getOrdinal,
        formatStats,
        format3DA,
        formatMPR,
        getLegWinPct
    };
}
