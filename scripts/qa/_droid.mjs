import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let pages = ctx.pages();
// pick the burningriverdarts page (or first)
let page = pages.find(p => /burningriverdarts/.test(p.url())) || pages[0];
console.log('PAGES:', pages.map(p=>p.url().slice(0,70)));
console.log('DRIVING:', page.url().slice(0,80));
const info = await page.evaluate(async () => {
  let authed=false, email='', err='';
  try { const m = await import('/js/firebase-config.js'); await m.waitForAuthReady(5000); authed=!!m.auth.currentUser; email=(m.auth.currentUser?.email||''); } catch(e){ err=e.message?.slice(0,60)||''; }
  return { url: location.href, title: document.title, authed, email,
    vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio };
}).catch(e=>({evalErr:e.message.slice(0,80)}));
console.log('STATE:', JSON.stringify(info));
await page.screenshot({ path: 'reports/droid-home.png' }).catch(e=>console.log('shot err', e.message));
await browser.close(); // detaches CDP, does NOT close device chrome
console.log('captured reports/droid-home.png');
