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
import * as ops from './ops.js';
import { targets, squares, uids } from './target.js';
import { traitsOf, powerOf, neighbours, squaresWithin } from './derive.js';
import { VOID, distance } from './board.js';

export const CARDS = {};

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
function hostOf({ state, self }) {
  if (self?.attachedTo) return ops.findCard(state, self.attachedTo) || null;
  return self || null;
}

/* ==================================================================== */
/* Shared families — these cover most of the pool                        */
/* ==================================================================== */

/**
 * Voidlink, on every Shadow basic: "During your turn, this fighter has the
 * abilities of all fighters that are in The Void and share a trait with it."
 */
const VOIDLINK = {
  constant({ state, self, derived }) {
    if (state.active !== self.owner) return;
    if (!state.locations?.void) return;
    const mine = traitsOf(state, self, state.defs, derived);
    const inVoid = state.board[VOID] || [];
    const gained = [];
    for (const other of inVoid) {
      if (other.uid === self.uid) continue;
      const theirs = traitsOf(state, other, state.defs, derived);
      if (![...mine].some((t) => theirs.has(t))) continue;
      for (const ab of state.defs[other.def]?.abilities || []) {
        if (!gained.some((g) => g.name === ab.name)) gained.push(ab);
      }
    }
    if (gained.length) {
      const cur = derived.grantedAbilities.get(self.uid) || [];
      derived.grantedAbilities.set(self.uid, [...cur, ...gained]);
    }
  },
};
def(['M184', 'M178', 'M187', 'M175', 'M174', 'M193', 'M192', 'M197', 'M196'], VOIDLINK);

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
    freeRun: run,
    constant({ state, self, derived }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host) return;
      const cur = derived.grantedAbilities.get(host.uid) || [];
      derived.grantedAbilities.set(host.uid, [...cur, { k: 'action', name, run, canUse, from: self.uid }]);
    },
    on: {
      afterMove({ state, self, card }) {
        const host = self.attachedTo && ops.findCard(state, self.attachedTo);
        if (!host || !card || card.uid !== host.uid) return;
        if (trait && !traitsOf(state, host, state.defs, state.derived).has(trait)) return;
        const key = `bolt:${self.uid}`;
        if (state.usedThisTurn[key]) return;
        state.usedThisTurn[key] = true;
        (state.queue ||= []).push({ kind: 'freeUse', uid: host.uid, source: self.uid });
      },
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
    if (pick) ops.toGraveyard(state, pick);
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
    if (trait) (card.lostTraits ||= []).push({ trait, until: state.turn + 2 });
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
    if (to != null) ops.relocate(state, pick, to, { withStack: false });
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
    if (to != null) ops.relocate(state, host.uid, to, { withStack: false });
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
        return s === VOID || distance(state, s, VOID) === 1;
      });
    const pick = yield ask.one(uids(opts), { prompt: 'Attack into The Void' });
    if (!pick) return;
    const target = ops.findCard(state, pick);
    const ap = powerOf(state, host, state.defs, state.derived, { attacking: true, vs: target });
    const dp = P(state, target);
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
    afterMove({ state, self, card, from }) {
      const host = self.attachedTo && ops.findCard(state, self.attachedTo);
      if (!host || !card || card.uid === host.uid) return;
      const here = sq(state, host.uid);
      if (here == null || distance(state, here, from) !== 1) return;
      if (ops.occupied(state, from)) return;
      ops.relocate(state, host.uid, from, { withStack: false });
    },
  },
});

def('A033', {                                      // Fatewoven Tapestry
  constant({ state, self, derived }) {
    const host = self.attachedTo && ops.findCard(state, self.attachedTo);
    if (!host) return;
    const cur = derived.grantedAbilities.get(host.uid) || [];
    derived.grantedAbilities.set(host.uid, [...cur, {
      k: 'action', name: 'Fatewoven Tapestry',
      *run({ state: s, self: me }) {
        const used = s.usedThisGame.tapestry || [];
        const kinds = ['draw', 'deploy', 'move', 'attack'].filter((k) => !used.includes(k));
        const kind = yield ask.pick(kinds, { prompt: 'Forbid which Action?' });
        if (!kind) return;
        (s.usedThisGame.tapestry ||= []).push(kind);
        s.forbidden = { player: enemy(me.owner), kind, until: s.turn + 2 };
      },
    }]);
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
    return sh?.revealed && sh.card ? [sh.card] : [];
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
    afterMove({ state, self, card, from }) {
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
    (derived.extraDeploy ||= []).push((s, card, p) => {
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
    (derived.extraDeploy ||= []).push((s, card, p) => {
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
    (derived.extraDeploy ||= []).push((s, card, p) => {
      if (p !== self.owner) return [];
      const pow = s.defs[card.def]?.power ?? 0;
      return pow >= 2 ? [square] : [];
    });
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
  *onDeploy({ state, self }) {
    const opts = targets(state, { player: self.owner, side: 'any', excludeGates: true, exclude: self.uid });
    const pick = yield ask.one(uids(opts), { prompt: 'Possess which fighter?', allowNone: true });
    if (pick == null) return;
    ops.relocate(state, self.uid, sq(state, pick), { withStack: false });
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
  // DEPLOYMENT, not an action — the icon is a down arrow.
  *onDeploy({ state }) { state.decreeUntil = state.turn + 2; },
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
        { k: 'bonusVsTrait', trait: 'Convicted', amount: 1 }]);
    }
  },
  // Sentence is a DEPLOYMENT, not an action — the icon is a down arrow.
  *onDeploy({ state, self }) {
    for (let i = 0; i < 2; i++) {
      const foes = targets(state, { player: self.owner, side: 'enemy' });
      const pick = yield ask.one(uids(foes), { prompt: 'Convict', allowNone: true });
      if (!pick) return;
      const card = ops.findCard(state, pick);
      (card.tokens ||= []).push('Convicted of Heresy');
    }
  },
});

def('M007', {                                      // Imperial Guard — Usherance
  on: {
    afterEnter({ state, self, card, square }) {
      if (state.active !== self.owner) return;
      const here = sq(state, self.uid);
      if (here == null || square == null) return;
      if (distance(state, here, square) !== 1) return;
      const spots = squares(state, { adjacentTo: square, empty: true });
      if (spots.length) ops.relocate(state, card.uid, spots[0], { withStack: false });
    },
  },
});

def('M004', {                                      // Capricorn Cavalry — Lash Out
  on: {
    afterMove({ state, self, card }) {
      if (!card || card.uid !== self.uid) return;
      const here = sq(state, self.uid);
      const n = self.movedThisTurn || 1;
      const foes = targets(state, { player: self.owner, side: 'any', adjacentTo: here, power: n, exclude: self.uid });
      if (foes.length) ops.toGraveyard(state, foes[0].uid);
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
  on: {
    afterDestroy({ state, self, card, square }) {
      if (!card || card.uid !== self.uid || square == null) return;
      for (const c of targets(state, { player: self.owner, side: 'any', adjacentTo: square, power: { max: 2 } })) {
        ops.toGraveyard(state, c.uid);
      }
    },
  },
});

def('R060', {                                      // Shard Wisp — Glimmer & Shimmer
  on: {
    afterDestroy({ state, self, card }) {
      if (!card || card.uid !== self.uid) return;
      const friend = targets(state, { player: self.owner, side: 'friendly' })[0];
      const foe = targets(state, { player: self.owner, side: 'enemy' })[0];
      if (friend) ops.toHand(state, friend.uid);
      if (foe) ops.toHand(state, foe.uid);
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

def('A007', {                                      // Threadbearer — Thrum Blade
  constant({ state, self, derived }) {
    const mine = state.players[self.owner].hand.length;
    const theirs = state.players[enemy(self.owner)].hand.length;
    if (mine < theirs) derived.powerAdd.set(self.uid, (derived.powerAdd.get(self.uid) || 0) + 2);
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
  constant({ state, self, derived }) {
    derived.blockEnter.push({
      square: VOID,
      blocks: (card) => card.owner !== self.owner,
    });
  },
});

def('M163', {                                      // Fraymaw — Devourer
  constant({ state, self, derived }) {
    const cur = derived.grantedAbilities.get(self.uid) || [];
    derived.grantedAbilities.set(self.uid, [...cur, {
      k: 'bonusVsTraitSquare', amount: 1,
      test: (target) => {
        const s = sq(state, target.uid);
        return s != null && (s === VOID || distance(state, s, VOID) === 1);
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
    const stacks = [];
    for (let i = 0; i < state.board.length; i++) if (ops.stackAt(state, i).length) stacks.push(i);
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
    const movers = row.filter((s) => s < 9 && ops.stackAt(state, s).length);
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
  },
});

def('A036', {                                      // Time Warp
  *play({ state, self }) {
    (state.nextTurnExtra ||= [0, 0])[self.owner] += 2;
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
      if (state.defs[top.def]?.power === 1) {
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

function trap({ name, arm = 'enter', fire }) {
  return {
    onPlay: function* ({ self }) { self.facedown = true; },
    on: {
      startOfTurn({ state, self, player }) {
        if (player !== self.owner || !self.facedown) return;
        self.facedown = false;
        fire({ state, self });
      },
      afterEnter({ state, self, card, square }) {
        if (arm !== 'enter' || !self.facedown) return;
        if (square !== self.square || !card || card.owner === self.owner) return;
        self.facedown = false;
        fire({ state, self, card });
      },
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
  ...trap({ name: 'Blockade', fire: () => {} }),
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
      const hand = state.players[self.owner].hand
        .filter((c) => state.defs[c.def]?.type === 'fighter');
      if (!hand.length || ops.occupied(state, self.square)) return;
      const card = ops.extract(state, hand[0].uid);
      ops.place(state, card, self.square);
      const i = state.constructs.findIndex((c) => c && c.uid === self.uid);
      if (i >= 0) state.players[self.owner].graveyard.push(state.constructs.splice(i, 1)[0]);
    },
  }),
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
    // "squares adjacent to this fighter are considered adjacent to The Void"
    for (const n of neighbours(state, square)) derived.voidSquares.add(n);
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
    const convicted = (victim.tokens || []).includes('Convicted of Heresy');
    ops.toGraveyard(state, pick);
    for (let i = 0; i < (convicted ? 2 : 1); i++) {
      const top = state.players[owner].deck[0];
      if (!top) return;
      const tt = state.defs[top.def]?.traits || [];
      if (tt.some((t) => vTraits.includes(t))) {
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
      k: 'action', name: 'Sentence',
      *run({ state: s, self: me }) {
        const foes = targets(s, { player: me.owner, side: 'enemy' });
        const pick = yield ask.one(uids(foes), { prompt: 'Convict' });
        if (pick) ((ops.findCard(s, pick).tokens ||= []).push('Convicted of Heresy'));
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
      // "you may repeat this any number of times" — a loop around a choice
      for (let round = 0; round < 12; round++) {
        const mine = targets(state, { player: self.owner, side: 'friendly', exclude: self.uid });
        if (!mine.length) return;
        const fodder = yield ask.one(uids(mine), { prompt: 'Sacrifice which of yours?', allowNone: round > 0 });
        if (!fodder) return;
        const power = P(state, ops.findCard(state, fodder));
        ops.toGraveyard(state, fodder);
        const foes = targets(state, { player: self.owner, side: 'enemy', power: { max: power } });
        const kill = yield ask.one(uids(foes), { prompt: 'Destroy which enemy?', allowNone: true });
        if (!kill) return;
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
  on: {
    afterMove({ state, self, card, from }) {
      if (!card || card.uid !== self.uid) return;
      const key = `pilot:${self.uid}`;
      if (state.usedThisTurn[key]) return;
      state.usedThisTurn[key] = true;
      const followers = targets(state, { player: self.owner, side: 'friendly', exclude: self.uid })
        .filter((c) => distance(state, sq(state, c.uid), from) === 1);
      if (followers.length && !ops.occupied(state, from)) {
        ops.relocate(state, followers[0].uid, from, { withStack: false });
      }
    },
  },
});

def('M170', {                                      // Twain of Twine — Double Stitch
  on: {
    afterAbility({ state, self, source }) {
      if (!source || source.owner !== self.owner || source.uid === self.uid) return;
      (state.queue ||= []).push({ kind: 'freeUse', uid: self.uid, source: source.uid });
    },
  },
});

def('M162', {                                      // Voidstrider — Shadow Step
  on: {
    afterMove({ state, self, card }) {
      if (!card || card.uid !== self.uid || !state.locations?.void) return;
      // If Voidstrider is itself the thing in The Void there is nothing to
      // swap with, and nothing to relocate into either.
      const inVoid = (state.board[VOID] || []).filter((c) => c.uid !== self.uid);
      if (inVoid.length) ops.swap(state, self.uid, inVoid[0].uid);
      else if (sq(state, self.uid) !== VOID) ops.relocate(state, self.uid, VOID, { withStack: false });
    },
  },
});

def('M166', {                                      // Veil Shearer — Rip Seams
  *onDeploy({ state, self }) {
    if (!state.locations?.void) return;
    const here = sq(state, self.uid);
    const friends = targets(state, { player: self.owner, side: 'friendly', adjacentTo: here, exclude: self.uid });
    const pick = yield ask.one(uids(friends), { prompt: 'Send which friend into The Void?', allowNone: true });
    if (pick) ops.relocate(state, pick, VOID, { withStack: false });
  },
});

def('M169', {                                      // Shadow Dancer — Spindle
  actions: [{
    name: 'Spindle',
    canUse({ state, self }) {
      if (!state.locations?.void) return false;
      const here = sq(state, self.uid);
      const inVoid = (state.board[VOID] || []).some((c) => c.owner === self.owner);
      return here === VOID || inVoid;
    },
    *run({ state, self }) {
      const friends = targets(state, { player: self.owner, side: 'friendly', exclude: self.uid });
      const here = sq(state, self.uid);
      const legal = friends.filter((c) => here === VOID || sq(state, c.uid) === VOID);
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
    if (sq(state, self.uid) !== VOID) return;
    for (const { card } of ops.allCards(state)) {
      if (card.owner !== self.owner) continue;
      if (!traitsOf(state, card, state.defs, derived).has('Shadow')) continue;
      (derived.puppeteered ||= new Set()).add(card.uid);
    }
  },
});

def('M167', {                                      // Doomweaver — Thread of Oblivion
  actions: [{
    name: 'Thread of Oblivion',
    canUse({ state, self }) { return sq(state, self.uid) === VOID; },
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
    for (const c of targets(state, {
      player: self.owner, side: 'enemy', adjacentTo: here, power: { max: 2 },
    })) ops.toGraveyard(state, c.uid);
  },
  playable(state, card, p) {
    return targets(state, { player: p, side: 'friendly' }).length > 0;
  },
});
