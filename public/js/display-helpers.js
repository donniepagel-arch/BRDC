/**
 * BRDC Display Helper Functions
 *
 * Standard functions for formatting data for display
 */

/**
 * Format league name to always end with "League"
 * @param {string} name - The league name
 * @returns {string} - League name ending with "League"
 */
function formatLeagueName(name) {
    if (!name) return 'League';

    const trimmed = name.trim();

    // Check if already ends with "League" (case-insensitive)
    if (trimmed.toLowerCase().endsWith('league')) {
        return trimmed;
    }

    return `${trimmed} League`;
}

/**
 * Format tournament name to always end with "Tournament"
 * @param {string} name - The tournament name
 * @returns {string} - Tournament name ending with "Tournament"
 */
function formatTournamentName(name) {
    if (!name) return 'Tournament';

    const trimmed = name.trim();

    // Check if already ends with "Tournament" (case-insensitive)
    if (trimmed.toLowerCase().endsWith('tournament')) {
        return trimmed;
    }

    return `${trimmed} Tournament`;
}

/**
 * Format event name based on type
 * @param {string} name - The event name
 * @param {string} type - Event type ('league' or 'tournament')
 * @returns {string} - Formatted event name
 */
function formatEventName(name, type) {
    if (type === 'league') {
        return formatLeagueName(name);
    } else if (type === 'tournament') {
        return formatTournamentName(name);
    }
    return name || 'Event';
}
