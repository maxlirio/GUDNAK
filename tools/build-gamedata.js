// Turn the card readings into something js/engine.js can actually play with.
//
//   node tools/build-gamedata.js   ->  game/data/decks.json
//
// The engine knows two card types, 'fighter' and 'tactic'. Constructs and
// Attachments occupy Tactic slots in a real deck, so they come across with
// their real type recorded for display. A card is flagged `inert` only if it
// needs code and js/rules/cards.js has none for it — so the table can say so
// out loud rather than pretending.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { CARDS } from '../js/rules/cards.js';
import { join } from 'node:path';

const DECKS = 'cards/decks';
const SLOT_TYPES = new Set(['tactic', 'construct', 'attachment']);

const defs = {};
const decks = [];

for (const file of readdirSync(DECKS).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(DECKS, file), 'utf8'));
  // The engine only deals the 20; strongholds and locations are set aside.
  const playable = d.cards.filter((c) => !['mat', 'stronghold', 'location'].includes(c.type));
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

    // "inert" means the engine will not do what the card says. Now that the
    // cards are implemented, that is a question for the registry, not a guess
    // from the card type.
    const needsCode = (c.abilities || []).some((a) => !a.bonusVsTrait) || !!c.text;
    const hasUnimplemented = needsCode && !CARDS[id];

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
      // The Void is set up before the game if any card brought to it mentions
      // it. An explicit flag beats searching the serialised def for a string.
      usesVoid: /The Void/.test(JSON.stringify(c)),
      // no extension: the table wants <img>.jpg, the hand wants <img>.thumb.jpg
      img: c.file ? c.file.replace('images/', 'cards/').replace(/\.png$/, '') : null,
    };
  }

  // A Stronghold comes from outside the 20 and is set up before the game.
  const sh = d.cards.find((c) => c.type === 'stronghold');
  if (sh) {
    const id = sh.code || sh.name;
    if (!defs[id]) {
      defs[id] = {
        id, name: sh.name, type: 'stronghold', realType: 'stronghold',
        kind: null, power: sh.power ?? null, traits: sh.traits || [],
        faction: sh.faction || d.faction || null, abilities: [],
        rules: (sh.abilities || []).map((a) => ({ k: a.k, name: a.name || null, text: a.text })),
        text: null, keywords: [], inert: false,
        img: sh.file ? sh.file.replace('images/', 'cards/').replace(/\.png$/, '') : null,
      };
    }
  }

  decks.push({
    name: d.deck,
    faction: (d.faction || '').replace(/\s*\(.*$/, ''),
    legal: d.legal === true,
    stronghold: sh ? (sh.code || sh.name) : null,
    cards: ids,
  });
}

/* ------------------------------------------------------------ tokens */
//
// Cards that come FROM OUTSIDE THE GAME. They are in nobody's deck and nobody's
// collection — a card makes one when it needs one. Convicted of Heresy is the
// first; other factions bring more, so this is a table rather than a special
// case buried in one card's code.

const TOKENS = {
  A051: {
    id: 'A051',
    name: 'Convicted of Heresy',
    type: 'attachment', realType: 'attachment', kind: 'basic',
    power: null, traits: [], faction: 'Refractory',
    cost: 0,
    abilities: [],
    rules: [
      { k: 'passive', name: null,
        text: 'When this fighter would be destroyed while being Attacked on your turn, '
          + 'put it underneath target fighter you control instead.' },
      { k: 'constant', name: null,
        text: 'Hunters you control may Attack this fighter while fatigued.' },
    ],
    text: 'Attach to an enemy fighter.',
    keywords: [], inert: false,
    token: true, fromOutsideGame: true, maxInPlay: 2,
    img: 'cards/tokens/convicted-of-heresy',
  },
};
for (const [id, def] of Object.entries(TOKENS)) defs[id] = def;

mkdirSync('game/data', { recursive: true });
writeFileSync('game/data/decks.json', JSON.stringify({ defs, decks }, null, 1));

const inert = Object.values(defs).filter((d) => d.inert).length;
console.log(`${Object.keys(defs).length} card definitions, ${decks.length} decks`);
console.log(inert
  ? `${inert} still have effects the engine does not implement (playable but inert)`
  : 'every card with an effect has an implementation');
for (const d of decks) console.log(`  ${d.cards.length.toString().padStart(2)}  ${d.name}`);
