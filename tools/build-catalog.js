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

  // Trait maxima (1 per trait at III, 2 at II and I; traitless exempt) and the
  // singleton rule for Heroes and Tactic-slot cards. "legal" is worth nothing
  // if it only means the counts add up.
  const violations = [];
  for (const [power, max] of [[3, 1], [2, 2], [1, 2]]) {
    const tally = {};
    for (const c of playable.filter((x) => x.kind === 'basic' && x.power === power)) {
      for (const t of c.traits || []) tally[t] = (tally[t] || 0) + 1;
    }
    for (const [t, n] of Object.entries(tally)) {
      if (n > max) violations.push(`${n}x ${t} among the power-${power} basics (max ${max})`);
    }
  }
  const singles = {};
  for (const c of playable.filter((x) => x.kind === 'hero' || SLOT.has(x.type))) {
    const k = c.code || c.name;
    singles[k] = (singles[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(singles)) {
    if (n > 1) violations.push(`${n} copies of ${k} (Heroes and Tactics are max 1)`);
  }

  report.push({
    deck: d.deck,
    violations,
    faction: d.faction || null,
    cards: playable.length,
    basics: spread('basic'),          // I/II/III, must be 4/4/2
    heroes: spread('hero'),           // I/II/III, must be 2/2/1
    tacticSlots: count((c) => SLOT.has(c.type)),   // must be 5
    mats: d.cards.length - playable.length,
    legal: d.legal === true && violations.length === 0,
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
let bad = 0;
for (const r of report) {
  const status = r.violations.length ? 'ILLEGAL' : r.legal ? 'legal' : (r.missing ? 'incomplete' : '-');
  if (r.violations.length) bad++;
  console.log(
    `${r.deck.padEnd(29)} ${(r.faction || '').padEnd(12)} ${String(r.cards).padStart(2)}  `
    + `${r.basics.padEnd(7)} ${r.heroes.padEnd(7)} ${String(r.tacticSlots).padStart(3)}    ${status}`);
  for (const v of r.violations) console.log(`${' '.repeat(31)}! ${v}`);
}
if (bad) console.log(`\n${bad} deck(s) break a deck-building rule.`);
console.log('\nunique cards per faction:');
for (const s of summary.sort((a, b) => b.unique - a.unique)) console.log(`  ${s.unique.toString().padStart(3)}  ${s.faction}`);
