// Serve the game locally so the effects bench can be opened in a real browser.
//
//   node tools/fxserve.js          (or: node tools/fxserve.js 9000)
//
// DEV ONLY, and meant to be deleted along with game/js/fxlab.js.

import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Served from the REPO, not from wherever you happen to be standing. Running
// this from another directory served nothing at all, which looks like a broken
// page rather than like a mistake.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(ROOT, 'game', 'index.html'))) {
  console.error(`\n  Cannot find the game under ${ROOT} — is this the GUDNAK repo?\n`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(ROOT, p.replace(/^\/+/, ''));
  try {
    statSync(file);
    res.writeHead(200, {
      'content-type': TYPES[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream',
      'cache-control': 'no-store',      // or an edit does not show up on reload
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});

// Something else on 8080 is the likeliest reason this "does not work", so it
// steps along until it finds a free port instead of dying.
function listen(port, tries) {
  const onErr = (e) => {
    srv.removeListener('error', onErr);
    if (e.code === 'EADDRINUSE' && tries > 0) {
      console.log(`  port ${port} is busy, trying ${port + 1}…`);
      listen(port + 1, tries - 1);
    } else {
      console.error(`\n  Could not open a port: ${e.message}\n`);
      process.exit(1);
    }
  };
  srv.once('error', onErr);
  srv.listen(port, () => {
    srv.removeListener('error', onErr);
    console.log(`\n  Effects bench:  http://localhost:${port}/game/?quick=1&fxlab=1\n`);
    console.log('  Click any effect on the left to watch it. "half speed" helps.');
    console.log('  Ctrl-C to stop.\n');
  });
}
listen(Number(process.argv[2]) || 8080, 12);
