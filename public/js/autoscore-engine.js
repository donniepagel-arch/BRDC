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
