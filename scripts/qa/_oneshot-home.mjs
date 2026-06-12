import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'https://burningriverdarts.com/pages/home-vnext.html';
const OUT = process.env.SHOT_OUT || 'reports/home-shot.png';
const W = Number(process.env.SHOT_W || 390);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: 1400 }, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => console.log('goto:', e.message));
await page.waitForTimeout(9000);
await page.screenshot({ path: OUT, fullPage: true }).catch((e) => console.log('shot:', e.message));
await browser.close();
console.log('captured', OUT);
