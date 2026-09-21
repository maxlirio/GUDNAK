// CHAINS — Refractory hauls people about in irons.
//
// One effect, one file. Preview it with:
//   node tools/shot.js --url "game/?quick=1&seed=5&zoom=26&t=700" \
//     --eval tools/fxdemo/chains.js --out /tmp/ch.png --settle 200
// `t` is the point in the MOTIF to freeze at, in milliseconds. Wall-clock
// --settle on its own is useless here — see the harness for why.
//
// The beats are a real capture's: the chain is THROWN, it BITES round the
// card, the slack goes with a clank, the card is HAULED across the stone in
// short heaves and brought up SHORT of its captor — still out in the open and
// plainly in irons — the loops open and the iron is dragged back in, and only
// then does the card slide the last of the way under and the captor come down
// on it. Nothing fades in or out on the spot; every piece of it arrives from
// the captor's hands with weight behind it, and leaves the same way.
//
// The rules have already moved the card by the time this plays, so the drag is
// re-staged: the victim is taken over, dragged from where it still stands to
// where it now belongs, and handed back.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { UP, _aim, burst, glow, restOf } from '../iron-kit.js';

/* ---------------------------------------------------------------- the iron */

// The links and the way they are laid along a curve started as copies out of
// ../iron-kit.js. They live here now because the wrap needed a lighter link
// and a different curve, and that file is shared with the brand, whose chain
// must not change under it.

// There is no environment map in this scene and the braziers are low, so a
// physically metallic chain renders as a black silhouette lit by nothing. The
// iron is mixed metal over a grey base with a trace of warm emissive instead:
// it reads as iron in the brazier light without turning into polished chrome,
// which is what the first pass looked like against the dark stone.
const IRON = 0x7e7872;

const LINK_R = 0.088;          // a card is 1.74 across, so this is heavy chain —
const LINK_T = 0.027;          // it has to read from a camera 19 units up
const LINK_LONG = 1.55;        // links are ovals, not rings
const LINK_STEP = LINK_R * 1.74;

/** Chain timeline, in seconds — phase boundaries, not durations. */
const C = {
  THROW: 0.26,    // in the air
  WRAP: 0.52,     // winding round the card
  CINCH: 0.62,    // slack gone, the card is caught
  HAUL: 1.04,     // dragged in under the captor, who is holding himself clear
  LETGO: 1.22,    // the loops open and the chain is pulled back in
  DROP: 1.46,     // the captor comes down on top of them
  TOTAL: 1.76,
  STAGGER: 0.3,   // between cards when a Man Catcher sweeps a square
};

function chainMesh(count) {
  const geo = new THREE.TorusGeometry(LINK_R, LINK_T, 5, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: IRON, metalness: 0.8, roughness: 0.36,
    emissive: 0x4a423a, emissiveIntensity: 0.2,
    transparent: true, opacity: 1,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

const _mat4 = new THREE.Matrix4();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _tan = new THREE.Vector3();
const _side = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _neg = new THREE.Vector3();
const LINK_SCALE = new THREE.Vector3(LINK_LONG, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Place the links along a polyline.
 *
 * Every other link stands at right angles to its neighbours. Without that a
 * chain is a string of beads, and that was a bigger part of why an early one
 * never read as iron than the path it followed.
 */
function layLinks(inst, pts, live) {
  for (let i = 0; i < inst.count; i++) {
    if (i >= live) { inst.setMatrixAt(i, HIDDEN); continue; }
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(live - 1, i + 1)];
    _tan.subVectors(next, prev);
    if (_tan.lengthSq() < 1e-9) _tan.set(1, 0, 0);
    _tan.normalize();
    _side.crossVectors(_tan, UP);
    if (_side.lengthSq() < 1e-9) _side.set(0, 0, 1);
    _side.normalize();
    _nrm.crossVectors(_side, _tan).normalize();
    // the torus hole runs along local Z; both bases below are right-handed,
    // which a straight (tan, side, nrm) is not — that one builds mirrored links
    if (i & 1) _basis.makeBasis(_tan, _nrm, _side);
    else _basis.makeBasis(_tan, _neg.copy(_side).negate(), _nrm);
    _quat.setFromRotationMatrix(_basis);
    _mat4.compose(pts[i], _quat, LINK_SCALE);
    inst.setMatrixAt(i, _mat4);
  }
  inst.instanceMatrix.needsUpdate = true;
}

/** How far a flat card reaches in a horizontal direction, so the loops can be
 *  sized to clear its edges instead of cutting through the face. */
function support(dir) {
  return Math.abs(dir.x) * CARD_W * 0.5 + Math.abs(dir.z) * CARD_H * 0.5;
}

/**
 * The outline a turn of chain follows round a card, in the card's own frame:
 * flat across the face, a quarter turn at the edge, flat back underneath, and
 * up the far edge. `a` reaches across the card, `b` is how far the chain
 * stands off each face, and the result is the point at arc length `m`.
 *
 * The corners are ARCS of one link's radius, because that is the tightest bend
 * a chain can make. Square corners had to pack three links into an edge only
 * 0.11 long, and the wrap came out as a row of little wire curls rather than
 * chain turning over an edge — that is what made it look like scribble in
 * every close shot.
 */
const _sec = { across: 0, up: 0, P: 0 };
function section(m, a, b) {
  const r = Math.min(LINK_R, a * 0.5, b);
  const q = Math.PI * 0.5 * r;
  const fa = a - r, fb = b - r;
  const P = 4 * fa + 4 * fb + 4 * q;
  _sec.P = P;
  let t = ((m % P) + P) % P;
  let across, up;
  if (t < fa) { across = t; up = b; }                                   // face
  else if ((t -= fa) < q) {                                             // edge
    const th = (t / r); across = fa + r * Math.sin(th); up = fb + r * Math.cos(th);
  } else if ((t -= q) < 2 * fb) { across = a; up = fb - t; }            // rim
  else if ((t -= 2 * fb) < q) {
    const th = (t / r); across = fa + r * Math.cos(th); up = -fb - r * Math.sin(th);
  } else if ((t -= q) < 2 * fa) { across = fa - t; up = -b; }           // underneath
  else if ((t -= 2 * fa) < q) {
    const th = (t / r); across = -fa - r * Math.sin(th); up = -fb - r * Math.cos(th);
  } else if ((t -= q) < 2 * fb) { across = -a; up = -fb + t; }          // far rim
  else if ((t -= 2 * fb) < q) {
    const th = (t / r); across = -fa - r * Math.cos(th); up = fb + r * Math.sin(th);
  } else { across = -fa + (t - q); up = b; }                            // face again
  _sec.across = across;
  _sec.up = up;
  return _sec;
}

/** The arc length of one whole turn, so the chain can be cut to fit it. */
function turnLength(a, b) { section(0, a, b); return _sec.P; }

/* ----------------------------------------------------------- one thrown chain */

/**
 * ONE THROWN CHAIN.
 *
 * The whole thing is a single arc-length curve rebuilt every frame:
 *
 *   u = 0 .. span       the run from the captor to the card, bowed while it is
 *                       in the air and dead straight once it pulls
 *   u = span .. +wrap   turns round the card
 *
 * and one number — how much chain has left the captor — says which part of it
 * is showing. That number does all the work: paying out during the throw,
 * winding on during the wrap, then, because `span` shrinks by itself as the
 * card is dragged nearer, reeling back in during the haul, and finally running
 * to nothing, which is how the chain lets go and leaves.
 *
 * The turns walk the OUTLINE OF A FLAT SLAB (see section() above), not a
 * circle. Chain over a card lies flat across the face, turns over the edge and
 * vanishes underneath; the return half of every turn is hidden by the card
 * itself, which is exactly what makes it read as wrapped rather than draped.
 * Round loops put the links on a curve no card has and the wrap read as a knot
 * parked on top of the art.
 *
 * WHY THERE IS NO PER-LINK LAG. Two earlier versions had every link chase its
 * place on the curve through the air, which is where their whip came from. It
 * cannot work here, because paying chain out means the whole length of it
 * SLIDES ALONG the curve — during the wrap the links travel at 30 units a
 * second, and a first-order chase at a plausible rate sits a couple of units
 * behind. The first version piled the laggards into a ball of wool on the card;
 * the second let go of them altogether and the chain broke into a dotted line
 * of loose links strewn across the stone.
 *
 * Chain is inextensible. So the links go exactly one LINK_STEP apart along the
 * curve, always, and the life comes from the CURVE moving instead: a flick
 * running down the free chain while it is in the air, and a damped shiver
 * through the whole run when the slack goes.
 */
function rope(kit, ctx, lane, delay, turns) {
  const wrapLen = turnLength(ctx.rx, ctx.ry) * turns;
  const n = Math.min(170, Math.ceil((ctx.span0 + wrapLen) / LINK_STEP) + 2);
  const inst = chainMesh(n);

  const pts = [];
  for (let i = 0; i < n; i++) pts.push(ctx.anchor(lane).clone());

  const anchor = new THREE.Vector3();
  const entry = new THREE.Vector3();

  const span_ = C.TOTAL + delay;
  kit.hold(inst, span_, (t) => {
    const s = t * span_ - delay;
    inst.visible = s > 0;
    if (s <= 0) return;
    ctx.aim();
    anchor.copy(ctx.anchor(lane));

    // how hard the turns are pulled in against the card: loose while it is
    // still winding on, tight from the cinch, thrown open again at the end
    const bite = s < C.WRAP ? 0
      : s < C.CINCH ? (s - C.WRAP) / (C.CINCH - C.WRAP)
        : s < C.LETGO ? 1 : 1 - 2.1 * Math.min(1, (s - C.LETGO) / 0.11);
    const rx = ctx.rx * (1.08 - 0.08 * bite);
    const ry = ctx.ry * (1.7 - 0.7 * bite);
    // the turns lift clear of the card as they are thrown open at the end
    const off = bite < 0 ? -bite * 0.1 : 0;

    // The first turn starts at the end nearest the captor and they walk away
    // from it, so the run always meets the card at its near edge instead of
    // lying across the picture.
    const loop = (w, out) => {
      const c = section(w * lane, rx, ry);
      const band = (0.5 - w / wrapLen) * ctx.spread + lane * 0.17;
      out.copy(ctx.card)
        .addScaledVector(ctx.axis, band)
        .addScaledVector(ctx.across, c.across);
      out.y += 0.028 + off + c.up;
      return out;
    };

    loop(0, entry);
    const span = anchor.distanceTo(entry);

    // thrown high, dropping as it lands, nothing left to give once it pulls
    const bow = s < C.THROW ? 0.75 * (1 - easeIn(s / C.THROW))
      : s < C.CINCH ? 0.26 * (1 - (s - C.THROW) / (C.CINCH - C.THROW))
        : s < C.LETGO ? -0.02
          : -0.09 * Math.min(1, (s - C.LETGO) / 0.2);

    // the clank: when the slack goes, the whole run shivers once and stills
    const shiver = s > C.CINCH - 0.02 && s < C.CINCH + 0.45
      ? Math.sin((s - C.CINCH) * 58) * 0.07 * Math.exp(-(s - C.CINCH) * 10) : 0;

    // the flick travelling down the free chain while it is still being thrown
    const wave = s < C.CINCH ? 0.17 * (1 - s / C.CINCH) ** 2 : 0;

    let out;
    if (s < C.THROW) out = easeOut(s / C.THROW) * span;
    else if (s < C.WRAP) out = span + ((s - C.THROW) / (C.WRAP - C.THROW)) * wrapLen;
    else if (s < C.LETGO) out = span + wrapLen;
    // Hauled back in, not faded out. easeIn here left 97% of the chain still
    // lying on the card when the fade started, so the irons ended the motif by
    // going transparent on the spot — the one thing this file is not allowed
    // to do. easeOut whips the free end home and the tail follows.
    else out = (span + wrapLen) * (1 - easeOut(Math.min(1, (s - C.LETGO) / 0.3)));

    const at = (u, o) => {
      if (u >= span) return loop(u - span, o);
      const k = span < 1e-6 ? 0 : u / span;
      o.lerpVectors(anchor, entry, k);
      const swing = Math.sin(Math.PI * k);
      o.y += swing * (bow + shiver);
      if (wave) {
        // a wave with a phase that runs toward the head, so the chain looks
        // thrown rather than waved about
        const ph = k * 6.5 - s * 15;
        o.addScaledVector(ctx.across, Math.sin(ph) * wave * swing);
        o.y += Math.cos(ph) * wave * 0.45 * swing;
      }
      return o;
    };

    const live = Math.max(0, Math.min(n, Math.floor(out / LINK_STEP) + 1));

    for (let i = 0; i < live; i++) at(Math.max(0, out - i * LINK_STEP), pts[i]);
    layLinks(inst, pts, live);

    // a hard glint down the whole run on the snap, then it dulls as it drops
    inst.material.emissiveIntensity = 0.2
      + (s > C.CINCH - 0.05 && s < C.CINCH + 0.18
        ? 0.55 * (1 - (s - C.CINCH + 0.05) / 0.23) : 0);
    // The last handful of links fade as they are gathered, because the reel-in
    // ends with exactly one link left sitting on the stone by the captor's
    // hand, and it sat there for a sixth of a second looking like a dropped
    // washer. Out of shot it is a fist closing on the end of the chain.
    const gathered = s > C.LETGO ? Math.min(1, live / 8) : 1;
    inst.material.opacity = Math.min(gathered,
      s < C.TOTAL - 0.14 ? 1 : Math.max(0, (C.TOTAL - s) / 0.14));
  });
}

/* ------------------------------------------------------------- the captor */

// Several chains can be hauling into the same captor at once — a Man Catcher
// sweeps a whole square and fires this once per card in the stack — and each
// of them wants the captor held clear so the cards can go under. The first
// tween to finish used to zero `piece.lift` outright, dropping the captor onto
// a card still on its way in, so each effect's contribution is kept separately
// and the piece always gets the largest one still asking.
const lifts = new Map();
let token = 0;
function liftCaptor(piece, id, height) {
  if (!piece) return;
  let m = lifts.get(piece);
  if (!m) lifts.set(piece, (m = new Map()));
  m.set(id, height);
  settle(piece, m);
}

/** Drop one effect's claim wherever it is held. Searching rather than looking
 *  the captor up again is what keeps a piece that died mid-haul — or was
 *  rebuilt by a resync — from being pinned in this map for the rest of the
 *  game, holding its `lift` at whatever it happened to be. */
function releaseLift(id) {
  for (const [piece, m] of lifts) if (m.delete(id)) settle(piece, m);
}

function settle(piece, m) {
  let top = 0;
  for (const v of m.values()) top = Math.max(top, v);
  piece.lift = top;
  if (!m.size) lifts.delete(piece);
}

/* --------------------------------------------------------------- the motif */

export function chains(kit, from, to) {
  const now = performance.now() / 1000;
  inVolley = now - lastThrow < 0.5 ? inVolley + 1 : 0;
  lastThrow = now;
  // A Man Catcher fires this once per card in the stack, all in the same
  // frame. Six ropes wrapping three cards on one square was a ball of wool, so
  // a chain that goes off while another is still leaving the captor knows it
  // is part of a sweep: it waits its turn and throws a single chain. The cards
  // then go under one after another, which is what a man catcher hooking them
  // out one at a time should look like anyway.
  const sweeping = inVolley > 0;
  const delay = Math.min(3, inVolley) * C.STAGGER;
  const id = ++token;

  const captor = kit.piece(from);
  const victim = kit.piece(to);
  const grab = restOf(captor) || kit.at(from);
  const held = victim ? victim.group.position.clone() : kit.at(to);
  const dest = restOf(victim) || kit.at(to) || held;
  if (!grab || !held) return;

  const ctx = {
    card: held.clone(),
    axis: new THREE.Vector3(), across: new THREE.Vector3(),
    rx: 1, ry: 0.105, spread: 1.75, span0: 4,
    aim() {
      _aim.copy(grab).sub(this.card).setY(0);
      // at the end the card is under the captor and there is no direction left
      // to read; the last good one is kept so the turns do not spin on the spot
      if (_aim.lengthSq() > 0.25) {
        this.axis.copy(_aim).normalize();
        this.across.crossVectors(this.axis, UP).normalize();
        // the chain's outer face just clears the card's edge rather than
        // cutting through the art
        this.rx = support(this.across) + LINK_R * 0.7;
        // wide enough that the two turns sit a third of a card apart. At 1.3 they
        // landed either side of the centre line with the whole near end and the
        // whole far end of the card bare, which read as a card with a chain
        // across it rather than a card bound in chains.
        this.spread = support(this.axis) * 2;
      }
    },
    anchor(lane) {
      // taken from where the captor's card IS, not where it rests: it holds
      // itself clear during the haul and the chain has to stay in its grip
      const c = kit.piece(from);
      const p = (c ? c.group.position : grab).clone();
      return p
        .addScaledVector(this.axis, -support(this.axis) * 0.98)
        .addScaledVector(this.across, lane * 0.4)
        .setY(p.y + 0.06);
    },
  };
  ctx.axis.copy(grab).sub(held).setY(0);
  if (ctx.axis.lengthSq() < 1e-6) ctx.axis.set(0, 0, 1);
  ctx.axis.normalize();
  ctx.across.crossVectors(ctx.axis, UP).normalize();
  ctx.aim();
  ctx.span0 = grab.distanceTo(held) + 2;

  // The haul is registered FIRST so it has moved the card before the ropes ask
  // where it is; an Object3D with nothing on it is only a clock to hang it on.
  const tip = ctx.across.clone();
  const HEAVES = 3;
  // HOW THE LAST BEAT IS STAGED. Hauled all the way home in one go, the victim
  // ends the motif exactly under the captor — same size card, 0.028 lower —
  // and vanishes, chains and all, behind its captor's own art. Lifting the
  // captor clear did not save it: from a camera nineteen units up a card half
  // a unit in the air only looks slightly bigger. So the heaves stop it SHORT,
  // with its near half still out in the open and plainly in irons, the chains
  // come off there where they can be seen, and only then does it slide the
  // rest of the way under and the captor come down on it.
  const NEAR = 0.84;
  const far = held.distanceTo(dest);
  const slewQ = new THREE.Quaternion();
  kit.hold(new THREE.Object3D(), C.TOTAL + delay, (t) => {
    const s = t * (C.TOTAL + delay) - delay;
    const v = kit.piece(to);
    if (!v) return;
    // held from the first frame, even before this chain's turn comes round:
    // otherwise the piece's own homing lerp walks it under the captor while
    // the sweep is still working through the cards in front of it
    v.animating = true;
    if (s <= 0) { v.group.position.copy(held); ctx.card.copy(held); return; }

    let k = 0;          // 0..1 along the drag
    let lift = 0;       // the leading edge riding up
    let slew = 0;       // and the card slewing as it is dragged off square
    const shove = C.DROP - 0.16;
    if (s > shove) {
      k = NEAR + (1 - NEAR) * easeOut(Math.min(1, (s - shove) / 0.16));
    } else if (s > C.HAUL) {
      const d = Math.min(1, (s - C.HAUL) / 0.14);
      k = NEAR;
      lift = 0.13 * (1 - d) * (1 - d);
      slew = 0.05 * (1 - d) * (1 - d);
    } else if (s > C.CINCH) {
      const h = (s - C.CINCH) / (C.HAUL - C.CINCH);
      // Dragged weight does not glide, and it does not ease in either: it
      // breaks loose and then grinds. Three heaves, each a hard surge into a
      // rest. An easeInOut over the whole distance was the single worst thing
      // in the motif — the card sat perfectly still for the first third of its
      // own haul while two taut chains pulled on it.
      const seg = h * HEAVES;
      const i = Math.min(HEAVES - 1, Math.floor(seg));
      k = NEAR * (i + easeOut(Math.min(1, (seg - i) * 1.4))) / HEAVES;
      lift = 0.13 * Math.sin(Math.PI * Math.min(1, h * 1.15));
      slew = 0.05 * Math.sin(Math.PI * Math.min(1, h * 1.1));
    } else if (s > C.WRAP) {
      // the yank, before it gives: pulled up onto its edge and held there
      const y = (s - C.WRAP) / (C.CINCH - C.WRAP);
      k = far > 0.01 ? Math.min(0.06, 0.14 / far) * easeIn(y) : 0;
      lift = 0.075 * easeIn(y);
      slew = 0.03 * easeIn(y);
    } else if (s > C.THROW) {
      // flinch as the iron lands on it
      lift = -0.03 * Math.exp(-(s - C.THROW) * 9) * Math.sin((s - C.THROW) * 40);
    }

    v.group.position.lerpVectors(held, dest, k);
    v.group.position.y += Math.sin(Math.PI * Math.min(1, k)) * 0.035;
    // tip about the axis the chain pulls along, and slew about the vertical —
    // a card hauled by two chains at its corners does not track straight
    v.group.quaternion.setFromAxisAngle(tip, lift);
    v.group.quaternion.multiply(slewQ.setFromAxisAngle(UP, slew));
    ctx.card.copy(v.group.position);

    // the captor holds himself clear to let them under, and drops on them
    const inb = s < C.CINCH ? 0
      : s < C.DROP ? Math.min(1, (s - C.CINCH) / 0.24)
        : Math.max(0, 1 - (s - C.DROP) / 0.11);
    liftCaptor(kit.piece(from), id, 0.3 * inb);
  }, () => {
    const v = kit.piece(to);
    if (v) {
      v.group.position.copy(dest);
      v.group.quaternion.identity();
      v.animating = false;
    }
    releaseLift(id);
  });

  // Two chains for a single capture, thrown from opposite corners so they
  // cross on the face; one apiece during a sweep, or three cards' worth of
  // ironwork lands on the same square at once and reads as wool.
  rope(kit, ctx, 1, delay, 2);
  if (!sweeping) rope(kit, ctx, -1, delay, 2);

  const GOLD = 'rgba(255,225,150,1)';
  const bit = held.clone().setY(held.y + 0.1);
  // A sweep drops every card of a stack on the SAME square, so three sets of
  // sparks and flashes land on one another. Half strength apiece, or the top
  // card of the stack is a white rectangle for a third of a second.
  const dim = sweeping ? 0.5 : 1;
  // iron leaving the captor, iron landing, and then the beat the whole motif
  // is built around: the snap, where the slack goes and the card is caught
  burst(kit, ctx.anchor(0), {
    colour: GOLD, count: 5, spread: 0.45, rise: 0.5, size: 0.22,
    delay, life: 0.35, total: C.TOTAL + delay,
  });
  burst(kit, bit, {
    colour: GOLD, count: Math.round(6 * dim), spread: 0.7, rise: 0.5, size: 0.18,
    delay: delay + C.THROW, life: 0.4, total: C.TOTAL + delay,
  });
  glow(kit, bit.clone().setY(held.y + 0.7), 0xffd9a0,
    { power: 6 * dim, delay: delay + C.THROW, life: 0.3, total: C.TOTAL + delay, reach: 3.6 });
  burst(kit, bit, {
    colour: GOLD, count: Math.round(9 * dim), spread: 1.3, rise: 1, size: 0.16,
    delay: delay + C.CINCH, life: 0.5, total: C.TOTAL + delay,
  });
  // HEIGHT, not power, is what keeps these off the card. A point light falls
  // off as 1/d^2 with a floor of 0.01, so the landing flash sitting 0.1 above
  // the face was multiplied by a hundred: it washed the card to flat white and
  // the links stopped reading as separate pieces of iron at the one moment
  // they most need to. Lifted clear, the same light is a pool rather than a
  // hole burned in the art.
  glow(kit, held.clone().setY(held.y + 0.9), 0xfff0cc,
    { power: 9 * dim, delay: delay + C.CINCH, life: 0.26, total: C.TOTAL + delay, reach: 4.2 });

  // grit ploughed up along the way, so the drag has a floor under it
  for (const f of [0.34, 0.68]) {
    burst(kit, held.clone().lerp(dest, f).setY(0.07), {
      colour: 'rgba(206,188,158,1)', count: 5, spread: 0.7, rise: 0.16, size: 0.26,
      delay: delay + C.CINCH + f * (C.HAUL - C.CINCH), life: 0.42,
      total: C.TOTAL + delay, gravity: 0.35,
    });
  }
  // dust, punched out from under the pair when the captor drops onto them
  burst(kit, dest.clone().setY(dest.y + 0.04), {
    colour: 'rgba(214,196,164,1)', count: 12, spread: 1.6, rise: 0.2, size: 0.34,
    delay: delay + C.DROP + 0.06, life: 0.5, total: C.TOTAL + delay, gravity: 0.4,
  });

  // NO GROUND RING. This had two of them, at the snap and at the grounding,
  // and both sat on the stone as wide pale translucent donuts that belonged to
  // some other game — they are the one shape in the motif that is not iron.
  // Shrinking and warming one did not save it. The snap already has the glint
  // running down the chain, the sparks and the close light, and the grounding
  // has its dust.
}

// A Man Catcher sweeping a square fires this once per card in the stack, all
// in the same frame, so the volley has to be counted somewhere that survives
// between calls. These two lived at the bottom of ../iron-kit.js when the
// motifs were split out of it and were never exported, so every call here
// threw a ReferenceError on its first line and the effect did not play at all.
let lastThrow = -9e9;
let inVolley = 0;

/**
 * This motif CARRIES its card: it reads the card's current position as the
 * start of the journey and its resting place as the end, and does the moving
 * itself. The table's own slide must stand down, or it runs over the top at a
 * third of the length and the card arrives before the motif has finished
 * putting it there. Declared here rather than on a list in main.js so the
 * fact lives next to the code that depends on it.
 */
export const carries = true;
