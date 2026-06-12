// Tiny static server for device testing (adb reverse tcp:5601).
// Usage: node scripts/qa/serve-public.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const port = Number(process.argv[2] || 5601);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
}).listen(port, () => console.log(`serving ${root} on :${port}`));
