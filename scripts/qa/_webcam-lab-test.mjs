// Desktop-webcam path test for autoscore-lab: fake camera + fake permission UI.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
page.on('pageerror', e => errors.push('EXC: ' + String(e).slice(0, 140)));

await page.goto('http://localhost:5601/pages/autoscore-lab.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.click('#btnStartCam');
await page.waitForTimeout(2500);

const state = await page.evaluate(() => ({
  camLog: [...document.querySelectorAll('#log div')].map(d => d.textContent).slice(0, 4),
  calibrateEnabled: !document.getElementById('btnCalibrate').disabled,
  pickerHidden: document.getElementById('camSelect').classList.contains('hidden'),
  pickerOptions: document.getElementById('camSelect').options.length,
  stageW: document.getElementById('stage').width,
  videoPlaying: (() => { const v = document.querySelector('video'); return v && !v.paused && v.videoWidth > 0; })(),
}));

// Calibrate with 4 synthetic taps (corners of a plausible board diamond) → detect button should appear
await page.click('#btnCalibrate');
await page.waitForTimeout(300);
const box = await page.locator('#stage').boundingBox();
const taps = [[0.5, 0.15], [0.85, 0.5], [0.5, 0.85], [0.15, 0.5]];
for (const [fx, fy] of taps) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);
const afterCal = await page.evaluate(() => ({
  detectVisible: !document.getElementById('btnDetect').classList.contains('hidden'),
  calSaved: (() => { try { const r = JSON.parse(localStorage.getItem('brdc:autoscore:cal:v1')); return r && r.byCam ? Object.keys(r.byCam).length : (r ? 'legacy' : 0); } catch { return 'err'; } })(),
}));

console.log(JSON.stringify({ state, afterCal, errors: [...new Set(errors)] }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
