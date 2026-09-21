// Card implementations, keyed by collector code.
//
// Shape of an implementation:
//   constant(ctx)          contribute to the continuous layer (ctx.derived)
//   onDeploy(ctx)*         generator — a Deployment ability
//   play(ctx)*             generator — a Tactic
//   onPlay(ctx)*           generator — a Construct entering
//   onAttach(ctx)*         generator — an Attachment being played
//   actions: [{name, canUse, run*}]   Action abilities
//   on: {event(ctx)}       trigger listeners
//   replace: {event(ctx)}  replacement effects
//   deploySquares(...)     extra legal deploy squares
//
// * generators, so they can yield a request and wait for a player choice.

import { ask } from './driver.js';
import { queueEffect as queue, emit } from './triggers.js';
import * as ops from './ops.js';
import { targets, squares, uids } from './target.js';
import {
  traitsOf, powerOf, neighbours, squaresWithin,
  isVoid, isVoidAdjacent, voidSquaresOf, cardsInVoid,
} from './derive.js';
// VOID itself is no longer named anywhere in this file: "The Void" is a
// QUESTION now (VOIDISH / VOID_SQUARES / IN_VOID), because a Veil Shroud makes
// square 9 only one of the answers. Anything that goes back to the constant is
// a card that a shroud will be invisible to.
import { distance } from './board.js';
// deployTargets lives in the engine and is imported back here on purpose: a
// second implementation of "where may this be Deployed" is a rule that drifts.
import { deployTargets, actionAbilitiesOf } from '../engine.js';

export const CARDS = {};

/** The live implementation table. A card that borrows another's abilities
 *  needs to read it at RUN time, not while this module is still being built. */
const impls = (state) => state.impls || CARDS;

/** Register one or more codes with the same implementation. */
function def(codes, impl) {
  for (const c of [].concat(codes)) CARDS[c] = { ...(CARDS[c] || {}), ...impl };
}

const T = (state, card) => traitsOf(state, card, state.defs, state.derived);
const P = (state, card) => powerOf(state, card, state.defs, state.derived);
const sq = (state, uid) => ops.locate(state, uid)?.square ?? null;
const enemy = (p) => 1 - p;

/**
 * The fighter an Attachment's ability acts FROM.
 *
 * An ability granted by an Attachment runs with `self` set to the host when it
 * is used as an action, but to the Attachment itself on the free use its
 * trigger grants. An Attachment has no square, so anything measuring adjacency
 * from `self` silently measured from nowhere.
 */
/**
 * "You may Deploy a Shadow."
 *
 * Two cards promise this and neither delivered it — Drop Shadow bounced a
 * Shadow and stopped, Shadowstep Shuttle moved and stopped. Legality comes
 * from the engine's own deployTargets rather than a second copy of the rule;
 * two implementations of Deploy is exactly how they drift apart.
 */
function* deployAShadow(state, owner, forcedSquare = null) {
  const hand = state.players[owner].hand.filter((c) => state.defs[c.def]?.type === 'fighter'
    && traitsOf(state, c, state.defs, state.derived).has('Shadow'));
  if (!hand.length) return;

  const pick = yield ask.one(uids(hand), { prompt: 'Deploy a Shadow?', allowNone: true });
  if (!pick) return;
  const card = ops.findCard(state, pick);
  if (!card) return;

  let to = forcedSquare;
  if (to != null) {
    if (ops.occupied(state, to)) return;
  } else {
    const spots = deployTargets(state, owner, card);
    if (!spots.length) return;
    to = yield ask.one(spots, { kind: 'square', prompt: 'Deploy where?' });
    if (to == null) return;
  }

  ops.extract(state, pick);
  card.fatigued = true;                 // a Deploy fatigues, however it happens
  ops.place(state, card, to);
  emit(state, state.impls || {}, 'afterEnter', { card, square: to });
}

/**
 * Convicted of Heresy — a card from OUTSIDE the game.
 *
 * It is an ATTACHMENT, not a marker: it takes up the fighter's attachment slot,
 * other cards ask whether it is attached, and it can be shed like any other.
 * Other factions bring more tokens later, so it is made through the general
 * token path rather than by hand.
 */
const CONVICTED = 'A051';

function isConvicted(card) {
  return (card?.attachments || []).some((a) => a.def === CONVICTED);
}

/** "(You may have a maximum of 2 Convicted of Heresy.)" */
function convictedInPlay(state, me) {
  let n = 0;
  for (const { card } of ops.allCards(state)) {
    if (card.def === CONVICTED && card.owner === me) n++;
  }
  return n;
}

/** Refractory drags people about in chains; everything that does it says so. */
const inIrons = (state, from, to) => ops.fx(state, 'chains', { from, to });

function* convict(state, me, count) {
  for (let i = 0; i < count; i++) {
    if (convictedInPlay(state, me) >= 2) return;      // the printed maximum
    // one Attachment per fighter, so a fighter already carrying one is out
    const foes = targets(state, { player: me, side: 'enemy' })
      .filter((c) => !(c.attachments || []).length);
    if (!foes.length) return;
    const pick = yield ask.one(uids(foes), { prompt: 'Convict of Heresy', allowNone: true });
    if (!pick) return;
    // the brand is burned on FIRST, then the card that carries it
    ops.fx(state, 'brand', { target: pick });
    const token = ops.createToken(state, CONVICTED, me);
    if (token) ops.attachTo(state, token, ops.findCard(state, pick));
  }
}

/**
 * Convicted of Heresy itself (A051). The fatigue exception and the rescue are
 * printed HERE, not on the Inquisitor — which is why the Inquisitor's own text
 * carries only the +I.
 */
def(CONVICTED, {
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    // "Hunters you control may Attack this fighter while fatigued."
    (derived.attackWhileFatigued ||= []).push((atk, target) => (
      target.uid === host.uid
      && atk.owner === self.owner
      && traitsOf(state, atk, state.defs, derived).has('Hunter')
    ));
  },
  queued: {
    *rescue({ state, self, descriptor }) {
      const card = ops.findCard(state, descriptor.target);
      if (!card) return;
      const mine = targets(state, { player: self.owner, side: 'friendly' })
        .filter((c) => sq(state, c.uid) != null && c.uid !== card.uid);
      if (mine.length < 2) return;
      const pick = yield ask.one(uids(mine), { prompt: 'Put the convicted fighter under which?' });
      if (pick == null) return;
      const where = sq(state, pick);
      if (where != null && where !== sq(state, card.uid)) {
        ops.relocate(state, card.uid, where, { withStack: false, under: true });
      }
    },
  },
  replace: {
    // "When this fighter would be destroyed while being Attacked on your turn,
    // put it underneath target fighter you control instead."
    destroy({ state, self, outcome }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host || !outcome?.card || outcome.card.uid !== host.uid) return null;
      if (state.active !== self.owner) return null;   // "on your turn"
      if (!outcome.byAttack) return null;             // "while being Attacked"
      const mine = targets(state, { player: self.owner, side: 'friendly' })
        .filter((c) => sq(state, c.uid) != null);
      if (!mine.length) return null;

      // A replacement cannot stop and ask — it has to answer right now — so the
      // rescued fighter goes under the first of your fighters, and if you have
      // more than one, a question follows that can move it under another.
      const where = sq(state, mine[0].uid);
      const card = ops.extract(state, host.uid);
      if (!card) return null;
      card.fatigued = false;
      ops.place(state, card, where, { under: true });
      inIrons(state, mine[0].uid, card.uid);
      if (mine.length > 1) {
        queue(state, { kind: 'queued', uid: self.uid, name: 'rescue', target: card.uid });
      }
      return { ...outcome, handled: true };
    },
  },
});

function hostOf({ state, self }) {
  if (self?.attachedTo) return ops.findCard(state, self.attachedTo) || null;
  return self || null;
}

/**
 * "Is this square The Void?"
 *
 * Square 9 always is. Veil Shroud makes its own square count as well, and
 * `derived.voidSquares` is where that is recorded — a set that was written by
 * two cards and read by nothing, so Veil Shroud's entire passive did nothing
 * at all while every harness reported it healthy. Every test that used to say
 * `s === VOID` goes through here now.
 */
const VOIDISH = (state, s) => s != null && isVoid(state, s, state.derived);

/** "In or adjacent to The Void", which several cards print as one phrase. */
const VOID_NEAR = (state, s) => s != null
  && (VOIDISH(state, s) || isVoidAdjacent(state, s, state.derived));

/** Every square that counts as The Void, and everyone standing in one. */
const VOID_SQUARES = (state) => voidSquaresOf(state, state.derived);
const IN_VOID = (state) => cardsInVoid(state, state.derived);

/**
 * "Relocate X to The Void" — which one, now that there can be more than one.
 *
 * With a Veil Shroud on the board there are two squares that count, so the
 * destination is a CHOICE rather than the constant 9. Asked only when it is
 * actually ambiguous: a prompt with one option in it is a dialog box that
 * exists to be dismissed, and every one of these fires mid-trigger.
 */
function* intoVoid(state, uid, opts = {}) {
  const spots = VOID_SQUARES(state).filter((s) => s !== sq(state, uid));
  if (!spots.length) return false;
  let to = spots[0];
  if (spots.length > 1) {
    to = yield ask.one(spots, { kind: 'square', prompt: 'Into which Void?' });
    if (to == null) return false;
  }
  return ops.relocate(state, uid, to, { withStack: false, ...opts });
}

/* ==================================================================== */
/* Shared families — these cover most of the pool                        */
/* ==================================================================== */

/**
 * Voidlink, on every Shadow basic: "During your turn, this fighter has the
 * abilities of all fighters that are in The Void and share a trait with it."
 *
 * "Abilities" means the ones printed on the other card — its Action abilities
 * and its Constants. It used to copy `defs[other].abilities`, which holds only
 * the structured "+I when Attacking Hunters" data and is empty for every card
 * that has a named ability, so a Shadow Brute standing next to an Umbren Jailor
 * in The Void gained precisely nothing. That is the entire card.
 */
const VOIDLINK_CODES = ['M184', 'M178', 'M187', 'M175', 'M174', 'M193', 'M192', 'M197', 'M196'];

const VOIDLINK = {
  constant(ctx) {
    const { state, self, derived, depth = 0 } = ctx;
    if (state.active !== self.owner) return;
    if (!state.locations?.void) return;
    const mine = traitsOf(state, self, state.defs, derived);
    const inVoid = IN_VOID(state);
    const gained = [];
    const seen = new Set();

    for (const other of inVoid) {
      if (other.uid === self.uid) continue;
      const theirs = traitsOf(state, other, state.defs, derived);
      if (![...mine].some((t) => theirs.has(t))) continue;

      // the structured combat bonuses, which powerOf reads
      for (const ab of state.defs[other.def]?.abilities || []) {
        const key = `bonus:${ab.trait}:${ab.amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        gained.push(ab);
      }

      const impl = impls(state)[other.def];
      if (!impl) continue;

      // the Action abilities, which is what anyone means by "has the abilities
      // of". They run with `self` bound to THIS fighter, because it is this
      // fighter that has them now.
      for (const a of impl.actions || []) {
        const key = `action:${a.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        gained.push({ ...a, k: 'action' });
      }

      // and the Constants. Voidlink copying Voidlink would recurse forever, so
      // it does not, and the depth guard catches any longer loop.
      if (impl.constant && !VOIDLINK_CODES.includes(other.def) && depth < 2) {
        try {
          impl.constant({ ...ctx, self, depth: depth + 1, borrowedFrom: other });
        } catch { /* a borrowed constant must not take the game down */ }
      }
    }

    if (gained.length) {
      const cur = derived.grantedAbilities.get(self.uid) || [];
      derived.grantedAbilities.set(self.uid, [...cur, ...gained]);
    }
  },
};

def(VOIDLINK_CODES, VOIDLINK);

/** Once per turn, when the attached fighter moves under its own steam or not. */
function boltTrigger({ state, self, card }, trait) {
  const host = self.attachedTo && ops.findCard(state, self.attachedTo);
  if (!host || !card || card.uid !== host.uid) return;
  if (trait && !traitsOf(state, host, state.defs, state.derived).has(trait)) return;
  const key = `bolt:${self.uid}`;
  if (state.usedThisTurn[key]) return;
  state.usedThisTurn[key] = true;
  queue(state, { kind: 'freeUse', uid: host.uid, source: self.uid });
}

/**
 * The Bolt attachments. Nine cards, one shape: grant the host an Action
 * ability, and "once per turn, after the attached <trait> Moves or is
 * relocated, it may Use this Ability".
 */
function boltAttachment({ trait, name, run, canUse }) {
  return {
    // `freeRun` is how the queued free use finds this effect again. A queue
    // entry must be plain data — putting the function itself in state made the
    // state uncloneable, which broke every snapshot taken afterwards.
    //
    // "it MAY Use this Ability" — so it asks first. It used to simply fire.
    *freeRun(ctx) {
      const yes = yield ask.confirm(`Use ${name}?`);
      if (yes) yield* run(ctx);
    },
    constant({ state, self, derived }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host) return;
      const cur = derived.grantedAbilities.get(host.uid) || [];
      derived.grantedAbilities.set(host.uid, [...cur, { k: 'action', name, run, canUse, from: self.uid }]);
    },
    on: {
      // "after attached <trait> Moves OR IS RELOCATED" — both, now that
      // relocation actually announces itself.
      afterMove(ctx) { boltTrigger(ctx, trait); },
      afterRelocate(ctx) { boltTrigger(ctx, trait); },
    },
  };
}

def('A029', boltAttachment({                       // Fire Bolt
  trait: 'Soldier', name: 'Fire Bolt',
  *run(ctx) {
    const { state } = ctx;
    const host = hostOf(ctx);
    const here = host && sq(state, host.uid);
    if (here == null) return;
    const opts = targets(state, {
      player: host.owner, side: 'enemy', adjacentTo: here,
      power: { max: 2 }, notInStack: true,
    });
    const pick = yield ask.one(uids(opts), { prompt: 'Destroy an adjacent I or II' });
    if (!pick) return;
    ops.fx(state, 'bolt', { bolt: 'fire', from: host.uid, to: pick });
    ops.toGraveyard(state, pick);
  },
}));

def('A030', boltAttachment({                       // Ice Bolt
  trait: 'Soldier', name: 'Ice Bolt',
  *run(ctx) {
    const { state } = ctx;
    const host = hostOf(ctx);
    const here = host && sq(state, host.uid);
    if (here == null) return;
    const opts = targets(state, { player: host.owner, side: 'any', adjacentTo: here, exclude: host.uid });
    const pick = yield ask.one(uids(opts), { prompt: 'Strip a trait' });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    const has = [...traitsOf(state, card, state.defs, state.derived)];
    const trait = yield ask.pick(has, { prompt: 'Which trait?' });
    if (!trait) return;
    ops.fx(state, 'bolt', { bolt: 'ice', from: host.uid, to: pick });
    (card.lostTraits ||= []).push({ trait, until: state.turn + 2 });
  },
}));

def('A031', boltAttachment({                       // Earth Bolt
  trait: 'Brute', name: 'Earth Bolt',
  *run(ctx) {
    const { state } = ctx;
    const host = hostOf(ctx);
    const here = host && sq(state, host.uid);
    if (here == null) return;
    const opts = targets(state, { player: host.owner, side: 'any', adjacentTo: here, exclude: host.uid });
    const pick = yield ask.one(uids(opts), { prompt: 'Shove a fighter 1 square' });
    if (!pick) return;
    const from = sq(state, pick);
    const dests = squares(state, { adjacentTo: from, empty: true });
    const to = yield ask.one(dests, { kind: 'square', prompt: 'Where to?' });
    if (to == null) return;
    // SQUARES, not uids, for anything about to move. A uid is resolved to
    // wherever the card is WHEN THE VIEW DRAWS IT, and by then the rules have
    // already moved it — so the cloth wrapped where they ended up instead of
    // where they were taken from.
    ops.fx(state, 'bolt', { bolt: 'earth', from: here, to: from, toSquare: to });
    ops.relocate(state, pick, to, { withStack: false });
  },
}));

def('A032', boltAttachment({                       // Lightning Bolt
  trait: 'Hunter', name: 'Lightning Bolt',
  *run({ state, self }) {
    const host = self.attachedTo ? ops.findCard(state, self.attachedTo) : self;
    const here = sq(state, host.uid);
    if (here == null) return;
    const dests = squares(state, { within: { of: here, range: 2 }, empty: true });
    const to = yield ask.one(dests, { kind: 'square', prompt: 'Blink to' });
    if (to == null) return;
    // it wraps its OWN fighter and puts them down somewhere else
    // Both ends as SQUARES: the fighter this wraps is the one that moves, so
    // a uid here resolved to its NEW square by the time the view drew it and
    // the bolt was struck backwards along the path it had just taken.
    ops.fx(state, 'bolt', { bolt: 'lightning', from: here, to: here, toSquare: to });
    ops.relocate(state, host.uid, to, { withStack: false });
  },
}));

def('M205', boltAttachment({                       // Doom Bolt
  trait: 'Shadow', name: 'Doom Bolt',
  *run({ state, self }) {
    const host = self.attachedTo ? ops.findCard(state, self.attachedTo) : self;
    const here = sq(state, host.uid);
    if (here == null) return;
    const mine = traitsOf(state, host, state.defs, state.derived);
    const doomed = targets(state, {
      player: host.owner, side: 'any', adjacentTo: here,
    }).filter((c) => [...traitsOf(state, c, state.defs, state.derived)].some((t) => mine.has(t)));
    ops.fx(state, 'bolt', { bolt: 'doom', from: host.uid, to: here });
    for (const c of doomed) ops.toGraveyard(state, c.uid);
    ops.toGraveyard(state, host.uid);
  },
}));

def('M206', boltAttachment({                       // Gloom Bolt
  trait: null, name: 'Gloom Bolt',
  *run({ state, self }) {
    const host = self.attachedTo ? ops.findCard(state, self.attachedTo) : self;
    const opts = targets(state, { player: host.owner, side: 'enemy' })
      .filter((c) => {
        const s = sq(state, c.uid);
        return VOID_NEAR(state, s);
      });
    const pick = yield ask.one(uids(opts), { prompt: 'Attack into The Void' });
    if (!pick) return;
    const target = ops.findCard(state, pick);
    const ap = powerOf(state, host, state.defs, state.derived, { attacking: true, vs: target });
    const dp = P(state, target);
    ops.fx(state, 'bolt', { bolt: 'shadow', from: host.uid, to: pick });
    if (ap >= dp) ops.toGraveyard(state, pick);
    if (ap <= dp) ops.toGraveyard(state, host.uid);
  },
}));

def('M207', {                                      // Shadow Bolt
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    const t = derived.traits.get(host.uid) || new Set();
    t.add('Shadow');
    derived.traits.set(host.uid, t);
  },
});

def('A034', {                                      // Pack Cordage
  on: {
    // "After ANOTHER friendly fighter Moves or is relocated from an adjacent
    // square" — the relocation is the event that covers both. See M162.
    afterRelocate({ state, self, card, from }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host || !card || card.uid === host.uid) return;
      const here = sq(state, host.uid);
      if (here == null || distance(state, here, from) !== 1) return;
      if (ops.occupied(state, from)) return;
      ops.relocate(state, host.uid, from, { withStack: false });
    },
  },
});

/** One body, used by the granted ability and by the free use on a Weaver. */
function* tapestryRun({ state: s, self: me }) {
  const used = s.usedThisGame.tapestry || [];
  // Every kind of Action there is — Defend is one, and it was missing.
  // "play" covers putting a card down: a Tactic, a Construct or an Attachment.
  const kinds = ['draw', 'deploy', 'move', 'attack', 'defend', 'ability', 'play']
    .filter((k) => !used.includes(k));
  const kind = yield ask.pick(kinds, { prompt: 'Forbid which Action?' });
  if (!kind) return;
  (s.usedThisGame.tapestry ||= []).push(kind);
  // Threads run out across the table and pull taut; after that, something is
  // simply not allowed any more.
  ops.fx(s, 'threads', { at: me.uid, colour: 0xffc46a });
  s.forbidden = { player: enemy(me.owner), kind, until: s.turn + 2 };
}

const WEAVERS = ['Fateweaver', 'Timeweaver', 'Spaceweaver'];

def('A033', {                                      // Fatewoven Tapestry
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    const cur = derived.grantedAbilities.get(host.uid) || [];
    derived.grantedAbilities.set(host.uid, [...cur, {
      k: 'action', name: 'Fatewoven Tapestry', run: tapestryRun, from: self.uid,
    }]);
  },

  // "After you Play this card on Fateweaver, Timeweaver, or Spaceweaver, it
  // MAY Use this Ability." The second sentence was never implemented, so
  // playing it on a Weaver did nothing extra at all.
  *onAttach({ state, self, host }) {
    if (!host || !WEAVERS.includes(state.defs[host.def]?.name)) return;
    const yes = yield ask.confirm('Fatewoven Tapestry — use it now, free?');
    if (!yes) return;
    yield* tapestryRun({ state, self: host });
  },
});

def('M204', {                                      // Avatar's Burden
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    derived.noGates[host.owner] = true;
  },
  attachAnywhere: true,
  attachTargets(state, card, p) {
    const sh = state.strongholds[p];
    if (!sh?.revealed || !sh.card) return [];
    // "regardless of position" means any SQUARE, not from under another
    // fighter — an Attachment only ever goes on the top of a stack.
    const at = ops.locate(state, sh.card.uid);
    if (at?.zone === 'board' && at.depth !== 0) return [];
    return [sh.card];
  },
});

/* ==================================================================== */
/* Gates and Back Row — the structural ones                              */
/* ==================================================================== */

/** Divine Aurox / Living Stronghold: squares next to me count as my Gates. */
const GATE_BEAST = {
  constant({ state, self, square, derived }) {
    if (square == null) return;
    if (state.active !== self.owner) return;
    if (self.fatigued) return;
    derived.addGates[self.owner].push(...neighbours(state, square));
  },
};
def(['A001', 'LivingStronghold'], GATE_BEAST);

def('A039', {                                      // Looming Large
  *play({ state, self }) {
    const mine = state.gates[self.owner] || [];
    const add = [];
    for (const g of mine) add.push(...neighbours(state, g));
    state.timedGates ||= [];
    state.timedGates.push({ player: self.owner, squares: add, until: state.turn + 1 });
  },
  constant({ state, derived }) {
    for (const t of state.timedGates || []) {
      if (state.turn <= t.until) derived.addGates[t.player].push(...t.squares);
    }
  },
});

def('M003', {                                      // Scylla
  constant({ state, self, derived }) {
    const all = [];
    for (let i = 0; i < state.board.length; i++) {
      if ((state.backRow?.[enemy(self.owner)] || []).includes(i)) continue;
      all.push(i);
    }
    derived.backRow[self.owner].push(...all);
  },
});

def('M046', {                                      // New Moon — the waiting face
  // Registered deliberately empty. Everything New Moon does happens before and
  // between turns — it is placed beside the Stronghold during setup and
  // rotated at the start of each Action Phase — so its rules live in the
  // engine (`tickBeside`) rather than here, where nothing would ever call
  // them: this card is never in a hand, a deck, or on the board.
  //
  // `elsewhere` says so OUT LOUD, because "an empty object plus a comment" is
  // indistinguishable from an unfinished card to every tool that walks this
  // file — tools/verify-abilities.js reported this one as having no
  // implementation, and a standing false alarm in that report is how a real
  // one gets scrolled past.
  elsewhere: 'js/engine.js tickBeside()',
});

def('M046C', {                                     // Charybdis — the turned face
  // Anchored: "This fighter cannot take Move or Attack actions, and it cannot
  // be in a stack."
  //
  // Three separate restrictions, and each needs its own hook: the move and the
  // attack are things IT may not do, the stack is a thing that may not be done
  // TO it. Blocking only the square would still have let it walk away.
  constant({ state, self, derived, square }) {
    derived.cannotMove.push((card) => card.uid === self.uid);
    derived.cannotAttack.push((atk) => atk.uid === self.uid);
    if (square != null) {
      derived.blockEnter.push({ square, blocks: (card) => card.uid !== self.uid });
    }
  },
  actions: [
    {
      name: 'Maelstrom',
      // "Target adjacent enemy fighter Attacks this fighter." The enemy is the
      // ATTACKER, so it is their power attacking and ours defending — getting
      // that backwards would make the whirlpool suicidal against anything big.
      canUse: ({ state, self }) => {
        const here = sq(state, self.uid);
        return here != null && targets(state, {
          player: self.owner, side: 'enemy', type: 'fighter', adjacentTo: here,
        }).length > 0;
      },
      *run({ state, self }) {
        const here = sq(state, self.uid);
        if (here == null) return;
        const foes = targets(state, {
          player: self.owner, side: 'enemy', type: 'fighter', adjacentTo: here,
        });
        const pick = yield ask.one(uids(foes), { prompt: 'Drag which fighter in?' });
        if (!pick) return;
        const atk = ops.findCard(state, pick);
        if (!atk) return;
        const ap = powerOf(state, atk, state.defs, state.derived, { attacking: true, vs: self });
        const dp = powerOf(state, self, state.defs, state.derived, { defending: true });
        // Same exchange every attack in this game uses: the higher power
        // survives, equal powers kill each other.
        if (ap >= dp) ops.toGraveyard(state, self.uid);
        if (ap <= dp) ops.toGraveyard(state, pick);
        ops.fx(state, 'maelstrom', { at: here, victim: pick });
      },
    },
  ],
});

def('M041', {                                      // Temple of Tides
  constant({ state, self, derived }) {
    if (state.active !== self.owner) return;
    const base = state.backRow?.[self.owner] || [];
    const add = new Set();
    for (const s of base) for (const n of neighbours(state, s)) add.add(n);
    derived.backRow[self.owner].push(...add);   // explicitly does not cascade
  },
  constructSquares(state, card, p) {
    return (state.backRow?.[p] || []).filter((s) => !state.constructs.some((c) => c && c.square === s));
  },
});

def('M202', {                                      // Temporary Camp
  constant({ state, self, derived }) {
    if (self.square != null) derived.backRow[self.owner].push(self.square);
  },
  on: {
    // "After a friendly fighter Moves or is relocated from an adjacent
    // square" — the relocation is the event that covers both. See M162.
    afterRelocate({ state, self, card, from }) {
      if (!card || card.owner !== self.owner) return;
      if (self.square == null || distance(state, self.square, from) !== 1) return;
      if (state.constructs.some((c) => c && c.square === from)) return;
      self.square = from;
    },
  },
});

/* ==================================================================== */
/* Deploy-square openers                                                 */
/* ==================================================================== */

def('A053', {                                      // Spirit of Alliance
  constant({ state, self, derived }) {
    if (state.active === self.owner) {
      const t = derived.traits.get(self.uid) || new Set();
      for (const x of ['Brute', 'Soldier', 'Hunter']) t.add(x);
      derived.traits.set(self.uid, t);
    }
    derived.extraDeploy.push((s, card, p) => {
      if (p !== self.owner) return [];
      const mine = traitsOf(s, card, s.defs, s.derived);
      const out = [];
      for (let i = 0; i < s.board.length; i++) {
        const top = ops.topOf(s, i);
        if (!top || top.owner !== p) continue;
        const theirs = traitsOf(s, top, s.defs, s.derived);
        if ([...mine].some((x) => theirs.has(x))) out.push(i);
      }
      return out;
    });
  },
});

def('M200', {                                      // Null Gate
  constant({ state, self, derived }) {
    derived.extraDeploy.push((s, card, p) => {
      if (p !== self.owner) return [];
      if (!traitsOf(s, card, s.defs, s.derived).has('Shadow')) return [];
      const out = [];
      for (let i = 0; i < s.board.length; i++) {
        const top = ops.topOf(s, i);
        if (top && top.owner === p) out.push(i);
      }
      return out;
    });
  },
});

def('M027', {                                      // Totally Normal Villager
  constant({ state, self, square, derived }) {
    if (square == null) return;
    if (!(state.backRow?.[self.owner] || []).includes(square)) return;
    derived.extraDeploy.push((s, card, p) => {
      if (p !== self.owner) return [];
      const pow = s.defs[card.def]?.power ?? 0;
      return pow >= 2 ? [square] : [];
    });
  },
  // "Before you do, put this fighter into your hand WITHOUT ITS STACK."
  //
  // The deploy asks whoever is on the square before it lands anything there.
  // This clause is the entire joke of the card — the villager is never under
  // the fighter you played, it was somewhere else all along — and it had gone
  // unimplemented, so the engine stacked where the card says it swaps.
  beforeCovered({ state, self, incoming }) {
    const pow = state.defs[incoming.def]?.power ?? 0;
    if (pow < 2) return;                       // only a II or a III opens it
    const here = sq(state, self.uid);
    if (here == null) return;
    if (!(state.backRow?.[self.owner] || []).includes(here)) return;
    // The Villager has to announce its OWN disappearance. defaultCast speaks
    // for the card that RESOLVED — which here is the fighter being deployed,
    // not the one getting out of its way — so without this the swap happened
    // in silence and the transformation never played at all.
    ops.fx(state, 'decoy', { at: self.uid });
    ops.toHand(state, self.uid);               // extract() leaves the stack put
  },
});
CARDS.M026 = CARDS.M027;
CARDS.M025 = CARDS.M027;

/* ==================================================================== */
/* Simple Action abilities                                               */
/* ==================================================================== */

def('C050', {                                      // Elven Ranger — Longshot
  actions: [{
    name: 'Longshot',
    *run({ state, self }) {
      const here = sq(state, self.uid);
      const opts = targets(state, {
        player: self.owner, side: 'enemy', power: 1,
        within: { of: here, range: 4 }, notAdjacent: here,
      });
      const pick = yield ask.one(uids(opts), { prompt: 'Snipe a I' });
      if (pick) ops.toGraveyard(state, pick);
    },
  }],
});

def('M079', {                                      // Khosari Cannoneer
  constant({ self, derived }) { derived.basic.add(self.uid); },
  actions: [{
    name: 'Volley',
    *run({ state, self }) {
      const here = sq(state, self.uid);
      const opts = targets(state, {
        player: self.owner, side: 'enemy', trait: ['Soldier', 'Brute'],
        power: { max: 2 },
      }).filter((c) => distance(state, here, sq(state, c.uid)) === 2);
      const pick = yield ask.one(uids(opts), { prompt: 'Volley' });
      if (pick) ops.toGraveyard(state, pick);
    },
  }],
});

def('C084', {                                      // Necromancer — Raise Dead
  actions: [{
    name: 'Raise Dead',
    canUse({ state, self }) {
      return state.players[self.owner].graveyard.some((c) => state.defs[c.def]?.power === 1);
    },
    *run({ state, self }) {
      const dead = state.players[self.owner].graveyard.filter((c) => state.defs[c.def]?.power === 1);
      const pick = yield ask.one(uids(dead), { prompt: 'Raise a I' });
      if (!pick) return;
      const spots = squares(state, { empty: true, player: self.owner, excludeGates: true });
      const to = yield ask.one(spots, { kind: 'square', prompt: 'Where?' });
      if (to == null) return;
      const card = ops.extract(state, pick);
      card.fatigued = true;
      ops.place(state, card, to);
    },
  }],
});

def('C086', {                                      // Undead Horde — Legion
  actions: [{
    name: 'Legion',
    canUse({ state, self }) {
      return state.players[self.owner].graveyard.some(
        (c) => state.defs[c.def]?.power === 1 && state.defs[c.def]?.kind === 'basic');
    },
    *run({ state, self }) {
      const here = sq(state, self.uid);
      if (here == null) return;
      const gy = state.players[self.owner].graveyard;
      const ones = gy.filter((c) => state.defs[c.def]?.power === 1 && state.defs[c.def]?.kind === 'basic');
      for (const c of [...ones]) {
        const card = ops.extract(state, c.uid);
        ops.place(state, card, here, { under: true });
      }
    },
  }],
});

def('R067', {                                      // The Lich — Soul Binding
  // DEPLOYMENT, not an action — the icon is a down arrow.
  *onDeploy({ state, self }) {
    yield* (function* run() {
      const pool = [
        ...state.players[self.owner].deck,
        ...state.players[self.owner].graveyard,
      ].filter((c) => state.defs[c.def]?.realType === 'construct');
      const pick = yield ask.one(uids(pool), { prompt: 'Fetch a Construct', allowNone: true });
      if (pick) ops.toHand(state, pick);
      shuffleDeck(state, self.owner);
    })();
  },
});

def('C006', {                                      // Battlemaster — Tactician
  *onDeploy({ state, self }) {
    const used = state.usedThisGame.tactician || [];
    const gy = state.players[self.owner].graveyard
      .filter((c) => state.defs[c.def]?.type === 'tactic' && !used.includes(c.def));
    const pick = yield ask.one(uids(gy), { prompt: 'Return a Tactic' });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    (state.usedThisGame.tactician ||= []).push(card.def);
    ops.toHand(state, pick);
  },
});

def('C087', {                                      // Echoing Specter — Reverberate
  *onDeploy({ state, self }) {
    const here = sq(state, self.uid);
    if (here == null) return;
    const dead = state.players[self.owner].graveyard.filter((c) => state.defs[c.def]?.power === 1);
    const pick = yield ask.one(uids(dead), { prompt: 'Deploy a I from the Graveyard', allowNone: true });
    if (!pick) return;
    const spots = squares(state, { adjacentTo: here, empty: true });
    const to = yield ask.one(spots, { kind: 'square', prompt: 'Where?' });
    if (to == null) return;
    const card = ops.extract(state, pick);
    card.fatigued = true;
    ops.place(state, card, to);
  },
});

def('A064', {                                      // Detached Shadow — Behind You
  actions: [{
    name: 'Behind You',
    canUse({ state, self }) {
      const here = sq(state, self.uid);
      return here != null && targets(state, { player: self.owner, side: 'enemy', adjacentTo: here }).length > 0;
    },
    *run({ state, self }) {
      const here = sq(state, self.uid);
      const foes = targets(state, { player: self.owner, side: 'enemy', adjacentTo: here });
      const foe = yield ask.one(uids(foes), { prompt: 'Slip behind which enemy?' });
      if (!foe) return;
      const foeSq = sq(state, foe);
      const hosts = targets(state, { player: self.owner, side: 'any', adjacentTo: foeSq, exclude: self.uid });
      const host = yield ask.one(uids(hosts), { prompt: 'Land on top of' });
      if (!host) return;
      ops.relocate(state, self.uid, sq(state, host), { withStack: false });
    },
  }],
});

def('C083', {                                      // Dominating Wraith
  // "Deploy this fighter ON TOP OF target fighter that is not in an opponent's
  // Gates, REGARDLESS OF OWNER, TRAIT, OR POSITION."
  //
  // This is a DEPLOY rule, not something that happens after deploying. It was
  // written as an onDeploy that put the Wraith down by the ordinary rules and
  // then relocated it onto its victim — which meant the printed ability never
  // applied to the only question it answers: WHERE MAY THIS BE PLAYED. With no
  // legal ordinary square the card could not be played at all, and it could
  // never be put on an enemy, which is the whole of it.
  //
  // `deploySquares` is the hook for exactly this, and the three clauses map
  // onto it: every OCCUPIED square (regardless of owner, trait or position),
  // minus an opponent's Gates.
  deploySquares(state, card, p) {
    return squares(state, { player: p, occupied: true, excludeGates: true });
  },
  actions: [{
    name: 'Relinquish',
    *run({ state, self }) {
      const here = sq(state, self.uid);
      const spots = squares(state, { adjacentTo: here, empty: true });
      const to = yield ask.one(spots, { kind: 'square', prompt: 'Move to' });
      if (to != null) ops.relocate(state, self.uid, to, { withStack: false });
    },
  }],
});

def('A042', {                                      // Umbren Jailor
  actions: [
    {
      name: 'Catch',
      *run({ state, self }) {
        const here = sq(state, self.uid);
        const foes = targets(state, { player: self.owner, side: 'enemy', adjacentTo: here });
        const pick = yield ask.one(uids(foes), { prompt: 'Catch' });
        if (!pick) return;
        const card = ops.extract(state, pick);
        ops.place(state, card, here, { under: true });
        inIrons(state, self.uid, card.uid);
      },
    },
    {
      name: 'Release',
      *run({ state, self }) {
        const here = sq(state, self.uid);
        const stack = ops.stackAt(state, here).filter((c) => c.uid !== self.uid);
        const pick = yield ask.one(uids(stack), { prompt: 'Destroy which?' });
        if (pick) ops.toGraveyard(state, pick);
      },
    },
  ],
});

def('A044', {                                      // Heretic Condemner — Man Catcher
  *onDeploy({ state, self }) {
    const here = sq(state, self.uid);
    const spots = squares(state, { adjacentTo: here, occupied: true });
    const from = yield ask.one(spots, { kind: 'square', prompt: 'Sweep which square?', allowNone: true });
    if (from == null) return;
    for (const c of [...ops.stackAt(state, from)]) {
      if (c.owner === self.owner) continue;
      if ((state.defs[c.def]?.power ?? 9) > 2) continue;
      const card = ops.extract(state, c.uid);
      ops.place(state, card, here, { under: true });
      // a separate chain for every one of them, which is what a man catcher
      // sweeping a whole square looks like
      inIrons(state, self.uid, card.uid);
    }
  },
});

def('C048', {                                      // Reckless Chimera
  *onDeploy({ state, self }) {
    const here = sq(state, self.uid);
    const doomed = targets(state, { player: self.owner, side: 'any', adjacentTo: here, power: 1 });
    for (const c of doomed) ops.toGraveyard(state, c.uid);
  },
  deploySquares(state, card, p) {
    return squares(state, { empty: true }).filter((s) => {
      for (let q = 0; q < 2; q++) if (q !== p && (state.gates?.[q] || []).includes(s)) return false;
      return true;
    });
  },
});

def('C049', {                                      // Greater Cockatrice
  *onDeploy({ state, self }) {
    const foes = targets(state, { player: self.owner, side: 'enemy' });
    const pick = yield ask.one(uids(foes), { prompt: 'Petrify', allowNone: true });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    card.startNextTurnFatigued = true;
  },
});

def('M015', {                                      // Wave Runner — Depth Charge
  *onDeploy({ state, self }) {
    const mine = state.backRow[self.owner] || [];
    const foes = targets(state, {
      player: self.owner, side: 'enemy', squares: mine, power: { max: 2 }, excludeGates: true,
    });
    const pick = yield ask.one(uids(foes), { prompt: 'Depth charge', allowNone: true });
    if (!pick) return;
    const where = sq(state, pick);
    ops.toGraveyard(state, pick);
    if (!ops.occupied(state, where)) ops.relocate(state, self.uid, where, { withStack: false });
  },
});

def('A005', {                                      // Bolt Golem — Born of Bolt
  *onDeploy({ state, self }) {
    const here = sq(state, self.uid);
    const near = [];
    for (const { card } of ops.allCards(state)) {
      if (state.defs[card.def]?.realType !== 'attachment') continue;
      if (!card.attachedTo) continue;
      const host = ops.findCard(state, card.attachedTo);
      const hs = host && sq(state, host.uid);
      if (hs != null && distance(state, here, hs) === 1) near.push(card);
    }
    const pick = yield ask.one(uids(near), { prompt: 'Take which Attachment?', allowNone: true });
    if (!pick) return;
    const a = ops.findCard(state, pick);
    ops.detach(state, pick, { toHand: true });
    ops.extract(state, pick);
    (self.attachments ||= []).push(a);
    a.attachedTo = self.uid;

    // "You may Use its Ability." — the third sentence, which was missing: the
    // Golem took the Attachment and then just stood there.
    const impl = impls(state)[a.def];
    const runner = impl?.freeRun || impl?.actions?.[0]?.run;
    if (!runner) return;
    const yes = yield ask.confirm(`Use ${state.defs[a.def]?.name || 'the Attachment'} now?`);
    if (!yes) return;
    yield* runner({
      state, self: a, me: self.owner, ops,
      emit: () => {}, destroy: (uid) => ops.toGraveyard(state, uid),
      refresh: () => {}, rand: () => 0,
    });
  },
  deploySquares(state, card, p) {
    const out = [];
    for (const { card: a } of ops.allCards(state)) {
      if (state.defs[a.def]?.realType !== 'attachment' || !a.attachedTo) continue;
      const host = ops.findCard(state, a.attachedTo);
      const hs = host && sq(state, host.uid);
      if (hs == null) continue;
      for (const n of neighbours(state, hs)) if (!ops.occupied(state, n)) out.push(n);
    }
    return out;
  },
});

/* ==================================================================== */
/* Constant abilities                                                    */
/* ==================================================================== */

def('A066', {                                      // Swarmseeker — Crowd Control
  constant({ state, self, derived }) {
    const here = sq(state, self.uid);
    if (here == null) return;
    let biggest = 0;
    for (const n of neighbours(state, here)) {
      const stack = ops.stackAt(state, n);
      if (stack.length && stack[0].owner !== self.owner) biggest = Math.max(biggest, stack.length);
    }
    if (biggest > 0) derived.powerSet.set(self.uid, biggest);
  },
});

def('C079', {                                      // The Everking — Decree
  // ACTION. The icon is the <+> diamond, not the down arrow — checked against
  // the printed card after this was implemented as a Deployment by mistake.
  actions: [{
    name: 'Decree',
    *run({ state }) { state.decreeUntil = state.turn + 2; },
  }],
  constant({ state, derived }) {
    if (state.decreeUntil && state.turn < state.decreeUntil) derived.globalPowerSet = 1;
  },
});

def('A041', {                                      // Lord High Inquisitor
  constant({ state, self, derived }) {
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== self.owner) continue;
      if (!traitsOf(state, card, state.defs, derived).has('Hunter')) continue;
      const cur = derived.grantedAbilities.get(card.uid) || [];
      derived.grantedAbilities.set(card.uid, [...cur,
        { k: 'bonusVsAttached', attached: CONVICTED, amount: 1 }]);
    }
    // The fatigue exception is printed on Convicted of Heresy itself, not
    // here — this card carries only the +I.
  },
  // Sentence is an ACTION — the <+> diamond. It was implemented as a
  // Deployment on a misread icon, which meant it could only ever fire on the
  // turn the Inquisitor arrived, and never again. It plays TWO.
  actions: [{
    name: 'Sentence',
    *run({ state, self }) {
      yield* convict(state, self.owner, 2);
    },
  }],
});

def('M007', {                                      // Imperial Guard — Usherance
  // "you may relocate that fighter 1 square" — you choose whether, and where.
  // A trigger cannot stop and ask, so it queues an effect that can.
  on: {
    afterEnter({ state, self, card, square }) {
      if (state.active !== self.owner) return;
      const here = sq(state, self.uid);
      if (here == null || square == null || !card) return;
      if (distance(state, here, square) !== 1) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'usher', target: card.uid });
    },
  },
  queued: {
    *usher({ state, descriptor }) {
      const card = ops.findCard(state, descriptor.target);
      const from = card && sq(state, card.uid);
      if (from == null) return;
      const spots = squares(state, { adjacentTo: from, empty: true });
      if (!spots.length) return;
      const to = yield ask.one(spots, {
        kind: 'square', prompt: 'Usher it one square — where?', allowNone: true,
      });
      if (to != null) ops.relocate(state, card.uid, to, { withStack: false });
    },
  },
});

def('M004', {                                      // Capricorn Cavalry — Lash Out
  // "destroy TARGET adjacent X" — the card does not get to pick for you.
  on: {
    // "After this fighter Moves OR IS RELOCATED" — see M162 for why this is
    // `afterRelocate` and not `afterMove`: the follow-up advance after a kill
    // emits only the relocation, and that is most of this card's real use.
    afterRelocate({ state, self, card }) {
      if (!card || card.uid !== self.uid) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'lash' });
    },
  },
  queued: {
    *lash({ state, self }) {
      const here = sq(state, self.uid);
      if (here == null) return;
      const n = self.movedThisTurn || 1;
      const foes = targets(state, {
        player: self.owner, side: 'any', adjacentTo: here, power: n, exclude: self.uid,
      });
      if (!foes.length) return;
      const pick = yield ask.one(uids(foes), {
        prompt: `Lash Out — destroy an adjacent ${['', 'I', 'II', 'III'][n] || n}`,
      });
      if (pick) ops.toGraveyard(state, pick);
    },
  },
});

def('R057', {                                      // Corrupted Shardbeast — Overkill
  on: {
    afterDestroy({ state, self }) {
      if (state.active !== self.owner) return;
      const key = `overkill:${self.uid}:${state.turn}`;
      if (state.usedThisTurn[key]) return;
      state.usedThisTurn[key] = true;
      const here = sq(state, self.uid);
      if (here == null) return;
      for (const c of targets(state, { player: self.owner, side: 'any', adjacentTo: here, power: { max: 2 }, exclude: self.uid })) {
        ops.toGraveyard(state, c.uid);
      }
    },
  },
});

def('C053', {                                      // Demolition "Experts" — Unstable
  // "After this fighter Moves or is relocated, YOU MAY DESTROY IT. After this
  // fighter is destroyed, destroy all Is and IIs that were adjacent."
  //
  // TWO sentences, and only the second was here — so the card could never be
  // set off deliberately, which is the entire point of it. The first sentence
  // is the fuse and the second is the charge, and a charge with no fuse only
  // goes off when the enemy chooses to kill it.
  on: {
    afterRelocate({ state, self, card }) {
      if (!card || card.uid !== self.uid) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'unstable' });
    },
    afterDestroy({ state, self, card, square }) {
      if (!card || card.uid !== self.uid || square == null) return;
      for (const c of targets(state, { player: self.owner, side: 'any', adjacentTo: square, power: { max: 2 } })) {
        ops.toGraveyard(state, c.uid);
      }
    },
  },
  queued: {
    *unstable({ state, self }) {
      // "YOU MAY" — a prompt, not a rule that fires itself. Destroying your
      // own fighter every time it took a step would make the card unplayable
      // rather than dangerous.
      if (!ops.findCard(state, self.uid)) return;
      const yes = yield ask.confirm('Unstable — set off the charge?');
      if (yes) ops.toGraveyard(state, self.uid);
    },
  },
});

def('R060', {                                      // Shard Wisp — Glimmer & Shimmer
  // "put TARGET friendly fighter and TARGET enemy fighter into their owners'
  // hands" — two choices, made by the player, after the Wisp has gone.
  on: {
    afterDestroy({ state, self, card }) {
      if (!card || card.uid !== self.uid) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'glimmer' });
    },
  },
  queued: {
    *glimmer({ state, self }) {
      for (const side of ['friendly', 'enemy']) {
        const pool = targets(state, { player: self.owner, side });
        if (!pool.length) continue;
        const pick = yield ask.one(uids(pool), {
          prompt: side === 'friendly' ? 'Return which fighter of yours?'
            : 'And which of theirs?',
        });
        if (pick != null) ops.toHand(state, pick);
      }
    },
  },
});

def('C164', {                                      // The Wanderer
  constant({ state, self, derived }) {
    derived.cannotAttack.push((atk, target) => {
      if (target.uid !== self.uid) return false;
      const s = sq(state, atk.uid);
      return s != null && ops.stackAt(state, s).length > 1;
    });
  },
  actions: [{
    name: 'Uninvited',
    *run({ state, self }) {
      const stacks = [];
      for (let i = 0; i < state.board.length; i++) {
        const st = ops.stackAt(state, i);
        if (st.length > 1 && st[0].owner !== self.owner) stacks.push(i);
      }
      const pick = yield ask.one(stacks, { kind: 'square', prompt: 'Which enemy stack?' });
      if (pick == null) return;
      const spots = squares(state, { adjacentTo: pick, empty: true });
      const to = yield ask.one(spots, { kind: 'square', prompt: 'Where?' });
      if (to != null) ops.relocate(state, self.uid, to, { withStack: false });
    },
  }],
});

def('R092', {                                      // Bards-for-Hire
  constant({ state, self, derived }) {
    const here = sq(state, self.uid);
    if (here == null) return;
    for (const c of targets(state, { player: self.owner, side: 'enemy', within: { of: here, range: 2 } })) {
      if (c.def === 'R092') continue;               // other Bards play along
      derived.blanked.add(c.uid);
    }
  },
});

/**
 * "Could this fighter attack RIGHT NOW?"
 *
 * Not "is it my turn". GUDNAK has cards that make the OPPONENT attack on their
 * own turn — Marvorren does it — so "your turn / my turn" is the wrong axis
 * entirely, and a card whose bonus depends on whether it is the attacker has
 * to be asked about the POSSIBILITY, not about the clock. This is the same
 * test `legalActions` runs when it decides whether to offer an attack, minus
 * the parts a card cannot see from here.
 */
let asking = false;
function couldAttack(state, card) {
  if (!card || state.active !== card.owner) return false;
  if ((state.actionsLeft ?? 0) <= 0) return false;
  const here = sq(state, card.uid);
  if (here == null) return false;
  if (ops.topOf(state, here)?.uid !== card.uid) return false;   // buried
  const d = state.derived || {};
  const spent = card.fatigued && !d.actWhileFatigued?.has(card.uid);
  const allow = d.attackWhileFatigued || [];
  if (spent && !allow.length) return false;
  const yes = (fn, foe) => { try { return !!fn(card, foe, state); } catch { return false; } };
  for (const to of neighbours(state, here)) {
    const foe = ops.topOf(state, to);
    if (!foe || foe.owner === card.owner) continue;
    if ((d.cannotAttack || []).some((fn) => yes(fn, foe))) continue;
    if (spent && !allow.some((fn) => yes(fn, foe))) continue;
    return true;
  }
  return false;
}

def('A007', {                                      // Threadbearer — Thrum Blade
  // "this fighter has +II when Attacking and +I when being Attacked" — TWO
  // numbers, and it was implemented as a flat +2 that applied to both, so it
  // defended at III. The side of the fight is the whole ability.
  //
  // The number the BOARD shows is the possibility one: if this fighter could
  // attack at this moment it is worth II, and if it cannot it is worth I. A
  // flag off whose turn it is would be wrong — Marvorren can make an opponent
  // attack on their own turn, and then Threadbearer is the one being attacked
  // while its own side's clock is running.
  constant({ state, self, derived }) {
    const mine = state.players[self.owner].hand.length;
    const theirs = state.players[enemy(self.owner)].hand.length;
    if (mine >= theirs) return;
    derived.powerWhen.set(self.uid, {
      attacking: 2,
      defending: 1,
      // Guarded against re-entry: a `cannotAttack` predicate is free to ask
      // what something is worth, and asking that question back here while it
      // is being answered is a stack overflow rather than a wrong number. The
      // flag is module scope and NOT on the state — the state is cloned and
      // hashed for the lockstep check, and a transient field on it is a
      // desync waiting to happen.
      idle: (st, card) => {
        if (asking) return 1;
        asking = true;
        try { return couldAttack(st, card) ? 2 : 1; } finally { asking = false; }
      },
    });
  },
});

def('A008', {                                      // Timeweaver — Temporal Shed
  on: {
    startOfTurn({ state, self, player }) {
      if (player !== self.owner) return;
      const here = sq(state, self.uid);
      if (here != null && (state.gates?.[self.owner] || []).includes(here)) {
        state.extraActions = (state.extraActions || 0) + 1;
      }
    },
  },
});

def('A010', {                                      // Fateweaver — Balanced Weave
  constant({ state, self, derived }) {
    const here = sq(state, self.uid);
    if (here == null || !(state.gates?.[self.owner] || []).includes(here)) return;
    for (const { card } of ops.allCards(state)) {
      if (card.owner === self.owner && (card.attachments || []).length) {
        derived.actWhileFatigued.add(card.uid);
      }
    }
  },
});

def('M164', {                                      // Null Warden — Loomlock
  // "Enemy fighters cannot Move or be relocated INTO OR OUT OF The Void."
  // Only the "into" half was implemented, so an enemy shut in The Void could
  // simply walk back out of it — which is the half of the card that does the
  // work. And it was nailed to square 9, so a Veil Shroud was a hole in the
  // net: the lock counts wherever The Void counts.
  constant({ state, self, derived }) {
    const mine = self.owner;
    for (const square of VOID_SQUARES(state)) {
      derived.blockEnter.push({ square, blocks: (card) => card.owner !== mine });
    }
    derived.cannotMove.push((card, from, to, st) => card.owner !== mine
      && isVoid(st, from, st.derived) && !isVoid(st, to, st.derived));
  },
});

def('M163', {                                      // Fraymaw — Devourer
  constant({ state, self, derived }) {
    const cur = derived.grantedAbilities.get(self.uid) || [];
    derived.grantedAbilities.set(self.uid, [...cur, {
      k: 'bonusVsTraitSquare', amount: 1,
      test: (target) => {
        const s = sq(state, target.uid);
        return VOID_NEAR(state, s);
      },
    }]);
  },
});

def('M087', {                                      // Deckhand Drifter — Shantyman
  constant({ self, derived }) { derived.singing.add(self.uid); },
});

/* ==================================================================== */
/* Tactics                                                               */
/* ==================================================================== */

def('C110', {                                      // Soul Swap
  *play({ state, self }) {
    const mine = targets(state, { player: self.owner, side: 'friendly', notInStack: true });
    const pick = yield ask.one(uids(mine), { prompt: 'Sacrifice which fighter?' });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    const power = state.defs[card.def]?.power;
    const where = sq(state, pick);
    ops.toGraveyard(state, pick);
    const pool = state.players[self.owner].graveyard
      .filter((c) => state.defs[c.def]?.power === power && c.uid !== pick);
    const swap = yield ask.one(uids(pool), { prompt: 'Deploy which in its place?', allowNone: true });
    if (swap == null || ops.occupied(state, where)) return;
    const raised = ops.extract(state, swap);
    raised.fatigued = true;
    ops.place(state, raised, where);
  },
});

def('C113', {                                      // Fratricide
  *play({ state, self }) {
    // A STACK IS TWO OR MORE. A square with one fighter on it is a square
    // with a fighter on it, and this offered every one of them — so "destroy
    // the lowest power fighter in target stack" was a plain "destroy target
    // fighter", which is a different and much better card.
    const stacks = [];
    for (let i = 0; i < state.board.length; i++) {
      if (ops.stackAt(state, i).length > 1) stacks.push(i);
    }
    const pick = yield ask.one(stacks, { kind: 'square', prompt: 'Which stack?' });
    if (pick == null) return;
    const stack = ops.stackAt(state, pick);
    let lowest = Infinity;
    for (const c of stack) lowest = Math.min(lowest, P(state, c));
    const tied = stack.filter((c) => P(state, c) === lowest);
    const which = tied.length === 1 ? tied[0].uid
      : yield ask.one(uids(tied), { prompt: 'Break the tie' });
    if (which) ops.toGraveyard(state, which);
  },
});

def('C073', {                                      // Unmarked Trails
  *play({ state, self }) {
    const opts = targets(state, { player: self.owner, side: 'any', excludeGates: true });
    const pick = yield ask.one(uids(opts), { prompt: 'Bounce which fighter?' });
    if (!pick) return;
    const where = sq(state, pick);
    for (const c of [...ops.stackAt(state, where)]) ops.toHand(state, c.uid);
  },
});

def('C071', {                                      // Diversion
  *play({ state, self }) {
    const mine = targets(state, { player: self.owner, side: 'friendly' });
    const pick = yield ask.one(uids(mine), { prompt: 'Send which to the bottom?' });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    const wasHunter = traitsOf(state, card, state.defs, state.derived).has('Hunter');
    ops.toDeck(state, pick, { bottom: true });
    if (wasHunter) {
      const yes = yield ask.confirm('Draw a card?');
      if (yes) ops.draw(state, self.owner, 1);
    }
  },
});

def('C076', {                                      // Burnout
  *play({ state }) {
    state.actionsLeft += state.lostThisTurn || 0;
  },
});

def('C070', {                                      // Arcane Blast
  *play({ state, self }) {
    const foes = targets(state, { player: self.owner, side: 'enemy' });
    const pick = yield ask.one(uids(foes), { prompt: 'Blast which fighter?' });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    const cost = P(state, card) + 1;
    const hand = state.players[self.owner].hand;
    if (hand.length < cost) return;
    const picks = yield ask.some(uids(hand), cost, { prompt: `Discard ${cost}` });
    for (const uid of picks || []) ops.discard(state, self.owner, uid);
    ops.toGraveyard(state, pick);
  },
  playable(state, card, p) {
    return state.players[p].hand.length >= 2;
  },
});

def('A059', {                                      // Inspiration
  *play({ state, self }) {
    const heroes = targets(state, { player: self.owner, side: 'friendly', kind: 'hero' });
    const pick = yield ask.one(uids(heroes), { prompt: 'Copy whose traits?' });
    if (!pick) return;
    const src = ops.findCard(state, pick);
    state.inspiration = {
      player: self.owner, until: state.turn,
      traits: [...traitsOf(state, src, state.defs, state.derived)],
    };
  },
  constant({ state, derived }) {
    const i = state.inspiration;
    if (!i || state.turn > i.until) return;
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== i.player) continue;
      const t = derived.traits.get(card.uid) || new Set();
      for (const x of i.traits) t.add(x);
      derived.traits.set(card.uid, t);
    }
  },
});

def('A058', {                                      // Shared Knowledge
  *play({ state, self }) {
    const trait = yield ask.pick(['Brute', 'Soldier', 'Hunter', 'Hero', 'Shadow'], { prompt: 'Which trait?' });
    if (!trait) return;
    state.sharedKnowledge = { player: self.owner, trait, until: state.turn };
  },
  constant({ state, derived }) {
    const k = state.sharedKnowledge;
    if (!k || state.turn > k.until) return;
    const pool = [];
    for (let i = 0; i < state.board.length; i++) {
      for (const c of ops.stackAt(state, i)) {
        if (c.owner !== k.player) continue;
        if (!traitsOf(state, c, state.defs, derived).has(k.trait)) continue;
        pool.push(c);
      }
    }
    const all = [];
    for (const c of pool) for (const ab of state.defs[c.def]?.abilities || []) {
      if (!all.some((x) => x.name === ab.name)) all.push(ab);
    }
    for (const c of pool) {
      const cur = derived.grantedAbilities.get(c.uid) || [];
      derived.grantedAbilities.set(c.uid, [...cur, ...all.filter((a) => !cur.some((x) => x.name === a.name))]);
    }
  },
});

def('M035', {                                      // Tidal Wave
  *play({ state, self }) {
    const dir = yield ask.pick(['up', 'down', 'left', 'right'], { prompt: 'Which way?' });
    if (!dir) return;
    const delta = { up: -3, down: 3, left: -1, right: 1 }[dir];
    const row = state.backRow[self.owner] || [];
    // ORDER MATTERS. Moving the fighter FURTHEST along the direction of travel
    // first empties the square behind it for the next one — going in index
    // order, the leader blocks the follower and only one of them ever moves.
    const movers = row
      .filter((s) => s < 9 && ops.stackAt(state, s).length)
      .sort((a, b) => (delta > 0 ? b - a : a - b));
    for (const s of movers) {
      const to = s + delta;
      if (to < 0 || to > 8) continue;
      if (Math.abs(delta) === 1 && Math.floor(to / 3) !== Math.floor(s / 3)) continue;
      if (ops.occupied(state, to)) continue;
      const top = ops.topOf(state, s);
      if (top) ops.relocate(state, top.uid, to, { withStack: true });
    }
  },
});

def('A068', {                                      // The Living Dead
  *play({ state }) {
    for (let p = 0; p < 2; p++) {
      const ones = state.players[p].graveyard.filter((c) => state.defs[c.def]?.power === 1);
      for (const s of state.backRow[p] || []) {
        const top = ops.topOf(state, s);
        if (!top || top.owner !== p) continue;
        const c = ones.shift();
        if (!c) break;
        const card = ops.extract(state, c.uid);
        ops.place(state, card, s);
      }
    }
  },
});

def('R072', {                                      // Shallow Grave
  *play({ state, self }) {
    const gy = state.players[self.owner].graveyard
      .filter((c) => (state.defs[c.def]?.power ?? 9) <= 2);
    const two = yield ask.by(enemy(self.owner), ask.some(uids(gy), 2, { prompt: 'Offer two' }));
    const pick = yield ask.one(two || [], { prompt: 'Take which?' });
    if (!pick) return;
    const hosts = targets(state, { player: self.owner, side: 'any' });
    const host = yield ask.one(uids(hosts), { prompt: 'Bury it under which fighter?' });
    if (!host) return;
    const card = ops.extract(state, pick);
    ops.place(state, card, sq(state, host), { under: true });
  },
});

def('A046', {                                      // Incarceration
  *play({ state, self }) {
    const heroes = targets(state, { player: self.owner, side: 'friendly', kind: 'hero' });
    const host = yield ask.one(uids(heroes), { prompt: 'Which Hero jails?' });
    if (!host) return;
    const here = sq(state, host);
    const foes = targets(state, { player: self.owner, side: 'enemy', adjacentTo: here, power: { max: 2 } });
    const pick = yield ask.one(uids(foes), { prompt: 'Jail which?' });
    if (!pick) return;
    const card = ops.extract(state, pick);
    ops.place(state, card, here, { under: true });
    inIrons(state, host, card.uid);
  },
});

def('M198', {                                      // Blackout
  *play({ state }) { state.blackoutUntil = state.turn + 2; },
  constant({ state, derived }) {
    if (!state.blackoutUntil || state.turn >= state.blackoutUntil) return;
    derived.cannotAttack.push((atk, target, s) => {
      const at = traitsOf(s, atk, s.defs, derived);
      const dt = traitsOf(s, target, s.defs, derived);
      return at.has('Shadow') || dt.has('Shadow');
    });
  },
});

def('M199', {                                      // Drop Shadow
  *play({ state, self }) {
    const shadows = targets(state, { player: self.owner, side: 'any', trait: 'Shadow' });
    const pick = yield ask.one(uids(shadows), { prompt: 'Bounce which Shadow?' });
    if (pick) ops.toHand(state, pick);
    // "Then, you may Deploy a Shadow." — the second sentence, which was missing.
    yield* deployAShadow(state, self.owner);
  },
});

def('A036', {                                      // Time Warp
  *play({ state, self }) {
    (state.nextTurnExtra ||= [0, 0])[self.owner] += 2;
  },
});

def('A038', {                                      // Migration
  // "Choose a square in your Back Row. That square is now your Gates. (You may
  // put your Stronghold behind it as a reminder.) If you still have cards in
  // your deck, shuffle this card into your deck."
  //
  // The Gates MOVE rather than gain a square, which is why `state.homeGate`
  // exists at all: every other Gates effect adds or removes one through the
  // continuous layer, and those all vanish when their card leaves play. This
  // one has to outlive the card — it shuffles itself back into the deck — so
  // it is a stored value.
  *play({ state, self }) {
    const row = (state.backRow?.[self.owner] || []).filter((s) => s >= 0 && s < 9);
    if (row.length) {
      const to = yield ask.one(row, { kind: 'square', prompt: 'Your Gates are now where?' });
      // No log line: `log` is private to the engine, and the engine already
      // records that Migration was played.
      if (to != null) (state.homeGate ||= [1, 7])[self.owner] = to;
    }
    // Back into the deck instead of the graveyard — but only if there is a
    // deck to go into. With an empty deck it is discarded like anything else,
    // which is what stops a player recycling it forever while Sieged. The
    // engine does the moving, once, when the Tactic retires; setting it here
    // and pushing the card ourselves would put it in two zones at once.
    if (state.players[self.owner].deck.length) self.toDeck = true;
  },
});

def('A040', {                                      // Winds of the Steppe
  *play({ state, self }) {
    const dir = yield ask.pick(['up', 'down', 'left', 'right'], { prompt: 'Which way?' });
    if (!dir) return;
    const delta = { up: -3, down: 3, left: -1, right: 1 }[dir];
    const order = delta > 0 ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (const s of order) {
      const top = ops.topOf(state, s);
      if (!top) continue;
      if ((state.gates || []).some((g) => g.includes(s))) continue;
      const to = s + delta;
      if (to < 0 || to > 8) continue;
      if (Math.abs(delta) === 1 && Math.floor(to / 3) !== Math.floor(s / 3)) continue;
      if (ops.occupied(state, to)) continue;
      ops.relocate(state, top.uid, to, { withStack: true });
      if (top.owner !== self.owner) top.startNextTurnFatigued = true;
    }
  },
});

def('A035', {                                      // Dyed in the Wool
  *play({ state, self }) {
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== self.owner || !(card.attachments || []).length) continue;
      state.derived.actWhileFatigued.add(card.uid);
    }
  },
});

/* ==================================================================== */
/* Constructs                                                            */
/* ==================================================================== */

def('M069', {                                      // Hallowed Ground
  actions: [{
    name: 'Hallowed Ground',
    canUse({ state, self }) { return !state.usedThisTurn[`hg:${self.uid}`]; },
    *run({ state, self }) {
      state.usedThisTurn[`hg:${self.uid}`] = true;
      const spots = squares(state, { adjacentTo: self.square });
      const pick = yield ask.one(spots, { kind: 'square', prompt: 'Ward which square?' });
      if (pick == null) return;
      (state.wards ||= []).push({ square: pick, owner: self.owner, until: state.turn + 2 });
    },
  }],
  constant({ state, self, derived }) {
    for (const w of state.wards || []) {
      if (state.turn >= w.until) continue;
      derived.blockEnter.push({ square: w.square, blocks: (c) => c.owner !== w.owner });
    }
  },
});

def('R074', {                                      // Empty Crypt
  // "When you would put a fighter into your hand from anywhere except your
  // deck, you may put it on top of this Construct instead."
  //
  // A replacement cannot ask a question — replacements run synchronously, and
  // "you may" is a real decision here, because landing on the Crypt puts the
  // fighter on the board in the open AND switches the Crypt's own ability off.
  // So the interception is done a beat later: the card goes to hand, the Crypt
  // queues a question, and answering yes moves it onto the Crypt. The end
  // state is the one the card describes, and the choice survives.
  on: {
    afterToHand({ state, self, card, from }) {
      if (from === 'deck') return;
      if (!card || card.owner !== self.owner) return;
      if (state.defs[card.def]?.type !== 'fighter') return;
      if (self.square == null || ops.occupied(state, self.square)) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'crypt', target: card.uid });
    },
  },
  queued: {
    *crypt({ state, self, descriptor }) {
      const card = state.players[self.owner].hand.find((c) => c.uid === descriptor.target);
      if (!card) return;
      if (self.square == null || ops.occupied(state, self.square)) return;
      const yes = yield ask.confirm(`Put ${state.defs[card.def]?.name || 'it'} on the Empty Crypt?`);
      if (!yes) return;
      const taken = ops.extract(state, card.uid);
      if (taken) ops.place(state, taken, self.square);
    },
  },
  actions: [{
    name: 'Empty Crypt',
    canUse({ state, self }) {
      return state.players[self.owner].graveyard.some((c) => state.defs[c.def]?.power === 1);
    },
    *run({ state, self }) {
      const ones = state.players[self.owner].graveyard.filter((c) => state.defs[c.def]?.power === 1);
      const pick = yield ask.one(uids(ones), { prompt: 'Retrieve a I' });
      if (pick) ops.toHand(state, pick);
    },
  }],
});

def('R073', {                                      // Phylactery
  replace: {
    destroy({ state, self, outcome }) {
      const card = outcome.card;
      if (!card || card.owner !== self.owner) return null;
      if (state.defs[card.def]?.kind !== 'hero') return null;
      if (self.square == null || ops.occupied(state, self.square)) return null;
      ops.extract(state, card.uid);
      card.fatigued = false;
      ops.place(state, card, self.square);
      const i = state.constructs.findIndex((c) => c && c.uid === self.uid);
      if (i >= 0) {
        const con = state.constructs.splice(i, 1)[0];
        state.players[con.owner].graveyard.push(con);
      }
      return { ...outcome, handled: true };
    },
  },
});

def('R076', {                                      // Funeral Pyre
  actions: [{
    name: 'Funeral Pyre',
    canUse({ state, self }) {
      return targets(state, { player: self.owner, side: 'friendly', power: 1, inStack: 'any' }).length >= 3;
    },
    *run({ state, self }) {
      const ones = targets(state, { player: self.owner, side: 'friendly', power: 1, inStack: 'any' });
      const picks = yield ask.some(uids(ones), 3, { prompt: 'Burn three Is' });
      for (const uid of picks || []) ops.toGraveyard(state, uid);
      const foes = targets(state, { player: self.owner, side: 'enemy', power: { max: 2 } });
      const kill = yield ask.one(uids(foes), { prompt: 'Destroy which?' });
      if (kill) ops.toGraveyard(state, kill);
    },
  }],
});

def('R053', {                                      // Ballista
  actions: [{
    name: 'Ballista',
    canUse({ state, self }) { return state.players[enemy(self.owner)].deck.length > 0; },
    *run({ state, self }) {
      const foe = enemy(self.owner);
      const top = state.players[foe].deck[0];
      if (!top) return;
      const isOne = state.defs[top.def]?.power === 1;
      // A reveal you never see is not a reveal. Stop and show the card.
      yield ask.one([top.uid], {
        prompt: isOne ? 'Revealed — a I, so it is discarded'
          : 'Revealed — not a I, so it stays on the deck',
      });
      if (isOne) {
        state.players[foe].deck.shift();
        state.players[foe].graveyard.push(top);
      }
    },
  }],
});

def('M040', {                                      // Jagged Rocks
  // Its whole function is to react to being stood on, so it must stay awake
  // while covered — the general rule switches a covered Construct off.
  whileCovered: true,
  replace: {
    // "During your turn, when an enemy fighter enters this square, destroy
    // that fighter INSTEAD of this Construct."
    constructEntered({ state, self, outcome }) {
      if (outcome.construct.uid !== self.uid) return null;
      if (state.active !== self.owner) return null;
      const victim = outcome.intruder;
      if (!victim) return null;
      ops.toGraveyard(state, victim.uid);
      return { ...outcome, handled: true };
    },
  },
  constructSquares(state, card, p) {
    return (state.backRow?.[p] || []).filter((s) => !state.constructs.some((c) => c && c.square === s));
  },
});

def('M201', {                                      // Shadowstep Shuttle
  actions: [{
    name: 'Shadowstep Shuttle',
    *run({ state, self }) {
      const from = self.square;
      const spots = squares(state, { adjacentTo: from });
      const to = yield ask.one(spots, { kind: 'square', prompt: 'Shuttle to' });
      if (to == null) return;
      self.square = to;
      // "You may Deploy a Shadow to the square it left." — also missing.
      yield* deployAShadow(state, self.owner, from);
    },
  }],
});

def('M203', {                                      // Veil Shroud
  // "this square is considered The Void, EVEN IF A FIGHTER IS ON TOP OF IT"
  whileCovered: true,
  constant({ state, self, derived }) {
    if (state.active === self.owner && self.square != null) derived.voidSquares.add(self.square);
  },
  actions: [{
    name: 'Veil Shroud',
    *run({ state, self }) {
      const spots = squares(state, { adjacentTo: self.square });
      const to = yield ask.one(spots, { kind: 'square', prompt: 'Drift to' });
      if (to != null) self.square = to;
    },
  }],
});

/* ==================================================================== */
/* Traps — Constructs played facedown with a Triggered condition          */
/* ==================================================================== */

function trap({ name, arm = 'enter', fire, blocks = null }) {
  return {
    onPlay: function* ({ self }) { self.facedown = true; },
    on: {
      startOfTurn({ state, self, player }) {
        if (player !== self.owner || !self.facedown) return;
        self.facedown = false;
        fire({ state, self });
      },
    },

    // "...or BEFORE an enemy fighter enters this square." The intruder is
    // still standing where it started when this runs, which is the only way
    // an Explosive Trap can ever catch the fighter that set it off. Listening
    // for the ARRIVAL instead meant the trap had already been crushed by the
    // fighter standing on it and never went off at all.
    onIntrusion: arm !== 'enter' ? null : ({ state, self, card }) => {
      if (!self.facedown) return false;
      self.facedown = false;
      fire({ state, self, card });
      // The entry is off if the intruder did not survive, or if the Construct
      // now refuses it. Survival means still ON THE BOARD — findCard walks the
      // graveyards too, so a fighter it had just killed still read as alive.
      if (ops.locate(state, card.uid)?.zone !== 'board') return true;
      return blocks ? blocks({ state, self, card }) : false;
    },
    constructSquares(state, card, p) {
      const out = [];
      for (let i = 0; i < 9; i++) {
        if (state.constructs.some((c) => c && c.square === i)) continue;
        if (name === 'Blockade' && (state.backRow?.[p] || []).includes(i)) continue;
        out.push(i);
      }
      return out;
    },
  };
}

def('R062', {                                      // Blockade
  ...trap({
    name: 'Blockade',
    fire: () => {},
    // "Enemy fighters that are not Brutes cannot enter this square" — it flips
    // up as they try, and then they cannot.
    blocks: ({ state, self, card }) => !traitsOf(state, card, state.defs, state.derived).has('Brute'),
  }),
  constant({ state, self, derived }) {
    if (self.facedown || self.square == null) return;
    derived.blockEnter.push({
      square: self.square,
      blocks: (c) => c.owner !== self.owner
        && !traitsOf(state, c, state.defs, derived).has('Brute'),
    });
  },
});

def('R063', {                                      // Explosive Trap
  ...trap({
    name: 'Explosive Trap',
    fire({ state, self }) {
      const here = self.square;
      for (const c of targets(state, { player: self.owner, side: 'any', adjacentTo: here })) {
        ops.toGraveyard(state, c.uid);
      }
      for (const c of [...state.constructs]) {
        if (c && c.uid !== self.uid && distance(state, c.square, here) === 1) {
          const i = state.constructs.findIndex((x) => x && x.uid === c.uid);
          state.players[c.owner].graveyard.push(state.constructs.splice(i, 1)[0]);
        }
      }
      const i = state.constructs.findIndex((c) => c && c.uid === self.uid);
      if (i >= 0) state.players[self.owner].graveyard.push(state.constructs.splice(i, 1)[0]);
    },
  }),
});

def('R065', {                                      // Concealed Post
  ...trap({
    name: 'Concealed Post', arm: 'turn',
    fire({ state, self }) {
      // "put A FIGHTER from your hand into this square" — which one is yours
      // to decide, so the trap queues the question rather than grabbing the
      // leftmost card in your hand.
      queue(state, { kind: 'queued', uid: self.uid, name: 'post' });
    },
  }),
  queued: {
    *post({ state, self }) {
      const hand = state.players[self.owner].hand
        .filter((c) => state.defs[c.def]?.type === 'fighter');
      if (!hand.length || ops.occupied(state, self.square)) return;
      const pick = yield ask.one(uids(hand), { prompt: 'Post which fighter?', allowNone: true });
      if (pick == null) return;
      const card = ops.extract(state, pick);
      if (card) ops.place(state, card, self.square);
      const i = state.constructs.findIndex((c) => c && c.uid === self.uid);
      if (i >= 0) state.players[self.owner].graveyard.push(state.constructs.splice(i, 1)[0]);
    },
  },
});

/* ==================================================================== */

function shuffleDeck(state, p) {
  const deck = state.players[p].deck;
  for (let i = deck.length - 1; i > 0; i--) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    const j = Math.abs(state.rng) % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

export default CARDS;

/* ==================================================================== */
/* The rest of the pool                                                  */
/* ==================================================================== */

// Strongholds are keyed by name — they carry no collector code.
CARDS['Living Stronghold'] = { ...GATE_BEAST };
CARDS['Black Aurox'] = {
  constant({ state, self, square, derived }) {
    if (square == null || state.active !== self.owner) return;
    // "squares adjacent to this fighter are considered ADJACENT TO The Void"
    // — not "are The Void", which is what writing them into voidSquares said.
    for (const n of neighbours(state, square)) derived.adjacentVoid.add(n);
  },
};

// The Void is set up by the engine before the game; the card itself does
// nothing once it is in place.
def('M208', { passiveOnly: true });

/* ---------------------------------------------------------------- Songs */

/**
 * Every Song is the same cost: "Fatigue any number of Is you control, they are
 * considered Singing until the end of your turn", and X is how many are
 * Singing. The effect then differs.
 */
function song(effect) {
  return {
    *play(ctx) {
      const { state, self } = ctx;
      const ones = targets(state, { player: self.owner, side: 'friendly', power: 1, inStack: 'any' })
        .filter((c) => !c.fatigued);
      const picked = ones.length
        ? yield ask.some(uids(ones), ones.length, { prompt: 'Fatigue any number of Is', exact: false })
        : [];
      const chosen = picked || [];
      for (const uid of chosen) {
        const c = ops.findCard(state, uid);
        if (c) { c.fatigued = true; c.singing = true; }
      }
      const already = [];
      for (const { card } of ops.allCards(state)) {
        if (card.owner === self.owner && card.singing && !chosen.includes(card.uid)) already.push(card);
      }
      const X = chosen.length + already.length
        + (state.derived.singing.size ? [...state.derived.singing].length : 0);
      yield* effect(ctx, X);
    },
    playable(state, card, p) { return true; },
  };
}

def('M029', song(function* ({ state, self }, X) {   // Aria of Aggression
  const foes = targets(state, { player: self.owner, side: 'enemy' })
    .filter((c) => P(state, c) <= X);
  const foe = yield ask.one(uids(foes), { prompt: `Force an enemy (power ${X} or less) to attack` });
  if (!foe) return;
  const here = sq(state, foe);
  const victims = targets(state, { player: self.owner, side: 'friendly', adjacentTo: here });
  const victim = yield ask.one(uids(victims), { prompt: 'Which of yours does it hit?' });
  if (!victim) return;
  const atk = ops.findCard(state, foe), tgt = ops.findCard(state, victim);
  const ap = powerOf(state, atk, state.defs, state.derived, { attacking: true, vs: tgt });
  const dp = P(state, tgt);
  if (ap >= dp) ops.toGraveyard(state, victim);
  if (ap <= dp) ops.toGraveyard(state, foe);
}));

def('M031', song(function* ({ state, self }, X) {   // Coercive Cantata
  const foes = targets(state, { player: self.owner, side: 'enemy' })
    .filter((c) => P(state, c) <= X);
  const foe = yield ask.one(uids(foes), { prompt: `Shove an enemy (power ${X} or less)` });
  if (!foe) return;
  const here = sq(state, foe);
  const dests = squares(state, { empty: true })
    .filter((s) => distance(state, here, s) === P(state, ops.findCard(state, foe)));
  const to = yield ask.one(dests, { kind: 'square', prompt: 'Where?' });
  if (to != null) ops.relocate(state, foe, to, { withStack: false });
}));

def('M068', song(function* ({ state, self }, X) {   // Dirge of Deconstruction
  const pool = state.players[self.owner].graveyard
    .filter((c) => state.defs[c.def]?.realType === 'construct' && (state.defs[c.def]?.cost ?? 9) < X);
  const pick = yield ask.one(uids(pool), { prompt: 'Raise a Construct' });
  if (!pick) return;
  const spots = squares(state, {}).filter((s) => !state.constructs.some((c) => c && c.square === s));
  const to = yield ask.one(spots, { kind: 'square', prompt: 'Where?' });
  if (to == null) return;
  const card = ops.extract(state, pick);
  card.square = to;
  state.constructs.push(card);
}));

/* ------------------------------------------------- Refractory leftovers */

def('A045', {                                      // Inquisitorial Confessor
  actions: [{
    name: 'Cross Examine',
    canUse({ state, self }) {
      return targets(state, { player: self.owner, side: 'enemy', inStack: 'buried' }).length > 0;
    },
    *run({ state, self }) {
      // reaches INSIDE a stack, which the default targeting rule forbids
      const buried = targets(state, { player: self.owner, side: 'enemy', inStack: 'buried' });
      const pick = yield ask.one(uids(buried), { prompt: 'Pull an enemy out of a friendly stack' });
      if (!pick) return;
      const victim = ops.findCard(state, pick);
      const vTraits = [...T(state, victim)];
      const owner = victim.owner;
      ops.toGraveyard(state, pick);
      const top = state.players[owner].deck[0];
      if (!top) return;
      const topTraits = state.defs[top.def]?.traits || [];
      if (topTraits.some((t) => vTraits.includes(t))) {
        state.players[owner].deck.shift();
        state.players[owner].graveyard.push(top);
      }
    },
  }],
});

def('A047', {                                      // Decarceration
  *play({ state, self }) {
    const buried = targets(state, { player: self.owner, side: 'enemy', inStack: 'buried' });
    const pick = yield ask.one(uids(buried), { prompt: 'Destroy an enemy inside your stack' });
    if (!pick) return;
    const victim = ops.findCard(state, pick);
    const vTraits = [...T(state, victim)];
    const owner = victim.owner;
    const convicted = isConvicted(victim);
    ops.toGraveyard(state, pick);
    for (let i = 0; i < (convicted ? 2 : 1); i++) {
      const top = state.players[owner].deck[0];
      if (!top) return;
      const tt = state.defs[top.def]?.traits || [];
      const shares = tt.some((t) => vTraits.includes(t));
      yield ask.one([top.uid], {
        prompt: shares ? 'Revealed — shares a trait, so it is discarded'
          : 'Revealed — no shared trait, so it stays',
      });
      if (shares) {
        state.players[owner].deck.shift();
        state.players[owner].graveyard.push(top);
      }
    }
  },
  playable(state, card, p) {
    return targets(state, { player: p, side: 'enemy', inStack: 'buried' }).length > 0;
  },
});

def('A050', {                                      // Inquisitorial Mandate
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    const t = derived.traits.get(host.uid) || new Set();
    t.add('Hunter');
    derived.traits.set(host.uid, t);
    const cur = derived.grantedAbilities.get(host.uid) || [];
    derived.grantedAbilities.set(host.uid, [...cur, {
      k: 'action', name: 'Sentence', from: self.uid,
      *run({ state: s, self: me }) {
        yield* convict(s, me.owner, 1);
      },
    }]);
  },
  attachFilter(state, host) {
    return state.defs[host.def]?.kind === 'hero';
  },
});

def('A049', {                                      // Dawnsteel Blade
  on: {
    afterAttack({ state, self, attacker, result }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host || !attacker || attacker.uid !== host.uid || !result?.defDies) return;
      (state.queue ||= []).push({ kind: 'freeUse', uid: host.uid, source: self.uid });
    },
  },
  freeRun: function* ({ state, self }) {
    const used = state.usedThisGame.dawnsteel || [];
    const gy = state.players[self.owner].graveyard
      .filter((c) => state.defs[c.def]?.type === 'tactic' && !used.includes(c.def));
    const pick = yield ask.one(uids(gy), { prompt: 'Replay a Tactic', allowNone: true });
    if (!pick) return;
    const card = ops.findCard(state, pick);
    (state.usedThisGame.dawnsteel ||= []).push(card.def);
    ops.toHand(state, pick);
  },
  attachFilter(state, host) {
    return traitsOf(state, host, state.defs, state.derived).has('Soldier');
  },
});

def('M064', {                                      // Unstable Shard Maul
  on: {
    afterAttack({ state, self, attacker }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host || !attacker || attacker.uid !== host.uid) return;
      const key = `maul:${self.uid}`;
      if (state.usedThisTurn[key]) return;
      state.usedThisTurn[key] = true;
      host.fatigued = false;          // it may Attack an additional time
    },
  },
  attachFilter(state, host) {
    return traitsOf(state, host, state.defs, state.derived).has('Soldier');
  },
});

def('M066', {                                      // Soulbound Gargoyle
  constant({ state, self, derived }) {
    for (const c of state.constructs || []) {
      if (!c || c.owner !== self.owner || c.square == null) continue;
      derived.blockEnter.push({
        square: c.square,
        blocks: (card, s) => {
          if (card.owner === self.owner) return false;
          const at = ops.locate(s, card.uid);
          return !(at && ops.stackAt(s, at.square).length > 1);
        },
      });
    }
  },
});

/* ------------------------------------------------- Shardsworn leftovers */

def('GMW164/189', {                                // The Shard Dragon
  // DEPLOYMENT, not an action — the icon is a down arrow.
  *onDeploy({ state, self }) {
      ops.fx(state, 'shardfire', { at: self.uid });   // it lands hard
      // "you may repeat this any number of times" — a loop around a choice
      for (let round = 0; round < 12; round++) {
        const mine = targets(state, { player: self.owner, side: 'friendly', exclude: self.uid });
        if (!mine.length) return;
        const fodder = yield ask.one(uids(mine), { prompt: 'Sacrifice which of yours?', allowNone: round > 0 });
        if (!fodder) return;
        const power = P(state, ops.findCard(state, fodder));
        // the Dragon's own red-pink fire, for EVERY death it causes, yours
        // as readily as theirs
        ops.fx(state, 'shardfire', { at: fodder });
        ops.toGraveyard(state, fodder);
        const foes = targets(state, { player: self.owner, side: 'enemy', power: { max: power } });
        const kill = yield ask.one(uids(foes), { prompt: 'Destroy which enemy?', allowNone: true });
        if (!kill) return;
        ops.fx(state, 'shardfire', { at: kill });
        ops.toGraveyard(state, kill);
        const again = yield ask.confirm('Again?');
        if (!again) return;
      }
  },
});

/* ------------------------------------------------- Auroxi leftovers */

def('A002', {                                      // Bolt Bender — Attuned
  actions: [{
    name: 'Attuned',
    canUse({ state, self }) {
      return state.players[self.owner].hand.some((c) => state.defs[c.def]?.realType === 'attachment');
    },
    *run({ state, self }) {
      const hand = state.players[self.owner].hand
        .filter((c) => state.defs[c.def]?.realType === 'attachment');
      const pick = yield ask.one(uids(hand), { prompt: 'Attune which Attachment?' });
      if (!pick) return;
      for (const a of [...(self.attachments || [])]) ops.detach(state, a.uid, { toHand: true });
      const card = ops.extract(state, pick);
      (self.attachments ||= []).push(card);
      card.attachedTo = self.uid;
      self.fatigued = false;                       // "Do not fatigue this fighter"
      const fn = CARDS[card.def]?.freeRun;
      if (fn) yield* fn({ state, self: card });
    },
  }],
});

def('A009', {                                      // Spaceweaver
  *onDeploy({ state, self }) {
    const gy = state.players[self.owner].graveyard
      .filter((c) => state.defs[c.def]?.realType === 'attachment');
    const pick = yield ask.one(uids(gy), { prompt: 'Return an Attachment', allowNone: true });
    if (pick) ops.toHand(state, pick);
  },
  constant({ state, self, derived }) {
    const here = sq(state, self.uid);
    if (here != null && (state.gates?.[self.owner] || []).includes(here)) {
      (derived.extraAttach ||= []).push(self.owner);
    }
  },
});

def('A011', {                                      // Veteran Herdsman
  *onDeploy({ state, self }) {
    // "Put Migration into your hand from outside the game" — a token-like card
    // that does not exist in the pool yet, so this records the promise rather
    // than inventing a card.
    (state.outsideGame ||= []).push({ player: self.owner, card: 'Migration' });
  },
});

def('A004', {                                      // Death Leaper
  actions: [{
    name: 'Head Home',
    *run({ state, self }) { ops.toHand(state, self.uid); },
  }],
  on: {
    afterDefend({ state, self, player }) {
      if (player !== self.owner) return;
      const g = (state.gates?.[self.owner] || [])[0];
      if (g == null || ops.occupied(state, g)) return;
      const inHand = state.players[self.owner].hand.find((c) => c.uid === self.uid);
      if (!inHand) return;
      const card = ops.extract(state, self.uid);
      card.fatigued = true;
      ops.place(state, card, g);
    },
  },
});

def('A006', {                                      // Fist of Fabric — Long Weave
  constant({ state, self, derived }) {
    (derived.longReach ||= new Set()).add(self.uid);
  },
});

def('A003', {                                      // Mammoth Caravan — Pilot Animal
  // "Once per turn, after this fighter Moves OR IS RELOCATED, you may relocate
  // TARGET other fighter you control to the square it left. If you do, you may
  // REPEAT this ability with that fighter."
  //
  // The old version listened only for a Move, picked the follower itself, and
  // demanded that follower already be next to the vacated square — none of
  // which the card says. With no neighbour it silently did nothing, which is
  // exactly how it looked from the table.
  on: {
    afterMove(ctx) { pilotAnimal(ctx); },
    afterRelocate(ctx) { pilotAnimal(ctx); },
  },
  queued: {
    *pilot({ state, self, descriptor }) {
      let vacated = descriptor.from;
      // EACH FIGHTER ONLY ONCE. The chain walks down a line of your fighters,
      // each stepping into the square the one ahead of it left — a fighter
      // that has already come along cannot be picked again to come along
      // twice, or the same two could shuffle back and forth all turn.
      const alreadyCame = new Set([self.uid]);

      for (let step = 0; step < 8; step++) {
        if (vacated == null || ops.occupied(state, vacated)) return;
        const others = targets(state, {
          player: self.owner, side: 'friendly', exclude: [...alreadyCame],
        });
        if (!others.length) return;
        const pick = yield ask.one(uids(others), {
          prompt: step === 0 ? 'Pilot Animal — bring which fighter along?'
            : 'Pilot Animal — and another?',
          allowNone: true,
        });
        if (!pick) return;
        const left = sq(state, pick);
        if (!ops.relocate(state, pick, vacated, { withStack: false })) return;
        vacated = left;
        alreadyCame.add(pick);
      }
    },
  },
});

/** Queued rather than run inline, because "target" and "you may" need asking. */
function pilotAnimal({ state, self, card, from }) {
  if (!card || card.uid !== self.uid || from == null) return;
  const key = `pilot:${self.uid}`;
  if (state.usedThisTurn[key]) return;
  state.usedThisTurn[key] = true;
  queue(state, { kind: 'queued', uid: self.uid, name: 'pilot', from });
}

def('M170', {                                      // Twain of Twine — Double Stitch
  // "After a fighter you control resolves an Action ability, this fighter may
  // ALSO resolve that ability."
  //
  // The old version queued a `freeUse`, which resolves `freeRun` — a hook only
  // the Bolt attachments have — so even once the event existed it would have
  // run nothing. It now borrows the ability itself and resolves it with Twain
  // as the one acting.
  on: {
    afterAbility({ state, self, source, index }) {
      if (!source || source.owner !== self.owner || source.uid === self.uid) return;
      if (sq(state, self.uid) == null) return;          // it has to be in play
      queue(state, {
        kind: 'queued', uid: self.uid, name: 'stitch',
        source: source.uid, sourceDef: source.def, index,
      });
    },
  },
  queued: {
    *stitch({ state, self, descriptor }) {
      const src = ops.findCard(state, descriptor.source);
      // The source may have destroyed itself resolving the ability, so fall
      // back to the printed implementation when it is no longer on the table.
      const entry = src ? actionAbilitiesOf(state, src)[descriptor.index] : null;
      const run = entry?.ability?.run
        || impls(state)[descriptor.sourceDef]?.actions?.[descriptor.index]?.run;
      if (!run) return;

      const name = entry?.ability?.name
        || state.defs[descriptor.sourceDef]?.name || 'that ability';
      const yes = yield ask.confirm(`Double Stitch — also resolve ${name}?`);
      if (!yes) return;
      yield* run({
        state, self, me: self.owner, ops, action: {},
        emit: () => {}, destroy: (uid) => ops.toGraveyard(state, uid),
        refresh: () => {}, rand: () => 0,
      });
    },
  },
});

def('M162', {                                      // Voidstrider — Shadow Step
  // "YOU MAY swap it with TARGET fighter in The Void. If it is unoccupied, you
  // MAY instead relocate this fighter to The Void." Both halves are choices.
  on: {
    // "After this fighter MOVES OR IS RELOCATED", and it listened only to the
    // first half. A player Move emits both `afterMove` and `afterRelocate`,
    // but the FOLLOW-UP ADVANCE after a kill — which is a move in every sense
    // a player cares about — goes through `ops.relocate` and emits only
    // `afterRelocate`, so Shadow Step never fired on the commonest way this
    // fighter changes square in a real game. `afterRelocate` alone covers
    // both paths and cannot double-fire the way listening to both would.
    afterRelocate({ state, self, card }) {
      if (!card || card.uid !== self.uid || !state.locations?.void) return;
      queue(state, { kind: 'queued', uid: self.uid, name: 'shadowstep' });
    },
  },
  queued: {
    *shadowstep({ state, self }) {
      // If Voidstrider is itself the thing in The Void there is nothing to
      // swap with, and nothing to relocate into either.
      if (VOIDISH(state, sq(state, self.uid))) return;
      const faction = state.defs[self.def]?.faction || 'Neutral';
      const inVoid = IN_VOID(state).filter((c) => c.uid !== self.uid);
      if (inVoid.length) {
        const pick = yield ask.one(uids(inVoid), {
          prompt: 'Shadow Step — swap with which fighter in The Void?', allowNone: true,
        });
        if (pick != null) {
          ops.swap(state, self.uid, pick);
          // The motif is told WHO he traded places with, because he can also
          // go alone and the animation is a different shape when he does —
          // two cards crossing, or one card leaving. It used to be handed
          // nothing but a uid and played the two-way swap every time, so a
          // lone step showed a phantom fighter coming the other way.
          ops.fx(state, 'voidstep', { at: self.uid, with: pick, faction });
        }
        return;
      }
      const yes = yield ask.confirm('Shadow Step — step into The Void?');
      if (yes && (yield* intoVoid(state, self.uid))) {
        ops.fx(state, 'voidstep', { at: self.uid, with: null, faction });
      }
    },
  },
});

def('M166', {                                      // Veil Shearer — Rip Seams
  *onDeploy({ state, self }) {
    if (!state.locations?.void) return;
    const here = sq(state, self.uid);
    const friends = targets(state, { player: self.owner, side: 'friendly', adjacentTo: here, exclude: self.uid });
    const pick = yield ask.one(uids(friends), { prompt: 'Send which friend into The Void?', allowNone: true });
    // "even on top of another fighter with the same owner" — which is why the
    // stack is left behind rather than carried.
    if (pick && (yield* intoVoid(state, pick))) {
      // ONE WAY, and it has to say so. This SENDS somebody in; nobody comes
      // back out. Left to defaultCast the motif was handed no `with` field at
      // all and fell back to the two-way swap, so a friend being shoved into
      // The Void was drawn as a trade with a fighter that does not exist.
      // `at` is the card that travels, not the Shearer that pushed it.
      ops.fx(state, 'voidstep', {
        at: pick, with: null, faction: state.defs[self.def]?.faction || 'Neutral',
      });
    }
  },
});

def('M169', {                                      // Shadow Dancer — Spindle
  actions: [{
    name: 'Spindle',
    canUse({ state, self }) {
      if (!state.locations?.void) return false;
      const here = sq(state, self.uid);
      const inVoid = IN_VOID(state).some((c) => c.owner === self.owner);
      return VOIDISH(state, here) || inVoid;
    },
    *run({ state, self }) {
      const friends = targets(state, { player: self.owner, side: 'friendly', exclude: self.uid });
      const here = sq(state, self.uid);
      const legal = friends.filter((c) => VOIDISH(state, here) || VOIDISH(state, sq(state, c.uid)));
      const pick = yield ask.one(uids(legal), { prompt: 'Swap with' });
      if (pick && pick !== self.uid) ops.swap(state, self.uid, pick);
    },
  }],
});

def('M165', {                                      // Shadowcaster — Shadow Underfoot
  actions: [{
    name: 'Shadow Underfoot',
    canUse({ state, self }) {
      return targets(state, { player: self.owner, side: 'friendly', trait: 'Shadow' }).length > 0;
    },
    *run({ state, self }) {
      const shadows = targets(state, { player: self.owner, side: 'friendly', trait: 'Shadow' });
      const s = yield ask.one(uids(shadows), { prompt: 'Which Shadow?' });
      if (!s) return;
      const hosts = targets(state, { player: self.owner, side: 'friendly', exclude: s });
      const h = yield ask.one(uids(hosts), { prompt: 'Slide it under which fighter?' });
      if (!h) return;
      const card = ops.extract(state, s);
      ops.place(state, card, sq(state, h), { under: true });
    },
  }],
});

def('M168', {                                      // Gloomweaver — Shadow Puppetry
  constant({ state, self, derived }) {
    if (!VOIDISH(state, sq(state, self.uid))) return;
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== self.owner) continue;
      if (!traitsOf(state, card, state.defs, derived).has('Shadow')) continue;
      derived.puppeteered.add(card.uid);
    }
  },
});

def('M167', {                                      // Doomweaver — Thread of Oblivion
  actions: [{
    name: 'Thread of Oblivion',
    canUse({ state, self }) { return VOIDISH(state, sq(state, self.uid)); },
    *run({ state, self }) {
      const shadows = targets(state, { player: self.owner, side: 'any', trait: 'Shadow' });
      const doomed = new Set(shadows.map((c) => c.uid));
      for (const s of shadows) {
        const here = sq(state, s.uid);
        const st = T(state, s);
        for (const n of targets(state, { player: self.owner, side: 'any', adjacentTo: here })) {
          if ([...T(state, n)].some((t) => st.has(t))) doomed.add(n.uid);
        }
      }
      for (const uid of doomed) ops.toGraveyard(state, uid);
      ops.toGraveyard(state, self.uid);
    },
  }],
});

def('A012', {                                      // Boltbearer — Over-Attuned
  on: {
    afterAttachmentPlayed({ state, self, host }) {
      if (!host || host.owner !== self.owner) return;
      const here = sq(state, self.uid);
      const there = sq(state, host.uid);
      if (here == null || there == null || distance(state, here, there) !== 1) return;
      swapWithNamed(state, self, 'A013');
    },
  },
});

def('A013', {                                      // Boltbeast — Feed Me Bolts
  on: {
    endOfTurn({ state, self, player }) {
      if (player !== self.owner) return;
      const here = sq(state, self.uid);
      if (here == null) return;
      let nearAttachment = false;
      for (const { card } of ops.allCards(state)) {
        if (state.defs[card.def]?.realType !== 'attachment' || !card.attachedTo) continue;
        const host = ops.findCard(state, card.attachedTo);
        const hs = host && sq(state, host.uid);
        if (hs != null && distance(state, here, hs) <= 1) nearAttachment = true;
      }
      if (!nearAttachment) swapWithNamed(state, self, 'A012');
    },
  },
});

/**
 * Boltbeast and Boltbearer swap with each other wherever the other one is —
 * hand, deck or graveyard. No other card in the pool needs this.
 */
function swapWithNamed(state, self, otherDef) {
  const here = sq(state, self.uid);
  if (here == null) return;
  let other = null;
  for (const { card } of ops.allCards(state)) {
    if (card.def === otherDef && card.owner === self.owner && card.uid !== self.uid) { other = card; break; }
  }
  if (!other) return;
  const at = ops.locate(state, other.uid);
  ops.extract(state, other.uid);
  ops.extract(state, self.uid);
  other.fatigued = self.fatigued;
  ops.place(state, other, here);
  if (at?.zone === 'board') ops.place(state, self, at.square);
  else state.players[self.owner][at?.zone || 'hand'].push(self);
}

def('A037', {                                      // Thread the Needle
  *play({ state, self }) {
    state.threadTheNeedle = { player: self.owner, until: state.turn };
  },
  constant({ state, derived }) {
    const t = state.threadTheNeedle;
    if (!t || state.turn > t.until) return;
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== t.player || !(card.attachments || []).length) continue;
      (derived.longReach ||= new Set()).add(card.uid);
    }
  },
});

def('C034', {                                      // Barrage
  *play({ state, self }) {
    const mine = targets(state, { player: self.owner, side: 'friendly' });
    const pick = yield ask.one(uids(mine), { prompt: 'Barrage around which of your fighters?' });
    if (!pick) return;
    const here = sq(state, pick);
    if (here == null) return;
    const hit = targets(state, {
      player: self.owner, side: 'enemy', adjacentTo: here, power: { max: 2 },
    });
    ops.fx(state, 'volley', { from: pick, targets: hit.map((c) => sq(state, c.uid)) });
    for (const c of hit) ops.toGraveyard(state, c.uid);
  },
  playable(state, card, p) {
    return targets(state, { player: p, side: 'friendly' }).length > 0;
  },
});
