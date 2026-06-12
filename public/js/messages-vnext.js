/**
 * messages-vnext.js — Clubhouse (Phase 5)
 * Areas: Lobby (default) · Chat · Trade · Members
 * Challenges + Online have moved to Arena (Phase 6).
 */
import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    collection,
    getDocs,
    doc,
    setDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit
} from '/js/firebase-config.js';

// ─── element refs ────────────────────────────────────────────────────────────

const els = {
    // hero stats
    authStatus:         document.getElementById('authStatus'),
    directCount:        document.getElementById('directCount'),
    leagueCount:        document.getElementById('leagueCount'),
    tradeCount:         document.getElementById('tradeCount'),
    memberCount:        document.getElementById('memberCount'),

    // chat rail
    directList:         document.getElementById('directList'),
    leagueList:         document.getElementById('leagueList'),
    teamList:           document.getElementById('teamList'),
    eventList:          document.getElementById('eventList'),

    // chat panel
    chatDefaultHeader:  document.getElementById('chatDefaultHeader'),
    activeThreadType:   document.getElementById('activeThreadType'),
    activeThreadName:   document.getElementById('activeThreadName'),
    teamMatchContext:   document.getElementById('teamMatchContext'),
    messageList:        document.getElementById('messageList'),
    messageForm:        document.getElementById('messageForm'),
    messageInput:       document.getElementById('messageInput'),
    sendMessageBtn:     document.getElementById('sendMessageBtn'),
    challengeThreadBtn: document.getElementById('challengeThreadBtn'),
    refreshDirectBtn:   document.getElementById('refreshDirectBtn'),

    // challenge modal
    challengeModal:     document.getElementById('challengeModal'),
    challengeTitle:     document.getElementById('challengeTitle'),
    challengeSubtitle:  document.getElementById('challengeSubtitle'),
    challengeRaceTo:    document.getElementById('challengeRaceTo'),
    challengeStartRule: document.getElementById('challengeStartRule'),
    challengeInRule:    document.getElementById('challengeInRule'),
    challengeOutRule:   document.getElementById('challengeOutRule'),
    challengeMessage:   document.getElementById('challengeMessage'),
    challengeStatus:    document.getElementById('challengeStatus'),
    sendChallengeBtn:   document.getElementById('sendChallengeBtn'),

    // lobby
    presenceList:       document.getElementById('presenceList'),
    banterList:         document.getElementById('banterList'),
    listingsPreview:    document.getElementById('listingsPreview'),
    activityList:       document.getElementById('activityList'),
    refreshPresenceBtn: document.getElementById('refreshPresenceBtn'),

    // trade
    tradeStatus:        document.getElementById('tradeStatus'),
    tradeGrid:          document.getElementById('tradeGrid'),

    // members
    membersStatus:      document.getElementById('membersStatus'),
    membersGrid:        document.getElementById('membersGrid'),
    memberSearch:       document.getElementById('memberSearch'),
    memberFilters:      document.getElementById('memberFilters')
};

// ─── shared state ─────────────────────────────────────────────────────────────

let currentPlayer = null;
let activeThread = null;
let activeSource = 'league';
let activeArea = 'lobby';
let selectedGameType = '501';
let conversations = [];
let leagueRooms = [];
let teamRooms = [];
let matchRooms = [];
let tournamentRooms = [];
const leagueContextCache = new Map();

// trade state
let tradeListings = [];
let tradeListingsLoaded = false;
let tradeActiveCategory = 'all';

// members state
const membersState = {
    players: [],
    teamsById: {},
    statsById: {},
    filter: 'all',
    search: ''
};

const DEFAULT_LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// ─── utilities ────────────────────────────────────────────────────────────────

function text(value, fallback = '') {
    return String(value ?? fallback);
}

function escapeHtml(value) {
    return text(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function initials(name = '') {
    const parts = text(name).trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || 'B').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
}

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function asDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = asDate(value);
    if (!date) return 'Date TBD';
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function teamNameOf(team) {
    return team?.name || team?.team_name || team?.display_name || 'Team';
}

function toast(message, type = 'info') {
    const fn = type === 'error' ? window.toastError : type === 'success' ? window.toastSuccess : window.toastInfo;
    if (typeof fn === 'function') fn(message);
    else console[type === 'error' ? 'error' : 'log'](message);
}

function setAuthStatus(message) {
    if (els.authStatus) els.authStatus.textContent = message;
}

function finite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function stat(value, decimals = 1) {
    const num = finite(value);
    return num == null || num <= 0 ? '-' : num.toFixed(decimals);
}

// ─── Optimistic localStorage cache (stale-while-revalidate) ──────────────────
// Mirrors home-vnext.js: render above-the-fold content INSTANTLY from last-known
// values while cold cloud functions warm up. Purely additive — the real fetch
// still runs and overwrites with fresh data.
const CLUBHOUSE_CACHE_KEY = 'brdc:vnext:clubhouse:v1';

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

// Write the current hero stats + auth name into the optimistic cache. Reads the
// rendered counts straight off the DOM so it captures whatever loaded last.
function persistClubhouseCache() {
    const num = el => {
        const n = parseInt(el?.textContent ?? '', 10);
        return Number.isFinite(n) ? n : 0;
    };
    writeLocalCache(CLUBHOUSE_CACHE_KEY, {
        directCount: num(els.directCount),
        leagueCount: num(els.leagueCount),
        tradeCount:  num(els.tradeCount),
        memberCount: num(els.memberCount),
        displayName: currentPlayer?.name || null
    });
}

// ─── Clubhouse area switching ─────────────────────────────────────────────────

function setActiveArea(name) {
    activeArea = name;
    document.querySelectorAll('[data-ch-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.chTab === name);
    });
    document.querySelectorAll('[data-ch-area]').forEach(section => {
        section.classList.toggle('hidden', section.dataset.chArea !== name);
    });
    // lazy-load data for areas as they're first visited
    if (name === 'trade' && tradeListings.length === 0) {
        loadTradeListings().catch(err => console.warn('[clubhouse] trade load:', err));
    }
    if (name === 'members' && membersState.players.length === 0) {
        loadMembers().catch(err => console.warn('[clubhouse] members load:', err));
    }
}

// ─── Chat engine (unchanged logic) ───────────────────────────────────────────

function renderLoggedOutState() {
    if (els.directCount) els.directCount.textContent = '0';
    if (els.leagueCount) els.leagueCount.textContent = '0';
    els.directList.innerHTML = '<div class="mv-empty">Log in to see direct messages.</div>';
    els.leagueList.innerHTML = '<div class="mv-empty">Log in to see league chat.</div>';
    els.teamList.innerHTML = '<div class="mv-empty">Log in to see team chat.</div>';
    els.eventList.innerHTML = '<div class="mv-empty">Log in to see event chat.</div>';
    els.messageList.innerHTML = '<div class="mv-empty large">Log in from the dashboard first.</div>';
    els.messageInput.disabled = true;
    els.sendMessageBtn.disabled = true;
    els.challengeThreadBtn.disabled = true;

    // Clear the four lobby-card skeletons so signed-out visitors see a clean
    // login prompt instead of perpetual loading bars.
    if (els.presenceList) els.presenceList.innerHTML = '<div class="mv-empty">Sign in to see who\'s here.</div>';
    if (els.banterList) els.banterList.innerHTML = '<div class="mv-empty">Sign in to read club banter.</div>';
    if (els.listingsPreview) els.listingsPreview.innerHTML = '<div class="mv-empty">Sign in to browse fresh listings.</div>';
    if (els.activityList) els.activityList.innerHTML = '<div class="mv-empty">Sign in to see recent activity.</div>';
    // Also clear the hidden Trade/Members grids so no skeletons linger in the DOM
    if (els.tradeGrid) els.tradeGrid.innerHTML = '<div class="mv-empty">Sign in to browse the trade board.</div>';
    if (els.membersGrid) els.membersGrid.innerHTML = '<div class="mv-empty">Sign in to view members.</div>';
}

function setActiveSource(name) {
    activeSource = name;
    document.querySelectorAll('[data-source-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.sourceTab === name);
    });
    document.querySelectorAll('[data-source-pane]').forEach(pane => {
        pane.classList.toggle('active', pane.dataset.sourcePane === name);
    });
}

function setActiveThread(thread) {
    activeThread = thread;
    document.querySelectorAll('.mv-thread').forEach(item => {
        item.classList.toggle('active', item.dataset.threadId === thread?.id && item.dataset.threadType === thread?.type);
    });

    if (!thread) {
        clearTeamMatchContext();
        els.activeThreadType.textContent = 'Select a thread';
        els.activeThreadName.textContent = 'Chat';
        els.messageList.innerHTML = '<div class="mv-empty large">Choose a chat to start.</div>';
        els.messageInput.disabled = true;
        els.sendMessageBtn.disabled = true;
        els.challengeThreadBtn.disabled = true;
        return;
    }

    els.activeThreadType.textContent = thread.type === 'conversation' ? 'Direct message' : `${thread.roomType || 'Room'} chat`;
    els.activeThreadName.textContent = thread.name;
    els.messageInput.disabled = false;
    els.sendMessageBtn.disabled = false;
    els.challengeThreadBtn.disabled = thread.type !== 'conversation';
    updateTeamMatchContext(thread);
}

function renderThreadList(container, items, emptyText) {
    if (!items.length) {
        container.innerHTML = `<div class="mv-empty">${escapeHtml(emptyText)}</div>`;
        return;
    }
    container.innerHTML = items.map(item => `
        <button class="mv-thread" type="button" data-thread-type="${escapeHtml(item.type)}" data-thread-id="${escapeHtml(item.id)}">
            <span class="mv-avatar">${escapeHtml(initials(item.name))}</span>
            <span>
                <span class="mv-thread-title">${escapeHtml(item.name)}</span>
                <span class="mv-thread-preview">${escapeHtml(item.preview || 'No messages yet')}</span>
            </span>
            <span>
                <span class="mv-thread-meta">${escapeHtml(item.time || '')}</span>
                ${item.unread ? `<span class="mv-unread">${item.unread}</span>` : ''}
            </span>
        </button>
    `).join('');

    container.querySelectorAll('.mv-thread').forEach(button => {
        button.addEventListener('click', () => {
            const item = items.find(candidate => candidate.id === button.dataset.threadId && candidate.type === button.dataset.threadType);
            if (item) openThread(item);
        });
    });
}

function normalizeConversation(conv) {
    const other = conv.other_participant || {};
    return {
        type: 'conversation',
        id: conv.id || conv.conversation_id,
        recipientId: other.id || other.player_id,
        name: other.name || 'Unknown player',
        preview: conv.last_message?.text || 'No messages yet',
        time: formatTime(conv.updated_at || conv.last_message?.timestamp),
        unread: conv.unread_count || 0
    };
}

function normalizeRoom(room) {
    return {
        type: 'room',
        roomType: room.type || 'room',
        id: room.id || room.room_id,
        leagueId: room.league_id || '',
        teamId: room.team_id || '',
        matchId: room.match_id || '',
        tournamentId: room.tournament_id || '',
        tournamentIds: room.tournament_ids || [],
        seriesId: room.series_id || '',
        seriesName: room.series_name || '',
        name: room.name || 'Room',
        preview: room.last_message?.text || `${room.participant_count || 0} players`,
        time: formatTime(room.updated_at || room.last_message?.timestamp),
        unread: room.unread_count || 0
    };
}

function renderMessages(messages = []) {
    if (!messages.length) {
        els.messageList.innerHTML = '<div class="mv-empty large">No messages yet.</div>';
        return;
    }
    els.messageList.innerHTML = messages.map(message => {
        const own = message.is_own || message.sender_id === currentPlayer?.id;
        const type = message.type === 'challenge' ? 'challenge' : '';
        const challenge = type ? getChallengeMessageData(message) : null;
        return `
            <article class="mv-message ${own ? 'own' : ''} ${type}">
                <strong>${escapeHtml(own ? 'You' : (message.sender_name || 'Player'))} <span class="mv-message-meta">${escapeHtml(formatTime(message.timestamp))}</span></strong>
                ${challenge ? renderChallengeBubble(challenge) : `<p>${escapeHtml(message.text || '')}</p>`}
            </article>
        `;
    }).join('');
    els.messageList.scrollTop = els.messageList.scrollHeight;
}

function getChallengeMessageData(message) {
    const data = message.challenge || message.challenge_data || message.payload || {};
    return {
        gameType: data.game_type || message.game_type || '501',
        raceTo: data.race_to || message.race_to || 3,
        status: data.status || message.status || 'pending',
        url: data.scorer_url || message.scorer_url || data.url || '',
        text: message.text || data.message || 'Challenge request'
    };
}

function renderChallengeBubble(challenge) {
    const url = challenge.url ? String(challenge.url) : '';
    return `
        <div class="mv-challenge-card">
            <header>
                <strong>${escapeHtml(challenge.gameType)} challenge</strong>
                <span>${escapeHtml(challenge.status)}</span>
            </header>
            <p>${escapeHtml(challenge.text)}</p>
            <div class="mv-challenge-settings">
                <span>Race to ${escapeHtml(challenge.raceTo)}</span>
                <span>Scorer ready</span>
            </div>
            ${url ? `<a href="${escapeHtml(url)}">Open scorer</a>` : '<em>Waiting for response</em>'}
        </div>
    `;
}

async function openThread(thread) {
    setActiveThread(thread);
    // ensure we're on the chat area
    if (activeArea !== 'chat') setActiveArea('chat');
    els.messageList.innerHTML = '<div class="mv-empty large">Loading...</div>';

    try {
        const result = thread.type === 'conversation'
            ? await callFunction('getConversationMessages', { conversation_id: thread.id, limit: 60 })
            : await callFunction('getChatRoomMessages', { room_id: thread.id, limit: 60 });
        if (!result?.success) throw new Error(result?.error || 'Could not load messages');
        renderMessages(result.messages || []);
    } catch (error) {
        console.error('[clubhouse] load thread failed:', error);
        els.messageList.innerHTML = `<div class="mv-empty large">${escapeHtml(error.message || 'Could not load messages')}</div>`;
    }
}

function clearTeamMatchContext() {
    if (!els.teamMatchContext) return;
    els.teamMatchContext.classList.add('hidden');
    els.teamMatchContext.innerHTML = '';
    els.chatDefaultHeader?.classList.remove('hidden');
}

async function loadLeagueContext(leagueId) {
    if (!leagueId) return { teams: [], matches: [], players: [], statsById: {} };
    if (leagueContextCache.has(leagueId)) return leagueContextCache.get(leagueId);

    const promise = Promise.all([
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'matches')),
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]).then(([teamsSnap, matchesSnap, playersSnap, statsSnap]) => ({
        teams: teamsSnap.docs.map(item => ({ id: item.id, ...item.data() })),
        matches: matchesSnap.docs.map(item => ({ id: item.id, ...item.data() })),
        players: playersSnap.docs.map(item => ({ id: item.id, ...item.data() })),
        statsById: Object.fromEntries(statsSnap.docs.map(item => [item.id, item.data()]))
    }));

    leagueContextCache.set(leagueId, promise);
    return promise;
}

function matchDate(match) {
    return asDate(match.match_date || match.scheduled_date || match.date || match.start_time);
}

function getNextTeamMatch(matches, teamId) {
    const now = new Date();
    const teamMatches = matches
        .filter(match => match.home_team_id === teamId || match.away_team_id === teamId)
        .filter(match => match.status !== 'completed');
    const upcoming = teamMatches
        .filter(match => {
            const date = matchDate(match);
            return !date || date >= new Date(now.getTime() - 12 * 60 * 60 * 1000);
        })
        .sort((a, b) => (matchDate(a)?.getTime() || 0) - (matchDate(b)?.getTime() || 0));
    return upcoming[0] || teamMatches.sort((a, b) => (matchDate(b)?.getTime() || 0) - (matchDate(a)?.getTime() || 0))[0] || null;
}

function compactTeamName(value) {
    return text(value).replace(/^Team\s+/i, '').trim() || 'Team';
}

function targetSets(match) {
    const target = Number(match?.playoff_target_score || match?.sets_to_win || match?.match_sets_to_win || (match?.season_phase === 'playoffs' || match?.match_type === 'playoff' ? 5 : 9));
    return Number.isFinite(target) && target > 0 ? target : 5;
}

function formatScore(match, teamId) {
    const homeScore = Number(match.home_score ?? 0);
    const awayScore = Number(match.away_score ?? 0);
    const home = match.home_team_id === teamId;
    return home ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`;
}

function previousMeetings(matches, match, teamId, opponentTeamId) {
    return matches
        .filter(item => item.id !== match.id)
        .filter(item => item.status === 'completed')
        .filter(item => {
            const sameDirection = item.home_team_id === teamId && item.away_team_id === opponentTeamId;
            const reverseDirection = item.home_team_id === opponentTeamId && item.away_team_id === teamId;
            return sameDirection || reverseDirection;
        })
        .sort((a, b) => (matchDate(b)?.getTime() || 0) - (matchDate(a)?.getTime() || 0))
        .slice(0, 2);
}

function playerRoster(players, teamId) {
    return players
        .filter(player => player.team_id === teamId && !player.is_fill_in && !player.is_fillin && !player.fill_in)
        .sort((a, b) => Number(a.position || 99) - Number(b.position || 99));
}

function statNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function playerStatsFor(player, statsById) {
    const stats = statsById[player?.id] || {};
    const embedded = player?.stats || player?.unified_stats || {};
    const threeDa = statNumber(stats.x01_three_dart_avg ?? embedded.x01_three_dart_avg ?? embedded.three_dart_avg);
    const mpr = statNumber(stats.cricket_mpr ?? embedded.cricket_mpr ?? embedded.mpr);
    return { threeDa, mpr };
}

function playerStatLine(player, statsById) {
    const { threeDa, mpr } = playerStatsFor(player, statsById);
    return `${threeDa == null ? '-' : threeDa.toFixed(1)} / ${mpr == null ? '-' : mpr.toFixed(2)}`;
}

function renderPlayerVsRows(players, statsById, myTeamId, opponentTeamId) {
    const mine = playerRoster(players, myTeamId);
    const opponents = playerRoster(players, opponentTeamId);
    const rowCount = Math.max(mine.length, opponents.length, 3);
    return Array.from({ length: rowCount }).map((_, index) => {
        const myPlayer = mine[index];
        const opponentPlayer = opponents[index];
        const myStats = playerStatsFor(myPlayer, statsById);
        const opponentStats = playerStatsFor(opponentPlayer, statsById);
        const myScore = (myStats.threeDa || 0) + ((myStats.mpr || 0) * 15);
        const opponentScore = (opponentStats.threeDa || 0) + ((opponentStats.mpr || 0) * 15);
        const myEdge = myPlayer && opponentPlayer && myScore > opponentScore + 1.5;
        const opponentEdge = myPlayer && opponentPlayer && opponentScore > myScore + 1.5;
        const level = myPlayer?.level || myPlayer?.skill_level || opponentPlayer?.level || opponentPlayer?.skill_level || String(index + 1);
        return `
            <div class="mv-match-player-row">
                <strong class="mv-match-level">${escapeHtml(level)}</strong>
                <span class="${myEdge ? 'edge' : ''}">${escapeHtml(myPlayer?.name || 'TBD')}<em>${escapeHtml(myPlayer ? playerStatLine(myPlayer, statsById) : '- / -')}${myEdge ? ' edge' : ''}</em></span>
                <span class="${opponentEdge ? 'edge' : ''}">${escapeHtml(opponentPlayer?.name || 'TBD')}<em>${escapeHtml(opponentPlayer ? playerStatLine(opponentPlayer, statsById) : '- / -')}${opponentEdge ? ' edge' : ''}</em></span>
            </div>
        `;
    }).join('');
}

function renderPreviousMeetingRows(meetings, teamId, teamsById) {
    if (!meetings.length) return '<div class="mv-match-mini-empty">No previous meetings this season.</div>';
    return meetings.map(item => {
        const opponentId = item.home_team_id === teamId ? item.away_team_id : item.home_team_id;
        const opponent = item.home_team_id === teamId
            ? (item.away_team_name || teamNameOf(teamsById[opponentId]))
            : (item.home_team_name || teamNameOf(teamsById[opponentId]));
        const teamScore = item.home_team_id === teamId ? Number(item.home_score || 0) : Number(item.away_score || 0);
        const opponentScore = item.home_team_id === teamId ? Number(item.away_score || 0) : Number(item.home_score || 0);
        const result = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T';
        return `
            <div class="mv-match-history-row ${result === 'W' ? 'win' : result === 'L' ? 'loss' : ''}">
                <span>Week ${escapeHtml(item.week || '?')}</span>
                <strong>${escapeHtml(result)} ${escapeHtml(formatScore(item, teamId))}</strong>
                <em>vs ${escapeHtml(compactTeamName(opponent))}</em>
            </div>
        `;
    }).join('');
}

function renderTeamMatchContext(match, context, thread) {
    const { teams, matches, players, statsById } = context;
    const teamsById = Object.fromEntries(teams.map(team => [team.id, team]));
    const homeName = match.home_team_name || teamNameOf(teamsById[match.home_team_id]);
    const awayName = match.away_team_name || teamNameOf(teamsById[match.away_team_id]);
    const mySide = match.home_team_id === thread.teamId ? 'home' : 'away';
    const opponentTeamId = mySide === 'home' ? match.away_team_id : match.home_team_id;
    const opponentName = mySide === 'home' ? awayName : homeName;
    const myName = mySide === 'home' ? homeName : awayName;
    const meetings = previousMeetings(matches, match, thread.teamId, opponentTeamId);
    const href = match.id && thread.leagueId
        ? `/pages/match-hub.html?league_id=${encodeURIComponent(thread.leagueId)}&match_id=${encodeURIComponent(match.id)}`
        : '';
    const scheduleHref = thread.leagueId
        ? `/pages/triples-vnext.html?league_id=${encodeURIComponent(thread.leagueId)}#schedule`
        : '/pages/triples-vnext.html#schedule';
    const status = match.status === 'in_progress' ? 'Live' : 'Match night';

    els.teamMatchContext.innerHTML = `
        <article class="mv-match-card">
            <div class="mv-match-card-top">
                <span>${escapeHtml(status)}</span>
                <em>${escapeHtml(formatDate(matchDate(match)))}</em>
            </div>
            <div class="mv-match-card-main">
                <div>
                    <span>Your team</span>
                    <strong>${escapeHtml(compactTeamName(myName))}</strong>
                </div>
                <div class="mv-match-card-center">
                    <span>Race to</span>
                    <strong>${escapeHtml(targetSets(match))}</strong>
                    <em>sets</em>
                </div>
                <div>
                    <span>Opponent</span>
                    <strong>${escapeHtml(compactTeamName(opponentName))}</strong>
                </div>
            </div>
            <details class="mv-match-card-extra">
                <summary>
                    <span>Scouting details</span>
                    <em>Previous meetings + A/B/C matchups</em>
                </summary>
                <div class="mv-match-card-details">
                    <section>
                        <header>
                            <span>Previous meetings</span>
                            <em>Season</em>
                        </header>
                        ${renderPreviousMeetingRows(meetings, thread.teamId, teamsById)}
                    </section>
                    <section>
                        <header>
                            <span>A / B / C matchups</span>
                            <em>3DA / MPR</em>
                        </header>
                        ${renderPlayerVsRows(players, statsById, thread.teamId, opponentTeamId)}
                    </section>
                </div>
            </details>
            <div class="mv-match-card-actions">
                ${href ? `<a href="${escapeHtml(href)}">Match hub</a>` : ''}
                <a href="${escapeHtml(scheduleHref)}">Schedule</a>
            </div>
        </article>
    `;
    els.teamMatchContext.classList.remove('hidden');
}

async function updateTeamMatchContext(thread) {
    if (!thread || thread.type !== 'room' || thread.roomType !== 'team' || !thread.leagueId || !thread.teamId) {
        clearTeamMatchContext();
        return;
    }

    if (!els.teamMatchContext) return;
    els.chatDefaultHeader?.classList.add('hidden');
    els.teamMatchContext.classList.remove('hidden');
    els.teamMatchContext.innerHTML = '<div class="mv-match-card loading">Loading match night...</div>';

    try {
        const context = await loadLeagueContext(thread.leagueId);
        if (activeThread?.id !== thread.id) return;
        const match = getNextTeamMatch(context.matches, thread.teamId);
        if (!match) {
            clearTeamMatchContext();
            return;
        }
        renderTeamMatchContext(match, context, thread);
    } catch (error) {
        console.warn('[clubhouse] team match context failed:', error);
        clearTeamMatchContext();
    }
}

async function loadConversations() {
    const result = await callFunction('getConversations', {});
    conversations = result?.success ? (result.conversations || []).map(normalizeConversation) : [];
    if (els.directCount) els.directCount.textContent = String(conversations.length);
    renderThreadList(els.directList, conversations, 'No direct messages yet.');
}

async function loadRooms() {
    const result = await callFunction('getPlayerChatRooms', {});
    const grouped = result?.success ? (result.rooms || {}) : {};
    leagueRooms = (grouped.league || []).map(normalizeRoom);
    teamRooms = (grouped.team || []).map(normalizeRoom);
    matchRooms = (grouped.match || []).map(normalizeRoom);
    tournamentRooms = [
        ...(grouped.tournament || []),
        ...(grouped.tournament_event || [])
    ].map(normalizeRoom);
    if (els.leagueCount) els.leagueCount.textContent = String(leagueRooms.length);
    renderThreadList(els.leagueList, leagueRooms, 'No league chat rooms yet.');
    renderThreadList(els.teamList, teamRooms, 'No team chat rooms yet.');
    renderThreadList(els.eventList, tournamentRooms, 'No event chat rooms yet.');
    // after rooms load, refresh banter in lobby
    renderLobbyBanter();
}

async function sendMessage(ev) {
    ev.preventDefault();
    if (!activeThread) return;
    const body = els.messageInput.value.trim();
    if (!body) return;

    els.sendMessageBtn.disabled = true;
    try {
        const result = activeThread.type === 'conversation'
            ? await callFunction('sendDirectMessage', { recipient_id: activeThread.recipientId, text: body })
            : await callFunction('sendChatMessage', { room_id: activeThread.id, text: body });
        if (!result?.success) throw new Error(result?.error || 'Message failed');
        els.messageInput.value = '';
        await openThread(activeThread);
        await Promise.allSettled([loadConversations(), loadRooms()]);
        restoreActiveSourceAfterRefresh();
    } catch (error) {
        toast(error.message || 'Message failed', 'error');
    } finally {
        els.sendMessageBtn.disabled = false;
    }
}

function openChallengeModal() {
    if (!activeThread || activeThread.type !== 'conversation') return;
    selectedGameType = '501';
    document.querySelectorAll('[data-game-type]').forEach(button => button.classList.toggle('active', button.dataset.gameType === selectedGameType));
    els.challengeTitle.textContent = `Challenge ${activeThread.name}`;
    els.challengeSubtitle.textContent = 'This posts a playable challenge into the direct message thread.';
    els.challengeRaceTo.value = '3';
    els.challengeStartRule.value = 'cork_every_leg';
    els.challengeInRule.value = 'straight';
    els.challengeOutRule.value = 'double';
    els.challengeMessage.value = '';
    els.challengeStatus.textContent = '';
    els.challengeStatus.className = 'mv-status';
    els.challengeModal.classList.add('active');
    els.challengeModal.setAttribute('aria-hidden', 'false');
}

function closeChallengeModal() {
    els.challengeModal.classList.remove('active');
    els.challengeModal.setAttribute('aria-hidden', 'true');
}

async function sendChallenge() {
    if (!activeThread || activeThread.type !== 'conversation') return;
    els.sendChallengeBtn.disabled = true;
    els.challengeStatus.textContent = 'Sending challenge...';
    els.challengeStatus.className = 'mv-status';

    const useCork = !['home_first', 'away_first'].includes(els.challengeStartRule.value);
    const payload = {
        challenged_player_id: activeThread.recipientId,
        game_type: selectedGameType,
        race_to: parseInt(els.challengeRaceTo.value, 10) || 3,
        message: els.challengeMessage.value.trim(),
        game_settings: {
            starting_score: ['501', '301', '701'].includes(selectedGameType) ? parseInt(selectedGameType, 10) : 501,
            in_rule: els.challengeInRule.value,
            out_rule: els.challengeOutRule.value,
            use_cork: useCork,
            cork_rule: els.challengeStartRule.value,
            default_starter: els.challengeStartRule.value === 'away_first' ? 'away' : 'home',
            cork_winner_gets: 'choose-and-start'
        }
    };

    try {
        const result = await callFunction('sendChallenge', payload);
        if (!result?.success) throw new Error(result?.error || 'Challenge failed');
        els.challengeStatus.textContent = 'Challenge sent.';
        els.challengeStatus.className = 'mv-status success';
        toast(`Challenge sent to ${activeThread.name}`, 'success');
        await loadConversations();
        await openThread(activeThread);
        setTimeout(closeChallengeModal, 650);
    } catch (error) {
        els.challengeStatus.textContent = error.message || 'Challenge failed';
        els.challengeStatus.className = 'mv-status error';
    } finally {
        els.sendChallengeBtn.disabled = false;
    }
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

async function loadLobbyPresence() {
    try {
        const result = await callFunction('getOnlinePlayers', {});
        const players = result?.success ? (result.online_players || []) : [];
        if (!players.length) {
            els.presenceList.innerHTML = '<div class="mv-empty">No one online right now.</div>';
            return;
        }
        els.presenceList.innerHTML = players.slice(0, 8).map(player => `
            <button class="ch-presence-row" type="button" data-chat-player="${escapeHtml(player.player_id)}" ${player.player_id === currentPlayer?.id ? 'disabled' : ''}>
                <span class="mv-avatar">${escapeHtml(initials(player.player_name))}</span>
                <span class="ch-presence-name">${escapeHtml(player.player_id === currentPlayer?.id ? 'You' : player.player_name)}</span>
                <span class="ch-presence-dot"></span>
            </button>
        `).join('');
        els.presenceList.querySelectorAll('[data-chat-player]').forEach(button => {
            button.addEventListener('click', () => startConversationWith(button.dataset.chatPlayer));
        });
    } catch (err) {
        els.presenceList.innerHTML = '<div class="mv-empty">Presence unavailable.</div>';
        console.warn('[clubhouse] presence:', err);
    }
}

function renderLobbyBanter() {
    // Show preview text from the first league room
    if (!leagueRooms.length) {
        if (els.banterList) els.banterList.innerHTML = '<div class="mv-empty">No league chat yet.</div>';
        return;
    }
    if (!els.banterList) return;
    els.banterList.innerHTML = leagueRooms.slice(0, 4).map(room => `
        <button class="ch-banter-row" type="button" data-open-room="${escapeHtml(room.id)}">
            <span class="ch-banter-room">${escapeHtml(room.name)}</span>
            <span class="ch-banter-preview">${escapeHtml(room.preview || 'No messages yet')}</span>
            ${room.time ? `<span class="ch-banter-time">${escapeHtml(room.time)}</span>` : ''}
        </button>
    `).join('');
    els.banterList.querySelectorAll('[data-open-room]').forEach(button => {
        button.addEventListener('click', () => {
            const room = leagueRooms.find(r => r.id === button.dataset.openRoom);
            if (room) openThread(room);
        });
    });
}

function renderLobbyListings() {
    if (!els.listingsPreview) return;
    if (!tradeListings.length) {
        if (tradeListingsLoaded) {
            // Loaded and genuinely empty — show empty state (don't re-loop the loader)
            els.listingsPreview.innerHTML = '<div class="mv-empty">No listings right now.</div>';
        } else {
            // Not loaded yet; kick off load (it calls renderLobbyListings again on completion)
            loadTradeListings().catch(() => {
                els.listingsPreview.innerHTML = '<div class="mv-empty">No listings right now.</div>';
            });
        }
        return;
    }
    const recent = tradeListings.slice(0, 3);
    els.listingsPreview.innerHTML = recent.map(item => `
        <a class="ch-listing-row" href="/pages/dart-trader-listing-vnext.html?id=${encodeURIComponent(item.id)}">
            <span class="ch-listing-cat">${escapeHtml(categoryOf(item))}</span>
            <span class="ch-listing-title">${escapeHtml(item.title || item.name || 'Dart listing')}</span>
            <span class="ch-listing-price">${escapeHtml(moneyOf(item.price))}</span>
        </a>
    `).join('');
}

function renderLobbyActivity() {
    if (!els.activityList) return;
    // Show members sorted by level; give a quick view if loaded, else stub
    if (!membersState.players.length) {
        els.activityList.innerHTML = '<div class="mv-empty">Loading activity...</div>';
        loadMembers().then(() => renderLobbyActivity()).catch(() => {
            els.activityList.innerHTML = '<div class="mv-empty">Activity unavailable.</div>';
        });
        return;
    }
    const sample = membersState.players.slice(0, 5);
    els.activityList.innerHTML = sample.map(player => {
        const team = membersState.teamsById[player.team_id];
        const tname = team?.name || team?.team_name || '';
        return `
            <a class="ch-activity-row" href="/pages/player-profile-vnext.html?player_id=${encodeURIComponent(player.id)}">
                <span class="mv-avatar">${escapeHtml(initials(player.name))}</span>
                <span class="ch-activity-name">${escapeHtml(player.name || 'Player')}</span>
                ${tname ? `<span class="ch-activity-team">${escapeHtml(tname)}</span>` : ''}
            </a>
        `;
    }).join('');
}

// ─── Trade ────────────────────────────────────────────────────────────────────

function categoryOf(listing) {
    return String(listing.category || listing.item_category || 'accessories').toLowerCase();
}

function moneyOf(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}` : 'Trade';
}

function renderTradeGrid() {
    const filtered = tradeListings.filter(item => tradeActiveCategory === 'all' || categoryOf(item) === tradeActiveCategory);
    if (els.tradeStatus) els.tradeStatus.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'} shown`;
    if (els.tradeCount) els.tradeCount.textContent = String(tradeListings.length);
    if (!filtered.length) {
        els.tradeGrid.innerHTML = '<div class="mv-empty">No listings found. Create one above.</div>';
        return;
    }
    els.tradeGrid.innerHTML = filtered.map(item => `
        <article class="ch-trade-card">
            <div>
                <p class="mv-kicker">${escapeHtml(categoryOf(item))}</p>
                <h3>${escapeHtml(item.title || item.name || 'Dart listing')}</h3>
            </div>
            <div class="ch-trade-price">${escapeHtml(moneyOf(item.price))}</div>
            <p class="ch-trade-desc">${escapeHtml(item.condition || 'Condition not listed')} — ${escapeHtml(item.location || item.city || 'BRDC')}</p>
            <a class="ch-trade-link" href="/pages/dart-trader-listing-vnext.html?id=${encodeURIComponent(item.id)}">View listing</a>
        </article>
    `).join('');
}

async function loadTradeListings() {
    if (els.tradeStatus) els.tradeStatus.textContent = 'Loading listings...';
    const q = query(
        collection(db, 'dart_trader_listings'),
        where('status', '==', 'active'),
        orderBy('created_at', 'desc'),
        limit(60)
    );
    const snap = await getDocs(q);
    tradeListings = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    tradeListingsLoaded = true;
    renderTradeGrid();
    renderLobbyListings();
}

// ─── Members ──────────────────────────────────────────────────────────────────

function isFillIn(player) {
    return player?.is_fill_in === true ||
        player?.is_fillin === true ||
        player?.is_sub === true ||
        ['fill_in', 'fill-in', 'fillin'].includes(String(player?.team_id || '').toLowerCase());
}

function memberLevel(player) {
    const raw = String(player?.skill_level || player?.preferred_level || player?.level || '').toUpperCase();
    if (isFillIn(player)) return 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function memberTeamName(player) {
    if (isFillIn(player)) return 'Fill-in';
    const team = membersState.teamsById[player.team_id] || {};
    return team.team_name || team.name || player.team_name || '-';
}

function memberStatsFor(player) {
    const stats = membersState.statsById[player.id] || {};
    return {
        threeDa: player.x01_three_dart_avg ?? player.avg_3da ?? stats.x01_three_dart_avg ?? stats.avg_3da,
        mpr: player.cricket_mpr ?? player.mpr ?? stats.cricket_mpr ?? stats.mpr,
        wins: stats.games_won ?? player.games_won,
        played: stats.games_played ?? player.games_played
    };
}

function winPct(s) {
    const won = finite(s.wins) || 0;
    const played = finite(s.played) || 0;
    return played > 0 ? `${Math.round((won / played) * 100)}%` : '-';
}

function memberText(player) {
    const s = memberStatsFor(player);
    return [player.name, memberTeamName(player), memberLevel(player), stat(s.threeDa, 1), stat(s.mpr, 2), player.email, player.phone].join(' ').toLowerCase();
}

function filteredMembers() {
    const search = membersState.search.trim().toLowerCase();
    const order = { A: 0, B: 1, C: 2, F: 3, '-': 9 };
    return membersState.players
        .filter(p => membersState.filter === 'all' || memberLevel(p) === membersState.filter)
        .filter(p => !search || memberText(p).includes(search))
        .sort((a, b) => {
            const diff = (order[memberLevel(a)] ?? 9) - (order[memberLevel(b)] ?? 9);
            return diff || String(a.name || '').localeCompare(String(b.name || ''));
        });
}

function renderMemberCard(player) {
    const s = memberStatsFor(player);
    const lvl = memberLevel(player);
    const team = memberTeamName(player);
    const leagueId = (Object.keys(membersState.teamsById)[0] && DEFAULT_LEAGUE_ID) || DEFAULT_LEAGUE_ID;
    return `
        <a class="ch-member-card" href="/pages/player-profile-vnext.html?league_id=${encodeURIComponent(leagueId)}&player_id=${encodeURIComponent(player.id)}">
            <span class="ch-member-level ${lvl === 'F' ? 'fillin' : ''}">${escapeHtml(lvl)}</span>
            <span class="ch-member-main">
                <strong>${escapeHtml(player.name || 'Player')}</strong>
                <em>${escapeHtml(team)}</em>
            </span>
            <span class="ch-member-stats">
                <span><strong>${stat(s.threeDa, 1)}</strong> 3DA</span>
                <span><strong>${stat(s.mpr, 2)}</strong> MPR</span>
                <span><strong>${winPct(s)}</strong> W%</span>
            </span>
        </a>
    `;
}

function renderMembersGrid() {
    const members = filteredMembers();
    const leaguePlayers = membersState.players.filter(p => !isFillIn(p));
    if (els.memberCount) els.memberCount.textContent = String(membersState.players.length);
    if (els.membersStatus) els.membersStatus.textContent = `${members.length} shown`;
    if (!els.membersGrid) return;
    els.membersGrid.innerHTML = members.length
        ? members.map(renderMemberCard).join('')
        : '<div class="mv-empty">No members match that filter.</div>';
}

async function loadMembers() {
    const leagueId = DEFAULT_LEAGUE_ID;
    const [playersSnap, teamsSnap, statsSnap] = await Promise.all([
        getDocs(collection(db, 'leagues', leagueId, 'players')),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'stats')).catch(() => ({ docs: [] }))
    ]);
    membersState.players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    membersState.teamsById = Object.fromEntries(teamsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    membersState.statsById = Object.fromEntries(statsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    renderMembersGrid();
    renderLobbyActivity();
}

// ─── Presence / heartbeat ─────────────────────────────────────────────────────

async function updatePresence() {
    if (!currentPlayer?.id) return;
    await setDoc(doc(db, 'presence_heartbeats', currentPlayer.id), {
        player_id: currentPlayer.id,
        player_name: currentPlayer.name,
        status: 'online',
        current_page: 'clubhouse',
        last_heartbeat: serverTimestamp(),
        updated_at: serverTimestamp()
    }, { merge: true }).catch(() => {});
}

// ─── Conversation starter (from lobby presence) ───────────────────────────────

async function startConversationWith(playerId) {
    if (!playerId || playerId === currentPlayer?.id) return;
    try {
        const result = await callFunction('startConversation', { recipient_id: playerId });
        if (!result?.success) throw new Error(result?.error || 'Could not start conversation');
        await loadConversations();
        setActiveArea('chat');
        setActiveSource('direct');
        const thread = conversations.find(item => item.id === result.conversation_id);
        if (thread) openThread(thread);
    } catch (error) {
        toast(error.message || 'Could not start conversation', 'error');
    }
}

// ─── Wire events ──────────────────────────────────────────────────────────────

function wireEvents() {
    // Clubhouse area tabs
    document.querySelectorAll('[data-ch-tab]').forEach(button => {
        button.addEventListener('click', () => setActiveArea(button.dataset.chTab));
    });

    // Lobby jump-links
    document.querySelectorAll('[data-ch-tab-jump]').forEach(button => {
        button.addEventListener('click', () => setActiveArea(button.dataset.chTabJump));
    });

    // Chat source tabs
    document.querySelectorAll('[data-source-tab]').forEach(button => {
        button.addEventListener('click', () => setActiveSource(button.dataset.sourceTab));
    });

    // Challenge modal game type
    document.querySelectorAll('[data-game-type]').forEach(button => {
        button.addEventListener('click', () => {
            selectedGameType = button.dataset.gameType;
            document.querySelectorAll('[data-game-type]').forEach(item => item.classList.toggle('active', item === button));
        });
    });

    // Chat form
    els.messageForm.addEventListener('submit', sendMessage);
    els.challengeThreadBtn.addEventListener('click', openChallengeModal);
    document.getElementById('closeChallengeBtn').addEventListener('click', closeChallengeModal);
    els.sendChallengeBtn.addEventListener('click', sendChallenge);
    els.refreshDirectBtn?.addEventListener('click', () => loadConversations().catch(err => toast(err.message, 'error')));

    // Challenge modal backdrop
    els.challengeModal.addEventListener('click', ev => {
        if (ev.target === els.challengeModal) closeChallengeModal();
    });

    // Lobby refresh presence
    els.refreshPresenceBtn?.addEventListener('click', () => loadLobbyPresence().catch(() => {}));

    // Trade category filters
    document.getElementById('tradeCategoryFilters')?.querySelectorAll('[data-trade-category]').forEach(button => {
        button.addEventListener('click', () => {
            tradeActiveCategory = button.dataset.tradeCategory;
            document.querySelectorAll('[data-trade-category]').forEach(item => item.classList.toggle('active', item === button));
            renderTradeGrid();
        });
    });

    // Members search + filters
    els.memberSearch?.addEventListener('input', () => {
        membersState.search = els.memberSearch.value;
        renderMembersGrid();
    });
    els.memberFilters?.querySelectorAll('[data-member-filter]').forEach(button => {
        button.addEventListener('click', () => {
            membersState.filter = button.dataset.memberFilter;
            els.memberFilters.querySelectorAll('[data-member-filter]').forEach(item => item.classList.toggle('active', item === button));
            renderMembersGrid();
        });
    });
}

// ─── URL routing helpers ──────────────────────────────────────────────────────

function allRooms() {
    return [...leagueRooms, ...teamRooms, ...matchRooms, ...tournamentRooms];
}

function normalizeSource(value) {
    if (value === 'rooms') return 'league';
    if (value === 'event' || value === 'tournament' || value === 'tournaments') return 'events';
    if (['league', 'team', 'events', 'direct'].includes(value)) return value;
    return 'league';
}

function restoreActiveSourceAfterRefresh() {
    setActiveSource(activeSource);
    if (activeThread?.type === 'room') {
        document.querySelectorAll('.mv-thread').forEach(item => {
            item.classList.toggle('active', item.dataset.threadId === activeThread.id && item.dataset.threadType === activeThread.type);
        });
    }
}

async function openInitialThread() {
    const params = new URLSearchParams(window.location.search);
    const area = params.get('area') || '';
    const source = normalizeSource(params.get('source') || params.get('tab') || '');
    const conversationId = params.get('conversation_id') || params.get('id');
    const roomId = params.get('room_id');
    const leagueId = params.get('league_id');
    const teamId = params.get('team_id');
    const tournamentId = params.get('tournament_id') || params.get('event_id');
    const seriesId = params.get('series_id');
    const wantsChallenge = params.get('action') === 'challenge';

    // honour ?area= param to land on a specific area
    const startArea = ['lobby', 'chat', 'trade', 'members'].includes(area) ? area : 'lobby';
    setActiveArea(startArea);

    if (conversationId) {
        const thread = conversations.find(item => item.id === conversationId);
        if (thread) {
            setActiveArea('chat');
            setActiveSource('direct');
            await openThread(thread);
        }
    } else if (roomId) {
        const thread = allRooms().find(item => item.id === roomId);
        if (thread) {
            setActiveArea('chat');
            setActiveSource(thread.roomType === 'team' ? 'team' : thread.roomType === 'league' ? 'league' : 'events');
            await openThread(thread);
        }
    } else if (startArea === 'chat') {
        setActiveSource(source);
        if (source === 'league') {
            const thread = leagueRooms.find(item => !leagueId || item.leagueId === leagueId) || leagueRooms[0];
            if (thread) await openThread(thread);
            else setActiveThread(null);
        } else if (source === 'team') {
            const thread = teamRooms.find(item => !teamId || item.teamId === teamId) || teamRooms[0];
            if (thread) await openThread(thread);
            else setActiveThread(null);
        } else if (source === 'events') {
            const thread = tournamentRooms.find(item => {
                if (seriesId) return item.seriesId === seriesId || item.id === seriesId;
                if (tournamentId) return item.tournamentId === tournamentId || item.tournamentIds.includes(tournamentId) || item.id === tournamentId;
                return true;
            }) || tournamentRooms[0];
            if (thread) await openThread(thread);
            else setActiveThread(null);
        } else if (source === 'direct') {
            if (conversations[0]) await openThread(conversations[0]);
            else setActiveThread(null);
        } else {
            setActiveThread(null);
        }
    }

    if (wantsChallenge && activeThread?.type === 'conversation') {
        openChallengeModal();
    }
}

// ─── init ─────────────────────────────────────────────────────────────────────

async function init() {
    wireEvents();

    // ⚡ Optimistic hero: show last-known counts + greeting INSTANTLY instead of
    // dashes while auth resolves + cold functions warm up. Overwritten by real data.
    const cachedClubhouse = readLocalCache(CLUBHOUSE_CACHE_KEY);
    if (cachedClubhouse) {
        if (els.directCount && cachedClubhouse.directCount != null) els.directCount.textContent = String(cachedClubhouse.directCount);
        if (els.leagueCount && cachedClubhouse.leagueCount != null) els.leagueCount.textContent = String(cachedClubhouse.leagueCount);
        if (els.tradeCount && cachedClubhouse.tradeCount != null) els.tradeCount.textContent = String(cachedClubhouse.tradeCount);
        if (els.memberCount && cachedClubhouse.memberCount != null) els.memberCount.textContent = String(cachedClubhouse.memberCount);
        if (cachedClubhouse.displayName) setAuthStatus(`Signed in as ${cachedClubhouse.displayName}`);
    }

    await waitForAuthReady(6500);
    if (!auth.currentUser) {
        setAuthStatus('Log in to use the Clubhouse.');
        renderLoggedOutState();
        return;
    }

    const session = await callFunction('getPlayerSession', {});
    if (!session?.success || !session.player?.id) throw new Error(session?.error || 'Could not load player session');
    currentPlayer = session.player;
    currentPlayer.name = currentPlayer.name || `${currentPlayer.first_name || ''} ${currentPlayer.last_name || ''}`.trim() || 'Player';
    setAuthStatus(`Signed in as ${currentPlayer.name}`);

    await updatePresence();
    setInterval(updatePresence, 30000);

    // load chat rooms + conversations first (Lobby banter depends on them)
    await Promise.allSettled([loadConversations(), loadRooms()]);

    // lobby widgets — presence + listings in parallel
    await Promise.allSettled([
        loadLobbyPresence(),
        loadTradeListings().then(() => renderLobbyListings()),
        loadMembers().then(() => renderLobbyActivity())
    ]);

    await openInitialThread();

    // Persist the fresh hero stats + greeting for instant render on the next open.
    persistClubhouseCache();
}

init().catch(error => {
    console.error('[clubhouse] init failed:', error);
    setAuthStatus(error.message || 'Could not load Clubhouse.');
    if (els.messageList) els.messageList.innerHTML = `<div class="mv-empty large">${escapeHtml(error.message || 'Could not load Clubhouse')}</div>`;
});
