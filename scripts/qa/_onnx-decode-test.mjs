// Validate onnx-detector.js end-to-end: run the COCO yolov8n in-browser against
// bus.jpg and confirm preprocess->infer->decode->NMS yields sane detections
// (persons + a bus at plausible locations). Proves the decode path our dart model
// will reuse (identical output shape, just 5 classes instead of 80).
import { chromium } from 'playwright';

const COCO = ['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto('http://localhost:5601/pages/autoscore-lab.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

const res = await page.evaluate(async () => {
    const { loadDetector } = await import('/js/onnx-detector.js?t=' + Date.now());
    const det = await loadDetector('/models/spike/yolov8n.onnx', { imgsz: 640, conf: 0.35 });
    const img = new Image(); img.src = '/models/spike/bus.jpg';
    await new Promise((r, j) => { img.onload = r; img.onerror = () => j(new Error('bus.jpg 404')); });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const out = await det.detect(c);
    return { backend: out.backend, ms: Math.round(out.ms), imgW: img.naturalWidth, imgH: img.naturalHeight,
             dets: out.raw.map(d => ({ cls: d.cls, conf: +d.conf.toFixed(2), x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.w), h: Math.round(d.h) })) };
});

const named = res.dets.map(d => ({ ...d, name: COCO[d.cls] })).sort((a, b) => b.conf - a.conf);
const counts = named.reduce((m, d) => (m[d.name] = (m[d.name] || 0) + 1, m), {});
console.log(JSON.stringify({ backend: res.backend, ms: res.ms, img: `${res.imgW}x${res.imgH}`,
    nDets: named.length, counts, top: named.slice(0, 8) }, null, 1));

// sanity gate: bus.jpg should yield a bus + several persons, boxes within image bounds
const okBus = named.some(d => d.name === 'bus' && d.conf > 0.6);
const okPpl = named.filter(d => d.name === 'person').length >= 2;
const inBounds = named.every(d => d.x >= 0 && d.x <= res.imgW && d.y >= 0 && d.y <= res.imgH);
console.log('VALIDATION:', JSON.stringify({ okBus, okPpl, inBounds, PASS: okBus && okPpl && inBounds }));
await browser.close();
process.exit(okBus && okPpl && inBounds ? 0 : 1);
