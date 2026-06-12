import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const fixturePath = path.join(repoRoot, 'temp/qa/playoff-match-night-fixture.json');
const outPath = path.join(repoRoot, 'temp/qa/playoff-scorer-replay-comparison.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const baseUrl = 'https://fortheloveofdarts.com';
const leagueId = 'rookies-demo-2026-triples';
const captureMatchId = 'qa_capture_no_write';

function sideParam(side) {
  return side === 'home' ? 'home' : 'away';
}

function rosterForUrl(players) {
  return JSON.stringify(players.map((player, index) => ({
    id: player.id,
    name: player.name,
    level: player.level,
    position: index + 1,
  })));
}

function commonParams(set, leg, sequence) {
  const params = new URLSearchParams();
  params.set('league_id', leagueId);
  params.set('match_id', captureMatchId);
  params.set('game_index', String(sequence - 1));
  params.set('game_number', String(sequence));
  params.set('from_match', 'true');
  params.set('total_games', '99');
  params.set('home_team_name', fixture.match.teams.home.name);
  params.set('away_team_name', fixture.match.teams.away.name);
  params.set('return_url', '/rookies/pages/match-hub-vnext.html?league_id=rookies-demo-2026-triples&match_id=playoff_2026_sf_2v3');
  params.set('home_players', rosterForUrl(set.homeRoster));
  params.set('away_players', rosterForUrl(set.awayRoster));
  params.set('legs_to_win', '1');
  params.set('sets_to_win', '99');
  params.set('cork', 'true');
  params.set('cork_rule', 'cork_every_leg');
  params.set('cork_option', 'winner_chooses');
  params.set('starter', sideParam(leg.starter || 'home'));
  params.set('qa_capture', 'true');
  return params;
}

function x01Url(set, leg, sequence) {
  const params = commonParams(set, leg, sequence);
  params.set('starting_score', '501');
  params.set('format', '501');
  params.set('game_type', '501');
  params.set('in_rule', 'straight');
  params.set('out_rule', 'double');
  params.set('checkout', 'double');
  return `${baseUrl}/rookies/pages/x01-scorer-vnext.html?${params.toString()}`;
}

function cricketUrl(set, leg, sequence) {
  const params = commonParams(set, leg, sequence);
  params.set('format', 'cricket');
  params.set('game_type', 'cricket');
  return `${baseUrl}/rookies/pages/league-cricket-vnext.html?${params.toString()}`;
}

function dartToAction(dart) {
  if (!dart || dart.label === 'MISS') return { miss: true };
  const label = dart.label;
  if (label === 'DB') return { target: 'BULL', mult: 2 };
  if (label === 'SB') return { target: 'BULL', mult: 1 };
  const prefix = label[0];
  return {
    target: label.slice(1),
    mult: prefix === 'T' ? 3 : prefix === 'D' ? 2 : 1,
  };
}

function emptyStatsFor(player) {
  return {
    id: player.id,
    name: player.name,
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

function buildNameIndex() {
  const byName = new Map();
  for (const set of fixture.match.sets) {
    for (const player of [...set.homeRoster, ...set.awayRoster]) {
      if (!byName.has(player.name)) byName.set(player.name, emptyStatsFor(player));
    }
  }
  return byName;
}

function addCapturedStats(capturedPayloads) {
  const stats = buildNameIndex();
  for (const payload of capturedPayloads) {
    const gameStats = payload.body?.game_stats;
    if (!gameStats?.legs?.length) continue;
    const gameType = String(gameStats.game_type || payload.type).toLowerCase();
    const homeNames = (payload.body.home_players || []).map((player) => player.name);
    const awayNames = (payload.body.away_players || []).map((player) => player.name);
    for (const leg of gameStats.legs) {
      const playerStats = leg.player_stats || {};
      for (const [name, row] of Object.entries(playerStats)) {
        if (!stats.has(name)) continue;
        const target = stats.get(name);
        const side = homeNames.includes(name) ? 'home' : awayNames.includes(name) ? 'away' : null;
        const won = side && leg.winner === side;
        if (gameType.includes('cricket')) {
          const marks = Number(row.marks ?? row.total_marks ?? row.mark_count ?? 0);
          const rounds = Number(row.rounds ?? row.total_rounds ?? 0);
          target.cricketMarks += marks;
          target.cricketRounds += rounds;
          target.cricketLegsPlayed += 1;
          if (won) target.cricketLegsWon += 1;
          target.highMarkRound = Math.max(target.highMarkRound, Number(row.high_mark_round || 0));
        } else {
          const points = Number(row.points ?? row.points_scored ?? 0);
          const darts = Number(row.darts ?? row.darts_thrown ?? 0);
          target.x01Points += points;
          target.x01Darts += darts;
          target.x01LegsPlayed += 1;
          if (won) target.x01LegsWon += 1;
          target.highScore = Math.max(target.highScore, Number(row.high_score || 0));
          target.highCheckout = Math.max(target.highCheckout, Number(row.checkout || 0));
        }
      }
    }
  }
  for (const row of stats.values()) {
    row.x01ThreeDartAvg = row.x01Darts ? Number(((row.x01Points / row.x01Darts) * 3).toFixed(3)) : 0;
    row.cricketMpr = row.cricketRounds ? Number((row.cricketMarks / row.cricketRounds).toFixed(3)) : 0;
  }
  return Object.fromEntries([...stats.values()].map((row) => [row.id, row]));
}

function compareStats(actual) {
  const rows = [];
  for (const [id, expected] of Object.entries(fixture.playerStats)) {
    const got = actual[id];
    const checks = [
      ['x01ThreeDartAvg', 0.011],
      ['x01LegsPlayed', 0],
      ['x01LegsWon', 0],
      ['highScore', 0],
      ['highCheckout', 0],
      ['cricketMpr', 0.011],
      ['cricketLegsPlayed', 0],
      ['cricketLegsWon', 0],
      ['highMarkRound', 0],
    ].map(([key, tolerance]) => {
      const expectedValue = Number(expected[key] || 0);
      const actualValue = Number(got?.[key] || 0);
      const pass = Math.abs(expectedValue - actualValue) <= tolerance;
      return { key, expected: expectedValue, actual: actualValue, pass };
    });
    rows.push({
      id,
      name: expected.name,
      pass: checks.every((check) => check.pass),
      checks,
    });
  }
  return rows;
}

async function playX01Leg(page, leg) {
  await page.waitForFunction(() => typeof window.submitScore === 'function' && typeof window.saveGame === 'function');
  await resolveStarter(page, leg.starter || 'home');
  for (const turn of leg.turns) {
    await page.evaluate((score) => window.submitScore(score), turn.score);
    if (turn.checkout) {
      await page.waitForFunction(() => document.querySelector('#scoreInput')?.classList.contains('checkout-mode'));
      await page.evaluate((darts) => window.completeCheckoutQuick(darts), turn.checkoutDarts || 3);
    }
    // The scorer has production double-tap protection. Keep the replay inside
    // that timing contract so this tests the real input path instead of racing it.
    await page.waitForTimeout(560);
  }
  if (await page.locator('#confirmGameModal.active').count()) {
    await page.evaluate(() => window.confirmGameWin());
  }
  await page.waitForSelector('#gameModal.active', { timeout: 5000 });
  await page.evaluate(() => window.saveGame());
}

async function playCricketLeg(page, leg) {
  await page.waitForFunction(() => typeof window.addHit === 'function' && typeof window.nextPlayer === 'function' && typeof window.saveAndExit === 'function');
  await resolveStarter(page, leg.starter || 'home');
  for (const turn of leg.turns) {
    let winConfirmed = false;
    for (const dart of turn.darts) {
      const action = dartToAction(dart);
      if (action.miss) {
        const hasWin = await page.locator('#dartsModal.active').count();
        if (!hasWin) await page.evaluate(() => window.addMiss());
      } else {
        await page.evaluate(({ target, mult }) => window.addHit(target, mult), action);
      }
      const activeWinModal = await page.locator('#dartsModal.active').count();
      if (activeWinModal) {
        const dartsUsed = turn.darts.findIndex((candidate) => candidate === dart) + 1;
        await page.evaluate((count) => window.confirmWinDarts(count), dartsUsed);
        winConfirmed = true;
        break;
      }
      await page.waitForTimeout(10);
    }
    if (!winConfirmed) {
      await page.evaluate(() => window.nextPlayer());
    }
    await page.waitForTimeout(20);
  }
  await page.waitForSelector('#winModal.active', { timeout: 5000 });
  await page.evaluate(() => window.saveAndExit());
}

async function resolveStarter(page, starter) {
  await page.waitForSelector('#starterModal.active', { timeout: 5000 }).catch(() => {});
  const starterIndex = starter === 'away' ? 1 : 0;
  if (await page.locator('#starterModal.active').count()) {
    const corkPhaseVisible = await page.evaluate(() => {
      const phase = document.getElementById('whoGotItPhase');
      return phase && getComputedStyle(phase).display !== 'none';
    });
    if (corkPhaseVisible) {
      await page.evaluate(async (index) => {
        document.querySelector('.cork-player-btn[data-team="0"][data-idx="0"]')?.click();
        document.querySelector('.cork-player-btn[data-team="1"][data-idx="0"]')?.click();
        window.corkSetWinner(index);
        await window.corkStart();
      }, starterIndex);
      await page.evaluate(async () => {
        const chooseOrder = document.getElementById('chooseOrderPhase');
        if (chooseOrder && getComputedStyle(chooseOrder).display !== 'none' && typeof window.chooseThrowOrder === 'function') {
          await window.chooseThrowOrder('first');
        }
      });
    } else {
      await page.evaluate(async () => window.confirmStarter && await window.confirmStarter());
    }
    await page.waitForTimeout(300);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
  });
  context.setDefaultTimeout(15000);

  const capturedPayloads = [];
  await context.route('**/submitGameResult', async (route) => {
    const request = route.request();
    let body = {};
    try {
      body = request.postDataJSON();
    } catch {
      body = { raw: request.postData() };
    }
    capturedPayloads.push({
      url: request.url(),
      body,
      type: body?.game_stats?.game_type || 'unknown',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, match_finalized: false, status: 'captured' }),
    });
  });
  await context.route('**/saveLeagueMatchProgress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, status: 'captured-progress' }),
    });
  });
  await context.route('**/getLeagueMatchProgress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, progress: null }),
    });
  });

  const page = await context.newPage();
  page.on('dialog', async (dialog) => dialog.dismiss().catch(() => {}));

  let sequence = 1;
  for (const set of fixture.match.sets) {
    for (const leg of set.legs) {
      const before = capturedPayloads.length;
      const url = leg.type === 'cricket' ? cricketUrl(set, leg, sequence) : x01Url(set, leg, sequence);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      if (leg.type === 'cricket') {
        await playCricketLeg(page, leg);
      } else {
        await playX01Leg(page, leg);
      }

      await page.waitForFunction(
        (count) => window.__captureCount ? window.__captureCount > count : true,
        before,
        { timeout: 1000 }
      ).catch(() => {});
      if (capturedPayloads.length !== before + 1) {
        throw new Error(`Expected one captured save for set ${set.set}, leg ${leg.leg}; got ${capturedPayloads.length - before}`);
      }
      sequence += 1;
    }
  }

  const actualStats = addCapturedStats(capturedPayloads);
  const comparison = {
    generatedAt: new Date().toISOString(),
    capturedSaves: capturedPayloads.length,
    expectedLegs: fixture.match.sets.reduce((sum, set) => sum + set.legs.length, 0),
    capturedPayloads,
    actualStats,
    expectedStats: fixture.playerStats,
    comparison: compareStats(actualStats),
  };
  comparison.pass = comparison.capturedSaves === comparison.expectedLegs
    && comparison.comparison.every((row) => row.pass);

  fs.writeFileSync(outPath, `${JSON.stringify(comparison, null, 2)}\n`);
  await browser.close();

  console.log(`Captured scorer saves: ${comparison.capturedSaves}/${comparison.expectedLegs}`);
  console.log(`Comparison: ${comparison.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Wrote ${outPath}`);
  for (const row of comparison.comparison) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.name}`);
    for (const check of row.checks.filter((item) => !item.pass)) {
      console.log(`  ${check.key}: expected ${check.expected}, actual ${check.actual}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
