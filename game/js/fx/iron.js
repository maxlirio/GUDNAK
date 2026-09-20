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

const UP = new THREE.Vector3(0, 1, 0);

// There is no environment map in this scene and the braziers are low, so a
// physically metallic chain renders as a black silhouette lit by nothing. The
// iron is mixed metal over a grey base with a trace of cold emissive instead:
// it still reads as iron in the warm light without turning into bone.
const IRON = 0x8b8781;

const LINK_R = 0.1;           // a card is 1.74 across, so this is heavy chain —
const LINK_T = 0.03;          // it has to read from a camera 19 units up
const LINK_LONG = 1.5;        // links are ovals, not rings
const LINK_STEP = LINK_R * 1.72;

/** Chain timeline, in seconds — phase boundaries, not durations. */
const C = {
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
function burst(kit, at, {
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

function glow(kit, at, colour, { power = 14, life = 0.35, delay = 0, total = 1, reach = 6 }) {
  const l = new THREE.PointLight(colour, 0, reach, 2);
  l.position.copy(at);
  kit.hold(l, total, (t) => {
    const k = (t * total - delay) / life;
    l.intensity = k <= 0 || k >= 1 ? 0 : power * (1 - k) * Math.min(1, k * 6);
  });
}

/* ------------------------------------------------------------ chain */

function chainMesh(count) {
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

const _mat4 = new THREE.Matrix4();
const _basis = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _tan = new THREE.Vector3();
const _side = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _neg = new THREE.Vector3();
const _aim = new THREE.Vector3();
const LINK_SCALE = new THREE.Vector3(LINK_LONG, 1, 1);
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Place the links along a polyline.
 *
 * Every other link stands at right angles to its neighbours. Without that a
 * chain is a string of beads, and that was a bigger part of why the old one
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

const restOf = (piece) => (piece?.restingPosition ? piece.restingPosition() : null);

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
function rope(kit, ctx, lane, delay) {
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

export function chains(kit, from, to) {
  const now = performance.now() / 1000;
  inVolley = now - lastThrow < 0.4 ? inVolley + 1 : 0;
  lastThrow = now;
  const sweeping = inVolley > 0;
  const delay = Math.min(3, inVolley) * 0.16;

  const captor = kit.piece(from);
  const victim = kit.piece(to);
  const grab = restOf(captor) || kit.at(from);
  const held = victim ? victim.group.position.clone() : kit.at(to);
  const dest = restOf(victim) || kit.at(to) || held;
  if (!grab || !held) return;

  const ctx = {
    card: held.clone(),
    axis: new THREE.Vector3(), across: new THREE.Vector3(),
    rx: 1, ry: 0.075, span0: 4,
    aim() {
      _aim.copy(grab).sub(this.card).setY(0);
      // at the end the card is under the captor and there is no direction left
      // to read; the last good one is kept so the loops do not spin on the spot
      if (_aim.lengthSq() > 0.25) {
        this.axis.copy(_aim).normalize();
        this.across.crossVectors(this.axis, UP).normalize();
        this.rx = support(this.across) + 0.04;
      }
    },
    anchor(lane) {
      return grab.clone()
        .addScaledVector(this.axis, -support(this.axis) * 0.86)
        .addScaledVector(this.across, lane * 0.44)
        .setY(grab.y + 0.07);
    },
  };
  ctx.axis.copy(grab).sub(held).setY(0);
  if (ctx.axis.lengthSq() < 1e-6) ctx.axis.set(0, 0, 1);
  ctx.axis.normalize();
  ctx.across.crossVectors(ctx.axis, UP).normalize();
  ctx.aim();
  ctx.span0 = grab.distanceTo(held) + 1.5;

  // The haul is registered FIRST so it has moved the card before the ropes ask
  // where it is; an Object3D with nothing on it is only a clock to hang it on.
  const tip = ctx.across.clone();
  const far = held.distanceTo(dest);
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
    if (s > C.HAUL) {
      const d = Math.min(1, (s - C.HAUL) / (C.SETTLE - C.HAUL));
      k = 1;
      lift = 0.1 * (1 - d) * (1 - d);
    } else if (s > C.CINCH) {
      const h = (s - C.CINCH) / (C.HAUL - C.CINCH);
      // dragged weight does not glide; it comes in short pulls
      k = easeInOut(h) + Math.sin(h * Math.PI * 5) * 0.02 * (1 - h);
      lift = 0.1 * Math.sin(Math.PI * Math.min(1, h * 1.2));
    } else if (s > C.WRAP) {
      // the yank, before it gives: pulled up onto its edge and held there
      const y = (s - C.WRAP) / (C.CINCH - C.WRAP);
      k = far > 0.01 ? Math.min(0.07, 0.12 / far) * easeIn(y) : 0;
      lift = 0.06 * easeIn(y);
    } else if (s > C.THROW) {
      // flinch as the iron lands on it
      lift = -0.025 * Math.exp(-(s - C.THROW) * 9) * Math.sin((s - C.THROW) * 40);
    }

    v.group.position.lerpVectors(held, dest, k);
    v.group.position.y += Math.sin(Math.PI * Math.min(1, k)) * 0.03;
    v.group.quaternion.setFromAxisAngle(tip, lift);
    ctx.card.copy(v.group.position);

    // the captor lifts a hand's breadth to let them under, and drops on them
    const c = kit.piece(from);
    if (c) {
      const inb = s < C.CINCH ? 0
        : s < C.HAUL ? Math.min(1, (s - C.CINCH) / 0.22)
          : Math.max(0, 1 - (s - C.HAUL) / (C.SETTLE - C.HAUL));
      c.lift = 0.22 * inb;
    }
  }, () => {
    const v = kit.piece(to);
    if (v) {
      v.group.position.copy(dest);
      v.group.quaternion.identity();
      v.animating = false;
    }
    const c = kit.piece(from);
    if (c) c.lift = 0;
  });

  rope(kit, ctx, 1, delay);
  if (!sweeping) rope(kit, ctx, -1, delay);

  const GOLD = 'rgba(255,225,150,1)';
  const bit = held.clone().setY(held.y + 0.1);
  // iron leaving the captor, iron landing, and then the beat the whole motif
  // is built around: the snap, where the slack goes and the card is caught
  burst(kit, ctx.anchor(0), {
    colour: GOLD, count: 5, spread: 0.45, rise: 0.5, size: 0.22,
    delay, life: 0.35, total: C.TOTAL + delay,
  });
  burst(kit, bit, {
    colour: GOLD, count: 6, spread: 0.7, rise: 0.5, size: 0.18,
    delay: delay + C.THROW, life: 0.4, total: C.TOTAL + delay,
  });
  glow(kit, bit, 0xffd9a0, { power: 3.5, delay: delay + C.THROW, life: 0.3, total: C.TOTAL + delay, reach: 3.2 });
  burst(kit, bit, {
    colour: GOLD, count: 8, spread: 1.2, rise: 0.9, size: 0.16,
    delay: delay + C.CINCH, life: 0.5, total: C.TOTAL + delay,
  });
  // a small, close light. A bright one blew the whole wrap out to white and
  // the links stopped reading as separate pieces of iron at the one moment
  // they most need to
  glow(kit, held.clone().setY(held.y + 0.55), 0xfff0cc,
    { power: 4, delay: delay + C.CINCH, life: 0.26, total: C.TOTAL + delay, reach: 3.2 });
  // dust, where the card grounds out under its captor
  burst(kit, dest.clone().setY(dest.y + 0.04), {
    colour: 'rgba(214,196,164,1)', count: 12, spread: 1.4, rise: 0.22, size: 0.32,
    delay: delay + C.SETTLE, life: 0.5, total: C.TOTAL + delay, gravity: 0.4,
  });

  // Rings go through anim.fx, which is the one list that CAN be added to from
  // inside a tick, so these two are allowed to stay on a delay.
  kit.after(delay + C.CINCH, () => kit.ring(held.clone().setY(0.12), 0xbfa87a, { size: 2.1, seconds: 0.4 }));
  kit.after(delay + C.SETTLE, () => kit.ring(dest.clone().setY(0.12), 0x9a8d78, { size: 2.5, seconds: 0.45 }));
}

/* ------------------------------------------------------------ the brand */

/** Brand timeline, in seconds — phase boundaries, not durations. */
const B = {
  FALL: 0.42,    // the iron comes down out of the light
  PRESS: 0.9,    // held against the card, smoking
  CLEAR: 1.16,   // pulled away
  COOL: 1.72,    // the mark going from white to black
  TOTAL: 2.1,
};

// An O with four spikes, burned into the card. Painted once and kept: every
// convict in a game asks for the same mark, and canvas work is not free.
let markTex = null;
function brandMark() {
  if (markTex) return markTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';

  // a scorched halo first, so the burn has a smeared edge rather than a cut one
  g.shadowColor = 'rgba(255,255,255,0.55)';
  g.shadowBlur = 15;

  const rough = (r, a) => r * (1 + 0.045 * Math.sin(a * 5.3 + 1.1) + 0.03 * Math.sin(a * 11 + 0.4));
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r = rough(68, a);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.lineWidth = 20;
    g.stroke();

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dx = Math.cos(a), dy = Math.sin(a);
      g.beginPath();
      g.moveTo(dx * 58 - dy * 14, dy * 58 + dx * 14);
      g.lineTo(dx * 120, dy * 120);
      g.lineTo(dx * 58 + dy * 14, dy * 58 - dx * 14);
      g.closePath();
      g.fill();
    }
    g.shadowBlur = 0;         // the second pass lays a crisp iron edge on top
  }

  // pitting: a hot iron never burns evenly, and a perfect stamp looks printed
  g.globalCompositeOperation = 'destination-out';
  let seed = 9;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 52 + rnd() * 62;
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, 3 + rnd() * 7, 0, Math.PI * 2);
    g.fill();
  }

  markTex = new THREE.CanvasTexture(c);
  markTex.colorSpace = THREE.SRGBColorSpace;
  return markTex;
}

let smokeTex = null;
const smokePuff = () => (smokeTex
  ||= blobTexture('rgba(176,166,154,0.5)', 'rgba(120,112,104,0)'));

/**
 * The iron itself: an O with four spikes, on the end of a shank.
 *
 * Head and shank are separate materials so the working end can be white hot
 * while the shaft stays dark. One glowing material for the whole tool looked
 * like a neon sign rather than metal out of a fire.
 */
function brandIron() {
  const group = new THREE.Group();
  const head = new THREE.MeshStandardMaterial({
    color: 0x2b2320, emissive: 0xffc98a, emissiveIntensity: 2.4,
    metalness: 0.6, roughness: 0.42, transparent: true,
  });
  const cold = new THREE.MeshStandardMaterial({
    color: 0x2e2722, emissive: 0x551e06, emissiveIntensity: 0.3,
    metalness: 0.75, roughness: 0.6, transparent: true,
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.072, 8, 26), head);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    // Euler XYZ applies Z first, so this stands the cylinder on its side and
    // then swings it out to its bearing — the order board.js uses for its own
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.085, 0.31, 6), head);
    spike.position.set(Math.cos(a) * 0.43, 0, Math.sin(a) * 0.43);
    spike.rotation.z = -Math.PI / 2;
    spike.rotation.y = -a;
    group.add(spike);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.08, 8), cold);
  collar.position.y = 0.11;
  group.add(collar);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 1.2, 7), cold);
  shank.position.y = 0.72;
  group.add(shank);

  return { group, head, cold };
}

/** The mark left on the card: white hot, then orange, then char. */
function scorch(at, yaw) {
  const tex = brandMark();
  const heat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const char = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, color: 0x1a0f09, opacity: 0,
  });
  const group = new THREE.Group();
  for (const m of [char, heat]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.24), m);
    q.rotation.x = -Math.PI / 2;
    q.renderOrder = m === char ? 11 : 12;
    group.add(q);
  }
  group.position.copy(at);
  group.position.y += 0.024;
  group.rotation.y = yaw;
  return { group, heat, char };
}

/** Smoke off a burn: slow, thickening, drifting, never symmetrical. */
function smoke(kit, at, { count = 16, delay = 0, total = 1 }) {
  const tex = smokePuff();
  const grp = new THREE.Group();
  const born = [], drift = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    }));
    const a = Math.random() * Math.PI * 2;
    const r = 0.1 + Math.random() * 0.44;
    s.position.set(at.x + Math.cos(a) * r, at.y + 0.04, at.z + Math.sin(a) * r);
    born.push(delay + (i / count) * (total - delay) * 0.62);
    drift.push(new THREE.Vector3(Math.cos(a) * 0.3 + 0.12, 0.55 + Math.random() * 0.45,
      Math.sin(a) * 0.3));
    grp.add(s);
  }
  kit.hold(grp, total, (t) => {
    const s = t * total;
    for (let i = 0; i < grp.children.length; i++) {
      const sp = grp.children[i];
      const k = (s - born[i]) / (total - born[i]);
      if (k <= 0) { sp.material.opacity = 0; continue; }
      sp.position.addScaledVector(drift[i], 0.011);
      sp.scale.setScalar(0.28 + k * 1.2);
      // thinning as it climbs and spreads is the only thing that stops this
      // from looking like a grey balloon parked over the card
      sp.material.opacity = Math.min(1, k * 5) * (1 - k) * 0.5;
    }
  });
}

/**
 * THE BRAND — a hot iron pressed onto the card.
 *
 * The beats are the ones a real branding has and the old version had none of:
 * it falls, it LANDS (flash, sparks, the card flinching under it), it is held
 * there smoking, it is pulled away, and only then is the mark visible — white,
 * then orange, then dark char that fades. The cooling is the whole point; a
 * mark that appears and disappears at the same colour is a decal.
 */
export function brand(kit, target) {
  const at = kit.at(target);
  if (!at) return;
  const yaw = 0.18;
  const iron = brandIron();
  const rest = at.y + 0.1;                 // the ring's tube lying on the face
  iron.group.position.copy(at).setY(rest + 2.4);
  iron.group.rotation.y = yaw + 0.9;

  // A shaft of hard white light, because a Refractory tool does not simply
  // appear on the table: it comes down out of the inquisitor's own light.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.85, 3.4, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0cc, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.copy(at).setY(at.y + 1.7);
  kit.hold(beam, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    beam.material.opacity = s < B.FALL
      ? 0.22 * easeOut(s / B.FALL)
      : 0.22 * Math.max(0, 1 - (s - B.FALL) / 0.45) ** 2;
  });

  const mark = scorch(at, yaw);
  mark.group.visible = false;
  kit.hold(mark.group, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.FALL) return;
    mark.group.visible = true;
    const k = Math.min(1, Math.max(0, (s - B.CLEAR) / (B.COOL - B.CLEAR)));
    const hot = 1 - k;
    const out = s > B.COOL ? Math.max(0, 1 - (s - B.COOL) / (B.TOTAL - B.COOL)) : 1;
    // white -> yellow -> orange -> dull red, which is iron losing its heat
    mark.heat.color.setRGB(1, 0.95 - 0.6 * k * k, Math.max(0, 0.8 - 2 * k));
    mark.heat.opacity = (s < B.CLEAR ? 1 : 0.3 + 0.7 * hot * hot) * out;
    mark.char.opacity = Math.min(0.85, (s - B.FALL) * 2.2) * out;
  });

  kit.hold(iron.group, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.FALL) {
      // dropped, not lowered: slow at the top, fast into the card
      const k = s / B.FALL;
      iron.group.position.y = rest + 2.4 * (1 - easeIn(k));
      iron.group.rotation.y = yaw + 0.9 * (1 - easeOut(k));
      iron.head.emissiveIntensity = 2.4 + 0.9 * k;
    } else if (s < B.PRESS) {
      // pressed hard and held; the shudder is the hand behind it
      const k = (s - B.FALL) / (B.PRESS - B.FALL);
      iron.group.position.y = rest - 0.03 * Math.exp(-k * 7) + 0.004 * Math.sin(s * 47);
      iron.group.rotation.y = yaw;
      iron.head.emissiveIntensity = 3.3 - 0.6 * k;
    } else {
      // lifted straight off, and gone before it can be looked at too closely
      const k = Math.min(1, (s - B.PRESS) / 0.5);
      iron.group.position.y = rest + easeIn(k) * 2.4;
      iron.head.emissiveIntensity = 2.7 * (1 - k);
      iron.head.opacity = Math.max(0, 1 - k * 1.4);
      iron.cold.opacity = Math.max(0, 1 - k * 1.4);
      iron.group.visible = k < 1;
    }
  });

  // The card takes the press: down under the iron, then back with a wobble.
  const home = restOf(kit.piece(target)) || at.clone();
  kit.hold(new THREE.Object3D(), B.PRESS + 0.4, (t) => {
    const s = t * (B.PRESS + 0.4);
    const p = kit.piece(target);
    if (!p || s < B.FALL - 0.02) return;
    p.animating = true;
    const k = s - B.FALL;
    p.group.position.copy(home);
    p.group.position.y -= 0.035 * Math.exp(-k * 4.5) * Math.cos(k * 13);
  }, () => {
    const p = kit.piece(target);
    if (p) { p.group.position.copy(home); p.animating = false; }
  });

  // contact, and then the iron dragging a little of the burn up with it
  glow(kit, at.clone().setY(at.y + 0.3), 0xfff2d2,
    { power: 26, delay: B.FALL, life: 0.4, total: B.TOTAL, reach: 6 });
  burst(kit, at.clone().setY(at.y + 0.07), {
    colour: 'rgba(255,190,110,1)', count: 18, spread: 1.15, rise: 0.8, size: 0.28,
    delay: B.FALL, life: 0.55, total: B.TOTAL,
  });
  burst(kit, at.clone().setY(at.y + 0.1), {
    colour: 'rgba(255,150,70,1)', count: 7, spread: 0.25, rise: 1.5, size: 0.2,
    delay: B.PRESS, life: 0.6, total: B.TOTAL, gravity: 0.2,
  });
  glow(kit, at.clone().setY(at.y + 0.25), 0xff9a4a,
    { power: 9, delay: B.PRESS, life: 0.5, total: B.TOTAL, reach: 5 });
  smoke(kit, at, { count: 18, delay: B.FALL, total: B.TOTAL });
  kit.after(B.FALL, () => kit.ring(at.clone().setY(at.y + 0.03), 0xffb469,
    { size: 2.2, seconds: 0.45 }));
}
