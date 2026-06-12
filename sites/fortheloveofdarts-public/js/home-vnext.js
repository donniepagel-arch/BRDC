import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    orderBy,
    limit
} from '/js/firebase-config.js';

const TRIPLES_LEAGUE_ID = 'rookies-demo-2026-triples';
const DEMO_TOURNAMENT_ID = 'rookies-wing-it-wednesdays-2026-05-27';
const NEXT_WING_TOURNAMENT_ID = 'rookies-wing-it-wednesdays-2026-06-03';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRIPLES_CACHE_KEY = `brdc:vnext:home:triples:${TRIPLES_LEAGUE_ID}:v2`;
const HOME_PUBLIC_CACHE_KEY = 'home_vnext';
const TRIPLES_CACHE_TTL_MS = 5 * 60 * 1000;
const HOME_MODE = document.body?.dataset?.homeMode || '';
const IS_PUBLIC_ROOKIES_HOME = HOME_MODE === 'public' || window.location.pathname.replace(/\/+$/, '') === '/rookies';
const COMPACT_TEAM_NAMES = new Map([
    ['cleveland pagel co', 'Cle Pagel Co.'],
    ['cleveland pagel co.', 'Cle Pagel Co.'],
    ['cle pagel co', 'Cle Pagel Co.'],
    ['cle pagel co.', 'Cle Pagel Co.'],
    ['neon nightmares', 'Neon Nightmrs'],
    ['neon nightmare', 'Neon Nightmrs']
]);

const els = {
    welcomeTitle: document.getElementById('welcomeTitle'),
    authStatus: document.getElementById('authStatus'),
    playerAvatar: document.getElementById('playerAvatar'),
    identity3da: document.getElementById('identity3da'),
    identityMpr: document.getElementById('identityMpr'),
    identity3daBar: document.getElementById('identity3daBar'),
    identityMprBar: document.getElementById('identityMprBar'),
    quickProfileLink: document.getElementById('quickProfileLink'),
    quickSettingsLink: document.getElementById('quickSettingsLink'),
    captainToolsLink: document.getElementById('captainToolsLink'),
    leagueStatsProfileLink: document.getElementById('leagueStatsProfileLink'),
    matchNightCard: document.getElementById('matchNightCard'),
    recentChatList: document.getElementById('recentChatList'),
    scheduleList: document.getElementById('scheduleList'),
    leaguePlayerStats: document.getElementById('leaguePlayerStats'),
    onlineCount: document.getElementById('onlineCount'),
    challengeCount: document.getElementById('challengeCount'),
    onlinePlayers: document.getElementById('onlinePlayers'),
    leagueChatSnapshot: document.getElementById('leagueChatSnapshot'),
    triplesStandings: document.getElementById('triplesStandings'),
    activityFeed: document.getElementById('activityFeed'),
    happeningsLeagueList: document.getElementById('happeningsLeagueList'),
    eventList: document.getElementById('eventList'),
    publicEventBanner: document.getElementById('rookiesPublicEventBanner'),
    publicEventEyebrow: document.getElementById('publicEventEyebrow'),
    publicEventTitle: document.getElementById('publicEventTitle'),
    publicEventMeta: document.getElementById('publicEventMeta'),
    publicEventCta: document.getElementById('publicEventCta'),
    publicUpcomingTitle: document.getElementById('publicUpcomingTitle'),
    publicUpcomingMeta: document.getElementById('publicUpcomingMeta'),
    publicCurrentTitle: document.getElementById('publicCurrentTitle'),
    publicCurrentMeta: document.getElementById('publicCurrentMeta'),
    publicRecentTitle: document.getElementById('publicRecentTitle'),
    publicRecentMeta: document.getElementById('publicRecentMeta'),
    publicRecognitionList: document.getElementById('rookiesRecognitionList'),
    playerLoginModal: document.getElementById('rookiesPlayerLoginModal'),
    playerLoginForm: document.getElementById('rookiesPlayerLoginForm'),
    playerLoginEmail: document.getElementById('rookiesPlayerLoginEmail'),
    playerLoginPassword: document.getElementById('rookiesPlayerLoginPassword'),
    playerLoginError: document.getElementById('rookiesPlayerLoginError')
};

let currentPlayer = null;
let activeMatchNight = null;
let currentLeagueContext = {
    id: TRIPLES_LEAGUE_ID,
    name: '2026 Triples League',
    teamId: null
};
let activeTeamChatRoom = null;

function setPublicLandingMode(isSignedOut) {
    document.body.classList.toggle('is-signed-out', isSignedOut);
    document.body.classList.toggle('is-signed-in', !isSignedOut);
    document.body.classList.remove('rookies-auth-pending');
    window.dispatchEvent(new CustomEvent('rookies:auth-mode-changed', {
        detail: { isSignedOut }
    }));
}

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
        sessionStorage.setItem(key, JSON.stringify({
            savedAt: Date.now(),
            data
        }));
    } catch {
        // Cache is an optimization only.
    }
}

function notifyUser(message, type = 'info') {
    const toastName = type === 'error' ? 'toastError' : type === 'success' ? 'toastSuccess' : 'toastInfo';
    if (typeof window[toastName] === 'function') {
        window[toastName](message);
        return;
    }
    console[type === 'error' ? 'error' : 'log'](`[BRDC Dashboard] ${message}`);
}

function playerLevel(player) {
    const raw = String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
    return ['A', 'B', 'C'].includes(raw) ? raw : '';
}

function sortPlayersByLevel(a, b) {
    const order = { A: 0, B: 1, C: 2, '': 9 };
    const aOrder = order[playerLevel(a)] ?? 9;
    const bOrder = order[playerLevel(b)] ?? 9;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function sortRosterByLevel(roster = []) {
    return [...roster].sort(sortPlayersByLevel);
}

function initViewCards() {
    document.querySelectorAll('[data-view-card]').forEach(card => {
        const titleEl = card.querySelector('h2[id$="ViewTitle"]');
        const dots = [...card.querySelectorAll('[data-view-target]')];
        const panes = [...card.querySelectorAll('[data-view-pane]')];
        let activeIndex = 0;

        function activate(target) {
            panes.forEach(pane => {
                const active = pane.dataset.viewPane === target;
                pane.classList.toggle('active', active);
                pane.setAttribute('aria-hidden', active ? 'false' : 'true');
                if (active && titleEl) {
                    titleEl.textContent = pane.dataset.viewTitle || titleEl.textContent;
                }
            });

            dots.forEach(dot => {
                const active = dot.dataset.viewTarget === target;
                dot.classList.toggle('active', active);
                dot.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            activeIndex = Math.max(0, dots.findIndex(dot => dot.dataset.viewTarget === target));
        }

        function activateByOffset(offset) {
            if (!dots.length) return;
            const nextIndex = Math.max(0, Math.min(dots.length - 1, activeIndex + offset));
            if (nextIndex !== activeIndex) activate(dots[nextIndex].dataset.viewTarget);
        }

        dots.forEach(dot => {
            dot.addEventListener('click', () => activate(dot.dataset.viewTarget));
        });

        let touchStartX = 0;
        let touchStartY = 0;
        card.addEventListener('touchstart', event => {
            const touch = event.touches?.[0];
            if (!touch) return;
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        card.addEventListener('touchend', event => {
            const touch = event.changedTouches?.[0];
            if (!touch || !touchStartX) return;
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            touchStartX = 0;
            touchStartY = 0;
            if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
            activateByOffset(dx < 0 ? 1 : -1);
        }, { passive: true });

        card.addEventListener('keydown', event => {
            if (event.key === 'ArrowRight') activateByOffset(1);
            if (event.key === 'ArrowLeft') activateByOffset(-1);
        });

        const activeDot = dots.find(dot => dot.classList.contains('active')) || dots[0];
        if (activeDot) activate(activeDot.dataset.viewTarget);
    });

    document.querySelectorAll('.hv-room-switch').forEach(switcher => {
        switcher.addEventListener('click', event => {
            const button = event.target.closest('[data-room-filter]');
            if (!button) return;
            const target = button.dataset.roomFilter;
            switcher.querySelectorAll('[data-room-filter]').forEach(item => {
                item.classList.toggle('active', item === button);
                item.setAttribute('aria-selected', item === button ? 'true' : 'false');
            });
            document.querySelectorAll('[data-room-pane]').forEach(pane => {
                pane.classList.toggle('active', pane.dataset.roomPane === target);
            });
        });
    });
}

function initHomeActions() {
    document.addEventListener('click', event => {
        const loginOpen = event.target.closest('[data-rookies-login-open]');
        if (loginOpen) {
            event.preventDefault();
            openRookiesPlayerLogin();
            return;
        }

        const loginClose = event.target.closest('[data-rookies-login-close]');
        if (loginClose) {
            event.preventDefault();
            closeRookiesPlayerLogin();
            return;
        }

        if (event.target === els.playerLoginModal) {
            closeRookiesPlayerLogin();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && els.playerLoginModal?.classList.contains('open')) {
            closeRookiesPlayerLogin();
        }
    });

    els.playerLoginForm?.addEventListener('submit', handleRookiesPlayerLogin);

    document.querySelector('[data-rookies-google-login]')?.addEventListener('click', event => {
        event.preventDefault();
        handleRookiesGoogleLogin();
    });

    document.querySelector('[data-rookies-password-reset]')?.addEventListener('click', event => {
        event.preventDefault();
        handleRookiesPasswordReset();
    });

    els.triplesStandings?.addEventListener('click', event => {
        const button = event.target.closest('[data-standings-target]');
        if (!button) return;
        event.preventDefault();
        const target = button.dataset.standingsTarget;
        els.triplesStandings.querySelectorAll('[data-standings-target]').forEach(item => {
            const active = item === button;
            item.classList.toggle('active', active);
            item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        els.triplesStandings.querySelectorAll('[data-standings-panel]').forEach(panel => {
            const active = panel.dataset.standingsPanel === target;
            panel.classList.toggle('active', active);
            panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
    });

    els.matchNightCard?.addEventListener('click', event => {
        const button = event.target.closest('[data-match-action]');
        const toggle = event.target.closest('[data-match-details-toggle]');
        if (toggle) {
            event.preventDefault();
            const expanded = els.matchNightCard.classList.toggle('details-open');
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            toggle.textContent = expanded ? 'Hide lineups' : 'Lineups / RSVP';
            return;
        }
        if (!button) return;
        event.preventDefault();
        handleMatchAction(button.dataset.matchAction, button);
    });

    els.leagueChatSnapshot?.addEventListener('click', event => {
        const button = event.target.closest('[data-team-chat-send]');
        if (!button) return;
        event.preventDefault();
        sendTeamChatMessage(button);
    });

    els.leagueChatSnapshot?.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        const input = event.target.closest('[data-team-chat-input]');
        if (!input) return;
        event.preventDefault();
        const button = els.leagueChatSnapshot.querySelector('[data-team-chat-send]');
        if (button) sendTeamChatMessage(button);
    });
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) {
            return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
    if (!date) return 'Date TBD';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysUntil(date) {
    if (!date) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - start) / MS_PER_DAY);
}

function isFutureOrToday(date) {
    const days = daysUntil(date);
    return days == null || days >= 0;
}

function soonLabel(date) {
    const days = daysUntil(date);
    if (days === null) return { text: 'Upcoming', cls: '' };
    if (days === 0) return { text: 'Today', cls: 'now' };
    if (days === 1) return { text: 'Tomorrow', cls: 'soon' };
    if (days > 1 && days <= 3) return { text: `${days} days`, cls: 'soon' };
    return { text: formatDate(date), cls: '' };
}

function shortDate(date) {
    if (!date) return 'TBD';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getTeamName(team) {
    return team?.team_name || team?.name || 'Team';
}

function compactTeamName(value) {
    const name = typeof value === 'string' ? value : getTeamName(value);
    const normalized = normalizeLookupName(name);
    if (COMPACT_TEAM_NAMES.has(normalized)) return COMPACT_TEAM_NAMES.get(normalized);
    if (name.length <= 14) return name;
    return name
        .replace(/\bCleveland\b/i, 'Cle')
        .replace(/\bCompany\b/i, 'Co.')
        .replace(/\bNightmares\b/i, 'Nightmrs')
        .replace(/\s+/g, ' ')
        .trim();
}

function getMatchDate(match) {
    return asDate(match.date || match.match_date || match.scheduled_date || match.scheduled_at);
}

function getInitials(name) {
    return String(name || 'BRDC')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'B';
}

function finiteStat(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function formatStat(value, decimals = 1) {
    const num = finiteStat(value);
    return num == null ? '-' : num.toFixed(decimals);
}

function shortPlayerName(name) {
    const parts = String(name || 'Player').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Player';
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function calcRosterAverage(roster, fieldNames, decimals = 1) {
    const values = (roster || [])
        .map(player => fieldNames.map(field => finiteStat(player?.[field])).find(value => value != null))
        .filter(value => value != null);
    if (!values.length) return null;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return avg.toFixed(decimals);
}

function statBarPercent(value, max) {
    const num = finiteStat(value);
    if (num == null) return '0%';
    return `${Math.max(4, Math.min(100, Math.round((num / max) * 100)))}%`;
}

function getPlayerTeamIds(player, leaguePlayers) {
    const ids = new Set();
    const currentEmail = String(auth.currentUser?.email || player?.email || '').toLowerCase();
    const currentName = normalizeLookupName(player?.name || player?.display_name || '');
    const leagueMatches = leaguePlayers.filter(p => {
        if (p.id === player?.id) return true;
        if (currentEmail && String(p.email || '').toLowerCase() === currentEmail) return true;
        if (currentName && normalizeLookupName(p.name || p.display_name) === currentName) return true;
        return false;
    });

    leagueMatches.forEach(leaguePlayer => {
        if (leaguePlayer?.team_id) ids.add(leaguePlayer.team_id);
    });

    (player?.roles || []).forEach(role => {
        if (role.team_id) ids.add(role.team_id);
    });
    (player?.leagues || []).forEach(role => {
        if (role.team_id) ids.add(role.team_id);
    });
    (player?.involvements?.leagues || []).forEach(role => {
        if (role.team_id) ids.add(role.team_id);
    });

    return ids;
}

function findLeaguePlayerForCurrentUser(leaguePlayers = []) {
    if (!currentPlayer) return null;
    const currentEmail = String(auth.currentUser?.email || currentPlayer?.email || '').toLowerCase();
    const currentName = normalizeLookupName(currentPlayer?.name || currentPlayer?.display_name || '');
    return leaguePlayers.find(player => {
        if (player.id === currentPlayer.id) return true;
        if (currentPlayer.global_player_id && player.global_player_id === currentPlayer.global_player_id) return true;
        if (currentEmail && String(player.email || '').toLowerCase() === currentEmail) return true;
        if (currentName && normalizeLookupName(player.name || player.display_name) === currentName) return true;
        return false;
    }) || null;
}

function mergeIdentityStats(primaryStats = {}, leaguePlayer = null, leagueStats = null) {
    const firstFinite = (...values) => values.find(value => finiteStat(value) != null);
    return {
        ...primaryStats,
        x01_three_dart_avg: firstFinite(
            primaryStats.x01_three_dart_avg,
            primaryStats.three_dart_avg,
            primaryStats.avg_3da,
            leagueStats?.x01_three_dart_avg,
            leagueStats?.three_dart_avg,
            leagueStats?.avg_3da,
            leaguePlayer?.x01_three_dart_avg,
            leaguePlayer?.three_dart_avg,
            leaguePlayer?.avg_3da,
            leaguePlayer?.stats?.x01_three_dart_avg,
            leaguePlayer?.unified_stats?.x01_three_dart_avg
        ),
        cricket_mpr: firstFinite(
            primaryStats.cricket_mpr,
            primaryStats.mpr,
            leagueStats?.cricket_mpr,
            leagueStats?.mpr,
            leaguePlayer?.cricket_mpr,
            leaguePlayer?.mpr,
            leaguePlayer?.stats?.cricket_mpr,
            leaguePlayer?.unified_stats?.cricket_mpr
        )
    };
}

function normalizeLookupName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function renderEmpty(el, text) {
    el.innerHTML = `<div class="hv-empty">${escapeHtml(text)}</div>`;
}

function renderIdentity(player, stats = {}) {
    const name = player?.name || player?.display_name || 'BRDC';
    const firstName = name.split(' ')[0] || 'Player';
    els.welcomeTitle.textContent = auth.currentUser ? `Welcome back, ${firstName}` : 'Rookies darts hub';
    els.playerAvatar.textContent = getInitials(name);
    if (player?.photo_url || player?.photo) {
        els.playerAvatar.style.backgroundImage = `url("${String(player.photo_url || player.photo).replace(/"/g, '%22')}")`;
        els.playerAvatar.textContent = '';
    } else {
        els.playerAvatar.style.backgroundImage = '';
    }
    els.authStatus.textContent = auth.currentUser
        ? (player?.is_admin ? 'Online as admin' : 'Online')
        : 'Signed out';

    const threeDa = finiteStat(stats.x01_three_dart_avg ?? stats.three_dart_avg ?? stats.avg_3da ?? player?.x01_three_dart_avg);
    const mpr = finiteStat(stats.cricket_mpr ?? stats.mpr ?? player?.cricket_mpr);
    els.identity3da.textContent = formatStat(threeDa, 1);
    els.identityMpr.textContent = formatStat(mpr, 2);
    els.identity3daBar.style.width = statBarPercent(threeDa, 70);
    els.identityMprBar.style.width = statBarPercent(mpr, 3.5);

    if (player?.id) {
        els.quickProfileLink.href = `/rookies/pages/player-profile-vnext.html?id=${player.id}`;
        if (els.quickSettingsLink) {
            els.quickSettingsLink.href = `/rookies/pages/player-profile-vnext.html?id=${player.id}#profile`;
        }
        if (els.leagueStatsProfileLink) {
            els.leagueStatsProfileLink.href = `/rookies/pages/player-profile-vnext.html?id=${player.id}`;
        }
    }
}

function renderMatchNightCard(item) {
    activeMatchNight = item || null;
    if (!item) {
        const signedIn = Boolean(auth.currentUser);
        els.matchNightCard.innerHTML = `
            <div class="hv-card-label">Match night</div>
            <h2>${signedIn ? 'No match attached' : 'Sign in for match night'}</h2>
            <p>${signedIn
                ? 'No upcoming league match is attached to your profile yet. Check the full schedule or open team chat.'
                : 'Your next opponent, team chat, RSVP, and lineup details will appear here after sign-in.'}</p>
            <div class="hv-action-grid hv-match-empty-actions">
                <a class="hv-action" href="${signedIn ? '/rookies/pages/messages-vnext.html' : '/rookies/'}" ${signedIn ? '' : 'data-rookies-login-open'}>${signedIn ? 'Open chat' : 'Log in'}</a>
                <a class="hv-action" href="/rookies/pages/triples-vnext.html">League schedule</a>
            </div>
        `;
        return;
    }

    const label = soonLabel(item.date);
    const exactDate = item.date ? item.date.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) : 'Date TBD';
    const homeIsMine = item.mySide === 'home';
    const awayIsMine = item.mySide === 'away';
    const myTeamName = homeIsMine ? item.homeTeamName : awayIsMine ? item.awayTeamName : 'Your team';
    const opponentName = homeIsMine ? item.awayTeamName : awayIsMine ? item.homeTeamName : item.awayTeamName;
    const myTeamCompactName = compactTeamName(myTeamName || 'Your team');
    const opponentCompactName = compactTeamName(opponentName || 'Opponent');
    const myRecord = homeIsMine ? item.homeRecord : awayIsMine ? item.awayRecord : '-';
    const opponentRecord = homeIsMine ? item.awayRecord : awayIsMine ? item.homeRecord : '-';
    const myRank = homeIsMine ? item.homeRank : awayIsMine ? item.awayRank : null;
    const opponentRank = homeIsMine ? item.awayRank : awayIsMine ? item.homeRank : null;
    const myRoster = item.myPlayers || [];
    const opponentRoster = item.opponentPlayers || [];
    const maxRows = Math.max(myRoster.length, opponentRoster.length, 3);
    const myTeamStats = `${item.my3da || '-'} / ${item.myMpr || '-'}`;
    const opponentStats = `${item.opponent3da || '-'} / ${item.opponentMpr || '-'}`;
    const targetSets = item.targetScore || 9;
    const availabilityKey = `match_availability_${item.leagueId}_${item.matchId}`;
    const savedAvailability = localStorage.getItem(availabilityKey) || item.myAvailability || '';
    const compareClass = (left, right, higherIsBetter = true) => {
        const l = finiteStat(left);
        const r = finiteStat(right);
        if (l == null || r == null || Math.abs(l - r) < 0.01) return ['', ''];
        const leftBetter = higherIsBetter ? l > r : l < r;
        return leftBetter ? ['better', 'worse'] : ['worse', 'better'];
    };
    const rosterRows = Array.from({ length: maxRows }).map((_, index) => {
        const mine = myRoster[index];
        const opp = opponentRoster[index];
        const [my3Class, opp3Class] = compareClass(mine?.threeDa, opp?.threeDa);
        const [myMprClass, oppMprClass] = compareClass(mine?.mpr, opp?.mpr);
        return `
            <div class="hv-matchup-roster-row">
                <div class="hv-matchup-player mine">
                    ${mine ? `
                        <strong>${escapeHtml(shortPlayerName(mine.name))}</strong>
                        <span><i class="${my3Class}">${escapeHtml(mine.threeDa || '-')}</i> / <i class="${myMprClass}">${escapeHtml(mine.mpr || '-')}</i></span>
                    ` : ''}
                </div>
                <div class="hv-matchup-player opponent">
                    ${opp ? `
                        <strong>${escapeHtml(shortPlayerName(opp.name))}</strong>
                        <span><i class="${opp3Class}">${escapeHtml(opp.threeDa || '-')}</i> / <i class="${oppMprClass}">${escapeHtml(opp.mpr || '-')}</i></span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    els.matchNightCard.innerHTML = `
        <div class="hv-matchup-top">
            <span class="hv-matchup-label">Match night</span>
            <span class="hv-matchup-date">${escapeHtml(item.detail || '2026 Triples League')} · ${escapeHtml(exactDate)}</span>
        </div>
        <div class="hv-matchup-scoreboard">
            <div class="hv-matchup-team mine">
                <span>${escapeHtml(myRank ? `#${myRank}` : 'Your team')}</span>
                <strong title="${escapeHtml(myTeamName || 'Your team')}">${escapeHtml(myTeamCompactName || 'Your team')}</strong>
                <em>${escapeHtml(myRecord)} · ${escapeHtml(myTeamStats)}</em>
            </div>
            <div class="hv-matchup-vs">
                <span>vs</span>
                <strong>${escapeHtml(targetSets)}</strong>
                <em>sets</em>
            </div>
            <div class="hv-matchup-team opponent">
                <span>${escapeHtml(opponentRank ? `#${opponentRank}` : 'Opponent')}</span>
                <strong title="${escapeHtml(opponentName || 'Opponent')}">${escapeHtml(opponentCompactName || 'Opponent')}</strong>
                <em>${escapeHtml(opponentRecord)} · ${escapeHtml(opponentStats)}</em>
            </div>
        </div>
        <div class="hv-matchup-summary-actions">
            ${item.href ? `<a href="${escapeHtml(item.href)}">Match hub</a>` : ''}
            <a href="/rookies/pages/messages-vnext.html?source=team&league_id=${escapeHtml(item.leagueId || TRIPLES_LEAGUE_ID)}&team_id=${escapeHtml(item.myTeamId || '')}">Team chat</a>
            <button type="button" data-match-details-toggle aria-expanded="false">Lineups / RSVP</button>
        </div>
        <div class="hv-matchup-details">
            <div class="hv-matchup-roster">
                <div class="hv-matchup-roster-head">
                    <span>Lineup</span>
                    <span>3DA / MPR</span>
                </div>
                ${rosterRows || '<div class="hv-meta">No roster data available.</div>'}
            </div>
            <div class="hv-matchup-note">
                <span>Last meeting</span>
                <strong>${escapeHtml(item.h2hText || 'No prior result')}</strong>
            </div>
            <div class="hv-matchup-actions">
                <button class="hv-rsvp yes ${savedAvailability === 'available' ? 'selected' : ''}" type="button" data-match-action="available">I can play</button>
                <button class="hv-rsvp ${savedAvailability === 'unavailable' ? 'selected' : ''}" type="button" data-match-action="unavailable">Need fill-in</button>
            </div>
        </div>
    `;
}

async function handleMatchAction(action, button) {
    if (!activeMatchNight || !currentPlayer?.id) {
        notifyUser('Sign in before updating match status.', 'error');
        return;
    }

    const status = action === 'available' ? 'available' : 'unavailable';
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = status === 'available' ? 'Saving...' : 'Requesting...';

    try {
        await callFunction('updatePlayerAvailability', {
            player_id: currentPlayer.id,
            league_id: activeMatchNight.leagueId,
            match_id: activeMatchNight.matchId,
            status
        });

        localStorage.setItem(`match_availability_${activeMatchNight.leagueId}_${activeMatchNight.matchId}`, status);
        els.matchNightCard.querySelectorAll('.hv-rsvp').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        notifyUser(status === 'available' ? 'Marked available for match night.' : 'Marked unavailable so your team can find a fill-in.', 'success');
    } catch (error) {
        console.error('Dashboard availability update failed:', error);
        notifyUser('Could not update match status. Try again from the dashboard.', 'error');
    } finally {
        button.disabled = false;
        button.textContent = previousText;
    }
}

function renderSchedule(items) {
    if (!items.length) {
        renderEmpty(els.scheduleList, 'No upcoming matches or events found.');
        return;
    }

    els.scheduleList.innerHTML = items.slice(0, 8).map(item => {
        const label = soonLabel(item.date);
        const titleParts = String(item.title || '').split(/\s+vs\.?\s+/i);
        const hasTeams = titleParts.length === 2;
        return `
            <a class="hv-list-item hv-schedule-item" href="${escapeHtml(item.href || '#')}">
                <div class="hv-schedule-date">
                    <strong>${escapeHtml(shortDate(item.date))}</strong>
                    <span class="hv-pill ${label.cls}">${escapeHtml(label.text)}</span>
                </div>
                <div class="hv-schedule-main">
                    ${hasTeams ? `
                        <div class="hv-schedule-teams">
                            <strong>${escapeHtml(compactTeamName(titleParts[0]))}</strong>
                            <span>vs</span>
                            <strong>${escapeHtml(compactTeamName(titleParts[1]))}</strong>
                        </div>
                    ` : `<strong>${escapeHtml(item.title)}</strong>`}
                    <span class="hv-meta">${escapeHtml(item.detail)}</span>
                </div>
                <div class="hv-pill-row">
                    <span class="hv-pill">${escapeHtml(item.type)}</span>
                    ${item.completed ? '<span class="hv-pill">Final</span>' : ''}
                </div>
            </a>
        `;
    }).join('');
}

function renderStandings(teams, matches = [], myTeamIds = new Set(), leaguePlayers = [], statsById = {}) {
    const regularRows = buildRegularSeasonStandings(teams, matches);
    const playoffMatches = matches
        .filter(isPlayoffMatch)
        .sort((a, b) => {
            const ar = playoffRoundNumber(a);
            const br = playoffRoundNumber(b);
            if (ar !== br) return ar - br;
            return String(a.playoff_match_key || a.id).localeCompare(String(b.playoff_match_key || b.id));
        });

    if (!regularRows.length && !playoffMatches.length) {
        renderEmpty(els.triplesStandings, 'Standings are not available yet.');
        return;
    }

    els.triplesStandings.innerHTML = `
        <div class="hv-standings-switch" role="tablist" aria-label="Standings views">
            <button type="button" class="active" data-standings-target="playoffs" aria-selected="true">Playoffs</button>
            <button type="button" data-standings-target="regular" aria-selected="false">Regular season</button>
        </div>
        <div class="hv-standings-panel active" data-standings-panel="playoffs" aria-hidden="false">
            ${renderPlayoffBracket(playoffMatches, teams, regularRows, leaguePlayers, statsById)}
        </div>
        <div class="hv-standings-panel" data-standings-panel="regular" aria-hidden="true">
            ${renderRegularSeasonStandings(regularRows, myTeamIds)}
        </div>
    `;
}

function isPlayoffMatch(match) {
    return match?.season_phase === 'playoffs' ||
        match?.match_type === 'playoff' ||
        Boolean(match?.playoff_round || match?.playoff_round_number || match?.playoff_match_key || match?.playoff_bracket_id);
}

function buildRegularSeasonStandings(teams, matches = []) {
    const rowsByTeamId = new Map(teams.map(team => [team.id, {
        ...team,
        wins: 0,
        losses: 0,
        ties: 0,
        setsWon: 0,
        setsLost: 0,
        legsWon: 0,
        legsLost: 0
    }]));

    matches
        .filter(match => match.status === 'completed' && !isPlayoffMatch(match))
        .forEach(match => {
            const homeId = match.home_team_id;
            const awayId = match.away_team_id;
            if (!homeId || !awayId) return;
            const home = rowsByTeamId.get(homeId);
            const away = rowsByTeamId.get(awayId);
            if (!home || !away) return;

            const homeScore = Number(match.home_score || 0);
            const awayScore = Number(match.away_score || 0);
            const homeLegs = matchLegsWon(match, 'home');
            const awayLegs = matchLegsWon(match, 'away');

            home.setsWon += homeScore;
            home.setsLost += awayScore;
            home.legsWon += homeLegs;
            home.legsLost += awayLegs;
            away.setsWon += awayScore;
            away.setsLost += homeScore;
            away.legsWon += awayLegs;
            away.legsLost += homeLegs;

            if (homeScore > awayScore) {
                home.wins += 1;
                away.losses += 1;
            } else if (awayScore > homeScore) {
                away.wins += 1;
                home.losses += 1;
            } else {
                home.ties += 1;
                away.ties += 1;
            }
        });

    return [...rowsByTeamId.values()].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
        if (b.legsWon !== a.legsWon) return b.legsWon - a.legsWon;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return getTeamName(a).localeCompare(getTeamName(b));
    });
}

function setRookiesLoginError(message = '') {
    if (!els.playerLoginError) return;
    els.playerLoginError.textContent = message;
    els.playerLoginError.hidden = !message;
}

function setRookiesLoginBusy(isBusy, message = '') {
    els.playerLoginModal?.classList.toggle('is-busy', Boolean(isBusy));
    els.playerLoginModal?.querySelectorAll('button, input').forEach(control => {
        control.disabled = Boolean(isBusy);
    });
    const status = els.playerLoginModal?.querySelector('[data-rookies-login-status]');
    if (status) status.textContent = message;
}

function openRookiesPlayerLogin() {
    if (!els.playerLoginModal) return;
    setRookiesLoginError('');
    setRookiesLoginBusy(false, '');
    els.playerLoginModal.classList.add('open');
    els.playerLoginModal.removeAttribute('hidden');
    document.body.classList.add('rookies-login-open');
    setTimeout(() => els.playerLoginEmail?.focus(), 40);
}

function closeRookiesPlayerLogin() {
    els.playerLoginModal?.classList.remove('open');
    els.playerLoginModal?.setAttribute('hidden', '');
    document.body.classList.remove('rookies-login-open');
}

async function storePlayerSessionFromAuth() {
    const result = await callFunction('getPlayerSession', {});
    if (!result?.success || !result?.player) {
        throw new Error(result?.error || 'No player profile is connected to this login.');
    }

    const player = result.player;
    localStorage.setItem('brdc_session', JSON.stringify({
        player_id: player.id,
        name: player.name,
        source_type: 'global',
        league_id: player.league_id || null,
        team_id: player.team_id || null,
        is_admin: Boolean(player.is_admin),
        is_master_admin: Boolean(player.is_master_admin),
        is_director: Boolean(player.is_director),
        is_captain: Boolean(player.is_captain),
        involvements: player.involvements || {},
        logged_in_at: Date.now()
    }));
    localStorage.removeItem('brdc_player_pin');
    return player;
}

function explainLoginError(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '');
    if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
        return 'That email/password did not match a player account.';
    }
    if (code.includes('popup-closed')) return 'Google login was closed before it finished.';
    if (message.toLowerCase().includes('no player profile')) return message;
    return 'Login failed. Check the account and try again.';
}

async function handleRookiesPlayerLogin(event) {
    event?.preventDefault();
    const email = els.playerLoginEmail?.value.trim();
    const password = els.playerLoginPassword?.value || '';
    if (!email || !password) {
        setRookiesLoginError('Enter the player email and password.');
        return;
    }

    setRookiesLoginError('');
    setRookiesLoginBusy(true, 'Signing in...');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        await storePlayerSessionFromAuth();
        window.location.href = '/rookies/dashboard/';
    } catch (error) {
        console.error('[Rookies login] Email login failed:', error);
        setRookiesLoginError(explainLoginError(error));
        setRookiesLoginBusy(false, '');
    }
}

async function handleRookiesGoogleLogin() {
    setRookiesLoginError('');
    setRookiesLoginBusy(true, 'Opening Google...');
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        await storePlayerSessionFromAuth();
        window.location.href = '/rookies/dashboard/';
    } catch (error) {
        console.error('[Rookies login] Google login failed:', error);
        setRookiesLoginError(explainLoginError(error));
        setRookiesLoginBusy(false, '');
    }
}

async function handleRookiesPasswordReset() {
    const email = els.playerLoginEmail?.value.trim();
    if (!email) {
        setRookiesLoginError('Enter your email first, then reset the password.');
        els.playerLoginEmail?.focus();
        return;
    }

    setRookiesLoginError('');
    setRookiesLoginBusy(true, 'Sending reset link...');
    try {
        await sendPasswordResetEmail(auth, email);
        setRookiesLoginBusy(false, 'Reset link sent.');
    } catch (error) {
        console.error('[Rookies login] Password reset failed:', error);
        setRookiesLoginError('Could not send a reset link for that email.');
        setRookiesLoginBusy(false, '');
    }
}

function matchLegsWon(match, side) {
    const direct = finiteStat(
        match?.[`${side}_legs_won`] ??
        match?.[`${side}_leg_wins`] ??
        match?.[`${side}_total_legs`] ??
        match?.[`${side}_legs`]
    );
    if (direct != null) return direct;
    if (!Array.isArray(match?.games)) return 0;
    return match.games.reduce((total, game) => {
        const gameLegs = finiteStat(
            game?.[`${side}_legs_won`] ??
            game?.[`${side}_leg_wins`] ??
            game?.[`${side}_score`]
        );
        return total + (gameLegs || 0);
    }, 0);
}

function renderRegularSeasonStandings(rows, myTeamIds) {
    if (!rows.length) return '<div class="hv-empty">No regular season standings are available yet.</div>';
    const hasLegData = rows.some(team => Number(team.legsWon || 0) > 0 || Number(team.legsLost || 0) > 0);
    return `
        <div class="hv-standing-row hv-standing-head regular ${hasLegData ? 'has-legs' : 'no-legs'}">
            <span>#</span>
            <strong>Team</strong>
            <span>W-L</span>
            <span>Sets</span>
            ${hasLegData ? '<span>Legs</span>' : ''}
        </div>
        ${rows.map((team, index) => {
            const isMine = myTeamIds.has(team.id);
            const setText = `${Number(team.setsWon || 0)}-${Number(team.setsLost || 0)}`;
            const legText = `${Number(team.legsWon || 0)}-${Number(team.legsLost || 0)}`;
            return `
                <div class="hv-standing-row regular ${hasLegData ? 'has-legs' : 'no-legs'} ${index < 6 ? 'playoff' : ''} ${isMine ? 'mine' : ''}">
                    <span class="hv-standing-rank">${index + 1}</span>
                    <strong title="${escapeHtml(getTeamName(team))}">
                        ${escapeHtml(compactTeamName(team))}
                        ${isMine ? '<em class="hv-standing-user">your team</em>' : ''}
                    </strong>
                    <span class="hv-standing-record">${Number(team.wins || 0)}-${Number(team.losses || 0)}</span>
                    <span class="hv-standing-points">${escapeHtml(setText)}</span>
                    ${hasLegData ? `<span class="hv-standing-legs">${escapeHtml(legText)}</span>` : ''}
                </div>
            `;
        }).join('')}
        <div class="hv-meta">Regular season only. Playoff matches are excluded.</div>
    `;
}

function renderPlayoffBracket(matches, teams, regularRows = [], leaguePlayers = [], statsById = {}) {
    const teamsById = Object.fromEntries(teams.map(team => [team.id, team]));
    const regularByTeamId = Object.fromEntries(regularRows.map(team => [team.id, team]));
    const rounds = groupPlayoffRounds(matches);
    if (!rounds.length) {
        return '<div class="hv-empty">Playoff bracket is not set up yet.</div>';
    }

    const completed = matches.filter(match => match.status === 'completed').length;
    return `
        <div class="hv-playoff-summary">
            <span class="hv-pill now">${completed} final</span>
            <span class="hv-pill">${matches.length - completed} open</span>
            <span class="hv-pill">Race to 5 sets</span>
        </div>
        <div class="hv-playoff-bracket">
            ${rounds.map(round => `
                <section class="hv-playoff-round">
                    <div class="hv-playoff-round-head">
                        <div>
                            <strong>${escapeHtml(round.label)}</strong>
                            <span>${escapeHtml(roundMetaText(round.matches))}</span>
                        </div>
                    </div>
                    ${round.matches.map(match => renderPlayoffMatch(match, teamsById, regularByTeamId, leaguePlayers, statsById)).join('')}
                </section>
            `).join('')}
        </div>
    `;
}

function roundMetaText(matches) {
    const week = matches.map(match => Number(match.week || 0)).find(Boolean);
    const date = matches.map(getMatchDate).find(Boolean);
    return [week ? `Week ${week}` : '', date ? formatDate(date) : 'Date TBD'].filter(Boolean).join(' - ');
}

function groupPlayoffRounds(matches) {
    const byRound = new Map();
    matches.forEach(match => {
        const round = playoffRoundNumber(match);
        if (!byRound.has(round)) {
            byRound.set(round, {
                round,
                label: playoffRoundLabel(match, round),
                matches: []
            });
        }
        byRound.get(round).matches.push(match);
    });
    if (matches.length) {
        const latestRound = [...byRound.values()].sort((a, b) => b.round - a.round)[0];
        if (!byRound.has(3)) {
            byRound.set(3, {
                round: 3,
                label: 'Final',
                matches: []
            });
        }
        const finalRound = byRound.get(3);
        const sourceMatches = latestRound?.matches || matches;
        if (!finalRound.matches.some(isChampionshipPlayoffMatch)) {
            finalRound.matches.push(buildPlaceholderFinal(sourceMatches));
        }
        if (!finalRound.matches.some(isThirdPlacePlayoffMatch)) {
            finalRound.matches.push(buildPlaceholderThirdPlace(sourceMatches));
        }
    }

    return [...byRound.values()]
        .sort((a, b) => b.round - a.round)
        .map(round => ({
            ...round,
            matches: round.matches.sort((a, b) => String(a.playoff_match_key || a.id).localeCompare(String(b.playoff_match_key || b.id)))
        }));
}

function isChampionshipPlayoffMatch(match) {
    const key = String(match?.playoff_match_key || match?.key || match?.id || '').toLowerCase();
    const label = String(match?.playoff_match_label || match?.label || match?.playoff_round || '').toLowerCase();
    return key === 'final' || key === 'final-placeholder' || label.includes('championship');
}

function isThirdPlacePlayoffMatch(match) {
    const text = `${match?.playoff_match_key || ''} ${match?.key || ''} ${match?.id || ''} ${match?.playoff_match_label || ''} ${match?.label || ''}`.toLowerCase();
    return text.includes('third') || text.includes('3rd') || text.includes('consolation') || text.includes('3-4') || text.includes('3_4');
}

function buildPlaceholderFinal(sourceMatches = []) {
    const latestWeek = Math.max(...sourceMatches.map(match => Number(match.week || 0)).filter(Boolean), 20);
    const latestDate = sourceMatches
        .map(getMatchDate)
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
    const finalDate = latestDate ? new Date(latestDate.getTime() + 7 * MS_PER_DAY) : new Date(2026, 5, 10);
    return {
        id: '',
        status: 'pending',
        playoff_round: 'final',
        playoff_round_number: 3,
        playoff_match_key: 'final-placeholder',
        playoff_match_label: 'Championship',
        week: latestWeek + 1,
        match_date: finalDate,
        home_from: 'sf_1_vs_qf_4v5',
        away_from: 'sf_2_vs_qf_3v6'
    };
}

function buildPlaceholderThirdPlace(sourceMatches = []) {
    const latestWeek = Math.max(...sourceMatches.map(match => Number(match.week || 0)).filter(Boolean), 20);
    const latestDate = sourceMatches
        .map(getMatchDate)
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
    const finalDate = latestDate ? new Date(latestDate.getTime() + 7 * MS_PER_DAY) : new Date(2026, 5, 10);
    return {
        id: '',
        status: 'pending',
        playoff_round: 'final',
        playoff_round_number: 3,
        playoff_match_key: 'third-place-placeholder',
        playoff_match_label: '3rd / 4th',
        week: latestWeek + 1,
        match_date: finalDate,
        home_from: 'loser_sf_1_vs_qf_4v5',
        away_from: 'loser_sf_2_vs_qf_3v6'
    };
}

function playoffRoundNumber(match) {
    const explicit = Number(match?.playoff_round_number || match?.round_number || match?.round);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const raw = String(match?.playoff_round || match?.round_label || match?.playoff_match_key || '').toLowerCase();
    if (raw.includes('quarter') || raw.startsWith('qf')) return 1;
    if (raw.includes('semi') || raw.startsWith('sf')) return 2;
    if (raw.includes('final') || raw === 'championship') return 3;
    return 99;
}

function playoffRoundLabel(match, round) {
    const raw = String(match?.playoff_round || match?.round_label || '').toLowerCase();
    if (raw.includes('quarter') || round === 1) return 'Quarterfinals';
    if (raw.includes('semi') || round === 2) return 'Semifinals';
    if (raw.includes('final') || round === 3) return 'Final';
    return `Round ${round}`;
}

function playoffEntrant(match, side, teamsById, regularByTeamId, leaguePlayers, statsById) {
    const teamId = match?.[`${side}_team_id`];
    const team = teamsById[teamId];
    const seed = match?.[`${side}_seed`];
    const from = match?.[`${side}_from`];
    const rawScore = Number(match?.[`${side}_score`]);
    const score = ['completed', 'in_progress'].includes(match?.status) && Number.isFinite(rawScore) ? rawScore : null;
    const regular = regularByTeamId[teamId];
    return {
        seed: seed ? `#${seed}` : '',
        name: match?.[`${side}_team_name`] || (team ? getTeamName(team) : (from ? sourcePlayoffLabel(from) : 'TBD')),
        record: regular ? `${Number(regular.wins || 0)}-${Number(regular.losses || 0)}` : team ? getTeamRecordText(team) : '',
        averages: teamAverageText(teamId, leaguePlayers, statsById),
        score,
        winner: playoffWinnerSide(match) === side
    };
}

function teamAverageText(teamId, leaguePlayers = [], statsById = {}) {
    if (!teamId) return '- / -';
    const roster = leaguePlayers.filter(player => player.team_id === teamId && !String(player.id || '').startsWith('fill'));
    const threeDaValues = roster
        .map(player => finiteStat(statsById[player.id]?.x01_three_dart_avg ?? statsById[player.id]?.avg_3da ?? player.x01_three_dart_avg ?? player.avg_3da))
        .filter(value => value != null);
    const mprValues = roster
        .map(player => finiteStat(statsById[player.id]?.cricket_mpr ?? statsById[player.id]?.mpr ?? player.cricket_mpr ?? player.mpr))
        .filter(value => value != null);
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return `${formatStat(avg(threeDaValues), 1)} / ${formatStat(avg(mprValues), 2)}`;
}

function sourcePlayoffLabel(source) {
    const labels = {
        qf_3v6: 'Winner 3/6',
        qf_4v5: 'Winner 4/5',
        sf_1_vs_qf_4v5: 'TBD',
        sf_2_vs_qf_3v6: 'TBD',
        loser_sf_1_vs_qf_4v5: 'TBD',
        loser_sf_2_vs_qf_3v6: 'TBD'
    };
    return labels[source] || 'Winner previous';
}

function playoffWinnerSide(match) {
    if (match?.winner === 'home' || match?.winner === 'away') return match.winner;
    if (match?.status !== 'completed') return '';
    const homeScore = Number(match?.home_score || 0);
    const awayScore = Number(match?.away_score || 0);
    if (homeScore > awayScore) return 'home';
    if (awayScore > homeScore) return 'away';
    return '';
}

function renderPlayoffMatch(match, teamsById, regularByTeamId, leaguePlayers, statsById) {
    const home = playoffEntrant(match, 'home', teamsById, regularByTeamId, leaguePlayers, statsById);
    const away = playoffEntrant(match, 'away', teamsById, regularByTeamId, leaguePlayers, statsById);
    const href = match.id ? `/rookies/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${encodeURIComponent(match.id)}` : '';
    const status = match.status === 'completed' ? 'Final' : match.status === 'in_progress' ? 'Live' : href ? 'Scheduled' : 'Pending';
    const label = match.playoff_match_label || match.label || '';
    const body = `
        <div class="hv-playoff-match-top ${label ? '' : 'status-only'}">
            ${label ? `<span>${escapeHtml(label)}</span>` : ''}
            <em>${escapeHtml(status)}</em>
        </div>
        ${renderPlayoffTeam(home)}
        ${renderPlayoffTeam(away)}
    `;
    return href
        ? `<a class="hv-playoff-match ${match.status === 'completed' ? 'final' : ''}" href="${escapeHtml(href)}">${body}</a>`
        : `<article class="hv-playoff-match placeholder ${match.status === 'completed' ? 'final' : ''}">${body}</article>`;
}

function renderPlayoffTeam(team) {
    return `
        <div class="hv-playoff-team ${team.winner ? 'winner' : ''}">
            <span>${escapeHtml(team.seed)}</span>
            <strong>
                ${escapeHtml(compactTeamName(team.name))}
                <small>${escapeHtml([team.record, team.averages].filter(Boolean).join(' - '))}</small>
            </strong>
            <em>${team.score == null ? '' : Number(team.score)}</em>
        </div>
    `;
}

function renderLeaguePlayerStats(leaguePlayer, stats = {}, team = null, leaguePlayers = [], statsById = {}, teamsById = {}) {
    if (!els.leaguePlayerStats) return;
    if (!currentPlayer?.id) {
        els.leaguePlayerStats.innerHTML = `
            <div class="hv-player-stat-empty">
                <span>Player stats</span>
                <strong>Sign in for your Triples snapshot.</strong>
                <a href="/rookies/" data-rookies-login-open>Log in</a>
            </div>
        `;
        return;
    }
    if (!leaguePlayer) {
        els.leaguePlayerStats.innerHTML = `
            <div class="hv-player-stat-empty">
                <span>Player stats</span>
                <strong>No Triples roster spot is attached to this profile yet.</strong>
                <a href="/rookies/pages/triples-vnext.html">View league</a>
            </div>
        `;
        return;
    }

    const mergedStats = mergeIdentityStats(window.__homeVnextIdentityStats || {}, leaguePlayer, stats);
    const threeDa = formatStat(mergedStats.x01_three_dart_avg ?? mergedStats.avg_3da ?? stats?.x01_three_dart_avg, 1);
    const mpr = formatStat(mergedStats.cricket_mpr ?? mergedStats.mpr ?? stats?.cricket_mpr, 2);
    const gamesWon = Number(stats?.games_won ?? leaguePlayer?.games_won ?? 0);
    const gamesLost = Number(stats?.games_lost ?? leaguePlayer?.games_lost ?? 0);
    const matchesWon = Number(stats?.matches_won ?? leaguePlayer?.matches_won ?? 0);
    const matchesLost = Number(stats?.matches_lost ?? leaguePlayer?.matches_lost ?? 0);
    const highCheckout = finiteStat(stats?.x01_high_checkout ?? leaguePlayer?.x01_high_checkout);
    const tons = Number(stats?.x01_total_tons ?? stats?.x01_tons ?? leaguePlayer?.x01_tons ?? 0);
    const teamName = team?.team_name || team?.name || leaguePlayer?.team_name || 'Your team';
    const level = playerLevel(leaguePlayer) || 'Player';
    const statTiles = [
        ['3DA', threeDa],
        ['MPR', mpr],
        ['Sets', gamesWon || gamesLost ? `${gamesWon}-${gamesLost}` : '-'],
        ['Matches', matchesWon || matchesLost ? `${matchesWon}-${matchesLost}` : '-']
    ];
    const comparisonLevel = playerLevel(leaguePlayer);
    const comparisonRows = leaguePlayers
        .filter(player => player?.team_id)
        .filter(player => comparisonLevel && playerLevel(player) === comparisonLevel)
        .map(player => {
            const rowStats = statsById[player.id] || {};
            const rowThreeDa = finiteStat(rowStats.x01_three_dart_avg ?? rowStats.avg_3da ?? player.x01_three_dart_avg ?? player.avg_3da);
            const rowMpr = finiteStat(rowStats.cricket_mpr ?? rowStats.mpr ?? player.cricket_mpr ?? player.mpr);
            return {
                id: player.id,
                name: player.name || 'Player',
                team: teamsById[player.team_id] || { name: player.team_name || 'Team' },
                threeDa: rowThreeDa,
                mpr: rowMpr,
                isMine: player.id === leaguePlayer.id
            };
        })
        .sort((a, b) => {
            if ((b.threeDa || 0) !== (a.threeDa || 0)) return (b.threeDa || 0) - (a.threeDa || 0);
            return (b.mpr || 0) - (a.mpr || 0);
        });

    els.leaguePlayerStats.innerHTML = `
        <section class="hv-player-stat-card" aria-label="Your league stats">
            <div class="hv-player-stat-head">
                <span>Your league stats</span>
                <strong>${escapeHtml(leaguePlayer.name || currentPlayer?.name || 'Player')}</strong>
                <em>Team ${escapeHtml(teamName)} - ${escapeHtml(level)} slot${highCheckout ? ` - ${highCheckout} high out` : ''}${tons ? ` - ${tons} tons` : ''}</em>
            </div>
            <div class="hv-player-stat-grid">
                ${statTiles.map(([label, value]) => `
                    <div>
                        <span>${escapeHtml(label)}</span>
                        <strong>${escapeHtml(value)}</strong>
                    </div>
                `).join('')}
            </div>
            <div class="hv-card-actions compact">
                <a href="/rookies/pages/player-profile-vnext.html?id=${escapeHtml(leaguePlayer.id)}">Profile</a>
                <a href="/rookies/pages/triples-vnext.html">Full stats</a>
            </div>
            ${comparisonRows.length ? `
                <div class="hv-level-compare">
                    <div class="hv-level-compare-head">
                        <span>${escapeHtml(comparisonLevel)} slot comparison</span>
                        <em>Sorted by 3DA</em>
                    </div>
                    <div class="hv-level-compare-list">
                        ${comparisonRows.map((row, index) => `
                            <a class="hv-level-compare-row ${row.isMine ? 'mine' : ''}" href="/rookies/pages/player-profile-vnext.html?id=${escapeHtml(row.id)}">
                                <span>${index + 1}</span>
                                <strong>${escapeHtml(shortPlayerName(row.name))}</strong>
                                <em>Team ${escapeHtml(compactTeamName(row.team))}</em>
                                <b>${escapeHtml(formatStat(row.threeDa, 1))}</b>
                                <i>${escapeHtml(formatStat(row.mpr, 2))}</i>
                            </a>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </section>
    `;
}

function renderLeagueChatRooms() {
    if (!els.leagueChatSnapshot) return;
    activeTeamChatRoom = null;
    renderTeamChatInterface(null, [], true);
}

function roomHref(room) {
    const id = room?.id || room?.room_id;
    return id ? `/rookies/pages/messages-vnext.html?id=${encodeURIComponent(id)}` : '/rookies/pages/messages-vnext.html';
}

function roomPreview(room) {
    return room?.last_message?.text || room?.lastMessage || 'No messages yet';
}

function roomMeta(room) {
    const count = Number(room?.participant_count || room?.participants_count || 0);
    const pieces = [];
    if (count) pieces.push(`${count} member${count === 1 ? '' : 's'}`);
    if (room?.unread_count) pieces.push(`${room.unread_count} unread`);
    return pieces.join(' - ');
}

function renderTeamChatInterface(room, messages = [], loading = false) {
    if (!els.leagueChatSnapshot) return;
    if (loading) {
        els.leagueChatSnapshot.innerHTML = '<div class="hv-empty">Loading team chat...</div>';
        return;
    }

    if (!room) {
        els.leagueChatSnapshot.innerHTML = `
            <a class="hv-room-preview-card empty" href="/rookies/pages/messages-vnext.html">
                <strong>No team room loaded yet.</strong>
                <span>Open messages to find or start your team chat.</span>
            </a>
        `;
        return;
    }

    const messageHtml = messages.length
        ? messages.slice(-5).map(message => {
            const sent = message.is_own || (currentPlayer?.id && message.sender_id === currentPlayer.id);
            const sender = !sent && message.sender_name ? `<span>${escapeHtml(message.sender_name)}</span>` : '';
            return `
                <div class="hv-team-chat-message ${sent ? 'sent' : 'received'}">
                    ${sender}
                    <strong>${escapeHtml(message.text || message.message || '')}</strong>
                </div>
            `;
        }).join('')
        : '<div class="hv-empty">No messages yet. Start the team thread.</div>';

    els.leagueChatSnapshot.innerHTML = `
        <div class="hv-team-chat-inline">
            <a class="hv-team-chat-head" href="${escapeHtml(roomHref(room))}">
                <strong>${escapeHtml(room.name || room.title || 'Team chat')}</strong>
                <span>${escapeHtml(roomPreview(room))}</span>
            </a>
            <div class="hv-team-chat-messages">
                ${messageHtml}
            </div>
            <div class="hv-team-chat-compose">
                <input type="text" data-team-chat-input maxlength="500" placeholder="Message your team..." aria-label="Message your team">
                <button type="button" data-team-chat-send>Send</button>
            </div>
        </div>
    `;
}

async function loadLeagueChatRooms() {
    if (!auth.currentUser || !currentPlayer?.id) {
        activeTeamChatRoom = null;
        renderTeamChatInterface(null, []);
        return;
    }

    try {
        const result = await callFunction('getPlayerChatRooms', {});
        const rooms = result?.success ? (result.rooms || {}) : {};
        const teamRoom = (rooms.team || [])[0] || null;
        activeTeamChatRoom = teamRoom;
        if (!teamRoom) {
            renderTeamChatInterface(null, []);
            return;
        }
        renderTeamChatInterface(teamRoom, [], true);
        const messageResult = await callFunction('getChatRoomMessages', {
            room_id: teamRoom.id || teamRoom.room_id,
            limit: 12
        });
        renderTeamChatInterface(teamRoom, messageResult?.success ? (messageResult.messages || []) : []);
    } catch (error) {
        activeTeamChatRoom = null;
        renderTeamChatInterface(null, []);
    }
}

async function sendTeamChatMessage(button) {
    const roomId = activeTeamChatRoom?.id || activeTeamChatRoom?.room_id;
    const input = els.leagueChatSnapshot?.querySelector('[data-team-chat-input]');
    const text = input?.value?.trim();
    if (!roomId || !text) return;
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending';
    try {
        await callFunction('sendChatMessage', { room_id: roomId, text });
        input.value = '';
        const messageResult = await callFunction('getChatRoomMessages', { room_id: roomId, limit: 12 });
        renderTeamChatInterface(activeTeamChatRoom, messageResult?.success ? (messageResult.messages || []) : []);
    } catch (error) {
        notifyUser('Could not send team message.', 'error');
    } finally {
        button.disabled = false;
        button.textContent = previous;
    }
}

function renderOnline(data) {
    const players = data?.online_players || [];
    els.onlineCount.textContent = String(data?.count ?? players.length ?? 0);
    els.onlinePlayers.innerHTML = players.length
        ? players.slice(0, 8).map(p => {
            const name = p.player_name || p.name || 'Player';
            const id = p.player_id || p.id || '';
            return `<a class="hv-chip" href="${id ? `/rookies/pages/player-profile-vnext.html?id=${escapeHtml(id)}` : '/rookies/pages/messages-vnext.html'}">${escapeHtml(name)}</a>`;
        }).join('')
        : '<span class="hv-meta">No one is online yet. Open chat to leave a message or send a challenge request.</span>';
}

function renderActiveMatches(data) {
    const matches = data?.matches || data?.online_matches || [];
    els.challengeCount.textContent = String(matches.length || 0);
    const activeList = document.getElementById('activeGamesList');
    if (!activeList) return;
    activeList.innerHTML = matches.length
        ? matches.slice(0, 3).map(match => `
            <a class="hv-chat-preview" href="${escapeHtml(match.scorer_url || match.url || '/rookies/pages/messages-vnext.html')}">
                <span>
                    <strong>${escapeHtml(match.title || match.match_name || 'Live match')}</strong>
                    <span>${escapeHtml(match.status || 'In progress')}</span>
                </span>
            </a>
        `).join('')
        : '<div class="hv-meta">No live games right now.</div>';
}

function renderFeed(items) {
    if (!items.length) {
        renderEmpty(els.activityFeed, 'No recent league activity yet.');
        return;
    }

    els.activityFeed.innerHTML = items.slice(0, 8).map(item => {
        const data = item.data || {};
        const title = item.title || data.title || item.message || 'League update';
        const detail = data.summary || data.description || data.body || item.description || item.type || 'Recent Rookies darts activity';
        const created = asDate(item.created_at || data.created_at || item.timestamp);
        return `
            <article class="hv-feed-item">
                <strong>${escapeHtml(title)}</strong>
                <span class="hv-meta">${escapeHtml(detail)}</span>
                ${created ? `<span class="hv-meta">${escapeHtml(formatDate(created))}</span>` : ''}
            </article>
        `;
    }).join('');
}

function renderHappeningsLeagues(teams = [], matches = []) {
    if (!els.happeningsLeagueList) return;
    const completed = matches.filter(match => match.status === 'completed').length;
    const upcoming = matches.filter(match => match.status !== 'completed' && getMatchDate(match)).length;
    const playoffMatches = matches.filter(match => match.season_phase === 'playoffs' || match.match_type === 'playoff');
    const activePlayoffs = playoffMatches.some(match => match.status !== 'completed');
    const teamCount = teams.length;
    const detail = [
        teamCount ? `${teamCount} teams` : 'League standings',
        completed ? `${completed} results` : null,
        upcoming ? `${upcoming} upcoming` : null
    ].filter(Boolean).join(' - ');

    els.happeningsLeagueList.innerHTML = `
        <article class="hv-event-card hv-action-card">
            <strong>2026 Triples League</strong>
            <span class="hv-meta">${escapeHtml(detail || 'Standings, schedule, playoffs, and match hubs')}</span>
            <div class="hv-pill-row">
                <span class="hv-pill">${activePlayoffs ? 'Playoffs live' : 'League'}</span>
                ${playoffMatches.length ? '<span class="hv-pill">Top 6 bracket</span>' : ''}
            </div>
            <div class="hv-card-actions">
                <a href="/rookies/pages/triples-vnext.html">View</a>
                <a href="/rookies/pages/messages-vnext.html?source=league&league_id=${TRIPLES_LEAGUE_ID}">Discuss</a>
            </div>
        </article>
    `;
}

function renderEvents(events) {
    if (!events.length) {
        renderEmpty(els.eventList, 'No upcoming events yet. Browse events or create one when you are ready to run something.');
        return;
    }

    els.eventList.innerHTML = events.slice(0, 6).map(event => {
        const eventDate = asDate(event.date || event.start_date || event.event_date || event.created_at);
        const mode = formatEventMode(event);
        const registrations = Number(event.registration_count ?? event.registered_count ?? event.current_players ?? 0);
        const capacity = Number(event.capacity ?? event.max_players ?? event.max_teams ?? 0);
        const rawStatus = String(event.status || 'registration');
        const status = formatEventStatus(rawStatus);
        const openForRegistration = ['registration', 'open', 'scheduled', 'published'].includes(rawStatus.toLowerCase());
        const viewHref = `/rookies/pages/tournament-view-vnext.html?tournament_id=${escapeHtml(event.id)}`;
        const discussHref = `/rookies/pages/messages-vnext.html?source=events&tournament_id=${escapeHtml(event.id)}`;
        const signupHref = `/rookies/pages/tournament-register-vnext.html?tournament_id=${escapeHtml(event.id)}`;
        return `
            <article class="hv-event-card hv-action-card">
                <strong>${escapeHtml(event.name || event.title || 'Tournament')}</strong>
                <span class="hv-meta">${escapeHtml(formatDate(eventDate))} - ${escapeHtml(mode)}</span>
                <div class="hv-pill-row">
                    <span class="hv-pill">${escapeHtml(status)}</span>
                    ${capacity ? `<span class="hv-pill">${registrations}/${capacity} signed up</span>` : ''}
                </div>
                <div class="hv-card-actions">
                    <a href="${viewHref}">View</a>
                    <a href="${discussHref}">Discuss</a>
                    ${openForRegistration ? `<a href="${signupHref}">Sign Up</a>` : '<span>Closed</span>'}
                </div>
            </article>
        `;
    }).join('');
}

function formatEventMode(event) {
    if (event.is_online) return 'Online';
    const raw = String(event.location_mode || event.venue_type || '').trim().toLowerCase();
    const labels = {
        in_person: 'In person',
        inperson: 'In person',
        venue: 'In person',
        hybrid: 'Hybrid',
        online: 'Online'
    };
    return labels[raw] || (raw ? titleCase(raw.replace(/[_-]+/g, ' ')) : 'Event');
}

function formatEventStatus(status) {
    const raw = String(status || '').trim().toLowerCase();
    const labels = {
        registration: 'Registration open',
        open: 'Open',
        scheduled: 'Scheduled',
        published: 'Published',
        in_progress: 'In progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
        canceled: 'Cancelled'
    };
    return labels[raw] || titleCase(raw.replace(/[_-]+/g, ' ')) || 'Event';
}

function titleCase(value) {
    return String(value || '').replace(/\b\w/g, char => char.toUpperCase());
}

function eventDateValue(event) {
    return asDate(event.date || event.start_date || event.event_date || event.created_at);
}

function isCompletedEvent(event) {
    return ['completed', 'deleted', 'archived', 'cancelled', 'canceled'].includes(String(event.status || '').toLowerCase());
}

function sortEventsForDisplay(a, b) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ad = eventDateValue(a);
    const bd = eventDateValue(b);
    const aUpcoming = !isCompletedEvent(a) && (!ad || ad >= today);
    const bUpcoming = !isCompletedEvent(b) && (!bd || bd >= today);
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    if (aUpcoming) return (ad || new Date(8640000000000000)) - (bd || new Date(8640000000000000));
    return (bd || new Date(0)) - (ad || new Date(0));
}

function publicEventTime(event) {
    return event?.start_time || event?.startTime || event?.time || '7:00 PM';
}

function renderPublicEventBanner(events = []) {
    if (!els.publicEventTitle) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sorted = [...events]
        .filter(event => event.demo_tenant === 'rookies' || event.id === DEMO_TOURNAMENT_ID || event.id === NEXT_WING_TOURNAMENT_ID)
        .filter(event => !['deleted', 'archived'].includes(String(event.status || '').toLowerCase()))
        .sort(sortEventsForDisplay);
    const upcoming = sorted.find(event => {
        const date = eventDateValue(event);
        return !isCompletedEvent(event) && (!date || date >= today);
    }) || sorted[0] || null;
    if (!upcoming) return;

    const date = eventDateValue(upcoming);
    const title = upcoming.name || upcoming.title || 'Wing It Wednesdays';
    const time = publicEventTime(upcoming);
    const href = `/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(upcoming.id)}`;
    els.publicEventEyebrow.textContent = date ? formatDate(date) : 'This Wednesday';
    els.publicEventTitle.textContent = title.replace(/\s+#\d+\b/i, '');
    els.publicEventMeta.textContent = `${time} - ${upcoming.format_label || 'Blind draw darts'} - Open to the public`;
    els.publicEventCta.href = href;
    if (els.publicUpcomingTitle) els.publicUpcomingTitle.textContent = title.replace(/\s+#\d+\b/i, '');
    if (els.publicUpcomingMeta) {
        els.publicUpcomingMeta.textContent = date
            ? `${formatDate(date)} at ${time}`
            : `Every Wednesday this summer at ${time}`;
    }
}

function renderPublicLeaguePulse(snapshot = {}) {
    const teams = snapshot?.teams || [];
    const teamsById = Object.fromEntries(teams.map(team => [team.id, team]));
    const matches = snapshot?.matches || [];
    const leaguePlayers = snapshot?.leaguePlayers || [];
    const statsById = snapshot?.statsById || {};
    const playoffMatches = matches
        .filter(match => match.season_phase === 'playoffs' || match.match_type === 'playoff' || match.playoff_round || match.playoff_match_key)
        .map(match => ({ ...match, dateObj: getMatchDate(match) }))
        .sort((a, b) => (a.dateObj || new Date(0)) - (b.dateObj || new Date(0)));
    const nextPlayoff = playoffMatches.find(match => match.status !== 'completed') || playoffMatches[0];
    if (nextPlayoff && els.publicCurrentTitle) {
        const home = compactTeamName(nextPlayoff.home_team_name || getTeamName(teamsById[nextPlayoff.home_team_id]));
        const away = compactTeamName(nextPlayoff.away_team_name || getTeamName(teamsById[nextPlayoff.away_team_id]));
        const round = playoffRoundLabel(nextPlayoff, playoffRoundNumber(nextPlayoff));
        els.publicCurrentTitle.textContent = `${home} vs ${away}`;
        els.publicCurrentMeta.textContent = [round, nextPlayoff.dateObj ? formatDate(nextPlayoff.dateObj) : 'Playoff bracket'].filter(Boolean).join(' - ');
    }

    const latestCompleted = [...matches]
        .map(match => ({ ...match, dateObj: getMatchDate(match) }))
        .filter(match => match.status === 'completed')
        .sort((a, b) => (b.dateObj || new Date(0)) - (a.dateObj || new Date(0)))[0];
    if (latestCompleted && els.publicRecentTitle) {
        const home = compactTeamName(latestCompleted.home_team_name || getTeamName(teamsById[latestCompleted.home_team_id]));
        const away = compactTeamName(latestCompleted.away_team_name || getTeamName(teamsById[latestCompleted.away_team_id]));
        els.publicRecentTitle.textContent = `${home} ${Number(latestCompleted.home_score || 0)} - ${Number(latestCompleted.away_score || 0)} ${away}`;
        els.publicRecentMeta.textContent = latestCompleted.season_phase === 'playoffs' || latestCompleted.match_type === 'playoff'
            ? 'Latest playoff result'
            : `Week ${latestCompleted.week || '?'} result`;
    }

    renderPublicRecognition(leaguePlayers, statsById, teamsById);
}

function renderPublicRecognition(leaguePlayers = [], statsById = {}, teamsById = {}) {
    if (!els.publicRecognitionList) return;
    const levels = ['A', 'B', 'C'];
    const rows = levels.map(level => {
        const candidates = leaguePlayers
            .filter(player => playerLevel(player) === level)
            .map(player => {
                const stats = statsById[player.id] || {};
                const threeDa = finiteStat(stats.x01_three_dart_avg ?? stats.avg_3da ?? player.x01_three_dart_avg ?? player.avg_3da);
                const mpr = finiteStat(stats.cricket_mpr ?? stats.mpr ?? player.cricket_mpr ?? player.mpr);
                return { player, stats, threeDa, mpr };
            })
            .filter(row => row.threeDa != null || row.mpr != null)
            .sort((a, b) => (b.threeDa || 0) - (a.threeDa || 0) || (b.mpr || 0) - (a.mpr || 0));
        const top = candidates[0];
        if (!top) return `<span>${level} level: building the board</span>`;
        const teamName = compactTeamName(getTeamName(teamsById[top.player.team_id]));
        const statText = top.threeDa != null ? `${formatStat(top.threeDa, 1)} 3DA` : `${formatStat(top.mpr, 2)} MPR`;
        const teamText = teamName && teamName !== 'Team' ? ` - Team ${teamName}` : '';
        return `<a href="/rookies/pages/player-profile-vnext.html?id=${escapeHtml(top.player.id)}">${escapeHtml(level)}: ${escapeHtml(shortPlayerName(top.player.name))} <em>${escapeHtml(statText)}${escapeHtml(teamText)}</em></a>`;
    });
    els.publicRecognitionList.innerHTML = rows.join('');
}

function getTeamRecordText(team) {
    if (!team) return '-';
    const wins = Number(team.wins ?? team.record?.wins ?? 0);
    const losses = Number(team.losses ?? team.record?.losses ?? 0);
    return `${wins}-${losses}`;
}

function getHeadToHeadText(matches, homeTeamId, awayTeamId) {
    const previous = matches
        .filter(match => match.status === 'completed')
        .filter(match => {
            const same = match.home_team_id === homeTeamId && match.away_team_id === awayTeamId;
            const swapped = match.home_team_id === awayTeamId && match.away_team_id === homeTeamId;
            return same || swapped;
        })
        .sort((a, b) => Number(b.week || 0) - Number(a.week || 0));

    if (!previous.length) return 'No prior result';
    const last = previous[0];
    const homeScore = Number(last.home_score || 0);
    const awayScore = Number(last.away_score || 0);
    return `W${last.week || '?'} ${last.home_team_name || 'Home'} ${homeScore}-${awayScore}`;
}

function getTeamRankMap(teams) {
    return Object.fromEntries([...teams]
        .sort((a, b) => {
            const aw = Number(a.wins ?? 0);
            const bw = Number(b.wins ?? 0);
            const ap = Number(a.points ?? a.games_won ?? 0);
            const bp = Number(b.points ?? b.games_won ?? 0);
            const al = Number(a.losses ?? 0);
            const bl = Number(b.losses ?? 0);
            if (bw !== aw) return bw - aw;
            if (bp !== ap) return bp - ap;
            return al - bl;
        })
        .map((team, index) => [team.id, index + 1]));
}

async function fetchTriplesDataSnapshot() {
    const leagueRef = collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'players');
    const [teamsSnap, matchesSnap, playersSnap, statsSnap, feedSnap] = await Promise.all([
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'teams')),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'matches')),
        getDocs(leagueRef),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'stats')).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'feed'), orderBy('created_at', 'desc'), limit(5))).catch(() => ({ docs: [] }))
    ]);

    return {
        teams: teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        matches: matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        leaguePlayers: playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        statsById: Object.fromEntries(statsSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])),
        feed: feedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
}

function renderTriplesDataSnapshot(snapshot) {
    const teams = snapshot?.teams || [];
    const teamsById = Object.fromEntries(teams.map(team => [team.id, team]));
    const rankByTeamId = getTeamRankMap(teams);
    const matches = snapshot?.matches || [];
    const leaguePlayers = snapshot?.leaguePlayers || [];
    const statsById = snapshot?.statsById || {};
    const feed = snapshot?.feed || [];
    const currentLeaguePlayer = findLeaguePlayerForCurrentUser(leaguePlayers);
    if (currentLeaguePlayer) {
        renderIdentity(currentPlayer, mergeIdentityStats(window.__homeVnextIdentityStats || {}, currentLeaguePlayer, statsById[currentLeaguePlayer.id]));
    }

    const myTeamIds = getPlayerTeamIds(currentPlayer, leaguePlayers);
    currentLeagueContext.teamId = [...myTeamIds][0] || null;
    if (els.captainToolsLink && currentLeagueContext.teamId) {
        els.captainToolsLink.href = `/rookies/pages/captain-dashboard-vnext.html?league_id=${encodeURIComponent(TRIPLES_LEAGUE_ID)}&team_id=${encodeURIComponent(currentLeagueContext.teamId)}`;
    }
    renderStandings(teams, matches, myTeamIds, leaguePlayers, statsById);
    renderLeaguePlayerStats(
        currentLeaguePlayer,
        currentLeaguePlayer?.id ? statsById[currentLeaguePlayer.id] : {},
        teamsById[currentLeaguePlayer?.team_id],
        leaguePlayers,
        statsById,
        teamsById
    );
    renderHappeningsLeagues(teams, matches);
    renderLeagueChatRooms();
    loadLeagueChatRooms();
    renderFeed(feed);
    renderPublicLeaguePulse(snapshot);

    if (!currentPlayer?.id || !myTeamIds.size) {
        return [];
    }

    const upcomingMatches = matches
        .map(match => ({ ...match, dateObj: getMatchDate(match) }))
        .filter(match => match.status !== 'completed' && match.dateObj)
        .filter(match => myTeamIds.has(match.home_team_id) || myTeamIds.has(match.away_team_id))
        .sort((a, b) => a.dateObj - b.dateObj)
        .map(match => {
            const homeTeam = teamsById[match.home_team_id];
            const awayTeam = teamsById[match.away_team_id];
            const mySide = myTeamIds.has(match.home_team_id) ? 'home' : (myTeamIds.has(match.away_team_id) ? 'away' : null);
            const normalizeRosterPlayer = player => {
                const statDoc = player?.id ? statsById[player.id] : null;
                return {
                    name: player?.name || 'Player',
                    level: playerLevel(player),
                    threeDa: formatStat(player?.x01_three_dart_avg ?? player?.avg_3da ?? statDoc?.x01_three_dart_avg ?? statDoc?.avg_3da, 1),
                    mpr: formatStat(player?.cricket_mpr ?? player?.mpr ?? statDoc?.cricket_mpr ?? statDoc?.mpr, 2),
                    threeDaRaw: finiteStat(player?.x01_three_dart_avg ?? player?.avg_3da ?? statDoc?.x01_three_dart_avg ?? statDoc?.avg_3da),
                    mprRaw: finiteStat(player?.cricket_mpr ?? player?.mpr ?? statDoc?.cricket_mpr ?? statDoc?.mpr)
                };
            };
            const homePlayers = sortRosterByLevel(homeTeam?.players || []).map(normalizeRosterPlayer).filter(player => player.name);
            const awayPlayers = sortRosterByLevel(awayTeam?.players || []).map(normalizeRosterPlayer).filter(player => player.name);
            homePlayers.forEach(player => { player.threeDa = player.threeDaRaw != null ? player.threeDa : '-'; player.mpr = player.mprRaw != null ? player.mpr : '-'; });
            awayPlayers.forEach(player => { player.threeDa = player.threeDaRaw != null ? player.threeDa : '-'; player.mpr = player.mprRaw != null ? player.mpr : '-'; });
            const myRoster = mySide === 'away' ? awayPlayers : homePlayers;
            const opponentRoster = mySide === 'away' ? homePlayers : awayPlayers;
            const isPlayoff = match.season_phase === 'playoffs' || match.match_type === 'playoff';
            const targetScore = Number(match.playoff_target_score || match.sets_to_win || match.match_sets_to_win || (isPlayoff ? 5 : 9));
            return {
            leagueId: TRIPLES_LEAGUE_ID,
            matchId: match.id,
            myTeamId: mySide === 'away' ? match.away_team_id : match.home_team_id,
            type: isPlayoff ? 'Playoff match' : 'League match',
            date: match.dateObj,
            title: `${match.home_team_name || 'Home'} vs ${match.away_team_name || 'Away'}`,
            detail: isPlayoff ? '2026 Triples League Playoffs' : `2026 Triples League - Week ${match.week || '?'}`,
            homeTeamName: match.home_team_name || getTeamName(homeTeam),
            awayTeamName: match.away_team_name || getTeamName(awayTeam),
            homeRecord: getTeamRecordText(homeTeam),
            awayRecord: getTeamRecordText(awayTeam),
            homeRank: isPlayoff ? Number(match.home_seed || 0) || null : rankByTeamId[match.home_team_id] || null,
            awayRank: isPlayoff ? Number(match.away_seed || 0) || null : rankByTeamId[match.away_team_id] || null,
            mySide,
            myAvailability: match.player_availability?.[currentPlayer?.id] || '',
            myPlayers: myRoster,
            opponentPlayers: opponentRoster,
            my3da: calcRosterAverage(myRoster, ['threeDaRaw'], 1),
            myMpr: calcRosterAverage(myRoster, ['mprRaw'], 2),
            opponent3da: calcRosterAverage(opponentRoster, ['threeDaRaw'], 1),
            opponentMpr: calcRosterAverage(opponentRoster, ['mprRaw'], 2),
            homeMeta: `#${rankByTeamId[match.home_team_id] || '-'} - ${getTeamRecordText(homeTeam)}${mySide === 'home' ? ' - Your team' : ''}`,
            awayMeta: `#${rankByTeamId[match.away_team_id] || '-'} - ${getTeamRecordText(awayTeam)}${mySide === 'away' ? ' - Your team' : ''}`,
            h2hText: getHeadToHeadText(matches, match.home_team_id, match.away_team_id),
            scoreText: match.status === 'completed' ? `${match.home_score || 0}-${match.away_score || 0}` : `${targetScore} sets`,
            targetScore,
            href: `/rookies/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${match.id}`
        };
        });

    return upcomingMatches;
}

async function loadTriplesData() {
    const cached = readCache(TRIPLES_CACHE_KEY, TRIPLES_CACHE_TTL_MS);
    if (cached) {
        const cachedItems = renderTriplesDataSnapshot(cached);
        fetchTriplesDataSnapshot()
            .then(fresh => {
                writeCache(TRIPLES_CACHE_KEY, fresh);
                const freshItems = renderTriplesDataSnapshot(fresh);
                const scheduleItems = freshItems.filter(item => item.date).sort((a, b) => a.date - b.date);
                renderSchedule(scheduleItems);
                renderMatchNightCard(freshItems[0] || scheduleItems[0] || null);
            })
            .catch(error => console.warn('Could not refresh Triples cache:', error));
        return cachedItems;
    }

    const fresh = await fetchTriplesDataSnapshot();
    writeCache(TRIPLES_CACHE_KEY, fresh);
    return renderTriplesDataSnapshot(fresh);
}

function renderRecentChats(conversations = []) {
    if (!els.recentChatList) return;
    if (!conversations.length) {
        els.recentChatList.innerHTML = `<div class="hv-meta">${auth.currentUser ? 'No recent direct messages yet.' : 'Log in to see team rooms and direct messages.'}</div>`;
        return;
    }

    els.recentChatList.innerHTML = conversations.slice(0, 5).map(conv => {
        const other = conv.other_participant || {};
        const preview = conv.last_message?.text || 'No messages yet';
        const unread = Number(conv.unread_count || 0);
        const conversationId = conv.id || conv.conversation_id || '';
        const href = conversationId ? `/rookies/pages/messages-vnext.html?conversation_id=${escapeHtml(conversationId)}` : '/rookies/pages/messages-vnext.html';
        return `
            <a class="hv-chat-preview" href="${href}">
                <span>
                    <strong>${escapeHtml(other.name || 'Player')}</strong>
                    <span>${escapeHtml(preview)}</span>
                </span>
                ${unread > 0 ? `<em>${unread}</em>` : ''}
            </a>
        `;
    }).join('');
}

async function loadRecentChats() {
    if (!auth.currentUser || !currentPlayer?.id) {
        renderRecentChats([]);
        return;
    }

    try {
        const result = await callFunction('getConversations', {});
        renderRecentChats(result?.success ? (result.conversations || []) : []);
    } catch (error) {
        renderRecentChats([]);
    }
}

async function loadEvents() {
    try {
        const snap = await getDocs(collection(db, 'tournaments'));
        const events = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(event => event.demo_tenant === 'rookies' || event.id === DEMO_TOURNAMENT_ID)
            .filter(event => !['deleted', 'archived'].includes(String(event.status || '').toLowerCase()))
            .sort(sortEventsForDisplay);
        renderEvents(events);
        renderPublicEventBanner(events);
        return events.slice(0, 3).map(event => ({
            type: event.is_online ? 'Online tournament' : 'Tournament',
            date: eventDateValue(event),
            title: event.name || event.title || 'Tournament',
            detail: event.is_online ? 'Online event room' : (event.venue_name || event.location_mode || 'Tournament event'),
            href: `/rookies/pages/tournament-view-vnext.html?tournament_id=${event.id}`
        }));
    } catch (error) {
        console.warn('Could not load tournaments for dashboard:', error);
        renderEmpty(els.eventList, 'Tournament list unavailable.');
        return [];
    }
}

function buildEventItems(events = []) {
    const sorted = events
        .filter(event => event.demo_tenant === 'rookies' || event.id === DEMO_TOURNAMENT_ID)
        .filter(event => !['deleted', 'archived'].includes(String(event.status || '').toLowerCase()))
        .sort(sortEventsForDisplay);
    renderEvents(sorted);
    renderPublicEventBanner(sorted);
    return sorted.slice(0, 3).map(event => ({
        type: event.is_online ? 'Online tournament' : 'Tournament',
        date: eventDateValue(event),
        title: event.name || event.title || 'Tournament',
        detail: event.is_online ? 'Online event room' : (event.venue_name || event.location_mode || 'Tournament event'),
        href: `/rookies/pages/tournament-view-vnext.html?tournament_id=${event.id}`
    }));
}

async function loadHomeSummary() {
    const result = await callFunction('getVNextHomeSummary', {
        leagueId: TRIPLES_LEAGUE_ID
    });
    if (!result?.success) throw new Error(result?.error || 'Summary failed');

    currentPlayer = result.player || null;
    window.__homeVnextIdentityStats = result.identityStats || {};
    renderIdentity(currentPlayer, result.identityStats || {});

    if (result.triples) {
        writeCache(TRIPLES_CACHE_KEY, result.triples);
        const leagueItems = renderTriplesDataSnapshot(result.triples);
        const eventItems = buildEventItems(result.events || []);
        const scheduleItems = [...leagueItems, ...eventItems]
            .filter(item => item.date)
            .sort((a, b) => a.date - b.date);
        const userScheduleItems = leagueItems.length ? leagueItems : scheduleItems;
        renderSchedule(userScheduleItems);
        renderMatchNightCard(leagueItems[0] || userScheduleItems[0] || null);
        return true;
    }

    return false;
}

async function loadPublicHomeCache() {
    const snap = await getDoc(doc(db, 'leagues', TRIPLES_LEAGUE_ID, 'public_cache', HOME_PUBLIC_CACHE_KEY));
    if (!snap.exists()) return null;
    const data = snap.data() || {};

    if (data.triples) {
        writeCache(TRIPLES_CACHE_KEY, data.triples);
        const leagueItems = renderTriplesDataSnapshot(data.triples);
        const eventItems = buildEventItems(data.events || []);
        const scheduleItems = [...leagueItems, ...eventItems]
            .filter(item => item.date)
            .sort((a, b) => a.date - b.date);
        const userScheduleItems = leagueItems.length ? leagueItems : scheduleItems;
        renderSchedule(userScheduleItems);
        renderMatchNightCard(leagueItems[0] || userScheduleItems[0] || null);
        return { leagueItems, eventItems };
    }

    return null;
}

async function loadPresence() {
    if (!auth.currentUser || !currentPlayer?.id) {
        renderOnline({ count: 0, online_players: [] });
        return;
    }

    try {
        const result = await callFunction('getOnlinePlayers', {});
        if (result?.success) renderOnline(result);
        else renderOnline({ count: 0, online_players: [] });
    } catch (error) {
        renderOnline({ count: 0, online_players: [] });
    }
}

async function loadOnlineMatches() {
    if (!auth.currentUser || !currentPlayer?.id) {
        renderActiveMatches({ matches: [] });
        return;
    }

    try {
        const result = await callFunction('getActiveOnlineMatches', {});
        if (result?.success) renderActiveMatches(result);
        else renderActiveMatches({ matches: [] });
    } catch (error) {
        renderActiveMatches({ matches: [] });
    }
}

async function initHomeVNext() {
    try {
        const cachedTriples = readCache(TRIPLES_CACHE_KEY, TRIPLES_CACHE_TTL_MS);
        if (cachedTriples) {
            const cachedItems = renderTriplesDataSnapshot(cachedTriples);
            renderSchedule(cachedItems);
            renderMatchNightCard(cachedItems[0] || null);
        }

        const publicCachePromise = loadPublicHomeCache().catch(error => {
            console.warn('Could not load public home cache:', error);
            return null;
        });

        await waitForAuthReady();
        if (IS_PUBLIC_ROOKIES_HOME) {
            setPublicLandingMode(true);
            renderIdentity(null, {});

            const publicCache = await publicCachePromise;
            if (publicCache) {
                loadPresence();
                loadOnlineMatches();
                loadRecentChats();
                return;
            }

            const [leagueItems, eventItems] = await Promise.all([
                loadTriplesData().catch(error => {
                    console.warn('Could not load Triples data:', error);
                    renderEmpty(els.triplesStandings, 'Triples snapshot unavailable.');
                    renderEmpty(els.activityFeed, 'Activity unavailable.');
                    return [];
                }),
                loadEvents()
            ]);

            const scheduleItems = [...leagueItems, ...eventItems]
                .filter(item => item.date)
                .sort((a, b) => a.date - b.date);
            renderSchedule(scheduleItems);
            renderMatchNightCard(scheduleItems[0] || null);
            loadPresence();
            loadOnlineMatches();
            loadRecentChats();
            return;
        }

        setPublicLandingMode(!auth.currentUser);
        if (!auth.currentUser) {
            renderIdentity(null, {});
        } else {
            const session = await callFunction('getPlayerSession', {});
            currentPlayer = session?.player || null;
            const statsResult = await callFunction('getPlayerStatsFiltered', {
                player_id: currentPlayer?.id,
                source: 'combined'
            }).catch(() => null);
            const identityStats = mergeIdentityStats(
                statsResult?.stats || {},
                {
                    stats: currentPlayer?.stats || {},
                    unified_stats: currentPlayer?.unified_stats || currentPlayer?.stats || {}
                },
                currentPlayer?.stats || currentPlayer?.unified_stats || {}
            );
            window.__homeVnextIdentityStats = identityStats;
            renderIdentity(currentPlayer, identityStats);
        }

        const publicCache = await publicCachePromise;
        if (publicCache) {
            await loadPublicHomeCache();
            loadPresence();
            loadOnlineMatches();
            loadRecentChats();
            return;
        }

        const loadedSummary = await loadHomeSummary().catch(error => {
            console.warn('Could not load compact home summary, falling back:', error);
            return false;
        });
        if (loadedSummary) {
            loadPresence();
            loadOnlineMatches();
            loadRecentChats();
            return;
        }

        const [leagueItems, eventItems] = await Promise.all([
            loadTriplesData().catch(error => {
                console.warn('Could not load Triples data:', error);
                renderEmpty(els.triplesStandings, 'Triples snapshot unavailable.');
                renderEmpty(els.activityFeed, 'Activity unavailable.');
                return [];
            }),
            loadEvents()
        ]);

        const scheduleItems = [...leagueItems, ...eventItems]
            .filter(item => item.date)
            .sort((a, b) => a.date - b.date);
        const userScheduleItems = leagueItems.length ? leagueItems : scheduleItems;

        renderSchedule(userScheduleItems);
        renderMatchNightCard(leagueItems[0] || userScheduleItems[0] || null);

        loadPresence();
        loadOnlineMatches();
        loadRecentChats();
    } catch (error) {
        console.error('Dashboard load failed:', error);
        els.authStatus.textContent = 'Could not load home data';
        renderEmpty(els.scheduleList, 'Dashboard failed to load. Refresh and try again.');
    }
}

initViewCards();
initHomeActions();
initHomeVNext();
