// Zone primitives — every way a card can move between board, hand, deck,
// graveyard and stacks. Cards never touch state.board directly; they call these,
// so relocation rules ("without its stack", "even within a stack") live in one
// place and the trigger bus fires consistently.

export function topOf(state, square) {
  return (state.board[square] || [])[0] || null;
}

export function stackAt(state, square) {
  return state.board[square] || [];
}

export function occupied(state, square) {
  return (state.board[square] || []).length > 0;
}

/** Where is this card? Returns {zone, square, depth, player} or null. */
export function locate(state, uid) {
  for (let s = 0; s < state.board.length; s++) {
    const i = (state.board[s] || []).findIndex((c) => c.uid === uid);
    if (i >= 0) return { zone: 'board', square: s, depth: i };
  }
  for (let p = 0; p < 2; p++) {
    const pl = state.players[p];
    for (const zone of ['hand', 'deck', 'graveyard']) {
      const i = pl[zone].findIndex((c) => c.uid === uid);
      if (i >= 0) return { zone, player: p, index: i };
    }
  }
  const c = (state.constructs || []).find((x) => x && x.uid === uid);
  if (c) return { zone: 'construct', square: c.square };
  for (const { card, zone, host } of allCards(state)) {
    if (zone === 'attachment' && card.uid === uid) return { zone: 'attachment', host: host.uid };
  }
  for (let p = 0; p < 2; p++) {
    if (state.strongholds?.[p]?.card?.uid === uid) return { zone: 'stronghold', player: p };
  }
  return null;
}

/** Pull a card out of wherever it is. Returns the card, or null. */
export function extract(state, uid, { withStack = false } = {}) {
  const at = locate(state, uid);
  if (!at) return null;

  if (at.zone === 'board') {
    const stack = state.board[at.square];
    if (withStack && at.depth === 0) {
      state.board[at.square] = [];
      return stack;
    }
    return stack.splice(at.depth, 1)[0];
  }
  if (at.zone === 'construct') {
    const i = state.constructs.findIndex((x) => x && x.uid === uid);
    return state.constructs.splice(i, 1)[0];
  }
  if (at.zone === 'stronghold') {
    const c = state.strongholds[at.player].card;
    state.strongholds[at.player].card = null;
    return c;
  }
  if (at.zone === 'attachment') {
    const host = findCard(state, at.host);
    const i = (host?.attachments || []).findIndex((a) => a.uid === uid);
    if (i < 0) return null;
    const a = host.attachments.splice(i, 1)[0];
    a.attachedTo = null;
    return a;
  }
  return state.players[at.player][at.zone].splice(at.index, 1)[0];
}

/* ------------------------------------------------------------ board moves */

/**
 * Put a card (or a whole stack) onto a square.
 * `under` places it beneath what is already there.
 */
export function place(state, cardOrStack, square, { under = false } = {}) {
  const arr = Array.isArray(cardOrStack) ? cardOrStack : [cardOrStack];
  const stack = state.board[square] || (state.board[square] = []);
  if (under) stack.push(...arr);
  else stack.unshift(...arr);
}

/**
 * Move a fighter to a square. Carries the cards beneath it unless
 * `withStack: false`, which several cards say explicitly.
 */
export function relocate(state, uid, to, { withStack = true, under = false } = {}) {
  const at = locate(state, uid);
  if (!at || at.zone !== 'board') return false;
  const canCarry = withStack && at.depth === 0;
  const moved = extract(state, uid, { withStack: canCarry });
  if (!moved) return false;
  place(state, moved, to, { under });
  return true;
}

/**
 * Swap two fighters' squares, keeping each one's stack where it is.
 *
 * Bails out BEFORE touching the board if the swap is impossible — extracting
 * the first card and then discovering the second cannot be found deletes the
 * first one out of the game, which is exactly what happened when Voidstrider
 * tried to swap with itself in The Void.
 */
export function swap(state, uidA, uidB) {
  if (uidA === uidB) return false;
  const a = locate(state, uidA), b = locate(state, uidB);
  if (!a || !b || a.zone !== 'board' || b.zone !== 'board') return false;

  const ca = extract(state, uidA);
  if (!ca) return false;
  const cb = extract(state, uidB);
  if (!cb) {
    // put the first one back exactly where it was
    state.board[a.square].splice(Math.min(a.depth, state.board[a.square].length), 0, ca);
    return false;
  }
  state.board[b.square].splice(Math.min(b.depth, state.board[b.square].length), 0, ca);
  state.board[a.square].splice(Math.min(a.depth, state.board[a.square].length), 0, cb);
  return true;
}

/* ------------------------------------------------------------ zones */

/**
 * Where a destroyed or displaced card's attachments go.
 *
 * "When a fighter is destroyed, any attachments attached to it are also
 * destroyed and are placed in their owners' Graveyards. When a fighter leaves
 * the Battlefield for any other reason, any attachments attached to it are
 * returned to their owners' hands."
 *
 * Clearing the array instead of moving them — which is what this used to do —
 * deletes cards out of the game.
 */
function shedAttachments(state, card, destroyed) {
  for (const a of card.attachments || []) {
    a.attachedTo = null;
    a.fatigued = false;
    state.players[a.owner][destroyed ? 'graveyard' : 'hand'].push(a);
  }
  card.attachments = [];
}

export function toGraveyard(state, uid) {
  const card = extract(state, uid);
  if (!card) return null;
  card.fatigued = false;
  shedAttachments(state, card, true);
  state.players[card.owner].graveyard.push(card);
  return card;
}

export function toHand(state, uid) {
  const card = extract(state, uid);
  if (!card) return null;
  card.fatigued = false;
  shedAttachments(state, card, false);
  state.players[card.owner].hand.push(card);
  return card;
}

export function toDeck(state, uid, { bottom = true } = {}) {
  const card = extract(state, uid);
  if (!card) return null;
  card.fatigued = false;
  shedAttachments(state, card, false);
  const deck = state.players[card.owner].deck;
  if (bottom) deck.push(card); else deck.unshift(card);
  return card;
}

export function draw(state, player, n = 1) {
  const pl = state.players[player];
  const got = [];
  for (let i = 0; i < n && pl.deck.length; i++) {
    const c = pl.deck.shift();
    pl.hand.push(c);
    got.push(c);
  }
  return got;
}

export function discard(state, player, uid) {
  const card = extract(state, uid);
  if (!card) return null;
  state.players[player].graveyard.push(card);
  return card;
}

export function mill(state, player, n = 1) {
  const pl = state.players[player];
  const out = [];
  for (let i = 0; i < n && pl.deck.length; i++) out.push(pl.deck.shift());
  pl.graveyard.push(...out);
  return out;
}

/* ------------------------------------------------------------ attachments */

export function attach(state, attachmentUid, hostUid) {
  const a = extract(state, attachmentUid);
  if (!a) return false;
  const host = findCard(state, hostUid);
  if (!host) return false;
  (host.attachments ||= []).push(a);
  a.attachedTo = hostUid;
  return true;
}

export function detach(state, attachmentUid, { toHand: retHand = false } = {}) {
  for (const { card } of allCards(state)) {
    const i = (card.attachments || []).findIndex((a) => a.uid === attachmentUid);
    if (i < 0) continue;
    const a = card.attachments.splice(i, 1)[0];
    a.attachedTo = null;
    const zone = retHand ? 'hand' : 'graveyard';
    state.players[a.owner][zone].push(a);
    return true;
  }
  return false;
}

export function findCard(state, uid) {
  for (const { card } of allCards(state)) if (card.uid === uid) return card;
  return null;
}

/** Every card object anywhere, including attachments and buried cards. */
export function* allCards(state) {
  for (const stack of state.board) {
    for (const c of stack || []) {
      yield { card: c, zone: 'board' };
      for (const a of c.attachments || []) yield { card: a, zone: 'attachment', host: c };
    }
  }
  for (const c of state.constructs || []) if (c) yield { card: c, zone: 'construct' };
  for (let p = 0; p < 2; p++) {
    const sh = state.strongholds?.[p];
    if (sh?.card) {
      yield { card: sh.card, zone: 'stronghold' };
      for (const a of sh.card.attachments || []) yield { card: a, zone: 'attachment', host: sh.card };
    }
    for (const zone of ['hand', 'deck', 'graveyard']) {
      for (const c of state.players[p][zone]) yield { card: c, zone };
    }
  }
}
