// BRDC Auto-Score Engine — computer-vision dart detection + scoring
// Pure module: no DOM dependencies. Runs in browser (ES module) and Node (tests).
//
// Pipeline:
//   1. CALIBRATE — 4 tapped landmarks on the double-ring outer edge → homography
//      from camera pixels to canonical board millimeters.
//   2. DETECT — frame differencing against a settled baseline; blob extraction;
//      tip located at the thin end of the blob's principal axis.
//   3. SCORE — canonical mm point → polar → segment/ring per official board geometry.
//
// Official board geometry (mm, measured from center):
//   double bull r<=6.35 | single bull r<=15.9 | triple ring 99..107
//   double ring 162..170 | scoring edge 170

// ── Board geometry ──────────────────────────────────────────────────────────

// Segment order clockwise from the top (20 wedge centered at 12 o'clock)
export const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const BOARD_RADII = {
    doubleBull: 6.35,
    singleBull: 15.9,
    tripleInner: 99,
    tripleOuter: 107,
    doubleInner: 162,
    doubleOuter: 170
};

// Canonical calibration landmarks: OUTER edge of the double ring at the center
// of 4 wedges — top of 20, right of 6, bottom of 3, left of 11.
// Canonical space: +x right, +y DOWN (image convention), origin at bull center.
export const CAL_TARGETS = [
    { label: 'Top of 20 (double ring outer edge)',   x: 0,    y: -170 },
    { label: 'Right of 6 (double ring outer edge)',  x: 170,  y: 0 },
    { label: 'Bottom of 3 (double ring outer edge)', x: 0,    y: 170 },
    { label: 'Left of 11 (double ring outer edge)',  x: -170, y: 0 }
];

/**
 * Score a point in canonical board space (mm, +y down, origin at bull).
 * Returns { score, segment, multiplier, ring, label }.
 */
export function scoreFromBoardPoint(x, y) {
    const r = Math.hypot(x, y);
    if (r <= BOARD_RADII.doubleBull) {
        return { score: 50, segment: 25, multiplier: 2, ring: 'DB', label: 'D-BULL' };
    }
    if (r <= BOARD_RADII.singleBull) {
        return { score: 25, segment: 25, multiplier: 1, ring: 'SB', label: 'S-BULL' };
    }
    if (r > BOARD_RADII.doubleOuter) {
        return { score: 0, segment: 0, multiplier: 0, ring: 'MISS', label: 'MISS' };
    }
    // Clockwise angle from straight up: up=0°, right=90°, down=180°, left=270°.
    // +y is DOWN, so "up" is -y → atan2(x, -y).
    let deg = Math.atan2(x, -y) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    const idx = Math.floor(((deg + 9) % 360) / 18);
    const segment = SEGMENT_ORDER[idx];

    let multiplier = 1, ring = 'S';
    if (r >= BOARD_RADII.tripleInner && r <= BOARD_RADII.tripleOuter) { multiplier = 3; ring = 'T'; }
    else if (r >= BOARD_RADII.doubleInner) { multiplier = 2; ring = 'D'; }

    return {
        score: segment * multiplier,
        segment,
        multiplier,
        ring,
        label: `${ring}${segment}`
    };
}

// ── Homography (4-point DLT) ────────────────────────────────────────────────

/**
 * Solve a homography H (3x3, h33=1) mapping srcPts[i] -> dstPts[i].
 * Exactly 4 correspondences. Points are {x,y}. Returns row-major 9-array.
 */
export function computeHomography(srcPts, dstPts) {
    if (srcPts.length !== 4 || dstPts.length !== 4) {
        throw new Error('computeHomography needs exactly 4 point pairs');
    }
    // 8 unknowns h11..h32. For each pair (x,y)->(u,v):
    //   u = (h11 x + h12 y + h13) / (h31 x + h32 y + 1)
    //   v = (h21 x + h22 y + h23) / (h31 x + h32 y + 1)
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
        const { x, y } = srcPts[i];
        const { x: u, y: v } = dstPts[i];
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (const p of [...srcPts, ...dstPts]) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            throw new Error('Calibration point is not a finite coordinate');
        }
    }
    const h = solveLinearSystem(A, b);
    if (!h || h.some(v => !Number.isFinite(v))) {
        throw new Error('Calibration points are degenerate (collinear or repeated)');
    }
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Gaussian elimination with partial pivoting. A: n x n rows, b: n. */
function solveLinearSystem(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++) {
            if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        }
        if (Math.abs(M[pivot][col]) < 1e-12) return null;
        [M[col], M[pivot]] = [M[pivot], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const f = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

/** Apply homography (row-major 9-array) to a point {x,y}. */
export function applyHomography(H, pt) {
    const w = H[6] * pt.x + H[7] * pt.y + H[8];
    return {
        x: (H[0] * pt.x + H[1] * pt.y + H[2]) / w,
        y: (H[3] * pt.x + H[4] * pt.y + H[5]) / w
    };
}

/** Convenience: camera-pixel point → score, given calibration homography. */
export function scoreFromImagePoint(H, pt) {
    const board = applyHomography(H, pt);
    return { ...scoreFromBoardPoint(board.x, board.y), boardX: board.x, boardY: board.y };
}

/**
 * Build calibration from 4 tapped image points, in CAL_TARGETS order.
 * Returns { H, inverse } (inverse maps board mm → image px, for overlays).
 */
export function calibrate(imagePts) {
    const H = computeHomography(imagePts, CAL_TARGETS.map(t => ({ x: t.x, y: t.y })));
    const inverse = computeHomography(CAL_TARGETS.map(t => ({ x: t.x, y: t.y })), imagePts);
    return { H, inverse };
}

// ── Frame differencing + blob extraction ────────────────────────────────────

/**
 * Grayscale a frame. data = RGBA Uint8ClampedArray. Returns Uint8Array w*h.
 */
export function toGray(data, w, h) {
    const g = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
        g[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    }
    return g;
}

/**
 * Binary diff mask between two grayscale frames.
 * Returns { mask: Uint8Array(0|1), changed: count }.
 */
export function diffMask(grayA, grayB, threshold = 28) {
    const n = grayA.length;
    const mask = new Uint8Array(n);
    let changed = 0;
    for (let i = 0; i < n; i++) {
        if (Math.abs(grayA[i] - grayB[i]) > threshold) { mask[i] = 1; changed++; }
    }
    return { mask, changed };
}

/** 3x3 majority filter to knock out salt noise in a binary mask (in place safe copy). */
export function denoiseMask(mask, w, h) {
    const out = new Uint8Array(mask.length);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!mask[i]) continue;
            let n = 0;
            n += mask[i - 1] + mask[i + 1] + mask[i - w] + mask[i + w];
            n += mask[i - w - 1] + mask[i - w + 1] + mask[i + w - 1] + mask[i + w + 1];
            if (n >= 2) out[i] = 1;
        }
    }
    return out;
}

/**
 * Connected components (4-connectivity) over a binary mask.
 * Returns array of blobs: { area, minX, minY, maxX, maxY, cx, cy, pixels:[i...] }.
 * Blobs under minArea are dropped. pixels capped at 20000 per blob for perf.
 */
export function findBlobs(mask, w, h, minArea = 12) {
    const labels = new Int32Array(mask.length); // 0 = unvisited
    const blobs = [];
    const stack = [];
    let nextLabel = 1;

    for (let start = 0; start < mask.length; start++) {
        if (!mask[start] || labels[start]) continue;
        const label = nextLabel++;
        let area = 0, sx = 0, sy = 0;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        const pixels = [];
        stack.length = 0;
        stack.push(start);
        labels[start] = label;
        while (stack.length) {
            const i = stack.pop();
            const x = i % w, y = (i / w) | 0;
            area++; sx += x; sy += y;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (pixels.length < 20000) pixels.push(i);
            if (x > 0 && mask[i - 1] && !labels[i - 1]) { labels[i - 1] = label; stack.push(i - 1); }
            if (x < w - 1 && mask[i + 1] && !labels[i + 1]) { labels[i + 1] = label; stack.push(i + 1); }
            if (y > 0 && mask[i - w] && !labels[i - w]) { labels[i - w] = label; stack.push(i - w); }
            if (y < h - 1 && mask[i + w] && !labels[i + w]) { labels[i + w] = label; stack.push(i + w); }
        }
        if (area >= minArea) {
            blobs.push({ area, minX, minY, maxX, maxY, cx: sx / area, cy: sy / area, pixels });
        }
    }
    blobs.sort((a, b) => b.area - a.area);
    return blobs;
}

// ── Dart tip detection ──────────────────────────────────────────────────────

/**
 * Locate the dart tip within a blob: PCA principal axis, then the END with the
 * narrower perpendicular spread is the tip (flights/barrel are the wide end).
 * Returns { x, y, axis, confidence } in mask pixel coords.
 */
export function findDartTip(blob, w) {
    const pts = blob.pixels.map(i => ({ x: i % w, y: (i / w) | 0 }));
    const n = pts.length;
    if (n < 5) return { x: blob.cx, y: blob.cy, axis: null, confidence: 0 };

    // PCA via 2x2 covariance
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) {
        const dx = p.x - blob.cx, dy = p.y - blob.cy;
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    sxx /= n; syy /= n; sxy /= n;
    const trace = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const l1 = trace / 2 + Math.sqrt(Math.max(0, trace * trace / 4 - det));
    const l2 = trace / 2 - Math.sqrt(Math.max(0, trace * trace / 4 - det));
    let ux, uy;
    if (Math.abs(sxy) > 1e-9) { ux = l1 - syy; uy = sxy; }
    else if (sxx >= syy) { ux = 1; uy = 0; }
    else { ux = 0; uy = 1; }
    const norm = Math.hypot(ux, uy) || 1;
    ux /= norm; uy /= norm;

    // Project onto axis; measure perpendicular spread in the outer 18% at each end
    let tMin = Infinity, tMax = -Infinity;
    const proj = new Float64Array(n), perp = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const dx = pts[i].x - blob.cx, dy = pts[i].y - blob.cy;
        proj[i] = dx * ux + dy * uy;
        perp[i] = -dx * uy + dy * ux;
        if (proj[i] < tMin) tMin = proj[i];
        if (proj[i] > tMax) tMax = proj[i];
    }
    const span = tMax - tMin;
    if (span < 4) return { x: blob.cx, y: blob.cy, axis: { ux, uy }, confidence: 0.2 };
    const cut = span * 0.18;

    let wA = 0, nA = 0, wB = 0, nB = 0;
    let extA = { t: -Infinity, x: 0, y: 0 }, extB = { t: Infinity, x: 0, y: 0 };
    for (let i = 0; i < n; i++) {
        if (proj[i] > tMax - cut) {
            wA += perp[i] * perp[i]; nA++;
            if (proj[i] > extA.t) extA = { t: proj[i], x: pts[i].x, y: pts[i].y };
        } else if (proj[i] < tMin + cut) {
            wB += perp[i] * perp[i]; nB++;
            if (proj[i] < extB.t) extB = { t: proj[i], x: pts[i].x, y: pts[i].y };
        }
    }
    const spreadA = nA ? Math.sqrt(wA / nA) : 0;
    const spreadB = nB ? Math.sqrt(wB / nB) : 0;
    const tip = spreadA <= spreadB ? extA : extB;
    // Confidence: elongation x how decisively one end is thinner
    const elong = l2 > 1e-9 ? Math.min(1, (l1 / l2) / 12) : 1;
    const asym = (Math.max(spreadA, spreadB) > 1e-9)
        ? Math.abs(spreadA - spreadB) / Math.max(spreadA, spreadB) : 0;
    return { x: tip.x, y: tip.y, axis: { ux, uy }, confidence: Math.max(0.1, Math.min(1, 0.4 * elong + 0.6 * asym)) };
}

// ── Auto-calibration: the board finds itself ────────────────────────────────
// The double + treble rings are saturated red/green — the strongest visual
// signal on any tournament board. Pipeline:
//   1. rgMask        — classify red/green pixels
//   2. findBullSeed  — compact red blob near the mask centroid = sweep origin
//   3. trace + fitConic — outermost red/green per angular ray = the double-ring
//      outer edge; least-squares conic through it (outlier-trimmed)
//   4. findRingTransitions — sample colors just inside the double band; each
//      red↔green flip is a wire crossing at a KNOWN canonical angle (9°+k·18°)
//   5. autoCalibrate — anchor rotation with ONE user tap inside the 20 wedge,
//      assign all ~20 crossings, solve an overdetermined homography.
// Result: sub-wedge accuracy without asking a human to tap ring edges.

/**
 * Classify a pixel: 1 = board red, 2 = board green, 0 = neither.
 * Margin-based with a luminance-scaled floor: a channel must BEAT the others by
 * an absolute margin, so near-black pixels with a faint color tint (the rubber
 * surround under colored spill — the classic phantom source) never qualify,
 * while washed-out ring colors under bright light still do.
 */
export function rgClass(r, g, b) {
    const lum = (r + g + b) / 3;
    if (r > 105 && r - Math.max(g, b) > Math.max(26, 0.24 * lum)) return 1;
    if (g > 60 && g - Math.max(r, b) > Math.max(18, 0.20 * lum)) return 2;
    return 0;
}

/** Red/green mask over an RGBA frame. Returns Uint8Array of 0|1|2. */
export function rgMask(data, w, h) {
    const m = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
        m[i] = rgClass(data[p], data[p + 1], data[p + 2]);
    }
    return m;
}

/**
 * Sweep origin for boundary tracing: centroid of a compact red blob nearest the
 * overall mask centroid (the bull). Falls back to the mask centroid.
 */
export function findBullSeed(mask, w, h) {
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) { sx += i % w; sy += (i / w) | 0; n++; }
    }
    if (!n) return null;
    const cx = sx / n, cy = sy / n;

    // red components, small + roundish, nearest centroid
    const redOnly = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) redOnly[i] = mask[i] === 1 ? 1 : 0;
    const blobs = findBlobs(redOnly, w, h, 4);
    let best = null, bestD = Infinity;
    const maxArea = w * h * 0.004;
    for (const b of blobs) {
        if (b.area > maxArea) continue;
        const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
        const aspect = bw / bh;
        if (aspect < 0.3 || aspect > 3.3) continue;
        const d = Math.hypot(b.cx - cx, b.cy - cy);
        if (d < bestD) { bestD = d; best = b; }
    }
    if (best && bestD < Math.min(w, h) * 0.25) return { x: best.cx, y: best.cy, isBull: true };
    return { x: cx, y: cy, isBull: false };
}

/**
 * Least-squares conic q1x²+q2xy+q3y²+q4x+q5y=1 through points (normalized
 * internally for stability). radiusAt/pointAt evaluate the conic along a ray
 * from `origin` at image-angle theta (radians).
 */
export function fitConic(pts) {
    const n = pts.length;
    if (n < 8) throw new Error('not enough boundary points for conic fit');
    let mx = 0, my = 0;
    for (const p of pts) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let s = 0;
    for (const p of pts) s += Math.hypot(p.x - mx, p.y - my);
    s = s / n || 1;

    const A = [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]];
    const bv = [0,0,0,0,0];
    for (const p of pts) {
        const x = (p.x - mx) / s, y = (p.y - my) / s;
        const row = [x * x, x * y, y * y, x, y];
        for (let i = 0; i < 5; i++) {
            bv[i] += row[i];
            for (let j = 0; j < 5; j++) A[i][j] += row[i] * row[j];
        }
    }
    const q = solveLinearSystem(A, bv);
    if (!q || q.some(v => !Number.isFinite(v))) throw new Error('conic fit failed');

    function radiusAt(origin, theta) {
        const ox = (origin.x - mx) / s, oy = (origin.y - my) / s;
        const c = Math.cos(theta), si = Math.sin(theta);
        const qa = q[0] * c * c + q[1] * c * si + q[2] * si * si;
        const qb = 2 * q[0] * ox * c + q[1] * (ox * si + oy * c) + 2 * q[2] * oy * si + q[3] * c + q[4] * si;
        const qc = q[0] * ox * ox + q[1] * ox * oy + q[2] * oy * oy + q[3] * ox + q[4] * oy - 1;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < 0 || Math.abs(qa) < 1e-12) return null;
        const r = (-qb + Math.sqrt(disc)) / (2 * qa);
        return r > 0 ? r * s : null;
    }
    function pointAt(origin, theta) {
        const r = radiusAt(origin, theta);
        if (r == null) return null;
        return { x: origin.x + r * Math.cos(theta), y: origin.y + r * Math.sin(theta) };
    }
    return { q, mx, my, s, radiusAt, pointAt };
}

/** Ellipse params (center, axes, rotation) from the fitted conic — used for the
 *  affine first-guess that labels wedge crossings before the projective solve. */
export function conicToEllipse(conic) {
    const [q1, q2, q3, q4, q5] = conic.q;
    const det = 4 * q1 * q3 - q2 * q2;
    if (det <= 1e-12) throw new Error('fit is not an ellipse');
    // center (normalized space): solves gradient = 0
    const ncx = (-2 * q3 * q4 + q2 * q5) / det;
    const ncy = (-2 * q1 * q5 + q2 * q4) / det;
    // centered form constant: x'Mx' = fEval at the center
    const fEval = 1 - (q1 * ncx * ncx + q2 * ncx * ncy + q3 * ncy * ncy + q4 * ncx + q5 * ncy);
    const tr = q1 + q3;
    const d2 = Math.sqrt((q1 - q3) * (q1 - q3) + q2 * q2);
    const l1 = (tr + d2) / 2, l2 = (tr - d2) / 2;       // eigenvalues of M
    if (l1 <= 0 || l2 <= 0 || fEval <= 0) throw new Error('degenerate ellipse');
    const a = Math.sqrt(fEval / l2);                     // semi-major (l2 smaller)
    const b = Math.sqrt(fEval / l1);                     // semi-minor
    let phi = Math.abs(q2) < 1e-12 ? (q1 <= q3 ? 0 : Math.PI / 2)
            : Math.atan2(l2 - q1, q2 / 2) ;
    return {
        cx: ncx * conic.s + conic.mx,
        cy: ncy * conic.s + conic.my,
        a: a * conic.s, b: b * conic.s, phi
    };
}

/**
 * Detect the board: red/green mask → bull seed → outer boundary per angular ray
 * → trimmed conic fit. Returns { origin, conic, ellipse, maskCount }.
 */
export function detectBoardEllipse(data, w, h) {
    const mask = rgMask(data, w, h);
    let count = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
    if (count < w * h * 0.002) throw new Error('board rings not found — too few red/green pixels (check light/framing)');

    const origin = findBullSeed(mask, w, h);

    // Radial histogram: the double ring is the most massive red/green structure,
    // concentrated in a narrow radius band. Stray red/green elsewhere in frame
    // (flags, signs, LED glow) is smeared thin across radii — band-pass it away.
    const HBINS = 200;
    const maxDim = Math.hypot(w, h);
    const hist = new Float64Array(HBINS);
    for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const r = Math.hypot((i % w) - origin.x, ((i / w) | 0) - origin.y);
        const hb = Math.min(HBINS - 1, (r / maxDim * HBINS) | 0);
        hist[hb]++;
    }
    // The double ring band is the most massive bin (largest circumference at full
    // saturation); the treble band peaks lower, stray red/green smears flat.
    let peakBin = 1;
    for (let b = 1; b < HBINS; b++) if (hist[b] > hist[peakBin]) peakBin = b;
    // grow the band around the peak while bins stay substantial
    let lo = peakBin, hi = peakBin;
    const floor = hist[peakBin] * 0.12;
    while (lo > 1 && hist[lo - 1] > floor) lo--;
    while (hi < HBINS - 1 && hist[hi + 1] > floor) hi++;
    const rLo = ((lo - 1) / HBINS) * maxDim;
    const rHi = ((hi + 2) / HBINS) * maxDim;

    // Trace the double-ring OUTER edge per angular ray — but only accept a ray's
    // outermost red/green run if a SIBLING run sits at ~0.615× its radius (the
    // treble ring). Logos, flags and signage can fake ring colors; they cannot
    // fake the double+treble concentric pairing.
    const BINS = 180;
    const rScanLo = Math.max(8, rLo * 0.45);
    const traceRing = () => {
        const pts = [];
        for (let bin = 0; bin < BINS; bin++) {
            const th = ((bin + 0.5) / BINS) * 2 * Math.PI - Math.PI;
            const c = Math.cos(th), si = Math.sin(th);
            const runs = [];
            let cur = null;
            for (let r = rScanLo; r <= rHi; r += 2) {
                const x = Math.round(origin.x + r * c), y = Math.round(origin.y + r * si);
                const cl = (x >= 0 && y >= 0 && x < w && y < h) ? mask[y * w + x] : 0;
                if (cl) {
                    if (!cur) cur = { r0: r, r1: r };
                    else if (r - cur.r1 <= 4) cur.r1 = r;
                    else { runs.push(cur); cur = { r0: r, r1: r }; }
                }
            }
            if (cur) runs.push(cur);
            for (let i = runs.length - 1; i >= 0; i--) {
                const rOut = runs[i].r1;
                if (rOut - runs[i].r0 < 2) continue;             // too thin to be the double band
                const hasTrebleSibling = runs.some(s =>
                    s.r1 < runs[i].r0 &&
                    Math.abs(((s.r0 + s.r1) / 2) / rOut - 0.615) < 0.07);
                if (hasTrebleSibling) {
                    pts.push({ x: origin.x + (rOut + 1) * c, y: origin.y + (rOut + 1) * si });
                    break;
                }
            }
        }
        return pts;
    };

    let pts = traceRing();
    if (pts.length < 24) throw new Error(`board ring structure not found (${pts.length} validated rays) — check light/framing`);
    let conic = fitConic(pts);
    // trim stragglers vs the fit, twice
    for (let pass = 0; pass < 2; pass++) {
        const trimmed = pts.filter(p => {
            const th = Math.atan2(p.y - origin.y, p.x - origin.x);
            const rFit = conic.radiusAt(origin, th);
            const rAct = Math.hypot(p.x - origin.x, p.y - origin.y);
            return rFit && Math.abs(rAct - rFit) / rFit < 0.08;
        });
        if (trimmed.length < 16) break;
        pts = trimmed;
        conic = fitConic(pts);
    }
    return { origin, conic, ellipse: conicToEllipse(conic), maskCount: count, boundaryPts: pts };
}

/**
 * Wire crossings along the double band: sample red/green just inside the outer
 * boundary; each red↔green flip is a wedge boundary. Returns
 * [{ theta (image rad), pt {x,y}, after: 1|2 }] — `after` = color counterclockwise…
 * i.e. of the arc that FOLLOWS the crossing in increasing image angle.
 */
export function findRingTransitions(data, w, h, det) {
    const STEPS = 1440;
    const FRACS = [0.962, 0.975, 0.988];
    const colors = new Int8Array(STEPS).fill(0);
    for (let i = 0; i < STEPS; i++) {
        const th = (i / STEPS) * 2 * Math.PI - Math.PI;
        const r = det.conic.radiusAt(det.origin, th);
        if (r == null) continue;
        let red = 0, green = 0;
        for (const f of FRACS) {
            const x = Math.round(det.origin.x + r * f * Math.cos(th));
            const y = Math.round(det.origin.y + r * f * Math.sin(th));
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const p = (y * w + x) * 4;
            const c = rgClass(data[p], data[p + 1], data[p + 2]);
            if (c === 1) red++; else if (c === 2) green++;
        }
        colors[i] = red > green ? 1 : green > red ? 2 : 0;
    }
    // fill unknown gaps with the previous color (wires/blur are thin)
    let last = 0;
    for (let i = 0; i < STEPS * 2; i++) {
        const k = i % STEPS;
        if (colors[k] === 0 && last) colors[k] = last;
        else if (colors[k]) last = colors[k];
    }
    // transitions: color change sustained for a few samples (debounce specks)
    const transitions = [];
    const SUSTAIN = 6; // 1.5°
    for (let i = 0; i < STEPS; i++) {
        const prev = colors[(i + STEPS - 1) % STEPS], cur = colors[i];
        if (!prev || !cur || prev === cur) continue;
        let ok = true;
        for (let k = 1; k < SUSTAIN; k++) {
            if (colors[(i + k) % STEPS] !== cur) { ok = false; break; }
            if (colors[(i + STEPS - 1 - k) % STEPS] !== prev) { ok = false; break; }
        }
        if (!ok) continue;
        const th = (i / STEPS) * 2 * Math.PI - Math.PI;
        const pt = det.conic.pointAt(det.origin, th);
        if (pt) transitions.push({ theta: th, pt, after: cur });
    }
    return transitions;
}

/** Overdetermined homography (n>=4 correspondences) via normal equations. */
export function computeHomographyN(srcPts, dstPts) {
    const n = srcPts.length;
    if (n < 4) throw new Error('computeHomographyN needs >=4 point pairs');
    if (n === 4) return computeHomography(srcPts, dstPts);
    const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const Atb = new Array(8).fill(0);
    const acc = (row, rhs) => {
        for (let i = 0; i < 8; i++) {
            Atb[i] += row[i] * rhs;
            for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
        }
    };
    for (let i = 0; i < n; i++) {
        const { x, y } = srcPts[i];
        const { x: u, y: v } = dstPts[i];
        if (![x, y, u, v].every(Number.isFinite)) throw new Error('non-finite correspondence');
        acc([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
        acc([0, 0, 0, x, y, 1, -v * x, -v * y], v);
    }
    const hv = solveLinearSystem(AtA, Atb);
    if (!hv || hv.some(v => !Number.isFinite(v))) throw new Error('homography solve failed (degenerate geometry)');
    return [hv[0], hv[1], hv[2], hv[3], hv[4], hv[5], hv[6], hv[7], 1];
}

const wrap360 = (d) => ((d % 360) + 360) % 360;

/**
 * One-tap auto-calibration. `anchorPt` = a tap anywhere inside the 20 wedge.
 * Returns { H, inverse, residualMm, nPoints, calPoints } — calPoints are the 4
 * canonical landmarks (top-20/right-6/bottom-3/left-11) projected back to image
 * space, so existing persistence (calibrate(points)) reproduces H exactly.
 */
export function autoCalibrate(data, w, h, anchorPt) {
    const det = detectBoardEllipse(data, w, h);
    const trans = findRingTransitions(data, w, h, det);
    if (trans.length < 14 || trans.length > 26) {
        throw new Error(`found ${trans.length} wedge crossings (want ~20) — improve light or move closer`);
    }

    // Affine normalization from the ellipse: image pt → unit-circle space where
    // angles are approximately canonical (good enough to LABEL wedges).
    const E = det.ellipse;
    const cosP = Math.cos(E.phi), sinP = Math.sin(E.phi);
    const toCircle = (p) => {
        const dx = p.x - E.cx, dy = p.y - E.cy;
        const u = (dx * cosP + dy * sinP) / E.a;
        const v = (-dx * sinP + dy * cosP) / E.b;
        return { u, v };
    };
    // clockwise-from-up angle in circle space (+y down in images)
    const circAngle = (p) => {
        const { u, v } = toCircle(p);
        return wrap360(Math.atan2(u, -v) * 180 / Math.PI);
    };

    if (!anchorPt) throw new Error('anchor tap (inside the 20 wedge) required');
    const aAng = circAngle(anchorPt);

    // Assign each crossing to its canonical angle 9°+k·18°, rotating so the
    // anchor sits at wedge-20 center (0°).
    const assigned = trans.map(t => {
        const rel = wrap360(circAngle(t.pt) - aAng);
        const k = Math.round((rel - 9) / 18);
        const canon = wrap360(9 + 18 * k);
        return { ...t, canon, err: Math.abs(rel - (9 + 18 * k)) };
    });

    // Color phase vote: the wedge AFTER crossing 9°+18k (i.e. wedge k+1 from 20)
    // is red when (k+1) is even. If the majority disagrees, the anchor tap was a
    // wedge off — shift every assignment by 18°.
    let agree = 0, disagree = 0;
    for (const t of assigned) {
        const k = Math.round((wrap360(t.canon) - 9) / 18);
        const wedgeAfter = ((k + 1) % 20 + 20) % 20;
        const shouldBeRed = wedgeAfter % 2 === 0;
        if ((t.after === 1) === shouldBeRed) agree++; else disagree++;
    }
    let shift = 0;
    if (disagree > agree) shift = 18;

    // Solve iteratively: affine labels seed the first homography; each pass then
    // re-labels every crossing by where the CURRENT homography actually puts it
    // (the affine guess can be a wedge off on the perspective-compressed side —
    // the correct majority dominates the solve, so strays snap home).
    const canonPt = (deg) => {
        const rad = deg * Math.PI / 180;
        return { x: BOARD_RADII.doubleOuter * Math.sin(rad), y: -BOARD_RADII.doubleOuter * Math.cos(rad) };
    };
    const dedupe = (list) => {
        const bySlot = new Map();
        for (const t of list) {
            const cur = bySlot.get(t.canon);
            if (!cur || t.err < cur.err) bySlot.set(t.canon, t);
        }
        return [...bySlot.values()];
    };

    let labeled = dedupe(assigned.map(t => ({ ...t, canon: wrap360(t.canon + shift) })));
    if (labeled.length < 10) throw new Error(`only ${labeled.length} distinct wedge crossings — board partly hidden?`);

    let H = computeHomographyN(labeled.map(t => t.pt), labeled.map(t => canonPt(t.canon)));
    for (let iter = 0; iter < 3; iter++) {
        const relabeled = assigned.map(t => {
            const b = applyHomography(H, t.pt);
            const ang = wrap360(Math.atan2(b.x, -b.y) * 180 / Math.PI);
            const k = Math.round((ang - 9) / 18);
            const canon = wrap360(9 + 18 * k);
            const c = canonPt(canon);
            return { ...t, canon, err: Math.hypot(b.x - c.x, b.y - c.y) };
        }).filter(t => t.err < 40); // a crossing 40mm+ from any slot is junk
        const kept = dedupe(relabeled);
        if (kept.length < 10) break;
        labeled = kept;
        H = computeHomographyN(labeled.map(t => t.pt), labeled.map(t => canonPt(t.canon)));
    }

    // Refine each crossing's RADIUS against the actual mask: the conic gives the
    // angle precisely but its radius can be locally sloppy. The crossing sits ON
    // a wire (colorless), so measure the band's outer edge a nudge into each
    // neighboring wedge and average.
    const mask2 = rgMask(data, w, h);
    const bandEdgeAt = (theta) => {
        const c = Math.cos(theta), si = Math.sin(theta);
        const rGuess = det.conic.radiusAt(det.origin, theta);
        if (rGuess == null) return null;
        // collect mask runs in the window; refine to the outer edge of the run
        // CONTAINING the expected edge — never jump to logo text further out
        const runs = [];
        let cur = null;
        for (let r = rGuess * 0.88; r <= rGuess * 1.08; r += 1) {
            const x = Math.round(det.origin.x + r * c), y = Math.round(det.origin.y + r * si);
            const on = x >= 0 && y >= 0 && x < w && y < h && mask2[y * w + x];
            if (on) {
                if (!cur) cur = { r0: r, r1: r };
                else if (r - cur.r1 <= 3) cur.r1 = r;
                else { runs.push(cur); cur = { r0: r, r1: r }; }
            }
        }
        if (cur) runs.push(cur);
        let best = null, bestGap = Infinity;
        for (const run of runs) {
            if (rGuess < run.r0 - 6 || rGuess > run.r1 + 8) continue; // expected edge not in/near this run
            const gap = Math.abs(run.r1 - rGuess);
            if (gap < bestGap) { bestGap = gap; best = run; }
        }
        if (!best || Math.abs(best.r1 - rGuess) > 12) return null;
        return best.r1 + 1;
    };
    for (const t of labeled) {
        const off = 1.2 * Math.PI / 180;
        const rA = bandEdgeAt(t.theta - off);
        const rB = bandEdgeAt(t.theta + off);
        if (rA && rB && Math.abs(rA - rB) < Math.max(6, rA * 0.03)) {
            const rr = (rA + rB) / 2;
            t.pt = { x: det.origin.x + rr * Math.cos(t.theta), y: det.origin.y + rr * Math.sin(t.theta) };
        }
    }
    H = computeHomographyN(labeled.map(t => t.pt), labeled.map(t => canonPt(t.canon)));

    // Residual trim: drop stragglers, tighten on consensus (kept loose enough to
    // preserve all-around coverage — a one-sided fit shifts the center).
    for (let pass = 0; pass < 3; pass++) {
        const errs = labeled.map(t => {
            const m = applyHomography(H, t.pt);
            const c = canonPt(t.canon);
            return Math.hypot(m.x - c.x, m.y - c.y);
        });
        const sorted = [...errs].sort((a, b) => a - b);
        const median = sorted[(sorted.length / 2) | 0];
        const cut = Math.max(5, median * 2.2);
        const kept = labeled.filter((_, i) => errs[i] <= cut);
        if (kept.length === labeled.length || kept.length < 10) break;
        labeled = kept;
        H = computeHomographyN(labeled.map(t => t.pt), labeled.map(t => canonPt(t.canon)));
    }

    // The bull blob centroid IS the board center — gentle single-point anchor.
    if (det.origin.isBull) {
        const srcW = labeled.map(t => t.pt), dstW = labeled.map(t => canonPt(t.canon));
        srcW.push({ x: det.origin.x, y: det.origin.y });
        dstW.push({ x: 0, y: 0 });
        H = computeHomographyN(srcW, dstW);
    }

    // ICP-style ring-edge lock: predict where the double/treble OUTER edges sit
    // via the current solution, find the actual mask edge along the local radial
    // direction at each predicted point, and re-solve with all edge pairs. Two
    // passes drag the rings onto the photographed bands everywhere at once.
    let finalSrc = null, finalDst = null;
    for (let icp = 0; icp < 2; icp++) {
        let inv;
        try { inv = computeHomographyN(labeled.map(t => canonPt(t.canon)), labeled.map(t => t.pt)); }
        catch { break; }
        // use the freshest H for prediction via its own inverse fit on same pairs
        const centerImg = applyHomography(inv, { x: 0, y: 0 });
        const srcR = [], dstR = [];
        for (const ringMm of [BOARD_RADII.doubleOuter, BOARD_RADII.tripleOuter]) {
            for (let deg = 0; deg < 360; deg += 4) {
                const rad = deg * Math.PI / 180;
                const P = { x: ringMm * Math.sin(rad), y: -ringMm * Math.cos(rad) };
                const img = applyHomography(inv, P);
                let dx = img.x - centerImg.x, dy = img.y - centerImg.y;
                const dn = Math.hypot(dx, dy) || 1;
                dx /= dn; dy /= dn;
                // mask runs along the radial probe (−14..+14 px around prediction)
                const on = [];
                for (let t = -14; t <= 14; t++) {
                    const x = Math.round(img.x + t * dx), y = Math.round(img.y + t * dy);
                    on.push(x >= 0 && y >= 0 && x < w && y < h && mask2[y * w + x] ? 1 : 0);
                }
                // find the run covering (or nearest within 6px of) t=0; take its outer end
                let best2 = null;
                let i = 0;
                while (i < on.length) {
                    if (!on[i]) { i++; continue; }
                    let j = i;
                    while (j + 1 < on.length && on[j + 1]) j++;
                    const t0 = i - 14, t1 = j - 14;
                    if (j - i + 1 >= 3 && t0 <= 6 && t1 >= -6) {
                        if (!best2 || Math.abs(t1) < Math.abs(best2.t1)) best2 = { t0, t1 };
                    }
                    i = j + 1;
                }
                if (best2) {
                    srcR.push({ x: img.x + (best2.t1 + 1) * dx, y: img.y + (best2.t1 + 1) * dy });
                    dstR.push(P);
                }
            }
        }
        if (srcR.length < 40) break;
        // crossings + bull keep their vote; ring edges dominate by count
        for (const t of labeled) { srcR.push(t.pt); dstR.push(canonPt(t.canon)); }
        if (det.origin.isBull) { srcR.push({ x: det.origin.x, y: det.origin.y }); dstR.push({ x: 0, y: 0 }); }
        H = computeHomographyN(srcR, dstR);
        finalSrc = srcR; finalDst = dstR;
    }

    let sumErr = 0;
    const perPoint = labeled.map(t => {
        const m = applyHomography(H, t.pt);
        const c = canonPt(t.canon);
        const e = Math.hypot(m.x - c.x, m.y - c.y);
        sumErr += e;
        return { canon: t.canon, mm: +e.toFixed(1) };
    });
    const residualMm = sumErr / labeled.length;
    if (residualMm > 6) {
        throw new Error(`calibration residual ${residualMm.toFixed(1)}mm over ${labeled.length} pts — too loose; recheck framing (worst: ${JSON.stringify(perPoint.sort((a, b) => b.mm - a.mm).slice(0, 3))})`);
    }
    const src = labeled.map(t => t.pt);
    let invSrc, invDst;
    if (finalSrc) {
        invSrc = [...finalDst]; invDst = [...finalSrc];
    } else {
        invSrc = labeled.map(t => canonPt(t.canon)); invDst = [...src];
        if (det.origin.isBull) {
            invSrc.push({ x: 0, y: 0 });
            invDst.push({ x: det.origin.x, y: det.origin.y });
        }
    }
    const inverse = computeHomographyN(invSrc, invDst);
    // verify the anchor actually lands in wedge 20
    const anchorScore = scoreFromBoardPoint(applyHomography(H, anchorPt).x, applyHomography(H, anchorPt).y);
    if (anchorScore.segment !== 20 && anchorScore.segment !== 25) {
        throw new Error(`anchor resolved to ${anchorScore.label} — tap INSIDE the 20 wedge and retry`);
    }

    const calPoints = CAL_TARGETS.map(t => applyHomography(inverse, { x: t.x, y: t.y }));
    return { H, inverse, residualMm, nPoints: src.length, calPoints };
}

// ── Registration refine: snap the wireframe onto the board's edges ──────────
// The crossing-fit pins only the OUTER ring (all crossings sit at one radius),
// so perspective/radial error lets the inner rings drift. This is the HDR-align
// fix: project the FULL board wireframe (every ring + every wire) and slide the
// homography until those lines land on the image's actual edges. Coarse-to-fine
// (blurred gradient → sharp) gives a wide capture basin that locks in tight.

/** Downscale an RGBA frame to a target width, returning { gray, w, h, scale }. */
export function downscaleGray(data, w, h, targetW = 480) {
    const scale = Math.min(1, targetW / w);
    const dw = Math.max(8, Math.round(w * scale)), dh = Math.max(8, Math.round(h * scale));
    const gray = new Float32Array(dw * dh);
    for (let y = 0; y < dh; y++) {
        const sy = Math.min(h - 1, Math.floor(y / scale));
        for (let x = 0; x < dw; x++) {
            const sx = Math.min(w - 1, Math.floor(x / scale));
            const p = (sy * w + sx) * 4;
            gray[y * dw + x] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
        }
    }
    return { gray, w: dw, h: dh, scale };
}

/** Sobel gradient magnitude over a Float32 gray buffer. Returns Float32 (same size). */
export function sobelMag(gray, w, h) {
    const mag = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const gx = (gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1])
                     - (gray[i - w - 1] + 2 * gray[i - 1] + gray[i + w - 1]);
            const gy = (gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1])
                     - (gray[i - w - 1] + 2 * gray[i - w] + gray[i - w + 1]);
            mag[i] = Math.hypot(gx, gy);
        }
    }
    return mag;
}

/** Separable box blur (two passes) — cheap smoothing for the pyramid basin. */
export function boxBlur(src, w, h, radius) {
    if (radius < 1) return src.slice();
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    const norm = 1 / (2 * radius + 1);
    for (let y = 0; y < h; y++) {
        let acc = 0;
        for (let x = -radius; x <= radius; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
            tmp[y * w + x] = acc * norm;
            const xout = Math.max(0, x - radius), xin = Math.min(w - 1, x + radius + 1);
            acc += src[y * w + xin] - src[y * w + xout];
        }
    }
    for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
            out[y * w + x] = acc * norm;
            const yout = Math.max(0, y - radius), yin = Math.min(h - 1, y + radius + 1);
            acc += tmp[yin * w + x] - tmp[yout * w + x];
        }
    }
    return out;
}

/** Board-mm sample points along every ring + every wedge wire (the wireframe). */
export function wireframeSamples() {
    const pts = [];
    const rings = [BOARD_RADII.singleBull, BOARD_RADII.tripleInner, BOARD_RADII.tripleOuter,
                   BOARD_RADII.doubleInner, BOARD_RADII.doubleOuter];
    for (const r of rings) {
        const step = r > 120 ? 3 : 5;
        for (let a = 0; a < 360; a += step) {
            const rad = a * Math.PI / 180;
            pts.push({ x: r * Math.sin(rad), y: -r * Math.cos(rad) });
        }
    }
    for (let i = 0; i < 20; i++) {
        const rad = (i * 18 + 9) * Math.PI / 180;
        for (let rr = 18; rr <= 170; rr += 7) {
            pts.push({ x: rr * Math.sin(rad), y: -rr * Math.cos(rad) });
        }
    }
    return pts;
}

/** Bilinear sample of a Float32 map (0 outside bounds). */
function sampleBilinear(map, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 0;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return map[i] * (1 - fx) * (1 - fy) + map[i + 1] * fx * (1 - fy)
         + map[i + w] * (1 - fx) * fy + map[i + w + 1] * fx * fy;
}

/**
 * Refine a calibration by registering the wireframe to the image edges.
 * `calPoints` = 4 image-space landmarks (CAL_TARGETS order), full-res. Returns
 * { H, inverse, calPoints, scoreBefore, scoreAfter, gain } — calPoints refined,
 * full-res, drop-in for calibrate(points). Pure: no DOM.
 */
export function refineCalibration(data, w, h, calPoints, opts = {}) {
    const targetW = opts.targetW ?? 480;
    const ds = downscaleGray(data, w, h, targetW);
    let edge = sobelMag(ds.gray, ds.w, ds.h);
    // soft-cap speculars so a glint can't outvote a whole ring
    let mean = 0; for (let i = 0; i < edge.length; i++) mean += edge[i]; mean /= edge.length;
    const cap = mean * 6 || 1;
    for (let i = 0; i < edge.length; i++) edge[i] = Math.min(edge[i], cap);

    const wf = wireframeSamples();
    const dstMm = CAL_TARGETS.map(t => ({ x: t.x, y: t.y }));
    // work in downscaled image space
    let pts = calPoints.map(p => ({ x: p.x * ds.scale, y: p.y * ds.scale }));
    const pts0 = pts.map(p => ({ x: p.x, y: p.y }));

    // Regularization: the board's 18° wedge repeat makes a wedge-rotated fit score
    // just as high on edges. autoCalibrate already nailed the rotation (color-phase
    // vote), so penalize drift from that start — small correct snaps survive, the
    // big wedge-jump does not. Weight is relative to the typical edge value.
    const regWeight = opts.regWeight ?? 0.12;
    const maxDrift = opts.maxDriftPx != null ? opts.maxDriftPx * ds.scale : ds.w * 0.05;
    const driftPenalty = (P) => {
        let d2 = 0;
        for (let i = 0; i < 4; i++) {
            const dx = P[i].x - pts0[i].x, dy = P[i].y - pts0[i].y;
            d2 += dx * dx + dy * dy;
        }
        return (regWeight * mean) * (d2 / 4);   // scale by image contrast
    };
    const withinDrift = (P) => {
        for (let i = 0; i < 4; i++) {
            if (Math.hypot(P[i].x - pts0[i].x, P[i].y - pts0[i].y) > maxDrift) return false;
        }
        return true;
    };

    const rawScore = (map, P) => {
        let inv;
        try { inv = computeHomography(dstMm, P); } catch { return -1; }
        if (inv.some(v => !Number.isFinite(v))) return -1;
        let s = 0, n = 0;
        for (const m of wf) {
            const ip = applyHomography(inv, m);
            const v = sampleBilinear(map, ds.w, ds.h, ip.x, ip.y);
            if (v > 0) { s += v; n++; }
        }
        return n > 8 ? s / wf.length : -1;   // divide by full count: reward staying in-frame
    };
    const scoreOn = (map, P) => {
        if (!withinDrift(P)) return -1e9;
        const raw = rawScore(map, P);
        return raw < 0 ? raw : raw / (1 + driftPenalty(P) / 100);
    };

    const scoreBefore = rawScore(edge, pts);

    // Coarse-to-fine: blur the gradient for a wide-but-bounded capture basin, then
    // sharpen. Steps stay small — autoCalibrate is already close; we only polish.
    const levels = [
        { blur: Math.round(ds.w * 0.018), step: ds.w * 0.012 },
        { blur: Math.round(ds.w * 0.008), step: ds.w * 0.006 },
        { blur: 0, step: ds.w * 0.004 }
    ];
    for (const lvl of levels) {
        const map = lvl.blur >= 1 ? boxBlur(edge, ds.w, ds.h, lvl.blur) : edge;
        let step = lvl.step;
        let cur = scoreOn(map, pts);
        for (let iter = 0; iter < 60 && step > 0.4; iter++) {
            let improved = false;
            for (let k = 0; k < 4; k++) {
                for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
                    const trial = pts.map((p, j) => j === k ? { x: p.x + dx, y: p.y + dy } : p);
                    const sc = scoreOn(map, trial);
                    if (sc > cur) { cur = sc; pts = trial; improved = true; }
                }
            }
            if (!improved) step *= 0.5;
        }
    }

    const scoreAfter = rawScore(edge, pts);
    // if refinement somehow made the sharp-edge score worse, keep the original
    const finalPts = scoreAfter >= scoreBefore ? pts : calPoints.map(p => ({ x: p.x * ds.scale, y: p.y * ds.scale }));
    const fullPts = finalPts.map(p => ({ x: p.x / ds.scale, y: p.y / ds.scale }));

    const H = computeHomography(fullPts, dstMm);
    const inverse = computeHomography(dstMm, fullPts);
    return {
        H, inverse, calPoints: fullPts,
        scoreBefore: +scoreBefore.toFixed(2),
        scoreAfter: +Math.max(scoreBefore, scoreAfter).toFixed(2),
        gain: +(((Math.max(scoreBefore, scoreAfter) - scoreBefore) / (scoreBefore || 1)) * 100).toFixed(1)
    };
}

// ── Turn detector state machine ─────────────────────────────────────────────

/**
 * Stateful detector fed downscaled grayscale frames at ~5-15fps.
 *
 *   const det = createDetector({ w, h });
 *   const events = det.push(grayFrame);
 *   // [] or [{type:'dart', tip:{x,y}, blob}, {type:'turn-reset'}, {type:'rebaseline'}]
 *
 * States: SETTLING (acquiring baseline) → READY → MOTION (hand/player in frame)
 *         → back to READY (diff settled). A settled dart-sized diff vs baseline
 *         that PERSISTS for confirmFrames evaluations = new dart (one-frame
 *         glints/reflections are rejected); the frame is folded into the baseline.
 *         A large motion followed by a return NEAR the ORIGINAL (turn-start)
 *         baseline = darts pulled → 'turn-reset'.
 *         MOTION with a frame-to-frame STATIC scene for deadlockFrames = the
 *         baseline is stale (auto-exposure shift, camera bump, detection started
 *         with someone at the board) → adopt the scene as the new baseline and
 *         emit 'rebaseline' (turn state is cleared; UI should warn).
 */
export function createDetector(opts = {}) {
    const w = opts.w, h = opts.h;
    const cfg = {
        pixelThreshold: opts.pixelThreshold ?? 28,
        handFrac: opts.handFrac ?? 0.06,        // >6% of pixels changed = player in frame
        minDartArea: opts.minDartArea ?? Math.max(10, Math.round(w * h * 0.00012)),
        maxDartAreaFrac: opts.maxDartAreaFrac ?? 0.03,
        stableFrames: opts.stableFrames ?? 3,    // consecutive calm frames to evaluate
        confirmFrames: opts.confirmFrames ?? 2,  // evaluations a dart diff must persist
        deadlockFrames: opts.deadlockFrames ?? 15 // static MOTION frames before rebaseline
    };
    // Frame-to-frame stillness tolerance: sensor noise sits under pixelThreshold,
    // so a vacated scene diffs ~0 px frame-to-frame; a human can't hold that still.
    const stillEps = Math.max(8, Math.round(w * h * 0.0008));
    let baseline = null;       // current baseline (includes darts already counted)
    let turnStart = null;      // baseline at start of turn (no new darts)
    let prevGray = null;       // previous frame (for frame-to-frame stillness)
    let calmStreak = 0;
    let stillMotionStreak = 0; // consecutive static frames while stuck in MOTION
    let pendingDart = null;    // { changed, frames } awaiting confirmFrames persistence
    let state = 'SETTLING';
    let dartsThisTurn = 0;
    let dartAreaThisTurn = 0;  // accumulated changed-pixel footprint of counted darts

    function pushInner(gray) {
        const events = [];
        if (!baseline) {
            baseline = gray.slice();
            turnStart = gray.slice();
            state = 'READY';
            return events;
        }
        const { mask, changed } = diffMask(baseline, gray, cfg.pixelThreshold);
        const frac = changed / gray.length;

        if (frac > cfg.handFrac) {
            state = 'MOTION';
            calmStreak = 0;
            pendingDart = null;
            // Deadlock escape: far from baseline yet frame-to-frame static —
            // the baseline is stale. Re-anchor instead of hanging in MOTION forever.
            if (prevGray && diffMask(prevGray, gray, cfg.pixelThreshold).changed <= stillEps) {
                if (++stillMotionStreak >= cfg.deadlockFrames) {
                    baseline = gray.slice();
                    turnStart = gray.slice();
                    dartsThisTurn = 0;
                    dartAreaThisTurn = 0;
                    stillMotionStreak = 0;
                    state = 'READY';
                    events.push({ type: 'rebaseline' });
                }
            } else {
                stillMotionStreak = 0;
            }
            return events;
        }
        stillMotionStreak = 0;

        calmStreak++;
        if (calmStreak < cfg.stableFrames) return events;

        if (state === 'MOTION' || state === 'READY') {
            // Calm again — did the scene return to the turn-start baseline? (darts pulled)
            // Threshold scales with the actual dart footprint: with darts still on the
            // board, the diff vs turn-start ≈ their accumulated area; pulled darts → ~0.
            if (dartsThisTurn > 0 && turnStart) {
                const vsStart = diffMask(turnStart, gray, cfg.pixelThreshold);
                const resetBelow = Math.max(cfg.minDartArea * 0.5, dartAreaThisTurn * 0.35);
                if (vsStart.changed < resetBelow) {
                    dartsThisTurn = 0;
                    dartAreaThisTurn = 0;
                    pendingDart = null;
                    baseline = gray.slice();
                    turnStart = gray.slice();
                    state = 'READY';
                    events.push({ type: 'turn-reset' });
                    return events;
                }
            }
            // New stable diff vs current baseline = candidate dart. Must persist
            // (with a consistent footprint) across confirmFrames evaluations so a
            // one-frame glint can't mint a dart — and the emitted frame is settled,
            // not the arrival frame with its motion blur.
            if (changed >= cfg.minDartArea && frac <= cfg.maxDartAreaFrac) {
                if (pendingDart &&
                    Math.abs(changed - pendingDart.changed) <= 0.4 * Math.max(changed, pendingDart.changed)) {
                    pendingDart.frames++;
                    pendingDart.changed = changed;
                } else {
                    pendingDart = { changed, frames: 1 };
                }
                if (pendingDart.frames >= cfg.confirmFrames) {
                    const clean = denoiseMask(mask, w, h);
                    const blobs = findBlobs(clean, w, h, cfg.minDartArea);
                    pendingDart = null;
                    if (blobs.length) {
                        const blob = blobs[0];
                        const tip = findDartTip(blob, w);
                        dartsThisTurn++;
                        dartAreaThisTurn += changed;
                        baseline = gray.slice(); // fold dart into baseline
                        events.push({ type: 'dart', tip, blob, dartNumber: dartsThisTurn });
                    }
                }
            } else {
                pendingDart = null;
                if (changed > 0 && changed < cfg.minDartArea) {
                    // sub-dart noise: re-anchor slowly to tolerate light drift
                    baseline = gray.slice();
                }
            }
            state = 'READY';
        }
        return events;
    }

    return {
        push(gray) {
            const events = pushInner(gray);
            prevGray = gray.slice();
            return events;
        },
        get state() { return state; },
        get dartsThisTurn() { return dartsThisTurn; },
        forceNewTurn() {
            dartsThisTurn = 0;
            dartAreaThisTurn = 0;
            pendingDart = null;
            if (baseline) turnStart = baseline.slice();
        },
        reset() {
            baseline = null; turnStart = null; prevGray = null;
            dartsThisTurn = 0; dartAreaThisTurn = 0;
            calmStreak = 0; stillMotionStreak = 0; pendingDart = null;
            state = 'SETTLING';
        }
    };
}
