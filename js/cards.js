// Card data.
//
// ENGINE-FIRST: there is no real card content here yet, by design. What ships
// is (a) the definition shape every future card will use, (b) deck-legality
// checking against the real construction rules, and (c) a vanilla fixture set
// the playtest harness beats on. Nothing here is meant to be a game.

/**
 * A card definition:
 *   id        unique string key
 *   name      display name
 *   type      'fighter' | 'tactic'
 *   kind      'basic' | 'hero'        (fighters only)
 *   power     1 | 2 | 3               (fighters only)
 *   cost      0 | 1 | 2               (tactics only)
 *   traits    subset of engine TRAITS
 *   faction   faction key, or 'Neutral'
 *   abilities array of ability descriptors:
 *               { k:'bonusVsTrait', trait, amount }  constant, attack only
 *               { k:'action', ... }                  costs an action
 *               { k:'deploy', ... }                  on the Deploy action
 */

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };

// The trait triangle is printed on basic fighters, not a global rule — a Hero
// with the Soldier trait gets no bonus. Modelling it per-card keeps that true.
export const PREY = { Brute: 'Soldier', Soldier: 'Hunter', Hunter: 'Brute' };

function basic(trait, power) {
  return {
    id: `t_${trait.toLowerCase()}${power}`,
    name: `${trait} ${ROMAN[power]}`,
    type: 'fighter',
    kind: 'basic',
    power,
    traits: [trait],
    faction: 'Neutral',
    abilities: PREY[trait] ? [{ k: 'bonusVsTrait', trait: PREY[trait], amount: 1 }] : [],
  };
}

function hero(n, power) {
  return {
    id: `t_hero${n}`,
    name: `Test Hero ${n} (${ROMAN[power]})`,
    type: 'fighter',
    kind: 'hero',
    power,
    traits: ['Hero'],
    faction: 'Neutral',
    abilities: [],       // deliberately vanilla: no card content yet
  };
}

export const TEST_DEFS = {};
for (const trait of ['Brute', 'Soldier', 'Hunter']) {
  for (const power of [1, 2, 3]) {
    const d = basic(trait, power);
    TEST_DEFS[d.id] = d;
  }
}
[[1, 3], [2, 2], [3, 2], [4, 1], [5, 1]].forEach(([n, p]) => {
  const d = hero(n, p);
  TEST_DEFS[d.id] = d;
});

/**
 * A 20-card fixture. NOT tournament-legal: the five Tactic slots are filled
 * with fighters because no tactics exist yet. validateDeck() will say so.
 */
export const TEST_DECK = [
  // 10 basics, legal on their own: 2x III (max 1 per trait),
  // 4x II and 4x I (max 2 per trait).
  't_brute3', 't_soldier3',
  't_brute2', 't_brute2', 't_hunter2', 't_hunter2',
  't_soldier1', 't_soldier1', 't_hunter1', 't_hunter1',
  // 5 heroes: 1x III, 2x II, 2x I.
  't_hero1', 't_hero2', 't_hero3', 't_hero4', 't_hero5',
  // 5 stand-ins for the Tactic slots.
  't_brute1', 't_brute1', 't_soldier2', 't_soldier2', 't_hunter3',
];

/**
 * Deck legality per docs/RULES.md. Returns a list of problems; empty is legal.
 * Already enforces the real rules so card content can be checked the day it
 * arrives.
 */
export function validateDeck(ids, defs) {
  const problems = [];
  const cards = ids.map((id) => {
    const d = defs[id];
    if (!d) problems.push(`unknown card "${id}"`);
    return d;
  }).filter(Boolean);

  if (ids.length !== 20) problems.push(`deck has ${ids.length} cards, must be exactly 20`);

  const heroes = cards.filter((c) => c.type === 'fighter' && c.kind === 'hero');
  const tactics = cards.filter((c) => c.type === 'tactic');
  const basics = cards.filter((c) => c.type === 'fighter' && c.kind === 'basic');

  if (heroes.length !== 5) problems.push(`${heroes.length} Heroes, must be 5`);
  if (tactics.length !== 5) problems.push(`${tactics.length} Tactics, must be 5`);
  if (basics.length !== 10) problems.push(`${basics.length} Basic Fighters, must be 10`);

  const count = (arr, p) => arr.filter((c) => c.power === p).length;
  if (count(heroes, 3) !== 1) problems.push(`Heroes: ${count(heroes, 3)} at III, must be 1`);
  if (count(heroes, 2) !== 2) problems.push(`Heroes: ${count(heroes, 2)} at II, must be 2`);
  if (count(heroes, 1) !== 2) problems.push(`Heroes: ${count(heroes, 1)} at I, must be 2`);
  if (count(basics, 3) !== 2) problems.push(`Basics: ${count(basics, 3)} at III, must be 2`);
  if (count(basics, 2) !== 4) problems.push(`Basics: ${count(basics, 2)} at II, must be 4`);
  if (count(basics, 1) !== 4) problems.push(`Basics: ${count(basics, 1)} at I, must be 4`);

  // Trait maxima within a power band. Traitless basics are exempt.
  for (const [power, max] of [[3, 1], [2, 2], [1, 2]]) {
    const tally = {};
    for (const c of basics.filter((x) => x.power === power)) {
      for (const t of c.traits || []) tally[t] = (tally[t] || 0) + 1;
    }
    for (const [t, n] of Object.entries(tally)) {
      if (n > max) problems.push(`Basics at ${ROMAN[power]}: ${n}x ${t}, max ${max}`);
    }
  }

  // Singleton rule for Heroes and Tactics.
  const singles = {};
  for (const c of [...heroes, ...tactics]) singles[c.id] = (singles[c.id] || 0) + 1;
  for (const [id, n] of Object.entries(singles)) {
    if (n > 1) problems.push(`${n} copies of ${defs[id].name}, max 1`);
  }

  // One faction plus Neutral.
  const factions = new Set(cards.map((c) => c.faction).filter((f) => f !== 'Neutral'));
  if (factions.size > 1) problems.push(`mixes factions: ${[...factions].join(', ')}`);

  return problems;
}
