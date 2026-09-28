// Minimal static file server for the MzansiConnect dashboards.
// Serves the project root so both dashboards can resolve the shared
// ../Citizen Portal Mobile App/... asset references.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.STATIC_PORT || 8080);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    // Blank root shows a small index linking to the dashboards.
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const resolved = path.join(root, pathname);
    // Prevent path traversal outside the project root.
    if (!resolved.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let target = resolved;
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = path.join(target, 'index.html');
    const data = await readFile(target);
    res.writeHead(200, { 'content-type': types[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(port, () => console.log(`Static server serving ${root} on http://localhost:${port}`));
