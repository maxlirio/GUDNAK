// Build site/data/cards.json for the library website.
//
//   node tools/build-sitedata.js
//
// Two shapes come out of this:
//
//   cards[]  one entry per UNIQUE card. Alternate art is the same card with a
//            different picture, so the arts collapse into one entry rather
//            than appearing as separate cards.
//   decks[]  what each deck actually holds, as {uid, count} — the library
//            shows deck names first and only opens a deck on request.
//
// Identity is (name, power, cost, type, abilities, text). Two cards with
// different collector codes but identical everything else are alternate
// printings of one card.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DECKS = 'cards/decks';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function identity(c) {
  const ab = (c.abilities || [])
    .map((a) => `${a.name || ''}|${a.text || ''}`)
    .sort().join('||');
  return [c.name, c.power ?? '', c.cost ?? '', c.type, ab, c.text || ''].join('~');
}

const unique = new Map();   // identity -> card entry
const decks = [];

for (const file of readdirSync(DECKS).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(DECKS, file), 'utf8'));
  const playable = d.cards.filter((c) => c.type !== 'mat');
  if (!playable.length) continue;

  const counts = new Map();   // uid -> { count, codes[] }

  for (const c of playable) {
    const key = identity(c);
    if (!unique.has(key)) {
      unique.set(key, {
        uid: `${slug(c.name)}${c.power ? `-${c.power}` : ''}${c.type !== 'fighter' ? `-${c.type}` : ''}`,
        name: c.name,
        type: c.type,
        kind: c.kind || null,
        power: c.power ?? null,
        cost: c.cost ?? null,
        traits: c.traits || [],
        faction: c.faction || d.faction || null,
        abilities: c.abilities || [],
        text: c.text || null,
        keywords: c.keywords || [],
        trap: !!c.trap,
        arts: [],          // every printing of this card
        decks: [],
      });
    }
    const entry = unique.get(key);

    // One printing per collector code. The same card sits in several decks
    // and therefore has several image files, but that is one piece of art.
    const img = c.file ? c.file.replace('images/', 'cards/').replace(/\.png$/, '') : null;
    const artKey = c.code || img;
    if (img && !entry.arts.some((a) => (a.code || a.img) === artKey)) {
      entry.arts.push({ code: c.code || null, img, credit: c.credit || null });
    }
    if (!entry.decks.includes(d.deck)) entry.decks.push(d.deck);

    const slot = counts.get(entry.uid) || { count: 0, codes: [] };
    slot.count++;
    if (c.code) slot.codes.push(c.code);
    counts.set(entry.uid, slot);
  }

  decks.push({
    deck: d.deck,
    faction: d.faction || null,
    legal: d.legal === true,
    note: d.note || null,
    incomplete: d.incomplete || null,
    entries: [...counts.entries()].map(([uid, v]) => ({ uid, count: v.count, codes: v.codes })),
  });
}

// uid must be unique; if identity collapsed two genuinely different cards onto
// the same slug, say so loudly rather than silently merging them in the UI.
const byUid = new Map();
for (const c of unique.values()) {
  if (byUid.has(c.uid)) console.error(`! uid collision: ${c.uid} (${byUid.get(c.uid).name} vs ${c.name})`);
  byUid.set(c.uid, c);
}

const cards = [...unique.values()].sort((a, b) =>
  (a.faction || '').localeCompare(b.faction || '')
  || (a.power ?? 9) - (b.power ?? 9)
  || a.name.localeCompare(b.name));

mkdirSync('site/data', { recursive: true });
writeFileSync('site/data/cards.json', JSON.stringify({ cards, decks }, null, 1));

const withAlts = cards.filter((c) => c.arts.length > 1);
console.log(`${cards.length} unique cards (${withAlts.length} with alternate art)`);
for (const c of withAlts) console.log(`   ${c.name} — ${c.arts.length} printings: ${c.arts.map((a) => a.code).join(', ')}`);
for (const d of decks) {
  const total = d.entries.reduce((n, e) => n + e.count, 0);
  console.log(`  ${String(total).padStart(2)} cards (${d.entries.length} distinct)  ${d.deck}`);
}
