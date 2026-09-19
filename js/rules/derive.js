// The continuous-effects layer.
//
// Power, traits, Gates, Back Row and legality are NOT stored on cards. They are
// recomputed from the board every time they are asked for, so an effect stops
// the instant its source leaves play. Writing them onto a card is the classic
// way to end up with a +I that never wears off.
//
// Every constant ability contributes into one `derived` bag, which the engine
// then reads through the helpers at the bottom.

import { adjacentTo, distance, VOID } from './board.js';

export function emptyDerived() {
  return {
    powerAdd: new Map(),      // uid -> number
    powerSet: new Map(),      // uid -> number (override, last writer wins)
    globalPowerSet: null,     // The Everking: everyone counts as I
    traits: new Map(),        // uid -> Set of extra traits
    lostTraits: new Map(),    // uid -> Set of removed traits
    grantedAbilities: new Map(), // uid -> [ability]
    blanked: new Set(),       // uid -> abilities replaced with "does nothing"
    basic: new Set(),         // uid -> counts as Basic
    singing: new Set(),       // uid
    addGates: [[], []],
    noGates: [false, false],
    backRow: [[], []],
    blockEnter: [],           // {square, blocks(card, state) -> bool}
    cannotAttack: [],         // (attacker, defender, state) -> bool
    actWhileFatigued: new Set(), // uid may act despite fatigue
    voidSquares: new Set(),   // squares that count as The Void
    extraAttachSlots: new Map(), // uid -> how many Attachments BEYOND the first
  };
}

/**
 * Walk everything in play and let each constant ability contribute.
 * `impls` maps a card definition id to its implementation.
 */
export function derive(state, impls) {
  const d = emptyDerived();
  const ctxBase = { state, derived: d };

  for (const { card, square, depth, covered } of allInPlay(state)) {
    const impl = impls[card.def];
    if (!impl?.constant) continue;
    // Only the top of a stack is in play; buried cards contribute nothing
    // unless their implementation says otherwise.
    if (depth > 0 && !impl.whileBuried) continue;
    if (covered && !impl.whileCovered) continue;
    try {
      (state.implsUsed ||= {})[card.def] = true;
      impl.constant({ ...ctxBase, self: card, square, depth });
    } catch (e) {
      // A broken card must not take the whole game down with it.
      if (!state.derivationErrors) state.derivationErrors = [];
      state.derivationErrors.push(`${card.def}: ${e.message}`);
    }
  }

  // Attachments are in play too, and their constants are how they grant their
  // host an ability. They were skipped entirely, so an Attachment's ability
  // could only ever fire from the trigger that grants a free use — never as an
  // action you could choose.
  for (const { card, square, covered } of allInPlay(state)) {
    if (covered) continue;
    for (const att of card.attachments || []) {
      const impl = impls[att.def];
      if (!impl?.constant) continue;
      try {
        (state.implsUsed ||= {})[att.def] = true;
        impl.constant({ ...ctxBase, self: att, host: card, square, depth: 0 });
      } catch (e) {
        (state.derivationErrors ||= []).push(`${att.def}: ${e.message}`);
      }
    }
  }
  return d;
}

/** Every card currently on the battlefield, with where it is and how deep. */
export function* allInPlay(state) {
  for (let square = 0; square < state.board.length; square++) {
    const stack = state.board[square] || [];
    for (let depth = 0; depth < stack.length; depth++) {
      yield { card: stack[depth], square, depth };
    }
  }
  for (const c of state.constructs || []) {
    if (!c) continue;
    // "A Construct's ability is considered active as long as it is the top
    // card in the square it occupies." A fighter standing on it switches it
    // off, unless the card says otherwise.
    const covered = (state.board[c.square] || []).length > 0;
    yield { card: c, square: c.square, depth: 0, construct: true, covered };
  }
}

/* ------------------------------------------------------------ queries */

export function traitsOf(state, card, defs, derived) {
  const base = new Set(defs[card.def]?.traits || []);
  for (const t of derived?.traits.get(card.uid) || []) base.add(t);
  for (const t of derived?.lostTraits.get(card.uid) || []) base.delete(t);
  return base;
}

export function isBasic(state, card, defs, derived) {
  if (derived?.basic.has(card.uid)) return true;
  return defs[card.def]?.kind === 'basic';
}

export function isSinging(state, card, derived) {
  return derived?.singing.has(card.uid) || !!card.singing;
}

/** Abilities a card actually has right now, after granting and blanking. */
export function abilitiesOf(card, defs, derived) {
  if (derived?.blanked.has(card.uid)) return [];
  const own = defs[card.def]?.abilities || [];
  const extra = derived?.grantedAbilities.get(card.uid) || [];
  return [...own, ...extra];
}

/**
 * Power, with every modifier applied in the right order:
 * overrides first (they replace the printed value), then additions.
 */
export function powerOf(state, card, defs, derived, opts = {}) {
  const def = defs[card.def] || {};
  let p = def.power ?? 0;

  if (derived?.globalPowerSet != null && (opts.attacking || opts.defending)) {
    p = derived.globalPowerSet;
  }
  if (derived?.powerSet.has(card.uid)) p = derived.powerSet.get(card.uid);

  p += derived?.powerAdd.get(card.uid) || 0;

  // "+I when Attacking <trait>" lives on the card and only applies on offence
  if (opts.attacking && opts.vs) {
    const vsTraits = traitsOf(state, opts.vs, defs, derived);
    for (const ab of abilitiesOf(card, defs, derived)) {
      if (ab.k === 'bonusVsTrait' && vsTraits.has(ab.trait)) p += ab.amount;
    }
  }
  return Math.max(0, p);
}

/* ------------------------------------------------------------ helpers cards use */

/** Squares adjacent to `square`, honouring The Void. */
export function neighbours(state, square) {
  return adjacentTo(state, square);
}

export function squaresWithin(state, from, range) {
  const out = [];
  const total = state.board.length;
  for (let i = 0; i < total; i++) {
    if (i === from) continue;
    if (distance(state, from, i) <= range) out.push(i);
  }
  return out;
}

export function isVoid(state, square, derived) {
  return square === VOID || !!derived?.voidSquares.has(square);
}
