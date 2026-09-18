// Which cards are actually implemented?
//
//   node tools/coverage.js            summary
//   node tools/coverage.js --missing  list what is still not done
//
// "Implemented" is only a real claim if it is measured. A card counts as
// NEEDS NOTHING when its only ability is the trait triangle, which the engine
// applies from the card data itself. Everything else needs an implementation,
// and this reports whether it has one.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS } from '../js/rules/cards.js';

const argv = process.argv.slice(2);
// The trait triangle, by name OR by its printed wording — the minimal-art
// reprints carry the same ability with no name on it.
const TRIANGLE_NAME = /Overwhelming Strength|Superior Coordination|Armor Piercing/;
const TRIANGLE_TEXT = /has \+I when Attacking (Soldiers|Hunters|Brutes)\.?$/;
const TRIANGLE = {
  test: (a) => TRIANGLE_NAME.test(a?.name || '') || TRIANGLE_TEXT.test(a?.text || ''),
};

const cards = new Map();   // code -> {name, type, abilities[], text}

function add(c) {
  const code = c.code || c.name;
  if (!code || cards.has(code)) return;
  cards.set(code, {
    code, name: c.name, type: c.type,
    abilities: c.abilities || [],
    text: c.text || null,
  });
}

for (const f of readdirSync('cards/decks').filter((x) => x.endsWith('.json'))) {
  for (const c of JSON.parse(readFileSync(join('cards/decks', f), 'utf8')).cards) {
    if (c.type !== 'mat') add(c);
  }
}
for (const f of readdirSync('cards/pools').filter((x) => x.endsWith('.json'))) {
  for (const c of JSON.parse(readFileSync(join('cards/pools', f), 'utf8')).cards) add(c);
}

const rows = [];
for (const c of cards.values()) {
  const named = c.abilities.filter((a) => !TRIANGLE.test(a));
  const needs = named.length > 0 || !!c.text;
  const has = !!CARDS[c.code];
  rows.push({ ...c, needs, has, effects: named.length + (c.text ? 1 : 0) });
}

const nothing = rows.filter((r) => !r.needs);
const done = rows.filter((r) => r.needs && r.has);
const todo = rows.filter((r) => r.needs && !r.has);

console.log(`${rows.length} unique cards`);
console.log(`  ${String(nothing.length).padStart(3)}  need no implementation (trait triangle only)`);
console.log(`  ${String(done.length).padStart(3)}  implemented`);
console.log(`  ${String(todo.length).padStart(3)}  still to do`);
const pct = (done.length / (done.length + todo.length)) * 100;
console.log(`\n${pct.toFixed(0)}% of the cards that need code have it.`);

const byType = {};
for (const r of todo) byType[r.type] = (byType[r.type] || 0) + 1;
if (todo.length) {
  console.log('\nstill to do, by type:');
  for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${t}`);
  }
}

if (argv.includes('--missing')) {
  console.log('\nNOT YET IMPLEMENTED\n');
  for (const r of todo.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))) {
    console.log(`  [${r.type}] ${r.name} (${r.code})`);
    for (const a of r.abilities.filter((x) => !TRIANGLE.test(x))) {
      console.log(`      ${a.name ? a.name + ': ' : ''}${a.text}`);
    }
    if (r.text) console.log(`      ${r.text}`);
  }
}

if (argv.includes('--done')) {
  console.log('\nIMPLEMENTED\n');
  for (const r of done.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${r.name} (${r.code})`);
  }
}
