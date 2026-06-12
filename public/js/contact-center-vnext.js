import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    callFunction
} from '/js/firebase-config.js';
import { requireDirectorLogin } from '/js/tournament-director-auth-vnext.js?v=3';

const params = new URLSearchParams(window.location.search);

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
    contactStatus: document.getElementById('contactStatus'),
    dryRunToggle: document.getElementById('dryRunToggle'),
    dryRunInput: document.getElementById('dryRunInput'),
    dryRunTitle: document.getElementById('dryRunTitle'),
    dryRunHint: document.getElementById('dryRunHint'),
    sendReport: document.getElementById('sendReport'),
    sendReportBadge: document.getElementById('sendReportBadge'),
    sendReportTitle: document.getElementById('sendReportTitle'),
    sendReportMeta: document.getElementById('sendReportMeta'),
    sendReportChips: document.getElementById('sendReportChips'),
    sendReportRows: document.getElementById('sendReportRows'),
    historyList: document.getElementById('historyList'),
    historyRefreshBtn: document.getElementById('historyRefreshBtn'),
    historyDetailPanel: document.getElementById('historyDetailPanel'),
    detailTitle: document.getElementById('detailTitle'),
    detailMeta: document.getElementById('detailMeta'),
    detailSubject: document.getElementById('detailSubject'),
    detailBody: document.getElementById('detailBody'),
    detailRows: document.getElementById('detailRows'),
    detailResendBtn: document.getElementById('detailResendBtn'),
    detailDuplicateBtn: document.getElementById('detailDuplicateBtn'),
    detailCloseBtn: document.getElementById('detailCloseBtn')
};

const state = {
    contacts: new Map(),
    audience: params.get('audience') || 'all',
    selectedCustomIds: new Set(),
    channels: new Set(['site', 'sms', 'email']),
    search: '',
    dryRun: true,
    history: [],
    detail: null
};

const CHANNEL_ORDER = ['site', 'sms', 'email'];

const AUDIENCE_LABELS = {
    all: 'All contacts',
    league: 'League players',
    events: 'Event registrants',
    captains: 'Captains',
    custom: 'Custom'
};

const REASON_LABELS = {
    missing_player_id: 'no site account',
    sender_is_recipient: 'sender',
    player_not_found: 'player record missing',
    invalid_or_missing_phone: 'no usable phone',
    reserved_demo_phone: 'demo phone',
    invalid_or_missing_email: 'no usable email',
    demo_email_domain: 'demo email'
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
    return key;
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
    // Discover all leagues dynamically — no hardcoded IDs
    const leaguesSnap = await getDocs(collection(db, 'leagues')).catch(() => ({ docs: [] }));

    await Promise.all(leaguesSnap.docs.map(async leagueDoc => {
        const leagueId = leagueDoc.id;
        const leagueData = leagueDoc.data();
        const leagueName = leagueData.name || leagueData.league_name || leagueId;

        const [playersSnap, teamsSnap] = await Promise.all([
            getDocs(collection(db, 'leagues', leagueId, 'players')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'leagues', leagueId, 'teams')).catch(() => ({ docs: [] }))
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
                labels: [leagueName],
                sourceIds: [leagueId]
            });
        });
    }));
}

async function loadEventContacts() {
    // Discover all tournaments dynamically — no hardcoded IDs
    const tournamentsSnap = await getDocs(collection(db, 'tournaments')).catch(() => ({ docs: [] }));

    await Promise.all(tournamentsSnap.docs.map(async tournamentDoc => {
        const eventId = tournamentDoc.id;
        const eventData = tournamentDoc.data();
        const eventName = eventData.name || eventData.tournament_name || eventId;

        const [regsSnap, playersSnap] = await Promise.all([
            getDocs(collection(db, 'tournaments', eventId, 'registrations')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'tournaments', eventId, 'players')).catch(() => ({ docs: [] }))
        ]);

        const contacts = [
            ...regsSnap.docs.map(regDoc => ({ id: regDoc.id, ...regDoc.data() })),
            ...playersSnap.docs.map(playerDoc => ({ id: playerDoc.id, ...playerDoc.data() }))
        ];

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
                sourceIds: [eventId]
            });
        });
    }));
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

    els.riskNote.textContent = !selected.length
        ? 'Select at least one recipient before drafting a message.'
        : state.dryRun
            ? `Dry run is ON: ${selected.length} recipients, ${channels.join(' + ') || 'no'} channels. Nothing is sent — you get a full simulated delivery report, logged to history.`
            : `LIVE SEND ARMED: ${selected.length} recipients, ${channels.join(' + ') || 'no'} channels. Real texts, emails, and site messages go out when you press send.`;
    const canSend = selected.length > 0 && body.length > 0 && channels.length > 0;
    els.sendBtn.disabled = !canSend;
    els.sendBtn.textContent = canSend ? (state.dryRun ? 'Run dry run' : 'Send live') : 'Send locked';
}

function updateDryRunUi() {
    els.dryRunToggle.classList.toggle('is-on', state.dryRun);
    els.dryRunTitle.textContent = state.dryRun ? 'Dry run (no sends)' : 'Live send armed';
    els.dryRunHint.textContent = state.dryRun
        ? 'Resolves the audience and every channel check, logs history — sends nothing.'
        : 'Real messages will be delivered. Switch back on to simulate safely.';
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
    localStorage.setItem('brdc_contact_center_draft', JSON.stringify(draft));
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

function channelLabel(channel) {
    if (channel === 'sms') return 'Text';
    if (channel === 'email') return 'Email';
    return 'Site';
}

function statusClass(status) {
    if (status === 'sent' || status === 'simulated') return 'sent';
    if (status === 'preview') return 'preview';
    if (status === 'failed') return 'failed';
    return 'skipped';
}

function statusLabel(status) {
    if (status === 'preview') return 'would send';
    return status || 'queued';
}

function deliveryChip(channel, result = {}) {
    const status = result.status || 'queued';
    const reason = REASON_LABELS[result.reason] || result.reason || result.error || '';
    return `<span class="contact-status-chip ${statusClass(status)}">${channelLabel(channel)}: ${escapeHtml(statusLabel(status))}${reason ? ` <small>(${escapeHtml(reason)})</small>` : ''}</span>`;
}

function orderedChannels(channels = {}) {
    return CHANNEL_ORDER.filter(channel => channels[channel]).map(channel => [channel, channels[channel]]);
}

function deliveryRowHtml(row) {
    const recipient = row.recipient || {};
    const contactLine = [recipient.email, recipient.phone].filter(Boolean).join(' - ');
    const chips = orderedChannels(row.channels).map(([channel, result]) => deliveryChip(channel, result)).join('');
    return `
        <div class="contact-delivery-row">
            <span>
                <strong>${escapeHtml(recipient.name || 'Unknown')}</strong>
                <em>${escapeHtml(contactLine || 'No contact info')}</em>
            </span>
            <span class="contact-delivery-chips">${chips || '<span class="contact-status-chip skipped">No channels</span>'}</span>
        </div>
    `;
}

function aggregateSummary(summary) {
    const totals = { sent: 0, preview: 0, skipped: 0, failed: 0 };
    Object.values(summary?.channels || {}).forEach(counts => {
        totals.sent += counts.sent || 0;
        totals.preview += counts.preview || 0;
        totals.skipped += counts.skipped || 0;
        totals.failed += counts.failed || 0;
    });
    return totals;
}

function summaryChipsHtml(summary, dryRun) {
    return Object.entries(summary?.channels || {}).map(([channel, counts]) => {
        const parts = [
            counts.sent ? `<b>${counts.sent}</b> sent` : '',
            counts.preview ? `<b>${counts.preview}</b> ${dryRun ? 'would send' : 'preview'}` : '',
            counts.skipped ? `<b>${counts.skipped}</b> skipped` : '',
            counts.failed ? `<b>${counts.failed}</b> failed` : ''
        ].filter(Boolean).join(', ');
        return `<span>${channelLabel(channel)}: ${parts || '<b>0</b> deliveries'}</span>`;
    }).join('');
}

function formatDateParts(iso) {
    if (!iso) return { date: 'Pending', time: '' };
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return { date: 'Unknown', time: '' };
    return {
        date: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        time: parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    };
}

function renderSendReport(result) {
    const dryRun = result.dry_run === true;
    els.sendReportBadge.textContent = dryRun ? 'DRY RUN' : 'LIVE';
    els.sendReportBadge.className = `contact-flag ${dryRun ? 'dry' : 'live'}`;
    els.sendReportTitle.textContent = dryRun ? 'Simulation complete — nothing was sent' : 'Broadcast delivered';
    els.sendReportMeta.textContent = `Broadcast ${result.broadcast_id || '-'}`;
    els.sendReportChips.innerHTML = summaryChipsHtml(result.summary, dryRun);
    els.sendReportRows.innerHTML = (result.deliveries || []).map(deliveryRowHtml).join('')
        || '<div class="ves-empty">No per-recipient results returned.</div>';
    els.sendReport.hidden = false;
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

    const dryRun = state.dryRun;
    if (!dryRun) {
        const ok = window.confirm(`LIVE SEND to ${draft.recipients.length} recipient${draft.recipients.length === 1 ? '' : 's'} via ${draft.channels.join(', ')}?\n\nReal texts, emails, and site messages WILL be delivered. Switch "Dry run" back on to simulate instead.`);
        if (!ok) return;
    }

    els.sendBtn.disabled = true;
    els.sendBtn.textContent = dryRun ? 'Simulating...' : 'Sending...';
    setStatus(dryRun ? 'Running dry run (no sends)...' : 'Sending broadcast...', '');
    els.sendReport.hidden = true;

    try {
        const result = await callFunction('sendDirectorBroadcast', {
            tenant_id: 'brdc',
            audience: draft.audience,
            channels: draft.channels,
            subject: draft.subject,
            body: draft.body,
            recipients: draft.recipients,
            require_live_send: !dryRun,
            dry_run: dryRun
        });
        if (!result?.success) throw new Error(result?.error || 'Broadcast failed.');
        const line = channelSummaryLine(result.summary);
        setStatus(dryRun
            ? `Dry run complete — nothing was sent. Logged as ${result.broadcast_id}. Review the report, then switch off dry run to send for real.`
            : `Broadcast sent. ID: ${result.broadcast_id}. ${line}`, 'success');
        renderSendReport(result);
        loadHistory().catch(() => {});
    } catch (error) {
        setStatus(error.message || 'Broadcast failed.', 'error');
    } finally {
        renderReview();
    }
}

function historyRowHtml(item) {
    const when = formatDateParts(item.created_at);
    const totals = aggregateSummary(item.summary);
    const breakdown = [
        totals.sent ? `<span class="contact-status-chip sent">${totals.sent} sent</span>` : '',
        totals.preview ? `<span class="contact-status-chip preview">${totals.preview} would send</span>` : '',
        totals.skipped ? `<span class="contact-status-chip skipped">${totals.skipped} skipped</span>` : '',
        totals.failed ? `<span class="contact-status-chip failed">${totals.failed} failed</span>` : ''
    ].filter(Boolean).join('') || `<span class="contact-status-chip skipped">${escapeHtml(item.status || 'unknown')}</span>`;
    const channels = (item.channels || []).map(channelLabel).join(' + ') || 'No channels';
    const audience = AUDIENCE_LABELS[item.audience] || item.audience || 'Custom';
    return `
        <button type="button" class="contact-history-row${state.detail?.broadcast?.id === item.id ? ' active' : ''}" data-broadcast-id="${escapeHtml(item.id)}">
            <span class="contact-history-date">${escapeHtml(when.date)}<em>${escapeHtml(when.time)}</em></span>
            <span class="contact-flag ${item.dry_run ? 'dry' : 'live'}">${item.dry_run ? 'DRY RUN' : 'LIVE'}</span>
            <span class="contact-history-subject">
                <strong>${escapeHtml(item.subject || '(no subject)')}</strong>
                <em>${escapeHtml(`${audience} - ${channels}`)}</em>
            </span>
            <span class="contact-history-count">${item.recipient_count || 0}</span>
            <span class="contact-history-breakdown">${breakdown}</span>
        </button>
    `;
}

function renderHistory() {
    if (!state.history.length) {
        els.historyList.innerHTML = '<div class="ves-empty">No broadcasts yet. Dry runs land here too.</div>';
        return;
    }
    els.historyList.innerHTML = state.history.map(historyRowHtml).join('');
}

async function loadHistory() {
    els.historyList.innerHTML = '<div class="ves-skeleton"></div>';
    try {
        const result = await callFunction('getDirectorBroadcasts', { tenant_id: 'brdc', limit: 30 });
        if (!result?.success) throw new Error(result?.error || 'Could not load history.');
        state.history = result.broadcasts || [];
        renderHistory();
    } catch (error) {
        els.historyList.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load broadcast history.')}</div>`;
    }
}

function failedDeliveries(detail) {
    return (detail?.deliveries || []).filter(row =>
        Object.values(row.channels || {}).some(result => result?.status === 'failed'));
}

function renderDetail() {
    const detail = state.detail;
    if (!detail) return;
    const broadcast = detail.broadcast || {};
    const when = formatDateParts(broadcast.created_at);
    const channels = (broadcast.channels || []).map(channelLabel).join(' + ') || 'No channels';
    const audience = AUDIENCE_LABELS[broadcast.audience] || broadcast.audience || 'Custom';

    els.detailTitle.textContent = `${when.date} ${when.time}`.trim();
    els.detailMeta.innerHTML = `
        <span class="contact-flag ${broadcast.dry_run ? 'dry' : 'live'}">${broadcast.dry_run ? 'DRY RUN' : 'LIVE'}</span>
        ${escapeHtml(` ${audience} - ${channels} - ${broadcast.recipient_count || 0} recipients - ${broadcast.sender_name || 'Unknown sender'} - ${broadcast.status || ''}`)}
    `;
    els.detailSubject.textContent = broadcast.subject || '(no subject)';
    els.detailBody.textContent = broadcast.body || '';
    els.detailRows.innerHTML = (detail.deliveries || []).map(deliveryRowHtml).join('')
        || '<div class="ves-empty">No delivery records for this broadcast.</div>';

    const failed = failedDeliveries(detail);
    els.detailResendBtn.hidden = !failed.length;
    els.detailResendBtn.textContent = `Resend failed (${failed.length})`;
    els.detailDuplicateBtn.hidden = false;
    els.historyDetailPanel.hidden = false;
    renderHistory();
}

async function openDetail(broadcastId) {
    els.historyDetailPanel.hidden = false;
    els.detailRows.innerHTML = '<div class="ves-skeleton"></div>';
    els.detailResendBtn.hidden = true;
    els.detailDuplicateBtn.hidden = true;
    try {
        const result = await callFunction('getDirectorBroadcastDetail', { broadcast_id: broadcastId });
        if (!result?.success) throw new Error(result?.error || 'Could not load broadcast detail.');
        state.detail = result;
        renderDetail();
        els.historyDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        els.detailRows.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load broadcast detail.')}</div>`;
    }
}

function closeDetail() {
    state.detail = null;
    els.historyDetailPanel.hidden = true;
    renderHistory();
}

function syncChannelInputs() {
    document.querySelectorAll('.contact-channel-list input').forEach(input => {
        input.checked = state.channels.has(input.value);
    });
}

function loadIntoCompose(detail, { onlyFailed }) {
    const broadcast = detail?.broadcast || {};
    const rows = onlyFailed ? failedDeliveries(detail) : (detail?.deliveries || []);
    if (!rows.length) {
        setStatus(onlyFailed ? 'No failed recipients on this broadcast.' : 'No recipients on this broadcast.', 'error');
        return;
    }

    const keys = rows.map(row => {
        const recipient = row.recipient || {};
        return mergeContact({
            playerId: recipient.player_id || '',
            name: recipient.name || 'Unknown',
            email: recipient.email || '',
            phone: recipient.phone || '',
            tags: recipient.tags || []
        });
    });

    state.selectedCustomIds = new Set(keys);
    state.audience = 'custom';
    state.channels = new Set((broadcast.channels || []).filter(channel => ['site', 'sms', 'email'].includes(channel)));
    if (!state.channels.size) state.channels = new Set(['site', 'sms', 'email']);
    els.subject.value = broadcast.subject || '';
    els.body.value = broadcast.body || '';

    // Safety: anything loaded from history re-arms as a dry run first.
    state.dryRun = true;
    els.dryRunInput.checked = true;
    updateDryRunUi();
    syncChannelInputs();
    renderAll();
    setStatus(onlyFailed
        ? `Loaded ${rows.length} failed recipient${rows.length === 1 ? '' : 's'} into compose. Dry run is back ON — simulate, then send live.`
        : `Duplicated broadcast into compose with ${rows.length} recipient${rows.length === 1 ? '' : 's'}. Dry run is back ON.`, 'success');
    document.querySelector('.contact-compose-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    els.recipientList.addEventListener('change', changeEvent => {
        const input = changeEvent.target.closest('[data-recipient-id]');
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
                tonight: ['BRDC darts tonight', 'BRDC darts tonight: check the hub for your match, board, and event updates. Reply in the site chat if you have a question.'],
                checkin: ['Check in for BRDC darts', 'Please check in when you arrive so the director can keep boards moving and update the bracket.'],
                schedule: ['BRDC schedule update', 'The schedule has been updated in the BRDC darts hub. Please review your next match or event before arriving.']
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

    els.dryRunInput.addEventListener('change', () => {
        state.dryRun = els.dryRunInput.checked;
        updateDryRunUi();
        renderReview();
    });

    els.historyRefreshBtn.addEventListener('click', () => loadHistory());
    els.historyList.addEventListener('click', clickEvent => {
        const row = clickEvent.target.closest('[data-broadcast-id]');
        if (!row) return;
        openDetail(row.dataset.broadcastId);
    });
    els.detailCloseBtn.addEventListener('click', closeDetail);
    els.detailResendBtn.addEventListener('click', () => loadIntoCompose(state.detail, { onlyFailed: true }));
    els.detailDuplicateBtn.addEventListener('click', () => loadIntoCompose(state.detail, { onlyFailed: false }));
}

async function load() {
    await Promise.all([
        loadLeagueContacts(),
        loadEventContacts()
    ]);
}

async function init() {
    wireEvents();
    updateDryRunUi();
    const director = await requireDirectorLogin({
        gatedElements: [els.app],
        statusEl: els.status,
        title: 'BRDC Director Login',
        copy: 'Use a director or admin account to contact BRDC players and event registrants.',
        readyText: 'Director mode'
    });
    if (!director) return;
    els.recipientList.innerHTML = '<div class="ves-skeleton"></div>';
    loadHistory().catch(() => {});
    await load();
    renderAll();
}

init().catch(error => {
    console.error('[contact-center-vnext] failed:', error);
    els.status.textContent = 'Contact center unavailable';
    els.app.hidden = false;
    els.app.innerHTML = `<div class="ves-panel"><div class="ves-empty">${escapeHtml(error.message || 'Could not load contact center')}</div></div>`;
});
