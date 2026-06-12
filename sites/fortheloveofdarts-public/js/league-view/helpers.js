/**
 * League View - Helper Functions Module
 *
 * Shared utility functions used across multiple modules
 */

export function isRegistrationClosed(leagueData) {
    // Check if registration is closed based on status or date
    if (leagueData.status === 'active' || leagueData.status === 'completed' || leagueData.status === 'playoffs') {
        return true;
    }
    if (leagueData.registration_close_date) {
        const closeDate = new Date(leagueData.registration_close_date);
        return new Date() > closeDate;
    }
    return false;
}

export function showError(message) {
    console.error(message);
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="empty-state" style="padding: 32px; text-align: center;">
                <div class="empty-state-icon" aria-hidden="true">&#9888;</div>
                <div style="font-weight: 700; margin-bottom: 8px;">League page failed to load</div>
                <div style="color: var(--text-dim); max-width: 520px; margin: 0 auto;">${message}</div>
            </div>
        `;
        mainContent.removeAttribute('aria-busy');
        return;
    }

    alert(message);
}

export function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatGameType(format) {
    if (!format) return '';
    const formats = {
        '501': '501',
        '301': '301',
        '701': '701',
        'cricket': 'Cricket',
        'mixed': 'Mixed'
    };
    return formats[format] || format;
}

export function formatLeagueName(name) {
    if (!name) return '';
    // Remove redundant "League" suffix if present
    return name.replace(/\s+League$/i, '');
}

export function getTeamRecord(rec) {
    if (!rec) return '(0-0)';
    const w = rec.wins || 0;
    const l = rec.losses || 0;
    const t = rec.ties || 0;
    return t > 0 ? `(${w}-${l}-${t})` : `(${w}-${l})`;
}

export function getTeamName(team) {
    return team.team_name || team.name || 'Unknown Team';
}

export function getPlayerName(player) {
    return player.name || player.player_name || 'Unknown Player';
}
