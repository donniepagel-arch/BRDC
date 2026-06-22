// Tiny static server for device testing.
// Usage: node scripts/qa/serve-public.mjs [port] [--https]
//   --https serves over TLS (self-signed _lan-cert.pem) bound to 0.0.0.0 so a phone
//   on the LAN can reach it at a SECURE origin (required for the camera + WebGPU).
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const DV = path.resolve(root, '..', 'darts-vision');
const PY = path.join(DV, '.venv', 'Scripts', 'python.exe');
const port = Number(process.argv[2] || 5601);
let latestFrame = null;   // in-memory relay: phone POSTs frames here, tablet GETs them
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// Short, typo-proof aliases for tablet/phone entry (long filenames are easy to fat-finger)
const ALIAS = {
  '/lab': '/pages/autoscore-labeler.html',
  '/labeler': '/pages/autoscore-labeler.html',
  '/cap': '/pages/autoscore-capture.html',
  '/streamer': '/pages/autoscore-streamer.html',
  '/stream': '/pages/autoscore-streamer.html',
  '/cam': '/pages/autoscore-streamer.html',
};

const handler = (req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ALIAS[urlPath.replace(/\/$/, '')]) urlPath = ALIAS[urlPath.replace(/\/$/, '')];
  // Auto-label capture: page POSTs {id, image dataURL, label (YOLO txt), split} →
  // writes a labeled sample into the darts-vision dataset (images/ + labels/).
  if (req.method === 'POST' && urlPath === '/capture') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e7) req.destroy(); });
    req.on('end', () => {
      try {
        const { id, image, label, split = 'train' } = JSON.parse(body);
        const safeId = String(id).replace(/[^a-z0-9_-]/gi, '');
        const sp = split === 'val' ? 'val' : 'train';
        const dsRoot = path.resolve(root, '..', 'darts-vision', 'dataset');
        const imgDir = path.join(dsRoot, 'images', sp);
        const lblDir = path.join(dsRoot, 'labels', sp);
        fs.mkdirSync(imgDir, { recursive: true });
        fs.mkdirSync(lblDir, { recursive: true });
        const b64 = String(image).replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(imgDir, safeId + '.jpg'), Buffer.from(b64, 'base64'));
        fs.writeFileSync(path.join(lblDir, safeId + '.txt'), String(label));
        // running count
        const n = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg')).length;
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, split: sp, count: n }));
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    return;
  }
  // Dataset stats helper
  if (req.method === 'GET' && urlPath === '/capture/stats') {
    try {
      const dsRoot = path.resolve(root, '..', 'darts-vision', 'dataset');
      const count = (sp) => { try { return fs.readdirSync(path.join(dsRoot, 'images', sp)).filter(f => f.endsWith('.jpg')).length; } catch { return 0; } };
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ train: count('train'), val: count('val') }));
    } catch (e) { res.writeHead(500).end(String(e)); }
    return;
  }

  // Classical auto-calibration: page POSTs {image dataURL} → cvcal.py finds the board
  // from its red+green rings and returns the 4 cal points (top/right/bottom/left) + bull.
  if (req.method === 'POST' && urlPath === '/calibrate') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e7) req.destroy(); });
    req.on('end', () => {
      try {
        const { image } = JSON.parse(body);
        const b64 = String(image).replace(/^data:image\/\w+;base64,/, '');
        const tmp = path.join(DV, '_calframe.jpg');
        fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
        execFile(PY, [path.join(DV, 'cvcal.py'), tmp, '--json'], { cwd: DV, timeout: 20000 }, (err, stdout, stderr) => {
          if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: String(stderr || err).slice(-400) })); return; }
          try {
            const out = JSON.parse(stdout.trim().split('\n').pop());
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, ...out }));
          } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'parse: ' + stdout.slice(-300) })); }
        });
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    return;
  }

  // Two-device relay: the phone (streamer) POSTs the latest camera frame here;
  // the tablet (labeler) GETs it. Kept purely in memory — one frame, last-wins.
  if (req.method === 'POST' && urlPath === '/stream-push') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e7) req.destroy(); });
    req.on('end', () => {
      try {
        const { image } = JSON.parse(body);
        latestFrame = String(image);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    return;
  }
  if (req.method === 'GET' && urlPath === '/stream-latest') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(latestFrame || '');
    return;
  }

  // QA helper: page POSTs a dataURL frame here so the agent can view what the camera sees.
  if (req.method === 'POST' && urlPath === '/snap') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(); });
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/\w+;base64,/, '');
        const out = path.join(root, '..', 'scripts', 'qa', '_snap.jpg');
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('saved');
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    return;
  }
  // QA helper: /__qa/* serves scripts/qa/ (dev artifacts like captured frames)
  const qaRoot = path.resolve(root, '..', 'scripts', 'qa');
  let file = urlPath.startsWith('/__qa/')
    ? path.normalize(path.join(qaRoot, urlPath.slice(6)))
    : path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root) && !file.startsWith(qaRoot)) { res.writeHead(403).end(); return; }
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
};

const useHttps = process.argv.includes('--https');
const certDir = path.dirname(fileURLToPath(import.meta.url));
const server = useHttps
  ? https.createServer({
      key: fs.readFileSync(path.join(certDir, '_lan-key.pem')),
      cert: fs.readFileSync(path.join(certDir, '_lan-cert.pem')),
    }, handler)
  : http.createServer(handler);
server.listen(port, '0.0.0.0', () =>
  console.log(`serving ${root} on ${useHttps ? 'https' : 'http'}://0.0.0.0:${port}`));
