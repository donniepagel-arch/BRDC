/**
 * League View - Main Application Module
 *
 * Handles:
 * - Initialization and data loading
 * - Tab switching
 * - Shared state management
 * - Coordination between feature modules
 */

import { db, doc, getDoc, collection, getDocs, query, where, orderBy, callFunction, uploadImage, showLoading, hideLoading } from '/js/firebase-config.js';
import { isRegistrationClosed, formatLeagueName, showError } from '/js/league-view/helpers.js?v=4';
import { renderSchedule, loadAllMatchCards, reloadScheduleView } from '/js/league-view/schedule.js?v=5';
import { initStandings } from '/js/league-view/standings.js?v=7';
import { initStats } from '/js/league-view/stats.js?v=4';
import { renderRules } from '/js/league-view/rules.js?v=4';
import { initTabSwipe } from '/js/tab-swipe.js';
import {
    renderRegistrationTab,
    renderSignupsList,
    showDirectorLogin,
    openFillinModal,
    openSubSignupModal,
    renderSubSignupForm,
    renderFillinForm,
    renderRegistrationForm,
    showSuccess,
    submitSubSignup,
    handleFillinPhotoChange,
    handleRegPhotoChange,
    submitFillin,
    openModal,
    closeModal,
    selectPayment,
    submitRegistration,
    loginEmailForReg,
    loginGoogleForReg,
    loginEmailForDirector,
    loginGoogleForDirector
} from '/js/league-view/registration.js?v=6';
import { renderLive, renderFillins } from '/js/league-view/live.js?v=4';
import { checkMatchNightForLeague, confirmAvailability } from '/js/league-view/match-night.js?v=5';

// ===== SHARED STATE =====

export const state = {
    leagueId: null,
    leagueData: null,
    teams: [],
    matches: [],
    registrations: [],
    fillins: [],
    isLoggedIn: false,
    memberData: null,
    selectedFillinPhoto: null,
    selectedRegPhoto: null,

    // Cached data - loaded once, used everywhere
    allPlayersById: null,  // { playerId: playerData }
    allPlayersList: null,  // [playerData, ...]
    allStatsById: null,    // { playerId: statsData }
    teamRecords: null,     // { teamId: { wins, losses, ties, gamesWon, gamesLost, legsWon, legsLost } }
    teamStandings: null,   // [{ id, wins, losses, gamePct }, ...] sorted by rank

    // Schedule state
    selectedWeek: null,
    selectedTeamFilter: 'all',

    // Standings-specific sub-state
    standingsData: {
        sortColumn: 'rank',
        sortDirection: 'asc',
        expandedTeams: new Set(),
        expandAll: false,
        teamStats: {},
        playerStats: {},
        leaguePlayers: {}
    },

    // Stats-specific sub-state
    statsData: {
        viewMode: 'players',
        mainTab: 'performance',
        subtab: 'x01',
        pageIndex: 0,
        levelFilter: null,
        sortColumn: 'primary',
        sortDirection: 'desc',
        expandedTeams: new Set(),
        loaded: false,
        playerStats: {},
        leaguePlayers: {}
    }
};

// ===== INITIALIZATION =====

let leagueViewInitialized = false;

async function initLeagueViewPage() {
    if (leagueViewInitialized) return;
    leagueViewInitialized = true;

    const urlParams = new URLSearchParams(window.location.search);
    state.leagueId = urlParams.get('league_id') || urlParams.get('id');
    state.isLoggedIn = !!localStorage.getItem('brdc_session');

    if (!state.leagueId) {
        showError('Missing league_id in URL');
        return;
    }
    await loadLeagueData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initLeagueViewPage().catch(error => {
            console.error('League view initialization failed:', error);
            showError('Failed to initialize league page: ' + error.message);
        });
    }, { once: true });
} else {
    initLeagueViewPage().catch(error => {
        console.error('League view initialization failed:', error);
        showError('Failed to initialize league page: ' + error.message);
    });
}

// ===== DATA LOADING =====

async function loadLeagueData() {
    try {
        // Invalidate caches - data is being reloaded
        state.allPlayersById = null;
        state.allPlayersList = null;
        state.allStatsById = null;
        state.teamRecords = null;
        state.teamStandings = null;

        const leagueDoc = await getDoc(doc(db, 'leagues', state.leagueId));

        if (!leagueDoc.exists()) {
            throw new Error('League not found');
        }

        state.leagueData = { id: state.leagueId, ...leagueDoc.data() };

        // Update breadcrumbs with league name
        const breadcrumbBar = document.getElementById('brdcBreadcrumbs');
        if (breadcrumbBar && state.leagueData) {
            const ol = breadcrumbBar.querySelector('ol');
            if (ol) {
                const li = document.createElement('li');
                li.textContent = formatLeagueName(state.leagueData.league_name || state.leagueData.name);
                li.setAttribute('aria-current', 'page');
                ol.appendChild(li);
            }
        }

        // Load registrations
        try {
            const regsSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'registrations'));
            state.registrations = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            state.registrations = [];
        }

        // Load fill-ins (available in all phases)
        try {
            const fillinsSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'fillins'));
            state.fillins = fillinsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            state.fillins = [];
        }

        // If registration is closed, load teams and matches
        if (isRegistrationClosed(state.leagueData)) {
            try {
                const teamsSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'teams'));
                state.teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                state.teams = [];
            }

            try {
                const matchesSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'matches'));
                state.matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                state.matches = [];
            }

            // Pre-load players and stats for active leagues
            await Promise.all([ensurePlayersLoaded(), ensureStatsLoaded()]);
            ensureTeamRecordsCalculated();
        }

        renderPage();

    } catch (error) {
        console.error('Error loading league:', error);
        showError('Failed to load league: ' + error.message);
    }
}

// Load all players once and cache
export async function ensurePlayersLoaded() {
    if (state.allPlayersById) return;
    const playersSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'players'));
    state.allPlayersById = {};
    state.allPlayersList = [];
    playersSnap.forEach(d => {
        const player = { id: d.id, ...d.data() };
        state.allPlayersById[d.id] = player;
        state.allPlayersList.push(player);
    });
}

// Load all stats once and cache
export async function ensureStatsLoaded() {
    if (state.allStatsById) return;
    const statsSnap = await getDocs(collection(db, 'leagues', state.leagueId, 'stats'));
    state.allStatsById = {};
    statsSnap.forEach(d => {
        state.allStatsById[d.id] = d.data();
    });
}

// Calculate team records and standings once from matches array
export function ensureTeamRecordsCalculated() {
    if (state.teamRecords) return;
    state.teamRecords = {};
    state.teams.forEach(t => {
        state.teamRecords[t.id] = { wins: 0, losses: 0, ties: 0, gamesWon: 0, gamesLost: 0, legsWon: 0, legsLost: 0 };
    });

    state.matches.forEach(m => {
        if (m.status !== 'completed') return;
        if (!state.teamRecords[m.home_team_id]) state.teamRecords[m.home_team_id] = { wins: 0, losses: 0, ties: 0, gamesWon: 0, gamesLost: 0, legsWon: 0, legsLost: 0 };
        if (!state.teamRecords[m.away_team_id]) state.teamRecords[m.away_team_id] = { wins: 0, losses: 0, ties: 0, gamesWon: 0, gamesLost: 0, legsWon: 0, legsLost: 0 };

        if (m.home_score > m.away_score) {
            state.teamRecords[m.home_team_id].wins++;
            state.teamRecords[m.away_team_id].losses++;
        } else if (m.away_score > m.home_score) {
            state.teamRecords[m.away_team_id].wins++;
            state.teamRecords[m.home_team_id].losses++;
        } else {
            state.teamRecords[m.home_team_id].ties++;
            state.teamRecords[m.away_team_id].ties++;
        }

        state.teamRecords[m.home_team_id].gamesWon += m.home_score || 0;
        state.teamRecords[m.home_team_id].gamesLost += m.away_score || 0;
        state.teamRecords[m.away_team_id].gamesWon += m.away_score || 0;
        state.teamRecords[m.away_team_id].gamesLost += m.home_score || 0;

        state.teamRecords[m.home_team_id].legsWon += m.home_legs || 0;
        state.teamRecords[m.home_team_id].legsLost += m.away_legs || 0;
        state.teamRecords[m.away_team_id].legsWon += m.away_legs || 0;
        state.teamRecords[m.away_team_id].legsLost += m.home_legs || 0;
    });

    // Calculate standings
    state.teamStandings = Object.entries(state.teamRecords).map(([id, rec]) => {
        const totalGames = rec.gamesWon + rec.gamesLost;
        const gamePct = totalGames > 0 ? rec.gamesWon / totalGames : 0;
        const totalLegs = rec.legsWon + rec.legsLost;
        const legPct = totalLegs > 0 ? rec.legsWon / totalLegs : 0;
        return {
            id,
            wins: rec.wins,
            losses: rec.losses,
            ties: rec.ties || 0,
            gamePct,
            legPct,
            gamesWon: rec.gamesWon,
            gamesLost: rec.gamesLost,
            legsWon: rec.legsWon,
            legsLost: rec.legsLost
        };
    }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
        if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return b.gamePct - a.gamePct;
    });
}

// Get team roster from cached players
export function getTeamRoster(teamId) {
    if (!state.allPlayersList) return [];
    const levelOrder = { A: 0, B: 1, C: 2, F: 3 };
    const getLevel = player => String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
    return state.allPlayersList.filter(p => p.team_id === teamId && !p.is_sub)
        .sort((a, b) => {
            const aOrder = levelOrder[getLevel(a)] ?? 9;
            const bOrder = levelOrder[getLevel(b)] ?? 9;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
}

// Get team standing (1-based rank)
export function getTeamStanding(teamId) {
    if (!state.teamStandings) return 0;
    return state.teamStandings.findIndex(t => t.id === teamId) + 1;
}

// ===== PAGE RENDERING =====

function renderPage() {
    const isClosed = isRegistrationClosed(state.leagueData);
    if (isClosed) {
        try {
            renderActiveLeagueView();
        } catch (error) {
            console.error('Error rendering active league view:', error);
            showError('This league loaded, but the page renderer hit invalid league data. ' + error.message);
        }
        return;
    }

    try {
        const totalSpots = (state.leagueData.num_teams || 8) * (state.leagueData.team_size || 3);
        const totalCount = state.registrations.length;
        const spotsRemaining = totalSpots - totalCount;
        const isFull = spotsRemaining <= 0;
        renderRegistrationView(totalSpots, totalCount, spotsRemaining, isFull);
    } catch (error) {
        console.error('Error rendering registration league view:', error);
        showError('This league loaded, but the registration view failed to render. ' + error.message);
    }
}

function renderActiveLeagueView() {
    const completedMatches = state.matches.filter(m => m.status === 'completed').length;
    const totalMatches = state.matches.length;
    const completedWeeks = state.matches
        .map(m => Number(m.week) || 1)
        .filter(w => state.matches.some(m => (Number(m.week) || 1) === w && m.status === 'completed'));
    const currentWeek = state.leagueData.current_week || Math.max(...completedWeeks, 1);

    let statusClass = 'active';
    let statusText = 'ACTIVE';
    if (state.leagueData.status === 'registration') {
        statusClass = 'registration';
        statusText = 'REGISTRATION';
    } else if (state.leagueData.status === 'draft') {
        statusClass = 'draft';
        statusText = 'DRAFT';
    } else if (state.leagueData.status === 'completed') {
        statusClass = 'completed';
        statusText = 'COMPLETED';
    }

    const leagueHeaderCard = `
        <div class="league-header-card">
            <div class="league-header-top">
                <div class="league-icon">🎯</div>
                <div class="league-info">
                    <div class="league-name">${state.leagueData.league_name || state.leagueData.name}</div>
                    <div class="league-season">${state.leagueData.season || ''} • ${state.leagueData.venue_name || 'TBD'}</div>
                </div>
                <button type="button" class="sub-signup-btn" onclick="openSubSignupModal()" aria-label="Sign up to be a substitute player"><span class="sub-signup-emoji">🙋</span> BE A SUB</button>
                <span class="league-status-badge ${statusClass}">${statusText}</span>
                <button type="button" class="brdc-share-btn" onclick="shareLink(location.href, document.title || 'League - BRDC', 'Check out this BRDC league!')" title="Share this league" aria-label="Share this league">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                </button>
            </div>
            <div class="league-stats-row">
                <div class="league-stat">
                    <span class="league-stat-value">${currentWeek}</span>
                    <span class="league-stat-label">/ ${state.leagueData.total_weeks || '18'} WEEKS</span>
                </div>
                <div class="league-stat">
                    <span class="league-stat-value">${state.teams.length}</span>
                    <span class="league-stat-label">TEAMS</span>
                </div>
                <div class="league-stat">
                    <span class="league-stat-value">${completedMatches}</span>
                    <span class="league-stat-label">/ ${totalMatches} MATCHES</span>
                </div>
            </div>
        </div>
    `;

    const html = `
        ${leagueHeaderCard}

        <div class="tabs" role="tablist" aria-label="League sections">
            <button type="button" class="tab active" role="tab" aria-selected="true" aria-controls="standingsTab" id="standingsTabBtn" onclick="switchTab('standings')">STANDINGS</button>
            <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="scheduleTab" id="scheduleTabBtn" onclick="switchTab('schedule')">SCHEDULE</button>
            <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="statsTab" id="statsTabBtn" onclick="switchTab('stats')">STATS</button>
            <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="rulesTab" id="rulesTabBtn" onclick="switchTab('rules')">RULES</button>
            <button type="button" class="tab" role="tab" aria-selected="false" id="membersTabBtn" onclick="goToMembers()" aria-label="Go to members page">MEMBERS</button>
        </div>

        <div id="standingsTab" class="tab-content active" role="tabpanel" aria-labelledby="standingsTabBtn" aria-live="polite">
            <div id="standingsContainer"></div>
        </div>

        <div id="scheduleTab" class="tab-content" role="tabpanel" aria-labelledby="scheduleTabBtn" aria-live="polite">
            ${renderSchedule(state)}
        </div>

        <div id="statsTab" class="tab-content" role="tabpanel" aria-labelledby="statsTabBtn" aria-live="polite">
            <div id="statsContainer"></div>
        </div>

        <div id="rulesTab" class="tab-content" role="tabpanel" aria-labelledby="rulesTabBtn">
            ${renderRules(state)}
        </div>
    `;
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = html;
    mainContent.removeAttribute('aria-busy');
    if (window.A11y) A11y.initTabs('.tabs', { tabSelector: '.tab', label: 'League sections' });

    // Load match cards after schedule tab is rendered
    loadAllMatchCards(state);

    // Initialize default standings tab immediately
    const initialStandingsTab = document.getElementById('standingsTab');
    if (initialStandingsTab) initialStandingsTab.setAttribute('aria-busy', 'true');
    setTimeout(() => {
        initStandings(state);
        if (initialStandingsTab) initialStandingsTab.setAttribute('aria-busy', 'false');
    }, 0);

    // Check if player has a match tonight
    checkMatchNightForLeague(state);

    // Initialize tab swipe gestures
    const TAB_NAMES = ['standings', 'schedule', 'stats', 'rules'];
    initTabSwipe({
        container: 'main',
        getActiveIndex: () => {
            const activeTab = document.querySelector('.tab.active');
            if (!activeTab) return 0;
            const tabName = activeTab.textContent.trim().toLowerCase();
            const idx = TAB_NAMES.indexOf(tabName);
            return idx >= 0 ? idx : 0;
        },
        getTabCount: () => TAB_NAMES.length,
        onSwipe: (index) => window.switchTab(TAB_NAMES[index])
    });
}

function renderRegistrationView(totalSpots, totalCount, spotsRemaining, isFull) {
    const html = renderRegistrationTab(state, totalSpots, totalCount, spotsRemaining, isFull);
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = html;
    mainContent.removeAttribute('aria-busy');
}

// ===== TAB SWITCHING =====

window.switchTab = function (tabName) {
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Find and activate the clicked tab
    const clickedTab = Array.from(allTabs).find(t => t.textContent.trim().toLowerCase() === tabName.toLowerCase());
    if (clickedTab) {
        clickedTab.classList.add('active');
        clickedTab.setAttribute('aria-selected', 'true');
    }

    const tabPanel = document.getElementById(tabName + 'Tab');
    if (tabPanel) {
        tabPanel.classList.add('active');

        // Show loading indicator for lazy-loaded tabs (preserve container divs)
        if (tabName === 'standings') {
            tabPanel.setAttribute('aria-busy', 'true');
            tabPanel.innerHTML = '<div class="tab-content-loading"></div><div id="standingsContainer"></div>';
        } else if (tabName === 'stats') {
            tabPanel.setAttribute('aria-busy', 'true');
            tabPanel.innerHTML = '<div class="tab-content-loading"></div><div id="statsContainer"></div>';
        }
    }

    // Accessibility
    if (window.A11y) A11y.activateTab(clickedTab, allTabs);

    // Lazy-load tab content
    if (tabName === 'standings') {
        // Use setTimeout to ensure loading indicator is visible
        setTimeout(() => {
            initStandings(state);
            if (tabPanel) tabPanel.setAttribute('aria-busy', 'false');
        }, 50);
    } else if (tabName === 'stats') {
        // Use setTimeout to ensure loading indicator is visible
        setTimeout(() => {
            initStats(state);
            if (tabPanel) tabPanel.setAttribute('aria-busy', 'false');
        }, 50);
    }
};

// ===== WINDOW EXPOSED FUNCTIONS =====

window.goToMembers = function () {
    window.location.href = `/pages/members.html?league_id=${state.leagueId}`;
};

window.changeWeek = function (week) {
    state.selectedWeek = parseInt(week);
    reloadScheduleView(state);
};

window.changeTeamFilter = function (teamId) {
    state.selectedTeamFilter = teamId;
    reloadScheduleView(state);
};

window.viewTeam = function (teamId) {
    window.location.href = `/pages/team-profile.html?league_id=${state.leagueId}&team_id=${teamId}`;
};

window.viewPlayer = function (playerId) {
    if (playerId) {
        window.location.href = `/pages/player-profile.html?id=${playerId}&league_id=${state.leagueId}`;
    }
};

window.viewMatch = function (matchId) {
    window.location.href = `/pages/match-hub.html?league_id=${state.leagueId}&match_id=${matchId}`;
};

window.confirmAvailability = async function (status) {
    await confirmAvailability(state, status);
};

// Expose registration functions for inline onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.openFillinModal = openFillinModal;
window.openSubSignupModal = openSubSignupModal;
window.submitSubSignup = submitSubSignup;
window.handleFillinPhotoChange = handleFillinPhotoChange;
window.handleRegPhotoChange = handleRegPhotoChange;
window.submitFillin = submitFillin;
window.selectPayment = selectPayment;
window.submitRegistration = submitRegistration;
window.showDirectorLogin = showDirectorLogin;
window.loginEmailForReg = loginEmailForReg;
window.loginGoogleForReg = loginGoogleForReg;
window.loginEmailForDirector = loginEmailForDirector;
window.loginGoogleForDirector = loginGoogleForDirector;

// Re-export functions needed by other modules
export { loadLeagueData, renderPage };
