/**
 * Player Profile - Feed Module
 *
 * Handles:
 * - Loading player's own posts
 * - Loading league feed events involving the player
 * - Rendering into #feedContent
 */

import { db, collection, query, where, orderBy, limit, getDocs, doc, getDoc } from '/js/firebase-config.js';

// ===== FEED LOADING =====

export async function loadFeedTab(state) {
    const container = document.getElementById('feedContent');
    if (!container) return;

    const playerId = state.currentPlayer?.player_id || state.currentPlayer?.id;
    const playerName = state.currentPlayer?.name;
    if (!playerId) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">No player data.</div>';
        return;
    }

    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);">Loading feed...</div>';

    const sections = [];

    // 1. Load posts by this player
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('author_id', '==', playerId),
            orderBy('created_at', 'desc'),
            limit(20)
        );
        const postsSnap = await getDocs(postsQuery);
        const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (posts.length > 0) {
            sections.push(renderPostsSection(posts, playerName));
        }
    } catch (e) {
        // Posts may not exist or index may be missing — skip silently
        console.log('Profile feed: posts query skipped:', e.message);
    }

    // 2. Load league feed events mentioning this player (from all player leagues)
    const leagueIds = new Set();
    if (state.currentLeagueId) leagueIds.add(state.currentLeagueId);
    // Also pull from playerLeagues if populated
    (state.playerLeagues || []).forEach(l => { if (l.league_id) leagueIds.add(l.league_id); });
    // And from playing roles if present
    (state.playingRoles || []).forEach(r => { if (r.id || r.league_id) leagueIds.add(r.id || r.league_id); });

    const allFeedItems = [];
    for (const lid of leagueIds) {
        try {
            const feedSnap = await getDocs(query(
                collection(db, 'leagues', lid, 'feed'),
                orderBy('created_at', 'desc'),
                limit(50)
            ));
            feedSnap.docs.forEach(d => {
                const item = { id: d.id, ...d.data(), _leagueId: lid };
                if (itemInvolvesPlayer(item, playerId, playerName)) {
                    allFeedItems.push(item);
                }
            });
        } catch (e) {
            console.log('Profile feed: league feed query skipped for', lid, e.message);
        }
    }

    // Sort by date descending
    allFeedItems.sort((a, b) => {
        const ta = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const tb = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return tb - ta;
    });

    if (allFeedItems.length > 0) {
        sections.push(renderLeagueFeedSection(allFeedItems));
    }

    if (sections.length === 0) {
        container.innerHTML = `
            <div style="padding:60px 20px;text-align:center;color:var(--text-dim);">
                <p style="font-family:'Oswald',sans-serif;font-size:18px;color:var(--yellow);margin-bottom:8px;">NO ACTIVITY YET</p>
                <p>Posts and match events will appear here.</p>
            </div>`;
        return;
    }

    container.innerHTML = sections.join('');
}

// ===== HELPERS =====

function itemInvolvesPlayer(item, playerId, playerName) {
    // Check by ID fields
    if (item.player_id === playerId) return true;
    if (item.home_player_id === playerId || item.away_player_id === playerId) return true;

    // Check match_result roster arrays (item.data.home_roster / away_roster)
    // Feed items store names in "First L." shortened format, so match against both forms
    if (playerName) {
        const lower = playerName.toLowerCase();
        const parts = lower.split(' ');
        const firstName = parts[0];
        // Build shortened form: "Donnie Pagel" → "donnie p."
        const shortForm = parts.length > 1 ? firstName + ' ' + parts[parts.length - 1].charAt(0) + '.' : firstName;

        const nameMatches = (n) => {
            if (!n) return false;
            const nl = n.toLowerCase();
            return nl === lower || nl === shortForm || nl.startsWith(firstName + ' ');
        };

        const homeRoster = item.data?.home_roster || [];
        const awayRoster = item.data?.away_roster || [];
        for (const p of homeRoster) { if (nameMatches(p.name)) return true; }
        for (const p of awayRoster) { if (nameMatches(p.name)) return true; }

        if (Array.isArray(item.home_players)) {
            for (const p of item.home_players) {
                if (nameMatches(typeof p === 'string' ? p : p?.name)) return true;
            }
        }
        if (Array.isArray(item.away_players)) {
            for (const p of item.away_players) {
                if (nameMatches(typeof p === 'string' ? p : p?.name)) return true;
            }
        }

        if (item.title?.toLowerCase().includes(lower)) return true;
        if (item.description?.toLowerCase().includes(lower)) return true;
        if (item.content?.toLowerCase().includes(lower)) return true;
    }

    return false;
}

function formatTime(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}

// ===== RENDERERS =====

function renderPostsSection(posts, playerName) {
    const cards = posts.map(post => {
        const time = formatTime(post.created_at);
        const content = (post.content || post.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const likes = post.likes_count || post.likes || 0;
        const comments = post.comments_count || post.comments || 0;

        return `
        <div style="border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--teal);">${escapeHtml(playerName || 'Player')}</span>
                <span style="font-size:11px;color:var(--text-dim);">${time}</span>
            </div>
            ${content ? `<p style="font-size:14px;color:var(--text-light);line-height:1.5;margin:0 0 8px;">${content}</p>` : ''}
            <div style="font-size:12px;color:var(--text-dim);">
                ${likes ? `<span style="margin-right:12px;">♥ ${likes}</span>` : ''}
                ${comments ? `<span>💬 ${comments}</span>` : ''}
            </div>
        </div>`;
    }).join('');

    return `
    <div style="background:var(--bg-panel);border-top:1px solid var(--pink);border-bottom:1px solid rgba(255,255,255,0.2);margin-top:8px;margin-bottom:8px;">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;padding:10px 14px;background:rgba(0,0,0,0.3);color:var(--yellow);letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.1);">POSTS</div>
        ${cards}
    </div>`;
}

function renderLeagueFeedSection(feedItems) {
    const cards = feedItems.slice(0, 20).map(item => renderFeedCard(item)).join('');
    return `<div class="fb-feed">${cards}</div>`;
}

function renderFeedCard(item) {
    const type = item.type || item.event_type || '';
    if (type === 'match_result' && item.data) return renderMatchResultCard(item);
    return ''; // skip non-match_result types for now
}

function renderMatchResultCard(item, idPrefix = 'pf-feed-') {
    const d = item.data;
    const leagueId = item.league_id || item._leagueId || '';
    const homeWon = d.home_score > d.away_score;
    const awayWon = d.away_score > d.home_score;
    const cardId = `${idPrefix}${item.id || item.match_id}`;

    // Date string
    const matchDate = item.created_at?.toDate ? item.created_at.toDate() : new Date(item.created_at || 0);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const compareValues = (l, r) => {
        if (l == null || r == null) return { l: '', r: '' };
        if (Math.abs(l - r) < 0.1) return { l: '', r: '' };
        return l > r ? { l: 'stat-better', r: 'stat-worse' } : { l: 'stat-worse', r: 'stat-better' };
    };
    const homeTeam3DA = d.home_team_avg?.x01_three_dart_avg ?? d.home_team_avg?.avg_3da;
    const homeTeamMPR = d.home_team_avg?.cricket_mpr ?? d.home_team_avg?.mpr;
    const awayTeam3DA = d.away_team_avg?.x01_three_dart_avg ?? d.away_team_avg?.avg_3da;
    const awayTeamMPR = d.away_team_avg?.cricket_mpr ?? d.away_team_avg?.mpr;
    const daC = compareValues(homeTeam3DA, awayTeam3DA);
    const mprC = compareValues(homeTeamMPR, awayTeamMPR);

    const homeOrd = d.home_standing ? `${d.home_standing}${ordSuffix(d.home_standing)}` : '';
    const awayOrd = d.away_standing ? `${d.away_standing}${ordSuffix(d.away_standing)}` : '';

    // Roster rows
    const homeRoster = (d.home_roster || []).sort((a, b) => (a.level || 'Z').localeCompare(b.level || 'Z'));
    const awayRoster = (d.away_roster || []).sort((a, b) => (a.level || 'Z').localeCompare(b.level || 'Z'));
    const maxRows = Math.max(homeRoster.length, awayRoster.length);
    let rosterRowsHtml = '';
    for (let i = 0; i < maxRows; i++) {
        const hp = homeRoster[i];
        const ap = awayRoster[i];
        const hL = hp ? String(hp.level || '').toUpperCase() : '';
        const aL = ap ? String(ap.level || '').toUpperCase() : '';
        const hBadge = ['A','B','C'].includes(hL) ? `<span class="feed-level-badge level-${hL.toLowerCase()}">${hL}</span> ` : '';
        const aBadge = ['A','B','C'].includes(aL) ? `<span class="feed-level-badge level-${aL.toLowerCase()}">${aL}</span> ` : '';
        const h3DA = hp?.x01_three_dart_avg ?? hp?.avg_3da;
        const hMPR = hp?.cricket_mpr ?? hp?.mpr;
        const a3DA = ap?.x01_three_dart_avg ?? ap?.avg_3da;
        const aMPR = ap?.cricket_mpr ?? ap?.mpr;
        const hStat = hp ? `${h3DA != null ? h3DA.toFixed(1) : '-'} / ${hMPR != null ? hMPR.toFixed(2) : '-'}` : '';
        const aStat = ap ? `${a3DA != null ? a3DA.toFixed(1) : '-'} / ${aMPR != null ? aMPR.toFixed(2) : '-'}` : '';
        rosterRowsHtml += `<div class="feed-roster-row">
            <div class="feed-roster-cell home">
                ${hp ? `<span class="feed-roster-stat">${hStat}</span><span class="feed-roster-name">${hBadge}${hp.name}</span>` : ''}
            </div>
            <div class="feed-roster-cell away">
                ${ap ? `<span class="feed-roster-name">${aBadge}${ap.name}</span><span class="feed-roster-stat">${aStat}</span>` : ''}
            </div>
        </div>`;
    }

    return `
        <div class="fb-feed-card match-result-card" id="${cardId}" data-league="${leagueId}" data-match="${item.match_id || ''}" data-home="${escapeHtml(d.home_team_name || '')}" data-away="${escapeHtml(d.away_team_name || '')}">
            <div class="feed-card-summary">
                <div class="feed-card-topbar">
                    <span class="feed-card-context">${item.league_name || 'League'} &middot; Week ${item.week} &middot; ${dateStr}</span>
                </div>
                <div class="feed-box-score">
                    <div class="feed-box-header">
                        <div class="feed-box-team-col">TEAM</div>
                        <div>SETS</div><div>3DA</div><div>MPR</div>
                    </div>
                    <div class="feed-box-row">
                        <div class="feed-box-team-col">
                            <span class="feed-box-star">${homeWon ? '★' : ''}</span>
                            <span class="feed-box-name">${escapeHtml(d.home_team_name || '')}</span>
                            <span class="feed-box-record">(${d.home_record || ''}${homeOrd ? ', ' + homeOrd : ''})</span>
                        </div>
                        <div class="feed-box-sets ${homeWon ? 'winner' : ''}">${d.home_score}</div>
                        <div class="${daC.l}">${homeTeam3DA != null ? homeTeam3DA.toFixed(1) : '-'}</div>
                        <div class="${mprC.l}">${homeTeamMPR != null ? homeTeamMPR.toFixed(2) : '-'}</div>
                    </div>
                    <div class="feed-box-row">
                        <div class="feed-box-team-col">
                            <span class="feed-box-star">${awayWon ? '★' : ''}</span>
                            <span class="feed-box-name">${escapeHtml(d.away_team_name || '')}</span>
                            <span class="feed-box-record">(${d.away_record || ''}${awayOrd ? ', ' + awayOrd : ''})</span>
                        </div>
                        <div class="feed-box-sets ${awayWon ? 'winner' : ''}">${d.away_score}</div>
                        <div class="${daC.r}">${awayTeam3DA != null ? awayTeam3DA.toFixed(1) : '-'}</div>
                        <div class="${mprC.r}">${awayTeamMPR != null ? awayTeamMPR.toFixed(2) : '-'}</div>
                    </div>
                </div>
            </div>
            <div class="feed-card-detail" id="${cardId}-detail">
                <div class="feed-line-score" id="${cardId}-ls"></div>
                <div class="feed-roster-section">
                    <div class="feed-roster-header">TEAM ROSTERS</div>
                    <div class="feed-roster-grid">${rosterRowsHtml}</div>
                </div>
                <div class="fb-feed-card-actions">
                    ${leagueId && item.match_id ? `<a class="fb-feed-action-btn" href="/pages/match-hub.html?league_id=${leagueId}&match_id=${item.match_id}">View Full Match</a>` : ''}
                    ${leagueId ? `<a class="fb-feed-action-btn" href="/pages/league-view.html?league_id=${leagueId}">View League</a>` : ''}
                    ${leagueId && item.match_id ? `<button class="fb-feed-action-btn share-action-btn" onclick="shareLink('/pages/match-hub.html?league_id=${leagueId}&match_id=${item.match_id}', 'Match Result - BRDC', 'Check out this match!', '${cardId}')">&#128279; Share</button>` : ''}
                </div>
            </div>
            <div class="feed-card-footer" onclick="toggleFeedCard('${cardId}')">
                <span class="toggle-more">MORE INFO</span><span class="toggle-less">LESS</span>
                <span class="feed-card-chevron">&#9660;</span>
            </div>
        </div>`;
}

function ordSuffix(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== LINE SCORE BUILDER =====

function buildFeedLineScore(matchData, homeName, awayName) {
    const games = matchData.games || [];
    if (games.length === 0) return '';

    // Group games by set
    const setGroups = {};
    games.forEach(g => {
        const sn = g.set || 1;
        if (!setGroups[sn]) setGroups[sn] = [];
        setGroups[sn].push(g);
    });

    const setNumbers = Object.keys(setGroups).map(Number).sort((a, b) => a - b);
    if (setNumbers.length <= 1) return '';

    const homeLegs = [];
    const awayLegs = [];
    let homeLegTotal = 0, awayLegTotal = 0;
    let homeSetWins = 0, awaySetWins = 0;

    setNumbers.forEach(sn => {
        const sg = setGroups[sn];
        let hW = 0, aW = 0;
        sg.forEach(g => {
            if (g.result) { hW += g.result.home_legs || 0; aW += g.result.away_legs || 0; }
            else { (g.legs || []).forEach(l => { if (l.winner === 'home') hW++; else if (l.winner === 'away') aW++; }); }
        });
        homeLegs.push(hW);
        awayLegs.push(aW);
        homeLegTotal += hW;
        awayLegTotal += aW;
        if (hW > aW) homeSetWins++;
        else if (aW > hW) awaySetWins++;
    });

    const numSets = setNumbers.length;
    const cols = `90px repeat(${numSets}, 1fr) 44px 44px`;
    const homeMore = homeLegTotal > awayLegTotal;
    const awayMore = awayLegTotal > homeLegTotal;

    let html = '<div class="feed-ls-title">LINE SCORE</div>';
    html += `<div class="feed-ls-header" style="grid-template-columns: ${cols}">`;
    html += '<div class="feed-ls-cell feed-ls-name">SET</div>';
    setNumbers.forEach(sn => { html += `<div class="feed-ls-cell feed-ls-hdr">${sn}</div>`; });
    html += '<div class="feed-ls-cell feed-ls-hdr feed-ls-final">TOT</div>';
    html += '<div class="feed-ls-cell feed-ls-hdr feed-ls-final">LEGS</div></div>';

    html += `<div class="feed-ls-team" style="grid-template-columns: ${cols}">`;
    html += `<div class="feed-ls-cell feed-ls-name">${homeName}</div>`;
    homeLegs.forEach((h, i) => { html += `<div class="feed-ls-cell ${h > awayLegs[i] ? 'feed-ls-win' : h < awayLegs[i] ? 'feed-ls-loss' : ''}">${h}</div>`; });
    html += `<div class="feed-ls-cell feed-ls-final${homeSetWins > awaySetWins ? ' feed-ls-winner' : homeSetWins < awaySetWins ? ' feed-ls-loser' : ''}">${homeSetWins}</div>`;
    html += `<div class="feed-ls-cell feed-ls-final${homeMore ? ' feed-ls-winner' : !awayMore ? '' : ' feed-ls-loser'}">${homeLegTotal}</div></div>`;

    html += `<div class="feed-ls-team feed-ls-team-last" style="grid-template-columns: ${cols}">`;
    html += `<div class="feed-ls-cell feed-ls-name">${awayName}</div>`;
    awayLegs.forEach((a, i) => { html += `<div class="feed-ls-cell ${a > homeLegs[i] ? 'feed-ls-win' : a < homeLegs[i] ? 'feed-ls-loss' : ''}">${a}</div>`; });
    html += `<div class="feed-ls-cell feed-ls-final${awaySetWins > homeSetWins ? ' feed-ls-winner' : awaySetWins < homeSetWins ? ' feed-ls-loser' : ''}">${awaySetWins}</div>`;
    html += `<div class="feed-ls-cell feed-ls-final${awayMore ? ' feed-ls-winner' : !homeMore ? '' : ' feed-ls-loser'}">${awayLegTotal}</div></div>`;

    return html;
}

// ===== INITIALIZATION =====

export function initFeedTab(state) {
    // toggleFeedCard is used by onclick in rendered cards — async so it can lazy-load line score
    if (!window.toggleFeedCard) {
        window.toggleFeedCard = async function(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;
            const detail = document.getElementById(cardId + '-detail');
            const isExpanded = card.classList.contains('expanded');
            const footer = card.querySelector('.feed-card-footer');
            const toggleMore = footer?.querySelector('.toggle-more');
            const toggleLess = footer?.querySelector('.toggle-less');
            const chevron = footer?.querySelector('.feed-card-chevron');

            if (isExpanded) {
                card.classList.remove('expanded');
                if (detail) detail.style.display = 'none';
                if (toggleMore) toggleMore.style.display = '';
                if (toggleLess) toggleLess.style.display = 'none';
                if (chevron) chevron.style.transform = '';
                return;
            }

            card.classList.add('expanded');
            if (detail) detail.style.display = 'block';
            if (toggleMore) toggleMore.style.display = 'none';
            if (toggleLess) toggleLess.style.display = 'inline';
            if (chevron) chevron.style.transform = 'rotate(180deg)';

            // Lazy-load line score on first expand
            const lsContainer = document.getElementById(cardId + '-ls');
            if (lsContainer && !lsContainer.dataset.loaded) {
                lsContainer.dataset.loaded = '1';
                const leagueId = card.dataset.league;
                const matchId = card.dataset.match;
                const homeName = card.dataset.home;
                const awayName = card.dataset.away;
                try {
                    const matchDoc = await getDoc(doc(db, 'leagues', leagueId, 'matches', matchId));
                    if (matchDoc.exists()) {
                        lsContainer.innerHTML = buildFeedLineScore(matchDoc.data(), homeName, awayName);
                    }
                } catch (e) {
                    console.error('Error loading line score:', e);
                }
            }
        };
    }
}

export { renderMatchResultCard, itemInvolvesPlayer, buildFeedLineScore, escapeHtml, ordSuffix, formatTime };
