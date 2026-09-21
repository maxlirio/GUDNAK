// THE MAELSTROM — the whirlpool hauling a neighbour in.
//
// Shared by 1 card: M046C Charybdis. "Maelstrom: Target adjacent enemy fighter
// Attacks this fighter." One motif, one file — worked on on its own.
//
// PULLING IS THE WHOLE MOTIF, and nothing else on this table pulls. The board
// opens rings, throws bolts, washes water ACROSS a square and drops things on
// it; every one of those is an outward or a crossing shape, and a player has
// never been shown an inward one. So the entire budget goes on inwardness, in
// the four places it can be read at sixty pixels a card:
//   - the ARMS wind in. The pattern's phase carries k*log(r), so advancing it
//     walks every contour toward the middle rather than merely spinning it;
//   - a ring of water COLLAPSES from the edge of the reach to the throat, and
//     it accelerates on the way, which is the one cue that has real height in
//     it and so survives a camera this steep;
//   - the water REACHES, in four tongues that run out over the neighbouring
//     squares and are hauled back — the grab, and the only part that says
//     which squares this is happening to;
//   - the VICTIM LEANS. An adjacent enemy card is dragged bodily toward the
//     square and tipped over, then handed back. A card that moves is worth
//     every painted cue put together.
//
// It is the opposite motif to ./moonrise.js in every dial and the same water
// in every colour: the paint is imported from there rather than rewritten, so
// the thing that drags is recognisably the thing that opened. What changes is
// the direction of travel.
//
// CHEAP, because it fires for the rest of the game. Under a second, one sheet,
// no sprites, no second light. ./moonrise gets a second and a half because it
// happens once.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=500" \
//             --eval tools/fxdemo/maelstrom.js --out /tmp/ms.png \
//             --wait 9000 --settle 900
// ?t is milliseconds INTO the motif and ?sq is the whirlpool's square.

import { THREE } from '../kit.js';
import { squareToWorld } from '../../board.js';
import { whirlSheet, paintWhirl } from './moonrise.js';

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in time.
const SPAN = 0.95;
const GRAB = 0.34;        // the tongues are fully out
const HAUL = 0.76;        // ...and are back, with whatever they caught

// The same clearance ./moonrise.js uses, for the same reason: the flagstone
// face is at 0.080 and the depth buffer cannot separate a centimetre at this
// camera, while a card face is at ~0.21 so the cards float ON this.
const WATER_Y = 0.145;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeIn = (x) => x * x * x;

/** The four squares this one touches. Charybdis is never in a stack and never
 *  moves, so this is the whole of its reach. */
function neighbours(square) {
  const col = square % 3, row = (square / 3) | 0;
  const out = [];
  if (col > 0) out.push({ sq: square - 1, th: Math.PI });        // -x
  if (col < 2) out.push({ sq: square + 1, th: 0 });              // +x
  if (row > 0) out.push({ sq: square - 3, th: -Math.PI / 2 });   // -z
  if (row < 2) out.push({ sq: square + 3, th: Math.PI / 2 });    // +z
  return out;
}

/**
 * WHICH SQUARE. The rules send a square index — `ops.fx(state, 'maelstrom',
 * { at: here })` — but every other table motif is handed a card UID, and the
 * fx bench hands one here too. A uid is a number as well, so the old
 * `typeof at === 'number' ? at : 4` read uid 44 as SQUARE 44, and
 * squareToWorld turned that into a point thirty-four units off the back of the
 * board. The whirlpool was painted, correctly, where nobody could see it:
 * the reason this motif appeared to do LITERALLY NOTHING in the bench.
 *
 * So ask the pieces first. Only a number that is not a card on the table is
 * read as a square, and only if it is one of the nine.
 */
function squareOf(kit, at, fallback) {
  const piece = kit.piece?.(at);
  if (piece && piece.square != null && piece.square < 9) return piece.square;
  if (typeof at === 'number' && at >= 0 && at < 9) return at;
  return fallback;
}

export function maelstrom(kit, at) {
  const square = squareOf(kit, at, 4);
  const centre = squareToWorld(square);

  // Whose whirlpool this is, so the tongues know which neighbours are prey.
  // Read off the board rather than passed in: the dispatcher hands table
  // motifs (kit, at, faction) and the victim is chosen by the rules after
  // this fires, so there is no uid to be had. Reaching for every adjacent
  // ENEMY is the honest picture — it is a mouth, and the rules pick.
  let owner = null;
  const pieces = [...(kit.pieces?.byUid?.values?.() || [])];
  for (const p of pieces) if (p.square === square) owner = p.owner;

  // Which of the four bearings have something worth reaching for, and the
  // cards standing on them.
  const arms = [];
  const prey = [];
  for (const n of neighbours(square)) {
    const on = pieces.filter((p) => p.square === n.sq);
    const enemy = owner == null ? on : on.filter((p) => p.owner !== owner);
    // Every bearing reaches — a mouth that only opens on one side is a hand —
    // but the ones with a fighter on them reach further and harder.
    arms.push({ th: n.th, want: enemy.length ? 1 : 0.42 });
    for (const p of enemy) {
      prey.push({ piece: p, home: p.restingPosition?.() || p.group.position.clone(), th: n.th });
    }
  }

  const g = new THREE.Group();
  g.position.set(centre.x, WATER_Y, centre.z);

  const s = whirlSheet(square * 2.3 + 1.1);
  g.add(s.mesh);

  // The tongues, as a per-angle gain on the water's reach. Built once: the
  // shape never changes, only how far out it is driven.
  const LOBE = new Float32Array(s.TH.length);
  for (let j = 0; j < s.TH.length; j++) {
    let v = 0;
    for (const a of arms) {
      // cos of the bearing difference, raised so the tongue is a TONGUE and
      // not a lobe of a flower. At ^2 the four ran into each other and the
      // water was simply a bigger circle; ^6 leaves dry stone in the corners,
      // which is what makes them four separate reaches.
      const c = Math.cos(s.TH[j] - a.th);
      if (c > 0) v = Math.max(v, c ** 6 * a.want);
    }
    LOBE[j] = v;
  }

  kit.hold(g, SPAN, (t) => {
    // Out, then hauled back hard. The reach eases OUT and the haul eases IN,
    // which is the difference between a thing being offered and a thing being
    // taken: symmetric, it was a pulse, and a pulse is a UI element.
    const reach = smooth(t / GRAB) * (1 - easeIn(clamp01((t - GRAB) / (HAUL - GRAB))));
    // The body of water, which is always there — this whirlpool has been on
    // the board since ./moonrise.js opened it, and nothing here may read as it
    // arriving for the first time.
    // 1.72 and not 2.05. At 2.05 the standing body of water alone reached a
    // third of the way over both neighbouring squares, so the tongues had
    // nothing to reach INTO — the whole thing photographed as one pale
    // pinwheel three squares across, and a grab you cannot see the start of
    // is not a grab. The body now keeps to its own stone and the tongues do
    // all the travelling.
    const base = 1.72 + 0.10 * Math.sin(t * 9);

    // THE COLLAPSE. One ring of standing water that leaves the outside of the
    // reach and runs to the throat, accelerating. Height is the only inward
    // cue on this table with a silhouette, and a ring that travels at one rate
    // is a ripple played backwards; one that speeds up as it closes is water
    // going down a hole.
    const fallIn = clamp01((t - 0.10) / 0.68);
    // It starts INSIDE the body of water, not out at the tips of the tongues.
    // Run from 3.05 it spent most of its life beyond the base circle, where
    // the paint's own cover fade cut it off — and a gaussian ring sliced by a
    // soft circle is a hard bright CRESCENT sitting on one side of the square,
    // which is what the first cut photographed as.
    const surgeR = 2.70 - 2.25 * easeIn(fallIn);
    const surgeAmp = fallIn > 0 && fallIn < 1
      // It piles up as it crowds inward: the same water round a shorter ring
      // has to go somewhere, and it is the last thing seen before the throat
      // takes it.
      ? 0.34 * (0.55 + 0.45 * fallIn) * smooth((1 - fallIn) / 0.18)
      : 0;

    // The arms wind in and speed up with the ring. `spin` only ever increases
    // — a whirlpool that slows down has stopped being one.
    const spin = 4.4 * t + 9.0 * easeIn(clamp01(t / 0.8)) * t;
    // The mouth: open while the tongues are out, shut as they come back.
    // The mouth: open while the tongues are out, shut as they come back. Kept
    // well under the collar's own radius — at 0.98 the eye reached past the
    // card lying in it and swallowed the inner half of the collar with it, and
    // what was left was a white ring round a black disc.
    const throat = 0.34 + 0.42 * smooth(t / GRAB) * (1 - smooth((t - HAUL) / 0.22))
      - 0.26 * smooth((t - HAUL) / 0.24);
    const alpha = smooth(t / 0.07) * (1 - smooth((t - 0.84) / 0.16));

    // Per-angle reach. `cover` in paintWhirl is one number, so the tongues are
    // fed in through the ragged-rim table the sheet already multiplies by —
    // which is also what keeps them ragged, and a tongue of water with a clean
    // edge is a UI arrow.
    // 0.72 is set by the MESH, not by taste: the sheet only exists out to
    // R_MAX, and a tongue driven past it is sliced off against a perfect
    // circle. At the base radius and full reach this puts the tips at about
    // 3.0, which is a third of a unit inside the rim and a little past the
    // centre of the neighbouring square — as far as the card's reach goes.
    for (let j = 0; j < s.EDGE.length; j++) {
      s.EDGE[j] = s.RIM[j] * (1 + (0.86 * LOBE[j] - 0.10) * reach);
    }

    paintWhirl(s, {
      cover: base,
      rim: 1.12 + 0.24 * (1 - reach),
      // Higher. The collar's own silhouette is the only part of this with any
      // height in it, and height is the one thing a camera pitched 52 degrees
      // can read as water standing up rather than a pattern lying flat.
      amp: 0.52 + 0.24 * reach,
      spin,
      throat: Math.max(0.18, throat),
      chop: 0.06,
      // Foam down by a third. At 0.55-0.90 the arms were broad soft white
      // streaks over most of three squares and the thing read as steam. The
      // contrast here is bought with the DARK water, not with more white —
      // the tone curve turns stacked pale into a slab and takes a third of
      // the green out of teal on the way, so every pale value spent here is
      // spent twice.
      foam: 0.37 + 0.24 * reach,
      surgeR,
      surgeAmp,
      alpha,
    });

    /* ---- the victim ---- */

    // Hauled toward the middle and tipped over on the way. `animating` is set
    // every tick and not once: the board's own tweens clear the flag when they
    // end, and a card whose flag was cleared mid-haul snapped back to its
    // square with the water still over it — the bug ./tide.js paid for.
    //
    // It is a LEAN and not a move. The rules do not relocate the attacker, and
    // a card that slid a whole square and then teleported home would be
    // telling the player a lie about the board.
    const drag = smooth(t / GRAB) * (1 - smooth((t - HAUL + 0.08) / 0.30));
    for (const v of prey) {
      const piece = v.piece;
      if (!piece.group?.parent) continue;
      piece.animating = true;
      // Toward the whirlpool, which is at -th from the victim's side.
      // THE CARD IS THE CUE. Every painted contour on this sheet is worth
      // less than an enemy card visibly sliding off its own square, so the
      // haul is as far as the picture can stand: 0.62 is a third of a square
      // and still plainly leaves the card over its own stone.
      const pull = 0.62 * drag;
      piece.group.position.set(
        v.home.x - Math.cos(v.th) * pull,
        // Down, not up. Dragged INTO water is the one thing this card does,
        // and 0.05 is a pixel and a half at this camera — small, but it is
        // the difference between leaning and hovering.
        v.home.y - 0.05 * drag,
        v.home.z - Math.sin(v.th) * pull,
      );
      // Tipped toward the hole. Held under 0.3rad: past that a flat card
      // standing on edge in a sixty-pixel square stops reading as a card.
      const tip = 0.34 * drag;
      piece.group.rotation.z = Math.cos(v.th) * tip;
      piece.group.rotation.x = -Math.sin(v.th) * tip;
      v.held = piece.group.position.clone();
    }
  }, () => {
    for (const v of prey) {
      const piece = v.piece;
      // Only if it is still where this left it. Maelstrom kills — that is the
      // point of the card — and the board's own destroy tween starts on top of
      // this one; restoring blind would yank a drowning card back onto its
      // square mid-fall to the discard pile.
      if (!v.held || piece.group.position.distanceTo(v.held) > 1e-4) continue;
      piece.group.position.copy(v.home);
      piece.group.rotation.set(0, 0, 0);
      piece.animating = false;
    }
  });

  // One short cold pulse at the throat, under the card that is lying in it, so
  // the stone around the square is lit from the hole for a moment. Low power:
  // a bright cool lamp over this faction's own blue-green art kills every edge
  // in it, which is the lesson ./cast-marvorren.js paid for.
  kit.light(new THREE.Vector3(centre.x, 0.45, centre.z), 0x86c8dc,
    { power: 3.4, seconds: SPAN * 0.7, reach: 4.6 });
}

// The cards this kills have to stay put until the haul has finished, or the
// victim is dead and gone before the water has touched it.
export const timing = { kill: SPAN * HAUL };
