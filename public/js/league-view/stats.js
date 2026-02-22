// stats.js - Stats tab functionality for league-view
import { state, ensurePlayersLoaded, ensureStatsLoaded } from './app.js';

// Stats view state
let statsData = {
    viewMode: 'players',      // 'teams' or 'players'
    mainTab: 'performance',   // 'performance', 'awards', 'leaderboard'
    subtab: 'x01',            // 'x01', 'cricket', 'combined'
    pageIndex: 0,             // current page within subtab
    levelFilter: null,        // null = all, or 'A', 'B', 'C'
    sortColumn: 'primary',
    sortDirection: 'desc',
    expandedTeams: new Set(),
    loaded: false,
    playerStats: {},
    leaguePlayers: {}
};

// 3 main tabs → subtabs → paginated pages → columns
const STATS_CATEGORIES = {
    'performance': {
        name: 'PERFORMANCE',
        subtabs: {
            'x01': {
                name: "'01",
                pages: [
                    {
                        name: 'Averages',
                        columns: [
                            { key: '3da', label: '3DA', primary: true },
                            { key: 'first9', label: 'Fir9' },
                            { key: 'avgCo', label: 'AFin', hidePortrait: true },
                            { key: 'legs', label: 'Legs', hidePortrait: true },
                            { key: 'legPct', label: 'Win%', hidePortrait: true }
                        ],
                        sortKey: '3da'
                    },
                    {
                        name: 'Tons',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'tons', label: '100+', primary: true },
                            { key: 't40', label: '140+' },
                            { key: 't80', label: '180', hidePortrait: true },
                            { key: 'highScore', label: 'HTurn', hidePortrait: true }
                        ],
                        sortKey: '3da'
                    },
                    {
                        name: 'Ton Breakdown',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'ton00', label: '100-119', primary: true },
                            { key: 'ton20', label: '120-139' },
                            { key: 'ton40', label: '140-159', hidePortrait: true },
                            { key: 'ton60', label: '160-179', hidePortrait: true },
                            { key: 't80', label: '180' }
                        ],
                        sortKey: '3da'
                    },
                    {
                        name: 'Checkouts',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'coPct', label: 'CO%', primary: true },
                            { key: 'avgCo', label: 'AFin' },
                            { key: 'highCo', label: 'HCO', hidePortrait: true },
                            { key: 'coHits', label: 'Made', hidePortrait: true },
                            { key: 'coAttempts', label: 'Att', hidePortrait: true }
                        ],
                        sortKey: 'coPct'
                    }
                ]
            },
            'cricket': {
                name: 'CRICKET',
                pages: [
                    {
                        name: 'Averages',
                        columns: [
                            { key: 'mpr', label: 'MPR', primary: true },
                            { key: 'highMark', label: 'HRnd' },
                            { key: 'cLegs', label: 'Legs', hidePortrait: true },
                            { key: 'cLegPct', label: 'Win%', hidePortrait: true }
                        ],
                        sortKey: 'mpr'
                    },
                    {
                        name: 'High Marks',
                        columns: [
                            { key: 'mpr', label: 'MPR' },
                            { key: 'mark9', label: '9M', primary: true },
                            { key: 'mark8', label: '8M' },
                            { key: 'mark7', label: '7M', hidePortrait: true },
                            { key: 'mark6', label: '6M', hidePortrait: true },
                            { key: 'mark5', label: '5M', hidePortrait: true }
                        ],
                        sortKey: 'mark9'
                    }
                ]
            }
        }
    },
    'awards': {
        name: 'AWARDS',
        subtabs: {
            'x01': {
                name: "'01",
                pages: [
                    {
                        name: 'CO Range %',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'co80Pct', label: '80+%', primary: true },
                            { key: 'co120Pct', label: '120+%' },
                            { key: 'co140Pct', label: '140+%', hidePortrait: true },
                            { key: 'co161Pct', label: '161+%', hidePortrait: true }
                        ],
                        sortKey: 'co80Pct'
                    },
                    {
                        name: 'CO Range Counts',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'co80Made', label: '80+', primary: true },
                            { key: 'co120Made', label: '120+' },
                            { key: 'co140Made', label: '140+', hidePortrait: true },
                            { key: 'co161Made', label: '161+', hidePortrait: true }
                        ],
                        sortKey: 'co80Made'
                    },
                    {
                        name: 'Checkout Perf',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'avgCo', label: 'AFin', primary: true },
                            { key: 'coPct', label: 'CO%' },
                            { key: 'highCo', label: 'HCO', hidePortrait: true },
                            { key: 'bestLeg', label: 'Best', hidePortrait: true }
                        ],
                        sortKey: 'avgCo'
                    }
                ]
            },
            'cricket': {
                name: 'CRICKET',
                pages: [
                    {
                        name: 'High Marks',
                        columns: [
                            { key: 'mpr', label: 'MPR' },
                            { key: 'mark9', label: '9M', primary: true },
                            { key: 'mark8', label: '8M' },
                            { key: 'mark7', label: '7M', hidePortrait: true },
                            { key: 'mark6', label: '6M', hidePortrait: true },
                            { key: 'hatTricks', label: 'Hats', hidePortrait: true }
                        ],
                        sortKey: 'mark9'
                    }
                ]
            }
        }
    },
    'leaderboard': {
        name: 'LEADERBOARD',
        subtabs: {
            'x01': {
                name: "'01",
                pages: [
                    {
                        name: 'Record',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'legWins', label: 'Won', primary: true },
                            { key: 'legs', label: 'Legs' },
                            { key: 'legPct', label: 'Win%' },
                            { key: 'bestLeg', label: 'Best', hidePortrait: true }
                        ],
                        sortKey: 'legPct'
                    },
                    {
                        name: 'Start Record',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'x01WithDarts', label: 'w/Darts%', primary: true },
                            { key: 'x01WithLegs', label: 'w/Legs' },
                            { key: 'x01AgainstDarts', label: 'vs%', hidePortrait: true },
                            { key: 'x01AgainstLegs', label: 'vs Legs', hidePortrait: true }
                        ],
                        sortKey: 'x01WithDarts'
                    },
                    {
                        name: 'CO Leaders',
                        columns: [
                            { key: '3da', label: '3DA' },
                            { key: 'highCo', label: 'HCO', primary: true },
                            { key: 'avgCo', label: 'AFin' },
                            { key: 'coPct', label: 'CO%', hidePortrait: true },
                            { key: 'highScore', label: 'HTurn', hidePortrait: true }
                        ],
                        sortKey: 'highCo'
                    }
                ]
            },
            'cricket': {
                name: 'CRICKET',
                pages: [
                    {
                        name: 'Record',
                        columns: [
                            { key: 'mpr', label: 'MPR' },
                            { key: 'cLegWins', label: 'Won', primary: true },
                            { key: 'cLegs', label: 'Legs' },
                            { key: 'cLegPct', label: 'Win%' },
                            { key: 'highMark', label: 'HRnd', hidePortrait: true }
                        ],
                        sortKey: 'cLegPct'
                    },
                    {
                        name: 'Start Record',
                        columns: [
                            { key: 'mpr', label: 'MPR' },
                            { key: 'cricketWithDarts', label: 'w/Darts%', primary: true },
                            { key: 'cricketWithLegs', label: 'w/Legs' },
                            { key: 'cricketAgainstDarts', label: 'vs%', hidePortrait: true },
                            { key: 'cricketAgainstLegs', label: 'vs Legs', hidePortrait: true }
                        ],
                        sortKey: 'cricketWithDarts'
                    }
                ]
            },
            'combined': {
                name: 'ALL',
                pages: [
                    {
                        name: 'Combined Record',
                        columns: [
                            { key: 'totalWins', label: 'Won', primary: true },
                            { key: 'totalLegs', label: 'Played' },
                            { key: 'totalPct', label: 'Win%' },
                            { key: 'withDarts', label: 'w/Darts%', hidePortrait: true },
                            { key: 'againstDarts', label: 'vs%', hidePortrait: true }
                        ],
                        sortKey: 'totalWins'
                    }
                ]
            }
        }
    }
};

// Helper to get current subtab config
function getCurrentSubtab() {
    const mainCat = STATS_CATEGORIES[statsData.mainTab];
    if (!mainCat) return null;
    let subtab = mainCat.subtabs[statsData.subtab];
    if (!subtab) {
        // Fall back to first available subtab
        const firstKey = Object.keys(mainCat.subtabs)[0];
        statsData.subtab = firstKey;
        subtab = mainCat.subtabs[firstKey];
    }
    return subtab;
}

export async function initStats() {
    const tabPanel = document.getElementById('statsTab');
    if (!tabPanel) return;
    // Ensure container exists and clear any loading spinners
    if (!document.getElementById('statsContainer')) {
        tabPanel.innerHTML = '<div id="statsContainer"></div>';
    }
    let container = document.getElementById('statsContainer');
    // Remove any sibling loading spinners
    const spinner = tabPanel.querySelector('.tab-content-loading');
    if (spinner) spinner.remove();

    if (!statsData.loaded) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9203;</div><div>Loading stats...</div></div>';

        try {
            await ensurePlayersLoaded();
            await ensureStatsLoaded();

            // Populate statsData from cached data
            Object.entries(state.allPlayersById).forEach(([id, player]) => {
                statsData.leaguePlayers[id] = player;
            });
            Object.entries(state.allStatsById).forEach(([id, stats]) => {
                statsData.playerStats[id] = stats;
            });

            statsData.loaded = true;
        } catch (err) {
            console.error('Error loading stats:', err);
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9888;</div><div>Failed to load stats</div></div>';
            return;
        }
    }

    renderStatsTab();
}

function renderStatsTab() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const mainCat = STATS_CATEGORIES[statsData.mainTab];
    const subtab = getCurrentSubtab();
    if (!subtab) return;

    const pages = subtab.pages;
    if (statsData.pageIndex >= pages.length) statsData.pageIndex = 0;
    const currentPage = pages[statsData.pageIndex] || pages[0];

    // Controls: View toggle + Level filter
    const controlsHtml = `
        <div class="stats-controls">
            <div class="stats-view-toggle" role="group" aria-label="Stats view mode">
                <button type="button" class="stats-view-btn ${statsData.viewMode === 'teams' ? 'active' : ''}" onclick="setStatsView('teams')" aria-pressed="${statsData.viewMode === 'teams'}">TEAMS</button>
                <button type="button" class="stats-view-btn ${statsData.viewMode === 'players' ? 'active' : ''}" onclick="setStatsView('players')" aria-pressed="${statsData.viewMode === 'players'}">PLAYERS</button>
            </div>
            <div class="stats-level-filter" role="group" aria-label="Filter by player level">
                <button type="button" class="stats-level-btn ${!statsData.levelFilter ? 'active' : ''}" onclick="setStatsLevel(null)" aria-pressed="${!statsData.levelFilter}" aria-label="Show all levels">ALL</button>
                <button type="button" class="stats-level-btn level-a ${statsData.levelFilter === 'A' ? 'active' : ''}" onclick="setStatsLevel('A')" aria-pressed="${statsData.levelFilter === 'A'}" aria-label="Show level A players only">A</button>
                <button type="button" class="stats-level-btn level-b ${statsData.levelFilter === 'B' ? 'active' : ''}" onclick="setStatsLevel('B')" aria-pressed="${statsData.levelFilter === 'B'}" aria-label="Show level B players only">B</button>
                <button type="button" class="stats-level-btn level-c ${statsData.levelFilter === 'C' ? 'active' : ''}" onclick="setStatsLevel('C')" aria-pressed="${statsData.levelFilter === 'C'}" aria-label="Show level C players only">C</button>
            </div>
        </div>
    `;

    // Main tabs (PERFORMANCE / AWARDS / LEADERBOARD)
    const mainTabsHtml = `
        <div class="stats-category-tabs" role="tablist" aria-label="Stats categories">
            ${Object.entries(STATS_CATEGORIES).map(([key, c]) => `
                <button type="button" role="tab" class="stats-category-btn ${statsData.mainTab === key ? 'active' : ''}" onclick="setStatsMainTab('${key}')" aria-selected="${statsData.mainTab === key}" aria-controls="statsTableContainer">${c.name}</button>
            `).join('')}
        </div>
    `;

    // Sub-tabs ('01 / CRICKET / ALL)
    const subtabKeys = Object.keys(mainCat.subtabs);
    const subtabsHtml = subtabKeys.length > 1 ? `
        <div class="stats-subtab-nav" role="tablist" aria-label="Game type">
            ${subtabKeys.map(key => {
                const st = mainCat.subtabs[key];
                return `<button type="button" role="tab" class="stats-subtab-btn ${statsData.subtab === key ? 'active' : ''}" onclick="setStatsSubtab('${key}')" aria-selected="${statsData.subtab === key}">${st.name}</button>`;
            }).join('')}
        </div>
    ` : '';

    // Page navigation (arrows + title box + dots)
    const pageNavHtml = pages.length > 1 ? `
        <div class="stats-page-nav" role="navigation" aria-label="Stats pages">
            <button type="button" class="stats-page-arrow" onclick="changeStatsPage(-1)" ${statsData.pageIndex === 0 ? 'disabled' : ''} aria-label="Previous page">&#9664;</button>
            <div class="stats-page-title-box">
                <span class="stats-page-label">${currentPage.name}</span>
                <div class="stats-page-indicator" role="tablist" aria-label="Page selection">
                    ${pages.map((p, i) => `<button type="button" role="tab" class="stats-page-dot ${i === statsData.pageIndex ? 'active' : ''}" onclick="setStatsPage(${i})" aria-label="Page ${i + 1}: ${p.name}" aria-selected="${i === statsData.pageIndex}"></button>`).join('')}
                </div>
            </div>
            <button type="button" class="stats-page-arrow" onclick="changeStatsPage(1)" ${statsData.pageIndex === pages.length - 1 ? 'disabled' : ''} aria-label="Next page">&#9654;</button>
        </div>
    ` : `
        <div class="stats-page-nav">
            <div class="stats-page-title-box">
                <span class="stats-page-label">${currentPage.name}</span>
            </div>
        </div>
    `;

    // Render appropriate view
    let tableHtml = '';
    if (statsData.viewMode === 'teams') {
        tableHtml = renderStatsTeamView();
    } else {
        tableHtml = renderStatsPlayerView();
    }

    container.innerHTML = controlsHtml + mainTabsHtml + subtabsHtml + pageNavHtml + tableHtml;
}

function getPlayerStatValues(playerId) {
    const s = statsData.playerStats[playerId] || {};
    const p = statsData.leaguePlayers[playerId] || {};

    // Calculate all possible stat values
    const x01Legs = s.x01_legs_played || 0;
    const x01Darts = s.x01_total_darts || 0;
    const x01Points = s.x01_total_points || 0;
    const cricketLegs = s.cricket_legs_played || 0;
    const cricketRounds = s.cricket_total_rounds || 0;
    const cricketMarks = s.cricket_total_marks || 0;

    // Use pre-calculated values first, then fall back to calculation
    const calc3DA = x01Darts > 0 ? (x01Points / x01Darts) * 3 : 0;
    const calcMPR = cricketRounds > 0 ? cricketMarks / cricketRounds : 0;

    return {
        // Player info
        id: playerId,
        name: p.name || 'Unknown',
        level: p.level || '',
        teamId: p.team_id,

        // X01 stats
        '3da': get3DA(s) || calc3DA,
        'first9': s.x01_first9_darts > 0 ? (s.x01_first9_points / s.x01_first9_darts) * 3 : 0,
        'legs': x01Legs,
        'legWins': s.x01_legs_won || 0,
        'legPct': x01Legs > 0 ? ((s.x01_legs_won || 0) / x01Legs) * 100 : 0,
        'tons': s.x01_tons || 0,
        'tonPct': x01Legs > 0 ? ((s.x01_tons || 0) / x01Legs) * 100 : 0,

        // Non-cumulative ton ranges (for breakdown view)
        'ton00': s.x01_ton_00 || 0,    // 100-119
        'ton20': s.x01_ton_20 || 0,    // 120-139
        'ton40': s.x01_ton_40 || 0,    // 140-159
        'ton60': s.x01_ton_60 || 0,    // 160-179
        // Cumulative ton ranges
        't80': s.x01_ton_80 || 0,
        't60': (s.x01_ton_60 || 0) + (s.x01_ton_80 || 0),
        't40': (s.x01_ton_40 || 0) + (s.x01_ton_60 || 0) + (s.x01_ton_80 || 0),
        't20': (s.x01_ton_20 || 0) + (s.x01_ton_40 || 0) + (s.x01_ton_60 || 0) + (s.x01_ton_80 || 0),
        't00': s.x01_tons || 0,
        'highScore': s.x01_high_score || 0,
        'highStraight': s.x01_high_straight_in || 0,
        'bestLeg': s.x01_best_leg && s.x01_best_leg < 900 ? s.x01_best_leg : 0,

        // Checkout stats
        'coPct': s.x01_checkout_attempts > 0 ? ((s.x01_checkouts_hit || 0) / s.x01_checkout_attempts) * 100 : 0,
        'highCo': s.x01_high_checkout || 0,
        'avgCo': s.x01_checkouts_hit > 0 ? (s.x01_total_checkout_points || 0) / s.x01_checkouts_hit : 0,
        'coHits': s.x01_checkouts_hit || 0,
        'coAttempts': s.x01_checkout_attempts || 0,
        // Checkout % by range
        'co80Pct': s.x01_co_80_attempts > 0 ? ((s.x01_co_80_hits || 0) / s.x01_co_80_attempts) * 100 : 0,
        'co80Att': s.x01_co_80_attempts || 0,
        'co80Made': s.x01_co_80_hits || 0,
        'co120Pct': s.x01_co_120_attempts > 0 ? ((s.x01_co_120_hits || 0) / s.x01_co_120_attempts) * 100 : 0,
        'co120Att': s.x01_co_120_attempts || 0,
        'co120Made': s.x01_co_120_hits || 0,
        'co140Pct': s.x01_co_140_attempts > 0 ? ((s.x01_co_140_hits || 0) / s.x01_co_140_attempts) * 100 : 0,
        'co140Att': s.x01_co_140_attempts || 0,
        'co140Made': s.x01_co_140_hits || 0,
        'co161Pct': s.x01_co_161_attempts > 0 ? ((s.x01_co_161_hits || 0) / s.x01_co_161_attempts) * 100 : 0,
        'co161Att': s.x01_co_161_attempts || 0,
        'co161Made': s.x01_co_161_hits || 0,

        // X01 with/against darts (separate)
        'x01WithDarts': (s.x01_legs_with_darts || 0) > 0 ?
            ((s.x01_legs_with_darts_won || 0) / s.x01_legs_with_darts) * 100 : 0,
        'x01WithLegs': s.x01_legs_with_darts || 0,
        'x01AgainstDarts': (s.x01_legs_against_darts || 0) > 0 ?
            ((s.x01_legs_against_darts_won || 0) / s.x01_legs_against_darts) * 100 : 0,
        'x01AgainstLegs': s.x01_legs_against_darts || 0,

        // Cricket stats
        'mpr': getMPR(s) || calcMPR,
        'cLegs': cricketLegs,
        'cLegWins': s.cricket_legs_won || 0,
        'cLegPct': cricketLegs > 0 ? ((s.cricket_legs_won || 0) / cricketLegs) * 100 : 0,
        'highMark': s.cricket_high_mark_round || 0,
        'mark9': s.cricket_nine_mark_rounds || 0,
        'mark8': s.cricket_eight_mark_rounds || 0,
        'mark7': s.cricket_seven_mark_rounds || 0,
        'mark6': s.cricket_six_mark_rounds || 0,
        'mark5': s.cricket_five_mark_rounds || 0,
        'hatTricks': s.cricket_hat_tricks || 0,

        // Cricket with/against darts (separate)
        'cricketWithDarts': (s.cricket_legs_with_darts || 0) > 0 ?
            ((s.cricket_legs_with_darts_won || 0) / s.cricket_legs_with_darts) * 100 : 0,
        'cricketWithLegs': s.cricket_legs_with_darts || 0,
        'cricketAgainstDarts': (s.cricket_legs_against_darts || 0) > 0 ?
            ((s.cricket_legs_against_darts_won || 0) / s.cricket_legs_against_darts) * 100 : 0,
        'cricketAgainstLegs': s.cricket_legs_against_darts || 0,

        // Combined leg record
        'totalLegs': x01Legs + cricketLegs,
        'totalWins': (s.x01_legs_won || 0) + (s.cricket_legs_won || 0),
        'totalPct': (x01Legs + cricketLegs) > 0 ? (((s.x01_legs_won || 0) + (s.cricket_legs_won || 0)) / (x01Legs + cricketLegs)) * 100 : 0,
        'withDarts': (s.x01_legs_with_darts || 0) + (s.cricket_legs_with_darts || 0) > 0 ?
            (((s.x01_legs_with_darts_won || 0) + (s.cricket_legs_with_darts_won || 0)) /
                ((s.x01_legs_with_darts || 0) + (s.cricket_legs_with_darts || 0))) * 100 : 0,
        'againstDarts': (s.x01_legs_against_darts || 0) + (s.cricket_legs_against_darts || 0) > 0 ?
            (((s.x01_legs_against_darts_won || 0) + (s.cricket_legs_against_darts_won || 0)) /
                ((s.x01_legs_against_darts || 0) + (s.cricket_legs_against_darts || 0))) * 100 : 0
    };
}

function formatStatValue(key, value) {
    if (value === 0 || value === null || value === undefined) return '-';

    // Percentages
    if (key.includes('Pct') || key === 'withDarts' || key === 'againstDarts' ||
        key === 'x01WithDarts' || key === 'x01AgainstDarts' ||
        key === 'cricketWithDarts' || key === 'cricketAgainstDarts') {
        return value.toFixed(1) + '%';
    }

    // Averages (3da, first9, mpr, avgCo)
    if (key === '3da' || key === 'first9' || key === 'avgCo') {
        return value.toFixed(1);
    }
    if (key === 'mpr') {
        return value.toFixed(2);
    }

    // Integers
    return Math.round(value).toString();
}

function renderStatsPlayerView() {
    const subtab = getCurrentSubtab();
    if (!subtab) return '';
    const currentPage = subtab.pages[statsData.pageIndex] || subtab.pages[0];
    const columns = currentPage.columns;

    // Get all players with stats
    let players = Object.keys(statsData.leaguePlayers).map(id => getPlayerStatValues(id));

    if (players.length === 0) {
        return '<div class="empty-state"><div class="empty-state-icon">&#128202;</div><div class="empty-state-title">No Stats Yet</div><div class="empty-state-text">Stats will appear here once match data has been imported.</div></div>';
    }

    // Filter by level if set
    if (statsData.levelFilter) {
        players = players.filter(p => (p.level || '').toUpperCase() === statsData.levelFilter);
    }

    // Sort players by the page's sort key
    const sortKey = currentPage.sortKey || columns[0].key;
    players.sort((a, b) => {
        const aVal = a[sortKey] || 0;
        const bVal = b[sortKey] || 0;
        return statsData.sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Get team names lookup
    const teamNames = {};
    state.teams.forEach(t => { teamNames[t.id] = t.team_name; });

    // Group by level if no filter
    const levels = statsData.levelFilter ? [statsData.levelFilter] : ['A', 'B', 'C', 'D', 'E', ''];
    const levelNames = { 'A': 'A LEVEL', 'B': 'B LEVEL', 'C': 'C LEVEL', 'D': 'D LEVEL', 'E': 'E LEVEL', '': 'UNRATED' };

    let html = '<div class="stats-table-section"><div class="stats-table-wrapper"><table class="stats-table"><thead><tr>';
    html += '<th class="rank-col">#</th>';
    html += '<th class="name-col">Player</th>';

    columns.forEach(col => {
        const hideClass = col.hidePortrait ? 'hide-portrait' : '';
        const sortClass = statsData.sortColumn === col.key ? `sort-${statsData.sortDirection}` : '';
        html += `<th class="stat-col sortable ${hideClass} ${sortClass}" onclick="sortStats('${col.key}')">${col.label}</th>`;
    });

    html += '</tr></thead><tbody>';

    levels.forEach(level => {
        const levelPlayers = players.filter(p => (p.level || '').toUpperCase() === level);
        if (levelPlayers.length === 0) return;

        // Level header (only if showing all levels)
        if (!statsData.levelFilter) {
            const levelClass = level ? `level-${level.toLowerCase()}` : '';
            html += `<tr><td colspan="${columns.length + 2}" class="stats-section-header ${levelClass}">${levelNames[level]} (${levelPlayers.length})</td></tr>`;
        }

        levelPlayers.forEach((p, idx) => {
            const levelBadge = p.level ? `<span class="player-level-badge level-${p.level.toLowerCase()}">${p.level}</span>` : '';
            const teamBadge = teamNames[p.teamId] ? `<span class="stats-team-badge">${teamNames[p.teamId]}</span>` : '';
            const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';

            html += '<tr>';
            html += `<td class="rank-col ${rankClass}">${idx + 1}</td>`;
            html += `<td class="name-col"><div class="stats-player-name">
                ${levelBadge}<a href="/pages/player-profile.html?id=${p.id}" class="stats-player-link">${p.name}</a>
                ${teamBadge}
            </div></td>`;

            columns.forEach(col => {
                const isPrimary = col.primary ? 'primary-stat' : 'secondary-stat';
                const hideClass = col.hidePortrait ? 'hide-portrait' : '';
                const val = p[col.key];
                const zeroClass = (val === 0 || val === null || val === undefined) ? 'zero-val' : '';
                html += `<td class="stat-col ${isPrimary} ${hideClass} ${zeroClass}">${formatStatValue(col.key, val)}</td>`;
            });

            html += '</tr>';
        });
    });

    html += '</tbody></table></div></div>';
    return html;
}

function renderStatsTeamView() {
    const subtab = getCurrentSubtab();
    if (!subtab) return '';
    const currentPage = subtab.pages[statsData.pageIndex] || subtab.pages[0];
    const columns = currentPage.columns;

    // Calculate team averages
    const teamStats = state.teams.map(team => {
        const teamPlayers = Object.keys(statsData.leaguePlayers)
            .filter(id => statsData.leaguePlayers[id].team_id === team.id)
            .map(id => getPlayerStatValues(id));

        // Filter by level if set
        let filteredPlayers = teamPlayers;
        if (statsData.levelFilter) {
            filteredPlayers = teamPlayers.filter(p => (p.level || '').toUpperCase() === statsData.levelFilter);
        }

        // Calculate team averages for each column
        const teamAvg = { id: team.id, name: team.team_name, players: filteredPlayers };

        columns.forEach(col => {
            const values = filteredPlayers.map(p => p[col.key]).filter(v => v > 0);
            teamAvg[col.key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });

        return teamAvg;
    });

    // Sort teams by the page's sort key
    const sortKey = currentPage.sortKey || columns[0].key;
    teamStats.sort((a, b) => {
        const aVal = a[sortKey] || 0;
        const bVal = b[sortKey] || 0;
        return statsData.sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    let html = '<div class="stats-table-section"><div class="stats-table-wrapper"><table class="stats-table"><thead><tr>';
    html += '<th class="rank-col">#</th>';
    html += '<th class="name-col">Team</th>';

    columns.forEach(col => {
        const hideClass = col.hidePortrait ? 'hide-portrait' : '';
        const sortClass = statsData.sortColumn === col.key ? `sort-${statsData.sortDirection}` : '';
        html += `<th class="stat-col sortable ${hideClass} ${sortClass}" onclick="sortStats('${col.key}')">${col.label}</th>`;
    });

    html += '</tr></thead><tbody>';

    teamStats.forEach((team, idx) => {
        const isExpanded = statsData.expandedTeams.has(team.id);
        const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';

        // Team row
        html += `<tr class="team-header-row ${isExpanded ? 'expanded' : ''}" onclick="toggleStatsTeam('${team.id}')">`;
        html += `<td class="rank-col ${rankClass}">${idx + 1}</td>`;
        html += `<td class="name-col"><span class="team-expand-icon">&#9654;</span>
            <a href="/pages/team-profile.html?team_id=${team.id}&league_id=${state.leagueId}" class="stats-team-link" onclick="event.stopPropagation()">${team.name}</a>
        </td>`;

        columns.forEach(col => {
            const isPrimary = col.primary ? 'primary-stat' : 'secondary-stat';
            const hideClass = col.hidePortrait ? 'hide-portrait' : '';
            const val = team[col.key];
            const zeroClass = (val === 0 || val === null || val === undefined) ? 'zero-val' : '';
            html += `<td class="stat-col ${isPrimary} ${hideClass} ${zeroClass}">${formatStatValue(col.key, val)}</td>`;
        });

        html += '</tr>';

        // Player rows (hidden unless expanded)
        team.players.forEach(p => {
            const levelBadge = p.level ? `<span class="player-level-badge level-${p.level.toLowerCase()}">${p.level}</span>` : '';

            html += `<tr class="player-row ${isExpanded ? '' : 'hidden'}">`;
            html += '<td></td>';
            html += `<td class="name-col"><div class="stats-player-name">
                ${levelBadge}<a href="/pages/player-profile.html?id=${p.id}" class="stats-player-link">${p.name}</a>
            </div></td>`;

            columns.forEach(col => {
                const hideClass = col.hidePortrait ? 'hide-portrait' : '';
                const val = p[col.key];
                const zeroClass = (val === 0 || val === null || val === undefined) ? 'zero-val' : '';
                html += `<td class="stat-col secondary-stat ${hideClass} ${zeroClass}">${formatStatValue(col.key, val)}</td>`;
            });

            html += '</tr>';
        });
    });

    html += '</tbody></table></div></div>';
    return html;
}

// ===== Control Functions =====

export function setStatsView(mode) {
    statsData.viewMode = mode;
    statsData.expandedTeams.clear();
    renderStatsTab();
}

export function setStatsLevel(level) {
    statsData.levelFilter = level;
    renderStatsTab();
}

export function setStatsMainTab(tab) {
    statsData.mainTab = tab;
    // Reset subtab to first available in this main tab
    const mainCat = STATS_CATEGORIES[tab];
    const subtabKeys = Object.keys(mainCat.subtabs);
    if (!subtabKeys.includes(statsData.subtab)) {
        statsData.subtab = subtabKeys[0];
    }
    statsData.pageIndex = 0;
    statsData.sortColumn = 'primary';
    statsData.sortDirection = 'desc';
    renderStatsTab();
}

export function setStatsSubtab(subtab) {
    statsData.subtab = subtab;
    statsData.pageIndex = 0;
    statsData.sortDirection = 'desc';
    renderStatsTab();
}

export function setStatsPage(index) {
    const subtab = getCurrentSubtab();
    if (subtab && index >= 0 && index < subtab.pages.length) {
        statsData.pageIndex = index;
        statsData.sortDirection = 'desc';
        renderStatsTab();
    }
}

export function changeStatsPage(delta) {
    const subtab = getCurrentSubtab();
    if (!subtab) return;
    const newIndex = statsData.pageIndex + delta;
    if (newIndex >= 0 && newIndex < subtab.pages.length) {
        statsData.pageIndex = newIndex;
        statsData.sortDirection = 'desc';
        renderStatsTab();
    }
}

export function sortStats(column) {
    if (statsData.sortColumn === column) {
        statsData.sortDirection = statsData.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        statsData.sortColumn = column;
        statsData.sortDirection = 'desc';
    }
    renderStatsTab();
}

export function toggleStatsTeam(teamId) {
    if (statsData.expandedTeams.has(teamId)) {
        statsData.expandedTeams.delete(teamId);
    } else {
        statsData.expandedTeams.add(teamId);
    }
    renderStatsTab();
}

// Wire all control functions to window for inline onclick handlers
window.setStatsView = setStatsView;
window.setStatsLevel = setStatsLevel;
window.setStatsMainTab = setStatsMainTab;
window.setStatsSubtab = setStatsSubtab;
window.setStatsPage = setStatsPage;
window.changeStatsPage = changeStatsPage;
window.sortStats = sortStats;
window.toggleStatsTeam = toggleStatsTeam;
