import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const REPORT_DIR = process.env.BRDC_REPORT_DIR || 'reports/vnext-visual';
const LEAGUE_ID = process.env.BRDC_LEAGUE_ID || 'aOq4Y0ETxPZ66tM1uUtP';

const pages = [
  ['home', '/pages/home-vnext.html'],
  ['triples', `/pages/triples-vnext.html?league_id=${LEAGUE_ID}`],
  ['members', `/pages/members-vnext.html?league_id=${LEAGUE_ID}`],
  ['messages', '/pages/messages-vnext.html'],
  ['captain', `/pages/captain-dashboard-vnext.html?league_id=${LEAGUE_ID}`],
  ['director', `/pages/league-director-vnext.html?league_id=${LEAGUE_ID}`],
  ['admin', '/pages/admin-vnext.html'],
  ['events', '/pages/events-vnext.html'],
  ['create-tournament', '/pages/create-tournament-vnext.html'],
  ['dart-trader', '/pages/dart-trader-vnext.html'],
  ['scorer-setup', '/pages/scorer-setup-vnext.html']
];

const viewports = [
  ['desktop', { width: 1440, height: 1000, isMobile: false }],
  ['tablet', { width: 820, height: 1180, isMobile: true }],
  ['mobile', { width: 390, height: 844, isMobile: true }]
];

function slug(value) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function waitForPage(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

async function collectMetrics(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const bodyText = document.body?.innerText || '';
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const visibleElements = [...document.querySelectorAll('body *')].filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const overflowElements = visibleElements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
          text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.right > viewportWidth + 2 || item.left < -2)
      .slice(0, 12);
    const tinyText = visibleElements
      .map((el) => {
        const style = getComputedStyle(el);
        const size = parseFloat(style.fontSize);
        const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
        return { tag: el.tagName.toLowerCase(), className: typeof el.className === 'string' ? el.className.slice(0, 80) : '', size, text: text.slice(0, 80) };
      })
      .filter((item) => item.text.length > 2 && item.size > 0 && item.size < 10)
      .slice(0, 12);
    return {
      title: document.title,
      url: location.href,
      viewportWidth,
      viewportHeight,
      scrollWidth: doc.scrollWidth,
      scrollHeight: doc.scrollHeight,
      bodyLength: bodyText.length,
      badText: [...bodyText.matchAll(/.{0,45}\b(NaN|undefined|null|PIN|Classic|safe preview|read-only in preview)\b.{0,45}/gi)].map((m) => m[0]).slice(0, 12),
      overflow: doc.scrollWidth > viewportWidth + 2,
      overflowElements,
      tinyText,
      skeletons: document.querySelectorAll('.skeleton, .loading, [class*="skeleton"], [class*="loading"]').length,
      visibleButtons: [...document.querySelectorAll('button, a')].filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length
    };
  });
}

await fs.mkdir(REPORT_DIR, { recursive: true });
const startedAt = new Date();
const runDir = path.join(REPORT_DIR, startedAt.toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(runDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

for (const [viewportName, viewport] of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile
  });
  const page = await context.newPage();

  for (const [name, route] of pages) {
    const errors = [];
    page.removeAllListeners('console');
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const url = new URL(route, BASE_URL).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((error) => {
      errors.push(`goto failed: ${error.message}`);
    });
    await waitForPage(page);
    const screenshot = `${viewportName}-${slug(name)}.png`;
    await page.screenshot({ path: path.join(runDir, screenshot), fullPage: true }).catch((error) => {
      errors.push(`screenshot failed: ${error.message}`);
    });
    const metrics = await collectMetrics(page).catch((error) => ({ error: error.message }));
    const ok = !metrics.overflow && !metrics.badText?.length && !errors.length;
    results.push({ name, viewport: viewportName, ok, screenshot, errors, metrics });
  }

  await context.close();
}

await browser.close();

const report = {
  startedAt: startedAt.toISOString(),
  baseUrl: BASE_URL,
  runDir,
  summary: {
    checks: results.length,
    failing: results.filter((result) => !result.ok).map((result) => `${result.viewport}:${result.name}`),
    overflow: results.filter((result) => result.metrics?.overflow).map((result) => `${result.viewport}:${result.name}`),
    badText: results.filter((result) => result.metrics?.badText?.length).map((result) => `${result.viewport}:${result.name}`),
    errors: results.filter((result) => result.errors.length).map((result) => `${result.viewport}:${result.name}`)
  },
  results
};

const reportPath = path.join(runDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ reportPath, runDir, summary: report.summary }, null, 2));
