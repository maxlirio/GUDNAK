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
} from './rules/board.js';
import { derive, powerOf as derivedPower, traitsOf, abilitiesOf } from './rules/derive.js';
import * as ops from './rules/ops.js';
import { emit, replace } from './rules/triggers.js';
import { runEffect, answerPending } from './rules/driver.js';
import { CARDS } from './rules/cards.js';

export const SIZE = 3;
export const SQUARES = 9;
export const BACK_ROW = BASE_BACK_ROW;
export const GATES = PRINTED_GATES;      // printed only; use gatesOf() for live
export { VOID, distance };

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

let uidCounter = 0;

function instantiate(def, owner) {
  return { uid: ++uidCounter, def: def.id, owner, fatigued: false, attachments: [] };
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
    board: Array.from({ length: SQUARES }, () => []),
    constructs: [],
    locations: {},
    strongholds: [newStronghold(), newStronghold()],
    players: [newPlayer(), newPlayer()],
    winner: null,
    reason: null,
    log: [],
    history: {},
    queue: [],
    usedThisTurn: {},
    usedThisGame: {},
  };

  for (let p = 0; p < 2; p++) {
    state.players[p].deck = shuffle(state, decks[p].map((id) => instantiate(defs[id], p)));
    if (strongholds[p] && defs[strongholds[p]]) {
      state.strongholds[p].card = instantiate(defs[strongholds[p]], p);
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
  state.derived = derive(state, state.impls);

  state.gates = [0, 1].map((p) => {
    if (state.derived.noGates[p]) return [...new Set(state.derived.addGates[p])];
    return [...new Set([PRINTED_GATES[p], ...state.derived.addGates[p]])];
  });

  state.backRow = [0, 1].map((p) => {
    const set = new Set(BASE_BACK_ROW[p]);
    if (state.locations.void) set.add(VOID);
    for (const s of state.derived.backRow[p]) set.add(s);
    for (const s of state.gates[p]) set.add(s);
    return [...set];
  });
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
  return state.locations.void ? SQUARES + 1 : SQUARES;
}

/* ---------------------------------------------------------------- actions */

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
    if (spent) continue;

    for (const to of adjacentTo(state, sq)) {
      if (!ops.occupied(state, to)) {
        if (canEnter(state, top, to)) out.push({ t: 'move', from: sq, to });
      } else if (ops.topOf(state, to).owner !== p) {
        if (canAttack(state, top, ops.topOf(state, to))) out.push({ t: 'attack', from: sq, to });
      }
    }

    actionAbilitiesOf(state, top).forEach(({ index, usable }) => {
      if (usable) out.push({ t: 'ability', uid: top.uid, index });
    });
  }

  // Constructs have Action abilities too, and they are not fighters.
  for (const c of state.constructs) {
    if (!c || c.owner !== p) continue;
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

  return out;
}

/** Squares this fighter may be deployed to right now. */
export function deployTargets(state, p, card) {
  const out = [];
  const def = defOf(state, card);
  const mine = traitsOf(state, card, state.defs, state.derived);

  for (const sq of state.backRow[p]) {
    if (isEnemyGates(state, p, sq)) continue;
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

function constructTargets(state, p, card) {
  const impl = CARDS[defOf(state, card).id];
  if (impl?.constructSquares) return impl.constructSquares(state, card, p);
  const out = [];
  for (let i = 0; i < squaresInPlay(state); i++) {
    if (state.constructs.some((c) => c && c.square === i)) continue;
    out.push(i);
  }
  return out;
}

function attachTargets(state, p, card) {
  const impl = CARDS[defOf(state, card).id];
  if (impl?.attachTargets) return impl.attachTargets(state, card, p);
  const out = [];
  for (let sq = 0; sq < squaresInPlay(state); sq++) {
    const top = ops.topOf(state, sq);
    if (top && top.owner === p) out.push(top);
  }
  return out;
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
      ops.draw(state, p, 1);
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
      const g = action.square ?? gatesOf(state, p)[0];
      const enemy = ops.topOf(state, g);
      const n = powerOf(state, enemy);
      const picks = action.discard || null;
      for (let i = 0; i < n; i++) {
        const idx = picks ? pl.hand.findIndex((c) => c.uid === picks[i])
          : Math.floor(rand(state) * pl.hand.length);
        if (idx < 0) throw new Error('discard card not in hand');
        pl.graveyard.push(pl.hand.splice(idx, 1)[0]);
      }
      destroy(state, enemy.uid, { by: null });
      log(state, `P${p} defends, discarding ${n}`);
      emit(state, state.impls, 'afterDefend', { player: p, card: enemy });
      return null;
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
        pl.graveyard.push(card);
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
  if (!impl) return null;

  let gen = null;
  if (descriptor.kind === 'deploy' && impl.onDeploy) {
    gen = () => impl.onDeploy(effectCtx(state, card, action));
  } else if (descriptor.kind === 'ability') {
    const entry = actionAbilitiesOf(state, card)[descriptor.index];
    if (entry?.ability?.run) gen = () => entry.ability.run(effectCtx(state, card, action));
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
  return res.done ? null : { pending: true };
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
  const res = answerPending(state, answer, (s, descriptor) => {
    const card = ops.findCard(s, descriptor.uid)
      || (s.resolving?.uid === descriptor.uid ? s.resolving : null);
    if (!card) return null;
    const impl = CARDS[card.def];
    if (!impl) return null;
    if (descriptor.kind === 'deploy') return () => impl.onDeploy(effectCtx(s, card));
    if (descriptor.kind === 'tactic') return () => impl.play(effectCtx(s, card));
    if (descriptor.kind === 'construct') return () => impl.onPlay(effectCtx(s, card));
    if (descriptor.kind === 'attach') {
      const host = ops.findCard(s, descriptor.host);
      return () => impl.onAttach({ ...effectCtx(s, card), host });
    }
    if (descriptor.kind === 'freeUse') {
      const src = ops.findCard(s, descriptor.source);
      const fn = src && CARDS[src.def]?.freeRun;
      return fn ? () => fn(effectCtx(s, src)) : null;
    }
    if (descriptor.kind === 'ability') {
      const entry = actionAbilitiesOf(s, card)[descriptor.index];
      return entry?.ability?.run ? () => entry.ability.run(effectCtx(s, card)) : null;
    }
    return null;
  }, refresh);

  refresh(state);
  if (!res.done) return state;

  if (state.resolving) {
    state.players[state.resolving.owner].graveyard.push(state.resolving);
    delete state.resolving;
  }
  drainQueue(state);
  finishAction(state);
  return state;
}

function drainQueue(state) {
  let guard = 0;
  while (state.queue?.length && guard++ < 50) {
    const descriptor = state.queue.shift();
    const card = ops.findCard(state, descriptor.uid);
    if (!card) continue;
    // A free use granted by an attachment: the effect belongs to the SOURCE
    // card, not the host running it.
    const source = descriptor.source ? ops.findCard(state, descriptor.source) : null;
    const fn = source ? CARDS[source.def]?.freeRun : CARDS[card.def]?.queued?.[descriptor.name];
    if (!fn) continue;
    const res = runEffect(state, descriptor, () => fn(effectCtx(state, source || card)));
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

  if (defDies) destroy(state, def.uid, { by: atk });
  if (atkDies) destroy(state, atk.uid, { by: def });

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
export function destroy(state, uid, { by = null } = {}) {
  const card = ops.findCard(state, uid);
  if (!card) return null;
  const at = ops.locate(state, uid);

  const outcome = replace(state, state.impls, 'destroy', { uid, card, to: 'graveyard', handled: false });
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
    refresh(state);

    if (isSieged(state, p)) {
      const pl = state.players[p];
      if (!pl.deck.length) {
        // The Stronghold is revealed when the deck is gone. Auroxi Strongholds
        // are fighters: they come onto the Gates and the game carries on.
        const sh = state.strongholds[p];
        if (sh?.card && !sh.revealed && state.defs[sh.card.def]?.power != null) {
          sh.revealed = true;
          const g = gatesOf(state, p)[0] ?? PRINTED_GATES[p];
          ops.place(state, sh.card, g);
          log(state, `P${p}'s Stronghold rises`);
          refresh(state);
        } else {
          state.winner = opponent(p);
          state.reason = `P${p} sieged with an empty Stronghold`;
          return;
        }
      } else {
        pl.graveyard.push(pl.deck.shift());
        log(state, `P${p} is Sieged, mills 1 (${pl.deck.length} left)`);
      }
    } else {
      ops.draw(state, p, 1);
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
  return `${state.active}#${board}#${zones}#${cons}`;
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
