import {
    auth,
    waitForAuthReady,
    callFunction,
    uploadImage
} from '/js/firebase-config.js';

const TRIPLES_LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

const els = {
    teamName: document.getElementById('teamName'),
    captainStatus: document.getElementById('captainStatus'),
    teamRank: document.getElementById('teamRank'),
    teamRecord: document.getElementById('teamRecord'),
    team3da: document.getElementById('team3da'),
    teamMpr: document.getElementById('teamMpr'),
    matchNightCard: document.getElementById('matchNightCard'),
    rosterList: document.getElementById('rosterList'),
    subsList: document.getElementById('subsList'),
    scheduleList: document.getElementById('scheduleList'),
    requestsList: document.getElementById('requestsList'),
    messageTeamLink: document.getElementById('messageTeamLink'),
    classicCaptainLink: document.getElementById('classicCaptainLink'),
    fillinModal: document.getElementById('fillinModal'),
    fillinMatch: document.getElementById('fillinMatch'),
    fillinLevel: document.getElementById('fillinLevel'),
    fillinSubList: document.getElementById('fillinSubList'),
    fillinMessage: document.getElementById('fillinMessage'),
    fillinStatus: document.getElementById('fillinStatus'),
    sendFillinBtn: document.getElementById('sendFillinBtn'),
    teamPhotoPreview: document.getElementById('teamPhotoPreview'),
    teamNameInput: document.getElementById('teamNameInput'),
    teamMottoInput: document.getElementById('teamMottoInput'),
    teamPhotoInput: document.getElementById('teamPhotoInput'),
    saveTeamProfileBtn: document.getElementById('saveTeamProfileBtn'),
    teamProfileStatus: document.getElementById('teamProfileStatus')
};

let session = null;
let dashboard = null;
let currentLeagueId = TRIPLES_LEAGUE_ID;
let currentTeamId = null;
let currentPlayerId = null;
let currentSubFilter = 'ALL';
let selectedTeamPhoto = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function toast(message, type = 'info') {
    const fn = type === 'error' ? window.toastError : type === 'success' ? window.toastSuccess : window.toastInfo;
    if (typeof fn === 'function') fn(message);
    else console[type === 'error' ? 'error' : 'log'](message);
}

function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function stat(value, decimals = 1) {
    const n = number(value);
    return n > 0 ? n.toFixed(decimals) : '-';
}

function levelOf(player) {
    const raw = String(player?.skill_level || player?.level || player?.preferred_level || '').toUpperCase();
    if (['A', 'B', 'C'].includes(raw)) return raw;
    if (player?.is_fillin || player?.is_fill_in || player?.is_sub) return 'F';
    return '?';
}

function sortByLevel(a, b) {
    const order = { A: 1, B: 2, C: 3, F: 4, '?': 9 };
    const aOrder = order[levelOf(a)] || 9;
    const bOrder = order[levelOf(b)] || 9;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function formatDate(value) {
    if (!value) return 'TBD';
    const raw = value?.toDate ? value.toDate() : new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    if (Number.isNaN(raw.getTime())) return 'TBD';
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(raw);
}

function findCaptainIds(player) {
    const involvement = (player?.involvements?.leagues || []).find(item =>
        item.league_id === TRIPLES_LEAGUE_ID && item.team_id && (item.role === 'captain' || player.is_captain)
    ) || (player?.involvements?.leagues || []).find(item => item.league_id === TRIPLES_LEAGUE_ID && item.team_id);

    return {
        leagueId: involvement?.league_id || player?.league_id || TRIPLES_LEAGUE_ID,
        teamId: involvement?.team_id || player?.team_id || null
    };
}

function getNextMatch() {
    const matches = dashboard?.matches || [];
    return matches.find(match => match.status !== 'completed') || matches[matches.length - 1] || null;
}

function opponentName(match) {
    if (!match) return 'Opponent';
    return match.is_home ? (match.away_team_name || 'Opponent') : (match.home_team_name || 'Opponent');
}

function playerStats(playerId) {
    return (dashboard?.player_stats || []).find(item => item.player_id === playerId) || {};
}

function winPct(stats) {
    const won = number(stats.x01_legs_won) + number(stats.cricket_legs_won);
    const played = number(stats.x01_legs_played) + number(stats.cricket_legs_played);
    return played > 0 ? `${Math.round((won / played) * 100)}%` : '-';
}

function availabilityFor(playerId, matchId = getNextMatch()?.id) {
    const match = (dashboard?.matches || []).find(item => item.id === matchId);
    return match?.availability?.[playerId] || 'unknown';
}

function renderHero() {
    const team = dashboard.team || {};
    const rosterCount = (team.players || []).length;
    const fillinCount = (dashboard.available_subs || []).length;
    const params = new URLSearchParams({
        league_id: currentLeagueId,
        team_id: currentTeamId || ''
    });
    els.teamName.textContent = team.team_name || team.name || 'Team';
    els.captainStatus.textContent = `${dashboard.league?.league_name || '2026 Triples League'} - ${rosterCount} roster players - ${fillinCount} fill-ins available`;
    els.teamRank.textContent = team.standing ? `#${team.standing}` : '-';
    els.teamRecord.textContent = `${number(team.wins)}-${number(team.losses)}`;
    els.team3da.textContent = stat(team.team_3da, 1);
    els.teamMpr.textContent = stat(team.team_mpr, 2);
    els.messageTeamLink.href = `/pages/messages-vnext.html?${params}`;
    els.classicCaptainLink.href = `/pages/captain-dashboard.html?${params}`;
}

function renderMatchNight() {
    const match = getNextMatch();
    const team = dashboard.team || {};
    if (!match) {
        els.matchNightCard.innerHTML = '<div class="cv-empty">No match found for this team.</div>';
        return;
    }

    const isCompleted = match.status === 'completed';
    const myScore = match.is_home ? number(match.home_score) : number(match.away_score);
    const oppScore = match.is_home ? number(match.away_score) : number(match.home_score);
    const scoreText = isCompleted ? `${myScore}-${oppScore}` : (match.is_home ? 'Home' : 'Away');

    els.matchNightCard.innerHTML = `
        <div class="cv-match-poster">
            <div class="cv-team-side">
                <span>Your team</span>
                <h2>${escapeHtml(team.team_name || team.name || 'Team')}</h2>
                <span>${stat(team.team_3da, 1)} 3DA - ${stat(team.team_mpr, 2)} MPR</span>
            </div>
            <div class="cv-match-middle">
                <span>Week ${escapeHtml(match.week || '-')}</span>
                <div class="cv-vs">${escapeHtml(scoreText)}</div>
                <span>${escapeHtml(formatDate(match.match_date))}</span>
            </div>
            <div class="cv-team-side right">
                <span>Opponent</span>
                <h2>${escapeHtml(opponentName(match))}</h2>
                <span>${escapeHtml(match.status || 'scheduled')}</span>
            </div>
        </div>
        <div class="cv-action-row">
            <a href="/pages/match-hub-vnext.html?league_id=${encodeURIComponent(currentLeagueId)}&match_id=${encodeURIComponent(match.id)}">${isCompleted ? 'View match' : 'Open match hub'}</a>
            <button type="button" data-open-fillin>Find fill-in</button>
            <a href="/pages/messages-vnext.html?league_id=${encodeURIComponent(currentLeagueId)}&team_id=${encodeURIComponent(currentTeamId || '')}">Team chat</a>
            <a href="/pages/captain-dashboard.html?league_id=${encodeURIComponent(currentLeagueId)}&team_id=${encodeURIComponent(currentTeamId || '')}" class="secondary" title="Open match report import tools">Import report</a>
        </div>
    `;
    els.matchNightCard.querySelector('[data-open-fillin]')?.addEventListener('click', openFillinModal);
}

function renderRoster() {
    const match = getNextMatch();
    const rows = [...(dashboard.team?.players || [])].sort(sortByLevel);
    if (!rows.length) {
        els.rosterList.innerHTML = '<div class="cv-empty">No roster loaded.</div>';
        return;
    }

    els.rosterList.innerHTML = rows.map(player => {
        const stats = playerStats(player.id);
        const level = levelOf(player);
        const status = availabilityFor(player.id, match?.id);
        return `
            <div class="cv-roster-row" data-player-id="${escapeHtml(player.id)}">
                <span class="cv-level ${level === 'F' ? 'level-f' : ''}">${escapeHtml(level)}</span>
                <span>
                    <span class="cv-name">${escapeHtml(player.name)}</span>
                    <span class="cv-statline">${stat(stats.x01_three_dart_avg, 1)} 3DA - ${stat(stats.cricket_mpr, 2)} MPR - ${winPct(stats)} W%</span>
                    <span class="cv-availability ${escapeHtml(status)}">${escapeHtml(status === 'available' ? 'Available' : status === 'unavailable' ? 'Out' : 'No RSVP')}</span>
                </span>
                ${match ? `<span class="cv-rsvp">
                    <button type="button" class="${status === 'available' ? 'in' : 'unknown'}" data-rsvp="${escapeHtml(player.id)}" data-available="true">In</button>
                    <button type="button" class="${status === 'unavailable' ? 'out' : 'unknown'}" data-rsvp="${escapeHtml(player.id)}" data-available="false">Out</button>
                </span>` : ''}
            </div>
        `;
    }).join('');

    els.rosterList.querySelectorAll('[data-rsvp]').forEach(button => {
        button.addEventListener('click', () => setAvailability(button.dataset.rsvp, match.id, button.dataset.available === 'true'));
    });
}

function renderSubs(filter = currentSubFilter) {
    currentSubFilter = filter;
    const subs = [...(dashboard.available_subs || [])].sort(sortByLevel).filter(sub => filter === 'ALL' || levelOf(sub) === filter);
    if (!subs.length) {
        els.subsList.innerHTML = `<div class="cv-empty">No ${filter === 'ALL' ? '' : `${filter} `}fill-ins available.</div>`;
        return;
    }
    els.subsList.innerHTML = subs.slice(0, 24).map(sub => {
        const level = levelOf(sub);
        return `
            <div class="cv-sub-row">
                <span class="cv-level ${level === 'F' ? 'level-f' : ''}">${escapeHtml(level)}</span>
                <span>
                    <span class="cv-name">${escapeHtml(sub.name)}</span>
                    <span class="cv-statline">${stat(sub.x01_three_dart_avg || sub.avg_3da, 1)} 3DA - ${stat(sub.cricket_mpr || sub.mpr, 2)} MPR</span>
                </span>
                <span class="cv-meta">${escapeHtml(sub.phone ? sub.phone : 'Contact in app')}</span>
            </div>
        `;
    }).join('');
}

function renderSchedule() {
    const matches = dashboard.matches || [];
    if (!matches.length) {
        els.scheduleList.innerHTML = '<div class="cv-empty">No schedule loaded.</div>';
        return;
    }
    els.scheduleList.innerHTML = matches.map(match => {
        const completed = match.status === 'completed';
        const myScore = match.is_home ? number(match.home_score) : number(match.away_score);
        const oppScore = match.is_home ? number(match.away_score) : number(match.home_score);
        return `
            <a class="cv-schedule-row" href="/pages/match-hub-vnext.html?league_id=${encodeURIComponent(currentLeagueId)}&match_id=${encodeURIComponent(match.id)}">
                <span class="cv-meta">W${escapeHtml(match.week || '-')}<br>${escapeHtml(formatDate(match.match_date))}</span>
                <span>
                    <span class="cv-name">${escapeHtml(dashboard.team?.team_name || 'Team')} vs ${escapeHtml(opponentName(match))}</span>
                    <span class="cv-statline">${escapeHtml(match.is_home ? 'Home' : 'Away')} - ${escapeHtml(match.status || 'scheduled')}</span>
                </span>
                <span class="cv-match-score">${completed ? `${myScore}-${oppScore}` : 'TBD'}</span>
            </a>
        `;
    }).join('');
}

function renderRequests() {
    const requests = dashboard.pending_fillin_requests || [];
    if (!requests.length) {
        els.requestsList.innerHTML = '<div class="cv-empty">No pending fill-in requests.</div>';
        return;
    }
    els.requestsList.innerHTML = requests.map(req => `
        <div class="cv-request-row">
            <span class="cv-level level-f">F</span>
            <span>
                <span class="cv-name">Week ${escapeHtml(req.match_week || '-')} request</span>
                <span class="cv-statline">${number(req.interested?.length)} interested - ${number(req.pending?.length)} pending - ${number(req.declined?.length)} declined</span>
            </span>
            <span class="cv-meta">${escapeHtml(req.status || 'pending')}</span>
        </div>
    `).join('');
}

function teamInitials(team = dashboard?.team || {}) {
    return String(team.team_name || team.name || 'Team')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('') || 'T';
}

function renderTeamProfile() {
    const team = dashboard?.team || {};
    els.teamNameInput.value = team.team_name || team.name || '';
    els.teamMottoInput.value = team.motto || '';
    els.teamPhotoPreview.innerHTML = team.photo_url
        ? `<img src="${escapeHtml(team.photo_url)}" alt="${escapeHtml(team.team_name || team.name || 'Team')} photo">`
        : `<span>${escapeHtml(teamInitials(team))}</span>`;
    els.teamProfileStatus.textContent = '';
    els.teamProfileStatus.className = 'cv-status';
}

async function saveTeamProfile() {
    if (!dashboard?.team || !currentLeagueId || !currentTeamId) return;
    els.saveTeamProfileBtn.disabled = true;
    els.teamProfileStatus.textContent = 'Saving team profile...';
    els.teamProfileStatus.className = 'cv-status';

    try {
        const settings = {
            team_name: els.teamNameInput.value.trim(),
            motto: els.teamMottoInput.value.trim()
        };
        if (selectedTeamPhoto) {
            els.teamProfileStatus.textContent = 'Uploading team photo...';
            settings.photo_url = await uploadImage(selectedTeamPhoto, 'teams');
        }
        const result = await callFunction('updateTeamSettings', {
            league_id: currentLeagueId,
            team_id: currentTeamId,
            captain_id: currentPlayerId,
            settings
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to save team profile');
        dashboard.team = { ...dashboard.team, ...settings };
        selectedTeamPhoto = null;
        els.teamPhotoInput.value = '';
        els.teamProfileStatus.textContent = 'Team profile saved.';
        els.teamProfileStatus.className = 'cv-status success';
        toast('Team profile saved', 'success');
        renderHero();
        renderMatchNight();
        renderSchedule();
        renderTeamProfile();
    } catch (error) {
        els.teamProfileStatus.textContent = error.message || 'Failed to save team profile';
        els.teamProfileStatus.className = 'cv-status error';
        toast(els.teamProfileStatus.textContent, 'error');
    } finally {
        els.saveTeamProfileBtn.disabled = false;
    }
}

function renderFillinModalSubs() {
    const level = els.fillinLevel.value;
    const subs = [...(dashboard.available_subs || [])].sort(sortByLevel).filter(sub => level === 'ALL' || levelOf(sub) === level);
    els.fillinSubList.innerHTML = subs.length ? subs.map(sub => `
        <label class="cv-sub-check">
            <input type="checkbox" value="${escapeHtml(sub.id)}">
            <span>
                <span class="cv-name">${escapeHtml(sub.name)}</span>
                <span class="cv-statline">${stat(sub.x01_three_dart_avg || sub.avg_3da, 1)} 3DA - ${stat(sub.cricket_mpr || sub.mpr, 2)} MPR</span>
            </span>
            <span class="cv-level ${levelOf(sub) === 'F' ? 'level-f' : ''}">${escapeHtml(levelOf(sub))}</span>
        </label>
    `).join('') : '<div class="cv-empty">No matching fill-ins.</div>';
}

function openFillinModal() {
    const upcoming = (dashboard.matches || []).filter(match => match.status !== 'completed');
    els.fillinMatch.innerHTML = upcoming.map(match => `<option value="${escapeHtml(match.id)}">Week ${escapeHtml(match.week)} - ${escapeHtml(formatDate(match.match_date))} - ${escapeHtml(opponentName(match))}</option>`).join('');
    renderFillinModalSubs();
    els.fillinStatus.textContent = '';
    els.fillinStatus.className = 'cv-status';
    els.fillinModal.classList.add('active');
    els.fillinModal.setAttribute('aria-hidden', 'false');
}

function closeFillinModal() {
    els.fillinModal.classList.remove('active');
    els.fillinModal.setAttribute('aria-hidden', 'true');
}

async function sendFillinRequests() {
    const subIds = [...els.fillinSubList.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    const matchId = els.fillinMatch.value;
    if (!matchId || !subIds.length) {
        els.fillinStatus.textContent = 'Choose a match and at least one fill-in.';
        els.fillinStatus.className = 'cv-status error';
        return;
    }

    els.sendFillinBtn.disabled = true;
    els.fillinStatus.textContent = 'Sending requests...';
    try {
        const result = await callFunction('sendFillinRequests', {
            league_id: currentLeagueId,
            team_id: currentTeamId,
            match_id: matchId,
            sub_ids: subIds,
            message: els.fillinMessage.value.trim() || null,
            captain_id: currentPlayerId
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to send requests');
        els.fillinStatus.textContent = `Sent to ${result.sent_to?.length || subIds.length} fill-ins.`;
        els.fillinStatus.className = 'cv-status success';
        toast('Fill-in requests sent', 'success');
        setTimeout(closeFillinModal, 700);
    } catch (error) {
        els.fillinStatus.textContent = error.message || 'Failed to send requests';
        els.fillinStatus.className = 'cv-status error';
    } finally {
        els.sendFillinBtn.disabled = false;
    }
}

async function setAvailability(playerId, matchId, available) {
    const match = (dashboard.matches || []).find(item => item.id === matchId);
    if (match) {
        match.availability = match.availability || {};
        match.availability[playerId] = available ? 'available' : 'unavailable';
        renderRoster();
    }

    try {
        const result = await callFunction('setPlayerAvailability', {
            league_id: currentLeagueId,
            match_id: matchId,
            player_id: playerId,
            available
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to update RSVP');
        toast('RSVP updated', 'success');
    } catch (error) {
        toast(error.message || 'Failed to update RSVP', 'error');
    }
}

function gatedSections() {
    return [
        document.getElementById('matchNightCard')?.closest('.cv-match-night') || document.getElementById('matchNightCard'),
        document.querySelector('.cv-grid')
    ].filter(Boolean);
}

function showGate(message) {
    // Hide every captain editing surface (match night, roster, fill-in,
    // schedule, requests, team profile) so a signed-out visitor never sees
    // half-loaded management blocks or skeleton placeholder rows.
    gatedSections().forEach(section => { section.hidden = true; });

    const shell = document.querySelector('.cv-shell');
    if (!shell || document.getElementById('captainGate')) return;

    const gate = document.createElement('section');
    gate.className = 'cv-card';
    gate.id = 'captainGate';
    gate.innerHTML = `
        <div class="cv-card-head">
            <div>
                <p class="cv-kicker">Captain board</p>
                <h2>Captain login required</h2>
            </div>
        </div>
        <div class="cv-empty">
            <p>${escapeHtml(message || 'Log in from the dashboard to manage your team.')}</p>
            <p style="margin-top:12px;">
                <a href="/pages/home-vnext.html">Go to Home / Log in</a>
            </p>
        </div>
    `;
    shell.appendChild(gate);
}

function renderAll() {
    renderHero();
    renderMatchNight();
    renderRoster();
    renderSubs();
    renderSchedule();
    renderRequests();
    renderTeamProfile();
}

function wireEvents() {
    document.querySelectorAll('[data-sub-filter]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-sub-filter]').forEach(item => item.classList.toggle('active', item === button));
            renderSubs(button.dataset.subFilter);
        });
    });
    document.getElementById('openFillinBtn').addEventListener('click', openFillinModal);
    document.getElementById('closeFillinBtn').addEventListener('click', closeFillinModal);
    els.sendFillinBtn.addEventListener('click', sendFillinRequests);
    els.fillinLevel.addEventListener('change', renderFillinModalSubs);
    els.saveTeamProfileBtn.addEventListener('click', saveTeamProfile);
    els.teamPhotoInput.addEventListener('change', () => {
        selectedTeamPhoto = els.teamPhotoInput.files?.[0] || null;
        if (!selectedTeamPhoto) {
            renderTeamProfile();
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            els.teamPhotoPreview.innerHTML = `<img src="${escapeHtml(reader.result)}" alt="Team photo preview">`;
        };
        reader.readAsDataURL(selectedTeamPhoto);
    });
    els.fillinModal.addEventListener('click', event => {
        if (event.target === els.fillinModal) closeFillinModal();
    });
}

async function init() {
    wireEvents();
    await waitForAuthReady(6500);
    if (!auth.currentUser) {
        els.captainStatus.textContent = 'Captain login required.';
        showGate('Log in from the dashboard first, then come back to manage your team.');
        return;
    }

    const sessionResult = await callFunction('getPlayerSession', {});
    if (!sessionResult?.success || !sessionResult.player?.id) {
        els.captainStatus.textContent = 'Captain login required.';
        showGate('We could not find a player session for this account. Log in from the dashboard first.');
        return;
    }
    session = sessionResult.player;
    currentPlayerId = session.id;

    const ids = findCaptainIds(session);
    currentLeagueId = ids.leagueId || TRIPLES_LEAGUE_ID;
    currentTeamId = new URLSearchParams(window.location.search).get('team_id') || ids.teamId;
    if (!currentTeamId) throw new Error('No captain team found for this account');

    const result = await callFunction('getCaptainDashboard', {
        league_id: currentLeagueId,
        team_id: currentTeamId,
        captain_id: currentPlayerId,
        captain_email: session.email || auth.currentUser.email || null
    });
    if (!result?.success) throw new Error(result?.error || 'Could not load captain dashboard');
    dashboard = result;
    renderAll();
}

init().catch(error => {
    console.error('[captain-vnext] init failed:', error);
    els.captainStatus.textContent = error.message || 'Could not load captain dashboard.';
    els.matchNightCard.innerHTML = `<div class="cv-empty">${escapeHtml(error.message || 'Could not load captain dashboard')}</div>`;
});
