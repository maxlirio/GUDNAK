// Serve the game locally so the effects bench can be opened in a real browser.
//
//   node tools/fxserve.js
//   -> http://localhost:8080/game/?quick=1&fxlab=1
//
// DEV ONLY, and meant to be deleted along with game/js/fxlab.js.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(process.cwd(), p.replace(/^\/+/, ''));
  try {
    statSync(file);
    res.writeHead(200, { 'content-type': TYPES[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`\n  Effects bench:  http://localhost:${PORT}/game/?quick=1&fxlab=1\n`);
  console.log('  Click any effect on the left to watch it. "half speed" helps.');
  console.log('  Ctrl-C to stop.\n');
});
