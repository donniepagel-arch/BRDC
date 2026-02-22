// Dashboard feed functions

import { callFunction, db } from '/js/firebase-config.js';
import { collection, getDocs, getDoc, doc, query, orderBy, limit, addDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { currentPlayer, dashboardData } from '/js/dashboard/dashboard-state.js';
import { getTimestamp, getDateFromTimestamp, formatTimeAgo, getOrdinalSuffix, calculateTeamAvg } from '/js/dashboard/dashboard-utils.js';
// formatLeagueName, toastSuccess, toastError, toastWarning are loaded as globals via <script> tags

// Social post state
let currentPostType = 'general';
let pendingMentions = [];
let mentionCandidates = null; // cached on first @ trigger
let mentionQuery = '';

// Map from groupId -> group data, for async performer loading
const weekGroupDataMap = {};

// Group match_result feed items by (league_id, week) — 2+ matches become one collapsible card
function groupWeekResults(items) {
    const weekGroups = {};
    items.forEach(item => {
        if (item.type === 'match_result' && item.week != null) {
            const key = `${item.league_id}_w${item.week}`;
            if (!weekGroups[key]) weekGroups[key] = [];
            weekGroups[key].push(item);
        }
    });

    const processed = new Set();
    const result = [];
    items.forEach(item => {
        if (item.type === 'match_result' && item.week != null) {
            const key = `${item.league_id}_w${item.week}`;
            if (processed.has(key)) return;
            processed.add(key);
            const group = weekGroups[key];
            if (group.length === 1) {
                result.push(item);
            } else {
                result.push({
                    type: 'week_results',
                    _groupKey: key,
                    week: item.week,
                    league_id: item.league_id,
                    league_name: item.league_name,
                    created_at: item.created_at,
                    matches: group
                });
            }
        } else {
            result.push(item);
        }
    });
    return result;
}

// Load feed items from all leagues
async function loadFeed(filter = 'all') {
    const container = document.getElementById('newsFeed');
    container.innerHTML = '<div class="fb-feed-loading">Loading your feed...</div>';

    try {
        const roles = dashboardData?.roles;
        const feedItems = [];

        // Get feed from all leagues player is in - fetch ALL in parallel
        if (roles && roles.playing) {
            const feedPromises = roles.playing.map(team => {
                const leagueId = team.league_id || team.id;
                return getDocs(
                    query(
                        collection(db, 'leagues', leagueId, 'feed'),
                        orderBy('created_at', 'desc'),
                        limit(50)
                    )
                ).then(feedSnap => ({ leagueId, feedSnap, error: null }))
                 .catch(error => ({ leagueId, feedSnap: null, error }));
            });

            const feedResults = await Promise.all(feedPromises);

            for (const { leagueId, feedSnap, error } of feedResults) {
                if (error) {
                    console.error('Error loading feed for league', leagueId, error);
                    continue;
                }
                if (feedSnap) {
                    feedSnap.forEach(doc => {
                        const item = { id: doc.id, ...doc.data(), leagueId };
                        feedItems.push(item);
                    });
                }
            }
        }

        // Also load social posts from global /posts collection
        const socialPostsPromise = getDocs(
            query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(20))
        ).then(snap => {
            snap.forEach(d => {
                feedItems.push({ id: d.id, ...d.data(), source: 'social' });
            });
        }).catch(err => console.warn('Social posts load error:', err));

        // Wait for social posts in parallel with league queries
        await socialPostsPromise;

        // Sort all feed items by date
        feedItems.sort((a, b) => {
            const dateA = getTimestamp(a.created_at);
            const dateB = getTimestamp(b.created_at);
            return dateB - dateA;
        });

        // Filter based on selected filter
        let filtered = feedItems;
        if (filter === 'leagues') {
            filtered = feedItems.filter(i => i.type === 'match_result' && i.source !== 'social');
        } else if (filter === 'events') {
            filtered = feedItems.filter(i => i.type === 'event' && i.source !== 'social');
        } else if (filter === 'friends') {
            const friendIds = currentPlayer?.friends || [];
            if (friendIds.length > 0) {
                filtered = feedItems.filter(item => {
                    // Check various ID fields that feed items might use
                    const authorId = item.author_id || item.player_id;
                    return authorId && friendIds.includes(authorId);
                });
            } else {
                filtered = [];
            }
        }

        // Remove week_highlights and league_night — superseded by week group cards
        filtered = filtered.filter(i => i.type !== 'week_highlights' && i.type !== 'league_night');

        // Group match results by week before rendering
        filtered = groupWeekResults(filtered);

        // Render
        if (filtered.length > 0) {
            container.innerHTML = filtered.slice(0, 20).map(item => renderFeedCard(item)).join('');
            // Async-load performer scorelines for any week group cards
            container.querySelectorAll('.week-results-group[id]').forEach(el => {
                loadWeekPerformers(el.id);
            });
        } else {
            // Custom empty message for friends filter
            if (filter === 'friends') {
                container.innerHTML = `
                    <div class="fb-feed-empty">
                        <div class="fb-feed-empty-icon">&#127919;</div>
                        <p>No posts from friends yet</p>
                        <p style="font-size: 13px; margin-top: 8px;">Add friends to see their activity here!</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="fb-feed-empty">
                        <div class="fb-feed-empty-icon">&#127919;</div>
                        <p>No recent activity</p>
                        <p style="font-size: 13px; margin-top: 8px;">Join a league or tournament to see updates here!</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading feed:', error);
        container.innerHTML = `
            <div class="fb-feed-empty">
                <div class="fb-feed-empty-icon">⚠️</div>
                <p>Error loading feed</p>
            </div>
        `;
    }
}

// Render a single feed card based on type
function renderFeedCard(item) {
    switch (item.type) {
        case 'match_result':
            return renderMatchResultFeedCard(item);
        case 'week_results':
            return renderWeekResultsGroup(item);
        case 'league_night':
            return renderLeagueNightCard(item);
        case 'week_highlights':
            return renderWeekHighlightsCard(item);
        case 'general':
        case 'anyone_going':
            return renderSocialPostCard(item);
        case 'looking_for_team':
        case 'looking_for_partner':
        case 'looking_for_ride':
            return renderPoolCard(item);
        case 'chatroom_invite':
            return renderChatroomInviteCard(item);
        default:
            return '';
    }
}

function renderPostCard(post) {
    const authorInitial = (post.author_name || 'U').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(post.created_at);

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-avatar">
                    ${post.author_photo ? `<img src="${post.author_photo}" alt="">` : authorInitial}
                </div>
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${post.author_name || 'Unknown'}</div>
                    <div class="fb-feed-time">${timeAgo}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${post.content}</div>
                ${post.event_tag ? `<span class="fb-feed-event-tag">${post.event_tag}</span>` : ''}
            </div>
            <div class="fb-feed-card-actions">
                <button class="fb-feed-action-btn">&#128077; Like</button>
                <button class="fb-feed-action-btn">&#128172; Comment</button>
                <button class="fb-feed-action-btn">&#128279; Share</button>
            </div>
        </div>
    `;
}

// Render a grouped "WEEK N RESULTS" card containing multiple match result cards
function renderWeekResultsGroup(group) {
    const groupId = `wg-${group.league_id}-w${group.week}`;
    weekGroupDataMap[groupId] = group; // store for async performer loading
    const count = group.matches.length;
    const innerCards = group.matches.map(m => renderMatchResultFeedCard(m)).join('');

    const groupDate = getDateFromTimestamp(group.created_at);
    const groupDateStr = groupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `
        <div class="week-results-group" id="${groupId}">
            <div class="week-results-header">
                <span class="week-results-label">WEEK ${group.week} RESULTS</span>
                <span class="week-results-league">${group.league_name || 'League'} &middot; ${groupDateStr}</span>
            </div>
            <div class="week-results-performers" id="${groupId}-perf">
                <span class="wrp-loading">&#183;&#183;&#183;</span>
            </div>
            <div class="week-results-footer" onclick="toggleWeekGroup('${groupId}')">
                <span class="week-results-count">${count} MATCHES</span>
                <span class="week-results-chevron">&#9660;</span>
            </div>
            <div class="week-results-matches" id="${groupId}-matches">
                ${innerCards}
            </div>
        </div>
    `;
}

// Mirror of generateLeagueFeed.js formatPlayerName — "First L."
function fmtShort(fullName) {
    if (!fullName || typeof fullName !== 'string') return fullName || '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

// Async: fetch match docs, compute per-player scores (set wins + notable throws), render scoreline grid
async function loadWeekPerformers(groupId) {
    const group = weekGroupDataMap[groupId];
    const perfEl = document.getElementById(groupId + '-perf');
    if (!group || !perfEl) return;

    try {
        // Build level map from rosters — names are already formatted ("First L.")
        const playerLevels = {}; // formattedName -> level
        group.matches.forEach(m => {
            [...(m.data.home_roster || []), ...(m.data.away_roster || [])].forEach(p => {
                if (p.name && p.level) playerLevels[p.name] = String(p.level).toUpperCase();
            });
        });

        // Fetch all match docs in parallel
        const matchDocs = await Promise.all(
            group.matches.map(m =>
                getDoc(doc(db, 'leagues', m.league_id, 'matches', m.match_id))
            )
        );

        // Track set wins and notables separately per player
        // Match docs use full names; format them to match the feed roster keys
        const playerSetWins = {};         // formattedName -> count
        const playerCricketNotables = {}; // formattedName -> count
        const playerX01Notables = {};     // formattedName -> count

        matchDocs.forEach(matchDoc => {
            if (!matchDoc.exists()) return;
            const md = matchDoc.data();
            (md.games || []).forEach(game => {
                const winner = game.winner; // 'home' or 'away'
                const homePlayers = (game.home_players || []).map(fmtShort);
                const awayPlayers = (game.away_players || []).map(fmtShort);

                // Set wins: 1 per player on the winning side
                const winners = winner === 'home' ? homePlayers : winner === 'away' ? awayPlayers : [];
                winners.forEach(name => {
                    if (name) playerSetWins[name] = (playerSetWins[name] || 0) + 1;
                });

                // Notable throws — both cricket and X01 are level-gated:
                //   Cricket (XM): A=9M+, B=7M+, C=5M+
                //   X01 (numeric): A=171+, B=140+, C=100+
                const cricketThresholds = { A: 9, B: 7, C: 5 };
                const x01Thresholds    = { A: 171, B: 140, C: 100 };
                (game.legs || []).forEach(leg => {
                    (leg.throws || []).forEach(t => {
                        ['home', 'away'].forEach(side => {
                            const td = t[side];
                            if (td && td.player && td.notable) {
                                const fn = fmtShort(td.player);
                                const lvl = playerLevels[fn];
                                const marksMatch = String(td.notable).match(/^(\d+)M$/i);
                                if (marksMatch) {
                                    const marks = parseInt(marksMatch[1], 10);
                                    const threshold = cricketThresholds[lvl] || 5;
                                    if (marks >= threshold) {
                                        playerCricketNotables[fn] = (playerCricketNotables[fn] || 0) + 1;
                                    }
                                } else {
                                    const score = parseInt(td.notable, 10);
                                    if (!isNaN(score)) {
                                        const threshold = x01Thresholds[lvl] || 100;
                                        if (score >= threshold) {
                                            playerX01Notables[fn] = (playerX01Notables[fn] || 0) + 1;
                                        }
                                    }
                                }
                            }
                        });
                    });
                });
            });
        });

        // Collect all players and find top per level (highest total = setWins + cricket + x01)
        const allPlayers = new Set([
            ...Object.keys(playerSetWins),
            ...Object.keys(playerCricketNotables),
            ...Object.keys(playerX01Notables)
        ]);
        const topByLevel = {};
        allPlayers.forEach(name => {
            const lvl = playerLevels[name];
            if (!lvl || !['A', 'B', 'C'].includes(lvl)) return;
            const setWins = playerSetWins[name] || 0;
            const cricket = playerCricketNotables[name] || 0;
            const x01 = playerX01Notables[name] || 0;
            const total = setWins + cricket + x01;
            if (!topByLevel[lvl] || total > topByLevel[lvl].total) {
                topByLevel[lvl] = { name, setWins, cricket, x01, total };
            }
        });

        const levels = ['A', 'B', 'C'];
        const performers = levels.filter(l => topByLevel[l]);

        if (performers.length === 0) {
            perfEl.innerHTML = '';
            return;
        }

        let html = `<div class="wpg-title">TOP PLAYERS</div>
        <div class="wpg-header">
            <div class="wpg-name">PLAYER</div>
            <div class="wpg-col wpg-divider">CRKT</div>
            <div class="wpg-col wpg-divider">01</div>
            <div class="wpg-col wpg-divider">WINS</div>
            <div class="wpg-col wpg-pts-hdr">TOTAL</div>
        </div>`;

        performers.forEach(l => {
            const p = topByLevel[l];
            html += `<div class="wpg-row">
                <div class="wpg-name"><span class="wpg-badge wpg-badge-${l.toLowerCase()}">${l}</span>${p.name}</div>
                <div class="wpg-col wpg-divider">${p.cricket}</div>
                <div class="wpg-col wpg-divider">${p.x01}</div>
                <div class="wpg-col wpg-divider">${p.setWins}</div>
                <div class="wpg-col wpg-pts">${p.total}</div>
            </div>`;
        });

        perfEl.innerHTML = html;

    } catch (e) {
        console.warn('loadWeekPerformers error:', e);
        perfEl.innerHTML = '';
    }
}

window.toggleWeekGroup = function(groupId) {
    const group = document.getElementById(groupId);
    if (group) group.classList.toggle('expanded');
};

// Render match result feed card - match-hub centered style
function renderMatchResultFeedCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const homeWon = data.home_score > data.away_score;
    const awayWon = data.away_score > data.home_score;

    const compareValues = (leftVal, rightVal) => {
        if (!leftVal || !rightVal) return { left: '', right: '' };
        if (Math.abs(leftVal - rightVal) < 0.1) return { left: '', right: '' };
        return leftVal > rightVal ? { left: 'stat-better', right: 'stat-worse' } : { left: 'stat-worse', right: 'stat-better' };
    };

    // Team averages
    const homeTeam3DA = data.home_team_avg?.x01_three_dart_avg ?? data.home_team_avg?.avg_3da;
    const homeTeamMPR = data.home_team_avg?.cricket_mpr ?? data.home_team_avg?.mpr;
    const awayTeam3DA = data.away_team_avg?.x01_three_dart_avg ?? data.away_team_avg?.avg_3da;
    const awayTeamMPR = data.away_team_avg?.cricket_mpr ?? data.away_team_avg?.mpr;

    const teamDACompare = compareValues(homeTeam3DA, awayTeam3DA);
    const teamMPRCompare = compareValues(homeTeamMPR, awayTeamMPR);

    const home3DAStr = homeTeam3DA != null ? homeTeam3DA.toFixed(1) : '-';
    const homeMPRStr = homeTeamMPR != null ? homeTeamMPR.toFixed(2) : '-';
    const away3DAStr = awayTeam3DA != null ? awayTeam3DA.toFixed(1) : '-';
    const awayMPRStr = awayTeamMPR != null ? awayTeamMPR.toFixed(2) : '-';

    const homeOrd = data.home_standing ? `${data.home_standing}${getOrdinalSuffix(data.home_standing)}` : '';
    const awayOrd = data.away_standing ? `${data.away_standing}${getOrdinalSuffix(data.away_standing)}` : '';

    // Build roster rows for the detail panel
    const homeRoster = (data.home_roster || []).sort((a, b) => (a.level || 'Z').localeCompare(b.level || 'Z'));
    const awayRoster = (data.away_roster || []).sort((a, b) => (a.level || 'Z').localeCompare(b.level || 'Z'));
    const maxRows = Math.max(homeRoster.length, awayRoster.length);
    let rosterRowsHtml = '';
    for (let i = 0; i < maxRows; i++) {
        const hp = homeRoster[i];
        const ap = awayRoster[i];
        const hLevel = hp ? String(hp.level || '').toUpperCase() : '';
        const aLevel = ap ? String(ap.level || '').toUpperCase() : '';
        const hBadge = ['A', 'B', 'C'].includes(hLevel) ? `<span class="feed-level-badge level-${hLevel.toLowerCase()}">${hLevel}</span> ` : '';
        const aBadge = ['A', 'B', 'C'].includes(aLevel) ? `<span class="feed-level-badge level-${aLevel.toLowerCase()}">${aLevel}</span> ` : '';
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

    const cardId = `feed-${item.match_id}`;

    return `
        <div class="fb-feed-card match-result-card" id="${cardId}" data-league="${item.league_id}" data-match="${item.match_id}" data-home="${data.home_team_name}" data-away="${data.away_team_name}">
            <!-- Collapsed: Box Score header bar + table -->
            <div class="feed-card-summary">
                <div class="feed-card-topbar">
                    <span class="feed-card-context">${item.league_name || 'League'} &middot; Week ${item.week} &middot; ${dateStr}</span>
                </div>
                <div class="feed-box-score">
                    <div class="feed-box-header">
                        <div class="feed-box-team-col">TEAM</div>
                        <div>SETS</div>
                        <div>3DA</div>
                        <div>MPR</div>
                    </div>
                    <div class="feed-box-row">
                        <div class="feed-box-team-col">
                            <span class="feed-box-star">${homeWon ? '★' : ''}</span>
                            <span class="feed-box-name">${data.home_team_name}</span>
                            <span class="feed-box-record">(${data.home_record}${homeOrd ? ', ' + homeOrd : ''})</span>
                        </div>
                        <div class="feed-box-sets ${homeWon ? 'winner' : ''}">${data.home_score}</div>
                        <div class="${teamDACompare.left}">${home3DAStr}</div>
                        <div class="${teamMPRCompare.left}">${homeMPRStr}</div>
                    </div>
                    <div class="feed-box-row">
                        <div class="feed-box-team-col">
                            <span class="feed-box-star">${awayWon ? '★' : ''}</span>
                            <span class="feed-box-name">${data.away_team_name}</span>
                            <span class="feed-box-record">(${data.away_record}${awayOrd ? ', ' + awayOrd : ''})</span>
                        </div>
                        <div class="feed-box-sets ${awayWon ? 'winner' : ''}">${data.away_score}</div>
                        <div class="${teamDACompare.right}">${away3DAStr}</div>
                        <div class="${teamMPRCompare.right}">${awayMPRStr}</div>
                    </div>
                </div>
            </div>

            <!-- Expanded detail: Line Score + Roster + View Match -->
            <div class="feed-card-detail" id="${cardId}-detail">
                <div class="feed-line-score" id="${cardId}-ls"></div>
                <div class="feed-roster-section">
                    <div class="feed-roster-header">TEAM ROSTERS</div>
                    <div class="feed-roster-grid">${rosterRowsHtml}</div>
                </div>
                <div class="fb-feed-card-actions">
                    <a class="fb-feed-action-btn" href="/pages/match-hub.html?league_id=${item.league_id}&match_id=${item.match_id}">
                        View Full Match
                    </a>
                    <a class="fb-feed-action-btn" href="/pages/league-view.html?league_id=${item.league_id}">
                        View League
                    </a>
                    <button class="fb-feed-action-btn share-action-btn" onclick="shareLink('/pages/match-hub.html?league_id=${item.league_id}&match_id=${item.match_id}', 'Match Result - BRDC', 'Check out this match!')">&#128279; Share</button>
                </div>
            </div>
            <!-- Footer toggle -->
            <div class="feed-card-footer" onclick="toggleFeedCard('${cardId}')">
                <span class="toggle-more">MORE INFO</span><span class="toggle-less">LESS</span>
                <span class="feed-card-chevron">&#9660;</span>
            </div>
        </div>
    `;
}

// Toggle feed card expand/collapse and lazy-load line score
window.toggleFeedCard = async function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const detail = document.getElementById(cardId + '-detail');
    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        card.classList.remove('expanded');
        detail.style.display = 'none';
        return;
    }

    card.classList.add('expanded');
    detail.style.display = 'block';

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
                const md = matchDoc.data();
                lsContainer.innerHTML = buildFeedLineScore(md, homeName, awayName);
            }
        } catch (e) {
            console.error('Error loading line score:', e);
        }
    }
};

// Build line score HTML from match games data
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

// Render league night summary card
function renderLeagueNightCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Render top performers by level
    let performersHtml = '';
    if (data.top_performers) {
        const levels = ['A', 'B', 'C'];
        const performersList = levels.map(level => {
            const perf = data.top_performers[level];
            if (!perf) return '';
            const stat = perf.avg_3da || perf.mpr;
            const statLabel = perf.avg_3da ? `${perf.avg_3da} 3DA` : `${perf.mpr} MPR`;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
                    <span style="color: var(--pink); font-weight: 600;">${level} Level</span>
                    <span style="color: var(--text-light);">${perf.name}</span>
                    <span style="color: var(--yellow);">${statLabel}</span>
                </div>
            `;
        }).join('');

        if (performersList) {
            performersHtml = `
                <div style="margin-top: 12px;">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-light);">Top Performers</div>
                    ${performersList}
                </div>
            `;
        }
    }

    // Render top 3 standings
    let standingsHtml = '';
    if (data.standings_top3 && data.standings_top3.length > 0) {
        const standingsList = data.standings_top3.map(team => `
            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span>${team.rank}. ${team.team_name}</span>
                <span style="color: var(--text-dim);">${team.wins}-${team.losses}</span>
            </div>
        `).join('');

        standingsHtml = `
            <div style="margin-top: 12px;">
                <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-light);">Standings</div>
                ${standingsList}
            </div>
        `;
    }

    return `
        <div class="fb-feed-card league-night-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${item.league_name || 'League'} - Week ${item.week}</div>
                    <div class="fb-feed-time">${dateStr} • ${data.matches_played} matches</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                ${performersHtml}
                ${standingsHtml}
            </div>
            <div class="fb-feed-card-actions">
                <a class="fb-feed-action-btn" href="/pages/league-view.html?league_id=${item.league_id}">
                    View League
                </a>
                <button class="fb-feed-action-btn share-action-btn" onclick="shareLink('/pages/league-view.html?league_id=${item.league_id}', '${(item.league_name || 'League').replace(/'/g, "\\'")} - BRDC', 'Check out the league!')">&#128279; Share</button>
            </div>
        </div>
    `;
}

// Render week highlights card
function renderWeekHighlightsCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let sectionsHtml = '';

    // Top Performers Section
    if (data.best_3da || data.best_mpr) {
        let performersContent = '';
        if (data.best_3da) {
            const match = data.best_3da.match ? ` - ${data.best_3da.match}` : '';
            performersContent += `
                <div class="highlight-stat">
                    <span>Best 3DA: ${data.best_3da.player_name}</span>
                    <span class="highlight-stat-value">${data.best_3da.value.toFixed(1)}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-dim); padding-left: 0;">${match}</div>
            `;
        }
        if (data.best_mpr) {
            const match = data.best_mpr.match ? ` - ${data.best_mpr.match}` : '';
            performersContent += `
                <div class="highlight-stat">
                    <span>Best MPR: ${data.best_mpr.player_name}</span>
                    <span class="highlight-stat-value">${data.best_mpr.value.toFixed(2)}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-dim); padding-left: 0;">${match}</div>
            `;
        }
        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">Top Performers</div>
                ${performersContent}
            </div>
        `;
    }

    // Notable Throws Section
    const has180s = data.maximums && data.maximums.length > 0;
    const hasTons140 = data.tons_140 > 0;
    const hasTons100 = data.tons_100 > 0;

    if (has180s || hasTons140 || hasTons100) {
        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">Notable Throws</div>
                <div class="highlight-count-grid">
                    <div class="highlight-count-item">
                        <div class="highlight-count-label">180s</div>
                        <div class="highlight-count-value">${has180s ? data.maximums.length : 0}</div>
                    </div>
                    <div class="highlight-count-item">
                        <div class="highlight-count-label">140+</div>
                        <div class="highlight-count-value">${data.tons_140 || 0}</div>
                    </div>
                    <div class="highlight-count-item">
                        <div class="highlight-count-label">100+</div>
                        <div class="highlight-count-value">${data.tons_100 || 0}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 180s List (if any)
    if (has180s) {
        const maxList = data.maximums.map(m => {
            const match = m.match ? ` (${m.match})` : '';
            return `
                <div class="highlight-stat">
                    <span>${m.player_name}${match}</span>
                </div>
            `;
        }).join('');

        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">Maximums (180s)</div>
                ${maxList}
            </div>
        `;
    }

    // Big Checkouts Section
    if (data.big_checkouts && data.big_checkouts.length > 0) {
        const checkoutList = data.big_checkouts.map(c => {
            const match = c.match ? ` (${c.match})` : '';
            return `
                <div class="highlight-stat">
                    <span>${c.player_name}${match}</span>
                    <span class="highlight-stat-value">${c.value}</span>
                </div>
            `;
        }).join('');

        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">Big Checkouts</div>
                ${checkoutList}
            </div>
        `;
    }

    // High Marks Section
    if (data.high_marks && data.high_marks.length > 0) {
        const marksList = data.high_marks.map(m => {
            const match = m.match ? ` (${m.match})` : '';
            return `
                <div class="highlight-stat">
                    <span>${m.player_name}${match}</span>
                    <span class="highlight-stat-value">${m.marks}M</span>
                </div>
            `;
        }).join('');

        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">High Marks (5M+)</div>
                ${marksList}
            </div>
        `;
    }

    // Match of the Week Section
    if (data.closest_match || data.biggest_win) {
        let matchesContent = '';

        if (data.closest_match) {
            const cm = data.closest_match;
            matchesContent += `
                <div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 2px;">Closest Match</div>
                    <div class="highlight-match-result">
                        <span class="team-name">${cm.home_team}</span>
                        <span class="score">${cm.home_score}-${cm.away_score}</span>
                        <span class="team-name">${cm.away_team}</span>
                    </div>
                </div>
            `;
        }

        if (data.biggest_win) {
            const bw = data.biggest_win;
            matchesContent += `
                <div style="margin-top: ${data.closest_match ? '8px' : '0'};">
                    <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 2px;">Biggest Win</div>
                    <div class="highlight-match-result">
                        <span class="team-name">${bw.winner_team}</span>
                        <span class="score">${bw.winner_score}-${bw.loser_score}</span>
                        <span class="team-name">${bw.loser_team}</span>
                    </div>
                </div>
            `;
        }

        sectionsHtml += `
            <div class="highlight-section">
                <div class="highlight-label">Match of the Week</div>
                ${matchesContent}
            </div>
        `;
    }

    return `
        <div class="fb-feed-card highlights-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">WEEK ${item.week} HIGHLIGHTS</div>
                    <div class="fb-feed-time">${item.league_name || 'League'} • ${dateStr}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                ${sectionsHtml}
            </div>
            <div class="fb-feed-card-actions">
                <a class="fb-feed-action-btn" href="/pages/league-view.html?league_id=${item.league_id}">
                    View League
                </a>
                <button class="fb-feed-action-btn share-action-btn" onclick="shareLink('/pages/league-view.html?league_id=${item.league_id}', '${(item.league_name || 'League').replace(/'/g, "\\'")} - BRDC', 'Check out the league!')">&#128279; Share</button>
            </div>
        </div>
    `;
}

// Render notable throw card
function renderNotableThrowCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let title = '';
    let description = '';

    if (item.type === 'maximum') {
        title = '180 Maximum!';
        description = `${item.player_name} throws a maximum 180`;
    } else if (item.type === 'high_score') {
        title = `${data.score} Points!`;
        description = `${item.player_name} with a big ${data.score}`;
    } else if (item.type === 'ton_checkout') {
        title = `${data.checkout} Checkout`;
        description = `${item.player_name} checks out ${data.checkout}`;
    } else if (item.type === 'big_checkout') {
        title = `BIG ${data.checkout} Checkout!`;
        description = `${item.player_name} with a huge ${data.checkout} checkout`;
    } else if (item.type === 'nine_mark') {
        title = '9-Mark Maximum!';
        description = `${item.player_name} throws 9 marks`;
    } else if (item.type === 'high_marks') {
        title = `${data.marks} Marks!`;
        description = `${item.player_name} with ${data.marks} marks`;
    } else if (item.type === 'bull_run') {
        title = 'Bull Run!';
        description = `${item.player_name} lights up the bulls (${data.notable})`;
    }

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${title}</div>
                    <div class="fb-feed-time">${dateStr} • Week ${item.week}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${description}</div>
                <span class="fb-feed-event-tag">${item.team_name} vs ${data.opponent_team}</span>
            </div>
        </div>
    `;
}

// Render weekly leader card
function renderWeeklyLeaderCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">Week ${item.week} Leader</div>
                    <div class="fb-feed-time">${dateStr}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">
                    <strong>${item.player_name}</strong> leads the week with ${data.value} ${data.stat_type}
                </div>
            </div>
        </div>
    `;
}

// Render milestone card
function renderMilestoneCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    let title = '';
    let description = '';

    if (data.milestone_type === 'legs_played') {
        title = `${data.value} Legs Played!`;
        description = `${item.player_name} reaches ${data.value} legs played`;
    } else if (data.milestone_type === 'first_180') {
        title = 'First 180!';
        description = `${item.player_name} throws their first maximum 180`;
    }

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${title}</div>
                    <div class="fb-feed-time">${dateStr}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${description}</div>
            </div>
        </div>
    `;
}

// Render hat trick card
function renderHatTrickCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">Hat Trick!</div>
                    <div class="fb-feed-time">${dateStr} • Week ${item.week}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">
                    <strong>${item.player_name}</strong> throws ${data.ton_count} tons in one set!
                </div>
                <span class="fb-feed-event-tag">${item.team_name} vs ${data.opponent_team}</span>
            </div>
        </div>
    `;
}

// Render upset card
function renderUpsetCard(item) {
    const data = item.data;
    const matchDate = getDateFromTimestamp(item.created_at);
    const dateStr = matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">UPSET!</div>
                    <div class="fb-feed-time">${dateStr} • Week ${item.week}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">
                    <strong>#${data.winner_rank} ${data.winner_team_name}</strong> defeats <strong>#${data.loser_rank} ${data.loser_team_name}</strong> ${data.winner_score}-${data.loser_score}
                </div>
            </div>
        </div>
    `;
}

function renderEventCard(event) {
    return `
        <div class="fb-feed-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${event.name}</div>
                    <div class="fb-feed-time">${event.date_str}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${event.description || 'Upcoming event'}</div>
                <span class="fb-feed-event-tag">${event.type}</span>
            </div>
        </div>
    `;
}

// Window-exposed handlers for onclick events

window.filterFeed = function(filter) {
    document.querySelectorAll('.feed-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    loadFeed(filter);
};

window.shareMatch = function(matchId) {
    const url = `${window.location.origin}/pages/match-hub.html?match_id=${matchId}`;
    if (navigator.share) {
        navigator.share({
            title: 'Match Result - BRDC',
            text: 'Check out this match result!',
            url: url
        }).catch(() => {});
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            toastSuccess('Link copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            toastError('Could not copy link');
        });
    }
};

window.triggerCommand = function(cmd) {
    const textarea = document.getElementById('postContent');
    if (!textarea) return;

    const cmdMap = {
        '/team':     { type: 'looking_for_team',    label: 'LOOKING FOR A TEAM',            placeholder: "Tell people what team situation you're looking for..." },
        '/partner':  { type: 'looking_for_partner', label: 'LOOKING FOR A DOUBLES PARTNER', placeholder: "Tell people about the events you want to play..." },
        '/ride':     { type: 'looking_for_ride',    label: 'LOOKING FOR A RIDE',             placeholder: "Where are you coming from / going to?" },
        '/chatroom': { type: 'chatroom_invite',     label: 'STARTING A CHAT ROOM',          placeholder: "Describe what you're organizing..." }
    };

    const cfg = cmdMap[cmd];
    if (!cfg) return;

    currentPostType = cfg.type;
    textarea.placeholder = cfg.placeholder;
    textarea.focus();

    const chip = document.getElementById('composerTypeChip');
    if (chip) {
        chip.textContent = cfg.label;
        chip.classList.remove('post-type-chip--hidden');
    }
};

window.submitPost = async function() {
    const textarea = document.getElementById('postContent');
    const content = textarea ? textarea.value.trim() : '';
    if (!content) {
        if (window.toastWarning) toastWarning('Please enter some text');
        return;
    }

    const submitBtn = document.getElementById('composerFooter')?.querySelector('button');
    if (submitBtn) submitBtn.disabled = true;

    try {
        let chat_room_id = null;

        // If chatroom type, create the room first
        if (currentPostType === 'chatroom_invite') {
            const roomResult = await callFunction('createOpenChatRoom', {
                player_id: currentPlayer.id,
                player_name: currentPlayer.name,
                name: content.substring(0, 60)
            });
            if (roomResult.success) {
                chat_room_id = roomResult.room_id;
            }
        }

        const result = await callFunction('createPost', {
            author_id: currentPlayer.id,
            content: content,
            post_type: currentPostType,
            mentions: pendingMentions,
            chat_room_id: chat_room_id
        });

        if (result.success) {
            // Reset composer inline
            if (textarea) { textarea.value = ''; textarea.placeholder = "What's on your mind?"; }
            const footer = document.getElementById('composerFooter');
            if (footer) footer.classList.add('composer-footer--hidden');
            const chip = document.getElementById('composerTypeChip');
            if (chip) { chip.textContent = ''; chip.classList.add('post-type-chip--hidden'); }
            currentPostType = 'general';
            pendingMentions = [];

            loadFeed();
            if (window.toastSuccess) toastSuccess('Post shared!');
        } else {
            if (window.toastError) toastError('Failed to create post');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        if (window.toastError) toastError('Failed to post. Please try again.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
};

// ===== SOCIAL POST CARD RENDERERS =====

function renderSocialPostCard(item) {
    const initial = (item.author_name || 'U').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(item.created_at);
    const bodyHtml = renderMentionsInText(item.content || '', item.mentions);
    const eventTag = item.tagged_event ? `<span class="fb-feed-event-tag">${item.tagged_event.name || item.tagged_event.type}</span>` : '';
    const shareUrl = `${location.origin}/pages/dashboard.html`;

    return `
        <div class="fb-feed-card social-post-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-avatar">${initial}</div>
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${item.author_name || 'Unknown'}</div>
                    <div class="fb-feed-time">${timeAgo}</div>
                </div>
            </div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${bodyHtml}</div>
                ${eventTag}
            </div>
            <div class="fb-feed-card-actions">
                <button class="fb-feed-action-btn" disabled>&#128077; Like</button>
                <button class="fb-feed-action-btn" disabled>&#128172; Comment</button>
                <button class="fb-feed-action-btn share-action-btn" onclick="shareLink('${shareUrl}', 'BRDC Post', '${(item.author_name || '').replace(/'/g, "\\'")} posted on BRDC')">&#128279; Share</button>
            </div>
        </div>
    `;
}

function renderPoolCard(item) {
    const initial = (item.author_name || 'U').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(item.created_at);
    const bodyHtml = renderMentionsInText(item.content || '', item.mentions);
    const eventTag = item.tagged_event ? `<span class="fb-feed-event-tag">${item.tagged_event.name || item.tagged_event.type}</span>` : '';

    const bannerMap = {
        looking_for_team: 'LOOKING FOR A TEAM',
        looking_for_partner: 'LOOKING FOR A DOUBLES PARTNER',
        looking_for_ride: 'LOOKING FOR A RIDE'
    };
    const banner = bannerMap[item.type] || 'LOOKING FOR...';

    const respondents = item.respondents || [];
    const alreadyJoined = currentPlayer && respondents.some(r => r.player_id === currentPlayer.id);

    const avatarHtml = respondents.slice(0, 5).map(r =>
        `<div class="pool-avatar" title="${r.player_name}">${r.player_name.charAt(0).toUpperCase()}</div>`
    ).join('');
    const extraCount = respondents.length > 5 ? `<span class="pool-extra">+${respondents.length - 5}</span>` : '';
    const countText = respondents.length === 0 ? 'No responses yet' : `${respondents.length} interested`;

    return `
        <div class="fb-feed-card pool-card" id="pool-${item.id}">
            <div class="fb-feed-card-header">
                <div class="fb-feed-avatar">${initial}</div>
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${item.author_name || 'Unknown'}</div>
                    <div class="fb-feed-time">${timeAgo}</div>
                </div>
            </div>
            <div class="pool-banner">${banner}</div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${bodyHtml}</div>
                ${eventTag}
            </div>
            <div class="pool-respondents">
                ${avatarHtml}${extraCount}
                <span class="pool-count">${countText}</span>
            </div>
            <div class="pool-actions">
                <button class="pool-join-btn" data-join="${item.id}" onclick="joinPool('${item.id}')" ${alreadyJoined ? 'disabled' : ''}>
                    ${alreadyJoined ? 'JOINED' : "I'M INTERESTED"}
                </button>
            </div>
        </div>
    `;
}

function renderChatroomInviteCard(item) {
    const initial = (item.author_name || 'U').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(item.created_at);
    const bodyHtml = renderMentionsInText(item.content || '', item.mentions);
    const roomId = item.chat_room_id || '';

    return `
        <div class="fb-feed-card chatroom-card">
            <div class="fb-feed-card-header">
                <div class="fb-feed-avatar">${initial}</div>
                <div class="fb-feed-meta">
                    <div class="fb-feed-author">${item.author_name || 'Unknown'}</div>
                    <div class="fb-feed-time">${timeAgo}</div>
                </div>
            </div>
            <div class="chatroom-banner">&#127919; OPEN CHAT ROOM</div>
            <div class="fb-feed-card-body">
                <div class="fb-feed-text">${bodyHtml}</div>
            </div>
            <div class="pool-actions">
                ${roomId ? `<a class="chatroom-join-btn" href="/pages/chat-room.html?room_id=${roomId}">JOIN CHAT</a>` : '<span class="fb-feed-time">Chat room unavailable</span>'}
            </div>
        </div>
    `;
}

function renderMentionsInText(content, mentions) {
    let html = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    (mentions || []).forEach(m => {
        if (m.type === 'player' && m.player_name) {
            const escaped = m.player_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            html = html.replace(
                new RegExp('@' + escaped, 'g'),
                `<span class="mention player-mention">@${m.player_name}</span>`
            );
        } else if (m.type === 'event' && m.event_name) {
            const href = m.event_type === 'league'
                ? `/pages/league-view.html?league_id=${m.event_id}`
                : `/pages/tournament-view.html?tournament_id=${m.event_id}`;
            const escaped = m.event_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            html = html.replace(
                new RegExp('@' + escaped, 'g'),
                `<a class="mention event-mention" href="${href}">@${m.event_name}</a>`
            );
        }
    });

    return html;
}

// ===== POOL JOIN =====

window.joinPool = async function(postId) {
    if (!currentPlayer) return;
    const btn = document.querySelector(`[data-join="${postId}"]`);
    if (btn) btn.disabled = true;

    try {
        const result = await callFunction('joinPool', {
            post_id: postId,
            player_id: currentPlayer.id,
            player_name: currentPlayer.name
        });
        if (result.success) {
            if (btn) {
                btn.textContent = 'JOINED';
                btn.disabled = true;
            }
            const card = document.getElementById('pool-' + postId);
            if (card) {
                const countEl = card.querySelector('.pool-count');
                if (countEl && result.respondent_count) {
                    countEl.textContent = result.respondent_count + ' interested';
                }
            }
            if (window.toastSuccess) toastSuccess("You're in the pool!");
        }
    } catch (e) {
        if (btn) btn.disabled = false;
        if (window.toastError) toastError('Could not join pool');
    }
};

// ===== MENTION INPUT HANDLING =====

window.onPostInput = function(textarea) {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Show/hide POST button
    const footer = document.getElementById('composerFooter');
    if (footer) {
        if (text.trim()) {
            footer.classList.remove('composer-footer--hidden');
        } else {
            footer.classList.add('composer-footer--hidden');
        }
    }

    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    const slashMatch = !atMatch && textBeforeCursor.match(/\/(\w*)$/);
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;

    if (atMatch) {
        mentionQuery = atMatch[1].toLowerCase();
        showMentionDropdown(mentionQuery);
    } else if (slashMatch) {
        showCommandDropdown(slashMatch[1].toLowerCase());
    } else {
        dropdown.classList.add('mention-dropdown--hidden');
    }
};

async function showMentionDropdown(query) {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;

    // Lazy-load candidates
    if (!mentionCandidates) {
        mentionCandidates = { players: [], events: [] };
        try {
            const { dashboardData: dd } = await import('/js/dashboard/dashboard-state.js');
            if (dd && dd.roles && dd.roles.playing) {
                dd.roles.playing.forEach(team => {
                    const leagueId = team.league_id || team.id;
                    const leagueName = team.league_name || team.name || 'League';
                    if (leagueId) {
                        mentionCandidates.events.push({ type: 'event', event_type: 'league', event_id: leagueId, event_name: leagueName });
                    }
                });
            }
            if (dd && dd.roles && dd.roles.playing && dd.roles.playing.length > 0) {
                const leagueId = dd.roles.playing[0].league_id || dd.roles.playing[0].id;
                if (leagueId) {
                    const snap = await getDocs(collection(db, 'leagues', leagueId, 'players'));
                    snap.forEach(d => {
                        const p = d.data();
                        if (p.name) mentionCandidates.players.push({ type: 'player', player_id: d.id, player_name: p.name });
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load mention candidates:', e);
        }
    }

    const filteredPlayers = mentionCandidates.players.filter(p =>
        p.player_name.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredEvents = mentionCandidates.events.filter(e =>
        e.event_name.toLowerCase().includes(query)
    ).slice(0, 3);

    if (filteredPlayers.length === 0 && filteredEvents.length === 0) {
        dropdown.classList.add('mention-dropdown--hidden');
        return;
    }

    let html = '';
    if (filteredPlayers.length > 0) {
        html += '<div class="mention-section-label">PLAYERS</div>';
        filteredPlayers.forEach(p => {
            html += `<div class="mention-item" onclick="selectMention(${JSON.stringify(p).replace(/"/g, '&quot;')})">@${p.player_name}</div>`;
        });
    }
    if (filteredEvents.length > 0) {
        html += '<div class="mention-section-label">EVENTS</div>';
        filteredEvents.forEach(e => {
            html += `<div class="mention-item mention-item--event" onclick="selectMention(${JSON.stringify(e).replace(/"/g, '&quot;')})">@${e.event_name}</div>`;
        });
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('mention-dropdown--hidden');
}

function showCommandDropdown(query) {
    const dropdown = document.getElementById('mentionDropdown');
    if (!dropdown) return;

    const commands = [
        { cmd: '/team',     label: 'Looking for a Team' },
        { cmd: '/partner',  label: 'Need a Doubles Partner' },
        { cmd: '/ride',     label: 'Need a Ride' },
        { cmd: '/chatroom', label: 'Start a Chat Room' }
    ];

    const filtered = query
        ? commands.filter(c => c.cmd.includes(query) || c.label.toLowerCase().includes(query))
        : commands;

    if (filtered.length === 0) {
        dropdown.classList.add('mention-dropdown--hidden');
        return;
    }

    dropdown.innerHTML = '<div class="mention-section-label">ACTIONS</div>' +
        filtered.map(c =>
            `<div class="mention-item" onclick="selectCommand('${c.cmd}')">${c.cmd} &mdash; ${c.label}</div>`
        ).join('');
    dropdown.classList.remove('mention-dropdown--hidden');
}

window.selectCommand = function(cmd) {
    const textarea = document.getElementById('postContent');
    const dropdown = document.getElementById('mentionDropdown');
    if (!textarea) return;

    // Strip the /word that triggered this from the textarea
    textarea.value = textarea.value.replace(/(?:^|\s)\/\w*$/, '').trimEnd();
    if (dropdown) dropdown.classList.add('mention-dropdown--hidden');

    window.triggerCommand(cmd);
    textarea.focus();
};

window.selectMention = function(candidate) {
    const textarea = document.getElementById('postContent');
    const dropdown = document.getElementById('mentionDropdown');
    if (!textarea || !dropdown) return;

    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const displayName = candidate.player_name || candidate.event_name;
    const replaced = textBeforeCursor.replace(/@(\w*)$/, `@${displayName} `);
    textarea.value = replaced + text.substring(cursorPos);
    textarea.selectionStart = textarea.selectionEnd = replaced.length;
    textarea.focus();

    pendingMentions.push(candidate);
    dropdown.classList.add('mention-dropdown--hidden');
};

// ===== COMPOSER AVATAR =====

window.initComposerAvatar = function(player) {
    const el = document.getElementById('feedComposerAvatar');
    if (el && player) {
        el.textContent = (player.name || '?').charAt(0).toUpperCase();
    }

    // Expand textarea on focus, collapse when blurred empty
    const textarea = document.getElementById('postContent');
    if (textarea) {
        textarea.addEventListener('focus', () => {
            textarea.classList.add('composer-textarea--expanded');
        });
        textarea.addEventListener('blur', () => {
            if (!textarea.value.trim()) {
                textarea.classList.remove('composer-textarea--expanded');
                const dropdown = document.getElementById('mentionDropdown');
                if (dropdown) dropdown.classList.add('mention-dropdown--hidden');
            }
        });
    }
};

export { loadFeed, renderFeedCard };
