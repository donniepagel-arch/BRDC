/**
 * Player Profile - Main Application Module
 *
 * Handles:
 * - Initialization and session management
 * - Tab switching
 * - Shared state management
 * - Coordination between feature modules
 */

import { callFunction, db, collection, getDocs, doc, getDoc, query, where } from '/js/firebase-config.js';
import { initProfileHeader, loadPlayerData } from '/js/player-profile/profile-header.js';
import { initProfileTab, loadStatsForSource } from '/js/player-profile/profile-stats.js';
import { initFeedTab, loadFeedTab } from '/js/player-profile/profile-feed.js';
import { initCareerTab, loadCareerTab } from '/js/player-profile/profile-career.js';
import { initPhotosTab, loadPhotosTab } from '/js/player-profile/profile-photos.js';

// ===== SHARED STATE =====

export const state = {
    currentPlayer: null,
    currentLeagueId: null,
    captainingTeams: [],
    isFilInPlayer: false,

    // Tab loaded flags
    statsLoaded: false,
    feedLoaded: false,
    careerLoaded: false,
    photosLoaded: false
};

// ===== INITIALIZATION =====

async function init() {
    // Check URL params for player_id or name
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlayerId = urlParams.get('player_id') || urlParams.get('id');
    const urlPlayerName = urlParams.get('name');
    const urlLeagueId = urlParams.get('league_id') || urlParams.get('league');

    // Check for existing session - try brdc_session first, then playerSession
    const brdcSession = localStorage.getItem('brdc_session');
    const playerSession = localStorage.getItem('playerSession');

    // Determine if we have a valid session
    let hasSession = false;

    if (brdcSession) {
        try {
            const session = JSON.parse(brdcSession);
            const sessionPlayerId = session.player_id || session.id;
            // If URL has player_id and it matches session, or no URL player_id, use session
            if (!urlPlayerId || urlPlayerId === sessionPlayerId) {
                state.currentPlayer = {
                    id: sessionPlayerId,
                    player_id: sessionPlayerId,
                    name: session.name,
                    source_type: session.source_type,
                    league_id: session.league_id
                };
                state.currentLeagueId = session.league_id || urlLeagueId;
                hasSession = true;
                // Show loading overlay while fetching data
                document.getElementById('loadingOverlay').style.display = 'flex';
                await loadPlayerData(state, sessionPlayerId, state.currentLeagueId);
            } else if (urlPlayerId) {
                // Viewing someone else's profile - load their data
                hasSession = true;
                document.getElementById('loadingOverlay').style.display = 'flex';
                await loadPlayerData(state, urlPlayerId, urlLeagueId);
            }
        } catch (e) {
            console.error('Session parse error:', e);
        }
    } else if (playerSession) {
        try {
            const session = JSON.parse(playerSession);
            state.currentPlayer = session.player;
            state.currentLeagueId = session.leagueId;
            hasSession = true;
            // Show loading overlay while fetching data
            document.getElementById('loadingOverlay').style.display = 'flex';
            // Fetch captain status since session might not have it
            await loadPlayerData(state, state.currentPlayer.id || state.currentPlayer.player_id, state.currentLeagueId);
        } catch (e) {
            console.error('Session parse error:', e);
        }
    }

    // If no valid session but we have player info in URL, try to load it
    if (!hasSession && (urlPlayerId || urlPlayerName)) {
        document.getElementById('loadingOverlay').style.display = 'flex';
        if (urlPlayerId) {
            await loadPlayerData(state, urlPlayerId, urlLeagueId);
        } else if (urlPlayerName) {
            // Look up player by name
            await lookupPlayerByName(urlPlayerName, urlLeagueId);
        }
    } else if (!hasSession) {
        document.getElementById('loginOverlay').style.display = 'flex';
    }

    // Initialize modules
    initProfileHeader(state);
    initProfileTab(state);
    initFeedTab(state);
    initCareerTab(state);
    initPhotosTab(state);
}

// Lookup player by name in league
async function lookupPlayerByName(name, leagueId) {
    try {
        // First try to find in league players
        if (leagueId) {
            const leaguePlayersSnap = await getDocs(collection(db, 'leagues', leagueId, 'players'));
            const foundPlayer = leaguePlayersSnap.docs.find(d => {
                const data = d.data();
                return data.name?.toLowerCase() === name.toLowerCase();
            });
            if (foundPlayer) {
                await loadPlayerData(state, foundPlayer.id, leagueId);
                return;
            }
        }

        // Fallback: search global players
        const playersSnap = await getDocs(collection(db, 'players'));
        const foundPlayer = playersSnap.docs.find(d => {
            const data = d.data();
            return data.name?.toLowerCase() === name.toLowerCase();
        });

        if (foundPlayer) {
            await loadPlayerData(state, foundPlayer.id, leagueId);
        } else {
            console.error('Player not found:', name);
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('loginOverlay').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error looking up player:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('loginOverlay').style.display = 'flex';
    }
}

// ===== TAB SWITCHING =====

window.switchDashTab = function(tabName) {
    const allTabs = document.querySelectorAll('.tab-btn');
    allTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.dash-tab-content').forEach(c => c.classList.remove('active'));

    // Find and activate the clicked tab
    const clickedTab = Array.from(allTabs).find(t => t.textContent.trim().toLowerCase() === tabName.toLowerCase());
    if (clickedTab) {
        clickedTab.classList.add('active');
        clickedTab.setAttribute('aria-selected', 'true');
    }

    const tabEl = document.getElementById(tabName + 'Tab');
    if (tabEl) tabEl.classList.add('active');

    // Accessibility
    if (window.A11y) A11y.activateTab(clickedTab, allTabs);

    // Lazy-load tab content
    if (tabName === 'stats' && !state.statsLoaded) {
        loadStatsForSource(state, 'combined');
        state.statsLoaded = true;
    } else if (tabName === 'feed' && !state.feedLoaded) {
        loadFeedTab(state);
        state.feedLoaded = true;
    } else if (tabName === 'career' && !state.careerLoaded) {
        loadCareerTab(state);
        state.careerLoaded = true;
    } else if (tabName === 'photos' && !state.photosLoaded) {
        loadPhotosTab(state);
        state.photosLoaded = true;
    }
};

// ===== WINDOW EXPOSED FUNCTIONS =====

// Called by showProfile (profile-header.js) after player data is rendered —
// ensures stats load on page load AND after login, not just on tab click.
// Stats are loaded in background to populate the header stats bar even when FEED tab is active.
window.triggerProfileStatsLoad = function() {
    if (state.currentPlayer && !state.statsLoaded) {
        loadStatsForSource(state, 'combined');
        state.statsLoaded = true;
    }
};

// Also trigger feed load on first profile show (FEED is the default tab)
window.triggerFeedLoad = function() {
    if (state.currentPlayer && !state.feedLoaded) {
        loadFeedTab(state);
        state.feedLoaded = true;
    }
};

// Smart back navigation - go to league page if we have league context
window.goBack = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLeagueId = urlParams.get('league_id');

    if (urlLeagueId) {
        window.location.href = `/pages/league-view.html?league_id=${urlLeagueId}`;
    } else if (state.currentLeagueId) {
        window.location.href = `/pages/league-view.html?league_id=${state.currentLeagueId}`;
    } else {
        history.back();
    }
};

window.showForgotPin = function() {
    const forgotPinCard = document.getElementById('forgotPinCard');
    const loginCard = document.getElementById('loginCard');
    forgotPinCard.style.display = 'block';
    loginCard.style.display = 'none';
};

window.showForgotPassword = window.showForgotPin;

window.showLoginCard = function() {
    const forgotPinCard = document.getElementById('forgotPinCard');
    const loginCard = document.getElementById('loginCard');
    forgotPinCard.style.display = 'none';
    loginCard.style.display = 'block';
};

window.logout = function() {
    localStorage.removeItem('brdc_session');
    localStorage.removeItem('playerSession');
    if (window.FBNav && window.FBNav.logout) {
        window.FBNav.logout();
    }
    window.location.href = '/pages/dashboard.html';
};

// ===== START =====

document.addEventListener('DOMContentLoaded', init);

export { init };
