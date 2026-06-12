/**
 * arena-vnext.js  — Phase 6: Play → Arena
 *
 * Sections (top to bottom):
 *  1. League match card   — player's upcoming/active league match → scorer
 *  2. [HTML] Score a game here → /pages/scorer-setup-vnext.html  (static link, no JS)
 *  3. Online now           — presence; quick-match / host / join
 *  4. Challenges           — send/receive async 1v1 (reuses sendChallenge / getPlayerChallenges /
 *                             respondToChallenge / cancelChallenge from chat-challenges.js)
 *  5. Mini-tournaments     — createMiniTournament / mini_tournaments collection
 *  6. Watch live           — in-progress online_matches
 *
 * Backend functions used:
 *   getPlayerSession         — session resolve (firebase-config.js callFunction)
 *   getActiveOnlineMatches   — online_matches where status in [waiting, in_progress]
 *   sendChallenge            — chat-challenges.js (creates challenges doc + conversation event)
 *   getPlayerChallenges      — chat-challenges.js (sent + received)
 *   respondToChallenge       — chat-challenges.js (accept / decline)
 *   cancelChallenge          — chat-challenges.js
 *   createMiniTournament     — mini-tournaments.js
 *   Firestore direct reads   — mini_tournaments (active), online_matches (in_progress), presence
 */

import {
    db,
    auth,
    callFunction,
    waitForAuthReady,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    limit
} from '/js/firebase-config.js';

// ─── Constants ────────────────────────────────────────────────────
const TRIPLES_LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// ─── Session state ─────────────────────────────────────────────────
let currentPlayer = null;
let allPlayers = [];   // for challenge player picker

// ─── Element refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
    leagueCard:       $('arenaLeagueMatchCard'),
    leagueKicker:     $('arenaLeagueKicker'),
    leagueVs:         $('arenaLeagueVs'),
    leagueMeta:       $('arenaLeagueMeta'),
    leagueScorerLink: $('arenaLeagueScorerLink'),

    onlineCount:       $('arenaOnlineCount'),
    presenceList:      $('arenaPresenceList'),
    quickMatchBtn:     $('arenaQuickMatchBtn'),
    hostBoardBtn:      $('arenaHostBoardBtn'),
    joinBoardBtn:      $('arenaJoinBoardBtn'),

    challengeBadge:       $('arenaChallengeBadge'),
    incomingChallenges:   $('arenaIncomingChallenges'),
    outgoingChallenges:   $('arenaOutgoingChallenges'),
    challengePlayerSel:   $('arenaChallengePlayerSelect'),
    challengeGameType:    $('arenaChallengeGameType'),
    sendChallengeBtn:     $('arenaSendChallengeBtn'),

    tournamentList:         $('arenaTournamentList'),
    createTournamentBtn:    $('arenaCreateTournamentBtn'),

    watchList:         $('arenaWatchList'),

    // Quick-match modal
    qmModal:      $('arenaQuickMatchModal'),
    qmGameType:   $('arenaQmGameType'),
    qmRaceTo:     $('arenaQmRaceTo'),
    qmOpponent:   $('arenaQmOpponent'),
    qmCancel:     $('arenaQmCancel'),
    qmConfirm:    $('arenaQmConfirm'),

    // Host board modal
    hostModal:    $('arenaHostBoardModal'),
    hostGameType: $('arenaHostGameType'),
    hostRaceTo:   $('arenaHostRaceTo'),
    hostMessage:  $('arenaHostMessage'),
    hostCancel:   $('arenaHostCancel'),
    hostConfirm:  $('arenaHostConfirm'),

    // Join board modal
    joinModal:    $('arenaJoinBoardModal'),
    joinList:     $('arenaJoinBoardList'),
    joinCancel:   $('arenaJoinCancel'),

    // Create tournament modal
    tournamentModal:       $('arenaCreateTournamentModal'),
    tournamentName:        $('arenaTournamentName'),
    tournamentGameType:    $('arenaTournamentGameType'),
    tournamentPlayers:     $('arenaTournamentPlayers'),
    tournamentCancel:      $('arenaTournamentCancel'),
    tournamentConfirm:     $('arenaTournamentConfirm'),
};

// ─── Utilities ─────────────────────────────────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0] || 'B').slice(0, 2).toUpperCase();
}

function formatMatchDate(ts) {
    if (!ts) return '';
    let d;
    if (ts?.toDate) d = ts.toDate();
    else if (ts?.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60);
    if (diff < 0 && diff > -24) return 'Match night';
    if (diff >= 0 && diff < 24) return 'Tonight';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function toast(msg, type = 'info') {
    const fn = type === 'error' ? window.toastError : type === 'success' ? window.toastSuccess : window.toastInfo;
    if (typeof fn === 'function') fn(msg);
    else console.log(`[Arena] ${msg}`);
}

function showModal(modalEl) {
    modalEl?.removeAttribute('hidden');
    // prevent body scroll
    document.body.style.overflow = 'hidden';
}
function hideModal(modalEl) {
    modalEl?.setAttribute('hidden', '');
    document.body.style.overflow = '';
}

// ─── 1. League match card ───────────────────────────────────────────
/**
 * Resolve the player's next/active league match for the hardcoded triples league.
 * Pattern mirrors home-vnext.js:
 *   - Find the league player record by auth UID / email / name
 *   - Get their team_id
 *   - Scan matches for one where home_team_id or away_team_id === team_id
 *     and status is 'scheduled' or 'in_progress', ordered by match_date asc
 *
 * If none found → hide the card.
 */
async function loadLeagueMatch() {
    if (!auth.currentUser || !currentPlayer) {
        els.leagueCard.style.display = 'none';
        return;
    }
    try {
        // Find league player
        const leaguePlayersSnap = await getDocs(
            collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'players')
        );
        const email = String(auth.currentUser.email || currentPlayer.email || '').toLowerCase();
        const uid   = auth.currentUser.uid;
        let leaguePlayer = null;

        leaguePlayersSnap.forEach(d => {
            const p = { id: d.id, ...d.data() };
            if (leaguePlayer) return;
            if (p.id === uid) { leaguePlayer = p; return; }
            if (p.id === currentPlayer?.id) { leaguePlayer = p; return; }
            if (email && String(p.email || '').toLowerCase() === email) { leaguePlayer = p; return; }
        });

        if (!leaguePlayer?.team_id) {
            els.leagueCard.style.display = 'none';
            return;
        }

        // Fetch matches for this team
        const matchesSnap = await getDocs(
            collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'matches')
        );
        const now = Date.now();
        let bestMatch = null;
        let bestTs = Infinity;

        matchesSnap.forEach(d => {
            const m = { id: d.id, ...d.data() };
            if (!['scheduled', 'in_progress'].includes(m.status)) return;
            const isMyTeam = m.home_team_id === leaguePlayer.team_id
                          || m.away_team_id === leaguePlayer.team_id;
            if (!isMyTeam) return;
            // Accept matches up to 3 days in the past (match night window)
            const matchTs = m.match_date?.toDate ? m.match_date.toDate().getTime()
                          : m.match_date?.seconds  ? m.match_date.seconds * 1000
                          : 0;
            const diff = matchTs - now;
            if (diff < -3 * 24 * 60 * 60 * 1000) return; // older than 3 days ago, skip
            if (diff < bestTs) { bestTs = diff; bestMatch = m; }
        });

        if (!bestMatch) {
            els.leagueCard.style.display = 'none';
            return;
        }

        // Resolve team names
        const [homeTeamSnap, awayTeamSnap] = await Promise.all([
            getDoc(doc(db, 'leagues', TRIPLES_LEAGUE_ID, 'teams', bestMatch.home_team_id)),
            getDoc(doc(db, 'leagues', TRIPLES_LEAGUE_ID, 'teams', bestMatch.away_team_id)),
        ]);
        const homeName = homeTeamSnap.data()?.name || 'Home';
        const awayName = awayTeamSnap.data()?.name || 'Away';
        const dateStr  = formatMatchDate(bestMatch.match_date);
        const weekStr  = bestMatch.week ? `Week ${bestMatch.week}` : '';

        els.leagueKicker.textContent = bestMatch.status === 'in_progress' ? 'In progress' : 'Your League Match';
        els.leagueVs.textContent     = `${homeName} vs ${awayName}`;
        els.leagueMeta.textContent   = [dateStr, weekStr].filter(Boolean).join(' · ');

        // Link to match-hub
        const matchHubUrl = `/pages/match-hub-vnext.html?league_id=${TRIPLES_LEAGUE_ID}&match_id=${bestMatch.id}`;
        els.leagueScorerLink.href = matchHubUrl;

        // Keyboard activation
        els.leagueCard.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.href = matchHubUrl; }
        });

        els.leagueCard.style.display = '';
    } catch (err) {
        console.warn('[Arena] League match load error:', err);
        els.leagueCard.style.display = 'none';
    }
}

// ─── 3. Online now (presence) ───────────────────────────────────────
/**
 * Read presence data from Firestore.  BRDC stores presence in /players/{id}.last_seen_at
 * and a dedicated /presence/{id} doc (from presence.js heartbeat) when available.
 * We query online_matches with status='waiting' to also surface waiting boards.
 */
async function loadPresence() {
    try {
        // Query /presence for recently active players (last 5 min)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        let onlinePlayers = [];

        try {
            const presenceSnap = await getDocs(
                query(
                    collection(db, 'presence'),
                    where('online', '==', true)
                )
            );
            presenceSnap.forEach(d => {
                const p = d.data();
                const lastSeen = p.last_seen?.toDate?.() || p.last_active?.toDate?.() || new Date(0);
                if (lastSeen >= fiveMinAgo || p.online === true) {
                    onlinePlayers.push({ id: d.id, name: p.name || p.display_name || '?', status: p.status || 'online' });
                }
            });
        } catch (_) {
            // presence collection may not exist yet — graceful empty
        }

        const count = onlinePlayers.length;
        els.onlineCount.textContent = `${count} online`;

        if (count === 0) {
            els.presenceList.innerHTML = '<div class="arena-presence-empty">No one online right now — be the first to host!</div>';
        } else {
            els.presenceList.innerHTML = onlinePlayers.slice(0, 12).map(p => `
                <div class="arena-presence-chip" title="${escHtml(p.name)}">
                    <div class="arena-presence-avatar">${escHtml(initials(p.name))}</div>
                    ${escHtml(p.name.split(' ')[0])}
                </div>
            `).join('');

            // Populate quick-match opponent picker with online players
            const myId = currentPlayer?.id || auth.currentUser?.uid;
            els.qmOpponent.innerHTML = '<option value="">Any available player</option>'
                + onlinePlayers
                    .filter(p => p.id !== myId)
                    .map(p => `<option value="${escHtml(p.id)}">${escHtml(p.name)}</option>`)
                    .join('');
        }
    } catch (err) {
        console.warn('[Arena] Presence load error:', err);
        els.presenceList.innerHTML = '<div class="arena-presence-empty">Could not load presence. Try again later.</div>';
    }
}

// ─── 4. Challenges ─────────────────────────────────────────────────
/**
 * Load challenges via getPlayerChallenges (chat-challenges.js).
 * Async key feature: challenges can be sent to offline players.
 * They receive a message_notification and see it in their Challenges section here.
 */
async function loadChallenges() {
    if (!auth.currentUser) {
        els.incomingChallenges.innerHTML = '<div class="arena-empty">Sign in to see challenges.</div>';
        return;
    }
    try {
        const result = await callFunction('getPlayerChallenges', { filter: 'all' });
        if (!result?.success) throw new Error(result?.error || 'Failed to load challenges');

        const received = (result.received || []).filter(c => c.status === 'pending');
        const sent     = (result.sent     || []).filter(c => ['pending','accepted'].includes(c.status));

        // Badge count
        if (received.length > 0) {
            els.challengeBadge.textContent = received.length;
            els.challengeBadge.style.display = '';
        } else {
            els.challengeBadge.style.display = 'none';
        }

        // Incoming
        if (received.length === 0) {
            els.incomingChallenges.innerHTML = '<div class="arena-empty">No incoming challenges.</div>';
        } else {
            els.incomingChallenges.innerHTML = received.map(c => {
                const gameLabel = c.game_type === 'corks_choice' ? "Cork's Choice" : (c.game_type || '501');
                const raceTo    = c.race_to ? ` · Race to ${c.race_to}` : '';
                const msg       = c.message ? ` · "${escHtml(c.message.slice(0, 40))}"` : '';
                return `<div class="arena-challenge-item" data-challenge-id="${escHtml(c.id)}">
                    <div class="arena-challenge-avatar">${escHtml(initials(c.challenger_name))}</div>
                    <div class="arena-challenge-info">
                        <div class="arena-challenge-name">${escHtml(c.challenger_name)}</div>
                        <div class="arena-challenge-meta">${escHtml(gameLabel)}${escHtml(raceTo)}${msg}</div>
                    </div>
                    <div class="arena-challenge-actions">
                        <button class="arena-challenge-btn accept"
                            data-challenge-id="${escHtml(c.id)}"
                            data-action="accept"
                            aria-label="Accept challenge from ${escHtml(c.challenger_name)}">Accept</button>
                        <button class="arena-challenge-btn decline"
                            data-challenge-id="${escHtml(c.id)}"
                            data-action="decline"
                            aria-label="Decline">No</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Outgoing
        if (sent.length === 0) {
            els.outgoingChallenges.innerHTML = '';
        } else {
            els.outgoingChallenges.innerHTML = sent.map(c => {
                const label     = c.status === 'accepted' ? 'Accepted!' : 'Pending…';
                const gameLabel = c.game_type === 'corks_choice' ? "Cork's Choice" : (c.game_type || '501');
                return `<div class="arena-challenge-item" style="opacity:0.75;" data-challenge-id="${escHtml(c.id)}">
                    <div class="arena-challenge-avatar" style="background:rgba(255,255,255,0.1);">${escHtml(initials(c.challenged_name))}</div>
                    <div class="arena-challenge-info">
                        <div class="arena-challenge-name">${escHtml(c.challenged_name)}</div>
                        <div class="arena-challenge-meta">${escHtml(gameLabel)} · ${escHtml(label)}</div>
                    </div>
                    <div class="arena-challenge-actions">
                        ${c.status === 'pending' ? `<button class="arena-challenge-btn cancel"
                            data-challenge-id="${escHtml(c.id)}"
                            data-action="cancel"
                            aria-label="Cancel challenge">Cancel</button>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

        // Wire accept / decline / cancel buttons
        [els.incomingChallenges, els.outgoingChallenges].forEach(container => {
            container.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => handleChallengeAction(
                    btn.dataset.challengeId,
                    btn.dataset.action
                ));
            });
        });

    } catch (err) {
        console.warn('[Arena] Challenges load error:', err);
        els.incomingChallenges.innerHTML = '<div class="arena-empty">Could not load challenges.</div>';
    }
}

async function handleChallengeAction(challengeId, action) {
    if (!challengeId) return;
    try {
        if (action === 'accept' || action === 'decline') {
            const result = await callFunction('respondToChallenge', {
                challenge_id: challengeId,
                response: action
            });
            if (result?.success) {
                toast(action === 'accept' ? 'Challenge accepted! Set up your match.' : 'Challenge declined.', action === 'accept' ? 'success' : 'info');
                if (action === 'accept' && result.scorer_url) {
                    window.location.href = result.scorer_url;
                    return;
                }
                await loadChallenges();
            } else {
                toast(result?.error || 'Action failed', 'error');
            }
        } else if (action === 'cancel') {
            const result = await callFunction('cancelChallenge', { challenge_id: challengeId });
            if (result?.success) {
                toast('Challenge cancelled.', 'info');
                await loadChallenges();
            } else {
                toast(result?.error || 'Cancel failed', 'error');
            }
        }
    } catch (err) {
        console.error('[Arena] Challenge action error:', err);
        toast('Something went wrong. Try again.', 'error');
    }
}

async function loadAllPlayersForChallengeSelect() {
    try {
        // Load players list for the challenge picker.
        // We keep it to the triples league roster to avoid a full /players scan.
        const snap = await getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'players'));
        const myId = currentPlayer?.id || auth.currentUser?.uid;

        allPlayers = [];
        snap.forEach(d => {
            if (d.id === myId) return;
            allPlayers.push({ id: d.id, name: d.data().name || 'Unknown' });
        });
        allPlayers.sort((a, b) => a.name.localeCompare(b.name));

        [els.challengePlayerSel, els.qmOpponent].forEach(sel => {
            if (!sel) return;
            const firstOpt = sel.options[0];
            sel.innerHTML = '';
            if (firstOpt) sel.appendChild(firstOpt.cloneNode(true));
            allPlayers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                sel.appendChild(opt);
            });
        });
    } catch (_) {
        // Non-critical — challenge select stays at default
    }
}

async function sendChallengeToPlayer(playerId, gameType) {
    if (!playerId) { toast('Pick a player first.', 'info'); return; }
    if (!auth.currentUser) { toast('Sign in to send challenges.', 'info'); return; }

    els.sendChallengeBtn.disabled = true;
    els.sendChallengeBtn.innerHTML = '<span class="arena-spinner"></span>';
    try {
        const result = await callFunction('sendChallenge', {
            challenged_player_id: playerId,
            game_type: gameType || '501',
            race_to: 3,
            message: '',
            start_time: 'later'
        });
        if (result?.success) {
            toast('Challenge sent! They\'ll be notified.', 'success');
            els.challengePlayerSel.value = '';
            await loadChallenges();
        } else {
            toast(result?.error || 'Failed to send challenge', 'error');
        }
    } catch (err) {
        console.error('[Arena] Send challenge error:', err);
        toast('Could not send challenge.', 'error');
    } finally {
        els.sendChallengeBtn.disabled = false;
        els.sendChallengeBtn.textContent = 'Send';
    }
}

// ─── 5. Mini Tournaments ────────────────────────────────────────────
async function loadMiniTournaments() {
    try {
        const snap = await getDocs(
            query(
                collection(db, 'mini_tournaments'),
                where('status', '==', 'active'),
                orderBy('created_at', 'desc'),
                limit(5)
            )
        );

        if (snap.empty) {
            els.tournamentList.innerHTML = '<div class="arena-empty">No active brackets right now. Create one!</div>';
            return;
        }

        els.tournamentList.innerHTML = snap.docs.map(d => {
            const t = { id: d.id, ...d.data() };
            const playerCount = Array.isArray(t.players) ? t.players.length : '?';
            const roundInfo   = t.current_round ? `Round ${t.current_round}` : 'Setting up';
            return `<div class="arena-tournament-item">
                <div class="arena-tournament-icon">🏆</div>
                <div class="arena-tournament-info">
                    <div class="arena-tournament-name">${escHtml(t.name || 'Quick Bracket')}</div>
                    <div class="arena-tournament-meta">${escHtml(t.game_type || '501')} · ${escHtml(playerCount)} players · ${escHtml(roundInfo)}</div>
                </div>
                <button class="arena-tournament-join-btn"
                    data-tournament-id="${escHtml(t.id)}"
                    data-tournament-pin="${escHtml(t.tournament_pin || '')}"
                    aria-label="Join ${escHtml(t.name || 'bracket')}">Join</button>
            </div>`;
        }).join('');

        els.tournamentList.querySelectorAll('.arena-tournament-join-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pin = btn.dataset.tournamentPin;
                if (pin) {
                    // Navigate to x01 scorer with tournament context if possible
                    window.location.href = `/pages/x01-scorer-vnext.html?tournament_pin=${encodeURIComponent(pin)}`;
                } else {
                    toast('Join link unavailable for this bracket.', 'info');
                }
            });
        });

    } catch (err) {
        console.warn('[Arena] Mini-tournaments load error:', err);
        els.tournamentList.innerHTML = '<div class="arena-empty">Could not load brackets.</div>';
    }
}

async function createMiniTournament() {
    const name      = els.tournamentName.value.trim();
    const gameType  = els.tournamentGameType.value;
    const rawNames  = els.tournamentPlayers.value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

    if (rawNames.length < 2) { toast('Enter at least 2 players.', 'info'); return; }
    if (rawNames.length > 8) { toast('Maximum 8 players.', 'info'); return; }

    els.tournamentConfirm.disabled = true;
    els.tournamentConfirm.innerHTML = '<span class="arena-spinner"></span> Creating…';

    const players = rawNames.map(n => ({ name: n }));

    try {
        const result = await callFunction('createMiniTournament', {
            name: name || undefined,
            game_type: gameType,
            players,
            bracket_type: 'single_elimination',
            game_settings: { legs_to_win: 2 }
        });

        if (result?.success) {
            toast('Bracket created!', 'success');
            hideModal(els.tournamentModal);
            els.tournamentName.value = '';
            els.tournamentPlayers.value = '';
            await loadMiniTournaments();
        } else {
            toast(result?.error || 'Failed to create bracket', 'error');
        }
    } catch (err) {
        console.error('[Arena] Create mini-tournament error:', err);
        toast('Could not create bracket.', 'error');
    } finally {
        els.tournamentConfirm.disabled = false;
        els.tournamentConfirm.textContent = 'Create bracket';
    }
}

// ─── 6. Watch live ──────────────────────────────────────────────────
/**
 * Show in-progress online_matches for spectation.
 * Backend: getActiveOnlineMatches (online-play.js) returns player's own matches;
 * for spectator list we do a direct Firestore query for all in_progress matches.
 */
async function loadWatchLive() {
    try {
        const snap = await getDocs(
            query(
                collection(db, 'online_matches'),
                where('status', '==', 'in_progress'),
                orderBy('started_at', 'desc'),
                limit(10)
            )
        );

        if (snap.empty) {
            els.watchList.innerHTML = '<div class="arena-empty">No live matches right now.</div>';
            return;
        }

        els.watchList.innerHTML = snap.docs.map(d => {
            const m = { id: d.id, ...d.data() };
            const label = `${m.player1_name || 'Player 1'} vs ${m.player2_name || 'Player 2'}`;
            const meta  = `${m.game_type || '501'} · Set ${m.current_set || 1}, Leg ${m.current_leg || 1}`;
            return `<div class="arena-watch-item"
                    role="button"
                    tabindex="0"
                    aria-label="Watch ${escHtml(label)}"
                    data-match-id="${escHtml(m.id)}">
                <span class="arena-watch-dot"></span>
                <span class="arena-watch-match-name">${escHtml(label)}</span>
                <span class="arena-watch-meta">${escHtml(meta)}</span>
                <span class="arena-chevron" aria-hidden="true">›</span>
            </div>`;
        }).join('');

        els.watchList.querySelectorAll('.arena-watch-item').forEach(item => {
            const go = () => {
                // Link to a spectator view — the x01 scorer supports ?match_id= for online matches.
                // Until a dedicated spectator page exists, link to the scorer in read-only mode.
                const matchId = item.dataset.matchId;
                window.location.href = `/pages/x01-scorer-vnext.html?match_id=${encodeURIComponent(matchId)}&spectate=1`;
            };
            item.addEventListener('click', go);
            item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        });

    } catch (err) {
        console.warn('[Arena] Watch live load error:', err);
        els.watchList.innerHTML = '<div class="arena-empty">Could not load live matches.</div>';
    }
}

// ─── Online board actions (Quick-match / Host / Join) ──────────────
async function loadOpenBoards() {
    try {
        const snap = await getDocs(
            query(
                collection(db, 'online_matches'),
                where('status', '==', 'waiting'),
                orderBy('created_at', 'desc'),
                limit(20)
            )
        );
        if (snap.empty) {
            els.joinList.innerHTML = '<div class="arena-empty">No open boards right now. Host one!</div>';
            return;
        }
        els.joinList.innerHTML = snap.docs.map(d => {
            const m = { id: d.id, ...d.data() };
            const label = m.player1_name || 'Open board';
            const meta  = `${m.game_type || '501'} · Waiting for opponent`;
            return `<div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px solid rgba(255,255,255,0.06);">
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:600; color:#fff;">${escHtml(label)}</div>
                    <div style="font-size:11px; color:var(--text-dim,#888);">${escHtml(meta)}</div>
                </div>
                <button class="arena-tournament-join-btn"
                    data-match-id="${escHtml(m.id)}"
                    aria-label="Join ${escHtml(label)}'s board">Join</button>
            </div>`;
        }).join('');

        els.joinList.querySelectorAll('[data-match-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const matchId = btn.dataset.matchId;
                if (!matchId) return;
                try {
                    const result = await callFunction('startOnlineMatch', { match_id: matchId });
                    if (result?.success) {
                        hideModal(els.joinModal);
                        toast('Joining match…', 'success');
                        window.location.href = `/pages/x01-scorer-vnext.html?match_id=${encodeURIComponent(matchId)}&online=1`;
                    } else {
                        toast(result?.error || 'Could not join', 'error');
                    }
                } catch (_) {
                    toast('Could not join this board.', 'error');
                }
            });
        });

    } catch (err) {
        console.warn('[Arena] Join boards load error:', err);
        els.joinList.innerHTML = '<div class="arena-empty">Could not load open boards.</div>';
    }
}

// ─── Modal wiring ──────────────────────────────────────────────────
function wireModals() {
    // Quick match
    els.quickMatchBtn?.addEventListener('click', () => showModal(els.qmModal));
    els.qmCancel?.addEventListener('click', () => hideModal(els.qmModal));
    els.qmModal?.addEventListener('click', e => { if (e.target === els.qmModal) hideModal(els.qmModal); });
    els.qmConfirm?.addEventListener('click', async () => {
        const opponentId = els.qmOpponent.value;
        const gameType   = els.qmGameType.value;
        const raceTo     = parseInt(els.qmRaceTo.value) || 3;
        if (!opponentId) { toast('Pick an opponent.', 'info'); return; }
        els.qmConfirm.disabled = true;
        els.qmConfirm.innerHTML = '<span class="arena-spinner"></span>';
        try {
            const result = await callFunction('sendChallenge', {
                challenged_player_id: opponentId,
                game_type: gameType,
                race_to: raceTo,
                message: '',
                start_time: 'now'
            });
            if (result?.success) {
                toast('Challenge sent!', 'success');
                hideModal(els.qmModal);
                await loadChallenges();
            } else {
                toast(result?.error || 'Failed', 'error');
            }
        } catch (_) {
            toast('Could not send challenge.', 'error');
        } finally {
            els.qmConfirm.disabled = false;
            els.qmConfirm.textContent = 'Send challenge';
        }
    });

    // Host board (creates a waiting online match via sendChallenge with "anyone" intent)
    els.hostBoardBtn?.addEventListener('click', () => showModal(els.hostModal));
    els.hostCancel?.addEventListener('click', () => hideModal(els.hostModal));
    els.hostModal?.addEventListener('click', e => { if (e.target === els.hostModal) hideModal(els.hostModal); });
    els.hostConfirm?.addEventListener('click', () => {
        // Host board: currently graceful stub since createOnlineMatch isn't surfaced as a standalone
        // callable from the client. Redirect to scorer-setup where players can invite.
        hideModal(els.hostModal);
        toast('Opening scorer setup to configure your board…', 'info');
        setTimeout(() => { window.location.href = '/pages/scorer-setup-vnext.html'; }, 800);
    });

    // Join board
    els.joinBoardBtn?.addEventListener('click', async () => {
        showModal(els.joinModal);
        await loadOpenBoards();
    });
    els.joinCancel?.addEventListener('click', () => hideModal(els.joinModal));
    els.joinModal?.addEventListener('click', e => { if (e.target === els.joinModal) hideModal(els.joinModal); });

    // Create tournament
    els.createTournamentBtn?.addEventListener('click', () => showModal(els.tournamentModal));
    els.tournamentCancel?.addEventListener('click', () => hideModal(els.tournamentModal));
    els.tournamentModal?.addEventListener('click', e => { if (e.target === els.tournamentModal) hideModal(els.tournamentModal); });
    els.tournamentConfirm?.addEventListener('click', createMiniTournament);

    // Send challenge inline
    els.sendChallengeBtn?.addEventListener('click', () => {
        sendChallengeToPlayer(
            els.challengePlayerSel.value,
            els.challengeGameType.value
        );
    });
}

// ─── Entry point ────────────────────────────────────────────────────
async function init() {
    await waitForAuthReady();

    // Resolve current player from session
    try {
        const raw = localStorage.getItem('brdc_session');
        if (raw) currentPlayer = JSON.parse(raw);
    } catch (_) {}

    if (auth.currentUser && !currentPlayer?.id) {
        try {
            const result = await callFunction('getPlayerSession', {});
            if (result?.success && result.player) {
                currentPlayer = result.player;
                localStorage.setItem('brdc_session', JSON.stringify(result.player));
            }
        } catch (_) {}
    }

    // Wire modals first (no network needed)
    wireModals();

    // Fire all sections in parallel — each handles its own empty state / error
    await Promise.all([
        loadLeagueMatch(),
        loadPresence(),
        loadAllPlayersForChallengeSelect()
            .then(() => loadChallenges()),
        loadMiniTournaments(),
        loadWatchLive(),
    ]);
}

init().catch(err => console.error('[Arena] Init error:', err));
