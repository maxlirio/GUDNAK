// Playtest the REAL decks with the REAL card implementations.
//
//   node tools/playtest.js --games 200
//   node tools/playtest.js --games 50 --verbose
//   node tools/playtest.js --pair "The Masked" "Bolts of Destruction"
//
// tools/simulate.js beats on the engine with vanilla fighters. This one beats
// on the CARDS: every deck plays every other deck, choices are answered at
// random, and the same invariants are asserted after every decision — plus a
// count of which card implementations actually fired, so "implemented" is a
// measured claim rather than a hopeful one.

import { readFileSync } from 'node:fs';
import {
  createGame, legalActions, apply, choose, cloneState, defOf,
  topOf, isSieged, gatesOf, powerOf,
} from '../js/engine.js';
import { CARDS } from '../js/rules/cards.js';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const GAMES = Number(flag('games', 200));
const VERBOSE = argv.includes('--verbose');
const PAIR = argv.indexOf('--pair') >= 0
  ? [argv[argv.indexOf('--pair') + 1], argv[argv.indexOf('--pair') + 2]] : null;

const data = JSON.parse(readFileSync('game/data/decks.json', 'utf8'));
const defs = data.defs;
const decks = data.decks;

const failures = [];
const fired = new Set();
const errors = new Map();

function note(map, key) { map.set(key, (map.get(key) || 0) + 1); }

function check(cond, msg, ctx) {
  if (!cond) failures.push(`${msg}  [${ctx}]`);
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ invariants */

function invariants(state, where) {
  const seen = new Map();
  const counts = [0, 0];

  const visit = (card, loc) => {
    if (seen.has(card.uid)) {
      check(false, `card ${card.uid} in two places: ${seen.get(card.uid)} and ${loc}`, where);
    }
    seen.set(card.uid, loc);
    // Tokens come FROM OUTSIDE THE GAME — Convicted of Heresy is made by the
    // card that plays it — so they are tracked for duplication but must not be
    // counted against the deck you started with.
    if (!card.token) counts[card.owner]++;
    for (const a of card.attachments || []) visit(a, `${loc}/attachment`);
  };

  state.board.forEach((sq, i) => (sq || []).forEach((c, d) => visit(c, `board[${i}][${d}]`)));
  if (state.resolving) visit(state.resolving, 'resolving');
  for (const c of state.constructs || []) if (c) visit(c, `construct@${c.square}`);
  for (let p = 0; p < 2; p++) {
    const sh = state.strongholds[p];
    if (sh?.card && sh.revealed === false) visit(sh.card, `stronghold${p}`);
    // Beside the Stronghold is a real place a card can be, and the only card
    // that is ever there is New Moon waiting to turn over.
    if (state.beside?.[p]?.card) visit(state.beside[p].card, `beside${p}`);
    // Removed from the game is still a place the card IS.
    for (const c of state.removed?.[p] || []) visit(c, `P${p}.removed`);
    for (const zone of ['deck', 'hand', 'graveyard']) {
      for (const c of state.players[p][zone]) visit(c, `P${p}.${zone}`);
    }
  }

  // Every card that started the game is still somewhere.
  check(counts[0] === state.startCount[0],
    `P0 has ${counts[0]} cards, expected ${state.startCount[0]}`, where);
  check(counts[1] === state.startCount[1],
    `P1 has ${counts[1]} cards, expected ${state.startCount[1]}`, where);

  check(state.actionsLeft >= 0, `actionsLeft = ${state.actionsLeft}`, where);

  // Gates must always be real squares, and Back Row must contain them.
  for (let p = 0; p < 2; p++) {
    for (const g of gatesOf(state, p)) {
      check(Number.isInteger(g) && g >= 0 && g < state.board.length, `gate ${g} out of range`, where);
      check(state.backRow[p].includes(g), `gate ${g} not in P${p} back row`, where);
    }
  }

  // Nothing with zero or negative power should ever be on the board.
  for (const sq of state.board) {
    for (const c of sq || []) {
      const p = powerOf(state, c);
      check(p >= 0 && p <= 12, `${defs[c.def]?.name} has power ${p}`, where);
    }
  }

  if (state.derivationErrors?.length) {
    for (const e of state.derivationErrors) note(errors, `derive ${e}`);
    state.derivationErrors = [];
  }
  if (state.triggerErrors?.length) {
    for (const e of state.triggerErrors) note(errors, `trigger ${e}`);
    state.triggerErrors = [];
  }
}

/* ------------------------------------------------------------ answering */

function answerRequest(req, rng) {
  const pickFrom = (arr) => arr[Math.floor(rng() * arr.length)];
  switch (req.type) {
    case 'one':
      if (!req.options.length) return null;
      if (req.allowNone && rng() < 0.25) return null;
      return pickFrom(req.options);
    case 'some': {
      const pool = [...req.options];
      const out = [];
      const want = Math.min(req.count, pool.length);
      for (let i = 0; i < want; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      return out;
    }
    case 'pick':
      return req.options.length ? pickFrom(req.options) : null;
    case 'confirm':
      return rng() < 0.5;
    default:
      return null;
  }
}

/* ------------------------------------------------------------ run */

function playGame(deckA, deckB, seed) {
  const rng = mulberry32(seed * 6151 + 7);
  const shA = deckA.stronghold || null;
  const shB = deckB.stronghold || null;

  const state = createGame({
    seed, defs, decks: [deckA.cards, deckB.cards],
    strongholds: [shA, shB], impls: CARDS,
  });
  // A deck holding Scylla also brings New Moon, which sits beside the
  // Stronghold from setup and later turns over into Charybdis. It is a card
  // that player started with, so it counts — restated here from the deck list
  // rather than read off the state, because an independent count is the whole
  // point of this check.
  const moon = (cards) => (cards.includes('M003') && defs.M046 ? 1 : 0);
  state.startCount = [
    deckA.cards.length + (shA ? 1 : 0) + moon(deckA.cards),
    deckB.cards.length + (shB ? 1 : 0) + moon(deckB.cards),
  ];

  invariants(state, `${deckA.name} vs ${deckB.name} seed ${seed} setup`);

  let guard = 0;
  while (state.winner === null) {
    if (++guard > 20000) { failures.push(`no end after 20000 decisions [${seed}]`); break; }

    if (state.pending) {
      const ans = answerRequest(state.pending.request, rng);
      try {
        choose(state, ans);
      } catch (e) {
        note(errors, `choose: ${e.message}`);
        break;
      }
      invariants(state, `after choice seed ${seed}`);
      continue;
    }

    const acts = legalActions(state);
    if (!acts.length) { failures.push(`no legal actions, game not over [${seed}]`); break; }
    const action = acts[Math.floor(rng() * acts.length)];

    try {
      apply(state, action);
    } catch (e) {
      note(errors, `apply ${action.t}: ${e.message}`);
      break;
    }
    invariants(state, `after ${action.t} seed ${seed}`);
  }
  // the engine records every implementation that actually ran — constants and
  // triggers included, which a hand-played count misses entirely
  for (const def of Object.keys(state.implsUsed || {})) if (CARDS[def]) fired.add(def);
  return state;
}

function findAnywhere(state, uid) {
  for (const sq of state.board) for (const c of sq || []) if (c.uid === uid) return c;
  for (const c of state.constructs || []) if (c && c.uid === uid) return c;
  return null;
}

/* ------------------------------------------------------------ main */

const pairs = [];
if (PAIR) {
  pairs.push([decks.find((d) => d.name === PAIR[0]), decks.find((d) => d.name === PAIR[1])]);
} else {
  for (let i = 0; i < decks.length; i++) {
    for (let j = 0; j < decks.length; j++) if (i !== j) pairs.push([decks[i], decks[j]]);
  }
}

const results = { wins: 0, losses: 0, other: 0, turns: [] };
let played = 0;
for (let g = 0; g < GAMES; g++) {
  const [a, b] = pairs[g % pairs.length];
  if (!a || !b) continue;
  const st = playGame(a, b, 1000 + g);
  played++;
  if (st.winner === 0) results.wins++;
  else if (st.winner === 1) results.losses++;
  else results.other++;
  results.turns.push(st.turn);
  if (VERBOSE && g === 0) console.log(st.log.slice(-25).join('\n'));
}

const impl = Object.keys(CARDS).length;
console.log(`\n${played} games across ${pairs.length} deck pairings`);
console.log(`  results     first ${results.wins} / second ${results.losses} / other ${results.other}`);
console.log(`  turns       mean ${(results.turns.reduce((a, b) => a + b, 0) / results.turns.length).toFixed(1)}`);
console.log(`  card impls  ${impl} registered, ${fired.size} exercised in these games`);
// An implementation that never ran is only a GAP if its card is actually in a
// deck. Most of the pool is not, so those are simply untested rather than
// broken — and saying which is which is the difference between a measured
// claim and a hopeful one.
const inDecks = new Set();
for (const d of decks) {
  for (const c of d.cards) inDecks.add(c);
  if (d.stronghold) inDecks.add(d.stronghold);
}
const never = Object.keys(CARDS).filter((k) => !fired.has(k));
const untested = never.filter((k) => inDecks.has(k));
const notInPlay = never.filter((k) => !inDecks.has(k));
console.log(`  in a deck   ${[...inDecks].filter((k) => CARDS[k]).length} implementations, `
  + `${[...inDecks].filter((k) => CARDS[k] && fired.has(k)).length} of them exercised`);
if (untested.length) console.log(`  UNTESTED    in a deck but never ran: ${untested.join(', ')}`);
if (notInPlay.length) console.log(`  no deck     ${notInPlay.length} implementations belong to cards no deck holds`);

if (errors.size) {
  console.log(`\nRUNTIME ERRORS (${[...errors.values()].reduce((a, b) => a + b, 0)} total)`);
  for (const [msg, n] of [...errors].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(n).padStart(4)}x ${msg}`);
  }
}

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} invariant violations`);
  const seen = new Set();
  for (const f of failures) {
    const key = f.split('[')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${f}`);
    if (seen.size > 15) break;
  }
  process.exit(1);
}
console.log('\nOK — no invariant violations');
