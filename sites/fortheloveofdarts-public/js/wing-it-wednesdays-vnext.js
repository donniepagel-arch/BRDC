import {
    db,
    doc,
    getDoc,
    collection,
    getDocs
} from '/js/firebase-config.js';

const WEEKS = [
    { id: 'rookies-wing-it-wednesdays-2026-06-03', fallbackName: 'Wing It Wednesdays', fallbackDate: '2026-06-03', fallbackStatus: 'Next week' },
    { id: 'rookies-wing-it-wednesdays-2026-05-27', fallbackName: 'Wing It Wednesdays', fallbackDate: '2026-05-27', fallbackStatus: 'Completed' }
];

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
    return week.date || week.tournament_date || week.start_date || week.fallbackDate || week.created_at;
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
    return `${date} - ${week.status || week.registration_status || week.fallbackStatus || `Week ${index + 1}`}`;
}

function runtimeHref(id) {
    return `/rookies/pages/tournament-runtime-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function viewHref(id) {
    return `/rookies/pages/tournament-view-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function bracketHref(id) {
    return `/rookies/pages/tournament-bracket.html?tournament_id=${encodeURIComponent(id)}`;
}

function registrationHref(id) {
    return `/rookies/pages/tournament-register-vnext.html?tournament_id=${encodeURIComponent(id)}`;
}

function render() {
    const next = weeks.find(week => {
        const status = String(week.status || week.registration_status || '').toLowerCase();
        return !status.includes('complete') && !status.includes('ended');
    }) || weeks[0];
    const totalRegs = weeks.reduce((sum, week) => sum + Number(week.registrationCount || 0), 0);

    els.status.textContent = 'Choose a week';
    els.weekCount.textContent = String(weeks.length);
    els.nextDate.textContent = next ? shortDate(eventDate(next)) : '-';
    els.totalPlayers.textContent = String(totalRegs);

    els.select.innerHTML = weeks.map((week, index) => `
        <option value="${escapeHtml(week.id)}">${escapeHtml(weekLabel(week, index))}</option>
    `).join('');
    if (next) els.select.value = next.id;
    setSelectedRuntime();

    els.list.innerHTML = weeks.map((week, index) => `
        <article class="wing-week-card">
            <div>
                <p class="ves-kicker">Week ${weeks.length - index}</p>
                <h2>${escapeHtml(week.name || week.tournament_name || week.fallbackName || 'Wing It Wednesdays')}</h2>
                <p>${escapeHtml(longDate(eventDate(week)))} - ${Number(week.registrationCount || 0)} registered - ${escapeHtml(week.status || week.registration_status || week.fallbackStatus || 'Event')}</p>
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

async function hydrateWeek(config) {
    const [snap, regsSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', config.id)).catch(() => null),
        getDocs(collection(db, 'tournaments', config.id, 'registrations')).catch(() => ({ docs: [] }))
    ]);
    return {
        id: config.id,
        fallbackName: config.fallbackName,
        fallbackDate: config.fallbackDate,
        fallbackStatus: config.fallbackStatus,
        ...(snap?.exists?.() ? snap.data() : {}),
        registrationCount: regsSnap.docs.length
    };
}

async function load() {
    weeks = await Promise.all(WEEKS.map(hydrateWeek));
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
