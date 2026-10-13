import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tiny static server so the QR verification page can load qrcode.js from the
// dashboard folder exactly as the real pages do (relative path, no bundler).
// Serve from the repository root so the page can load `Admin Dashboard/qrcode.js`
// over the same relative path the real dashboards use.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const target = path.join(root, decodeURIComponent(url.pathname));
    if (!target.startsWith(root)) { res.writeHead(403).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(8791, () => console.log('qr-verify server on http://127.0.0.1:8791'));