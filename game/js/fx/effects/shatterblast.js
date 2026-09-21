// SHATTERBLAST — the crystal inside a Shardsworn body goes off and takes the
// four squares next door with it.
//
// Shared by 2 cards: R057 (Corrupted Shardbeast, "Overkill"), C053
// (Demolition "Experts", "Unstable"). Same picture both times: a body comes
// apart, and everything ADJACENT dies.
//
// The motif is the faction's colour — the same red-pink crystal as the Shard
// Dragon's fire — but it must not be a bigger shardfire. That one BLOOMS on
// one square; this one is hard geometry LEAVING the square:
//
//   - the shape is a PLUS, not a circle. Four lances are driven out along the
//     four orthogonal neighbours, a fracture runs along the stone under each
//     one, and even the loose debris is thrown along those four axes rather
//     than evenly around. A radial blast of the usual kind said "something
//     exploded"; it never said "and the card over THERE is dead".
//   - the blast has to ARRIVE somewhere. Every lane lands on a real square
//     (kit.at(n)), and the impact there — flash, fracture on the card, spall
//     thrown back out, a shove — is a bigger event than the detonation at the
//     centre. That is where the rules text happens.
//   - it is FAST. Charge 75ms, detonation, lances across in 105ms, four
//     impacts inside a fifth of a second. The whole loud part is over before
//     shardfire has finished lighting. What is left afterwards is cold: dark
//     cracks, dulling shards standing in the stone, dust.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=200&mag=3" \
//             --eval tools/fxdemo/shatterblast.js --out /tmp/s.png --settle 500
//
// ?t is milliseconds into the motif — the harness steps the animator by hand,
// because --settle is wall clock and a blast this fast is over before headless
// Chrome has drawn its second frame. &mag=3 magnifies the picture around the
// blast; &kill=1 runs the real deaths underneath it.

import { THREE } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 256, h = w) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * The impact flash: a star with HARD SPIKES, not a round blob.
 *
 * The first cut used a soft radial glow for this and the four impacts read as
 * four little campfires lighting up — the same language as shardfire, which is
 * the one thing this motif cannot borrow. Spikes of uneven length, thrown out
 * of a small bright core, say something struck the square.
 */
const starTex = () => tex('sb-star', (g, S) => {
  const c = S / 2;
  g.translate(c, c);
  g.fillStyle = '#fff';
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd(-0.12, 0.12);
    // long and short alternating, plus jitter: even spikes make a snowflake
    const len = c * (i % 2 ? rnd(0.5, 0.72) : rnd(0.82, 0.99));
    const w = c * (i % 2 ? 0.035 : 0.055);
    g.beginPath();
    g.moveTo(Math.cos(a) * len, Math.sin(a) * len);
    g.lineTo(Math.cos(a + 1.5708) * w, Math.sin(a + 1.5708) * w);
    g.lineTo(Math.cos(a - 1.5708) * w, Math.sin(a - 1.5708) * w);
    g.closePath();
    g.fill();
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.42);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(-c, -c, S, S);
}, 256);

/**
 * The fracture left where a lance lands — struck glass, not a starburst:
 * long straight splits out of one point, crossed by two broken rings.
 *
 * Drawn deliberately unlike shardfire's crack decal, which is short, forked
 * and even all round like something burst UP through the slab. This one has a
 * direction it was hit from.
 */
const crackTex = () => tex('sb-crack', (g, S) => {
  const c = S / 2;
  g.translate(c, c);
  g.lineCap = 'round';
  g.strokeStyle = '#fff';
  const arms = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd(-0.3, 0.3);
    arms.push(a);
    let x = 0, y = 0, dir = a, w = 5.5;
    const reach = c * rnd(0.62, 0.97);
    let r = 0;
    while (r < reach) {
      const step = c * rnd(0.1, 0.2);
      const nx = x + Math.cos(dir) * step, ny = y + Math.sin(dir) * step;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (r > c * 0.2 && Math.random() < 0.45) {       // a split
        const b = dir + (Math.random() < 0.5 ? -0.7 : 0.7);
        g.lineWidth = w * 0.5;
        g.beginPath(); g.moveTo(nx, ny);
        g.lineTo(nx + Math.cos(b) * c * 0.16, ny + Math.sin(b) * c * 0.16);
        g.stroke();
      }
      x = nx; y = ny; r += step; dir = a + rnd(-0.28, 0.28); w *= 0.82;
    }
  }
  // the two broken rings: short arcs hung between neighbouring arms, which is
  // what tells the eye this is a pane that CRACKED and not a drawn star
  for (const k of [0.34, 0.62]) {
    for (let i = 0; i < arms.length; i++) {
      if (Math.random() < 0.3) continue;
      const a0 = arms[i], a1 = arms[(i + 1) % arms.length];
      const span = ((a1 - a0) + Math.PI * 2) % (Math.PI * 2);
      const r0 = c * k * rnd(0.85, 1.15);
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
      g.lineTo(Math.cos(a0 + span * 0.5) * r0 * 0.86, Math.sin(a0 + span * 0.5) * r0 * 0.86);
      g.lineTo(Math.cos(a0 + span) * r0, Math.sin(a0 + span) * r0);
      g.stroke();
    }
  }
}, 256);

/**
 * The lane: one split running left to right along the stone, branching and
 * dying out. U is the length of the run, which is what lets the lane be
 * REVEALED by winding map.repeat.x out from 0 — see the lane code below.
 */
const laneTex = () => tex('sb-lane', (g, W, H) => {
  const mid = H / 2;
  g.lineCap = 'round';
  g.strokeStyle = '#fff';
  const walk = (x0, y0, w0, len, wob) => {
    let x = x0, y = y0, w = w0;
    while (x < x0 + len) {
      const step = W * rnd(0.03, 0.07);
      const ny = y + rnd(-wob, wob);
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + step, ny); g.stroke();
      // fork off the main split, always forward — a crack outruns its branches
      if (Math.random() < 0.3) {
        walk(x + step, ny, w * 0.45, W * rnd(0.05, 0.16), wob * 2.4);
      }
      x += step; y = ny;
      w *= 0.985;
    }
  };
  walk(0, mid, 9, W, H * 0.05);
  walk(0, mid + H * 0.1, 4, W * 0.7, H * 0.09);
  walk(0, mid - H * 0.12, 3.5, W * 0.55, H * 0.08);
  // fade the far end out, or the lane stops dead in a line across the stone
  g.globalCompositeOperation = 'destination-out';
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.72, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 512, 128);

/** A hard dot with a halo — grit and the dust motes. */
const moteTex = () => tex('sb-mote', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 64);

/* -------------------------------------------------------------- colour */

// Deliberately the SAME ramp as shardfire: hot pink, through the shard pink of
// the card, down to a dark crimson. Green and blue are held low for the reason
// that file gives — ACES tone mapping washes a bright additive stack towards
// white, and the one thing the Shardsworn motifs must not do is go white.
// It is duplicated rather than shared because a motif owns its own file.
const RAMP = [
  [0.00, 1.00, 0.16, 0.32],
  [0.16, 1.00, 0.08, 0.24],
  [0.40, 0.80, 0.03, 0.14],
  [0.70, 0.36, 0.01, 0.05],
  [1.00, 0.06, 0.00, 0.02],
];
function heatAt(u, out) {
  let i = 1;
  while (i < RAMP.length - 1 && u > RAMP[i][0]) i++;
  const a = RAMP[i - 1], b = RAMP[i];
  const k = Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0])));
  out.setRGB(a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k);
}

const PINK = 0xff2f68;
const HOT = 0xff1a54;

/* ------------------------------------------------------------- timings */

const CHARGE = 0.075;        // the crystal gathers, then goes
const CROSS = 0.105;         // a lance's flight to the next square
const SPAN = 2.0;            // the whole thing, cracks and dust included
const G = 13;                // gravity for the debris, a shade snappier than
                             // shardfire's so nothing hangs in the air

const FLOOR = 0.095;         // the flagstone face is 0.080; this clears it
const DECAL = 0.262;         // a card's face is ~0.21 and anything flat drawn
                             // on it has to clear that or it depth-tests away
                             // and lands on the STONE AROUND the card instead

/* --------------------------------------------------------------- blast */

export function shatterblast(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  /* --- which square went off, and what is next door.
     The effect is handed the card, not the square, and by the time it plays
     that card may already be in the air on its way to the graveyard — so the
     square is found by looking for the nearest of the nine, and everything is
     built on the SQUARE's position rather than the card's. Built on the card,
     a Demolition "Experts" blast fired with its own corpse halfway to the
     discard pile and the four lanes pointed off the board. */
  let src = -1, best = 1e9;
  for (let i = 0; i < 9; i++) {
    const q = kit.at(i);
    if (!q) continue;
    const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
    if (d < best) { best = d; src = i; }
  }
  const home = src >= 0 && best < 2.6 * 2.6 ? kit.at(src) : p.clone();
  const base = new THREE.Vector3(home.x, FLOOR, home.z);

  const lanes = [];
  if (src >= 0 && best < 2.6 * 2.6) {
    const row = Math.floor(src / 3), col = src % 3;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c2 = col + dc, r2 = row + dr;
      if (c2 < 0 || c2 > 2 || r2 < 0 || r2 > 2) continue;
      const sq = r2 * 3 + c2;
      const to = kit.at(sq);
      if (!to) continue;
      const dir = new THREE.Vector3(to.x - base.x, 0, to.z - base.z);
      const len = dir.length();
      dir.divideScalar(len);
      lanes.push({
        sq, dir, len,
        to: new THREE.Vector3(to.x, FLOOR, to.z),
        yaw: Math.atan2(-dir.z, dir.x),
        // the four impacts are staggered by a few milliseconds, or they land
        // on the same frame and the whole thing reads as one switch being
        // thrown rather than four separate deaths
        hit: CHARGE + CROSS * rnd(0.93, 1.1),
      });
    }
  }

  const phase = Math.random() * Math.PI * 2;
  const group = new THREE.Group();
  const tint = new THREE.Color();
  const q4 = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const vec = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* --- the crystal, as one shape used at three sizes: an octahedron squeezed
     long. Eight flat facets and flatShading give it a lit side and a dark
     side, which is the only thing that reads as crystal at 60 pixels a card;
     cones and cylinders both came out as flat pink paper. */
  const splinter = new THREE.OctahedronGeometry(0.5, 0);
  splinter.scale(0.34, 1, 0.26);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x86123a, emissive: PINK, emissiveIntensity: 0.5,
    roughness: 0.28, metalness: 0.05, flatShading: true, transparent: true,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: PINK, transparent: true, opacity: 0.62,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });

  /* --- THE LANCES. The signature of the motif: one spear of crystal driven
     flat out of the blast at each neighbour, arriving in about a tenth of a
     second.

     They fly nearly LEVEL, a little above the cards, and they are long. An
     early version threw them on a high arc like shardfire's blades and from
     this camera the arc hid the direction completely — you saw shards go up,
     not shards go THAT WAY. Level and fast, the lance is a line pointing at
     the card it is about to kill. */
  const NL = lanes.length;
  const lance = new THREE.InstancedMesh(splinter, crystalMat, Math.max(1, NL));
  lance.frustumCulled = false;
  lance.count = NL;
  lance.castShadow = true;
  group.add(lance);

  // the same lance again, longer, thinner and purely additive: at 28 units a
  // second a solid shard moves half its own length between frames and reads as
  // a stutter. The streak welds those positions into one movement.
  const streak = new THREE.InstancedMesh(splinter, haloMat, Math.max(1, NL));
  streak.frustumCulled = false;
  streak.count = NL;
  group.add(streak);

  /* --- debris. One instanced mesh for everything thrown: the chips off the
     centre and the spall knocked out of each square that is hit.

     Thrown ALONG THE FOUR LANES rather than evenly around. Scattered evenly
     the debris field was a circle, and a circle of chips is exactly what the
     motif must not be — the ability hits a plus, so the litter is a plus. */
  const bits = [];
  // Dark body, LOW emissive. Run bright the chips are one flat magenta all
  // over and a field of them reads as petals; the facets only appear when most
  // of what you see on a chip is the blast's own light falling on one side of
  // it. metalness stays near zero — there is no environment map in this scene,
  // so a metallic surface has nothing to reflect and goes dead flat.
  const chipMat = new THREE.MeshStandardMaterial({
    color: 0x7d1138, emissive: PINK, emissiveIntensity: 0.3,
    roughness: 0.26, metalness: 0.05, flatShading: true, transparent: true,
  });

  const throwBit = (from, o) => {
    const a = o.angle;
    const sp = o.speed;
    const vy = o.vy;
    const y0 = from.y;
    // where it comes down, solved rather than tested for, so a chip can be
    // asked whether it has landed at any time without stepping a simulation
    const land = (vy + Math.sqrt(vy * vy + 2 * G * Math.max(0, y0 - (FLOOR + 0.02)))) / G;
    bits.push({
      x: from.x, y: y0, z: from.z,
      vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy,
      born: o.born, land, life: o.life,
      len: o.len, wide: o.wide || 1,
      tx: -Math.sin(a), tz: Math.cos(a),
      lean: rnd(-1, 1), spin: rnd(-14, 14),
      // the angle it ends up standing at once it is in the stone
      stuck: rnd(0.35, 1.0),
    });
  };

  // angle of one of the lanes, most of the time — the rest scattered, so the
  // plus has a haze around it and does not look stencilled
  const lanePick = () => {
    if (!NL || Math.random() < 0.22) return rnd(0, Math.PI * 2);
    const l = lanes[(Math.random() * NL) | 0];
    return Math.atan2(l.dir.z, l.dir.x) + rnd(-0.38, 0.38);
  };

  // Sizes skewed SMALL — a few real shards and a lot of grit. Thirty chips
  // all between 0.16 and 0.42 long came out as thirty flat pink lozenges
  // tumbling over the board: at 300ms the middle of the table was confetti,
  // which is the exact failure shardfire records. Squaring the roll gives a
  // field of specks with the occasional proper splinter in it, and a field of
  // specks reads as pulverised crystal.
  const chipLen = () => 0.07 + Math.random() ** 2.4 * 0.22;
  const core = new THREE.Vector3(base.x, 0.42, base.z);
  for (let i = 0; i < 18; i++) {
    throwBit(core, {
      angle: lanePick(),
      speed: rnd(2.2, 5.6), vy: rnd(0.5, 2.6),
      born: CHARGE + rnd(0, 0.02),
      len: chipLen(), wide: rnd(0.7, 1.1),
      life: rnd(0.5, 0.8),
    });
  }

  /* --- the fracture that runs out along the stone under each lance.
     This is the part that makes the blast REACH: the lane is revealed from the
     blast outwards and gets to the next square on the same frame the lance
     does. It is a plane scaled along its own length — and the texture's
     repeat is wound out with it, or the crack pattern is squashed into the
     first few centimetres and then stretched like a rubber band, which reads
     as a decal being inflated rather than a split running. */
  const laneMats = [];
  for (const l of lanes) {
    const pivot = new THREE.Group();
    pivot.position.set(base.x, FLOOR + 0.018, base.z);
    pivot.rotation.y = l.yaw;
    const geo = new THREE.PlaneGeometry(l.len + 1.1, 1.5);
    geo.translate((l.len + 1.1) / 2, 0, 0);
    const map = laneTex().clone();
    map.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({
      map, color: PINK, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    pivot.add(mesh);
    group.add(pivot);
    l.laneMesh = mesh;
    l.laneMat = mat;
    laneMats.push(map);
  }

  /* --- what is drawn where a lance lands: a spike flash, and a fracture that
     stays on the card. Both are flat and both sit at DECAL height, because a
     card covers most of its own flagstone and a mark drawn at floor level
     vanished under it — the four impacts happened on the stone AROUND four
     cards that looked untouched. */
  const star = starTex(), crackMap = crackTex();
  for (const l of lanes) {
    const flash = new THREE.Mesh(
      // 2.9 across, which is a flagstone and a bit. It was 3.4 with the scale
      // running to 1.3, and the spikes of four of those reached out past the
      // corners of their own squares; three hundred milliseconds after the
      // blast the board had a faint pink X drawn across it by stars that were
      // supposed to be a flash.
      new THREE.PlaneGeometry(2.9, 2.9),
      new THREE.MeshBasicMaterial({
        map: star, color: HOT, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      }),
    );
    // depthTest off: the table throws the corpse of a card it destroys UP and
    // over the square, so for the first 300ms the thing being killed is
    // floating directly above its own impact. Tested, the flash was hidden by
    // the card it belonged to.
    flash.rotation.x = -Math.PI / 2;
    flash.rotation.z = rnd(0, 6.28);
    flash.position.set(l.to.x, DECAL, l.to.z);
    flash.renderOrder = 6;
    group.add(flash);
    l.flash = flash;

    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.5),
      new THREE.MeshBasicMaterial({
        map: crackMap, color: PINK, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = rnd(0, 6.28);
    crack.position.set(l.to.x, DECAL - 0.004, l.to.z);
    group.add(crack);
    l.crack = crack;

    // spall: thrown back out of the square that was hit, mostly onward and up.
    // Without it a lance arrived and simply stopped, which looked like it had
    // been absorbed.
    const aOut = Math.atan2(l.dir.z, l.dir.x);
    for (let i = 0; i < 6; i++) {
      throwBit(new THREE.Vector3(l.to.x, DECAL, l.to.z), {
        angle: i < 5 ? aOut + rnd(-1.0, 1.0) : rnd(0, 6.28),
        speed: rnd(1.1, 3.6), vy: rnd(1.4, 3.4),
        born: l.hit + rnd(0, 0.012),
        len: chipLen(), wide: rnd(0.7, 1.1),
        life: rnd(0.45, 0.78),
      });
    }
  }

  const chips = new THREE.InstancedMesh(splinter, chipMat, Math.max(1, bits.length));
  chips.frustumCulled = false;
  chips.count = bits.length;
  chips.castShadow = true;
  group.add(chips);
  for (let i = 0; i < bits.length; i++) {
    // per-chip tint, or thirty identical pink slivers read as confetti
    tint.setRGB(rnd(0.7, 1.3), rnd(0.5, 1.0), rnd(0.65, 1.15));
    chips.setColorAt(i, tint);
  }
  if (chips.instanceColor) chips.instanceColor.needsUpdate = true;

  /* --- the centre. A cluster of crystal that snaps up out of the card during
     the charge and is gone the instant it detonates — the body coming apart.
     Three shards, not one: one shape growing is a balloon. */
  const seedCount = 3;
  const seedMesh = new THREE.InstancedMesh(splinter, crystalMat, seedCount);
  seedMesh.frustumCulled = false;
  group.add(seedMesh);
  const seeds = [];
  for (let i = 0; i < seedCount; i++) {
    const a = phase + (i / seedCount) * 2.09;
    // big enough to SEE. At 0.5-0.78 long the charge was a smudge of pink on
    // the card art and the blast appeared to come from nothing; the charge is
    // only 75ms and it has to land in four or five frames.
    seeds.push({ a, tilt: rnd(0.2, 0.6), len: rnd(0.75, 1.15), r: rnd(0.06, 0.2) });
  }

  /* --- the hard core: a faceted solid that snaps open and is gone inside
     120ms, so the blast looks like it came OUT of something.

     It is small — 0.9 across at its widest. The first cut ran it out to 3.1
     units, the distance to the next square, on the theory that the shockwave
     should reach; photographed at t+100ms it was a pink balloon covering the
     middle four squares and the lances, the lanes and the impacts were all
     inside it. The reach belongs to the lances. This is just the muzzle.

     There was a wireframe copy of it too, for the facets. At this size and
     drawn additively over itself it was a white cage of scribble sitting on
     the board — the single worst thing in any frame of the motif — and every
     other part improved the moment it went. */
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({
      color: HOT, transparent: true, opacity: 0, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending,
    }),
  );
  shell.position.set(base.x, 0.36, base.z);
  shell.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
  shell.renderOrder = 5;
  group.add(shell);

  /* --- the column: two shards that STRETCH straight up out of the card on
     the frame it goes off and snap shut again inside 160ms.

     Everything else in this motif lies flat on the table, and photographed at
     the real size — a card is sixty pixels — the whole blast was a pink cross
     painted on the floor with no height to it at all. This is the silhouette,
     and it is the one place the motif is allowed to go up.

     It is deliberately NOT shardfire's blades: those are half a dozen shards
     thrown on a ballistic arc that hang at the top and break. These two go
     straight up like a crack opening, and they are gone before the lances have
     landed. Nothing arcs, nothing tumbles, nothing hangs. */
  const JETS = 2;
  const jets = [];
  const jetMesh = new THREE.InstancedMesh(splinter, crystalMat, JETS);
  jetMesh.frustumCulled = false;
  group.add(jetMesh);
  for (let i = 0; i < JETS; i++) {
    const a = phase + i * 3.14 + rnd(-0.4, 0.4);
    jets.push({
      h: rnd(1.5, 2.1), w: rnd(0.4, 0.58),
      lx: Math.cos(a) * rnd(0.07, 0.2), lz: Math.sin(a) * rnd(0.07, 0.2),
      up: rnd(0.9, 1.05),
    });
  }

  /* --- and the flash over the card that burst, the same spiked star the four
     impacts use. One motif, one shape: the centre and the four squares it
     kills are visibly the same event. */
  const burst = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({
      map: starTex(), color: HOT, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  );
  burst.rotation.x = -Math.PI / 2;
  burst.rotation.z = phase;
  burst.position.set(base.x, DECAL, base.z);
  burst.renderOrder = 6;
  group.add(burst);

  /* --- the ground wave: a HEXAGON, not a circle. Six straight sides is a
     small thing that does a lot of work — it is the difference between a
     shockwave and a crystal shockwave, and it costs nothing. Two of them,
     offset in angle and speed, because one lonely ring reads as a decal. */
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 6),
      new THREE.MeshBasicMaterial({
        color: i ? 0xff6f9c : 0xff3b72, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = phase + i * 0.52;
    m.position.set(base.x, FLOOR + 0.03 + i * 0.004, base.z);
    group.add(m);
    // It stays on its OWN flagstone. Run out to 3.5 — the distance to the next
    // square, which seemed like the honest size for a shockwave — a hexagon
    // that big is not a wave at all: at t+200ms there was a pale six-sided
    // outline drawn across three squares of the board, the most eye-catching
    // thing in the frame, and it looked like a targeting overlay. The reach of
    // this motif is the lances and the lanes; the ring is just the ground
    // flinching under the card that burst.
    rings.push({ m, size: i ? 1.05 : 1.45, life: i ? 0.3 : 0.22 });
  }

  /* --- the fracture on the square that blew, under everything else */
  const hub = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({
      map: crackMap, color: PINK, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  hub.rotation.x = -Math.PI / 2;
  hub.rotation.z = phase;
  hub.position.set(base.x, FLOOR + 0.026, base.z);
  group.add(hub);

  /* --- dust. The tail of the motif and the only soft thing in it: crystal
     ground to powder, drifting off the four squares. It is what stops the
     effect ending on a hard cut when the cracks fade. */
  const DUST = 34;
  const duGeo = new THREE.BufferGeometry();
  const duPos = new Float32Array(DUST * 3);
  const duCol = new Float32Array(DUST * 4);
  duGeo.setAttribute('position', new THREE.BufferAttribute(duPos, 3));
  duGeo.setAttribute('color', new THREE.BufferAttribute(duCol, 4));
  const dust = new THREE.Points(duGeo, new THREE.PointsMaterial({
    map: moteTex(), size: 0.34, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  group.add(dust);
  const motes = [];
  for (let i = 0; i < DUST; i++) {
    const a = lanePick();
    const near = Math.random() < 0.45 || !NL;
    const l = NL ? lanes[(Math.random() * NL) | 0] : null;
    motes.push({
      x: near ? base.x : l.to.x + rnd(-0.6, 0.6),
      z: near ? base.z : l.to.z + rnd(-0.6, 0.6),
      vx: Math.cos(a) * rnd(0.3, 1.5) * (near ? 1 : 0.4),
      vz: Math.sin(a) * rnd(0.3, 1.5) * (near ? 1 : 0.4),
      vy: rnd(0.35, 1.1),
      born: (near ? CHARGE : l.hit) + rnd(0, 0.12),
      life: rnd(1.0, 1.9), heat: rnd(0.45, 1),
    });
  }

  /* --- light. TWO point lights, no more: the braziers already put six in the
     scene and every extra count the renderer sees is a new shader. The flash
     reaches 5.8, which with quadratic decay is enough for the four neighbours
     to brighten as the wave passes them and not enough to reach the far row.
     It is hung OFF CENTRE so the lances get a lit face and a dark one. */
  const flash = new THREE.PointLight(0xff5a92, 0, 5.8, 2);
  flash.position.set(base.x + Math.cos(phase) * 0.5, 1.15, base.z + Math.sin(phase) * 0.5);
  group.add(flash);
  // The second one is the working light: it is what falls on the shards while
  // they are in the air. With the flash gone after a quarter of a second and
  // this one reaching only its own square, every chip past the middle went
  // flat pink the moment it left — reach 4.6 covers the four squares that were
  // hit and stops short of the next row.
  const after = new THREE.PointLight(0xff3a72, 0, 4.6, 2);
  after.position.set(base.x, 0.7, base.z);
  group.add(after);

  /* --- the cards themselves. The blast SHOVES them: the source jumps and
     rattles, each neighbour is knocked away from the centre and tips.
     Nothing here owns a card for long — the offset is written on top of the
     piece's own resting position every frame and simply stops, and pieces.js
     lerps it home. A piece already animating (a corpse in mid-throw) is left
     alone, because that animation owns its transform. */
  const shoved = [];
  const srcPiece = kit.piece(at);
  if (srcPiece) shoved.push({ piece: srcPiece, dir: null, t0: CHARGE });
  for (const l of lanes) {
    const piece = kit.pieces?.topAt?.(l.sq);
    if (piece) shoved.push({ piece, dir: l.dir, t0: l.hit });
  }

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;
    const det = s - CHARGE;                        // time since the detonation

    /* the charge: three shards rise out of the card, lean apart, and vanish
       on the frame it goes off */
    if (det < 0) {
      const u = s / CHARGE;
      for (let i = 0; i < seedCount; i++) {
        const sd = seeds[i];
        const k = u ** 0.6;
        vec.set(base.x + Math.cos(sd.a) * sd.r * k, 0.30 + 0.16 * k,
          base.z + Math.sin(sd.a) * sd.r * k);
        axis.set(Math.cos(sd.a) * sd.tilt, 1, Math.sin(sd.a) * sd.tilt).normalize();
        q4.setFromUnitVectors(UP, axis);
        mat4.compose(vec, q4, scale.setScalar(sd.len * k));
        seedMesh.setMatrixAt(i, mat4);
      }
      seedMesh.instanceMatrix.needsUpdate = true;
      // it flares just before it lets go, which is the only warning there is —
      // the shards go white-hot and a pip of light swells between them
      crystalMat.emissiveIntensity = 0.5 + 3.4 * u ** 3;
      after.intensity = 1.6 * u ** 2;
      shell.scale.setScalar(0.1 + 0.22 * u ** 2);
      shell.material.opacity = 0.5 * u ** 2;
    } else if (seedMesh.visible) {
      seedMesh.visible = false;
    }

    /* the lances */
    for (let i = 0; i < NL; i++) {
      const l = lanes[i];
      const u = det / (l.hit - CHARGE);
      if (u < 0 || u > 1) {
        mat4.compose(vec.set(0, -99, 0), q4.identity(), scale.setScalar(0));
        lance.setMatrixAt(i, mat4);
        streak.setMatrixAt(i, mat4);
        continue;
      }
      // out of the middle and DOWN into the square: it starts above the
      // source card and arrives at the height of the card it is killing
      const d = l.len * u;
      vec.set(base.x + l.dir.x * d, 0.52 - 0.22 * u * u, base.z + l.dir.z * d);
      axis.copy(l.dir).setY(-0.34).normalize();
      q4.setFromUnitVectors(UP, axis);
      // rolled about its OWN length, to turn a facet towards the light. This
      // used to roll about the axis ACROSS the flight, which does not present
      // a facet at all — it tips the whole spear 29 degrees out of its aim,
      // and every lance was landing nose-up like a thrown leaf.
      roll.setFromAxisAngle(axis, l.yaw * 2 + 0.6);
      q4.premultiply(roll);
      const grow = Math.min(1, u * 6);
      // slender: seven times as long as it is wide. At 4:1 the lance was a
      // kite rather than a spear and the direction went out of it
      mat4.compose(vec, q4, scale.set(0.8 * grow, 2.1 * grow, 0.8 * grow));
      lance.setMatrixAt(i, mat4);
      // The streak is the same shard drawn far longer and thinner, covering
      // the gap the lance jumped since the last frame — at 28 units a second
      // it moves more than its own length between frames, and without this it
      // read as four shards blinking along the row rather than flying. It is
      // pushed BACK along the flight so it trails: centred on the lance it
      // stuck out as far in front as behind, and the smear arrived at the next
      // square a frame and a half before the shard carrying it.
      vec.addScaledVector(l.dir, -1.5);
      mat4.compose(vec, q4, scale.set(0.72 * grow, 4.6 * grow, 0.72 * grow));
      streak.setMatrixAt(i, mat4);
    }
    lance.instanceMatrix.needsUpdate = true;
    streak.instanceMatrix.needsUpdate = true;

    /* debris */
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      const e = s - b.born;
      const u = e / b.life;
      if (e <= 0 || u >= 1) {
        mat4.compose(vec.set(0, -99, 0), q4.identity(), scale.setScalar(0));
        chips.setMatrixAt(i, mat4);
        continue;
      }
      const flying = e < b.land;
      const ts = Math.min(e, b.land);
      vec.set(b.x + b.vx * ts, b.y + b.vy * ts - 0.5 * G * ts * ts, b.z + b.vz * ts);
      if (flying) {
        axis.set(b.vx * 0.25, Math.max(0.4, b.vy - G * ts), b.vz * 0.25).normalize();
        q4.setFromUnitVectors(UP, axis);
        roll.setFromAxisAngle(axis.set(b.tx, 0, b.tz).normalize(), b.lean + b.spin * ts);
        q4.premultiply(roll);
      } else {
        // it does not lie down — it STICKS, standing in the stone at the angle
        // it came in at. Chips left lying flat were the same mistake shardfire
        // made once: pink lozenges scattered over the board, and nothing about
        // them said crystal.
        const settle = Math.min(1, (e - b.land) / 0.07);
        axis.set(b.tx * b.stuck, 1, b.tz * b.stuck).normalize();
        q4.setFromUnitVectors(UP, axis);
        roll.setFromAxisAngle(axis.set(0, 1, 0), b.lean * 3 + settle * 0.3);
        q4.premultiply(roll);
        vec.y = FLOOR + b.len * 0.3;
      }
      // Full size while it is in the air — a chip that shrinks from the moment
      // it is thrown never looks like it BROKE off — then it SINKS once it is
      // down. Chips that kept their size until the end of their life left the
      // board covered in little flat pink leaves for half a second after the
      // blast was over, with no light on them to say what they were.
      const rest = Math.max(0.12, b.life - b.land - 0.1);
      const fade = flying ? 1 : Math.max(0, 1 - Math.max(0, e - b.land - 0.1) / rest);
      mat4.compose(vec, q4, scale.set(b.wide * fade, b.len * fade, b.wide * fade));
      chips.setMatrixAt(i, mat4);
    }
    chips.instanceMatrix.needsUpdate = true;
    chipMat.emissiveIntensity = 0.3 * Math.max(0.1, 1 - s * 1.1);
    if (det >= 0) crystalMat.emissiveIntensity = 0.9 * Math.max(0.1, 1 - det * 3);

    /* the core and the flash over it */
    // ...only once it has GONE OFF: before that the charge above owns the
    // shell, and an unguarded else here was zeroing the pip on every frame of
    // the charge, which is why the charge kept looking like nothing.
    const su = det / 0.12;
    if (su >= 0) {
      if (su < 1) {
        const e = 1 - (1 - su) ** 2.4;
        const r = 0.2 + 0.7 * e;
        shell.scale.set(r, r * 0.55, r);
        shell.material.opacity = 0.62 * (1 - su) ** 1.5;
      } else {
        shell.material.opacity = 0;
      }
    }
    /* the column: up fast, then shut. It shrinks rather than fading because
       the shards share one material with the lances and a material fade would
       take those with it — and a shard that shrinks to nothing looks like it
       was pulled back into the blast, which is better than one that dissolves */
    const ju = det / 0.16;
    for (let i = 0; i < JETS; i++) {
      const j = jets[i];
      if (ju <= 0 || ju >= 1) {
        mat4.compose(vec.set(0, -99, 0), q4.identity(), scale.setScalar(0));
        jetMesh.setMatrixAt(i, mat4);
        continue;
      }
      const k = ju < 0.4 ? 1 - (1 - ju / 0.4) ** 3 : 1;
      const shut = ju < 0.55 ? 1 : Math.max(0, 1 - (ju - 0.55) / 0.45) ** 0.8;
      const h = j.h * k * shut;
      axis.set(j.lx, j.up, j.lz).normalize();
      q4.setFromUnitVectors(UP, axis);
      vec.set(base.x + axis.x * h * 0.5, 0.26 + axis.y * h * 0.5, base.z + axis.z * h * 0.5);
      mat4.compose(vec, q4, scale.set(j.w * shut, h, j.w * shut));
      jetMesh.setMatrixAt(i, mat4);
    }
    jetMesh.instanceMatrix.needsUpdate = true;

    const bu = det / 0.15;
    if (bu >= 0 && bu < 1) {
      burst.scale.setScalar(0.3 + 0.85 * (1 - (1 - bu) ** 3));
      burst.material.opacity = (1 - bu) ** 1.4;
    } else {
      burst.material.opacity = 0;
    }

    /* the two hexagons going out over the stone */
    for (const rg of rings) {
      const u = det / rg.life;
      if (u < 0 || u > 1) { rg.m.material.opacity = 0; continue; }
      const e = 1 - (1 - u) ** 3;
      rg.m.scale.setScalar(0.3 + rg.size * e);
      rg.m.material.opacity = 0.8 * (1 - u) ** 1.4;
    }

    /* the lanes running out under the lances */
    for (const l of lanes) {
      const u = det / (l.hit - CHARGE);
      if (u <= 0) { l.laneMat.opacity = 0; continue; }
      const k = Math.min(1, u * 1.04);
      l.laneMesh.scale.x = k;
      l.laneMat.map.repeat.x = k;
      const age = Math.max(0, s - l.hit);
      // bright while it is opening, then a cooling seam in the stone
      heatAt(Math.min(0.78, age * 0.5), tint);
      l.laneMat.color.copy(tint);
      l.laneMat.opacity = (u < 1 ? 1 : 0.34 + 0.66 * Math.max(0, 1 - age * 3))
        * (s > 1.5 ? Math.max(0, 1 - (s - 1.5) / 0.5) : 1);
    }

    /* the impacts */
    for (const l of lanes) {
      const e = s - l.hit;
      const fu = e / 0.13;
      l.flash.material.opacity = fu > 0 && fu < 1 ? (1 - fu) ** 1.8 : 0;
      if (fu > 0 && fu < 1) l.flash.scale.setScalar(0.3 + 0.7 * (1 - (1 - fu) ** 3));

      if (e <= 0) { l.crack.material.opacity = 0; continue; }
      const open = Math.min(1, e / 0.05);
      l.crack.scale.setScalar(0.5 + 0.5 * (1 - (1 - open) ** 3));
      heatAt(Math.min(0.8, 0.05 + e * 0.5), tint);
      l.crack.material.color.copy(tint);
      l.crack.material.opacity = open * (0.35 + 0.65 * Math.max(0, 1 - e * 1.6))
        * (0.85 + 0.15 * Math.sin(s * 21 + l.yaw))
        * (s > 1.5 ? Math.max(0, 1 - (s - 1.5) / 0.5) : 1);
    }

    /* the fracture on the square that went off */
    if (det > 0) {
      const open = Math.min(1, det / 0.05);
      hub.scale.setScalar(0.45 + 0.55 * (1 - (1 - open) ** 3));
      heatAt(Math.min(0.8, det * 0.45), tint);
      hub.material.color.copy(tint);
      hub.material.opacity = open * (0.3 + 0.7 * Math.max(0, 1 - det * 1.4))
        * (0.85 + 0.15 * Math.sin(s * 17 + phase))
        * (s > 1.5 ? Math.max(0, 1 - (s - 1.5) / 0.5) : 1);
    }

    /* dust */
    for (let i = 0; i < DUST; i++) {
      const m = motes[i];
      const e = s - m.born;
      const u = e / m.life;
      const a4 = i * 4;
      if (e <= 0 || u >= 1) { duCol[a4 + 3] = 0; continue; }
      duPos[i * 3] = m.x + m.vx * e * (1 - 0.35 * u);
      duPos[i * 3 + 1] = FLOOR + 0.1 + m.vy * e * (1 - 0.4 * u);
      duPos[i * 3 + 2] = m.z + m.vz * e * (1 - 0.35 * u);
      heatAt(0.25 + u * 0.7, tint);
      duCol[a4] = tint.r; duCol[a4 + 1] = tint.g; duCol[a4 + 2] = tint.b;
      duCol[a4 + 3] = m.heat * (1 - u) * (u < 0.1 ? u / 0.1 : 1);
    }
    duGeo.attributes.position.needsUpdate = true;
    duGeo.attributes.color.needsUpdate = true;

    /* light */
    if (det >= 0) {
      const fu = det / 0.26;
      flash.intensity = fu < 1 ? 17 * (1 - fu) ** 1.8 * Math.min(1, det / 0.02) : 0;
      after.intensity = 5.4 * Math.max(0, 1 - det / 0.9) ** 2
        * (0.8 + 0.2 * Math.sin(det * 40 + phase));
    }

    /* the cards */
    for (const sh of shoved) {
      const piece = sh.piece;
      if (piece.animating || !piece.restingPosition) continue;
      const e = s - sh.t0;
      if (e < 0) continue;
      // a hit, then a settle: hard edge in 30ms, most of it gone in a third of
      // a second, and a wobble on the way down so it looks knocked rather than
      // slid
      const k = e < 0.03 ? e / 0.03 : Math.max(0, 1 - (e - 0.03) / 0.36) ** 1.5;
      // handed back the moment the shove is spent, not at the end of SPAN:
      // `continue` here left the last frame's tilt frozen on the card for the
      // second and a half of cracks and dust that follow
      if (k <= 0) { piece.group.rotation.set(0, 0, 0); continue; }
      const wob = Math.sin(e * 34) * 0.35 + 1;
      const rest = piece.restingPosition();
      if (sh.dir) {
        piece.group.position.set(
          rest.x + sh.dir.x * 0.26 * k * wob, rest.y + 0.1 * k,
          rest.z + sh.dir.z * 0.26 * k * wob,
        );
        piece.group.rotation.x = -sh.dir.z * 0.4 * k * wob;
        piece.group.rotation.z = sh.dir.x * 0.4 * k * wob;
      } else {
        // the source is not pushed anywhere — it is the thing that burst
        piece.group.position.set(rest.x, rest.y + 0.16 * k, rest.z);
        piece.group.rotation.x = Math.sin(e * 41 + 1) * 0.22 * k;
        piece.group.rotation.z = Math.cos(e * 37) * 0.22 * k;
      }
    }
  }, () => {
    // the shove is written every frame and just stops, so position lerps home
    // on its own — but rotation is nobody's business but this motif's and has
    // to be handed back, or the card stays leaning for the rest of the game
    for (const sh of shoved) sh.piece.group.rotation.set(0, 0, 0);
    // the lane maps are per-blast clones (each one winds its own repeat), so
    // they are not in the shared cache and nothing else would free them
    for (const m of laneMats) m.dispose();
  });
}

/* ---------------------------------------------------------------- exit */

/**
 * How long a card this ability kills stays on the board.
 *
 * Measured to the DETONATION and the lances landing, not to the end of the
 * motif: the engine resolves the whole ability on one frame, so without this
 * the four neighbours were already gone by the time their lances arrived and
 * the blast struck four empty flagstones. 0.2s puts every victim still on its
 * square when the crystal reaches it, and the cracks, the dust and the cooling
 * seams play out over the empty board afterwards, which is right — they are
 * the aftermath.
 */
export const timing = { kill: 0.2 };

const DUSTCOL = new THREE.Color(0.30, 0.05, 0.11);

/**
 * WHAT BECOMES OF EACH CARD.
 *
 * The generic death struck every card flat, put a red burst under it and threw
 * it at the pile — so a fighter this blast had just speared died a second time
 * in a motion that knew nothing about crystal, and the lance read as something
 * that had merely happened nearby.
 *
 * This motif is the best case in the set for owning the leaving, because it
 * kills SEVERAL cards at once and this is called once per card with that
 * card's own piece and square. Each one therefore leaves ALONG ITS OWN LINE
 * from the blast: the card that stood to the left is thrown left, the one
 * beyond is thrown away from the camera, and the card that burst goes straight
 * up. Four cards dying in four different directions out of one point is the
 * whole ability in one picture, and nothing else in the game can show it.
 *
 * It ends ON THE DISCARD PILE. An earlier cut had the card shatter where it
 * stood and fade out, and that reads as the card being deleted rather than
 * discarded — you lose track of where it went.
 */
export const exit = {
  destroy(kit, piece, square, ev, done) {
    const start = piece.group.position.clone();
    const grave = kit.grave(piece.owner);
    grave.y = 0.34;                              // resting on top of the pile

    // The line the blast pushed this card along. `ev.at` is the card that
    // detonated, so for every neighbour this is the direction the lance came
    // in on — and for the bomb itself it is nothing, which is how this tells
    // the two apart without being told.
    const from = kit.at(ev?.at);
    const out = new THREE.Vector3(
      start.x - (from ? from.x : start.x), 0, start.z - (from ? from.z : start.z),
    );
    const bomb = out.lengthSq() < 0.09;
    if (bomb) {
      const a = rnd(0, Math.PI * 2);             // it has no line; give it one
      out.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    }
    out.normalize();

    piece.animating = true;
    // the motif's own shove was writing this until a moment ago and stops the
    // instant `animating` goes up; left alone the card would carry that tilt
    // through the whole exit
    piece.group.rotation.set(0, 0, 0);

    /* --- the card comes apart. The same splinter the blast is built from, so
       what flies off the card is visibly the crystal that killed it. Two
       waves: the spray knocked off where it stood, and the rest when the slab
       finally breaks over the pile. */
    const splinter = new THREE.OctahedronGeometry(0.5, 0);
    splinter.scale(0.34, 1, 0.26);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x7d1138, emissive: PINK, emissiveIntensity: 0.42,
      roughness: 0.28, metalness: 0.05, flatShading: true, transparent: true,
    });
    const SHARDS = 22;
    const shards = new THREE.InstancedMesh(splinter, shardMat, SHARDS);
    shards.frustumCulled = false;
    const bits = [];
    const tint = new THREE.Color();
    for (let i = 0; i < SHARDS; i++) {
      const late = i >= 12;
      const a = late ? rnd(0, Math.PI * 2)
        : Math.atan2(out.z, out.x) + rnd(-1.1, 1.1);
      const sp = late ? rnd(0.7, 2.2) : rnd(1.6, 4.4);
      bits.push({
        late,
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rnd(1.0, 3.2),
        born: late ? 0.72 + rnd(0, 0.06) : rnd(0, 0.05),
        life: late ? rnd(0.4, 0.7) : rnd(0.35, 0.6),
        len: 0.08 + Math.random() ** 2.2 * 0.2, wide: rnd(0.7, 1.1),
        tx: -Math.sin(a), tz: Math.cos(a), lean: rnd(-1, 1), spin: rnd(-16, 16),
      });
      tint.setRGB(rnd(0.7, 1.3), rnd(0.5, 1.0), rnd(0.65, 1.15));
      shards.setColorAt(i, tint);
    }
    if (shards.instanceColor) shards.instanceColor.needsUpdate = true;

    const q4 = new THREE.Quaternion();
    const roll = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const mat4 = new THREE.Matrix4();
    const vec = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);

    const SPAN = 1.0;
    // When the slab itself goes — and it goes OVER THE PILE. At 0.5 of a 0.8s
    // flight it broke a third of the way there, with its second spray of
    // shards landing on a graveyard the card had not reached yet: two halves
    // of one event happening in two different places. The travel below is
    // shaped to arrive on exactly this beat.
    const BREAK = 0.72;

    // Outliving the card by half a second: the second wave is born as the
    // slab breaks and has to be seen to settle on the pile afterwards.
    const SHARDSPAN = 1.55;
    kit.hold(shards, SHARDSPAN, (t) => {
      const s = t * SHARDSPAN;
      for (let i = 0; i < SHARDS; i++) {
        const b = bits[i];
        const e = s - b.born;
        const u = e / b.life;
        if (e <= 0 || u >= 1) {
          mat4.compose(vec.set(0, -99, 0), q4.identity(), scale.setScalar(0));
          shards.setMatrixAt(i, mat4);
          continue;
        }
        // the first wave leaves the card where it was struck, the second one
        // from over the pile, which is where the card actually breaks
        const o = b.late ? grave : start;
        vec.set(o.x + b.vx * e, o.y + 0.1 + b.vy * e - 0.5 * G * e * e, o.z + b.vz * e);
        vec.y = Math.max(FLOOR + 0.05, vec.y);
        axis.set(b.vx * 0.25, Math.max(0.4, b.vy - G * e), b.vz * 0.25).normalize();
        q4.setFromUnitVectors(UP, axis);
        roll.setFromAxisAngle(axis.set(b.tx, 0, b.tz).normalize(), b.lean + b.spin * e);
        q4.premultiply(roll);
        const fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
        mat4.compose(vec, q4, scale.set(b.wide * fade, b.len * fade, b.wide * fade));
        shards.setMatrixAt(i, mat4);
      }
      shards.instanceMatrix.needsUpdate = true;
      shardMat.emissiveIntensity = 0.42 * Math.max(0.12, 1 - s * 1.6);
    });

    /* --- the card itself. Struck, thrown off its square along the line of the
       blast, and broken over the discard pile.

       It is NOT lifted and spun flat like the generic death. It is hit: it
       goes over on the edge nearest the blast, keeps turning as it travels,
       and the turn is about the axis ACROSS the direction it was hit from, so
       the motion has the same line in it as the lance did. */
    const edge = piece.card3d.material[0];
    const mats = [piece.frontMat, piece.backMat, edge];
    for (const m of mats) m.transparent = true;
    const baseCol = mats.map((m) => m.color.clone());

    kit.anim.add(SPAN, (t) => {
      // Two stages, not one curve. For the first fifth the card stays on its
      // own square and is driven OUTWARD along the blast's line — that is the
      // part that says which way it was hit, and a card already on its way to
      // the graveyard by then looked swept aside rather than struck. Then it
      // is carried to the pile, arriving exactly on BREAK.
      const travel = Math.min(1, Math.max(0, (t - 0.22) / 0.5)) ** 0.85;
      vec.lerpVectors(start, grave, travel);
      vec.addScaledVector(out, 0.95 * Math.sin(Math.min(1, t / 0.34) * Math.PI));
      vec.y += 0.85 * Math.sin(Math.min(1, t / BREAK) * Math.PI) * (1 - travel * 0.5);
      piece.group.position.copy(vec);

      const spin = t * 7.5;
      piece.tilt.rotation.x = -out.z * spin;
      piece.tilt.rotation.z = out.x * spin;
      piece.tilt.rotation.y = (bomb ? 4 : 1.2) * t;

      // Two flashes and a dimming between them: the strike, the colour going
      // out of the card as it tumbles, and then the break itself. Without the
      // second flash the card simply got smaller and fainter on its way to the
      // pile, and the moment it actually came apart — the only moment that
      // says destroyed rather than swept aside — passed unnoticed at this
      // camera.
      const hit = Math.max(0, 1 - t / 0.1);
      const snap = Math.max(0, 1 - Math.abs(t - BREAK) / 0.07);
      const dark = Math.min(1, Math.max(0, (t - 0.12) / 0.45));
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseCol[i])
          .multiplyScalar(1 + 1.5 * hit + 2.2 * snap ** 2 - 0.35 * dark);
        if (dark) mats[i].color.lerp(DUSTCOL, dark * 0.45 * (1 - snap));
      }

      // and it BREAKS over the pile rather than shrinking all the way there:
      // a card that dwindles from the moment it is hit reads as a card flying
      // away, not a card coming apart
      const gone = Math.max(0, (t - BREAK) / (1 - BREAK));
      piece.group.scale.setScalar(1 - 0.12 * t - 0.72 * gone ** 1.6);
      for (const m of mats) m.opacity = 1 - gone ** 1.3;
    }, () => {
      // Everything borrowed goes back. Pieces are pooled, and a card that came
      // back from the pool still dark, shrunk and half transparent is a ghost.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(baseCol[i]);
        mats[i].opacity = 1;
      }
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.animating = false;
      done?.();
    });
  },
};
