// Testovací server, který napodobuje WordPress plugin (wp-plugin/nakupak.php):
// /nakupak/ = aplikace z dist/, /nakupak/api = stejný synchronizační protokol jako v PHP.
// Použití: npm run build && node scripts/mock-server.mjs [port] [kód1,kód2,…]
// Každý kód je jedna domácnost s vlastními daty.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'dist');
const port = +(process.argv[2] || 5182);
const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const CODES = (process.argv[3] || 'TEST-TEST-TEST,DRUH-A-DOMA').split(',').map(norm);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

// „Databáze“: domácnost|k → { household, k, data, deleted, rev }
const table = new Map();
let rev = 0;
let purged = 0;
let requests = 0;

function api(body, headerCode) {
  const household = CODES.indexOf(norm(headerCode || body.code)) + 1;
  if (!household) return [401, { error: 'bad_code' }];
  const since = Math.max(0, parseInt(body.since, 10) || 0);
  const changes = Array.isArray(body.changes) ? body.changes : [];
  const clean = new Map();
  for (const c of changes) {
    if (!c || typeof c.k !== 'string' || c.k.length > 191 || !/^[a-z]+:./.test(c.k)) continue;
    const d = c.d ?? null;
    if (d !== null && typeof d !== 'string') continue;
    clean.set(c.k, d);
  }
  if (clean.size) {
    rev++;
    for (const [k, d] of clean) table.set(household + '|' + k, { household, k, data: d, deleted: d === null, rev });
  }
  const full = since <= 0 || since < purged || since > rev;
  const records = [];
  for (const r of table.values()) {
    if (r.household !== household) continue;
    if (full ? !r.deleted : r.rev > since) records.push({ k: r.k, d: r.deleted ? null : r.data });
  }
  return [200, { rev, full, records }];
}

http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/nakupak/api') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{"error":"bad_json"}'); }
    requests++;
    const [status, data] = api(body, req.headers['x-nakupak-code']);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(data));
  }
  if (p === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ rev, requests, records: [...table].filter(([, r]) => !r.deleted).length, tombstones: [...table].filter(([, r]) => r.deleted).length }));
  }
  if (p === '/nakupak') { res.writeHead(301, { Location: '/nakupak/' }); return res.end(); }
  if (p.startsWith('/nakupak/')) {
    const rel = p.slice('/nakupak/'.length) || 'index.html';
    try {
      const data = await readFile(path.join(root, rel));
      res.writeHead(200, { 'Content-Type': types[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(data);
    } catch {}
  }
  res.writeHead(404); res.end('not found');
}).listen(port, () => console.log(`http://localhost:${port}/nakupak/  (kódy ${CODES.join(', ')})`));
