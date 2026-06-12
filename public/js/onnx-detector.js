// BRDC ONNX dart detector — runs a YOLOv8 model in-browser (onnxruntime-web,
// WebGPU→WASM) and decodes its output into board calibration points + dart tips.
// Pure module (no DOM beyond an optional canvas for preprocessing). The scoring
// math stays in autoscore-engine.js — this only replaces the fragile *detection*.
//
// Model contract (matches darts-vision/train.py export):
//   input  : "images" float32 [1,3,IMGSZ,IMGSZ], RGB, /255, letterboxed
//   output : float32 [1, 4+nc, 8400]  (YOLOv8 head; nc=5 for the dart model)
//   classes: 0 cal_top, 1 cal_right, 2 cal_bottom, 3 cal_left, 4 dart

const ORT_VER = '1.20.1';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
export const DART_CLASSES = ['cal_top', 'cal_right', 'cal_bottom', 'cal_left', 'dart'];

let _ort = null;
async function ort() {
    if (_ort) return _ort;
    _ort = await import(ORT_BASE + 'ort.webgpu.min.mjs');
    _ort.env.wasm.wasmPaths = ORT_BASE;
    _ort.env.wasm.numThreads = 1;
    return _ort;
}

/**
 * Load a YOLO ONNX model. Returns a detector:
 *   { detect(source) -> {raw:[{cls,conf,x,y,w,h}], backend, ms},
 *     detectBoard(source) -> {calPoints:[4|null], darts:[{x,y,conf}], ms},
 *     imgsz, nc, backend }
 * `source` is any canvas/video/image; coords come back in SOURCE pixels.
 */
export async function loadDetector(modelUrl, opts = {}) {
    const o = await ort();
    const buf = await fetch(modelUrl).then(r => { if (!r.ok) throw new Error('model HTTP ' + r.status); return r.arrayBuffer(); });
    let backend = 'webgpu', session;
    try { session = await o.InferenceSession.create(buf, { executionProviders: ['webgpu'] }); }
    catch { backend = 'wasm'; session = await o.InferenceSession.create(buf, { executionProviders: ['wasm'] }); }

    const imgsz = opts.imgsz ?? 640;
    const conf = opts.conf ?? 0.25;
    const iou = opts.iou ?? 0.45;
    const inName = session.inputNames[0], outName = session.outputNames[0];

    const pre = document.createElement('canvas');
    pre.width = imgsz; pre.height = imgsz;
    const pctx = pre.getContext('2d', { willReadFrequently: true });

    function letterbox(src) {
        const sw = src.videoWidth || src.naturalWidth || src.width;
        const sh = src.videoHeight || src.naturalHeight || src.height;
        const scale = Math.min(imgsz / sw, imgsz / sh);
        const nw = Math.round(sw * scale), nh = Math.round(sh * scale);
        const padX = (imgsz - nw) / 2, padY = (imgsz - nh) / 2;
        pctx.fillStyle = '#727272'; pctx.fillRect(0, 0, imgsz, imgsz);
        pctx.drawImage(src, padX, padY, nw, nh);
        return { scale, padX, padY, sw, sh };
    }

    function toTensor() {
        const { data } = pctx.getImageData(0, 0, imgsz, imgsz);
        const n = imgsz * imgsz;
        const f = new Float32Array(3 * n);
        for (let i = 0, p = 0; i < n; i++, p += 4) {
            f[i] = data[p] / 255;             // R plane
            f[n + i] = data[p + 1] / 255;     // G plane
            f[2 * n + i] = data[p + 2] / 255; // B plane
        }
        return new o.Tensor('float32', f, [1, 3, imgsz, imgsz]);
    }

    function decode(out, lb) {
        const data = out.data;
        const dims = out.dims;                 // [1, 4+nc, N]
        const C = dims[1], N = dims[2], nc = C - 4;
        const dets = [];
        for (let i = 0; i < N; i++) {
            let best = 0, bestC = -1;
            for (let c = 0; c < nc; c++) {
                const s = data[(4 + c) * N + i];
                if (s > best) { best = s; bestC = c; }
            }
            if (best < conf) continue;
            const cx = data[i], cy = data[N + i], w = data[2 * N + i], h = data[3 * N + i];
            // letterbox-space (imgsz px) → source px
            dets.push({
                cls: bestC, conf: best,
                x: (cx - lb.padX) / lb.scale,
                y: (cy - lb.padY) / lb.scale,
                w: w / lb.scale, h: h / lb.scale
            });
        }
        return nms(dets, iou);
    }

    async function detect(src) {
        const lb = letterbox(src);
        const tensor = toTensor();
        const t0 = performance.now();
        const out = await session.run({ [inName]: tensor });
        const ms = performance.now() - t0;
        return { raw: decode(out[outName], lb), backend, ms };
    }

    async function detectBoard(src) {
        const { raw, ms } = await detect(src);
        const calPoints = [null, null, null, null];
        const calConf = [0, 0, 0, 0];
        const darts = [];
        for (const d of raw) {
            if (d.cls <= 3) {
                if (d.conf > calConf[d.cls]) { calConf[d.cls] = d.conf; calPoints[d.cls] = { x: d.x, y: d.y, conf: d.conf }; }
            } else {
                darts.push({ x: d.x, y: d.y, conf: d.conf });
            }
        }
        return { calPoints, darts, ms, complete: calPoints.every(Boolean) };
    }

    return { detect, detectBoard, imgsz, backend, classes: DART_CLASSES };
}

/** Greedy per-class non-max suppression (IoU). */
export function nms(dets, iouThresh = 0.45) {
    const byCls = {};
    for (const d of dets) (byCls[d.cls] ||= []).push(d);
    const keep = [];
    for (const cls in byCls) {
        const arr = byCls[cls].sort((a, b) => b.conf - a.conf);
        const taken = [];
        for (const d of arr) {
            if (taken.every(t => iou(d, t) < iouThresh)) { taken.push(d); keep.push(d); }
        }
    }
    return keep;
}

function iou(a, b) {
    const ax1 = a.x - a.w / 2, ay1 = a.y - a.h / 2, ax2 = a.x + a.w / 2, ay2 = a.y + a.h / 2;
    const bx1 = b.x - b.w / 2, by1 = b.y - b.h / 2, bx2 = b.x + b.w / 2, by2 = b.y + b.h / 2;
    const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
    const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const inter = ix * iy;
    const uni = a.w * a.h + b.w * b.h - inter;
    return uni > 0 ? inter / uni : 0;
}
