// Render the shared dartboard via headless chromium and save a PNG to eyeball the look.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 460, height: 460 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('[err]', String(e).slice(0, 200)));

await page.goto('http://localhost:5601/pages/cricket-strategy-vnext.html', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ url: '/js/dartboard-render.js?v=1' });
await page.waitForTimeout(300);

await page.evaluate(() => {
  document.body.innerHTML = '<canvas id="t" width="840" height="840" style="width:420px;height:420px"></canvas>';
  document.body.style.background = '#0c1020';
  document.body.style.margin = '0';
  const cv = document.getElementById('t'), ctx = cv.getContext('2d');
  ctx.fillStyle = '#0c1020'; ctx.fillRect(0, 0, cv.width, cv.height);
  const R = cv.width * 0.43, cx = cv.width / 2, cy = cv.height / 2;
  // eslint-disable-next-line no-undef
  DB.draw(ctx, cx, cy, R, { glow: 'T20' });
});
await page.waitForTimeout(150);
await page.locator('#t').screenshot({ path: path.join(here, '_db-render.png') });
console.log('saved scripts/qa/_db-render.png');
await browser.close();
