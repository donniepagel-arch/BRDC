// Registration-refine dev harness: autoCalibrate -> refineCalibration against the
// REAL frame (_snap-fresh.jpg). Draws BEFORE (red) vs AFTER (cyan) wireframes.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const anchor = { x: Number(process.argv[2] || 700), y: Number(process.argv[3] || 160) };
const frame = process.argv[4] || '_snap-fresh.jpg';
const regWeight = process.argv[5] != null ? Number(process.argv[5]) : 0.12;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto('http://localhost:5601/pages/autoscore-lab.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

const result = await page.evaluate(async ({ anchor, frame, regWeight }) => {
    const eng = await import('/js/autoscore-engine.js?v=6&t=' + Date.now());
    const img = new Image();
    img.src = '/__qa/' + frame;
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('frame 404')); });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const data = x.getImageData(0, 0, c.width, c.height);

    const out = {};
    const drawWire = (inv, stroke, lw) => {
        const rings = [15.9, 99, 107, 162, 170];
        for (const r of rings) {
            x.beginPath();
            for (let a = 0; a <= 360; a += 3) {
                const rad = a * Math.PI / 180;
                const p = eng.applyHomography(inv, { x: r * Math.sin(rad), y: -r * Math.cos(rad) });
                a === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
            }
            x.lineWidth = lw; x.strokeStyle = stroke; x.stroke();
        }
        for (let i = 0; i < 20; i++) {
            const rad = (i * 18 + 9) * Math.PI / 180;
            const a2 = eng.applyHomography(inv, { x: 15.9 * Math.sin(rad), y: -15.9 * Math.cos(rad) });
            const b2 = eng.applyHomography(inv, { x: 170 * Math.sin(rad), y: -170 * Math.cos(rad) });
            x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(b2.x, b2.y);
            x.lineWidth = lw * 0.7; x.strokeStyle = stroke; x.stroke();
        }
    };

    try {
        const auto = eng.autoCalibrate(data.data, c.width, c.height, anchor);
        out.autoResidualMm = +auto.residualMm.toFixed(2);
        // BEFORE overlay (red, faint)
        drawWire(auto.inverse, 'rgba(255,70,120,0.85)', 1.5);

        const t0 = Date.now();
        const ref = eng.refineCalibration(data.data, c.width, c.height, auto.calPoints, { targetW: 480, regWeight });
        out.refineMs = Date.now() - t0;
        out.scoreBefore = ref.scoreBefore;
        out.scoreAfter = ref.scoreAfter;
        out.gainPct = ref.gain;
        // AFTER overlay (cyan, bold, dark halo)
        drawWire(ref.inverse, 'rgba(0,0,0,0.7)', 3.5);
        drawWire(ref.inverse, '#3DEFFF', 1.8);

        // score probes via the refined H
        const probe = (mmX, mmY) => eng.scoreFromImagePoint(ref.H, eng.applyHomography(ref.inverse, { x: mmX, y: mmY })).label;
        out.probes = {
            T20: probe(0, -103), T6: probe(103, 0),
            T3: probe(0, 103), T11: probe(-103, 0),
            DBULL: probe(0, 0)
        };
    } catch (e) { out.error = String(e.message || e); }

    out.png = c.toDataURL('image/png');
    // Clean clear overlay for judging: redraw raw frame, draw AFTER rings in
    // distinct bold colors (double=cyan, triple=yellow, bull=magenta), tight crop.
    let det = null;
    try { det = eng.detectBoardEllipse(data.data, c.width, c.height); } catch {}
    if (out.scoreAfter != null) {
        const auto2 = eng.autoCalibrate(data.data, c.width, c.height, anchor);
        const ref2 = eng.refineCalibration(data.data, c.width, c.height, auto2.calPoints, { targetW: 480, regWeight });
        x.drawImage(img, 0, 0); // wipe the messy before/after combo
        const ringDraw = (r, color) => {
            x.beginPath();
            for (let a = 0; a <= 360; a += 2) {
                const rad = a * Math.PI / 180;
                const p = eng.applyHomography(ref2.inverse, { x: r * Math.sin(rad), y: -r * Math.cos(rad) });
                a === 0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y);
            }
            x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.stroke();
            x.lineWidth = 2; x.strokeStyle = color; x.stroke();
        };
        ringDraw(170, '#19E3FF'); ringDraw(162, '#19E3FF');
        ringDraw(107, '#FFE100'); ringDraw(99, '#FFE100');
        ringDraw(15.9, '#FF35D0'); ringDraw(6.35, '#FF35D0');
        for (let i = 0; i < 20; i++) {
            const rad = (i * 18 + 9) * Math.PI / 180;
            const a2 = eng.applyHomography(ref2.inverse, { x: 15.9 * Math.sin(rad), y: -15.9 * Math.cos(rad) });
            const b2 = eng.applyHomography(ref2.inverse, { x: 170 * Math.sin(rad), y: -170 * Math.cos(rad) });
            x.beginPath(); x.moveTo(a2.x, a2.y); x.lineTo(b2.x, b2.y);
            x.lineWidth = 1.3; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.stroke();
        }
    }
    let cropX = 330, cropY = 40, cropW = 420, cropH = 420;
    if (det) {
        const m = det.ellipse.a * 1.12;
        cropX = Math.max(0, det.ellipse.cx - m); cropY = Math.max(0, det.ellipse.cy - m);
        cropW = Math.min(c.width - cropX, 2 * m); cropH = Math.min(c.height - cropY, 2 * m);
    }
    const z = document.createElement('canvas'); z.width = 820; z.height = 820;
    const zx = z.getContext('2d'); zx.imageSmoothingEnabled = true; zx.imageSmoothingQuality = 'high';
    zx.drawImage(c, cropX, cropY, cropW, cropH, 0, 0, 820, 820);
    out.zoom = z.toDataURL('image/png');
    return out;
}, { anchor, frame, regWeight });

const { png, zoom, ...stats } = result;
console.log(JSON.stringify(stats, null, 1));
if (png) fs.writeFileSync(path.join(here, '_refine-result.png'), Buffer.from(png.split(',')[1], 'base64'));
if (zoom) fs.writeFileSync(path.join(here, '_refine-zoom.png'), Buffer.from(zoom.split(',')[1], 'base64'));
console.log('saved _refine-result.png + _refine-zoom.png');
await browser.close();
