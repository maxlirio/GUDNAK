// THE USHER — a way is opened, and you are walked down it.
//
// Shared by 4 cards: M007, M027, M203, M200.
// One motif, one file — worked on on its own.
//
// The brief is one word: POLITE. This fires on ordinary board traffic — a
// guard nudging someone off his flank, a villager bowing out — so it has to be
// a gesture and not an event. ../earth.js already owns the violent version of
// the same sentence: broken paving, stone in the air, a body dragged a square.
// Nothing here breaks, is thrown, or dies.
//
// WHAT IT IS: two low rails of tide-water rise out of the flagstones either
// side of the fighter and run forward exactly one square, a lane held open. A
// small bow wave walks down it and stops on the far square, leaving wet stone
// and a little foam behind it, and then the rails sink back the way they came,
// near end first, so the last thing left on screen is the end he arrived at.
// The length of the lane IS the rule — one square, measured off the board
// rather than invented — and it is aimed at a real neighbouring square, an
// empty one by choice.
//
// WHAT IT IS NOT: a wave over the card. The first two passes built one — a
// bowed crest with a foam lip that crossed the fighter and carried on — and it
// looked well enough on its own and was USELESS, because ./cast-marvorren.js
// is already a wave crossing a card and fires on half the faction's cards. Two
// motifs cannot own one shape. The lane also keeps clear of the card's
// footprint entirely, so the fighter's art is never covered by it.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=300" \
//             --eval tools/fxdemo/usher.js --out /tmp/u.png --wait 4000 --settle 600
// ?t is milliseconds INTO the motif (see the harness); wall-clock --settle
// lands wherever the headless frame rate feels like on the day, and much past
// 600ms the table's own opening moves on and clears the board under you.

import { THREE, CARD_W } from '../kit.js';
import { STEP } from '../../arena.js';
import { blobTexture } from '../../textures.js';

/* -------------------------------------------------------------- which way */

// Preference order for the step, and it is a LOOKS question, not a rules one:
// the sun sits at (-13,15,9), so a lane running toward +z or -x turns its lit
// flanks to the camera, and a lane toward the camera is the one whose LENGTH
// is easiest to judge at this angle. Away from the camera is last.
const WAYS = [
  { dc: 0, dr: -1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 },
];

/**
 * A real neighbouring square to be ushered onto.
 *
 * Picked rather than assumed, because the whole read of this motif is "ONE
 * square" and the lane has to stop where a square stops. An empty one is
 * preferred: a lane laid across an occupied square puts two cards inside one
 * effect, and at this size that reads as a fight rather than as a courtesy.
 */
function step(kit, at) {
  let sq = kit.piece(at)?.square;
  if (sq == null && typeof at === 'number') sq = at;
  if (!(sq >= 0 && sq < 9)) return null;
  const c = sq % 3, r = Math.floor(sq / 3);
  let fallback = null;
  for (const w of WAYS) {
    const nc = c + w.dc, nr = r + w.dr;
    if (nc < 0 || nc > 2 || nr < 0 || nr > 2) continue;
    if (!fallback) fallback = w;
    if (!kit.pieces?.topAt?.(nr * 3 + nc)) return w;
  }
  return fallback;
}

/* -------------------------------------------------------------- the water */

// Marvorren card art is itself blue-green, so hue buys nothing here and the
// rails have to be carried by VALUE: a dark foot, a lit flank, a pale crest.
// Nothing is the faction's bright cyan — that is the colour of a spell going
// off, and this is somebody being shown to their seat.
const DEEP = new THREE.Color(0x07293a);
const MID = new THREE.Color(0x15617a);
const FOAM = new THREE.Color(0x86ccdf);

// The lane, in its own frame: +x runs the way the fighter is going, +z across.
// It starts a little behind the card, so the water comes up AROUND him rather
// than in front of him, and ends on the middle of the next square.
const TAIL = 0.75;              // how far back of centre the rails begin
const LEN = STEP + TAIL;
// Just outside the card's own footprint (half of CARD_W is 0.87). The lane
// must never cross the card: a fighter with water drawn over his art is a
// fighter you cannot read, and this fires often enough that that matters more
// than the effect does.
const SIDE = CARD_W * 0.63;
const BOW = 0.15;               // the rails bow outward in the middle
const WW = 0.22;                // half the width of one rail
const AMP = 0.095;              // how high it stands out of the stone
const NL = 72, NW = 14;         // ribs along the rail, columns across it

// Nothing across the rail changes from frame to frame, so the cross-section is
// sampled once. It is a RIDGE: steep, dark at the foot, pale along the top.
const W = new Float32Array(NW), HG = new Float32Array(NW);
const CV = new Float32Array(NW), FM = new Float32Array(NW), SL = new Float32Array(NW);
const ridge = (w) => Math.exp(-0.5 * (w / 0.60) ** 2);
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
for (let j = 0; j < NW; j++) {
  const w = -1 + (2 * j) / (NW - 1);
  W[j] = w;
  HG[j] = ridge(w);
  CV[j] = smooth((1 - Math.abs(w)) / 0.30);
  FM[j] = Math.exp(-0.5 * (w / 0.20) ** 2) * CV[j];
  SL[j] = ridge(w - 0.12) - ridge(w + 0.12);
}

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.18;
const OPEN = 0.26;                  // the lane has run its full length
const WALK0 = 0.14, WALK1 = 0.62;   // the swell goes down it
const SHUT = 0.70;                  // and it starts closing again

const gaussU = (u, c, s) => Math.exp(-0.5 * ((u - c) / s) ** 2);

/** A grid of quads with room for per-vertex RGBA. */
function railGeo() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NL * NW * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NL * NW * 4), 4));
  const idx = [];
  for (let i = 0; i < NL - 1; i++) {
    for (let j = 0; j < NW - 1; j++) {
      const a = i * NW + j;
      idx.push(a, a + 1, a + NW, a + 1, a + NW + 1, a + NW);
    }
  }
  geo.setIndex(idx);
  return geo;
}

/**
 * The little bow wave that walks down the lane, as a decal.
 *
 * Geometry cannot do this at card size — the thing is a couple of pixels deep
 * — so it is drawn: a soft pale arc bulging the way it is going, with a wider,
 * dimmer wash behind it for the water it is dragging. Blurred, because a
 * crisp-edged arc is a logo.
 */
let BOWTEX = null;
function bowTexture() {
  if (BOWTEX) return BOWTEX;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  g.shadowColor = 'rgba(255,255,255,1)';
  // The wash first, then the crest over it: the crest has to be the brightest
  // thing in the sprite or the whole decal is a smudge.
  g.shadowBlur = 22; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 15;
  g.beginPath(); g.arc(6, 64, 74, -0.95, 0.95); g.stroke();
  g.shadowBlur = 7; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 5;
  g.beginPath(); g.arc(18, 64, 78, -0.8, 0.8); g.stroke();
  // Bitten open in two places, because an unbroken arc is a bracket.
  g.globalCompositeOperation = 'destination-out';
  for (const [x, y, r] of [[92, 34, 15], [86, 92, 12]]) {
    const l = g.createRadialGradient(x, y, 0, x, y, r);
    l.addColorStop(0, 'rgba(255,255,255,0.9)');
    l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  BOWTEX = t;
  return t;
}

let WET = null;
const wetTexture = () => (WET || (WET = blobTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)')));

export function usher(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const way = step(kit, at) || { dc: 0, dr: -1 };
  // z = (1 - row) * STEP, so a step to a LOWER row travels toward the camera.
  const dir = new THREE.Vector3(way.dc, 0, -way.dr).normalize();
  // rotation.y maps local +x onto world (cos y, 0, -sin y).
  const yaw = Math.atan2(-dir.z, dir.x);

  // Flat work sits 0.055 clear of whatever it lies on. At 0.03 — where this
  // started — a decal lands ON the card's face to within a rounding error,
  // loses the depth test (gl.LESS fails on equal) and draws on the stone
  // AROUND the card but not on the card itself.
  const TOP = Math.min(p.y, 0.225) + 0.055;
  const GROUND = 0.08 + 0.055;

  const g = new THREE.Group();
  g.position.copy(p).setY(GROUND);
  g.rotation.y = yaw;

  /* ---------------------------------------------------- the lane it leaves */

  // Wet stone down the middle of the lane, going dark and drying off. The
  // rails say where the way is; this is the only thing that says it was
  // WALKED. Dark, not pale: lit flagstone eats a pale smear, and wet stone is
  // darker than dry stone anyway.
  const marks = [];
  const wet = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const u = i / 9;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: wetTexture(), color: 0x0a2f45, transparent: true, depthWrite: false, opacity: 0,
    }));
    m.rotation.set(-Math.PI / 2, 0, yaw);
    // A step in height, not a ramp: the card's face stands 0.13 above the
    // stone and anything in between lands inside the card and flickers.
    m.position.copy(p).addScaledVector(dir, u * STEP).setY(u < 0.36 ? TOP : GROUND);
    m.scale.set(1.1 + Math.random() * 0.4, 1.2 + Math.random() * 0.4, 1);
    wet.add(m);
    marks.push({ wake: WALK0 + u * (WALK1 - WALK0), alpha: 0.22 + Math.random() * 0.12 });
  }
  kit.hold(wet, SPAN * 1.45, (t) => {
    const u = t * 1.45;                      // this hold outlasts the water
    for (let i = 0; i < marks.length; i++) {
      const a = (u - marks[i].wake) / (1.45 - marks[i].wake);
      wet.children[i].material.opacity = a <= 0 ? 0
        : marks[i].alpha * Math.min(1, a * 7) * Math.max(0, 1 - a) ** 1.4;
    }
  });

  /* ------------------------------------------------------------- the rails */

  // Unlit on purpose: the key light is a warm low sun, and a teal surface lit
  // by it goes grey-green. Every colour below is placed by hand in the vertex
  // attribute and the form is carried by the slope shade.
  const rails = [0, 1].map(() => {
    const m = new THREE.Mesh(railGeo(), new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.renderOrder = 2;
    m.frustumCulled = false;
    g.add(m);
    return m;
  });

  // Where each rib of each rail sits, and which way is "across" there. The
  // rails bow outward in the middle and wander a little: two straight parallel
  // lines are a lane marking painted on a road, and the one thing this must
  // not look like is the interface pointing at a square.
  const AX = new Float32Array(NL);
  const AZ = [new Float32Array(NL), new Float32Array(NL)];
  const NX = [new Float32Array(NL), new Float32Array(NL)];
  const NZ = [new Float32Array(NL), new Float32Array(NL)];
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? -1 : 1;
    for (let i = 0; i < NL; i++) {
      const u = i / (NL - 1);
      AX[i] = -TAIL + u * LEN;
      // Wide enough to clear the card at the near end and CLOSING at the far
      // one. Two parallel rails were a pair of brackets round the square and
      // said nothing about where the fighter was going; rails that draw in
      // toward the end of the lane point at the square he arrives on.
      AZ[s][i] = sign * (SIDE * (1 - 0.46 * smooth((u - 0.48) / 0.52))
        + BOW * Math.sin(Math.PI * u) + 0.04 * Math.sin(u * 5.3 + s * 2.1));
    }
    for (let i = 0; i < NL; i++) {
      const a = Math.max(0, i - 1), b = Math.min(NL - 1, i + 1);
      const tx = AX[b] - AX[a], tz = AZ[s][b] - AZ[s][a];
      const len = Math.hypot(tx, tz) || 1;
      NX[s][i] = -tz / len; NZ[s][i] = tx / len;      // across the rail
    }
  }

  // The sun, brought into the lane's own frame so the slope shade is an honest
  // dot product rather than a guess — the motif points a different way on
  // every square, and a baked-in bright side would be wrong three times in
  // four.
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
  const L = new THREE.Vector3(-13, 15, 9).normalize();
  const LX = L.x * cy + L.z * sy, LZ = -L.x * sy + L.z * cy, LY = L.y;

  // It only appears once it is CLEAR of the card (u past about 0.55). Drawn
  // over the fighter it covered the art the rails were routed around to keep
  // visible, and it read as something landing on him rather than as him
  // leaving.
  const bow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.45), new THREE.MeshBasicMaterial({
    map: bowTexture(), color: 0x9fdff0, transparent: true, depthWrite: false, opacity: 0,
  }));
  bow.rotation.x = -Math.PI / 2;
  bow.renderOrder = 3;
  g.add(bow);

  // Foam left on the stone as the swell goes over it, and a handful of it
  // sitting on the square he arrives on. Flat flecks and not sprites: a
  // camera-facing blob at this size is a round bright dot, and a dozen round
  // bright dots are lens bokeh — the eye goes to them instead of to the board.
  // Lying on the flagstones they are just foam.
  const flecks = [];
  const foam = new THREE.Group();
  for (let i = 0; i < 11; i++) {
    const u = i < 6 ? 0.55 + (i / 5) * 0.4 : 0.9 + Math.random() * 0.16;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: wetTexture(), color: 0xa8dced, transparent: true, depthWrite: false, opacity: 0,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(-TAIL + u * LEN, 0.014, (Math.random() - 0.5) * 1.5);
    m.scale.set(0.22 + Math.random() * 0.26, 0.14 + Math.random() * 0.18, 1);
    foam.add(m);
    flecks.push({ u, alpha: 0.4 + Math.random() * 0.32 });
  }
  g.add(foam);

  const c = new THREE.Color();

  kit.hold(g, SPAN, (t) => {
    // The lane RUNS open, from the fighter outward, rather than appearing all
    // at once: a lane that is simply there is a diagram, and a lane that opens
    // in front of someone is an invitation. It closes from the same end, so
    // the last of it to go is the end he has arrived at.
    const front = smooth(t / OPEN) * 1.12;
    const back = t < SHUT ? -1 : smooth((t - SHUT) / (1 - SHUT)) * 1.2;
    // The swell that walks him down it. Slow off the mark and a soft stop —
    // linear, it read as a bead sliding along a wire.
    const walked = smooth(Math.min(1, Math.max(0, (t - WALK0) / (WALK1 - WALK0))));
    const here = -0.08 + walked * 1.14;

    // It stops ON the square rather than running past it, and then SPREADS
    // out and dies instead of being switched off: the arrival is the beat the
    // whole motif is for, and a decal that simply stops being drawn gave it
    // no ending at all.
    const set = smooth((t - WALK1) / 0.3);
    bow.position.set(-TAIL + Math.min(here, 0.995) * LEN, 0.012, 0);
    bow.scale.setScalar(1 + set * 0.3);
    bow.material.opacity = 0.42 * smooth((here - 0.5) / 0.14) * (1 - set);

    for (let i = 0; i < flecks.length; i++) {
      const a = (here - flecks[i].u) / 0.42;
      foam.children[i].material.opacity = a <= 0 ? 0
        : flecks[i].alpha * Math.min(1, a * 6) * Math.max(0, 1 - a) ** 1.3;
    }

    for (let s = 0; s < 2; s++) {
      const geo = rails[s].geometry;
      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;
      const az = AZ[s], anx = NX[s], anz = NZ[s];
      for (let i = 0; i < NL; i++) {
        const u = i / (NL - 1);
        // Alive where the opening front has passed and the closing one has
        // not. The soft ends are what make it water running rather than a bar
        // being extended.
        const life = smooth((front - u) / 0.16) * (1 - smooth((back - u) / 0.24));
        // The swell, as a bulge and a brightening travelling along the rail.
        const pulse = gaussU(u, here, 0.075);
        const ax = AX[i], z0 = az[i], ex = anx[i], ez = anz[i];
        const lift = life * (1 + 0.85 * pulse);
        const fd = ex * LX + ez * LZ;            // the sun, across this rib
        // Chop, and it is doing the heavy lifting: an even ridge held at one
        // height down its whole length was a glowing PIPE lying on the stone.
        // Broken up — the crest riding up and down, and the rail thinning
        // almost to nothing where it dips — it becomes a run of little crests,
        // which is what shallow water over rough ground actually is.
        const chop = 1 + 0.34 * Math.sin(u * 31 + s * 1.7 + t * 9);
        // Two frequencies that do not divide into each other. At one, the
        // rail came out as seven evenly spaced dashes — a road marking, which
        // is exactly the interface-pointing-at-a-square look the bow in the
        // rails was there to avoid.
        const beads = 0.68 + 0.26 * Math.sin(u * 23 - s * 2.4 + t * 6)
          + 0.2 * Math.sin(u * 9.7 + s * 1.1);
        // The ends taper to nothing as well as fading: a rail held at full
        // width to its last rib has a cut end, and a cut end is a pipe.
        const half = WW * (0.3 + 0.7 * life);
        for (let j = 0; j < NW; j++) {
          const n = (i * NW + j) * 3, n4 = (i * NW + j) * 4;
          pos[n] = ax + ex * W[j] * half;
          pos[n + 1] = AMP * HG[j] * lift * chop;
          pos[n + 2] = z0 + ez * W[j] * half;

          // Slope shade. The horizontal part of the surface normal lies across
          // the rail, against the fall of the ridge; without it an unlit strip
          // is a decal and the rail has no volume at all.
          const sl = SL[j] * lift * 4.2;
          const lit = (LY - sl * fd) / Math.sqrt(sl * sl + 1);
          c.copy(DEEP).lerp(MID, Math.min(1, HG[j] * 1.05));
          c.lerp(FOAM, Math.min(1, FM[j] * (0.45 + 2.2 * pulse)));
          const shade = 0.28 + 0.88 * Math.max(0, lit);
          col[n4] = c.r * shade; col[n4 + 1] = c.g * shade; col[n4 + 2] = c.b * shade;
          col[n4 + 3] = Math.min(1, life * Math.max(0.35, beads)
            * (CV[j] * (0.09 + 0.24 * HG[j]) + FM[j] * (0.38 + 1.25 * pulse)));
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  });
}
