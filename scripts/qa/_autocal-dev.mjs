// Auto-calibration dev harness: run the engine's autoCalibrate against the REAL
// webcam frame (scripts/qa/_snap-raw.jpg), draw the result, save a PNG to view.
// Usage: node scripts/qa/_autocal-dev.mjs [anchorX] [anchorY]
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const anchor = { x: Number(process.argv[2] || 700), y: Number(process.argv[3] || 160) };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text().slice(0, 300)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto('http://localhost:5601/pages/autoscore-lab.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

const result = await page.evaluate(async ({ anchor }) => {
    const eng = await import('/js/autoscore-engine.js?v=5');
    const img = new Image();
    img.src = '/__qa/_snap-raw.jpg';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('raw frame 404')); });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);

    const out = { w: c.width, h: c.height };
    try {
        const det = eng.detectBoardEllipse(data.data, c.width, c.height);
        out.origin = { x: Math.round(det.origin.x), y: Math.round(det.origin.y) };
        out.ellipse = { cx: Math.round(det.ellipse.cx), cy: Math.round(det.ellipse.cy), a: Math.round(det.ellipse.a), b: Math.round(det.ellipse.b), phiDeg: Math.round(det.ellipse.phi * 180 / Math.PI) };
        out.maskCount = det.maskCount;
        const trans = eng.findRingTransitions(data.data, c.width, c.height, det);
        out.transitions = trans.length;

        // diagnostic: color runs along the sampled band (angle°: color × span°)
        {
            const STEPS = 720;
            const seq = [];
            for (let i = 0; i < STEPS; i++) {
                const th = (i / STEPS) * 2 * Math.PI - Math.PI;
                const r = det.conic.radiusAt(det.origin, th);
                if (r == null) { seq.push('?'); continue; }
                let red = 0, green = 0, none = 0;
                for (const f of [0.962, 0.975, 0.988]) {
                    const sx = Math.round(det.origin.x + r * f * Math.cos(th));
                    const sy = Math.round(det.origin.y + r * f * Math.sin(th));
                    if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) { none++; continue; }
                    const p = (sy * c.width + sx) * 4;
                    const cl = eng.rgClass(data.data[p], data.data[p + 1], data.data[p + 2]);
                    if (cl === 1) red++; else if (cl === 2) green++; else none++;
                }
                seq.push(red > green ? 'R' : green > red ? 'G' : '.');
            }
            const runs = [];
            let start = 0;
            for (let i = 1; i <= STEPS; i++) {
                if (i === STEPS || seq[i] !== seq[start]) {
                    runs.push(`${Math.round(start / 2)}°${seq[start]}×${((i - start) / 2).toFixed(0)}`);
                    start = i;
                }
            }
            out.colorRuns = runs.filter(r => !r.includes('×0')).join(' ');

            // raw RGB at dead-zone angles (mid-band sample) to tune the classifier
            out.rgbProbes = {};
            for (const aDeg of [40, 100, 150, 180, 210, 240, 300]) {
                const th = (aDeg / 360) * 2 * Math.PI - Math.PI;
                const r = det.conic.radiusAt(det.origin, th);
                if (r == null) { out.rgbProbes[aDeg] = 'no-radius'; continue; }
                const vals = [];
                for (const f of [0.86, 0.90, 0.93, 0.962, 0.975]) {
                    const sx = Math.round(det.origin.x + r * f * Math.cos(th));
                    const sy = Math.round(det.origin.y + r * f * Math.sin(th));
                    const p = (sy * c.width + sx) * 4;
                    vals.push(`${data.data[p]},${data.data[p + 1]},${data.data[p + 2]}`);
                }
                out.rgbProbes[aDeg] = vals.join(' | ');
            }

            // radial class scans at dead angles: where do ring colors ACTUALLY live?
            out.radialScans = {};
            for (const aDeg of [100, 150, 180, 210, 240]) {
                const th = (aDeg / 360) * 2 * Math.PI - Math.PI;
                let s = '';
                for (let r = 60; r <= 280; r += 5) {
                    const sx = Math.round(det.origin.x + r * Math.cos(th));
                    const sy = Math.round(det.origin.y + r * Math.sin(th));
                    if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) { s += ' '; continue; }
                    const p = (sy * c.width + sx) * 4;
                    const cl = eng.rgClass(data.data[p], data.data[p + 1], data.data[p + 2]);
                    s += cl === 1 ? 'R' : cl === 2 ? 'G' : '.';
                }
                const rFit = det.conic.radiusAt(det.origin, th);
                out.radialScans[aDeg] = `${s}  fit=${rFit ? Math.round(rFit) : '?'}px (r60→280 step5)`;
            }

            // boundary points the fit consumed, by 30° sector: n + mean radius
            const sectors = {};
            for (const p of det.boundaryPts) {
                const th = Math.atan2(p.y - det.origin.y, p.x - det.origin.x);
                const sec = Math.floor(((th + Math.PI) / (2 * Math.PI)) * 12) * 30;
                const r = Math.hypot(p.x - det.origin.x, p.y - det.origin.y);
                (sectors[sec] = sectors[sec] || []).push(r);
            }
            out.boundarySectors = Object.fromEntries(Object.entries(sectors).map(([k, v]) =>
                [k, `n=${v.length} r̄=${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}`]));

            // inspect the phantom boundary points on the right side: position + RGB
            out.phantoms = det.boundaryPts
                .map(p => {
                    const th = Math.atan2(p.y - det.origin.y, p.x - det.origin.x);
                    const deg = Math.round(((th + Math.PI) / (2 * Math.PI)) * 360);
                    const r = Math.round(Math.hypot(p.x - det.origin.x, p.y - det.origin.y));
                    const px = (p.y * c.width + p.x) * 4;
                    return { deg, r, x: p.x, y: p.y, rgb: `${data.data[px]},${data.data[px + 1]},${data.data[px + 2]}` };
                })
                .filter(p => p.deg >= 140 && p.deg <= 250 && p.r > 190)
                .slice(0, 14);
        }

        const cal = eng.autoCalibrate(data.data, c.width, c.height, anchor);
        out.residualMm = +cal.residualMm.toFixed(2);
        out.nPoints = cal.nPoints;

        // sanity scores: probe where T20 / D-bull / T19 SHOULD be via inverse, then score them back
        const probe = (mmX, mmY) => {
            const ip = eng.applyHomography(cal.inverse, { x: mmX, y: mmY });
            return eng.scoreFromImagePoint(cal.H, ip).label;
        };
        out.probes = { T20: probe(0, -103), DBULL: probe(0, 2), T19_at: probe(103 * Math.sin(198 * Math.PI / 180), -103 * Math.cos(198 * Math.PI / 180)) };

        // draw verification overlay
        const rings = [170, 162, 107, 99, 15.9];
        for (const r of rings) {
            x.beginPath();
            for (let a = 0; a <= 360; a += 3) {
                const rad = a * Math.PI / 180;
                const p = eng.applyHomography(cal.inverse, { x: r * Math.sin(rad), y: -r * Math.cos(rad) });
                a === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
            }
            x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.8)'; x.stroke();
            x.lineWidth = 2; x.strokeStyle = '#3DEFFF'; x.stroke();
        }
        for (let i = 0; i < 20; i++) {
            const rad = (i * 18 + 9) * Math.PI / 180;
            const a2 = eng.applyHomography(cal.inverse, { x: 15.9 * Math.sin(rad), y: -15.9 * Math.cos(rad) });
            const b2 = eng.applyHomography(cal.inverse, { x: 170 * Math.sin(rad), y: -170 * Math.cos(rad) });
            x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(b2.x, b2.y);
            x.lineWidth = 1.5; x.strokeStyle = 'rgba(61,239,255,0.65)'; x.stroke();
        }
        // label wedge 20 center + anchor
        const w20 = eng.applyHomography(cal.inverse, { x: 0, y: -135 });
        x.fillStyle = '#FFC928'; x.font = 'bold 26px Inter'; x.fillText('20', w20.x - 12, w20.y);
        x.beginPath(); x.arc(anchor.x, anchor.y, 8, 0, 7); x.fillStyle = '#FF469A'; x.fill();
        out.png = c.toDataURL('image/png');
        // zoomed crop of the board for ring-hug inspection
        {
            const E2 = det.ellipse;
            const pad = E2.a + 40;
            const zc = document.createElement('canvas');
            const sz = Math.min(2 * pad, 700);
            zc.width = 1000; zc.height = 1000;
            zc.getContext('2d').drawImage(c, E2.cx - pad, E2.cy - pad, 2 * pad, 2 * pad, 0, 0, 1000, 1000);
            out.zoomPng = zc.toDataURL('image/png');
        }
    } catch (e) {
        out.error = String(e.message || e);
        // still draw what we have: mask boundary points if any
        try {
            const det2 = eng.detectBoardEllipse(data.data, c.width, c.height);
            x.fillStyle = '#FF469A';
            for (const p of det2.boundaryPts) { x.fillRect(p.x - 1, p.y - 1, 3, 3); }
        } catch {}
        out.png = c.toDataURL('image/png');
    }
    return out;
}, { anchor });

const { png, zoomPng, ...stats } = result;
console.log(JSON.stringify(stats, null, 1));
const fs = await import('fs');
if (png) {
    fs.writeFileSync(path.join(here, '_autocal-result.png'), Buffer.from(png.split(',')[1], 'base64'));
    console.log('overlay saved -> scripts/qa/_autocal-result.png');
}
if (zoomPng) {
    fs.writeFileSync(path.join(here, '_autocal-zoom.png'), Buffer.from(zoomPng.split(',')[1], 'base64'));
    console.log('zoom saved -> scripts/qa/_autocal-zoom.png');
}
await browser.close();
