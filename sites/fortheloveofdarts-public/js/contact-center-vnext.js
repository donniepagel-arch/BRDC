import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    callFunction
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const TRIPLES_LEAGUE_ID = 'rookies-demo-2026-triples';
const params = new URLSearchParams(window.location.search);
const WING_EVENT_IDS = [
    'rookies-wing-it-wednesdays-2026-06-03',
    'rookies-wing-it-wednesdays-2026-05-27'
];

const els = {
    status: document.getElementById('contactCenterStatus'),
    app: document.getElementById('contactCenterApp'),
    audienceOptions: document.getElementById('audienceOptions'),
    recipientSearch: document.getElementById('recipientSearch'),
    recipientList: document.getElementById('recipientList'),
    audAllCount: document.getElementById('audAllCount'),
    audLeagueCount: document.getElementById('audLeagueCount'),
    audEventCount: document.getElementById('audEventCount'),
    audCaptainCount: document.getElementById('audCaptainCount'),
    audCustomCount: document.getElementById('audCustomCount'),
    siteCoverage: document.getElementById('siteCoverage'),
    smsCoverage: document.getElementById('smsCoverage'),
    emailCoverage: document.getElementById('emailCoverage'),
    riskNote: document.getElementById('riskNote'),
    subject: document.getElementById('messageSubject'),
    body: document.getElementById('messageBody'),
    messageCount: document.getElementById('messageCount'),
    smsSegments: document.getElementById('smsSegments'),
    selectedCount: document.getElementById('selectedCount'),
    textReadyCount: document.getElementById('textReadyCount'),
    emailReadyCount: document.getElementById('emailReadyCount'),
    siteReadyCount: document.getElementById('siteReadyCount'),
    previewSubject: document.getElementById('previewSubject'),
    previewBody: document.getElementById('previewBody'),
    previewChannels: document.getElementById('previewChannels'),
    recipientPreview: document.getElementById('recipientPreview'),
    saveDraftBtn: document.getElementById('saveDraftBtn'),
    copyDraftBtn: document.getElementById('copyDraftBtn'),
    sendBtn: document.getElementById('sendBtn'),
    contactStatus: document.getElementById('contactStatus')
};

const state = {
    contacts: new Map(),
    audience: params.get('audience') || 'all',
    selectedCustomIds: new Set(),
    channels: new Set(['site', 'sms', 'email']),
    search: ''
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '');
}

function hasUsablePhone(contact) {
    return cleanPhone(contact.phone).length >= 7;
}

function hasUsableEmail(contact) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email || '').trim());
}

function contactKey(seed = {}) {
    if (seed.playerId) return `player:${seed.playerId}`;
    const email = String(seed.email || '').trim().toLowerCase();
    if (email) return `email:${email}`;
    const phone = cleanPhone(seed.phone);
    if (phone) return `phone:${phone}`;
    return `contact:${seed.id || seed.name || Math.random().toString(36).slice(2)}`;
}

function mergeContact(seed) {
    const key = contactKey(seed);
    const existing = state.contacts.get(key) || {
        id: key,
        playerId: seed.playerId || '',
        name: '',
        email: '',
        phone: '',
        teamName: '',
        tags: new Set(),
        labels: new Set(),
        isCaptain: false,
        sourceIds: new Set()
    };

    existing.playerId = existing.playerId || seed.playerId || '';
    existing.name = existing.name || seed.name || seed.full_name || seed.player_name || seed.email || 'Unknown';
    existing.email = existing.email || seed.email || '';
    existing.phone = existing.phone || seed.phone || '';
    existing.teamName = existing.teamName || seed.teamName || '';
    existing.isCaptain = existing.isCaptain || seed.isCaptain || false;
    (seed.tags || []).forEach(tag => existing.tags.add(tag));
    (seed.labels || []).forEach(label => existing.labels.add(label));
    (seed.sourceIds || []).forEach(id => existing.sourceIds.add(id));
    if (existing.isCaptain) existing.tags.add('captains');

    state.contacts.set(key, existing);
}

function normalizeContact(contact) {
    return {
        ...contact,
        tags: [...contact.tags],
        labels: [...contact.labels],
        sourceIds: [...contact.sourceIds]
    };
}

async function getGlobalPlayers(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const pairs = await Promise.all(unique.map(async id => {
        const snap = await getDoc(doc(db, 'players', id)).catch(() => null);
        return [id, snap?.exists?.() ? snap.data() : {}];
    }));
    return Object.fromEntries(pairs);
}

async function loadLeagueContacts() {
    const [playersSnap, teamsSnap] = await Promise.all([
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'players')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leagues', TRIPLES_LEAGUE_ID, 'teams')).catch(() => ({ docs: [] }))
    ]);
    const teamsById = {};
    const captainIds = new Set();
    teamsSnap.docs.forEach(teamDoc => {
        const team = { id: teamDoc.id, ...teamDoc.data() };
        teamsById[team.id] = team;
        if (team.captain_id) captainIds.add(team.captain_id);
    });

    const leaguePlayers = playersSnap.docs.map(playerDoc => ({ id: playerDoc.id, ...playerDoc.data() }));
    const globalsById = await getGlobalPlayers(leaguePlayers.map(player => player.id));

    leaguePlayers.forEach(player => {
        const global = globalsById[player.id] || {};
        const team = teamsById[player.team_id] || {};
        mergeContact({
            playerId: player.id,
            name: player.name || global.name || global.full_name,
            email: player.email || global.email,
            phone: player.phone || global.phone,
            teamName: team.name || player.team_name || '',
            isCaptain: player.is_captain === true || captainIds.has(player.id),
            tags: ['all', 'league'],
            labels: [team.name || 'Triples League'],
            sourceIds: [TRIPLES_LEAGUE_ID]
        });
    });
}

async function loadEventContacts() {
    const tournaments = await Promise.all(WING_EVENT_IDS.map(async id => {
        const [eventSnap, regsSnap, playersSnap] = await Promise.all([
            getDoc(doc(db, 'tournaments', id)).catch(() => null),
            getDocs(collection(db, 'tournaments', id, 'registrations')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'tournaments', id, 'players')).catch(() => ({ docs: [] }))
        ]);
        const event = eventSnap?.exists?.() ? { id, ...eventSnap.data() } : { id, tournament_name: 'Wing It Wednesdays' };
        return {
            event,
            contacts: [
                ...regsSnap.docs.map(regDoc => ({ id: regDoc.id, ...regDoc.data() })),
                ...playersSnap.docs.map(playerDoc => ({ id: playerDoc.id, ...playerDoc.data() }))
            ]
        };
    }));

    tournaments.forEach(({ event, contacts }) => {
        const eventName = event.name || event.tournament_name || 'Wing It Wednesdays';
        contacts.forEach(item => {
            const playerId = item.player_id || item.playerId || item.global_player_id || '';
            mergeContact({
                id: item.id,
                playerId,
                name: item.name || item.full_name || item.player_name || item.team_name,
                email: item.email,
                phone: item.phone,
                tags: ['all', 'events'],
                labels: [eventName],
                sourceIds: [event.id]
            });
        });
    });
}

function contacts() {
    return [...state.contacts.values()].map(normalizeContact).sort((a, b) => a.name.localeCompare(b.name));
}

function selectedContacts() {
    let list = contacts();
    if (state.audience !== 'all') {
        if (state.audience === 'custom') {
            list = list.filter(contact => state.selectedCustomIds.has(contact.id));
        } else {
            list = list.filter(contact => contact.tags.includes(state.audience));
        }
    }
    return list;
}

function searchedContacts(list) {
    const q = state.search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(contact => {
        return [
            contact.name,
            contact.email,
            contact.phone,
            contact.teamName,
            ...(contact.labels || [])
        ].join(' ').toLowerCase().includes(q);
    });
}

function renderCounts() {
    const all = contacts();
    els.audAllCount.textContent = String(all.length);
    els.audLeagueCount.textContent = String(all.filter(contact => contact.tags.includes('league')).length);
    els.audEventCount.textContent = String(all.filter(contact => contact.tags.includes('events')).length);
    els.audCaptainCount.textContent = String(all.filter(contact => contact.tags.includes('captains')).length);
    els.audCustomCount.textContent = String(state.selectedCustomIds.size);
}

function contactBadges(contact) {
    const badges = [];
    if (contact.tags.includes('league')) badges.push('League');
    if (contact.tags.includes('events')) badges.push('Event');
    if (contact.tags.includes('captains')) badges.push('Captain');
    return badges.map(label => `<span>${escapeHtml(label)}</span>`).join('');
}

function renderRecipients() {
    const list = searchedContacts(contacts());
    if (!list.length) {
        els.recipientList.innerHTML = '<div class="ves-empty">No matching contacts.</div>';
        return;
    }
    els.recipientList.innerHTML = list.map(contact => {
        const checked = state.audience !== 'custom'
            ? selectedContacts().some(item => item.id === contact.id)
            : state.selectedCustomIds.has(contact.id);
        const disabled = state.audience !== 'custom';
        return `
            <label class="contact-recipient-row">
                <input type="checkbox" data-recipient-id="${escapeHtml(contact.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                <span>
                    <strong>${escapeHtml(contact.name)}</strong>
                    <em>${escapeHtml([contact.teamName, contact.email || 'No email', contact.phone || 'No phone'].filter(Boolean).join(' - '))}</em>
                </span>
                <span class="contact-badges">${contactBadges(contact)}</span>
            </label>
        `;
    }).join('');
}

function activeChannels() {
    return [...state.channels];
}

function smsSegments(length) {
    if (!length) return 0;
    return length <= 160 ? 1 : Math.ceil(length / 153);
}

function setStatus(message, type = '') {
    els.contactStatus.textContent = message;
    els.contactStatus.className = `ves-form-status ${type}`.trim();
    els.contactStatus.hidden = !message;
}

function renderReview() {
    const selected = selectedContacts();
    const smsReady = selected.filter(hasUsablePhone);
    const emailReady = selected.filter(hasUsableEmail);
    const siteReady = selected.filter(contact => contact.playerId);
    const subject = els.subject.value.trim();
    const body = els.body.value.trim();
    const segments = smsSegments(body.length);
    const channels = activeChannels();

    els.selectedCount.textContent = String(selected.length);
    els.textReadyCount.textContent = String(smsReady.length);
    els.emailReadyCount.textContent = String(emailReady.length);
    els.siteReadyCount.textContent = String(siteReady.length);
    els.siteCoverage.textContent = `${siteReady.length} ready, ${selected.length - siteReady.length} missing account`;
    els.smsCoverage.textContent = `${smsReady.length} ready, ${selected.length - smsReady.length} missing phone`;
    els.emailCoverage.textContent = `${emailReady.length} ready, ${selected.length - emailReady.length} missing email`;
    els.messageCount.textContent = `${body.length} characters`;
    els.smsSegments.textContent = `${segments} SMS segment${segments === 1 ? '' : 's'}`;
    els.previewSubject.textContent = subject || 'No subject yet';
    els.previewBody.textContent = body || 'Write a message to preview it here.';
    els.previewChannels.textContent = channels.length ? channels.map(channel => {
        if (channel === 'sms') return 'Text';
        if (channel === 'email') return 'Email';
        return 'Site';
    }).join(' + ') : 'No channels';

    els.recipientPreview.innerHTML = selected.slice(0, 8).map(contact => `
        <div>
            <strong>${escapeHtml(contact.name)}</strong>
            <span>${escapeHtml([
                channels.includes('sms') && hasUsablePhone(contact) ? 'Text' : '',
                channels.includes('email') && hasUsableEmail(contact) ? 'Email' : '',
                channels.includes('site') && contact.playerId ? 'Site' : ''
            ].filter(Boolean).join(' / ') || 'No selected channel ready')}</span>
        </div>
    `).join('') || '<div class="ves-empty">No recipients selected.</div>';

    const hiddenCount = selected.length - 8;
    if (hiddenCount > 0) {
        els.recipientPreview.insertAdjacentHTML('beforeend', `<div><strong>+${hiddenCount} more</strong><span>Shown after review export</span></div>`);
    }

    els.riskNote.textContent = selected.length
        ? `Review: ${selected.length} recipients, ${channels.join(' + ') || 'no'} channels selected. Send creates a logged broadcast and requires confirmation.`
        : 'Select at least one recipient before drafting a message.';
    const canSend = selected.length > 0 && body.length > 0 && channels.length > 0;
    els.sendBtn.disabled = !canSend;
    els.sendBtn.textContent = canSend ? 'Send' : 'Send locked';
}

function renderAll() {
    document.querySelectorAll('[data-audience]').forEach(button => {
        button.classList.toggle('active', button.dataset.audience === state.audience);
    });
    renderCounts();
    renderRecipients();
    renderReview();
}

function draftPayload() {
    return {
        created_at: new Date().toISOString(),
        audience: state.audience,
        channels: activeChannels(),
        subject: els.subject.value.trim(),
        body: els.body.value.trim(),
        recipients: selectedContacts().map(contact => ({
            id: contact.id,
            player_id: contact.playerId || null,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            tags: contact.tags
        }))
    };
}

function saveDraft() {
    const draft = draftPayload();
    localStorage.setItem('rookies_contact_center_draft', JSON.stringify(draft));
    setStatus(`Draft saved with ${draft.recipients.length} recipients.`, 'success');
}

async function copyDraft() {
    const draft = draftPayload();
    const text = [
        draft.subject,
        '',
        draft.body,
        '',
        `Recipients: ${draft.recipients.length}`,
        `Channels: ${draft.channels.join(', ') || 'none'}`
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setStatus('Message copied to clipboard.', 'success');
}

function channelSummaryLine(summary = {}) {
    return Object.entries(summary.channels || {}).map(([channel, counts]) => {
        const parts = [
            counts.sent ? `${counts.sent} sent` : '',
            counts.skipped ? `${counts.skipped} skipped` : '',
            counts.failed ? `${counts.failed} failed` : ''
        ].filter(Boolean).join(', ') || 'no deliveries';
        return `${channel}: ${parts}`;
    }).join(' | ');
}

async function sendBroadcast() {
    const draft = draftPayload();
    if (!draft.body) {
        setStatus('Write a message before sending.', 'error');
        return;
    }
    if (!draft.channels.length) {
        setStatus('Choose at least one channel before sending.', 'error');
        return;
    }
    if (!draft.recipients.length) {
        setStatus('Choose at least one recipient before sending.', 'error');
        return;
    }

    const ok = window.confirm(`Send this broadcast to ${draft.recipients.length} recipient${draft.recipients.length === 1 ? '' : 's'} via ${draft.channels.join(', ')}? This will create a logged broadcast and delivery records.`);
    if (!ok) return;

    els.sendBtn.disabled = true;
    els.sendBtn.textContent = 'Sending...';
    setStatus('Sending broadcast...', '');

    try {
        const result = await callFunction('sendDirectorBroadcast', {
            tenant_id: 'rookies',
            audience: draft.audience,
            channels: draft.channels,
            subject: draft.subject,
            body: draft.body,
            recipients: draft.recipients,
            require_live_send: true,
            dry_run: false
        });
        if (!result?.success) throw new Error(result?.error || 'Broadcast failed.');
        const line = channelSummaryLine(result.summary);
        setStatus(`Broadcast sent. ID: ${result.broadcast_id}. ${line}`, 'success');
    } catch (error) {
        setStatus(error.message || 'Broadcast failed.', 'error');
    } finally {
        renderReview();
    }
}

function wireEvents() {
    els.audienceOptions.addEventListener('click', event => {
        const button = event.target.closest('[data-audience]');
        if (!button) return;
        state.audience = button.dataset.audience;
        renderAll();
    });

    els.recipientSearch.addEventListener('input', () => {
        state.search = els.recipientSearch.value;
        renderRecipients();
    });

    els.recipientList.addEventListener('change', event => {
        const input = event.target.closest('[data-recipient-id]');
        if (!input) return;
        if (input.checked) state.selectedCustomIds.add(input.dataset.recipientId);
        else state.selectedCustomIds.delete(input.dataset.recipientId);
        state.audience = 'custom';
        renderAll();
    });

    document.querySelectorAll('.contact-channel-list input').forEach(input => {
        input.addEventListener('change', () => {
            if (input.checked) state.channels.add(input.value);
            else state.channels.delete(input.value);
            renderReview();
        });
    });

    document.querySelectorAll('[data-template]').forEach(button => {
        button.addEventListener('click', () => {
            const templates = {
                night: ['Rookies darts tonight', 'Rookies darts tonight: check the hub for your match, board, and event updates. Reply in the site chat if you have a question.'],
                checkin: ['Check in for Rookies darts', 'Please check in when you arrive so the director can keep boards moving and update the bracket.'],
                schedule: ['Rookies schedule update', 'The schedule has been updated in the Rookies darts hub. Please review your next match or event before arriving.']
            };
            const [subject, body] = templates[button.dataset.template] || ['', ''];
            els.subject.value = subject;
            els.body.value = body;
            renderReview();
        });
    });

    els.subject.addEventListener('input', renderReview);
    els.body.addEventListener('input', renderReview);
    els.saveDraftBtn.addEventListener('click', saveDraft);
    els.copyDraftBtn.addEventListener('click', () => copyDraft().catch(error => setStatus(error.message || 'Copy failed.', 'error')));
    els.sendBtn.addEventListener('click', () => sendBroadcast());
}

async function load() {
    await Promise.all([
        loadLeagueContacts(),
        loadEventContacts()
    ]);
}

async function init() {
    wireEvents();
    const director = await requireDirectorLogin({
        gatedElements: [els.app],
        statusEl: els.status,
        title: 'Rookies Director Login',
        copy: 'Use Brian or another director account to contact Rookies players and event registrants.',
        readyText: 'Staff mode'
    });
    if (!director) return;
    els.recipientList.innerHTML = '<div class="ves-skeleton"></div>';
    await load();
    renderAll();
}

init().catch(error => {
    console.error('[contact-center-vnext] failed:', error);
    els.status.textContent = 'Contact center unavailable';
    els.app.hidden = false;
    els.app.innerHTML = `<div class="ves-panel"><div class="ves-empty">${escapeHtml(error.message || 'Could not load contact center')}</div></div>`;
});
