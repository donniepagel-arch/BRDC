/**
 * leagues-vnext.js
 * My Leagues landing page — Phase 4 of the vNext nav redesign.
 *
 * Data sources:
 *   • Current / Past  — player.involvements.leagues[] from getPlayerSession.
 *     Each item has: { id, name, team_id, team_name, role, status? }
 *     League-level status (active / registration / playoffs / completed / archived)
 *     is fetched in a single batch from the `leagues` collection so the player-centric
 *     split is accurate even if the session item omits it.
 *   • Open to join    — direct Firestore query on `leagues` for documents where
 *     status is "registration" or "open", excluding any league the player is already in.
 */

import {
    db,
    auth,
    waitForAuthReady,
    callFunction,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where
} from '/js/firebase-config.js';

/* ─────────────────────────────────────────────
   ACTIVE-LEAGUE STATUSES
   ───────────────────────────────────────────── */
const ACTIVE_STATUSES = new Set(['active', 'registration', 'open', 'playoffs', 'in_progress', 'setup']);
const PAST_STATUSES   = new Set(['completed', 'archived', 'cancelled', 'ended']);

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Classify a league status string into "current" | "past" | "unknown".
 * Treat missing/unknown status as current (optimistic default for live leagues).
 */
function classifyStatus(status) {
    const s = String(status || '').toLowerCase().trim();
    if (PAST_STATUSES.has(s)) return 'past';
    if (ACTIVE_STATUSES.has(s) || !s) return 'current';
    return 'current'; // unknown → current
}

/**
 * Build a badge element string for a league status.
 */
function statusBadge(status) {
    const s = String(status || '').toLowerCase().trim();
    const map = {
        active:       ['Active',       'lv-badge-active'],
        in_progress:  ['Active',       'lv-badge-active'],
        registration: ['Registration', 'lv-badge-reg'],
        open:         ['Open',         'lv-badge-open'],
        playoffs:     ['Playoffs',     'lv-badge-playoffs'],
        setup:        ['Setup',        'lv-badge-other'],
        completed:    ['Completed',    'lv-badge-completed'],
        archived:     ['Archived',     'lv-badge-archived'],
        cancelled:    ['Cancelled',    'lv-badge-archived'],
        ended:        ['Completed',    'lv-badge-completed'],
    };
    const [label, cls] = map[s] || [escapeHtml(status) || 'Active', 'lv-badge-other'];
    return `<span class="lv-badge ${cls}">${label}</span>`;
}

/**
 * Build a role pill string.
 */
function rolePill(role) {
    const r = String(role || '').toLowerCase().trim();
    const map = {
        captain:  ['Captain',  'lv-role-captain'],
        director: ['Director', 'lv-role-director'],
        player:   ['Player',   'lv-role-player'],
    };
    const [label, cls] = map[r] || ['Player', 'lv-role-player'];
    return `<span class="lv-role-pill ${cls}">${label}</span>`;
}

/**
 * Render a single league card for Current/Past sections.
 * @param {{ id:string, name:string, team_name?:string, role?:string, status?:string }} item
 */
function renderMyLeagueCard(item) {
    const href = `/pages/triples-vnext.html?league_id=${encodeURIComponent(item.id)}`;
    const teamMeta = item.team_name
        ? `<span class="lv-card-meta-item">${escapeHtml(item.team_name)} ${rolePill(item.role)}</span>`
        : `<span class="lv-card-meta-item">${rolePill(item.role)}</span>`;

    return `
        <a class="lv-card" href="${href}" aria-label="Go to ${escapeHtml(item.name)}">
            <div class="lv-card-top">
                <span class="lv-card-name">${escapeHtml(item.name || 'League')}</span>
                ${statusBadge(item.status)}
            </div>
            <div class="lv-card-meta">
                ${teamMeta}
            </div>
        </a>
    `;
}

/**
 * Render a single league card for the Open to Join section.
 * @param {{ id:string, league_name?:string, name?:string, status:string, team_count?:number }} league
 */
function renderOpenLeagueCard(league) {
    const href = `/pages/triples-vnext.html?league_id=${encodeURIComponent(league.id)}`;
    const name = league.league_name || league.name || 'League';
    const teamCountStr = Number.isFinite(league.team_count) && league.team_count > 0
        ? `<span class="lv-card-meta-item">${league.team_count} team${league.team_count === 1 ? '' : 's'} registered</span>`
        : '';

    return `
        <a class="lv-card" href="${href}" aria-label="View and join ${escapeHtml(name)}">
            <div class="lv-card-top">
                <span class="lv-card-name">${escapeHtml(name)}</span>
                ${statusBadge(league.status)}
            </div>
            <div class="lv-card-meta">
                ${teamCountStr}
                <span class="lv-card-meta-item">Accepting registration</span>
            </div>
            <span class="lv-card-arrow" aria-hidden="true">&#8250;</span>
        </a>
    `;
}

/**
 * Render a section block with heading + card list.
 * Returns empty string if items array is empty (section is omitted).
 */
function renderSection(heading, items, renderFn) {
    if (!items.length) return '';
    return `
        <section class="lv-section">
            <div class="lv-section-head">
                <h2>${heading}</h2>
                <span class="lv-section-count">${items.length}</span>
            </div>
            ${items.map(renderFn).join('')}
        </section>
    `;
}

/**
 * Render the Open-to-join list as a standalone section.
 * Used both inside the normal layout and inside the no-league splash.
 */
function renderOpenSection(openLeagues) {
    if (!openLeagues.length) return '';
    return `
        <section class="lv-section lv-open-section">
            <div class="lv-section-head">
                <h2>Open to join</h2>
                <span class="lv-section-count">${openLeagues.length}</span>
            </div>
            ${openLeagues.map(renderOpenLeagueCard).join('')}
        </section>
    `;
}

/* ─────────────────────────────────────────────
   FIRESTORE: open leagues
   Query the top-level `leagues` collection for status in
   ("registration", "open").  Exclude leagues the player is already in.
   Degrades gracefully — on error returns empty array and hides section.
   ───────────────────────────────────────────── */
async function loadOpenLeagues(playerLeagueIds = new Set()) {
    try {
        // Query for leagues in registration status
        const regSnap = await getDocs(
            query(collection(db, 'leagues'), where('status', 'in', ['registration', 'open']))
        );

        const results = [];
        regSnap.forEach(docSnap => {
            if (playerLeagueIds.has(docSnap.id)) return; // already in this league
            const data = docSnap.data();
            results.push({
                id: docSnap.id,
                league_name: data.league_name || data.name,
                name: data.name || data.league_name,
                status: data.status,
                team_count: Number.isFinite(data.team_count)
                    ? data.team_count
                    : (Array.isArray(data.teams) ? data.teams.length : null)
            });
        });

        return results;
    } catch (err) {
        console.warn('[leagues-vnext] Could not load open leagues:', err);
        return []; // degrade gracefully — section is hidden
    }
}

/* ─────────────────────────────────────────────
   FIRESTORE: batch-fetch league status
   Given a list of involvement items, fetch each league doc to get its
   current status (so current/past split is accurate).
   Returns a Map<leagueId, status>.
   ───────────────────────────────────────────── */
async function fetchLeagueStatuses(involvements) {
    const statusMap = new Map();
    if (!involvements.length) return statusMap;

    // Pre-populate from any status already in the involvement record
    involvements.forEach(item => {
        if (item.status) statusMap.set(item.id, item.status);
    });

    // Only fetch docs we don't already have a status for
    const idsToFetch = involvements
        .filter(item => !statusMap.has(item.id))
        .map(item => item.id);

    if (!idsToFetch.length) return statusMap;

    await Promise.allSettled(
        idsToFetch.map(async (leagueId) => {
            try {
                const snap = await getDoc(doc(db, 'leagues', leagueId));
                if (snap.exists()) {
                    statusMap.set(leagueId, snap.data().status || 'active');
                }
            } catch {
                // Treat missing/inaccessible as active (non-fatal)
                statusMap.set(leagueId, 'active');
            }
        })
    );

    return statusMap;
}

/* ─────────────────────────────────────────────
   RENDER
   ───────────────────────────────────────────── */
function renderPage({ currentLeagues, pastLeagues, openLeagues, noLeagues }) {
    const content = document.getElementById('leaguesContent');
    const subtitle = document.getElementById('leaguesSubtitle');
    if (!content) return;

    // No leagues at all — splash + open list prominently
    if (noLeagues) {
        const total = currentLeagues.length + pastLeagues.length;
        const openHtml = openLeagues.length
            ? renderOpenSection(openLeagues)
            : `<div class="lv-empty" style="margin-top:20px;">
                   <div class="lv-empty-icon" aria-hidden="true">📋</div>
                   <p class="lv-empty-title">No open leagues right now</p>
                   <p class="lv-empty-body">Check back soon — registration opens here when a new league is forming.</p>
               </div>`;

        if (subtitle) subtitle.textContent = 'Join a league to get started.';

        content.innerHTML = `
            <div class="lv-splash">
                <div class="lv-splash-icon" aria-hidden="true">🎯</div>
                <h2>You're not in a league yet</h2>
                <p class="lv-splash-copy">When you join a league your standings, schedule, and team will appear here. Have a look at what's open below.</p>
            </div>
            ${openHtml}
        `;
        return;
    }

    // Build sections
    const currentHtml = renderSection('Current', currentLeagues, renderMyLeagueCard);
    const pastHtml    = renderSection('Past', pastLeagues, renderMyLeagueCard);
    const openHtml    = renderOpenSection(openLeagues);

    const total = currentLeagues.length + pastLeagues.length;
    if (subtitle) {
        subtitle.textContent = total === 1
            ? '1 league'
            : `${total} league${total === 0 ? 's' : 's'}`;
    }

    content.innerHTML = `
        ${currentHtml}
        ${pastHtml || (currentHtml ? '' : '')}
        ${pastHtml && openHtml ? '<hr class="lv-divider">' : ''}
        ${openHtml}
        ${!currentHtml && !pastHtml && !openHtml ? `
            <section class="lv-section">
                <div class="lv-empty">
                    <div class="lv-empty-icon" aria-hidden="true">🎯</div>
                    <p class="lv-empty-title">Nothing to show</p>
                    <p class="lv-empty-body">Your league history will appear here once you have played in a league.</p>
                </div>
            </section>
        ` : ''}
    `;
}

/* ─────────────────────────────────────────────
   MAIN INIT
   ───────────────────────────────────────────── */
async function initLeaguesVNext() {
    const subtitle = document.getElementById('leaguesSubtitle');

    try {
        await waitForAuthReady();

        if (!auth.currentUser) {
            // Not logged in — show open leagues only, no personalized sections
            const openLeagues = await loadOpenLeagues();
            if (subtitle) subtitle.textContent = openLeagues.length
                ? `${openLeagues.length} league${openLeagues.length === 1 ? '' : 's'} open`
                : 'Log in to see your leagues.';

            renderPage({
                currentLeagues: [],
                pastLeagues: [],
                openLeagues,
                noLeagues: true
            });
            return;
        }

        // ── Fetch session for involvement data ──
        let player = null;
        try {
            const session = await callFunction('getPlayerSession', {});
            player = session?.player || null;
        } catch (err) {
            console.warn('[leagues-vnext] getPlayerSession failed:', err);
        }

        // Fall back to local session if cloud call failed
        if (!player) {
            try {
                const raw = localStorage.getItem('brdc_session');
                if (raw) player = JSON.parse(raw);
            } catch {}
        }

        const rawInvolvements = player?.involvements?.leagues || [];

        // ── Fetch league statuses from Firestore ──
        const statusMap = await fetchLeagueStatuses(rawInvolvements);

        // ── Build enriched involvement items ──
        const enrichedInvolvements = rawInvolvements.map(item => ({
            id: item.id || item.league_id,
            name: item.name || item.league_name || 'League',
            team_id: item.team_id || null,
            team_name: item.team_name || null,
            role: item.role || 'player',
            status: statusMap.get(item.id || item.league_id) || item.status || 'active'
        }));

        // ── Split into current vs past ──
        const currentLeagues = enrichedInvolvements.filter(
            item => classifyStatus(item.status) === 'current'
        );
        const pastLeagues = enrichedInvolvements.filter(
            item => classifyStatus(item.status) === 'past'
        );

        // ── Fetch open leagues (exclude player's own) ──
        const playerLeagueIds = new Set(enrichedInvolvements.map(item => item.id).filter(Boolean));
        const openLeagues = await loadOpenLeagues(playerLeagueIds);

        // ── Render ──
        const hasAny = enrichedInvolvements.length > 0;
        renderPage({
            currentLeagues,
            pastLeagues,
            openLeagues,
            noLeagues: !hasAny
        });

    } catch (err) {
        console.error('[leagues-vnext] Init failed:', err);
        const content = document.getElementById('leaguesContent');
        if (content) {
            content.innerHTML = `
                <div class="lv-notice">
                    Could not load leagues — please refresh and try again.
                </div>
            `;
        }
        if (subtitle) subtitle.textContent = 'Failed to load. Refresh to retry.';
    }
}

initLeaguesVNext();
