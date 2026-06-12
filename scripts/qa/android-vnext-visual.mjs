import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const ADB = process.env.ADB || 'C:\\Users\\gcfrp\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const BASE_URL = process.env.BRDC_BASE_URL || 'https://burningriverdarts.com';
const CDP_URL = process.env.BRDC_CDP_URL || 'http://127.0.0.1:9222';
const REPORT_DIR = process.env.BRDC_REPORT_DIR || 'reports/android-vnext-visual';
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

const pages = [
  ['home', '/pages/home-vnext.html'],
  ['triples', `/pages/triples-vnext.html?league_id=${LEAGUE_ID}`],
  ['messages', '/pages/messages-vnext.html'],
  ['captain', `/pages/captain-dashboard-vnext.html?league_id=${LEAGUE_ID}`],
  ['director', `/pages/league-director-vnext.html?league_id=${LEAGUE_ID}`],
  ['admin', '/pages/admin-vnext.html'],
  ['members', `/pages/members-vnext.html?league_id=${LEAGUE_ID}`]
];

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        if (!data.trim()) {
          reject(new Error(`Empty response from ${url}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function waitForCdp(timeoutMs = 20000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      await getJson(`${CDP_URL}/json/version`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error('Chrome DevTools endpoint was not ready');
}

async function openAndroidUrl(url) {
  await execFileAsync(ADB, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url.replaceAll('&', '\\&')]);
  await new Promise((resolve) => setTimeout(resolve, 8000));
}

async function activePage(browser, pathFragment) {
  const contexts = browser.contexts();
  for (const context of contexts) {
    for (const page of context.pages()) {
      if (page.url().includes(pathFragment)) return page;
    }
  }
  throw new Error(`No Android page found for ${pathFragment}`);
}

async function metrics(page) {
  return await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const viewportWidth = window.innerWidth;
    const doc = document.documentElement;
    const visible = [...document.querySelectorAll('body *')].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    return {
      title: document.title,
      url: location.href,
      viewportWidth,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > viewportWidth + 2,
      badText: [...text.matchAll(/.{0,45}\b(NaN|undefined|null|PIN|Classic|safe preview|read-only in preview)\b.{0,45}/gi)].map((m) => m[0]).slice(0, 8),
      signedIn: /Donnie Pagel|ADMIN|Cle Pagel Co|Signed in/i.test(text),
      skeletons: document.querySelectorAll('.skeleton, .loading, [class*="skeleton"], [class*="loading"]').length,
      overflowElements: visible
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            className: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
            text: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
            left: Math.round(rect.left),
            right: Math.round(rect.right)
          };
        })
        .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
        .slice(0, 10)
    };
  });
}

await execFileAsync(ADB, ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote']);
await openAndroidUrl(`${BASE_URL}/pages/home-vnext.html`);
await waitForCdp();
const browser = await chromium.connectOverCDP(CDP_URL);
const startedAt = new Date();
const runDir = path.join(REPORT_DIR, startedAt.toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(runDir, { recursive: true });

const results = [];
for (const [name, route] of pages) {
  const url = new URL(route, BASE_URL).toString();
  const errors = [];
  await openAndroidUrl(url);
  const page = await activePage(browser, route.split('?')[0]);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const screenshot = `${name}.png`;
  await page.screenshot({ path: path.join(runDir, screenshot), fullPage: true });
  const pageMetrics = await metrics(page);
  const ok = !pageMetrics.overflow && !pageMetrics.badText.length && !errors.length;
  results.push({ name, ok, screenshot, errors, metrics: pageMetrics });
}

await browser.close();

const report = {
  startedAt: startedAt.toISOString(),
  runDir,
  summary: {
    checks: results.length,
    failing: results.filter((result) => !result.ok).map((result) => result.name),
    overflow: results.filter((result) => result.metrics.overflow).map((result) => result.name),
    badText: results.filter((result) => result.metrics.badText.length).map((result) => result.name),
    errors: results.filter((result) => result.errors.length).map((result) => result.name)
  },
  results
};
const reportPath = path.join(runDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ reportPath, runDir, summary: report.summary }, null, 2));
