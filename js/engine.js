// Gudnak rules engine — headless, deterministic, no DOM.
//
// Rules of record: docs/RULES.md. Every [ruling] there is marked RULING here.
//
// State is plain JSON: structuredClone-able, hashable, and safe to ship over
// the wire. Nothing in this file touches the renderer or the network.
//
// Card effects live in js/rules/. The engine owns the turn, the actions and the
// win conditions; it asks js/rules/cards.js what each card does.

import {
  VOID, BASE_BACK_ROW, PRINTED_GATES, adjacentTo, distance,
  strongholdSquareOf,
} from './rules/board.js';
import { derive, powerOf as derivedPower, traitsOf, abilitiesOf } from './rules/derive.js';
import * as ops from './rules/ops.js';
import { emit, replace, springTraps } from './rules/triggers.js';
import { runEffect, answerPending, ask } from './rules/driver.js';
import { CARDS } from './rules/cards.js';
import { CARD_MOTIF } from './rules/motifs.js';

export const SIZE = 3;
export const SQUARES = 9;
export const BACK_ROW = BASE_BACK_ROW;
export const GATES = PRINTED_GATES;      // printed only; use gatesOf() for live

// New Moon and the Scylla it waits on. Named here because the engine itself
// has to place the card before the game starts, which is the only rules text
// in the pool that runs before anything is in play.
const SCYLLA = 'M003';
const NEW_MOON = 'M046';
const CHARYBDIS = 'M046C';
export { VOID, distance };
export { STRONGHOLD_SQ, strongholdSquareOf } from './rules/board.js';

export const ADJACENT = (() => {
  const a = [];
  for (let i = 0; i < SQUARES; i++) a.push(adjacentTo({ locations: {} }, i));
  return a;
})();

export const TRAITS = ['Brute', 'Soldier', 'Hunter', 'Hero', 'Demon', 'Shadow', 'Token'];

/* ---------------------------------------------------------------- rng */

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

/* ---------------------------------------------------------------- cards */

/**
 * Card ids must be DETERMINISTIC PER GAME, not globally unique.
 *
 * They used to come from a module-level counter, so a second game in the same
 * process numbered its cards differently — which is invisible locally and fatal
 * online, because an action says "deploy card 37" and the two machines
 * disagreed about which card 37 was. Numbering from the state means both sides
 * deal the same ids from the same setup.
 */
function instantiate(state, def, owner) {
  return { uid: ++state.nextUid, def: def.id, owner, fatigued: false, attachments: [] };
}

export function defOf(state, card) {
  return state.defs[card.def];
}

/* ---------------------------------------------------------------- setup */

export function createGame({
  seed = 1, decks, mulligan = [false, false], defs, first = null,
  strongholds = [null, null], impls = CARDS,
}) {
  const state = {
    rng: seed | 0,
    seed: seed | 0,
    defs,
    impls,
    turn: 0,
    active: 0,
    actionsLeft: 0,
    // 9 grid squares, The Void, and a square for each Stronghold.
    board: Array.from({ length: SQUARES + 3 }, () => []),
    constructs: [],
    locations: {},
    // Where each player's Gates SIT. Printed at the start, but Migration
    // moves them permanently, so this is a stored value rather than a derived
    // one — the card that moved them is back in the deck by the time it
    // matters, so there is nothing in play left to derive it from.
    homeGate: [...PRINTED_GATES],
    // What is sitting BESIDE each Stronghold: not in the deck, not on the
    // board, not in any zone the rest of the engine knows about. New Moon is
    // the only one, and it waits there counting turns until it is Charybdis.
    beside: [null, null],
    // Cards REMOVED from the game — not discarded, not destroyed, gone. New
    // Moon is the only one that can end up here, when it sets with nowhere to
    // rise. They are kept rather than dropped because a card that simply
    // stopped existing is indistinguishable from one the engine lost.
    removed: [[], []],
    strongholds: [newStronghold(), newStronghold()],
    players: [newPlayer(), newPlayer()],
    winner: null,
    reason: null,
    log: [],
    history: {},
    queue: [],
    usedThisTurn: {},
    usedThisGame: {},
    nextUid: 0,
  };

  for (let p = 0; p < 2; p++) {
    state.players[p].deck = shuffle(state, decks[p].map((id) => instantiate(state, defs[id], p)));

    const shId = strongholds[p];
    const shDef = shId && defs[shId];
    if (!shDef) continue;

    if (shDef.power != null) {
      // The Auroxi have no separate Stronghold card: the Living Stronghold or
      // Black Aurox IS their Stronghold, and it sits at the BOTTOM OF THE DECK.
      // When you run out of cards it is what is left, and it rises rather than
      // being drawn or milled.
      const card = instantiate(state, shDef, p);
      card.isStronghold = true;
      state.players[p].deck.push(card);
      state.strongholds[p].inDeck = true;
    } else {
      // Every other faction's Stronghold is plain art — the space your deck
      // sits on, with no rules text and no presence in the game.
      state.strongholds[p].card = instantiate(state, shDef, p);
      state.strongholds[p].art = true;
    }
  }

  // "Before the start of the game, if your Stronghold or any card in your deck
  // mentions The Void, put this card beside the Battlefield." The flag is set
  // by tools/build-gamedata.js; the text search is the fallback for decks
  // assembled by hand.
  for (let p = 0; p < 2; p++) {
    const mentions = [...decks[p], strongholds[p]].filter(Boolean).some((id) => {
      const d = defs[id];
      if (!d) return false;
      return d.usesVoid === true || JSON.stringify(d).includes('The Void');
    });
    if (mentions) state.locations.void = true;
  }
  if (state.locations.void) state.board[VOID] = [];

  // "Before the start of the game, if you have Scylla in your deck, put this
  // card beside your Stronghold."
  //
  // Keyed off Scylla rather than off the deck listing New Moon, for the same
  // reason The Void is keyed off a deck mentioning it: createGame is handed a
  // list of card ids and a Stronghold, and threading a third list of
  // outside-the-deck cards through it would change the signature for every
  // caller. A deck holding Scylla is a deck that brought her moon.
  for (let p = 0; p < 2; p++) {
    if (!decks[p].includes(SCYLLA) || !defs[NEW_MOON]) continue;
    state.beside[p] = { card: instantiate(state, defs[NEW_MOON], p), rotations: 0 };
  }

  for (let p = 0; p < 2; p++) {
    ops.draw(state, p, 5);
    if (mulligan[p]) {
      state.players[p].deck.push(...state.players[p].hand.splice(0));
      shuffle(state, state.players[p].deck);
      ops.draw(state, p, 5);
    }
  }

  state.active = first === null ? (rand(state) < 0.5 ? 0 : 1) : first;
  refresh(state);
  beginTurn(state);
  return state;
}

function newPlayer() {
  return { deck: [], hand: [], graveyard: [] };
}

function newStronghold() {
  return { card: null, revealed: false };
}

/* ---------------------------------------------------------------- derived */

/**
 * Recompute everything continuous. Called after any mutation, because power,
 * Gates and Back Row are answers to questions, never stored values.
 */
export function refresh(state) {
  sweepConstructs(state);
  state.derived = derive(state, state.impls);

  state.gates = [0, 1].map((p) => {
    const home = state.homeGate?.[p] ?? PRINTED_GATES[p];
    if (state.derived.noGates[p]) return [...new Set(state.derived.addGates[p])];
    return [...new Set([home, ...state.derived.addGates[p]])];
  });

  state.backRow = [0, 1].map((p) => {
    const set = new Set(BASE_BACK_ROW[p]);
    if (state.locations.void) set.add(VOID);
    for (const s of state.derived.backRow[p]) set.add(s);
    for (const s of state.gates[p]) set.add(s);
    return [...set];
  });
}

/**
 * "When an enemy Fighter enters a square containing a Construct you own,
 * destroy that Construct."
 *
 * Done as a sweep rather than hung off the move actions, because Constructs can
 * also be landed on by relocation from a card effect, and every one of those
 * would otherwise need its own hook. Jagged Rocks intercepts through the
 * replacement bus and destroys the intruder instead.
 */
function sweepConstructs(state) {
  if (!state.constructs?.length) return;
  for (const con of [...state.constructs]) {
    if (!con) continue;
    const top = ops.topOf(state, con.square);
    if (!top || top.owner === con.owner) continue;

    const outcome = replace(state, state.impls, 'constructEntered',
      { construct: con, intruder: top, handled: false });
    if (outcome.handled) continue;

    const i = state.constructs.findIndex((c) => c && c.uid === con.uid);
    if (i >= 0) {
      const gone = state.constructs.splice(i, 1)[0];
      state.players[gone.owner].graveyard.push(gone);
      log(state, `${state.defs[gone.def]?.name || 'A Construct'} is destroyed`);
    }
  }
}

/* ---------------------------------------------------------------- queries */

export const topOf = (state, sq) => ops.topOf(state, sq);
export const occupied = (state, sq) => ops.occupied(state, sq);
export const controllerOf = (state, sq) => (ops.topOf(state, sq) || {}).owner ?? null;
export const opponent = (p) => 1 - p;
export const gatesOf = (state, p) => state.gates?.[p] || [PRINTED_GATES[p]];

export function isSieged(state, p) {
  return gatesOf(state, p).some((g) => {
    const t = ops.topOf(state, g);
    return !!t && t.owner !== p;
  });
}

export function powerOf(state, card, vs = null) {
  return derivedPower(state, card, state.defs, state.derived, {
    attacking: !!vs, vs,
  });
}

export function traitsFor(state, card) {
  return traitsOf(state, card, state.defs, state.derived);
}

function squaresInPlay(state) {
  return state.board.length;
}

/* ---------------------------------------------------------------- actions */

/**
 * "Opponents cannot take that Action until your next turn."
 *
 * The Tapestry recorded the ban and nothing ever read it, so it forbade
 * precisely nothing.
 */
function forbidden(state, p, t) {
  const f = state.forbidden;
  if (!f || f.player !== p || state.turn >= f.until) return false;
  if (f.kind === 'play') return t === 'tactic' || t === 'construct' || t === 'attach';
  return f.kind === t;
}

export function legalActions(state) {
  if (state.winner !== null) return [];
  if (state.pending) return [];          // a choice is owed first
  const p = state.active, pl = state.players[p], out = [];

  if (pl.deck.length) out.push({ t: 'draw' });

  for (const card of pl.hand) {
    const def = defOf(state, card);
    if (!def) continue;

    if (def.type === 'fighter') {
      for (const sq of deployTargets(state, p, card)) {
        out.push({ t: 'deploy', card: card.uid, to: sq });
      }
    } else if ((def.cost ?? 1) <= state.actionsLeft) {
      if (def.realType === 'construct') {
        for (const sq of constructTargets(state, p, card)) {
          out.push({ t: 'construct', card: card.uid, to: sq });
        }
      } else if (def.realType === 'attachment') {
        for (const host of attachTargets(state, p, card)) {
          out.push({ t: 'attach', card: card.uid, host: host.uid });
        }
      } else if (CARDS[def.id]?.playable?.(state, card, p) !== false) {
        out.push({ t: 'tactic', card: card.uid });
      }
    }
  }

  const total = squaresInPlay(state);
  for (let sq = 0; sq < total; sq++) {
    const top = ops.topOf(state, sq);
    if (!top || top.owner !== p) continue;
    const spent = top.fatigued && !state.derived.actWhileFatigued.has(top.uid);
    if (spent) {
      // An exhausted fighter is finished for the turn — unless something grants
      // it one particular attack. Unrelenting is the first: a Hunter of yours
      // may still fall on a fighter that is Convicted of Heresy.
      const allow = state.derived.attackWhileFatigued || [];
      if (allow.length) {
        for (const to of adjacentTo(state, sq)) {
          const foe = ops.topOf(state, to);
          if (!foe || foe.owner === p) continue;
          if (!canAttack(state, top, foe)) continue;
          if (allow.some((fn) => safeBool(() => fn(top, foe, state)))) {
            out.push({ t: 'attack', from: sq, to });
          }
        }
      }
      continue;
    }

    for (const to of adjacentTo(state, sq)) {
      if (!ops.occupied(state, to)) {
        if (canEnter(state, top, to) && canMove(state, top, sq, to)) {
          out.push({ t: 'move', from: sq, to });
        }
      } else if (ops.topOf(state, to).owner !== p) {
        if (canAttack(state, top, ops.topOf(state, to))) out.push({ t: 'attack', from: sq, to });
      }
    }

    actionAbilitiesOf(state, top).forEach(({ index, usable }) => {
      if (usable) out.push({ t: 'ability', uid: top.uid, index });
    });
  }

  // Constructs have Action abilities too, and they are not fighters — but a
  // Construct with a fighter standing on it is switched off.
  for (const c of state.constructs) {
    if (!c || c.owner !== p) continue;
    if (ops.occupied(state, c.square) && !CARDS[c.def]?.whileCovered) continue;
    actionAbilitiesOf(state, c).forEach(({ index, usable }) => {
      if (usable) out.push({ t: 'ability', uid: c.uid, index });
    });
  }

  if (isSieged(state, p)) {
    for (const g of gatesOf(state, p)) {
      const enemy = ops.topOf(state, g);
      if (enemy && enemy.owner !== p && pl.hand.length >= powerOf(state, enemy)) {
        out.push({ t: 'defend', square: g });
      }
    }
  }

  return out.filter((a) => !forbidden(state, p, a.t));
}

/** Squares this fighter may be deployed to right now. */
export function deployTargets(state, p, card) {
  const out = [];
  const def = defOf(state, card);
  const mine = traitsOf(state, card, state.defs, state.derived);

  for (const sq of state.backRow[p]) {
    if (isEnemyGates(state, p, sq)) continue;
    // A square something may not ENTER is not a square something may be
    // deployed onto either. This only ever ran on moves, so Blockade stopped
    // a fighter walking in and then let one be dealt straight on top of it.
    if (!canEnter(state, card, sq)) continue;
    if (!ops.occupied(state, sq)) { out.push(sq); continue; }
    const top = ops.topOf(state, sq);
    if (top.owner !== p) continue;
    const theirs = traitsOf(state, top, state.defs, state.derived);
    if ([...mine].some((t) => theirs.has(t))) out.push(sq);
  }

  // Cards may open up extra deploy squares (Solidarity, Null Gate, Born of Bolt).
  const extra = CARDS[def.id]?.deploySquares?.(state, card, p) || [];
  for (const sq of extra) if (!out.includes(sq)) out.push(sq);
  for (const fn of state.derived.extraDeploy || []) {
    for (const sq of fn(state, card, p) || []) if (!out.includes(sq)) out.push(sq);
  }
  return out;
}

/**
 * Where a Construct may be built.
 *
 * "Play this card in your Back Row or adjacent to a Fighter or Construct you
 * control." It used to be allowed anywhere on the board.
 *
 * The square must also be EMPTY — a Construct cannot be slid underneath one of
 * your own fighters.
 */
function constructTargets(state, p, card) {
  const impl = CARDS[defOf(state, card).id];
  const taken = (i) => state.constructs.some((c) => c && c.square === i);

  const base = [];
  for (let i = 0; i < squaresInPlay(state); i++) {
    if (taken(i) || ops.occupied(state, i)) continue;
    if ((state.backRow?.[p] || []).includes(i)) { base.push(i); continue; }
    const near = adjacentTo(state, i).some((n) => {
      const top = ops.topOf(state, n);
      if (top && top.owner === p) return true;
      return state.constructs.some((c) => c && c.owner === p && c.square === n);
    });
    if (near) base.push(i);
  }

  // A card may narrow this further (Jagged Rocks and Temple of Tides are Back
  // Row only; Blockade may not be in your Back Row at all).
  if (impl?.constructSquares) {
    const allowed = new Set(impl.constructSquares(state, card, p));
    return base.filter((i) => allowed.has(i));
  }
  return base;
}

/**
 * Where an Attachment may be played.
 *
 * You may only attach to a fighter in YOUR BACK ROW. Two cards prove the rule
 * by lifting it: Spaceweaver's Rigid Heddles lets you "Play Attachments
 * anywhere on the Battlefield", and Avatar's Burden attaches "regardless of
 * position" — neither line means anything unless the default is restricted.
 */
function attachTargets(state, p, card) {
  const impl = CARDS[defOf(state, card).id];
  if (impl?.attachTargets) return impl.attachTargets(state, card, p);

  const anywhere = impl?.attachAnywhere
    || (state.derived.extraAttach || []).includes(p);
  const rows = anywhere ? null : new Set(state.backRow[p]);

  const out = [];
  for (let sq = 0; sq < squaresInPlay(state); sq++) {
    if (rows && !rows.has(sq)) continue;
    const top = ops.topOf(state, sq);
    if (!top || top.owner !== p) continue;
    // ONE Attachment per fighter unless something says otherwise. Bolt Bender
    // is the card that says otherwise, and it swaps rather than stacking.
    if (!attachSlotsFree(state, top, impl)) continue;
    if (impl?.attachFilter && !impl.attachFilter(state, top, p)) continue;
    out.push(top);
  }
  return out;
}

/**
 * How many Attachments may this fighter carry?
 *
 * One, unless the Attachment being played overrides it (`multiAttach`) or a
 * continuous effect grants the fighter another slot.
 */
function attachSlotsFree(state, host, impl) {
  if (impl?.multiAttach) return true;
  const extra = state.derived?.extraAttachSlots?.get(host.uid) || 0;
  return (host.attachments || []).length < 1 + extra;
}

function isEnemyGates(state, p, square) {
  for (let q = 0; q < 2; q++) if (q !== p && gatesOf(state, q).includes(square)) return true;
  return false;
}

function canEnter(state, card, square) {
  for (const rule of state.derived.blockEnter) {
    if (rule.square === square && rule.blocks(card, state)) return false;
  }
  return true;
}

/**
 * Whether a fighter may Move at all.
 *
 * Nothing needed this until Charybdis, which is Anchored — "cannot take Move
 * or Attack actions". The attack half was already expressible through
 * `cannotAttack`; the move half had no hook, and Scylla's own "cannot Move or
 * be relocated out of your Back Row" had quietly gone unimplemented for want
 * of one.
 */
function canMove(state, card, from, to) {
  for (const rule of state.derived.cannotMove || []) {
    if (safeBool(() => rule(card, from, to, state))) return false;
  }
  return true;
}

function canAttack(state, attacker, defender) {
  for (const rule of state.derived.cannotAttack) {
    if (rule(attacker, defender, state)) return false;
  }
  return true;
}

/** Action abilities a card has, and whether each can be used now. */
export function actionAbilitiesOf(state, card) {
  const impl = CARDS[card.def];
  const granted = state.derived.grantedAbilities.get(card.uid) || [];
  const own = impl?.actions || [];
  const all = [...own, ...granted.filter((a) => a.k === 'action')];
  if (state.derived.blanked.has(card.uid)) return [];

  return all.map((a, index) => ({
    index,
    ability: a,
    usable: !a.canUse || safeBool(() => a.canUse({ state, self: card })),
  }));
}

function safeBool(fn) {
  try { return !!fn(); } catch { return false; }
}

/* ---------------------------------------------------------------- apply */

export function apply(state, action) {
  if (state.winner !== null) throw new Error('game is over');
  if (state.pending) throw new Error('a choice is owed first');

  const p = state.active, pl = state.players[p];
  const cost = actionCost(state, action);
  if (cost > state.actionsLeft) throw new Error('not enough actions');

  state.fx = [];            // what the view will be told about this action

  // The cost comes off BEFORE the effect runs. A pending effect snapshots the
  // state mid-action, so deducting afterwards meant the snapshot still had the
  // action unspent and every choice refunded it.
  state.actionsLeft -= cost;
  const result = perform(state, action, p, pl);
  refresh(state);

  if (result && result.pending) return state;   // waiting on a player choice

  drainQueue(state);
  finishAction(state);
  return state;
}

function actionCost(state, action) {
  if (action.t === 'tactic' || action.t === 'construct' || action.t === 'attach') {
    const card = findInHand(state, state.active, action.card);
    return defOf(state, card).cost ?? 1;
  }
  return 1;
}

function perform(state, action, p, pl) {
  switch (action.t) {
    case 'draw':
      pullFromDeck(state, p, true);
      log(state, `P${p} draws`);
      return null;

    case 'deploy': {
      const card = takeFromHand(state, p, action.card);
      card.fatigued = true;
      ops.place(state, card, action.to);
      log(state, `P${p} deploys ${defOf(state, card).name}`);
      refresh(state);
      emit(state, state.impls, 'afterEnter', { card, square: action.to });
      return startCardEffect(state, { kind: 'deploy', uid: card.uid }, action);
    }

    case 'move': {
      const top = ops.topOf(state, action.from);
      // A trap on the destination goes off BEFORE the fighter gets there, and
      // may stop it getting there at all.
      if (springTraps(state, action.to, top)) {
        if (ops.findCard(state, top.uid)) top.fatigued = true;
        log(state, `P${p} walked into something`);
        refresh(state);
        return null;
      }
      ops.relocate(state, top.uid, action.to, { withStack: true });
      top.fatigued = true;
      top.movedThisTurn = (top.movedThisTurn || 0) + 1;
      log(state, `P${p} moves ${action.from}->${action.to}`);
      refresh(state);
      emit(state, state.impls, 'afterMove', { card: top, from: action.from, to: action.to });
      emit(state, state.impls, 'afterEnter', { card: top, square: action.to });
      return null;
    }

    case 'attack':
      return resolveAttack(state, action.from, action.to);

    case 'defend': {
      // WHICH cards you throw away is your decision, not the dice's. It used
      // to take them at random out of your hand.
      const g = action.square ?? gatesOf(state, p)[0];
      const res = runEffect(state, { kind: 'defend', square: g }, () => defendEffect(state, g));
      refresh(state);
      return res.done ? null : { pending: true };
    }

    case 'ability': {
      const card = ops.findCard(state, action.uid);
      const entry = actionAbilitiesOf(state, card)[action.index];
      if (!entry) throw new Error('no such ability');
      const def = state.defs[card.def];
      if (def?.type === 'fighter') card.fatigued = true;
      log(state, `P${p} uses ${entry.ability.name || 'an ability'}`);
      return startCardEffect(state, { kind: 'ability', uid: card.uid, index: action.index }, action);
    }

    case 'tactic': {
      const card = takeFromHand(state, p, action.card);
      state.playedTactics ||= [];
      state.playedTactics.push(card.def);
      log(state, `P${p} plays ${defOf(state, card).name}`);
      // A Tactic being resolved belongs to no zone, so it is parked in
      // `resolving` — otherwise a snapshot taken mid-effect loses the card.
      state.resolving = card;
      const r = startCardEffect(state, { kind: 'tactic', uid: card.uid, card: card.def }, action, card);
      if (!r || !r.pending) {
        retireTactic(state, card);
        delete state.resolving;
      }
      return r;
    }

    case 'construct': {
      const card = takeFromHand(state, p, action.card);
      card.square = action.to;
      state.constructs.push(card);
      log(state, `P${p} plays ${defOf(state, card).name}`);
      refresh(state);
      return startCardEffect(state, { kind: 'construct', uid: card.uid }, action);
    }

    case 'attach': {
      const card = takeFromHand(state, p, action.card);
      const host = ops.findCard(state, action.host);
      (host.attachments ||= []).push(card);
      card.attachedTo = host.uid;
      log(state, `P${p} attaches ${defOf(state, card).name}`);
      refresh(state);
      emit(state, state.impls, 'afterAttachmentPlayed', { attachment: card, host });
      return startCardEffect(state, { kind: 'attach', uid: card.uid, host: host.uid }, action);
    }

    default:
      throw new Error(`unknown action ${action.t}`);
  }
}

/** Run whatever the card does for this descriptor, if anything. */
function startCardEffect(state, descriptor, action, cardOverride = null) {
  const card = cardOverride || ops.findCard(state, descriptor.uid);
  if (!card) return null;
  const impl = CARDS[card.def];

  let gen = null;
  if (descriptor.kind === 'ability') {
    // An ability may be GRANTED by an Attachment, in which case it belongs to
    // the attachment and the host may have no implementation at all. Bailing
    // out on a missing host impl is why an attached Fire Bolt did nothing.
    const entry = actionAbilitiesOf(state, card)[descriptor.index];
    if (entry?.ability?.run) gen = () => entry.ability.run(effectCtx(state, card, action));
    if (!gen) return null;
    (state.implsUsed ||= {})[card.def] = true;
    const res = runEffect(state, descriptor, gen);
    refresh(state);
    if (res.done) {
      defaultCast(state, card);
      announceAbility(state, card, descriptor.index, entry);
    }
    return res.done ? null : { pending: true };
  }

  if (!impl) return null;
  if (descriptor.kind === 'deploy' && impl.onDeploy) {
    gen = () => impl.onDeploy(effectCtx(state, card, action));
  } else if (descriptor.kind === 'tactic' && impl.play) {
    gen = () => impl.play(effectCtx(state, card, action));
  } else if (descriptor.kind === 'construct' && impl.onPlay) {
    gen = () => impl.onPlay(effectCtx(state, card, action));
  } else if (descriptor.kind === 'attach' && impl.onAttach) {
    const host = ops.findCard(state, descriptor.host);
    gen = () => impl.onAttach({ ...effectCtx(state, card, action), host });
  }
  if (!gen) return null;

  (state.implsUsed ||= {})[card.def] = true;
  const res = runEffect(state, descriptor, gen);
  refresh(state);
  if (res.done) defaultCast(state, card);
  return res.done ? null : { pending: true };
}

/**
 * Every card that goes off should LOOK like it went off.
 *
 * Cards with a motif of their own say so themselves; this is the rest — a
 * flourish in the colour of whoever played it, so a Gloaming tactic does not
 * resolve in the same silence as a Shardsworn one. Skipped when the card has
 * already described itself, so a Fire Bolt is not also a generic puff.
 */
function defaultCast(state, card) {
  if (!card) return;
  const named = CARD_MOTIF[card.def];
  const already = (state.fx || []).some((e) => e.kind !== 'cast');

  // A card that describes itself as it resolves — a Convict, a bolt, a haul in
  // irons — has already said everything it needs to, and a faction flourish on
  // top of that is noise. But a card with a NAMED motif is a deliberate
  // authoring decision and should still get it: the three Inquisition jailers
  // emit `chains` while they drag the victim in, and `bury` is what happens
  // when the weight comes down on them afterwards. Suppressing the second
  // event meant the motif fired for exactly one of its four cards.
  if (already && !named) return;

  ops.fx(state, named || 'cast', {
    at: card.uid, faction: state.defs[card.def]?.faction || 'Neutral',
  });
}

/**
 * "After a fighter you control resolves an Action ability..."
 *
 * Twain of Twine listens for this and it was never once fired — the event was
 * declared, listened for, and emitted by nobody, so the card did nothing at
 * all. An ability can finish either immediately or several answers later, so
 * both endings announce it.
 */
function announceAbility(state, card, index, entry) {
  emit(state, state.impls, 'afterAbility', {
    source: card, index, name: entry?.ability?.name || null,
  });
}

/**
 * Paying for a Defend: discard cards equal to the intruder's power, then it
 * dies. Written as a generator so the player picks which cards go — and so the
 * choice crosses the wire like every other choice, rather than being made
 * locally and hoped about.
 */
function* defendEffect(state, square) {
  const enemy = ops.topOf(state, square);
  if (!enemy) return;
  const p = state.active;
  const pl = state.players[p];
  const n = powerOf(state, enemy);

  let picks;
  if (pl.hand.length <= n) {
    picks = pl.hand.map((c) => c.uid);            // nothing to decide
  } else {
    picks = yield ask.some(pl.hand.map((c) => c.uid), n, {
      exact: true, prompt: `Discard ${n} card${n === 1 ? '' : 's'} to throw them off your Gates`,
    });
  }

  for (const uid of picks || []) {
    const idx = pl.hand.findIndex((c) => c.uid === uid);
    if (idx >= 0) pl.graveyard.push(pl.hand.splice(idx, 1)[0]);
  }
  destroy(state, enemy.uid, { by: null });
  log(state, `P${p} defends, discarding ${n}`);
  emit(state, state.impls, 'afterDefend', { player: p, card: enemy });
}

export function effectCtx(state, self, action = {}) {
  return {
    state, self, action,
    me: self.owner,
    ops, emit: (e, pl) => emit(state, state.impls, e, pl),
    destroy: (uid, by) => destroy(state, uid, { by }),
    refresh: () => refresh(state),
    rand: () => rand(state),
  };
}

/** Answer an outstanding choice. */
export function choose(state, answer) {
  state.fx = [];
  const finished = state.pending?.descriptor || null;
  const res = answerPending(state, answer, (s, descriptor) => {
    // KIND FIRST, ALWAYS. Not every pending effect belongs to a card — paying
    // for a Defend belongs to the player — so looking a card up before
    // dispatching threw those effects away the moment they were answered.
    // This is the fourth time this shape of bug has bitten; the lookup now
    // happens only for the kinds that actually need one.
    if (descriptor.kind === 'defend') {
      return () => defendEffect(s, descriptor.square);
    }

    const card = ops.findCard(s, descriptor.uid)
      || (s.resolving?.uid === descriptor.uid ? s.resolving : null);
    if (!card) return null;

    // WHOSE implementation runs is not always the card the descriptor names.
    // A granted ability belongs to the Attachment, a free use belongs to the
    // card that granted it, and a queued effect belongs to whatever queued it —
    // so none of them may be gated on the named card having an implementation
    // of its own. Checking that first is what silently dropped an attached
    // Fire Bolt the moment you answered it: the host is a plain Soldier with
    // no implementation at all.
    if (descriptor.kind === 'ability') {
      const entry = actionAbilitiesOf(s, card)[descriptor.index];
      return entry?.ability?.run ? () => entry.ability.run(effectCtx(s, card)) : null;
    }
    if (descriptor.kind === 'freeUse') {
      const src = ops.findCard(s, descriptor.source);
      const fn = src && CARDS[src.def]?.freeRun;
      return fn ? () => fn({ ...effectCtx(s, src), descriptor }) : null;
    }
    if (descriptor.kind === 'queued') {
      // Dispatch on the KIND, exactly as drainQueue does. Choosing by whether
      // a `source` field is present meant a queued effect that recorded what
      // triggered it was resumed as a free use — so answering its question
      // threw the whole effect away.
      const fn = CARDS[card.def]?.queued?.[descriptor.name];
      return fn ? () => fn({ ...effectCtx(s, card), descriptor }) : null;
    }

    const impl = CARDS[card.def];
    if (!impl) return null;
    if (descriptor.kind === 'deploy') return () => impl.onDeploy(effectCtx(s, card));
    if (descriptor.kind === 'tactic') return () => impl.play(effectCtx(s, card));
    if (descriptor.kind === 'construct') return () => impl.onPlay(effectCtx(s, card));
    if (descriptor.kind === 'attach') {
      const host = ops.findCard(s, descriptor.host);
      return () => impl.onAttach({ ...effectCtx(s, card), host });
    }
    return null;
  }, refresh);

  refresh(state);
  if (!res.done) return state;

  if (finished?.uid != null) {
    const card = ops.findCard(state, finished.uid)
      || (state.resolving?.uid === finished.uid ? state.resolving : null);
    defaultCast(state, card);
    if (finished.kind === 'ability' && card) {
      announceAbility(state, card, finished.index,
        actionAbilitiesOf(state, card)[finished.index]);
    }
  }

  if (state.resolving) {
    retireTactic(state, state.resolving);
    delete state.resolving;
  }
  drainQueue(state);
  finishAction(state);
  return state;
}

/**
 * Where a resolved Tactic goes. The graveyard, unless the card said otherwise
 * while it was resolving — Migration shuffles itself back into its owner's
 * deck, and it is the only card that does, so the exception lives here rather
 * than in two separate disposal sites that would drift apart.
 */
function retireTactic(state, card) {
  if (card.toDeck) {
    delete card.toDeck;
    state.players[card.owner].deck.push(card);
    shuffleFor(state, card.owner);
    return;
  }
  state.players[card.owner].graveyard.push(card);
}

function shuffleFor(state, p) {
  const deck = state.players[p].deck;
  for (let i = deck.length - 1; i > 0; i--) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    const j = Math.abs(state.rng) % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/**
 * NEW MOON, waiting beside the Stronghold.
 *
 * "At the start of your Action Phase, if you control Scylla, rotate this card.
 *  After four rotations, flip this card over and put it in an unoccupied
 *  non-Gate square in your Back Row. If you cannot, remove this card from
 *  beside your Stronghold."
 *
 * The clock only runs while Scylla is alive and yours, so killing her stops
 * the moon — that is the whole tension of the card, and it is why this is
 * checked every turn rather than counted down from when she arrived.
 */
function tickBeside(state, p) {
  const slot = state.beside?.[p];
  if (!slot || slot.done) return;

  // allCards is a generator, so this is a loop rather than .some().
  let hasScylla = false;
  for (const { card, zone } of ops.allCards(state)) {
    if (zone === 'board' && card.owner === p && card.def === SCYLLA) { hasScylla = true; break; }
  }
  if (!hasScylla) return;

  slot.rotations++;
  ops.fx(state, 'moonphase', { player: p, phase: slot.rotations });
  if (slot.rotations < 4) return;

  // A non-Gate square in your Back Row, with nothing standing on it. Charybdis
  // cannot be in a stack, so "unoccupied" is not a convenience here — there is
  // nowhere else it could legally go.
  const gates = gatesOf(state, p);
  const spot = (state.backRow?.[p] || [])
    .filter((sq) => sq >= 0 && sq < 9 && !gates.includes(sq) && !ops.occupied(state, sq))
    .sort((a, b) => a - b)[0];

  slot.done = true;
  if (spot == null) {
    // "If you cannot, remove this card from beside your Stronghold." Removed,
    // not discarded: it must not turn up in a Graveyard for something to haul
    // back out. It still has to go SOMEWHERE, though — dropping the reference
    // made a card vanish, which the conservation check caught at 200 games and
    // not at 60.
    log(state, `P${p}'s New Moon sets with nowhere to rise`);
    state.removed[p].push(slot.card);
    state.beside[p] = null;
    return;
  }
  // The card turns over: the face beside the Stronghold was New Moon, the one
  // that lands on the board is Charybdis. Same card, so the instance is kept
  // and only its definition changes.
  const card = slot.card;
  card.def = CHARYBDIS;
  ops.place(state, card, spot);
  state.beside[p] = null;
  ops.fx(state, 'moonrise', { at: spot, player: p });
  log(state, `P${p}'s New Moon turns: Charybdis rises on square ${spot}`);
}

function drainQueue(state) {
  let guard = 0;
  while (state.queue?.length && guard++ < 50) {
    const descriptor = state.queue.shift();
    const card = ops.findCard(state, descriptor.uid);
    if (!card) continue;
    // WHICH function runs is decided by the KIND of queue entry, never by
    // which fields happen to be set. Dispatching on `source` meant any queued
    // effect that recorded what triggered it was looked up as a free use and
    // silently dropped — which is what happened to Twain of Twine.
    const source = descriptor.source ? ops.findCard(state, descriptor.source) : null;
    const fn = descriptor.kind === 'freeUse'
      ? (source && CARDS[source.def]?.freeRun)
      : CARDS[card.def]?.queued?.[descriptor.name];
    if (!fn) continue;
    // The descriptor travels with the effect: a queued effect often needs to
    // know WHICH card the trigger was about, and a queue entry is plain data.
    const owner = descriptor.kind === 'freeUse' ? (source || card) : card;
    const res = runEffect(state, descriptor,
      () => fn({ ...effectCtx(state, owner), descriptor }));
    refresh(state);
    if (!res.done) return;
  }
}

function finishAction(state) {
  if (state.winner !== null || state.pending) return;
  checkAvatars(state);
  if (state.winner !== null) return;
  if (state.actionsLeft <= 0 || legalActions(state).length === 0) endTurn(state);
}

/**
 * Take the next card off a deck — into hand, or into the graveyard when milled.
 *
 * If that card is an Auroxi Stronghold it is not drawn or milled at all: it
 * rises onto the battlefield as a fighter. Returns true if that happened.
 */
function pullFromDeck(state, p, toHand) {
  const pl = state.players[p];
  const next = pl.deck[0];
  if (!next) return false;

  if (!next.isStronghold) {
    pl.deck.shift();
    if (toHand) pl.hand.push(next);
    else pl.graveyard.push(next);
    return false;
  }

  // It rises WHERE THE DECK STOOD. That square is its own — nothing else can
  // enter it while it is empty — so it is free unless an enemy has already
  // walked in over the Stronghold's own square.
  const home = strongholdSquareOf(p);
  const spots = [home, ...gatesOf(state, p), ...(state.backRow?.[p] || [])];
  const free = spots.find((sq) => !ops.occupied(state, sq));
  if (free == null) {
    state.winner = opponent(p);
    state.reason = `P${p}'s Stronghold had nowhere to rise`;
    return true;
  }

  pl.deck.shift();
  const sh = state.strongholds[p];
  sh.card = next;
  sh.revealed = true;
  ops.place(state, next, free);
  log(state, `P${p}'s Stronghold rises on square ${free}`);
  refresh(state);
  return true;
}

/* ---------------------------------------------------------------- combat */

function resolveAttack(state, from, to) {
  const atk = ops.topOf(state, from), def = ops.topOf(state, to);
  const ap = powerOf(state, atk, def);
  const dp = derivedPower(state, def, state.defs, state.derived, { defending: true });

  let atkDies = false, defDies = false;
  if (ap > dp) defDies = true;
  else if (ap === dp) { defDies = true; atkDies = true; }
  else atkDies = true;

  log(state, `attack ${from}->${to} (${ap} v ${dp})`);

  // THE TRAIT TRIANGLE. Half the cards in the pool say "+I when Attacking
  // Brutes" and until now that rule had no picture at all — the commonest
  // thing in the game was also the only thing that happened invisibly.
  //
  // Emitted only when the bonus ACTUALLY BITES, which means asking for the
  // power twice: once as the game computes it and once with the bonus denied.
  // Announcing it whenever an attacker merely HAS the ability would light up
  // on every attack, including the ones where the trait does not match.
  const plain = derivedPower(state, atk, state.defs, state.derived,
    { attacking: true, vs: def, noTraitBonus: true });
  if (ap > plain) {
    ops.fx(state, 'triangle', {
      at: from, to, amount: ap - plain,
      trait: [...traitsOf(state, def, state.defs, state.derived)][0] || null,
    });
  }

  if (defDies) destroy(state, def.uid, { by: atk, byAttack: true });
  if (atkDies) destroy(state, atk.uid, { by: def, byAttack: true });

  if (!atkDies && ops.topOf(state, from) === atk && !ops.occupied(state, to)) {
    ops.relocate(state, atk.uid, to, { withStack: true });
    emit(state, state.impls, 'afterEnter', { card: atk, square: to });
  }
  if (!atkDies) atk.fatigued = true;

  refresh(state);
  emit(state, state.impls, 'afterAttack', {
    attacker: atk, defender: def, result: { atkDies, defDies },
  });
  return null;
}

/**
 * Destroy a card. Replacements get first refusal — Phylactery catches Heroes,
 * and a Construct under an entering fighter is destroyed instead of it.
 */
export function destroy(state, uid, { by = null, byAttack = false } = {}) {
  const card = ops.findCard(state, uid);
  if (!card) return null;
  const at = ops.locate(state, uid);

  // Whether this death came out of a FIGHT matters: Convicted of Heresy only
  // rescues its host "while being Attacked".
  const outcome = replace(state, state.impls, 'destroy',
    { uid, card, to: 'graveyard', handled: false, byAttack, by });
  if (outcome.handled) { refresh(state); return card; }

  // ops.toGraveyard sheds attachments to their owners' graveyards, which is
  // what the rules say happens when a fighter is destroyed.
  ops.toGraveyard(state, uid);
  state.lastKillTurn = state.turn;
  refresh(state);
  emit(state, state.impls, 'afterDestroy', { card, by, square: at?.square });
  checkAvatars(state, card);
  return card;
}

/** Avatar: "If this fighter is destroyed, you lose the game." */
function checkAvatars(state, justDestroyed = null) {
  for (let p = 0; p < 2; p++) {
    const sh = state.strongholds[p];
    if (!sh?.revealed || !sh.card) continue;
    const stillThere = ops.findCard(state, sh.card.uid);
    const onBoard = stillThere && ops.locate(state, sh.card.uid)?.zone === 'board';
    if (!onBoard) {
      state.winner = opponent(p);
      state.reason = `P${p}'s Avatar was destroyed`;
      return;
    }
  }
}

/* ---------------------------------------------------------------- turns */

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

function endTurn(state) {
  emit(state, state.impls, 'endOfTurn', { player: state.active });
  for (const sq of state.board) {
    for (const card of sq || []) {
      if (card.owner === state.active) { card.fatigued = false; card.movedThisTurn = 0; }
    }
  }
  for (const c of state.constructs) if (c && c.owner === state.active) c.fatigued = false;
  state.usedThisTurn = {};
  state.singing = [];
  state.active = opponent(state.active);
  refresh(state);
  beginTurn(state);
}

function beginTurn(state) {
  for (let guard = 0; guard < 64; guard++) {
    state.turn++;
    const p = state.active;
    refresh(state);
    emit(state, state.impls, 'startOfTurn', { player: p });
    tickBeside(state, p);
    refresh(state);

    if (isSieged(state, p)) {
      const pl = state.players[p];
      if (!pl.deck.length) {
        state.winner = opponent(p);
        state.reason = `P${p} sieged with an empty Stronghold`;
        return;
      }
      if (!pullFromDeck(state, p, false)) {
        log(state, `P${p} is Sieged, mills 1 (${pl.deck.length} left)`);
      }
    } else {
      pullFromDeck(state, p, true);
    }

    const h = hashState(state);
    state.history[h] = (state.history[h] || 0) + 1;
    if (state.history[h] >= 4) {
      state.winner = 'stalemate';
      state.reason = 'position repeated four times';
      return;
    }

    // Both Strongholds empty and nobody under siege: no player can be made to
    // lose a card ever again, so the only way the game ends is a Siege that
    // may never come. The repeated-position test cannot see this because the
    // fighters keep shuffling around. RULING #5.
    const bothEmpty = state.players.every((pl) => pl.deck.length === 0);
    if (bothEmpty && state.turn - (state.lastKillTurn || 0) > 10) {
      state.winner = 'draw';
      state.reason = 'both Strongholds empty and no fighter destroyed for ten turns';
      return;
    }

    // Cards that deploy out of the Graveyard can trade forever, so a game is
    // not guaranteed to terminate on its own. A hard cap keeps it finite.
    // RULING #6.
    if (state.turn > 400) {
      state.winner = 'draw';
      state.reason = 'the game reached 400 turns';
      return;
    }

    state.actionsLeft = state.turn === 1 ? 1 : 2;
    if (state.extraActions) { state.actionsLeft += state.extraActions; state.extraActions = 0; }
    if (state.nextTurnExtra?.[p]) {
      state.actionsLeft += state.nextTurnExtra[p];
      state.nextTurnExtra[p] = 0;
    }

    // A trap that springs at the START of your turn queues its effect, and the
    // queue was only ever drained at the END of an action — so Concealed Post
    // waited politely until you had already done something. Drain it here,
    // once the turn is set up but before you can act.
    drainQueue(state);
    if (state.pending) return;
    if (state.winner !== null) return;

    if (legalActions(state).length > 0) return;

    for (const sq of state.board) {
      for (const card of sq || []) if (card.owner === p) card.fatigued = false;
    }
    state.active = opponent(p);
  }
  state.winner = 'draw';
  state.reason = 'neither player could act';
}

export function hashState(state) {
  const board = state.board
    .map((sq) => (sq || []).map((c) => `${c.def}:${c.owner}:${c.fatigued ? 1 : 0}`).join('|'))
    .join(',');
  const zones = state.players
    .map((pl) => [
      pl.hand.map((c) => c.def).sort().join('|'),
      pl.deck.map((c) => c.def).join('|'),
      pl.graveyard.length,
    ].join('/'))
    .join(';');
  const cons = (state.constructs || []).map((c) => `${c.def}@${c.square}`).sort().join('|');
  // Gates are part of the position: Migration moves them permanently, and two
  // engines that disagreed about where they were would not be caught by any
  // of the rest of this.
  const gates = (state.homeGate || PRINTED_GATES).join('.');
  // The moon's count is part of the position too — two engines a rotation
  // apart would put Charybdis on the board a turn apart.
  const moon = (state.beside || []).map((b) => (b ? b.rotations : '-')).join('.');
  return `${state.active}#${board}#${zones}#${cons}#${gates}#${moon}`;
}

function log(state, msg) {
  state.log.push(`T${state.turn} ${msg}`);
  if (state.log.length > 2000) state.log.shift();
}

export function cloneState(state) {
  const { defs, impls } = state;
  const shallow = {};
  for (const k of Object.keys(state)) if (!['defs', 'impls', 'derived'].includes(k)) shallow[k] = state[k];
  const copy = structuredClone(shallow);
  copy.defs = defs;
  copy.impls = impls;
  refresh(copy);
  return copy;
}
