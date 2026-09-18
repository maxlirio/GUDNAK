// Gudnak rules engine — headless, deterministic, no DOM.
//
// Rules of record: docs/RULES.md. Every [ruling] there is marked RULING here.
//
// State is plain JSON: structuredClone-able, hashable, and safe to ship over
// the wire. Nothing in this file touches the renderer or the network.

export const SIZE = 3;
export const SQUARES = SIZE * SIZE;

// 0 1 2  <- P0 back row, 1 = P0 gates
// 3 4 5
// 6 7 8  <- P1 back row, 7 = P1 gates
export const BACK_ROW = [[0, 1, 2], [6, 7, 8]];
export const GATES = [1, 7];

export const ADJACENT = (() => {
  const a = [];
  for (let i = 0; i < SQUARES; i++) {
    const r = Math.floor(i / SIZE), c = i % SIZE, n = [];
    if (r > 0) n.push(i - SIZE);
    if (r < SIZE - 1) n.push(i + SIZE);
    if (c > 0) n.push(i - 1);
    if (c < SIZE - 1) n.push(i + 1);
    a.push(n);
  }
  return a;
})();

export const TRAITS = ['Brute', 'Soldier', 'Hunter', 'Hero', 'Demon', 'Shadow', 'Token'];

// ---------------------------------------------------------------- rng

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(state) {
  state.rng = (state.rng + 0x6D2B79F5) | 0;
  return mulberry32(state.rng - 0x6D2B79F5)();
}

function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- cards

// A card *definition* is static data (see js/cards.js). A card *instance* on
// the battlefield or in a zone is { uid, def, owner, fatigued }.
let uidCounter = 0;

function instantiate(def, owner) {
  return { uid: ++uidCounter, def: def.id, owner, fatigued: false };
}

export function defOf(state, card) {
  return state.defs[card.def];
}

// ---------------------------------------------------------------- setup

export function createGame({ seed = 1, decks, mulligan = [false, false], defs, first = null }) {
  const state = {
    rng: seed | 0,
    seed: seed | 0,
    defs,                    // id -> definition, shared and never mutated
    turn: 0,
    active: 0,
    actionsLeft: 0,
    board: Array.from({ length: SQUARES }, () => []),  // [0] is the TOP of the stack
    players: [newPlayer(), newPlayer()],
    winner: null,            // null | 0 | 1 | 'draw' | 'stalemate'
    reason: null,
    log: [],
    history: {},             // state-hash -> count, for the stalemate rule
  };

  for (let p = 0; p < 2; p++) {
    state.players[p].deck = shuffle(state, decks[p].map((id) => instantiate(defs[id], p)));
  }
  for (let p = 0; p < 2; p++) {
    draw(state, p, 5);
    if (mulligan[p]) {
      // "shuffle your hand into your deck and redraw 5 cards one time"
      state.players[p].deck.push(...state.players[p].hand.splice(0));
      shuffle(state, state.players[p].deck);
      draw(state, p, 5);
    }
  }

  state.active = first === null ? (rand(state) < 0.5 ? 0 : 1) : first;
  beginTurn(state);
  return state;
}

function newPlayer() {
  return { deck: [], hand: [], graveyard: [] };
}

function draw(state, p, n = 1) {
  const pl = state.players[p];
  for (let i = 0; i < n && pl.deck.length; i++) pl.hand.push(pl.deck.shift());
}

// ---------------------------------------------------------------- queries

export const topOf = (state, sq) => state.board[sq][0] || null;
export const occupied = (state, sq) => state.board[sq].length > 0;
export const controllerOf = (state, sq) => (topOf(state, sq) || {}).owner ?? null;
export const opponent = (p) => 1 - p;

export function isSieged(state, p) {
  const t = topOf(state, GATES[p]);
  return !!t && t.owner !== p;
}

/** Power of `card`, including its own modifiers. `vs` is the defending card
 *  when this is an attack, so cards with "+I while attacking X" can apply. */
export function powerOf(state, card, vs = null) {
  const def = defOf(state, card);
  let p = def.power;
  for (const ab of def.abilities || []) {
    if (ab.k === 'bonusVsTrait' && vs) {
      const vdef = defOf(state, vs);
      if ((vdef.traits || []).includes(ab.trait)) p += ab.amount;
    }
  }
  return p;
}

// ---------------------------------------------------------------- actions

export function legalActions(state) {
  if (state.winner !== null) return [];
  const p = state.active, pl = state.players[p], out = [];

  if (pl.deck.length) out.push({ t: 'draw' });

  // Deploy: unoccupied square in your back row, or onto a friendly fighter in
  // your back row sharing at least one trait.
  for (const card of pl.hand) {
    const def = defOf(state, card);
    if (def.type !== 'fighter') continue;
    for (const sq of BACK_ROW[p]) {
      if (!occupied(state, sq)) { out.push({ t: 'deploy', card: card.uid, to: sq }); continue; }
      const top = topOf(state, sq);
      if (top.owner !== p) continue;
      const tt = defOf(state, top).traits || [], ct = def.traits || [];
      if (ct.some((x) => tt.includes(x))) out.push({ t: 'deploy', card: card.uid, to: sq });
    }
  }

  for (let sq = 0; sq < SQUARES; sq++) {
    const top = topOf(state, sq);
    if (!top || top.owner !== p || top.fatigued) continue;
    for (const to of ADJACENT[sq]) {
      if (!occupied(state, to)) out.push({ t: 'move', from: sq, to });
      else if (topOf(state, to).owner !== p) out.push({ t: 'attack', from: sq, to });
    }
    // Action abilities live on the top card only.
    (defOf(state, top).abilities || []).forEach((ab, i) => {
      if (ab.k === 'action' && abilityUsable(state, top, sq, ab)) {
        out.push({ t: 'ability', from: sq, idx: i });
      }
    });
  }

  // Defend: only against a fighter sitting on your own Gates, and only if you
  // can pay the full discard. RULING #2.
  if (isSieged(state, p)) {
    const enemy = topOf(state, GATES[p]);
    if (pl.hand.length >= powerOf(state, enemy)) out.push({ t: 'defend' });
  }

  for (const card of pl.hand) {
    const def = defOf(state, card);
    if (def.type === 'tactic' && def.cost <= state.actionsLeft && tacticPlayable(state, card)) {
      out.push({ t: 'tactic', card: card.uid });
    }
  }

  return out;
}

export function apply(state, action) {
  if (state.winner !== null) throw new Error('game is over');
  const p = state.active, pl = state.players[p];
  const cost = action.t === 'tactic' ? defOf(state, findInHand(state, p, action.card)).cost : 1;
  if (cost > state.actionsLeft) throw new Error('not enough actions');

  switch (action.t) {
    case 'draw':
      draw(state, p, 1);
      log(state, `P${p} draws`);
      break;

    case 'deploy': {
      const card = takeFromHand(state, p, action.card);
      card.fatigued = true;
      state.board[action.to].unshift(card);
      log(state, `P${p} deploys ${defOf(state, card).name} to ${action.to}`);
      runDeployAbilities(state, card, action.to);
      break;
    }

    case 'move': {
      const stack = state.board[action.from];
      state.board[action.to] = stack;
      state.board[action.from] = [];
      stack[0].fatigued = true;
      log(state, `P${p} moves ${action.from}->${action.to}`);
      break;
    }

    case 'attack':
      resolveAttack(state, action.from, action.to);
      break;

    case 'defend': {
      const enemy = topOf(state, GATES[p]);
      const n = powerOf(state, enemy);
      // The player chooses which cards to pitch; action.discard carries that
      // choice from the UI. The sim omits it and discards at random.
      const picks = action.discard ? action.discard.slice(0, n) : null;
      if (picks && picks.length !== n) throw new Error('discard must be exactly ' + n);
      for (let i = 0; i < n; i++) {
        const idx = picks
          ? pl.hand.findIndex((c) => c.uid === picks[i])
          : Math.floor(rand(state) * pl.hand.length);
        if (idx < 0) throw new Error('discard card not in hand');
        pl.graveyard.push(pl.hand.splice(idx, 1)[0]);
      }
      destroyTop(state, GATES[p]);
      log(state, `P${p} defends, discarding ${n}`);
      break;
    }

    case 'ability': {
      const top = topOf(state, action.from);
      const ab = (defOf(state, top).abilities || [])[action.idx];
      resolveAbility(state, ab, top, action.from);
      top.fatigued = true;
      break;
    }

    case 'tactic': {
      const card = takeFromHand(state, p, action.card);
      resolveTactic(state, card);
      pl.graveyard.push(card);
      log(state, `P${p} plays ${defOf(state, card).name}`);
      break;
    }

    default:
      throw new Error(`unknown action ${action.t}`);
  }

  state.actionsLeft -= cost;
  if (state.winner === null && (state.actionsLeft <= 0 || legalActions(state).length === 0)) {
    endTurn(state);
  }
  return state;
}

function resolveAttack(state, from, to) {
  const atk = topOf(state, from), def = topOf(state, to);
  const ap = powerOf(state, atk, def);
  const dp = powerOf(state, def, null);   // the defender is not attacking

  if (ap > dp) {
    destroyTop(state, to);
  } else if (ap === dp) {
    destroyTop(state, to);
    destroyTop(state, from);
  } else {
    destroyTop(state, from);
  }
  log(state, `attack ${from}->${to} (${ap} v ${dp})`);

  // Relocate the survivor and whatever was under it, if the square opened up.
  if (topOf(state, from) === atk && !occupied(state, to)) {
    state.board[to] = state.board[from];
    state.board[from] = [];
  }
  if (isAlive(state, atk)) atk.fatigued = true;
}

function isAlive(state, card) {
  return state.board.some((sq) => sq.includes(card));
}

function destroyTop(state, sq) {
  const card = state.board[sq].shift();
  if (!card) return null;
  card.fatigued = false;
  state.players[card.owner].graveyard.push(card);
  return card;
}

function findInHand(state, p, uid) {
  const c = state.players[p].hand.find((x) => x.uid === uid);
  if (!c) throw new Error(`card ${uid} not in P${p} hand`);
  return c;
}

function takeFromHand(state, p, uid) {
  const hand = state.players[p].hand;
  const i = hand.findIndex((x) => x.uid === uid);
  if (i < 0) throw new Error(`card ${uid} not in P${p} hand`);
  return hand.splice(i, 1)[0];
}

// ---------------------------------------------------------------- turns

function endTurn(state) {
  // End Phase: fatigue clears on every fighter the active player owns,
  // including those buried in stacks. RULING #1.
  for (const sq of state.board) {
    for (const card of sq) if (card.owner === state.active) card.fatigued = false;
  }
  state.active = opponent(state.active);
  beginTurn(state);
}

function beginTurn(state) {
  // Loop rather than recurse: a player with no legal action passes straight
  // through, and we must not blow the stack if both are stuck.
  for (let guard = 0; guard < 64; guard++) {
    state.turn++;
    const p = state.active;

    // Start Phase.
    if (isSieged(state, p)) {
      const pl = state.players[p];
      if (!pl.deck.length) {
        state.winner = opponent(p);
        state.reason = `P${p} sieged with an empty Stronghold`;
        return;
      }
      pl.graveyard.push(pl.deck.shift());
      log(state, `P${p} is Sieged, mills 1 (${pl.deck.length} left)`);
    } else {
      draw(state, p, 1);   // no-op on an empty deck. RULING #3.
    }

    // Stalemate: the same position recurring four times. RULING #4.
    const h = hashState(state);
    state.history[h] = (state.history[h] || 0) + 1;
    if (state.history[h] >= 4) {
      state.winner = 'stalemate';
      state.reason = 'position repeated four times';
      return;
    }

    state.actionsLeft = state.turn === 1 ? 1 : 2;

    if (legalActions(state).length > 0) return;

    // Nothing to do — clear fatigue and pass.
    for (const sq of state.board) {
      for (const card of sq) if (card.owner === p) card.fatigued = false;
    }
    state.active = opponent(p);
  }
  state.winner = 'draw';
  state.reason = 'neither player could act';
}

export function hashState(state) {
  const board = state.board
    .map((sq) => sq.map((c) => `${c.def}:${c.owner}:${c.fatigued ? 1 : 0}`).join('|'))
    .join(',');
  const zones = state.players
    .map((pl) => [
      pl.hand.map((c) => c.def).sort().join('|'),
      pl.deck.map((c) => c.def).join('|'),
      pl.graveyard.length,
    ].join('/'))
    .join(';');
  return `${state.active}#${board}#${zones}`;
}

function log(state, msg) {
  state.log.push(`T${state.turn} ${msg}`);
  if (state.log.length > 2000) state.log.shift();
}

// ---------------------------------------------------------------- effects
//
// Card content does not exist yet (engine first, cards later). These are the
// seams it will plug into; js/cards.js ships only vanilla test fixtures.

function abilityUsable() { return false; }
function resolveAbility() { throw new Error('no Action abilities defined yet'); }
function runDeployAbilities() { /* Deployment abilities land here */ }
function tacticPlayable() { return true; }
function resolveTactic() { /* Tactic effects land here */ }

// ---------------------------------------------------------------- util

export function cloneState(state) {
  const defs = state.defs;
  const copy = structuredClone({ ...state, defs: null });
  copy.defs = defs;   // definitions are immutable and shared
  return copy;
}
