/**
 * BRDC Presence System - Frontend
 * Heartbeat, online status, last seen formatting
 */

(function() {
    let heartbeatInterval = null;
    let currentPage = 'unknown';

    /**
     * Start sending heartbeats every 60 seconds
     */
    function startPresenceHeartbeat(page) {
        currentPage = page || 'unknown';

        // Send initial heartbeat
        sendHeartbeat();

        // Set up interval
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        heartbeatInterval = setInterval(sendHeartbeat, 60000);

        // Send offline when page unloads
        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    /**
     * Stop heartbeat
     */
    function stopPresenceHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        window.removeEventListener('beforeunload', handleUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    /**
     * Send heartbeat to server
     */
    async function sendHeartbeat() {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('updatePresence', {
                player_pin: playerPin,
                status: document.hidden ? 'away' : 'online',
                current_page: currentPage,
                device_type: getDeviceType()
            });
        } catch (error) {
            console.log('Heartbeat error:', error.message);
        }
    }

    /**
     * Handle page unload - set offline
     */
    async function handleUnload() {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        // Use sendBeacon for reliable delivery
        const data = JSON.stringify({ player_pin: playerPin });
        navigator.sendBeacon?.(
            'https://us-central1-brdc-v2.cloudfunctions.net/setOffline',
            new Blob([data], { type: 'application/json' })
        );
    }

    /**
     * Handle visibility change - away/online
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, set status to away
            updatePresenceStatus('away');
        } else {
            // Page is visible again, set back to online
            sendHeartbeat();
        }
    }

    /**
     * Update presence status manually
     */
    async function updatePresenceStatus(status) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('setPresenceStatus', {
                player_pin: playerPin,
                status: status
            });
        } catch (error) {
            console.log('Status update error:', error.message);
        }
    }

    /**
     * Get presence for multiple players
     */
    async function getPresenceForPlayers(playerIds) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin || !playerIds?.length) return {};

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getPlayerPresence', {
                player_pin: playerPin,
                player_ids: playerIds
            });
            return result.presence || {};
        } catch (error) {
            console.log('Get presence error:', error.message);
            return {};
        }
    }

    /**
     * Format last seen timestamp
     */
    function formatLastSeen(timestamp) {
        if (!timestamp) return 'Never';

        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 5) {
            return 'Online';
        } else if (diffMins < 60) {
            return `${diffMins} min ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    /**
     * Check if a timestamp indicates online status
     */
    function isOnline(timestamp) {
        if (!timestamp) return false;
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        return diffMs < 300000; // 5 minutes
    }

    /**
     * Get device type
     */
    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            return 'tablet';
        }
        if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    /**
     * Create online indicator element
     */
    function createOnlineIndicator(status) {
        const indicator = document.createElement('span');
        indicator.className = `online-indicator ${status || 'offline'}`;
        return indicator;
    }

    /**
     * Update online indicator
     */
    function updateOnlineIndicator(element, status) {
        element.className = `online-indicator ${status || 'offline'}`;
    }

    // Export to window
    window.brdcPresence = {
        startPresenceHeartbeat,
        stopPresenceHeartbeat,
        updatePresenceStatus,
        getPresenceForPlayers,
        formatLastSeen,
        isOnline,
        getDeviceType,
        createOnlineIndicator,
        updateOnlineIndicator
    };
})();
