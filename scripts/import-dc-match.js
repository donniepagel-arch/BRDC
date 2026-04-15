/**
 * import-dc-match.js
 *
 * Single generic importer for all DartConnect web recap exports.
 * Replaces import-from-dc-web.js and import-weeks-9-10.js.
 *
 * Usage:
 *   node scripts/import-dc-match.js                  # dry-run all
 *   node scripts/import-dc-match.js --live            # import all
 *   node scripts/import-dc-match.js --week 9          # dry-run week 9
 *   node scripts/import-dc-match.js --week 9 --live   # import week 9
 *   node scripts/import-dc-match.js --match HsFErJ... # single match
 *   node scripts/import-dc-match.js --match HsFErJ... --live
 *
 * Data files live in temp/dc-web/ (relative to project root).
 * Player identity is resolved via PLAYER_CONFIG in import-match-from-rtf.js;
 * per-match fill-ins override for subs not in the regular roster.
 *
 * To add a new week's matches, append entries to the MATCHES array at the top.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { getTeamForPlayer, setFillIns } = require('./import-match-from-rtf.js');

const LEAGUE_ID  = 'aOq4Y0ETxPZ66tM1uUtP';
const DC_WEB_DIR = path.join(__dirname, '..', 'temp', 'dc-web');

// ---------------------------------------------------------------------------
// MATCH REGISTRY
// Add new weeks here. dataFile is relative to temp/dc-web/.
// homeTeam / awayTeam must match team names in PLAYER_CONFIG exactly.
// fillIns: { 'Player Name': 'home'|'away' } for subs not in PLAYER_CONFIG.
// ---------------------------------------------------------------------------

const MATCHES = [
    // ---- Week 5 (Feb 18, 2026) ----
    {
        week: 5,
        name: 'K. Yasenchak vs M. Pagel (Week 5)',
        matchId: 'HsFErJsZsl65vwWdPMZf',
        dataFile: 'pagel-v-yasenchak-week5.txt',
        homeTeam: 'K. Yasenchak',
        awayTeam: 'M. Pagel',
        fillIns: {},
    },

    // ---- Week 9 (Mar 18, 2026) ----
    {
        week: 9,
        name: 'D. Russano vs D. Partlo (Week 9)',
        matchId: 'sXqtymuHCGCBnCWrxPli',
        dataFile: 'week-new/69bb30ed34d25fbeabe63a04.txt',
        homeTeam: 'D. Russano',
        awayTeam: 'D. Partlo',
        fillIns: {},
    },
    {
        week: 9,
        name: 'N. Kull vs M. Pagel (Week 9)',
        matchId: 'bKbFUA2OEqBwP4tkUMl2',
        dataFile: 'week-new/69bb327534d25fbeabe63e0d.txt',
        homeTeam: 'N. Kull',
        awayTeam: 'M. Pagel',
        fillIns: {
            'Josh Kelly':  'home',  // J. Ragnoni sub filling in for N. Kull
            'Kim Scott':   'away',  // sub filling in for M. Pagel
        },
    },
    {
        week: 9,
        name: 'K. Yasenchak vs J. Ragnoni (Week 9)',
        matchId: 'TNUKhFB5xrtTNmzmTaob',
        dataFile: 'week-new/69bb331c34d25fbeabe63fd0.txt',
        homeTeam: 'K. Yasenchak',
        awayTeam: 'J. Ragnoni',
        fillIns: {},
    },

    // ---- Week 10 (Mar 25, 2026) ----
    {
        week: 10,
        name: 'D. Partlo vs E. O (Week 10)',
        matchId: 'd0ydoWv53591zfYOGdfU',
        dataFile: 'week-new/69c46b7f34d25fbeabf03e71.txt',
        homeTeam: 'D. Partlo',
        awayTeam: 'E. O',
        fillIns: {},
    },
    {
        week: 10,
        name: 'D. Russano vs N. Mezlak (Week 10)',
        matchId: 'ctYzWU3tdIAqJQ47P7b6',
        dataFile: 'week-new/69c46c6534d25fbeabf040ab.txt',
        homeTeam: 'D. Russano',
        awayTeam: 'N. Mezlak',
        fillIns: {
            'Ray Skrovan': 'away',  // sub filling in for N. Mezlak
        },
    },
    {
        week: 10,
        name: 'neon nightmares vs J. Ragnoni (Week 10)',
        matchId: '8vgs6TM9wV4UqLbLvXIn',
        dataFile: 'week-new/69c46c8034d25fbeabf040df.txt',
        homeTeam: 'neon nightmares',
        awayTeam: 'J. Ragnoni',
        fillIns: {},
    },
    {
        week: 10,
        name: 'D. Pagel vs M. Pagel (Week 10)',
        matchId: 'LX4TspwI5CUI6qKLQhRk',
        dataFile: 'week-new/69c46de334d25fbeabf044c3.txt',
        homeTeam: 'D. Pagel',
        awayTeam: 'M. Pagel',
        fillIns: {
            'Matty Wentz': 'home',  // sub filling in for D. Pagel
        },
    },
];

// ---------------------------------------------------------------------------
// PLAYER REGISTRY
// All player name variants that can appear in DC exports.
// The PLAYER_CONFIG in import-match-from-rtf.js is the authoritative source;
// this set just covers edge-case spellings that appear in raw DC text.
// ---------------------------------------------------------------------------

let _knownPlayers = null;
function knownPlayers() {
    if (_knownPlayers) return _knownPlayers;
    _knownPlayers = new Set([
        // M. Pagel
        'Matt Pagel', 'Matthew Pagel', 'Joe Peters', 'John Linden', 'Dave Bonness',
        // D. Pagel
        'Donnie Pagel', 'Christian Ketchum', 'Christian Ketchem',
        'Jennifer Malek', 'Jenn Malek', 'Jenn M',
        // N. Kull
        'Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Mike Jarvis',
        'Stephanie Kull', 'Steph Kull',
        // K. Yasenchak
        'Kevin Yasenchak', 'Kevin Y', 'Brian Smith', 'Brian S',
        'Cesar Andino', 'Cesar A',
        // D. Partlo
        'Dan Partlo', 'Joe Donley', 'Kevin McKelvey', 'Kevin Mckelvey',
        // E. O (Olschansky)
        'Eddie Olschansky', 'Eddie Olschanskey', 'Eddie O',
        'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzalez', 'Mike Gonzales', 'Mike Gonz',
        // neon nightmares (T. Massimiani)
        'Tony Massimiani', 'Chris Benco', 'Chris B',
        'Dominick Russano', 'Dom Russano',
        // J. Ragnoni
        'John Ragnoni', 'Marc Tate', 'David Brunner', 'Dave Brunner',
        'Derek Fess', 'Josh Kelly',
        // N. Mezlak
        'Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U', 'Dillon Ullises',
        // D. Russano
        'Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric D', 'Eric',
        'Luke Kollias',
        // Known subs / fill-ins
        'Kim Scott', 'Ray Skrovan', 'Matty Wentz', 'Matt Wentz',
        'Anthony Donley', 'Derek',
    ]);
    return _knownPlayers;
}

// Add a fill-in player name to the known-players set for the duration of a match parse.
function registerFillIn(name) {
    knownPlayers().add(name);
}

// ---------------------------------------------------------------------------
// CANONICAL NAME MAP
// Normalises DC display names → the name stored in Firestore player docs.
// ---------------------------------------------------------------------------

const CANONICAL = {
    'Matthew Pagel':      'Matt Pagel',
    'Christian Ketchem':  'Christian Ketchum',
    'Nate Kull':          'Nathan Kull',
    'Steph Kull':         'Stephanie Kull',
    'Jenn M':             'Jennifer Malek',
    'Jenn Malek':         'Jennifer Malek',
    'Mike Gonzales':      'Michael Gonzalez',
    'Mike Gonzalez':      'Michael Gonzalez',
    'Mike Gonz':          'Michael Gonzalez',
    'Eddie O':            'Eddie Olschansky',
    'Eddie Olschanskey':  'Eddie Olschansky',
    'Kevin Y':            'Kevin Yasenchak',
    'Brian S':            'Brian Smith',
    'Cesar A':            'Cesar Andino',
    'Dom Russano':        'Dominick Russano',
    'Kevin Mckelvey':     'Kevin McKelvey',
    'Mike Jarvis':        'Michael Jarvis',
    'Chris B':            'Chris Benco',
    'Matt Wentz':         'Matthew Wentz',
    'Matty Wentz':        'Matthew Wentz',
    'Dillon U':           'Dillon Ulisses',
    'Dillon Ullises':     'Dillon Ulisses',
    'Dave Bonness':       'Dave Bonness',
};
function canon(name) { return CANONICAL[name] || name; }

// ---------------------------------------------------------------------------
// CRICKET HELPERS
// ---------------------------------------------------------------------------

/**
 * Count marks from a cricket hit string.
 * S/D/T prefix = 1/2/3 marks per dart; DB=2, SB=1.
 * "Sx2" means 2 single darts (= 2 marks total).
 * "∅" / "X" / "" = 0 marks (full missed turn still counts as 3 darts).
 */
function countCricketMarks(hitStr) {
    if (!hitStr) return 0;
    const s = hitStr.trim();
    if (s === '∅' || s === 'X' || s === '' || s === 'Start') return 0;
    let total = 0;
    for (const part of s.split(',').map(p => p.trim()).filter(Boolean)) {
        const mult = (part.match(/x(\d+)$/i) || [, 1])[1];
        const base = part.replace(/x\d+$/i, '').trim();
        let m = 0;
        if (base === 'DB')            m = 2;
        else if (base === 'SB')       m = 1;
        else if (base.startsWith('T')) m = 3;
        else if (base.startsWith('D')) m = 2;
        else if (base.startsWith('S')) m = 1;
        total += m * parseInt(mult);
    }
    return total;
}

/**
 * Count actual darts thrown in a cricket hit string.
 * Each comma-separated segment = 1 dart, unless multiplier (e.g. "Sx2" = 2 darts).
 * Miss "∅"/"X" = 3 darts (full turn).  "Start" = 0 (cork; no darts thrown yet).
 */
function countCricketDarts(hitStr) {
    if (!hitStr) return 3;
    const s = hitStr.trim();
    if (s === '∅' || s === 'X' || s === '') return 3;
    if (s === 'Start') return 0;
    let total = 0;
    for (const part of s.split(',').map(p => p.trim()).filter(Boolean)) {
        const m = part.match(/x(\d+)$/i);
        total += m ? parseInt(m[1]) : 1;
    }
    return total;
}

// ---------------------------------------------------------------------------
// HEADER PARSING
// ---------------------------------------------------------------------------

/**
 * Extract match metadata from the first ~6 lines of a normalised DC text file.
 * Date line format: "Date: Wednesday, 18-Mar-2026"
 * Time lines: "Start: 7:15 PM" / "End: 10:07 PM"
 * Durations: "Game Time: 2:52" / "Match Length: 2:52"
 */
function parseHeader(lines) {
    const meta = {
        match_date: null, start_time: null, end_time: null,
        game_time_minutes: null, match_length_minutes: null,
        total_darts: null, total_games: null,
    };

    for (const line of lines.slice(0, 8)) {
        // Date: Wednesday, 18-Mar-2026
        const dateM = line.match(/Date:\s+\w+,\s+(\d{1,2}-\w+-\d{4})/);
        if (dateM) {
            const d = new Date(dateM[1]);
            if (!isNaN(d)) {
                const y  = d.getUTCFullYear();
                const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dy = String(d.getUTCDate()).padStart(2, '0');
                meta.match_date = `${y}-${mo}-${dy}`;
            }
        }

        const buildISO = (h, m, ampm, dateStr) => {
            let hh = parseInt(h), mm = parseInt(m);
            if (ampm.toUpperCase() === 'PM' && hh !== 12) hh += 12;
            if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
            const utcH = hh + 5; // EST → UTC
            if (!dateStr) return null;
            const [yr, mo2, d2] = dateStr.split('-').map(Number);
            if (utcH >= 24) {
                const next = new Date(Date.UTC(yr, mo2 - 1, d2 + 1));
                return `${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}-${String(next.getUTCDate()).padStart(2,'0')}T${String(utcH-24).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00Z`;
            }
            return `${dateStr}T${String(utcH).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00Z`;
        };

        const sm = line.match(/Start:\s+(\d+):(\d+)\s+(AM|PM)/i);
        if (sm && meta.match_date) meta.start_time = buildISO(sm[1], sm[2], sm[3], meta.match_date);

        const em = line.match(/End:\s+(\d+):(\d+)\s+(AM|PM)/i);
        if (em && meta.match_date) meta.end_time = buildISO(em[1], em[2], em[3], meta.match_date);

        const gtm = line.match(/Game Time:\s+(\d+):(\d+)/);
        if (gtm) meta.game_time_minutes = parseInt(gtm[1]) * 60 + parseInt(gtm[2]);

        const mlm = line.match(/Match Length:\s+(\d+):(\d+)/);
        if (mlm) meta.match_length_minutes = parseInt(mlm[1]) * 60 + parseInt(mlm[2]);

        const gm = line.match(/Games:\s+(\d+)/);
        if (gm) meta.total_games = parseInt(gm[1]);

        const dm = line.match(/Darts:\s+([\d,]+)/);
        if (dm) meta.total_darts = parseInt(dm[1].replace(/,/g, ''));
    }

    return meta;
}

// ---------------------------------------------------------------------------
// TEXT STRUCTURE SPLITTING
// ---------------------------------------------------------------------------

function splitIntoSets(lines) {
    const sets = [];
    let cur = null;
    for (const line of lines) {
        const m = line.match(/^Set (\d+)\s*$/);
        if (m) {
            if (cur) sets.push(cur);
            cur = { setNum: parseInt(m[1]), lines: [] };
        } else if (cur) {
            cur.lines.push(line);
        }
    }
    if (cur) sets.push(cur);
    return sets;
}

/**
 * Each set block contains one or more game headers in the form:
 *   "Game X.Y - FORMAT\t<leftScore>\t-\t<rightScore>\t<duration>"
 * (already normalised by fetch-dc-matches.js from the multi-line new-UI format)
 */
function splitSetIntoGames(setLines) {
    const games = [];
    let cur = null;
    for (const line of setLines) {
        const m = line.match(/^Game (\d+)\.(\d+) - (.+?)\t(\d+)\t-\t(\d+)\t([\d:]+)\s*$/);
        if (m) {
            if (cur) games.push(cur);
            cur = {
                setNum:         parseInt(m[1]),
                legNum:         parseInt(m[2]),
                formatStr:      m[3].trim(),
                leftFinalScore: parseInt(m[4]),
                rightFinalScore:parseInt(m[5]),
                duration:       m[6],
                lines:          [],
            };
        } else if (cur) {
            cur.lines.push(line);
        }
    }
    if (cur) games.push(cur);
    return games;
}

// The column-header row that precedes throw data.
function isHeaderLine(line) {
    return /!\s+Player\s+Turn\s+Score\s+Rnd\s+Score\s+Turn\s+Player/.test(line);
}

// Summary/stats row that follows throw data (different signatures in old vs new UI).
function isSummaryLine(line) {
    return /3 Dart Avg/.test(line) ||
           (/^\d+\.?\d*\s+(Darts:\s+\d+)?$/.test(line.trim()) && !/Player/.test(line));
}

// ---------------------------------------------------------------------------
// ROW PARSING — 501
// ---------------------------------------------------------------------------
//
// Full DC tab row (9 fields):
//   [0] notable_L  (e.g. "140", "DO (2)", or "")
//   [1] player_L
//   [2] turn_L     (points scored, or "X" bust, or "∅" miss)
//   [3] remaining_L
//   [4] round
//   [5] remaining_R
//   [6] turn_R
//   [7] player_R
//   [8] notable_R
//
// Partial rows (one side has already checked out) have fewer fields.
// Strategy: locate the round number (field where value is 1–30), then split
// into left-of-round and right-of-round halves.

function parse501Row(rawLine, homeTeam, awayTeam) {
    const f = rawLine.split('\t').map(s => s.trim());
    const n = f.length;
    const known = knownPlayers();

    // Find round index
    let roundIdx = -1;
    if (n >= 5 && /^\d+$/.test(f[4]) && parseInt(f[4]) >= 1 && parseInt(f[4]) <= 30) {
        roundIdx = 4;
    }
    if (roundIdx < 0) {
        for (let i = 1; i < n; i++) {
            if (/^\d+$/.test(f[i]) && parseInt(f[i]) >= 1 && parseInt(f[i]) <= 30) {
                roundIdx = i; break;
            }
        }
    }
    if (roundIdx < 0) return null;

    const round      = parseInt(f[roundIdx]);
    const leftFields = f.slice(0, roundIdx);
    const rightFields = f.slice(roundIdx + 1);
    const result     = { round, left: null, right: null };

    // ---- LEFT SIDE ----
    const leftPlayer = leftFields.find(fv => known.has(fv)) || null;
    if (leftPlayer) {
        let remaining = null, turn = null, notable = null, checkoutDarts = null;

        // Remaining = last numeric (0–501) in leftFields
        for (let i = leftFields.length - 1; i >= 0; i--) {
            if (/^\d+$/.test(leftFields[i])) {
                const v = parseInt(leftFields[i]);
                if (v >= 0 && v <= 501) {
                    remaining = v;
                    // Turn = field just before remaining
                    if (i > 0) {
                        const t = leftFields[i - 1];
                        turn = /^\d+$/.test(t) ? parseInt(t) : (t === 'X' || t === '∅') ? 0 : 0;
                    }
                    break;
                }
            }
        }

        // Notable / DO marker
        for (const fv of leftFields) {
            if (!fv) continue;
            const doM = fv.match(/^DO\s*\((\d)\)$/i);
            if (doM) {
                checkoutDarts = parseInt(doM[1]);
                notable = `DO (${doM[1]})`;
            } else if (/^\d+$/.test(fv)) {
                const v = parseInt(fv);
                // Scores >= 95 that aren't the remaining or turn value are notable
                if (v >= 95 && v !== remaining && v !== turn) notable = fv;
            }
        }

        const team = getTeamForPlayer(leftPlayer, homeTeam, awayTeam);
        result.left = { player: leftPlayer, team, score: turn || 0, remaining };
        if (remaining === 0) result.left.checkout = true;
        if (checkoutDarts)   result.left.checkout_darts = checkoutDarts;
        if (notable)         result.left.notable = notable;
    }

    // ---- RIGHT SIDE ----
    const rightPlayer = rightFields.find(fv => known.has(fv)) || null;
    if (rightPlayer) {
        let remaining = null, turn = null, notable = null, checkoutDarts = null;
        const pidx = rightFields.indexOf(rightPlayer);

        // Remaining = first numeric (0–501) in rightFields (it precedes player on right)
        for (let i = 0; i < pidx; i++) {
            if (/^\d+$/.test(rightFields[i])) {
                const v = parseInt(rightFields[i]);
                if (v >= 0 && v <= 501) {
                    remaining = v;
                    if (i + 1 < pidx) {
                        const t = rightFields[i + 1];
                        turn = /^\d+$/.test(t) ? parseInt(t) : (t === 'X' || t === 'âˆ…') ? 0 : 0;
                    }
                    break;
                }
            }
        }

        // Notable / DO: typically after player name in rightFields
        for (let i = pidx; i < rightFields.length; i++) {
            const fv = rightFields[i];
            if (!fv) continue;
            const doM = fv.match(/^DO\s*\((\d)\)$/i);
            if (doM) {
                checkoutDarts = parseInt(doM[1]);
                notable = `DO (${doM[1]})`;
            } else if (/^\d+$/.test(fv)) {
                const v = parseInt(fv);
                if (v >= 95 && v !== remaining && v !== turn) notable = fv;
            }
        }

        const team = getTeamForPlayer(rightPlayer, homeTeam, awayTeam);
        result.right = { player: rightPlayer, team, score: turn || 0, remaining };
        if (remaining === 0) result.right.checkout = true;
        if (checkoutDarts)   result.right.checkout_darts = checkoutDarts;
        if (notable)         result.right.notable = notable;
    }

    return result;
}

// ---------------------------------------------------------------------------
// ROW PARSING — CRICKET
// ---------------------------------------------------------------------------
//
// Full DC tab row (9 fields):
//   [0] notable_L   (e.g. "5M", "7M", "9M", "3B", "5B", or "")
//   [1] player_L
//   [2] hit_L       (e.g. "T20,S20", "DB", "∅", "Start")
//   [3] score_L     (running total, or "Start" for cork)
//   [4] round
//   [5] score_R
//   [6] hit_R
//   [7] player_R
//   [8] notable_R

function parseCricketRow(rawLine, homeTeam, awayTeam) {
    const f = rawLine.split('\t').map(s => s.trim());
    const n = f.length;
    const known = knownPlayers();

    let roundIdx = -1;
    if (n >= 5 && /^\d+$/.test(f[4]) && parseInt(f[4]) >= 1 && parseInt(f[4]) <= 30) {
        roundIdx = 4;
    }
    if (roundIdx < 0) {
        for (let i = 0; i < n; i++) {
            if (/^\d+$/.test(f[i]) && parseInt(f[i]) >= 1 && parseInt(f[i]) <= 30) {
                roundIdx = i; break;
            }
        }
    }
    if (roundIdx < 0) return null;

    const round      = parseInt(f[roundIdx]);
    const leftFields = f.slice(0, roundIdx);
    const rightFields = f.slice(roundIdx + 1);
    const result     = { round, left: null, right: null };

    // ---- LEFT SIDE ----
    const leftPlayer = leftFields.find(fv => known.has(fv)) || null;
    if (leftPlayer) {
        const pidx  = leftFields.indexOf(leftPlayer);
        const hit   = pidx + 1 < leftFields.length ? leftFields[pidx + 1] : '∅';
        const scoreStr = pidx + 2 < leftFields.length ? leftFields[pidx + 2] : null;
        const isCork   = scoreStr === 'Start';
        const score    = !isCork && scoreStr && /^\d+$/.test(scoreStr) ? parseInt(scoreStr) : 0;
        const notable  = leftFields[0] && /^(\d+M|3B|5B)$/.test(leftFields[0]) ? leftFields[0] : null;
        const team     = getTeamForPlayer(leftPlayer, homeTeam, awayTeam);
        result.left = {
            player: leftPlayer, team, hit, score,
            marks: countCricketMarks(hit),
            darts: countCricketDarts(hit),
        };
        if (isCork)  result.left.cork    = true;
        if (notable) result.left.notable = notable;
    }

    // ---- RIGHT SIDE ----
    const rightPlayer = rightFields.find(fv => known.has(fv)) || null;
    if (rightPlayer) {
        const pidx     = rightFields.indexOf(rightPlayer);
        const hit      = pidx > 0 ? rightFields[pidx - 1] : '∅';
        const scoreStr = pidx > 1 ? rightFields[pidx - 2] : null;
        const isCork   = scoreStr === 'Start';
        const score    = !isCork && scoreStr && /^\d+$/.test(scoreStr) ? parseInt(scoreStr) : 0;
        const notable  = pidx + 1 < rightFields.length && /^(\d+M|3B|5B)$/.test(rightFields[pidx + 1])
                         ? rightFields[pidx + 1] : null;
        const team     = getTeamForPlayer(rightPlayer, homeTeam, awayTeam);
        result.right = {
            player: rightPlayer, team, hit, score,
            marks: countCricketMarks(hit),
            darts: countCricketDarts(hit),
        };
        if (isCork)  result.right.cork    = true;
        if (notable) result.right.notable = notable;
    }

    return result;
}

// ---------------------------------------------------------------------------
// GAME / LEG PARSING
// ---------------------------------------------------------------------------

function parseGame(game, homeTeam, awayTeam) {
    const is501    = /501|301|701/i.test(game.formatStr);
    const isCricket = /cricket/i.test(game.formatStr);
    const format   = is501 ? '501' : 'cricket';

    const darts  = {};   // player → dart count
    const points = {};   // player → 501 points
    const marks  = {};   // player → cricket marks
    const checkout = {}; // player → { darts, score }
    const throws = [];
    let inData = false;

    for (const rawLine of game.lines) {
        if (isHeaderLine(rawLine))  { inData = true;  continue; }
        if (isSummaryLine(rawLine)) { inData = false; continue; }
        if (!inData || !rawLine.trim()) continue;

        const row = is501
            ? parse501Row(rawLine, homeTeam, awayTeam)
            : parseCricketRow(rawLine, homeTeam, awayTeam);
        if (!row) continue;

        for (const side of [row.left, row.right]) {
            if (!side) continue;
            const p = side.player;
            if (!darts[p]) { darts[p] = 0; points[p] = 0; marks[p] = 0; }

            if (is501) {
                darts[p] += 3;
                points[p] += side.score || 0;
                if (side.checkout) {
                    const cd = side.checkout_darts || 3;
                    checkout[p] = { darts: cd, score: side.score };
                    darts[p] = darts[p] - 3 + cd; // correct for partial final turn
                }
            } else {
                darts[p] += side.darts;
                marks[p] += side.marks;
            }
        }

        throws.push({ round: row.round, left: row.left || null, right: row.right || null });
    }

    // ---- WINNER DETECTION ----
    let winner = null;

    if (is501) {
        const leftWon  = throws.some(t => t.left  && t.left.checkout);
        const rightWon = throws.some(t => t.right && t.right.checkout);
        if (leftWon && !rightWon) {
            winner = throws.find(t => t.left?.checkout)?.left?.team;
        } else if (rightWon && !leftWon) {
            winner = throws.find(t => t.right?.checkout)?.right?.team;
        } else {
            // No checkout found in throw data — fall back to header final scores.
            // In 501, lower remaining score = winner.
            const lWins = game.leftFinalScore < game.rightFinalScore;
            const firstThrow = throws[0];
            winner = lWins
                ? (firstThrow?.left?.team  || null)
                : (firstThrow?.right?.team || null);
        }
    } else {
        // Cricket: higher final score (marks) wins.
        if (game.leftFinalScore > game.rightFinalScore) {
            winner = throws[0]?.left?.team || null;
        } else if (game.rightFinalScore > game.leftFinalScore) {
            winner = throws[0]?.right?.team || null;
        } else {
            // Tied in header — look at who threw last.
            const last = throws[throws.length - 1];
            if (last?.right && !last?.left) winner = last.right.team;
            else if (last?.left && !last?.right) winner = last.left.team;
        }
    }

    // ---- PLAYER STATS ----
    const playerStats = {};
    for (const [name, dartCount] of Object.entries(darts)) {
        const team = getTeamForPlayer(name, homeTeam, awayTeam);
        const cName = canon(name);
        if (is501) {
            const pts = points[name] || 0;
            playerStats[cName] = {
                darts: dartCount, points: pts, marks: 0,
                three_dart_avg: dartCount > 0 ? parseFloat(((pts / dartCount) * 3).toFixed(2)) : 0,
                mpr: 0, side: team,
            };
        } else {
            const m = marks[name] || 0;
            playerStats[cName] = {
                darts: dartCount, points: 0, marks: m,
                three_dart_avg: 0,
                mpr: dartCount > 0 ? parseFloat(((m / dartCount) * 3).toFixed(2)) : 0,
                side: team,
            };
        }
    }

    // ---- CHECKOUT INFO ----
    let checkoutVal = null, checkoutDartsVal = null;
    if (is501) {
        for (const t of throws) {
            for (const side of [t.left, t.right]) {
                if (side?.checkout) {
                    checkoutVal = side.score;
                    checkoutDartsVal = side.checkout_darts || null;
                }
            }
        }
    }

    return { setNum: game.setNum, legNum: game.legNum, format, winner,
             throws, playerStats, checkoutVal, checkoutDartsVal,
             leftFinalScore: game.leftFinalScore, rightFinalScore: game.rightFinalScore,
             duration: game.duration };
}

// ---------------------------------------------------------------------------
// CONVERT THROWS → FIRESTORE FORMAT
// ---------------------------------------------------------------------------
//
// Throw rows are stored as { round, home: {...}, away: {...} }
// using the actual Firestore home/away rather than DC left/right.

function convertThrow(t) {
    const row = { round: t.round };

    const mapSide = (s) => {
        if (!s) return null;
        const out = { player: canon(s.player), score: s.score || 0 };
        if (s.remaining != null) out.remaining = s.remaining;
        if (s.hit)               out.hit = s.hit;
        if (s.marks > 0)         out.marks = s.marks;
        if (s.notable)           out.notable = s.notable;
        if (s.checkout)          out.checkout = true;
        if (s.checkout_darts)    out.checkout_darts = s.checkout_darts;
        if (s.cork)              out.cork = true;
        return out;
    };

    // Map left/right → home/away using each side's resolved team.
    if (t.left) {
        const side = mapSide(t.left);
        if (side) row[t.left.team || 'home'] = side;
    }
    if (t.right) {
        const side = mapSide(t.right);
        if (side) row[t.right.team || 'away'] = side;
    }

    return row;
}

// ---------------------------------------------------------------------------
// BUILD FIRESTORE GAMES ARRAY
// ---------------------------------------------------------------------------

function buildFirestoreGames(legs) {
    // Group by set number
    const bySet = {};
    for (const leg of legs) {
        (bySet[leg.setNum] = bySet[leg.setNum] || []).push(leg);
    }

    const games = [];
    for (const key of Object.keys(bySet).sort((a, b) => a - b)) {
        const setLegs    = bySet[key].sort((a, b) => a.legNum - b.legNum);
        let homeLegs = 0, awayLegs = 0;
        const homePlayers = new Set(), awayPlayers = new Set();
        const fsLegs = [];

        for (const leg of setLegs) {
            if (leg.winner === 'home') homeLegs++;
            else if (leg.winner === 'away') awayLegs++;

            // Aggregate side stats across player_stats
            const homeStats = { darts: 0, points: 0, marks: 0, three_dart_avg: 0, mpr: 0 };
            const awayStats = { darts: 0, points: 0, marks: 0, three_dart_avg: 0, mpr: 0 };
            const playerStats = {};

            for (const [cName, ps] of Object.entries(leg.playerStats)) {
                playerStats[cName] = {
                    darts: ps.darts || 0, points: ps.points || 0, marks: ps.marks || 0,
                    three_dart_avg: ps.three_dart_avg || 0, mpr: ps.mpr || 0,
                };
                const target  = ps.side === 'home' ? homeStats : awayStats;
                const players = ps.side === 'home' ? homePlayers : awayPlayers;
                players.add(cName);
                target.darts  += ps.darts  || 0;
                target.points += ps.points || 0;
                target.marks  += ps.marks  || 0;
            }

            if (leg.format === '501') {
                homeStats.three_dart_avg = homeStats.darts > 0
                    ? parseFloat(((homeStats.points / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.three_dart_avg = awayStats.darts > 0
                    ? parseFloat(((awayStats.points / awayStats.darts) * 3).toFixed(2)) : 0;
            } else {
                homeStats.mpr = homeStats.darts > 0
                    ? parseFloat(((homeStats.marks / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.mpr = awayStats.darts > 0
                    ? parseFloat(((awayStats.marks / awayStats.darts) * 3).toFixed(2)) : 0;
            }

            const fsLeg = {
                leg_number:   leg.legNum,
                format:       leg.format,
                winner:       leg.winner,
                home_stats:   homeStats,
                away_stats:   awayStats,
                player_stats: playerStats,
                throws:       leg.throws.map(convertThrow),
            };
            if (leg.format === '501' && leg.checkoutVal !== null) {
                fsLeg.checkout = leg.checkoutVal;
                if (leg.checkoutDartsVal) fsLeg.checkout_darts = leg.checkoutDartsVal;
            }
            fsLegs.push(fsLeg);
        }

        const setWinner = homeLegs > awayLegs ? 'home' : awayLegs > homeLegs ? 'away' : 'tie';
        const formats   = new Set(setLegs.map(l => l.format));
        const setType   = formats.size > 1 ? 'mixed' : setLegs[0]?.format || '501';

        games.push({
            set:          parseInt(key),
            game_number:  parseInt(key),
            type:         setType,
            format:       setLegs[0]?.format || '501',
            home_players: Array.from(homePlayers),
            away_players: Array.from(awayPlayers),
            winner:       setWinner,
            result:       { home_legs: homeLegs, away_legs: awayLegs },
            status:       'completed',
            legs:         fsLegs,
        });
    }

    return games;
}

// ---------------------------------------------------------------------------
// MAIN PARSE FUNCTION
// ---------------------------------------------------------------------------

function parseDCWebText(text, config) {
    // Register fill-in names so the row parsers can identify them
    setFillIns(config.fillIns || {});
    for (const name of Object.keys(config.fillIns || {})) registerFillIn(name);

    const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
    const meta  = parseHeader(lines);
    const sets  = splitIntoSets(lines).filter(s => s.setNum <= 9);  // triples = max 9 sets

    console.log(`  Sets found: ${splitIntoSets(lines).length} (processing ${sets.length})`);

    const allLegs = [];
    for (const setBlock of sets) {
        for (const game of splitSetIntoGames(setBlock.lines)) {
            const parsed = parseGame(game, config.homeTeam, config.awayTeam);
            const co = parsed.checkoutVal !== null ? ` checkout=${parsed.checkoutVal}` : '';
            console.log(`    Set ${game.setNum} Leg ${game.legNum} (${game.formatStr}): winner=${parsed.winner}${co}`);
            allLegs.push(parsed);
        }
    }

    const games = buildFirestoreGames(allLegs);
    let homeScore = 0, awayScore = 0;
    games.forEach(g => { if (g.winner === 'home') homeScore++; else if (g.winner === 'away') awayScore++; });

    return {
        games,
        home_team:            config.homeTeam,
        away_team:            config.awayTeam,
        home_score:           homeScore,
        away_score:           awayScore,
        final_score:          { home: homeScore, away: awayScore },
        match_date:           meta.match_date,
        start_time:           meta.start_time,
        end_time:             meta.end_time,
        game_time_minutes:    meta.game_time_minutes,
        match_length_minutes: meta.match_length_minutes,
        total_darts:          meta.total_darts,
        total_legs:           allLegs.length,
        total_sets:           games.length,
        status:               'completed',
    };
}

// ---------------------------------------------------------------------------
// HTTP POST
// ---------------------------------------------------------------------------

function post(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const u    = new URL(url);
        const req  = https.request(
            { hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
            res => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch { resolve({ raw: s }); } }); }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

async function main() {
    const args    = process.argv.slice(2);
    const live    = args.includes('--live');
    const weekArg = args.includes('--week')  ? parseInt(args[args.indexOf('--week')  + 1]) : null;
    const matchArg = args.includes('--match') ? args[args.indexOf('--match') + 1] : null;

    let toRun = MATCHES;
    if (matchArg) toRun = MATCHES.filter(m => m.matchId === matchArg);
    else if (weekArg) toRun = MATCHES.filter(m => m.week === weekArg);

    console.log(`=== DC Match Import (${toRun.length} match${toRun.length === 1 ? '' : 'es'}) ===`);
    if (!live) console.log('[DRY RUN — pass --live to write to Firebase]\n');

    const results = [];

    for (const config of toRun) {
        console.log(`\n--- ${config.name} ---`);
        const filePath = path.join(DC_WEB_DIR, config.dataFile);

        if (!fs.existsSync(filePath)) {
            console.error(`  ERROR: data file not found: ${filePath}`);
            results.push({ name: config.name, ok: false, error: 'file not found' });
            continue;
        }

        let matchData;
        try {
            matchData = parseDCWebText(fs.readFileSync(filePath, 'utf8'), config);
        } catch (err) {
            console.error(`  PARSE ERROR: ${err.message}`);
            results.push({ name: config.name, ok: false, error: err.message });
            continue;
        }

        console.log(`  Result: ${config.homeTeam} ${matchData.home_score} – ${matchData.away_score} ${config.awayTeam}`);
        console.log(`  Sets: ${matchData.total_sets}  Legs: ${matchData.total_legs}  Darts: ${matchData.total_darts}`);

        if (!live) {
            results.push({ name: config.name, ok: true });
            continue;
        }

        try {
            const importResult = await post(
                'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData',
                { leagueId: LEAGUE_ID, matchId: config.matchId, matchData }
            );
            if (importResult.success || importResult.matchId) {
                console.log(`  Imported OK`);
                results.push({ name: config.name, ok: true });
            } else {
                console.error(`  Import FAILED:`, JSON.stringify(importResult));
                results.push({ name: config.name, ok: false, error: JSON.stringify(importResult) });
            }
        } catch (err) {
            console.error(`  POST error: ${err.message}`);
            results.push({ name: config.name, ok: false, error: err.message });
        }
    }

    console.log('\n=== SUMMARY ===');
    for (const r of results) {
        console.log(`[${r.ok ? 'OK' : 'FAIL'}] ${r.name}${r.error ? ': ' + r.error : ''}`);
    }

    const okCount = results.filter(r => r.ok).length;
    if (live && okCount > 0) {
        console.log('\n--- Recalculating league stats ---');
        const recalc = await post(
            'https://us-central1-brdc-v2.cloudfunctions.net/recalculateAllLeagueStats',
            { leagueId: LEAGUE_ID }
        );
        if (recalc.success) {
            console.log(`Stats recalculated: ${recalc.matchesProcessed} matches → ${recalc.playersUpdated} players`);
        } else {
            console.error('Stats recalc failed:', JSON.stringify(recalc));
        }
    }

    console.log('\n=== Done ===');
}

main().catch(err => { console.error(err); process.exit(1); });
