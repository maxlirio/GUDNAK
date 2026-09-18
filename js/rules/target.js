// One selector for every "target ..." on every card.
//
// The pool's targeting vocabulary is small and closed, so this is a filter over
// a handful of named axes rather than 80 bespoke searches. The important
// non-obvious one is `inStack`: the default rule is that only the TOP of a
// stack can be targeted, but Cross Examine and Decarceration reach inside, so
// that default has to be opt-out.

import { distance } from './board.js';
import { traitsOf, powerOf, isBasic } from './derive.js';
import { allCards, locate } from './ops.js';

/**
 * @param {object} q
 *   side      'friendly' | 'enemy' | 'any'         (relative to q.player)
 *   zone      'board' | 'hand' | 'graveyard' | 'deck'   default 'board'
 *   power     number | {max} | {min} | {eq}
 *   trait     string | string[]  (any of)
 *   kind      'basic' | 'hero'
 *   type      'fighter' | 'tactic' | 'construct' | 'attachment'
 *   adjacentTo   square
 *   within    {of: square, range: n}
 *   notAdjacent  square
 *   inStack   'top' (default) | 'any' | 'buried'
 *   squares   explicit list of squares to consider
 *   exclude   uid | uid[]
 *   excludeGates  true — never an opponent's Gates
 *   notInStack   true — the fighter must be alone on its square
 */
export function targets(state, q = {}) {
  const { defs } = state;
  const derived = state.derived;
  const out = [];
  const excl = new Set([].concat(q.exclude || []).filter(Boolean));

  const zone = q.zone || 'board';

  if (zone === 'board') {
    for (let square = 0; square < state.board.length; square++) {
      if (q.squares && !q.squares.includes(square)) continue;
      const stack = state.board[square] || [];
      for (let depth = 0; depth < stack.length; depth++) {
        const mode = q.inStack || 'top';
        if (mode === 'top' && depth !== 0) continue;
        if (mode === 'buried' && depth === 0) continue;
        const card = stack[depth];
        if (!accept(state, card, { square, depth, stack }, q, defs, derived, excl)) continue;
        out.push(card);
      }
    }
    return out;
  }

  for (let p = 0; p < 2; p++) {
    if (!sideOk(p, q)) continue;
    for (const card of state.players[p][zone]) {
      if (!accept(state, card, {}, q, defs, derived, excl)) continue;
      out.push(card);
    }
  }
  return out;
}

function sideOk(owner, q) {
  if (!q.side || q.side === 'any') return true;
  if (q.side === 'friendly') return owner === q.player;
  return owner !== q.player;
}

function accept(state, card, where, q, defs, derived, excl) {
  if (excl.has(card.uid)) return false;
  if (!sideOk(card.owner, q)) return false;

  const def = defs[card.def] || {};
  if (q.type && def.type !== q.type && def.realType !== q.type) return false;
  if (q.kind === 'basic' && !isBasic(state, card, defs, derived)) return false;
  if (q.kind === 'hero' && def.kind !== 'hero') return false;

  if (q.power != null) {
    const p = powerOf(state, card, defs, derived);
    if (typeof q.power === 'number') { if (p !== q.power) return false; }
    else {
      if (q.power.max != null && p > q.power.max) return false;
      if (q.power.min != null && p < q.power.min) return false;
      if (q.power.eq != null && p !== q.power.eq) return false;
    }
  }

  if (q.trait) {
    const want = [].concat(q.trait);
    const has = traitsOf(state, card, defs, derived);
    if (!want.some((t) => has.has(t))) return false;
  }

  if (where.square != null) {
    if (q.adjacentTo != null) {
      if (distance(state, q.adjacentTo, where.square) !== 1) return false;
    }
    if (q.notAdjacent != null && distance(state, q.notAdjacent, where.square) <= 1) return false;
    if (q.within) {
      const d = distance(state, q.within.of, where.square);
      if (d > q.within.range || d === 0) return false;
    }
    if (q.notInStack && where.stack && where.stack.length > 1) return false;
    if (q.excludeGates) {
      const gates = state.gates || [[], []];
      for (let p = 0; p < 2; p++) {
        if (p !== q.player && gates[p].includes(where.square)) return false;
      }
    }
  }
  return true;
}

/** Squares, rather than cards — for "choose an adjacent square". */
export function squares(state, q = {}) {
  const out = [];
  for (let i = 0; i < state.board.length; i++) {
    if (q.squares && !q.squares.includes(i)) continue;
    if (q.empty && (state.board[i] || []).length) continue;
    if (q.occupied && !(state.board[i] || []).length) continue;
    if (q.adjacentTo != null && distance(state, q.adjacentTo, i) !== 1) continue;
    if (q.within && distance(state, q.within.of, i) > q.within.range) continue;
    if (q.backRowOf != null && !(state.backRow?.[q.backRowOf] || []).includes(i)) continue;
    if (q.excludeGates) {
      const gates = state.gates || [[], []];
      let bad = false;
      for (let p = 0; p < 2; p++) if (p !== q.player && gates[p].includes(i)) bad = true;
      if (bad) continue;
    }
    out.push(i);
  }
  return out;
}

export const uids = (cards) => cards.map((c) => c.uid);
export const squareOf = (state, uid) => locate(state, uid)?.square ?? null;
