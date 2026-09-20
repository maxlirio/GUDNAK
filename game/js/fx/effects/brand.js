// THE BRAND — white-hot iron pressed onto a card, smoking, then cooling.
//
// One effect, one file. The sparks and the flash come from ../iron-kit.js,
// which Refractory's chains share.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=450" \
//             --eval tools/fxdemo/brand.js --out /tmp/b.png --settle 500
// `t` is the point in the MOTIF to freeze at, in ms, and `two=1` fires it on
// two cards at once the way the Lord High Inquisitor's Sentence does. See the
// harness for why --settle alone lies about where on the timeline a shot was
// taken.
//
// A brand is a tool, not a spell. It is heated somewhere off the table, it is
// brought down by a hand, it BITES, it is held there while the card blackens
// under it, and it is lifted. Only then is the mark there to be seen, and the
// mark is the point: white, then yellow, then orange, then a dull red ember
// that dies. A mark that appears and vanishes at one colour is a decal, and
// that is exactly what the first version read as.
//
// The Convicted of Heresy card is attached right behind this, so the whole
// thing is over in a little over a second. Everything below is timed against
// that: there is no room for a slow descent or a leisurely fade.

import { THREE, CARD_W, easeOut, easeIn } from '../kit.js';
import { blobTexture } from '../../textures.js';
import { burst, glow, restOf } from '../iron-kit.js';

/** Brand timeline, in seconds — phase boundaries, not durations. */
const B = {
  FALL: 0.17,    // the iron comes down and bites
  CLEAR: 0.60,   // held there smoking, then lifted and the mark uncovered
  COOL: 0.98,    // white -> orange -> dull red
  TOTAL: 1.24,   // the ember gone, the last smoke still going
};

// A card is 63 SCREEN PIXELS wide from the game's camera, and that one number
// settles every proportion here.
//
// Two goes at this failed on it. At 0.64 of the card the mark was 40px across
// and dissolved into a smudge. Made bigger but kept heavy — a 5:1 ring, stroke
// to diameter — it filled in and became a red starfish with no hole, because
// at forty-odd pixels a thick annulus simply closes up. The gate brand already
// painted on every tile of this board is the proof of what does work: a WIDE,
// THIN ring in one flat colour. So the mark is thin line-art nearly as wide as
// the card, and it gets its contrast from the black burn under it rather than
// from weight of stroke.
const MARK_SIZE = CARD_W * 0.86;

// The mark's proportions, as fractions of MARK_SIZE, shared by the canvas that
// paints the burn and the mesh that presses it — they are the same tool.
const RING_R = 0.30;               // radius of the O
const RING_T = 0.030;              // half the stroke width
const SPIKE_IN = 0.25;             // where a spike leaves the ring
const SPIKE_OUT = 0.46;            // and where its point is — inside 0.5, so
                                   // the blurred copy is not clipped by the
                                   // edge of its own canvas
const SPIKE_W = 10.5;              // half-width of a spike at its base, in
                                   // canvas pixels out of 256. At 9 the points
                                   // thinned out of existence once the mark
                                   // cooled off white and lost its halo

/* ------------------------------------------------------- the mark, painted */

// An O with four spikes. Painted once and kept: every conviction in a game
// asks for the same mark and canvas work is not free.
//
// Two textures, not one: `crisp` is the iron edge and `bloom` is the same
// shape bled outwards. Layering them is the only way to get the falloff hot
// metal has, because this renderer has no bloom pass of its own.
let MARK = null;
function markTextures() {
  if (MARK) return MARK;

  // the shape, drawn into whatever context it is handed
  const paint = (g, ringW, spikeW) => {
    const R = RING_R * 256;
    const rough = (a) => R * (1 + 0.05 * Math.sin(a * 5.3 + 1.1)
                                + 0.028 * Math.sin(a * 11 + 0.4));
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      const r = rough(a);
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.lineWidth = ringW;
    g.stroke();
    // Spikes on the diagonals, so none of them runs parallel to a card edge —
    // on the cardinals the top and bottom spike lined up with the card's own
    // border and the mark read as part of the card frame.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dx = Math.cos(a), dy = Math.sin(a);
      const i0 = SPIKE_IN * 256, i1 = SPIKE_OUT * 256;
      g.beginPath();
      g.moveTo(dx * i0 - dy * spikeW, dy * i0 + dx * spikeW);
      g.lineTo(dx * i1, dy * i1);
      g.lineTo(dx * i0 + dy * spikeW, dy * i0 - dx * spikeW);
      g.closePath();
      g.fill();
    }
  };

  const make = (blur, ringW, spikeW, passes) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    if (blur) { g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = blur; }
    for (let p = 0; p < passes; p++) paint(g, ringW, spikeW);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { ctx: g, tex: t };
  };

  const W = RING_T * 512;
  const crisp = make(0, W, SPIKE_W, 1);
  // The char is painted FATTER than the heat on purpose. A thin bright line
  // over card art is invisible at this size whatever colour it is; a black
  // keyline either side of it is what makes line-art read on a busy ground,
  // and it doubles as the scorch spreading past the edge of the iron.
  const wide = make(0, W * 2.4, SPIKE_W * 2.1, 1);
  const bloom = make(14, W, SPIKE_W, 2);

  // Pitting, punched through the crisp layer only. A hot iron never burns
  // evenly and a perfect stamp looks printed; the bloom layer keeps its halo
  // continuous underneath so the gaps read as pits, not as a broken ring.
  const g = crisp.ctx;
  g.globalCompositeOperation = 'destination-out';
  let seed = 9;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  // small pits only: at the stroke width this ring is now drawn at, an 8px
  // bite takes the ring out altogether and leaves a broken C
  for (let i = 0; i < 20; i++) {
    const a = rnd() * Math.PI * 2, r = (SPIKE_IN * 0.9 + rnd() * SPIKE_OUT) * 256;
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6 + rnd() * 3.4, 0, Math.PI * 2);
    g.fill();
  }
  crisp.tex.needsUpdate = true;

  MARK = { crisp: crisp.tex, wide: wide.tex, bloom: bloom.tex };
  return MARK;
}

let smokeTex = null;
// Nearly opaque at the core. At 0.62 the puffs were there in the scene graph
// and invisible on screen: a sprite's material opacity MULTIPLIES the alpha
// already in the texture, so a 0.6 texture at 0.3 opacity is 0.18 of a pale
// grey over pale stone, which is nothing at all.
const smokePuff = () => (smokeTex
  ||= blobTexture('rgba(216,205,190,0.95)', 'rgba(104,96,90,0)'));

let emberTex = null;
const emberPuff = () => (emberTex
  ||= blobTexture('rgba(255,170,80,1)', 'rgba(255,90,20,0)'));

/* -------------------------------------------------------------- the tool */

/**
 * The iron itself: an O with four spikes, on the end of a shank.
 *
 * Head and shank are separate materials so the working end can be white hot
 * while the shaft stays dark and cold. One glowing material for the whole tool
 * looked like a neon sign rather than metal out of a fire.
 */
function brandIron() {
  const group = new THREE.Group();
  const head = new THREE.MeshStandardMaterial({
    color: 0x30231c, emissive: 0xffd9a0, emissiveIntensity: 3.2,
    metalness: 0.55, roughness: 0.45, transparent: true,
  });
  // There is no environment map in this scene and the braziers are low, so a
  // physically metallic shank renders as a black silhouette lit by nothing.
  // Grey base, part metal, a trace of cold emissive — the same compromise the
  // chains are built on.
  const cold = new THREE.MeshStandardMaterial({
    color: 0x6f6a64, metalness: 0.7, roughness: 0.5,
    emissive: 0x3a2a1c, emissiveIntensity: 0.35, transparent: true,
  });

  // The head is cut to the same numbers the burn is painted from, so what
  // presses down and what is left behind are one shape.
  const M = MARK_SIZE;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(M * RING_R, M * RING_T, 8, 28), head);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const len = M * (SPIKE_OUT - SPIKE_IN);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    // Euler XYZ applies Z first, so this stands the cylinder on its side and
    // then swings it out to its bearing — the order board.js uses for its own
    const spike = new THREE.Mesh(
      new THREE.CylinderGeometry(M * 0.012, M * RING_T * 1.25, len, 6), head);
    spike.position.set(Math.cos(a) * M * (SPIKE_IN + SPIKE_OUT) * 0.5, 0,
      Math.sin(a) * M * (SPIKE_IN + SPIKE_OUT) * 0.5);
    spike.rotation.z = -Math.PI / 2;
    spike.rotation.y = -a;
    group.add(spike);
  }
  // The collar is the last hot part and the shank is stone cold, which is
  // what says the heat is in the WORKING END and the rest is a handle someone
  // is holding. One material for the whole tool read as a neon sign.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.115, 0.08, 8), head);
  collar.position.y = 0.09;
  group.add(collar);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.05, 1.5, 7), cold);
  shank.position.y = 0.86;
  group.add(shank);

  return { group, head, cold };
}

/* ------------------------------------------------------------- the mark */

/**
 * What is left on the card: a dark burn, the live heat sitting in it, and a
 * soft halo over the top.
 *
 * The heat layer is NOT additive. Additive white over card art has no edge —
 * it washed out into a pale blob and the ring and its spikes disappeared
 * entirely, which is the single thing this effect exists to show. Hot metal is
 * opaque and lights itself, so the mark is painted OVER the art at full
 * coverage and only the halo around it adds.
 */
function scorch(at, yaw) {
  const { crisp, wide, bloom } = markTextures();
  const char = new THREE.MeshBasicMaterial({
    map: wide, transparent: true, depthWrite: false, color: 0x120a05, opacity: 0,
  });
  const heat = new THREE.MeshBasicMaterial({
    map: crisp, transparent: true, depthWrite: false, opacity: 0,
  });
  const halo = new THREE.MeshBasicMaterial({
    map: bloom, transparent: true, depthWrite: false, opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Group();
  const quad = (m, size, order) => {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    q.rotation.x = -Math.PI / 2;
    q.renderOrder = order;
    group.add(q);
    return q;
  };
  quad(char, MARK_SIZE, 11);
  // The halo is deliberately barely wider than the mark. At 1.3x and full
  // strength it stopped being a halo and became a warm blob with the ring
  // lost inside it — the failure this effect kept coming back to.
  quad(halo, MARK_SIZE * 1.1, 12);
  quad(heat, MARK_SIZE, 13);
  group.position.copy(at);
  // Well clear of the card face, not a hair above it. `kit.at` gives the card
  // GROUP's origin and the face sits half the card's thickness above that, so
  // a mark at +0.026 had eight thousandths of a unit of headroom — and the
  // flinch below lifts the card by more than that on the rebound, which sank
  // the mark under its own card and left it showing only on the stone around
  // the edges. This is the one place in the effect the brand must never vanish.
  group.position.y += 0.055;
  group.rotation.y = yaw;
  return { group, char, heat, halo };
}

/* ------------------------------------------------------------- the smoke */

/**
 * Smoke off a burn: it comes off the RIM of the iron, not out of a point, and
 * it thins as it climbs. Position is computed from absolute time rather than
 * accumulated per tick — the old version added a fixed step every frame, so it
 * drifted three times as fast under a fast clock and barely moved at six
 * frames a second, which is exactly the rate the headless preview runs at.
 */
function smoke(kit, at, {
  count = 16, delay = 0, spread = 0.26, life = 0.6, total = 1, radius = 0.45,
}) {
  const tex = smokePuff();
  const grp = new THREE.Group();
  const born = [], drift = [], from = [], spin = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    }));
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.9;
    const r = radius * (0.7 + Math.random() * 0.55);
    from.push(new THREE.Vector3(at.x + Math.cos(a) * r, at.y + 0.05, at.z + Math.sin(a) * r));
    s.position.copy(from[i]);
    // Every puff is born in the first quarter-second and lives a fixed span,
    // so the smoke is thickest while the iron is on the card and thinning by
    // the time it lifts. Spread over the whole motif instead, it was still
    // arriving after the iron had gone, which reads as fog, and it greyed out
    // the mark at exactly the moment the mark is the thing to look at.
    born.push(delay + (i / count) * spread + Math.random() * 0.05);
    // It leans off the card as it climbs, rather than sitting on the face.
    drift.push(new THREE.Vector3(Math.cos(a) * 0.32 + 0.4, 1.15 + Math.random() * 0.6,
      Math.sin(a) * 0.32 - 0.2));
    spin.push(Math.random() * 6.3);
    grp.add(s);
  }
  kit.hold(grp, total, (t) => {
    const s = t * total;
    for (let i = 0; i < grp.children.length; i++) {
      const sp = grp.children[i];
      const k = (s - born[i]) / life;
      if (k <= 0 || k >= 1) { sp.material.opacity = 0; continue; }
      sp.position.copy(from[i]).addScaledVector(drift[i], k * life);
      sp.position.x += Math.sin(spin[i] + k * 3.2) * 0.07 * k;
      sp.scale.setScalar(0.17 + k * 0.95);
      // thinning as it climbs and spreads is the only thing that keeps this
      // from being a grey balloon parked over the card
      sp.material.opacity = Math.min(1, k * 7) * (1 - k) ** 1.4 * 0.95;
    }
  });
}

/* ------------------------------------------------------------- the embers */

/**
 * Embers lifting off the burnt line as the iron clears. They are born ON the
 * ring, drift up slowly and wander, and they die orange — sparks that fly out
 * flat belong to the moment of the strike, not to a mark already burning.
 */
function embers(kit, at, radius, { count = 9, delay = 0, total = 1 }) {
  const tex = emberPuff();
  const grp = new THREE.Group();
  const from = [], vel = [], phase = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.7;
    const r = radius * (0.8 + Math.random() * 0.5);
    from.push(new THREE.Vector3(at.x + Math.cos(a) * r, at.y + 0.05, at.z + Math.sin(a) * r));
    vel.push(new THREE.Vector3(Math.cos(a) * 0.12, 0.5 + Math.random() * 0.5,
      Math.sin(a) * 0.12));
    phase.push(Math.random() * 6.3);
    s.position.copy(from[i]);
    s.scale.setScalar(0.11);
    grp.add(s);
  }
  const life = total - delay;
  kit.hold(grp, total, (t) => {
    const s = t * total;
    const k = (s - delay) / life;
    grp.visible = k > 0 && k < 1;
    if (!grp.visible) return;
    for (let i = 0; i < grp.children.length; i++) {
      const sp = grp.children[i];
      sp.position.copy(from[i]).addScaledVector(vel[i], k * life);
      sp.position.x += Math.sin(phase[i] + k * 7) * 0.03;
      sp.material.opacity = 0.9 * (1 - k) ** 1.4 * Math.min(1, k * 7);
      sp.scale.setScalar(0.11 * (1 - k * 0.45));
    }
  });
}

/* -------------------------------------------------------------- the beat */

export function brand(kit, target) {
  const at = kit.at(target);
  if (!at) return;

  // Every brand is struck a little differently: a hand holds this, and two
  // convictions in the same breath landing at the same angle read as one
  // texture stamped twice.
  const yaw = 0.14 + (Math.random() - 0.5) * 0.6;

  const iron = brandIron();
  const rest = at.y + 0.115;               // the ring's tube lying on the face
  // Not far. The camera is 19 units up and looking down a steep diagonal, so
  // anything lifted high off a card projects a long way from it: from 2.6 the
  // iron came in from the top corner of the screen and read as a separate
  // object falling past, not as something aimed at this card.
  const HIGH = 1.25;
  iron.group.position.copy(at).setY(rest + HIGH);
  iron.group.rotation.set(0, yaw + 0.9, 0);

  // A thin shaft of hard light the iron comes down: a Refractory tool does not
  // simply appear on the table. Kept narrow and brief — a wide cone laid a
  // flat white wedge across the stone beside the card and read as paper.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.42, HIGH + 0.5, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0cc, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.copy(at).setY(at.y + (HIGH + 0.5) * 0.5);
  kit.hold(beam, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    beam.material.opacity = s < B.FALL
      ? 0.16 * easeOut(s / B.FALL)
      : 0.16 * Math.max(0, 1 - (s - B.FALL) / 0.22) ** 2;
  });

  /* ---- the mark. Hidden under the iron until it lifts, bar the heat that
     leaks out around the head while it is pressed down. ---- */
  const mark = scorch(at, yaw);
  kit.hold(mark.group, B.TOTAL, (t) => {
    const s = t * B.TOTAL;
    if (s < B.FALL) { mark.group.visible = false; return; }
    mark.group.visible = true;

    // k = 0 at white heat, 1 when the ember is out
    const k = Math.min(1, Math.max(0, (s - B.CLEAR) / (B.COOL - B.CLEAR)));
    const hot = 1 - k;
    const out = s > B.COOL ? Math.max(0, 1 - (s - B.COOL) / (B.TOTAL - B.COOL)) : 1;
    // White -> yellow -> orange -> dull red: iron losing its heat. Blue goes
    // first and fast, green after it, and red holds on to the end.
    //
    // These are LINEAR values — `setRGB` writes straight into the working
    // space — and that is the whole trap. A green of 0.75 linear is 0.89 on
    // screen, so a ramp that looked like it was already well into orange was
    // still emitting nearly pure yellow; over the black char under it the mark
    // spent its entire cooling half a flat olive green. The powers below are
    // chosen against the SCREEN values, not the numbers.
    const r = 1.6 - 1.25 * k ** 1.6;
    mark.heat.color.setRGB(r, 1.5 * (1 - k) ** 3.2, 1.3 * (1 - k) ** 7);
    mark.halo.color.setRGB(1, 0.75 * (1 - k) ** 2.2 + 0.12, 0.6 * (1 - k) ** 5);

    // under the iron the mark is covered; only the halo shows round the edges
    const open = s < B.CLEAR ? 0 : Math.min(1, (s - B.CLEAR) / 0.07);
    // Cooling is done with COLOUR, not with opacity. Hot metal does not go
    // see-through as it cools, it goes dark, and fading the glow out instead
    // let the black char underneath dilute the line into mud.
    mark.heat.opacity = open * out;
    mark.halo.opacity = (s < B.CLEAR ? 0.12 * (s - B.FALL) / (B.CLEAR - B.FALL)
      : 0.08 + 0.2 * hot ** 2) * out;
    // The char deepens as the glow goes down — the burn outlives the heat —
    // but it never starts from nothing. Half of it is there from the first
    // moment, because the black keyline under the bright line is the only
    // thing holding the mark together on a PALE card: on cream-coloured art a
    // gold ring with no outline all but disappeared, and the Lord High
    // Inquisitor's Sentence brands two cards at once with no say in which.
    mark.char.opacity = Math.min(1, (s - B.FALL) * 3.4) * (0.5 + 0.5 * k) * (0.3 + 0.7 * out);
  });

  /* ---- the tool ---- */
  const ironLife = B.CLEAR + 0.3;
  kit.hold(iron.group, ironLife, (t) => {
    const s = t * ironLife;
    if (s < B.FALL) {
      // dropped, not lowered: slow at the top, hard into the card
      const k = s / B.FALL;
      iron.group.position.y = rest + HIGH * (1 - easeIn(k));
      iron.group.rotation.y = yaw + 0.9 * (1 - easeOut(k));
      iron.head.emissiveIntensity = 1.5 + 0.5 * k;
    } else if (s < B.CLEAR) {
      // pressed hard and held; the shudder is the hand behind it
      const k = (s - B.FALL) / (B.CLEAR - B.FALL);
      iron.group.position.y = rest - 0.03 * Math.exp(-k * 8) + 0.004 * Math.sin(s * 55);
      iron.group.rotation.y = yaw;
      // it gives its heat to the card, so it dulls while it is held there
      iron.head.emissiveIntensity = 2.2 - 0.9 * k;
      iron.head.color.setRGB(0.19 * (1 - k), 0.14 * (1 - k), 0.11 * (1 - k));
    } else {
      // lifted straight off and gone before it can be looked at too closely
      const k = Math.min(1, (s - B.CLEAR) / 0.3);
      iron.group.position.y = rest + easeIn(k) * HIGH * 1.6;
      iron.head.emissiveIntensity = 1.3 * (1 - k);
      iron.head.opacity = Math.max(0, 1 - k * 1.5);
      iron.cold.opacity = Math.max(0, 1 - k * 1.5);
      iron.group.visible = k < 1;
    }
  });

  /* ---- the card takes the press: knocked down, then back with a wobble ---- */
  const home = restOf(kit.piece(target)) || at.clone();
  const flinch = B.CLEAR + 0.4;
  kit.hold(new THREE.Object3D(), flinch, (t) => {
    const s = t * flinch;
    const p = kit.piece(target);
    if (!p || s < B.FALL - 0.02) return;
    // set every tick, not once: the board's own move tween clears this flag
    // when it ends and the card was snapping home mid-press
    p.animating = true;
    const k = s - B.FALL;
    p.group.position.copy(home);
    p.group.position.y -= 0.05 * Math.exp(-k * 5) * Math.cos(k * 15);
  }, () => {
    const p = kit.piece(target);
    if (p) { p.group.position.copy(home); p.animating = false; }
  });

  /* ---- contact, heat, and what comes off it ---- */
  // A hard white flash at the bite, then a warm one while the mark burns.
  //
  // HEIGHT, not power, is what these two are tuned on. A point light decays
  // with the square of the distance, so 26 candela sitting 0.26 above the card
  // face put ~380 units of light on the square inch under it: a blown-out
  // white disc that swallowed the ring and its spikes whole, and read as the
  // mark being a featureless blob. Lifted to about a card's width up they wash
  // the whole face evenly, which is what a thing glowing ON the card does.
  glow(kit, at.clone().setY(at.y + 1.05), 0xfff1d4,
    { power: 11, delay: B.FALL, life: 0.26, total: B.TOTAL, reach: 5 });
  glow(kit, at.clone().setY(at.y + 0.75), 0xff8a38,
    { power: 3.2, delay: B.CLEAR, life: 0.45, total: B.TOTAL, reach: 4 });

  // scale flung sideways off the face on contact: flat and fast, because it is
  // struck out of the card, not poured up out of it
  burst(kit, at.clone().setY(at.y + 0.07), {
    colour: 'rgba(255,208,138,1)', count: 22, spread: 1.15, rise: 0.55, size: 0.17,
    delay: B.FALL, life: 0.36, total: B.TOTAL, gravity: 0.75,
  });
  // ...and a few embers dragged up with the iron as it clears. They lift off
  // the RING, not the centre: iron-kit's burst starts everything near one
  // point, and nine sprites rising together put a white dot in the middle of
  // the mark and hid the shape it exists to show.
  embers(kit, at, MARK_SIZE * RING_R, { count: 9, delay: B.CLEAR, total: B.TOTAL });

  smoke(kit, at, {
    count: 16, delay: B.FALL, spread: 0.26, life: 0.62, total: B.TOTAL,
    radius: MARK_SIZE * RING_R,
  });

  // the shock of the press running out across the stone. Lifted the same way
  // the mark is: at +0.03 its first frames were inside the card it started on.
  kit.after(B.FALL, () => kit.ring(at.clone().setY(at.y + 0.07), 0xffc078,
    { size: 1.7, seconds: 0.34 }));
}
