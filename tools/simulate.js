// Playtest harness. Plays whole games with random-legal bots and asserts the
// engine's invariants after EVERY decision, not just at the end.
//
//   node tools/simulate.js --games 2000 --seed 1
//   node tools/simulate.js --games 200 --strict     (verify every legal action)
//
// Unit tests never find the interesting bugs; full matches do.

import {
  createGame, legalActions, apply, choose, cloneState, defOf, topOf,
  GATES, SQUARES, BACK_ROW, isSieged, powerOf,
} from '../js/engine.js';
import { TEST_DEFS, TEST_DECK, validateDeck } from '../js/cards.js';

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1]?.startsWith('--') ? true : argv[i + 1]) : dflt;
};
const GAMES = Number(flag('games', 1000));
const SEED0 = Number(flag('seed', 1));
const STRICT = argv.includes('--strict');
const VERBOSE = argv.includes('--verbose');

const failures = [];
function check(cond, msg, ctx) {
  if (!cond) failures.push({ msg, ctx });
  return cond;
}

// ------------------------------------------------------------- invariants

function invariants(state, where) {
  const seen = new Map();          // uid -> location
  const counts = [0, 0];

  const note = (card, loc) => {
    if (seen.has(card.uid)) {
      check(false, `card ${card.uid} in two places: ${seen.get(card.uid)} and ${loc}`, where);
    }
    seen.set(card.uid, loc);
    counts[card.owner]++;
  };

  state.board.forEach((sq, i) => {
    check(Array.isArray(sq), `square ${i} is not an array`, where);
    sq.forEach((c, d) => note(c, `board[${i}][${d}]`));
  });
  state.players.forEach((pl, p) => {
    pl.deck.forEach((c) => {
      note(c, `P${p}.deck`);
      check(c.owner === p, `card ${c.uid} owned by P${c.owner} sits in P${p} deck`, where);
      check(c.fatigued === false, `card ${c.uid} is fatigued in a deck`, where);
    });
    pl.hand.forEach((c) => {
      note(c, `P${p}.hand`);
      check(c.owner === p, `card ${c.uid} owned by P${c.owner} sits in P${p} hand`, where);
      check(c.fatigued === false, `card ${c.uid} is fatigued in hand`, where);
    });
    pl.graveyard.forEach((c) => {
      note(c, `P${p}.graveyard`);
      check(c.owner === p, `card ${c.uid} owned by P${c.owner} sits in P${p} graveyard`, where);
    });
  });

  // Conservation: 20 cards per player, always, everywhere.
  check(counts[0] === 20, `P0 has ${counts[0]} cards, expected 20`, where);
  check(counts[1] === 20, `P1 has ${counts[1]} cards, expected 20`, where);

  check(Number.isInteger(state.actionsLeft) && state.actionsLeft >= 0 && state.actionsLeft <= 2,
    `actionsLeft = ${state.actionsLeft}`, where);

  // Only fighters reach the battlefield, and power stays in band.
  for (const sq of state.board) {
    for (const c of sq) {
      const d = defOf(state, c);
      check(d.type === 'fighter', `${d.name} (${d.type}) is on the battlefield`, where);
      check(d.power >= 1 && d.power <= 3, `${d.name} has power ${d.power}`, where);
    }
  }

  // Legal actions must never name a fatigued fighter as a move/attack source,
  // and must never target a square the mover cannot reach.
  if (state.winner === null) {
    for (const a of legalActions(state)) {
      if (a.t === 'move' || a.t === 'attack' || a.t === 'ability') {
        const top = topOf(state, a.from);
        check(!!top, `${a.t} from empty square ${a.from}`, where);
        check(top && top.owner === state.active, `${a.t} with an enemy fighter`, where);
        check(top && !top.fatigued, `${a.t} offered with a fatigued fighter`, where);
      }
      if (a.t === 'move') check(state.board[a.to].length === 0, `move into occupied ${a.to}`, where);
      if (a.t === 'attack') {
        check(state.board[a.to].length > 0, `attack into empty ${a.to}`, where);
        check(topOf(state, a.to).owner !== state.active, `attack on a friendly fighter`, where);
      }
      if (a.t === 'deploy') {
        check(BACK_ROW[state.active].includes(a.to), `deploy outside the back row (${a.to})`, where);
      }
      if (a.t === 'defend') {
        check(isSieged(state, state.active), 'defend offered while not Sieged', where);
        check(state.players[state.active].hand.length >= powerOf(state, topOf(state, GATES[state.active])),
          'defend offered without enough cards to discard', where);
      }
    }
  }
}

// ------------------------------------------------------------- the bots

function randomBot(rng) {
  return (state) => {
    const acts = legalActions(state);
    return acts[Math.floor(rng() * acts.length)];
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- run

const deckProblems = validateDeck(TEST_DECK, TEST_DEFS);
console.log(`deck check: ${deckProblems.length ? deckProblems.join('; ') : 'legal'}`);

const stats = {
  wins: [0, 0], draw: 0, stalemate: 0,
  turns: [], actions: {}, decisions: 0, firstPlayerWins: 0,
};

for (let g = 0; g < GAMES; g++) {
  const seed = SEED0 + g;
  const rng = mulberry32(seed * 7919 + 13);
  const bot = randomBot(rng);

  let state;
  try {
    state = createGame({
      seed,
      defs: TEST_DEFS,
      decks: [TEST_DECK, TEST_DECK],
      mulligan: [rng() < 0.2, rng() < 0.2],
    });
  } catch (e) {
    failures.push({ msg: `createGame threw: ${e.message}`, ctx: `seed ${seed}` });
    continue;
  }

  const firstPlayer = state.active;
  invariants(state, `seed ${seed} setup`);

  let guard = 0;
  while (state.winner === null) {
    if (++guard > 4000) {
      failures.push({ msg: 'game exceeded 4000 decisions without ending', ctx: `seed ${seed}` });
      break;
    }
    const acts = legalActions(state);
    if (!acts.length) {
      failures.push({ msg: 'no legal actions but game not over', ctx: `seed ${seed} turn ${state.turn}` });
      break;
    }

    // Every action the engine offers must actually be applicable.
    if (STRICT || stats.decisions % 97 === 0) {
      for (const a of acts) {
        try {
          apply(cloneState(state), a);
        } catch (e) {
          failures.push({ msg: `offered action ${JSON.stringify(a)} threw: ${e.message}`, ctx: `seed ${seed}` });
        }
      }
    }

    const action = bot(state);
    stats.actions[action.t] = (stats.actions[action.t] || 0) + 1;
    stats.decisions++;

    try {
      apply(state, action);
      // This deck has no card effects, so for a long time nothing ever stopped
      // to ask anything — then Defend started asking WHICH cards you discard,
      // and a harness that cannot answer reads a waiting game as a stuck one.
      let asked = 0;
      while (state.pending && asked++ < 40) {
        const req = state.pending.request;
        const opts = req.options || [];
        let answer = null;
        if (req.type === 'confirm') answer = rng() < 0.5;
        else if (req.type === 'some') {
          const pool = [...opts];
          answer = [];
          for (let i = 0; i < Math.min(req.count ?? 1, pool.length); i++) {
            answer.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
          }
        } else if (opts.length) answer = opts[Math.floor(rng() * opts.length)];
        choose(state, answer);
        invariants(state, `seed ${seed} after answering on turn ${state.turn}`);
      }
    } catch (e) {
      failures.push({ msg: `apply(${JSON.stringify(action)}) threw: ${e.message}`, ctx: `seed ${seed} turn ${state.turn}` });
      break;
    }
    invariants(state, `seed ${seed} after ${action.t} on turn ${state.turn}`);
  }

  if (state.winner === 0 || state.winner === 1) {
    stats.wins[state.winner]++;
    if (state.winner === firstPlayer) stats.firstPlayerWins++;
  } else if (state.winner === 'draw') stats.draw++;
  else if (state.winner === 'stalemate') stats.stalemate++;

  stats.turns.push(state.turn);

  if (VERBOSE && g === 0) {
    console.log('\n--- game 0 log ---');
    console.log(state.log.slice(-40).join('\n'));
    console.log(`result: ${state.winner} (${state.reason})\n`);
  }
}

// ------------------------------------------------------------- report

const decided = stats.wins[0] + stats.wins[1];
const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length);
const pct = (n) => `${((n / GAMES) * 100).toFixed(1)}%`;

console.log(`\n${GAMES} games, ${stats.decisions} decisions`);
console.log(`  P0 wins        ${stats.wins[0]} (${pct(stats.wins[0])})`);
console.log(`  P1 wins        ${stats.wins[1]} (${pct(stats.wins[1])})`);
console.log(`  draw           ${stats.draw} (${pct(stats.draw)})`);
console.log(`  stalemate      ${stats.stalemate} (${pct(stats.stalemate)})`);
console.log(`  first-player   ${decided ? ((stats.firstPlayerWins / decided) * 100).toFixed(1) : '-'}% of decided games`);
console.log(`  turns          mean ${mean(stats.turns).toFixed(1)}, max ${Math.max(...stats.turns)}`);
console.log(`  action mix     ${Object.entries(stats.actions).map(([k, v]) => `${k} ${((v / stats.decisions) * 100).toFixed(0)}%`).join(', ')}`);

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} invariant violations`);
  const grouped = {};
  for (const f of failures) (grouped[f.msg] ||= []).push(f.ctx);
  for (const [msg, ctxs] of Object.entries(grouped).slice(0, 25)) {
    console.log(`  ${ctxs.length}x  ${msg}`);
    console.log(`        e.g. ${ctxs[0]}`);
  }
  process.exit(1);
}
console.log('\nOK — no invariant violations');
