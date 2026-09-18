// Prove the multiplayer invariant.
//
//   node tools/checklockstep.js --games 300
//
// Online play sends MOVES, never the board. That only works if two engines,
// given the same setup and the same ordered moves, stay byte-identical. This
// runs two independent games side by side — as if on two machines — feeds them
// the same decisions, and compares the full state hash after EVERY move.
//
// A desync here is a desync in the real game, and it would show up as two
// players looking at different boards.

import { readFileSync } from 'node:fs';
import { createGame, legalActions, apply, choose, hashState } from '../js/engine.js';
import { CARDS } from '../js/rules/cards.js';

const argv = process.argv.slice(2);
const GAMES = Number(argv[argv.indexOf('--games') + 1]) || 300;

const data = JSON.parse(readFileSync('game/data/decks.json', 'utf8'));
const { defs, decks } = data;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(setup) {
  const a = decks.find((d) => d.name === setup.decks[0]);
  const b = decks.find((d) => d.name === setup.decks[1]);
  return createGame({
    seed: setup.seed, defs, impls: CARDS,
    decks: [a.cards, b.cards],
    strongholds: [a.stronghold || null, b.stronghold || null],
    first: setup.first,
  });
}

function answer(req, rng) {
  const pickFrom = (arr) => arr[Math.floor(rng() * arr.length)];
  switch (req.type) {
    case 'one': return req.options.length ? pickFrom(req.options) : null;
    case 'some': {
      const pool = [...req.options], out = [];
      for (let i = 0; i < Math.min(req.count, pool.length); i++) {
        out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      }
      return out;
    }
    case 'pick': return req.options.length ? pickFrom(req.options) : null;
    case 'confirm': return rng() < 0.5;
    default: return null;
  }
}

const problems = [];
let moves = 0;
let finished = 0;

const pairs = [];
for (let i = 0; i < decks.length; i++) {
  for (let j = 0; j < decks.length; j++) if (i !== j) pairs.push([decks[i].name, decks[j].name]);
}

for (let g = 0; g < GAMES; g++) {
  const [d0, d1] = pairs[g % pairs.length];
  const setup = { seed: 9000 + g, decks: [d0, d1], first: g % 2 };

  // two machines
  const A = build(setup);
  const B = build(setup);

  if (hashState(A) !== hashState(B)) {
    problems.push(`seed ${setup.seed}: the two games differ before a single move`);
    continue;
  }

  const rng = mulberry32(setup.seed * 31 + 17);
  let guard = 0;

  while (A.winner === null && guard++ < 4000) {
    let move;
    if (A.pending) {
      // The player whose choice it is decides on THEIR machine; the answer is
      // what crosses the wire.
      move = { k: 'choice', answer: answer(A.pending.request, rng) };
    } else {
      const acts = legalActions(A);
      if (!acts.length) break;
      move = { k: 'action', action: acts[Math.floor(rng() * acts.length)] };
    }

    try {
      if (move.k === 'action') apply(A, move.action); else choose(A, move.answer);
    } catch (e) {
      problems.push(`seed ${setup.seed}: local apply threw — ${e.message}`);
      break;
    }
    try {
      if (move.k === 'action') apply(B, move.action); else choose(B, move.answer);
    } catch (e) {
      problems.push(`seed ${setup.seed}: remote apply threw — ${e.message}`);
      break;
    }
    moves++;

    const ha = hashState(A), hb = hashState(B);
    if (ha !== hb) {
      problems.push(`seed ${setup.seed}: DESYNC after ${move.k} ${move.action?.t || ''} `
        + `(turn ${A.turn})\n      A ${ha}\n      B ${hb}`);
      break;
    }
    // the pending state has to match too, or the two sides would be asked
    // different questions
    const pa = A.pending ? JSON.stringify(A.pending.request) : '';
    const pb = B.pending ? JSON.stringify(B.pending.request) : '';
    if (pa !== pb) {
      problems.push(`seed ${setup.seed}: the two sides are being asked different questions`);
      break;
    }
  }

  if (A.winner !== B.winner) {
    problems.push(`seed ${setup.seed}: different winners — ${A.winner} vs ${B.winner}`);
  }
  if (A.winner !== null) finished++;
}

console.log(`${GAMES} games replayed on two independent engines`);
console.log(`  ${moves} moves compared, ${finished} games reached an ending`);

if (problems.length) {
  console.log(`\nFAIL — ${problems.length} lockstep problems`);
  for (const p of problems.slice(0, 12)) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\nOK — the two engines never disagreed');
