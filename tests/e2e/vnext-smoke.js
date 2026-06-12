// vNext smoke: load every page (except auto-score) authed, capture JS/console errors + render + screenshot.
// Run: node tests/e2e/vnext-smoke.js   (needs local server on :5000 — scripts/qa/serve-public.mjs 5000)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const admin = require('../../functions/node_modules/firebase-admin');
const serviceAccount = require('../../functions/service-account-key.json');

const BASE = process.env.BASE || 'http://localhost:5000';
const ADMIN_UID = 'guJR44IeFYPaqccsGy5k2ZVaXAk2';
const LEAGUE = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH = 'sgmoL4GyVUYP67aOS7wm';
const SHOTDIR = path.resolve(__dirname, '../../test-results/vnext-smoke');

// deep-link pages that need params to render meaningfully
const PARAMS = {
  'match-hub.html': `?league_id=${LEAGUE}&match_id=${MATCH}`,
  'league-view.html': `?league_id=${LEAGUE}`,
  'league-scoreboard.html': `?league_id=${LEAGUE}`,
  'league-team.html': `?league_id=${LEAGUE}`,
  'league-team-vnext.html': `?league_id=${LEAGUE}`,
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

(async () => {
  fs.mkdirSync(SHOTDIR, { recursive: true });
  const pagesDir = path.resolve(__dirname, '../../public/pages');
  const pages = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.html') && !/autoscore/i.test(f))
    .sort();

  const token = await admin.auth().createCustomToken(ADMIN_UID);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 834, height: 1194 } });
  const page = await ctx.newPage();

  // sign in once on the origin (auth persists in the context for same-origin navigations)
  await page.goto(`${BASE}/pages/register.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(async ({ token }) => {
    const config = await import('/js/firebase-config.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    await authMod.signInWithCustomToken(config.auth, token);
    await config.auth.currentUser.getIdToken(true);
  }, { token });
  await page.waitForTimeout(1500);

  const results = [];
  for (const f of pages) {
    const consoleErrors = [];
    const pageErrors = [];
    const onConsole = m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); };
    const onPageErr = e => pageErrors.push(String((e && e.message) || e).slice(0, 300));
    page.on('console', onConsole);
    page.on('pageerror', onPageErr);
    const url = `${BASE}/pages/${f}${PARAMS[f] || ''}`;
    let bodyLen = 0, title = '', navOk = true;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3500); // let JS + Firestore data load
      bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0));
      title = await page.title();
    } catch (e) { navOk = false; pageErrors.push('NAV: ' + String(e.message).slice(0, 200)); }
    try { await page.screenshot({ path: path.join(SHOTDIR, f.replace('.html', '.png')), fullPage: false }); } catch {}
    page.off('console', onConsole);
    page.off('pageerror', onPageErr);
    const ok = navOk && pageErrors.length === 0 && bodyLen > 150;
    results.push({ page: f, ok, title, bodyLen, consoleErrorCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 3), pageErrors });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.padEnd(36)} body=${String(bodyLen).padStart(5)} cErr=${consoleErrors.length} pErr=${pageErrors.length}${pageErrors.length ? '  :: ' + pageErrors[0] : ''}`);
  }
  fs.writeFileSync(path.join(SHOTDIR, 'results.json'), JSON.stringify(results, null, 2));
  const fails = results.filter(r => !r.ok);
  const cerr = results.filter(r => r.ok && r.consoleErrorCount > 0);
  console.log(`\n=== SUMMARY: ${results.length} pages | ${results.length - fails.length} pass | ${fails.length} FAIL | ${cerr.length} pass-with-console-errors ===`);
  fails.forEach(r => console.log(`  FAIL ${r.page}  pErr=${r.pageErrors.length} (${(r.pageErrors[0] || '').slice(0, 120)})`));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('SMOKE ERROR', e); process.exit(1); });
