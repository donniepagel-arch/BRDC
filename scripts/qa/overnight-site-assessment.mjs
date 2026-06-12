import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const CDP_URL = process.env.BRDC_CDP_URL || 'http://127.0.0.1:9222';
const LEAGUE_ID = process.env.BRDC_LEAGUE_ID || 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = process.env.BRDC_MATCH_ID || 'e2nibslUoRKdtWA5Nzqy';
const TOURNAMENT_ID = process.env.BRDC_TOURNAMENT_ID || '2uU3CpIFDdJUzmcTv5PQ';
const REPORT_DIR = process.env.BRDC_REPORT_DIR || 'reports';

const routes = [
  {
    name: 'dashboard',
    url: `${BASE_URL}/pages/dashboard.html`,
    actions: ['expand-feed']
  },
  {
    name: 'messages',
    url: `${BASE_URL}/pages/messages.html`,
    actions: ['tabs']
  },
  {
    name: 'league-view',
    url: `${BASE_URL}/pages/league-view.html?league_id=${LEAGUE_ID}`,
    actions: ['tabs', 'expand-feed']
  },
  {
    name: 'league-director',
    url: `${BASE_URL}/pages/league-director.html?league_id=${LEAGUE_ID}`,
    actions: ['tabs']
  },
  {
    name: 'match-hub',
    url: `${BASE_URL}/pages/match-hub.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`,
    actions: ['tabs', 'expand-feed']
  },
  {
    name: 'player-profile',
    url: `${BASE_URL}/pages/player-profile.html`,
    actions: ['tabs', 'expand-feed']
  },
  {
    name: 'members',
    url: `${BASE_URL}/pages/members.html?league_id=${LEAGUE_ID}`,
    actions: []
  },
  {
    name: 'events-hub',
    url: `${BASE_URL}/pages/events-hub.html`,
    actions: ['tabs']
  },
  {
    name: 'tournaments',
    url: `${BASE_URL}/pages/tournaments.html`,
    actions: []
  },
  {
    name: 'tournament-view',
    url: `${BASE_URL}/pages/tournament-view.html?tournament_id=${TOURNAMENT_ID}`,
    actions: ['tabs']
  },
  {
    name: 'tournament-bracket',
    url: `${BASE_URL}/pages/tournament-bracket.html?tournament_id=${TOURNAMENT_ID}`,
    actions: []
  },
  {
    name: 'dart-trader',
    url: `${BASE_URL}/pages/dart-trader.html`,
    actions: ['tabs']
  },
  {
    name: 'game-setup',
    url: `${BASE_URL}/pages/game-setup.html`,
    actions: []
  },
  {
    name: 'x01-scorer',
    url: `${BASE_URL}/pages/x01-scorer.html`,
    actions: []
  },
  {
    name: 'league-cricket',
    url: `${BASE_URL}/pages/league-cricket.html?league_id=${LEAGUE_ID}`,
    actions: []
  }
];

const tabLabels = [
  'STANDINGS', 'SCHEDULE', 'STATS', 'RULES', 'MEMBERS',
  'MATCHES', 'PLAYERS', 'TEAMS', 'CONTACT', 'SETTINGS', 'DIRECTOR TOOLS',
  'LOBBY', 'CHANNELS', 'DIRECT', 'ONLINE NOW',
  'GAMES', 'PERFORMANCE', 'AWARDS', 'LEADERS',
  'OVERVIEW', 'EVENTS', 'REGISTRATIONS', 'BRACKET', 'MATCHES',
  'MARKETPLACE', 'MY LISTINGS'
];

function badContexts(text) {
  return [...text.matchAll(/.{0,60}\b(NaN|undefined)\b.{0,60}/gi)].map((m) => m[0]).slice(0, 25);
}

function extractInterestingLines(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /3DA|MPR|STANDINGS|SCHEDULE|STATS|TEAM|SETS|MATCH|ERROR|UNAUTHORIZED|PLAYOFF|REGISTER|CHALLENGE|LOBBY|DIRECT|CRKT|WINS|TOTAL/i.test(line))
    .slice(0, 180);
}

async function clickVisibleText(page, label) {
  const locator = page.getByText(label, { exact: false }).first();
  if (!(await locator.count())) return false;
  try {
    await locator.click({ timeout: 2500 });
    await page.waitForTimeout(1200);
    return true;
  } catch {
    return false;
  }
}

async function expandCards(page) {
  return await page.evaluate(() => {
    let clicked = 0;
    const elements = [...document.querySelectorAll('button, [onclick], .expand-btn, .feed-toggle, .match-count, .week-feed-card')];
    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim();
      if (/MORE INFO|MATCHES|EXPAND|DETAIL/i.test(text) || text.includes('▼')) {
        try {
          el.click();
          clicked++;
        } catch {}
      }
    }
    return clicked;
  });
}

async function snapshotPage(page, routeName, phase, errors, warnings) {
  const text = await page.locator('body').innerText({ timeout: 8000 }).catch((error) => `BODY_READ_FAILED: ${error.message}`);
  const counts = await page.evaluate(() => {
    const selectors = ['table', '.standings-table', '.match-card', '.feed-card', '.post-card', '.member-row', '.stat-card', '.modal', '.skeleton', '.loading'];
    return Object.fromEntries(selectors.map((selector) => [selector, document.querySelectorAll(selector).length]));
  }).catch((error) => ({ error: error.message }));

  return {
    routeName,
    phase,
    url: page.url(),
    title: await page.title().catch(() => null),
    textLength: text.length,
    hasNaNOrUndefined: /\b(NaN|undefined)\b/i.test(text),
    badContexts: badContexts(text),
    counts,
    errors: errors.slice(),
    warnings: warnings.slice(),
    lines: extractInterestingLines(text)
  };
}

async function runRoute(page, route) {
  const errors = [];
  const warnings = [];
  const snapshots = [];

  page.removeAllListeners('console');
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') errors.push(text);
    if (message.type() === 'warning') warnings.push(text);
  });

  try {
    await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (error) {
    errors.push(`goto failed: ${error.message}`);
  }

  await page.waitForTimeout(6000);
  snapshots.push(await snapshotPage(page, route.name, 'initial', errors, warnings));

  if (route.actions.includes('tabs')) {
    for (const label of tabLabels) {
      const clicked = await clickVisibleText(page, label);
      if (clicked) {
        snapshots.push(await snapshotPage(page, route.name, `tab:${label}`, errors, warnings));
      }
    }
  }

  if (route.actions.includes('expand-feed')) {
    const clicked = await expandCards(page);
    await page.waitForTimeout(2500);
    const expanded = await snapshotPage(page, route.name, 'expanded', errors, warnings);
    expanded.expandedClicks = clicked;
    snapshots.push(expanded);
  }

  return {
    name: route.name,
    url: route.url,
    ok: snapshots.every((snapshot) => !snapshot.hasNaNOrUndefined) && errors.length === 0,
    errors,
    warnings,
    snapshots
  };
}

async function connectBrowser() {
  try {
    return await chromium.connectOverCDP(CDP_URL);
  } catch {
    return await chromium.launch({ headless: true });
  }
}

const startedAt = new Date();
const browser = await connectBrowser();
const context = browser.contexts()[0] || await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = context.pages()[0] || await context.newPage();

const results = [];
for (const route of routes) {
  results.push(await runRoute(page, route));
}

const finishedAt = new Date();
const report = {
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  baseUrl: BASE_URL,
  cdpUrl: CDP_URL,
  leagueId: LEAGUE_ID,
  matchId: MATCH_ID,
  tournamentId: TOURNAMENT_ID,
  summary: {
    routes: results.length,
    passing: results.filter((result) => result.ok).length,
    failing: results.filter((result) => !result.ok).map((result) => result.name),
    errorCount: results.reduce((sum, result) => sum + result.errors.length, 0),
    badValueRoutes: results.filter((result) => result.snapshots.some((snapshot) => snapshot.hasNaNOrUndefined)).map((result) => result.name)
  },
  results
};

await fs.mkdir(REPORT_DIR, { recursive: true });
const fileName = `overnight-site-assessment-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`;
const reportPath = path.join(REPORT_DIR, fileName);
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  reportPath,
  summary: report.summary
}, null, 2));

await browser.close();
