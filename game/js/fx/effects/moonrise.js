// THE MOON COMES DOWN AND THE SEA OPENS — Charybdis arriving.
//
// Shared by 1 card: M046C Charybdis, the turned face of M046 New Moon. One
// motif, one file — worked on on its own.
//
// THIS IS THE PAYOFF OF FOUR TURNS. ./moonphase.js has fired four times beside
// the Stronghold, each one a little nearer, and on the fourth the moon is full
// and the water is running at the board. This is what it was running toward,
// so it is the biggest thing on this table and it is allowed the time: the
// moon leaves its plinth, comes down over the square, turns over on the way,
// and goes INTO the stone — and where it went in, the sea opens.
//
// THE MOON IS THE CARD. New Moon is never drawn by the table (it lives in
// `state.beside`, which pieces.js never sees), so the moon sprite ./moonphase
// paints is the only object that has ever stood for it. It has to be the SAME
// moon — same texture function, same plinth — or the four turns of waiting
// have nothing to hand over to. It is imported rather than redrawn for exactly
// that reason. The Charybdis card itself arrives on the table's own deploy
// animation; nothing here draws a card.
//
// IT MUST NOT BE A SECOND VOID. There is already a vortex on this table, out
// to the left (see `VoidPit` in js/board.js): a flat painted BLACK hole with
// additive spiral arms and a collar of broken masonry. Four things keep this
// one apart, and every one of them was chosen against that reference:
//   - it is WATER, so the body is deep blue-green and the arms are FOAM, and
//     the foam is not additive (the ACES curve turns stacked additive halos
//     white, and takes a third of the green out of teal on the way);
//   - it has HEIGHT. The Void is flat. A standing collar of water rises around
//     the square, breaks the square's own silhouette and stands proud of the
//     card lying in the middle of it, which no painted hole can do;
//   - it SPILLS. The Void's edge is a hard lip of stone; this one runs out
//     past its square into the joints and dies there, ragged;
//   - the arms run INWARD on a log spiral and tighten, where the Void's arms
//     just rotate.
//
// WHAT THE CARD COVERS. A card is 1.74 by 1.76 and sits at y~0.21, the water
// at 0.145 — so the card FLOATS on it, and everything inside r=0.9 is hidden
// under the card for the rest of the game. So the picture is built as an
// ANNULUS: the collar, the rim foam and the working part of the arms all live
// between 0.9 and 2.2, and the black eye is only ever glimpsed in the moment
// before the card lands in it.
//
// THE GROUND IS OPAQUE AND UNBROKEN, so there is no down. A real funnel would
// need geometry below y=0, which is invisible — the same wall the Void hit,
// and why it had to be rebuilt as a painted hole. The bowl here is bought the
// same way: a black eye, a ring of real raised water around it, and the slope
// shade between them.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=900" \
//             --eval tools/fxdemo/moonrise.js --out /tmp/mr.png \
//             --wait 9000 --settle 900
// ?t is milliseconds INTO the motif, ?sq is the square it lands on and ?card=0
// drops the Charybdis card so the eye can be seen (see the harness).

import { THREE } from '../kit.js';
import { squareToWorld } from '../../board.js';
import { blobTexture } from '../../textures.js';
import { moonTexture, besidePosition } from './moonphase.js';

/* ------------------------------------------------------- the whirlpool */

// Exported, because ./maelstrom.js paints the SAME water. Two files drawing
// their own whirlpool drift apart in a week — one gets a new foam scale, the
// other does not — and the player has to recognise the thing on the board as
// the thing that opened. So the paint lives here, where it is born, and the
// other motif turns the dials.

// Polar, because a vortex is. The grid is the usual trade: NA is set by the
// FOAM, whose bands are about 0.12 across and which a mesh can only draw where
// it has vertices, and at the rim an arc step of 144 is 0.146. Inside r=1 the
// cells are finer than they need to be and that costs nothing worth saving.
//
// R_MAX is 3.35 and not the 2.9 it started at because ./maelstrom.js reaches
// FURTHER than this motif floods: its tongues run out over the neighbouring
// squares, and at 2.9 they were cut off dead against the edge of the mesh —
// four reaching arms ending on a clean circle, which is the one shape a sheet
// of water must never have.
export const NR = 52, NA = 144, R_MAX = 3.35;

// The card art: a near-black throat, deep blue-green water, and one ring of
// real GREEN where the water piles up — the only green in the faction's five
// motifs, and the thing that says Charybdis rather than "more Marvorren
// water". Foam is the only bright colour, as everywhere else in this faction.
export const ABYSS = new THREE.Color(0x01070d);
export const DEEP = new THREE.Color(0x031825);
export const MID = new THREE.Color(0x11667e);
export const SEA = new THREE.Color(0x2fa39a);
export const FOAM = new THREE.Color(0xe9fbff);

// Three arms on a log spiral. Two read as an S drawn on the stone and five are
// a rosette; three is what the card art has.
//
// PITCH is 14 and not the 6.5 it started at, and the reason is the log. The
// arm's phase carries k*log(r+0.3), so its RADIAL RATE is k/(r+0.3) — the
// bands get wider the further out they are, and at 6.5 an arm at r=2 was two
// and a half units across. Raised to a power to make a line out of it, that is
// a band seven tenths of a unit wide, and the whirlpool came back as a ring of
// WHIPPED CREAM a square across with no dark water anywhere in it. At 10, with
// the ^12 the streak is raised to below, the band is about 0.23 at the collar
// and the arms wrap a turn and a third across the visible annulus. 14 was
// tried first and wrapped two and a half times, which at this size is not a
// spiral any more, it is corduroy.
const ARMS = 3, PITCH = 10;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// exp(-x*x), tabled. The collar, the surge ring, the rim foam and the caustics
// each want one per vertex, and four exps over seven thousand vertices is a
// third of the tick on its own. Past |x|=4 it is 1e-7.
const BELL = new Float32Array(1024);
for (let i = 0; i < BELL.length; i++) {
  const x = (4 * i) / (BELL.length - 1);
  BELL[i] = Math.exp(-x * x);
}
const BELL_K = (BELL.length - 1) / 4;
function bell(x) {
  const a = (x < 0 ? -x : x) * BELL_K;
  if (a >= BELL.length - 1) return 0;
  const i = a | 0;
  return BELL[i] + (BELL[i + 1] - BELL[i]) * (a - i);
}

/**
 * One spiral wave over the polar sheet, held as four small tables.
 *
 * Every pattern here is sin(m*theta + k*q + phase) with q = log(r+0.3), and
 * evaluating those straight is a dozen sines a vertex — which tide.js measured
 * at 2.1ms a tick over a grid this size. sin(A+B) = sinA cosB + cosA sinB, so
 * a table per ANGLE and a table per RING answer any vertex in two multiplies,
 * and the cosine falls out of the same four numbers for free, which is what
 * the chop's slope is computed from.
 *
 * The angle tables never change; the ring tables are rebuilt once a tick.
 */
function spiral(m, k, TH, Q) {
  const sa = new Float32Array(NA), ca = new Float32Array(NA);
  const sq = new Float32Array(NR), cq = new Float32Array(NR);
  for (let j = 0; j < NA; j++) { sa[j] = Math.sin(m * TH[j]); ca[j] = Math.cos(m * TH[j]); }
  const phase = (ph) => {
    for (let i = 0; i < NR; i++) {
      const b = k * Q[i] + ph;
      sq[i] = Math.sin(b); cq[i] = Math.cos(b);
    }
  };
  phase(0);
  return {
    phase,
    at: (i, j) => sa[j] * cq[i] + ca[j] * sq[i],
    cos: (i, j) => ca[j] * cq[i] - sa[j] * sq[i],
  };
}

/**
 * The sheet the whirlpool is painted on, and everything about it that never
 * changes. Held per cast and not per module, so two whirlpools on the table at
 * once cannot share their scratch.
 */
export function whirlSheet(seed = 1) {
  const R = new Float32Array(NR), Q = new Float32Array(NR);
  const TH = new Float32Array(NA), COS = new Float32Array(NA), SIN = new Float32Array(NA);
  for (let i = 0; i < NR; i++) {
    R[i] = (R_MAX * i) / (NR - 1);
    // +0.30 keeps the log finite at the middle and, more usefully, stops the
    // arms winding infinitely tight there: at +0.02 the eye was a solid disc
    // of moire where the pattern was finer than the mesh.
    Q[i] = Math.log(R[i] + 0.30);
  }
  for (let j = 0; j < NA; j++) {
    TH[j] = (2 * Math.PI * j) / NA;
    COS[j] = Math.cos(TH[j]); SIN[j] = Math.sin(TH[j]);
  }

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NR * NA * 3);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NA; j++) {
      const n = (i * NA + j) * 3;
      pos[n] = R[i] * COS[j];
      pos[n + 2] = R[i] * SIN[j];
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NR * NA * 4), 4));
  const idx = [];
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NA; j++) {
      // The ring WRAPS. Stopping at NA-1 leaves a one-cell wedge missing, and
      // a pie slice cut out of a whirlpool is the first thing the eye finds.
      const j2 = (j + 1) % NA;
      const a = i * NA + j, b = i * NA + j2;
      idx.push(a, b, a + NA, b, b + NA, a + NA);
    }
  }
  geo.setIndex(idx);

  // Unlit, like every water sheet in this faction: the key light is a warm low
  // sun and a teal surface under it goes grey-green. Every colour below is
  // placed by hand in the vertex attribute and the form is carried by slope.
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;

  // The ragged rim, fixed per cast. A circle of water with a clean edge is a
  // painted UI disc on the flagstone, which is the one thing this must not be.
  //
  // RIM is the shape itself and never changes; EDGE is what the paint reads
  // and a motif may rewrite it every tick — ./maelstrom.js drives its four
  // tongues through it. They are separate arrays because modulating one in
  // place compounds: a reach of 1.35 applied to last tick's answer runs away
  // to a sheet twenty units across inside half a second.
  const RIM = new Float32Array(NA);
  const EDGE = new Float32Array(NA);
  const RAG = new Float32Array(NA);
  for (let j = 0; j < NA; j++) {
    const a = TH[j] + seed;
    RIM[j] = 1 + 0.085 * Math.sin(a * 3 + 0.6) + 0.06 * Math.sin(a * 5 - 1.4)
      + 0.035 * Math.sin(a * 9 + 2.2);
    EDGE[j] = RIM[j];
    // Clipped at zero, so the rim foam actually STOPS in places. As a smooth
    // 0..1 wobble it only ever got dimmer and the ring never broke.
    RAG[j] = Math.max(0, 0.42 + 0.42 * Math.sin(a * 11 + 1.1)
      + 0.34 * Math.sin(a * 4.5 - 2.3));
  }

  return {
    mesh,
    geo,
    R,
    TH,
    RIM,
    EDGE,
    RAG,
    pos,
    col: geo.attributes.color.array,
    // The arm the foam rides, the cross wave that breaks it, and the caustic
    // net. All three are spirals so everything on this surface turns together;
    // a straight cross wave over a vortex is a grid laid on a spinning thing.
    arm: spiral(ARMS, PITCH, TH, Q),
    brk: spiral(7, -3.1, TH, Q),
    net: spiral(11, 14.0, TH, Q),
    c: new THREE.Color(),
  };
}

/**
 * The whirlpool, painted, for whatever the dials say.
 *
 * `o` is the whole of the motif's state: how far the water has spread
 * (`cover`), where the standing collar is and how high (`rim`, `amp`), how far
 * the arms have turned (`spin`), how wide the black eye is (`throat`), how
 * hard the water is being drawn in (`pull`), an outward burst ring
 * (`surgeR`/`surgeAmp`) and an overall `alpha`.
 */
export function paintWhirl(s, o) {
  const { R, EDGE, RAG, pos, col, c } = s;
  s.arm.phase(o.spin);
  s.brk.phase(-o.spin * 0.7);
  s.net.phase(o.spin * 1.9);

  // Per-ring scratch. The collar, the surge and the throat depend only on r,
  // and computing them per vertex is 144 bells for one bell's worth of answer.
  const H = new Float32Array(NR);
  const DH = new Float32Array(NR);
  const EYE = new Float32Array(NR);
  const LIVE = new Float32Array(NR);
  for (let i = 0; i < NR; i++) {
    const r = R[i];
    const d = (r - o.rim) / 0.42;
    const collar = o.amp * bell(d);
    // The derivative of amp*exp(-(d/s)^2), which is what the slope shade is.
    // Taken as a finite difference it cost two more bells a ring for a number
    // that is one multiply away from the one already in hand.
    let dh = collar * (-2 * d) / 0.42;
    let h = collar;
    if (o.surgeAmp > 0) {
      const e = (r - o.surgeR) / 0.30;
      const surge = o.surgeAmp * bell(e);
      h += surge;
      dh += surge * (-2 * e) / 0.30;
    }
    // Flat inside the eye. Water piled up in the middle of a whirlpool is a
    // dome, which is the opposite thing.
    const live = smooth((r - o.throat) / 0.55);
    LIVE[i] = live;
    H[i] = h * live;
    DH[i] = dh * live;
    // The eye is only the THROAT, with a soft inner edge. It ran out to
    // throat+0.45 with 0.9 of falloff in the first cut, which at the dials
    // this motif hands it painted the entire square flat black: a hole in the
    // flagstone with a thin ring of water round the outside, which is the
    // Void, which is the one thing this must not be.
    EYE[i] = smooth((o.throat - r) / 0.45);
  }

  for (let i = 0; i < NR; i++) {
    const r = R[i];
    const live = LIVE[i];
    const eye = EYE[i];
    // The chop gets shorter as the water is drawn in — a surface being pulled
    // has its ripples crowded together, and it is the cheapest cue there is
    // that the middle is going somewhere.
    const chop = o.chop * (0.5 + 0.5 * live);
    for (let j = 0; j < NA; j++) {
      const n = (i * NA + j) * 3;
      const n4 = (i * NA + j) * 4;
      // Water out to `cover`, with a ragged edge and a soft one: a hard rim
      // is a decal, and the joints between flagstones are where it should die.
      const cover = smooth((o.cover * EDGE[j] - r) / 0.55);
      if (cover <= 0.003) { pos[n + 1] = 0; col[n4 + 3] = 0; continue; }

      const a = s.arm.at(i, j);
      const ac = s.arm.cos(i, j);
      const b = s.brk.at(i, j);

      // Height: the collar, plus chop riding the arms so the surface turns
      // with them. d/dr of the chop comes off the same cosine — the arm's
      // phase carries k*log(r+0.3), so its radial rate is k/(r+0.3).
      const h = H[i] + chop * a * cover;
      pos[n + 1] = h * o.alpha;
      const slope = (DH[i] + chop * ac * (PITCH / (r + 0.30)) * cover) * 0.85;

      // Deep water, going to mid only where it piles up, and to the card's
      // green only on the very TOP of the collar. ^2.6 and not ^2: the collar
      // is a gaussian ring most of a unit wide, so `up` is near 1 across the
      // whole of it, and at any gentler curve the entire ring came out
      // mid-teal-green — a plastic paddling pool sitting on the flagstone,
      // which is what the first two passes photographed as. Deep water is
      // nearly black; only the last of the height has any colour in it, and
      // the foam is the only bright thing anywhere here.
      const up = clamp01(h / Math.max(0.08, o.amp));
      c.copy(DEEP).lerp(MID, up ** 2.6);
      c.lerp(SEA, clamp01((up - 0.82) * 4.0) * 0.55 * o.foam);

      // THE ARMS. Foam torn into spiral streaks, brightest where the water is
      // being drawn in hardest. ^6, because a plain sine is three fat painted
      // bands — what a caustic and a foam streak have in common is that they
      // are LINES.
      // The break has almost no floor. At 0.35 the arms never actually broke
      // — every one of them ran the whole way round at better than a third
      // brightness, which is a smooth painted spiral, not torn water.
      const streak = (a > 0 ? a ** 12 : 0) * (0.1 + 0.9 * clamp01(b + 0.15))
        * live * cover;
      // The rim: white water piling against the outside of the collar, ragged
      // along its length so it is not a drawn ring.
      // 0.15 and not 0.24: at 0.24 the rim was a half-unit band of soft white
      // all the way round, a piped edge on a cake rather than water piling up.
      const lip = bell((r - o.rim - 0.12) / 0.15) * RAG[j] * cover;
      // The caustic net, which is the one underwater cue that survives a
      // camera this steep. Contours of a fine spiral, not a product of sines:
      // a product tiles a regular lattice of round dots, and polka dots on the
      // flagstone are the first thing the eye finds.
      const caustic = bell(s.net.at(i, j) * 3.4) * cover * live * (1 - up * 0.6);
      c.lerp(SEA, Math.min(1, caustic * 0.30));

      // 0.85, measured off the frame rather than reasoned: at 1.0 with o.foam
      // near its ceiling the ridge of every arm was 80% white, and there are
      // three arms wrapping a turn and a third, so most of the square was
      // white. Foam is the only bright thing here and it still has to be a
      // minority of the picture.
      const foam = Math.min(1.0, (streak * 0.85 + lip * 0.65) * o.foam);
      c.lerp(FOAM, Math.min(1, foam));

      // THE EYE. Painted, not dug: the ground is an opaque unbroken plane and
      // anything below it is invisible, which is the wall the Void hit before
      // it was rebuilt as a hole with a picture in it. Black last, so it takes
      // the foam down with it — foam does not survive in the throat.
      c.lerp(ABYSS, Math.min(1, eye * 0.95));

      // The ceiling is 0.42 and not the 0.7 it started at: on the inner face
      // of a collar this steep the term ran to one and a half, which on a
      // colour that was already foam-white went past 1.0 in all three channels
      // and the ACES curve finished it — the whole inner wall came back a
      // blown white slab with no streaks left in it.
      const shade = 0.78 + Math.max(-0.45, Math.min(0.42, slope)) + caustic * 0.26;
      col[n4] = c.r * shade; col[n4 + 1] = c.g * shade; col[n4 + 2] = c.b * shade;
      // Foam gets its own share of the alpha on top of the water's: it is the
      // one part of this that is not see-through, and on the shared weight the
      // collar was a pale film with the flagstone showing through it.
      col[n4 + 3] = Math.min(1, o.alpha
        * (cover * (0.74 + 0.2 * up) + foam * 0.7 + eye * 0.5));
    }
  }
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.color.needsUpdate = true;
}

/* ------------------------------------------------------------ the motif */

/**
 * THE CROWN — the white water thrown off the moment the moon goes in.
 *
 * This was `kit.sparks`, and kit.sparks starts every sprite at ONE POINT.
 * Twenty-six additive sprites stacked on the same pixel is the exact trap the
 * tone curve is worst at, and it went off at the exact moment this motif
 * exists for: photographed 76ms after the impact, the square was a blank
 * WHITE PILL — no moon, no water, no crown, nothing to look at at all. That
 * one frame is most of why the payoff of four turns read as dumb.
 *
 * So these start spread round a RING the size of the throat and throw
 * outward, which is what a crown of water is; they are small enough that two
 * overlapping is still water rather than a lamp; and they are seeded off the
 * square so two casts are not the same splash.
 */
function crown(kit, centre, seed) {
  const tex = blobTexture('rgba(232,248,255,0.95)', 'rgba(150,205,225,0)');
  const grp = new THREE.Group();
  const N = 20;
  const from = [];
  const vel = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.sin(i * 12.9898 + seed) * 0.16;
    // On the rim of the throat, not in the middle of it. The card lands here
    // a moment later and anything that started under it was never seen.
    const r = 0.62 + 0.22 * ((Math.sin(i * 78.233 + seed) + 1) % 1);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // 0.30 down to 0.17 across the ring. An even size is a string of beads;
    // uneven is spray.
    sp.scale.setScalar(0.36 - 0.17 * ((Math.sin(i * 43.11 + seed) + 1) % 1));
    from.push(new THREE.Vector3(centre.x + Math.cos(a) * r, 0.20, centre.z + Math.sin(a) * r));
    // OUT and UP, and more up than out: a crown stands, a shockwave lies down,
    // and at a fixed camera elevation the standing one is the only one with a
    // silhouette.
    const out = 1.5 + 0.9 * ((Math.sin(i * 91.7 + seed) + 1) % 1);
    vel.push(new THREE.Vector3(Math.cos(a) * out, 2.5 + 1.1 * ((Math.sin(i * 17.3 + seed) + 1) % 1),
      Math.sin(a) * out));
    grp.add(sp);
  }
  // NOT kit.hold. kit.hold traverses what it is given and disposes every
  // `geometry` it finds, and a Sprite's geometry is a MODULE-LEVEL SINGLETON
  // shared by every sprite in the scene — the same thing that took the torch
  // glows down when ./moonphase.js first tried it. Materials and the one map
  // are all this owns, so it takes them down itself.
  kit.scene.add(grp);
  kit.anim.add(0.62, (t) => {
    for (let i = 0; i < N; i++) {
      const sp = grp.children[i];
      // A real arc: out to about a square across and up over the collar
      // before it falls back. At 0.42 with 2.6 of gravity every drop was
      // already below where it started by a third of its life — a crown that
      // goes straight down is a puddle.
      sp.position.copy(from[i]).addScaledVector(vel[i], t * 0.55);
      sp.position.y -= t * t * 1.15;
      // Out fast. Spray that lingers is fog, and this has to be gone before
      // the sea underneath it has anything left to lose.
      sp.material.opacity = (1 - t) ** 1.6;
      sp.scale.multiplyScalar(0.985);
    }
  }, () => {
    kit.scene.remove(grp);
    for (const sp of grp.children) sp.material.dispose();
    tex.dispose();
  });
}

// Long, and it has earned it: this happens once in a game, at the end of four
// turns of counting. kit.hold hands the tick a FRACTION of the span, so every
// moment below is a fraction and SPAN is the only number in time.
const SPAN = 1.9;
// The fall was 0.40 of the span — three quarters of a second of a fifty-pixel
// sprite sliding over dark dirt, which is not what four turns of waiting were
// counting toward. It is the APPROACH; the sea is the payoff, so it is short.
const FALL = 0.30;        // the moon reaches the square
const OPEN = 0.28;        // the water starts, on the impact and not after it
const FLOOD = 0.16;       // ...and takes this long to fill its square
const SETTLE = 0.78;      // the collar stops rising and begins to turn instead

// Where the flat water lies. The flagstone face is at 0.080 and the depth
// buffer cannot separate a centimetre at this camera — 0.095 was tried on
// ./moonphase's lane and the far half of it was still eaten by the stone. 65mm
// of clearance, 1.7 pixels of lift, and still well under a card face at ~0.21
// so the card FLOATS on this rather than being drawn under it.
const WATER_Y = 0.145;

/** Which end of the table this square belongs to. Charybdis is only ever put
 *  in its owner's Back Row, so the row answers it. */
const playerOf = (square) => (square >= 6 ? 1 : 0);

export function moonrise(kit, at) {
  // A SQUARE, or a card standing on one. The rules send a square index
  // (`ops.fx(state, 'moonrise', { at: spot, player: p })`) but the fx bench —
  // and every other table motif — sends a card UID, which is also a number.
  // `typeof at === 'number' ? at : 0` therefore read uid 44 as square 44, and
  // squareToWorld put the sea thirty-four units off the back of the board
  // while the moon slid away into the dark after it. Ask the pieces first.
  const piece = kit.piece?.(at);
  const square = (piece && piece.square != null && piece.square < 9) ? piece.square
    : (typeof at === 'number' && at >= 0 && at < 9 ? at : 0);
  const centre = squareToWorld(square);
  const player = playerOf(square);
  const home = besidePosition(player);

  const g = new THREE.Group();
  g.position.set(centre.x, WATER_Y, centre.z);

  const s = whirlSheet(square * 1.7);
  g.add(s.mesh);

  /* ---- the moon, leaving its plinth ---- */

  // The same moon ./moonphase has been turning for four turns, full, because
  // the fourth rotation is what turned the card over. A Sprite for the same
  // reason it is one there: the camera's elevation is fixed, and a disc laid
  // in the world is seen at 46 degrees and reads as an ellipse.
  const moonMat = new THREE.SpriteMaterial({
    map: moonTexture(1), transparent: true, depthWrite: false,
  });
  const moon = new THREE.Sprite(moonMat);
  // Higher and half again as big as the one ./moonphase turns beside the
  // Stronghold. That moon is a marker counting turns and is meant to be
  // small; this one is the payoff, and at 1.66 on a board this dark it came
  // down as a forty-pixel speckled pellet — a golf ball sliding over dirt.
  moon.position.copy(home).setY(3.15);
  moon.scale.setScalar(2.32);
  // AFTER the halo. Both sit at the same point, the transparent pass sorted
  // them by whim, and when the halo won it added a fifth of white to every
  // pixel of the moon's face — which the ACES curve finished off into a blank
  // pearl. Same fix, same reason, as in ./moonphase.js.
  moon.renderOrder = 3;
  kit.scene.add(moon);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobTexture('rgba(226,240,220,0.9)', 'rgba(150,190,200,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  halo.renderOrder = 2;
  halo.position.copy(moon.position);
  kit.scene.add(halo);

  // THE WAKE. A dark wet stain that TRAVELS UNDER THE MOON and then settles
  // on the square. Two things were wrong without it. The stone knew nothing
  // until the water arrived, so the sea appeared on dry lit flagstone as a
  // blue decal; and the fall itself was a fifty-pixel disc sliding across the
  // picture with nothing happening underneath it — which is not the payoff of
  // four turns, it is a token being moved. Dragged along, it also picks up
  // where ./moonphase's fourth firing left off: that one sent a swell out of
  // the pool toward the board and did not finish it, and this is the water
  // arriving.
  //
  // In its own yawed group because it is ELONGATED along the line of travel,
  // and a plate laid flat has no way to be turned to face down a bearing —
  // its local axes are already spent on lying down.
  const wake = new THREE.Group();
  wake.rotation.y = Math.atan2(-(centre.z - home.z), centre.x - home.x);
  const stain = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({
      map: blobTexture('rgba(3,10,16,0.95)', 'rgba(3,10,16,0)'),
      transparent: true, depthWrite: false, opacity: 0,
    }),
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = WATER_Y - 0.03;
  wake.add(stain);
  g.add(wake);

  // Cold light riding down with it, so the stone the moon passes over knows it
  // is there. Low power on purpose: a bright cool lamp over Marvorren's own
  // blue-green art kills every edge in it, which is the lesson
  // ./cast-marvorren.js paid for. Held in the group so it goes when it goes.
  const lamp = new THREE.PointLight(0x9fd0e4, 0, 6.5, 2);
  g.add(lamp);

  let splashed = false;

  kit.hold(g, SPAN, (t) => {
    /* ---- the fall ---- */

    // Slow away from the plinth and fast into the stone: a moon that travels
    // at one rate is a token being moved by a rules engine.
    const fall = clamp01(t / FALL) ** 2.1;
    moon.position.x = home.x + (centre.x - home.x) * fall;
    moon.position.z = home.z + (centre.z - home.z) * fall;
    // It comes down over the top of an arc rather than in a straight line, so
    // the descent is read against the board instead of against the sky.
    // 1.45 of arc and not 0.55. Height is the only part of a fall this
    // camera can see — it is pitched 52 degrees, so a world unit of height is
    // ~26 pixels and a world unit across the board is ~34 — and at 0.55 the
    // moon crossed almost level and read as a token being slid, not dropped.
    moon.position.y = 3.15 + 1.45 * Math.sin(Math.PI * clamp01(t / FALL))
      - 2.70 * fall;
    // Shrinking as it comes: perspective would do a little of this, but the
    // camera is far enough off that a sprite crossing four units barely
    // changes size, and the moon has to look like it is going AWAY into the
    // stone and not sliding across the picture.
    // ^1.7, so it holds its size for most of the crossing and then goes in a
    // hurry. On a linear shrink it was a small pale pellet for three quarters
    // of the fall, which is the half of the motif the player spends waiting.
    // ...and it goes INTO the stone. It used to stop shrinking at 0.66 and
    // then fade, so the last thing seen of the moon was a pellet switching
    // off. Driven to 0.15 the shrink itself is the entry and the fade has
    // almost nothing left to hide.
    const size = 2.32 - 2.17 * fall ** 1.7;
    moon.scale.setScalar(Math.max(0.05, size));
    // TURNING OVER. It keeps the quarter-turn beat ./moonphase set up and then
    // runs away with it — four rotations were the count, and this is the card
    // going over, so the last turn is the one that does not stop.
    moonMat.rotation = -Math.PI * 2 - fall * fall * Math.PI * 3.4;
    moonMat.opacity = t < FALL ? 1 - smooth((t - FALL * 0.93) / (FALL * 0.08)) : 0;
    halo.position.copy(moon.position);
    halo.scale.setScalar(Math.max(0.1, size * 2.6));
    // The halo grows as the moon shrinks, so what goes into the stone is a
    // point of light rather than a disappearing ball. Additive, so it stays
    // under a half: two of these summed is white and there is a lamp riding
    // down with it already.
    halo.material.opacity = moonMat.opacity * (0.12 + 0.30 * fall);

    // The wake, under the moon and a little behind it, settling onto the
    // square as the moon goes in.
    const lag = Math.max(0, fall - 0.12);
    wake.position.set(
      (home.x - centre.x) * (1 - lag),
      0,
      (home.z - centre.z) * (1 - lag),
    );
    lamp.position.set(moon.position.x - centre.x, 0.9, moon.position.z - centre.z);
    // Out before the impact, not after it: the travelling lamp was still at
    // full power a tenth of a second past the splash, on top of the impact
    // flash, and together they blew the square out.
    lamp.intensity = 5.0 * smooth(t / 0.06) * (1 - smooth((t - FALL * 0.86) / 0.10));

    /* ---- the impact ---- */

    if (!splashed && t >= FALL * 0.92) {
      splashed = true;
      // Cold light, low power and short. A bright cool lamp over Marvorren's
      // own blue-green art kills every edge in it — the lesson
      // ./cast-marvorren.js paid for — so this is a flash that is gone before
      // the water has anything to lose.
      // 6 and not the 16 this started at. At 16 the flash washed the square
      // and both its neighbours pale white for a third of a second — a cool
      // lamp over this faction's own blue-green art kills every edge in it,
      // and there was nothing left of the water it had just opened.
      kit.light(new THREE.Vector3(centre.x, 0.7, centre.z), 0x9fdcea,
        { power: 6, seconds: 0.4, reach: 5.5 });
      // The crown of white water. See `crown` above for why this is not
      // kit.sparks any more — in one word, because kit.sparks starts all of
      // them on the same pixel and this frame came out blank white.
      crown(kit, centre, square * 3.7);
    }

    /* ---- the sea ---- */

    // The flood is FAST. Spread over the whole span it left the square as a
    // thin ring of water round a black disc for most of the motif — the eye
    // arrives before the sea does and the thing reads as a hole. Water first,
    // throat afterwards.
    const open = clamp01((t - OPEN) / FLOOD);
    // It loses way as it spreads, the way water running over flat stone does.
    // Linear is a wipe.
    // ...and then draws back. At the flood's full spread it stood over the
    // neighbouring squares' stone, and a whirlpool that covers three squares
    // is telling the player something the rules do not say.
    // 2.35 and not 2.65. At full spread the water stood a third of the way
    // over BOTH neighbouring squares and over the dark apron beyond the
    // board, which is three squares of sea for a card that occupies one.
    const cover = 2.35 * open ** 0.5 - 0.55 * smooth((t - SETTLE) / 0.3);
    // The burst ring: one crest that leaves the middle at the impact and runs
    // out past the square's own stone before it dies. This is the moment the
    // motif is biggest, and it lasts about a fifth of a second.
    const burst = clamp01((t - FALL * 0.92) / 0.34);
    const surgeAmp = burst > 0 && burst < 1 ? 0.62 * (1 - burst) ** 1.4 : 0;
    // The collar settles as the burst leaves, so the water is never simply
    // switched on at its resting height.
    const amp = 0.62 * smooth((t - OPEN) / 0.18) * (1 - 0.45 * smooth((t - SETTLE) / 0.3));
    // It winds up and keeps winding: the whirlpool is still turning when this
    // ends, because it does not stop for the rest of the game.
    const spin = 5.2 * t + 6.5 * smooth((t - OPEN) / 0.5) * t;
    // The eye closes in as the spin takes hold — an open mouth narrowing to a
    // throat, which is the shape on the card.
    // The eye closes in behind the flood, never ahead of it: it starts as a
    // wide dark mouth about the size of the card that is about to land in it
    // and tightens to a throat.
    // ...and it can never be wider than the water it is a hole in. Left to
    // its own curve it was 1.02 while the flood was still only 0.9 across, so
    // every vertex that existed was inside the eye and the first third of a
    // second of the sea was a small BLACK SWIRL on the flagstone — the Void,
    // arriving exactly where this motif must not go.
    const throat = Math.min(cover * 0.42,
      1.02 - 0.44 * smooth((t - OPEN - 0.06) / 0.42));
    const alpha = smooth((t - OPEN) / 0.07) * (1 - smooth((t - 0.90) / 0.10));

    stain.material.opacity = 0.78 * smooth(t / 0.22) * (1 - smooth((t - 0.88) / 0.12));
    // Long and narrow while it is being dragged, round once it has arrived:
    // a wake has a direction and a pool does not.
    const drag = 1 - smooth(fall);
    stain.scale.set(
      (0.34 + 0.30 * open) * (1 + 1.5 * drag),
      (0.30 + 0.30 * open) * (1 - 0.45 * drag),
      1,
    );

    if (alpha > 0.004) {
      paintWhirl(s, {
        cover: Math.max(0.2, cover),
        rim: 1.30 + 0.10 * Math.sin(t * 7.0),
        amp,
        spin,
        throat,
        chop: 0.075,
        foam: 0.45 + 0.35 * open,
        surgeR: 0.3 + 3.0 * burst,
        surgeAmp,
        alpha,
      });
    } else {
      // Nothing drawn yet. The buffer still holds whatever the last tick left,
      // and a sheet added to the scene before its first paint shows one frame
      // of garbage — a tween added mid-pass is not stepped until the next
      // frame, so this object exists for a tick before anything runs.
      s.mesh.visible = false;
      return;
    }
    s.mesh.visible = true;
  }, () => {
    kit.scene.remove(moon); kit.scene.remove(halo);
    // Materials and maps only. A Sprite's geometry is a MODULE-LEVEL singleton
    // in three.js, shared by every sprite in the scene; disposing it here took
    // the torch glows down with it the first time it was tried in ./moonphase.
    moonMat.map.dispose(); moonMat.dispose();
    halo.material.map.dispose(); halo.material.dispose();
  });
}

// No `timing` export on purpose. `Fx.killWait` only holds back cards that LEFT
// the board, and nothing leaves when Charybdis arrives — declaring a wait here
// would read as controlling when the card is DEALT, which it does not do. The
// deploy runs on the table's own animation alongside this.
