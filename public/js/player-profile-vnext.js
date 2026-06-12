import {
    auth,
    waitForAuthReady,
    callFunction,
    uploadImage,
    db,
    collection,
    doc,
    getDoc,
    getDocs
} from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'aOq4Y0ETxPZ66tM1uUtP';
let playerId = params.get('player_id') || params.get('id');

// True only when viewing your OWN profile (no explicit id in the URL). The
// optimistic localStorage cache is keyed off this — never cache/show someone
// else's profile when an ?id= / ?player_id= is present.
const isSelfProfileRequest = !params.get('player_id') && !params.get('id');

// Persistent (cross-session) cache for instant optimistic render of the user's
// OWN profile header/stats, while the cold Cloud Functions warm up.
// Stale-while-revalidate: read ignores TTL; the real load overwrites it.
const PROFILE_SELF_CACHE_KEY = 'brdc:vnext:profile:self:v1';

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

const els = {
    hero: document.getElementById('profileHero'),
    stats: document.getElementById('statsGrid'),
    matches: document.getElementById('matchList'),
    matchCount: document.getElementById('matchCount'),
    awards: document.getElementById('awardsGrid'),
    details: document.getElementById('profileDetails'),
    leagueProfileLink: document.getElementById('leagueProfileLink'),
    // Team + Recent sections (moved from Home)
    profileTeamSection: document.getElementById('profileTeamSection'),
    profileTeamCard: document.getElementById('profileTeamCard'),
    profileRecentSection: document.getElementById('profileRecentSection'),
    profileRecentList: document.getElementById('profileRecentList')
};

let state = {
    league: null,
    player: null,
    globalPlayer: null,
    session: null,
    stats: {},
    team: null,
    matches: [],
    selectedPhoto: null
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function finite(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function pick(...values) {
    for (const value of values) {
        const num = finite(value);
        if (num != null) return num;
    }
    return null;
}

function stat(value, decimals = 1) {
    const num = finite(value);
    return num == null || num <= 0 ? '-' : num.toFixed(decimals);
}

function pct(won, total) {
    const w = finite(won) || 0;
    const t = finite(total) || 0;
    return t > 0 ? `${Math.round((w / t) * 100)}%` : '-';
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (typeof value === 'string') {
        const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
    const date = asDate(value);
    if (!date) return 'Date TBD';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function level() {
    const player = state.player || {};
    const raw = String(player.skill_level || player.preferred_level || player.level || '').toUpperCase();
    const fill = player.is_fill_in || player.is_sub || String(player.team_id || '').toLowerCase().includes('fill');
    if (fill) return 'F';
    return ['A', 'B', 'C'].includes(raw) ? raw : '-';
}

function initials(name) {
    return String(name || 'BRDC').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'B';
}

function displayName() {
    return state.player?.name || state.globalPlayer?.name || 'Player';
}

function teamName() {
    if (state.player?.is_fill_in || level() === 'F') return 'Fill-in';
    return state.team?.team_name || state.team?.name || state.player?.team_name || '-';
}

function mergedStats() {
    const s = state.stats || {};
    const p = state.player?.stats || state.player?.unified_stats || {};
    return { ...p, ...s };
}

function coreStats() {
    const s = mergedStats();
    return {
        threeDa: pick(s.x01_three_dart_avg, s.three_dart_avg, s.avg_3da),
        mpr: pick(s.cricket_mpr, s.mpr),
        x01Legs: pick(s.x01_legs_played, s.legs_played) || 0,
        x01Wins: pick(s.x01_legs_won) || 0,
        cricketLegs: pick(s.cricket_legs_played) || 0,
        cricketWins: pick(s.cricket_legs_won) || 0,
        matches: pick(s.matches_played) || state.matches.length,
        gamesWon: pick(s.games_won) || 0,
        gamesPlayed: pick(s.games_played) || 0,
        first9: pick(s.x01_first_9_avg, s.x01_first9_avg),
        highTurn: pick(s.x01_high_turn, s.x01_high_score),
        highCheckout: pick(s.x01_high_checkout),
        tons180: pick(s.x01_tons_180, s.x01_ton_80) || 0,
        tons140: pick(s.x01_tons_140, s.x01_ton_40) || 0,
        tons120: pick(s.x01_tons_120, s.x01_ton_20) || 0,
        tons100: pick(s.x01_tons_100, s.x01_ton_00) || 0,
        cricket5: pick(s.cricket_five_mark_rounds, s.cricket_5m_plus) || 0,
        cricket6: pick(s.cricket_six_mark_rounds) || 0,
        cricket7: pick(s.cricket_seven_mark_rounds) || 0,
        cricket8: pick(s.cricket_eight_mark_rounds) || 0,
        cricket9: pick(s.cricket_nine_mark_rounds) || 0
    };
}

function renderHero() {
    const photo = state.globalPlayer?.photo_url || state.player?.photo_url;
    const stats = coreStats();
    const role = state.player?.is_fill_in || level() === 'F'
        ? 'Fill-in'
        : state.player?.is_captain ? 'Captain' : 'League player';
    els.hero.innerHTML = `
        ${photo ? `<img class="ppv-avatar" src="${escapeHtml(photo)}" alt="${escapeHtml(displayName())}">` : `<div class="ppv-avatar">${escapeHtml(initials(displayName()))}</div>`}
        <div>
            <p class="ppv-kicker">${escapeHtml(state.league?.name || '2026 Triples League')}</p>
            <h1>${escapeHtml(displayName())}</h1>
            <div class="ppv-pill-row">
                <span class="ppv-pill hot">Level ${escapeHtml(level())}</span>
                <span class="ppv-pill green">${escapeHtml(teamName())}</span>
                <span class="ppv-pill">${escapeHtml(role)}</span>
                <span class="ppv-pill">${stat(stats.threeDa, 1)} 3DA</span>
                <span class="ppv-pill">${stat(stats.mpr, 2)} MPR</span>
            </div>
        </div>
    `;
}

function metric(label, value) {
    return `<div class="ppv-stat-card"><span>${escapeHtml(label)}</span><strong class="ppv-number">${escapeHtml(value)}</strong></div>`;
}

function renderStats() {
    const s = coreStats();
    els.stats.innerHTML = [
        ['3DA', stat(s.threeDa, 1)],
        ['MPR', stat(s.mpr, 2)],
        ['01 Legs', `${s.x01Wins}/${s.x01Legs}`],
        ['Cricket Legs', `${s.cricketWins}/${s.cricketLegs}`],
        ['Game Win %', pct(s.gamesWon, s.gamesPlayed)],
        ['First 9', stat(s.first9, 1)]
    ].map(([label, value]) => metric(label, value)).join('');
}

function matchIncludesPlayer(match) {
    const playerName = String(displayName()).toLowerCase();
    if (match.home_team_id === state.player?.team_id || match.away_team_id === state.player?.team_id) return true;
    return (match.games || []).some(game => {
        const players = [...(game.home_players || []), ...(game.away_players || [])];
        return players.some(player => String(player?.id || '') === playerId || String(player?.name || '').toLowerCase() === playerName);
    });
}

function renderMatches() {
    const rows = state.matches.filter(matchIncludesPlayer)
        .sort((a, b) => Number(b.week || 0) - Number(a.week || 0))
        .slice(0, 12);
    els.matchCount.textContent = `${rows.length} shown`;
    if (!rows.length) {
        els.matches.innerHTML = '<div class="ppv-empty">No matches found for this player yet.</div>';
        return;
    }
    els.matches.innerHTML = rows.map(match => {
        const score = match.status === 'completed' ? `${Number(match.home_score || 0)}-${Number(match.away_score || 0)}` : 'vs';
        const teamId = state.player?.team_id;
        const isHomeTeam = teamId && match.home_team_id === teamId;
        const isAwayTeam = teamId && match.away_team_id === teamId;
        const side = isHomeTeam ? 'Home' : isAwayTeam ? 'Away' : 'Played';
        const myScore = isHomeTeam ? Number(match.home_score || 0) : isAwayTeam ? Number(match.away_score || 0) : null;
        const oppScore = isHomeTeam ? Number(match.away_score || 0) : isAwayTeam ? Number(match.home_score || 0) : null;
        const resultClass = match.status === 'completed' && myScore != null
            ? (myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw')
            : 'upcoming';
        return `
            <a class="ppv-match-row ${resultClass}" href="/pages/match-hub-vnext.html?league_id=${leagueId}&match_id=${escapeHtml(match.id)}">
                <span class="week">W${escapeHtml(match.week || '?')}</span>
                <span><strong>${escapeHtml(match.home_team_name || 'Home')} vs ${escapeHtml(match.away_team_name || 'Away')}</strong><small>${escapeHtml(side)} - ${escapeHtml(formatDate(match.match_date || match.date || match.scheduled_date))}</small></span>
                <em>${escapeHtml(score)}</em>
            </a>
        `;
    }).join('');
}

function award(label, value) {
    return `<div class="ppv-award-card"><span>${escapeHtml(label)}</span><strong class="ppv-number">${escapeHtml(value)}</strong></div>`;
}

function renderAwards() {
    const s = coreStats();
    els.awards.innerHTML = [
        ['180s', s.tons180],
        ['140s', s.tons140],
        ['120s', s.tons120],
        ['100s', s.tons100],
        ['High Turn', s.highTurn || '-'],
        ['High Out', s.highCheckout || '-'],
        ['5 Marks+', s.cricket5],
        ['9 Marks', s.cricket9],
        ['7/8 Marks', `${s.cricket7}/${s.cricket8}`]
    ].map(([label, value]) => award(label, value)).join('');
}

function renderDetails() {
    if (els.leagueProfileLink) {
        els.leagueProfileLink.href = `/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}`;
    }
    const items = [
        ['Player ID', playerId],
        ['Email', state.player?.email || state.globalPlayer?.email || '-'],
        ['Phone', state.player?.phone || state.globalPlayer?.phone || '-'],
        ['Team', teamName()],
        ['Level', level()],
        ['Role', state.player?.is_fill_in ? 'Fill-in' : state.player?.is_captain ? 'Captain' : 'Player'],
        ['League', state.league?.name || '2026 Triples League']
    ];
    const detailRows = items.map(([label, value]) => `
        <div class="ppv-detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join('');
    els.details.innerHTML = detailRows + renderSettingsPanel();
    wireSettingsPanel();
}

function isOwnProfile() {
    return Boolean(state.session?.id && state.session.id === playerId);
}

function renderSettingsPanel() {
    if (!isOwnProfile()) return '';
    const player = state.globalPlayer || state.player || {};
    return `
        <form class="ppv-settings-card" id="profileSettingsForm">
            <div class="ppv-section-head compact">
                <div><p class="ppv-kicker">Account</p><h2>Settings</h2></div>
                <button type="submit" id="saveProfileBtn">Save</button>
            </div>
            <div class="ppv-settings-grid">
                <label>Display name<input id="settingsName" name="name" autocomplete="name" value="${escapeHtml(player.name || displayName())}"></label>
                <label>Email<input id="settingsEmail" name="email" type="email" autocomplete="email" value="${escapeHtml(player.email || '')}"></label>
                <label>Phone<input id="settingsPhone" name="phone" autocomplete="tel" value="${escapeHtml(player.phone || '')}"></label>
                <label>ZIP<input id="settingsZip" name="zip" inputmode="numeric" value="${escapeHtml(player.zip || '')}"></label>
                <label>Home bar<input id="settingsHomeBar" name="home_bar" value="${escapeHtml(player.home_bar || '')}"></label>
                <label>Preferred game
                    <select id="settingsPreferredGame" name="preferred_game">
                        ${['', '501', 'Cricket', 'Choice', 'Around the Clock'].map(value => `<option value="${escapeHtml(value)}" ${String(player.preferred_game || '') === value ? 'selected' : ''}>${escapeHtml(value || 'No preference')}</option>`).join('')}
                    </select>
                </label>
                <label class="wide">Bio<textarea id="settingsBio" name="bio" rows="3" maxlength="200">${escapeHtml(player.bio || '')}</textarea></label>
                <label class="wide">Profile photo<input id="settingsPhoto" name="photo" type="file" accept="image/*"></label>
            </div>
            <div class="ppv-settings-checks">
                ${settingCheck('show_email', 'Show email', player.privacy?.show_email)}
                ${settingCheck('show_phone', 'Show phone', player.privacy?.show_phone)}
                ${settingCheck('allow_messages', 'Allow messages', player.privacy?.allow_messages !== false)}
                ${settingCheck('sms', 'SMS updates', player.notifications?.sms !== false)}
                ${settingCheck('email', 'Email updates', player.notifications?.email !== false)}
            </div>
            <div class="ppv-settings-status" id="profileSettingsStatus"></div>
        </form>
    `;
}

function settingCheck(name, label, checked) {
    return `<label><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''}> ${escapeHtml(label)}</label>`;
}

function wireSettingsPanel() {
    const form = document.getElementById('profileSettingsForm');
    if (!form) return;
    document.getElementById('settingsPhoto')?.addEventListener('change', event => {
        state.selectedPhoto = event.target.files?.[0] || null;
    });
    form.addEventListener('submit', saveProfileSettings);
}

function setSettingsStatus(message, type = '') {
    const status = document.getElementById('profileSettingsStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `ppv-settings-status ${type}`.trim();
}

async function saveProfileSettings(event) {
    event.preventDefault();
    if (!isOwnProfile()) return;
    const form = event.currentTarget;
    const button = document.getElementById('saveProfileBtn');
    button.disabled = true;
    setSettingsStatus('Saving profile...');
    try {
        const formData = new FormData(form);
        let photoUrl = '';
        if (state.selectedPhoto) {
            setSettingsStatus('Uploading profile photo...');
            photoUrl = await uploadImage(state.selectedPhoto, 'players');
        }
        const payload = {
            player_id: playerId,
            name: String(formData.get('name') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            phone: String(formData.get('phone') || '').trim(),
            zip: String(formData.get('zip') || '').trim(),
            home_bar: String(formData.get('home_bar') || '').trim(),
            preferred_game: String(formData.get('preferred_game') || ''),
            bio: String(formData.get('bio') || '').trim(),
            privacy: {
                show_email: formData.get('show_email') === 'on',
                show_phone: formData.get('show_phone') === 'on',
                allow_messages: formData.get('allow_messages') === 'on'
            },
            notifications: {
                sms: formData.get('sms') === 'on',
                email: formData.get('email') === 'on'
            }
        };
        if (photoUrl) payload.photo_url = photoUrl;
        const result = await callFunction('updateGlobalPlayer', payload);
        if (!result?.success) throw new Error(result?.error || 'Profile save failed');
        state.globalPlayer = { ...(state.globalPlayer || {}), ...payload };
        state.player = { ...(state.player || {}), name: payload.name || state.player?.name, email: payload.email, phone: payload.phone, photo_url: photoUrl || state.player?.photo_url };
        state.selectedPhoto = null;
        setSettingsStatus('Profile saved.', 'success');
        renderHero();
        renderDetails();
    } catch (error) {
        setSettingsStatus(error.message || 'Profile save failed.', 'error');
    } finally {
        button.disabled = false;
    }
}

function initTabs() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.viewTarget;
            document.querySelectorAll('[data-view-target]').forEach(item => item.classList.toggle('active', item === button));
            document.querySelectorAll('[data-view-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.viewPane === target));
        });
    });
}

async function loadData() {
    await waitForAuthReady(5000).catch(() => null);

    // No explicit ?id= in the URL → fall back to the signed-in user's OWN profile.
    let preloadedSession = null;
    if (!playerId) {
        if (auth.currentUser) {
            preloadedSession = await callFunction('getPlayerSession', {}).catch(() => null);
            if (preloadedSession?.success && preloadedSession.player?.id) {
                playerId = preloadedSession.player.id;
            }
        }
        // Still no id → genuinely not signed in (and no profile requested)
        if (!playerId) throw new Error('NOT_SIGNED_IN');
    }

    const sessionPromise = preloadedSession
        ? Promise.resolve(preloadedSession)
        : (auth.currentUser
            ? callFunction('getPlayerSession', {}).catch(() => null)
            : Promise.resolve(null));
    const [leagueSnap, leaguePlayerSnap, globalPlayerSnap, statsSnap, teamsSnap, matchesSnap, sessionResult] = await Promise.all([
        getDoc(doc(db, 'leagues', leagueId)).catch(() => null),
        getDoc(doc(db, 'leagues', leagueId, 'players', playerId)),
        getDoc(doc(db, 'players', playerId)).catch(() => null),
        getDoc(doc(db, 'leagues', leagueId, 'stats', playerId)).catch(() => null),
        getDocs(collection(db, 'leagues', leagueId, 'teams')),
        getDocs(collection(db, 'leagues', leagueId, 'matches')),
        sessionPromise
    ]);
    if (!leaguePlayerSnap.exists() && !globalPlayerSnap?.exists?.()) throw new Error('Player not found');
    state.league = leagueSnap?.exists?.() ? { id: leagueSnap.id, ...leagueSnap.data() } : null;
    state.player = leaguePlayerSnap.exists() ? { id: leaguePlayerSnap.id, ...leaguePlayerSnap.data() } : { id: globalPlayerSnap.id, ...globalPlayerSnap.data() };
    state.globalPlayer = globalPlayerSnap?.exists?.() ? { id: globalPlayerSnap.id, ...globalPlayerSnap.data() } : null;
    state.session = sessionResult?.success ? sessionResult.player : null;
    state.stats = statsSnap?.exists?.() ? { id: statsSnap.id, ...statsSnap.data() } : {};
    const teams = teamsSnap.docs.map(team => ({ id: team.id, ...team.data() }));
    state.team = teams.find(team => team.id === state.player.team_id) || null;
    state.matches = matchesSnap.docs.map(match => ({ id: match.id, ...match.data() }));
}

// ─── Helpers shared with team/recent renderers ─────────────────────

function getMatchDate(match) {
    const raw = match.match_date || match.date || match.scheduled_date || match.scheduled_at;
    if (!raw) return null;
    return asDate(raw);
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
        .map((t, i) => [t.id, i + 1]));
}

function compactName(value) {
    const name = typeof value === 'string' ? value : (value?.team_name || value?.name || 'Team');
    if (name.length <= 14) return name;
    return name.replace(/\bCleveland\b/i, 'Cle').replace(/\bCompany\b/i, 'Co.').replace(/\bNightmares\b/i, 'Nightmrs').trim();
}

/** Render the Your Team card (moved from Home) */
function renderProfileTeamCard() {
    if (!els.profileTeamSection || !els.profileTeamCard) return;

    const team = state.team;
    if (!team) {
        // Don't show the section if no team found
        els.profileTeamSection.style.display = 'none';
        return;
    }

    const teams = state.matches.length > 0 ? null : null; // teams array not separately stored, derive rank from matches context
    // Build a minimal teams array from matches to derive rank (best effort)
    const allTeamIds = new Set();
    state.matches.forEach(m => {
        if (m.home_team_id) allTeamIds.add(m.home_team_id);
        if (m.away_team_id) allTeamIds.add(m.away_team_id);
    });
    // We don't have the full teams list in state, so rank is not available here.
    // Show rank from team document fields if available.
    const rank = team.rank || team.standings_rank || null;
    const record = getTeamRecordText(team);

    els.profileTeamCard.innerHTML = `
        <div class="ppv-team-header">
            <div>
                <strong class="ppv-team-name">${escapeHtml(team.team_name || team.name || 'Your Team')}</strong>
                <span class="ppv-team-league">2026 Triples League</span>
            </div>
            <div class="ppv-team-badges">
                ${rank ? `<span class="ppv-team-rank">#${rank}</span>` : ''}
                <span class="ppv-team-record">${escapeHtml(record)}</span>
            </div>
        </div>
        <div class="ppv-team-footer">
            <a href="/pages/triples-vnext.html" class="ppv-link-action">League standings →</a>
        </div>
    `;
    els.profileTeamSection.style.display = '';
}

/** Render recent match results (moved from Home).
 *  Uses state.matches (already loaded) filtered to the player's team.
 *  Shows up to 5 most recent completed matches. */
function renderProfileRecentMatches() {
    if (!els.profileRecentSection || !els.profileRecentList) return;

    const teamId = state.player?.team_id;
    if (!teamId) {
        els.profileRecentSection.style.display = 'none';
        return;
    }

    const completed = state.matches
        .filter(m => m.status === 'completed')
        .filter(m => m.home_team_id === teamId || m.away_team_id === teamId)
        .sort((a, b) => {
            const ad = getMatchDate(a) || new Date(0);
            const bd = getMatchDate(b) || new Date(0);
            return bd - ad;
        })
        .slice(0, 5);

    if (!completed.length) {
        els.profileRecentSection.style.display = 'none';
        return;
    }

    // Build a lightweight teamsById from match data (names only)
    const teamsById = {};
    state.matches.forEach(m => {
        if (m.home_team_id && m.home_team_name) teamsById[m.home_team_id] = { name: m.home_team_name };
        if (m.away_team_id && m.away_team_name) teamsById[m.away_team_id] = { name: m.away_team_name };
    });
    // Also include actual state.team
    if (state.team) teamsById[state.team.id] = state.team;

    const rows = completed.map(m => {
        const mySide = m.home_team_id === teamId ? 'home' : 'away';
        const myScore = Number(m[`${mySide}_score`] ?? 0);
        const oppScore = Number(m[mySide === 'home' ? 'away_score' : 'home_score'] ?? 0);
        const won = myScore > oppScore;
        const tied = myScore === oppScore;
        const resultClass = tied ? 'draw' : won ? 'win' : 'loss';
        const resultLabel = tied ? 'TIE' : won ? 'WIN' : 'LOSS';

        const myTeam = teamsById[teamId];
        const oppId = mySide === 'home' ? m.away_team_id : m.home_team_id;
        const oppTeam = teamsById[oppId];
        const myName = compactName(myTeam || (mySide === 'home' ? m.home_team_name : m.away_team_name) || 'Us');
        const oppName = compactName(oppTeam || (mySide === 'home' ? m.away_team_name : m.home_team_name) || 'Opp');

        const matchDate = getMatchDate(m);
        const weekStr = m.week ? `Wk ${m.week}` : '';
        const dateStr = matchDate ? matchDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
        const metaStr = [weekStr, dateStr].filter(Boolean).join(' · ');

        return `
            <a class="ppv-recent-row ${resultClass}" href="/pages/match-hub-vnext.html?league_id=${escapeHtml(leagueId)}&match_id=${escapeHtml(m.id)}">
                <span class="ppv-recent-result ${resultClass}">${resultLabel}</span>
                <span class="ppv-recent-teams">
                    <strong>${escapeHtml(myName)}</strong>
                    <span class="ppv-recent-score">${myScore} – ${oppScore}</span>
                    <span class="ppv-recent-opp">${escapeHtml(oppName)}</span>
                </span>
                <span class="ppv-recent-meta">${escapeHtml(metaStr)}</span>
            </a>
        `;
    }).join('');

    els.profileRecentList.innerHTML = rows;
    els.profileRecentSection.style.display = '';
}

function renderAll() {
    renderHero();
    renderStats();
    renderMatches();
    renderAwards();
    renderDetails();
    renderProfileTeamCard();
    renderProfileRecentMatches();
}

// Paint the header + stats INSTANTLY from the last-known self profile, so the
// above-the-fold content shows real data (≈0.6s) instead of placeholders for
// ~10s while auth resolves and the cold Cloud Functions warm up. Purely
// additive — the real loadData()/renderAll() below overwrites this with fresh
// data. Only for the OWN-profile case (no ?id= in the URL).
function renderOptimisticSelf() {
    if (!isSelfProfileRequest) return;
    const cached = readLocalCache(PROFILE_SELF_CACHE_KEY);
    if (!cached) return;
    state.player = cached.player || state.player;
    state.globalPlayer = cached.globalPlayer || state.globalPlayer;
    state.team = cached.team || state.team;
    state.stats = cached.stats || state.stats;
    if (cached.league) state.league = cached.league;
    if (cached.playerId) playerId = cached.playerId;
    try {
        renderHero();
        renderStats();
    } catch {
        // optimistic only — never block the real load
    }
}

// Persist the rendered self profile (header + stats inputs) for instant paint
// on the next open. Only the OWN profile, never someone else's.
function writeOptimisticSelf() {
    if (!isSelfProfileRequest) return;
    if (!isOwnProfile()) return;   // double-guard: confirmed signed-in user's own profile
    writeLocalCache(PROFILE_SELF_CACHE_KEY, {
        playerId,
        player: state.player,
        globalPlayer: state.globalPlayer,
        team: state.team,
        stats: state.stats,
        league: state.league
    });
}

async function init() {
    initTabs();
    renderOptimisticSelf();
    try {
        await loadData();
        renderAll();
        writeOptimisticSelf();
    } catch (error) {
        console.error('[player-profile-vnext] failed:', error);
        if (error.message === 'NOT_SIGNED_IN') {
            els.hero.innerHTML = `<div class="ppv-empty">
                <p>Sign in to view your profile.</p>
                <a href="/" class="ppv-link-action">Sign in</a>
            </div>`;
        } else {
            els.hero.innerHTML = `<div class="ppv-empty">${escapeHtml(error.message || 'Could not load player.')}</div>`;
        }
    }
}

init();
