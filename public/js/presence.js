/**
 * BRDC Enhanced Presence System - Frontend
 * Discord-like presence with:
 * - Online/offline/away/in-game status
 * - Current activity tracking (watching match, in channel, playing game)
 * - Typing indicators for chat
 * - "Last seen" timestamps
 * - Viewer lists per match/channel
 * - Real-time subscriptions
 */

(function() {
    // ========================================================================
    // STATE
    // ========================================================================

    let heartbeatInterval = null;
    let currentPage = 'unknown';
    let currentActivity = null;
    let currentContext = null;
    let typingTimeout = null;
    let isTyping = false;
    let viewerUnsubscribe = null;
    let presenceUnsubscribes = {};

    // Activity types (must match backend)
    const ACTIVITY_TYPES = {
        IDLE: 'idle',
        WATCHING_MATCH: 'watching_match',
        PLAYING_GAME: 'playing_game',
        SCORING: 'scoring',
        IN_CHAT: 'in_chat',
        BROWSING: 'browsing'
    };

    // Status types
    const STATUS_TYPES = {
        ONLINE: 'online',
        AWAY: 'away',
        IN_GAME: 'in_game',
        DND: 'dnd',
        OFFLINE: 'offline'
    };

    // ========================================================================
    // HEARTBEAT & PRESENCE
    // ========================================================================

    /**
     * Start sending heartbeats every 60 seconds
     * @param {string} page - Current page identifier
     * @param {Object} options - Optional activity and context
     */
    function startPresenceHeartbeat(page, options = {}) {
        currentPage = page || 'unknown';
        currentActivity = options.activity || null;
        currentContext = options.context || null;

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
                status: document.hidden ? STATUS_TYPES.AWAY : STATUS_TYPES.ONLINE,
                current_page: currentPage,
                device_type: getDeviceType(),
                activity: currentActivity,
                context: currentContext
            });
        } catch (error) {
            // Heartbeat failed silently - will retry on next interval
            console.debug('Heartbeat failed:', error.message);
        }
    }

    /**
     * Handle page unload - set offline
     */
    async function handleUnload() {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        // Clean up any typing status
        if (isTyping && currentContext?.room_id) {
            clearTypingIndicator(currentContext.room_id);
        }

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
            updatePresenceStatus(STATUS_TYPES.AWAY);
        } else {
            // Page is visible again, set back to online
            sendHeartbeat();
        }
    }

    /**
     * Update presence status manually
     * @param {string} status - One of: online, away, in_game, dnd, offline
     * @param {string} customStatus - Optional custom status message
     */
    async function updatePresenceStatus(status, customStatus = null) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('setPresenceStatus', {
                player_pin: playerPin,
                status: status,
                custom_status: customStatus
            });
        } catch (error) {
            console.error('Status update failed:', error);
        }
    }

    // ========================================================================
    // ACTIVITY TRACKING
    // ========================================================================

    /**
     * Update current activity
     * @param {Object} activity - Activity object with type, match_id, room_id, etc.
     * @param {Object} context - Context object with league_id, match_id, room_id, tournament_id
     */
    async function updateActivity(activity, context = null) {
        currentActivity = activity;
        if (context) currentContext = context;

        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('updateActivity', {
                player_pin: playerPin,
                activity: activity,
                context: currentContext
            });
        } catch (error) {
            console.error('Activity update failed:', error);
        }
    }

    /**
     * Set activity to watching a match
     * @param {string} matchId - Match document ID
     * @param {string} matchName - Human-readable match name
     * @param {string} leagueId - Optional league ID
     */
    async function setWatchingMatch(matchId, matchName = null, leagueId = null) {
        await updateActivity(
            {
                type: ACTIVITY_TYPES.WATCHING_MATCH,
                match_id: matchId,
                match_name: matchName
            },
            {
                match_id: matchId,
                league_id: leagueId
            }
        );
    }

    /**
     * Set activity to playing a game
     * @param {string} gameType - e.g., '501', 'cricket'
     * @param {string} matchId - Optional match ID if in a scored match
     */
    async function setPlayingGame(gameType, matchId = null) {
        await updateActivity(
            {
                type: ACTIVITY_TYPES.PLAYING_GAME,
                game_type: gameType,
                match_id: matchId
            },
            {
                match_id: matchId
            }
        );
    }

    /**
     * Set activity to scoring a match
     * @param {string} matchId - Match ID
     * @param {string} matchName - Match name
     */
    async function setScoringMatch(matchId, matchName = null) {
        await updateActivity(
            {
                type: ACTIVITY_TYPES.SCORING,
                match_id: matchId,
                match_name: matchName
            },
            {
                match_id: matchId
            }
        );
    }

    /**
     * Set activity to being in a chat room
     * @param {string} roomId - Chat room ID
     * @param {string} roomName - Chat room name
     */
    async function setInChat(roomId, roomName = null) {
        await updateActivity(
            {
                type: ACTIVITY_TYPES.IN_CHAT,
                room_id: roomId,
                room_name: roomName
            },
            {
                room_id: roomId
            }
        );
    }

    /**
     * Set activity to browsing a page
     * @param {string} pageName - Page name for display
     */
    async function setBrowsing(pageName) {
        await updateActivity({
            type: ACTIVITY_TYPES.BROWSING,
            page_name: pageName
        });
    }

    /**
     * Clear current activity
     */
    async function clearActivity() {
        await updateActivity(null, null);
    }

    // ========================================================================
    // MATCH VIEWER TRACKING
    // ========================================================================

    /**
     * Join a match as a viewer
     * @param {string} matchId - Match ID to join
     * @param {string} leagueId - Optional league ID
     */
    async function joinMatchAsViewer(matchId, leagueId = null) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('joinMatchAsViewer', {
                player_pin: playerPin,
                match_id: matchId,
                league_id: leagueId
            });
        } catch (error) {
            console.error('Failed to join as viewer:', error);
        }
    }

    /**
     * Leave a match as a viewer
     * @param {string} matchId - Match ID to leave
     */
    async function leaveMatchAsViewer(matchId) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('leaveMatchAsViewer', {
                player_pin: playerPin,
                match_id: matchId
            });
        } catch (error) {
            console.error('Failed to leave as viewer:', error);
        }
    }

    /**
     * Get match viewers (one-time fetch)
     * @param {string} matchId - Match ID
     * @returns {Promise<{viewers: Array, viewer_count: number}>}
     */
    async function getMatchViewers(matchId) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { viewers: [], viewer_count: 0 };

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getMatchViewers', {
                player_pin: playerPin,
                match_id: matchId
            });
            return {
                viewers: result.viewers || [],
                viewer_count: result.viewer_count || 0
            };
        } catch (error) {
            console.error('Failed to get viewers:', error);
            return { viewers: [], viewer_count: 0 };
        }
    }

    /**
     * Subscribe to match viewers (real-time updates)
     * @param {string} matchId - Match ID
     * @param {Function} callback - Called with (viewers, viewerCount) on each update
     * @returns {Function} Unsubscribe function
     */
    async function subscribeToMatchViewers(matchId, callback) {
        try {
            const { db, doc, onSnapshot } = await import('/js/firebase-config.js');
            const viewersRef = doc(db, 'match_viewers', matchId);

            const unsubscribe = onSnapshot(viewersRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const viewers = Object.entries(data.viewers || {}).map(([id, info]) => ({
                        player_id: id,
                        player_name: info.player_name,
                        joined_at: info.joined_at?.toDate?.() || null
                    }));
                    callback(viewers, data.viewer_count || 0);
                } else {
                    callback([], 0);
                }
            });

            // Store for cleanup
            viewerUnsubscribe = unsubscribe;
            return unsubscribe;
        } catch (error) {
            console.error('Failed to subscribe to viewers:', error);
            return () => {};
        }
    }

    /**
     * Unsubscribe from match viewers
     */
    function unsubscribeFromMatchViewers() {
        if (viewerUnsubscribe) {
            viewerUnsubscribe();
            viewerUnsubscribe = null;
        }
    }

    // ========================================================================
    // TYPING INDICATORS
    // ========================================================================

    /**
     * Set typing status in a chat room
     * @param {string} roomId - Chat room ID
     * @param {boolean} typing - Whether user is typing
     */
    async function setTypingStatus(roomId, typing) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return;

        isTyping = typing;

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            await callFunction('setTypingStatus', {
                player_pin: playerPin,
                room_id: roomId,
                is_typing: typing
            });
        } catch (error) {
            console.debug('Typing status failed:', error.message);
        }
    }

    /**
     * Handle typing input - call this on each keystroke in chat
     * Automatically manages typing start/stop with debouncing
     * @param {string} roomId - Chat room ID
     */
    function handleTypingInput(roomId) {
        // If not currently typing, start typing indicator
        if (!isTyping) {
            setTypingStatus(roomId, true);
        }

        // Clear existing timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Set timeout to clear typing after 3 seconds of no input
        typingTimeout = setTimeout(() => {
            setTypingStatus(roomId, false);
        }, 3000);
    }

    /**
     * Clear typing indicator immediately (e.g., when message sent)
     * @param {string} roomId - Chat room ID
     */
    function clearTypingIndicator(roomId) {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            typingTimeout = null;
        }
        if (isTyping) {
            setTypingStatus(roomId, false);
        }
    }

    /**
     * Subscribe to typing indicators in a room
     * @param {string} roomId - Chat room ID
     * @param {Function} callback - Called with array of typing users [{player_id, player_name}]
     * @returns {Function} Unsubscribe function
     */
    async function subscribeToTypingIndicators(roomId, callback) {
        try {
            const { db, collection, onSnapshot } = await import('/js/firebase-config.js');
            const typingRef = collection(db, 'chat_rooms', roomId, 'typing');
            const currentPlayerId = localStorage.getItem('brdc_player_id');

            const unsubscribe = onSnapshot(typingRef, (snapshot) => {
                const fiveSecondsAgo = new Date(Date.now() - 5000);
                const typingUsers = [];

                snapshot.forEach(doc => {
                    // Exclude self
                    if (doc.id === currentPlayerId) return;

                    const data = doc.data();
                    const timestamp = data.timestamp?.toDate?.() || new Date(0);

                    // Only include if recent
                    if (timestamp > fiveSecondsAgo) {
                        typingUsers.push({
                            player_id: doc.id,
                            player_name: data.player_name
                        });
                    }
                });

                callback(typingUsers);
            });

            return unsubscribe;
        } catch (error) {
            console.error('Failed to subscribe to typing:', error);
            return () => {};
        }
    }

    // ========================================================================
    // PRESENCE QUERIES
    // ========================================================================

    /**
     * Get presence for multiple players
     * @param {string[]} playerIds - Array of player IDs
     * @returns {Promise<Object>} Map of playerId -> presence data
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
            return {};
        }
    }

    /**
     * Get online players (optionally filtered)
     * @param {Object} options - Filter options
     * @param {string} options.context - 'league', 'team', or 'match'
     * @param {string} options.league_id - League ID for filtering
     * @param {string} options.team_id - Team ID for filtering
     * @param {string} options.match_id - Match ID for filtering
     * @returns {Promise<{online_players: Array, count: number}>}
     */
    async function getOnlinePlayers(options = {}) {
        const playerPin = localStorage.getItem('brdc_player_pin');
        if (!playerPin) return { online_players: [], count: 0 };

        try {
            const { callFunction } = await import('/js/firebase-config.js');
            const result = await callFunction('getOnlinePlayers', {
                player_pin: playerPin,
                ...options
            });
            return {
                online_players: result.online_players || [],
                count: result.count || 0
            };
        } catch (error) {
            return { online_players: [], count: 0 };
        }
    }

    /**
     * Subscribe to a player's presence (real-time)
     * @param {string} playerId - Player ID to watch
     * @param {Function} callback - Called with presence data on each update
     * @returns {Function} Unsubscribe function
     */
    async function subscribeToPlayerPresence(playerId, callback) {
        try {
            const { db, doc, onSnapshot } = await import('/js/firebase-config.js');
            const presenceRef = doc(db, 'presence_heartbeats', playerId);

            const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const lastHeartbeat = data.last_heartbeat?.toDate?.();
                    const isOnline = lastHeartbeat && lastHeartbeat > fiveMinutesAgo;

                    callback({
                        status: isOnline ? data.status : 'offline',
                        last_seen_at: lastHeartbeat,
                        activity: isOnline ? data.activity : null,
                        custom_status: data.custom_status || null
                    });
                } else {
                    callback({
                        status: 'offline',
                        last_seen_at: null,
                        activity: null,
                        custom_status: null
                    });
                }
            });

            presenceUnsubscribes[playerId] = unsubscribe;
            return unsubscribe;
        } catch (error) {
            console.error('Failed to subscribe to presence:', error);
            return () => {};
        }
    }

    /**
     * Unsubscribe from a player's presence
     * @param {string} playerId - Player ID
     */
    function unsubscribeFromPlayerPresence(playerId) {
        if (presenceUnsubscribes[playerId]) {
            presenceUnsubscribes[playerId]();
            delete presenceUnsubscribes[playerId];
        }
    }

    /**
     * Unsubscribe from all player presence subscriptions
     */
    function unsubscribeFromAllPresence() {
        Object.values(presenceUnsubscribes).forEach(unsub => unsub());
        presenceUnsubscribes = {};
    }

    // ========================================================================
    // FORMATTING & UTILITIES
    // ========================================================================

    /**
     * Format last seen timestamp
     * @param {Date|string|Object} timestamp - Timestamp to format
     * @returns {string} Human-readable string
     */
    function formatLastSeen(timestamp) {
        if (!timestamp) return 'Never';

        const date = timestamp instanceof Date
            ? timestamp
            : timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 5) {
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
     * Check if a timestamp indicates online status (within 5 minutes)
     * @param {Date|string|Object} timestamp - Timestamp to check
     * @returns {boolean}
     */
    function isOnline(timestamp) {
        if (!timestamp) return false;
        const date = timestamp instanceof Date
            ? timestamp
            : timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        return diffMs < 300000; // 5 minutes
    }

    /**
     * Get device type
     * @returns {string} 'mobile', 'tablet', or 'desktop'
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
     * Get status color for CSS
     * @param {string} status - Status value
     * @returns {string} CSS color value
     */
    function getStatusColor(status) {
        switch (status) {
            case STATUS_TYPES.ONLINE:
                return '#22c55e'; // Green
            case STATUS_TYPES.AWAY:
                return '#eab308'; // Yellow
            case STATUS_TYPES.IN_GAME:
                return '#a855f7'; // Purple
            case STATUS_TYPES.DND:
                return '#ef4444'; // Red
            case STATUS_TYPES.OFFLINE:
            default:
                return '#6b7280'; // Gray
        }
    }

    /**
     * Get status label for display
     * @param {string} status - Status value
     * @returns {string} Human-readable label
     */
    function getStatusLabel(status) {
        switch (status) {
            case STATUS_TYPES.ONLINE:
                return 'Online';
            case STATUS_TYPES.AWAY:
                return 'Away';
            case STATUS_TYPES.IN_GAME:
                return 'In Game';
            case STATUS_TYPES.DND:
                return 'Do Not Disturb';
            case STATUS_TYPES.OFFLINE:
            default:
                return 'Offline';
        }
    }

    /**
     * Create online indicator element
     * @param {string} status - Status value
     * @returns {HTMLElement}
     */
    function createOnlineIndicator(status) {
        const indicator = document.createElement('span');
        indicator.className = `online-indicator ${status || 'offline'}`;
        indicator.style.cssText = `
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: ${getStatusColor(status)};
            border: 2px solid currentColor;
        `;
        return indicator;
    }

    /**
     * Update online indicator element
     * @param {HTMLElement} element - Indicator element
     * @param {string} status - New status
     */
    function updateOnlineIndicator(element, status) {
        element.className = `online-indicator ${status || 'offline'}`;
        element.style.backgroundColor = getStatusColor(status);
    }

    /**
     * Create presence badge with status dot and activity
     * @param {Object} presence - Presence data
     * @param {boolean} showActivity - Whether to show activity text
     * @returns {HTMLElement}
     */
    function createPresenceBadge(presence, showActivity = true) {
        const badge = document.createElement('div');
        badge.className = 'presence-badge';
        badge.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        `;

        // Status dot
        const dot = createOnlineIndicator(presence.status);
        badge.appendChild(dot);

        // Activity or status text
        const text = document.createElement('span');
        text.style.color = '#8a8aa3';

        if (showActivity && presence.activity?.description) {
            text.textContent = presence.activity.description;
        } else if (presence.custom_status) {
            text.textContent = presence.custom_status;
        } else {
            text.textContent = getStatusLabel(presence.status);
        }

        badge.appendChild(text);
        return badge;
    }

    /**
     * Format typing indicator text
     * @param {Array} typingUsers - Array of {player_id, player_name}
     * @returns {string}
     */
    function formatTypingIndicator(typingUsers) {
        if (!typingUsers || typingUsers.length === 0) {
            return '';
        }

        if (typingUsers.length === 1) {
            return `${typingUsers[0].player_name} is typing...`;
        } else if (typingUsers.length === 2) {
            return `${typingUsers[0].player_name} and ${typingUsers[1].player_name} are typing...`;
        } else {
            return `${typingUsers[0].player_name} and ${typingUsers.length - 1} others are typing...`;
        }
    }

    // ========================================================================
    // EXPORT
    // ========================================================================

    // Export to window
    window.brdcPresence = {
        // Constants
        ACTIVITY_TYPES,
        STATUS_TYPES,

        // Heartbeat
        startPresenceHeartbeat,
        stopPresenceHeartbeat,
        updatePresenceStatus,

        // Activity
        updateActivity,
        setWatchingMatch,
        setPlayingGame,
        setScoringMatch,
        setInChat,
        setBrowsing,
        clearActivity,

        // Match viewers
        joinMatchAsViewer,
        leaveMatchAsViewer,
        getMatchViewers,
        subscribeToMatchViewers,
        unsubscribeFromMatchViewers,

        // Typing
        setTypingStatus,
        handleTypingInput,
        clearTypingIndicator,
        subscribeToTypingIndicators,

        // Presence queries
        getPresenceForPlayers,
        getOnlinePlayers,
        subscribeToPlayerPresence,
        unsubscribeFromPlayerPresence,
        unsubscribeFromAllPresence,

        // Utilities
        formatLastSeen,
        isOnline,
        getDeviceType,
        getStatusColor,
        getStatusLabel,
        createOnlineIndicator,
        updateOnlineIndicator,
        createPresenceBadge,
        formatTypingIndicator
    };
})();
