// Board topology as DATA, not arithmetic.
//
// The engine used to compute adjacency from a square index, and treat Gates as
// the constant [1, 7]. The card pool does not allow either:
//
//   The Void (M208)        adds a TENTH square, in your Back Row, adjacent only
//                          to the centre — so the board is a graph, not a grid.
//   Divine Aurox,          make squares next to them count as your Gates
//   Living Stronghold
//   Looming Large          extends your Gates outward for a turn
//   Avatar's Burden        removes your Gates entirely
//   Scylla, Temple of      redefine which squares are your Back Row, which is
//   Tides, Temporary Camp  what Deploy legality is built on
//
// So Gates and Back Row are computed per player per query, and adjacency is a
// table that Locations can extend.

export const SIZE = 3;
export const GRID_SQUARES = 9;

/** The Void, when in play, is square 9. Locations get indices above the grid. */
export const VOID = 9;

/**
 * Each player's Stronghold is a SQUARE, not scenery.
 *
 * The Auroxi have no separate Stronghold card: the Living Stronghold or Black
 * Aurox IS their Stronghold, and it rises where the deck stood when the deck
 * runs out. From there it walks onto the field like anything else — so the
 * deck's place has to be somewhere a fighter can stand, joined to the middle of
 * that player's Back Row.
 *
 * The square exists only while someone is standing on it. Empty, it has no
 * neighbours at all, so nothing can wander into the space behind your lines.
 */
export const STRONGHOLD_SQ = [10, 11];
const STRONGHOLD_GATE = [1, 7];

export function strongholdSquareOf(player) { return STRONGHOLD_SQ[player]; }

export function isStrongholdSquare(square) {
  return square === STRONGHOLD_SQ[0] || square === STRONGHOLD_SQ[1];
}

function strongholdStanding(state, p) {
  return ((state.board || [])[STRONGHOLD_SQ[p]] || []).length > 0;
}

/** Base orthogonal adjacency of the 3x3 grid. */
export const BASE_ADJACENT = (() => {
  const a = [];
  for (let i = 0; i < GRID_SQUARES; i++) {
    const r = Math.floor(i / SIZE), c = i % SIZE, n = [];
    if (r > 0) n.push(i - SIZE);
    if (r < SIZE - 1) n.push(i + SIZE);
    if (c > 0) n.push(i - 1);
    if (c < SIZE - 1) n.push(i + 1);
    a.push(n);
  }
  return a;
})();

export const BASE_BACK_ROW = [[0, 1, 2], [6, 7, 8]];
export const PRINTED_GATES = [1, 7];

/** How many squares exist in this game — 9, or 10 once The Void is in play. */
export function squareCount(state) {
  // 9 grid + The Void + the two Stronghold squares. They are always indexed,
  // whether or not anything is in them, so a square's number never changes
  // mid-game — the netcode compares boards position by position.
  return GRID_SQUARES + 3;
}

/**
 * Adjacency including any Location in play.
 *
 * The Void is "adjacent only to the center square" — and it is in BOTH
 * players' Back Rows, since each player who brings it has their own. We model
 * one shared Void square, which is how it is played: one card beside the board.
 */
export function adjacentTo(state, square) {
  if (square === VOID) return state.locations?.void ? [4] : [];
  for (let p = 0; p < 2; p++) {
    if (square === STRONGHOLD_SQ[p]) {
      return strongholdStanding(state, p) ? [STRONGHOLD_GATE[p]] : [];
    }
  }

  const base = BASE_ADJACENT[square] || [];
  const extra = [];
  if (state.locations?.void && square === 4) extra.push(VOID);
  for (let p = 0; p < 2; p++) {
    if (square === STRONGHOLD_GATE[p] && strongholdStanding(state, p)) {
      extra.push(STRONGHOLD_SQ[p]);
    }
  }
  return extra.length ? [...base, ...extra] : base;
}

/** Straight-line distance in squares, as the rules count it ("2 squares away"). */
export function distance(state, a, b) {
  if (a === b) return 0;
  // breadth-first over the real adjacency graph, so The Void measures correctly
  const seen = new Set([a]);
  let frontier = [a], d = 0;
  while (frontier.length && d < 12) {
    d++;
    const next = [];
    for (const s of frontier) {
      for (const n of adjacentTo(state, s)) {
        if (seen.has(n)) continue;
        if (n === b) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Every square that currently counts as `player`'s Back Row. */
export function backRowOf(state, player, derived) {
  const set = new Set(BASE_BACK_ROW[player]);
  if (state.locations?.void) set.add(VOID);      // The Void is in your Back Row
  for (const s of derived?.backRow?.[player] || []) set.add(s);
  // Gates are always considered in your Back Row, even when they move.
  for (const s of gatesOf(state, player, derived)) set.add(s);
  return set;
}

/**
 * Every square that currently counts as `player`'s Gates.
 *
 * Printed Gates unless something says otherwise; effects may add squares, and
 * Avatar's Burden removes the lot.
 */
export function gatesOf(state, player, derived) {
  if (derived?.noGates?.[player]) {
    // "While this fighter is in play, you have no Gates. (Other effects may
    // still consider squares as your Gates.)" — so added Gates survive.
    return new Set(derived?.addGates?.[player] || []);
  }
  const set = new Set([state.homeGate?.[player] ?? PRINTED_GATES[player]]);
  for (const s of derived?.addGates?.[player] || []) set.add(s);
  return set;
}

/** Is any enemy fighter standing on one of this player's Gates? */
export function siegedSquares(state, player, derived, topOf) {
  const out = [];
  for (const g of gatesOf(state, player, derived)) {
    const t = topOf(state, g);
    if (t && t.owner !== player) out.push(g);
  }
  return out;
}
