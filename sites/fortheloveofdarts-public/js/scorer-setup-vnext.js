import { callFunction, db, collection, getDocs } from '/js/firebase-config.js';

const setupParams = new URLSearchParams(window.location.search);
const els = {
    resume: document.getElementById('resumeBanner'),
    resumeTitle: document.getElementById('resumeMatchTitle'),
    resumeMeta: document.getElementById('resumeMatchMeta'),
    resumeBtn: document.getElementById('resumeMatchBtn'),
    discardBtn: document.getElementById('discardMatchBtn'),
    knockoutToggle: document.getElementById('knockoutToggle'),
    knockoutSubtext: document.getElementById('knockoutSubtext'),
    knockoutExtra: document.getElementById('knockoutExtra'),
    knockoutName: document.getElementById('knockoutName'),
    playerName: document.getElementById('playerNameInput'),
    addPlayer: document.getElementById('addPlayerBtn'),
    openPin: document.getElementById('openPinModalBtn'),
    botMenuBtn: document.getElementById('botMenuBtn'),
    botMenu: document.getElementById('botMenu'),
    botMenuContent: document.getElementById('botMenuContent'),
    playerPool: document.getElementById('playerPool'),
    assignmentHelp: document.getElementById('assignmentHelp'),
    teamCards: document.getElementById('teamCards'),
    statPanel: document.getElementById('statTrackingPanel'),
    statToggle: document.getElementById('statToggle'),
    statPinSection: document.getElementById('statPinSection'),
    statPinEntry: document.getElementById('statPinEntry'),
    statPinInput: document.getElementById('statPinInput'),
    statVerify: document.getElementById('statVerifyBtn'),
    statVerified: document.getElementById('statPlayerVerified'),
    statPlayerName: document.getElementById('statPlayerName'),
    clearStat: document.getElementById('clearStatPlayerBtn'),
    numLegs: document.getElementById('numLegs'),
    legMode: document.getElementById('legMode'),
    numSets: document.getElementById('numSets'),
    setModeWrap: document.getElementById('setModeWrap'),
    setMode: document.getElementById('setMode'),
    gameType: document.getElementById('gameType'),
    x01ScoreWrap: document.getElementById('x01ScoreWrap'),
    x01Score: document.getElementById('x01Score'),
    inRuleWrap: document.getElementById('inRuleWrap'),
    inRule: document.getElementById('inRule'),
    outRuleWrap: document.getElementById('outRuleWrap'),
    outRule: document.getElementById('outRule'),
    startRulesWrap: document.getElementById('startRulesWrap'),
    startRule: document.getElementById('startRule'),
    corkOptionWrap: document.getElementById('corkOptionWrap'),
    corkOption: document.getElementById('corkOption'),
    corkOrderWrap: document.getElementById('corkOrderWrap'),
    corkOrder: document.getElementById('corkOrder'),
    corkWinnerWrap: document.getElementById('corkWinnerWrap'),
    corkWinnerGets: document.getElementById('corkWinnerGets'),
    starterCard: document.getElementById('starterCard'),
    starterButtons: document.getElementById('starterButtons'),
    mixedConfig: document.getElementById('mixedConfig'),
    mixedLegRows: document.getElementById('mixedLegRows'),
    startBtn: document.getElementById('startBtn'),
    pinModal: document.getElementById('pinModal'),
    closePin: document.getElementById('closePinModalBtn'),
    lookupPin: document.getElementById('lookupPinBtn'),
    pinInput: document.getElementById('pinModalInput'),
    profileResults: document.getElementById('profileLookupResults'),
    statProfileResults: document.getElementById('statProfileResults'),
    pinLoginPane: document.getElementById('pinLoginPane'),
    pinRegisterPane: document.getElementById('pinRegisterPane'),
    registerError: document.getElementById('registerError'),
    registerBtn: document.getElementById('registerBtn'),
    regFirstName: document.getElementById('regFirstName'),
    regLastName: document.getElementById('regLastName'),
    regPhone: document.getElementById('regPhone'),
    regEmail: document.getElementById('regEmail')
};

let playerPool = [];
let selectedTeamId = 1;
let selectedStarter = 1;
let knockoutMode = false;
let statTrackingEnabled = false;
let statTrackingPlayer = null;
let registeredBots = [];
let mixedLegs = [];

const ROOKIES_DEMO_PROFILES = [
    { id: 'demo_brian_beach', name: 'Brian Beach', team_name: 'Team K. Yasenchak', league_name: 'Rookies 2026 Triples League' },
    { id: 'demo_dr4ML1i9ZeMI7SNisX6E', name: 'Kevin Yasenchak', team_name: 'Team K. Yasenchak', league_name: 'Rookies 2026 Triples League' },
    { id: 'demo_SwnH8GUBmrcdmOAs07Vp', name: 'John Ragnoni', team_name: 'Team J. Ragnoni', league_name: 'Rookies 2026 Triples League' },
    { id: 'demo_ZwdiN0qfmIY5MMCOLJps', name: 'Marc Tate', team_name: 'Team J. Ragnoni', league_name: 'Rookies 2026 Triples League' },
    { id: 'demo_matt_chris', name: 'Matt Chris', team_name: 'Wing It Wednesdays', league_name: 'Rookies player profile' },
    { id: 'demo_patrick_brian', name: 'Patrick & Brian', team_name: 'Wing It Wednesdays', league_name: 'Rookies player profile' }
];

function toast(type, message) {
    const fn = window[`toast${type}`];
    if (typeof fn === 'function') fn(message);
}

function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isX01Game(type) {
    return ['301', '501', '701', 'x01'].includes(String(type || ''));
}

function teamCount() {
    if (!knockoutMode) return 2;
    return Math.min(Math.max(2, playerPool.length || 2), 8);
}

function teamName(teamId) {
    return document.getElementById(`teamName${teamId}`)?.value?.trim() || `Team ${teamId}`;
}

function legsToWin() {
    const total = parseInt(els.numLegs.value, 10) || 1;
    return els.legMode.value === 'play-all' ? total : Math.floor(total / 2) + 1;
}

function setsToWin() {
    const total = parseInt(els.numSets.value, 10) || 0;
    if (!total) return 0;
    return els.setMode.value === 'play-all' ? total : Math.floor(total / 2) + 1;
}

function defaultTeamName(teamId) {
    const players = playerPool.filter(player => player.teamId === teamId);
    return players.length ? players.map(player => player.name.split(' ')[0]).join(' & ') : `Team ${teamId}`;
}

function playerPayload(players) {
    return players.map((player, index) => ({
        id: player.playerId || player.id || `${slugify(player.name) || 'player'}-${index + 1}`,
        name: player.name,
        position: index + 1,
        isBot: player.isBot || false,
        botDifficulty: player.botDifficulty || null,
        registeredPlayer: player.registeredPlayer || false
    }));
}

function autoAssignTwoPlayers() {
    if (playerPool.length !== 2) return;
    if (playerPool.some(player => player.teamId)) return;
    playerPool[0].teamId = 1;
    playerPool[1].teamId = 2;
}

function addPlayer(name, extra = {}) {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (playerPool.some(player => player.name.toLowerCase() === clean.toLowerCase() && !extra.playerId)) {
        toast('Warning', 'That player is already in the match.');
        return;
    }
    playerPool.push({
        id: extra.id || `${slugify(clean) || 'player'}-${Date.now()}`,
        name: clean,
        teamId: extra.teamId || null,
        ...extra
    });
    autoAssignTwoPlayers();
    renderAll();
}

function removePlayer(id) {
    playerPool = playerPool.filter(player => player.id !== id);
    renderAll();
}

function togglePlayerTeam(id) {
    const player = playerPool.find(item => item.id === id);
    if (!player) return;
    player.teamId = player.teamId === selectedTeamId ? null : selectedTeamId;
    renderAll();
}

function renderPlayerPool() {
    if (!playerPool.length) {
        els.playerPool.className = 'ves-player-pool empty';
        els.playerPool.textContent = 'Add players above';
        return;
    }
    els.playerPool.className = 'ves-player-pool';
    els.playerPool.innerHTML = playerPool.map(player => {
        const assigned = player.teamId ? `team-${player.teamId}` : '';
        const type = player.isBot ? 'bot' : player.registeredPlayer ? 'registered' : '';
        const label = player.isBot ? 'BOT' : player.registeredPlayer ? 'PROFILE' : '';
        return `
            <button class="ves-player-chip ${assigned} ${type}" type="button" data-player-id="${player.id}">
                ${label ? `<span>${label}</span>` : ''}
                ${escapeHtml(player.name)}
            </button>
        `;
    }).join('');
}

function renderTeamCards() {
    const count = teamCount();
    els.teamCards.innerHTML = Array.from({ length: count }, (_, index) => {
        const id = index + 1;
        const players = playerPool.filter(player => player.teamId === id);
        const active = selectedTeamId === id ? 'active' : '';
        const existingName = document.getElementById(`teamName${id}`)?.value;
        return `
            <article class="ves-team-card ${active}" data-team-card="${id}">
                <button class="ves-team-select" type="button" data-team-select="${id}">Team ${id}</button>
                <input id="teamName${id}" value="${escapeHtml(existingName || defaultTeamName(id))}" aria-label="Team ${id} name">
                <div class="ves-team-roster">
                    ${players.length ? players.map(player => `
                        <button type="button" data-remove-player="${player.id}">${escapeHtml(player.name)}</button>
                    `).join('') : '<span>No players assigned</span>'}
                </div>
            </article>
        `;
    }).join('');
}

function renderStarterButtons() {
    els.starterButtons.innerHTML = [1, 2].map(id => `
        <button class="ves-action ${selectedStarter === id ? 'primary' : ''}" type="button" data-starter="${id}">
            ${escapeHtml(teamName(id))}
        </button>
    `).join('');
}

function renderMixedConfig() {
    const count = parseInt(els.numLegs.value, 10) || 1;
    while (mixedLegs.length < count) {
        mixedLegs.push({ type: '501', score: 501, inRule: 'straight', outRule: 'double', corkWinnerGets: 'choose-and-start' });
    }
    mixedLegs = mixedLegs.slice(0, count);
    els.mixedLegRows.innerHTML = mixedLegs.map((leg, index) => {
        const x01 = isX01Game(leg.type);
        return `
            <article class="ves-mixed-leg-row">
                <strong>Leg ${index + 1}</strong>
                <select data-mixed-index="${index}" data-mixed-field="type">
                    <option value="501"${leg.type === '501' ? ' selected' : ''}>501</option>
                    <option value="301"${leg.type === '301' ? ' selected' : ''}>301</option>
                    <option value="701"${leg.type === '701' ? ' selected' : ''}>701</option>
                    <option value="x01"${leg.type === 'x01' ? ' selected' : ''}>Custom X01</option>
                    <option value="cricket"${leg.type === 'cricket' ? ' selected' : ''}>Cricket</option>
                    <option value="corks_choice"${leg.type === 'corks_choice' ? ' selected' : ''}>CH</option>
                </select>
                ${x01 ? `
                    <input data-mixed-index="${index}" data-mixed-field="score" type="number" value="${Number(leg.score || 501)}" min="101" max="1001" step="100"${leg.type === 'x01' ? '' : ' hidden'}>
                    <select data-mixed-index="${index}" data-mixed-field="inRule">
                        <option value="straight"${leg.inRule === 'straight' ? ' selected' : ''}>Free in</option>
                        <option value="double"${leg.inRule === 'double' ? ' selected' : ''}>Double in</option>
                        <option value="master"${leg.inRule === 'master' ? ' selected' : ''}>Master in (D/T)</option>
                    </select>
                    <select data-mixed-index="${index}" data-mixed-field="outRule">
                        <option value="double"${leg.outRule === 'double' ? ' selected' : ''}>Double out</option>
                        <option value="straight"${leg.outRule === 'straight' ? ' selected' : ''}>Single out</option>
                        <option value="master"${leg.outRule === 'master' ? ' selected' : ''}>Master out (D/T)</option>
                    </select>
                ` : ''}
                ${leg.type === 'corks_choice' ? `
                    <select data-mixed-index="${index}" data-mixed-field="corkWinnerGets">
                        <option value="choose-and-start"${leg.corkWinnerGets === 'choose-and-start' ? ' selected' : ''}>Choose game and start</option>
                        <option value="choose-only"${leg.corkWinnerGets === 'choose-only' ? ' selected' : ''}>Choose game only</option>
                        <option value="choose-or-start"${leg.corkWinnerGets === 'choose-or-start' ? ' selected' : ''}>Choose game or start</option>
                    </select>
                ` : ''}
            </article>
        `;
    }).join('');
}

function updateHelp() {
    const assigned1 = playerPool.some(player => player.teamId === 1);
    const assigned2 = playerPool.some(player => player.teamId === 2);
    els.assignmentHelp.textContent = playerPool.length < 2
        ? 'Add at least 2 players to assign teams.'
        : assigned1 && assigned2
            ? `Tap a team card, then tap players to move them. Current selection: Team ${selectedTeamId}.`
            : 'Assign at least one player to Team 1 and Team 2.';
    els.knockoutSubtext.textContent = knockoutMode
        ? `${teamCount()} teams ready`
        : 'Up to 8 teams with up to 4 players per team.';
}

function updateStartButton() {
    const ready = playerPool.some(player => player.teamId === 1) && playerPool.some(player => player.teamId === 2);
    els.startBtn.disabled = !ready;
    els.startBtn.textContent = knockoutMode ? 'Create bracket' : 'Start game';
}

function renderAll() {
    renderPlayerPool();
    renderTeamCards();
    renderStarterButtons();
    renderOptionToggles();
    renderSteppers();
    updateHelp();
    updateStartButton();
}

function renderOptionToggles() {
    document.querySelectorAll('.ves-option-toggle[data-select]').forEach(group => {
        const select = document.getElementById(group.dataset.select);
        if (!select) return;
        group.querySelectorAll('button[data-value]').forEach(button => {
            button.classList.toggle('active', button.dataset.value === select.value);
        });
    });
}

function renderSteppers() {
    document.querySelectorAll('.ves-stepper[data-input]').forEach(stepper => {
        const input = document.getElementById(stepper.dataset.input);
        if (!input) return;
        const value = parseInt(input.value, 10) || 0;
        const min = input.min !== '' ? parseInt(input.min, 10) : -Infinity;
        const max = input.max !== '' ? parseInt(input.max, 10) : Infinity;
        const valueEl = stepper.querySelector('span');
        if (valueEl) valueEl.textContent = String(value);
        stepper.querySelectorAll('button[data-step]').forEach(button => {
            const next = value + Number(button.dataset.step || 0);
            button.disabled = next < min || next > max;
        });
    });
}

function setStepperValue(input, value, emit = true) {
    const min = input.min !== '' ? parseInt(input.min, 10) : -Infinity;
    const max = input.max !== '' ? parseInt(input.max, 10) : Infinity;
    const next = Math.min(max, Math.max(min, Number(value)));
    input.value = String(Number.isFinite(next) ? next : 0);
    if (emit) input.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateRuleVisibility() {
    const game = els.gameType.value;
    const choice = game === 'corks_choice';
    const mixed = game === 'mixed' || game === 'custom';
    const cricket = game === 'cricket';
    const customX01 = game === 'x01';
    const x01 = ['301', '501', '701', 'x01'].includes(game);

    els.x01ScoreWrap.hidden = !customX01;
    els.inRuleWrap.hidden = !x01;
    els.outRuleWrap.hidden = !x01;
    els.startRulesWrap.hidden = choice;
    els.corkOptionWrap.hidden = choice || els.startRule.value === 'select-starter';
    els.corkOrderWrap.hidden = !choice;
    els.corkWinnerWrap.hidden = !choice;
    els.starterCard.hidden = choice || els.startRule.value !== 'select-starter';
    els.mixedConfig.hidden = !mixed;
    els.setModeWrap.hidden = String(els.numSets.value || '0') === '0';

    if (mixed) renderMixedConfig();
    if (cricket) {
        els.inRuleWrap.hidden = true;
        els.outRuleWrap.hidden = true;
    }
}

function currentCorkRule() {
    if (els.gameType.value === 'corks_choice') return 'cork_every_leg';
    if (els.startRule.value === 'select-starter') return selectedStarter === 1 ? 'home_first' : 'away_first';
    return els.startRule.value;
}

function appendSharedParams(params, homePlayers, awayPlayers) {
    params.set('home_players', JSON.stringify(playerPayload(homePlayers)));
    params.set('away_players', JSON.stringify(playerPayload(awayPlayers)));
    params.set('home_team_name', teamName(1));
    params.set('away_team_name', teamName(2));
    params.set('total_legs', els.numLegs.value);
    params.set('legs_to_win', String(legsToWin()));
    params.set('leg_mode', els.legMode.value);
    params.set('total_sets', els.numSets.value);
    params.set('sets_to_win', String(setsToWin()));
    params.set('set_mode', els.setMode.value);
    params.set('casual', 'true');
    params.set('origin', 'casual');
    params.set('source', setupParams.get('source') || 'scorer_setup_vnext');
    params.set('return_url', '/rookies/pages/scorer-setup-vnext.html');
    const useCork = currentCorkRule() !== 'home_first' && currentCorkRule() !== 'away_first';
    params.set('cork', String(useCork));
    params.set('cork_rule', currentCorkRule());
    params.set('cork_option', els.corkOption.value);
    params.set('cork_order', els.corkOrder.value);
    params.set('cork_winner_gets', els.corkWinnerGets.value);
    if (statTrackingEnabled && statTrackingPlayer) {
        params.set('track_stats', 'true');
        params.set('stat_player_id', statTrackingPlayer.id);
        params.set('stat_player_name', statTrackingPlayer.name);
    }
    ['tournament_id', 'event_id', 'match_id', 'tournament_match_id'].forEach(key => {
        const value = setupParams.get(key);
        if (value) params.set(key, value);
    });
}

function mixedPayload() {
    return mixedLegs.map(leg => {
        const x01 = isX01Game(leg.type);
        return {
            game_type: leg.type,
            type: leg.type,
            x01_value: x01 ? String(leg.score || (leg.type === '301' ? 301 : leg.type === '701' ? 701 : 501)) : '',
            score: x01 ? Number(leg.score || 501) : null,
            in_rule: x01 ? leg.inRule || 'straight' : 'n/a',
            inRule: x01 ? leg.inRule || 'straight' : 'n/a',
            out_rule: x01 ? leg.outRule || 'double' : 'n/a',
            outRule: x01 ? leg.outRule || 'double' : 'n/a',
            cork_winner_gets: leg.corkWinnerGets || 'choose-and-start'
        };
    });
}

function scorerUrlForGame(game, params) {
    if (game === 'cricket') return `/rookies/pages/league-cricket-vnext.html?${params}`;
    return `/rookies/pages/x01-scorer-vnext.html?${params}`;
}

function buildLaunchUrl() {
    const homePlayers = playerPool.filter(player => player.teamId === 1);
    const awayPlayers = playerPool.filter(player => player.teamId === 2);
    if (!homePlayers.length || !awayPlayers.length) return '';

    const game = els.gameType.value;
    const params = new URLSearchParams();
    appendSharedParams(params, homePlayers, awayPlayers);

    if (game === 'mixed' || game === 'custom') {
        const legs = mixedPayload();
        const first = legs[0] || { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' };
        sessionStorage.setItem('mixedGameConfig', JSON.stringify({
            home_players: playerPayload(homePlayers),
            away_players: playerPayload(awayPlayers),
            legs,
            current_leg: 0,
            home_legs: 0,
            away_legs: 0,
            leg_mode: els.legMode.value,
            cork_rule: currentCorkRule(),
            cork_option: els.corkOption.value,
            cork_winner_gets: els.corkWinnerGets.value
        }));
        params.set('mixed', 'true');
        params.set('mixed_leg', '0');
        params.set('mixed_legs', JSON.stringify(legs));
        if (first.game_type === 'cricket') return scorerUrlForGame('cricket', params);
        if (first.game_type === 'corks_choice') {
            params.set('format', 'choice');
            params.set('game_type', 'choice');
            params.set('corks_choice', 'true');
            params.set('starting_score', '501');
            params.set('in_rule', 'straight');
            params.set('out_rule', 'double');
            params.set('checkout', 'double');
            return scorerUrlForGame('x01', params);
        }
        params.set('game_type', first.game_type);
        params.set('starting_score', first.x01_value || '501');
        params.set('in_rule', first.in_rule || 'straight');
        params.set('out_rule', first.out_rule || 'double');
        params.set('checkout', first.out_rule || 'double');
        return scorerUrlForGame('x01', params);
    }

    if (game === 'cricket') {
        params.set('game_type', 'cricket');
        return scorerUrlForGame('cricket', params);
    }

    if (game === 'corks_choice') {
        params.set('format', 'choice');
        params.set('game_type', 'choice');
        params.set('corks_choice', 'true');
        params.set('starting_score', '501');
        params.set('in_rule', 'straight');
        params.set('out_rule', 'double');
        params.set('checkout', 'double');
        return scorerUrlForGame('x01', params);
    }

    const startingScore = game === 'x01' ? (els.x01Score.value || '501') : game;
    params.set('game_type', game);
    params.set('starting_score', startingScore);
    params.set('in_rule', els.inRule.value);
    params.set('out_rule', els.outRule.value);
    params.set('checkout', els.outRule.value);
    return scorerUrlForGame('x01', params);
}

function buildKnockoutTeams() {
    const count = teamCount();
    return Array.from({ length: count }, (_, index) => {
        const id = index + 1;
        const players = playerPool.filter(player => player.teamId === id);
        return {
            name: teamName(id),
            players: playerPayload(players)
        };
    }).filter(team => team.players.length);
}

async function createKnockoutBracket() {
    const teams = buildKnockoutTeams();
    if (teams.length < 2) {
        toast('Warning', 'Assign at least two teams before creating a bracket.');
        return;
    }
    els.startBtn.disabled = true;
    els.startBtn.textContent = 'Creating bracket...';
    try {
        const game = els.gameType.value;
        const format = game === 'cricket' ? 'cricket' : game === '301' ? '301' : game === '701' ? '701' : '501';
        const result = await callFunction('createKnockout', {
            name: els.knockoutName.value.trim() || 'Rookies Knockout',
            teams,
            format,
            best_of: parseInt(els.numLegs.value, 10) || 3
        });
        if (!result?.success || !result.knockout_id) throw new Error(result?.error || 'Bracket creation failed.');
        localStorage.setItem('currentKnockoutId', result.knockout_id);
        window.location.href = `/rookies/pages/knockout.html?id=${encodeURIComponent(result.knockout_id)}`;
    } catch (error) {
        toast('Error', error.message || 'Could not create the bracket.');
        els.startBtn.disabled = false;
        els.startBtn.textContent = 'Create bracket';
    }
}

function launch() {
    if (knockoutMode) {
        createKnockoutBracket();
        return;
    }
    const url = buildLaunchUrl();
    if (!url) {
        toast('Warning', 'Assign at least one player to each team.');
        return;
    }
    sessionStorage.setItem('gameSetupPlayersVNext', JSON.stringify(playerPool));
    window.location.href = url;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function openPinModal() {
    els.pinModal.hidden = false;
    els.pinInput.value = '';
    els.profileResults.innerHTML = '';
    setPinTab('login');
    setTimeout(() => els.pinInput.focus(), 50);
}

function closePinModal() {
    els.pinModal.hidden = true;
}

function setPinTab(tab) {
    document.querySelectorAll('[data-pin-tab]').forEach(button => {
        button.classList.toggle('active', button.dataset.pinTab === tab);
    });
    els.pinLoginPane.hidden = tab !== 'login';
    els.pinRegisterPane.hidden = tab !== 'register';
    els.registerError.textContent = '';
}

function profileSubtext(player) {
    return [player.team_name, player.league_name].filter(Boolean).join(' / ') || 'Player profile';
}

function renderProfileResults(container, players, action) {
    if (!container) return;
    if (!players.length) {
        container.innerHTML = '<div class="ves-profile-empty">No matching profiles found. Add by name or register a new profile.</div>';
        return;
    }
    container.innerHTML = players.map(player => `
        <button class="ves-profile-result" type="button" data-profile-action="${action}" data-profile-id="${escapeHtml(player.id)}" data-profile-name="${escapeHtml(player.name)}">
            <span><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(profileSubtext(player))}</span></span>
            <span>Add</span>
        </button>
    `).join('');
}

async function searchProfiles(query) {
    const clean = String(query || '').trim();
    if (clean.length < 2) {
        toast('Warning', 'Enter at least 2 characters.');
        return [];
    }

    if (window.location.pathname.startsWith('/rookies')) {
        const needle = clean.toLowerCase();
        const demoMatches = ROOKIES_DEMO_PROFILES
            .filter(player => String(player.name || '').toLowerCase().includes(needle))
            .slice(0, 8);
        if (demoMatches.length) return demoMatches;

        const snap = await getDocs(collection(db, 'leagues', 'rookies-demo-2026-triples', 'players'));
        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), league_id: 'rookies-demo-2026-triples', league_name: 'Rookies 2026 Triples League' }))
            .filter(player => String(player.name || '').toLowerCase().includes(needle))
            .slice(0, 8);
    }

    const result = await callFunction('searchPlayers', { query: clean, limit: 8 });
    if (!result?.success) throw new Error(result?.error || 'Profile search failed.');
    return result.players || [];
}

function addProfilePlayer(player) {
    if (playerPool.some(item => item.playerId === player.id)) {
        toast('Warning', 'That player is already in the match.');
        return;
    }
    addPlayer(player.name, {
        id: `profile_${player.id}`,
        registeredPlayer: true,
        playerId: player.id
    });
}

async function lookupProfilePlayer() {
    try {
        els.profileResults.innerHTML = '<div class="ves-profile-empty">Searching...</div>';
        const players = await searchProfiles(els.pinInput.value);
        const exact = players.find(player => player.name?.toLowerCase() === els.pinInput.value.trim().toLowerCase());
        if (exact || players.length === 1) {
            addProfilePlayer(exact || players[0]);
            closePinModal();
            return;
        }
        renderProfileResults(els.profileResults, players, 'add-player');
    } catch (error) {
        els.profileResults.innerHTML = '';
        toast('Error', error.message || 'Could not find profiles.');
    }
}

async function registerNewPlayer() {
    const first = els.regFirstName.value.trim();
    const last = els.regLastName.value.trim();
    const phone = els.regPhone.value.trim();
    const email = els.regEmail.value.trim();
    els.registerError.textContent = '';
    if (!first || !last || phone.replace(/\D/g, '').length < 10) {
        els.registerError.textContent = 'First name, last name, and a valid phone are required.';
        return;
    }
    els.registerBtn.disabled = true;
    els.registerBtn.textContent = 'Registering...';
    try {
        const result = await callFunction('registerPlayerSimpleV2', {
            first_name: first,
            last_name: last,
            phone,
            email: email || null
        });
        if (!result?.success || !result.player) throw new Error(result?.error || 'Registration failed.');
        addPlayer(result.player.name, {
            id: `reg_${result.player.id}`,
            registeredPlayer: true,
            playerId: result.player.id
        });
        closePinModal();
        toast('Success', `Added ${result.player.name}.`);
    } catch (error) {
        els.registerError.textContent = error.message || 'Registration failed.';
    } finally {
        els.registerBtn.disabled = false;
        els.registerBtn.textContent = 'Register';
    }
}

async function loadBots() {
    try {
        const result = await callFunction('getBots', {});
        registeredBots = result?.bots || [];
    } catch {
        registeredBots = [];
    }
    renderBotMenu();
}

function renderBotMenu() {
    if (!registeredBots.length) {
        els.botMenuContent.textContent = 'No bots available.';
        return;
    }
    const added = new Set(playerPool.filter(player => player.registeredBotId).map(player => player.registeredBotId));
    els.botMenuContent.innerHTML = registeredBots.map(bot => `
        <button type="button" data-bot-id="${bot.id}" ${added.has(bot.id) ? 'disabled' : ''}>
            <strong>${escapeHtml(bot.name)}</strong>
            <span>${escapeHtml(bot.difficulty || 'league')}</span>
        </button>
    `).join('');
}

function setStatPlayer(player) {
    statTrackingPlayer = { id: player.id, name: player.name };
    els.statPinEntry.hidden = true;
    els.statVerified.hidden = false;
    els.statPlayerName.textContent = player.name;
    els.statProfileResults.innerHTML = '';
}

async function verifyStatProfile() {
    els.statVerify.disabled = true;
    try {
        els.statProfileResults.innerHTML = '<div class="ves-profile-empty">Searching...</div>';
        const players = await searchProfiles(els.statPinInput.value);
        const exact = players.find(player => player.name?.toLowerCase() === els.statPinInput.value.trim().toLowerCase());
        if (exact || players.length === 1) {
            setStatPlayer(exact || players[0]);
            return;
        }
        renderProfileResults(els.statProfileResults, players, 'track-stats');
    } catch (error) {
        els.statProfileResults.innerHTML = '';
        toast('Error', error.message || 'Could not find profiles.');
    } finally {
        els.statVerify.disabled = false;
    }
}

function clearStatPlayer() {
    statTrackingPlayer = null;
    els.statPinInput.value = '';
    els.statProfileResults.innerHTML = '';
    els.statPinEntry.hidden = false;
    els.statVerified.hidden = true;
}

function checkResumeState() {
    let state = null;
    try {
        state = JSON.parse(sessionStorage.getItem('matchResumeState') || 'null');
    } catch {
        state = null;
    }
    if (!state) return;
    els.resume.hidden = false;
    els.resumeTitle.textContent = `${state.teams?.[0]?.name || 'Home'} vs ${state.teams?.[1]?.name || 'Away'}`;
    els.resumeMeta.textContent = `${state.teams?.[0]?.legs || 0}-${state.teams?.[1]?.legs || 0} legs saved`;
}

function resumeMatch() {
    let state = null;
    try {
        state = JSON.parse(sessionStorage.getItem('matchResumeState') || 'null');
    } catch {
        state = null;
    }
    if (!state) return;
    const params = new URLSearchParams();
    params.set('resume', 'true');
    params.set('home_players', JSON.stringify(state.homePlayers || []));
    params.set('away_players', JSON.stringify(state.awayPlayers || []));
    params.set('home_team_name', state.teams?.[0]?.name || 'Home');
    params.set('away_team_name', state.teams?.[1]?.name || 'Away');
    params.set('starting_score', state.startingScore || 501);
    params.set('game_type', state.gameType || '501');
    params.set('in_rule', state.inRule || 'straight');
    params.set('out_rule', state.outRule || 'double');
    params.set('checkout', state.outRule || 'double');
    params.set('legs_to_win', state.legsToWin || 1);
    params.set('resume_home_score', state.teams?.[0]?.score || state.startingScore || 501);
    params.set('resume_away_score', state.teams?.[1]?.score || state.startingScore || 501);
    params.set('resume_home_darts', state.teams?.[0]?.darts || 0);
    params.set('resume_away_darts', state.teams?.[1]?.darts || 0);
    params.set('resume_active', state.activeTeam || 0);
    window.location.href = `/rookies/pages/x01-scorer-vnext.html?${params}`;
}

function restorePlayers() {
    try {
        const saved = JSON.parse(sessionStorage.getItem('gameSetupPlayersVNext') || '[]');
        if (Array.isArray(saved) && saved.length) playerPool = saved;
    } catch {
        playerPool = [];
    }
}

function applyUrlDefaults() {
    if (setupParams.get('mode') === 'knockout') {
        knockoutMode = true;
        els.knockoutToggle.classList.add('active');
        els.knockoutToggle.setAttribute('aria-pressed', 'true');
        els.knockoutExtra.hidden = false;
        els.statPanel.hidden = true;
    }
    const game = setupParams.get('game_type') || setupParams.get('format') || setupParams.get('default_game');
    const normalized = String(game || '').toLowerCase();
    if (['501', '301', '701', 'x01', 'cricket', 'corks_choice', 'mixed', 'custom'].includes(normalized)) {
        els.gameType.value = normalized;
    } else if (normalized === 'choice') {
        els.gameType.value = 'corks_choice';
    }
    if (setupParams.get('starting_score')) els.x01Score.value = setupParams.get('starting_score');
    if (setupParams.get('in_rule')) els.inRule.value = setupParams.get('in_rule');
    if (setupParams.get('out_rule')) els.outRule.value = setupParams.get('out_rule');
    if (setupParams.get('cork_rule')) {
        const value = setupParams.get('cork_rule');
        els.startRule.value = ['home_first', 'away_first'].includes(value) ? 'select-starter' : value;
        selectedStarter = value === 'away_first' ? 2 : 1;
    }
    if (setupParams.get('cork_option')) els.corkOption.value = setupParams.get('cork_option');
    if (setupParams.get('cork_winner_gets')) els.corkWinnerGets.value = setupParams.get('cork_winner_gets');
}

els.addPlayer.addEventListener('click', () => {
    addPlayer(els.playerName.value);
    els.playerName.value = '';
    els.playerName.focus();
});
els.playerName.addEventListener('keypress', event => {
    if (event.key === 'Enter') els.addPlayer.click();
});
els.playerPool.addEventListener('click', event => {
    const button = event.target.closest('[data-player-id]');
    if (button) togglePlayerTeam(button.dataset.playerId);
});
els.teamCards.addEventListener('click', event => {
    const select = event.target.closest('[data-team-select]');
    const remove = event.target.closest('[data-remove-player]');
    if (select) {
        selectedTeamId = Number(select.dataset.teamSelect);
        renderAll();
    }
    if (remove) {
        const player = playerPool.find(item => item.id === remove.dataset.removePlayer);
        if (player) player.teamId = null;
        renderAll();
    }
});
els.teamCards.addEventListener('input', event => {
    if (event.target.id?.startsWith('teamName')) renderStarterButtons();
});
els.knockoutToggle.addEventListener('click', () => {
    knockoutMode = !knockoutMode;
    els.knockoutToggle.classList.toggle('active', knockoutMode);
    els.knockoutToggle.setAttribute('aria-pressed', String(knockoutMode));
    els.statPanel.hidden = knockoutMode;
    els.knockoutExtra.hidden = !knockoutMode;
    renderAll();
});
els.statToggle.addEventListener('click', () => {
    statTrackingEnabled = !statTrackingEnabled;
    els.statToggle.classList.toggle('active', statTrackingEnabled);
    els.statToggle.setAttribute('aria-pressed', String(statTrackingEnabled));
    els.statPinSection.hidden = !statTrackingEnabled;
    if (!statTrackingEnabled) clearStatPlayer();
});
els.statVerify.addEventListener('click', verifyStatProfile);
els.clearStat.addEventListener('click', clearStatPlayer);
els.openPin.addEventListener('click', openPinModal);
els.closePin.addEventListener('click', closePinModal);
els.lookupPin.addEventListener('click', lookupProfilePlayer);
els.pinInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') lookupProfilePlayer();
});
els.statPinInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') verifyStatProfile();
});
document.addEventListener('click', event => {
    const button = event.target.closest('[data-profile-action]');
    if (!button) return;
    const player = {
        id: button.dataset.profileId,
        name: button.dataset.profileName
    };
    if (button.dataset.profileAction === 'track-stats') {
        setStatPlayer(player);
    } else {
        addProfilePlayer(player);
        closePinModal();
    }
});
document.querySelectorAll('[data-pin-tab]').forEach(button => {
    button.addEventListener('click', () => setPinTab(button.dataset.pinTab));
});
document.addEventListener('click', event => {
    const button = event.target.closest('.ves-option-toggle button[data-value]');
    if (!button) return;
    const group = button.closest('.ves-option-toggle[data-select]');
    const select = document.getElementById(group.dataset.select);
    if (!select) return;
    select.value = button.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    renderOptionToggles();
});
document.addEventListener('click', event => {
    const button = event.target.closest('.ves-stepper button[data-step]');
    if (!button) return;
    const stepper = button.closest('.ves-stepper[data-input]');
    const input = document.getElementById(stepper.dataset.input);
    if (!input) return;
    setStepperValue(input, (parseInt(input.value, 10) || 0) + Number(button.dataset.step || 0));
    renderSteppers();
});
document.addEventListener('change', event => {
    if (!event.target.matches('.ves-stepper-setting input[type="number"]')) return;
    setStepperValue(event.target, event.target.value, false);
    renderSteppers();
});
els.registerBtn.addEventListener('click', registerNewPlayer);
els.botMenuBtn.addEventListener('click', () => {
    els.botMenu.hidden = !els.botMenu.hidden;
});
els.botMenu.addEventListener('click', event => {
    const button = event.target.closest('[data-bot-id]');
    if (!button) return;
    const bot = registeredBots.find(item => item.id === button.dataset.botId);
    if (!bot) return;
    addPlayer(bot.name, {
        id: `bot_${bot.id}_${Date.now()}`,
        isBot: true,
        botDifficulty: bot.difficulty || 'league',
        registeredBotId: bot.id
    });
    els.botMenu.hidden = true;
    renderBotMenu();
});
[els.gameType, els.startRule, els.numLegs, els.numSets].forEach(el => el.addEventListener('change', () => {
    updateRuleVisibility();
    renderAll();
}));
els.mixedLegRows.addEventListener('change', event => {
    const target = event.target.closest('[data-mixed-index]');
    if (!target) return;
    const index = Number(target.dataset.mixedIndex);
    const field = target.dataset.mixedField;
    mixedLegs[index][field] = field === 'score' ? Number(target.value) : target.value;
    if (field === 'type') {
        if (target.value === '301') mixedLegs[index].score = 301;
        if (target.value === '501') mixedLegs[index].score = 501;
        if (target.value === '701') mixedLegs[index].score = 701;
        renderMixedConfig();
    }
});
els.starterButtons.addEventListener('click', event => {
    const button = event.target.closest('[data-starter]');
    if (!button) return;
    selectedStarter = Number(button.dataset.starter);
    renderStarterButtons();
});
els.startBtn.addEventListener('click', launch);
els.resumeBtn.addEventListener('click', resumeMatch);
els.discardBtn.addEventListener('click', () => {
    sessionStorage.removeItem('matchResumeState');
    els.resume.hidden = true;
});

restorePlayers();
applyUrlDefaults();
renderAll();
updateRuleVisibility();
renderOptionToggles();
renderSteppers();
checkResumeState();
loadBots();

window.__BRDC_SCORER_VNEXT__ = {
    buildLaunchUrl,
    addPlayer,
    getState: () => ({ playerPool, knockoutMode, statTrackingEnabled, statTrackingPlayer })
};
