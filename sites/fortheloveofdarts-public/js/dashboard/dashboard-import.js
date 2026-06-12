import { callFunction, showLoading, hideLoading } from '/js/firebase-config.js';
import { currentPlayer, dashboardData } from '/js/dashboard/dashboard-state.js';

let memberImportPayload = null;
let memberImportValidation = null;
let memberImportParseSummary = null;
let memberImportMatches = [];

function getPlayerLeague() {
    let session = {};
    try {
        session = JSON.parse(localStorage.getItem('brdc_session') || '{}');
    } catch (e) {
        session = {};
    }

    const roles = dashboardData?.roles || {};
    const playing = Array.isArray(roles.playing) ? roles.playing : [];
    const firstPlaying = playing.find(role => role?.team_id) || playing[0] || {};
    const player = currentPlayer || dashboardData?.player || {};
    const involvements = player?.involvements || session?.involvements || {};
    const involvedLeagues = Array.isArray(involvements.leagues) ? involvements.leagues : [];
    const firstInvolvedLeague = involvedLeagues.find(league => league?.team_id) || involvedLeagues[0] || {};

    return {
        leagueId: player.league_id || session.league_id || firstPlaying.league_id || firstPlaying.id || firstInvolvedLeague.id || null,
        teamId: player.team_id || session.team_id || firstPlaying.team_id || firstInvolvedLeague.team_id || null,
        playerId: player.id || session.player_id || null
    };
}

function getTeamMatch(matchId) {
    return memberImportMatches.find(match => match.id === matchId || match.match_id === matchId) || null;
}

function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setStatus(message) {
    const status = document.getElementById('memberImportStatus');
    if (status) status.textContent = message;
}

function countSetVisits(game) {
    return (game?.legs || []).reduce((total, leg) => {
        return total + (Array.isArray(leg.throws) ? leg.throws.length : 0);
    }, 0);
}

function formatRecapScopeSummary(parseSummary) {
    if (!parseSummary) return 'Recap scope unavailable.';
    const fullNightGroups = parseSummary.raw_group_count ?? '-';
    const importedGroups = parseSummary.parsed_group_count ?? '-';
    const scheduledGroups = parseSummary.scheduled_game_count ?? '-';
    if (fullNightGroups === importedGroups) {
        return `Recap scope: importing all ${importedGroups} matched set(s).`;
    }
    return `Recap scope: page contains ${fullNightGroups} set group(s); this matchup imports ${importedGroups} of ${scheduledGroups} scheduled set(s).`;
}

function renderSetSummary(matchData, targetId, parseSummary = null) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const games = Array.isArray(matchData?.games) ? matchData.games : [];
    if (!games.length) {
        target.innerHTML = '';
        return;
    }

    const fullNightGroups = parseSummary?.raw_group_count ?? null;
    const importedGroups = parseSummary?.parsed_group_count ?? games.length;
    const scopeNote = fullNightGroups && fullNightGroups !== importedGroups
        ? `<div style="margin-bottom: 8px; color: var(--text-dim); font-size: 12px;">Showing ${importedGroups} matched set(s) from a recap page containing ${fullNightGroups} set group(s) for the full night.</div>`
        : '';

    target.innerHTML = `
        ${scopeNote}
        <div class="dc-import-set-table">
            <div class="dc-import-set-header">
                <span>Set</span>
                <span>Game</span>
                <span>Players</span>
                <span>Legs</span>
                <span>Visits</span>
            </div>
            ${games.map((game, idx) => {
                const homePlayers = (game.home_players || []).join(' + ') || 'Home';
                const awayPlayers = (game.away_players || []).join(' + ') || 'Away';
                const homeLegs = game.result?.home_legs ?? 0;
                const awayLegs = game.result?.away_legs ?? 0;
                const winner = game.winner === 'home' ? 'H' : game.winner === 'away' ? 'A' : '-';
                const label = `${game.format || game.type || 'Game'}`;
                return `
                    <div class="dc-import-set-row">
                        <strong class="dc-set-num">${idx + 1}</strong>
                        <span class="dc-set-game">${escapeText(label)}</span>
                        <span class="dc-import-set-players">${escapeText(homePlayers)} <span style="color: var(--text-dim);">vs</span> ${escapeText(awayPlayers)}</span>
                        <strong class="dc-set-legs">${homeLegs}-${awayLegs} ${winner}</strong>
                        <span class="dc-set-turns">${countSetVisits(game)} visits</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function resetMemberImport(message = 'Any league member can import a DartConnect recap for their own team match.') {
    memberImportPayload = null;
    memberImportValidation = null;
    memberImportParseSummary = null;
    const importBtn = document.getElementById('memberImportBtn');
    const confirmBox = document.getElementById('memberImportConfirm');
    if (importBtn) importBtn.disabled = true;
    if (confirmBox) {
        confirmBox.checked = false;
        confirmBox.disabled = true;
    }
    setStatus(message);
    const summary = document.getElementById('memberImportSummary');
    const setSummary = document.getElementById('memberImportSetSummary');
    const errors = document.getElementById('memberImportErrors');
    if (summary) summary.innerHTML = '';
    if (setSummary) setSummary.innerHTML = '';
    if (errors) errors.innerHTML = '';
}

function formatMemberImportMatch(match) {
    if (!match) return 'Unknown match';
    const side = match.is_home ? 'vs' : '@';
    const opponent = match.opponent_name || match.away_team_name || match.home_team_name || 'TBD';
    return `Week ${match.week || '?'} ${side} ${opponent}`;
}

function formatMemberImportWeekOption(week, matches) {
    const weekMatches = (matches || []).filter(match => parseInt(match.week, 10) === parseInt(week, 10));
    const firstMatchWithDate = weekMatches.find(match => match?.match_date || match?.date);
    const dateLabel = firstMatchWithDate ? (firstMatchWithDate.match_date || firstMatchWithDate.date) : null;
    return dateLabel ? `Week ${week} - ${dateLabel}` : `Week ${week}`;
}

function renderMemberImportSummaryText() {
    const summary = document.getElementById('memberImportSummary');
    if (!summary) return;
    const match = getSelectedMemberImportMatch();
    if (!match) {
        summary.innerHTML = '<strong>Select one of your scheduled matches.</strong><br>The importer will anchor the DartConnect recap to that exact BRDC match and ignore unrelated older sets on the page.';
        return;
    }
    const date = match.match_date || match.date || 'date not set';
    summary.innerHTML = `<strong>${escapeText(formatMemberImportMatch(match))}</strong><br>${escapeText(date)}`;
}

function getSelectedMemberImportMatch() {
    const matchId = document.getElementById('memberImportMatchId')?.value?.trim();
    return matchId ? getTeamMatch(matchId) : null;
}

function populateMemberImportMatchSelect(week, preferredMatchId = '') {
    const matchSelect = document.getElementById('memberImportMatchSelect');
    const hiddenMatchId = document.getElementById('memberImportMatchId');
    if (!matchSelect || !hiddenMatchId) return;

    const weekNumber = parseInt(week, 10);
    const matches = memberImportMatches
        .filter(match => parseInt(match.week, 10) === weekNumber)
        .sort((a, b) => String(a.match_date || '').localeCompare(String(b.match_date || '')) ||
            String(a.opponent_name || '').localeCompare(String(b.opponent_name || '')));

    if (!matches.length) {
        matchSelect.innerHTML = '<option value="">No matches for this week</option>';
        hiddenMatchId.value = '';
        renderMemberImportSummaryText();
        return;
    }

    matchSelect.innerHTML = '<option value="">Select your match...</option>' + matches.map(match =>
        `<option value="${escapeText(match.id)}">${escapeText(formatMemberImportMatch(match))}</option>`
    ).join('');

    const nextMatchId = preferredMatchId && matches.some(match => match.id === preferredMatchId)
        ? preferredMatchId
        : '';
    matchSelect.value = nextMatchId;
    hiddenMatchId.value = nextMatchId;
    renderMemberImportSummaryText();
}

function populateMemberImportSelectors(preferredMatchId = '') {
    const weekSelect = document.getElementById('memberImportWeekSelect');
    if (!weekSelect) return;

    const selectedMatch = preferredMatchId
        ? getTeamMatch(preferredMatchId)
        : getSelectedMemberImportMatch();
    const weeks = Array.from(new Set(memberImportMatches
        .map(match => parseInt(match.week, 10))
        .filter(Number.isFinite)))
        .sort((a, b) => a - b);

    if (!weeks.length) {
        weekSelect.innerHTML = '<option value="">No team matches found</option>';
        populateMemberImportMatchSelect('', '');
        return;
    }

    const selectedWeek = selectedMatch?.week || weeks[0];
    weekSelect.innerHTML = weeks.map(week => `<option value="${week}">${escapeText(formatMemberImportWeekOption(week, memberImportMatches))}</option>`).join('');
    weekSelect.value = String(weeks.includes(parseInt(selectedWeek, 10)) ? selectedWeek : weeks[0]);
    populateMemberImportMatchSelect(weekSelect.value, selectedMatch?.id || preferredMatchId);
}

async function loadMemberImportMatches() {
    const roles = dashboardData?.roles || {};
    const playing = Array.isArray(roles.playing) ? roles.playing : [];
    const { playerId } = getPlayerLeague();
    if (!playing.length || !playerId) {
        memberImportMatches = [];
        populateMemberImportSelectors('');
        return;
    }

    const results = await Promise.all(playing
        .filter(role => role?.team_id && (role?.league_id || role?.id))
        .map(async role => {
            const leagueId = role.league_id || role.id;
            const teamId = role.team_id;
            const response = await callFunction('getTeamScheduleEnhanced', {
                league_id: leagueId,
                team_id: teamId,
                player_id: playerId
            });
            if (!response?.success) return [];

            const toImportMatch = (match, completed = false) => ({
                id: match.id,
                week: match.week,
                match_date: match.match_date || null,
                is_home: Boolean(match.is_home),
                opponent_name: match.opponent?.name || 'TBD',
                home_team_name: match.is_home ? (match.my_team?.name || 'My Team') : (match.opponent?.name || 'Home'),
                away_team_name: match.is_home ? (match.opponent?.name || 'Away') : (match.my_team?.name || 'My Team'),
                league_id: leagueId,
                team_id: teamId,
                completed
            });

            return [
                ...(response.upcoming || []).map(match => toImportMatch(match, false)),
                ...(response.past || []).map(match => toImportMatch(match, true))
            ];
        }));

    memberImportMatches = results
        .flat()
        .filter(match => match?.id)
        .sort((a, b) => (parseInt(a.week, 10) || 0) - (parseInt(b.week, 10) || 0) ||
            String(a.match_date || '').localeCompare(String(b.match_date || '')));

    populateMemberImportSelectors('');
}

function updateImportApprovalState() {
    const importBtn = document.getElementById('memberImportBtn');
    const confirmBox = document.getElementById('memberImportConfirm');
    const hasValidPreview = Boolean(memberImportPayload && memberImportValidation?.valid && memberImportParseSummary?.schedule_match_id);
    if (importBtn) importBtn.disabled = !(hasValidPreview && confirmBox?.checked);
}

export function initMemberImportCard() {
    const card = document.getElementById('memberImportCard');
    if (!card) return;
    const { leagueId, playerId } = getPlayerLeague();
    const canImport = Boolean(leagueId && playerId);
    card.style.display = canImport ? '' : 'none';
    if (canImport) {
        resetMemberImport('Select one of your scheduled matches, then parse the DartConnect recap URL.');
        loadMemberImportMatches().catch(error => {
            console.error('Failed to load member import matches:', error);
            setStatus('Could not load your team matches for import.');
        });
    }
}

window.onMemberImportWeekChanged = function() {
    const week = document.getElementById('memberImportWeekSelect')?.value || '';
    populateMemberImportMatchSelect(week, '');
    resetMemberImport('Week changed. Select your scheduled match, then parse the DartConnect recap URL.');
    renderMemberImportSummaryText();
};

window.onMemberImportMatchChanged = function() {
    const matchId = document.getElementById('memberImportMatchSelect')?.value || '';
    const hidden = document.getElementById('memberImportMatchId');
    if (hidden) hidden.value = matchId;
    renderMemberImportSummaryText();
    resetMemberImport(matchId
        ? 'Scheduled match selected. Paste and parse the DartConnect recap URL.'
        : 'Select your scheduled match before parsing the recap URL.');
    renderMemberImportSummaryText();
};

window.parseMemberRecap = async function(event) {
    const recapUrl = document.getElementById('memberImportRecapUrl')?.value?.trim();
    const selectedMatch = getSelectedMemberImportMatch();
    const leagueId = selectedMatch?.league_id || null;
    const matchId = selectedMatch?.id || null;
    if (!recapUrl) {
        window.toastWarning?.('Paste a DartConnect recap URL first');
        return;
    }
    if (!leagueId || !matchId) {
        window.toastWarning?.('Select one of your scheduled matches first');
        return;
    }

    resetMemberImport('Parsing recap against your selected scheduled match...');
    renderMemberImportSummaryText();
    const parseBtn = event?.target || null;
    if (parseBtn) parseBtn.disabled = true;

    try {
        setStatus('Parsing DartConnect recap against your selected scheduled match...');
        showLoading('Parsing DartConnect recap...');
        const result = await callFunction('parseDartConnectRecap', {
            recapUrl,
            leagueId,
            matchId
        });
        hideLoading();
        memberImportPayload = result.matchData;
        memberImportValidation = result.validation;
        memberImportParseSummary = result.parse_summary || null;

        const resolvedMatchId = memberImportParseSummary?.schedule_match_id;
        if (resolvedMatchId) {
            populateMemberImportSelectors(resolvedMatchId);
            const matchSelect = document.getElementById('memberImportMatchSelect');
            const hiddenMatchId = document.getElementById('memberImportMatchId');
            if (matchSelect) matchSelect.value = resolvedMatchId;
            if (hiddenMatchId) hiddenMatchId.value = resolvedMatchId;
        }
        const match = getSelectedMemberImportMatch();
        const autoMatch = memberImportParseSummary?.auto_match;
        const score = memberImportPayload?.final_score || {};
        const metrics = memberImportValidation?.metrics || {};
        const errors = memberImportValidation?.errors || [];
        const warnings = memberImportValidation?.warnings || [];
        const summaryEl = document.getElementById('memberImportSummary');
        const errorsEl = document.getElementById('memberImportErrors');

        if (summaryEl) {
            const lines = [
                `Score: ${Number.isFinite(score.home) && Number.isFinite(score.away) ? `${score.home}-${score.away}` : '-'}`,
                formatRecapScopeSummary(memberImportParseSummary),
                `Visits parsed: ${metrics.throws ?? '-'}`,
                autoMatch ? `Auto-match score: ${autoMatch.score}${autoMatch.next_score ? `, next ${autoMatch.next_score}` : ''}` : ''
            ].filter(Boolean).map(escapeText);
            const title = escapeText(match ? formatMemberImportMatch(match) : (autoMatch ? `${autoMatch.home_team} vs ${autoMatch.away_team}` : resolvedMatchId || 'Matched schedule'));
            summaryEl.innerHTML = `<strong>${title}</strong><br>${lines.join('<br>')}`;
        }
        renderSetSummary(memberImportPayload, 'memberImportSetSummary', memberImportParseSummary);
        if (errorsEl) {
            const allMessages = [...errors, ...warnings];
            errorsEl.innerHTML = allMessages.length
                ? `<ul style="margin: 0; padding-left: 18px;">${allMessages.map(msg => `<li>${escapeText(msg)}</li>`).join('')}</ul>`
                : '';
        }

        if (!memberImportValidation?.valid) {
            setStatus('Import blocked: parser found validation errors. Send this recap to the league director.');
            window.toastWarning?.('Recap parsed with blocking validation errors');
            return;
        }

        const confirmBox = document.getElementById('memberImportConfirm');
        if (confirmBox) {
            confirmBox.disabled = false;
            confirmBox.checked = false;
        }
        setStatus('Review the night score and every set score, then check the confirmation box to enable import.');
        updateImportApprovalState();
        window.toastSuccess?.('Recap parsed and matched');
    } catch (error) {
        hideLoading();
        console.error('Member recap parse error:', error);
        resetMemberImport(`Recap parse failed: ${error.message}`);
        window.toastError?.(error.message);
    } finally {
        hideLoading();
        if (parseBtn) parseBtn.disabled = false;
    }
};

window.importMemberRecap = async function() {
    const { playerId } = getPlayerLeague();
    const selectedMatch = getSelectedMemberImportMatch();
    const leagueId = selectedMatch?.league_id || null;
    const teamId = selectedMatch?.team_id || null;
    const matchId = selectedMatch?.id || null;
    if (!leagueId || !playerId || !matchId || !memberImportPayload || !memberImportValidation?.valid) {
        window.toastWarning?.('Parse a valid recap for your team first');
        return;
    }
    if (!document.getElementById('memberImportConfirm')?.checked) {
        window.toastWarning?.('Confirm the set and match scores before importing');
        return;
    }
    const score = memberImportPayload?.final_score || {};
    const scoreText = Number.isFinite(score.home) && Number.isFinite(score.away) ? `${score.home}-${score.away}` : 'parsed score';
    if (!confirm(`Import this DartConnect recap with final score ${scoreText}? This updates the match report and league stats.`)) return;

    const importBtn = document.getElementById('memberImportBtn');
    if (importBtn) importBtn.disabled = true;
    setStatus('Importing match and recalculating stats...');

    try {
        showLoading('Importing recap and recalculating stats...');
        const result = await callFunction('importMatchData', {
            leagueId,
            matchId,
            matchData: memberImportPayload,
            parseSummary: memberImportParseSummary,
            player_id: playerId,
            team_id: teamId || null
        });
        hideLoading();
        if (!result.success) throw new Error(result.error || 'Import failed');
        window.toastSuccess?.('Match imported successfully', 5000);
        resetMemberImport(result.statsRebuild?.success
            ? 'Import completed and stats were rebuilt. Paste another DartConnect recap URL if needed.'
            : `Import completed, but stats rebuild failed: ${result.statsRebuild?.error || 'unknown error'}`);
    } catch (error) {
        hideLoading();
        console.error('Member import error:', error);
        setStatus(`Import failed: ${error.message}`);
        window.toastError?.(error.message);
        if (importBtn) importBtn.disabled = false;
    } finally {
        hideLoading();
    }
};

window.confirmMemberImportPreview = updateImportApprovalState;
