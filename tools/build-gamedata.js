// Turn the card readings into something js/engine.js can actually play with.
//
//   node tools/build-gamedata.js   ->  game/data/decks.json
//
// The engine knows two card types, 'fighter' and 'tactic'. Constructs and
// Attachments occupy Tactic slots in a real deck, so they come across as
// tactics and keep their real type for display. Their effects are NOT
// implemented — they are playable and inert, and flagged `inert` so the table
// can say so out loud rather than pretending.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DECKS = 'cards/decks';
const SLOT_TYPES = new Set(['tactic', 'construct', 'attachment']);

const defs = {};
const decks = [];

for (const file of readdirSync(DECKS).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(DECKS, file), 'utf8'));
  const playable = d.cards.filter((c) => c.type !== 'mat');
  if (!playable.length) continue;

  const ids = [];
  for (const c of playable) {
    const id = c.code || c.name;
    ids.push(id);
    if (defs[id]) continue;

    // Only the trait-triangle bonus is a rule the engine understands. Action
    // and deployment abilities are carried for display only — emitting them as
    // engine abilities would offer moves that cannot resolve.
    const engineAbilities = (c.abilities || [])
      .filter((a) => a.bonusVsTrait)
      .map((a) => ({ k: 'bonusVsTrait', trait: a.bonusVsTrait, amount: a.amount }));

    const hasUnimplemented = (c.abilities || []).some((a) => !a.bonusVsTrait)
      || (SLOT_TYPES.has(c.type) && c.type !== 'tactic')
      || (c.type === 'tactic');

    defs[id] = {
      id,
      name: c.name,
      type: c.type === 'fighter' ? 'fighter' : 'tactic',
      realType: c.type,
      kind: c.kind || null,
      power: c.power ?? null,
      cost: SLOT_TYPES.has(c.type) ? (c.cost ?? 1) : undefined,
      traits: c.traits || [],
      faction: c.faction || d.faction || null,
      abilities: engineAbilities,
      // display-only
      rules: (c.abilities || []).map((a) => ({ k: a.k, name: a.name || null, text: a.text })),
      text: c.text || null,
      keywords: c.keywords || [],
      inert: hasUnimplemented,
      // no extension: the table wants <img>.jpg, the hand wants <img>.thumb.jpg
      img: c.file ? c.file.replace('images/', 'cards/').replace(/\.png$/, '') : null,
    };
  }

  decks.push({
    name: d.deck,
    faction: (d.faction || '').replace(/\s*\(.*$/, ''),
    legal: d.legal === true,
    cards: ids,
  });
}

mkdirSync('game/data', { recursive: true });
writeFileSync('game/data/decks.json', JSON.stringify({ defs, decks }, null, 1));

const inert = Object.values(defs).filter((d) => d.inert).length;
console.log(`${Object.keys(defs).length} card definitions, ${decks.length} decks`);
console.log(`${inert} have effects the engine does not implement yet (playable but inert)`);
for (const d of decks) console.log(`  ${d.cards.length.toString().padStart(2)}  ${d.name}`);
