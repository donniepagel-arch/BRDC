// Unit tests for public/js/autoscore-engine.js — run: node scripts/qa/autoscore-engine-test.mjs
// (public/js has no ESM package.json, so copy the engine to a temp .mjs for import)
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = join(here, '..', '..', 'public', 'js', 'autoscore-engine.js');
const tempEngine = join(mkdtempSync(join(tmpdir(), 'autoscore-')), 'autoscore-engine.mjs');
copyFileSync(enginePath, tempEngine);
const {
    SEGMENT_ORDER, BOARD_RADII, CAL_TARGETS,
    scoreFromBoardPoint, computeHomography, applyHomography, calibrate,
    scoreFromImagePoint, toGray, diffMask, denoiseMask, findBlobs, findDartTip,
    createDetector
} = await import(pathToFileURL(tempEngine).href);

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
    if (cond) { pass++; }
    else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 1. Polar scoring: every segment x every ring ────────────────────────────
const ringSamples = [
    { r: 50,    mult: 1, ringName: 'inner single' },
    { r: 103,   mult: 3, ringName: 'triple' },
    { r: 130,   mult: 1, ringName: 'outer single' },
    { r: 166,   mult: 2, ringName: 'double' }
];
for (let i = 0; i < 20; i++) {
    const segment = SEGMENT_ORDER[i];
    const deg = i * 18; // wedge centers: 20 at 0°, then every 18° clockwise
    const rad = deg * Math.PI / 180;
    for (const { r, mult, ringName } of ringSamples) {
        // clockwise from up, +y down: x = r sin θ, y = -r cos θ
        const x = r * Math.sin(rad), y = -r * Math.cos(rad);
        const res = scoreFromBoardPoint(x, y);
        check(`seg ${segment} ${ringName}`,
            res.segment === segment && res.multiplier === mult && res.score === segment * mult,
            `got ${res.label}=${res.score}, want ${mult}x${segment}`);
    }
}

// Wedge boundaries: 1° either side of the 20/1 border (at +9° from top)
{
    const a = scoreFromBoardPoint(100 * Math.sin(8 * Math.PI / 180), -100 * Math.cos(8 * Math.PI / 180));
    const b = scoreFromBoardPoint(100 * Math.sin(10 * Math.PI / 180), -100 * Math.cos(10 * Math.PI / 180));
    check('boundary 20 side', a.segment === 20, `got ${a.segment}`);
    check('boundary 1 side', b.segment === 1, `got ${b.segment}`);
}

// Bulls + miss + ring radii edges
check('double bull', scoreFromBoardPoint(0, 3).score === 50);
check('single bull', scoreFromBoardPoint(10, 0).score === 25);
check('sb->single edge', scoreFromBoardPoint(0, -20).ring === 'S');
check('miss outside 170', scoreFromBoardPoint(0, -171).score === 0);
check('double outer edge in', scoreFromBoardPoint(0, -169.9).multiplier === 2);
check('triple inner edge', scoreFromBoardPoint(0, -99.5).multiplier === 3);
check('triple outer edge', scoreFromBoardPoint(0, -106.5).multiplier === 3);
check('between rings single', scoreFromBoardPoint(0, -120).multiplier === 1);

// Known checkouts sanity: T20 = 60 at top, D16 location
{
    const t20 = scoreFromBoardPoint(0, -103);
    check('T20 = 60', t20.score === 60 && t20.label === 'T20', t20.label);
    // 16 is at index of SEGMENT_ORDER: find it
    const idx16 = SEGMENT_ORDER.indexOf(16);
    const rad = idx16 * 18 * Math.PI / 180;
    const d16 = scoreFromBoardPoint(166 * Math.sin(rad), -166 * Math.cos(rad));
    check('D16 = 32', d16.score === 32 && d16.label === 'D16', d16.label);
}

// ── 2. Homography: synthetic camera projection round-trip ───────────────────
{
    // A plausible oblique camera: rotate, scale, translate + mild projective terms
    const T = [320 + 1.8 * Math.cos(0.3), -1.8 * Math.sin(0.3), 0,
               240 + 0, 0, 0, 0, 0, 0];
    const project = (p) => {
        const px = 1.8 * (p.x * Math.cos(0.3) - p.y * Math.sin(0.3)) + 320;
        const py = 1.5 * (p.x * Math.sin(0.3) + p.y * Math.cos(0.3)) + 240;
        const w = 1 + 0.0004 * p.x + 0.0002 * p.y;
        return { x: px / w, y: py / w };
    };
    const imagePts = CAL_TARGETS.map(t => project({ x: t.x, y: t.y }));
    const { H, inverse } = calibrate(imagePts);

    // Calibration points themselves must map exactly
    for (let i = 0; i < 4; i++) {
        const m = applyHomography(H, imagePts[i]);
        check(`cal pt ${i} roundtrip`, Math.hypot(m.x - CAL_TARGETS[i].x, m.y - CAL_TARGETS[i].y) < 0.01,
            `err ${Math.hypot(m.x - CAL_TARGETS[i].x, m.y - CAL_TARGETS[i].y).toFixed(3)}mm`);
    }
    // Sample interior points: project with the SAME camera, unproject via H — must land within tolerance.
    // (A projective camera viewing a plane IS a homography, so this should be near-exact.)
    const samples = [
        { x: 0, y: -103 },   // T20
        { x: 80, y: 60 },    // somewhere lower right
        { x: -120, y: -40 },
        { x: 0, y: 0 }       // bull
    ];
    for (const s of samples) {
        const img = project(s);
        const back = applyHomography(H, img);
        const err = Math.hypot(back.x - s.x, back.y - s.y);
        check(`interior pt (${s.x},${s.y}) maps back`, err < 0.05, `err ${err.toFixed(3)}mm`);
    }
    // Inverse maps board → image (overlay drawing)
    const fwd = applyHomography(inverse, { x: 0, y: -170 });
    check('inverse maps cal target to image pt',
        Math.hypot(fwd.x - imagePts[0].x, fwd.y - imagePts[0].y) < 0.01);
    // Full chain: image px of a simulated T20 dart scores 60
    const t20img = project({ x: 0, y: -103 });
    const scored = scoreFromImagePoint(H, t20img);
    check('image-space T20 scores 60', scored.score === 60 && scored.label === 'T20', scored.label);

    // Degenerate calibration must throw
    let threw = false;
    try { computeHomography([{x:0,y:0},{x:1,y:1},{x:2,y:2},{x:3,y:3}], CAL_TARGETS.map(t=>({x:t.x,y:t.y}))); }
    catch { threw = true; }
    check('degenerate (collinear) calibration throws', threw);
}

// ── 3. Blob extraction + tip detection on synthetic masks ──────────────────
function blankMask(w, h) { return new Uint8Array(w * h); }
function drawDart(mask, w, x0, y0, x1, y1, tipWidth, flightWidth) {
    // thick line from tip (x0,y0,width tipWidth) to flight (x1,y1,width flightWidth)
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
        const half = (tipWidth + (flightWidth - tipWidth) * t) / 2;
        for (let dy = -Math.ceil(half); dy <= Math.ceil(half); dy++) {
            for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
                if (dx * dx + dy * dy <= half * half) {
                    const px = Math.round(cx + dx), py = Math.round(cy + dy);
                    if (px >= 0 && py >= 0 && px < w && py < mask.length / w) mask[py * w + px] = 1;
                }
            }
        }
    }
}
{
    const w = 320, h = 240;
    const mask = blankMask(w, h);
    // Dart: tip at (100,80), flight at (160,150); tip thin (2px), flight wide (10px)
    drawDart(mask, w, 100, 80, 160, 150, 2, 10);
    const blobs = findBlobs(mask, w, h, 12);
    check('one blob found', blobs.length === 1, `got ${blobs.length}`);
    const tip = findDartTip(blobs[0], w);
    const tipErr = Math.hypot(tip.x - 100, tip.y - 80);
    check('tip at thin end (within 6px)', tipErr < 6, `err ${tipErr.toFixed(1)}px at (${tip.x},${tip.y})`);
    check('tip confidence > 0.3', tip.confidence > 0.3, `conf ${tip.confidence.toFixed(2)}`);

    // Flipped orientation: flight upper-left, tip lower-right
    const mask2 = blankMask(w, h);
    drawDart(mask2, w, 220, 180, 150, 100, 2, 11);
    const blobs2 = findBlobs(mask2, w, h, 12);
    const tip2 = findDartTip(blobs2[0], w);
    const tipErr2 = Math.hypot(tip2.x - 220, tip2.y - 180);
    check('flipped tip detected (within 6px)', tipErr2 < 6, `err ${tipErr2.toFixed(1)}px`);

    // Two blobs → largest first
    const mask3 = blankMask(w, h);
    drawDart(mask3, w, 50, 50, 90, 90, 2, 8);
    mask3[10 * w + 10] = 1; mask3[10 * w + 11] = 1; // 2px noise, under minArea
    const blobs3 = findBlobs(mask3, w, h, 12);
    check('noise below minArea dropped', blobs3.length === 1, `got ${blobs3.length}`);

    // Denoise kills isolated speckle, keeps the dart
    const noisy = mask.slice();
    for (let i = 0; i < 200; i++) noisy[(i * 379) % noisy.length] = 1;
    const clean = denoiseMask(noisy, w, h);
    const cleanBlobs = findBlobs(clean, w, h, 12);
    check('denoise leaves the dart', cleanBlobs.length >= 1 && cleanBlobs[0].area > 100,
        `blobs ${cleanBlobs.length}`);
}

// ── 4. toGray + diffMask ────────────────────────────────────────────────────
{
    const w = 4, h = 1;
    const rgba = new Uint8ClampedArray([255,255,255,255, 0,0,0,255, 255,0,0,255, 0,255,0,255]);
    const g = toGray(rgba, w, h);
    check('gray white=255ish', g[0] > 250);
    check('gray black=0', g[1] === 0);
    check('gray red≈76', Math.abs(g[2] - 76) <= 2, `${g[2]}`);
    const g2 = g.slice(); g2[0] = 100;
    const { changed } = diffMask(g, g2, 28);
    check('diff finds 1 changed px', changed === 1, `${changed}`);
}

// ── 5. Detector state machine: full simulated turn ──────────────────────────
{
    const w = 320, h = 240;
    const mkFrame = (drawFns = []) => {
        // background: gradient texture
        const g = new Uint8Array(w * h);
        for (let i = 0; i < g.length; i++) g[i] = 60 + ((i % w) / w) * 80;
        for (const fn of drawFns) fn(g);
        return g;
    };
    const dartPatch = (x0, y0, x1, y1, tipW, flW) => (g) => {
        const m = blankMask(w, h);
        drawDart(m, w, x0, y0, x1, y1, tipW, flW);
        for (let i = 0; i < m.length; i++) if (m[i]) g[i] = 230; // bright dart
    };
    const handPatch = () => (g) => {
        for (let y = 40; y < 200; y++) for (let x = 60; x < 260; x++) g[y * w + x] = 200;
    };

    const det = createDetector({ w, h });
    const events = [];
    const feed = (frame, times = 1) => { for (let i = 0; i < times; i++) events.push(...det.push(frame)); };

    const bg = mkFrame();
    feed(bg, 4);                        // settle baseline
    check('detector READY after settle', det.state === 'READY');

    feed(mkFrame([handPatch()]), 3);    // player steps in
    check('detector MOTION on hand', det.state === 'MOTION');

    const with1 = mkFrame([dartPatch(120, 90, 170, 150, 2, 9)]);
    feed(with1, 5);                     // hand leaves, dart 1 on board
    const dart1 = events.filter(e => e.type === 'dart');
    check('dart 1 detected', dart1.length === 1, `got ${dart1.length}`);
    if (dart1.length === 1) {
        const err = Math.hypot(dart1[0].tip.x - 120, dart1[0].tip.y - 90);
        check('dart 1 tip located (within 7px)', err < 7, `err ${err.toFixed(1)}`);
    }

    const with2 = mkFrame([dartPatch(120, 90, 170, 150, 2, 9), dartPatch(200, 60, 240, 130, 2, 9)]);
    feed(mkFrame([handPatch()]), 2);    // (simulated throw motion)
    feed(with2, 5);
    const dartsNow = events.filter(e => e.type === 'dart');
    check('dart 2 detected', dartsNow.length === 2, `got ${dartsNow.length}`);
    if (dartsNow.length === 2) {
        const err = Math.hypot(dartsNow[1].tip.x - 200, dartsNow[1].tip.y - 60);
        check('dart 2 tip located (within 7px)', err < 7, `err ${err.toFixed(1)}`);
    }

    feed(mkFrame([handPatch()]), 3);    // player pulls darts
    feed(bg, 5);                        // board back to empty
    check('turn reset after pull', events.some(e => e.type === 'turn-reset'));
    check('darts count reset', det.dartsThisTurn === 0, `${det.dartsThisTurn}`);
}

// ── 5b. Regression: SMALL dart must not trigger a false turn-reset ─────────
// (Bug found in browser e2e: dart footprint under an absolute frame fraction
//  made the "back to turn-start" check fire right after every dart.)
{
    const w = 320, h = 240;
    const mkFrame = (drawFns = []) => {
        const g = new Uint8Array(w * h);
        for (let i = 0; i < g.length; i++) g[i] = 60 + ((i % w) / w) * 80;
        for (const fn of drawFns) fn(g);
        return g;
    };
    const smallDart = (g) => {
        const m = blankMask(w, h);
        drawDart(m, w, 150, 110, 175, 135, 2, 6); // tiny: ~35px line, max 6px wide
        for (let i = 0; i < m.length; i++) if (m[i]) g[i] = 230;
    };
    const det = createDetector({ w, h });
    const events = [];
    const feed = (frame, times = 1) => { for (let i = 0; i < times; i++) events.push(...det.push(frame)); };
    feed(mkFrame(), 4);
    feed(mkFrame([smallDart]), 10); // dart lands, then many calm frames
    const dartEvents = events.filter(e => e.type === 'dart');
    const resets = events.filter(e => e.type === 'turn-reset');
    check('small dart detected', dartEvents.length === 1, `got ${dartEvents.length}`);
    check('NO false turn-reset after small dart', resets.length === 0, `got ${resets.length} resets`);
    check('dart count persists', det.dartsThisTurn === 1, `${det.dartsThisTurn}`);
    feed(mkFrame(), 6); // dart actually pulled → reset SHOULD fire
    check('real pull still resets', events.some(e => e.type === 'turn-reset'));
}

// ── 5c. One-frame glint must NOT mint a dart (confirmFrames persistence) ───
{
    const w = 320, h = 240;
    const mkFrame = (drawFns = []) => {
        const g = new Uint8Array(w * h);
        for (let i = 0; i < g.length; i++) g[i] = 60 + ((i % w) / w) * 80;
        for (const fn of drawFns) fn(g);
        return g;
    };
    const glint = (g) => {
        const m = blankMask(w, h);
        drawDart(m, w, 150, 110, 185, 145, 3, 8); // dart-sized bright flash
        for (let i = 0; i < m.length; i++) if (m[i]) g[i] = 240;
    };
    const det = createDetector({ w, h });
    const events = [];
    const feed = (frame, times = 1) => { for (let i = 0; i < times; i++) events.push(...det.push(frame)); };
    const bg = mkFrame();
    feed(bg, 4);
    feed(mkFrame([glint]), 1);  // single-frame reflection
    feed(bg, 8);                // gone next frame
    const darts = events.filter(e => e.type === 'dart');
    check('one-frame glint rejected', darts.length === 0, `got ${darts.length} darts`);
    check('no phantom dart on glint revert', events.every(e => e.type !== 'dart'));
    // A REAL dart (persists) must still be detected afterward
    feed(mkFrame([(g) => {
        const m = blankMask(w, h);
        drawDart(m, w, 100, 80, 150, 140, 2, 9);
        for (let i = 0; i < m.length; i++) if (m[i]) g[i] = 230;
    }]), 5);
    check('real dart after glint still detected',
        events.filter(e => e.type === 'dart').length === 1,
        `got ${events.filter(e => e.type === 'dart').length}`);
}

// ── 5d. MOTION deadlock escape: stale baseline (AE shift / bump) recovers ──
{
    const w = 320, h = 240;
    const mkFrame = (shift = 0, drawFns = []) => {
        const g = new Uint8Array(w * h);
        for (let i = 0; i < g.length; i++) g[i] = Math.min(255, 60 + ((i % w) / w) * 80 + shift);
        for (const fn of drawFns) fn(g);
        return g;
    };
    const det = createDetector({ w, h });
    const events = [];
    const feed = (frame, times = 1) => { for (let i = 0; i < times; i++) events.push(...det.push(frame)); };
    feed(mkFrame(0), 4);                 // baseline at exposure A
    check('deadlock test: READY at exposure A', det.state === 'READY');
    feed(mkFrame(45), 20);               // global exposure shift: static scene, far from baseline
    check('rebaseline fired on static stale-baseline MOTION',
        events.some(e => e.type === 'rebaseline'),
        `events: ${events.map(e => e.type).join(',') || 'none'}`);
    check('detector READY after rebaseline', det.state === 'READY', det.state);
    // Detection still works on the new exposure
    feed(mkFrame(45, [(g) => {
        const m = blankMask(w, h);
        drawDart(m, w, 120, 90, 170, 150, 2, 9);
        for (let i = 0; i < m.length; i++) if (m[i]) g[i] = 230;
    }]), 5);
    check('dart detected after rebaseline',
        events.filter(e => e.type === 'dart').length === 1,
        `got ${events.filter(e => e.type === 'dart').length}`);
    // Sanity: a moving player (changing frames) must NOT trigger rebaseline
    const det2 = createDetector({ w, h });
    const ev2 = [];
    for (let i = 0; i < 4; i++) ev2.push(...det2.push(mkFrame(0)));
    for (let i = 0; i < 25; i++) {
        // hand region wiggles each frame → frame-to-frame NOT static
        ev2.push(...det2.push(mkFrame(0, [(g) => {
            for (let y = 40 + (i % 3) * 4; y < 200; y++) for (let x = 60; x < 260; x++) g[y * w + x] = 200;
        }])));
    }
    check('moving player never rebaselines', ev2.every(e => e.type !== 'rebaseline'),
        `events: ${ev2.map(e => e.type).join(',')}`);
}

// ── Results ─────────────────────────────────────────────────────────────────
console.log(`\nAUTOSCORE ENGINE TESTS: ${pass} passed, ${fail} failed`);
if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  ✗ ' + f);
    process.exit(1);
}
