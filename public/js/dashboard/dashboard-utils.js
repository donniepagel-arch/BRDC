// Dashboard utility functions

// Helper to calculate team average from roster
export function calculateTeamAvg(roster) {
    if (!roster || roster.length === 0) return null;

    const validAvgs = roster
        .map(p => parseFloat(p.x01_three_dart_avg))
        .filter(avg => !isNaN(avg) && avg > 0);

    if (validAvgs.length === 0) return null;

    const avg = validAvgs.reduce((sum, a) => sum + a, 0) / validAvgs.length;
    return avg.toFixed(1);
}

// Helper functions for date handling
export function getTimestamp(date) {
    if (!date) return 0;
    if (date._seconds) return date._seconds;
    if (date.seconds) return date.seconds;
    if (date.toDate) return date.toDate().getTime() / 1000;
    return new Date(date).getTime() / 1000;
}

export function getDateFromTimestamp(date) {
    if (!date) return new Date();
    if (date._seconds) return new Date(date._seconds * 1000);
    if (date.seconds) return new Date(date.seconds * 1000);
    if (date.toDate) return date.toDate();
    // Handle date strings like "2026-01-28" - parse as local time, not UTC
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = date.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    return new Date(date);
}

export function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = timestamp._seconds || timestamp.seconds || Math.floor(timestamp / 1000);
    const date = new Date(seconds * 1000);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getOrdinalSuffix(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}
