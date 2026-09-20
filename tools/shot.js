// Look at the table.
//
//   node tools/shot.js --url "game/?quick=1&seed=5" --out /tmp/x.png \
//                      --eval "path/to/snippet.js" --wait 2500
//
// Screenshots alone are not enough for this game: the interesting states (a
// fighter at -I power, a stack, a corpse mid-animation) take a dozen moves to
// reach. So this drives real Chrome over the DevTools protocol, runs a snippet
// against the live `window.__table`, and only then takes the picture.
//
// Technical checks cannot tell you a badge is in the wrong place.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

const URL_ = arg('--url', 'game/');
const OUT = arg('--out', '/tmp/gudnak.png');
const EVAL = arg('--eval', null);
const WAIT = Number(arg('--wait', 2500));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 800));
// Several of these run at once while different effects are being worked on,
// so the ports cannot be fixed numbers — siblings were colliding on them and
// stealing each other's browsers. 0 asks the OS for a free one.
const PORT = Number(arg('--port', 0)) || 9000 + Math.floor(Math.random() * 900);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// a static server, because ES modules will not load from file://
const http = await import('node:http');
const { createReadStream, statSync } = await import('node:fs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(process.cwd(), p.replace(/^\/+/, ''));
  try {
    statSync(file);
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('no'); }
});
let PAGE_PORT = Number(arg('--serve-port', 0));
await new Promise((resolve, reject) => {
  const tryPort = (n, left) => {
    const onErr = () => {
      server.removeListener('error', onErr);
      if (left <= 0) { reject(new Error('no free port for the page server')); return; }
      tryPort(8100 + Math.floor(Math.random() * 800), left - 1);
    };
    server.once('error', onErr);
    server.listen(n, () => { server.removeListener('error', onErr); PAGE_PORT = n; resolve(); });
  };
  tryPort(PAGE_PORT || 8100 + Math.floor(Math.random() * 800), 25);
});

const profile = mkdtempSync(join(tmpdir(), 'gudshot-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run',
  '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
  'about:blank',
], { stdio: 'ignore' });

async function cdpTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('Chrome never opened a debuggable page');
}

const ws = new WebSocket(await cdpTarget());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const waiting = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
};
function cmd(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((res, rej) => waiting.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))));
}

await cmd('Page.enable');
await cmd('Runtime.enable');
const logs = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION ' + (msg.params.exceptionDetails.exception?.description
      || msg.params.exceptionDetails.text));
  }
});

await cmd('Page.navigate', { url: `http://127.0.0.1:${PAGE_PORT}/${URL_}` });
await new Promise((r) => setTimeout(r, WAIT));

if (EVAL) {
  const src = readFileSync(EVAL, 'utf8');
  const r = await cmd('Runtime.evaluate', { expression: src, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) console.log('EVAL THREW:', r.exceptionDetails.exception?.description);
  else if (r.result?.value !== undefined) console.log('eval ->', JSON.stringify(r.result.value));
  await new Promise((r2) => setTimeout(r2, Number(arg('--settle', 1400))));
}

const shot = await cmd('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
console.log(`wrote ${OUT}`);
for (const l of logs.slice(0, 25)) console.log('  console:', l);
if (!logs.length) console.log('  (no console output)');

ws.close();
chrome.kill();
server.close();
process.exit(0);
