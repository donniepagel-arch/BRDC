/**
 * BRDC Offline Storage
 * IndexedDB-based storage for game data that syncs when online
 */

const DB_NAME = 'brdc-offline';
const DB_VERSION = 2; // Bumped for callQueue store

let db = null;
let isProcessingQueue = false;

// Initialize IndexedDB
export async function initOfflineStorage() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Store for pending game results to sync
            if (!database.objectStoreNames.contains('pendingGames')) {
                const pendingStore = database.createObjectStore('pendingGames', { keyPath: 'id', autoIncrement: true });
                pendingStore.createIndex('timestamp', 'timestamp');
                pendingStore.createIndex('synced', 'synced');
            }

            // Store for game throws/leg details
            if (!database.objectStoreNames.contains('gameThrows')) {
                const throwsStore = database.createObjectStore('gameThrows', { keyPath: 'id', autoIncrement: true });
                throwsStore.createIndex('gameId', 'gameId');
                throwsStore.createIndex('timestamp', 'timestamp');
            }

            // Store for cached player data
            if (!database.objectStoreNames.contains('players')) {
                const playersStore = database.createObjectStore('players', { keyPath: 'pin' });
                playersStore.createIndex('name', 'name');
            }

            // Store for cached match data
            if (!database.objectStoreNames.contains('matches')) {
                const matchesStore = database.createObjectStore('matches', { keyPath: 'id' });
                matchesStore.createIndex('leagueId', 'leagueId');
            }

            // Store for local game state (resume capability)
            if (!database.objectStoreNames.contains('gameState')) {
                database.createObjectStore('gameState', { keyPath: 'id' });
            }

            // Store for failed function call queue (v2)
            if (!database.objectStoreNames.contains('callQueue')) {
                const queueStore = database.createObjectStore('callQueue', { keyPath: 'id', autoIncrement: true });
                queueStore.createIndex('timestamp', 'timestamp');
                queueStore.createIndex('functionName', 'functionName');
            }
        };
    });
}

// ============================================
// OFFLINE CALL QUEUE - Queue failed API calls
// ============================================

/**
 * Queue a failed function call for later retry
 * @param {string} functionName - The cloud function name
 * @param {object} data - The data to send
 * @returns {Promise<number>} - The queued item ID
 */
export async function queueFailedCall(functionName, data) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['callQueue'], 'readwrite');
        const store = transaction.objectStore('callQueue');

        const item = {
            functionName,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            lastRetry: null,
            error: null
        };

        const request = store.add(item);
        request.onsuccess = () => {
            updateQueueIndicator();
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all queued calls
 * @returns {Promise<Array>}
 */
export async function getQueuedCalls() {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['callQueue'], 'readonly');
        const store = transaction.objectStore('callQueue');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get count of queued calls
 * @returns {Promise<number>}
 */
export async function getQueuedCount() {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['callQueue'], 'readonly');
        const store = transaction.objectStore('callQueue');
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Remove a queued call after successful processing
 * @param {number} id
 */
export async function removeQueuedCall(id) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['callQueue'], 'readwrite');
        const store = transaction.objectStore('callQueue');
        const request = store.delete(id);

        request.onsuccess = () => {
            updateQueueIndicator();
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update retry count and error for a queued call
 */
async function updateQueuedCall(id, updates) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['callQueue'], 'readwrite');
        const store = transaction.objectStore('callQueue');
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const item = getReq.result;
            if (item) {
                Object.assign(item, updates);
                store.put(item);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

/**
 * Process the queue with exponential backoff
 * @param {function} callFunction - The callFunction from firebase-config.js
 * @returns {Promise<{processed: number, failed: number, remaining: number}>}
 */
export async function processCallQueue(callFunction) {
    if (isProcessingQueue) return { processed: 0, failed: 0, remaining: 0 };
    if (!navigator.onLine) return { processed: 0, failed: 0, remaining: 0 };

    isProcessingQueue = true;
    const MAX_RETRIES = 5;
    let processed = 0;
    let failed = 0;

    try {
        const items = await getQueuedCalls();

        for (const item of items) {
            // Check if enough time has passed based on retry count (exponential backoff)
            const backoffMs = Math.min(1000 * Math.pow(2, item.retryCount), 60000); // Max 1 minute
            if (item.lastRetry && (Date.now() - item.lastRetry) < backoffMs) {
                continue; // Skip, not ready for retry yet
            }

            // Skip if max retries exceeded
            if (item.retryCount >= MAX_RETRIES) {
                failed++;
                continue;
            }

            try {
                await callFunction(item.functionName, item.data);
                await removeQueuedCall(item.id);
                processed++;
            } catch (error) {
                // Update retry count
                await updateQueuedCall(item.id, {
                    retryCount: item.retryCount + 1,
                    lastRetry: Date.now(),
                    error: error.message || 'Unknown error'
                });
            }
        }

        const remaining = await getQueuedCount();
        return { processed, failed, remaining };
    } finally {
        isProcessingQueue = false;
        updateQueueIndicator();
    }
}

/**
 * Wrapper for callFunction that queues on failure
 * @param {function} callFunction - The original callFunction
 * @param {string} functionName - Function name to call
 * @param {object} data - Data to send
 * @returns {Promise<any>} - Result or throws if offline/failed
 */
export async function callWithQueue(callFunction, functionName, data) {
    try {
        // Try the call
        const result = await callFunction(functionName, data);
        return result;
    } catch (error) {
        // If network error, queue for later
        if (!navigator.onLine || isNetworkError(error)) {
            await queueFailedCall(functionName, data);
            throw new Error('QUEUED_OFFLINE');
        }
        throw error;
    }
}

/**
 * Check if error is network-related
 */
function isNetworkError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return msg.includes('network') ||
           msg.includes('fetch') ||
           msg.includes('failed to fetch') ||
           msg.includes('offline') ||
           msg.includes('timeout') ||
           error.code === 'unavailable';
}

/**
 * Update the visual queue indicator
 */
export async function updateQueueIndicator() {
    try {
        const count = await getQueuedCount();
        const indicator = document.getElementById('offlineQueueIndicator');

        if (indicator) {
            if (count > 0) {
                indicator.style.display = 'flex';
                const countEl = indicator.querySelector('.queue-count');
                if (countEl) countEl.textContent = count;
            } else {
                indicator.style.display = 'none';
            }
        }

        // Dispatch event for custom handling
        window.dispatchEvent(new CustomEvent('offlineQueueUpdate', { detail: { count } }));
    } catch (e) {
        // Ignore errors updating indicator
    }
}

/**
 * Create and inject the queue indicator element
 */
export function createQueueIndicator() {
    if (document.getElementById('offlineQueueIndicator')) return;

    const indicator = document.createElement('div');
    indicator.id = 'offlineQueueIndicator';
    indicator.innerHTML = `
        <span style="margin-right: 6px;">📤</span>
        <span><span class="queue-count">0</span> pending</span>
    `;
    indicator.style.cssText = `
        display: none;
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #f59e0b;
        color: #000;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        z-index: 9999;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
    `;
    indicator.title = 'Scores queued for sync';
    indicator.onclick = () => {
        if (navigator.onLine) {
            indicator.innerHTML = '<span>⏳ Syncing...</span>';
            window.dispatchEvent(new CustomEvent('offlineQueueRetry'));
        }
    };
    document.body.appendChild(indicator);

    updateQueueIndicator();
}

// Save a game result for later sync
export async function savePendingGame(gameData) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingGames'], 'readwrite');
        const store = transaction.objectStore('pendingGames');

        const data = {
            ...gameData,
            timestamp: Date.now(),
            synced: false
        };

        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get all pending games that need to sync
export async function getPendingGames() {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingGames'], 'readonly');
        const store = transaction.objectStore('pendingGames');
        const index = store.index('synced');
        const request = index.getAll(IDBKeyRange.only(false));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Mark a game as synced
export async function markGameSynced(gameId) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingGames'], 'readwrite');
        const store = transaction.objectStore('pendingGames');
        const request = store.get(gameId);

        request.onsuccess = () => {
            const game = request.result;
            if (game) {
                game.synced = true;
                store.put(game);
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

// Save throw data for a game
export async function saveThrow(gameId, throwData) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['gameThrows'], 'readwrite');
        const store = transaction.objectStore('gameThrows');

        const data = {
            gameId,
            ...throwData,
            timestamp: Date.now()
        };

        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get all throws for a game
export async function getGameThrows(gameId) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['gameThrows'], 'readonly');
        const store = transaction.objectStore('gameThrows');
        const index = store.index('gameId');
        const request = index.getAll(IDBKeyRange.only(gameId));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Save current game state (for resume)
export async function saveGameState(stateId, state) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['gameState'], 'readwrite');
        const store = transaction.objectStore('gameState');

        const data = {
            id: stateId,
            ...state,
            savedAt: Date.now()
        };

        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get saved game state
export async function getGameState(stateId) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['gameState'], 'readonly');
        const store = transaction.objectStore('gameState');
        const request = store.get(stateId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Clear saved game state
export async function clearGameState(stateId) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['gameState'], 'readwrite');
        const store = transaction.objectStore('gameState');
        const request = store.delete(stateId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Cache player data
export async function cachePlayer(playerData) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['players'], 'readwrite');
        const store = transaction.objectStore('players');
        const request = store.put(playerData);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get cached player by PIN
export async function getCachedPlayer(pin) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['players'], 'readonly');
        const store = transaction.objectStore('players');
        const request = store.get(pin);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Cache match data
export async function cacheMatch(matchData) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['matches'], 'readwrite');
        const store = transaction.objectStore('matches');
        const request = store.put(matchData);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Get cached match
export async function getCachedMatch(matchId) {
    if (!db) await initOfflineStorage();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['matches'], 'readonly');
        const store = transaction.objectStore('matches');
        const request = store.get(matchId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Sync all pending data when online
export async function syncAllPending(callFunction) {
    const pending = await getPendingGames();

    if (pending.length === 0) {
        return { synced: 0 };
    }
    let synced = 0;

    for (const game of pending) {
        try {
            // Call appropriate sync function based on game type
            if (game.type === 'league_round') {
                await callFunction('saveRoundResult', {
                    league_id: game.league_id,
                    match_id: game.match_id,
                    round_number: game.round_number,
                    home_players: game.home_players,
                    away_players: game.away_players,
                    home_score: game.home_score,
                    away_score: game.away_score,
                    game_stats: game.game_stats
                });
            } else if (game.type === 'player_stats') {
                await callFunction('updatePlayerStats', {
                    player_id: game.player_id,
                    stats: game.stats
                });
            }

            await markGameSynced(game.id);
            synced++;
        } catch (error) {
            console.error('[Offline] Sync failed for game:', game.id, error);
        }
    }

    return { synced, total: pending.length };
}

// Check if online
export function isOnline() {
    return navigator.onLine;
}

// Register for online/offline events
export function registerConnectivityListeners(onOnline, onOffline) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
}

/**
 * Setup offline queue with automatic retry on reconnect
 * @param {function} callFunction - The callFunction from firebase-config.js
 */
export function setupOfflineQueue(callFunction) {
    // Create indicator
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createQueueIndicator);
    } else {
        createQueueIndicator();
    }

    // Process queue when coming online
    window.addEventListener('online', async () => {
        const result = await processCallQueue(callFunction);
        if (result.processed > 0) {
            window.dispatchEvent(new CustomEvent('offlineQueueSynced', { detail: result }));
        }
    });

    // Listen for manual retry requests
    window.addEventListener('offlineQueueRetry', async () => {
        const result = await processCallQueue(callFunction);
        updateQueueIndicator();
    });

    // Process any pending items on load
    if (navigator.onLine) {
        setTimeout(() => processCallQueue(callFunction), 2000);
    }
}

// Initialize on load
initOfflineStorage().catch(console.error);
