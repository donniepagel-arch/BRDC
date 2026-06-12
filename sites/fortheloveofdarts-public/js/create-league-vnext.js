import {
    auth,
    db,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const params = new URLSearchParams(window.location.search);
const existingLeagueId = params.get('league_id') || '';
const isSettingsMode = Boolean(existingLeagueId);
const form = document.getElementById('createLeagueForm');
const statusEl = document.getElementById('createLeagueStatus');
const titleEl = document.getElementById('leagueSetupTitle');
const kickerEl = document.getElementById('leagueSetupKicker');
const copyEl = document.getElementById('leagueSetupCopy');
const submitButton = form?.querySelector('button[type="submit"]');
const cancelLink = document.getElementById('cancelLeagueSetup');
const roundsEl = document.getElementById('leagueRounds');
const addRoundBtn = document.getElementById('addRoundBtn');
const corkPreviewEl = document.getElementById('corkRulePreview');
let directorSession = null;
let existingLeague = null;

const DEFAULT_MIXED_LEGS = [
    { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
    { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
    { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
];
const MIXED_SET_GAME_VALUES = ['mixed', 'custom', 'corks_choice'];

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.classList.toggle('success', type === 'success');
    statusEl.classList.toggle('error', type === 'error');
}

function optionalNumber(value) {
    const number = parseInt(value, 10);
    return Number.isFinite(number) ? number : null;
}

function clampNumber(value, fallback, min, max) {
    const number = optionalNumber(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function boolString(value, fallback = false) {
    if (value === true || value === 'true') return 'true';
    if (value === false || value === 'false') return 'false';
    return fallback ? 'true' : 'false';
}

function valueForDate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value.toDate ? value.toDate() : value._seconds ? new Date(value._seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function normalizeOptionValue(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizePlayoffFormat(value) {
    const normalized = normalizeOptionValue(value);
    if (!normalized || normalized === 'none') return 'none';
    if (normalized.includes('double')) return 'double_elimination';
    if (normalized.includes('round_robin')) return 'round_robin';
    if (normalized.includes('single')) return 'single_elimination';
    return normalized;
}

function setField(name, value) {
    const field = form?.querySelector(`[name="${name}"]`);
    if (!field || value == null) return;
    const nextValue = String(value);
    field.value = nextValue;
    if (field.tagName === 'SELECT' && field.value !== nextValue) {
        const normalized = normalizeOptionValue(nextValue);
        const option = Array.from(field.options).find(item =>
            normalizeOptionValue(item.value) === normalized ||
            normalizeOptionValue(item.textContent) === normalized
        );
        if (option) field.value = option.value;
    }
}

function formatFromRosterSize(size) {
    const number = clampNumber(size, 3, 1, 8);
    if (number === 1) return 'singles';
    if (number === 2) return 'doubles';
    if (number === 3) return 'triples';
    return `${number}_person`;
}

function rosterSizeFromFormat(format, fallback = 3) {
    const normalized = normalizeOptionValue(format);
    if (normalized === 'singles') return 1;
    if (normalized === 'doubles') return 2;
    if (normalized === 'triples') return 3;
    const parsed = parseInt(normalized, 10);
    return clampNumber(parsed, fallback, 1, 8);
}

function safeLegs(legs) {
    return Array.isArray(legs) && legs.length
        ? legs.map(leg => ({
            game_type: leg.game_type || leg.type || '501',
            x01_value: leg.x01_value || leg.score || (String(leg.game_type || leg.type) === '301' ? '301' : '501'),
            in_rule: leg.in_rule || leg.inRule || (String(leg.game_type || leg.type) === 'cricket' || String(leg.game_type || leg.type) === 'corks_choice' ? 'n/a' : 'straight'),
            out_rule: leg.out_rule || leg.outRule || (String(leg.game_type || leg.type) === 'cricket' || String(leg.game_type || leg.type) === 'corks_choice' ? 'n/a' : 'double')
        }))
        : DEFAULT_MIXED_LEGS.map(leg => ({ ...leg }));
}

function isX01Game(type) {
    return ['301', '501', '701'].includes(String(type || ''));
}

function isMixedSetGame(type) {
    return MIXED_SET_GAME_VALUES.includes(String(type || ''));
}

function ruleLabel(value, direction) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'double') return `double ${direction}`;
    if (normalized === 'master') return `master ${direction}`;
    return `${direction === 'in' ? 'free' : 'single'} ${direction}`;
}

function ruleAbbr(value, direction) {
    const normalized = String(value || '').toLowerCase();
    if (direction === 'in') {
        if (normalized === 'double') return 'DI';
        if (normalized === 'master') return 'MI';
        return 'FI';
    }
    if (normalized === 'straight') return 'SO';
    if (normalized === 'master') return 'MO';
    return 'DO';
}

function mixedLegLabel(leg) {
    const type = String(leg.game_type || leg.type || '501');
    if (type === 'cricket') return 'C';
    if (type === 'corks_choice') return 'CH';
    const inRule = leg.in_rule || leg.inRule || 'straight';
    const outRule = leg.out_rule || leg.outRule || 'double';
    const suffix = inRule === 'straight' && outRule === 'double'
        ? ''
        : ` ${ruleAbbr(inRule, 'in')}/${ruleAbbr(outRule, 'out')}`;
    return `${leg.x01_value || type}${suffix}`;
}

function roundRows() {
    return Array.from(roundsEl?.querySelectorAll('.ves-round-row[data-round]') || []);
}

function updateRoundNumbers() {
    roundRows().forEach((row, index) => {
        const round = index + 1;
        const oldRound = row.dataset.round || round;
        row.dataset.round = String(round);
        const title = row.querySelector('strong');
        if (title) title.textContent = `Set ${round}`;
        row.querySelectorAll('[name]').forEach(field => {
            field.name = field.name.replace(new RegExp(`round_${oldRound}_`), `round_${round}_`);
        });
        row.querySelectorAll('[data-mixed-summary]').forEach(item => item.dataset.mixedSummary = String(round));
        row.querySelectorAll('[data-x01-rules]').forEach(item => item.dataset.x01Rules = String(round));
        row.querySelectorAll('[data-mixed-round]').forEach(item => item.dataset.mixedRound = String(round));
    });
}

function createPlayerOptions(selected = 2) {
    return Array.from({ length: 8 }, (_, index) => {
        const count = index + 1;
        const label = count === 1 ? 'Singles' : count === 2 ? 'Doubles' : count === 3 ? 'Triples' : `${count} players`;
        return `<option value="${count}"${Number(selected) === count ? ' selected' : ''}>${label}</option>`;
    }).join('');
}

function createGameOptions(selected = '501') {
    const options = [
        ['501', '501'],
        ['301', '301'],
        ['701', '701'],
        ['cricket', 'Cricket'],
        ['mixed', '501/C/CH'],
        ['custom', 'Custom set'],
        ['corks_choice', "Cork's choice"]
    ];
    return options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function createBestOfOptions(selected = 3) {
    return [1, 3, 5, 7, 9].map(value => {
        const label = value === 1 ? '1 leg' : `Best of ${value}`;
        return `<option value="${value}"${Number(selected) === value ? ' selected' : ''}>${label}</option>`;
    }).join('');
}

function createPointOptions(selected = 1) {
    return [1, 2, 3, 4, 5].map(value => `<option value="${value}"${Number(selected) === value ? ' selected' : ''}>${value} point${value === 1 ? '' : 's'}</option>`).join('');
}

function createRuleOptions(selected = 'straight', direction = 'in') {
    const options = direction === 'in'
        ? [
            ['straight', 'Free in'],
            ['double', 'Double in'],
            ['master', 'Master in (D/T)']
        ]
        : [
            ['straight', 'Single out'],
            ['double', 'Double out'],
            ['master', 'Master out (D/T)']
        ];
    return options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
}

function displayGameValue(round = {}) {
    const storedGame = round.game_type || round.game || round.format || '501';
    return storedGame === 'mixed' && round.set_format === 'custom' ? 'custom' : storedGame;
}

function createRoundRow(roundNumber, round = {}) {
    const row = document.createElement('article');
    row.className = 'ves-round-row';
    row.dataset.round = String(roundNumber);
    const game = displayGameValue(round);
    row.innerHTML = `
        <strong>Set ${roundNumber}</strong>
        <select name="round_${roundNumber}_players">${createPlayerOptions(round.num_players ?? round.players ?? 2)}</select>
        <select name="round_${roundNumber}_game">${createGameOptions(game)}</select>
        <select name="round_${roundNumber}_best_of">${createBestOfOptions(round.best_of || round.legs_to_win || 3)}</select>
        <select name="round_${roundNumber}_points">${createPointOptions(round.points || 1)}</select>
        <div class="ves-mixed-leg-summary" data-mixed-summary="${roundNumber}"></div>
        <div class="ves-round-x01-rules" data-x01-rules="${roundNumber}">
            <label><span>In</span><select name="round_${roundNumber}_in_rule">${createRuleOptions(round.in_rule || 'straight', 'in')}</select></label>
            <label><span>Out</span><select name="round_${roundNumber}_out_rule">${createRuleOptions(round.out_rule || 'double', 'out')}</select></label>
        </div>
        <div class="ves-round-mixed" data-mixed-round="${roundNumber}"></div>
    `;
    return row;
}

function ensureRoundRuleControls(row) {
    if (!row) return;
    const round = row.dataset.round || '1';
    let rules = row.querySelector('[data-x01-rules]');
    if (!rules) {
        rules = document.createElement('div');
        rules.className = 'ves-round-x01-rules';
        const mixed = row.querySelector('[data-mixed-round]');
        row.insertBefore(rules, mixed || null);
    }
    rules.dataset.x01Rules = round;
    if (!rules.querySelector('[name$="_in_rule"]')) {
        rules.innerHTML = `
            <label><span>In</span><select name="round_${round}_in_rule">${createRuleOptions('straight', 'in')}</select></label>
            <label><span>Out</span><select name="round_${round}_out_rule">${createRuleOptions('double', 'out')}</select></label>
        `;
    }
}

function legTypeControls(leg, legIndex, options = {}) {
    const type = leg.game_type || '501';
    const x01 = leg.x01_value || (type === '301' ? '301' : '501');
    const isX01 = isX01Game(type);
    const locked = options.lockPreset === true;
    return `
        <article class="ves-mixed-leg-row" data-leg-index="${legIndex}">
            <strong>Leg ${legIndex + 1}</strong>
            <select data-leg-field="game_type"${locked ? ' disabled' : ''}>
                <option value="501"${type === '501' ? ' selected' : ''}>501</option>
                <option value="301"${type === '301' ? ' selected' : ''}>301</option>
                <option value="cricket"${type === 'cricket' ? ' selected' : ''}>Cricket</option>
                <option value="corks_choice"${type === 'corks_choice' ? ' selected' : ''}>CH</option>
            </select>
            <select data-leg-field="x01_value"${isX01 ? '' : ' hidden'}>
                <option value="501"${x01 === '501' ? ' selected' : ''}>501</option>
                <option value="301"${x01 === '301' ? ' selected' : ''}>301</option>
                <option value="701"${x01 === '701' ? ' selected' : ''}>701</option>
            </select>
            <select data-leg-field="in_rule"${isX01 ? '' : ' hidden'}>${createRuleOptions(leg.in_rule || 'straight', 'in')}</select>
            <select data-leg-field="out_rule"${isX01 ? '' : ' hidden'}>${createRuleOptions(leg.out_rule || 'double', 'out')}</select>
            ${locked ? '<span class="ves-inline-note">Preset</span>' : '<button class="ves-action danger" type="button" data-remove-leg>Remove</button>'}
        </article>
    `;
}

function setRoundMixedLegs(row, legs = null) {
    row.dataset.mixedLegs = JSON.stringify(safeLegs(legs));
    renderRoundMixed(row);
}

function getRoundMixedLegs(row) {
    try {
        return safeLegs(JSON.parse(row.dataset.mixedLegs || '[]'));
    } catch {
        return safeLegs([]);
    }
}

function renderRoundMixed(row) {
    const round = row.dataset.round;
    const game = row.querySelector(`[name="round_${round}_game"]`)?.value || '501';
    const shouldShow = isMixedSetGame(game);
    const shouldShowX01Rules = isX01Game(game);
    const legs = getRoundMixedLegs(row);
    const summary = row.querySelector(`[data-mixed-summary="${round}"]`);
    const isOpen = row.dataset.mixedOpen === 'true';
    const isPresetMixed = game === 'mixed';
    row.classList.toggle('has-mixed', shouldShow);
    row.classList.toggle('has-x01-rules', shouldShowX01Rules);
    if (summary) {
        summary.innerHTML = shouldShow
            ? `<span>${escapeHtml(legs.map(mixedLegLabel).join('/'))}</span><button class="ves-inline-action" type="button" data-edit-legs>${isOpen ? 'Hide legs' : (isPresetMixed ? '501 rules' : 'Edit legs')}</button>`
            : `<span>${escapeHtml(shouldShowX01Rules ? `${game} ${ruleLabel(row.querySelector(`[name="round_${round}_in_rule"]`)?.value, 'in')} / ${ruleLabel(row.querySelector(`[name="round_${round}_out_rule"]`)?.value, 'out')}` : 'Cricket')}</span>`;
    }
    const x01Rules = row.querySelector(`[data-x01-rules="${round}"]`);
    if (x01Rules) x01Rules.hidden = !shouldShowX01Rules;
    const container = row.querySelector(`[data-mixed-round="${round}"]`);
    if (!container) return;
    container.hidden = !shouldShow || !isOpen;
    container.innerHTML = shouldShow && isOpen
        ? `<div class="ves-mixed-leg-list">${legs.map((leg, index) => legTypeControls(leg, index, { lockPreset: isPresetMixed })).join('')}</div>${isPresetMixed ? '<p class="ves-section-note">CH means cork winner chooses from the games already played in this set.</p>' : '<button class="ves-action" type="button" data-add-leg>+ Add leg</button><p class="ves-section-note">CH means cork winner chooses from the games already played earlier in this set.</p>'}`
        : '';
}

function readRoundMixedLegs(row) {
    const legRows = Array.from(row.querySelectorAll('.ves-mixed-leg-row'));
    if (!legRows.length) return getRoundMixedLegs(row);
    return legRows.map(item => {
        const type = item.querySelector('[data-leg-field="game_type"]')?.value || '501';
        const x01Value = item.querySelector('[data-leg-field="x01_value"]')?.value || (type === '301' ? '301' : '501');
        const inRule = item.querySelector('[data-leg-field="in_rule"]')?.value || 'straight';
        const outRule = item.querySelector('[data-leg-field="out_rule"]')?.value || 'double';
        return {
            game_type: type,
            x01_value: type === 'cricket' || type === 'corks_choice' ? '' : x01Value,
            in_rule: type === 'cricket' || type === 'corks_choice' ? 'n/a' : inRule,
            out_rule: type === 'cricket' || type === 'corks_choice' ? 'n/a' : outRule
        };
    });
}

function collectLeagueRounds(data) {
    return roundRows().map((row, index) => {
        const round = index + 1;
        const selectedGame = data[`round_${round}_game`] || '501';
        const game = selectedGame === 'custom' ? 'mixed' : selectedGame;
        const base = {
        round,
        num_players: optionalNumber(data[`round_${round}_players`]) || 2,
            game_type: game,
            set_format: selectedGame === 'mixed' ? '501_c_ch' : selectedGame === 'custom' ? 'custom' : null,
        best_of: optionalNumber(data[`round_${round}_best_of`]) || 3,
        points: optionalNumber(data[`round_${round}_points`]) || 1,
            in_rule: isX01Game(game) ? (data[`round_${round}_in_rule`] || 'straight') : 'n/a',
            out_rule: isX01Game(game) ? (data[`round_${round}_out_rule`] || 'double') : 'n/a'
        };
        if (isMixedSetGame(selectedGame)) base.legs = readRoundMixedLegs(row);
        return base;
    });
}

function splitCsv(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function collectLeaguePayload(data) {
    const name = String(data.name || '').trim();
    const season = String(data.season || '').trim();
    const venue = String(data.venue || '').trim();
    const rosterSize = clampNumber(data.roster_size, rosterSizeFromFormat(data.format), 1, 8);
    const format = formatFromRosterSize(rosterSize);
    const playoffTeams = optionalNumber(data.playoff_teams);
    const playoffSets = optionalNumber(data.playoff_sets_to_win);
    return {
        name,
        league_name: name,
        season,
        venue_name: venue || 'Rookies Sports Bar & Grill',
        venue_address: data.venue_address || '',
        format,
        roster_size: rosterSize,
        league_mode: data.league_mode || 'draft',
        max_teams: optionalNumber(data.max_teams),
        schedule_format: data.schedule_format || 'round_robin',
        min_players: clampNumber(data.min_players, rosterSize, 1, 8),
        max_roster: clampNumber(data.max_roster, Math.min(8, rosterSize + 1), 1, 8),
        registration_open_date: data.registration_open_date || '',
        registration_close_date: data.registration_close_date || '',
        registration_notifications: data.registration_notifications || 'email_phone_required',
        registration_approval: data.registration_approval || 'auto',
        start_date: data.start_date || '',
        match_day: data.match_day || 'wednesday',
        start_time: data.start_time || '19:00',
        blackout_dates: splitCsv(data.blackout_dates),
        default_boards_available: optionalNumber(data.default_boards_available),
        rounds: collectLeagueRounds(data),
        cork_rule: data.cork_rule || 'cork_every_leg',
        cork_option: data.cork_option || 'winner_chooses',
        cork_winner_gets: data.cork_winner_gets || 'choose-and-start',
        tiebreakers: splitCsv(data.tiebreakers),
        point_system: data.point_system || 'game_based',
        level_rules: data.level_rules || 'flexible',
        playoff_format: data.playoff_format || 'none',
        playoff_teams: playoffTeams,
        playoff_sets_to_win: playoffSets || 5,
        third_place_match: data.third_place_match === 'true',
        playoff_reseed: data.playoff_reseed === 'true',
        playoff_start_date: data.playoff_start_date || '',
        bye_points: data.bye_points || 'average',
        match_reminders: data.match_reminders || 'site_sms_email',
        reminder_timing: data.reminder_timing || 'day_of',
        up_next_notifications: data.up_next_notifications || 'site_sms',
        director_alerts: data.director_alerts || 'site_sms_email',
        updated_at: serverTimestamp()
    };
}

function applyRound(roundNumber, round = {}) {
    if (!roundRows()[roundNumber - 1]) roundsEl?.appendChild(createRoundRow(roundNumber, round));
    updateRoundNumbers();
    const row = roundRows()[roundNumber - 1];
    ensureRoundRuleControls(row);
    setField(`round_${roundNumber}_players`, round.num_players ?? round.players ?? 2);
    setField(`round_${roundNumber}_game`, displayGameValue(round));
    setField(`round_${roundNumber}_best_of`, round.best_of || round.legs_to_win || 3);
    setField(`round_${roundNumber}_points`, round.points || 1);
    setField(`round_${roundNumber}_in_rule`, round.in_rule === 'n/a' ? 'straight' : (round.in_rule || 'straight'));
    setField(`round_${roundNumber}_out_rule`, round.out_rule === 'n/a' ? 'double' : (round.out_rule || 'double'));
    setRoundMixedLegs(row, round.legs || round.mixed_legs || null);
}

function populateForm(league) {
    const rounds = Array.isArray(league.rounds) && league.rounds.length
        ? league.rounds
        : Array.isArray(league.match_format) ? league.match_format : [];
    setField('name', league.name || league.league_name || '');
    setField('season', league.season || '');
    setField('venue', league.venue_name || league.venue || '');
    setField('venue_address', league.venue_address || '');
    setField('league_mode', league.league_mode || 'draft');
    setField('status', league.status || 'draft');
    const rosterSize = clampNumber(league.roster_size, rosterSizeFromFormat(league.format), 1, 8);
    setField('roster_size', rosterSize);
    setField('format', formatFromRosterSize(rosterSize));
    setField('max_teams', league.max_teams ?? '');
    setField('schedule_format', league.schedule_format || 'round_robin');
    setField('min_players', league.min_players || 3);
    setField('max_roster', league.max_roster || 4);
    setField('registration_open_date', valueForDate(league.registration_open_date));
    setField('registration_close_date', valueForDate(league.registration_close_date));
    setField('registration_notifications', league.registration_notifications || 'email_phone_required');
    setField('registration_approval', league.registration_approval || 'auto');
    setField('start_date', valueForDate(league.start_date));
    setField('match_day', league.match_day || league.league_night || 'wednesday');
    setField('start_time', league.start_time || '19:00');
    setField('blackout_dates', Array.isArray(league.blackout_dates) ? league.blackout_dates.join(', ') : (league.blackout_dates || ''));
    setField('default_boards_available', league.default_boards_available ?? '');
    roundRows().forEach((row, index) => {
        if (index >= Math.max(rounds.length, 3)) row.remove();
    });
    Array.from({ length: Math.max(rounds.length, 3) }, (_, index) => applyRound(index + 1, rounds[index] || {}));
    setField('cork_rule', league.cork_rule || 'cork_every_leg');
    setField('cork_option', 'winner_chooses');
    setField('cork_winner_gets', league.cork_winner_gets || 'choose-and-start');
    setField('tiebreakers', Array.isArray(league.tiebreakers) ? league.tiebreakers.join(',') : (league.tiebreakers || 'match_wins,set_wins,leg_wins,head_to_head'));
    setField('playoff_format', normalizePlayoffFormat(league.playoff_format || (league.playoff?.format) || 'single_elimination'));
    setField('playoff_teams', league.playoff_teams || league.playoff?.teams || 6);
    setField('playoff_sets_to_win', league.playoff_sets_to_win || league.playoff?.sets_to_win || 5);
    setField('third_place_match', boolString(league.third_place_match, true));
    setField('playoff_reseed', boolString(league.playoff_reseed, false));
    setField('playoff_start_date', valueForDate(league.playoff_start_date || league.playoff?.start_date));
    setField('match_reminders', league.match_reminders || 'site_sms_email');
    setField('reminder_timing', league.reminder_timing || 'day_of');
    setField('up_next_notifications', league.up_next_notifications || 'site_sms');
    setField('director_alerts', league.director_alerts || 'site_sms_email');
    updateCorkPreview();
}

function syncRosterFormat() {
    const size = clampNumber(form?.querySelector('[name="roster_size"]')?.value, 3, 1, 8);
    setField('format', formatFromRosterSize(size));
}

function addRound(round = {}) {
    const nextRound = roundRows().length + 1;
    const row = createRoundRow(nextRound, round);
    roundsEl?.appendChild(row);
    setRoundMixedLegs(row, round.legs || null);
    updateRoundNumbers();
}

function initRoundBuilder() {
    updateRoundNumbers();
    roundRows().forEach(row => {
        ensureRoundRuleControls(row);
        setRoundMixedLegs(row, null);
    });
    roundsEl?.addEventListener('change', event => {
        const row = event.target.closest?.('.ves-round-row');
        if (!row) return;
        if (event.target.matches('[data-leg-field]')) {
            row.dataset.mixedLegs = JSON.stringify(readRoundMixedLegs(row));
        }
        renderRoundMixed(row);
    });
    roundsEl?.addEventListener('click', event => {
        const row = event.target.closest?.('.ves-round-row');
        if (!row) return;
        if (event.target.matches('[data-edit-legs]')) {
            row.dataset.mixedOpen = row.dataset.mixedOpen === 'true' ? 'false' : 'true';
            renderRoundMixed(row);
        }
        if (event.target.matches('[data-add-leg]')) {
            const legs = readRoundMixedLegs(row);
            legs.push({ game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' });
            setRoundMixedLegs(row, legs);
        }
        if (event.target.matches('[data-remove-leg]')) {
            const legRow = event.target.closest('.ves-mixed-leg-row');
            legRow?.remove();
            setRoundMixedLegs(row, readRoundMixedLegs(row));
        }
    });
    addRoundBtn?.addEventListener('click', () => addRound());
    form?.querySelector('[name="roster_size"]')?.addEventListener('change', syncRosterFormat);
    form?.querySelector('[name="cork_rule"]')?.addEventListener('change', updateCorkPreview);
    form?.querySelector('[name="cork_option"]')?.addEventListener('change', updateCorkPreview);
    form?.querySelector('[name="cork_winner_gets"]')?.addEventListener('change', updateCorkPreview);
    syncRosterFormat();
    updateCorkPreview();
}

function updateCorkPreview() {
    if (!corkPreviewEl) return;
    const rule = form?.querySelector('[name="cork_rule"]')?.value || 'cork_every_leg';
    const option = form?.querySelector('[name="cork_option"]')?.value || 'alternate_random_first_last';
    const winnerGets = form?.querySelector('[name="cork_winner_gets"]')?.value || 'choose-and-start';
    const ruleLabels = {
        cork_every_leg: 'Every leg opens with a cork.',
        alternate_cork_first_deciding: 'First and deciding legs cork; the rest alternate from the previous starter.',
        loser_starts_cork_first_deciding: 'First and deciding legs cork; other legs start with the previous leg loser.',
        winner_starts_cork_first_deciding: 'First and deciding legs cork; other legs start with the previous leg winner.',
        home_first: 'Home starts leg one, then starters alternate.',
        away_first: 'Away starts leg one, then starters alternate.'
    };
    const optionLabels = {
        alternate_random_first_last: 'When a cork has throw-order option, the option alternates with random first/deciding legs.',
        winner_chooses: 'The cork winner chooses whether to throw first or second.',
        loser_chooses: 'The cork loser chooses whether to throw first or second.',
        home_team_option: 'Home has the throw-order option when a cork is required.',
        away_team_option: 'Away has the throw-order option when a cork is required.'
    };
    const choiceLabels = {
        'choose-and-start': 'In choice legs, the cork winner picks the game and then chooses throw order.',
        'choose-only': 'In choice legs, the cork winner picks the game; the opponent starts.',
        'choose-or-start': 'In choice legs, the cork winner chooses either the game or the start.'
    };
    corkPreviewEl.innerHTML = `
        <strong>Scorer behavior</strong>
        <span>${ruleLabels[rule] || ruleLabels.cork_every_leg}</span>
        <span>${optionLabels[option] || optionLabels.alternate_random_first_last}</span>
        <span>${choiceLabels[winnerGets] || choiceLabels['choose-and-start']}</span>
    `;
}

async function loadExistingLeague() {
    if (!isSettingsMode) return;
    setStatus('Loading league settings...');
    const snap = await getDoc(doc(db, 'leagues', existingLeagueId));
    if (!snap.exists()) throw new Error('League settings were not found.');
    existingLeague = { id: snap.id, ...snap.data() };
    populateForm(existingLeague);
    setStatus('League settings loaded.');
}

function configureMode() {
    if (isSettingsMode) {
        document.title = 'League Settings - Rookies';
        kickerEl.textContent = 'League management';
        titleEl.textContent = 'League Settings';
        copyEl.textContent = 'Review the league rules, schedule, playoffs, notifications, and match format currently powering this league.';
        submitButton.textContent = 'Save league settings';
        cancelLink.textContent = 'Back to manage';
        cancelLink.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(existingLeagueId)}#manage`;
    } else {
        document.title = 'Create League - Rookies';
    }
}

form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!directorSession) {
        setStatus('Director login is required before saving league setup.', 'error');
        return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const name = String(data.name || '').trim();
    const season = String(data.season || '').trim();
    const format = String(data.format || 'triples').trim();
    if (!name || !season) {
        setStatus('League name and season are required.', 'error');
        return;
    }

    const id = isSettingsMode ? existingLeagueId : `rookies-${slugify(name || `${season}-${format}`)}`;
    setStatus(isSettingsMode ? 'Saving league settings...' : 'Creating draft league...');
    try {
        const payload = collectLeaguePayload(data);
        if (!isSettingsMode) {
            Object.assign(payload, {
                status: data.status || 'draft',
                tenant: 'rookies',
                created_at: serverTimestamp()
            });
        } else {
            payload.status = data.status || existingLeague?.status || 'active';
        }
        await setDoc(doc(db, 'leagues', id), {
            ...payload,
            director_name: directorSession?.name || auth.currentUser?.displayName || '',
            director_email: directorSession?.email || auth.currentUser?.email || '',
            director_phone: directorSession?.phone || '',
            director_player_id: directorSession?.id || directorSession?.player_id || null
        }, { merge: true });
        setStatus(isSettingsMode ? 'League settings saved.' : 'Draft league created. Opening league management.', 'success');
        if (!isSettingsMode) window.location.href = `/rookies/pages/triples-vnext.html?league_id=${encodeURIComponent(id)}#manage`;
    } catch (error) {
        console.error('[create-league-vnext] failed:', error);
        setStatus(error.message || 'Could not save league setup.', 'error');
    }
});

(async function initDirectorGate() {
    configureMode();
    initRoundBuilder();
    if (submitButton) submitButton.disabled = true;
    directorSession = await requireDirectorLogin({
        mountAfter: document.querySelector('.ves-hero'),
        gatedElements: [document.querySelector('.league-create-panel')],
        statusEl,
        title: isSettingsMode ? 'League Settings' : 'Create League',
        copy: 'Director login is required before league setup.',
        readyText: isSettingsMode ? 'Editing as' : 'Creating as'
    });
    if (!directorSession) return;
    try {
        await loadExistingLeague();
    } catch (error) {
        console.error('[create-league-vnext] load failed:', error);
        setStatus(error.message || 'Could not load league settings.', 'error');
    }
    if (submitButton) submitButton.disabled = false;
})();
