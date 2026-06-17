import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:5601/pages/checkout-trainer-vnext.html?target=121';
const out = process.argv[3] || '_trainer-shot.png';
const sel = process.argv[4] || '#board';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errs.push('EXC: ' + String(e).slice(0, 160)));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator(sel).screenshot({ path: path.join(here, out) });
console.log(JSON.stringify({ out, errors: [...new Set(errs)] }));
await browser.close();
