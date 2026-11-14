#!/usr/bin/env node
//
// eng/serve.mjs — minimal dependency-free static server for local preview.
//
// Serves the built payload (artifacts/site) under the exact GitHub project Pages
// base path (/Heretical-Documentation) so relative URLs behave as they will in
// production. Loopback only; it contacts no external network.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORTAL_ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(PORTAL_ROOT, 'artifacts', 'site');
const BASE = process.env.PORTAL_BASE || '/Heretical-Documentation';
const HOST = process.env.PORTAL_HOST || '127.0.0.1';
const PORT = Number(process.env.PORTAL_PORT || 4000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolve(urlPath) {
  let p = urlPath;
  if (p === BASE) p = BASE + '/';
  if (!p.startsWith(BASE + '/')) return null; // outside the project path
  try {
    p = decodeURIComponent(p.slice(BASE.length));
  } catch {
    return null; // malformed percent-encoding
  }
  if (p === '/' || p === '') p = '/index.html';
  if (p.includes('\0')) return null;
  const abs = path.resolve(SITE, '.' + p);
  if (abs !== SITE && !abs.startsWith(SITE + path.sep)) return null; // traversal guard
  return abs;
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('invalid request URL');
    return;
  }
  let abs = resolve(url.pathname);
  if (!abs) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not under project base path');
    return;
  }
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      abs = path.join(abs, 'index.html');
    }
    if (!fs.existsSync(abs)) {
      const notfound = path.join(SITE, '404.html');
      if (fs.existsSync(notfound)) {
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        res.end(fs.readFileSync(notfound));
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404');
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(abs));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`serve: http://${HOST}:${PORT}${BASE}/  (payload: ${path.relative(PORTAL_ROOT, SITE)})`);
});
