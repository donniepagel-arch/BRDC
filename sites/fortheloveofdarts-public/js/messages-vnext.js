import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    collection,
    getDocs,
    doc,
    setDoc,
    serverTimestamp
} from '/js/firebase-config.js';

const els = {
    authStatus: document.getElementById('authStatus'),
    directCount: document.getElementById('directCount'),
    leagueCount: document.getElementById('leagueCount'),
    teamCount: document.getElementById('teamCount'),
    eventCount: document.getElementById('eventCount'),
    onlineCount: document.getElementById('onlineCount'),
    directList: document.getElementById('directList'),
    leagueList: document.getElementById('leagueList'),
    teamList: document.getElementById('teamList'),
    eventList: document.getElementById('eventList'),
    challengeList: document.getElementById('challengeList'),
    onlineList: document.getElementById('onlineList'),
    chatDefaultHeader: document.getElementById('chatDefaultHeader'),
    activeThreadType: document.getElementById('activeThreadType'),
    activeThreadName: document.getElementById('activeThreadName'),
    teamMatchContext: document.getElementById('teamMatchContext'),
    messageList: document.getElementById('messageList'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    challengeThreadBtn: document.getElementById('challengeThreadBtn'),
    refreshDirectBtn: document.getElementById('refreshDirectBtn'),
    challengeModal: document.getElementById('challengeModal'),
    challengeTitle: document.getElementById('challengeTitle'),
    challengeSubtitle: document.getElementById('challengeSubtitle'),
    challengeRaceTo: document.getElementById('challengeRaceTo'),
    challengeStartRule: document.getElementById('challengeStartRule'),
    challengeInRule: document.getElementById('challengeInRule'),
    challengeOutRule: document.getElementById('challengeOutRule'),
    challengeMessage: document.getElementById('challengeMessage'),
    challengeStatus: document.getElementById('challengeStatus'),
    sendChallengeBtn: document.getElementById('sendChallengeBtn')
};

let currentPlayer = null;
let activeThread = null;
let activeSource = 'league';
let selectedGameType = '501';
let conversations = [];
let leagueRooms = [];
let teamRooms = [];
let matchRooms = [];
let tournamentRooms = [];
const leagueContextCache = new Map();

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

function teamName(team) {
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

function renderLoggedOutState() {
    if (els.directCount) els.directCount.textContent = '0';
    if (els.leagueCount) els.leagueCount.textContent = '0';
    if (els.teamCount) els.teamCount.textContent = '0';
    if (els.eventCount) els.eventCount.textContent = '0';
    if (els.onlineCount) els.onlineCount.textContent = '0';
    els.directList.innerHTML = '<div class="mv-empty">Log in to see direct messages.</div>';
    els.leagueList.innerHTML = '<div class="mv-empty">Log in to see league chat.</div>';
    els.teamList.innerHTML = '<div class="mv-empty">Log in to see team chat.</div>';
    els.eventList.innerHTML = '<div class="mv-empty">Log in to see event chat.</div>';
    els.challengeList.innerHTML = '<div class="mv-empty">Log in to see challenges.</div>';
    els.onlineList.innerHTML = '<div class="mv-empty">Log in to see who is online.</div>';
    els.messageList.innerHTML = '<div class="mv-empty large">Log in from the dashboard first.</div>';
    els.messageInput.disabled = true;
    els.sendMessageBtn.disabled = true;
    els.challengeThreadBtn.disabled = true;
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
        els.activeThreadName.textContent = 'Messages';
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
    els.messageList.innerHTML = '<div class="mv-empty large">Loading...</div>';

    try {
        const result = thread.type === 'conversation'
            ? await callFunction('getConversationMessages', { conversation_id: thread.id, limit: 60 })
            : await callFunction('getChatRoomMessages', { room_id: thread.id, limit: 60 });
        if (!result?.success) throw new Error(result?.error || 'Could not load messages');
        renderMessages(result.messages || []);
    } catch (error) {
        console.error('[messages-vnext] load thread failed:', error);
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
    return text(value)
        .replace(/^Team\s+/i, '')
        .trim() || 'Team';
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

function playerStats(player, statsById) {
    const stats = statsById[player?.id] || {};
    const embedded = player?.stats || player?.unified_stats || {};
    const threeDa = statNumber(stats.x01_three_dart_avg ?? embedded.x01_three_dart_avg ?? embedded.three_dart_avg);
    const mpr = statNumber(stats.cricket_mpr ?? embedded.cricket_mpr ?? embedded.mpr);
    return { threeDa, mpr };
}

function playerStatLine(player, statsById) {
    const { threeDa, mpr } = playerStats(player, statsById);
    return `${threeDa == null ? '-' : threeDa.toFixed(1)} / ${mpr == null ? '-' : mpr.toFixed(2)}`;
}

function renderPlayerVsRows(players, statsById, myTeamId, opponentTeamId) {
    const mine = playerRoster(players, myTeamId);
    const opponents = playerRoster(players, opponentTeamId);
    const rowCount = Math.max(mine.length, opponents.length, 3);
    return Array.from({ length: rowCount }).map((_, index) => {
        const myPlayer = mine[index];
        const opponentPlayer = opponents[index];
        const myStats = playerStats(myPlayer, statsById);
        const opponentStats = playerStats(opponentPlayer, statsById);
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
            ? (item.away_team_name || teamName(teamsById[opponentId]))
            : (item.home_team_name || teamName(teamsById[opponentId]));
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
    const homeName = match.home_team_name || teamName(teamsById[match.home_team_id]);
    const awayName = match.away_team_name || teamName(teamsById[match.away_team_id]);
    const mySide = match.home_team_id === thread.teamId ? 'home' : 'away';
    const opponentTeamId = mySide === 'home' ? match.away_team_id : match.home_team_id;
    const opponentName = mySide === 'home' ? awayName : homeName;
    const myName = mySide === 'home' ? homeName : awayName;
    const meetings = previousMeetings(matches, match, thread.teamId, opponentTeamId);
    const href = match.id && thread.leagueId
        ? `/rookies/pages/match-hub-vnext.html?league_id=${encodeURIComponent(thread.leagueId)}&match_id=${encodeURIComponent(match.id)}`
        : '';
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
                <a href="/rookies/pages/triples-vnext.html#schedule">Schedule</a>
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
        console.warn('[messages-vnext] team match context failed:', error);
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
    if (els.teamCount) els.teamCount.textContent = String(teamRooms.length);
    if (els.eventCount) els.eventCount.textContent = String(tournamentRooms.length);
    renderThreadList(els.leagueList, leagueRooms, 'No league chat rooms yet.');
    renderThreadList(els.teamList, teamRooms, 'No team chat rooms yet.');
    renderThreadList(els.eventList, tournamentRooms, 'No event chat rooms yet.');
}

function renderChallenges(received = [], sent = []) {
    const pending = [...received, ...sent].filter(challenge => challenge.status === 'pending');
    if (!pending.length) {
        els.challengeList.innerHTML = '<div class="mv-empty">No pending challenges.</div>';
        return;
    }
    els.challengeList.innerHTML = pending.map(challenge => {
        const incoming = challenge.challenged_id === currentPlayer?.id;
        const name = incoming ? challenge.challenger_name : challenge.challenged_name;
        return `
            <div class="mv-thread challenge-thread" data-challenge-id="${escapeHtml(challenge.id)}">
                <span class="mv-avatar">${escapeHtml(initials(name))}</span>
                <span>
                    <span class="mv-thread-title">${escapeHtml(incoming ? `${name} challenged you` : `Sent to ${name}`)}</span>
                    <span class="mv-thread-preview">${escapeHtml(challenge.game_type || '501')} race to ${escapeHtml(challenge.race_to || 3)}</span>
                </span>
                <span class="mv-thread-meta">${escapeHtml(formatTime(challenge.created_at))}</span>
            </div>
            ${incoming ? `<div class="mv-challenge-actions" data-challenge-actions="${escapeHtml(challenge.id)}">
                <button type="button" data-accept-challenge="${escapeHtml(challenge.id)}">Accept</button>
                <button type="button" data-decline-challenge="${escapeHtml(challenge.id)}">Decline</button>
            </div>` : ''}
        `;
    }).join('');

    els.challengeList.querySelectorAll('[data-accept-challenge]').forEach(button => {
        button.addEventListener('click', () => respondToChallenge(button.dataset.acceptChallenge, 'accept'));
    });
    els.challengeList.querySelectorAll('[data-decline-challenge]').forEach(button => {
        button.addEventListener('click', () => respondToChallenge(button.dataset.declineChallenge, 'decline'));
    });
}

async function loadChallenges() {
    const result = await callFunction('getPlayerChallenges', { filter: 'pending' });
    if (!result?.success) throw new Error(result?.error || 'Could not load challenges');
    renderChallenges(result.received || [], result.sent || []);
}

function renderOnline(players = []) {
    if (els.onlineCount) els.onlineCount.textContent = String(players.length);
    if (!players.length) {
        els.onlineList.innerHTML = '<div class="mv-empty">No one is online right now.</div>';
        return;
    }
    els.onlineList.innerHTML = players.map(player => `
        <button class="mv-thread" type="button" data-online-player="${escapeHtml(player.player_id)}" ${player.player_id === currentPlayer?.id ? 'disabled' : ''}>
            <span class="mv-avatar">${escapeHtml(initials(player.player_name))}</span>
            <span>
                <span class="mv-thread-title">${escapeHtml(player.player_id === currentPlayer?.id ? 'You' : player.player_name)}</span>
                <span class="mv-thread-preview">${escapeHtml(player.current_page || player.status || 'online')}</span>
            </span>
            <span class="mv-thread-meta">online</span>
        </button>
    `).join('');

    els.onlineList.querySelectorAll('[data-online-player]').forEach(button => {
        button.addEventListener('click', () => startConversationWith(button.dataset.onlinePlayer));
    });
}

async function loadOnline() {
    const result = await callFunction('getOnlinePlayers', {});
    const players = result?.success ? (result.online_players || []) : [];
    renderOnline(players);
}

async function startConversationWith(playerId) {
    if (!playerId || playerId === currentPlayer?.id) return;
    try {
        const result = await callFunction('startConversation', { recipient_id: playerId });
        if (!result?.success) throw new Error(result?.error || 'Could not start conversation');
        await loadConversations();
        setActiveSource('direct');
        const thread = conversations.find(item => item.id === result.conversation_id);
        if (thread) openThread(thread);
    } catch (error) {
        toast(error.message || 'Could not start conversation', 'error');
    }
}

async function sendMessage(event) {
    event.preventDefault();
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
        await Promise.allSettled([loadChallenges(), loadConversations()]);
        await openThread(activeThread);
        setTimeout(closeChallengeModal, 650);
    } catch (error) {
        els.challengeStatus.textContent = error.message || 'Challenge failed';
        els.challengeStatus.className = 'mv-status error';
    } finally {
        els.sendChallengeBtn.disabled = false;
    }
}

async function respondToChallenge(challengeId, response) {
    try {
        const result = await callFunction('respondToChallenge', { challenge_id: challengeId, response });
        if (!result?.success) throw new Error(result?.error || 'Could not update challenge');
        toast(response === 'accept' ? 'Challenge accepted' : 'Challenge declined', 'success');
        if (response === 'accept' && result.scorer_url) {
            window.location.href = result.scorer_url;
            return;
        }
        await loadChallenges();
    } catch (error) {
        toast(error.message || 'Could not update challenge', 'error');
    }
}

async function updatePresence() {
    if (!currentPlayer?.id) return;
    await setDoc(doc(db, 'presence_heartbeats', currentPlayer.id), {
        player_id: currentPlayer.id,
        player_name: currentPlayer.name,
        status: 'online',
        current_page: 'messages-vnext',
        last_heartbeat: serverTimestamp(),
        updated_at: serverTimestamp()
    }, { merge: true }).catch(() => {});
}

function wireEvents() {
    document.querySelectorAll('[data-source-tab]').forEach(button => {
        button.addEventListener('click', () => setActiveSource(button.dataset.sourceTab));
    });
    document.querySelectorAll('[data-game-type]').forEach(button => {
        button.addEventListener('click', () => {
            selectedGameType = button.dataset.gameType;
            document.querySelectorAll('[data-game-type]').forEach(item => item.classList.toggle('active', item === button));
        });
    });
    els.messageForm.addEventListener('submit', sendMessage);
    els.challengeThreadBtn.addEventListener('click', openChallengeModal);
    document.getElementById('closeChallengeBtn').addEventListener('click', closeChallengeModal);
    els.sendChallengeBtn.addEventListener('click', sendChallenge);
    els.refreshDirectBtn?.addEventListener('click', () => loadConversations().catch(error => toast(error.message, 'error')));
    document.getElementById('refreshChallengesBtn').addEventListener('click', () => loadChallenges().catch(error => toast(error.message, 'error')));
    document.getElementById('refreshOnlineBtn').addEventListener('click', () => loadOnline().catch(error => toast(error.message, 'error')));
    els.challengeModal.addEventListener('click', event => {
        if (event.target === els.challengeModal) closeChallengeModal();
    });
}

function allRooms() {
    return [...leagueRooms, ...teamRooms, ...matchRooms, ...tournamentRooms];
}

function sourceRooms(source) {
    if (source === 'team') return teamRooms;
    if (source === 'league') return leagueRooms;
    if (source === 'events') return tournamentRooms;
    return allRooms();
}

function normalizeSource(value) {
    if (value === 'rooms') return 'league';
    if (value === 'event' || value === 'tournament' || value === 'tournaments') return 'events';
    if (['league', 'team', 'events', 'direct', 'challenges', 'online'].includes(value)) return value;
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
    const source = normalizeSource(params.get('source') || params.get('tab') || '');
    const conversationId = params.get('conversation_id') || params.get('id');
    const roomId = params.get('room_id');
    const leagueId = params.get('league_id');
    const teamId = params.get('team_id');
    const tournamentId = params.get('tournament_id') || params.get('event_id');
    const seriesId = params.get('series_id');
    const wantsChallenge = params.get('action') === 'challenge';

    setActiveSource(source);

    if (conversationId) {
        const thread = conversations.find(item => item.id === conversationId);
        if (thread) {
            setActiveSource('direct');
            await openThread(thread);
        }
    } else if (roomId) {
        const thread = allRooms().find(item => item.id === roomId);
        if (thread) {
            setActiveSource(thread.roomType === 'team' ? 'team' : thread.roomType === 'league' ? 'league' : 'events');
            await openThread(thread);
        }
    } else if (source === 'league') {
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

    if (wantsChallenge && activeThread?.type === 'conversation') {
        openChallengeModal();
    }
}

async function init() {
    wireEvents();
    await waitForAuthReady(6500);
    if (!auth.currentUser) {
        setAuthStatus('Log in to use chat.');
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

    await Promise.allSettled([loadConversations(), loadRooms(), loadChallenges(), loadOnline()]);

    await openInitialThread();
}

init().catch(error => {
    console.error('[messages-vnext] init failed:', error);
    setAuthStatus(error.message || 'Could not load chat.');
    els.messageList.innerHTML = `<div class="mv-empty large">${escapeHtml(error.message || 'Could not load chat')}</div>`;
});
