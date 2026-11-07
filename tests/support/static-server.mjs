// Local static server for the UI tests. It serves the project ONLY under /lead-dashboard/,
// the same path GitHub Pages uses (https://taliasnir-prog.github.io/lead-dashboard/).
// Anything outside that path returns 404, so an absolute path in the app or in a test
// (for example page.goto('/')) fails locally instead of only after publishing.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const PREFIX = '/lead-dashboard/';
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
// Like the published site: only the files GitHub Pages would serve, never node_modules or .git.
const BLOCKED = ['node_modules', '.git', 'test-results', 'playwright-report'];

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/lead-dashboard') {
    res.writeHead(301, { Location: PREFIX }).end();
    return;
  }
  if (!url.pathname.startsWith(PREFIX)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found (outside /lead-dashboard/)');
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(PREFIX.length));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(ROOT, rel));
  const top = rel.split('/')[0];
  if (!file.startsWith(ROOT + sep) || BLOCKED.includes(top)) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}${PREFIX}`));
