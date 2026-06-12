const admin = require('../functions/node_modules/firebase-admin');

const LEAGUE_ID = process.argv[2] || 'aOq4Y0ETxPZ66tM1uUtP';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'brdc-v2' });
}

const db = admin.firestore();

function plainDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

function pickPlayerForHome(doc) {
  const player = plainDoc(doc);
  return {
    id: player.id,
    name: player.name || player.player_name || null,
    email: player.email || null,
    team_id: player.team_id || null,
    level: player.level || player.skill_level || player.preferred_level || null,
    skill_level: player.skill_level || player.level || null,
    preferred_level: player.preferred_level || null,
    position: player.position || null,
    is_sub: player.is_sub === true,
    is_fill_in: player.is_fill_in === true,
    x01_three_dart_avg: player.x01_three_dart_avg || player.avg_3da || null,
    avg_3da: player.avg_3da || player.x01_three_dart_avg || null,
    cricket_mpr: player.cricket_mpr || player.mpr || null,
    mpr: player.mpr || player.cricket_mpr || null
  };
}

function pickTeamForHome(doc) {
  const team = plainDoc(doc);
  return {
    id: team.id,
    name: team.name || team.team_name || null,
    team_name: team.team_name || team.name || null,
    wins: team.wins || 0,
    losses: team.losses || 0,
    ties: team.ties || 0,
    points: team.points ?? team.games_won ?? team.set_wins ?? 0,
    games_won: team.games_won ?? team.set_wins ?? 0,
    games_lost: team.games_lost ?? team.set_losses ?? 0,
    set_wins: team.set_wins ?? team.games_won ?? 0,
    set_losses: team.set_losses ?? team.games_lost ?? 0,
    players: Array.isArray(team.players) ? team.players.map(player => ({
      id: player.id || player.player_id || null,
      name: player.name || player.player_name || null,
      level: player.level || player.skill_level || player.preferred_level || null,
      skill_level: player.skill_level || player.level || null,
      preferred_level: player.preferred_level || null,
      position: player.position || null
    })) : []
  };
}

function pickMatchForHome(doc) {
  const match = plainDoc(doc);
  return {
    id: match.id,
    week: match.week || match.match_week || null,
    status: match.status || null,
    match_date: match.match_date || match.scheduled_date || match.date || null,
    scheduled_date: match.scheduled_date || match.match_date || match.date || null,
    home_team_id: match.home_team_id || null,
    away_team_id: match.away_team_id || null,
    home_team_name: match.home_team_name || null,
    away_team_name: match.away_team_name || null,
    home_seed: match.home_seed || null,
    away_seed: match.away_seed || null,
    season_phase: match.season_phase || null,
    match_type: match.match_type || null,
    playoff_round: match.playoff_round || null,
    playoff_target_score: match.playoff_target_score || null,
    sets_to_win: match.sets_to_win || null,
    match_sets_to_win: match.match_sets_to_win || null,
    home_score: match.home_score || 0,
    away_score: match.away_score || 0,
    player_availability: match.player_availability || {}
  };
}

function pickStatsForHome(doc) {
  const stats = plainDoc(doc);
  return {
    id: stats.id,
    player_name: stats.player_name || stats.name || null,
    x01_three_dart_avg: stats.x01_three_dart_avg || stats.avg_3da || 0,
    avg_3da: stats.avg_3da || stats.x01_three_dart_avg || 0,
    cricket_mpr: stats.cricket_mpr || stats.mpr || 0,
    mpr: stats.mpr || stats.cricket_mpr || 0,
    games_won: stats.games_won || 0,
    games_lost: stats.games_lost || 0,
    games_played: stats.games_played || 0,
    matches_won: stats.matches_won || 0,
    matches_lost: stats.matches_lost || 0,
    matches_played: stats.matches_played || 0,
    x01_high_checkout: stats.x01_high_checkout || 0,
    x01_total_tons: stats.x01_total_tons || stats.x01_tons || 0,
    x01_tons: stats.x01_tons || stats.x01_total_tons || 0
  };
}

function pickFeedForHome(doc) {
  const feed = plainDoc(doc);
  return {
    id: feed.id,
    type: feed.type || null,
    title: feed.title || null,
    message: feed.message || feed.text || null,
    created_at: feed.created_at || feed.timestamp || null,
    timestamp: feed.timestamp || feed.created_at || null,
    match_id: feed.match_id || null,
    league_id: feed.league_id || LEAGUE_ID,
    data: feed.data ? {
      week: feed.data.week || null,
      teams: feed.data.teams || null,
      notables: feed.data.notables || null
    } : null
  };
}

function pickEventForHome(doc) {
  const event = plainDoc(doc);
  return {
    id: event.id,
    name: event.name || event.title || null,
    title: event.title || event.name || null,
    status: event.status || null,
    demo_mode: event.demo_mode === true,
    demo_tenant: event.demo_tenant || null,
    series_name: event.series_name || null,
    series_occurrence: event.series_occurrence || null,
    summer_series: event.summer_series === true,
    date: event.date || event.start_date || event.event_date || null,
    start_date: event.start_date || event.date || null,
    event_date: event.event_date || event.date || null,
    is_online: event.is_online === true,
    venue_name: event.venue_name || null,
    location_mode: event.location_mode || null
  };
}

function isVisibleTournament(tournament) {
  const status = String(tournament?.status || '').toLowerCase();
  return status !== 'deleted' && status !== 'archived';
}

async function main() {
  const leagueRef = db.collection('leagues').doc(LEAGUE_ID);
  const [teamsSnap, matchesSnap, playersSnap, statsSnap, feedSnap, tournamentsSnap] = await Promise.all([
    leagueRef.collection('teams').get(),
    leagueRef.collection('matches').get(),
    leagueRef.collection('players').get(),
    leagueRef.collection('stats').get().catch(() => ({ docs: [] })),
    leagueRef.collection('feed').orderBy('created_at', 'desc').limit(5).get().catch(() => ({ docs: [] })),
    db.collection('tournaments').limit(50).get().catch(() => ({ docs: [] }))
  ]);

  const summary = {
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    triples: {
      teams: teamsSnap.docs.map(pickTeamForHome),
      matches: matchesSnap.docs.map(pickMatchForHome),
      leaguePlayers: playersSnap.docs.map(pickPlayerForHome),
      statsById: Object.fromEntries(statsSnap.docs.map(doc => [doc.id, pickStatsForHome(doc)])),
      feed: feedSnap.docs.map(pickFeedForHome)
    },
    events: tournamentsSnap.docs
      .map(pickEventForHome)
      .filter(isVisibleTournament)
  };

  const jsonBytes = Buffer.byteLength(JSON.stringify(summary));
  if (jsonBytes > 900000) {
    throw new Error(`Summary is too large for one Firestore document: ${jsonBytes} bytes`);
  }

  await leagueRef.collection('public_cache').doc('home_vnext').set(summary, { merge: false });
  console.log(JSON.stringify({
    success: true,
    leagueId: LEAGUE_ID,
    bytes: jsonBytes,
    teams: summary.triples.teams.length,
    matches: summary.triples.matches.length,
    players: summary.triples.leaguePlayers.length,
    stats: Object.keys(summary.triples.statsById).length,
    events: summary.events.length
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
