/**
 * home-vnext.js — Lean jump-off cockpit (v4)
 *
 * Home is a JUMP-OFF page — every card is a place to go, not content to read.
 *
 * Sections rendered (top → bottom):
 *  1. Welcome strip   — compact: greeting + 3DA/MPR glance + ⚔ badge → Profile
 *  2. Up Next (HERO)  — next league match card with YOUR team context baked in,
 *                       or playoff tracker. League launchpad.
 *  3. What's Happening — messages half (→ Clubhouse) + Play Now half (→ Arena).
 *                        Play Now is ALWAYS rendered (inviting empty state when 0 online).
 *  4. What's Next     — events/leagues I'm registered for → Events launchpad.
 *
 * REMOVED from Home (moved to player-profile-vnext):
 *  - Standalone Your Team card (team context now lives on the Up Next match card)
 *  - Recent result card
 *
 * Data reused from existing loaders:
 *  - fetchTriplesDataSnapshot()  → teams, matches, leaguePlayers, statsById
 *  - fetchPlayoffDoc()           → leagues/{id}/playoffs/current (same as triples-vnext)
 *  - getPlayerChallenges CF      → same query Arena uses
 *  - getConversations CF         → same CF as messages-vnext.js
 *  - presence collection         → same Firestore read as arena-vnext.js
 *  - loadEvents()                → tournaments collection (for registrations)
 */

import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    collection,
    getDocs,
    doc,
    getDoc,
    onSnapshot,
    onAuthStateChanged,
    query,
    orderBy,
    limit,
    where
} from '/js/firebase-config.js';

const TRIPLES_LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRIPLES_CACHE_KEY = `brdc:vnext:home:triples:${TRIPLES_LEAGUE_ID}:v3`;
const TRIPLES_CACHE_TTL_MS = 5 * 60 * 1000;
// Persistent identity cache (localStorage) — shown instantly on every open while
// the fresh (cold-start-prone) calls resolve in the background. Stale-while-revalidate.
const IDENTITY_CACHE_KEY = 'brdc:vnext:home:identity:v1';
// Persistent snapshot cache (localStorage) so the Up Next card + league context
// render fast on a fresh open instead of waiting for a cold full-league fetch.
const SNAPSHOT_LOCAL_KEY = `brdc:vnext:home:snapshot:${TRIPLES_LEAGUE_ID}:v1`;
const COMPACT_TEAM_NAMES = new Map([
    ['cleveland pagel co', 'Cle Pagel Co.'],
    ['cleveland pagel co.', 'Cle Pagel Co.'],
    ['cle pagel co', 'Cle Pagel Co.'],
    ['cle pagel co.', 'Cle Pagel Co.'],
    ['neon nightmares', 'Neon Nightmrs'],
    ['neon nightmare', 'Neon Nightmrs']
]);

// ─── Element refs ──────────────────────────────────────────────────
const els = {
    welcomeTitle:   document.getElementById('welcomeTitle'),
    // authStatus hidden input on v4 (strip has no status text)
    authStatus:     document.getElementById('authStatus'),
    playerAvatar:   document.getElementById('playerAvatar'),
    identity3da:    document.getElementById('identity3da'),
    identityMpr:    document.getElementById('identityMpr'),
    // bar inputs now hidden; kept to avoid null refs in renderIdentity
    identity3daBar: document.getElementById('identity3daBar'),
    identityMprBar: document.getElementById('identityMpr_bar'),
    identityWL:     document.getElementById('identityWL'),
    identityRank:   document.getElementById('identityRank'),
    wlStatBlock:    document.getElementById('wlStatBlock'),
    rankStatBlock:  document.getElementById('rankStatBlock'),
    quickProfileLink: document.getElementById('quickProfileLink'),
    challengeBadgeWrap: document.getElementById('challengeBadgeWrap'),
    challengeBadgeCount: document.getElementById('challengeBadgeCount'),
    upNextHero:       document.getElementById('upNextHero'),
    // snapshotCard removed; kept as null-safe ref
    snapshotCard:     document.getElementById('snapshotCard'),
    // teamCard / recentCard removed from Home (moved to Profile)
    teamCard:         null,
    recentCard:       null,
    nudgeSection:     document.getElementById('nudgeSection'),
    registrationsCard: document.getElementById('registrationsCard'),
    welcomeStrip:     document.getElementById('welcomeStrip'),
    liveNowBanner:    document.getElementById('liveNowBanner')
};

let currentPlayer = null;
let currentLeagueContext = {
    id: TRIPLES_LEAGUE_ID,
    name: '2026 Triples League',
    teamId: null
};

// ─── Cache helpers ─────────────────────────────────────────────────
function readCache(key, ttlMs) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) return null;
        return parsed.data || null;
    } catch {
        return null;
    }
}

function writeCache(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
        // optimization only
    }
}

// Persistent (cross-session) cache for instant optimistic render.
function readLocalCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw)?.data ?? null;   // stale-while-revalidate: no TTL gate
    } catch {
        return null;
    }
}

function writeLocalCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
        // optimization only
    }
}

// ─── Signed-out cache hygiene ──────────────────────────────────────
// RULE: once Firebase auth DEFINITIVELY reports signed-out (onAuthStateChanged
// fires with null — the SDK only fires after persistence is resolved, and this
// app uses popup sign-in so there is no pending redirect), Home must NOT keep
// rendering a cached identity. The optimistic render (IDENTITY_CACHE_KEY) is
// deliberately untouched on startup — we only react INSIDE auth callbacks, so
// the instant optimistic paint for returning signed-in users is preserved.
function clearSignedOutIdentityCaches() {
    try {
        localStorage.removeItem(IDENTITY_CACHE_KEY);
        localStorage.removeItem(SNAPSHOT_LOCAL_KEY);
        sessionStorage.removeItem(TRIPLES_CACHE_KEY);
        // Shared legacy session identity. Same key dashboard-auth clears on
        // signed-out; without this the nav header keeps showing a stale user.
        localStorage.removeItem('brdc_session');
        sessionStorage.removeItem('currentPlayer');
    } catch { /* storage unavailable — purge is best-effort */ }
}

/** Swap every identity surface to its signed-out state + purge stale caches. */
function applySignedOutState() {
    currentPlayer = null;
    window.__homeVnextIdentityStats = {};
    window.__homeBundleChallenges = null;
    clearSignedOutIdentityCaches();
    renderIdentity(null, {});
    renderChallengeBadge(0);
    if (els.identityWL) {
        els.identityWL.textContent = '';
        if (els.identityWL.style) els.identityWL.style.display = 'none';
    }
    renderUpNext('', true); // snapshot/Up Next card → signed-out state
    // Ask the shared nav (if present) to drop its cached player. Guarded —
    // purely cosmetic for the current view; storage is already clean.
    try {
        if (window.brdcNav) {
            window.brdcNav.player = null;
            if (typeof window.brdcNav._build === 'function') window.brdcNav._build();
        }
    } catch { /* nav refresh is best-effort */ }
}

/**
 * Watch auth for a definitive signed-out signal. Every onAuthStateChanged
 * callback is definitive (the first one only fires once persistence has been
 * read), so reacting to `null` here can never flash signed-out during normal
 * load, and also catches mid-session sign-outs (other tab, token revoked).
 */
function watchAuthForSignOut() {
    try {
        onAuthStateChanged(auth, (user) => {
            if (!user) applySignedOutState();
        });
    } catch { /* main init's waitForAuthReady path still applies */ }
}

// ─── Utility helpers ───────────────────────────────────────────────
function notifyUser(message, type = 'info') {
    const toastName = type === 'error' ? 'toastError' : type === 'success' ? 'toastSuccess' : 'toastInfo';
    if (typeof window[toastName] === 'function') { window[toastName](message); return; }
    console[type === 'error' ? 'error' : 'log'](`[Home] ${message}`);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
    if (!date) return 'Date TBD';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortDate(date) {
    if (!date) return 'TBD';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function daysUntil(date) {
    if (!date) return null;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const target = new Date(date); target.setHours(0, 0, 0, 0);
    return Math.round((target - start) / MS_PER_DAY);
}

function soonLabel(date) {
    const days = daysUntil(date);
    if (days === null) return { text: 'Upcoming', cls: '' };
    if (days === 0) return { text: 'Tonight', cls: 'now' };
    if (days === 1) return { text: 'Tomorrow', cls: 'soon' };
    if (days > 1 && days <= 3) return { text: `${days} days`, cls: 'soon' };
    return { text: formatDate(date), cls: '' };
}

function isFutureOrToday(date) {
    const days = daysUntil(date);
    return days == null || days >= 0;
}

function finiteStat(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function formatStat(value, decimals = 1) {
    const num = finiteStat(value);
    return num == null ? '-' : num.toFixed(decimals);
}

function getInitials(name) {
    return String(name || 'BRDC').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'B';
}

function getTeamName(team) {
    return team?.team_name || team?.name || 'Team';
}

function compactTeamName(value) {
    const name = typeof value === 'string' ? value : getTeamName(value);
    const normalized = normalizeLookupName(name);
    if (COMPACT_TEAM_NAMES.has(normalized)) return COMPACT_TEAM_NAMES.get(normalized);
    if (name.length <= 14) return name;
    return name.replace(/\bCleveland\b/i, 'Cle').replace(/\bCompany\b/i, 'Co.').replace(/\bNightmares\b/i, 'Nightmrs').replace(/\s+/g, ' ').trim();
}

function normalizeLookupName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function statBarPercent(value, max) {
    const num = finiteStat(value);
    if (num == null) return '0%';
    return `${Math.max(4, Math.min(100, Math.round((num / max) * 100)))}%`;
}

function playerLevel(player) {
    const raw = String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
    return ['A', 'B', 'C'].includes(raw) ? raw : '';
}

function getMatchDate(match) {
    return asDate(match.date || match.match_date || match.scheduled_date || match.scheduled_at);
}

function getTeamRecordText(team) {
    if (!team) return '-';
    const wins = Number(team.wins ?? team.record?.wins ?? 0);
    const losses = Number(team.losses ?? team.record?.losses ?? 0);
    return `${wins}-${losses}`;
}

function getTeamRankMap(teams) {
    return Object.fromEntries([...teams]
        .sort((a, b) => {
            const aw = Number(a.wins ?? 0), bw = Number(b.wins ?? 0);
            const ap = Number(a.points ?? a.games_won ?? 0), bp = Number(b.points ?? b.games_won ?? 0);
            if (bw !== aw) return bw - aw;
            if (bp !== ap) return bp - ap;
            return Number(a.losses ?? 0) - Number(b.losses ?? 0);
        })
        .map((team, i) => [team.id, i + 1]));
}

function findLeaguePlayerForCurrentUser(leaguePlayers = []) {
    if (!currentPlayer) return null;
    const currentEmail = String(auth.currentUser?.email || currentPlayer?.email || '').toLowerCase();
    const currentName = normalizeLookupName(currentPlayer?.name || currentPlayer?.display_name || '');
    return leaguePlayers.find(p => {
        if (p.id === currentPlayer.id) return true;
        if (currentPlayer.global_player_id && p.global_player_id === currentPlayer.global_player_id) return true;
        if (currentEmail && String(p.email || '').toLowerCase() === currentEmail) return true;
        if (currentName && normalizeLookupName(p.name || p.display_name) === currentName) return true;
        return false;
    }) || null;
}

function getPlayerTeamIds(player, leaguePlayers) {
    const ids = new Set();
    const currentEmail = String(auth.currentUser?.email || player?.email || '').toLowerCase();
    const currentName = normalizeLookupName(player?.name || player?.display_name || '');
    leaguePlayers.filter(p => {
        if (p.id === player?.id) return true;
        if (currentEmail && String(p.email || '').toLowerCase() === currentEmail) return true;
        if (currentName && normalizeLookupName(p.name || p.display_name) === currentName) return true;
        return false;
    }).forEach(p => { if (p?.team_id) ids.add(p.team_id); });
    (player?.roles || []).forEach(r => { if (r.team_id) ids.add(r.team_id); });
    (player?.leagues || []).forEach(r => { if (r.team_id) ids.add(r.team_id); });
    (player?.involvements?.leagues || []).forEach(r => { if (r.team_id) ids.add(r.team_id); });
    return ids;
}

function mergeIdentityStats(primary = {}, leaguePlayer = null, leagueStats = null) {
    const first = (...vals) => vals.find(v => finiteStat(v) != null);
    return {
        ...primary,
        x01_three_dart_avg: first(
            primary.x01_three_dart_avg, primary.three_dart_avg, primary.avg_3da,
            leagueStats?.x01_three_dart_avg, leagueStats?.three_dart_avg, leagueStats?.avg_3da,
            leaguePlayer?.x01_three_dart_avg, leaguePlayer?.three_dart_avg, leaguePlayer?.avg_3da,
            leaguePlayer?.stats?.x01_three_dart_avg, leaguePlayer?.unified_stats?.x01_three_dart_avg
        ),
        cricket_mpr: first(
            primary.cricket_mpr, primary.mpr,
            leagueStats?.cricket_mpr, leagueStats?.mpr,
            leaguePlayer?.cricket_mpr, leaguePlayer?.mpr,
            leaguePlayer?.stats?.cricket_mpr, leaguePlayer?.unified_stats?.cricket_mpr
        )
    };
}

// ─── Playoff helpers (same logic as triples-vnext.js) ─────────────
function isPlayoffMatch(match) {
    return match?.season_phase === 'playoffs' ||
        match?.match_type === 'playoff' ||
        Boolean(match?.playoff_round || match?.playoff_match_key || match?.playoff_bracket_id);
}

/**
 * Determine if the league is currently in playoff mode.
 * Returns true if: playoff doc exists with seeds/rounds, OR any match is a playoff match.
 */
function leagueIsInPlayoffs(snapshot, playoffDoc) {
    if (playoffDoc) {
        const seeds = Array.isArray(playoffDoc.seeds) ? playoffDoc.seeds : [];
        const rounds = Array.isArray(playoffDoc.rounds) ? playoffDoc.rounds : [];
        if (seeds.length > 0 || rounds.length > 0) return true;
    }
    if (snapshot) {
        return (snapshot.matches || []).some(isPlayoffMatch);
    }
    return false;
}

/** Find this player's team seed entry in the playoff doc */
function findMyPlayoffSeed(playoffDoc, myTeamIds) {
    if (!playoffDoc || !myTeamIds.size) return null;
    const seeds = Array.isArray(playoffDoc.seeds) ? playoffDoc.seeds : [];
    return seeds.find(s => myTeamIds.has(s.team_id)) || null;
}

/** Find my team's next unplayed playoff match */
function findMyNextPlayoffMatch(snapshot, myTeamIds) {
    if (!snapshot || !myTeamIds.size) return null;
    const now = Date.now();
    return (snapshot.matches || [])
        .filter(isPlayoffMatch)
        .filter(m => !['completed', 'cancelled'].includes(m.status))
        .filter(m => myTeamIds.has(m.home_team_id) || myTeamIds.has(m.away_team_id))
        .map(m => ({ ...m, dateObj: getMatchDate(m) }))
        .filter(m => !m.dateObj || m.dateObj.getTime() > now - 3 * MS_PER_DAY)
        .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0))[0] || null;
}

/** Determine if my team is eliminated from playoffs */
function isTeamEliminated(playoffDoc, myTeamIds, snapshot) {
    if (!myTeamIds.size) return false;
    // If there's a seed entry for my team and no remaining matches, check if eliminated
    // Playoff match lost by my team = eliminated (unless there's a 3rd place match)
    const playoffMatches = (snapshot?.matches || []).filter(isPlayoffMatch);
    const completedLosses = playoffMatches.filter(m => {
        const isMyMatch = myTeamIds.has(m.home_team_id) || myTeamIds.has(m.away_team_id);
        if (!isMyMatch || m.status !== 'completed') return false;
        const mySide = myTeamIds.has(m.home_team_id) ? 'home' : 'away';
        const myScore = Number(m[`${mySide}_score`] ?? 0);
        const oppScore = Number(m[mySide === 'home' ? 'away_score' : 'home_score'] ?? 0);
        return myScore < oppScore; // I lost this playoff match
    });
    // Also check: no remaining playoff matches involving my team
    const hasRemainingMatches = playoffMatches.some(
        m => !['completed', 'cancelled'].includes(m.status) &&
             (myTeamIds.has(m.home_team_id) || myTeamIds.has(m.away_team_id))
    );
    return completedLosses.length > 0 && !hasRemainingMatches;
}

// ─── 1. Up Next hero renderers ─────────────────────────────────────

/**
 * Build the DARK match-night card for a scheduled league match.
 * Uses the rich .hv-mn-* layout with teams/records/ranks/CTA.
 */
function buildDarkMatchCard(matchItem, isScorableNow) {
    const label = soonLabel(matchItem.date);
    const myTeamName = compactTeamName(
        matchItem.mySide === 'home' ? matchItem.homeTeamName : matchItem.awayTeamName
    );
    const opponentName = compactTeamName(
        matchItem.mySide === 'home' ? matchItem.awayTeamName : matchItem.homeTeamName
    );
    const myRecord = matchItem.mySide === 'home' ? matchItem.homeRecord : matchItem.awayRecord;
    const oppRecord = matchItem.mySide === 'home' ? matchItem.awayRecord : matchItem.homeRecord;
    const myRank = matchItem.mySide === 'home' ? matchItem.homeRank : matchItem.awayRank;
    const oppRank = matchItem.mySide === 'home' ? matchItem.awayRank : matchItem.homeRank;

    const ctaHref = escapeHtml(matchItem.href || `/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${matchItem.matchId}`);
    const ctaLabel = isScorableNow ? 'Score Match' : 'View Match';
    const kindLabel = isScorableNow ? 'Match Night' : `League Match · ${escapeHtml(label.text)}`;
    const detailLabel = matchItem.detail || '2026 Triples League';

    const dateStr = matchItem.date ? escapeHtml(formatDate(matchItem.date)) : 'Date TBD';

    const myRankHtml = myRank ? `<span class="hv-mn-rank">#${myRank}</span>` : '';
    const oppRankHtml = oppRank ? `<span class="hv-mn-rank">#${oppRank}</span>` : '';

    return `
        <div class="hv-upnext-match-night${isScorableNow ? ' scorable' : ''}">
            <div class="hv-mn-kicker">
                <span class="hv-mn-kind">${escapeHtml(kindLabel)}</span>
                <span class="hv-mn-date">${isScorableNow ? 'Tonight' : dateStr}</span>
            </div>
            <div class="hv-mn-matchup">
                <div class="hv-mn-side mine">
                    <strong>${escapeHtml(myTeamName)}</strong>
                    <div class="hv-mn-badges">
                        ${myRankHtml}
                        <span class="hv-mn-record">${escapeHtml(myRecord)}</span>
                    </div>
                </div>
                <div class="hv-mn-vs">
                    <span>VS</span>
                </div>
                <div class="hv-mn-side opp">
                    <strong>${escapeHtml(opponentName)}</strong>
                    <div class="hv-mn-badges">
                        ${oppRankHtml}
                        <span class="hv-mn-record">${escapeHtml(oppRecord)}</span>
                    </div>
                </div>
            </div>
            <div class="hv-mn-meta">${escapeHtml(detailLabel)}</div>
            <div class="hv-mn-actions">
                <a href="${ctaHref}" class="hv-mn-cta${isScorableNow ? ' score' : ''}">${ctaLabel}</a>
                <a href="/pages/triples-vnext.html" class="hv-mn-secondary">Full Schedule</a>
            </div>
        </div>
    `;
}

/** Get round label string from a playoff match */
function playoffMatchRoundLabel(match) {
    const key = String(
        match?.playoff_match_label || match?.playoff_round || match?.playoff_match_key || ''
    ).trim().toLowerCase();
    if (!key) {
        if (match?.playoff_round_number) return `Round ${match.playoff_round_number}`;
        return '';
    }
    if (key.includes('championship') || (key.includes('final') && !key.includes('semi') && !key.includes('quarter'))) return 'Championship';
    if (key.includes('third') || key.includes('3rd') || key.includes('3rd place') || key.includes('place')) return '3rd Place';
    if (key.includes('semi')) return 'Semifinals';
    if (key.includes('quarter')) return 'Quarterfinals';
    return String(match?.playoff_match_label || match?.playoff_round || match?.playoff_match_key || '').trim();
}

/**
 * Find remaining/upcoming playoff matches across the bracket (not filtered by team).
 * Returns up to `maxCount` matches sorted by date, preferring upcoming over past.
 */
function findRemainingBracketMatches(snapshot, maxCount = 3) {
    const now = Date.now();
    return (snapshot?.matches || [])
        .filter(isPlayoffMatch)
        .filter(m => !['completed', 'cancelled'].includes(m.status))
        .map(m => ({ ...m, dateObj: getMatchDate(m) }))
        .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0))
        .slice(0, maxCount);
}

/**
 * Build rows of upcoming bracket matches (used in the "eliminated / awaiting" state).
 * Each row shows: round · Home vs Away · Date + View link
 */
function buildBracketMatchRows(remainingMatches, teamsById) {
    if (!remainingMatches.length) return '';
    return remainingMatches.map(m => {
        const homeTeam = teamsById[m.home_team_id];
        const awayTeam = teamsById[m.away_team_id];
        const homeName = compactTeamName(homeTeam || m.home_team_name || 'TBD');
        const awayName = compactTeamName(awayTeam || m.away_team_name || 'TBD');
        const matchDate = m.dateObj || getMatchDate(m);
        const dateStr = matchDate ? shortDate(matchDate) : 'Date TBD';
        const roundLabel = playoffMatchRoundLabel(m);
        const ctaHref = escapeHtml(`/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${m.id}`);
        const statusChip = m.status === 'in_progress'
            ? `<span class="hv-playoff-row-live">Live</span>`
            : '';
        return `
            <a class="hv-playoff-bracket-row" href="${ctaHref}">
                ${roundLabel ? `<span class="hv-playoff-row-round">${escapeHtml(roundLabel)}</span>` : ''}
                <span class="hv-playoff-row-teams">${escapeHtml(homeName)} <em>vs</em> ${escapeHtml(awayName)}</span>
                <span class="hv-playoff-row-date">${escapeHtml(dateStr)} ${statusChip}</span>
                <span class="hv-playoff-row-view">View →</span>
            </a>
        `;
    }).join('');
}

/**
 * Build the playoff tracker card.
 * State 1: My team has an upcoming/in-progress playoff match → dark scorable match-night card
 * State 2: My team is eliminated OR has no upcoming match but playoffs are ongoing →
 *          show small status chip + REAL remaining bracket matches (max 3)
 * State 3: No playoff match data at all → graceful "view bracket" fallback
 */
function buildPlayoffTrackerCard(myTeamIds, snapshot, playoffDoc, teamsById) {
    const eliminated = isTeamEliminated(playoffDoc, myTeamIds, snapshot);
    const nextMatch = eliminated ? null : findMyNextPlayoffMatch(snapshot, myTeamIds);
    const mySeed = findMyPlayoffSeed(playoffDoc, myTeamIds);
    const seedText = mySeed?.seed ? `#${mySeed.seed} seed` : '';

    // ── State 1: My team has a playoff match coming up (or live now) ──────────
    if (nextMatch) {
        const mySide = myTeamIds.has(nextMatch.home_team_id) ? 'home' : 'away';
        const oppTeamId = mySide === 'home' ? nextMatch.away_team_id : nextMatch.home_team_id;
        const myTeamId = mySide === 'home' ? nextMatch.home_team_id : nextMatch.away_team_id;
        const myTeamObj = teamsById[myTeamId];
        const oppTeamObj = teamsById[oppTeamId];
        const myName = compactTeamName(myTeamObj || (mySide === 'home' ? nextMatch.home_team_name : nextMatch.away_team_name) || 'Your Team');
        const oppName = compactTeamName(oppTeamObj || (mySide === 'home' ? nextMatch.away_team_name : nextMatch.home_team_name) || 'TBD');
        const matchDate = nextMatch.dateObj || getMatchDate(nextMatch);
        const dateStr = matchDate ? escapeHtml(formatDate(matchDate)) : 'Date TBD';
        const ctaHref = escapeHtml(`/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${nextMatch.id}`);
        const roundStr = escapeHtml(playoffMatchRoundLabel(nextMatch) || 'Playoff Match');
        const isScorableNow = (() => {
            if (!matchDate) return false;
            const diff = matchDate.getTime() - Date.now();
            return diff > -3 * MS_PER_DAY && diff <= MS_PER_DAY && ['scheduled', 'in_progress'].includes(nextMatch.status);
        })();

        return `
            <div class="hv-upnext-match-night playoff${isScorableNow ? ' scorable' : ''}">
                <div class="hv-mn-kicker">
                    <span class="hv-mn-kind">🏆 ${roundStr}</span>
                    <span class="hv-mn-date">${isScorableNow ? 'Tonight' : dateStr}</span>
                </div>
                <div class="hv-mn-matchup">
                    <div class="hv-mn-side mine">
                        <strong>${escapeHtml(myName)}</strong>
                        ${seedText ? `<div class="hv-mn-badges"><span class="hv-mn-seed">${escapeHtml(seedText)}</span></div>` : ''}
                    </div>
                    <div class="hv-mn-vs">
                        <span>VS</span>
                    </div>
                    <div class="hv-mn-side opp">
                        <strong>${escapeHtml(oppName)}</strong>
                    </div>
                </div>
                <div class="hv-mn-meta">2026 Triples League · Playoffs</div>
                <div class="hv-mn-actions">
                    <a href="/pages/triples-vnext.html?league_id=${TRIPLES_LEAGUE_ID}" class="hv-mn-secondary">View League</a>
                    <a href="${ctaHref}" class="hv-mn-cta${isScorableNow ? ' score' : ''}">${isScorableNow ? 'Score Match' : 'View Match'}</a>
                </div>
            </div>
        `;
    }

    // ── State 2: Eliminated or awaiting → show actual remaining bracket matches ─
    const remainingMatches = findRemainingBracketMatches(snapshot, 3);
    const bracketRows = buildBracketMatchRows(remainingMatches, teamsById);

    const myStatusChip = eliminated
        ? `<span class="hv-playoff-badge eliminated">Your team: out this round</span>`
        : (myTeamIds.size
            ? `<span class="hv-playoff-badge alive">${seedText ? `Your team: ${seedText}` : 'Your team: in playoffs'}</span>`
            : '');

    if (bracketRows) {
        // Have real match data to show
        return `
            <div class="hv-upnext-playoff bracket-view">
                <div class="hv-mn-kicker">
                    <span class="hv-mn-kind">🏆 Playoffs</span>
                    ${myStatusChip}
                </div>
                <div class="hv-playoff-bracket-list">
                    ${bracketRows}
                </div>
                <div class="hv-mn-actions">
                    <a href="/pages/triples-vnext.html?league_id=${TRIPLES_LEAGUE_ID}" class="hv-mn-secondary">View League</a>
                    <a href="/pages/triples-vnext.html#playoffs" class="hv-mn-cta">Full Bracket</a>
                </div>
            </div>
        `;
    }

    // ── State 3: No remaining match data found → graceful fallback ────────────
    return `
        <div class="hv-upnext-playoff alive">
            <div class="hv-mn-kicker">
                <span class="hv-mn-kind">🏆 Playoffs</span>
                ${myStatusChip || ''}
            </div>
            <div class="hv-playoff-msg">
                ${eliminated
                    ? 'The playoffs continue — follow the bracket to see who advances.'
                    : (seedText ? `Your team is the ${escapeHtml(seedText)}.` : 'Your team is in the playoffs.')
                      + ' Next matchup not yet scheduled — check the bracket for updates.'}
            </div>
            <div class="hv-mn-actions">
                <a href="/pages/triples-vnext.html?league_id=${TRIPLES_LEAGUE_ID}" class="hv-mn-secondary">View League</a>
                <a href="/pages/triples-vnext.html#playoffs" class="hv-mn-cta">Full Bracket</a>
            </div>
        </div>
    `;
}

/** Render the Up Next hero with the dark match-night card or playoff tracker */
function renderUpNext(matchHtml, isEmpty) {
    if (isEmpty) {
        renderUpNextEmpty();
        return;
    }
    els.upNextHero.innerHTML = `
        <div class="hv-upnext-wrap">
            ${matchHtml}
        </div>
    `;
}

function renderUpNextEmpty() {
    const signedIn = Boolean(auth.currentUser);
    els.upNextHero.innerHTML = `
        <div class="hv-upnext-empty-card">
            <div class="hv-card-label">Up Next</div>
            <div class="hv-upnext-empty-icon">🎯</div>
            <h2>You're all clear</h2>
            <p>${signedIn
                ? 'No matches scheduled right now. Check the league schedule or find a game in the Arena.'
                : 'Sign in to see your next match and personal stats.'}</p>
            <div class="hv-mn-actions">
                <a href="${signedIn ? '/pages/triples-vnext.html' : '/'}" class="hv-mn-cta">
                    ${signedIn ? 'League schedule' : 'Sign in'}
                </a>
                ${signedIn ? `<a href="/pages/arena-vnext.html" class="hv-mn-secondary">Find a game</a>` : ''}
            </div>
        </div>
    `;
}

async function handleUpNextChallengeAction(challengeId, action, btn) {
    if (!challengeId) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        if (action === 'accept' || action === 'decline') {
            const result = await callFunction('respondToChallenge', { challenge_id: challengeId, response: action });
            if (result?.success) {
                notifyUser(action === 'accept' ? 'Challenge accepted! Head to Arena to play.' : 'Challenge declined.', action === 'accept' ? 'success' : 'info');
                if (action === 'accept' && result.scorer_url) { window.location.href = result.scorer_url; return; }
                await loadChallengesForBadge();
            } else {
                notifyUser(result?.error || 'Action failed', 'error');
                btn.disabled = false; btn.textContent = prev;
            }
        } else if (action === 'cancel') {
            const result = await callFunction('cancelChallenge', { challenge_id: challengeId });
            if (result?.success) {
                notifyUser('Challenge cancelled.', 'info');
                await loadChallengesForBadge();
            } else {
                notifyUser(result?.error || 'Cancel failed', 'error');
                btn.disabled = false; btn.textContent = prev;
            }
        }
    } catch (err) {
        console.error('[Home] Challenge action error:', err);
        notifyUser('Something went wrong. Try again.', 'error');
        btn.disabled = false; btn.textContent = prev;
    }
}

// ─── 1. Welcome strip renderer ─────────────────────────────────────
function renderIdentity(player, stats = {}, teamRank = null, teamRecord = null) {
    const name = player?.name || player?.display_name || 'BRDC';
    const firstName = name.split(' ')[0] || 'Player';

    // Welcome title
    if (els.welcomeTitle) {
        els.welcomeTitle.textContent = auth.currentUser ? `Hey ${firstName}` : 'BRDC Clubhouse';
    }

    // Avatar
    if (els.playerAvatar) {
        if (player?.photo_url || player?.photo) {
            els.playerAvatar.style.backgroundImage = `url("${String(player.photo_url || player.photo).replace(/"/g, '%22')}")`;
            els.playerAvatar.textContent = '';
        } else {
            els.playerAvatar.style.backgroundImage = '';
            els.playerAvatar.textContent = getInitials(name);
        }
    }

    // Glance stats on the strip
    const threeDa = finiteStat(stats.x01_three_dart_avg ?? stats.three_dart_avg ?? stats.avg_3da ?? player?.x01_three_dart_avg);
    const mpr = finiteStat(stats.cricket_mpr ?? stats.mpr ?? player?.cricket_mpr);
    if (els.identity3da) els.identity3da.textContent = formatStat(threeDa, 1);
    if (els.identityMpr) els.identityMpr.textContent = formatStat(mpr, 2);

    // W-L glance (hidden until data loads)
    if (teamRecord && els.identityWL) {
        els.identityWL.textContent = teamRecord;
        els.identityWL.style.display = '';
    }

    // Snapshot Rank column
    const snapRank = document.getElementById('snapRank');
    if (snapRank) snapRank.textContent = (teamRank != null && teamRank !== '') ? `#${teamRank}` : '-';

    // Wire profile link on the strip itself
    const playerId = player?.id;
    if (playerId && els.welcomeStrip) {
        els.welcomeStrip.href = `/pages/player-profile-vnext.html?id=${playerId}`;
    }

    // Legacy hidden refs — no-ops but avoid null crashes
    if (els.identity3daBar && els.identity3daBar.style) els.identity3daBar.style.width = statBarPercent(threeDa, 70);
    if (els.identityMprBar && els.identityMprBar.style) els.identityMprBar.style.width = statBarPercent(mpr, 3.5);
}

/**
 * Update the challenge icon/badge on the welcome strip.
 * Shows ⚔ icon + count badge when pending/accepted challenges exist.
 * The whole strip links to Profile; tapping the badge area still goes to Arena
 * via the strip's href (set to profile) — badge is purely a counter signal.
 * Only visible when count > 0.
 */
function renderChallengeBadge(count) {
    const n = (count && count > 0) ? count : 0;

    // Snapshot "Challenges" stat column (primary surface on v5 Home)
    const snap = document.getElementById('snapChallenges');
    if (snap) snap.textContent = n > 99 ? '99+' : String(n);

    // Legacy badge element (if present) — kept null-safe
    if (els.challengeBadgeWrap && els.challengeBadgeWrap.style) {
        els.challengeBadgeWrap.style.display = n > 0 ? '' : 'none';
        if (els.challengeBadgeCount) {
            els.challengeBadgeCount.textContent = n > 9 ? '9+' : String(n);
        }
    }
}

/** Load challenges for the badge only (no Up Next rendering) */
async function loadChallengesForBadge() {
    if (!auth.currentUser) {
        renderChallengeBadge(0);
        return;
    }
    try {
        // Reuse challenges already fetched by getHomeBundle (avoids a separate call).
        const bundled = window.__homeBundleChallenges;
        const result = bundled
            ? { success: true, received: bundled.received || [], sent: bundled.sent || [] }
            : await callFunction('getPlayerChallenges', { filter: 'all' });
        if (result?.success) {
            const received = (result.received || []).filter(c => ['pending', 'accepted'].includes(c.status));
            const sent = (result.sent || []).filter(c => c.status === 'accepted');
            const count = received.length + sent.length;
            renderChallengeBadge(count);
            // Merge into persistent identity cache for instant badge next open
            const prev = readLocalCache(IDENTITY_CACHE_KEY);
            if (prev) writeLocalCache(IDENTITY_CACHE_KEY, { ...prev, challenges: count });
        } else {
            renderChallengeBadge(0);
        }
    } catch (err) {
        console.warn('[Home] Could not load challenges for badge:', err);
        renderChallengeBadge(0);
    }
}

// ─── 3. Team card renderer ─────────────────────────────────────────
// NOTE (v4): teamCard is no longer on Home; this function is preserved
// but is a no-op now because els.teamCard is null. Team info lives on Profile.
function renderTeamCard(myTeam, rankByTeamId, snapshot) {
    if (!els.teamCard) return; // v4: removed from Home, moved to Profile
    if (!myTeam) {
        els.teamCard.innerHTML = `
            <div class="hv-team-empty">
                <p class="hv-meta">No team found for your account in the current league.</p>
                <a href="/pages/triples-vnext.html" class="hv-link-action">Browse league</a>
            </div>
        `;
        return;
    }
    const rank = rankByTeamId[myTeam.id] || '-';
    const record = getTeamRecordText(myTeam);
    const isPlayoff = rank !== '-' && rank <= 6;

    // Next opponent
    const matches = snapshot?.matches || [];
    const now = Date.now();
    const nextMatch = [...matches]
        .map(m => ({ ...m, dateObj: getMatchDate(m) }))
        .filter(m => m.status !== 'completed' && m.dateObj && m.dateObj.getTime() > now - MS_PER_DAY)
        .filter(m => m.home_team_id === myTeam.id || m.away_team_id === myTeam.id)
        .sort((a, b) => a.dateObj - b.dateObj)[0] || null;

    let nextOppHtml = '';
    if (nextMatch) {
        const teamsById = Object.fromEntries((snapshot?.teams || []).map(t => [t.id, t]));
        const isHome = nextMatch.home_team_id === myTeam.id;
        const oppTeam = teamsById[isHome ? nextMatch.away_team_id : nextMatch.home_team_id];
        const oppName = oppTeam ? compactTeamName(oppTeam) : (isHome ? nextMatch.away_team_name : nextMatch.home_team_name) || 'TBD';
        const oppRank = oppTeam ? rankByTeamId[oppTeam.id] : null;
        const labelObj = soonLabel(nextMatch.dateObj);
        nextOppHtml = `
            <div class="hv-team-next">
                <span class="hv-kicker">Next opp</span>
                <strong>${escapeHtml(oppName)}</strong>
                ${oppRank ? `<span class="hv-rank-badge">#${oppRank}</span>` : ''}
                <span class="hv-pill ${escapeHtml(labelObj.cls)}">${escapeHtml(labelObj.text)}</span>
            </div>
        `;
    }

    els.teamCard.innerHTML = `
        <div class="hv-team-header">
            <div class="hv-team-name-block">
                <h2>${escapeHtml(getTeamName(myTeam))}</h2>
                <span class="hv-kicker">2026 Triples League</span>
            </div>
            <div class="hv-team-meta-block">
                <span class="hv-rank-badge large ${isPlayoff ? 'playoff' : ''}">#${rank}</span>
                <span class="hv-record-badge">${escapeHtml(record)}</span>
            </div>
        </div>
        ${nextOppHtml}
        <div class="hv-team-footer">
            <a href="/pages/triples-vnext.html" class="hv-link-action">League page &amp; standings</a>
        </div>
    `;
}

// ─── 4. Recent result renderer ─────────────────────────────────────
// NOTE (v4): recentCard is no longer on Home; this function is a no-op.
// Recent results moved to player-profile-vnext.
function renderRecentCard(lastMatch, myTeamIds, snapshot) {
    if (!els.recentCard) return; // v4: removed from Home, moved to Profile
    if (!lastMatch) {
        els.recentCard.innerHTML = `<p class="hv-meta">No completed matches yet this season.</p>`;
        return;
    }
    const teamsById = Object.fromEntries((snapshot?.teams || []).map(t => [t.id, t]));
    const mySide = myTeamIds.has(lastMatch.home_team_id) ? 'home'
                 : myTeamIds.has(lastMatch.away_team_id) ? 'away' : null;
    const homeScore = Number(lastMatch.home_score ?? 0);
    const awayScore = Number(lastMatch.away_score ?? 0);
    const myScore = mySide === 'home' ? homeScore : awayScore;
    const oppScore = mySide === 'home' ? awayScore : homeScore;
    const won = myScore > oppScore;
    const tied = myScore === oppScore;
    const resultLabel = tied ? 'TIE' : won ? 'WIN' : 'LOSS';
    const resultClass = tied ? 'tie' : won ? 'win' : 'loss';

    const myTeamId = mySide === 'home' ? lastMatch.home_team_id : lastMatch.away_team_id;
    const oppTeamId = mySide === 'home' ? lastMatch.away_team_id : lastMatch.home_team_id;
    const myTeam = teamsById[myTeamId];
    const oppTeam = teamsById[oppTeamId];
    const myTeamName = compactTeamName(myTeam || (mySide === 'home' ? lastMatch.home_team_name : lastMatch.away_team_name) || 'Your team');
    const oppTeamName = compactTeamName(oppTeam || (mySide === 'home' ? lastMatch.away_team_name : lastMatch.home_team_name) || 'Opponent');
    const matchDate = asDate(lastMatch.match_date || lastMatch.date);
    const weekLabel = lastMatch.week ? `Week ${lastMatch.week}` : '';

    els.recentCard.innerHTML = `
        <div class="hv-recent-header">
            <span class="hv-result-badge ${resultClass}">${resultLabel}</span>
            <span class="hv-recent-meta">${escapeHtml(weekLabel)}${weekLabel && matchDate ? ' · ' : ''}${matchDate ? escapeHtml(shortDate(matchDate)) : ''}</span>
        </div>
        <div class="hv-recent-score-row">
            <div class="hv-recent-team mine">
                <strong>${escapeHtml(myTeamName)}</strong>
                <span class="hv-score ${won ? 'winner' : ''}">${myScore}</span>
            </div>
            <span class="hv-recent-dash">–</span>
            <div class="hv-recent-team opp">
                <span class="hv-score ${!won && !tied ? 'winner' : ''}">${oppScore}</span>
                <strong>${escapeHtml(oppTeamName)}</strong>
            </div>
        </div>
        <div class="hv-recent-footer">
            <a href="/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${escapeHtml(lastMatch.id)}" class="hv-link-action">View match details</a>
        </div>
    `;
}

// ─── 5. Registrations / What's Next renderer ───────────────────────
function renderRegistrationsCard(events, registeredIds = new Set()) {
    const upcoming = events
        .filter(e => !['deleted', 'archived'].includes(String(e.status || '').toLowerCase()))
        .filter(e => isFutureOrToday(asDate(e.date || e.start_date || e.event_date || e.created_at)))
        .sort((a, b) => {
            const ad = asDate(a.date || a.start_date || a.event_date || a.created_at) || new Date(8640000000000000);
            const bd = asDate(b.date || b.start_date || b.event_date || b.created_at) || new Date(8640000000000000);
            return ad - bd;
        });

    const myEvents = upcoming.filter(e => registeredIds.has(e.id));
    const openToJoin = upcoming.filter(e => !registeredIds.has(e.id) && e.status === 'open').slice(0, 1);

    if (!myEvents.length && !openToJoin.length) {
        els.registrationsCard.innerHTML = `
            <div class="hv-card-label">What's Next</div>
            <p class="hv-meta">No upcoming events or leagues you're registered for.</p>
            <a href="/pages/events-vnext.html" class="hv-link-action">Browse events</a>
        `;
        return;
    }

    const eventHtml = (items, label) => items.map(e => {
        const eDate = asDate(e.date || e.start_date || e.event_date || e.created_at);
        const eLabel = soonLabel(eDate);
        const regCount = Number(e.registration_count ?? e.registered_count ?? e.current_players ?? 0);
        const cap = Number(e.capacity ?? e.max_players ?? e.max_teams ?? 0);
        return `
            <a class="hv-reg-item" href="/pages/tournament-view-vnext.html?tournament_id=${escapeHtml(e.id)}">
                ${label ? `<span class="hv-reg-label">${label}</span>` : ''}
                <div class="hv-reg-info">
                    <strong>${escapeHtml(e.name || e.title || 'Event')}</strong>
                    <span class="hv-meta">${eDate ? escapeHtml(formatDate(eDate)) : 'Date TBD'}</span>
                </div>
                <span class="hv-pill ${escapeHtml(eLabel.cls)}">${escapeHtml(eLabel.text)}</span>
                ${cap ? `<span class="hv-meta">${regCount}/${cap}</span>` : ''}
            </a>
        `;
    }).join('');

    els.registrationsCard.innerHTML = `
        <div class="hv-card-label">What's Next</div>
        ${myEvents.length ? `<div class="hv-reg-group">${eventHtml(myEvents, 'Registered')}</div>` : ''}
        ${openToJoin.length ? `<div class="hv-reg-group open">${eventHtml(openToJoin, 'Open to join')}</div>` : ''}
        <div class="hv-reg-footer">
            <a href="/pages/events-vnext.html" class="hv-link-action">All events</a>
        </div>
    `;
}

// ─── 3. What's Happening: Messages + Play Now ──────────────────────

/**
 * Render the What's Happening section into #nudgeSection.
 *
 * Messages half  — recent conversations → Clubhouse launchpad.
 *                  Hidden when no conversations.
 * Play Now half  — ALWAYS rendered (Arena launchpad).
 *                  Shows online players when present; shows an inviting
 *                  empty state ("Quiet right now — host a board →") when 0.
 *
 * Both can appear side-by-side or stacked.  The section itself is ALWAYS shown
 * because Play Now is unconditional.
 */
async function loadAndRenderNudge() {
    if (!els.nudgeSection) return;
    await waitForAuthReady();

    let conversations = [];
    let onlinePlayers = [];

    // Parallel: conversations (CF) + presence (Firestore)
    await Promise.allSettled([
        (async () => {
            if (!auth.currentUser) return;
            try {
                const result = await callFunction('getConversations', {});
                if (result?.success) {
                    conversations = (result.conversations || [])
                        .slice(0, 3)
                        .map(conv => {
                            const other = conv.other_participant || {};
                            return {
                                id: conv.id || conv.conversation_id,
                                recipientId: other.id || other.player_id || '',
                                name: other.name || 'Someone',
                                preview: conv.last_message?.text || 'No messages yet',
                                time: conv.updated_at || conv.last_message?.timestamp || null
                            };
                        });
                }
            } catch { /* graceful — messages half stays empty */ }
        })(),
        (async () => {
            try {
                const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
                const meUid = auth.currentUser?.uid;
                const presenceSnap = await getDocs(
                    query(collection(db, 'presence_heartbeats'), limit(50))
                );
                presenceSnap.forEach(d => {
                    if (meUid && d.id === meUid) return; // don't list yourself
                    const p = d.data();
                    const last = p.last_heartbeat?.toDate?.() || p.last_seen?.toDate?.() || new Date(0);
                    if (p.status === 'online' || last >= twoMinAgo) {
                        onlinePlayers.push({ id: d.id, name: p.name || p.display_name || p.player_name || '?' });
                    }
                });
            } catch { /* presence may not exist — empty state still renders */ }
        })()
    ]);

    const hasConvos = auth.currentUser && conversations.length > 0;
    const onlineCount = onlinePlayers.length;
    const hasOnline = onlineCount > 0;

    // ── Messages half (optional — only when signed in and convos exist) ──
    let convosHtml = '';
    if (hasConvos) {
        const rows = conversations.map(c => {
            const href = c.recipientId
                ? `/pages/messages-vnext.html?source=direct&conversation_id=${escapeHtml(c.id)}`
                : '/pages/messages-vnext.html';
            const timeStr = c.time ? formatNudgeTime(c.time) : '';
            const preview = String(c.preview || '');
            return `
                <a class="hv-nudge-convo" href="${escapeHtml(href)}">
                    <div class="hv-nudge-convo-avatar">${escapeHtml(getInitials(c.name))}</div>
                    <div class="hv-nudge-convo-body">
                        <strong>${escapeHtml(c.name)}</strong>
                        <span>${escapeHtml(preview.slice(0, 60))}${preview.length > 60 ? '…' : ''}</span>
                    </div>
                    ${timeStr ? `<div class="hv-nudge-convo-time">${escapeHtml(timeStr)}</div>` : ''}
                </a>
            `;
        }).join('');
        convosHtml = `
            <div class="hv-nudge-half messages">
                <div class="hv-nudge-half-label">Messages</div>
                <div class="hv-nudge-convo-list">${rows}</div>
                <a href="/pages/messages-vnext.html" class="hv-nudge-more">All messages →</a>
            </div>
        `;
    }

    // ── Play Now half (ALWAYS rendered — Arena launchpad) ───────────
    const myId = currentPlayer?.id || auth.currentUser?.uid;
    let playNowBody = '';
    if (hasOnline) {
        const others = onlinePlayers.filter(p => p.id !== myId).slice(0, 4);
        const avatarChips = others.slice(0, 3).map(p =>
            `<div class="hv-nudge-online-chip" title="${escapeHtml(p.name)}">${escapeHtml(getInitials(p.name))}</div>`
        ).join('');
        playNowBody = `
            <div class="hv-nudge-online-body">
                <div class="hv-nudge-online-avatars">${avatarChips}</div>
                <div class="hv-nudge-online-count">${onlineCount} around now</div>
            </div>
            <a href="/pages/arena-vnext.html" class="hv-nudge-more">Challenge someone →</a>
        `;
    } else {
        // Empty / quiet state — still a compelling CTA
        playNowBody = `
            <div class="hv-nudge-playnow-quiet">
                <span class="hv-nudge-playnow-icon">🎯</span>
                <span>Quiet right now</span>
            </div>
            <a href="/pages/arena-vnext.html" class="hv-nudge-more">Host a board &middot; throw a quick game →</a>
        `;
    }

    const playNowHtml = `
        <div class="hv-nudge-half playnow">
            <div class="hv-nudge-half-label">Play Now</div>
            ${playNowBody}
        </div>
    `;

    // Layout: side-by-side when messages also present, otherwise full-width Play Now
    const layoutClass = hasConvos ? 'hv-nudge-grid two' : 'hv-nudge-grid one';
    els.nudgeSection.innerHTML = `
        <div class="${layoutClass}">
            ${convosHtml}
            ${playNowHtml}
        </div>
    `;
    // Always show — Play Now is unconditional
    els.nudgeSection.style.display = '';
}

/** Format a Firestore Timestamp / epoch / Date for the nudge time column */
function formatNudgeTime(value) {
    let d;
    if (value?.toDate) d = value.toDate();
    else if (value?._seconds) d = new Date(value._seconds * 1000);
    else if (value?.seconds) d = new Date(value.seconds * 1000);
    else d = value instanceof Date ? value : new Date(value);
    if (!d || isNaN(d)) return '';
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60 * 1000) return 'just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Data fetchers ─────────────────────────────────────────────────
async function fetchTriplesDataSnapshot() {
    const [teamsSnap, matchesSnap, playersSnap, statsSnap, playoffDoc] = await Promise.all([
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'teams')),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'matches')),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'players')),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'stats')).catch(() => ({ docs: [] })),
        // Same pattern as triples-vnext.js: leagues/{id}/playoffs/current
        getDoc(doc(db, 'leagues', TRIPLES_LEAGUE_ID, 'playoffs', 'current')).catch(() => null)
    ]);
    return {
        teams: teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        matches: matchesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        leaguePlayers: playersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        statsById: Object.fromEntries(statsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }])),
        // playoff doc: same shape as state.playoff in triples-vnext.js
        playoffDoc: (playoffDoc?.exists?.() ? { id: playoffDoc.id, ...playoffDoc.data() } : null)
    };
}

/**
 * Build and render the Up Next section:
 *  - Playoff tracker if league is in playoffs
 *  - Dark match-night card if there's a scheduled match
 *  - Clean empty state otherwise
 * Challenges are NOT shown here — they live on the snapshot card badge.
 */
async function loadUpNext(snapshot = null) {
    const playoffDoc = snapshot?.playoffDoc || null;

    if (snapshot && currentPlayer) {
        const leaguePlayers = snapshot.leaguePlayers || [];
        const myTeamIds = getPlayerTeamIds(currentPlayer, leaguePlayers);
        const teams = snapshot.teams || [];
        const teamsById = Object.fromEntries(teams.map(t => [t.id, t]));
        const rankByTeamId = getTeamRankMap(teams);
        const now = Date.now();
        const THREE_DAYS = 3 * MS_PER_DAY;

        // ── Playoff tracker takes priority ──────────────────────────
        if (leagueIsInPlayoffs(snapshot, playoffDoc) && myTeamIds.size) {
            const html = buildPlayoffTrackerCard(myTeamIds, snapshot, playoffDoc, teamsById);
            renderUpNext(html, false);
            return;
        }

        // ── League match card ───────────────────────────────────────
        if (myTeamIds.size) {
            const myMatches = (snapshot.matches || [])
                .map(m => ({ ...m, dateObj: getMatchDate(m) }))
                .filter(m => !['completed', 'cancelled'].includes(m.status) && m.dateObj)
                .filter(m => myTeamIds.has(m.home_team_id) || myTeamIds.has(m.away_team_id))
                .filter(m => m.dateObj.getTime() > now - THREE_DAYS)
                .sort((a, b) => a.dateObj - b.dateObj);

            if (myMatches.length) {
                const m = myMatches[0];
                const mySide = myTeamIds.has(m.home_team_id) ? 'home' : 'away';
                const homeTeam = teamsById[m.home_team_id];
                const awayTeam = teamsById[m.away_team_id];
                const diff = m.dateObj.getTime() - now;
                const isScorableNow = diff > -THREE_DAYS && diff <= MS_PER_DAY && ['scheduled', 'in_progress'].includes(m.status);

                const matchItem = {
                    matchId: m.id,
                    mySide,
                    date: m.dateObj,
                    homeTeamName: m.home_team_name || getTeamName(homeTeam),
                    awayTeamName: m.away_team_name || getTeamName(awayTeam),
                    homeRecord: getTeamRecordText(homeTeam),
                    awayRecord: getTeamRecordText(awayTeam),
                    homeRank: rankByTeamId[m.home_team_id] || null,
                    awayRank: rankByTeamId[m.away_team_id] || null,
                    detail: `2026 Triples League · Week ${m.week || '?'}`,
                    href: `/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${m.id}`
                };

                const html = buildDarkMatchCard(matchItem, isScorableNow);
                renderUpNext(html, false);
                return;
            }
        }
    }

    // ── No match or not signed in ───────────────────────────────────
    renderUpNext('', true);
}

// Slim the snapshot for the localStorage cache: drop the multi-MB per-match
// throw-by-throw arrays and the full statsById map (stats come from the separate
// identity cache). Keeps what Up Next needs: teams, leaguePlayers, slim matches, playoff.
function slimSnapshotForLocal(s) {
    if (!s) return null;
    const slimMatch = (m) => {
        const { games, throws, home_lineup, away_lineup, sets, leg_data, ...rest } = m;
        return rest;
    };
    return {
        league: s.league || null,
        teams: s.teams || [],
        leaguePlayers: s.leaguePlayers || [],
        matches: (s.matches || []).map(slimMatch),
        playoffDoc: s.playoffDoc || null
    };
}

// Persist the cross-session snapshot only for signed-in users — a signed-out
// visitor must not re-seed the optimistic cache we just purged on sign-out.
function persistSnapshotLocal(fresh) {
    if (auth.currentUser) writeLocalCache(SNAPSHOT_LOCAL_KEY, slimSnapshotForLocal(fresh));
}

async function loadTriplesSnapshot() {
    // sessionStorage (fast, same-tab) → localStorage (survives fresh opens) → network.
    const cached = readCache(TRIPLES_CACHE_KEY, TRIPLES_CACHE_TTL_MS) || readLocalCache(SNAPSHOT_LOCAL_KEY);
    if (cached) {
        fetchTriplesDataSnapshot()
            .then(fresh => { writeCache(TRIPLES_CACHE_KEY, fresh); persistSnapshotLocal(fresh); })
            .catch(err => console.warn('[Home] Could not refresh Triples cache:', err));
        return cached;
    }
    const fresh = await fetchTriplesDataSnapshot();
    writeCache(TRIPLES_CACHE_KEY, fresh);
    persistSnapshotLocal(fresh);
    return fresh;
}

async function loadEvents() {
    try {
        const snap = await getDocs(collection(db, 'tournaments'));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn('[Home] Could not load events:', err);
        return [];
    }
}

// ─── Live stream banner ────────────────────────────────────────────
/**
 * Subscribe to live_streams/current. When live === true, reveal a "LIVE NOW"
 * banner linking to the watch page; otherwise keep it hidden. Additive + fully
 * guarded — any error/absence leaves the banner hidden (its default state).
 */
function subscribeLiveBanner() {
    const banner = els.liveNowBanner;
    if (!banner) return;

    const hide = () => { banner.style.display = 'none'; };

    try {
        onSnapshot(
            doc(db, 'live_streams', 'current'),
            (snap) => {
                try {
                    const data = (snap && snap.exists && snap.exists()) ? snap.data() : null;
                    if (data && data.live === true && data.watch_id) {
                        const watchId = String(data.watch_id);
                        const title = String(data.title || 'the stream');
                        banner.href = `/pages/watch-vnext.html?id=${encodeURIComponent(watchId)}`;
                        banner.innerHTML = `
                            <span class="hv-live-dot" aria-hidden="true"></span>
                            <span class="hv-live-label">LIVE NOW</span>
                            <span class="hv-live-title">Watch ${escapeHtml(title)}</span>
                            <span class="hv-live-go">Watch →</span>
                        `;
                        banner.style.display = '';
                    } else {
                        hide();
                    }
                } catch (err) {
                    console.warn('[Home] Live banner render failed:', err);
                    hide();
                }
            },
            (err) => {
                console.warn('[Home] Live banner subscription error:', err);
                hide();
            }
        );
    } catch (err) {
        console.warn('[Home] Could not subscribe to live stream:', err);
        hide();
    }
}

// ─── Main init ─────────────────────────────────────────────────────
async function initHomeVNext() {
    // ── Live stream banner: subscribe immediately (auth-independent) ──
    subscribeLiveBanner();

    // ── Definitive sign-out watcher (reacts only INSIDE auth callbacks,
    //    so the optimistic render below is never pre-empted on normal load) ──
    watchAuthForSignOut();

    // ⚡ Optimistic identity: show last-known stats INSTANTLY (≈0.6s) instead of
    // dashes for ~11s while auth resolves + cold functions warm up.
    const cachedIdentity = readLocalCache(IDENTITY_CACHE_KEY);
    if (cachedIdentity) {
        renderIdentity(
            cachedIdentity.player || null,
            cachedIdentity.stats || {},
            cachedIdentity.teamRank ?? null,
            cachedIdentity.teamRecord ?? null
        );
        if (typeof cachedIdentity.challenges === 'number') renderChallengeBadge(cachedIdentity.challenges);
    }

    // Optimistic snapshot while auth resolves
    const earlyCached = readCache(TRIPLES_CACHE_KEY, TRIPLES_CACHE_TTL_MS);
    if (earlyCached) {
        const teams = earlyCached.teams || [];
        const rankByTeamId = getTeamRankMap(teams);
        if (!cachedIdentity) renderIdentity(null, {});
        renderTeamCard(null, rankByTeamId, earlyCached);
    }

    await waitForAuthReady();

    // ── Auth + player session ──
    if (!auth.currentUser) {
        renderIdentity(null, {});
        renderChallengeBadge(0);
    } else {
        try {
            // ⚡ ONE batched round-trip (getHomeBundle = session + stats + challenges)
            // instead of 3 separate cold-startable calls. Falls back to the legacy
            // per-call path if the bundle isn't available / fails.
            let bundle = await callFunction('getHomeBundle', {}).catch(() => null);
            if (!bundle?.success || !bundle.player) {
                // token may have raced auth — one retry
                await new Promise(r => setTimeout(r, 600));
                bundle = await callFunction('getHomeBundle', {}).catch(() => null);
            }

            if (bundle?.success && bundle.player) {
                currentPlayer = bundle.player;
                window.__homeVnextIdentityStats = bundle.stats || {};
                window.__homeBundleChallenges = bundle.challenges || null;
                renderIdentity(currentPlayer, bundle.stats || {});
            } else {
                // ── Legacy fallback: 3 separate calls ──
                let session = await callFunction('getPlayerSession', {}).catch(() => null);
                if (!session?.player) {
                    await new Promise(r => setTimeout(r, 600));
                    session = await callFunction('getPlayerSession', {}).catch(() => null);
                }
                currentPlayer = session?.player || null;
                const statsResult = await callFunction('getPlayerStatsFiltered', {
                    player_id: currentPlayer?.id,
                    source: 'combined'
                }).catch(() => null);
                window.__homeVnextIdentityStats = statsResult?.stats || {};
                renderIdentity(currentPlayer, statsResult?.stats || {});
            }
        } catch (err) {
            console.warn('[Home] Could not load player session:', err);
            renderIdentity(null, {});
        }
    }

    // ── Triples snapshot (includes playoff doc) ──
    let snapshot = null;
    try {
        snapshot = await loadTriplesSnapshot();
    } catch (err) {
        console.warn('[Home] Could not load Triples snapshot:', err);
    }

    // ── Derive player context from snapshot ──
    let myTeamIds = new Set();
    let myTeam = null;
    let rankByTeamId = {};
    let identityStats = window.__homeVnextIdentityStats || {};

    if (snapshot && currentPlayer) {
        const leaguePlayers = snapshot.leaguePlayers || [];
        const leaguePlayer = findLeaguePlayerForCurrentUser(leaguePlayers);
        const statsById = snapshot.statsById || {};
        const leagueStats = leaguePlayer ? statsById[leaguePlayer.id] : null;

        if (leaguePlayer) {
            identityStats = mergeIdentityStats(identityStats, leaguePlayer, leagueStats);
        }

        myTeamIds = getPlayerTeamIds(currentPlayer, leaguePlayers);
        currentLeagueContext.teamId = [...myTeamIds][0] || null;

        const teams = snapshot.teams || [];
        rankByTeamId = getTeamRankMap(teams);
        myTeam = teams.find(t => myTeamIds.has(t.id)) || null;
    } else if (snapshot) {
        rankByTeamId = getTeamRankMap(snapshot.teams || []);
    }

    const teamRank = myTeam ? rankByTeamId[myTeam.id] : null;
    const teamRecord = myTeam ? getTeamRecordText(myTeam) : null;
    renderIdentity(currentPlayer, identityStats, teamRank, teamRecord);

    // Persist for instant optimistic render on the next open
    if (currentPlayer) {
        writeLocalCache(IDENTITY_CACHE_KEY, {
            player: { id: currentPlayer.id, name: currentPlayer.name || currentPlayer.display_name },
            stats: identityStats,
            teamRank: teamRank ?? null,
            teamRecord: teamRecord ?? null,
            challenges: (readLocalCache(IDENTITY_CACHE_KEY) || {}).challenges
        });
    }

    // ── Section 2: Up Next (match or playoff tracker; NO challenges) ──
    await loadUpNext(snapshot);

    // ── Challenge badge on welcome strip ──
    // Run in parallel with the rest; badge updates independently
    loadChallengesForBadge();

    // Team card + Recent card have moved to player-profile-vnext; nothing to render here.

    // ── Section 3: What's Happening (Messages + Play Now — always renders) ──
    loadAndRenderNudge().catch(err => {
        console.warn('[Home] Nudge/PlayNow section failed:', err);
        // Even on error, render a minimal Play Now so the Arena launchpad is always there
        if (els.nudgeSection) {
            els.nudgeSection.innerHTML = `
                <div class="hv-section-label">What's Happening</div>
                <div class="hv-nudge-grid one">
                    <div class="hv-nudge-half playnow">
                        <div class="hv-nudge-half-label">Play Now</div>
                        <div class="hv-nudge-playnow-quiet">
                            <span class="hv-nudge-playnow-icon">🎯</span>
                            <span>Head to the Arena to play</span>
                        </div>
                        <a href="/pages/arena-vnext.html" class="hv-nudge-more">Open Arena →</a>
                    </div>
                </div>
            `;
            els.nudgeSection.style.display = '';
        }
    });

    // ── Section 6: What's Next ──
    try {
        const events = await loadEvents();
        const registeredIds = new Set();
        renderRegistrationsCard(events, registeredIds);
    } catch (err) {
        console.warn('[Home] Could not load events for registrations:', err);
        els.registrationsCard.innerHTML = `<div class="hv-card-label">What's Next</div><p class="hv-meta">Events unavailable. <a href="/pages/events-vnext.html" class="hv-link-action">Browse events</a></p>`;
    }
}

initHomeVNext();
