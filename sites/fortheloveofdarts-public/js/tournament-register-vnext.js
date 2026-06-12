import { auth, waitForAuthReady, callFunction, db, collection, doc, getDoc, getDocs } from '/js/firebase-config.js';

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get('tournament_id') || params.get('id') || 'rookies-wing-it-wednesdays-2026-05-27';

const els = {
    status: document.getElementById('registerStatusLine'),
    title: document.getElementById('registerTitle'),
    meta: document.getElementById('registerMeta'),
    back: document.getElementById('tournamentBackLink'),
    runtime: document.getElementById('runtimeLink'),
    form: document.getElementById('registrationForm'),
    fullName: document.getElementById('fullName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    matchmakerPanel: document.getElementById('matchmakerRegisterPanel'),
    matchmakerGender: document.getElementById('matchmakerGender'),
    matchmakerTeamNameWrap: document.getElementById('matchmakerTeamNameWrap'),
    matchmakerTeamName: document.getElementById('matchmakerTeamName'),
    partnerNameWrap: document.getElementById('partnerNameWrap'),
    partnerName: document.getElementById('partnerName'),
    partnerEmailWrap: document.getElementById('partnerEmailWrap'),
    partnerEmail: document.getElementById('partnerEmail'),
    partnerPhoneWrap: document.getElementById('partnerPhoneWrap'),
    partnerPhone: document.getElementById('partnerPhone'),
    partnerGenderWrap: document.getElementById('partnerGenderWrap'),
    partnerGender: document.getElementById('partnerGender'),
    eventKicker: document.getElementById('eventSectionKicker'),
    eventTitle: document.getElementById('eventSectionTitle'),
    events: document.getElementById('eventOptions'),
    votePanel: document.getElementById('registrationVotePanel'),
    voteQuestion: document.getElementById('registrationVoteQuestion'),
    voteOptions: document.getElementById('registrationVoteOptions'),
    voteSuggestion: document.getElementById('registrationVoteSuggestion'),
    voteNote: document.getElementById('registrationVoteNote'),
    payment: document.getElementById('paymentMethod'),
    notificationPreference: document.getElementById('notificationPreference'),
    total: document.getElementById('totalLine'),
    submit: document.getElementById('registerBtn'),
    result: document.getElementById('registerResult')
};

let state = {
    tournament: null,
    events: [],
    session: null,
    mode: 'self',
    matchmakerType: 'single',
    selected: new Set(),
    selectedVote: null
};

const DEFAULT_WING_VOTE_OPTIONS = [
    { id: 'blind_draw_doubles', label: 'Blind draw doubles' },
    { id: 'mixed_doubles_matchmaker', label: 'Mixed doubles matchmaker' },
    { id: '501_c_ch', label: '501/C/CH' },
    { id: 'cricket_luck_draw', label: 'Cricket luck draw' },
    { id: 'mystery_format', label: 'Mystery format' }
];

function demoWingTournament(id) {
    if (id !== 'rookies-wing-it-wednesdays-2026-05-27') return null;
    return {
        tournament: {
            id,
            name: 'Wing It Wednesdays #1: Blind Draw',
            tournament_name: 'Wing It Wednesdays #1: Blind Draw',
            status: 'completed',
            registration_status: 'completed',
            date: '2026-05-27',
            series_name: 'Wing It Wednesdays',
            entry_fee: 5,
            max_players: 32,
            venue_name: 'Rookies Sports Bar & Grill',
            format: 'single_elimination',
            game_type: '501',
            entry_type: 'blind_draw_team',
            registration_voting_enabled: true,
            registration_vote_required: true,
            registration_vote_question: 'What should we play this week?',
            registration_vote_options: DEFAULT_WING_VOTE_OPTIONS
        },
        events: [
            {
                id: 'main',
                event_name: 'Blind Draw Doubles',
                format: '501/C/CH',
                game_type: '501/C/CH',
                entry_type: 'blind_draw_team',
                entry_fee: 5,
                max_players: 32,
                registered_count: 4
            }
        ]
    };
}

function timeoutAfter(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out loading tournament data')), ms));
}

function mergeDemoTournament(fallback, data = {}) {
    if (!fallback) return data;
    const merged = {
        ...fallback.tournament,
        ...data
    };
    merged.registration_voting_enabled = true;
    merged.registration_vote_required = data.registration_vote_required ?? fallback.tournament.registration_vote_required;
    merged.registration_vote_question = data.registration_vote_question || fallback.tournament.registration_vote_question;
    merged.registration_vote_options = Array.isArray(data.registration_vote_options) && data.registration_vote_options.length
        ? data.registration_vote_options
        : fallback.tournament.registration_vote_options;
    return merged;
}

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    const date = new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : 'Date TBD';
}

function title() {
    return state.tournament?.tournament_name || state.tournament?.name || 'Tournament';
}

function isWingItWednesday() {
    const raw = `${tournamentId} ${title()}`.toLowerCase();
    return raw.includes('wing-it-wednesdays') || raw.includes('wing it wednesday') || raw.includes('wing it wednesdays');
}

function voteOptions() {
    const configured = Array.isArray(state.tournament?.registration_vote_options)
        ? state.tournament.registration_vote_options
        : [];
    const normalized = configured
        .map((option, index) => typeof option === 'string'
            ? { id: `option_${index + 1}`, label: option }
            : { id: option.id || `option_${index + 1}`, label: option.label || option.name || option.id || `Option ${index + 1}` })
        .filter(option => option.label);
    return normalized.length ? normalized : DEFAULT_WING_VOTE_OPTIONS;
}

function votingEnabled() {
    if (state.tournament?.registration_vote_locked === true) return true;
    if (state.tournament?.registration_voting_enabled === true) return true;
    if (state.tournament?.registration_voting_enabled === false) return false;
    return isWingItWednesday();
}

function voteRequired() {
    return votingEnabled()
        && state.tournament?.registration_vote_locked !== true
        && state.tournament?.registration_vote_required !== false;
}

function formatLabel(item = {}) {
    return [item.format || item.game_format || item.match_format, item.game || item.game_type || item.default_game, item.entry_type]
        .filter(Boolean)
        .join(' - ') || 'Tournament event';
}

function entryFee(event) {
    const raw = event.entry_fee ?? event.fee ?? state.tournament?.entry_fee ?? 0;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : 0;
}

function selectedTotal() {
    return [...state.selected].reduce((sum, id) => sum + entryFee(state.events.find(event => event.id === id) || {}), 0);
}

function setStatus(message, isError = false) {
    els.result.hidden = false;
    els.result.classList.toggle('error', isError);
    els.result.innerHTML = escapeHtml(message);
}

function clearStatus() {
    els.result.hidden = true;
    els.result.textContent = '';
    els.result.classList.remove('error');
}

function applySessionToFields() {
    const user = auth.currentUser;
    if (state.mode !== 'self') {
        els.fullName.value = '';
        els.email.value = '';
        els.phone.value = '';
        return;
    }
    els.fullName.value = state.session?.name || user?.displayName || els.fullName.value || '';
    els.email.value = state.session?.email || user?.email || els.email.value || '';
    els.phone.value = state.session?.phone || els.phone.value || '';
}

function updateSubmitState() {
    const total = selectedTotal();
    els.total.textContent = total > 0 ? `$${total.toFixed(2)} selected` : '$0 due now';
    if (total === 0) els.payment.value = 'free';
    const isMatchmaker = state.tournament?.matchmaker_enabled === true;
    const partnerReady = state.matchmakerType !== 'team'
        || (els.partnerName.value.trim() && els.partnerEmail.value.trim() && els.partnerPhone.value.trim() && els.partnerGender.value);
    const matchmakerReady = !isMatchmaker || (els.matchmakerGender.value && partnerReady);
    const voteReady = !voteRequired() || Boolean(state.selectedVote);
    els.submit.disabled = (!isMatchmaker && state.selected.size === 0)
        || !els.fullName.value.trim()
        || !els.email.value.trim()
        || !els.phone.value.trim()
        || !matchmakerReady
        || !voteReady;
}

function renderHeader() {
    const tournament = state.tournament || {};
    const isMatchmaker = tournament.matchmaker_enabled === true;
    els.status.textContent = tournament.status || tournament.registration_status || 'Registration open';
    els.title.textContent = title();
    els.meta.textContent = `${dateLabel(tournament.date || tournament.tournament_date || tournament.start_date)} - ${state.events.length || 1} event option${state.events.length === 1 ? '' : 's'}`;
    if (isMatchmaker) {
        els.meta.textContent = `${dateLabel(tournament.date || tournament.tournament_date || tournament.start_date)} - mixed doubles matchmaker`;
    }
    if (els.eventKicker) els.eventKicker.textContent = isMatchmaker ? 'Entry' : 'Events';
    if (els.eventTitle) els.eventTitle.textContent = isMatchmaker ? 'Choose entry type' : 'Select event';
    els.back.href = `/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
    els.runtime.href = `/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}`;
}

function renderEvents() {
    const events = state.tournament?.matchmaker_enabled
        ? [{ id: 'matchmaker', ...(state.tournament || {}), event_name: 'Mixed doubles entry', entry_type: state.matchmakerType === 'team' ? 'Pair' : 'Single' }]
        : state.events.length ? state.events : [{ id: 'main', ...(state.tournament || {}), event_name: title() }];
    state.events = events;
    if (state.tournament?.matchmaker_enabled) state.selected.add(events[0].id);
    els.events.innerHTML = events.map((event, index) => {
        const count = Number(event.registered_count || event.registration_count || 0);
        const cap = Number(event.max_players || event.max_teams || event.capacity || state.tournament?.max_players || 0);
        const fee = entryFee(event);
        const selected = state.selected.has(event.id);
        return `
            <button class="trv-event-option ${selected ? 'selected' : ''}" type="button" data-event-id="${escapeHtml(event.id)}" aria-pressed="${selected ? 'true' : 'false'}">
                <span class="trv-event-check">${selected ? 'Selected' : 'Select'}</span>
                <strong>${escapeHtml(event.event_name || event.name || event.title || `Event ${index + 1}`)}</strong>
                <em>${escapeHtml(formatLabel(event))}</em>
                <small>${escapeHtml(cap ? `${count}/${cap} signed up` : `${count || 0} signed up`)} - ${fee > 0 ? `$${fee.toFixed(2)}` : 'Free'}</small>
            </button>
        `;
    }).join('');
    els.events.querySelectorAll('[data-event-id]').forEach(button => {
        button.addEventListener('click', () => {
            const id = button.dataset.eventId;
            if (state.selected.has(id)) state.selected.delete(id);
            else state.selected.add(id);
            renderEvents();
            updateSubmitState();
        });
    });
    updateSubmitState();
}

function renderVotingPanel() {
    if (!els.votePanel) return;
    const enabled = votingEnabled();
    els.votePanel.hidden = !enabled;
    if (!enabled) {
        state.selectedVote = null;
        return;
    }

    const locked = state.tournament?.registration_vote_locked === true;
    const selectedLabel = state.tournament?.registration_vote_selected_label || state.tournament?.locked_format_label || '';
    els.voteQuestion.textContent = state.tournament?.registration_vote_question || 'What should we play this week?';
    if (locked) {
        els.voteOptions.innerHTML = `
            <div class="ves-empty trv-vote-locked">
                Final format locked${selectedLabel ? `: ${escapeHtml(selectedLabel)}` : '.'}
            </div>
        `;
        els.voteSuggestion.disabled = true;
        els.voteNote.textContent = 'Voting is closed for this week.';
        state.selectedVote = null;
        updateSubmitState();
        return;
    }

    els.voteSuggestion.disabled = false;
    els.voteNote.textContent = voteRequired()
        ? 'Choose one. The director still locks the final format before play starts.'
        : 'Optional. Votes help the director lock the final weekly format.';

    els.voteOptions.innerHTML = voteOptions().map(option => {
        const active = state.selectedVote?.id === option.id;
        return `
            <button class="trv-event-option ${active ? 'selected' : ''}" type="button" data-vote-id="${escapeHtml(option.id)}" aria-pressed="${active ? 'true' : 'false'}">
                <span class="trv-event-check">${active ? 'Your vote' : 'Vote'}</span>
                <strong>${escapeHtml(option.label)}</strong>
                <em>${escapeHtml(option.description || 'Player choice')}</em>
            </button>
        `;
    }).join('');

    els.voteOptions.querySelectorAll('[data-vote-id]').forEach(button => {
        button.addEventListener('click', () => {
            const option = voteOptions().find(item => item.id === button.dataset.voteId);
            state.selectedVote = option || null;
            renderVotingPanel();
            updateSubmitState();
        });
    });
    updateSubmitState();
}

function registrationVotePayload() {
    if (!votingEnabled() || state.tournament?.registration_vote_locked === true) return null;
    if (!state.selectedVote) return null;
    return {
        question: state.tournament?.registration_vote_question || 'What should we play this week?',
        option_id: state.selectedVote.id,
        label: state.selectedVote.label,
        suggestion: els.voteSuggestion?.value.trim() || ''
    };
}

function renderMatchmakerPanel() {
    const enabled = state.tournament?.matchmaker_enabled === true;
    if (!els.matchmakerPanel) return;
    els.matchmakerPanel.hidden = !enabled;
    document.querySelectorAll('[data-matchmaker-type]').forEach(button => {
        button.classList.toggle('active', button.dataset.matchmakerType === state.matchmakerType);
    });
    const team = enabled && state.matchmakerType === 'team';
    [
        els.matchmakerTeamNameWrap,
        els.partnerNameWrap,
        els.partnerEmailWrap,
        els.partnerPhoneWrap,
        els.partnerGenderWrap
    ].forEach(item => { if (item) item.hidden = !team; });
    [els.partnerName, els.partnerEmail, els.partnerPhone, els.partnerGender].forEach(item => {
        if (item) item.required = team;
    });
    if (els.matchmakerGender) els.matchmakerGender.required = enabled;
}

function initModeButtons() {
    document.querySelectorAll('[data-register-mode]').forEach(button => {
        button.addEventListener('click', () => {
            state.mode = button.dataset.registerMode;
            document.querySelectorAll('[data-register-mode]').forEach(item => item.classList.toggle('active', item === button));
            applySessionToFields();
            updateSubmitState();
        });
    });
    document.querySelectorAll('[data-matchmaker-type]').forEach(button => {
        button.addEventListener('click', () => {
            state.matchmakerType = button.dataset.matchmakerType;
            renderMatchmakerPanel();
            renderEvents();
            updateSubmitState();
        });
    });
}

async function loadSession() {
    await waitForAuthReady(5000);
    if (!auth.currentUser) return;
    try {
        const result = await callFunction('getPlayerSession', {});
        if (result?.success && result.player) state.session = result.player;
    } catch (error) {
        console.warn('[tournament-register-vnext] session lookup failed:', error?.message || error);
    }
}

async function loadTournament() {
    if (!tournamentId) throw new Error('Missing tournament_id');
    const fallback = demoWingTournament(tournamentId);
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    try {
        const [tournamentSnap, eventsSnap] = await Promise.race([
            Promise.all([
                getDoc(tournamentRef),
                getDocs(collection(db, 'tournaments', tournamentId, 'events')).catch(() => ({ docs: [] }))
            ]),
            timeoutAfter(fallback ? 9000 : 16000)
        ]);
        if (!tournamentSnap.exists()) {
            if (!fallback) throw new Error('Tournament not found');
            state.tournament = fallback.tournament;
            state.events = fallback.events;
            return;
        }
        state.tournament = mergeDemoTournament(fallback, { id: tournamentSnap.id, ...tournamentSnap.data() });
        state.events = eventsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
        if (!state.events.length && fallback?.events) state.events = fallback.events;
    } catch (error) {
        if (!fallback) throw error;
        console.warn('[tournament-register-vnext] using demo tournament fallback:', error?.message || error);
        state.tournament = fallback.tournament;
        state.events = fallback.events;
    }
}

els.fullName.addEventListener('input', updateSubmitState);
els.email.addEventListener('input', updateSubmitState);
els.phone.addEventListener('input', updateSubmitState);
els.matchmakerGender?.addEventListener('change', updateSubmitState);
els.partnerName?.addEventListener('input', updateSubmitState);
els.partnerEmail?.addEventListener('input', updateSubmitState);
els.partnerPhone?.addEventListener('input', updateSubmitState);
els.partnerGender?.addEventListener('change', updateSubmitState);
els.payment.addEventListener('change', updateSubmitState);
initModeButtons();

Promise.all([loadTournament(), loadSession()]).then(() => {
    renderHeader();
    applySessionToFields();
    renderMatchmakerPanel();
    renderEvents();
    renderVotingPanel();
}).catch(error => {
    console.error('[tournament-register-vnext] failed:', error);
    els.status.textContent = 'Registration unavailable';
    els.events.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load registration')}</div>`;
});

els.form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!els.form.checkValidity()) {
        els.form.reportValidity();
        return;
    }
    if (voteRequired() && !state.selectedVote) {
        setStatus('Choose your Wing It vote before registering.', true);
        return;
    }
    if (!state.selected.size) {
        setStatus('Select at least one event.', true);
        return;
    }

    els.submit.disabled = true;
    els.submit.textContent = 'Registering...';
    clearStatus();

    try {
        const total = selectedTotal();
        const notificationPreference = els.notificationPreference.value || 'both';
        const registrationVote = registrationVotePayload();
        const basePlayer = {
            name: els.fullName.value.trim(),
            email: els.email.value.trim(),
            phone: els.phone.value.trim(),
            gender: els.matchmakerGender?.value || ''
        };
        const result = state.tournament?.matchmaker_enabled
            ? await callFunction('matchmakerRegister', state.matchmakerType === 'team'
                ? {
                    tournament_id: tournamentId,
                    registration_type: 'team',
                    team_name: els.matchmakerTeamName.value.trim(),
                    player1: basePlayer,
                    player2: {
                        name: els.partnerName.value.trim(),
                        email: els.partnerEmail.value.trim(),
                        phone: els.partnerPhone.value.trim(),
                        gender: els.partnerGender.value
                    },
                    notification_preference: notificationPreference,
                    registration_vote: registrationVote,
                    sms_opt_in: notificationPreference === 'sms' || notificationPreference === 'both',
                    payment_method: total > 0 ? els.payment.value : 'free',
                    total_amount: total
                }
                : {
                    tournament_id: tournamentId,
                    registration_type: 'single',
                    player: basePlayer,
                    notification_preference: notificationPreference,
                    registration_vote: registrationVote,
                    sms_opt_in: notificationPreference === 'sms' || notificationPreference === 'both',
                    payment_method: total > 0 ? els.payment.value : 'free',
                    total_amount: total
                })
            : await callFunction('registerForTournament', {
                tournament_id: tournamentId,
                full_name: basePlayer.name,
                email: basePlayer.email,
                phone: basePlayer.phone,
                event_ids: [...state.selected],
                notification_preference: notificationPreference,
                registration_vote: registrationVote,
                sms_opt_in: notificationPreference === 'sms' || notificationPreference === 'both',
                payment_method: total > 0 ? els.payment.value : 'free',
                total_amount: total
            });
        if (!result?.success) throw new Error(result?.error || 'Registration failed');
        els.result.hidden = false;
        els.result.classList.remove('error');
        els.result.innerHTML = `Registration saved. <a href="/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(tournamentId)}">Back to tournament</a>`;
        if (typeof window.toastSuccess === 'function') window.toastSuccess('Registration saved');
    } catch (error) {
        setStatus(error.message || 'Registration failed.', true);
        if (typeof window.toastError === 'function') window.toastError(error.message || 'Registration failed');
    } finally {
        els.submit.disabled = false;
        els.submit.textContent = 'Register';
        updateSubmitState();
    }
});
