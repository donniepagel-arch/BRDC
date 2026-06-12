// Quick pre-deploy smoke: load changed pages on the local server, collect console errors.
import { chromium } from 'playwright';

const PAGES = [
  '/pages/home-vnext.html',
  '/pages/contact-center-vnext.html',
  '/pages/match-hub-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=sgmoL4GyVUYP67aOS7wm',
  '/pages/x01-scorer-vnext.html',
  '/pages/autoscore-lab.html',
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
let bad = 0;
for (const p of PAGES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('EXC: ' + String(e).slice(0, 120)));
  try {
    await page.goto('http://localhost:5601' + p, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(6000);
    const title = await page.title();
    const uniq = [...new Set(errors)];
    if (uniq.length) bad++;
    console.log(`${uniq.length ? '✗' : '✓'} ${p.split('?')[0]} — "${title}"${uniq.length ? '\n    ' + uniq.join('\n    ') : ''}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${p} — LOAD FAIL: ${String(e).slice(0, 100)}`);
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
