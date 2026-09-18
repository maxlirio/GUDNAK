// Turn CARD_FORGE exports into files that can actually be looked at.
//
//   node tools/ingest-cards.js ~/Downloads/*.cards.json
//   node tools/ingest-cards.js --out cards/refractory ~/Downloads/gudnak*.json
//   node tools/ingest-cards.js --skip Auroxi ~/Downloads/*.cards.json   (bulk folders)
//   node tools/ingest-cards.js --only "Refractory Deck" ~/Downloads/*.json
//   node tools/ingest-cards.js --max-folder 40 ~/Downloads/*.json  (drop bulk dumps)
//
// Reads "cardforge.cards.v1" envelopes, writes each card's image to
// cards/images/<folder>/<name>.<ext>, and writes cards/index.json — a manifest
// of every card with its name, folder and image path, ready to be filled in
// with power/traits/text once the faces have been read.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : resolve('cards');

// Bulk faction folders get excluded; deck folders get kept. Both take a
// comma-separated list and match folder names case-insensitively.
const listArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : null;
};
const SKIP = listArg('skip');
const ONLY = listArg('only');
// A folder bigger than this is a bulk faction dump, not a built deck.
const maxIdx = args.indexOf('--max-folder');
const MAX_FOLDER = maxIdx >= 0 ? Number(args[maxIdx + 1]) : Infinity;
const valueIdx = new Set(['--out', '--skip', '--only', '--max-folder']
  .map((f) => args.indexOf(f)).filter((i) => i >= 0).map((i) => i + 1));
const files = args.filter((a, i) => !a.startsWith('--') && !valueIdx.has(i));

const wanted = (folder) => {
  const key = folder || 'unfiled';
  const f = key.toLowerCase();
  if (ONLY && !ONLY.includes(f)) return false;
  if (SKIP && SKIP.includes(f)) return false;
  if (folderTotals[key] > MAX_FOLDER) return false;
  return true;
};

// Folder sizes must be counted across EVERY input file before anything is
// filtered — a folder's cards are split across parts, so judging one file at a
// time would let a 75-card folder through 25 at a time.
const folderTotals = {};
function tally(fileList) {
  for (const file of fileList) {
    let env;
    try { env = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
    if (env.format !== 'cardforge.cards.v1') continue;
    for (const c of env.cards || []) {
      const k = c.folder || 'unfiled';
      folderTotals[k] = (folderTotals[k] || 0) + 1;
    }
  }
}

if (!files.length) {
  console.error('usage: node tools/ingest-cards.js [--out DIR] <file.cards.json ...>');
  process.exit(1);
}

const EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif',
};

const slug = (s) => (s || 'card').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'card';

tally(files);
if (MAX_FOLDER !== Infinity) {
  const big = Object.entries(folderTotals).filter(([, n]) => n > MAX_FOLDER);
  if (big.length) {
    console.log(`folders over ${MAX_FOLDER} cards (treated as bulk, excluded): `
      + big.map(([k, n]) => `${k} ${n}`).join(', '));
  }
}

const manifest = [];
const used = new Set();
let written = 0, skipped = 0, filtered = 0;
const filteredFolders = {};

for (const file of files) {
  let env;
  try {
    env = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`! ${file}: not valid JSON (${e.message})`);
    continue;
  }
  if (env.format !== 'cardforge.cards.v1') {
    console.error(`! ${file}: unexpected format "${env.format}"`);
    continue;
  }

  for (const card of env.cards || []) {
    if (!wanted(card.folder)) {
      const k = card.folder || 'unfiled';
      filteredFolders[k] = (filteredFolders[k] || 0) + 1;
      filtered++;
      continue;
    }
    const img = card.image || {};
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(img.dataUrl || '');
    if (!m) { console.error(`  ! ${card.name}: no decodable image`); skipped++; continue; }

    const ext = EXT[m[1]] || 'png';
    const folder = card.folder ? slug(card.folder) : 'unfiled';

    // Names repeat across exports; keep every card rather than overwriting.
    let base = slug(card.name), key = `${folder}/${base}`, n = 1;
    while (used.has(key)) key = `${folder}/${base}-${++n}`;
    used.add(key);

    const rel = join('images', `${key}.${ext}`);
    const abs = join(OUT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, Buffer.from(m[2], 'base64'));
    written++;

    manifest.push({
      name: card.name,
      folder: card.folder,
      image: rel,
      pixels: `${img.width}x${img.height}`,
      fromSource: !!img.source,
      fields: card.fields && Object.keys(card.fields).length ? card.fields : undefined,
      // Filled in after reading the face:
      card: null,
    });
  }
}

mkdirSync(OUT, { recursive: true });
const indexPath = join(OUT, 'index.json');
const prior = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : null;
writeFileSync(indexPath, JSON.stringify({
  ingested: new Date().toISOString(),
  count: manifest.length,
  cards: manifest,
}, null, 2));

console.log(`wrote ${written} image${written === 1 ? '' : 's'} to ${join(OUT, 'images')}`);
// Never let a filter silently swallow cards — say exactly what was left out.
if (filtered) {
  console.log(`filtered out ${filtered} card${filtered === 1 ? '' : 's'}: `
    + Object.entries(filteredFolders).map(([k, v]) => `${k} ${v}`).join(', '));
}
if (skipped) console.log(`skipped ${skipped} card${skipped === 1 ? '' : 's'} with no usable image`);
console.log(`manifest: ${indexPath}`);
if (prior) console.log(`(replaced a previous manifest of ${prior.count} cards)`);

const byFolder = {};
for (const c of manifest) byFolder[c.folder || 'unfiled'] = (byFolder[c.folder || 'unfiled'] || 0) + 1;
console.log(manifest.length
  ? 'by folder: ' + Object.entries(byFolder).map(([k, v]) => `${k} ${v}`).join(', ')
  : 'nothing imported');
