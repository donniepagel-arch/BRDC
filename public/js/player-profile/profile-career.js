/**
 * Player Profile - Career Module
 *
 * Handles:
 * - Loading and displaying league and tournament history (past + present)
 * - Renders into #careerContent
 */

import { db, doc, getDoc, collection, getDocs, query, orderBy, limit } from '/js/firebase-config.js';
import { renderMatchResultCard, itemInvolvesPlayer, initFeedTab } from '/js/player-profile/profile-feed.js';

// ===== CAREER LOADING =====

export async function loadCareerTab(state) {
    const container = document.getElementById('careerContent');
    if (!container) return;

    const playerId = state.currentPlayer?.player_id || state.currentPlayer?.id;
    if (!playerId) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">No player data.</div>';
        return;
    }

    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">Loading career data...</div>';

    const leagueMap = new Map();
    const tournamentMap = new Map();

    // 1. Playing roles — these already carry league_name + team_name from getDashboardData
    const playingRoles = state.playingRoles || [];
    for (const r of playingRoles) {
        const lid = r.id || r.league_id;
        if (lid && !leagueMap.has(lid)) {
            const invData = {
                league_name: r.league_name || r.name || '',
                team_name: r.team_name || '',
                team_id: r.team_id || ''
            };
            await tryAddLeague(leagueMap, lid, playerId, true, invData);
        }
    }

    // 2. Captaining teams — also carry name data
    for (const t of (state.captainingTeams || [])) {
        const lid = t.league_id || t.id;
        if (lid && !leagueMap.has(lid)) {
            const invData = {
                league_name: t.league_name || t.name || '',
                team_name: t.team_name || '',
                team_id: t.team_id || ''
            };
            await tryAddLeague(leagueMap, lid, playerId, true, invData);
        }
    }

    // 3. currentLeagueId fallback (if not already captured above)
    if (state.currentLeagueId && !leagueMap.has(state.currentLeagueId)) {
        await tryAddLeague(leagueMap, state.currentLeagueId, playerId, true);
    }

    // 4. Historical involvements from global player doc
    try {
        const globalPlayerDoc = await getDoc(doc(db, 'players', playerId));
        if (globalPlayerDoc.exists()) {
            const data = globalPlayerDoc.data();
            const involvements = data.involvements || {};

            for (const [lid, inv] of Object.entries(involvements.leagues || {})) {
                if (!leagueMap.has(lid)) {
                    await tryAddLeague(leagueMap, lid, playerId, false, inv);
                }
            }

            for (const [tid, inv] of Object.entries(involvements.tournaments || {})) {
                if (!tournamentMap.has(tid)) {
                    await tryAddTournament(tournamentMap, tid, playerId, inv);
                }
            }
        }
    } catch (e) {
        console.log('Career: could not load involvements:', e.message);
    }

    // Ensure feed card toggle is registered (for expanded match cards)
    initFeedTab(state);
    registerCareerMatchToggle();

    // Render
    const sections = [];
    if (leagueMap.size > 0) sections.push(renderLeaguesSection(leagueMap));
    if (tournamentMap.size > 0) sections.push(renderTournamentsSection(tournamentMap));

    if (sections.length === 0) {
        container.innerHTML = `
            <div style="padding:60px 20px;text-align:center;color:var(--text-dim);">
                <p style="font-family:'Oswald',sans-serif;font-size:18px;color:var(--yellow);margin-bottom:8px;">NO CAREER DATA</p>
                <p>League and tournament history will appear here.</p>
            </div>`;
        return;
    }

    container.innerHTML = sections.join('');
}

// ===== HELPERS =====

async function tryAddLeague(leagueMap, leagueId, playerId, isCurrent, invData = null) {
    try {
        const leagueDoc = await getDoc(doc(db, 'leagues', leagueId));
        if (!leagueDoc.exists()) return;

        const league = leagueDoc.data();
        const entry = {
            leagueId,
            // Prefer name data passed in (from role/involvement) over fresh fetch
            leagueName: invData?.league_name || league.name || league.league_name || 'Unknown League',
            season: league.season || league.year || '',
            isCurrent,
            teamName: invData?.team_name || '',
            teamId: invData?.team_id || '',
            record: invData?.record || '',
            stats: invData?.stats || null
        };

        // If we still don't have team info, fetch it from the league
        if (!entry.teamName) {
            try {
                const leaguePlayerDoc = await getDoc(doc(db, 'leagues', leagueId, 'players', playerId));
                if (leaguePlayerDoc.exists()) {
                    const lp = leaguePlayerDoc.data();
                    entry.teamId = lp.team_id || '';
                    if (lp.team_id) {
                        const teamDoc = await getDoc(doc(db, 'leagues', leagueId, 'teams', lp.team_id));
                        if (teamDoc.exists()) entry.teamName = teamDoc.data().name || '';
                    }
                }
            } catch (e) { /* skip */ }
        }

        // Stats
        if (!entry.stats) {
            try {
                const statsDoc = await getDoc(doc(db, 'leagues', leagueId, 'stats', playerId));
                if (statsDoc.exists()) entry.stats = statsDoc.data();
            } catch (e) { /* skip */ }
        }

        leagueMap.set(leagueId, entry);
    } catch (e) {
        console.log('Career: could not load league', leagueId, e.message);
    }
}

async function tryAddTournament(tournamentMap, tournId, playerId, invData = null) {
    try {
        const tournDoc = await getDoc(doc(db, 'tournaments', tournId));
        if (!tournDoc.exists()) return;

        const tourn = tournDoc.data();
        tournamentMap.set(tournId, {
            tournId,
            tournName: tourn.name || 'Unknown Tournament',
            date: tourn.date || tourn.start_date || '',
            placement: invData?.placement || invData?.finish || '',
            stats: invData?.stats || null
        });
    } catch (e) {
        console.log('Career: could not load tournament', tournId, e.message);
    }
}

function formatStats(stats) {
    if (!stats) return '';
    const parts = [];
    const x01Darts = stats.x01_total_darts || 0;
    const crkDarts = stats.cricket_total_darts || 0;

    if (x01Darts > 0) {
        const avg = ((stats.x01_total_points || 0) / x01Darts * 3).toFixed(1);
        parts.push(`3DA: ${avg}`);
    }
    if (crkDarts > 0) {
        const mpr = ((stats.cricket_total_marks || 0) / crkDarts * 3).toFixed(2);
        parts.push(`MPR: ${mpr}`);
    }

    const totalPlayed = (stats.x01_legs_played || 0) + (stats.cricket_legs_played || 0);
    const totalWon = (stats.x01_legs_won || 0) + (stats.cricket_legs_won || 0);
    if (totalPlayed > 0) {
        parts.push(`Win%: ${((totalWon / totalPlayed) * 100).toFixed(0)}%`);
    }

    return parts.join('  ·  ');
}

// ===== RENDERERS =====

function renderLeaguesSection(leagueMap) {
    const items = Array.from(leagueMap.values())
        .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

    const cards = items.map(entry => {
        const statsStr = formatStats(entry.stats);
        const cardId = `career-card-${entry.leagueId}`;
        const detailId = `career-matches-${entry.leagueId}`;

        const currentBadge = entry.isCurrent
            ? `<span style="font-family:'Oswald',sans-serif;font-size:10px;background:var(--yellow);color:#000;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;margin-left:8px;">CURRENT</span>`
            : '';

        const teamLink = entry.teamId && entry.leagueId
            ? `<a href="/pages/team-profile.html?league_id=${entry.leagueId}&team_id=${entry.teamId}" style="color:var(--teal);text-decoration:none;">${escapeHtml(entry.teamName)}</a>`
            : (entry.teamName ? `<span style="color:var(--teal);">${escapeHtml(entry.teamName)}</span>` : '');

        const leagueLink = entry.leagueId
            ? `<a href="/pages/league-view.html?league_id=${entry.leagueId}" style="font-family:'Oswald',sans-serif;font-size:12px;color:var(--pink);text-decoration:none;letter-spacing:1px;">VIEW LEAGUE →</a>`
            : '';

        return `
        <div class="fb-feed-card career-league-card" id="${cardId}">
            <div class="feed-card-summary" style="padding:14px 16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div style="min-width:0;flex:1;">
                        <div style="font-family:'Oswald',sans-serif;font-size:16px;color:var(--text-light);line-height:1.2;">
                            ${escapeHtml(entry.leagueName)}${currentBadge}
                        </div>
                        ${teamLink ? `<div style="font-size:13px;margin-top:4px;">${teamLink}</div>` : ''}
                        ${statsStr ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${statsStr}</div>` : ''}
                        ${leagueLink ? `<div style="margin-top:10px;">${leagueLink}</div>` : ''}
                    </div>
                    ${entry.season ? `<div style="font-size:11px;color:var(--text-dim);flex-shrink:0;">${escapeHtml(String(entry.season))}</div>` : ''}
                </div>
            </div>
            <div class="feed-card-detail" id="${detailId}"></div>
            <div class="feed-card-footer" onclick="toggleCareerLeagueMatches('${entry.leagueId}', '${detailId}', '${cardId}')">
                <span class="toggle-more">MATCHES</span>
                <span class="toggle-less">HIDE MATCHES</span>
                <span class="feed-card-chevron">&#9660;</span>
            </div>
        </div>`;
    }).join('');

    return `
    <div style="background:var(--bg-panel);border-top:1px solid var(--pink);border-bottom:1px solid rgba(255,255,255,0.2);margin-top:8px;margin-bottom:8px;">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;padding:10px 14px;background:rgba(0,0,0,0.3);color:var(--yellow);letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.1);">LEAGUES</div>
        <div class="fb-feed">${cards}</div>
    </div>`;
}

function renderTournamentsSection(tournamentMap) {
    const items = Array.from(tournamentMap.values());

    const rows = items.map(entry => {
        const statsStr = formatStats(entry.stats);
        const link = entry.tournId
            ? `<a href="/pages/tournament-view.html?tournament_id=${entry.tournId}" style="font-family:'Oswald',sans-serif;font-size:12px;color:var(--pink);text-decoration:none;letter-spacing:1px;">VIEW →</a>`
            : '';

        return `
        <div style="border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
                <div>
                    <div style="font-family:'Oswald',sans-serif;font-size:16px;color:var(--text-light);">${escapeHtml(entry.tournName)}</div>
                    ${entry.placement ? `<div style="font-size:12px;color:var(--yellow);margin-top:2px;">Finish: ${escapeHtml(String(entry.placement))}</div>` : ''}
                    ${statsStr ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${statsStr}</div>` : ''}
                </div>
                <div style="text-align:right;">
                    ${entry.date ? `<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">${escapeHtml(String(entry.date))}</div>` : ''}
                    ${link}
                </div>
            </div>
        </div>`;
    }).join('');

    return `
    <div style="background:var(--bg-panel);border-top:1px solid var(--pink);border-bottom:1px solid rgba(255,255,255,0.2);margin-top:8px;margin-bottom:8px;">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;padding:10px 14px;background:rgba(0,0,0,0.3);color:var(--yellow);letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.1);">TOURNAMENTS</div>
        ${rows}
    </div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== MATCH TOGGLE =====

function registerCareerMatchToggle() {
    if (window.toggleCareerLeagueMatches) return;

    window.toggleCareerLeagueMatches = async function(leagueId, detailId, cardId) {
        const card = document.getElementById(cardId);
        const detail = document.getElementById(detailId);
        if (!card || !detail) return;

        const isExpanded = card.classList.contains('expanded');
        const footer = card.querySelector('.feed-card-footer');
        const toggleMore = footer?.querySelector('.toggle-more');
        const toggleLess = footer?.querySelector('.toggle-less');
        const chevron = footer?.querySelector('.feed-card-chevron');

        if (isExpanded) {
            card.classList.remove('expanded');
            detail.style.display = 'none';
            if (toggleMore) toggleMore.style.display = '';
            if (toggleLess) toggleLess.style.display = 'none';
            if (chevron) chevron.style.transform = '';
            return;
        }

        // Save scroll position before expanding so the page doesn't jump
        const savedScrollY = window.scrollY;

        card.classList.add('expanded');
        detail.style.display = 'block';
        if (toggleMore) toggleMore.style.display = 'none';
        if (toggleLess) toggleLess.style.display = 'inline';
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        // Restore scroll immediately (prevents footer from pulling the page down)
        window.scrollTo(0, savedScrollY);

        if (detail.dataset.loaded) return;
        detail.dataset.loaded = '1';

        detail.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-dim);font-family:\'Oswald\',sans-serif;font-size:13px;letter-spacing:0.5px;">Loading matches...</div>';

        const state = window.playerProfileState;
        const playerId = state?.currentPlayer?.player_id || state?.currentPlayer?.id;
        const playerName = state?.currentPlayer?.name;

        try {
            const feedSnap = await getDocs(query(
                collection(db, 'leagues', leagueId, 'feed'),
                orderBy('created_at', 'desc'),
                limit(50)
            ));

            const matchItems = [];
            feedSnap.docs.forEach(d => {
                const item = { id: d.id, ...d.data(), _leagueId: leagueId };
                const type = item.type || item.event_type || '';
                if (type === 'match_result' && item.data && itemInvolvesPlayer(item, playerId, playerName)) {
                    matchItems.push(item);
                }
            });

            if (matchItems.length === 0) {
                detail.innerHTML = '<div style="padding:20px 16px;text-align:center;color:var(--text-dim);font-size:13px;">No match history found in this league.</div>';
            } else {
                detail.innerHTML = `<div class="fb-feed">${matchItems.map(item => renderMatchResultCard(item, 'career-')).join('')}</div>`;
            }
            // Restore scroll after content renders to prevent jump from async load
            window.scrollTo(0, savedScrollY);
        } catch (e) {
            console.error('Career: load league matches error:', e);
            detail.innerHTML = '<div style="padding:12px 16px;color:var(--text-dim);font-size:13px;">Could not load match history.</div>';
        }
    };
}

// ===== INITIALIZATION =====

export function initCareerTab(state) {
    // Nothing to do on init — lazy loads when tab is clicked
}
