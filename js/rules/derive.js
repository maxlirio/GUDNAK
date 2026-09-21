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
    cannotMove: [],           // (card, from, to, state) -> bool
    attackWhileFatigued: [],  // (attacker, defender) -> bool, an exhausted attack
    actWhileFatigued: new Set(), // uid may act despite fatigue
    // Shadow Puppetry: uids that may take Move and Attack actions from INSIDE
    // a stack. It was created ad hoc with `||=` by the one card that writes it
    // and declared nowhere, which is how it went unread for its whole life —
    // a bucket the layer does not declare is a bucket nothing can be reading.
    puppeteered: new Set(),   // uid may act while buried, and moves alone
    // Bonuses that depend on WHICH SIDE OF A FIGHT the card is on. A flat
    // `powerAdd` cannot say "+II when Attacking and +I when being Attacked" —
    // it can only say one number — so Threadbearer was giving its attacking
    // bonus while it was being attacked, and the card prints two numbers.
    // `idle` is what it is worth when nobody is fighting, which is the number
    // the board shows.
    powerWhen: new Map(),     // uid -> {attacking, defending, idle(state, card)}
    voidSquares: new Set(),   // squares that count as The Void
    // ...and squares that count as ADJACENT to it, which is a different claim.
    // Black Aurox was writing its neighbours into voidSquares, so even once
    // that set was read it would have made the squares around it BE the Void
    // rather than border it.
    adjacentVoid: new Set(),
    // Extra squares a card may be deployed to, as predicates the engine asks.
    // Declared here rather than invented with `||=` by the three cards that
    // write it: an undeclared bucket reads as dead to every tool that walks
    // this layer, and it is one typo away from actually being dead.
    extraDeploy: [],          // [(state, card, player) -> [square]]
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

  // Side-of-the-fight bonuses. Asked for the side the caller is asking about,
  // and `idle` when the caller is only asking what the card is worth — which
  // is the number on the board, and has to be the one the player would get if
  // they acted now, not whichever half of the ability reads better.
  const when = derived?.powerWhen?.get(card.uid);
  if (when) {
    if (opts.attacking) p += when.attacking || 0;
    else if (opts.defending) p += when.defending || 0;
    else if (when.idle) p += when.idle(state, card) || 0;
  }

  // "+I when Attacking <trait>" lives on the card and only applies on offence
  if (opts.attacking && opts.vs) {
    const vsTraits = traitsOf(state, opts.vs, defs, derived);
    for (const ab of abilitiesOf(card, defs, derived)) {
      // `noTraitBonus` exists so the engine can ask what this attack would
      // have been WITHOUT the triangle, and show the bonus only when it
      // actually changed something. It must never be set by a rule.
      if (ab.k === 'bonusVsTrait' && vsTraits.has(ab.trait) && !opts.noTraitBonus) p += ab.amount;
      // "+I when Attacking enemy fighters with <card> attached" — the bonus
      // depends on what the DEFENDER is carrying, not on what it is.
      if (ab.k === 'bonusVsAttached'
          && (opts.vs.attachments || []).some((a) => a.def === ab.attached)) {
        p += ab.amount;
      }
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

/**
 * "Is this square ADJACENT to The Void?" — a different claim from being it.
 *
 * The real Void's neighbours fall out of the board graph, so a BFS distance of
 * 1 answers for those, and Black Aurox widens the same graph through
 * `adjacentVoid`. A VEIL SHROUD square has no graph entry at all — it is an
 * ordinary square that merely COUNTS as The Void when something asks — so its
 * neighbours have to be asked for directly. Without this, "in or adjacent to
 * The Void" saw the shroud itself and nothing standing around it, which is
 * half of that clause missing on every card that prints it.
 */
export function isVoidAdjacent(state, square, derived) {
  if (square == null) return false;
  if (distance(state, square, VOID) === 1) return true;
  for (const v of derived?.voidSquares || []) {
    if (v !== square && adjacentTo(state, v).includes(square)) return true;
  }
  return false;
}

/**
 * Every square that counts as The Void right now, the real one first.
 *
 * Sorted after the first, because two engines must agree on the ORDER as well
 * as the contents and a Set iterates in insertion order — which here depends
 * on the order the constants happened to run in. The same trap adjacentTo
 * already had to be taught.
 */
export function voidSquaresOf(state, derived) {
  const out = state.locations?.void ? [VOID] : [];
  const extra = [...(derived?.voidSquares || [])].filter((s) => s !== VOID);
  extra.sort((a, b) => a - b);
  return [...out, ...extra];
}

/**
 * The fighters standing in any square that counts as The Void.
 *
 * Cards that ask "which fighters are IN The Void" read `state.board[VOID]`
 * directly, which is the one square the engine hard-codes. So a Veil Shroud
 * square counted as The Void for every test that asked "is this square it?"
 * and for NONE that asked "what is standing in it?" — Voidlink, Shadow Step
 * and Spindle all looked straight past a shrouded fighter.
 */
export function cardsInVoid(state, derived) {
  const out = [];
  for (const s of voidSquaresOf(state, derived)) {
    for (const c of state.board[s] || []) out.push(c);
  }
  return out;
}
