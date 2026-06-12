import {
    db,
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    limit
} from '/js/firebase-config.js';

// Discover Wing It Wednesdays tournaments dynamically from Firestore.
// Primary: an explicit series tag (series_slug/series_id/event_series === 'wing-it-wednesdays')
// if the event builder sets one. Fallback (real BRDC data is not series-tagged): identify
// events by name / doc-id, since every week is named "Wing It Wednesdays #N". No hardcoded IDs.
const SERIES_FIELD_CANDIDATES = ['series_slug', 'series_id', 'event_series'];
const SERIES_VALUE = 'wing-it-wednesdays';
const WING_NAME_RE = /wing.?it.?wednesday/i;

function isWingItDoc(id, data) {
    if (SERIES_FIELD_CANDIDATES.some(f => (data || {})[f] === SERIES_VALUE)) return true;
    const name = (data || {}).name || (data || {}).tournament_name || '';
    return WING_NAME_RE.test(name) || WING_NAME_RE.test(String(id || ''));
}

const els = {
    status: document.getElementById('wingStatus'),
    weekCount: document.getElementById('wingWeekCount'),
    nextDate: document.getElementById('wingNextDate'),
    totalPlayers: document.getElementById('wingTotalPlayers'),
    select: document.getElementById('wingWeekSelect'),
    selectedRuntime: document.getElementById('wingSelectedRuntime'),
    list: document.getElementById('wingWeekList')
};

let weeks = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function asDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value._seconds) return new Date(value._seconds * 1000);
    if (value.seconds) return new Date(value.seconds * 1000);
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(week) {
    return week.date || week.tournament_date || week.start_date || week.created_at;
}

function shortDate(value) {
    const date = asDate(value);
    return date ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBD';
}

function longDate(value) {
    const date = asDate(value);
    return date ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD';
}

function weekLabel(week, index) {
    const date = shortDate(eventDate(week));
    return `${date} - ${week.status || week.registration_status || `Week ${index + 1}`}`;
}

function runtimeHref(id) {
    return `/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function viewHref(id) {
    return `/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function bracketHref(id) {
    return `/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(id)}`;
}

function registrationHref(id) {
    return `/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function render() {
    const next = weeks.find(week => {
        const status = String(week.status || week.registration_status || '').toLowerCase();
        return !status.includes('complete') && !status.includes('ended');
    }) || weeks[0];
    const totalRegs = weeks.reduce((sum, week) => sum + Number(week.registrationCount || 0), 0);

    els.status.textContent = weeks.length ? 'Choose a week' : 'No weeks found';
    els.weekCount.textContent = String(weeks.length);
    els.nextDate.textContent = next ? shortDate(eventDate(next)) : '-';
    els.totalPlayers.textContent = String(totalRegs);

    if (!weeks.length) {
        els.select.innerHTML = '<option value="">No Wing It Wednesday events found</option>';
        els.selectedRuntime.href = '#';
        els.list.innerHTML = '<div class="ves-empty">No Wing It Wednesday events found. Add a week to get started.</div>';
        return;
    }

    els.select.innerHTML = weeks.map((week, index) => `
        <option value="${escapeHtml(week.id)}">${escapeHtml(weekLabel(week, index))}</option>
    `).join('');
    if (next) els.select.value = next.id;
    setSelectedRuntime();

    els.list.innerHTML = weeks.map((week, index) => `
        <article class="wing-week-card">
            <div>
                <p class="ves-kicker">Week ${weeks.length - index}</p>
                <h2>${escapeHtml(week.name || week.tournament_name || 'Wing It Wednesdays')}</h2>
                <p>${escapeHtml(longDate(eventDate(week)))} - ${Number(week.registrationCount || 0)} registered - ${escapeHtml(week.status || week.registration_status || 'Event')}</p>
            </div>
            <div class="wing-week-actions">
                <a class="ves-action primary" href="${runtimeHref(week.id)}">Manage</a>
                <a class="ves-action" href="${viewHref(week.id)}">View</a>
                <a class="ves-action" href="${bracketHref(week.id)}">Bracket</a>
                <a class="ves-action" href="${registrationHref(week.id)}">Register</a>
            </div>
        </article>
    `).join('');
}

function setSelectedRuntime() {
    const id = els.select.value || weeks[0]?.id;
    els.selectedRuntime.href = id ? runtimeHref(id) : '#';
}

async function hydrateWeek(snap) {
    const data = snap.data() || {};
    const regsSnap = await getDocs(
        collection(db, 'tournaments', snap.id, 'registrations')
    ).catch(() => ({ docs: [] }));
    return {
        id: snap.id,
        ...data,
        registrationCount: regsSnap.docs.length
    };
}

async function loadSeriesWeeks() {
    // Primary: explicit series tag (clean data model, if/when the event builder sets one).
    for (const field of SERIES_FIELD_CANDIDATES) {
        const snap = await getDocs(
            query(collection(db, 'tournaments'), where(field, '==', SERIES_VALUE))
        ).catch(() => null);
        if (snap && !snap.empty) return snap.docs;
    }
    // Fallback: scan tournaments and match Wing It Wednesdays by name / id (real data isn't tagged).
    const all = await getDocs(
        query(collection(db, 'tournaments'), limit(300))
    ).catch(() => null);
    if (!all) return [];
    return all.docs.filter(d => isWingItDoc(d.id, d.data()));
}

async function load() {
    const docs = await loadSeriesWeeks();
    weeks = await Promise.all(docs.map(hydrateWeek));
    weeks.sort((a, b) => {
        const ad = asDate(eventDate(a));
        const bd = asDate(eventDate(b));
        if (ad && bd) return bd - ad;
        if (ad) return -1;
        if (bd) return 1;
        return String(a.id).localeCompare(String(b.id));
    });
}

els.select?.addEventListener('change', setSelectedRuntime);

load().then(render).catch(error => {
    console.error('[wing-it-wednesdays-vnext] failed:', error);
    els.status.textContent = 'Wing It Wednesdays unavailable';
    els.list.innerHTML = `<div class="ves-empty">${escapeHtml(error.message || 'Could not load Wing It Wednesdays')}</div>`;
});
