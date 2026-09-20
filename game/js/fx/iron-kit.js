// The ironwork every Refractory motif is built from — links, heat, smoke.
//
// Shared by chains and the brand, so it belongs to neither of them.

// IRON — what Refractory does to people. Chains, and the brand.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&fx=chains&t=600" \
//             --eval tools/fxdemo/iron.js --out /tmp/i.png --settle 200
// `t` is the point in the MOTIF to freeze at, in ms, because --settle is wall
// clock and headless Chrome renders this at about six frames a second: every
// early screenshot taken at --settle 800 was really the motif 80ms in.
//
// Both motifs are iron handled by people, not magic. A chain is thrown, bites,
// snaps taut and hauls a card bodily across the stone; a brand is heated,
// pressed, held, lifted, and left to cool. So nothing here fades in on the
// spot: everything arrives from somewhere with weight behind it.
//
// The first version did fade in on the spot, which is exactly why it read as
// decoration — a line of torus links laid along a curve between two cards,
// gripping neither, and a flat ring that grew and shrank.
//
// ONE RULE FOR THIS FILE: every tween is registered when the effect starts.
// Animator.update() replaces its list with a filter() of the list it started
// the frame with, so a tween added from inside another tween's callback is
// thrown away — and the object it was animating stays in the scene forever,
// never ticked. That is what the stuck white blob over the victim was. So the
// delayed beats below carry their own delay instead of being scheduled later.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from './kit.js';
import { blobTexture } from '../textures.js';

export const UP = new THREE.Vector3(0, 1, 0);

// There is no environment map in this scene and the braziers are low, so a
// physically metallic chain renders as a black silhouette lit by nothing. The
// iron is mixed metal over a grey base with a trace of cold emissive instead:
// it still reads as iron in the warm light without turning into bone.
export const IRON = 0x8b8781;

export const LINK_R = 0.1;           // a card is 1.74 across, so this is heavy chain —
export const LINK_T = 0.03;          // it has to read from a camera 19 units up
export const LINK_LONG = 1.5;        // links are ovals, not rings
export const LINK_STEP = LINK_R * 1.72;

/** Chain timeline, in seconds — phase boundaries, not durations. */
export const C = {
  THROW: 0.22,   // in the air
  WRAP: 0.44,    // winding round the card
  CINCH: 0.54,   // slack gone, the card is caught
  HAUL: 0.98,    // dragged across
  SETTLE: 1.08,  // grounded under the captor
  LETGO: 1.16,   // the loops open and the chain is pulled back in
  TOTAL: 1.52,
};

/* ------------------------------------------------- delayed odds and ends */

/**
 * Sparks, and a flash of light, both of which have to be booked in advance
 * (see the rule at the top of the file). `delay` is measured from the start of
 * the motif; `total` is how long the tween has to stay alive for.
 */
export function burst(kit, at, {
  colour, count = 12, spread = 0.9, rise = 0.8, size = 0.3,
  life = 0.5, delay = 0, total = 1, gravity = 1.3,
}) {
  const tex = blobTexture(colour, colour.replace(/,\s*1\)$/, ',0)'));
  const grp = new THREE.Group();
  const vel = [], from = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const r = 0.35 + Math.random() * 0.65;
    // every spark starts on its own patch of card: born at one point they
    // stack into a single blown-out white ball for the first few frames
    from.push(at.clone().add(new THREE.Vector3(
      Math.cos(a) * spread * 0.3, Math.random() * 0.06, Math.sin(a) * spread * 0.3)));
    s.position.copy(from[i]);
    s.scale.setScalar(size);
    vel.push(new THREE.Vector3(Math.cos(a) * spread * r,
      rise * (0.5 + Math.random()), Math.sin(a) * spread * r));
    grp.add(s);
  }
  kit.hold(grp, total, (t) => {
    const k = (t * total - delay) / life;
    grp.visible = k > 0 && k < 1;
    if (!grp.visible) return;
    for (let i = 0; i < grp.children.length; i++) {
      const s = grp.children[i];
      s.position.copy(from[i]).addScaledVector(vel[i], k);
      s.position.y -= k * k * gravity;
      s.material.opacity = 0.85 * (1 - k) * Math.min(1, k * 8);
      s.scale.setScalar(size * (1 - k * 0.55));
    }
  });
}

export function glow(kit, at, colour, { power = 14, life = 0.35, delay = 0, total = 1, reach = 6 }) {
  const l = new THREE.PointLight(colour, 0, reach, 2);
  l.position.copy(at);
  kit.hold(l, total, (t) => {
    const k = (t * total - delay) / life;
    l.intensity = k <= 0 || k >= 1 ? 0 : power * (1 - k) * Math.min(1, k * 6);
  });
}

/* ------------------------------------------------------------ chain */

export function chainMesh(count) {
  const geo = new THREE.TorusGeometry(LINK_R, LINK_T, 5, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: IRON, metalness: 0.85, roughness: 0.3,
    emissive: 0x6b7480, emissiveIntensity: 0.14,
    transparent: true, opacity: 1,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

export const _mat4 = new THREE.Matrix4();
export const _basis = new THREE.Matrix4();
export const _quat = new THREE.Quaternion();
export const _tan = new THREE.Vector3();
export const _side = new THREE.Vector3();
export const _nrm = new THREE.Vector3();
export const _neg = new THREE.Vector3();
export const _aim = new THREE.Vector3();
export const LINK_SCALE = new THREE.Vector3(LINK_LONG, 1, 1);
export const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Place the links along a polyline.
 *
 * Every other link stands at right angles to its neighbours. Without that a
 * chain is a string of beads, and that was a bigger part of why the old one
 * never read as iron than the path it followed.
 */
export function layLinks(inst, pts, live) {
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
export function support(dir) {
  return Math.abs(dir.x) * CARD_W * 0.5 + Math.abs(dir.z) * CARD_H * 0.5;
}

export const restOf = (piece) => (piece?.restingPosition ? piece.restingPosition() : null);

/**
 * ONE THROWN CHAIN.
 *
 * The whole thing is a single arc-length curve rebuilt every frame:
 *
 *   u = 0 .. span       the run from the captor to the card, bowed while it is
 *                       in the air and dead straight once it pulls
 *   u = span .. +wrap   loops round the card
 *
 * and one number — how much chain has left the captor — says which part of it
 * is showing. That number does all the work: paying out during the throw,
 * winding on during the wrap, and then, because `span` shrinks by itself as
 * the card is dragged nearer, reeling back in during the haul.
 *
 * The loops walk the PERIMETER OF A RECTANGLE, not a circle. A card is a flat
 * slab, so chain over it lies flat across the face, bends hard at the edge and
 * disappears underneath. Round loops put the links on a curve no card has, and
 * the wrap read as a knot sitting on top of the art.
 *
 * Links chase their place on the curve with a lag that grows down the chain,
 * which is where the whip on the throw and the shudder on the snap come from.
 * A Verlet rope was tried first (the cloth motif uses one); it was wrong for
 * this, because chain is stiff and heavy and the rope wanted to bounce.
 */
export function rope(kit, ctx, lane, delay) {
  const turns = 1;
  const wrapLen = (4 * ctx.rx + 4 * ctx.ry) * turns;
  const n = Math.min(150, Math.ceil((ctx.span0 + wrapLen) / LINK_STEP) + 2);
  const inst = chainMesh(n);
  const anchor = ctx.anchor(lane);

  const pts = [];
  for (let i = 0; i < n; i++) pts.push(anchor.clone());

  const entry = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let prev = 0;
  let laid = false;

  const span_ = C.TOTAL + delay;
  kit.hold(inst, span_, (t) => {
    const s = t * span_ - delay;
    inst.visible = s > 0;
    if (s <= 0) return;
    const dt = Math.min(0.05, Math.max(0.004, s - prev));
    prev = s;
    ctx.aim();

    // how hard the loops are pulled in against the card
    const bite = s < C.WRAP ? 0
      : s < C.CINCH ? (s - C.WRAP) / (C.CINCH - C.WRAP)
        : s < C.LETGO ? 1 : Math.max(0, 1 - (s - C.LETGO) / 0.12);
    const rx = ctx.rx * (1.14 - 0.14 * bite);
    const ry = ctx.ry * (1.5 - 0.5 * bite);
    const P = 4 * rx + 4 * ry;

    // The loop, in the card's own frame: out along the top face, down the
    // edge, back underneath, up the far edge. The lanes run opposite ways so
    // the two chains cross on the face instead of doubling up on each other.
    const loop = (w, out) => {
      const m = (((w * lane) % P) + P) % P;
      let across, up;
      if (m < rx) { across = m; up = ry; }                                  // top
      else if (m < rx + 2 * ry) { across = rx; up = ry - (m - rx); }        // edge
      else if (m < 3 * rx + 2 * ry) { across = rx - (m - rx - 2 * ry); up = -ry; }
      else if (m < 3 * rx + 4 * ry) { across = -rx; up = -ry + (m - 3 * rx - 2 * ry); }
      else { across = -rx + (m - 3 * rx - 4 * ry); up = ry; }        // top again
      const band = (w / wrapLen - 0.5) * 0.8 + lane * 0.3;
      out.copy(ctx.card)
        .addScaledVector(ctx.axis, band)
        .addScaledVector(ctx.across, across);
      out.y += 0.045 + up;
      return out;
    };

    loop(0, entry);
    const span = anchor.distanceTo(entry);

    // thrown high, dropping as it lands, nothing left to give once it pulls
    const bow = s < C.THROW ? 0.6 * (1 - easeIn(s / C.THROW))
      : s < C.CINCH ? 0.22 * (1 - (s - C.THROW) / (C.CINCH - C.THROW))
        : s < C.LETGO ? 0
          : -0.07 * Math.min(1, (s - C.LETGO) / 0.2);

    // the clank: when the slack goes, the whole run shivers once and stills
    const shiver = s > C.CINCH - 0.02 && s < C.CINCH + 0.4
      ? Math.sin((s - C.CINCH) * 62) * 0.055 * Math.exp(-(s - C.CINCH) * 11) : 0;

    // Everything the chain does is this one number: how much of it is out of
    // the captor's hands. Paying out, winding on, then — because `span` gets
    // shorter by itself as the card is dragged nearer — reeling back in, and
    // finally wound all the way home, which is how it lets go and leaves.
    let out;
    if (s < C.THROW) out = easeOut(s / C.THROW) * span;
    else if (s < C.WRAP) out = span + ((s - C.THROW) / (C.WRAP - C.THROW)) * wrapLen;
    else if (s < C.LETGO) out = span + wrapLen;
    else out = (span + wrapLen) * (1 - easeIn(Math.min(1, (s - C.LETGO) / 0.3)));

    const at = (u, o) => {
      if (u >= span) return loop(u - span, o);
      const k = span < 1e-6 ? 0 : u / span;
      o.lerpVectors(anchor, entry, k);
      o.y += Math.sin(Math.PI * k) * (bow + shiver);
      return o;
    };

    const live = Math.max(0, Math.min(n, Math.floor(out / LINK_STEP) + 1));

    for (let i = 0; i < live; i++) {
      const p = pts[i];
      at(Math.max(0, out - i * LINK_STEP), tmp);
      if (!laid) { p.copy(tmp); continue; }
      // the head is the thrown end and goes where it is aimed; the links
      // behind it lag more the further back they are, which is the whip
      const rate = s > C.CINCH ? 34 : Math.max(9, 30 - i * 0.6);
      tmp.sub(p);
      p.addScaledVector(tmp, Math.min(1, dt * rate));
    }
    laid = true;
    layLinks(inst, pts, live);

    // a hard glint down the whole run on the snap, then it dulls as it drops
    inst.material.emissiveIntensity = 0.14
      + (s > C.CINCH - 0.04 && s < C.CINCH + 0.16
        ? 0.4 * (1 - (s - C.CINCH + 0.04) / 0.2) : 0);
    inst.material.opacity = s < C.TOTAL - 0.2 ? 1 : Math.max(0, (C.TOTAL - s) / 0.2);
  });
}

/**
 * CHAINS — the captor throws, the chains wrap the victim's card, and it is
 * hauled bodily across the stone to sit under them.
 *
 * The rules have already moved the card by the time this plays, so the drag is
 * re-staged: the victim is taken over (`animating` is the piece's own hook for
 * "an animation owns my transform"), dragged from where it still stands to
 * where it now belongs, and handed back. The flag is set every tick rather
 * than once, because the board's own 0.3s move tween clears it when it ends
 * and the card was snapping home halfway through the drag.
 */
// A Man Catcher sweeping a square fires this once per card in the stack, all
// in the same frame, and six ropes wrapping three cards on the same square was
// a ball of wool. So a chain that goes off while another is still leaving the
// captor knows it is part of a sweep: it waits its turn, and throws one chain
// instead of two. The cards then go under one after another, which is what a
// man catcher hooking them out one at a time should look like anyway.
let lastThrow = -9e9;
let inVolley = 0;
