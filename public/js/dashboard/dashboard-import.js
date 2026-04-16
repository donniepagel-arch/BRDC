import { callFunction } from '/js/firebase-config.js';
import { currentPlayer, dashboardData } from '/js/dashboard/dashboard-state.js';

let memberImportPayload = null;
let memberImportValidation = null;
let memberImportParseSummary = null;

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
    const schedule = [
        ...(dashboardData?.schedule || []),
        ...(dashboardData?.matches || []),
        ...(dashboardData?.events || [])
    ];
    return schedule.find(item => item.id === matchId || item.match_id === matchId) || null;
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

function countSetThrows(game) {
    return (game?.legs || []).reduce((total, leg) => {
        return total + (Array.isArray(leg.throws) ? leg.throws.length : 0);
    }, 0);
}

function renderSetSummary(matchData, targetId) {
    const target = document.getElementById(targetId);
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
                const label = `${game.format || game.type || 'Game'}`;
                return `
                    <div class="dc-import-set-row">
                        <strong class="dc-set-num">${idx + 1}</strong>
                        <span class="dc-set-game">${escapeText(label)}</span>
                        <span class="dc-import-set-players">${escapeText(homePlayers)} <span style="color: var(--text-dim);">vs</span> ${escapeText(awayPlayers)}</span>
                        <strong class="dc-set-legs">${homeLegs}-${awayLegs} ${winner}</strong>
                        <span class="dc-set-turns">${countSetThrows(game)} turns</span>
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
    if (importBtn) importBtn.disabled = true;
    setStatus(message);
    const summary = document.getElementById('memberImportSummary');
    const setSummary = document.getElementById('memberImportSetSummary');
    const errors = document.getElementById('memberImportErrors');
    if (summary) summary.innerHTML = '';
    if (setSummary) setSummary.innerHTML = '';
    if (errors) errors.innerHTML = '';
}

export function initMemberImportCard() {
    const card = document.getElementById('memberImportCard');
    if (!card) return;
    const { leagueId, teamId, playerId } = getPlayerLeague();
    const canImport = Boolean(leagueId && teamId && playerId);
    card.style.display = canImport ? '' : 'none';
    if (canImport) resetMemberImport();
}

window.parseMemberRecap = async function() {
    const recapUrl = document.getElementById('memberImportRecapUrl')?.value?.trim();
    const { leagueId, teamId } = getPlayerLeague();
    if (!recapUrl) {
        window.toastWarning?.('Paste a DartConnect recap URL first');
        return;
    }
    if (!leagueId || !teamId) {
        window.toastWarning?.('No league team found for this account');
        return;
    }

    resetMemberImport('Parsing recap and matching your team schedule...');
    const parseBtn = event?.target;
    if (parseBtn) parseBtn.disabled = true;

    try {
        const result = await callFunction('parseDartConnectRecap', {
            recapUrl,
            leagueId
        });
        memberImportPayload = result.matchData;
        memberImportValidation = result.validation;
        memberImportParseSummary = result.parse_summary || null;

        const matchId = memberImportParseSummary?.schedule_match_id;
        const match = getTeamMatch(matchId);
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
                `Games: ${memberImportParseSummary?.parsed_group_count ?? '-'} / ${memberImportParseSummary?.scheduled_game_count ?? '-'}`,
                `Throws: ${metrics.throws ?? '-'}`,
                autoMatch ? `Auto-match score: ${autoMatch.score}${autoMatch.next_score ? `, next ${autoMatch.next_score}` : ''}` : ''
            ].filter(Boolean).map(escapeText);
            const title = escapeText(autoMatch ? `${autoMatch.home_team} vs ${autoMatch.away_team}` : matchId || 'Matched schedule');
            summaryEl.innerHTML = `<strong>${title}</strong><br>${lines.join('<br>')}`;
        }
        renderSetSummary(memberImportPayload, 'memberImportSetSummary');
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

        setStatus(match
            ? 'Ready to import this team match.'
            : 'Ready to import. Server will verify this match belongs to your team before saving.');
        document.getElementById('memberImportBtn').disabled = false;
        window.toastSuccess?.('Recap parsed and matched');
    } catch (error) {
        console.error('Member recap parse error:', error);
        resetMemberImport(`Recap parse failed: ${error.message}`);
        window.toastError?.(error.message);
    } finally {
        if (parseBtn) parseBtn.disabled = false;
    }
};

window.importMemberRecap = async function() {
    const { leagueId, teamId, playerId } = getPlayerLeague();
    const matchId = memberImportParseSummary?.schedule_match_id;
    if (!leagueId || !teamId || !playerId || !matchId || !memberImportPayload || !memberImportValidation?.valid) {
        window.toastWarning?.('Parse a valid recap for your team first');
        return;
    }
    if (!confirm('Import this DartConnect recap? This updates the match report and league stats.')) return;

    const importBtn = document.getElementById('memberImportBtn');
    if (importBtn) importBtn.disabled = true;
    setStatus('Importing match...');

    try {
        const result = await callFunction('importMatchData', {
            leagueId,
            matchId,
            matchData: memberImportPayload,
            parseSummary: memberImportParseSummary,
            player_id: playerId,
            team_id: teamId
        });
        if (!result.success) throw new Error(result.error || 'Import failed');
        window.toastSuccess?.('Match imported successfully', 5000);
        resetMemberImport('Import completed. Paste another DartConnect recap URL if needed.');
    } catch (error) {
        console.error('Member import error:', error);
        setStatus(`Import failed: ${error.message}`);
        window.toastError?.(error.message);
        if (importBtn) importBtn.disabled = false;
    }
};
