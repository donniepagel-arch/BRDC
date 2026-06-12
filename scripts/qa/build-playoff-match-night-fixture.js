const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../../temp/qa');
fs.mkdirSync(outDir, { recursive: true });

const players = {
  home: {
    A: { id: 'demo_dr4ML1i9ZeMI7SNisX6E', name: 'Kevin Yasenchak', level: 'A' },
    B: { id: 'demo_brian_beach', name: 'Brian Beach', level: 'B' },
    C: { id: 'demo_Dag2lYDtqoo4kc3cRHHa', name: 'Cesar Andino', level: 'C' },
  },
  away: {
    A: { id: 'demo_SwnH8GUBmrcdmOAs07Vp', name: 'John Ragnoni', level: 'A' },
    B: { id: 'demo_ZwdiN0qfmIY5MMCOLJps', name: 'Marc Tate', level: 'B' },
    C: { id: 'demo_YHCbJsXKYjFMPk5Wk7kd', name: 'Anthony Donley', level: 'C' },
  },
};

const teams = {
  home: { id: 'home', name: 'K. Yasenchak' },
  away: { id: 'away', name: 'J. Ragnoni' },
};

const targets = [20, 19, 18, 17, 16, 15, 'BULL'];
const targetValue = (target) => target === 'BULL' ? 25 : Number(target);

const x01Patterns = {
  homeA: { home: [60, 100, 85, 95, 60, 61, co(40, 2)], away: [45, 81, 60, 100, 45, 85, 45] },
  awayA: { home: [60, 45, 81, 60, 85, 60], away: [100, 60, 85, 45, 95, 76, co(40, 2)] },
  homeB: { home: [45, 85, 60, 100, 41, 90, co(80, 3)], away: [60, 45, 100, 60, 81, 45, 60] },
  awayB: { home: [85, 45, 60, 41, 100, 60], away: [60, 100, 45, 85, 60, 111, co(40, 2)] },
  homeC: { home: [45, 60, 41, 85, 60, 100, 70, co(40, 2)], away: [26, 60, 45, 81, 60, 41, 60] },
  awayC: { home: [41, 60, 26, 85, 60, 45, 60], away: [45, 60, 81, 45, 85, 60, 85, co(40, 2)] },
  homeClose: { home: [81, 60, 100, 45, 85, 90, co(40, 3)], away: [60, 100, 60, 85, 45, 91] },
  awayClose: { home: [60, 85, 45, 100, 60, 81, 26], away: [81, 60, 100, 45, 85, 90, co(40, 3)] },
};

function co(score, darts) {
  return { score, checkoutDarts: darts };
}

function roster(side, letters) {
  return letters.split('').map((level) => players[side][level]);
}

const cricketProfiles = {
  homeStrong: { home: [5, 4, 5, 3, 5, 4, 4, 3, 4, 3, 2, 4], away: [3, 3, 4, 2, 3, 3, 2, 3, 2, 2, 3, 2] },
  awayStrong: { home: [3, 3, 4, 2, 3, 3, 2, 3, 2, 2, 3, 2], away: [5, 4, 5, 3, 5, 4, 4, 3, 4, 3, 2, 4] },
  homeClose: { home: [4, 3, 4, 3, 4, 3, 3, 4, 2, 3, 3, 2, 3], away: [3, 4, 3, 4, 3, 3, 4, 2, 3, 2, 2, 3, 2] },
  awayClose: { home: [2, 3, 2, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2], away: [4, 3, 4, 3, 4, 3, 3, 4, 2, 3, 3, 2, 3] },
  homeC: { home: [3, 2, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2], away: [1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2] },
  awayC: { home: [1, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2], away: [3, 2, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2, 3, 2, 2] },
};

const setPlan = [
  {
    set: 1,
    label: 'AB Doubles - 501 / Cricket / Cork Choice',
    homeRoster: 'AB',
    awayRoster: 'AB',
    legs: [
      { type: 'x01', pattern: 'homeA', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'cricket', profile: 'awayClose', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'x01', choice: true, pattern: 'homeB', winner: 'home', starter: 'away', corkWinner: 'home' },
    ],
  },
  {
    set: 2,
    label: 'C Singles - Cricket',
    homeRoster: 'C',
    awayRoster: 'C',
    legs: [
      { type: 'cricket', profile: 'awayC', winner: 'away', starter: 'home', corkWinner: 'away' },
      { type: 'cricket', profile: 'awayStrong', winner: 'away', starter: 'away', corkWinner: 'away' },
    ],
  },
  {
    set: 3,
    label: 'A Singles - Cricket',
    homeRoster: 'A',
    awayRoster: 'A',
    legs: [
      { type: 'cricket', profile: 'homeStrong', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'cricket', profile: 'awayClose', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'cricket', profile: 'homeClose', winner: 'home', starter: 'home', corkWinner: 'home' },
    ],
  },
  {
    set: 4,
    label: 'BC Doubles - 501 / Cricket / Cork Choice',
    homeRoster: 'BC',
    awayRoster: 'BC',
    legs: [
      { type: 'x01', pattern: 'homeC', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'cricket', profile: 'awayStrong', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'cricket', choice: true, profile: 'awayClose', winner: 'away', starter: 'home', corkWinner: 'away' },
    ],
  },
  {
    set: 5,
    label: 'B Singles - Cricket',
    homeRoster: 'B',
    awayRoster: 'B',
    legs: [
      { type: 'cricket', profile: 'homeClose', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'cricket', profile: 'homeStrong', winner: 'home', starter: 'away', corkWinner: 'home' },
    ],
  },
  {
    set: 6,
    label: 'A Singles - 501',
    homeRoster: 'A',
    awayRoster: 'A',
    legs: [
      { type: 'x01', pattern: 'homeClose', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'x01', pattern: 'awayA', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'x01', pattern: 'awayClose', winner: 'away', starter: 'home', corkWinner: 'away' },
    ],
  },
  {
    set: 7,
    label: 'AC Doubles - 501 / Cricket / Cork Choice',
    homeRoster: 'AC',
    awayRoster: 'AC',
    legs: [
      { type: 'x01', pattern: 'awayB', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'cricket', profile: 'homeClose', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'x01', choice: true, pattern: 'homeA', winner: 'home', starter: 'away', corkWinner: 'home' },
    ],
  },
  {
    set: 8,
    label: 'B Singles - 501',
    homeRoster: 'B',
    awayRoster: 'B',
    legs: [
      { type: 'x01', pattern: 'awayB', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'x01', pattern: 'awayClose', winner: 'away', starter: 'home', corkWinner: 'away' },
    ],
  },
  {
    set: 9,
    label: 'C Singles - 501',
    homeRoster: 'C',
    awayRoster: 'C',
    legs: [
      { type: 'x01', pattern: 'homeC', winner: 'home', starter: 'home', corkWinner: 'home' },
      { type: 'x01', pattern: 'awayC', winner: 'away', starter: 'away', corkWinner: 'away' },
      { type: 'x01', pattern: 'homeC', winner: 'home', starter: 'home', corkWinner: 'home' },
    ],
  },
];

function sideName(side) {
  return side === 'home' ? teams.home.name : teams.away.name;
}

function labelDart(mark, target) {
  if (target === 'BULL') return mark === 2 ? 'DB' : 'SB';
  return `${mark === 3 ? 'T' : mark === 2 ? 'D' : 'S'}${target}`;
}

function applyCricketDart(state, side, mark, target) {
  if (!mark) return;
  const own = state[side];
  const opp = state[side === 'home' ? 'away' : 'home'];
  const before = own.marks[target] || 0;
  const closingMarks = Math.min(mark, Math.max(0, 3 - before));
  own.marks[target] = Math.min(3, before + closingMarks);
  const scoringMarks = mark - closingMarks;
  if (scoringMarks > 0 && (opp.marks[target] || 0) < 3) {
    own.score += scoringMarks * targetValue(target);
  }
  own.totalMarks += mark;
}

function cricketClosed(sideState) {
  return targets.every((target) => (sideState.marks[target] || 0) >= 3);
}

function chooseCricketTarget(state, side) {
  const own = state[side];
  const opp = state[side === 'home' ? 'away' : 'home'];
  const open = targets.find((target) => (own.marks[target] || 0) < 3);
  if (open) return open;
  return targets.find((target) => (opp.marks[target] || 0) < 3) || 'BULL';
}

function buildCricketDarts(state, side, wantedMarks) {
  const darts = [];
  let remaining = wantedMarks;
  let wonOnThisDart = false;
  while (darts.length < 3 && remaining > 0) {
    const target = chooseCricketTarget(state, side);
    const maxMark = target === 'BULL' ? 2 : 3;
    const mark = Math.min(maxMark, remaining);
    darts.push({ label: labelDart(mark, target), mark, target });
    applyCricketDart(state, side, mark, target);
    remaining -= mark;
    if (cricketClosed(state[side]) && state[side].score >= state[side === 'home' ? 'away' : 'home'].score) {
      wonOnThisDart = true;
      break;
    }
  }
  while (!wonOnThisDart && darts.length < 3) darts.push({ label: 'MISS', mark: 0, target: null });
  return darts;
}

function makeCricketLeg(config, context) {
  const profile = cricketProfiles[config.profile];
  if (!profile) throw new Error(`Missing cricket profile ${config.profile}`);
  const state = {
    home: { marks: {}, score: 0, totalMarks: 0, rounds: 0 },
    away: { marks: {}, score: 0, totalMarks: 0, rounds: 0 },
  };
  targets.forEach((target) => {
    state.home.marks[target] = 0;
    state.away.marks[target] = 0;
  });
  const playerIndex = { home: 0, away: 0 };
  const turns = [];
  let side = config.starter || 'home';
  for (let round = 1; round <= 40; round++) {
    const sequence = profile[side];
    const wanted = sequence[(state[side].rounds) % sequence.length];
    const player = context[side][playerIndex[side] % context[side].length];
    const before = { home: state.home.score, away: state.away.score };
    const darts = buildCricketDarts(state, side, wanted);
    state[side].rounds += 1;
    turns.push({
      round,
      side,
      player,
      darts,
      marks: darts.reduce((sum, dart) => sum + dart.mark, 0),
      score: state[side].score - before[side],
      totals: { home: state.home.score, away: state.away.score },
      closed: {
        home: targets.filter((target) => state.home.marks[target] >= 3),
        away: targets.filter((target) => state.away.marks[target] >= 3),
      },
    });
    playerIndex[side] += 1;
    if (cricketClosed(state[side]) && state[side].score >= state[side === 'home' ? 'away' : 'home'].score) {
      if (side !== config.winner) {
        throw new Error(`Cricket ${context.set}.${context.leg} expected ${config.winner}, got ${side}`);
      }
      return {
        type: 'cricket',
        winner: side,
        corkWinner: config.corkWinner,
        starter: config.starter,
        choice: !!config.choice,
        turns,
        final: {
          homeScore: state.home.score,
          awayScore: state.away.score,
          homeMarks: state.home.totalMarks,
          awayMarks: state.away.totalMarks,
          homeRounds: state.home.rounds,
          awayRounds: state.away.rounds,
        },
      };
    }
    side = side === 'home' ? 'away' : 'home';
  }
  throw new Error(`Cricket leg ${context.set}.${context.leg} did not finish`);
}

function normalizeTurn(turn) {
  return typeof turn === 'number' ? { score: turn, checkoutDarts: null } : turn;
}

function makeX01Leg(config, context) {
  const pattern = x01Patterns[config.pattern];
  if (!pattern) throw new Error(`Missing x01 pattern ${config.pattern}`);
  const remaining = { home: 501, away: 501 };
  const playerIndex = { home: 0, away: 0 };
  const positions = { home: 0, away: 0 };
  const turns = [];
  let side = config.starter || 'home';
  for (let round = 1; round <= 30; round++) {
    if (positions[side] >= pattern[side].length) {
      side = side === 'home' ? 'away' : 'home';
      continue;
    }
    const raw = normalizeTurn(pattern[side][positions[side]++]);
    const player = context[side][playerIndex[side] % context[side].length];
    const before = remaining[side];
    const after = before - raw.score;
    if (after < 0) throw new Error(`X01 ${context.set}.${context.leg} bust in fixture`);
    const checkout = after === 0;
    if (checkout && side !== config.winner) throw new Error(`X01 ${context.set}.${context.leg} expected ${config.winner}, got ${side}`);
    if (checkout && !raw.checkoutDarts) throw new Error(`X01 checkout missing darts in ${context.set}.${context.leg}`);
    remaining[side] = after;
    turns.push({
      round,
      side,
      player,
      score: raw.score,
      darts: checkout ? raw.checkoutDarts : 3,
      remaining: { home: remaining.home, away: remaining.away },
      checkout,
      checkoutDarts: checkout ? raw.checkoutDarts : null,
    });
    playerIndex[side] += 1;
    if (checkout) {
      return {
        type: 'x01',
        winner: side,
        corkWinner: config.corkWinner,
        starter: config.starter,
        choice: !!config.choice,
        turns,
        final: {
          homeRemaining: remaining.home,
          awayRemaining: remaining.away,
          homePoints: 501 - remaining.home,
          awayPoints: 501 - remaining.away,
          homeDarts: turns.filter((t) => t.side === 'home').reduce((sum, t) => sum + t.darts, 0),
          awayDarts: turns.filter((t) => t.side === 'away').reduce((sum, t) => sum + t.darts, 0),
        },
      };
    }
    side = side === 'home' ? 'away' : 'home';
  }
  throw new Error(`X01 leg ${context.set}.${context.leg} did not finish`);
}

function emptyPlayerStats(player) {
  return {
    id: player.id,
    name: player.name,
    level: player.level,
    x01Points: 0,
    x01Darts: 0,
    x01LegsPlayed: 0,
    x01LegsWon: 0,
    highScore: 0,
    highCheckout: 0,
    cricketMarks: 0,
    cricketRounds: 0,
    cricketLegsPlayed: 0,
    cricketLegsWon: 0,
    highMarkRound: 0,
  };
}

const playerStats = {};
Object.values(players.home).concat(Object.values(players.away)).forEach((player) => {
  playerStats[player.id] = emptyPlayerStats(player);
});

const match = {
  teams,
  sets: [],
  summary: { homeSets: 0, awaySets: 0, homeLegs: 0, awayLegs: 0 },
};

function addLegStats(leg, context) {
  for (const side of ['home', 'away']) {
    for (const player of context[side]) {
      const stat = playerStats[player.id];
      if (leg.type === 'x01') {
        stat.x01LegsPlayed += 1;
        if (leg.winner === side) stat.x01LegsWon += 1;
      } else {
        stat.cricketLegsPlayed += 1;
        if (leg.winner === side) stat.cricketLegsWon += 1;
      }
    }
  }
  for (const turn of leg.turns) {
    const stat = playerStats[turn.player.id];
    if (leg.type === 'x01') {
      stat.x01Points += turn.score;
      stat.x01Darts += turn.darts;
      stat.highScore = Math.max(stat.highScore, turn.score);
      if (turn.checkout) stat.highCheckout = Math.max(stat.highCheckout, turn.score);
    } else {
      stat.cricketMarks += turn.marks;
      stat.cricketRounds += 1;
      stat.highMarkRound = Math.max(stat.highMarkRound, turn.marks);
    }
  }
}

for (const plannedSet of setPlan) {
  const context = {
    set: plannedSet.set,
    home: roster('home', plannedSet.homeRoster),
    away: roster('away', plannedSet.awayRoster),
  };
  const set = {
    set: plannedSet.set,
    label: plannedSet.label,
    homeRoster: context.home,
    awayRoster: context.away,
    legs: [],
    homeLegs: 0,
    awayLegs: 0,
  };
  plannedSet.legs.forEach((legConfig, index) => {
    context.leg = index + 1;
    const leg = legConfig.type === 'x01'
      ? makeX01Leg(legConfig, context)
      : makeCricketLeg(legConfig, context);
    leg.leg = index + 1;
    set.legs.push(leg);
    if (leg.winner === 'home') set.homeLegs += 1;
    else set.awayLegs += 1;
    addLegStats(leg, context);
  });
  set.winner = set.homeLegs > set.awayLegs ? 'home' : 'away';
  match.summary.homeLegs += set.homeLegs;
  match.summary.awayLegs += set.awayLegs;
  if (set.winner === 'home') match.summary.homeSets += 1;
  else match.summary.awaySets += 1;
  match.sets.push(set);
}

function fmtAvg(points, darts) {
  return darts ? ((points / darts) * 3).toFixed(1) : '-';
}

function fmtMpr(marks, rounds) {
  return rounds ? (marks / rounds).toFixed(2) : '-';
}

function legLine(leg) {
  const suffix = leg.choice ? " (cork's choice)" : '';
  return `${leg.type === 'x01' ? '501' : 'Cricket'}${suffix} - ${sideName(leg.winner)} wins`;
}

function makeMarkdown() {
  const lines = [];
  lines.push('# Theoretical Playoff Match Night Fixture');
  lines.push('');
  lines.push(`Match: ${teams.home.name} vs ${teams.away.name}`);
  lines.push(`Final: ${teams.home.name} ${match.summary.homeSets}, ${teams.away.name} ${match.summary.awaySets}`);
  lines.push(`Total legs: ${match.summary.homeLegs}-${match.summary.awayLegs}`);
  lines.push('');
  lines.push('## Set Summary');
  lines.push('');
  lines.push('| Set | Format | Winner | Legs |');
  lines.push('| --- | --- | --- | --- |');
  match.sets.forEach((set) => {
    lines.push(`| ${set.set} | ${set.label} | ${sideName(set.winner)} | ${set.homeLegs}-${set.awayLegs} |`);
  });
  lines.push('');
  lines.push('## Expected Player Stats');
  lines.push('');
  lines.push('| Player | X01 3DA | X01 Legs | High Score | High CO | Cricket MPR | Cricket Legs | High Marks |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  Object.values(playerStats).forEach((stat) => {
    lines.push(`| ${stat.name} | ${fmtAvg(stat.x01Points, stat.x01Darts)} | ${stat.x01LegsWon}-${stat.x01LegsPlayed} | ${stat.highScore || '-'} | ${stat.highCheckout || '-'} | ${fmtMpr(stat.cricketMarks, stat.cricketRounds)} | ${stat.cricketLegsWon}-${stat.cricketLegsPlayed} | ${stat.highMarkRound || '-'} |`);
  });
  lines.push('');
  lines.push('## Full Throw Report');
  match.sets.forEach((set) => {
    lines.push('');
    lines.push(`### Set ${set.set}: ${set.label}`);
    lines.push(`Rosters: ${set.homeRoster.map((p) => p.name).join(' / ')} vs ${set.awayRoster.map((p) => p.name).join(' / ')}`);
    lines.push(`Set result: ${teams.home.name} ${set.homeLegs}, ${teams.away.name} ${set.awayLegs}`);
    set.legs.forEach((leg) => {
      lines.push('');
      lines.push(`#### Set ${set.set}, Leg ${leg.leg}: ${legLine(leg)}`);
      lines.push(`Starter: ${sideName(leg.starter)}. Cork winner: ${sideName(leg.corkWinner)}.`);
      if (leg.type === 'x01') {
        lines.push('| Turn | Side | Player | Score | Darts | Home Rem | Away Rem | Note |');
        lines.push('| ---: | --- | --- | ---: | ---: | ---: | ---: | --- |');
        leg.turns.forEach((turn, index) => {
          lines.push(`| ${index + 1} | ${sideName(turn.side)} | ${turn.player.name} | ${turn.score} | ${turn.darts} | ${turn.remaining.home} | ${turn.remaining.away} | ${turn.checkout ? `Checkout in ${turn.checkoutDarts}` : ''} |`);
        });
      } else {
        lines.push('| Turn | Side | Player | Darts | Marks | Points | Home Pts | Away Pts |');
        lines.push('| ---: | --- | --- | --- | ---: | ---: | ---: | ---: |');
        leg.turns.forEach((turn, index) => {
          lines.push(`| ${index + 1} | ${sideName(turn.side)} | ${turn.player.name} | ${turn.darts.map((d) => d.label).join(' ')} | ${turn.marks} | ${turn.score} | ${turn.totals.home} | ${turn.totals.away} |`);
        });
      }
    });
  });
  lines.push('');
  return lines.join('\n');
}

const fixture = {
  generatedAt: new Date().toISOString(),
  match,
  playerStats: Object.fromEntries(Object.entries(playerStats).map(([id, stat]) => [id, {
    ...stat,
    x01ThreeDartAvg: stat.x01Darts ? Number(((stat.x01Points / stat.x01Darts) * 3).toFixed(3)) : null,
    cricketMpr: stat.cricketRounds ? Number((stat.cricketMarks / stat.cricketRounds).toFixed(3)) : null,
  }])),
};

const jsonPath = path.join(outDir, 'playoff-match-night-fixture.json');
const mdPath = path.join(outDir, 'playoff-match-night-report.md');
fs.writeFileSync(jsonPath, JSON.stringify(fixture, null, 2));
fs.writeFileSync(mdPath, makeMarkdown());
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
console.log(`Final ${teams.home.name} ${match.summary.homeSets}, ${teams.away.name} ${match.summary.awaySets}`);
