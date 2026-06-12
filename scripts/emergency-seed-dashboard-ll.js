const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const projectId = 'dashboard-ll';
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
const serviceAccountPath = 'E:/scribd/dashboard-ll-fc5f4ba59f84.json';
const authExportPath = path.join(process.env.TEMP || process.env.TMP || '.', 'dashboardll-auth-check.json');

process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
admin.initializeApp({ projectId });
const db = admin.firestore();

const teamIds = {
  'D. Partlo': 'FDk7AdpAiEoDuwN7wxvQ',
  'neon nightmares': 'HOE5XY3YzHte4WdMNnpu',
  'D. Pagel': 'U5ZEAT55xiNM9Otarafx',
  'N. Mezlak': 'XYiJFZwkSPID7K3j21dt',
  'M. Pagel': 'mgR4e3zldLsM9tAnXmK8',
  'Make A Wish': 'mgR4e3zldLsM9tAnXmK8',
  'E. O': 'nxsNIQEEvmbhPei5t6s8',
  'K. Yasenchak': 'oZSTZMxgFNz9Nz206alJ',
  'J. Ragnoni': 'qFJie5BPOl4tkPb7ImDm',
  'D. Russano': 'rAbQ8TsEphy7wXYvLv2H',
  'N. Kull': 's9rgmDoXTckL1KmrkV1f'
};

const teamNames = Object.entries(teamIds).reduce((acc, [name, id]) => {
  if (!acc[id]) acc[id] = name === 'M. Pagel' ? 'Make A Wish' : name;
  return acc;
}, {});

const triplesMatchFormat = [
  { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'C', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
  { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'AB', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
    { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
    { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
    { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
  ] },
  { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'C', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
  { game_type: 'cricket', best_of: 3, num_players: 1, player_level: 'A', in_rule: 'n/a', out_rule: 'n/a', points: 1 },
  { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'BC', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
    { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
    { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
    { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
  ] },
  { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'B', in_rule: 'straight', out_rule: 'double', points: 1 },
  { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'B', in_rule: 'straight', out_rule: 'double', points: 1 },
  { game_type: 'mixed', best_of: 3, num_players: 2, player_level: 'AC', in_rule: 'straight', out_rule: 'double', points: 1, legs: [
    { game_type: '501', x01_value: '501', in_rule: 'straight', out_rule: 'double' },
    { game_type: 'cricket', in_rule: 'n/a', out_rule: 'n/a' },
    { game_type: 'corks_choice', in_rule: 'n/a', out_rule: 'n/a' }
  ] },
  { game_type: '501', x01_value: '501', best_of: 3, num_players: 1, player_level: 'C', in_rule: 'straight', out_rule: 'double', points: 1 }
];

const seedPlayers = {
  X2DMb9bP4Q8fy9yr5Fam: { name: 'Donnie Pagel', email: 'donniepagel@gmail.com', team_id: teamIds['D. Pagel'], level: 'A', is_admin: true, is_master_admin: true, is_director: true, position: 1 },
  TJ3uwMdslbtpjtq17xW4: { name: 'Matthew Wentz', team_id: teamIds['D. Pagel'], level: 'B', position: 2 },
  '7Hj4KWNpm0GviTYbwfbM': { name: 'Jennifer Malek', team_id: teamIds['D. Pagel'], level: 'C', position: 3 },
  SwnH8GUBmrcdmOAs07Vp: { name: 'John Ragnoni', team_id: teamIds['J. Ragnoni'], level: 'A', position: 1 },
  ZwdiN0qfmIY5MMCOLJps: { name: 'Marc Tate', email: 'marctate1970@gmail.com', team_id: teamIds['J. Ragnoni'], level: 'B', is_captain: true, position: 2 },
  YHCbJsXKYjFMPk5Wk7kd: { name: 'Anthony Donley', email: 'anthonydonley1106@gmail.com', team_id: teamIds['J. Ragnoni'], level: 'A', position: 1 },
  olBQqegkQWeq310ciM5dEDHZOz13: { name: 'Dave Bonness', email: 'dwb44134@yahoo.com', team_id: null, level: 'B', is_fill_in: true }
};

const knownTeamByName = {
  'Donnie Pagel': 'D. Pagel',
  'Matthew Wentz': 'D. Pagel',
  'Jennifer Malek': 'D. Pagel',
  'John Ragnoni': 'J. Ragnoni',
  'Marc Tate': 'J. Ragnoni',
  'Anthony Donley': 'J. Ragnoni',
  'Dave Bonness': null,
  'Dan Partlo': 'D. Partlo',
  'Michael Jarvis': 'D. Partlo',
  'Stephanie Kull': 'D. Partlo',
  'Dillon Ulisses': 'neon nightmares',
  'Tony Massimiani': 'neon nightmares',
  'Dominick Russano': 'D. Russano',
  'Danny Russano': 'D. Russano',
  'Chris Russano': 'D. Russano',
  'Nick Mezlak': 'N. Mezlak',
  'Cory Jacobs': 'N. Mezlak',
  'Nathan Kull': 'N. Kull',
  'Eddie Olschansky': 'E. O',
  'Eric Duale': 'E. O',
  'Kevin Yasenchak': 'K. Yasenchak',
  'Brian Smith': 'K. Yasenchak',
  'Cesar Andino': 'K. Yasenchak',
  'Matt Pagel': 'Make A Wish',
  'Christian Ketchum': 'Make A Wish',
  'John Linden': 'Make A Wish',
  'Kevin Mckelvey': 'neon nightmares',
  'Jeff Boss': 'E. O',
  'Chris Benco': 'N. Kull',
  'Joe Donley': 'N. Kull',
  'Joe Peters': 'N. Mezlak'
};

const knownPositionByName = {
  'Tony Massimiani': 1,
  'Dillon Ulisses': 2,
  'Kevin Mckelvey': 3,
  'Matt Pagel': 1,
  'Christian Ketchum': 2,
  'John Linden': 3,
  'Kevin Yasenchak': 1,
  'Brian Smith': 2,
  'Cesar Andino': 3,
  'Donnie Pagel': 1,
  'Matthew Wentz': 2,
  'Jennifer Malek': 3,
  'John Ragnoni': 1,
  'Marc Tate': 2,
  'Anthony Donley': 3,
  'Dan Partlo': 1,
  'Michael Jarvis': 2,
  'Stephanie Kull': 3,
  'Danny Russano': 1,
  'Chris Russano': 2,
  'Dominick Russano': 3,
  'Eric Duale': 1,
  'Jeff Boss': 2,
  'Eddie Olschansky': 3,
  'Nathan Kull': 1,
  'Joe Donley': 2,
  'Chris Benco': 3,
  'Nick Mezlak': 1,
  'Cory Jacobs': 2,
  'Joe Peters': 3
};

function levelFromStats(stats) {
  const avg = Number(stats.x01_three_dart_avg || 0);
  if (avg >= 52) return 'A';
  if (avg >= 40) return 'B';
  return 'C';
}

function levelFromRosterPosition(position, fallback) {
  if (position === 1) return 'A';
  if (position === 2) return 'B';
  if (position === 3) return 'C';
  return fallback || 'C';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fromBackupTimestamp(value) {
  if (!value || typeof value !== 'object') return value;
  if (value._seconds !== undefined) return new admin.firestore.Timestamp(value._seconds, value._nanoseconds || 0);
  if (value.__timestamp) return admin.firestore.Timestamp.fromDate(new Date(value.__timestamp));
  return value;
}

function normalizeTimestamps(value) {
  if (Array.isArray(value)) return value.map(normalizeTimestamps);
  if (!value || typeof value !== 'object') return value;
  const converted = fromBackupTimestamp(value);
  if (converted !== value) return converted;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeTimestamps(child)]));
}

function authUidByEmail(email) {
  if (!fs.existsSync(authExportPath)) return null;
  const exportData = readJson(authExportPath);
  const user = (exportData.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase());
  return user?.localId || null;
}

function authByDisplayName() {
  if (!fs.existsSync(authExportPath)) return new Map();
  const exportData = readJson(authExportPath);
  const map = new Map();
  for (const user of exportData.users || []) {
    const display = String(user.displayName || '').trim().toLowerCase();
    if (display && !map.has(display)) {
      map.set(display, user);
    }
  }
  return map;
}

function weekDate(week) {
  const start = new Date('2026-01-14T12:00:00Z');
  start.setUTCDate(start.getUTCDate() + (Number(week) - 1) * 7);
  return start.toISOString().slice(0, 10);
}

function makeMatchId(week, homeId, awayId) {
  return `emergency_w${String(week).padStart(2, '0')}_${homeId.slice(0, 5)}_${awayId.slice(0, 5)}`;
}

function parseScheduleCsv() {
  const file = 'E:/scribd/BRDC_matches.xlsx - Triples Match Reports.csv';
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [weekRaw, dateRaw, matchRaw] = line.split(',');
      const week = Number(weekRaw);
      const match = String(matchRaw || '').trim();
      const [homeRaw, awayRaw] = match.split(/\s+vs\s+/i);
      if (!week || !dateRaw || !homeRaw || !awayRaw) return null;
      return {
        week,
        date: String(dateRaw).trim(),
        home: homeRaw.trim(),
        away: awayRaw.trim(),
        match
      };
    })
    .filter(Boolean);
}

function matchKey(week, homeId, awayId) {
  return `${Number(week)}|${homeId}|${awayId}`;
}

function normalizeTeamName(name) {
  return String(name || '').trim() === 'M. Pagel' ? 'Make A Wish' : String(name || '').trim();
}

function buildMatchReportMap() {
  const file = 'E:/scribd/triples_match_report_links.json';
  const reports = fs.existsSync(file) ? readJson(file) : [];
  const map = new Map();
  for (const report of reports) {
    const homeName = normalizeTeamName(report.home_team_name);
    const awayName = normalizeTeamName(report.away_team_name);
    const homeId = report.home_team_id || teamIds[homeName];
    const awayId = report.away_team_id || teamIds[awayName];
    if (!report.week || !homeId || !awayId) continue;
    map.set(matchKey(report.week, homeId, awayId), report);
  }
  return map;
}

function buildSummaryMap() {
  const map = new Map();
  const aggregated = fs.existsSync('E:/scribd/_aggregated.json') ? readJson('E:/scribd/_aggregated.json') : [];
  for (const item of aggregated) {
    const homeName = normalizeTeamName(item.team_a);
    const awayName = normalizeTeamName(item.team_b);
    const homeId = teamIds[homeName];
    const awayId = teamIds[awayName];
    if (!item.week || !homeId || !awayId) continue;
    map.set(matchKey(item.week, homeId, awayId), {
      week: Number(item.week),
      home_team_id: homeId,
      away_team_id: awayId,
      home_team_name: teamNames[homeId],
      away_team_name: teamNames[awayId],
      home_score: Number(item.score_a || 0),
      away_score: Number(item.score_b || 0),
      home_legs_won: Number(item.legs_a || 0),
      away_legs_won: Number(item.legs_b || 0),
      total_legs: Number(item.legs_a || 0) + Number(item.legs_b || 0),
      import_source: item.method || 'emergency_summary',
      notes: item.notes || []
    });
  }

  const liveIndex = fs.existsSync('E:/scribd/live_match_index.json') ? readJson('E:/scribd/live_match_index.json') : [];
  for (const item of liveIndex) {
    if (item.status !== 'completed') continue;
    const [homeRaw, awayRaw] = String(item.match || '').split(/\s+vs\s+/i);
    const homeName = normalizeTeamName(homeRaw);
    const awayName = normalizeTeamName(awayRaw);
    const homeId = teamIds[homeName];
    const awayId = teamIds[awayName];
    if (!item.week || !homeId || !awayId) continue;
    const key = matchKey(item.week, homeId, awayId);
    if (map.has(key)) continue;
    map.set(key, {
      week: Number(item.week),
      home_team_id: homeId,
      away_team_id: awayId,
      home_team_name: teamNames[homeId],
      away_team_name: teamNames[awayId],
      home_score: Number(item.home_score || 0),
      away_score: Number(item.away_score || 0),
      home_legs_won: 0,
      away_legs_won: 0,
      total_legs: 0,
      import_source: item.import_source || 'live_match_index_summary',
      notes: []
    });
  }
  return map;
}

function addStandingResult(standings, match) {
  const homeId = match.home_team_id;
  const awayId = match.away_team_id;
  for (const [id, name] of [[homeId, match.home_team_name], [awayId, match.away_team_name]]) {
    standings[id] ||= { team_name: teamNames[id] || name, wins: 0, losses: 0, ties: 0, points: 0, games_won: 0, games_lost: 0, legs_won: 0, legs_lost: 0, matches_played: 0 };
  }
  const homeScore = Number(match.home_score || 0);
  const awayScore = Number(match.away_score || 0);
  standings[homeId].matches_played++;
  standings[awayId].matches_played++;
  standings[homeId].games_won += homeScore;
  standings[homeId].games_lost += awayScore;
  standings[awayId].games_won += awayScore;
  standings[awayId].games_lost += homeScore;
  standings[homeId].points += homeScore;
  standings[awayId].points += awayScore;
  standings[homeId].legs_won += Number(match.home_legs_won || 0);
  standings[homeId].legs_lost += Number(match.away_legs_won || 0);
  standings[awayId].legs_won += Number(match.away_legs_won || 0);
  standings[awayId].legs_lost += Number(match.home_legs_won || 0);
  if (homeScore > awayScore) { standings[homeId].wins++; standings[awayId].losses++; }
  else if (awayScore > homeScore) { standings[awayId].wins++; standings[homeId].losses++; }
  else { standings[homeId].ties++; standings[awayId].ties++; }
}

function computePlayerStatsFromMatchReports(reports) {
  const totals = new Map();
  function playerTotal(name) {
    if (!name || name === 'undefined') return null;
    if (!totals.has(name)) {
      totals.set(name, {
        player_name: name,
        x01_points: 0,
        x01_darts: 0,
        cricket_marks: 0,
        cricket_darts: 0,
        games_played: 0,
        legs_played: 0,
        legs_won: 0
      });
    }
    return totals.get(name);
  }
  for (const report of reports) {
    if (!Array.isArray(report.games)) continue;
    const playersInMatch = new Set();
    for (const game of report.games) {
      for (const sidePlayers of [game.home_players || [], game.away_players || []]) {
        sidePlayers.forEach(name => playersInMatch.add(name));
      }
      for (const leg of game.legs || []) {
        const isCricket = String(leg.format || game.format || game.type || '').toLowerCase().includes('cricket');
        for (const [name, stat] of Object.entries(leg.player_stats || {})) {
          const total = playerTotal(name);
          if (!total) continue;
          total.legs_played++;
          if (isCricket) {
            total.cricket_marks += Number(stat.marks || 0);
            total.cricket_darts += Number(stat.darts || 0);
          } else {
            total.x01_points += Number(stat.points || 0);
            total.x01_darts += Number(stat.darts || 0);
          }
        }
      }
    }
    playersInMatch.forEach(name => {
      const total = playerTotal(name);
      if (total) total.games_played++;
    });
  }
  return totals;
}

function reportGamesMatchScore(report) {
  if (!Array.isArray(report.games) || report.games.length === 0) return false;
  const homeSets = report.games.reduce((sum, game) => sum + (game.winner === 'home' ? 1 : 0), 0);
  const awaySets = report.games.reduce((sum, game) => sum + (game.winner === 'away' ? 1 : 0), 0);
  return homeSets === Number(report.home_score || 0) && awaySets === Number(report.away_score || 0);
}

async function seed() {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const leagueRef = db.collection('leagues').doc(leagueId);

  await leagueRef.set({
    name: '2026 Triples League',
    league_name: '2026 Triples League',
    season: '2026',
    status: 'active',
    format: 'triples',
    game_format: 'mixed',
    in_rule: 'straight',
    checkout: 'double',
    out_rule: 'double',
    best_of: 3,
    games_per_match: 9,
    rounds_per_match: 9,
    start_rules: 'cork_every_leg',
    cork_rule: 'cork_every_leg',
    cork_option: 'home',
    cork_winner_gets: 'choice',
    point_system: 'game_based',
    match_format: triplesMatchFormat,
    director_id: 'X2DMb9bP4Q8fy9yr5Fam',
    directors: ['X2DMb9bP4Q8fy9yr5Fam'],
    playoff_teams: 6,
    current_week: 15,
    total_weeks: 18,
    emergency_recovery: true,
    emergency_note: 'Seeded into dashboard-ll after brdc-v2 suspension. Replace with restored Firestore export when available.',
    updated_at: now
  }, { merge: true });

  const statsBackup = readJson('E:/projects/brdc-firebase/reports/codex-stats-site-backup-codex_android_stats_1777342191838.json');
  const rosterStats = statsBackup.stats || {};
  const fullStatsBackup = readJson('E:/projects/brdc-firebase/docs/data/triples-draft-stats-backup-2026-04-09.json');
  const fullStatsById = Object.fromEntries((fullStatsBackup.existing_stats || []).map(stat => [stat.id || stat.player_id, stat]));
  Object.assign(rosterStats, fullStatsById);
  const donnieUid = authUidByEmail('donniepagel@gmail.com') || 'guJR44IeFYPaqccsGy5k2ZVaXAk2';
  seedPlayers.X2DMb9bP4Q8fy9yr5Fam.firebase_uid = donnieUid;
  const authNameMap = authByDisplayName();

  for (const stat of fullStatsBackup.existing_stats || []) {
    const playerId = stat.id || stat.player_id;
    const name = stat.player_name;
    if (!playerId || !name || seedPlayers[playerId]) continue;
    if (name === 'Jennifer Malek' && Number(stat.games_played || 0) === 0) continue;
    const teamName = knownTeamByName[name] ?? null;
    const authUser = authNameMap.get(name.toLowerCase());
    seedPlayers[playerId] = {
      name,
      email: authUser?.email || null,
      firebase_uid: authUser?.localId || null,
      team_id: teamName ? teamIds[teamName] : null,
      level: levelFromStats(stat),
      is_fill_in: !teamName,
      position: knownPositionByName[name] || null
    };
  }

  const playerByName = new Map();
  const matchReportMap = buildMatchReportMap();
  const summaryMap = buildSummaryMap();
  const matchReports = [...matchReportMap.values()];
  const consistentMatchReports = matchReports.filter(reportGamesMatchScore);
  const recomputedPlayerStats = computePlayerStatsFromMatchReports(consistentMatchReports);
  for (const [playerId, player] of Object.entries(seedPlayers)) {
    const stat = rosterStats[playerId] || {};
    const recomputed = recomputedPlayerStats.get(player.name);
    const mergedStat = {
      ...stat,
      ...(recomputed ? {
        games_played: Math.max(Number(stat.games_played || 0), Number(recomputed.games_played || 0)),
        legs_played: Math.max(Number(stat.legs_played || 0), Number(recomputed.legs_played || 0)),
        x01_points: Math.max(Number(stat.x01_points || 0), Number(recomputed.x01_points || 0)),
        x01_darts: Math.max(Number(stat.x01_darts || 0), Number(recomputed.x01_darts || 0)),
        cricket_marks: Math.max(Number(stat.cricket_marks || 0), Number(recomputed.cricket_marks || 0)),
        cricket_darts: Math.max(Number(stat.cricket_darts || 0), Number(recomputed.cricket_darts || 0))
      } : {})
    };
    if (Number(mergedStat.x01_darts || 0) > 0) {
      mergedStat.x01_three_dart_avg = Number(((Number(mergedStat.x01_points || 0) / Number(mergedStat.x01_darts || 0)) * 3).toFixed(1));
      mergedStat.three_dart_avg = mergedStat.x01_three_dart_avg;
    }
    if (Number(mergedStat.cricket_darts || 0) > 0) {
      mergedStat.cricket_mpr = Number(((Number(mergedStat.cricket_marks || 0) / Number(mergedStat.cricket_darts || 0)) * 3).toFixed(2));
      mergedStat.mpr = mergedStat.cricket_mpr;
    }
    const rosterLevel = player.is_fill_in
      ? player.level
      : levelFromRosterPosition(player.position, player.level);
    const data = {
      id: playerId,
      name: player.name,
      name_lower: player.name.toLowerCase(),
      email: player.email || null,
      firebase_uid: player.firebase_uid || null,
      skill_level: rosterLevel,
      preferred_level: rosterLevel,
      level: rosterLevel,
      position: player.position || null,
      team_id: player.team_id || null,
      team_name: player.team_id ? teamNames[player.team_id] : 'Fill-In',
      league_id: leagueId,
      source_type: 'global',
      is_admin: !!player.is_admin,
      is_master_admin: !!player.is_master_admin,
      is_director: !!player.is_director,
      is_captain: !!player.is_captain,
      is_fill_in: !!player.is_fill_in,
      stats: mergedStat,
      unified_stats: mergedStat,
      involvements: {
        leagues: [{
          id: leagueId,
          name: '2026 Triples League',
          team_id: player.team_id || null,
          team_name: player.team_id ? teamNames[player.team_id] : 'Fill-In',
          role: player.is_captain ? 'captain' : (player.is_fill_in ? 'fill_in' : 'player'),
          status: 'active'
        }]
      },
      emergency_recovery: true,
      updated_at: now
    };
    await db.collection('players').doc(playerId).set(data, { merge: true });
    await leagueRef.collection('players').doc(playerId).set(data, { merge: true });
    await leagueRef.collection('stats').doc(playerId).set({
      ...mergedStat,
      id: playerId,
      player_id: playerId,
      player_name: player.name,
      team_id: player.team_id || null,
      team_name: player.team_id ? teamNames[player.team_id] : 'Fill-In',
      level: rosterLevel,
      emergency_recovery: true,
      updated_at: now
    }, { merge: true });
    if (player.email) await db.collection('users').doc(player.firebase_uid || playerId).set(data, { merge: true });
    playerByName.set(player.name.toLowerCase(), { id: playerId, ...data });
  }

  for (const [id, teamName] of Object.entries(teamNames)) {
    const backupTeam = id === statsBackup.homeTeamId ? statsBackup.homeTeam : (id === statsBackup.awayTeamId ? statsBackup.awayTeam : {});
    const rosterIds = Object.entries(seedPlayers)
      .filter(([, p]) => p.team_id === id)
      .sort(([, a], [, b]) => (a.position || 99) - (b.position || 99))
      .map(([pid]) => pid);
    await leagueRef.collection('teams').doc(id).set({
      team_name: teamName,
      name: teamName,
      player_ids: rosterIds,
      player_names: rosterIds.map(pid => seedPlayers[pid].name),
      captain_id: rosterIds.find(pid => seedPlayers[pid].is_captain || seedPlayers[pid].position === 1) || null,
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      games_won: 0,
      games_lost: 0,
      legs_won: 0,
      legs_lost: 0,
      ...normalizeTimestamps(backupTeam),
      emergency_recovery: true,
      updated_at: now
    }, { merge: true });
  }

  const scheduleRows = parseScheduleCsv();
  for (const item of scheduleRows) {
    const homeId = teamIds[item.home];
    const awayId = teamIds[item.away];
    if (!homeId || !awayId) continue;
    const key = matchKey(item.week, homeId, awayId);
    const report = matchReportMap.get(key);
    const summary = summaryMap.get(key);
    const matchId = report?.id || makeMatchId(item.week, homeId, awayId);
    const isCompleted = !!summary || report?.status === 'completed';
    await leagueRef.collection('matches').doc(matchId).set({
      id: matchId,
      league_id: leagueId,
      week: item.week,
      match_date: item.date,
      home_team_id: homeId,
      away_team_id: awayId,
      home_team_name: teamNames[homeId],
      away_team_name: teamNames[awayId],
      home_score: Number(summary?.home_score ?? report?.home_score ?? 0),
      away_score: Number(summary?.away_score ?? report?.away_score ?? 0),
      home_legs_won: Number(summary?.home_legs_won ?? report?.home_legs_won ?? 0),
      away_legs_won: Number(summary?.away_legs_won ?? report?.away_legs_won ?? 0),
      total_sets: 9,
      total_legs: Number(summary?.total_legs ?? report?.total_legs ?? 0),
      status: isCompleted ? 'completed' : 'scheduled',
      import_source: summary?.import_source || report?.import_source || 'emergency_schedule',
      emergency_recovery: true,
      updated_at: now
    }, { merge: true });
  }

  const standings = {};
  for (const summary of summaryMap.values()) {
    addStandingResult(standings, summary);
    const report = matchReportMap.get(matchKey(summary.week, summary.home_team_id, summary.away_team_id));
    const id = report?.id || makeMatchId(summary.week, summary.home_team_id, summary.away_team_id);
    await leagueRef.collection('matches').doc(id).set({
      id,
      league_id: leagueId,
      week: summary.week,
      match_date: report?.match_date || weekDate(summary.week),
      home_team_id: summary.home_team_id,
      away_team_id: summary.away_team_id,
      home_team_name: summary.home_team_name,
      away_team_name: summary.away_team_name,
      home_score: summary.home_score,
      away_score: summary.away_score,
      home_legs_won: summary.home_legs_won,
      away_legs_won: summary.away_legs_won,
      total_sets: 9,
      total_legs: summary.total_legs,
      status: 'completed',
      import_source: summary.import_source,
      emergency_recovery: true,
      notes: summary.notes || [],
      updated_at: now
    }, { merge: true });
  }

  for (const [teamId, data] of Object.entries(standings)) {
    await leagueRef.collection('teams').doc(teamId).set({ ...data, updated_at: now }, { merge: true });
  }

  const backupFiles = [
    'E:/projects/brdc-firebase/docs/backups/TNUKhFB5xrtTNmzmTaob-pre-repair-2026-04-11.json',
    ...fs.readdirSync('E:/projects/brdc-firebase/docs/backups/match-import-repair-2026-04-14')
      .filter(f => f.endsWith('.json'))
      .map(f => `E:/projects/brdc-firebase/docs/backups/match-import-repair-2026-04-14/${f}`)
  ];
  for (const file of backupFiles) {
    const raw = readJson(file);
    const id = raw.id || path.basename(file, '.json');
    const data = normalizeTimestamps(raw.data || raw);
    await leagueRef.collection('matches').doc(id).set({
      ...data,
      id,
      league_id: leagueId,
      emergency_recovery: true,
      updated_at: now
    }, { merge: true });
  }

  let fullReportWrites = 0;
  let strippedBadReports = 0;
  for (const report of matchReports) {
    if (!Array.isArray(report.games) || report.games.length === 0) continue;
    const data = normalizeTimestamps(report);
    const gamesAreConsistent = reportGamesMatchScore(report);
    if (!gamesAreConsistent) {
      data.games = [];
      data.import_warning = 'Full game detail hidden during emergency restore because stored game winners do not match the match score.';
      strippedBadReports++;
    }
    await leagueRef.collection('matches').doc(report.id).set({
      ...data,
      id: report.id,
      league_id: leagueId,
      status: report.status === 'completed' ? 'completed' : (summaryMap.has(matchKey(report.week, report.home_team_id, report.away_team_id)) ? 'completed' : 'scheduled'),
      emergency_recovery: true,
      updated_at: now
    }, { merge: true });
    fullReportWrites++;
  }

  await db.collection('chatRooms').doc(`${leagueId}_league`).set({
    name: '2026 Triples League Chat',
    type: 'league',
    league_id: leagueId,
    participant_ids: Object.keys(seedPlayers),
    lastMessage: 'Temporary recovery chat room restored.',
    updated_at: now,
    emergency_recovery: true
  }, { merge: true });

  const allMatches = await leagueRef.collection('matches').get();
  const grouped = new Map();
  allMatches.forEach(doc => {
    const match = doc.data();
    const key = [
      match.week || '',
      match.home_team_id || '',
      match.away_team_id || ''
    ].join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ id: doc.id, data: match, ref: doc.ref });
  });
  let duplicateDeletes = 0;
  for (const group of grouped.values()) {
    if (group.length <= 1) continue;
    group.sort((a, b) => {
      const aRich = Array.isArray(a.data.games) ? a.data.games.length : 0;
      const bRich = Array.isArray(b.data.games) ? b.data.games.length : 0;
      if (bRich !== aRich) return bRich - aRich;
      const aSchedule = a.data.import_source === 'emergency_schedule' ? 1 : 0;
      const bSchedule = b.data.import_source === 'emergency_schedule' ? 1 : 0;
      return aSchedule - bSchedule;
    });
    for (const duplicate of group.slice(1)) {
      await duplicate.ref.delete();
      duplicateDeletes++;
    }
  }

  const currentMatches = await leagueRef.collection('matches').get();
  const finalStandings = {};
  currentMatches.forEach(doc => {
    const match = doc.data();
    if (match.status !== 'completed') return;
    if (!match.home_team_id || !match.away_team_id) return;
    addStandingResult(finalStandings, match);
  });
  for (const [teamId, data] of Object.entries(finalStandings)) {
    await leagueRef.collection('teams').doc(teamId).set({ ...data, updated_at: now }, { merge: true });
  }

  console.log(`Seeded dashboard-ll: ${Object.keys(seedPlayers).length} players, ${Object.keys(teamNames).length} teams, ${scheduleRows.length} schedule rows, ${summaryMap.size} completed summaries, ${fullReportWrites} full match reports, ${backupFiles.length} legacy backups.`);
  if (strippedBadReports) console.log(`Stripped games from ${strippedBadReports} internally inconsistent full reports so match hubs do not show false set details.`);
  if (duplicateDeletes) console.log(`Removed ${duplicateDeletes} duplicate schedule/match docs.`);
}

seed().catch(error => {
  console.error(error);
  process.exit(1);
});
