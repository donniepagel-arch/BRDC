const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const PROJECT_ID = 'brdc-v2';
const SHOULD_WRITE = process.argv.includes('--write');

const EXPLICIT_ALIASES = {
  'Brian S': 'Brian Smith',
  'Cesar A': 'Cesar Andino',
  'Dave Brunner': 'David Brunner',
  'Dillon Ullises': 'Dillon Ulisses',
  'Eddie O': 'Eddie Olschansky',
  'Eddie Olshansky': 'Eddie Olschansky',
  'Eric D': 'Eric Duale',
  'Jenn Malek': 'Jennifer Malek',
  'Joshua kelly': 'Josh Kelly',
  'Kevin McKelvey': 'Kevin Mckelvey',
  'Kevin Y': 'Kevin Yasenchak',
  'Matthew Pagel': 'Matt Pagel',
  'Matty Wentz': 'Matthew Wentz',
  'Mike Gonzalez': 'Michael Gonzalez',
  'Mike Jarvis': 'Michael Jarvis',
  'Nate Kull': 'Nathan Kull',
  'Nicholas Mezlak': 'Nick Mezlak',
  'Steph Kull': 'Stephanie Kull',
};

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function slugName(name) {
  return normalizeName(name).toLowerCase();
}

function getFormat(leg, game) {
  const value = String(leg?.format || game?.format || '').trim().toLowerCase();
  if (value === 'cricket') return 'cricket';
  if (value === '301' || value === '501' || value === '701' || value === 'x01') return 'x01';
  if (value.includes('cricket')) return 'cricket';
  return 'x01';
}

function getPlayerNames(players) {
  return (Array.isArray(players) ? players : [])
    .map((player) => (typeof player === 'string' ? player : player?.name))
    .map(normalizeName)
    .filter(Boolean);
}

function createEmptyStats(playerId, playerName) {
  return {
    player_id: playerId,
    player_name: playerName,
    games_played: 0,
    games_won: 0,
    games_lost: 0,
    matches_played: 0,
    matches_won: 0,
    matches_lost: 0,
    x01_legs_played: 0,
    x01_legs_won: 0,
    x01_total_darts: 0,
    x01_total_points: 0,
    x01_three_dart_avg: 0,
    x01_first9_darts: 0,
    x01_first9_points: 0,
    x01_first_9_avg: 0,
    x01_ton_80: 0,
    x01_ton_60: 0,
    x01_ton_40: 0,
    x01_ton_20: 0,
    x01_ton_00: 0,
    x01_tons: 0,
    x01_high_turn: 0,
    x01_high_score: 0,
    x01_high_checkout: 0,
    x01_checkouts_hit: 0,
    x01_checkout_attempts: 0,
    x01_checkout_pct: 0,
    x01_total_checkout_points: 0,
    x01_best_leg: 0,
    x01_leg_win_pct: 0,
    cricket_legs_played: 0,
    cricket_legs_won: 0,
    cricket_total_darts: 0,
    cricket_total_rounds: 0,
    cricket_total_marks: 0,
    cricket_mpr: 0,
    cricket_five_mark_rounds: 0,
    cricket_six_mark_rounds: 0,
    cricket_seven_mark_rounds: 0,
    cricket_eight_mark_rounds: 0,
    cricket_nine_mark_rounds: 0,
    cricket_hat_tricks: 0,
    cricket_bulls: 0,
    cricket_triples: 0,
    cricket_high_mark_round: 0,
    cricket_leg_win_pct: 0,
  };
}

function getOrCreate(statsMap, playerId, playerName) {
  if (!statsMap.has(playerId)) {
    statsMap.set(playerId, createEmptyStats(playerId, playerName));
  }
  return statsMap.get(playerId);
}

function incrementRoundStats(row, marks, triples, bulls) {
  if (marks >= 5) row.cricket_five_mark_rounds += 1;
  if (marks >= 6) row.cricket_six_mark_rounds += 1;
  if (marks >= 7) row.cricket_seven_mark_rounds += 1;
  if (marks >= 8) row.cricket_eight_mark_rounds += 1;
  if (marks >= 9) row.cricket_nine_mark_rounds += 1;
  if (marks > row.cricket_high_mark_round) row.cricket_high_mark_round = marks;
  if (triples >= 3 || marks >= 9) row.cricket_hat_tricks += 1;
  row.cricket_triples += triples;
  row.cricket_bulls += bulls;
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: PROJECT_ID,
    });
  }

  const db = admin.firestore();
  const leagueRef = db.collection('leagues').doc(LEAGUE_ID);

  const [playersSnap, teamsSnap, matchesSnap, statsSnap] = await Promise.all([
    leagueRef.collection('players').get(),
    leagueRef.collection('teams').get(),
    leagueRef.collection('matches').where('status', '==', 'completed').get(),
    leagueRef.collection('stats').get(),
  ]);

  const players = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const existingStats = statsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const teamRosterNames = new Set();
  for (const team of teams) {
    for (const name of team.player_names || []) {
      teamRosterNames.add(normalizeName(name));
    }
  }

  const exactNameToCandidates = new Map();
  for (const player of players) {
    const name = normalizeName(player.name);
    if (!name) continue;
    if (!exactNameToCandidates.has(name)) exactNameToCandidates.set(name, []);
    exactNameToCandidates.get(name).push(player);
  }

  const existingStatsByName = new Map();
  for (const stat of existingStats) {
    const name = normalizeName(stat.player_name || stat.playerName || stat.name);
    if (!name) continue;
    if (!existingStatsByName.has(name)) existingStatsByName.set(name, []);
    existingStatsByName.get(name).push(stat);
  }

  function chooseCanonicalPlayer(canonicalName) {
    const exact = exactNameToCandidates.get(canonicalName) || [];
    const withTeam = exact.filter((p) => p.team_id);
    if (withTeam.length === 1) return withTeam[0];
    if (exact.length === 1) return exact[0];

    const statsDocs = existingStatsByName.get(canonicalName) || [];
    if (statsDocs.length === 1) {
      const match = exact.find((p) => p.id === statsDocs[0].id);
      if (match) return match;
    }

    if (exact.length > 1) {
      const rosterLinked = exact.filter((p) => teamRosterNames.has(canonicalName));
      if (rosterLinked.length === 1) return rosterLinked[0];
      return exact[0];
    }

    const existing = statsDocs[0];
    if (existing) {
      return { id: existing.id, name: canonicalName, team_id: null };
    }

    throw new Error(`No canonical player doc found for ${canonicalName}`);
  }

  const aliasResolution = new Map();
  const allNames = new Set();
  for (const matchDoc of matchesSnap.docs) {
    const match = matchDoc.data() || {};
    for (const game of match.games || []) {
      for (const name of getPlayerNames(game.home_players)) allNames.add(name);
      for (const name of getPlayerNames(game.away_players)) allNames.add(name);
      for (const leg of game.legs || []) {
        for (const name of Object.keys(leg.player_stats || {})) allNames.add(normalizeName(name));
        for (const throwData of leg.throws || []) {
          if (throwData.home?.player) allNames.add(normalizeName(throwData.home.player));
          if (throwData.away?.player) allNames.add(normalizeName(throwData.away.player));
        }
      }
    }
  }

  for (const rawName of allNames) {
    const canonicalName = EXPLICIT_ALIASES[rawName] || rawName;
    const canonicalPlayer = chooseCanonicalPlayer(canonicalName);
    aliasResolution.set(rawName, {
      rawName,
      canonicalName,
      playerId: canonicalPlayer.id,
    });
  }

  function resolveName(rawName) {
    const normalized = normalizeName(rawName);
    const resolved = aliasResolution.get(normalized);
    if (!resolved) throw new Error(`Unresolved player name: ${normalized}`);
    return resolved;
  }

  const statsMap = new Map();

  for (const matchDoc of matchesSnap.docs) {
    const match = matchDoc.data() || {};
    const seenPlayers = new Set();
    const homeTeamWon = match.winner === 'home' || Number(match.home_score || 0) > Number(match.away_score || 0);
    const awayTeamWon = match.winner === 'away' || Number(match.away_score || 0) > Number(match.home_score || 0);

    for (const game of match.games || []) {
      const homePlayers = getPlayerNames(game.home_players).map(resolveName);
      const awayPlayers = getPlayerNames(game.away_players).map(resolveName);

      for (const p of [...homePlayers, ...awayPlayers]) {
        seenPlayers.add(p.playerId);
        getOrCreate(statsMap, p.playerId, p.canonicalName).games_played += 1;
      }

      if (game.winner === 'home') {
        for (const p of homePlayers) getOrCreate(statsMap, p.playerId, p.canonicalName).games_won += 1;
        for (const p of awayPlayers) getOrCreate(statsMap, p.playerId, p.canonicalName).games_lost += 1;
      } else if (game.winner === 'away') {
        for (const p of awayPlayers) getOrCreate(statsMap, p.playerId, p.canonicalName).games_won += 1;
        for (const p of homePlayers) getOrCreate(statsMap, p.playerId, p.canonicalName).games_lost += 1;
      }

      for (const leg of game.legs || []) {
        const format = getFormat(leg, game);
        const homePlayerIds = new Set(homePlayers.map((p) => p.playerId));
        const awayPlayerIds = new Set(awayPlayers.map((p) => p.playerId));

        for (const [rawName, legStats] of Object.entries(leg.player_stats || {})) {
          const resolved = resolveName(rawName);
          const row = getOrCreate(statsMap, resolved.playerId, resolved.canonicalName);
          const isHome = homePlayerIds.has(resolved.playerId);
          const isAway = awayPlayerIds.has(resolved.playerId);
          if (!isHome && !isAway) continue;

          if (format === 'cricket') {
            row.cricket_legs_played += 1;
            row.cricket_total_marks += Number(legStats.marks || 0);
            row.cricket_total_darts += Number(legStats.darts || 0);
            row.cricket_total_rounds = Number((row.cricket_total_darts / 3).toFixed(2));
            if ((leg.winner === 'home' && isHome) || (leg.winner === 'away' && isAway)) {
              row.cricket_legs_won += 1;
            }
          } else {
            row.x01_legs_played += 1;
            row.x01_total_darts += Number(legStats.darts || 0);
            row.x01_total_points += Number(legStats.points || 0);
            if ((leg.winner === 'home' && isHome) || (leg.winner === 'away' && isAway)) {
              row.x01_legs_won += 1;
            }
          }
        }

        for (const throwData of leg.throws || []) {
          for (const side of ['home', 'away']) {
            const shot = throwData[side];
            const rawName = normalizeName(shot?.player);
            if (!rawName) continue;
            const resolved = resolveName(rawName);
            const row = getOrCreate(statsMap, resolved.playerId, resolved.canonicalName);

            if (format === 'cricket') {
              const marks = Number(shot.marks || 0);
              const triples = Number(shot.triples || 0);
              const bulls = Number(shot.bulls || 0);
              incrementRoundStats(row, marks, triples, bulls);
            } else {
              const score = Number(shot.score || 0);
              if (throwData.round <= 3) {
                row.x01_first9_darts += 3;
                row.x01_first9_points += score;
              }
              if (score >= 100) {
                row.x01_tons += 1;
                if (score === 180) row.x01_ton_80 += 1;
                else if (score >= 160) row.x01_ton_60 += 1;
                else if (score >= 140) row.x01_ton_40 += 1;
                else if (score >= 120) row.x01_ton_20 += 1;
                else row.x01_ton_00 += 1;
              }
              if (score > row.x01_high_turn) row.x01_high_turn = score;
              if (score > row.x01_high_score) row.x01_high_score = score;
              if (shot.checkout) {
                row.x01_checkouts_hit += 1;
                row.x01_total_checkout_points += score;
                if (score > row.x01_high_checkout) row.x01_high_checkout = score;
                const dartsUsed = Number(shot.checkout_darts || 0);
                if (dartsUsed > 0 && (row.x01_best_leg === 0 || dartsUsed < row.x01_best_leg)) {
                  row.x01_best_leg = dartsUsed;
                }
              }
            }
          }
        }

        if (format === 'x01') {
          for (const resolved of [...homePlayers, ...awayPlayers]) {
            const row = getOrCreate(statsMap, resolved.playerId, resolved.canonicalName);
            if (row.x01_total_darts > 0) {
              row.x01_three_dart_avg = Number(((row.x01_total_points / row.x01_total_darts) * 3).toFixed(2));
            }
            if (row.x01_first9_darts > 0) {
              row.x01_first_9_avg = Number(((row.x01_first9_points / row.x01_first9_darts) * 3).toFixed(2));
            }
          }
        }
      }
    }

    for (const playerId of seenPlayers) {
      const row = statsMap.get(playerId);
      row.matches_played += 1;
      const isHomeSide = (match.games || []).some((game) =>
        getPlayerNames(game.home_players).some((name) => resolveName(name).playerId === playerId)
      );
      if (isHomeSide && homeTeamWon) row.matches_won += 1;
      else if (isHomeSide && awayTeamWon) row.matches_lost += 1;
      else if (!isHomeSide && awayTeamWon) row.matches_won += 1;
      else if (!isHomeSide && homeTeamWon) row.matches_lost += 1;
    }
  }

  for (const row of statsMap.values()) {
    if (row.x01_total_darts > 0) {
      row.x01_three_dart_avg = Number(((row.x01_total_points / row.x01_total_darts) * 3).toFixed(2));
    }
    if (row.x01_first9_darts > 0) {
      row.x01_first_9_avg = Number(((row.x01_first9_points / row.x01_first9_darts) * 3).toFixed(2));
    }
    if (row.x01_legs_played > 0) {
      row.x01_leg_win_pct = Number(((row.x01_legs_won / row.x01_legs_played) * 100).toFixed(1));
    }
    if (row.cricket_total_darts > 0) {
      row.cricket_total_rounds = Number((row.cricket_total_darts / 3).toFixed(2));
      row.cricket_mpr = Number(((row.cricket_total_marks / row.cricket_total_darts) * 3).toFixed(2));
    }
    if (row.cricket_legs_played > 0) {
      row.cricket_leg_win_pct = Number(((row.cricket_legs_won / row.cricket_legs_played) * 100).toFixed(1));
    }
    if (row.x01_checkouts_hit > 0) {
      row.x01_checkout_attempts = row.x01_checkouts_hit;
      row.x01_checkout_pct = 100;
    }
  }

  const backupDir = path.join(__dirname, '..', 'docs', 'data');
  const backupPath = path.join(backupDir, 'triples-draft-stats-backup-2026-04-09.json');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        captured_at: new Date().toISOString(),
        league_id: LEAGUE_ID,
        existing_stats: existingStats,
      },
      null,
      2
    )
  );

  const summary = Array.from(statsMap.values())
    .sort((a, b) => b.games_won - a.games_won || a.player_name.localeCompare(b.player_name))
    .map((row) => ({
      player_id: row.player_id,
      player_name: row.player_name,
      matches_played: row.matches_played,
      matches_won: row.matches_won,
      games_played: row.games_played,
      games_won: row.games_won,
      x01_legs_played: row.x01_legs_played,
      cricket_legs_played: row.cricket_legs_played,
      x01_three_dart_avg: row.x01_three_dart_avg,
      cricket_mpr: row.cricket_mpr,
    }));

  if (SHOULD_WRITE) {
    const batchSize = 350;
    const statsRef = leagueRef.collection('stats');
    const canonicalIds = new Set(summary.map((row) => row.player_id));

    let batch = db.batch();
    let ops = 0;
    for (const doc of statsSnap.docs) {
      if (!canonicalIds.has(doc.id)) {
        batch.delete(doc.ref);
        ops += 1;
        if (ops >= batchSize) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }
    for (const row of statsMap.values()) {
      batch.set(
        statsRef.doc(row.player_id),
        {
          ...row,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          repaired_at: admin.firestore.FieldValue.serverTimestamp(),
          repair_source: 'triples-draft-match-history-2026-04-09',
        },
        { merge: false }
      );
      ops += 1;
      if (ops >= batchSize) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  }

  console.log(
    JSON.stringify(
      {
        league_id: LEAGUE_ID,
        write: SHOULD_WRITE,
        backup_path: backupPath,
        raw_names_mapped: aliasResolution.size,
        repaired_players: summary.length,
        aliases: Array.from(aliasResolution.values())
          .filter((entry) => entry.rawName !== entry.canonicalName)
          .sort((a, b) => a.rawName.localeCompare(b.rawName)),
        sample: summary.slice(0, 20),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
