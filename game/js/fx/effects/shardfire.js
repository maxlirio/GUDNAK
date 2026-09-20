// SHARD FIRE — the Shard Dragon's red-pink crystal fire, thrown for every death
// it causes.
//
// The Dragon throws this once when it lands and again for EVERY fighter Lay
// Waste destroys, so half a dozen can overlap inside a second. That drives the
// whole file:
//   - the light stays LOCAL. An earlier version threw a wide, powerful light
//     from each death and six together turned the whole battlefield pink. The
//     lights here are short and low and their reach is smaller than the gap to
//     the next square, so a chain lights six squares and not the board.
//   - the blast stays ON ITS SQUARE. The version before this one threw its
//     splinters at 4-7 units a second across a 2.5-unit tile, so half a second
//     after every death there were flat pink diamonds lying two squares away;
//     photographed at t+650ms the motif was nothing but litter. Everything now
//     lands inside its own flagstone.
//   - the loud parts are SHORT and the quiet parts are LONG. Six overlapping
//     blasts can each afford a 120ms core; they cannot each afford a 600ms
//     one. What outlives the blast is the scorch, which is dark, so stacking
//     it makes the board dirtier rather than brighter.
//   - every blast is jittered — ring phase, size, speed, splinter count — so a
//     chain does not read as one clip played six times.
//   - nothing is allocated per frame and the textures are cached for the life
//     of the page, because the sixth blast must cost what the first one did.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&fxzoom=2.2&fxat=0.2" \
//             --eval tools/fxdemo/shardfire.js --out /tmp/s.png --settle 300

import { THREE } from '../kit.js';

/* ------------------------------------------------------------ textures */

// Cached across blasts: kit.hold() disposes materials, and a material never
// disposes its map, so these survive for the life of the page.
const TEXES = new Map();
function tex(key, paint, size = 128) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

/**
 * A flame TONGUE, drawn white and tinted per particle, tip at the top.
 *
 * Round soft blobs were tried first and they only ever make a glowing ball —
 * the eye needs a silhouette with a point on it to call something fire. The
 * sprites that use this are anchored at their base (`center.y ≈ 0`) so the
 * tongue always licks UP the screen whichever side of the table you are on,
 * which is why this needs no camera and no per-frame billboard maths.
 *
 * Two of them, leaning opposite ways: a fire built from one silhouette
 * repeated thirty times reads as a row of identical petals.
 *
 * SLENDER — about a third as wide as it is tall. The first cut of this was a
 * fat blurred teardrop, and thirteen fat teardrops piled on one square make a
 * pink cotton-wool mound with a couple of points on the rim; the fire had no
 * tongues in it at all. Narrow shapes keep their outline even where they
 * overlap.
 */
const tongueTex = (n) => tex(`tongue${n}`, (g, S) => {
  const lean = n ? S * 0.07 : -S * 0.07;
  const x = (u) => S * u, y = (v) => S * v;
  g.filter = `blur(${S * 0.014}px)`;
  g.beginPath();
  g.moveTo(S / 2 + lean, y(0.04));                 // the tip
  g.bezierCurveTo(S / 2 + lean * 1.9, y(0.32), x(0.66), y(0.58), x(0.685), y(0.82));
  g.bezierCurveTo(x(0.70), y(0.99), x(0.30), y(0.99), x(0.315), y(0.82));
  g.bezierCurveTo(x(0.34), y(0.58), S / 2 - lean * 0.4, y(0.32), S / 2 + lean, y(0.04));
  g.closePath();
  // Brightest in the UPPER middle, dim at the root. Two mistakes were made
  // here in turn. First the white band sat at the root and the top faded out,
  // so only the bottom third of a 2.4-unit flame was visible and the fire read
  // as a stub. Then, with the whole length bright, thirteen roots landing on
  // the same spot summed into a pale pink pool sitting on the flagstone. A dim
  // root fixes both: the licks read separately and the base stays dark, which
  // is also where the burning card is.
  const grd = g.createLinearGradient(0, 0, 0, S);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.09, 'rgba(255,255,255,0.3)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.5, 'rgba(255,255,255,1)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.72)');
  grd.addColorStop(0.88, 'rgba(255,255,255,0.24)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fill();
}, 256);

/** The root of the fire — round, because the root of a fire is. */
const puffTex = () => tex('puff', (g) => {
  const lobe = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.4})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    lobe(64 + Math.cos(a) * 17, 64 + Math.sin(a) * 15, 32, 0.4);
  }
  lobe(64, 64, 50, 0.6);
});

/** A hard little dot with a halo — the embers. */
const emberTex = () => tex('ember', (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.16, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
});

/**
 * The scorch. Drawn as a MASK — the mesh that uses it is dark and blended
 * normally, not additively, because this is the one part of the motif that
 * outlives the blast and six additive pink stains left the board glowing.
 * Burnt stone is darker than stone.
 */
const scorchTex = () => tex('scorch', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.48);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.92)');
  grd.addColorStop(0.75, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  // bitten out around the rim, so the edge of the burn is ragged like a burn
  // and not the circle of a decal
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
    const r = S * (0.30 + Math.random() * 0.2);
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r,
      S * (0.05 + Math.random() * 0.09), 0, Math.PI * 2);
    g.fill();
  }
});

/**
 * The split in the stone: jagged lines out of the middle, drawn once and
 * reused. This is what says CRYSTAL rather than just fire — the square is
 * fractured, the same shape as the shards standing up out of it.
 */
const crackTex = () => tex('crack', (g, S) => {
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,1)';
  for (let i = 0; i < 9; i++) {
    const a0 = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    let a = a0, x = S / 2, y = S / 2, w = 4.2 + Math.random() * 2.4;
    const steps = 4 + ((Math.random() * 3) | 0);
    for (let k = 0; k < steps; k++) {
      const len = S * (0.055 + Math.random() * 0.055);
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (k === 1 && Math.random() < 0.7) {       // a crack that forks
        const b = a + (Math.random() < 0.5 ? -0.8 : 0.8);
        g.lineWidth = w * 0.55;
        g.beginPath(); g.moveTo(nx, ny);
        g.lineTo(nx + Math.cos(b) * S * 0.09, ny + Math.sin(b) * S * 0.09);
        g.stroke();
      }
      x = nx; y = ny; a = a0 + (Math.random() - 0.5) * 0.7; w *= 0.66;
    }
  }
}, 256);

/* -------------------------------------------------------------- colour */

// Hot pink at the root, through the shard pink of the card, down to a dark
// crimson as it cools. Additive blending does the rest: the cool end is nearly
// black and stops contributing, which is how a flame tops out.
//
// The hot end is deliberately NOT white, and its green channel is deliberately
// tiny. The renderer tone-maps with ACES, which desaturates anything bright
// towards white; three overlapping additive sprites whose green sits at 0.35
// sum past 1.0 in every channel and the plume goes white with a pink fringe,
// which is what the first three versions of this file looked like. Held near
// 0.1, green never reaches white however deep the stack gets, so the core
// clips to hot pink instead.
// Blue is held down for the same reason green is. The designer asked for
// REDDISH pink, and a hot end with blue up at 0.44 goes pale and sugary the
// moment two sprites overlap — the plume turned into candyfloss sitting on the
// flagstone. At 0.32 it stays the crimson-magenta of the shards on the card.
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

const rnd = (a, b) => a + Math.random() * (b - a);
const G = 11.5;                                  // gravity, tuned so a blade
                                                 // thrown at 4 u/s is down again
                                                 // inside its own flagstone

/* --------------------------------------------------------------- blast */

export function shardfire(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  // It all stands on the STONE, not on the card. The card face is 0.22 up and
  // rooting the fire there was wrong twice over: the scorch was buried under a
  // card (invisible for the whole motif) and, worse, the death animation lifts
  // the corpse 0.35 and spins it before throwing it at the graveyard, so for
  // the first 250ms the card floated directly over the blast and hid it. On
  // the stone the fire burns around the dying card, the blades come up through
  // it, and when the corpse is thrown clear the burn is already there.
  // The flagstone's top face is at y=0.08 (a 0.34-deep slab sunk to -0.09),
  // its own glow plane at 0.085 and its rim at 0.09. The first cut of this put
  // the scorch, the cracks and the shock ring at 0.05, INSIDE the stone, so
  // all three were invisible for every frame of every blast and the square was
  // left looking untouched. They sit above the rim now.
  const floor = 0.095;
  const base = p.clone();
  base.y = floor + 0.02;
  const phase = Math.random() * Math.PI * 2;     // so two blasts never line up
  // Sized against the SCREEN, not against the card. The table is seen from far
  // enough back that a whole flagstone is about 95 pixels tall: a 1.5-unit
  // flame that looked generous zoomed in was 50 pixels of pink on the real
  // board and you could miss a death entirely. The fire stands 2.5 units — it
  // is a dragon's — while the footprint stays inside the flagstone, which is
  // 2.5 across, so nothing travels much past 1.3 from the middle.
  const gain = rnd(0.92, 1.12);                  // and no two are the same size
  const SPAN = 2.4;                              // the scorch outlives the fire

  const group = new THREE.Group();
  const tint = new THREE.Color();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const vec = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  /* --- the crystal. A splinter is an octahedron squeezed long: eight flat
     facets, so flatShading gives it a hard lit side and a dark side, which is
     what makes it read as crystal. The first version used cones, which have a
     smooth round flank and looked like pink party bunting.

     Few and BIG, thrown steeply. Many small ones thrown flat looked like
     confetti: at this camera a 0.3-long chip is a dozen pixels of flat pink,
     and fifteen of them skating outwards read as a party popper. Six blades
     that stand up out of the square, hang, and break have a silhouette. */
  const BLADES = 5 + ((Math.random() * 3) | 0);
  const CHIPS = BLADES * 3;
  const splinter = new THREE.OctahedronGeometry(0.5, 0);
  splinter.scale(0.30, 1, 0.22);

  // Dark body, modest emissive, bright halo. Run with the emissive high the
  // blade is one flat magenta shape whatever the lighting does and it reads as
  // cut paper; kept low, the facets take the blast's own light and you can see
  // a lit side and a dark side, which is the only thing that says crystal.
  const crystalMat = new THREE.MeshStandardMaterial({
    // metalness stays near zero. There is no environment map in this scene,
    // so a metallic surface has nothing to reflect and renders as a dead flat
    // colour — which is exactly what the blades looked like at 0.35.
    color: 0x86123a, emissive: 0xff2f68, emissiveIntensity: 0.24,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const blades = new THREE.InstancedMesh(splinter, crystalMat, BLADES);
  blades.frustumCulled = false;
  blades.castShadow = true;
  group.add(blades);

  // A second, larger, purely additive copy of every blade. Lit crystal on a
  // dark board was reading as flat pink card: the solid mesh gives the facets
  // and this gives the heat coming off them, and the two together stop the
  // shards looking like cut paper.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff2f68, transparent: true, opacity: 0.42,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.InstancedMesh(splinter, haloMat, BLADES);
  halo.frustumCulled = false;
  group.add(halo);

  const chipMat = new THREE.MeshStandardMaterial({
    color: 0x8d1740, emissive: 0xff2f68, emissiveIntensity: 0.45,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const chips = new THREE.InstancedMesh(splinter, chipMat, CHIPS);
  chips.frustumCulled = false;
  group.add(chips);

  // per-splinter tint, or eight identical pink chips read as confetti
  for (const m of [blades, chips]) {
    for (let i = 0; i < m.count; i++) {
      tint.setRGB(rnd(0.75, 1.3), rnd(0.55, 1.0), rnd(0.7, 1.15));
      m.setColorAt(i, tint);
    }
    m.instanceColor.needsUpdate = true;
  }

  const bits = [];
  for (let i = 0; i < BLADES; i++) {
    const a = phase + (i / BLADES) * Math.PI * 2 + rnd(-0.3, 0.3);
    const out = rnd(1.0, 2.1) * gain;            // sideways, per second
    const vy = rnd(4.2, 5.6) * gain;
    const r0 = rnd(0.05, 0.28);                  // no splinter starts dead centre
    bits.push({
      ox: Math.cos(a) * r0, oz: Math.sin(a) * r0,
      vx: Math.cos(a) * out, vz: Math.sin(a) * out * 0.9, vy,
      len: rnd(0.5, 0.88) * gain,
      // tumbling end over end about an axis across its own flight, not
      // spinning about its length — a splinter spun about its long axis has
      // the same silhouette all the way round and looks pinned in place.
      // `lean` is a random head start on that tumble: without it all eight
      // are at the same angle on the same frame and they move as one object.
      tx: -Math.sin(a), tz: Math.cos(a),
      lean: rnd(-0.5, 0.5), spin: rnd(-3.4, 3.4),
      // it breaks at the top of its arc, where it has stopped moving and the
      // eye can see it happen. Breaking on the way up hid the shatter behind
      // its own speed.
      shatter: (vy / G) * rnd(0.88, 1.25),
    });
  }

  const shards = [];
  for (let i = 0; i < CHIPS; i++) {
    const b = bits[i % BLADES];
    const a = rnd(0, Math.PI * 2);
    const sp = rnd(0.5, 1.7);
    shards.push({
      of: i % BLADES,
      vx: b.vx * 0.3 + Math.cos(a) * sp, vz: b.vz * 0.3 + Math.sin(a) * sp,
      vy: rnd(0.3, 2.2),
      len: b.len * rnd(0.2, 0.42),
      tx: Math.cos(a + 1.6), tz: Math.sin(a + 1.6), spin: rnd(-16, 16),
      life: rnd(0.4, 0.85),
    });
  }

  /* --- the fire. Tongues stand up out of a ring of roots and LEAN OUTWARD as
     they burn, because a fire drawn as a ring of upright petals is a crown, not
     a blast. A few round puffs sit at the very centre — that is the hard pink
     core the brief asks for.

     The fire, the embers and the core are drawn with depthTest OFF. A sprite
     is a flat quad facing the camera, so every pixel of a 1.7-tall flame is
     depth-tested at the depth of its ROOT, down on the stone — and the death
     animation lifts the dying card 0.35 and spins it directly over that root.
     Depth-tested, the corpse swallowed the entire plume for the first 300ms
     and all you saw was a pink edge sticking out past the card. The solid
     crystal is left depth-tested, because it has real geometry and reads
     correctly when the corpse tumbles through it. */
  const flames = [];
  const fire = new THREE.Group();
  group.add(fire);

  // Two waves. One burst of tongues is a pop, not a fire; the second, smaller
  // wave is the crystal catching properly a third of a second later, and it is
  // what makes the square look like it is BURNING rather than flashing.
  const wave = (n, t0, tall, hot, spread) => {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2 + rnd(-0.45, 0.45);
      // No tongue roots at the dead centre. Piled on the middle, four or five
      // additive tongues sum past 1.0 in every channel and the heart of the
      // blast goes WHITE — the one thing this motif must never do, since the
      // whole point is the colour. The middle belongs to the hard core.
      const r = (0.26 + Math.random() ** 0.55 * 0.72) * gain;
      const m = new THREE.SpriteMaterial({
        map: tongueTex(i & 1), transparent: true, depthWrite: false,
        depthTest: false, blending: THREE.AdditiveBlending, opacity: 0,
      });
      const s2 = new THREE.Sprite(m);
      s2.center.set(0.5, 0.06);                  // burns up from its own root
      s2.scale.set(0.01, 0.01, 1);
      fire.add(s2);
      const ox = Math.cos(a) * r;
      flames.push({
        s: s2, m, tongue: true,
        ox, oz: Math.sin(a) * r * 0.85,
        out: rnd(0.25, 0.6) * gain,
        // Tallest in the middle, so the plume is a flame shape and not a hedge
        // — but only a little. This used to fall off as 0.34+0.66*exp(-1.7r),
        // which at the rim of a 0.9 radius is 0.48, and with the random
        // multiplier under it the average tongue came out 0.7 units tall when
        // the motif was designed around 1.9. Measuring the sprites was the
        // only way to find that: on screen it just looked like the fire was
        // missing and I twice went hunting for it in the wrong place.
        h: (0.62 + 0.38 * Math.exp(-r * 1.4)) * rnd(0.75, 1.3) * tall * gain,
        w: rnd(0.5, 0.72),
        lift: rnd(0.15, 0.55),
        // the lean is away from the middle: sprites are billboards, so the
        // sign of the world offset is the sign on screen from this camera
        tilt: (ox >= 0 ? -1 : 1) * rnd(0.12, 0.5),
        born: t0 + (i / n) * spread + rnd(0, spread * 0.4),
        life: rnd(0.36, 0.72),
        heat: rnd(0.45, 0.68) * hot,
      });
    }
  };
  // The fire is the body of the motif and the crystal is the detail on it. The
  // first pass had that the other way round: eight bright blades over a thin
  // flame, and what you saw was a pink flower.
  //
  // FEW tongues, not many. Twenty-four of them inside a 0.9 radius put six or
  // eight additive sprites on top of each other everywhere but the rim, and
  // the plume turned into a flat pink haze with a fringe of flame — the shapes
  // were all still there and none of them were legible. Half as many, each
  // bigger and hotter, and you can read individual licks again.
  // The first wave lands ALL AT ONCE — spread over 70ms, not 200ms. Staggered
  // wide, the fire arrived after the crystal had already finished erupting and
  // the opening frames were all shard and no flame, which is backwards: the
  // fire is what the Dragon threw, the crystal is what it threw it at.
  wave(12, 0.0, 2.2, 1, 0.07);
  wave(8, 0.1, 1.5, 0.85, 0.2);

  /* --- the jet. The first 200ms is the blast itself and the motif needs a
     silhouette for it: the ring of tongues alone opens like a flower, which is
     pretty and has no violence in it. Two tall narrow sprites go straight up
     out of the middle on the first frame and are gone before the fire proper
     has finished arriving, and that is what makes it read as something being
     blown apart rather than lit. Two, not three — a third puts enough additive
     pink through the same pixels to clip them white. */
  for (let i = 0; i < 2; i++) {
    const m = new THREE.SpriteMaterial({
      map: tongueTex(i), transparent: true, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending, opacity: 0,
    });
    const s2 = new THREE.Sprite(m);
    s2.center.set(0.5, 0.06);
    s2.scale.set(0.01, 0.01, 1);
    fire.add(s2);
    flames.push({
      s: s2, m, tongue: true,
      ox: rnd(-0.12, 0.12), oz: rnd(-0.1, 0.1), out: 0.2,
      h: rnd(2.5, 3.1) * gain, w: rnd(0.3, 0.4), lift: 0.15,
      tilt: (i ? 1 : -1) * 0.1,
      born: i * 0.02, life: rnd(0.2, 0.26), heat: 0.46,
    });
  }

  for (let i = 0; i < 3; i++) {                  // the soft part of the core
    const m = new THREE.SpriteMaterial({
      map: puffTex(), transparent: true, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending, opacity: 0,
    });
    const s = new THREE.Sprite(m);
    s.scale.set(0.01, 0.01, 1);
    fire.add(s);
    flames.push({
      s, m, tongue: false,
      ox: rnd(-0.1, 0.1), oz: rnd(-0.08, 0.08), out: 0.5,
      h: rnd(0.5, 0.78) * gain, w: 1, lift: rnd(0.2, 0.5), tilt: 0,
      born: rnd(0, 0.04), life: rnd(0.22, 0.34), heat: 0.16,
    });
  }

  /* --- the hard core. Sprites are all soft edges, and a blast made only of
     them has no centre to it — it is a smear. This is a real faceted solid
     that snaps open and collapses in 130ms, and it is the thing that makes the
     blast feel like it came from something. */
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({
      color: 0xff2b66, transparent: true, opacity: 0, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending,
    }),
  );
  core.position.set(base.x, base.y + 0.26, base.z);   // clear of the card face
  core.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
  group.add(core);

  /* --- embers. One Points cloud rather than sprites: they outlive everything
     else and there can be six clouds up at once. */
  const EMBERS = 18;
  const emGeo = new THREE.BufferGeometry();
  const emPos = new Float32Array(EMBERS * 3);
  const emCol = new Float32Array(EMBERS * 4);
  emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
  emGeo.setAttribute('color', new THREE.BufferAttribute(emCol, 4));
  const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({
    map: emberTex(), size: 0.17 * gain, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  embers.frustumCulled = false;
  group.add(embers);
  const em = [];
  for (let i = 0; i < EMBERS; i++) {
    const a = phase + (i / EMBERS) * Math.PI * 2 + rnd(-0.4, 0.4);
    const r = rnd(0.35, 1.15) * gain;
    em.push({
      vx: Math.cos(a) * r, vz: Math.sin(a) * r * 0.9, vy: rnd(2.0, 3.6) * gain,
      born: rnd(0, 0.22), life: rnd(1.0, 1.8), flick: rnd(18, 34), heat: rnd(0.6, 1),
    });
  }

  /* --- what is left on the square. The scorch is DARK and blended normally:
     it is the only part that is still there a second later, and an additive
     pink stain that outlives the fire is how a chain of six ends up with a
     glowing board. The cracks glow on top of it and cool off. */
  const scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2 * gain, 2.2 * gain),
    new THREE.MeshBasicMaterial({
      map: scorchTex(), color: 0x140208, transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.rotation.z = phase;
  scorch.position.set(base.x, floor + 0.012, base.z);
  group.add(scorch);

  const cracks = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5 * gain, 2.5 * gain),
    new THREE.MeshBasicMaterial({
      map: crackTex(), color: 0xff2f68, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  cracks.rotation.x = -Math.PI / 2;
  cracks.rotation.z = phase * 1.7;
  cracks.position.set(base.x, floor + 0.026, base.z);
  group.add(cracks);

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    for (let i = 0; i < BLADES; i++) {
      const b = bits[i];
      const live = s < b.shatter;
      const ts = Math.min(s, b.shatter);
      const y = base.y + b.vy * ts - 0.5 * G * ts * ts;
      vec.set(base.x + b.ox + b.vx * ts, Math.max(floor + 0.05, y), base.z + b.oz + b.vz * ts);
      if (live) {
        // Aimed steeply OUT, never along the velocity. Pointing a blade down
        // its own flight path turns the whole burst horizontal at the top of
        // the arc, where the velocity is: photographed at t+180ms the eight
        // blades lay flat in a ring and the blast was a pink starfish. The
        // vertical term is floored so a blade can lean as it slows but never
        // lies down.
        axis.set(b.vx * 0.3, Math.max(1.1, b.vy - G * s * 0.55), b.vz * 0.3).normalize();
        q.setFromUnitVectors(UP, axis);
        roll.setFromAxisAngle(axis.set(b.tx, 0, b.tz).normalize(), b.lean + b.spin * s);
        q.premultiply(roll);
        // full size the moment it is thrown, and it does not shrink: a blade
        // that fades out mid-air never looks like it BROKE
        const k = Math.min(1, s * 14);
        mat4.compose(vec, q, scale.setScalar(b.len * k));
        blades.setMatrixAt(i, mat4);
        mat4.compose(vec, q, scale.setScalar(b.len * k * 1.3));
        halo.setMatrixAt(i, mat4);
      } else {
        mat4.compose(vec, q, scale.setScalar(0));
        blades.setMatrixAt(i, mat4);
        halo.setMatrixAt(i, mat4);
      }

      // the blade's own position at the instant it broke, so its chips start
      // exactly where it was rather than at the middle of the square
      b.px = vec.x; b.py = vec.y; b.pz = vec.z;
    }
    blades.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    haloMat.opacity = 0.42 * Math.max(0, 1 - t * 3.2);

    for (let i = 0; i < CHIPS; i++) {
      const c = shards[i];
      const b = bits[c.of];
      const e = s - b.shatter;
      const u = e / c.life;
      if (u <= 0 || u >= 1) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scale.setScalar(0));
        chips.setMatrixAt(i, mat4);
        continue;
      }
      vec.set(b.px + c.vx * e, Math.max(floor + 0.04, b.py + c.vy * e - 0.5 * G * e * e),
        b.pz + c.vz * e);
      axis.set(c.tx, 0.3, c.tz).normalize();
      q.setFromAxisAngle(axis, c.spin * e + i);
      // chips burn out where they land rather than lying about on the stone
      mat4.compose(vec, q, scale.setScalar(c.len * Math.min(1, (1 - u) * 3)));
      chips.setMatrixAt(i, mat4);
    }
    chips.instanceMatrix.needsUpdate = true;
    crystalMat.emissiveIntensity = 0.24 * Math.max(0.1, 1 - t * 2);
    chipMat.emissiveIntensity = 0.45 * Math.max(0.1, 1 - t * 1.6);

    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const u = (s - f.born) / f.life;
      if (u <= 0 || u >= 1) { f.m.opacity = 0; continue; }
      const spread = 1 + f.out * u ** 0.7;
      f.s.position.set(base.x + f.ox * spread, base.y + 0.02 + f.lift * u ** 1.6,
        base.z + f.oz * spread);
      // up fast, then burning down: a tongue is at its tallest early
      // Up almost at once, then burning down. The ramp used to run to u=0.24,
      // which on a 500ms tongue is 120ms of growing: measured mid-blast the
      // sprites were 0.65 units tall instead of the 1.6 they were built for,
      // because every one of them was still on its way up when it started
      // dying. A flame arrives; it does not inflate.
      const k = u < 0.09 ? u / 0.09 : 1 - (u - 0.09) / 0.91 * 0.5;
      if (f.tongue) {
        f.s.scale.set(f.h * f.w * (0.5 + 0.5 * k), f.h * k, 1);
        f.m.rotation = f.tilt * u;                // leans over as it burns down
      } else {
        f.s.scale.set(f.h * (0.4 + k), f.h * (0.4 + k), 1);
      }
      // Cooled against u**2.2, not u. A tongue lives 400-700ms and spends
       // almost all of it past u=0.3, where the ramp is already a dark crimson;
       // measured at t+160ms there were twenty sprites up, 2.2 units tall, and
       // the fire still read as a dim smear because every one of them had
       // cooled out of the hot end within a frame or two of being born. Held
       // hot for the first two thirds of its life and dropped fast after, a
       // tongue is the colour of the shards while you can see it.
      heatAt(u ** 2.2, tint);
      f.m.color.copy(tint);
      // Held, then dropped — not a straight line to nothing. A linear fade
      // spends the whole middle of a tongue's life at half brightness, which
      // is where most of the tongues are on most frames, so the fire looked
      // permanently half out.
      f.m.opacity = f.heat * (u < 0.1 ? u / 0.1 : (1 - (u - 0.1) / 0.9) ** 0.62);
    }

    // The core: open in 40ms, gone by 170ms. Anything slower and six of them
    // in a chain are a single continuous pink lamp in the middle of the board.
    const cu = s / 0.17;
    if (cu < 1) {
      const k = cu < 0.24 ? cu / 0.24 : 1;
      core.scale.setScalar((0.16 + 0.46 * k) * gain * (1 - cu * 0.35));
      core.material.opacity = 0.82 * (1 - cu) ** 1.4;
      core.rotation.y += 0.02;
    } else {
      core.material.opacity = 0;
    }

    for (let i = 0; i < EMBERS; i++) {
      const e = em[i];
      const u = (s - e.born) / e.life;
      const a4 = i * 4;
      if (u <= 0 || u >= 1) { emCol[a4 + 3] = 0; continue; }
      const es = s - e.born;
      emPos[i * 3] = base.x + e.vx * es * (1 - 0.3 * u);
      emPos[i * 3 + 1] = Math.max(floor + 0.05, base.y + e.vy * es - 3.9 * es * es);
      emPos[i * 3 + 2] = base.z + e.vz * es * (1 - 0.3 * u);
      heatAt(0.1 + u * 0.75, tint);
      const flick = 0.65 + 0.35 * Math.sin(s * e.flick + i);
      emCol[a4] = tint.r; emCol[a4 + 1] = tint.g; emCol[a4 + 2] = tint.b;
      emCol[a4 + 3] = e.heat * flick * (1 - u) * (u < 0.08 ? u / 0.08 : 1);
    }
    emGeo.attributes.position.needsUpdate = true;
    emGeo.attributes.color.needsUpdate = true;

    // The burn arrives with the blast and is still there when the fire has
    // gone; it only fades at the very end so its removal is not a pop.
    scorch.material.opacity = 0.78 * Math.min(1, s / 0.1)
      * (s > 1.7 ? Math.max(0, 1 - (s - 1.7) / 0.7) : 1);
    scorch.scale.setScalar(0.72 + 0.28 * Math.min(1, s / 0.3));

    // The cracks snap open, glow hot, then cool — the last pink on the square.
    const co = Math.min(1, s / 0.07);
    cracks.scale.setScalar(0.45 + 0.55 * (1 - (1 - co) ** 3));
    const cool = Math.max(0, 1 - s / 2.1) ** 1.5;
    cracks.material.opacity = co * (0.18 + 0.52 * cool)
      * (0.8 + 0.2 * Math.sin(s * 19 + phase)) * (s > 1.7 ? Math.max(0, 1 - (s - 1.7) / 0.7) : 1);
    heatAt(Math.min(0.62, s * 0.42), tint);
    cracks.material.color.copy(tint);
  });

  /* --- the ground. One thin, fast ring for the crack going out.
     Drawn here rather than with kit.ring because that one scales a fixed-width
     annulus: ask it for a wide ring and the band scales with the radius, and at
     the size this blast wants it stopped being a shockwave and became a solid
     pink puddle around the card. The band is kept thin as the radius grows.

     There used to be two of these, opacity 1.3 and 0.75, and photographed at
     t+200ms they were the loudest thing in the picture — two fat pale hoops
     with a small fire inside them. One thin one, under the fire. */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff3f7a, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(base.x, floor + 0.04, base.z);
  kit.hold(ring, 0.36, (t) => {
    const e = 1 - (1 - t) ** 3;
    ring.scale.setScalar((0.35 + 1.15 * e) * gain);
    ring.material.opacity = 0.85 * (1 - t) ** 1.3;
  });

  /* --- light. Reach is 4.4 and the squares are 2.9 apart, so with quadratic
     decay a neighbouring card catches an edge of this and the far side of the
     board catches nothing. This is the part that must not grow. */
  const flash = new THREE.PointLight(0xff5a92, 0, 4.4, 2);
  flash.position.set(base.x + Math.cos(phase) * 0.55, base.y + 0.95,
    base.z + Math.sin(phase) * 0.55);
  // The flash lasts as long as the blades are in the air, because it is what
  // lights their facets — cut short, the crystal went flat halfway up its arc.
  // It is also deliberately OFF CENTRE and high: hung in the middle of the
  // blast it lit every splinter square-on from the inside and they all came
  // out the same shade, which is the other half of why they read as cut paper.
  // From one side each blade gets a lit face and a dark one.
  kit.hold(flash, 0.34, (t) => { flash.intensity = 8 * (1 - t) ** 1.7 * (t < 0.1 ? t / 0.1 : 1); });

  const glow = new THREE.PointLight(0xff3a72, 0, 3.6, 2);
  glow.position.set(base.x, base.y + 0.25, base.z);
  kit.hold(glow, 1.3, (t) => {
    glow.intensity = 3.4 * (1 - t) ** 2.2 * (0.78 + 0.22 * Math.sin(t * 44 + phase));
  });
}
