import { auth, callFunction, uploadImage } from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const form = document.getElementById('createTournamentForm');
const statusEl = document.getElementById('createStatus');
const resultEl = document.getElementById('createResult');
const submitBtn = document.getElementById('createTournamentBtn');
const locationMode = document.getElementById('locationMode');
const venueName = document.getElementById('venueName');
const venueAddressWrap = document.getElementById('venueAddressWrap');
const venueAddress = document.getElementById('venueAddress');
const presetSelect = document.getElementById('tournamentPreset');
const eventEditors = document.getElementById('eventEditors');
const addEventBtn = document.getElementById('addEventBtn');
const matchmakerSettings = document.getElementById('matchmakerSettings');
const createParams = new URLSearchParams(window.location.search);

let session = null;
let eventCounter = 1;

function setLocation(mode) {
    locationMode.value = mode;
    document.querySelectorAll('[data-location]').forEach(button => button.classList.toggle('active', button.dataset.location === mode));
    if (mode === 'online') {
        venueName.value = 'Online';
        venueAddress.value = '';
        venueAddressWrap.style.display = 'none';
    } else if (mode === 'flexible') {
        venueName.value = 'Flexible / Players Decide';
        venueAddress.value = '';
        venueAddressWrap.style.display = 'none';
    } else {
        if (venueName.value === 'Online' || venueName.value === 'Flexible / Players Decide') venueName.value = '';
        venueAddressWrap.style.display = '';
    }
}

function checked(name) {
    return form.elements[name]?.checked === true;
}

function numberValue(formData, name, fallback = 0) {
    const value = parseFloat(formData.get(name));
    return Number.isFinite(value) ? value : fallback;
}

function integerValue(formData, name, fallback = 0) {
    const value = parseInt(formData.get(name), 10);
    return Number.isFinite(value) ? value : fallback;
}

function boardListValue(formData, name) {
    return String(formData.get(name) || '')
        .split(',')
        .map(value => parseInt(value.trim(), 10))
        .filter(value => Number.isFinite(value) && value > 0);
}

function slugOption(value, index) {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
    return slug || `option_${index + 1}`;
}

function votingOptionsValue(formData) {
    const seen = new Set();
    return String(formData.get('registration_vote_options') || '')
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
        .map((label, index) => {
            let id = slugOption(label, index);
            let suffix = 2;
            while (seen.has(id)) {
                id = `${slugOption(label, index)}_${suffix}`;
                suffix += 1;
            }
            seen.add(id);
            return { id, label };
        });
}

function winTarget(total, mode) {
    const value = parseInt(total, 10) || 1;
    return mode === 'play-all' ? value : Math.floor(value / 2) + 1;
}

function isX01Game(game) {
    return ['301', '501', '701'].includes(String(game || ''));
}

function fieldValue(scope, name, fallback = '') {
    const field = scope.querySelector(`[name="${CSS.escape(name)}"]`);
    return field?.value ?? fallback;
}

function fieldChecked(scope, name) {
    return scope.querySelector(`[name="${CSS.escape(name)}"]`)?.checked === true;
}

function fieldNumber(scope, name, fallback = 0) {
    const value = parseFloat(fieldValue(scope, name, ''));
    return Number.isFinite(value) ? value : fallback;
}

function fieldInteger(scope, name, fallback = 0) {
    const value = parseInt(fieldValue(scope, name, ''), 10);
    return Number.isFinite(value) ? value : fallback;
}

function mixedLegPayload(editor) {
    return [...editor.querySelectorAll('[data-mixed-leg]')].map((row, index) => {
        const game = row.querySelector('[data-field="game_type"]')?.value || '501';
        const inOption = row.querySelector('[data-field="in_rule"]')?.value || 'straight';
        const outOption = row.querySelector('[data-field="out_rule"]')?.value || 'double';
        return {
            leg_number: index + 1,
            game,
            x01_value: isX01Game(game) ? parseInt(game, 10) : null,
            in_option: isX01Game(game) ? inOption : 'n/a',
            out_option: isX01Game(game) ? outOption : 'n/a'
        };
    });
}

function buildEventPayload(editor, formData) {
    const selectedGame = fieldValue(editor, 'game', '501');
    const game = selectedGame === 'custom' ? 'mixed' : selectedGame;
    const bestOf = fieldInteger(editor, 'best_of', 3);
    const legMode = fieldValue(editor, 'leg_mode', 'best-of');
    const numSets = fieldInteger(editor, 'num_sets', 1);
    const setMode = fieldValue(editor, 'set_mode', 'best-of');
    const startRule = fieldValue(editor, 'start_rule', 'cork_every_leg');
    const useCork = startRule !== 'choose_no_cork';
    const drawType = formData.get('draw_type') || '';
    const drawPool = formData.get('draw_pool') || 'all_registered';
    const event = {
        event_name: fieldValue(editor, 'event_name', 'Event'),
        entry_type: fieldValue(editor, 'entry_type', 'individual'),
        format: fieldValue(editor, 'format', 'single_elimination'),
        game,
        set_format: selectedGame === 'mixed' ? '501_c_ch' : selectedGame === 'custom' ? 'custom' : null,
        draw_type: drawType,
        draw_pool: drawPool,
        checked_in_draw_default: drawPool === 'checked_in_only',
        allow_house_player: checked('allow_house_player'),
        auto_generate_runtime: checked('auto_generate_runtime'),
        best_of: bestOf,
        num_legs: bestOf,
        legs_to_win: winTarget(bestOf, legMode),
        num_sets: numSets,
        sets_to_win: winTarget(numSets, setMode),
        leg_mode: legMode,
        set_mode: setMode,
        cork_rules: startRule,
        cork_option: fieldValue(editor, 'cork_option', 'winner_chooses'),
        cork_order: fieldValue(editor, 'cork_order', 'alternate-random'),
        cork_winner_gets: fieldValue(editor, 'cork_winner_gets', 'choose-and-start'),
        use_cork: useCork,
        in_option: fieldValue(editor, 'in_option', 'straight'),
        out_option: fieldValue(editor, 'out_option', 'double'),
        x01_value: ['301', '501', '701'].includes(game) ? parseInt(game, 10) : null,
        entry_fee: fieldNumber(editor, 'entry_fee', 0),
        start_time: fieldValue(editor, 'event_start_time', ''),
        event_details: fieldValue(editor, 'event_details', ''),
        playoff_settings_enabled: fieldChecked(editor, 'enable_playoff_settings'),
        playoff_settings: {
            semis: {
                format: fieldValue(editor, 'semis_format', 'legs'),
                num_legs: fieldInteger(editor, 'semis_num_legs', 3),
                num_sets: fieldInteger(editor, 'semis_num_sets', 3)
            },
            finals: {
                format: fieldValue(editor, 'finals_format', 'legs'),
                num_legs: fieldInteger(editor, 'finals_num_legs', 5),
                num_sets: fieldInteger(editor, 'finals_num_sets', 5)
            }
        }
    };

    if (selectedGame === 'mixed' || selectedGame === 'custom') {
        event.legs = mixedLegPayload(editor);
    }

    return event;
}

function buildPayload(formData) {
    const mode = formData.get('location_mode') || 'online';
    const events = [...eventEditors.querySelectorAll('.ves-event-editor')].map(editor => buildEventPayload(editor, formData));
    const firstEvent = events[0] || {};
    const drawType = formData.get('draw_type') || '';
    const drawPool = formData.get('draw_pool') || 'all_registered';
    const preset = formData.get('preset') || '';
    const registrationVoteOptions = votingOptionsValue(formData);
    const votingEnabled = checked('registration_voting_enabled') && registrationVoteOptions.length > 0;

    return {
        tournament_name: formData.get('tournament_name'),
        preset,
        tournament_date: formData.get('tournament_date'),
        tournament_time: formData.get('tournament_time') || '',
        tournament_details: formData.get('tournament_details') || '',
        series_mode: formData.get('series_mode') || 'single',
        is_series: formData.get('series_mode') === 'series',
        registration_close_time: formData.get('registration_close_time') || '',
        registration_voting_enabled: votingEnabled,
        registration_vote_required: votingEnabled && checked('registration_vote_required'),
        registration_vote_question: formData.get('registration_vote_question') || 'What should we play this week?',
        registration_vote_options: registrationVoteOptions,
        registration_vote_locked: false,
        registration_vote_selected_label: formData.get('registration_vote_selected_label') || '',
        draw_type: drawType,
        draw_pool: drawPool,
        checked_in_draw_default: drawPool === 'checked_in_only',
        allow_house_player: checked('allow_house_player'),
        auto_generate_runtime: checked('auto_generate_runtime'),
        location_mode: mode,
        is_online: mode === 'online',
        allow_remote_play: mode === 'online' || mode === 'flexible',
        venue_name: formData.get('venue_name') || (mode === 'online' ? 'Online' : ''),
        venue_address: mode === 'specific' ? (formData.get('venue_address') || '') : '',
        boards_available: integerValue(formData, 'boards_available', 0),
        venue_board_count: integerValue(formData, 'boards_available', 0),
        unavailable_boards: boardListValue(formData, 'unavailable_boards'),
        full_name: session?.name || auth.currentUser?.displayName || 'BRDC Director',
        director_name: session?.name || auth.currentUser?.displayName || 'BRDC Director',
        email: session?.email || auth.currentUser?.email || '',
        phone: session?.phone || '',
        director_player_id: session?.id || null,
        max_players: integerValue(formData, 'max_players', 16),
        format: firstEvent.format || 'single_elimination',
        game: firstEvent.game || '501',
        entry_fee: firstEvent.entry_fee || 0,
        enable_tournament_chat: checked('enable_tournament_chat'),
        enable_player_challenges: checked('enable_player_challenges'),
        auto_create_match_rooms: checked('auto_create_match_rooms'),
        require_check_in: checked('require_check_in'),
        allow_player_self_report: checked('allow_player_self_report'),
        show_tournament_runtime: true,
        enable_video_streaming: checked('enable_video_streaming'),
        enable_score_assist: checked('enable_score_assist'),
        enable_runtime_notifications: checked('enable_runtime_notifications'),
        matchmaker_enabled: preset === 'mixed_doubles_matchmaker',
        partner_matching: checked('partner_matching'),
        breakup_enabled: checked('breakup_enabled'),
        savage_summaries_enabled: checked('savage_summaries_enabled'),
        nudge_limit: integerValue(formData, 'nudge_limit', 3),
        winners_game_type: formData.get('winners_game_type') || 'cricket',
        winners_best_of: integerValue(formData, 'winners_best_of', 3),
        losers_game_type: formData.get('losers_game_type') || '501',
        losers_best_of: integerValue(formData, 'losers_best_of', 1),
        mingle_cutoff: formData.get('mingle_cutoff') || 'wc_r2_last_start',
        events
    };
}

function applyPreset(preset) {
    if (matchmakerSettings) {
        matchmakerSettings.hidden = preset !== 'mixed_doubles_matchmaker';
        matchmakerSettings.open = preset === 'mixed_doubles_matchmaker';
    }
    if (!preset) {
        updateFormatVisibility();
        return;
    }
    const set = (name, value) => {
        const field = form.elements[name];
        if (!field) return;
        if (field.type === 'checkbox') field.checked = value === true || value === 'on';
        else field.value = value;
    };
    set('registration_voting_enabled', false);
    if (preset === 'blind_draw') {
        set('tournament_name', 'Wing It Wednesdays Blind Draw');
        set('event_name', 'Blind Draw');
        set('entry_type', 'blind_draw');
        set('format', 'single_elimination');
        set('game', 'mixed');
        set('entry_fee', '5');
        set('series_mode', 'series');
        set('registration_close_time', '18:45');
        set('boards_available', '8');
        set('draw_type', 'blind_draw_doubles');
        set('draw_pool', 'checked_in_only');
        set('registration_voting_enabled', 'on');
        setLocation('specific');
        venueName.value = 'Rookies Sports Bar & Grill';
    }
    if (preset === 'weekly_series') {
        set('tournament_name', 'Wing It Wednesdays');
        set('event_name', 'Weekly Event');
        set('series_mode', 'series');
        set('format', 'single_elimination');
        set('game', 'mixed');
        set('boards_available', '8');
        set('registration_voting_enabled', 'on');
        setLocation('specific');
        venueName.value = 'Rookies Sports Bar & Grill';
    }
    if (preset === 'mixed_doubles_matchmaker') {
        set('tournament_name', 'Mixed Doubles Matchmaker');
        set('event_name', 'Mixed Doubles Matchmaker');
        set('entry_type', 'mixed_doubles');
        set('format', 'double_elimination');
        set('game', 'cricket');
        set('series_mode', 'single');
        set('max_players', '32');
        set('boards_available', '12');
        set('draw_type', 'manual_teams');
        set('draw_pool', 'checked_in_only');
        set('winners_game_type', 'cricket');
        set('winners_best_of', '3');
        set('losers_game_type', '501');
        set('losers_best_of', '1');
        set('mingle_cutoff', 'wc_r2_last_start');
        setLocation('specific');
        venueName.value = 'Rookies Sports Bar & Grill';
    }
    updateFormatVisibility();
}

function gameOptions(selected = '501') {
    return ['501', '301', '701', 'cricket', 'corks_choice']
        .map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value === 'corks_choice' ? 'CH' : value === 'cricket' ? 'C' : value}</option>`)
        .join('');
}

function ruleOptions(selected = 'straight') {
    return [
        ['straight', 'Free in'],
        ['double', 'Double in'],
        ['master', 'Master in (D/T)']
    ].map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function outOptions(selected = 'double') {
    return [
        ['double', 'Double out'],
        ['straight', 'Single out'],
        ['master', 'Master out (D/T)']
    ].map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

function renderMixedConfig(editor) {
    const rows = editor.querySelector('[data-mixed-rows]');
    if (!rows) return;
    const current = mixedLegPayload(editor);
    const count = Math.max(1, Math.min(21, fieldInteger(editor, 'best_of', 3)));
    const defaultPattern = ['501', 'cricket', 'corks_choice'];
    rows.innerHTML = Array.from({ length: count }, (_, index) => {
        const existing = current[index] || {};
        const game = existing.game || defaultPattern[index % defaultPattern.length];
        const inRule = existing.in_option === 'n/a' ? 'straight' : (existing.in_option || 'straight');
        const outRule = existing.out_option === 'n/a' ? 'double' : (existing.out_option || 'double');
        return `
            <article class="ves-round-row" data-mixed-leg="${index}">
                <strong>Leg ${index + 1}</strong>
                <select data-field="game_type">${gameOptions(game)}</select>
                <select data-field="in_rule">${ruleOptions(inRule)}</select>
                <select data-field="out_rule">${outOptions(outRule)}</select>
            </article>
        `;
    }).join('');
    rows.querySelectorAll('[data-field="game_type"]').forEach(select => {
        select.addEventListener('change', () => updateMixedRuleVisibility(editor));
    });
    updateMixedRuleVisibility(editor);
}

function updateMixedRuleVisibility(editor) {
    editor.querySelectorAll('[data-mixed-leg]').forEach(row => {
        const typeSelect = row.querySelector('[data-field="game_type"]');
        const isX01 = isX01Game(typeSelect.value);
        row.querySelectorAll('[data-field="in_rule"], [data-field="out_rule"]')
            .forEach(ruleSelect => { ruleSelect.hidden = !isX01; });
    });
}

function updateEditorVisibility(editor) {
    const game = fieldValue(editor, 'game', '501');
    const mixedConfig = editor.querySelector('[data-mixed-config]');
    if (mixedConfig) mixedConfig.classList.toggle('is-visible', game === 'mixed' || game === 'custom');
    if (game === 'mixed' || game === 'custom') renderMixedConfig(editor);
    const summary = editor.querySelector('summary b');
    if (summary) {
        const gameLabel = game === 'mixed' ? '501/C/CH' : game === 'custom' ? 'Custom set' : game;
        summary.textContent = `${gameLabel}, ${fieldValue(editor, 'format', 'single_elimination').replace(/_/g, ' ')}`;
    }
}

function updateFormatVisibility() {
    eventEditors.querySelectorAll('.ves-event-editor').forEach(updateEditorVisibility);
}

function bindEventEditor(editor) {
    editor.querySelector('[name="game"]')?.addEventListener('change', () => updateEditorVisibility(editor));
    editor.querySelector('[name="best_of"]')?.addEventListener('change', () => updateEditorVisibility(editor));
    editor.querySelector('[name="format"]')?.addEventListener('change', () => updateEditorVisibility(editor));
    editor.querySelector('[data-remove-event]')?.addEventListener('click', () => {
        editor.remove();
        renumberEvents();
    });
    updateEditorVisibility(editor);
}

function renumberEvents() {
    eventEditors.querySelectorAll('.ves-event-editor').forEach((editor, index) => {
        editor.dataset.eventIndex = String(index + 1);
        const label = editor.querySelector('summary small');
        if (label) label.textContent = `Event ${index + 1}`;
        const remove = editor.querySelector('[data-remove-event]');
        if (remove) remove.hidden = index === 0;
    });
}

function eventEditorTemplate(index) {
    return `
        <details class="ves-panel ves-details-panel ves-event-editor" data-event-index="${index}">
            <summary>
                <span>
                    <small>Event ${index}</small>
                    <strong>Format settings</strong>
                </span>
                <b>501, single elimination</b>
            </summary>
            <button class="ves-action danger" type="button" data-remove-event>Remove event</button>
            <div class="ves-config-grid">
                <label>Event name<input name="event_name" required value="Event ${index}"></label>
                <label>Entry type<select name="entry_type"><option value="individual">Singles</option><option value="doubles">Doubles</option><option value="mixed_doubles">Mixed doubles</option><option value="blind_draw">Blind Draw</option><option value="team">Team</option></select></label>
                <label>Bracket<select name="format"><option value="single_elimination">Single elimination</option><option value="double_elimination">Double elimination</option><option value="round_robin">Round robin</option><option value="swiss">Swiss</option></select></label>
                <label>Game<select name="game"><option value="501" selected>501</option><option value="301">301</option><option value="701">701</option><option value="cricket">Cricket</option><option value="corks_choice">Cork's choice</option><option value="mixed">501/C/CH</option><option value="custom">Custom set</option></select></label>
                <label>Total legs<input name="best_of" type="number" min="1" step="2" value="3"></label>
                <label>Leg mode<select name="leg_mode"><option value="best-of" selected>Best of</option><option value="play-all">Play all</option></select></label>
                <label>Sets<input name="num_sets" type="number" min="1" value="1"></label>
                <label>Set mode<select name="set_mode"><option value="best-of" selected>Best of</option><option value="play-all">Play all</option></select></label>
                <label>In rule<select name="in_option"><option value="straight">Free in</option><option value="double">Double in</option><option value="master">Master in (D/T)</option></select></label>
                <label>Out rule<select name="out_option"><option value="double">Double out</option><option value="straight">Single out</option><option value="master">Master out (D/T)</option></select></label>
                <label>Start rule<select name="start_rule"><option value="cork_every_leg">Cork every leg</option><option value="alternate_cork_first_deciding">Alternate, cork first/deciding</option><option value="loser_starts_cork_first_deciding">Loser starts, cork first/deciding</option><option value="winner_starts_cork_first_deciding">Winner starts, cork first/deciding</option><option value="choose_no_cork">Select starter, no cork</option></select></label>
                <label>Cork option<select name="cork_option"><option value="alternate_random_first_last">Alternate, random first/deciding</option><option value="winner_chooses">Cork winner chooses</option><option value="loser_chooses">Cork loser chooses</option><option value="home_team_option">Higher seed/home option</option><option value="away_team_option">Lower seed/away option</option></select></label>
                <label>Cork order<select name="cork_order"><option value="alternate-random">Alternate, random first/deciding</option><option value="random-every">Random every leg</option><option value="loser-random">Loser first, random first/deciding</option><option value="winner-random">Winner first, random first/deciding</option></select></label>
                <label>Choice winner gets<select name="cork_winner_gets"><option value="choose-and-start">Choose game and start</option><option value="choose-only">Choose game only</option><option value="choose-or-start">Choose game or start</option></select></label>
                <label>Entry fee<input name="entry_fee" type="number" min="0" step="0.01" value="0"></label>
                <label>Event start<input name="event_start_time" type="time"></label>
                <label>Event image<input name="event_image" type="file" accept="image/*"></label>
            </div>
            <div class="ves-mixed-config" data-mixed-config>
                <p class="ves-kicker">Mixed legs</p>
                <p class="ves-section-note">CH means cork winner chooses from the games already played earlier in this set.</p>
                <div data-mixed-rows></div>
            </div>
            <div class="ves-playoff-config">
                <p class="ves-kicker">Late-round overrides</p>
                <div class="ves-config-grid">
                    <label><input type="checkbox" name="enable_playoff_settings"> Use semi/final format overrides</label>
                    <label>Semis format<select name="semis_format"><option value="legs" selected>Best of legs</option><option value="sets">Best of sets</option></select></label>
                    <label>Semis legs<input name="semis_num_legs" type="number" min="1" step="2" value="3"></label>
                    <label>Semis sets<input name="semis_num_sets" type="number" min="1" step="2" value="3"></label>
                    <label>Finals format<select name="finals_format"><option value="legs" selected>Best of legs</option><option value="sets">Best of sets</option></select></label>
                    <label>Finals legs<input name="finals_num_legs" type="number" min="1" step="2" value="5"></label>
                    <label>Finals sets<input name="finals_num_sets" type="number" min="1" step="2" value="5"></label>
                </div>
            </div>
            <label class="ves-textarea-label">Event details<textarea name="event_details" rows="3" placeholder="Special rules, payout notes, or callout copy."></textarea></label>
        </details>
    `;
}

function addEventEditor() {
    eventCounter += 1;
    eventEditors.insertAdjacentHTML('beforeend', eventEditorTemplate(eventCounter));
    const editor = eventEditors.querySelector(`.ves-event-editor[data-event-index="${eventCounter}"]`);
    bindEventEditor(editor);
    renumberEvents();
}

async function initSession() {
    submitBtn.disabled = true;
    session = await requireDirectorLogin({
        mountAfter: document.querySelector('.ves-page-header'),
        gatedElements: [form],
        statusEl,
        title: 'Create Event',
        copy: 'Director login is required before event setup.',
        readyText: 'Creating as'
    });
    submitBtn.disabled = !session;
}

document.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => setLocation(button.dataset.location)));
presetSelect?.addEventListener('change', () => applyPreset(presetSelect.value));
addEventBtn?.addEventListener('click', addEventEditor);
eventEditors.querySelectorAll('.ves-event-editor').forEach(bindEventEditor);
renumberEvents();
setLocation('online');
const requestedPreset = createParams.get('preset');
if (requestedPreset && presetSelect?.querySelector(`option[value="${CSS.escape(requestedPreset)}"]`)) {
    presetSelect.value = requestedPreset;
    applyPreset(requestedPreset);
}
updateFormatVisibility();
initSession();

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    resultEl.hidden = false;
    resultEl.textContent = 'Creating tournament...';
    try {
        const payload = buildPayload(new FormData(form));
        const tournamentImage = form.elements.tournament_image?.files?.[0];
        if (tournamentImage) {
            resultEl.textContent = 'Uploading tournament image...';
            payload.image_url = await uploadImage(tournamentImage, 'tournaments');
        }
        const editors = [...eventEditors.querySelectorAll('.ves-event-editor')];
        for (let index = 0; index < editors.length; index += 1) {
            const eventImage = editors[index].querySelector('[name="event_image"]')?.files?.[0];
            if (!eventImage) continue;
            resultEl.textContent = `Uploading event ${index + 1} image...`;
            payload.events[index].image_url = await uploadImage(eventImage, 'events');
        }
        resultEl.textContent = 'Creating event...';
        const functionName = payload.preset === 'mixed_doubles_matchmaker'
            ? 'createMixedDoublesMatchmakerTournament'
            : 'createTournament';
        const result = await callFunction(functionName, payload);
        if (!result?.success) throw new Error(result?.error || 'Create failed');
        resultEl.innerHTML = `Event created. <a href="/rookies/pages/tournament-runtime-vnext.html?tournament_id=${result.tournament_id}">Open runtime</a>`;
        if (typeof window.toastSuccess === 'function') window.toastSuccess('Event created');
    } catch (error) {
        resultEl.textContent = error.message || 'Could not create tournament.';
        if (typeof window.toastError === 'function') window.toastError(resultEl.textContent);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create event';
    }
});
