import { callFunction } from '/js/firebase-config.js';

let importContext = null;
let memberImportPayload = null;
let memberImportValidation = null;
let memberImportParseSummary = null;

function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStoredSession() {
    try {
        return JSON.parse(localStorage.getItem('brdc_session') || '{}');
    } catch (e) {
        return {};
    }
}

function getFirstTeamContext(player, dashboard) {
    const roles = dashboard?.roles || {};
    const playing = Array.isArray(roles.playing) ? roles.playing : [];
    const firstPlaying = playing.find(role => role?.team_id) || playing[0] || {};
    const involvements = player?.involvements || {};
    const leagues = Array.isArray(involvements.leagues) ? involvements.leagues : [];
    const firstLeague = leagues.find(league => league?.team_id) || leagues[0] || {};

    return {
        playerId: player?.id || dashboard?.player?.id || null,
        leagueId: player?.league_id || dashboard?.player?.league_id || firstPlaying.league_id || firstPlaying.id || firstLeague.id || null,
        teamId: player?.team_id || dashboard?.player?.team_id || firstPlaying.team_id || firstLeague.team_id || null
    };
}

async function resolveImportContext() {
    const session = getStoredSession();
    let player = {
        id: session.player_id || session.id || null,
        name: session.name || '',
        league_id: session.league_id || null,
        team_id: session.team_id || null,
        involvements: session.involvements || {}
    };

    if (!player.id) {
        const sessionResult = await callFunction('getPlayerSession', {});
        if (!sessionResult?.success) throw new Error(sessionResult?.error || 'Could not load your player session');
        player = sessionResult.player;
    }

    const context = getFirstTeamContext(player, null);
    if (context.leagueId && context.teamId && context.playerId) return context;

    const dashboardResult = await callFunction('getDashboardData', {
        player_id: player.id,
        source_type: player.source_type || 'global',
        league_id: player.league_id || context.leagueId || null
    });
    if (!dashboardResult?.success) throw new Error(dashboardResult?.error || 'Could not load league team context');

    return getFirstTeamContext(dashboardResult.dashboard?.player || player, dashboardResult.dashboard);
}

function setStatus(message) {
    const status = document.getElementById('memberImportStatus');
    if (status) status.textContent = message;
}

function countSetThrows(game) {
    return (game?.legs || []).reduce((total, leg) => total + (Array.isArray(leg.throws) ? leg.throws.length : 0), 0);
}

function renderSetSummary(matchData) {
    const target = document.getElementById('memberImportSetSummary');
    if (!target) return;
    const games = Array.isArray(matchData?.games) ? matchData.games : [];
    if (!games.length) {
        target.innerHTML = '';
        return;
    }

    target.innerHTML = `
        <div class="dc-import-set-table">
            <div class="dc-import-set-header">
                <span>Set</span>
                <span>Game</span>
                <span>Players</span>
                <span>Legs</span>
                <span>Turns</span>
            </div>
            ${games.map((game, idx) => {
                const homePlayers = (game.home_players || []).join(' + ') || 'Home';
                const awayPlayers = (game.away_players || []).join(' + ') || 'Away';
                const homeLegs = game.result?.home_legs ?? 0;
                const awayLegs = game.result?.away_legs ?? 0;
                const winner = game.winner === 'home' ? 'H' : game.winner === 'away' ? 'A' : '-';
                return `
                    <div class="dc-import-set-row">
                        <strong class="dc-set-num">${idx + 1}</strong>
                        <span class="dc-set-game">${escapeText(game.format || game.type || 'Game')}</span>
                        <span class="dc-import-set-players">${escapeText(homePlayers)} <span style="color: var(--text-dim);">vs</span> ${escapeText(awayPlayers)}</span>
                        <strong class="dc-set-legs">${homeLegs}-${awayLegs} ${winner}</strong>
                        <span class="dc-set-turns">${countSetThrows(game)} turns</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function resetMemberImport(message = 'Paste a DartConnect recap link. You must confirm the final and set scores before importing.') {
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
    ['memberImportSummary', 'memberImportSetSummary', 'memberImportErrors'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function updateImportApprovalState() {
    const importBtn = document.getElementById('memberImportBtn');
    const confirmBox = document.getElementById('memberImportConfirm');
    const hasValidPreview = Boolean(memberImportPayload && memberImportValidation?.valid && memberImportParseSummary?.schedule_match_id);
    if (importBtn) importBtn.disabled = !(hasValidPreview && confirmBox?.checked);
}

export async function initProfileImportCard() {
    const card = document.getElementById('memberImportCard');
    if (!card) return;

    try {
        importContext = await resolveImportContext();
        const canImport = Boolean(importContext?.leagueId && importContext?.playerId);
        card.style.display = canImport ? '' : 'none';
        if (canImport) resetMemberImport();
    } catch (error) {
        console.warn('Profile import unavailable:', error.message);
        card.style.display = 'none';
    }
}

window.parseMemberRecap = async function(event) {
    const recapUrl = document.getElementById('memberImportRecapUrl')?.value?.trim();
    if (!recapUrl) {
        window.toastWarning?.('Paste a DartConnect recap URL first');
        return;
    }
    if (!importContext?.leagueId) {
        window.toastWarning?.('No league found for this account');
        return;
    }

    resetMemberImport('Parsing recap and matching your team schedule...');
    const parseBtn = event?.target;
    if (parseBtn) parseBtn.disabled = true;

    try {
        const result = await callFunction('parseDartConnectRecap', {
            recapUrl,
            leagueId: importContext.leagueId
        });
        memberImportPayload = result.matchData;
        memberImportValidation = result.validation;
        memberImportParseSummary = result.parse_summary || null;

        const autoMatch = memberImportParseSummary?.auto_match;
        const score = memberImportPayload?.final_score || {};
        const metrics = memberImportValidation?.metrics || {};
        const errors = memberImportValidation?.errors || [];
        const warnings = memberImportValidation?.warnings || [];
        const summaryEl = document.getElementById('memberImportSummary');
        const errorsEl = document.getElementById('memberImportErrors');

        if (summaryEl) {
            const title = escapeText(autoMatch ? `${autoMatch.home_team} vs ${autoMatch.away_team}` : memberImportParseSummary?.schedule_match_id || 'Matched schedule');
            const lines = [
                `Final score: ${Number.isFinite(score.home) && Number.isFinite(score.away) ? `${score.home}-${score.away}` : '-'}`,
                `Sets parsed: ${memberImportParseSummary?.parsed_group_count ?? '-'} / ${memberImportParseSummary?.scheduled_game_count ?? '-'}`,
                `Throws: ${metrics.throws ?? '-'}`,
                autoMatch ? `Auto-match confidence: ${autoMatch.score}${autoMatch.next_score ? `, next ${autoMatch.next_score}` : ''}` : ''
            ].filter(Boolean).map(escapeText);
            summaryEl.innerHTML = `<strong>${title}</strong><br>${lines.join('<br>')}`;
        }
        renderSetSummary(memberImportPayload);
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
        setStatus('Review the final night score and every set score, then check the confirmation box to enable import.');
        updateImportApprovalState();
        window.toastSuccess?.('Recap parsed and matched');
    } catch (error) {
        console.error('Profile recap parse error:', error);
        resetMemberImport(`Recap parse failed: ${error.message}`);
        window.toastError?.(error.message);
    } finally {
        if (parseBtn) parseBtn.disabled = false;
    }
};

window.importMemberRecap = async function() {
    const matchId = memberImportParseSummary?.schedule_match_id;
    if (!importContext?.leagueId || !importContext?.playerId || !matchId || !memberImportPayload || !memberImportValidation?.valid) {
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
    setStatus('Importing match...');

    try {
        const result = await callFunction('importMatchData', {
            leagueId: importContext.leagueId,
            matchId,
            matchData: memberImportPayload,
            parseSummary: memberImportParseSummary,
            player_id: importContext.playerId,
            team_id: importContext.teamId || null
        });
        if (!result.success) throw new Error(result.error || 'Import failed');
        window.toastSuccess?.('Match imported successfully', 5000);
        resetMemberImport('Import completed. Paste another DartConnect recap URL if needed.');
    } catch (error) {
        console.error('Profile import error:', error);
        setStatus(`Import failed: ${error.message}`);
        window.toastError?.(error.message);
        if (importBtn) importBtn.disabled = false;
    }
};

window.confirmMemberImportPreview = updateImportApprovalState;
