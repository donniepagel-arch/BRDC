/**
 * Player Profile - Stats Module
 *
 * Handles:
 * - Loading and displaying player stats (501, Cricket)
 * - Stats source filtering (league/tournament/social/combined)
 * - Stats cards rendering
 */

import { callFunction, db, collection, getDocs } from '/js/firebase-config.js';

function toFiniteNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function pickFirstFinite(...values) {
    for (const value of values) {
        const num = toFiniteNumber(value);
        if (num != null) return num;
    }
    return null;
}

function normalizeProfileStats(stats = {}) {
    const x01TotalPoints = pickFirstFinite(
        stats.x01_total_points,
        stats.x01_points,
        stats.total_points
    ) || 0;
    const x01TotalDarts = pickFirstFinite(
        stats.x01_total_darts,
        stats.x01_darts,
        stats.total_darts
    ) || 0;
    const cricketTotalMarks = pickFirstFinite(
        stats.cricket_total_marks,
        stats.cricket_marks,
        stats.total_marks
    ) || 0;
    const cricketTotalRounds = pickFirstFinite(
        stats.cricket_total_rounds,
        stats.cricket_rounds
    );
    const cricketTotalDarts = pickFirstFinite(
        stats.cricket_total_darts,
        stats.cricket_darts,
        stats.total_darts
    );
    const normalizedCricketRounds = cricketTotalRounds != null
        ? cricketTotalRounds
        : (cricketTotalDarts != null ? cricketTotalDarts / 3 : 0);
    const normalizedCricketDarts = cricketTotalDarts != null
        ? cricketTotalDarts
        : normalizedCricketRounds * 3;
    const checkoutsHit = pickFirstFinite(
        stats.x01_checkouts,
        stats.x01_checkouts_hit
    ) || 0;
    const checkoutAttempts = pickFirstFinite(
        stats.x01_checkout_opps,
        stats.x01_checkout_attempts
    ) || 0;
    const checkoutTotals = pickFirstFinite(
        stats.x01_checkout_totals,
        stats.x01_total_checkout_points
    ) || 0;
    const avgCheckout = pickFirstFinite(
        stats.x01_avg_checkout,
        stats.x01_avg_finish,
        stats.avg_finish
    );
    const avg3da = pickFirstFinite(
        stats.x01_three_dart_avg,
        stats.x01_3da,
        stats.three_dart_avg,
        stats.ppd,
        stats.avg
    );
    const mpr = pickFirstFinite(
        stats.cricket_mpr,
        stats.mpr
    );
    const first9 = pickFirstFinite(
        stats.x01_first_9_avg,
        stats.x01_first9_avg,
        stats.first_9_avg
    );
    const bestLeg = pickFirstFinite(stats.x01_best_leg);
    const highScore = pickFirstFinite(stats.x01_high_score, stats.x01_high_turn);
    const highCheckout = pickFirstFinite(stats.x01_high_checkout);

    return {
        ...stats,
        x01_total_points: x01TotalPoints,
        x01_total_darts: x01TotalDarts,
        x01_legs_played: pickFirstFinite(stats.x01_legs_played, stats.legs_played) || 0,
        x01_legs_won: pickFirstFinite(stats.x01_legs_won, stats.legs_won) || 0,
        x01_first9_points: pickFirstFinite(stats.x01_first9_points, stats.first9_points) || 0,
        x01_first9_darts: pickFirstFinite(stats.x01_first9_darts, stats.first9_darts) || 0,
        x01_best_leg: bestLeg,
        x01_high_score: highScore,
        x01_high_checkout: highCheckout,
        x01_checkout_opps: checkoutAttempts,
        x01_checkouts: checkoutsHit,
        x01_checkout_totals: checkoutTotals,
        x01_tons_100: pickFirstFinite(stats.x01_tons_100, stats.x01_ton_00) || 0,
        x01_tons_120: pickFirstFinite(stats.x01_tons_120, stats.x01_ton_20) || 0,
        x01_tons_140: pickFirstFinite(stats.x01_tons_140, stats.x01_ton_40) || 0,
        x01_tons_160: pickFirstFinite(stats.x01_tons_160, stats.x01_ton_60) || 0,
        x01_tons_180: pickFirstFinite(stats.x01_tons_180, stats.x01_ton_80, stats.x01_ton_eighties) || 0,
        x01_one_seventy_ones: pickFirstFinite(stats.x01_one_seventy_ones) || 0,
        x01_ton_plus_checkouts: pickFirstFinite(stats.x01_ton_plus_checkouts) || 0,
        cricket_total_marks: cricketTotalMarks,
        cricket_total_rounds: normalizedCricketRounds,
        cricket_total_darts: normalizedCricketDarts,
        cricket_legs_played: pickFirstFinite(stats.cricket_legs_played) || 0,
        cricket_legs_won: pickFirstFinite(stats.cricket_legs_won) || 0,
        cricket_missed_darts: pickFirstFinite(stats.cricket_missed_darts) || 0,
        cricket_triple_bull_darts: pickFirstFinite(stats.cricket_triple_bull_darts) || 0,
        cricket_five_mark_rounds: pickFirstFinite(stats.cricket_five_mark_rounds, stats.cricket_5m_plus) || 0,
        cricket_six_mark_rounds: pickFirstFinite(stats.cricket_six_mark_rounds) || 0,
        cricket_seven_mark_rounds: pickFirstFinite(stats.cricket_seven_mark_rounds) || 0,
        cricket_eight_mark_rounds: pickFirstFinite(stats.cricket_eight_mark_rounds) || 0,
        cricket_nine_mark_rounds: pickFirstFinite(stats.cricket_nine_mark_rounds) || 0,
        cricket_three_bulls: pickFirstFinite(stats.cricket_three_bulls, stats.cricket_bulls) || 0,
        cricket_hat_tricks: pickFirstFinite(stats.cricket_hat_tricks) || 0,
        x01_three_dart_avg: avg3da != null ? avg3da : (x01TotalDarts > 0 ? (x01TotalPoints / x01TotalDarts) * 3 : null),
        cricket_mpr: mpr != null ? mpr : (normalizedCricketRounds > 0 ? cricketTotalMarks / normalizedCricketRounds : null),
        x01_first_9_avg: first9 != null
            ? first9
            : ((pickFirstFinite(stats.x01_first9_darts, stats.first9_darts) || 0) > 0
                ? ((pickFirstFinite(stats.x01_first9_points, stats.first9_points) || 0) / (pickFirstFinite(stats.x01_first9_darts, stats.first9_darts) || 1)) * 3
                : null),
        x01_avg_checkout: avgCheckout != null ? avgCheckout : (checkoutsHit > 0 ? checkoutTotals / checkoutsHit : null)
    };
}

// ===== STATS SOURCE TOGGLE =====

let currentStatsSource = 'combined';

window.switchStatsSource = async function(source) {
    const state = window.playerProfileState;
    if (!state) return;

    currentStatsSource = source;

    // Update button states
    document.querySelectorAll('.perf-subtab-btn[data-source]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === source);
    });

    // Reload stats with the selected source
    await loadStatsForSource(state, source);
};

window.switchStatsSubTab = function(subtab) {
    // Sync the dropdown select
    const sel = document.getElementById('statsSubTabSelect');
    if (sel) sel.value = subtab;

    // Show/hide sub-tab content panels
    const panels = {
        performance: document.getElementById('statsPerformanceTab'),
        awards: document.getElementById('statsAwardsTab'),
        leaders: document.getElementById('statsLeadersTab')
    };
    Object.entries(panels).forEach(([key, el]) => {
        if (el) el.classList.toggle('active', key === subtab);
    });
};

async function loadStatsForSource(state, source) {
    if (source === 'combined') {
        await loadStats(state);
        return;
    }

    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;

    try {
        // Call the API with source filter
        const result = await callFunction('getPlayerStatsFiltered', {
            player_id: playerId,
            source: source  // 'league', 'tournament', 'social', or 'combined'
        });

        if (result.success && result.stats) {
            displayStats(normalizeProfileStats(result.stats));
        } else {
            // If no filtered stats API exists, fall back to showing message
            if (source !== 'combined') {
                // Show "no stats" for specific sources if API doesn't exist yet
                resetStatsDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading stats for source:', error);
        // Fall back to regular loadStats for combined
        if (source === 'combined') {
            await loadStats(state);
        } else {
            resetStatsDisplay();
        }
    }
}

function resetStatsDisplay() {
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safeSet('stat501Avg', '-');
    safeSet('statMPR', '-');
    safeSet('statHighCO', '-');
    safeSet('x01LegsPlayed', '0');
    safeSet('x01LegsWon', '0');
    safeSet('x01WinPct', '0%');
    safeSet('x01First9', '-');
    safeSet('x01BestLeg', '-');
    safeSet('x01HighScore', '-');
    safeSet('x01COPct', '0%');
    safeSet('x01AvgCO', '-');
    safeSet('x01T80', '0');
    safeSet('x01171s', '0');
    safeSet('x01TonCOs', '0');
    safeSet('x01TonPlus', '0');
    safeSet('x01Ton', '0');
    safeSet('crkLegsPlayed', '0');
    safeSet('crkLegsWon', '0');
    safeSet('crkWinPct', '0%');
    safeSet('crkMarks', '0');
    safeSet('crkRounds', '0');
    safeSet('crkMissPct', '0%');
    safeSet('crkTBPct', '0%');
    safeSet('crk5Marks', '0');
    safeSet('crk6Marks', '0');
    safeSet('crk7Marks', '0');
    safeSet('crk8Marks', '0');
    safeSet('crk9Marks', '0');
    safeSet('crk3Bulls', '0');
    safeSet('crkHatTricks', '0');
}

function populateHeaderStats(s) {
    const avg = Number.isFinite(s.x01_three_dart_avg) ? s.x01_three_dart_avg.toFixed(1) : '-';
    const mpr = Number.isFinite(s.cricket_mpr) ? s.cricket_mpr.toFixed(2) : '-';

    const x01Played = s.x01_legs_played || 0;
    const x01Won = s.x01_legs_won || 0;
    const crkPlayed = s.cricket_legs_played || 0;
    const crkWon = s.cricket_legs_won || 0;
    const totalPlayed = x01Played + crkPlayed;
    const totalWon = x01Won + crkWon;
    const winPct = totalPlayed > 0 ? ((totalWon / totalPlayed) * 100).toFixed(0) + '%' : '-';

    const missPct = s.cricket_total_darts > 0
        ? ((s.cricket_missed_darts || 0) / s.cricket_total_darts * 100).toFixed(1) + '%'
        : '-';

    const el3da = document.getElementById('hstat3da');
    const elMpr = document.getElementById('hstatMpr');
    const elMiss = document.getElementById('hstatMiss');
    const elWin = document.getElementById('hstatWin');

    if (el3da) el3da.textContent = avg;
    if (elMpr) elMpr.textContent = mpr;
    if (elMiss) elMiss.textContent = missPct;
    if (elWin) elWin.textContent = winPct;

    // Show the bar
    const bar = document.getElementById('profileHeaderStats');
    if (bar && (avg !== '-' || mpr !== '-')) {
        bar.style.display = 'grid';
    }
}

function displayStats(s) {
    s = normalizeProfileStats(s);

    // Summary stats
    const avg = Number.isFinite(s.x01_three_dart_avg) ? s.x01_three_dart_avg.toFixed(1) : '-';
    const mpr = Number.isFinite(s.cricket_mpr) ? s.cricket_mpr.toFixed(2) : '-';

    document.getElementById('stat501Avg').textContent = avg;
    document.getElementById('statMPR').textContent = mpr;
    document.getElementById('statHighCO').textContent = s.x01_high_checkout || '-';

    // Detailed 501 stats
    document.getElementById('x01LegsPlayed').textContent = s.x01_legs_played || 0;
    document.getElementById('x01LegsWon').textContent = s.x01_legs_won || 0;
    const x01WinPct = s.x01_legs_played > 0 ? ((s.x01_legs_won / s.x01_legs_played) * 100).toFixed(1) : 0;
    document.getElementById('x01WinPct').textContent = x01WinPct + '%';

    // First 9 average
    const first9Avg = Number.isFinite(s.x01_first_9_avg) ? s.x01_first_9_avg.toFixed(1) : '-';
    document.getElementById('x01First9').textContent = first9Avg;

    // Best leg and high score
    document.getElementById('x01BestLeg').textContent = (s.x01_best_leg && s.x01_best_leg < 999) ? s.x01_best_leg + ' darts' : '-';
    document.getElementById('x01HighScore').textContent = s.x01_high_score || '-';

    // Checkout stats - support both old and new field names
    const checkoutAttempts = s.x01_checkout_opps || 0;
    const checkoutsHit = s.x01_checkouts || 0;
    const coPct = checkoutAttempts > 0 ? ((checkoutsHit / checkoutAttempts) * 100).toFixed(1) : 0;
    document.getElementById('x01COPct').textContent = coPct + '%';
    const avgCO = checkoutsHit > 0 && Number.isFinite(s.x01_avg_checkout) ? s.x01_avg_checkout.toFixed(1) : '-';
    document.getElementById('x01AvgCO').textContent = avgCO !== '-' ? avgCO : '-';

    // Ton breakdown (remaining fields after removing removed element IDs)
    document.getElementById('x01T80').textContent = s.x01_tons_180 || 0;
    document.getElementById('x01171s').textContent = s.x01_one_seventy_ones || 0;
    document.getElementById('x01TonCOs').textContent = s.x01_ton_plus_checkouts || 0;

    // Detailed Cricket stats
    document.getElementById('crkLegsPlayed').textContent = s.cricket_legs_played || 0;
    document.getElementById('crkLegsWon').textContent = s.cricket_legs_won || 0;
    const crkWinPct = s.cricket_legs_played > 0 ? ((s.cricket_legs_won / s.cricket_legs_played) * 100).toFixed(1) : 0;
    document.getElementById('crkWinPct').textContent = crkWinPct + '%';
    document.getElementById('crkMarks').textContent = s.cricket_total_marks || 0;
    document.getElementById('crkRounds').textContent = s.cricket_total_rounds || 0;

    // Miss % and T&B %
    const missPct = s.cricket_total_darts > 0 ? ((s.cricket_missed_darts || 0) / s.cricket_total_darts * 100).toFixed(1) : 0;
    document.getElementById('crkMissPct').textContent = missPct + '%';
    const tbPct = s.cricket_total_darts > 0 ? ((s.cricket_triple_bull_darts || 0) / s.cricket_total_darts * 100).toFixed(1) : 0;
    document.getElementById('crkTBPct').textContent = tbPct + '%';

    // High mark rounds
    document.getElementById('crk5Marks').textContent = s.cricket_five_mark_rounds || 0;
    document.getElementById('crk7Marks').textContent = s.cricket_seven_mark_rounds || 0;
    document.getElementById('crk8Marks').textContent = s.cricket_eight_mark_rounds || 0;
    document.getElementById('crk9Marks').textContent = s.cricket_nine_mark_rounds || 0;
    document.getElementById('crk3Bulls').textContent = s.cricket_three_bulls || 0;
    document.getElementById('crkHatTricks').textContent = s.cricket_hat_tricks || 0;

    // Populate header stats bar
    populateHeaderStats(s);

    // Update awards tab with new IDs
    const x01TonPlusEl = document.getElementById('x01TonPlus');
    const x01TonEl = document.getElementById('x01Ton');
    const crk6MarksEl = document.getElementById('crk6Marks');
    if (x01TonPlusEl) x01TonPlusEl.textContent = (s.x01_tons_140 || 0) + (s.x01_tons_160 || 0);
    if (x01TonEl) x01TonEl.textContent = s.x01_tons_100 || 0;
    if (crk6MarksEl) crk6MarksEl.textContent = s.cricket_six_mark_rounds || 0;
}

async function loadStats(state) {
    let s = null;
    const playerId = state.currentPlayer.player_id || state.currentPlayer.id;

    // First try to use stats from currentPlayer (already fetched)
    if (state.currentPlayer.stats) {
        const stats = state.currentPlayer.stats;
        // Convert unified_stats format to the expected format
        if (stats.totals) {
            s = normalizeProfileStats({
                x01_total_points: stats.totals.x01_total_points || stats.totals.x01_points || stats.totals.total_points || 0,
                x01_total_darts: stats.totals.x01_total_darts || stats.totals.x01_darts || stats.totals.total_darts || 0,
                x01_legs_played: stats.totals.x01_legs_played || stats.totals.legs_played || 0,
                x01_legs_won: stats.totals.x01_legs_won || stats.totals.legs_won || 0,
                x01_tons_180: stats.totals.x01_tons_180 || stats.totals.ton_eighties || stats.totals['180s'] || 0,
                x01_high_checkout: stats.totals.x01_high_checkout || stats.totals.high_checkout || 0,
                x01_first9_points: stats.totals.x01_first9_points || stats.totals.first9_points || 0,
                x01_first9_darts: stats.totals.x01_first9_darts || stats.totals.first9_darts || 0,
                cricket_total_marks: stats.totals.cricket_total_marks || stats.totals.cricket_marks || stats.totals.total_marks || 0,
                cricket_total_darts: stats.totals.cricket_total_darts || stats.totals.cricket_darts || stats.totals.total_darts || 0,
                cricket_legs_played: stats.totals.cricket_legs_played || 0,
                cricket_legs_won: stats.totals.cricket_legs_won || 0
            });
        } else if (stats.x01) {
            // Global player format
            s = normalizeProfileStats({
                x01_total_points: stats.x01.x01_total_points || stats.x01.x01_points || stats.x01.total_points || 0,
                x01_total_darts: stats.x01.x01_total_darts || stats.x01.x01_darts || stats.x01.total_darts || 0,
                x01_legs_played: stats.x01.legs_played || 0,
                x01_legs_won: stats.x01.legs_won || 0,
                x01_tons_180: stats.x01.x01_tons_180 || stats.x01.ton_eighties || 0,
                x01_high_checkout: stats.x01.x01_high_checkout || stats.x01.high_checkout || 0,
                cricket_total_marks: stats.cricket?.cricket_total_marks || stats.cricket?.cricket_marks || stats.cricket?.total_marks || 0,
                cricket_total_darts: stats.cricket?.cricket_total_darts || stats.cricket?.cricket_darts || stats.cricket?.total_darts || 0,
                cricket_legs_played: stats.cricket?.legs_played || 0,
                cricket_legs_won: stats.cricket?.legs_won || 0
            });
        }
    }

    // Try to get league stats - first from currentLeagueId, then from playerLeagues
    let leagueIdToUse = state.currentLeagueId;

    // If no currentLeagueId, use the first league from playerLeagues (populated by loadLeagues)
    if (!leagueIdToUse && state.playerLeagues && state.playerLeagues.length > 0) {
        leagueIdToUse = state.playerLeagues[0].league_id;
    }

    if (leagueIdToUse) {
        // First, try to find the player's league-specific ID from the team rosters
        let leaguePlayerId = playerId;
        const playerName = state.currentPlayer.name?.toLowerCase();
        const playerEmail = state.currentPlayer.email?.toLowerCase();

        try {
            // Search league players subcollection to find this player by name or email
            const playersSnapshot = await getDocs(collection(db, 'leagues', leagueIdToUse, 'players'));

            for (const playerDoc of playersSnapshot.docs) {
                const p = playerDoc.data();
                if (p.name?.toLowerCase() === playerName ||
                    p.email?.toLowerCase() === playerEmail ||
                    playerDoc.id === playerId) {
                    leaguePlayerId = playerDoc.id;
                    break;
                }
            }
        } catch (error) {
            console.error('Error searching league players:', error);
        }

        try {
            const result = await callFunction('getPlayerStats', {
                league_id: leagueIdToUse,
                player_id: leaguePlayerId
            });
            if (result.success && result.stats) {
                s = normalizeProfileStats(result.stats);
            }
        } catch (error) {
            console.error('Error fetching league stats:', error);
        }
    }

    // If still no stats, show dashes
    if (!s) {
        document.getElementById('stat501Avg').textContent = '-';
        document.getElementById('statMPR').textContent = '-';
        document.getElementById('statHighCO').textContent = '-';
        return;
    }

    try {
        // We have stats, display them
        displayStats(s);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ===== INITIALIZATION =====

function initProfileTab(state) {
    // Stats will be loaded on first tab activation
}

// ===== EXPORTS =====

export {
    initProfileTab,
    loadStats,
    loadStatsForSource,
    displayStats,
    resetStatsDisplay,
    populateHeaderStats
};
