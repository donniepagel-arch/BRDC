/**
 * Import Match Data Functions
 * Temporary functions for importing DartConnect match data with throws
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');
const { parseMatch: parseDartConnectMatch } = require('./parse-dartconnect');
const importMatchesAdmin = require('./import-matches-admin');

// Initialize if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const TRIPLES_MATCH_FORMAT = [
    { game: 1, homePositions: [1, 2], awayPositions: [1, 2], type: 'doubles', format: '501' },
    { game: 2, homePositions: [3], awayPositions: [3], type: 'singles', format: 'Cricket' },
    { game: 3, homePositions: [1], awayPositions: [1], type: 'singles', format: 'Cricket' },
    { game: 4, homePositions: [2, 3], awayPositions: [2, 3], type: 'doubles', format: '501' },
    { game: 5, homePositions: [2], awayPositions: [2], type: 'singles', format: 'Cricket' },
    { game: 6, homePositions: [1], awayPositions: [1], type: 'singles', format: '501' },
    { game: 7, homePositions: [1, 3], awayPositions: [1, 3], type: 'doubles', format: '501' },
    { game: 8, homePositions: [2], awayPositions: [2], type: 'singles', format: '501' },
    { game: 9, homePositions: [3], awayPositions: [3], type: 'singles', format: '501' }
];

/**
 * Create global player documents from league player roster
 * This ensures every player in a league has a global player document
 * Players are stored in leagues/{leagueId}/players collection
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.createGlobalPlayersFromRosters = importMatchesAdmin.createGlobalPlayersFromRosters;

/**
 * Consolidate player IDs across the system
 * This migration ensures every player has ONE consistent ID used everywhere:
 * - Global players collection (source of truth)
 * - League team rosters
 * - League stats
 * - Tournament registrations/stats
 *
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.consolidatePlayerIds = importMatchesAdmin.consolidatePlayerIds;

/**
 * Look up player IDs by email to create proper mapping
 * POST { emails: ["email1@example.com", "email2@example.com"] }
 * Returns { success: true, mapping: { "email1@example.com": { id: "xxx", name: "..." }, ... } }
 */
exports.lookupPlayersByEmail = importMatchesAdmin.lookupPlayersByEmail;

/**
 * Fully migrate league to use global player IDs everywhere
 * This updates:
 * - leagues/{id}/players collection (recreates docs with global IDs)
 * - leagues/{id}/teams (updates players array with global IDs)
 * - leagues/{id}/stats (already done by recalculateLeagueStats)
 *
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.migrateLeagueToGlobalIds = importMatchesAdmin.migrateLeagueToGlobalIds;

// Helper to normalize team name for comparison
function normalizeTeamName(name) {
    return (name || '').toUpperCase().replace(/[^A-Z]/g, '');
}

// Check if import home team matches Firestore home team
function teamsMatch(importHome, firestoreHome) {
    const importNorm = normalizeTeamName(importHome);
    const fbNorm = normalizeTeamName(firestoreHome);
    // Check if either contains a significant portion of the other
    return fbNorm.includes(importNorm.substring(0, 4)) ||
           importNorm.includes(fbNorm.substring(0, 4));
}

// Swap home/away in leg data
function swapLegData(leg) {
    return {
        ...leg,
        winner: leg.winner === 'home' ? 'away' : leg.winner === 'away' ? 'home' : leg.winner,
        home_stats: leg.away_stats,
        away_stats: leg.home_stats,
        throws: leg.throws ? leg.throws.map(t => ({
            ...t,
            home: t.away,
            away: t.home
        })) : undefined
    };
}

function validateImportedMatchPayload(matchData) {
    const errors = [];
    const warnings = [];
    const placeholderThrowPlayers = new Set();
    const metrics = {
        games: 0,
        legs: 0,
        legsWithThrows: 0,
        legsWithoutThrows: 0,
        throws: 0,
        throwsMissingPlayer: 0,
        throwsUnresolvedPlayerId: 0,
        throwsMissingSideData: 0,
        playerStatsOnlyLegs: 0
    };

    if (!matchData || typeof matchData !== 'object') {
        return {
            valid: false,
            errors: ['matchData must be an object'],
            warnings: [],
            metrics
        };
    }

    if (!Array.isArray(matchData.games) || matchData.games.length === 0) {
        errors.push('matchData.games must contain at least one game');
        return { valid: false, errors, warnings, metrics };
    }

    metrics.games = matchData.games.length;

    matchData.games.forEach((game, gameIdx) => {
        const legs = Array.isArray(game.legs) ? game.legs : [];
        if (legs.length === 0) {
            warnings.push(`game ${gameIdx + 1} has no legs`);
        }

        legs.forEach((leg, legIdx) => {
            metrics.legs++;
            const throws = Array.isArray(leg.throws) ? leg.throws : [];
            const playerStats = leg.player_stats && typeof leg.player_stats === 'object' ? leg.player_stats : null;

            if (throws.length === 0) {
                metrics.legsWithoutThrows++;
                if (playerStats && Object.keys(playerStats).length > 0) {
                    metrics.playerStatsOnlyLegs++;
                    warnings.push(`game ${gameIdx + 1} leg ${legIdx + 1} has player_stats but no throws`);
                } else {
                    warnings.push(`game ${gameIdx + 1} leg ${legIdx + 1} has no throw data`);
                }
            } else {
                metrics.legsWithThrows++;
            }

            throws.forEach((round, roundIdx) => {
                metrics.throws++;
                const hasHome = !!round?.home;
                const hasAway = !!round?.away;

                if (!hasHome && !hasAway) {
                    metrics.throwsMissingSideData++;
                    warnings.push(`game ${gameIdx + 1} leg ${legIdx + 1} round ${roundIdx + 1} has no home/away throw payload`);
                    return;
                }

                ['home', 'away'].forEach(side => {
                    const throwInfo = round?.[side];
                    if (!throwInfo) return;
                    if (!throwInfo.player) {
                        metrics.throwsMissingPlayer++;
                        warnings.push(`game ${gameIdx + 1} leg ${legIdx + 1} round ${roundIdx + 1} ${side} throw is missing player attribution`);
                        return;
                    }
                    if (isPlaceholderSideName(throwInfo.player)) {
                        placeholderThrowPlayers.add(normalizeRecapLabel(throwInfo.player, side));
                        return;
                    }
                    if (!throwInfo.player_id && !isPlaceholderSideName(throwInfo.player)) {
                        metrics.throwsUnresolvedPlayerId++;
                        warnings.push(`game ${gameIdx + 1} leg ${legIdx + 1} round ${roundIdx + 1} ${side} throw could not be resolved to a canonical player id (${throwInfo.player})`);
                    }
                });
            });
        });
    });

    if (metrics.legs === 0) {
        errors.push('matchData.games contains no legs');
    }

    const placeholderPlayers = Array.from(placeholderThrowPlayers.size ? placeholderThrowPlayers : new Set(collectPlaceholderThrowPlayers(matchData)));
    if (placeholderPlayers.length) {
        errors.push(`matchData still contains placeholder throw owners: ${placeholderPlayers.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        metrics
    };
}

function htmlDecode(value) {
    if (!value || typeof value !== 'string') return value;
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function parseNumericValue(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return value;
    const normalized = String(value).replace(/,/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRecapLabel(label, fallback) {
    const normalized = String(label || '').replace(/\s+/g, ' ').trim();
    return normalized || fallback;
}

function buildGamesDetailUrl(sourceUrl) {
    const url = new URL(sourceUrl);
    if (url.pathname.startsWith('/matches/')) {
        url.pathname = url.pathname.replace('/matches/', '/games/');
    }
    return url.toString();
}

function extractRecapDataPagePayload(html) {
    const marker = 'data-page="';
    const startIdx = html.indexOf(marker);
    if (startIdx < 0) {
        throw new Error('DartConnect recap page is missing data-page payload');
    }

    const jsonStart = startIdx + marker.length;
    const endMarker = '"></div>';
    const endIdx = html.indexOf(endMarker, jsonStart);
    if (endIdx < 0) {
        throw new Error('Unable to find end of DartConnect data-page payload');
    }

    const encoded = html.slice(jsonStart, endIdx);
    const decoded = htmlDecode(encoded);
    return JSON.parse(decoded);
}

function mapRecapGameType(gameName) {
    const normalized = String(gameName || '').trim().toLowerCase();
    if (normalized === 'cricket') {
        return { type: 'cricket', format: 'Cricket' };
    }
    const x01Match = normalized.match(/^(\d{3,4})$/);
    if (x01Match) {
        return { type: 'x01', format: x01Match[1] };
    }
    return { type: normalized || 'unknown', format: String(gameName || '').trim() || 'Unknown' };
}

function parseCheckoutDarts(notable) {
    const match = String(notable || '').match(/DO\s*\((\d)\)/i);
    return match ? parseInt(match[1], 10) : null;
}

function countCricketMarks(turnScore) {
    const text = String(turnScore || '').trim();
    if (!text) return 0;
    return text.split(/\s*,\s*/).reduce((total, part) => {
        const token = part.trim().toUpperCase();
        if (!token) return total;
        if (token === 'DB') return total + 2;
        if (token === 'SB') return total + 1;
        const mult = token.match(/^([STD])(\d+)(X(\d+))?$/);
        if (!mult) return total;
        const base = mult[1] === 'T' ? 3 : mult[1] === 'D' ? 2 : 1;
        const repeat = mult[4] ? parseInt(mult[4], 10) : 1;
        return total + (base * repeat);
    }, 0);
}

function mapX01TurnSide(turnSide, scheduledContext, unresolvedPlayers) {
    if (!turnSide || !turnSide.name) return null;
    const resolved = resolveThrowSidePlayer(turnSide, scheduledContext, unresolvedPlayers);
    return {
        ...resolved,
        score: parseNumericValue(turnSide.turn_score) || 0,
        remaining: turnSide.current_score == null ? null : parseNumericValue(turnSide.current_score),
        checkout_darts: parseCheckoutDarts(turnSide.notable)
    };
}

function mapCricketTurnSide(turnSide, isWinningSide, scheduledContext, unresolvedPlayers) {
    if (!turnSide || !turnSide.name) return null;
    const resolved = resolveThrowSidePlayer(turnSide, scheduledContext, unresolvedPlayers);
    return {
        ...resolved,
        marks: countCricketMarks(turnSide.turn_score),
        hit: turnSide.turn_score || null,
        score: parseNumericValue(turnSide.current_score) || 0,
        closed_out: Boolean(isWinningSide && turnSide.current_score == null),
        closeout_darts: 3
    };
}

function mapGameTurnsToThrows(recapGame, winner, scheduledContext, unresolvedPlayers) {
    const turns = Array.isArray(recapGame?.turns) ? recapGame.turns : [];
    const isCricket = String(recapGame?.score_type || '').toUpperCase() === 'M';
    return turns.map((turn) => ({
        home: isCricket
            ? mapCricketTurnSide(turn.home, winner === 'home', scheduledContext, unresolvedPlayers)
            : mapX01TurnSide(turn.home, scheduledContext, unresolvedPlayers),
        away: isCricket
            ? mapCricketTurnSide(turn.away, winner === 'away', scheduledContext, unresolvedPlayers)
            : mapX01TurnSide(turn.away, scheduledContext, unresolvedPlayers)
    }));
}

function extractRosterNames(players) {
    if (!Array.isArray(players)) return [];
    return players
        .map((player, idx) => normalizeRecapLabel(player?.name, `Player ${idx + 1}`))
        .filter(Boolean);
}

function chooseSideRosterNames(sidePlayerNames, rosterNames, fallback) {
    const cleanSideNames = (sidePlayerNames || []).filter(name => name && !/^home$|^away$/i.test(name));
    if (cleanSideNames.length) return cleanSideNames;
    if (rosterNames.length) return rosterNames;
    return [fallback];
}

function extractTurnPlayerNames(turns, side) {
    const names = [];
    (Array.isArray(turns) ? turns : []).forEach((turn) => {
        const name = normalizeRecapLabel(turn?.[side]?.name, '');
        if (!name || /^home$|^away$/i.test(name) || names.includes(name)) return;
        names.push(name);
    });
    return names;
}

function isPlaceholderSideName(name) {
    return /^home$|^away$/i.test(normalizeRecapLabel(name, ''));
}

function trimLeadingPlaceholderGroups(groupedSets) {
    let startIndex = 0;
    while (startIndex < groupedSets.length) {
        const setGroup = Array.isArray(groupedSets[startIndex]) ? groupedSets[startIndex] : [];
        const names = [];
        setGroup.forEach((game) => {
            (game?.turns || []).forEach((turn) => {
                if (turn?.home?.name) names.push(turn.home.name);
                if (turn?.away?.name) names.push(turn.away.name);
            });
        });
        const normalized = names.map(name => normalizeRecapLabel(name, '')).filter(Boolean);
        if (!normalized.length || normalized.every(isPlaceholderSideName)) {
            startIndex += 1;
            continue;
        }
        break;
    }
    return {
        groups: groupedSets.slice(startIndex),
        trimmedCount: startIndex
    };
}

function collectRecapGroupSideNames(setGroup, side) {
    const names = [];
    const addName = (name) => {
        const normalized = normalizeRecapLabel(name, '');
        if (!normalized || isPlaceholderSideName(normalized) || names.includes(normalized)) return;
        names.push(normalized);
    };

    (Array.isArray(setGroup) ? setGroup : []).forEach((game) => {
        const sidePlayers = Array.isArray(game?.[side]?.players) ? game[side].players : [];
        sidePlayers.forEach((player) => addName(player?.player_label || player?.name));
        (Array.isArray(game?.turns) ? game.turns : []).forEach((turn) => {
            addName(turn?.[side]?.name);
        });
    });

    return names;
}

function buildNameAliasSet(names) {
    const aliases = new Set();
    (names || []).forEach((name) => {
        buildIdentityAliases(name).forEach((alias) => aliases.add(alias));
    });
    return aliases;
}

function countNameAliasMatches(names, aliasSet) {
    return (names || []).reduce((count, name) => {
        const aliases = buildIdentityAliases(name);
        return count + (aliases.some((alias) => aliasSet.has(alias)) ? 1 : 0);
    }, 0);
}

function scoreRecapGroupForScheduledGame(setGroup, scheduledGame) {
    if (!scheduledGame) return 0;

    const firstRecapGame = Array.isArray(setGroup) ? setGroup[0] : null;
    const recapType = mapRecapGameType(firstRecapGame?.game_name);
    const scheduledFormat = String(scheduledGame.format || '').toLowerCase();
    const scheduledType = String(scheduledGame.type || '').toLowerCase();
    let score = 0;

    if (scheduledFormat && String(recapType.format || '').toLowerCase().includes(scheduledFormat.replace(/\s+/g, ''))) {
        score += 8;
    }
    if (scheduledType && String(recapType.type || '').toLowerCase() === scheduledType) {
        score += 4;
    }

    const recapHomeNames = collectRecapGroupSideNames(setGroup, 'home');
    const recapAwayNames = collectRecapGroupSideNames(setGroup, 'away');
    const scheduledHomeAliases = buildNameAliasSet(scheduledGame.home_players);
    const scheduledAwayAliases = buildNameAliasSet(scheduledGame.away_players);

    const directMatches =
        countNameAliasMatches(recapHomeNames, scheduledHomeAliases) +
        countNameAliasMatches(recapAwayNames, scheduledAwayAliases);
    const swappedMatches =
        countNameAliasMatches(recapHomeNames, scheduledAwayAliases) +
        countNameAliasMatches(recapAwayNames, scheduledHomeAliases);

    score += Math.max(directMatches, swappedMatches) * 20;

    if (!recapHomeNames.length && !recapAwayNames.length) {
        score -= 50;
    }

    return score;
}

function selectScheduledRecapGroups(groupedSets, scheduledGames) {
    const expectedCount = Array.isArray(scheduledGames) ? scheduledGames.length : 0;
    if (!expectedCount || groupedSets.length <= expectedCount) {
        return {
            groups: groupedSets,
            selectedStart: 0,
            selectedCount: groupedSets.length,
            rawCount: groupedSets.length,
            score: null
        };
    }

    let bestStart = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let start = 0; start <= groupedSets.length - expectedCount; start += 1) {
        const windowScore = scheduledGames.reduce((total, scheduledGame, idx) => {
            return total + scoreRecapGroupForScheduledGame(groupedSets[start + idx], scheduledGame);
        }, 0);
        if (windowScore > bestScore) {
            bestScore = windowScore;
            bestStart = start;
        }
    }

    return {
        groups: groupedSets.slice(bestStart, bestStart + expectedCount),
        selectedStart: bestStart,
        selectedCount: expectedCount,
        rawCount: groupedSets.length,
        score: bestScore
    };
}

function normalizeIdentityName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const FIRST_NAME_VARIANT_GROUPS = [
    ['brian'],
    ['cesar'],
    ['chris', 'christopher'],
    ['danny', 'daniel'],
    ['david', 'dave'],
    ['dillon'],
    ['dom', 'dominick', 'dominique'],
    ['eddie', 'edward'],
    ['eric'],
    ['jennifer', 'jenn'],
    ['josh', 'joshua'],
    ['kevin'],
    ['matt', 'matthew', 'matty'],
    ['michael', 'mike'],
    ['nathan', 'nate'],
    ['nicholas', 'nick'],
    ['stephanie', 'steph'],
    ['vince', 'vincent']
];

const FIRST_NAME_VARIANTS = {};
FIRST_NAME_VARIANT_GROUPS.forEach((group) => {
    const normalizedGroup = group.map(normalizeIdentityName);
    normalizedGroup.forEach((name) => {
        FIRST_NAME_VARIANTS[name] = normalizedGroup;
    });
});

function getIdentityTokens(name) {
    return normalizeIdentityName(name).split(' ').filter(Boolean);
}

function getIdentityFirstNameVariants(firstName) {
    const normalized = normalizeIdentityName(firstName);
    return FIRST_NAME_VARIANTS[normalized] || [normalized];
}

function buildIdentityAliases(name) {
    const normalized = normalizeIdentityName(name);
    const tokens = getIdentityTokens(name);
    if (!tokens.length) return [];

    const firstName = tokens[0];
    const lastName = tokens[tokens.length - 1];
    const lastInitial = lastName?.[0] || '';
    const aliases = new Set([normalized]);

    getIdentityFirstNameVariants(firstName).forEach((variant) => {
        aliases.add(`${variant} ${lastName}`.trim());
        if (lastInitial) {
            aliases.add(`${variant} ${lastInitial}`.trim());
        }
    });

    return Array.from(aliases).filter(Boolean);
}

function editDistance(a, b) {
    const left = normalizeIdentityName(a);
    const right = normalizeIdentityName(b);
    if (!left || !right) return Math.max(left.length, right.length);
    if (left === right) return 0;

    const previous = Array.from({ length: right.length + 1 }, (_, idx) => idx);
    const current = new Array(right.length + 1);

    for (let i = 1; i <= left.length; i++) {
        current[0] = i;
        for (let j = 1; j <= right.length; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost
            );
        }
        for (let j = 0; j <= right.length; j++) previous[j] = current[j];
    }

    return previous[right.length];
}

function isLikelySamePlayerName(importedName, rosterName) {
    const importedTokens = getIdentityTokens(importedName);
    const rosterTokens = getIdentityTokens(rosterName);
    if (importedTokens.length < 2 || rosterTokens.length < 2) return false;

    const importedFirst = importedTokens[0];
    const importedLast = importedTokens[importedTokens.length - 1];
    const rosterFirst = rosterTokens[0];
    const rosterLast = rosterTokens[rosterTokens.length - 1];
    const firstCompatible = getIdentityFirstNameVariants(importedFirst).includes(rosterFirst) ||
        importedFirst[0] === rosterFirst[0] && editDistance(importedFirst, rosterFirst) <= 1;
    const lastCompatible = importedLast[0] === rosterLast[0] && editDistance(importedLast, rosterLast) <= 2;

    return firstCompatible && lastCompatible;
}

function nameAliasSetHasMatch(name, aliasSet) {
    const aliases = buildIdentityAliases(name);
    if (aliases.some((alias) => aliasSet.has(alias))) return true;
    return aliases.some((alias) => {
        for (const candidate of aliasSet) {
            if (isLikelySamePlayerName(alias, candidate)) return true;
        }
        return false;
    });
}

function choosePreferredResolvedPlayer(current, candidate, preferredIds = new Set()) {
    if (!current) return candidate;
    if (preferredIds.has(candidate.id) !== preferredIds.has(current.id)) {
        return preferredIds.has(candidate.id) ? candidate : current;
    }
    if (!!candidate.team_id !== !!current.team_id) {
        return candidate.team_id ? candidate : current;
    }
    return current;
}

function buildPlayerAliasResolver(players, preferredIds = new Set()) {
    const aliasMap = new Map();

    const setAlias = (alias, player) => {
        const normalizedAlias = normalizeIdentityName(alias);
        if (!normalizedAlias) return;
        aliasMap.set(
            normalizedAlias,
            choosePreferredResolvedPlayer(aliasMap.get(normalizedAlias), player, preferredIds)
        );
    };

    (players || []).forEach((player) => {
        buildIdentityAliases(player.name).forEach((alias) => setAlias(alias, player));
    });

    Object.entries(DEFAULT_PLAYER_IDS).forEach(([alias, playerId]) => {
        const matchingPlayer = (players || []).find((player) => player.id === playerId);
        if (matchingPlayer) {
            setAlias(alias, matchingPlayer);
        }
    });

    return function resolveImportedPlayer(rawName) {
        const normalized = normalizeIdentityName(rawName);
        if (!normalized) return null;

        const direct = aliasMap.get(normalized);
        if (direct) return direct;

        const tokens = getIdentityTokens(rawName);
        if (!tokens.length) return null;

        const firstName = tokens[0];
        const lastName = tokens[tokens.length - 1];
        const lastInitial = lastName?.[0] || '';
        const firstVariants = getIdentityFirstNameVariants(firstName);

        const byLastInitial = (players || []).filter((player) => {
            const playerTokens = getIdentityTokens(player.name);
            if (!playerTokens.length) return false;
            return firstVariants.includes(playerTokens[0]) &&
                lastInitial &&
                (playerTokens[playerTokens.length - 1]?.[0] || '') === lastInitial;
        });
        if (byLastInitial.length === 1) return byLastInitial[0];

        const byLastName = (players || []).filter((player) => {
            const playerTokens = getIdentityTokens(player.name);
            if (!playerTokens.length) return false;
            return firstVariants.includes(playerTokens[0]) &&
                playerTokens[playerTokens.length - 1] === lastName;
        });
        if (byLastName.length === 1) return byLastName[0];

        const fuzzyMatches = (players || []).filter((player) => isLikelySamePlayerName(rawName, player.name));
        if (fuzzyMatches.length === 1) return fuzzyMatches[0];

        return null;
    };
}

function buildRosterAliasSet(rosterPlayers) {
    const aliases = new Set();
    const rosterIds = new Set((rosterPlayers || []).map(player => player.id).filter(Boolean));
    (rosterPlayers || []).forEach((player) => {
        buildIdentityAliases(player.name).forEach((alias) => aliases.add(alias));
    });
    Object.entries(DEFAULT_PLAYER_IDS).forEach(([alias, playerId]) => {
        if (rosterIds.has(playerId)) {
            aliases.add(normalizeIdentityName(alias));
        }
    });
    return aliases;
}

function resolveThrowSidePlayer(turnSide, scheduledContext, unresolvedPlayers) {
    if (!turnSide || !turnSide.name) return null;

    const importedLabel = normalizeRecapLabel(turnSide.name, 'Unknown Player');
    const resolvedPlayer = scheduledContext?.resolveImportedPlayer
        ? scheduledContext.resolveImportedPlayer(importedLabel)
        : null;

    if (!resolvedPlayer && unresolvedPlayers && importedLabel && !isPlaceholderSideName(importedLabel)) {
        unresolvedPlayers.add(importedLabel);
    }

    return {
        imported_player_label: importedLabel,
        player: resolvedPlayer?.name || importedLabel,
        player_name: resolvedPlayer?.name || importedLabel,
        player_id: resolvedPlayer?.id || null
    };
}

function countRosterMatches(names, aliasSet) {
    return (names || []).reduce((count, name) => count + (nameAliasSetHasMatch(name, aliasSet) ? 1 : 0), 0);
}

function swapMappedGameSides(game) {
    return {
        ...game,
        home_players: game.away_players,
        away_players: game.home_players,
        result: {
            home_legs: game.result?.away_legs || 0,
            away_legs: game.result?.home_legs || 0
        },
        winner: game.winner === 'home' ? 'away' : game.winner === 'away' ? 'home' : game.winner,
        legs: (game.legs || []).map(swapLegData)
    };
}

function orientGameToSchedule(game, scheduledContext) {
    if (!scheduledContext) return game;
    const homeMatchesHome = countRosterMatches(game.home_players, scheduledContext.homeAliasSet);
    const homeMatchesAway = countRosterMatches(game.home_players, scheduledContext.awayAliasSet);
    const awayMatchesHome = countRosterMatches(game.away_players, scheduledContext.homeAliasSet);
    const awayMatchesAway = countRosterMatches(game.away_players, scheduledContext.awayAliasSet);

    const shouldSwap =
        homeMatchesAway > homeMatchesHome &&
        awayMatchesHome > awayMatchesAway;

    if (!shouldSwap) return game;
    return swapMappedGameSides(game);
}

function collectPlaceholderThrowPlayers(matchData) {
    const placeholders = new Set();
    (matchData?.games || []).forEach((game) => {
        (game?.legs || []).forEach((leg) => {
            (leg?.throws || []).forEach((round) => {
                ['home', 'away'].forEach((side) => {
                    const player = normalizeRecapLabel(round?.[side]?.player, '');
                    if (/^home$|^away$/i.test(player)) placeholders.add(player);
                });
            });
        });
    });
    return Array.from(placeholders);
}

async function buildScheduledMatchContext(leagueId, matchId) {
    if (!leagueId || !matchId) return null;

    const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
        throw new Error('Scheduled match not found for supplied leagueId/matchId');
    }

    const leagueDoc = await db.collection('leagues').doc(leagueId).get();
    const league = leagueDoc.exists ? leagueDoc.data() : {};
    const teamRefs = await Promise.all([
        db.collection('leagues').doc(leagueId).collection('teams').doc(matchDoc.data().home_team_id).get(),
        db.collection('leagues').doc(leagueId).collection('teams').doc(matchDoc.data().away_team_id).get()
    ]);
    const teamsById = new Map();
    if (teamRefs[0].exists) teamsById.set(matchDoc.data().home_team_id, teamRefs[0].data());
    if (teamRefs[1].exists) teamsById.set(matchDoc.data().away_team_id, teamRefs[1].data());
    const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').get();
    const allPlayers = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return buildScheduledMatchContextFromData(matchDoc.id, matchDoc.data(), league, teamsById, allPlayers);
}

function buildScheduledMatchContextFromData(matchId, match, league, teamsById, allPlayers) {
    const homeTeam = teamsById.get(match.home_team_id) || null;
    const awayTeam = teamsById.get(match.away_team_id) || null;
    const homeRoster = allPlayers.filter(player => player.team_id === match.home_team_id);
    const awayRoster = allPlayers.filter(player => player.team_id === match.away_team_id);
    const preferredPlayerIds = new Set([
        ...homeRoster.map(player => player.id),
        ...awayRoster.map(player => player.id)
    ]);

    const scheduledGames = Array.isArray(match.games) && match.games.length
        ? match.games.map((game, idx) => ({
            game_number: game.game_number || idx + 1,
            type: game.type || null,
            format: game.format || null,
            home_players: (game.home_players || []).map(player => typeof player === 'string' ? player : player?.name).filter(Boolean),
            away_players: (game.away_players || []).map(player => typeof player === 'string' ? player : player?.name).filter(Boolean)
        }))
        : ((league?.league_type === 'triples_draft' && homeTeam?.players && awayTeam?.players)
            ? TRIPLES_MATCH_FORMAT.map((format) => ({
                game_number: format.game,
                type: format.type,
                format: format.format,
                home_players: format.homePositions
                    .map(pos => homeTeam.players.find(player => player.position === pos)?.name)
                    .filter(Boolean),
                away_players: format.awayPositions
                    .map(pos => awayTeam.players.find(player => player.position === pos)?.name)
                    .filter(Boolean)
            }))
            : []);

    return {
        matchId,
        home_team: match.home_team_name,
        away_team: match.away_team_name,
        match_date: match.match_date || match.scheduled_date || null,
        week: match.week || null,
        homeRoster,
        awayRoster,
        homeAliasSet: buildRosterAliasSet(homeRoster),
        awayAliasSet: buildRosterAliasSet(awayRoster),
        scheduledGames,
        resolveImportedPlayer: buildPlayerAliasResolver(allPlayers, preferredPlayerIds)
    };
}

function normalizeDateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
        if (iso) return iso[1];
        const dartConnect = value.match(/\b(\d{1,2})-([A-Za-z]{3})-(\d{4})\b/);
        if (dartConnect) {
            const monthMap = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            const month = monthMap[dartConnect[2].toLowerCase()];
            if (month) return `${dartConnect[3]}-${month}-${String(dartConnect[1]).padStart(2, '0')}`;
        }
    }
    if (value?.seconds) {
        return new Date(value.seconds * 1000).toISOString().slice(0, 10);
    }
    return null;
}

async function verifyTeamMemberImportAccess(req, leagueId, match, actorId, teamId) {
    if (!actorId && !teamId) {
        return { checked: false };
    }
    if (!actorId) {
        return { checked: true, ok: false, error: 'Member imports require player_id' };
    }
    if (teamId && ![match.home_team_id, match.away_team_id].includes(teamId)) {
        return { checked: true, ok: false, error: 'Members can only import matches involving their team' };
    }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        return { checked: true, ok: false, error: 'Member import requires Firebase authentication' };
    }

    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        return { checked: true, ok: false, error: 'Invalid Firebase authentication token' };
    }

    const playerDoc = await db.collection('leagues').doc(leagueId).collection('players').doc(actorId).get();
    let player = playerDoc.exists ? { id: playerDoc.id, ...playerDoc.data() } : null;

    if (!player) {
        const globalPlayerDoc = await db.collection('players').doc(actorId).get();
        if (globalPlayerDoc.exists) {
            player = { id: globalPlayerDoc.id, ...globalPlayerDoc.data() };
        }
    }

    if (!player && decoded.email) {
        const playerSnap = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .where('email', '==', decoded.email.toLowerCase())
            .limit(1)
            .get();
        if (!playerSnap.empty) {
            player = { id: playerSnap.docs[0].id, ...playerSnap.docs[0].data() };
        }
    }

    const emailMatches = decoded.email && player?.email &&
        String(player.email).toLowerCase() === decoded.email.toLowerCase();
    const globalMatches = player?.global_player_id && player.global_player_id === actorId;
    const playerName = normalizeIdentityName(player?.name);
    const possibleTeamIds = [match.home_team_id, match.away_team_id].filter(Boolean);
    const teamMatches = [];

    for (const possibleTeamId of possibleTeamIds) {
        if (teamId && possibleTeamId !== teamId) continue;
        const teamDoc = await db.collection('leagues').doc(leagueId).collection('teams').doc(possibleTeamId).get();
        const team = teamDoc.exists ? teamDoc.data() : {};
        const rosterIds = Array.isArray(team.player_ids) ? team.player_ids : [];
        const rosterNames = Array.isArray(team.player_names) ? team.player_names : [];
        const rosterMatches = Boolean(player) && (
            player.team_id === possibleTeamId ||
            rosterIds.includes(player.id) ||
            rosterIds.includes(player.global_player_id) ||
            (playerName && rosterNames.some(name => isLikelySamePlayerName(playerName, name) || normalizeIdentityName(name) === playerName))
        );
        if (rosterMatches) {
            teamMatches.push(possibleTeamId);
        }
    }

    if (!player || !emailMatches || teamMatches.length !== 1) {
        return { checked: true, ok: false, error: 'Not authorized as a member of this team' };
    }

    return {
        checked: true,
        ok: true,
        player_id: player.id,
        team_id: teamMatches[0],
        global_player_id: globalMatches ? actorId : player.global_player_id || null
    };
}

function scoreScheduledContextForPayload(context, payload, recapDate) {
    const props = payload?.props || {};
    const segments = props.segments || {};
    const groupedSets = [];
    Object.keys(segments).forEach((segmentKey) => {
        const segmentGroups = Array.isArray(segments[segmentKey]) ? segments[segmentKey] : [];
        segmentGroups.forEach((setGroup) => {
            if (Array.isArray(setGroup) && setGroup.length) groupedSets.push(setGroup);
        });
    });

    const trimmed = trimLeadingPlaceholderGroups(groupedSets);
    const selected = selectScheduledRecapGroups(trimmed.groups, context.scheduledGames);
    const dateScore = recapDate && normalizeDateOnly(context.match_date) === recapDate ? 250 : 0;
    const shapeScore = selected.selectedCount === context.scheduledGames.length ? 100 : -100;
    return {
        score: (selected.score || 0) + dateScore + shapeScore,
        selected
    };
}

async function resolveScheduledMatchContextFromPayload(leagueId, payload) {
    const leagueDoc = await db.collection('leagues').doc(leagueId).get();
    const league = leagueDoc.exists ? leagueDoc.data() : {};
    const [matchesSnap, teamsSnap, playersSnap] = await Promise.all([
        db.collection('leagues').doc(leagueId).collection('matches').get(),
        db.collection('leagues').doc(leagueId).collection('teams').get(),
        db.collection('leagues').doc(leagueId).collection('players').get()
    ]);
    const teamsById = new Map(teamsSnap.docs.map(doc => [doc.id, doc.data()]));
    const allPlayers = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const recapDate = normalizeDateOnly(payload?.props?.matchInfo?.server_match_start_date);

    const candidates = matchesSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() }))
        .filter(({ data }) => !recapDate || normalizeDateOnly(data.match_date || data.scheduled_date) === recapDate)
        .map(({ id, data }) => {
            const context = buildScheduledMatchContextFromData(id, data, league, teamsById, allPlayers);
            const score = scoreScheduledContextForPayload(context, payload, recapDate);
            return {
                context,
                score: score.score,
                selected: score.selected,
                match: data
            };
        })
        .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
        throw new Error(recapDate
            ? `No scheduled BRDC matches found for DartConnect date ${recapDate}`
            : 'No scheduled BRDC matches found for this league');
    }

    const [best, second] = candidates;
    if (best.score < 250 || (second && best.score - second.score < 80)) {
        const bestLabel = `${best.match.home_team_name || 'Home'} vs ${best.match.away_team_name || 'Away'} (${best.context.matchId})`;
        const secondLabel = second
            ? `${second.match.home_team_name || 'Home'} vs ${second.match.away_team_name || 'Away'} (${second.context.matchId})`
            : 'none';
        throw new Error(`Unable to confidently match DartConnect recap to the schedule. Best: ${bestLabel}; next: ${secondLabel}. Select the match manually.`);
    }

    return {
        context: best.context,
        autoMatch: {
            match_id: best.context.matchId,
            score: best.score,
            next_score: second?.score || null,
            candidate_count: candidates.length,
            date: recapDate,
            home_team: best.context.home_team,
            away_team: best.context.away_team,
            week: best.match.week || null
        }
    };
}

function buildMatchDataFromRecapPayload(payload, recapUrl, gamesUrl, scheduledContext = null) {
    const props = payload?.props || {};
    const matchInfo = props.matchInfo || {};
    const segments = props.segments || {};
    const homeRoster = scheduledContext?.homeRoster?.map(player => player.name) || extractRosterNames(props.homePlayers);
    const awayRoster = scheduledContext?.awayRoster?.map(player => player.name) || extractRosterNames(props.awayPlayers);
    const segmentKeys = Object.keys(segments);
    const groupedSets = [];

    segmentKeys.forEach((segmentKey) => {
        const segmentGroups = Array.isArray(segments[segmentKey]) ? segments[segmentKey] : [];
        segmentGroups.forEach((setGroup) => {
            if (Array.isArray(setGroup) && setGroup.length) {
                groupedSets.push(setGroup);
            }
        });
    });
    const trimmed = trimLeadingPlaceholderGroups(groupedSets);
    const selected = selectScheduledRecapGroups(trimmed.groups, scheduledContext?.scheduledGames);
    const activeGroupedSets = selected.groups;
    const parsedGroupCount = activeGroupedSets.length;

    let gameNumber = 1;
    let homeWins = 0;
    let awayWins = 0;
    let totalLegs = 0;
    let summaryOnlyLegs = 0;
    let totalDarts = 0;
    const unresolvedPlayers = new Set();

    const games = activeGroupedSets.map((setGroup, setIdx) => {
        const scheduledGame = scheduledContext?.scheduledGames?.[setIdx] || null;
        const firstRecapGame = setGroup[0] || {};
        const defaultType = scheduledGame?.type || mapRecapGameType(firstRecapGame?.game_name).type;
        const defaultFormat = scheduledGame?.format || mapRecapGameType(firstRecapGame?.game_name).format;

        const setHomePlayers = [];
        const setAwayPlayers = [];
        const addUnique = (target, names) => {
            (names || []).forEach((name) => {
                if (!name || target.includes(name)) return;
                target.push(name);
            });
        };

        const legs = setGroup.map((recapGame, legIdx) => {
            const { format } = mapRecapGameType(recapGame?.game_name);
            const recapHomePlayers = Array.isArray(recapGame?.home?.players)
                ? recapGame.home.players.map((player, idx) => normalizeRecapLabel(player?.player_label, `Home Player ${idx + 1}`))
                : [];
            const recapAwayPlayers = Array.isArray(recapGame?.away?.players)
                ? recapGame.away.players.map((player, idx) => normalizeRecapLabel(player?.player_label, `Away Player ${idx + 1}`))
                : [];
            const turnHomePlayers = extractTurnPlayerNames(recapGame?.turns, 'home');
            const turnAwayPlayers = extractTurnPlayerNames(recapGame?.turns, 'away');
            addUnique(setHomePlayers, turnHomePlayers.length ? turnHomePlayers : recapHomePlayers);
            addUnique(setAwayPlayers, turnAwayPlayers.length ? turnAwayPlayers : recapAwayPlayers);

            const winner = recapGame?.winner_index === 0 ? 'home' : recapGame?.winner_index === 1 ? 'away' : null;
            totalLegs += 1;
            totalDarts += parseNumericValue(recapGame?.home?.darts_thrown) || 0;
            totalDarts += parseNumericValue(recapGame?.away?.darts_thrown) || 0;
            const throws = mapGameTurnsToThrows(recapGame, winner, scheduledContext, unresolvedPlayers);
            if (!throws.length) summaryOnlyLegs += 1;

            return {
                leg_number: legIdx + 1,
                format,
                winner,
                home_stats: {
                    ppr: parseNumericValue(recapGame?.home?.ppr),
                    mpr: parseNumericValue(recapGame?.home?.mpr),
                    starting_points: parseNumericValue(recapGame?.home?.starting_points),
                    ending_points: parseNumericValue(recapGame?.home?.ending_points),
                    double_out_points: parseNumericValue(recapGame?.home?.double_out_points),
                    ending_marks: parseNumericValue(recapGame?.home?.ending_marks)
                },
                away_stats: {
                    ppr: parseNumericValue(recapGame?.away?.ppr),
                    mpr: parseNumericValue(recapGame?.away?.mpr),
                    starting_points: parseNumericValue(recapGame?.away?.starting_points),
                    ending_points: parseNumericValue(recapGame?.away?.ending_points),
                    double_out_points: parseNumericValue(recapGame?.away?.double_out_points),
                    ending_marks: parseNumericValue(recapGame?.away?.ending_marks)
                },
                player_stats: {},
                throws
            };
        });

        const homePlayers = scheduledGame?.home_players?.length
            ? scheduledGame.home_players
            : chooseSideRosterNames(setHomePlayers, homeRoster, 'Home');
        const awayPlayers = scheduledGame?.away_players?.length
            ? scheduledGame.away_players
            : chooseSideRosterNames(setAwayPlayers, awayRoster, 'Away');

        const homeLegsWon = legs.filter(leg => leg.winner === 'home').length;
        const awayLegsWon = legs.filter(leg => leg.winner === 'away').length;
        const winner = homeLegsWon > awayLegsWon ? 'home' : awayLegsWon > homeLegsWon ? 'away' : null;

        if (winner === 'home') homeWins += 1;
        if (winner === 'away') awayWins += 1;

        const mappedGame = {
            game_number: scheduledGame?.game_number || gameNumber++,
            set: setIdx + 1,
            type: defaultType,
            format: defaultFormat,
            home_players: homePlayers,
            away_players: awayPlayers,
            result: {
                home_legs: homeLegsWon,
                away_legs: awayLegsWon
            },
            winner,
            legs
        };

        return orientGameToSchedule(mappedGame, scheduledContext);
    });

    const homeTeam = scheduledContext?.home_team || normalizeRecapLabel(matchInfo.home_label, 'Home');
    const awayTeam = scheduledContext?.away_team || normalizeRecapLabel(matchInfo.away_label, 'Away');
    const matchTotalDarts = totalDarts;
    const teamLabelsMissing = !scheduledContext && (!matchInfo.home_label || !matchInfo.away_label);

    return {
        matchData: {
            home_team: homeTeam,
            away_team: awayTeam,
            final_score: {
                home: homeWins,
                away: awayWins
            },
            total_darts: matchTotalDarts,
            total_legs: totalLegs,
            total_sets: games.length,
            start_time: null,
            end_time: null,
            games
        },
        parseSummary: {
            recap_url: recapUrl,
            games_url: gamesUrl,
            component: payload?.component || null,
            page_url: payload?.url || null,
            recapv1_url: matchInfo.recapv1_url || null,
            games: games.length,
            legs: totalLegs,
            summary_only_legs: summaryOnlyLegs,
            segment_keys: segmentKeys,
            home_label: matchInfo.home_label || null,
            away_label: matchInfo.away_label || null,
            team_labels_missing: teamLabelsMissing,
            schedule_match_id: scheduledContext?.matchId || null,
            parsed_group_count: parsedGroupCount,
            raw_group_count: selected.rawCount,
            scheduled_game_count: scheduledContext?.scheduledGames?.length || null,
            trimmed_placeholder_groups: trimmed.trimmedCount,
            selected_group_start: selected.selectedStart,
            selected_group_count: selected.selectedCount,
            selected_group_score: selected.score,
            unresolved_turn_players: Array.from(unresolvedPlayers),
            unresolved_turn_player_count: unresolvedPlayers.size
        }
    };
}

exports.validateImportMatchData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { matchData } = req.body;
        const validation = validateImportedMatchPayload(matchData);

        res.json({
            success: true,
            validation
        });
    } catch (error) {
        console.error('Import validation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.parseDartConnectRecap = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { recapUrl, html, leagueId, matchId } = req.body || {};
        if (!recapUrl && !html) {
            res.status(400).json({ error: 'Missing required field: recapUrl or html' });
            return;
        }
        if (recapUrl && !leagueId) {
            res.status(400).json({ error: 'Schedule-anchored recap parsing requires leagueId' });
            return;
        }

        const sourceUrl = recapUrl || null;
        const gamesUrl = sourceUrl ? buildGamesDetailUrl(sourceUrl) : null;

        let pageHtml = html;
        if (!pageHtml) {
            const response = await axios.get(gamesUrl, {
                responseType: 'text',
                timeout: 30000,
                headers: {
                    'User-Agent': 'BRDC-Import-Parser/1.0'
                }
            });
            pageHtml = response.data;
        }

        const payload = extractRecapDataPagePayload(pageHtml);
        let autoMatch = null;
        const scheduledContext = (leagueId && matchId)
            ? await buildScheduledMatchContext(leagueId, matchId)
            : leagueId
                ? (await resolveScheduledMatchContextFromPayload(leagueId, payload))
                : null;
        const resolvedContext = scheduledContext?.context || scheduledContext;
        if (scheduledContext?.autoMatch) {
            autoMatch = scheduledContext.autoMatch;
        }
        const { matchData, parseSummary } = buildMatchDataFromRecapPayload(payload, sourceUrl, gamesUrl, resolvedContext);
        if (autoMatch) {
            parseSummary.auto_match = autoMatch;
        }
        const validation = validateImportedMatchPayload(matchData);
        const placeholderPlayers = collectPlaceholderThrowPlayers(matchData);
        const scheduledGameCount = parseSummary.scheduled_game_count;
        const parsedGroupCount = parseSummary.parsed_group_count;
        if (parseSummary.team_labels_missing) {
            validation.valid = false;
            validation.errors = validation.errors || [];
            validation.errors.push('Game detail page does not expose reliable home/away team labels. Set matchData.home_team and matchData.away_team manually before import.');
        }
        if (scheduledGameCount && parsedGroupCount !== scheduledGameCount) {
            validation.valid = false;
            validation.errors = validation.errors || [];
            validation.errors.push(`Parsed game-detail structure does not match the scheduled BRDC layout: parsed ${parsedGroupCount} groups, scheduled ${scheduledGameCount} games.`);
        }
        if (placeholderPlayers.length) {
            validation.valid = false;
            validation.errors = validation.errors || [];
            validation.errors.push(`Game detail turns still contain placeholder player labels: ${placeholderPlayers.join(', ')}. Resolve player names before import.`);
        }

        res.json({
            success: true,
            parse_summary: parseSummary,
            matchData,
            validation
        });
    } catch (error) {
        console.error('DartConnect recap parse error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Import match data with throw-level detail.
 * Called with match data JSON in request body.
 * Automatically detects and handles home/away team swaps.
 *
 * Contract:
 * - leg.throws is the canonical source of truth for downstream stats
 * - leg.player_stats is retained only as non-authoritative import context
 * - callers should normalize imported reports into throws before storage
 */
exports.importMatchData = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { matchId, leagueId, matchData, parseSummary, captain_id, player_id, team_id } = req.body;

        if (!matchId || !leagueId || !matchData) {
            res.status(400).json({ error: 'Missing required fields: matchId, leagueId, matchData' });
            return;
        }

        const validation = validateImportedMatchPayload(matchData);
        if (!validation.valid) {
            res.status(400).json({
                error: 'Import payload failed validation',
                validation
            });
            return;
        }

        const hasParseSummary = parseSummary && typeof parseSummary === 'object';
        const hasScheduleAnchor = hasParseSummary &&
            parseSummary.schedule_match_id &&
            parseSummary.schedule_match_id === matchId;
        const parsedGroupCount = hasParseSummary ? parseSummary.parsed_group_count : null;
        const scheduledGameCount = hasParseSummary ? parseSummary.scheduled_game_count : null;
        const hasMatchingScheduleShape = !scheduledGameCount ||
            !parsedGroupCount ||
            parsedGroupCount === scheduledGameCount;

        if (hasParseSummary && parseSummary.schedule_match_id && parseSummary.schedule_match_id !== matchId) {
            res.status(400).json({
                error: `Import parse summary is anchored to ${parseSummary.schedule_match_id}, but the request targets ${matchId}`
            });
            return;
        }

        if (hasParseSummary && parseSummary.team_labels_missing) {
            res.status(400).json({
                error: 'Import parse summary indicates missing home/away team labels; import must be corrected before storage'
            });
            return;
        }

        if (hasParseSummary && !hasMatchingScheduleShape) {
            res.status(400).json({
                error: `Import parse summary does not match scheduled structure: parsed ${parsedGroupCount} groups, scheduled ${scheduledGameCount} games`
            });
            return;
        }

        const canonicalScheduleAnchoredImport = hasScheduleAnchor && hasMatchingScheduleShape;
        const importSource = canonicalScheduleAnchoredImport
            ? 'dartconnect_recap_canonical'
            : 'manual_review_import';
        const importReviewStatus = canonicalScheduleAnchoredImport
            ? 'validated_canonical'
            : 'manual_review_required';

        // Fetch existing match to check team orientation
        const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found in Firestore' });
            return;
        }

        const existingMatch = matchDoc.data();
        const memberAccess = await verifyTeamMemberImportAccess(req, leagueId, existingMatch, player_id || captain_id, team_id);
        if (memberAccess.checked && !memberAccess.ok) {
            res.status(403).json({ error: memberAccess.error });
            return;
        }
        const needsSwap = !teamsMatch(matchData.home_team, existingMatch.home_team_name);

        console.log(`Import: ${matchData.home_team} vs ${matchData.away_team}`);
        console.log(`Firestore: ${existingMatch.home_team_name} vs ${existingMatch.away_team_name}`);
        console.log(`Needs swap: ${needsSwap}`);

        // Convert games to Firestore format, swapping if needed
        const firestoreGames = matchData.games.map((game, idx) => {
            const legs = game.legs.map(leg => {
                const baseLeg = {
                    leg_number: leg.leg_number,
                    format: leg.format,
                    winner: leg.winner,
                    home_stats: leg.home_stats,
                    away_stats: leg.away_stats,
                    player_stats: leg.player_stats,
                    throws: leg.throws
                };
                // Add checkout_darts if present (for 501 games)
                if (leg.checkout_darts) {
                    baseLeg.checkout_darts = leg.checkout_darts;
                }
                // Add checkout score if present
                if (leg.checkout) {
                    baseLeg.checkout = leg.checkout;
                }
                return needsSwap ? swapLegData(baseLeg) : baseLeg;
            });

            if (needsSwap) {
                return {
                    game: game.game_number,
                    set: game.set,
                    type: game.type,
                    format: game.format,
                    home_players: game.away_players,
                    away_players: game.home_players,
                    home_legs_won: game.result.away_legs,
                    away_legs_won: game.result.home_legs,
                    winner: game.winner === 'home' ? 'away' : game.winner === 'away' ? 'home' : game.winner,
                    status: 'completed',
                    legs
                };
            } else {
                return {
                    game: game.game_number,
                    set: game.set,
                    type: game.type,
                    format: game.format,
                    home_players: game.home_players,
                    away_players: game.away_players,
                    home_legs_won: game.result.home_legs,
                    away_legs_won: game.result.away_legs,
                    winner: game.winner,
                    status: 'completed',
                    legs
                };
            }
        });

        // Swap scores if needed
        const homeScore = needsSwap ? matchData.final_score.away : matchData.final_score.home;
        const awayScore = needsSwap ? matchData.final_score.home : matchData.final_score.away;

        const matchWinner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie';
        const updateData = {
            games: firestoreGames,
            home_score: homeScore,
            away_score: awayScore,
            winner: matchWinner,
            total_darts: matchData.total_darts,
            total_legs: matchData.total_legs,
            total_sets: matchData.total_sets || firestoreGames.length,
            status: 'completed',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            import_source: importSource,
            import_truth_source: 'throws',
            import_contract_version: '2026-04-09-throws-first',
            import_review_status: importReviewStatus,
            import_validation: {
                ...validation.metrics,
                warning_count: validation.warnings.length,
                canonical_schedule_anchored: canonicalScheduleAnchoredImport
            },
            teams_swapped: needsSwap
        };

        if (parseSummary && typeof parseSummary === 'object') {
            updateData.import_parse_summary = {
                component: parseSummary.component || null,
                recap_url: parseSummary.recap_url || null,
                games_url: parseSummary.games_url || null,
                trimmed_placeholder_groups: parseSummary.trimmed_placeholder_groups ?? 0,
                parsed_group_count: parseSummary.parsed_group_count ?? null,
                scheduled_game_count: parseSummary.scheduled_game_count ?? null,
                schedule_match_id: parseSummary.schedule_match_id || null,
                summary_only_legs: parseSummary.summary_only_legs ?? 0,
                unresolved_turn_players: Array.isArray(parseSummary.unresolved_turn_players)
                    ? parseSummary.unresolved_turn_players
                    : [],
                unresolved_turn_player_count: parseSummary.unresolved_turn_player_count ?? 0,
                team_labels_missing: Boolean(parseSummary.team_labels_missing),
                imported_at: admin.firestore.FieldValue.serverTimestamp()
            };
        }

        // Add timing metadata if available
        if (matchData.start_time) {
            updateData.start_time = new Date(matchData.start_time);
        }
        if (matchData.end_time) {
            updateData.end_time = new Date(matchData.end_time);
        }
        if (matchData.game_time_minutes != null) {
            updateData.game_time_minutes = matchData.game_time_minutes;
        }
        if (matchData.match_length_minutes != null) {
            updateData.match_length_minutes = matchData.match_length_minutes;
        }

        await matchRef.update(updateData);

        res.json({
            success: true,
            matchId,
            games: firestoreGames.length,
            totalLegs: matchData.total_legs,
            teamsSwapped: needsSwap,
            importSource,
            importReviewStatus,
            finalScore: { home: homeScore, away: awayScore },
            validation,
            importParseSummary: updateData.import_parse_summary || null
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Find match by team names and week
 */
exports.findMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, homeTeam, awayTeam, week } = req.query;

        if (!leagueId || !homeTeam || !awayTeam) {
            res.status(400).json({ error: 'Missing required params' });
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');
        const snapshot = await matchesRef.where('week', '==', parseInt(week) || 1).get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const homeMatch = data.home_team_name?.toUpperCase().includes(homeTeam.toUpperCase());
            const awayMatch = data.away_team_name?.toUpperCase().includes(awayTeam.toUpperCase());

            if (homeMatch && awayMatch) {
                res.json({
                    matchId: doc.id,
                    homeTeam: data.home_team_name,
                    awayTeam: data.away_team_name,
                    week: data.week,
                    status: data.status
                });
                return;
            }
        }

        res.status(404).json({ error: 'Match not found' });

    } catch (error) {
        console.error('Find match error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * List all matches for a league week
 */
exports.listMatches = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, week } = req.query;

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');
        let query = matchesRef;

        if (week) {
            query = query.where('week', '==', parseInt(week));
        }

        const snapshot = await query.get();

        const matches = snapshot.docs.map(doc => ({
            matchId: doc.id,
            homeTeam: doc.data().home_team_name,
            awayTeam: doc.data().away_team_name,
            week: doc.data().week,
            status: doc.data().status,
            homeScore: doc.data().home_score,
            awayScore: doc.data().away_score
        }));

        res.json({ matches });

    } catch (error) {
        console.error('List matches error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fix swapped scores in existing matches
 * Pass matchIds and their correct scores
 */
exports.fixMatchScores = importMatchesAdmin.fixMatchScores;

/**
 * Update match scores to use sets (games won) instead of legs
 * Also updates team standings
 */
exports.updateToSetScores = importMatchesAdmin.updateToSetScores;

// Default player mapping from names to IDs (can be overridden via API)
const DEFAULT_PLAYER_IDS = {
            // M. Pagel team
            'Matt Pagel': 'maH2vUZbuVLBbBQwoIqW',
            'Matthew Pagel': 'maH2vUZbuVLBbBQwoIqW',  // RTF full name variant
            'Joe Peters': 'pERxbhcN3VNAvu6wFN9o',
            'John Linden': '06IoctkB8mTTSPBGRbu5',
            'Dave Bonness': 'nDPDqXbEBJvUgGl2iXF3',
            'David Bonness': 'nDPDqXbEBJvUgGl2iXF3',
            // D. Pagel team
            'Donnie Pagel': 'X2DMb9bP4Q8fy9yr5Fam',
            'Jennifer Malek': '7Hj4KWNpm0GviTYbwfbM',
            'Jenn Malek': '7Hj4KWNpm0GviTYbwfbM',  // RTF variant
            'Jenn M': '7Hj4KWNpm0GviTYbwfbM',
            'Matthew Wentz': 'TJ3uwMdslbtpjtq17xW4',
            'Matt Wentz': 'TJ3uwMdslbtpjtq17xW4',  // RTF short variant
            'Christian Ketchum': '89RkfFLOhvUwV83ZS5J4',
            'Christian Ketchem': '89RkfFLOhvUwV83ZS5J4',  // RTF typo variant
            // N. Kull team
            'Nathan Kull': 'bsAlnR7Ii1pWmMvsWzrS',
            'Nate Kull': 'bsAlnR7Ii1pWmMvsWzrS',
            'Michael Jarvis': '7GH1SWRR3dAyAVxgMqvf',
            'Mike Jarvis': '7GH1SWRR3dAyAVxgMqvf',  // RTF short variant
            'Stephanie Kull': '4sly23nOXhC475q95R4L',
            'Steph Kull': '4sly23nOXhC475q95R4L',
            // K. Yasenchak team
            'Kevin Yasenchak': 'dr4ML1i9ZeMI7SNisX6E',
            'Kevin Y': 'dr4ML1i9ZeMI7SNisX6E',  // RTF abbreviation
            'Brian Smith': 'bIv2rga3jBSvzsQ2khne',
            'Brian S': 'bIv2rga3jBSvzsQ2khne',  // RTF abbreviation
            'Cesar Andino': 'Dag2lYDtqoo4kc3cRHHa',
            'Cesar A': 'Dag2lYDtqoo4kc3cRHHa',  // RTF abbreviation
            // D. Partlo team
            'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
            'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
            'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
            'Kevin McKelvey': 'Gmxl5I2CtVXYns4b4AeU',  // RTF capital K variant
            // E. Olschansky team
            'Eddie Olschansky': 'wLMJoz1GylfVCMM32nWm',
            'Eddie Olschanskey': 'wLMJoz1GylfVCMM32nWm',  // RTF typo variant
            'Eddie O': 'wLMJoz1GylfVCMM32nWm',  // RTF abbreviation
            'Jeff Boss': 'Tj1LsOtRiJwHW4r4sgWa',
            'Michael Gonzalez': 'FfODZtkFiGUEzptzD8tH',
            'Mike Gonzalez': 'FfODZtkFiGUEzptzD8tH',
            'Mike Gonzales': 'FfODZtkFiGUEzptzD8tH',  // RTF variant
            'Mike Gonz': 'FfODZtkFiGUEzptzD8tH',  // RTF abbreviation
            // J. Ragnoni team
            'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
            'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
            'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
            'Dave Brunner': 'ctnV5Je72HAIyVpE5zjS',
            'Derek Fess': 'vVR4AOITXYzhR2H4GqzI',
            'Derek': 'vVR4AOITXYzhR2H4GqzI',  // RTF first name only
            'DF': 'vVR4AOITXYzhR2H4GqzI',  // RTF initials
            'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
            'Joshua kelly': '34GDgRRFk0uFmOvyykHE',  // RTF lowercase variant
            'JK': '34GDgRRFk0uFmOvyykHE',  // RTF initials
            // Neon Nightmares (T. Massimiani) team
            'Tony Massimiani': 'gqhzEQLifL402lQwDMpH',
            'TM': 'gqhzEQLifL402lQwDMpH',  // RTF initials
            'Dominick Russano': 'pL9CGc688ZpxbPKJ11cZ',
            'Dom Russano': 'pL9CGc688ZpxbPKJ11cZ',
            'DR': 'pL9CGc688ZpxbPKJ11cZ',  // RTF initials
            'Chris Benco': 'rZ57ofUYFXPSrrhyBVkz',
            'Chris B': 'rZ57ofUYFXPSrrhyBVkz',  // RTF abbreviation
            // N. Mezlak team
            'Nick Mezlak': 'yGcBLDcTwgHtWmZEg3TG',
            'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
            'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
            'Dillon U': 'dFmalrT5BMdaTOUUVTOZ',  // RTF abbreviation
            'Dillon Ullises': 'dFmalrT5BMdaTOUUVTOZ',  // RTF misspelling
            // D. Russano team
            'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
            'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
            'Eric Duale': 'NCeaIaMXsXVN135pX91L',
            'Eric D': 'NCeaIaMXsXVN135pX91L',
            'Eric': 'NCeaIaMXsXVN135pX91L',  // RTF first name only
            // Fill-ins / Alternates
            'Luke Kollias': 'mFyX9sv1l95V0czECUKu',
            'Anthony Donley': 'YHCbJsXKYjFMPk5Wk7kd',
            'Tony Rook': 'AwrGDvwsdPQ52kfRTLMk',
            'TR': 'AwrGDvwsdPQ52kfRTLMk'
};

// Canonical display names per player ID (used for consistent stat doc names)
const DEFAULT_CANONICAL_NAMES = {
            'maH2vUZbuVLBbBQwoIqW': 'Matt Pagel',
            'pERxbhcN3VNAvu6wFN9o': 'Joe Peters',
            '06IoctkB8mTTSPBGRbu5': 'John Linden',
            'nDPDqXbEBJvUgGl2iXF3': 'Dave Bonness',
            'X2DMb9bP4Q8fy9yr5Fam': 'Donnie Pagel',
            '7Hj4KWNpm0GviTYbwfbM': 'Jennifer Malek',
            'TJ3uwMdslbtpjtq17xW4': 'Matthew Wentz',
            '89RkfFLOhvUwV83ZS5J4': 'Christian Ketchum',
            'bsAlnR7Ii1pWmMvsWzrS': 'Nathan Kull',
            '7GH1SWRR3dAyAVxgMqvf': 'Michael Jarvis',
            '4sly23nOXhC475q95R4L': 'Stephanie Kull',
            'dr4ML1i9ZeMI7SNisX6E': 'Kevin Yasenchak',
            'bIv2rga3jBSvzsQ2khne': 'Brian Smith',
            'Dag2lYDtqoo4kc3cRHHa': 'Cesar Andino',
            'xtgPtBokzUj3nli61AKq': 'Dan Partlo',
            'JxFXNWdd2dFMja3rI0jf': 'Joe Donley',
            'Gmxl5I2CtVXYns4b4AeU': 'Kevin McKelvey',
            'wLMJoz1GylfVCMM32nWm': 'Eddie Olschansky',
            'Tj1LsOtRiJwHW4r4sgWa': 'Jeff Boss',
            'FfODZtkFiGUEzptzD8tH': 'Michael Gonzalez',
            'SwnH8GUBmrcdmOAs07Vp': 'John Ragnoni',
            'ZwdiN0qfmIY5MMCOLJps': 'Marc Tate',
            'ctnV5Je72HAIyVpE5zjS': 'David Brunner',
            'vVR4AOITXYzhR2H4GqzI': 'Derek Fess',
            '34GDgRRFk0uFmOvyykHE': 'Josh Kelly',
            'gqhzEQLifL402lQwDMpH': 'Tony Massimiani',
            'pL9CGc688ZpxbPKJ11cZ': 'Dominick Russano',
            'rZ57ofUYFXPSrrhyBVkz': 'Chris Benco',
            'yGcBLDcTwgHtWmZEg3TG': 'Nick Mezlak',
            '8f52A1dwRB4eIU5UyQZo': 'Cory Jacobs',
            'dFmalrT5BMdaTOUUVTOZ': 'Dillon Ulisses',
            'gmZ8d6De0ZlqPVV0V9Q6': 'Danny Russano',
            'NJgDQ0d4RzpDVuCnqYZO': 'Chris Russano',
            'NCeaIaMXsXVN135pX91L': 'Eric Duale',
            'mFyX9sv1l95V0czECUKu': 'Luke Kollias',
            'YHCbJsXKYjFMPk5Wk7kd': 'Anthony Donley',
            'AwrGDvwsdPQ52kfRTLMk': 'Tony Rook'
};

// Helper: create empty stats object with all tracked fields
function createEmptyMatchStats(playerId, playerName, CANONICAL_NAMES) {
            return {
                player_id: playerId,
                player_name: CANONICAL_NAMES[playerId] || playerName,
                // Basic X01
                x01_legs_played: 0,
                x01_legs_won: 0,
                x01_total_darts: 0,
                x01_total_points: 0,
                x01_three_dart_avg: 0,
                // Tons tracking (by range)
                x01_ton_80: 0,  // 180
                x01_ton_60: 0,  // 160-179
                x01_ton_40: 0,  // 140-159
                x01_ton_20: 0,  // 120-139
                x01_ton_00: 0,  // 100-119
                x01_tons: 0,    // Total 100+
                x01_one_seventy_ones: 0,
                x01_high_score: 0,
                // First 9
                x01_first9_darts: 0,
                x01_first9_points: 0,
                // Checkout tracking
                x01_checkouts_hit: 0,
                x01_checkout_attempts: 0,
                x01_total_checkout_points: 0,
                x01_ton_plus_checkouts: 0,
                x01_high_checkout: 0,
                x01_best_leg: 999,
                // Checkout by range
                x01_co_80_hits: 0, x01_co_80_attempts: 0,
                x01_co_120_hits: 0, x01_co_120_attempts: 0,
                x01_co_140_hits: 0, x01_co_140_attempts: 0,
                x01_co_161_hits: 0, x01_co_161_attempts: 0,
                // With/against darts (cork)
                x01_legs_with_darts: 0, x01_legs_with_darts_won: 0,
                x01_legs_against_darts: 0, x01_legs_against_darts_won: 0,
                // Basic Cricket
                cricket_legs_played: 0,
                cricket_legs_won: 0,
                cricket_total_darts: 0,
                cricket_total_marks: 0,
                cricket_mpr: 0,
                // Cricket mark rounds
                cricket_nine_mark_rounds: 0,
                cricket_eight_mark_rounds: 0,
                cricket_seven_mark_rounds: 0,
                cricket_six_mark_rounds: 0,
                cricket_five_mark_rounds: 0,
                cricket_high_mark_round: 0,
                cricket_hat_tricks: 0,
                // Cricket with/against darts
                cricket_legs_with_darts: 0, cricket_legs_with_darts_won: 0,
                cricket_legs_against_darts: 0, cricket_legs_against_darts_won: 0,
                // Game-level
                games_played: 0,
                games_won: 0
            };
}

// Helper: process X01 leg throws using two-pass approach
// Pass 1: compute actual scores from side-level remaining differences
// Pass 2: group by player and accumulate stats
function processX01LegThrows(leg, statsUpdates, getPlayerId, detailedOnly = false) {
    const throws = leg.throws || [];
    if (throws.length === 0) return;

    const format = leg.format;
    const gameValue = parseInt(format) || 501;

    // FIRST PASS: compute actual per-round scores from side-level remaining
    const sideLastRemaining = { home: gameValue, away: gameValue };
    const processedThrows = [];

    throws.forEach((throwData) => {
        const processed = {};
        ['home', 'away'].forEach(side => {
            const throwInfo = throwData[side];
            if (!throwInfo || !throwInfo.player) { processed[side] = null; return; }

            const remaining = throwInfo.remaining;
            const rawScore = throwInfo.score || 0;
            const remainingAtStart = sideLastRemaining[side];
            let actualScore;

            if (remaining !== undefined && remaining !== null) {
                actualScore = remainingAtStart - remaining;
                sideLastRemaining[side] = remaining;
            } else {
                actualScore = (rawScore > 0 && rawScore <= 180) ? rawScore : null;
            }

            if (actualScore !== null && (actualScore > 180 || actualScore < 0)) {
                actualScore = null;
            }

            processed[side] = { ...throwInfo, actualScore, remainingAtStart, side };
        });
        processedThrows.push(processed);
    });

    // Determine winner
    let winningPlayerId = null;
    const lastProcessed = processedThrows[processedThrows.length - 1];
    if (lastProcessed) {
        ['home', 'away'].forEach(side => {
            if (lastProcessed[side] && lastProcessed[side].remaining === 0) {
                winningPlayerId = getPlayerId(lastProcessed[side]);
            }
        });
    }

    // Cork inference: determine who threw first from final round
    let corkSide = null;
    if (lastProcessed) {
        const hasHome = lastProcessed.home !== null;
        const hasAway = lastProcessed.away !== null;
        if (hasHome && !hasAway) {
            corkSide = 'home'; // only home threw last round = home had cork
        } else if (hasAway && !hasHome) {
            corkSide = 'away';
        } else if (hasHome && hasAway) {
            // Both threw: winner threw second, loser had cork
            if (lastProcessed.home.remaining === 0) corkSide = 'away';
            else if (lastProcessed.away.remaining === 0) corkSide = 'home';
        }
    }

    // SECOND PASS: group by player and accumulate
    const playerThrowsMap = {};
    processedThrows.forEach(throwData => {
        ['home', 'away'].forEach(side => {
            const info = throwData[side];
            if (!info) return;
            const playerId = getPlayerId(info);
            if (!playerId) return;
            if (!playerThrowsMap[playerId]) playerThrowsMap[playerId] = [];
            playerThrowsMap[playerId].push(info);
        });
    });

    Object.keys(playerThrowsMap).forEach(playerId => {
        const pThrows = playerThrowsMap[playerId];
        if (!statsUpdates[playerId]) return;
        const stats = statsUpdates[playerId];

        // Basic counters: only when NOT detailedOnly (i.e., no player_stats available)
        if (!detailedOnly) stats.x01_legs_played++;
        let totalDarts = 0;
        let totalPoints = 0;
        let first9Points = 0;

        pThrows.forEach((throwInfo, idx) => {
            const actualScore = throwInfo.actualScore;
            const remaining = throwInfo.remaining;
            const isCheckout = (remaining === 0);
            const checkoutDarts = throwInfo.checkout_darts || 3;
            const remainingAtStart = throwInfo.remainingAtStart;

            let dartsThisRound = isCheckout ? checkoutDarts : 3;
            totalDarts += dartsThisRound;
            if (actualScore !== null) totalPoints += actualScore;

            // First 9 (first 3 of this player's throws)
            if (idx < 3 && actualScore !== null) first9Points += actualScore;

            // Tons tracking
            if (actualScore !== null) {
                if (actualScore === 171) stats.x01_one_seventy_ones++;
                if (actualScore >= 180) stats.x01_ton_80++;
                else if (actualScore >= 160) stats.x01_ton_60++;
                else if (actualScore >= 140) stats.x01_ton_40++;
                else if (actualScore >= 120) stats.x01_ton_20++;
                else if (actualScore >= 100) stats.x01_ton_00++;
                if (actualScore >= 100) stats.x01_tons++;
                if (actualScore > stats.x01_high_score) stats.x01_high_score = actualScore;
            }

            // Checkout tracking
            if (remainingAtStart != null && remainingAtStart <= 170) {
                stats.x01_checkout_attempts++;
                if (remainingAtStart >= 161) {
                    stats.x01_co_161_attempts++;
                    if (isCheckout) stats.x01_co_161_hits++;
                } else if (remainingAtStart >= 140) {
                    stats.x01_co_140_attempts++;
                    if (isCheckout) stats.x01_co_140_hits++;
                } else if (remainingAtStart >= 120) {
                    stats.x01_co_120_attempts++;
                    if (isCheckout) stats.x01_co_120_hits++;
                } else if (remainingAtStart >= 80) {
                    stats.x01_co_80_attempts++;
                    if (isCheckout) stats.x01_co_80_hits++;
                }
            }

            if (isCheckout) {
                stats.x01_checkouts_hit++;
                stats.x01_total_checkout_points += remainingAtStart;
                if (remainingAtStart >= 100) stats.x01_ton_plus_checkouts++;
                if (remainingAtStart > stats.x01_high_checkout) stats.x01_high_checkout = remainingAtStart;
                if (totalDarts < stats.x01_best_leg) stats.x01_best_leg = totalDarts;
            }
        });

        // Basic totals: only when NOT detailedOnly
        if (!detailedOnly) {
            stats.x01_total_darts += totalDarts;
            stats.x01_total_points += totalPoints;
            if (playerId === winningPlayerId) stats.x01_legs_won++;
        }
        stats.x01_first9_darts += Math.min(pThrows.length * 3, 9);
        stats.x01_first9_points += first9Points;

        // With/against darts tracking
        if (corkSide) {
            const playerSide = pThrows[0].side;
            if (playerSide === corkSide) {
                stats.x01_legs_with_darts++;
                if (playerId === winningPlayerId) stats.x01_legs_with_darts_won++;
            } else {
                stats.x01_legs_against_darts++;
                if (playerId === winningPlayerId) stats.x01_legs_against_darts_won++;
            }
        }
    });
}

// Helper: process Cricket leg throws
function processCricketLegThrows(leg, statsUpdates, getPlayerId, detailedOnly = false) {
    const throws = leg.throws || [];
    if (throws.length === 0) return;

    const winningSide = leg.winner;
    let winningPlayerId = null;
    const lastThrow = throws[throws.length - 1];
    if (lastThrow && winningSide) {
        const winningThrow = lastThrow[winningSide];
        if (winningThrow?.player) winningPlayerId = getPlayerId(winningThrow);
    }

    // Cork inference: determine who threw first from final round
    let corkSide = null;
    if (lastThrow) {
        const hasHome = lastThrow.home && lastThrow.home.player;
        const hasAway = lastThrow.away && lastThrow.away.player;
        if (hasHome && !hasAway) {
            corkSide = 'home';
        } else if (hasAway && !hasHome) {
            corkSide = 'away';
        } else if (hasHome && hasAway) {
            // Both threw: the closing side threw second, other had cork
            const homeClosedOut = lastThrow.home.closed_out || lastThrow.home.closeout;
            const awayClosedOut = lastThrow.away.closed_out || lastThrow.away.closeout;
            if (homeClosedOut) corkSide = 'away';
            else if (awayClosedOut) corkSide = 'home';
            else if (winningSide === 'home') corkSide = 'away';
            else if (winningSide === 'away') corkSide = 'home';
        }
    }

    const playerThrowsMap = {};
    throws.forEach(throwData => {
        ['home', 'away'].forEach(side => {
            const throwInfo = throwData[side];
            if (!throwInfo || !throwInfo.player) return;
            const playerId = getPlayerId(throwInfo);
            if (!playerId) return;
            if (!playerThrowsMap[playerId]) playerThrowsMap[playerId] = [];
            playerThrowsMap[playerId].push({ ...throwInfo, side });
        });
    });

    Object.keys(playerThrowsMap).forEach(playerId => {
        const pThrows = playerThrowsMap[playerId];
        if (!statsUpdates[playerId]) return;
        const stats = statsUpdates[playerId];

        if (!detailedOnly) stats.cricket_legs_played++;
        let totalDarts = 0;
        let totalMarks = 0;

        pThrows.forEach(throwInfo => {
            const marks = throwInfo.marks || 0;
            const closeout = throwInfo.closed_out || throwInfo.closeout || false;
            const closeoutDarts = throwInfo.closeout_darts || 3;

            totalDarts += closeout ? closeoutDarts : 3;
            totalMarks += marks;

            // Mark rounds tracking
            if (marks === 9) stats.cricket_nine_mark_rounds++;
            else if (marks === 8) stats.cricket_eight_mark_rounds++;
            else if (marks === 7) stats.cricket_seven_mark_rounds++;
            else if (marks === 6) stats.cricket_six_mark_rounds++;
            else if (marks === 5) stats.cricket_five_mark_rounds++;

            if (marks > stats.cricket_high_mark_round) stats.cricket_high_mark_round = marks;

            // Hat tricks (3+ bull marks)
            const hitLower = (throwInfo.hit || '').toLowerCase();
            const bullCount = (hitLower.match(/\bb\b|bull/g) || []).length;
            if (bullCount >= 3) stats.cricket_hat_tricks++;
        });

        if (!detailedOnly) {
            stats.cricket_total_darts += totalDarts;
            stats.cricket_total_marks += totalMarks;
            if (playerId === winningPlayerId) stats.cricket_legs_won++;
        }

        // With/against darts tracking
        if (corkSide) {
            const playerSide = pThrows[0].side;
            if (playerSide === corkSide) {
                stats.cricket_legs_with_darts++;
                if (playerId === winningPlayerId) stats.cricket_legs_with_darts_won++;
            } else {
                stats.cricket_legs_against_darts++;
                if (playerId === winningPlayerId) stats.cricket_legs_against_darts_won++;
            }
        }
    });
}

// Process match games and return stats updates object
// This is the shared processing logic used by both updateImportedMatchStats and recalculateAllLeagueStats
function processMatchGamesForStats(games, PLAYER_IDS, CANONICAL_NAMES) {
    const statsUpdates = {};
    const getPlayerId = (name) => PLAYER_IDS[name] || null;
    const getThrowPlayerId = (throwInfo) => throwInfo?.player_id || getPlayerId(throwInfo?.player);

    for (const game of games) {
        const homePlayerNames = (game.home_players || []).map(p => typeof p === 'string' ? p : p.name);
        const awayPlayerNames = (game.away_players || []).map(p => typeof p === 'string' ? p : p.name);
        // Ensure all players in this game have stat entries
        [...homePlayerNames, ...awayPlayerNames].forEach(playerName => {
            const playerId = PLAYER_IDS[playerName];
            if (playerId && !statsUpdates[playerId]) {
                statsUpdates[playerId] = createEmptyMatchStats(playerId, playerName, CANONICAL_NAMES);
            }
        });

        // Process each leg using a throws-first contract.
        // throws are authoritative for both basic and detailed stats.
        // player_stats is only a fallback for historical legs with no throw data.
        for (const leg of (game.legs || [])) {
            // Use leg-level format first, fall back to game-level (mixed format sets have cricket legs in 501 games)
            const legFormat = leg.format || game.format || '';
            const isX01 = legFormat === '501' || legFormat === '301' || legFormat === '701';
            const hasThrows = (leg.throws || []).length > 0;
            const playerStats = leg.player_stats || {};
            const hasPlayerStats = Object.keys(playerStats).length > 0;

            // Throws are canonical when they exist.
            // player_stats is the authoritative source — correct for both singles and doubles
            if (hasThrows) {
                if (isX01) {
                    processX01LegThrows(leg, statsUpdates, getThrowPlayerId, false);
                } else {
                    processCricketLegThrows(leg, statsUpdates, getThrowPlayerId, false);
                }
            }

            if (!hasThrows && hasPlayerStats) {
                for (const [playerName, pStats] of Object.entries(playerStats)) {
                    const playerId = PLAYER_IDS[playerName];
                    if (!playerId || !statsUpdates[playerId]) continue;

                    const ps = statsUpdates[playerId];
                    const isHome = homePlayerNames.includes(playerName);
                    const isWinner = (leg.winner === 'home' && isHome) || (leg.winner === 'away' && !isHome);

                    if (isX01) {
                        // Skip bad data: darts counted but no points (import artifact from doubles legs)
                        if ((pStats.darts || 0) > 0 && (pStats.points || 0) === 0) continue;
                        ps.x01_legs_played++;
                        ps.x01_total_darts += pStats.darts || 0;
                        ps.x01_total_points += pStats.points || 0;
                        if (isWinner) {
                            ps.x01_legs_won++;
                            if (pStats.checkout && pStats.checkout > ps.x01_high_checkout) {
                                ps.x01_high_checkout = pStats.checkout;
                            }
                        }
                    } else {
                        ps.cricket_legs_played++;
                        ps.cricket_total_marks += pStats.marks || 0;
                        let dartCount = pStats.darts || 0;
                        if (isWinner && leg.closeout_darts && leg.closeout_darts < 3) {
                            const rounds = leg.winning_round || Math.ceil(dartCount / 3);
                            if (dartCount === rounds * 3) dartCount -= (3 - leg.closeout_darts);
                        }
                        ps.cricket_total_darts += dartCount;
                        if (isWinner) ps.cricket_legs_won++;
                    }
                }
            }

        }

        // Update games played/won
        const gameWinner = game.winner;
        for (const playerName of homePlayerNames) {
            const playerId = PLAYER_IDS[playerName];
            if (playerId && statsUpdates[playerId]) {
                statsUpdates[playerId].games_played++;
                if (gameWinner === 'home') statsUpdates[playerId].games_won++;
            }
        }
        for (const playerName of awayPlayerNames) {
            const playerId = PLAYER_IDS[playerName];
            if (playerId && statsUpdates[playerId]) {
                statsUpdates[playerId].games_played++;
                if (gameWinner === 'away') statsUpdates[playerId].games_won++;
            }
        }
    }

    return statsUpdates;
}

/**
 * Update player stats from imported match data
 * Processes all games and legs from an imported match
 */
exports.updateImportedMatchStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { leagueId, matchId, playerMapping } = req.body;

        if (!leagueId || !matchId) {
            res.status(400).json({ error: 'Missing leagueId or matchId' });
            return;
        }

        // Fetch the match
        const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const match = matchDoc.data();
        const games = match.games || [];

        // Use provided mapping or default
        const PLAYER_IDS = playerMapping || DEFAULT_PLAYER_IDS;
        const CANONICAL_NAMES = DEFAULT_CANONICAL_NAMES;

        // Process match games
        const statsUpdates = processMatchGamesForStats(games, PLAYER_IDS, CANONICAL_NAMES);
        const results = [];

        // Write stats to Firestore
        const statsRef = db.collection('leagues').doc(leagueId).collection('stats');

        // Helper: add two stat values (sum for counters)
        const addStat = (existing, key, newVal) => (existing[key] || 0) + (newVal || 0);
        // Helper: take max of two stat values
        const maxStat = (existing, key, newVal) => Math.max(existing[key] || 0, newVal || 0);
        // Helper: take min of two stat values (for best leg)
        const minStat = (existing, key, newVal) => {
            const e = existing[key] || 999;
            const n = newVal || 999;
            return Math.min(e, n);
        };

        for (const [playerId, stats] of Object.entries(statsUpdates)) {
            const existingDoc = await statsRef.doc(playerId).get();

            // Clean up best_leg sentinel
            if (stats.x01_best_leg === 999) stats.x01_best_leg = 0;

            // Calculate averages
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = parseFloat(((stats.x01_total_points / stats.x01_total_darts) * 3).toFixed(2));
            }
            if (stats.cricket_total_darts > 0) {
                stats.cricket_mpr = parseFloat(((stats.cricket_total_marks / (stats.cricket_total_darts / 3))).toFixed(2));
            }

            if (existingDoc.exists) {
                const existing = existingDoc.data();
                const merged = {
                    // X01 basic
                    x01_legs_played: addStat(existing, 'x01_legs_played', stats.x01_legs_played),
                    x01_legs_won: addStat(existing, 'x01_legs_won', stats.x01_legs_won),
                    x01_total_darts: addStat(existing, 'x01_total_darts', stats.x01_total_darts),
                    x01_total_points: addStat(existing, 'x01_total_points', stats.x01_total_points),
                    // Tons
                    x01_ton_80: addStat(existing, 'x01_ton_80', stats.x01_ton_80),
                    x01_ton_60: addStat(existing, 'x01_ton_60', stats.x01_ton_60),
                    x01_ton_40: addStat(existing, 'x01_ton_40', stats.x01_ton_40),
                    x01_ton_20: addStat(existing, 'x01_ton_20', stats.x01_ton_20),
                    x01_ton_00: addStat(existing, 'x01_ton_00', stats.x01_ton_00),
                    x01_tons: addStat(existing, 'x01_tons', stats.x01_tons),
                    x01_high_score: maxStat(existing, 'x01_high_score', stats.x01_high_score),
                    // First 9
                    x01_first9_darts: addStat(existing, 'x01_first9_darts', stats.x01_first9_darts),
                    x01_first9_points: addStat(existing, 'x01_first9_points', stats.x01_first9_points),
                    // Checkout
                    x01_checkouts_hit: addStat(existing, 'x01_checkouts_hit', stats.x01_checkouts_hit),
                    x01_checkout_attempts: addStat(existing, 'x01_checkout_attempts', stats.x01_checkout_attempts),
                    x01_total_checkout_points: addStat(existing, 'x01_total_checkout_points', stats.x01_total_checkout_points),
                    x01_high_checkout: maxStat(existing, 'x01_high_checkout', stats.x01_high_checkout),
                    x01_best_leg: minStat(existing, 'x01_best_leg', stats.x01_best_leg),
                    // Checkout by range
                    x01_co_80_hits: addStat(existing, 'x01_co_80_hits', stats.x01_co_80_hits),
                    x01_co_80_attempts: addStat(existing, 'x01_co_80_attempts', stats.x01_co_80_attempts),
                    x01_co_120_hits: addStat(existing, 'x01_co_120_hits', stats.x01_co_120_hits),
                    x01_co_120_attempts: addStat(existing, 'x01_co_120_attempts', stats.x01_co_120_attempts),
                    x01_co_140_hits: addStat(existing, 'x01_co_140_hits', stats.x01_co_140_hits),
                    x01_co_140_attempts: addStat(existing, 'x01_co_140_attempts', stats.x01_co_140_attempts),
                    x01_co_161_hits: addStat(existing, 'x01_co_161_hits', stats.x01_co_161_hits),
                    x01_co_161_attempts: addStat(existing, 'x01_co_161_attempts', stats.x01_co_161_attempts),
                    // Cricket basic
                    cricket_legs_played: addStat(existing, 'cricket_legs_played', stats.cricket_legs_played),
                    cricket_legs_won: addStat(existing, 'cricket_legs_won', stats.cricket_legs_won),
                    cricket_total_marks: addStat(existing, 'cricket_total_marks', stats.cricket_total_marks),
                    cricket_total_darts: addStat(existing, 'cricket_total_darts', stats.cricket_total_darts),
                    // Cricket mark rounds
                    cricket_nine_mark_rounds: addStat(existing, 'cricket_nine_mark_rounds', stats.cricket_nine_mark_rounds),
                    cricket_eight_mark_rounds: addStat(existing, 'cricket_eight_mark_rounds', stats.cricket_eight_mark_rounds),
                    cricket_seven_mark_rounds: addStat(existing, 'cricket_seven_mark_rounds', stats.cricket_seven_mark_rounds),
                    cricket_six_mark_rounds: addStat(existing, 'cricket_six_mark_rounds', stats.cricket_six_mark_rounds),
                    cricket_five_mark_rounds: addStat(existing, 'cricket_five_mark_rounds', stats.cricket_five_mark_rounds),
                    cricket_high_mark_round: maxStat(existing, 'cricket_high_mark_round', stats.cricket_high_mark_round),
                    cricket_hat_tricks: addStat(existing, 'cricket_hat_tricks', stats.cricket_hat_tricks),
                    // With/against darts (cork)
                    x01_legs_with_darts: addStat(existing, 'x01_legs_with_darts', stats.x01_legs_with_darts),
                    x01_legs_with_darts_won: addStat(existing, 'x01_legs_with_darts_won', stats.x01_legs_with_darts_won),
                    x01_legs_against_darts: addStat(existing, 'x01_legs_against_darts', stats.x01_legs_against_darts),
                    x01_legs_against_darts_won: addStat(existing, 'x01_legs_against_darts_won', stats.x01_legs_against_darts_won),
                    cricket_legs_with_darts: addStat(existing, 'cricket_legs_with_darts', stats.cricket_legs_with_darts),
                    cricket_legs_with_darts_won: addStat(existing, 'cricket_legs_with_darts_won', stats.cricket_legs_with_darts_won),
                    cricket_legs_against_darts: addStat(existing, 'cricket_legs_against_darts', stats.cricket_legs_against_darts),
                    cricket_legs_against_darts_won: addStat(existing, 'cricket_legs_against_darts_won', stats.cricket_legs_against_darts_won),
                    // Game-level
                    games_played: addStat(existing, 'games_played', stats.games_played),
                    games_won: addStat(existing, 'games_won', stats.games_won),
                    matches_played: (existing.matches_played || 0) + 1,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                };

                // Recalculate averages from merged totals
                if (merged.x01_total_darts > 0) {
                    merged.x01_three_dart_avg = parseFloat(((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2));
                }
                if (merged.cricket_total_darts > 0) {
                    merged.cricket_mpr = parseFloat((merged.cricket_total_marks / (merged.cricket_total_darts / 3)).toFixed(2));
                }

                await statsRef.doc(playerId).update(merged);
            } else {
                // Create new
                stats.matches_played = 1;
                stats.created_at = admin.firestore.FieldValue.serverTimestamp();
                stats.updated_at = admin.firestore.FieldValue.serverTimestamp();
                await statsRef.doc(playerId).set(stats);
            }

            results.push({
                playerId,
                playerName: stats.player_name,
                x01Avg: stats.x01_three_dart_avg,
                cricketMpr: stats.cricket_mpr
            });
        }

        res.json({
            success: true,
            matchId,
            playersUpdated: results.length,
            stats: results
        });

    } catch (error) {
        console.error('Update imported match stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Set player stats directly from DartConnect performance report totals
 * This bypasses leg-by-leg parsing and uses the exact totals from DC
 *
 * Supports all DartConnect stat fields:
 * - X01: 3DA, first9, avgFinish, highTurn, highCheckout, tons (100+, 140+, 180), checkout stats
 * - Cricket: MPR, marks, 5M+ turns, bulls, triples, hatTricks
 * - Record: legs, matches, wins, with/against darts
 */
exports.setPlayerStatsFromPerformance = importMatchesAdmin.setPlayerStatsFromPerformance;

/**
 * Debug endpoint to check match data including games array
 * GET ?leagueId=xxx&week=1
 */
exports.debugMatchData = importMatchesAdmin.debugMatchData;

/**
 * Debug endpoint to check player stats structure
 * GET ?leagueId=xxx&playerName=xxx
 */
exports.debugPlayerStats = importMatchesAdmin.debugPlayerStats;

/**
 * Sync player names from players collection to stats collection
 * This ensures stats.player_name matches players.name
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.syncPlayerNames = importMatchesAdmin.syncPlayerNames;

/**
 * Clear all stats documents for a league (used before full recalculation)
 */
exports.clearLeagueStats = importMatchesAdmin.clearLeagueStats;

/**
 * Recalculate ALL player stats for a league from scratch.
 * Clears all existing stats, then processes every completed match.
 * This is idempotent - safe to run multiple times.
 */
exports.recalculateAllLeagueStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { leagueId } = req.body;
        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const PLAYER_IDS = DEFAULT_PLAYER_IDS;
        const CANONICAL_NAMES = DEFAULT_CANONICAL_NAMES;

        // Step 1: Clear all existing stats
        const statsRef = db.collection('leagues').doc(leagueId).collection('stats');
        const existingStats = await statsRef.get();
        const deleteBatch = db.batch();
        existingStats.forEach(doc => deleteBatch.delete(doc.ref));
        if (!existingStats.empty) await deleteBatch.commit();
        console.log(`Cleared ${existingStats.size} existing stat docs`);

        // Step 2: Get all completed matches with game data
        const matchesSnap = await db.collection('leagues').doc(leagueId).collection('matches')
            .where('status', '==', 'completed').get();

        console.log(`Processing ${matchesSnap.size} completed matches`);

        // Step 3: Process each match and accumulate stats
        const cumulativeStats = {};  // playerId -> cumulative stats
        let matchesProcessed = 0;

        for (const matchDoc of matchesSnap.docs) {
            const match = matchDoc.data();
            const games = match.games || [];
            if (games.length === 0) continue;

            const matchStats = processMatchGamesForStats(games, PLAYER_IDS, CANONICAL_NAMES);

            // Merge match stats into cumulative
            for (const [playerId, stats] of Object.entries(matchStats)) {
                if (!cumulativeStats[playerId]) {
                    cumulativeStats[playerId] = createEmptyMatchStats(playerId, stats.player_name, CANONICAL_NAMES);
                    cumulativeStats[playerId].matches_played = 0;
                }

                const cum = cumulativeStats[playerId];
                // Add all counter fields
                const addFields = [
                    'x01_legs_played', 'x01_legs_won', 'x01_total_darts', 'x01_total_points',
                    'x01_ton_80', 'x01_ton_60', 'x01_ton_40', 'x01_ton_20', 'x01_ton_00', 'x01_tons',
                    'x01_first9_darts', 'x01_first9_points',
                    'x01_checkouts_hit', 'x01_checkout_attempts', 'x01_total_checkout_points',
                    'x01_co_80_hits', 'x01_co_80_attempts',
                    'x01_co_120_hits', 'x01_co_120_attempts',
                    'x01_co_140_hits', 'x01_co_140_attempts',
                    'x01_co_161_hits', 'x01_co_161_attempts',
                    'x01_legs_with_darts', 'x01_legs_with_darts_won',
                    'x01_legs_against_darts', 'x01_legs_against_darts_won',
                    'cricket_legs_played', 'cricket_legs_won', 'cricket_total_darts', 'cricket_total_marks',
                    'cricket_nine_mark_rounds', 'cricket_eight_mark_rounds',
                    'cricket_seven_mark_rounds', 'cricket_six_mark_rounds', 'cricket_five_mark_rounds',
                    'cricket_hat_tricks',
                    'cricket_legs_with_darts', 'cricket_legs_with_darts_won',
                    'cricket_legs_against_darts', 'cricket_legs_against_darts_won',
                    'games_played', 'games_won'
                ];
                addFields.forEach(f => { cum[f] = (cum[f] || 0) + (stats[f] || 0); });

                // Max fields
                cum.x01_high_score = Math.max(cum.x01_high_score || 0, stats.x01_high_score || 0);
                cum.x01_high_checkout = Math.max(cum.x01_high_checkout || 0, stats.x01_high_checkout || 0);
                cum.cricket_high_mark_round = Math.max(cum.cricket_high_mark_round || 0, stats.cricket_high_mark_round || 0);

                // Min fields (best leg)
                const curBest = cum.x01_best_leg || 999;
                const newBest = stats.x01_best_leg || 999;
                cum.x01_best_leg = Math.min(curBest, newBest);

                cum.matches_played++;
            }

            matchesProcessed++;
        }

        // Step 4: Calculate averages and write to Firestore
        const results = [];
        for (const [playerId, stats] of Object.entries(cumulativeStats)) {
            // Clean up best_leg sentinel
            if (stats.x01_best_leg === 999) stats.x01_best_leg = 0;

            // Calculate averages
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = parseFloat(((stats.x01_total_points / stats.x01_total_darts) * 3).toFixed(2));
            }
            if (stats.cricket_total_darts > 0) {
                stats.cricket_mpr = parseFloat((stats.cricket_total_marks / (stats.cricket_total_darts / 3)).toFixed(2));
            }

            stats.created_at = admin.firestore.FieldValue.serverTimestamp();
            stats.updated_at = admin.firestore.FieldValue.serverTimestamp();
            await statsRef.doc(playerId).set(stats);

            results.push({
                playerId,
                playerName: stats.player_name,
                x01Avg: stats.x01_three_dart_avg || 0,
                cricketMpr: stats.cricket_mpr || 0,
                matchesPlayed: stats.matches_played
            });
        }

        res.json({
            success: true,
            matchesProcessed,
            playersUpdated: results.length,
            stats: results
        });

    } catch (error) {
        console.error('Recalculate all league stats error:', error);
        res.status(500).json({ error: error.message });
    }
});
