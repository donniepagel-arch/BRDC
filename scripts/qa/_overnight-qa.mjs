import { chromium } from 'playwright';
import fs from 'fs';

const PAGES = fs.readdirSync('public/pages').filter(f => /vnext\.html$/.test(f));
const BASE = 'https://burningriverdarts.com/pages/';
const b = await chromium.launch({ headless: true });
const results = [];

for (const page of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 1400 }, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const consoleErrs = [];
  const pageErrs = [];
  p.on('console', m => { if (m.type() === 'error') consoleErrs.push((m.text() || '').slice(0, 160)); });
  p.on('pageerror', e => pageErrs.push((e.message || '').slice(0, 160)));
  const url = BASE + page + '?_cb=qa' + Math.floor(Math.random() * 99999);
  let nav = 'ok';
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(e => nav = 'goto:' + e.message.slice(0,60));
  await p.waitForTimeout(7000);
  const info = await p.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const skels = document.querySelectorAll('[class*="skeleton"]').length;
    const title = document.title;
    // internal page links
    const links = [...new Set([...document.querySelectorAll('a[href^="/pages/"]')].map(a => a.getAttribute('href').split('?')[0].split('#')[0]))];
    // visible error-ish text
    const bodyTxt = (document.body.innerText || '');
    const errText = /unexpected end of input|is not defined|cannot read|undefined is not|failed to load|application error/i.test(bodyTxt);
    return { overflow, skels, title, links, errText };
  }).catch(e => ({ evalError: e.message.slice(0,80) }));
  results.push({ page, nav, ...info,
    consoleErrors: [...new Set(consoleErrs)].slice(0, 6),
    pageErrors: [...new Set(pageErrs)].slice(0, 6) });
  await ctx.close();
  process.stdout.write('.');
}
await b.close();
fs.writeFileSync('reports/overnight-qa.json', JSON.stringify(results, null, 2));
console.log('\nDONE -> reports/overnight-qa.json (' + results.length + ' pages)');
