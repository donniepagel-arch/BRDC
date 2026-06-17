// Verify the checkout trainer's flight->land->score->stat loop completes after the refactor.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errs.push('EXC: ' + String(e).slice(0, 160)));

await page.goto('http://localhost:5601/pages/checkout-trainer-vnext.html?target=40', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

const result = await page.evaluate(async () => {
  try { localStorage.removeItem('brdc:checkoutTrainer:stats:v1'); } catch {}
  const cv = document.getElementById('board');
  const click = () => cv.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // 3 darts: lockX, lockY, then wait > flight duration (470ms) for it to land
  for (let d = 0; d < 3; d++) { click(); await wait(120); click(); await wait(650); }
  await wait(300);
  return {
    slots: [0, 1, 2].map(i => document.getElementById('s' + i).textContent),
    msg: document.getElementById('msg').textContent,
    stats: JSON.parse(localStorage.getItem('brdc:checkoutTrainer:stats:v1') || '{}'),
  };
});
console.log(JSON.stringify({ ...result, errors: [...new Set(errs)] }, null, 1));
await browser.close();
