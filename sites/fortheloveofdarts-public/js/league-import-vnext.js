import { callFunction } from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const params = new URLSearchParams(window.location.search);
const leagueId = params.get('league_id') || 'rookies-demo-2026-triples';

const els = {
    statusKicker: document.getElementById('importStatusKicker'),
    manageLeagueLink: document.getElementById('manageLeagueLink'),
    recapUrl: document.getElementById('recapUrlInput'),
    parseBtn: document.getElementById('parseRecapBtn'),
    importBtn: document.getElementById('importRecapBtn'),
    status: document.getElementById('importStatus'),
    match: document.getElementById('importMatch'),
    score: document.getElementById('importScore'),
    games: document.getElementById('importGames'),
    throws: document.getElementById('importThrows'),
    messages: document.getElementById('importMessages'),
    setSummary: document.getElementById('importSetSummary')
};

let directorSession = null;
let parsedPayload = null;
let parsedValidation = null;
let parsedSummary = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function setStatus(message, type = '') {
    els.status.textContent = message;
    els.status.classList.toggle('success', type === 'success');
    els.status.classList.toggle('error', type === 'error');
}

function resetPreview(message = 'Paste a recap URL to begin. Parsing does not write results.') {
    parsedPayload = null;
    parsedValidation = null;
    parsedSummary = null;
    els.importBtn.disabled = true;
    els.importBtn.textContent = 'Import locked';
    els.match.textContent = '-';
    els.score.textContent = '-';
    els.games.textContent = '-';
    els.throws.textContent = '-';
    els.messages.innerHTML = '';
    els.setSummary.innerHTML = '<div class="ves-empty">No recap parsed yet.</div>';
    setStatus(message);
}

function countVisits(game) {
    return (game?.legs || []).reduce((total, leg) => total + (Array.isArray(leg.throws) ? leg.throws.length : 0), 0);
}

function renderMessageList(title, messages, type) {
    const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
    if (!list.length) return '';
    return `
        <div class="league-import-message ${type}">
            <strong>${escapeHtml(title)}</strong>
            <ul>${list.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul>
        </div>
    `;
}

function renderSetSummary(matchData, parseSummary) {
    const games = Array.isArray(matchData?.games) ? matchData.games : [];
    if (!games.length) {
        els.setSummary.innerHTML = '<div class="ves-empty">No set data was found in this recap.</div>';
        return;
    }
    const rawGroups = parseSummary?.raw_group_count ?? null;
    const parsedGroups = parseSummary?.parsed_group_count ?? games.length;
    const scope = rawGroups && rawGroups !== parsedGroups
        ? `<p class="league-import-scope">Showing ${escapeHtml(parsedGroups)} matched set(s) from ${escapeHtml(rawGroups)} set group(s) on the recap page.</p>`
        : '';
    els.setSummary.innerHTML = `
        ${scope}
        <div class="league-import-table">
            <div class="league-import-table-head">
                <span>Set</span><span>Game</span><span>Players</span><span>Legs</span><span>Visits</span>
            </div>
            ${games.map((game, index) => {
        const homePlayers = (game.home_players || []).join(' + ') || 'Home';
        const awayPlayers = (game.away_players || []).join(' + ') || 'Away';
        const homeLegs = game.result?.home_legs ?? game.home_legs_won ?? 0;
        const awayLegs = game.result?.away_legs ?? game.away_legs_won ?? 0;
        return `
                <div class="league-import-table-row">
                    <strong>${index + 1}</strong>
                    <span>${escapeHtml(game.format || game.type || game.game_type || 'Game')}</span>
                    <span>${escapeHtml(homePlayers)} <em>vs</em> ${escapeHtml(awayPlayers)}</span>
                    <strong>${escapeHtml(homeLegs)}-${escapeHtml(awayLegs)}</strong>
                    <span>${countVisits(game)}</span>
                </div>
            `;
    }).join('')}
        </div>
    `;
}

async function parseRecap() {
    const recapUrl = els.recapUrl.value.trim();
    if (!recapUrl) {
        setStatus('Paste a DartConnect recap URL first.', 'error');
        return;
    }
    resetPreview('Parsing recap and matching league schedule...');
    els.parseBtn.disabled = true;
    try {
        const result = await callFunction('parseDartConnectRecap', {
            recapUrl,
            leagueId
        });
        parsedPayload = result.matchData;
        parsedValidation = result.validation;
        parsedSummary = result.parse_summary || null;

        const score = parsedPayload?.final_score || {};
        const metrics = parsedValidation?.metrics || {};
        const autoMatch = parsedSummary?.auto_match || {};
        const matchId = parsedSummary?.schedule_match_id || '';
        const valid = Boolean(parsedValidation?.valid);

        els.match.textContent = autoMatch.home_team && autoMatch.away_team
            ? `${autoMatch.home_team} vs ${autoMatch.away_team}`
            : (matchId || '-');
        els.score.textContent = Number.isFinite(score.home) && Number.isFinite(score.away) ? `${score.home}-${score.away}` : (autoMatch.score || '-');
        els.games.textContent = `${parsedSummary?.parsed_group_count ?? '-'} / ${parsedSummary?.scheduled_game_count ?? '-'}`;
        els.throws.textContent = metrics.throws ?? '-';
        els.messages.innerHTML = [
            renderMessageList('Errors', parsedValidation?.errors, 'error'),
            renderMessageList('Warnings', parsedValidation?.warnings, 'warning')
        ].join('');
        renderSetSummary(parsedPayload, parsedSummary);

        if (!matchId) {
            setStatus('Parsed, but no scheduled league match was matched. Do not import from this page.', 'error');
            return;
        }
        if (!valid) {
            setStatus('Parsed, but validation found blocking issues. Review errors before importing.', 'error');
            return;
        }
        els.importBtn.disabled = false;
        els.importBtn.textContent = 'Import match';
        setStatus(`Ready to import matched schedule result ${matchId}. Importing will update Firestore.`, 'success');
    } catch (error) {
        console.error('[league-import-vnext] parse failed:', error);
        resetPreview(error.message || 'Recap parse failed.');
        setStatus(error.message || 'Recap parse failed.', 'error');
    } finally {
        els.parseBtn.disabled = false;
    }
}

async function importRecap() {
    const matchId = parsedSummary?.schedule_match_id;
    if (!parsedPayload || !parsedValidation?.valid || !matchId) {
        setStatus('Parse a clean recap with a matched scheduled match before importing.', 'error');
        return;
    }
    if (!window.confirm(`Import this recap into ${matchId}? This updates the league match report and stats.`)) return;
    els.importBtn.disabled = true;
    setStatus('Importing match and recalculating stats...');
    try {
        const result = await callFunction('importMatchData', {
            leagueId,
            matchId,
            matchData: parsedPayload,
            parseSummary: parsedSummary,
            director_id: directorSession?.id || directorSession?.player_id || null,
            director_name: directorSession?.name || ''
        });
        if (!result?.success) throw new Error(result?.error || 'Import failed.');
        setStatus('Import completed. Opening match hub...', 'success');
        window.location.href = `/rookies/pages/match-hub-vnext.html?league_id=${encodeURIComponent(leagueId)}&match_id=${encodeURIComponent(matchId)}`;
    } catch (error) {
        console.error('[league-import-vnext] import failed:', error);
        setStatus(error.message || 'Import failed.', 'error');
        els.importBtn.disabled = false;
    }
}

async function init() {
    els.manageLeagueLink.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(leagueId)}#manage`;
    resetPreview();
    els.parseBtn.addEventListener('click', parseRecap);
    els.importBtn.addEventListener('click', importRecap);
    els.recapUrl.addEventListener('keydown', event => {
        if (event.key === 'Enter') parseRecap();
    });

    directorSession = await requireDirectorLogin({
        mountAfter: document.querySelector('.ves-hero'),
        gatedElements: [document.querySelector('.league-import-panel')],
        statusEl: els.statusKicker,
        title: 'Import Reports',
        copy: 'Director login is required before parsing or importing league results.',
        readyText: 'Importing as'
    });
}

init().catch(error => {
    console.error('[league-import-vnext] failed:', error);
    setStatus(error.message || 'Import tools unavailable.', 'error');
});
