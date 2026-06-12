import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.ROOKIES_BASE_URL || 'https://fortheloveofdarts.com';
const REPORT_DIR = process.env.ROOKIES_REPORT_DIR || 'reports/rookies-overnight';
const LEAGUE_ID = process.env.ROOKIES_LEAGUE_ID || 'rookies-demo-2026-triples';
const MATCH_ID = process.env.ROOKIES_MATCH_ID || 'playoff_2026_sf_2v3';
const TEAM_ID = process.env.ROOKIES_TEAM_ID || 'oZSTZMxgFNz9Nz206alJ';
const TOURNAMENT_ID = process.env.ROOKIES_TOURNAMENT_ID || 'rookies-wing-it-wednesdays-2026-05-27';
const LINK_LIMIT = Number.parseInt(process.env.ROOKIES_LINK_LIMIT || '40', 10);
const PAGE_LOAD_TIMEOUT = Number.parseInt(process.env.ROOKIES_PAGE_LOAD_TIMEOUT || '25000', 10);

const startedAt = new Date();
const runId = startedAt.toISOString().replace(/[:.]/g, '-');
const runDir = path.join(REPORT_DIR, runId);

const viewports = [
  ['desktop', { width: 1440, height: 1000, isMobile: false }],
  ['tablet', { width: 820, height: 1180, isMobile: true }],
  ['mobile', { width: 390, height: 844, isMobile: true }],
];

const pages = [
  ['landing', '/rookies/'],
  ['dashboard', '/rookies/dashboard/'],
  ['triples', `/rookies/pages/triples-vnext.html?league_id=${LEAGUE_ID}`],
  ['match-hub', `/rookies/pages/match-hub-vnext.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`],
  ['messages-league', `/rookies/pages/messages-vnext.html?source=league&league_id=${LEAGUE_ID}`],
  ['messages-team', `/rookies/pages/messages-vnext.html?source=team&league_id=${LEAGUE_ID}&team_id=${TEAM_ID}`],
  ['messages-event', `/rookies/pages/messages-vnext.html?source=events&tournament_id=${TOURNAMENT_ID}`],
  ['director-home', '/rookies/pages/director-home-vnext.html'],
  ['league-director', `/rookies/pages/league-director-vnext.html?league_id=${LEAGUE_ID}`],
  ['wing-it-series', '/rookies/pages/wing-it-wednesdays-vnext.html'],
  ['events', '/rookies/pages/events-vnext.html'],
  ['tournament-view', `/rookies/pages/tournament-view-vnext.html?tournament_id=${TOURNAMENT_ID}`],
  ['tournament-register', `/rookies/pages/tournament-register-vnext.html?tournament_id=${TOURNAMENT_ID}`],
  ['tournament-runtime', `/rookies/pages/tournament-runtime-vnext.html?tournament_id=${TOURNAMENT_ID}`],
  ['matchmaker-mingle', `/rookies/pages/matchmaker-mingle-vnext.html?tournament_id=${TOURNAMENT_ID}`],
  ['matchmaker-tv', `/rookies/pages/matchmaker-tv-vnext.html?tournament_id=${TOURNAMENT_ID}`],
  ['scorer-setup', '/rookies/pages/scorer-setup-vnext.html'],
  ['create-league', '/rookies/pages/create-league-vnext.html'],
  ['create-tournament', '/rookies/pages/create-tournament-vnext.html'],
  ['player-profile-brian', `/rookies/pages/player-profile-vnext.html?id=demo_brian_beach&league_id=${LEAGUE_ID}`],
];

const ignoredConsoleFragments = [
  'Unauthorized',
  '401',
  'Failed to load resource',
  'getConversations',
  'getPlayerChatRooms',
  'favicon',
  'firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
  'WebChannelConnection RPC',
  'ERR_BLOCKED_BY_CLIENT',
];

function slug(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function internalPath(url) {
  try {
    const parsed = new URL(url, BASE_URL);
    if (parsed.origin !== new URL(BASE_URL).origin) return null;
    if (!parsed.pathname.startsWith('/rookies')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function isIgnoredConsole(message) {
  return ignoredConsoleFragments.some((fragment) => message.includes(fragment));
}

async function collectMetrics(page) {
  return await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const doc = document.documentElement;
    const visible = [...document.querySelectorAll('body *')].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const overflowElements = visible
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === 'string' ? el.className.slice(0, 90) : '',
          text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -2 || item.right > window.innerWidth + 2)
      .slice(0, 10);

    const badText = [...bodyText.matchAll(/.{0,55}\b(NaN|undefined|null|Classic|safe preview|read-only preview)\b.{0,55}/gi)]
      .map((match) => match[0])
      .slice(0, 12);

    const visibleLinks = [...document.querySelectorAll('a[href]')]
      .filter((a) => {
        const rect = a.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((a) => ({
        text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        href: a.href,
      }));

    return {
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      bodyLength: bodyText.length,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
      overflowElements,
      badText,
      visibleButtons: [...document.querySelectorAll('button, a')].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length,
      forms: document.querySelectorAll('form').length,
      directorLoginVisible: !!document.querySelector('.ves-director-auth:not([hidden])'),
      hiddenCreateSurface: !!document.querySelector('.league-create-panel[hidden], #createTournamentForm[hidden]'),
      links: visibleLinks,
    };
  });
}

async function loadPage(page, url) {
  const errors = [];
  const warnings = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isIgnoredConsole(text)) errors.push(text);
    if (message.type() === 'warning' && !isIgnoredConsole(text)) warnings.push(text);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (isIgnoredConsole(url)) return;
    errors.push(`HTTP ${status}: ${url}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT }).catch((error) => {
    errors.push(`goto failed: ${error.message}`);
  });
  await page.waitForTimeout(3500);
  return { errors, warnings };
}

async function auditPages(browser) {
  const results = [];
  const discoveredLinks = new Map();

  for (const [viewportName, viewport] of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
    });
    const page = await context.newPage();

    for (const [name, route] of pages) {
      const url = new URL(route, BASE_URL).toString();
      const { errors, warnings } = await loadPage(page, url);
      const metrics = await collectMetrics(page).catch((error) => ({ error: error.message }));
      const screenshot = `${viewportName}-${slug(name)}.png`;
      await page.screenshot({ path: path.join(runDir, screenshot), fullPage: true }).catch((error) => {
        errors.push(`screenshot failed: ${error.message}`);
      });

      for (const link of metrics.links || []) {
        const pathOnly = internalPath(link.href);
        if (pathOnly && !discoveredLinks.has(pathOnly)) {
          discoveredLinks.set(pathOnly, { source: name, text: link.text, path: pathOnly });
        }
      }

      results.push({
        name,
        viewport: viewportName,
        url,
        screenshot,
        ok: !errors.length && !metrics.horizontalOverflow && !(metrics.badText || []).length,
        errors,
        warnings,
        metrics: {
          ...metrics,
          links: undefined,
        },
      });
    }

    await context.close();
  }

  return { results, discoveredLinks: [...discoveredLinks.values()] };
}

async function auditLinks(browser, discoveredLinks) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const limited = discoveredLinks
    .filter((link) => !link.path.includes('logout') && !link.path.includes('mailto:') && !link.path.includes('tel:'))
    .slice(0, Number.isFinite(LINK_LIMIT) ? LINK_LIMIT : 40);
  const results = [];

  for (const link of limited) {
    const url = new URL(link.path, BASE_URL).toString();
    const { errors } = await loadPage(page, url);
    const metrics = await collectMetrics(page).catch((error) => ({ error: error.message }));
    results.push({
      ...link,
      url,
      ok: !errors.length && !metrics.horizontalOverflow && !(metrics.badText || []).length,
      status: page.url().startsWith(BASE_URL) ? 'loaded' : 'redirected',
      finalUrl: page.url(),
      errors,
      horizontalOverflow: metrics.horizontalOverflow,
      badText: metrics.badText || [],
    });
  }

  await context.close();
  return results;
}

await fs.mkdir(runDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const { results, discoveredLinks } = await auditPages(browser);
const linkResults = await auditLinks(browser, discoveredLinks);
await browser.close();

const report = {
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  runDir,
  pages,
  summary: {
    pageChecks: results.length,
    pageFailures: results.filter((result) => !result.ok).map((result) => `${result.viewport}:${result.name}`),
    overflow: results.filter((result) => result.metrics?.horizontalOverflow).map((result) => `${result.viewport}:${result.name}`),
    badText: results.filter((result) => result.metrics?.badText?.length).map((result) => `${result.viewport}:${result.name}`),
    consoleErrors: results.filter((result) => result.errors.length).map((result) => `${result.viewport}:${result.name}`),
    discoveredLinks: discoveredLinks.length,
    linkChecks: linkResults.length,
    linkFailures: linkResults.filter((result) => !result.ok).map((result) => ({ source: result.source, text: result.text, path: result.path, errors: result.errors, badText: result.badText })),
  },
  results,
  linkResults,
};

const reportPath = path.join(runDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ reportPath, runDir, summary: report.summary }, null, 2));
