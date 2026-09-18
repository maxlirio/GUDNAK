// Inventory every ability and Tactic on every card, so the work of
// implementing them can be sized and grouped rather than guessed at.
//
//   node tools/scan-abilities.js            summary by mechanism
//   node tools/scan-abilities.js --full     every distinct text, grouped
//   node tools/scan-abilities.js --verbs    the verb vocabulary, with counts
//
// Nothing here changes behaviour. It reads cards/decks/*.json and reports.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DECKS = 'cards/decks';
const argv = process.argv.slice(2);

/* Every effect the card pool actually asks for, as a probe against the text.
 * Order matters only for reporting; a text can match several. */
const MECHANISMS = [
  ['destroy',        /\bdestroy(s|ed)?\b/i],
  ['deploy',         /\bdeploy\b/i],
  ['relocate',       /\brelocate/i],
  ['move',           /\bmove(s|d)?\b/i],
  ['to-hand',        /into (their|your|its) owners?'? ?hand|into your hand/i],
  ['from-graveyard', /from (your|their|its owner'?s?) graveyard/i],
  ['to-graveyard',   /into (your|their) graveyard/i],
  ['discard',        /\bdiscard/i],
  ['draw',           /\bdraw\b/i],
  ['reveal',         /\breveal/i],
  ['deck-order',     /top of (your|their|target opponent'?s?) deck|bottom of your deck|shuffle your deck/i],
  ['power-mod',      /\+I\b|power is equal|printed power|becomes? a I\b|considered Basic/i],
  ['stack',          /underneath|on top of|in (a|that|target) stack|within stacks/i],
  ['fatigue',        /fatigue|starts its owner'?s next turn fatigued/i],
  ['gain-action',    /gain an action|gain actions/i],
  ['extra-attack',   /Attack an additional time|may Attack/i],
  ['grant-trait',    /gains? (Hunter|Soldier|Brute|the trait|the abilities)/i],
  ['grant-ability',  /gains? "|gains the abilities/i],
  ['block-entry',    /cannot (Move or be relocated|enter)/i],
  ['cannot-attack',  /cannot be Attacked|cannot Attack/i],
  ['attachment',     /\bAttach to\b/i],
  ['trap',           /facedown|Triggered/i],
  ['token',          /Convicted of Heresy|Play a Convicted|Play 2 Convicted/i],
  ['song',           /\bSong:/i],
  ['range',          /squares away|non-adjacent/i],
  ['area',           /all adjacent|adjacent to this fighter|all Is\b|all Is and IIs/i],
  ['forced-attack',  /Attacks target adjacent/i],
  ['replacement',    /instead of|instead\./i],
  ['once-per-turn',  /more than once per turn|not choose the same/i],
];

const rows = [];
const seenCard = new Set();

for (const file of readdirSync(DECKS).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(DECKS, file), 'utf8'));
  for (const c of d.cards) {
    if (c.type === 'mat') continue;
    const id = c.code || c.name;
    if (seenCard.has(id)) continue;
    seenCard.add(id);

    const items = [];
    for (const a of c.abilities || []) {
      items.push({ kind: a.k, name: a.name || null, text: a.text || '' });
    }
    if (c.text) items.push({ kind: c.type === 'tactic' ? 'tactic' : 'text', name: null, text: c.text });

    for (const it of items) {
      rows.push({
        card: c.name, code: c.code, type: c.type, kind: it.kind,
        ability: it.name, text: it.text,
        mechanisms: MECHANISMS.filter(([, re]) => re.test(it.text)).map(([k]) => k),
      });
    }
  }
}

/* ------------------------------------------------------------ reports */

const byMech = {};
for (const r of rows) {
  for (const m of r.mechanisms) (byMech[m] ||= []).push(r);
  if (!r.mechanisms.length) (byMech['UNCLASSIFIED'] ||= []).push(r);
}

// The trait triangle is already implemented, so separate it out — otherwise it
// dominates the counts and hides the real work.
const isTriangle = (r) => /Overwhelming Strength|Superior Coordination|Armor Piercing/.test(r.ability || '');
const work = rows.filter((r) => !isTriangle(r));

console.log(`${seenCard.size} unique cards`);
console.log(`${rows.length} abilities and effects total`);
console.log(`${rows.length - work.length} are the trait triangle (already implemented)`);
console.log(`${work.length} still to implement\n`);

console.log('BY ABILITY KIND');
const byKind = {};
for (const r of work) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${k}`);
}

console.log('\nBY MECHANISM (a text can need several)');
const mechCounts = Object.entries(byMech)
  .map(([m, rs]) => [m, rs.filter((r) => !isTriangle(r)).length])
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1]);
for (const [m, n] of mechCounts) console.log(`  ${String(n).padStart(3)}  ${m}`);

if (argv.includes('--verbs')) {
  const verbs = {};
  for (const r of work) {
    for (const w of (r.text.match(/\b[A-Z][a-z]+\b/g) || [])) {
      if (['This', 'The', 'If', 'When', 'After', 'Then', 'You', 'Put', 'Each', 'Choose',
           'Target', 'While', 'Before', 'All', 'Song', 'Play', 'Enemy', 'Your',
           'Basic', 'Hero', 'Heroes', 'Construct', 'Constructs', 'Tactic', 'Tactics',
           'Graveyard', 'Battlefield', 'Back', 'Row', 'Gates', 'Stronghold', 'Attacking',
           'Attacked', 'Attacks', 'Attack', 'Moves', 'Move', 'Deploy', 'Brutes', 'Soldiers',
           'Hunters', 'Brute', 'Soldier', 'Hunter', 'Singing', 'Triggered'].includes(w)) continue;
      verbs[w] = (verbs[w] || 0) + 1;
    }
  }
  console.log('\nVOCABULARY');
  for (const [w, n] of Object.entries(verbs).sort((a, b) => b[1] - a[1]).slice(0, 45)) {
    console.log(`  ${String(n).padStart(3)}  ${w}`);
  }
}

if (argv.includes('--full')) {
  console.log('\nEVERY EFFECT STILL TO IMPLEMENT\n');
  const groups = {};
  for (const r of work) {
    const key = r.mechanisms[0] || 'UNCLASSIFIED';
    (groups[key] ||= []).push(r);
  }
  for (const [g, rs] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n=== ${g} (${rs.length}) ===`);
    for (const r of rs) {
      console.log(`  [${r.kind}] ${r.card}${r.ability ? ` — ${r.ability}` : ''} (${r.code})`);
      console.log(`      ${r.text}`);
    }
  }
}
