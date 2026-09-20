// CHAINS — Refractory hauls people about in irons.
//
// One effect, one file. The links and their metal live in ../iron-kit.js.

import { THREE, CARD_W, CARD_H, easeOut, easeIn, easeInOut } from '../kit.js';
import { C, UP, _aim, burst, glow, restOf, rope, support } from '../iron-kit.js';

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
