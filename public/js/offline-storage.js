/**
 * BRDC Offline Storage
 * IndexedDB-based storage for game data that syncs when online
 */

const DB_NAME = 'brdc-offline';
const DB_VERSION = 1;

let db = null;

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
        };
    });
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
        console.log('[Offline] No pending data to sync');
        return { synced: 0 };
    }

    console.log(`[Offline] Syncing ${pending.length} pending games...`);
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

    console.log(`[Offline] Synced ${synced}/${pending.length} games`);
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

// Initialize on load
initOfflineStorage().catch(console.error);
