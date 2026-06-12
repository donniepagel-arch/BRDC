/**
 * Dashboard Authentication and Initialization Module
 *
 * Handles:
 * - Login/logout flow
 * - Session management
 * - Dashboard initialization
 * - Data loading with stale-while-revalidate caching
 */

import { callFunction, db, auth, onAuthStateChanged } from '/js/firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { currentPlayer, dashboardData, setCurrentPlayer, setDashboardData } from '/js/dashboard/dashboard-state.js';
import { loadScheduleStories } from '/js/dashboard/dashboard-schedule.js?v=5';
import { loadFeed } from '/js/dashboard/dashboard-feed.js?v=30';

// ===== INITIALIZATION =====

/**
 * Caches that must NOT survive a DEFINITIVE signed-out state.
 * Targeted keys only — never blanket-clear storage (other features keep
 * OAuth tokens / capability state in the same stores).
 */
function clearSignedOutCaches() {
    try {
        localStorage.removeItem('brdc_session');
        sessionStorage.removeItem('currentPlayer');
        // vNext Home optimistic identity caches (same signed-out rule)
        localStorage.removeItem('brdc:vnext:home:identity:v1');
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith('dashboard_data_v2_') || key.startsWith('brdc:vnext:home:snapshot:')) {
                localStorage.removeItem(key);
            }
        }
    } catch (e) { /* storage unavailable — purge is best-effort */ }
}

/**
 * Auth-definitive dashboard init.
 *
 * RULE: act only INSIDE onAuthStateChanged callbacks. The SDK fires the first
 * callback only after persistence (IndexedDB) has been read, so:
 *  - a signed-in user never gets a login flash while auth initializes
 *    (the old `waitForAuthReady(1500)` race could expire BEFORE auth resolved
 *    and wrongly clear brdc_session + show login), and
 *  - a definitive signed-out state (first callback null, OR a later
 *    mid-session sign-out from another tab / token revocation) always purges
 *    the cached identity so the dashboard can never keep rendering it.
 */
function initDashboardStable() {
    const savedSession = localStorage.getItem('brdc_session');

    if (savedSession) {
        // Optimistic: returning user — keep login hidden while auth resolves.
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.classList.add('hidden');
        showInitialLoader('Loading your dashboard...');
    } else {
        hideInitialLoader();
    }

    let firstAuthCallback = true;
    onAuthStateChanged(auth, (user) => {
        const isFirst = firstAuthCallback;
        firstAuthCallback = false;

        if (!user) {
            // DEFINITIVE signed-out — cached identity must not survive.
            clearSignedOutCaches();
            showLoginPage();
            return;
        }

        // Signed-in transitions AFTER page load are driven by login() /
        // loginWithGoogle(), which run their own session+load flow — don't
        // double-load from here.
        if (!isFirst) return;

        bootstrapSignedInDashboard();
    });
}

async function bootstrapSignedInDashboard() {
    const savedSession = localStorage.getItem('brdc_session');
    const SESSION_MAX_AGE = 30 * 60 * 1000; // 30 minutes

    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            const age = Date.now() - (session.logged_in_at || 0);
            if (session.player_id && age < SESSION_MAX_AGE) {
                showInitialLoader('Loading your dashboard...');
                loadDashboard(session.player_id, session.source_type, session.league_id);
                return;
            }
        } catch (e) {
            localStorage.removeItem('brdc_session');
        }
    }

    showInitialLoader('Loading your dashboard...');
    try {
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) {
            throw new Error(result?.error || 'Could not load player data');
        }
        const player = result.player;
        const session = {
            player_id: player.id,
            name: player.name,
            source_type: 'global',
            league_id: player.league_id || null,
            team_id: player.team_id || null,
            is_admin: player.is_admin || false,
            is_master_admin: player.is_master_admin || false,
            is_director: player.is_director || false,
            is_captain: player.is_captain || false,
            involvements: player.involvements || {},
            logged_in_at: Date.now()
        };
        localStorage.setItem('brdc_session', JSON.stringify(session));
        loadDashboard(session.player_id, session.source_type, session.league_id);
    } catch (err) {
        console.error('[initDashboard] Session refresh failed:', err);
        localStorage.removeItem('brdc_session');
        showLoginPage();
    }
}

function hideInitialLoader() {
    const loader = document.getElementById('initialLoader');
    if (loader) loader.style.display = 'none';
}

function showInitialLoader(message) {
    const loader = document.getElementById('initialLoader');
    const text = document.getElementById('initialLoaderText');
    if (loader) {
        loader.style.display = 'flex';
        if (text && message) text.textContent = message;
    }
}

function showLoginPage() {
    hideInitialLoader();

    // Reset login form visibility
    const loginBox = document.querySelector('.login-box');
    if (loginBox) {
        loginBox.querySelector('h2').style.display = '';
        loginBox.querySelector('.form-group').style.display = '';
        loginBox.querySelector('.login-btn').style.display = '';
        loginBox.querySelector('.login-links').style.display = '';
    }

    // Hide login loader
    const loginLoader = document.getElementById('loginLoader');
    if (loginLoader) {
        loginLoader.classList.add('hidden');
        loginLoader.style.display = 'none';
    }

    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('mainContent').style.display = 'none';
}

function showDashboard() {
    // Hide all loaders
    hideInitialLoader();
    const loginLoader = document.getElementById('loginLoader');
    if (loginLoader) {
        loginLoader.classList.add('hidden');
        loginLoader.style.display = 'none';
    }

    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('mainContent').style.display = 'block';

    // Initialize or update FB navigation
    if (window.FBNav && currentPlayer) {
        // Check if already initialized (sidebar property exists on FBNav)
        if (window.FBNav.sidebar) {
            // Already initialized, just update player and regenerate content
            window.FBNav.sidebar.setPlayer(currentPlayer);
            window.FBNav.sidebar.generateContent();
        } else {
            // First time init
            window.FBNav.init(currentPlayer);
        }
    }
}

// ===== CACHE HELPER =====

// Cache helper with stale-while-revalidate pattern
const CacheHelper = {
    FRESH_TIME: 5 * 60 * 1000,      // 5 minutes
    STALE_TIME: 30 * 60 * 1000,     // 30 minutes

    get(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            return {
                data,
                age,
                isFresh: age < this.FRESH_TIME,
                isStale: age >= this.FRESH_TIME && age < this.STALE_TIME,
                isExpired: age >= this.STALE_TIME
            };
        } catch (e) {
            return null;
        }
    },

    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Cache set failed:', e);
        }
    },

    clear(key) {
        localStorage.removeItem(key);
    }
};

// ===== DATA LOADING =====

async function loadDashboard(playerId, sourceType, leagueId) {
    const cacheKey = `dashboard_data_v2_${playerId}_${sourceType}_${leagueId}`;
    const cached = CacheHelper.get(cacheKey);

    // If cache is fresh, use it immediately and skip API call
    if (cached && cached.isFresh) {
        setDashboardData(cached.data.dashboard);
        setCurrentPlayer(cached.data.dashboard.player);
        if (cached.data.playerStats) {
            dashboardData.playerStats = cached.data.playerStats;
        }
        renderDashboard();
        showDashboard();
        return;
    }

    // If cache is stale, show it immediately while fetching fresh data
    if (cached && cached.isStale) {
        setDashboardData(cached.data.dashboard);
        setCurrentPlayer(cached.data.dashboard.player);
        if (cached.data.playerStats) {
            dashboardData.playerStats = cached.data.playerStats;
        }
        renderDashboard();
        showDashboard();
        // Continue to fetch fresh data in background
    }

    // Fetch fresh data (either no cache, expired cache, or stale cache)
    // Run both calls in PARALLEL for faster loading
    try {
        const [result, statsResult] = await Promise.all([
            callFunction('getDashboardData', {
                player_id: playerId,
                source_type: sourceType || 'global',
                league_id: leagueId || null
            }),
            callFunction('getPlayerStatsFiltered', {
                player_id: playerId,
                source: 'combined'
            }).catch(() => {
                return null;
            })
        ]);

        if (result.success) {
            setDashboardData(result.dashboard);
            setCurrentPlayer(result.dashboard.player);

            // Apply stats if loaded successfully
            if (statsResult?.success && statsResult?.stats) {
                dashboardData.playerStats = statsResult.stats;
            }

            // Update cache
            CacheHelper.set(cacheKey, {
                dashboard: dashboardData,
                playerStats: dashboardData.playerStats
            });

            // Re-render with fresh data (if we showed stale cache, this updates it)
            renderDashboard();
            showDashboard();
        } else {
            // Only clear session and show login if we don't have cached data
            if (!cached) {
                localStorage.removeItem('brdc_session');
                showLoginPage();
            }
        }
    } catch (error) {
        console.error('Load dashboard error:', error);
        // Only clear session and show login if we don't have cached data
        if (!cached) {
            localStorage.removeItem('brdc_session');
            showLoginPage();
        }
    }
}

// ===== RENDERING =====

function renderDashboard() {
    const player = dashboardData.player;
    const roles = dashboardData.roles;

    // Load schedule stories and feed
    loadScheduleStories(roles);
    loadFeed();

    // Update composer avatar with logged-in player initial
    if (window.initComposerAvatar) window.initComposerAvatar(dashboardData.player);
}

// ===== WINDOW EXPOSED FUNCTIONS =====

// Login function
window.login = async function() {
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginError = document.getElementById('loginError');
    const loginBtn = document.querySelector('.login-btn');
    const loader = document.getElementById('loginLoader');

    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    if (!email || !password) {
        if (loginError) { loginError.textContent = 'Please enter your email and password.'; loginError.classList.remove('hidden'); }
        return;
    }

    if (loginBtn) loginBtn.disabled = true;
    if (loginError) loginError.classList.add('hidden');
    if (loader) { loader.classList.remove('hidden'); loader.style.display = 'flex'; }

    try {
        const { auth, signInWithEmailAndPassword, callFunction } = await import('/js/firebase-config.js');

        // Sign in with Firebase Auth
        await signInWithEmailAndPassword(auth, email, password);

        // Get player session data from backend
        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) {
            throw new Error(result?.error || 'Could not load player data');
        }

        const player = result.player;

        // Store session (no PIN)
        const session = {
            player_id: player.id,
            name: player.name,
            source_type: 'global',
            league_id: player.league_id || null,
            team_id: player.team_id || null,
            is_admin: player.is_admin || false,
            is_master_admin: player.is_master_admin || false,
            is_director: player.is_director || false,
            is_captain: player.is_captain || false,
            involvements: player.involvements || {},
            logged_in_at: Date.now()
        };
        localStorage.setItem('brdc_session', JSON.stringify(session));

        // Hide login UI and show loading state
        if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
        document.getElementById('loginOverlay').classList.add('hidden');
        showInitialLoader('Loading your dashboard...');

        loadDashboard(session.player_id, session.source_type, session.league_id);

    } catch (err) {
        if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
        if (loginBtn) loginBtn.disabled = false;
        let msg = 'Login failed. Please try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            msg = 'Invalid email or password.';
        } else if (err.code === 'auth/too-many-requests') {
            msg = 'Too many attempts. Please try again later.';
        } else if (err.code === 'auth/invalid-email') {
            msg = 'Please enter a valid email address.';
        } else if (err.message) {
            msg = err.message;
        }
        if (loginError) { loginError.textContent = msg; loginError.classList.remove('hidden'); }
    }
};

// Google Sign-In
window.loginWithGoogle = async function() {
    const loginError = document.getElementById('loginError');
    const loader = document.getElementById('loginLoader');

    if (loader) { loader.classList.remove('hidden'); loader.style.display = 'flex'; }
    if (loginError) loginError.classList.add('hidden');

    try {
        const { auth, signInWithPopup, GoogleAuthProvider, callFunction } = await import('/js/firebase-config.js');
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);

        const result = await callFunction('getPlayerSession', {});
        if (!result || !result.success) {
            throw new Error(result?.error || 'Could not load player data');
        }

        const player = result.player;
        const session = {
            player_id: player.id,
            name: player.name,
            source_type: 'global',
            league_id: player.league_id || null,
            team_id: player.team_id || null,
            is_admin: player.is_admin || false,
            is_master_admin: player.is_master_admin || false,
            is_director: player.is_director || false,
            is_captain: player.is_captain || false,
            involvements: player.involvements || {},
            logged_in_at: Date.now()
        };
        localStorage.setItem('brdc_session', JSON.stringify(session));

        if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
        document.getElementById('loginOverlay').classList.add('hidden');
        showInitialLoader('Loading your dashboard...');
        loadDashboard(session.player_id, session.source_type, session.league_id);

    } catch (err) {
        if (loader) { loader.classList.add('hidden'); loader.style.display = 'none'; }
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        let msg = 'Google sign-in failed. Please try again.';
        if (err.code === 'auth/popup-blocked') {
            msg = 'Popup was blocked. Please allow popups for this site and try again.';
        } else if (err.message) {
            msg = err.message;
        }
        if (loginError) { loginError.textContent = msg; loginError.classList.remove('hidden'); }
    }
};

// Forgot password
window.forgotPassword = async function() {
    const emailInput = document.getElementById('emailInput');
    const email = (emailInput?.value || '').trim();
    if (!email) {
        alert('Please enter your email address first.');
        return;
    }
    try {
        const { auth, sendPasswordResetEmail } = await import('/js/firebase-config.js');
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent! Check your inbox.');
    } catch (err) {
        alert(err.code === 'auth/user-not-found' ? 'No account found with that email.' : 'Could not send reset email. Please try again.');
    }
};

// Logout
window.logout = async function() {
    try {
        const { auth, signOut } = await import('/js/firebase-config.js');
        await signOut(auth);
    } catch (e) {
        console.warn('Logout error:', e);
    }
    clearSignedOutCaches();
    if (window.FBNav && typeof window.FBNav.logout === 'function') window.FBNav.logout();
    const loginPage = document.getElementById('loginOverlay');
    const dashboardContent = document.getElementById('mainContent');
    if (loginPage) loginPage.classList.remove('hidden');
    if (dashboardContent) dashboardContent.style.display = 'none';
};

// Mark module as loaded
window.moduleLoaded = true;

// ===== EXPORTS =====

export {
    initDashboardStable as initDashboard,
    loadDashboard,
    renderDashboard,
    CacheHelper,
    hideInitialLoader,
    showInitialLoader,
    showLoginPage,
    showDashboard
};
