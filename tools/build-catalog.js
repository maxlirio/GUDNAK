// Fold the per-deck readings into a faction-divided catalog.
//
//   node tools/build-catalog.js
//
// Writes cards/by-faction/<faction>.json (unique cards, deduped by collector
// code) and cards/catalog.json (everything, plus a legality report per deck).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DECKS = 'cards/decks';
const SLOT = new Set(['tactic', 'construct', 'attachment']);

const decks = readdirSync(DECKS).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(DECKS, f), 'utf8')));

const byFaction = {};
const report = [];

for (const d of decks) {
  const playable = d.cards.filter((c) => c.type !== 'mat');
  const count = (pred) => playable.filter(pred).length;
  const spread = (kind) => [1, 2, 3].map((p) =>
    count((c) => c.kind === kind && c.power === p)).join('/');

  report.push({
    deck: d.deck,
    faction: d.faction || null,
    cards: playable.length,
    basics: spread('basic'),          // I/II/III, must be 4/4/2
    heroes: spread('hero'),           // I/II/III, must be 2/2/1
    tacticSlots: count((c) => SLOT.has(c.type)),   // must be 5
    mats: d.cards.length - playable.length,
    legal: d.legal === true,
    missing: d.incomplete ? d.incomplete.missing : null,
  });

  // A card's own faction overrides the deck's (Neutrals live in every deck).
  for (const c of playable) {
    const f = c.faction || (d.faction || 'Unknown').replace(/ \(.*\)$/, '');
    (byFaction[f] ||= new Map()).set(c.code || c.name, { ...c, decks: [] });
  }
}

// Record which decks each card turned up in.
for (const d of decks) {
  for (const c of d.cards.filter((x) => x.type !== 'mat')) {
    const f = c.faction || (d.faction || 'Unknown').replace(/ \(.*\)$/, '');
    const entry = byFaction[f].get(c.code || c.name);
    if (entry && !entry.decks.includes(d.deck)) entry.decks.push(d.deck);
  }
}

mkdirSync('cards/by-faction', { recursive: true });
const summary = [];
for (const [faction, map] of Object.entries(byFaction)) {
  const cards = [...map.values()].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  writeFileSync(join('cards/by-faction', `${faction.toLowerCase()}.json`),
    JSON.stringify({ faction, uniqueCards: cards.length, cards }, null, 2));
  summary.push({ faction, unique: cards.length });
}

writeFileSync('cards/catalog.json', JSON.stringify({
  built: new Date().toISOString(), decks: report, factions: summary,
}, null, 2));

console.log('DECK                          FACTION      N   basics  heroes  slots  status');
for (const r of report) {
  const status = r.legal ? 'legal' : (r.missing ? 'incomplete' : '-');
  console.log(
    `${r.deck.padEnd(29)} ${(r.faction || '').padEnd(12)} ${String(r.cards).padStart(2)}  `
    + `${r.basics.padEnd(7)} ${r.heroes.padEnd(7)} ${String(r.tacticSlots).padStart(3)}    ${status}`);
}
console.log('\nunique cards per faction:');
for (const s of summary.sort((a, b) => b.unique - a.unique)) console.log(`  ${s.unique.toString().padStart(3)}  ${s.faction}`);
