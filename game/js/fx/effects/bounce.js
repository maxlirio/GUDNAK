// BOUNCE — a fighter is UNMADE and goes home to its owner's hand.
//
// Shared by 3 cards: R060 Shard Wisp, C073 Unmarked Trails, C071 Diversion.
// One motif, one file — worked on on its own.
//
// The three cards all say the same thing in different words: the fighter is
// not killed, it is TAKEN OFF THE TABLE and put somewhere — a hand, the bottom
// of a deck. So this is the faction's other face: same crystal, same reddish
// pink as the Shard Dragon's fire, but nothing is thrown, nothing burns, and
// nothing is left on the stone.
//
// THE CARD IS THE MOTIF. This file owns `exit.hand`, so the thing that comes
// apart is the real slab — it lights up, thins away, and the crystal it leaves
// is what actually travels to the hand and lands there. The version before
// this one had no such hook: the dissolution played on the square, and the
// intact card then flew home behind it under the generic `anim.vanish`, which
// is the whole complaint. Two things follow from owning it:
//   - the unmaking is in `exit.hand`, not in `bounce()`. For two of the three
//     cards the motif itself has nothing to draw — a Tactic resolves from a
//     hand, not from a square — so the card's own leaving has to carry the
//     motif or there is no motif.
//   - the crystal must ARRIVE. Fading it out over the board reads as deleted,
//     and this is the one effect in the game whose subject is NOT dead.
//
// It is built against shardfire.js, which is the Shardsworn signature and must
// stay distinguishable from this at a glance, on a card that is 60 pixels
// wide:
//   - shardfire ERUPTS from the middle outward; this one CLOSES INWARD. Its
//     ring on the stone contracts where the Dragon's shockwave expands.
//   - shardfire is loud for 200ms and then leaves a dark scorch; this is quiet
//     all the way through and leaves the square exactly as it found it.
//   - shardfire is FIRE with crystal in it — tongues, a white-hot core, a jet.
//     There is no flame anywhere in here. The crystal is the whole body of it,
//     and it drifts rather than being thrown: nothing in this file moves faster
//     than about two units a second on its own, where a blade of the Dragon's
//     leaves at five and shatters at the top of its arc.
//   - it GOES SOMEWHERE, and the shape of the journey is the sentence:
//     SCATTER over the square, STREAM across the table, and a CARD again at
//     the other end — every mote walks back to the place it left the card
//     from, so what lands is the fighter's own footprint in its own
//     arrangement. The direction comes from kit.hand(owner), the point
//     anim.draw and anim.vanish aim at; where exactly it stops, and why it
//     stops short, is at the bottom of this file.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=600" \
//             --eval tools/fxdemo/bounce.js --out /tmp/b-600.png \
//             --wait 3500 --settle 500 --port 9811 --serve-port 8811
// ?t is milliseconds from the moment the rules resolve, and the harness runs
// the motif and then hands the card to this file's exit on the same clock the
// table uses — which is the only honest view of it.

import { THREE, CARD_W, CARD_H, easeOut } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials, and a
// material never disposes its map, so a second bounce would otherwise repaint
// every canvas.
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
 * A GLIMMER: a hard little core with four rays off it.
 *
 * Plain round blobs were tried for these first and a hundred of them is a pink
 * mist — pretty, and it says smoke rather than crystal. The rays are what make
 * a four-pixel dot read as something that catches the light, which is the
 * whole idea of "Glimmer & Shimmer".
 */
const glimmerTex = () => tex('glimmer', (g, S) => {
  const h = S / 2;
  const ray = (rot) => {
    g.save();
    g.translate(h, h);
    g.rotate(rot);
    g.scale(1, 0.085);                    // a long thin lens, not a circle
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.94);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.42)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, h * 0.94, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  ray(0);
  ray(Math.PI / 2);
  const core = g.createRadialGradient(h, h, 0, h, h, h * 0.44);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.28, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
}, 128);

/** The dust between the glimmers — soft, and much dimmer than they are. */
const dustTex = () => tex('dust', (g, S) => {
  const h = S / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.5)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 64);

/**
 * The line the unmaking runs along: bright, thin, and faded out at both ends
 * so it never shows a rectangle's corners. It crosses the card once.
 */
const seamTex = () => tex('seam', (g, S) => {
  const grd = g.createLinearGradient(0, 0, 0, S);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.36, 'rgba(255,255,255,0.13)');
  grd.addColorStop(0.49, 'rgba(255,255,255,1)');
  grd.addColorStop(0.53, 'rgba(255,255,255,1)');
  grd.addColorStop(0.66, 'rgba(255,255,255,0.10)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-in';
  const ends = g.createLinearGradient(0, 0, S, 0);
  ends.addColorStop(0, 'rgba(0,0,0,0)');
  ends.addColorStop(0.22, 'rgba(0,0,0,1)');
  ends.addColorStop(0.78, 'rgba(0,0,0,1)');
  ends.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ends;
  g.fillRect(0, 0, S, S);
}, 128);

/**
 * THE CARD'S OWN SHAPE, soft at the edges: a rounded rectangle, brightest
 * along the middle.
 *
 * This is what the crystal turns back into when it lands in the hand — the
 * card putting itself together again at the other end. It has to be
 * card-shaped: a round blob arriving at the hand read as a puff of smoke, and
 * the whole sentence the motif is saying is that this fighter is not dead, it
 * is a card again.
 */
const ghostTex = () => tex('ghost', (g, S) => {
  const r = S * 0.10, m = S * 0.13;
  g.filter = `blur(${S * 0.055}px)`;
  const grd = g.createLinearGradient(0, m, 0, S - m);
  grd.addColorStop(0, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.5, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = grd;
  g.beginPath();
  g.roundRect(m, m, S - m * 2, S - m * 2, r);
  g.fill();
}, 128);

/** A soft blob, for the pool on the stone. */
const softTex = () => tex('soft', (g, S) => {
  const h = S / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 128);

/* -------------------------------------------------------------- colour */

// The same reddish pink as the Dragon's fire, and held down in green and blue
// for the same reason: the renderer tone-maps with ACES, so anything that sums
// past 1.0 in all three channels goes white, and a cloud of additive motes
// over a card is exactly where that happens. Green near 0.2 keeps the core
// pink however many motes overlap.
const HOT = new THREE.Color(1.0, 0.22, 0.42);       // the freshest motes
const COOL = new THREE.Color(0.52, 0.03, 0.16);     // as one cools on its way
const GLOW = new THREE.Color(1.0, 0.30, 0.52);      // what the card itself goes

/* ------------------------------------------------------------- a cloud */

/**
 * One Points cloud. Two are used — bright glimmers and dim dust — because a
 * PointsMaterial has ONE size for the whole cloud, and a field of motes that
 * are all the same size reads as a printed pattern rather than as something
 * coming apart.
 */
function cloud(count, map, size, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map, size, sizeAttenuation: true, vertexColors: true, transparent: true,
    opacity, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  return { geo, points, pos, col };
}

/* ----------------------------------------------------------- the crystal */

/**
 * THE UNMAKING: a card's worth of crystal coming off `p`, gathering, and
 * travelling to `to` — where, if it is going anywhere real, it lands.
 *
 * Both users of this file go through here. `exit.hand` runs it over the card
 * that is leaving, aimed at the owner's hand; `bounce()` runs a smaller one at
 * the square the spell was cast from, aimed nowhere in particular.
 */
function unmake(kit, p, to, {
  flakeN = 18, dustN = 46, glimN = 24,
  seamOn = true, ground = true, land = true,
  depart = 0.42, arrive = 1.15,
} = {}) {
  const trip = to.clone().sub(p);
  // Which way the seam runs, and which way the flakes end up pointing: the way
  // the fighter is about to go.
  const home = trip.z >= 0 ? 1 : -1;
  const floor = 0.095;                  // the flagstone face, plus a hair
  // Flat things that belong to the CARD have to clear its face, which sits
  // about 0.055 above the card's own origin. Drawn at p.y they lose the depth
  // test against the card and appear only on the stone around it.
  const face = p.y + 0.055;
  const SPAN = arrive + 0.5;            // the landing outlives the journey
  const group = new THREE.Group();

  /* --- the seam: one bright line crossing the card in the direction the
     fighter is about to leave in, and the crystal wakes up behind it. This is
     the part that says UNMADE rather than blown up — there is a front, it
     passes over the card once, and what is behind it is no longer card. */
  const SWEEP0 = 0.02, SWEEP = 0.16;
  const seam = seamOn ? new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, CARD_H * 0.46),
    new THREE.MeshBasicMaterial({
      map: seamTex(), color: 0xff5f92, transparent: true, opacity: 0,
      // DEPTH TEST OFF. The card is lifting as this crosses it and the motes
      // stand off its face; depth-tested, the opening of the motif kept being
      // hidden behind the very card it is about.
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  ) : null;
  if (seam) {
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(p.x, face + 0.01, p.z);
    group.add(seam);
  }

  /* --- the iris, on the STONE. A thin ring that CONTRACTS into the middle of
     the square. The Dragon's fire throws a shockwave outward from exactly
     here; this is the same gesture run backwards, which is the cheapest way to
     tell a viewer at a glance that this is the opposite kind of event. */
  const iris = ground ? new THREE.Mesh(
    new THREE.RingGeometry(0.945, 1.0, 56),
    new THREE.MeshBasicMaterial({
      color: 0xff5c90, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  ) : null;
  /* --- the pool on the stone. Pale, additive, and GONE by the end — the one
     thing shardfire leaves behind is a dark scorch, and the whole point of
     this motif is that the square is untouched afterwards. */
  const pool = ground ? new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: softTex(), color: 0xc42a58, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  ) : null;
  if (iris) {
    iris.rotation.x = -Math.PI / 2;
    iris.position.set(p.x, floor + 0.03, p.z);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(p.x, floor + 0.012, p.z);
    group.add(iris, pool);
  }

  // How high the stream bows on its way. Measured, not guessed: the camera is
  // at (0, 19.6, 18.6), nearly overhead, so height is the axis this view
  // barely sees — 3.4 units of climb moved a mote ELEVEN pixels, where four
  // and a half units along the table moved it a hundred. An earlier departure
  // built on a tall climb looked exactly like crystal hanging over the square
  // fading out, which is the one thing this motif must not do. So the journey
  // is the ground distance to the hand, and the lift is only a bow in it.
  const ARC = 0.85;

  /* --- the motes. Laid out over the CARD'S footprint, not in a circle: what
     comes apart is a rectangle of printed card, and a round puff of particles
     is what every other effect in this game already looks like. */
  const make = (n, rise, lit) => {
    const out = [];
    const cols = Math.ceil(Math.sqrt(n * (CARD_W / CARD_H)));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      // a jittered grid, so the cloud keeps the card's shape for the first
      // moments; scattered at random it read as a puff from the very first
      // frame and the card was never legible in it
      const gx = (((i % cols) + 0.5) / cols - 0.5) * CARD_W;
      const gz = ((Math.floor(i / cols) + 0.5) / rows - 0.5) * CARD_H;
      const x = gx + rnd(-0.06, 0.06);
      const z = gz + rnd(-0.06, 0.06);
      // the seam runs the way the fighter is going, so a mote's birth is where
      // it stands along that axis
      const u = 0.5 + (z * home) / CARD_H;
      const off = depart + rnd(0, 0.10) + u * 0.05;
      out.push({
        x, z,
        born: SWEEP0 + u * SWEEP + rnd(0, 0.07),
        vy: rnd(1.55, 3.10) * rise,
        dx: rnd(-0.95, 0.95), dz: rnd(-0.80, 0.80),
        swirl: rnd(0, Math.PI * 2), swirlR: rnd(0.02, 0.10),
        departAt: off,
        // THEY ALL GET THERE AT ONCE, give or take 70ms. Each mote used to run
        // its own length of journey, so the swarm dribbled into the hand over
        // a third of a second and the arrival had no moment in it. A staggered
        // START and a shared FINISH is what makes a stream converge.
        span: Math.max(0.3, arrive + rnd(-0.03, 0.04) - off),
        flick: rnd(9, 22), bright: rnd(0.62, 1) * lit,
      });
    }
    return out;
  };

  const dust = cloud(dustN, dustTex(), 0.26, 0.45);
  const glim = cloud(glimN, glimmerTex(), 0.55, 1.0);
  const dustM = make(dustN, 1, 0.85);
  const glimM = make(glimN, 1.15, 1.35);
  group.add(dust.points, glim.points);

  const tint = new THREE.Color();
  const runCloud = (c, list, s) => {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const a4 = i * 4;
      const age = s - m.born;
      if (age <= 0) { c.col[a4 + 3] = 0; continue; }
      const u = Math.min(1, Math.max(0, (s - m.departAt) / m.span));
      const k = u ** 1.2;               // eases INTO the journey; it builds
      // float
      let x = p.x + m.x + m.dx * age + Math.sin(m.swirl + age * 2.1) * m.swirlR;
      let y = face + 0.02 + m.vy * age * (1 - 0.42 * age);
      let z = p.z + m.z + m.dz * age + Math.cos(m.swirl + age * 1.7) * m.swirlR;
      // and then HOME, in three parts that happen at once.
      //
      // IT PUTS ITSELF BACK. `lay` walks every mote back to the place it left
      // the card from, so what lands is the card's own footprint in the card's
      // own arrangement — the fighter is not dead, it is a card again, and a
      // swarm that converges on a single point instead just piles additive
      // pink into one spot and goes white.
      const lay = k * k;
      x += (p.x + m.x - x) * lay;
      y += (face + 0.03 - y) * lay;
      z += (p.z + m.z - z) * lay;
      // GATHERED in the middle of the journey and opened out again at the end,
      // so the shape of the thing is: scatter, stream, card. Gathering all the
      // way in (which is what this did first) crossed the table as a knot and
      // arrived as a dot.
      const g = 0.62 * Math.sin(Math.PI * k);
      x += (p.x - x) * g;
      z += (p.z - z) * g;
      y += (face + 0.55 - y) * g * 0.5;
      // and the whole thing is carried to the destination, bowing on the way
      x += trip.x * k;
      y += trip.y * k + ARC * Math.sin(Math.PI * k);
      z += trip.z * k;
      c.pos[i * 3] = x; c.pos[i * 3 + 1] = y; c.pos[i * 3 + 2] = z;
      tint.copy(HOT).lerp(COOL, Math.min(0.45, u * 0.5));
      const flick = 0.72 + 0.28 * Math.sin(age * m.flick + i);
      // FULL BRIGHTNESS ALL THE WAY THERE, and it only goes out once it has
      // landed and sat for an instant. Fading it across the journey — which
      // is what this did first — is how a card being RETURNED reads as a card
      // being deleted; the eye needs to see the thing get somewhere.
      const after = Math.max(0, s - (m.departAt + m.span));
      const fade = Math.max(0, 1 - after / 0.3);
      c.col[a4] = tint.r; c.col[a4 + 1] = tint.g; c.col[a4 + 2] = tint.b;
      c.col[a4 + 3] = m.bright * flick * fade * Math.min(1, age / 0.06);
    }
    c.geo.attributes.position.needsUpdate = true;
    c.geo.attributes.color.needsUpdate = true;
  };

  /* --- the flakes, and they are the BODY of this motif rather than a detail
     on it. The first three versions were built on a cloud of additive motes
     with a few chips in it, and photographed on the real table the motes were
     not there: 56 dust points and 26 glimmers came out as faint speckle on a
     brown flagstone, because additive pink at half alpha over lit stone is
     almost nothing, and a card is only 60 pixels wide. The one thing that DID
     read in those shots was the handful of crystal chips — a lit solid with a
     hard silhouette. So the card comes apart into a dozen of them, and the
     motes are the glitter around them.

     Same squeezed octahedron the Dragon's fire throws, so the two motifs are
     plainly the same crystal. The difference is what happens to it: shardfire
     launches blades at 5 units a second and breaks them at the top of the arc;
     these lift off at under 1.5, keep turning over, and are carried away
     whole. Nothing here shatters. */
  const flakeGeo = new THREE.OctahedronGeometry(0.5, 0);
  flakeGeo.scale(0.34, 1, 0.27);        // slim enough to be a shard, not so
                                        // flat it vanishes when it turns edge-on
  const flakeMat = new THREE.MeshStandardMaterial({
    color: 0x8d1740, emissive: 0xff2f68, emissiveIntensity: 1.0,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, flakeN);
  flakes.frustumCulled = false;
  flakes.castShadow = true;
  group.add(flakes);

  // A larger, purely additive copy of every flake. The braziers are low and
  // warm and the board is dark: lit crystal alone came out as dull maroon
  // chips, and this is the heat coming off them that makes them read as
  // crystal rather than as gravel.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff3f7a, transparent: true, opacity: 0.55,
    // DEPTH TEST OFF on the glow, and only on the glow. The hand is off the
    // near edge of the table with the arena's trees and rocks in front of it,
    // and the crystal arrives there: depth-tested, the last 200ms of the
    // journey — the part that says it got home — was swallowed by a bush. The
    // solid shards stay depth-tested so they still sit correctly among the
    // cards on the board, and the additive glow is order-independent anyway.
    depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.InstancedMesh(flakeGeo, haloMat, flakeN);
  halo.frustumCulled = false;
  group.add(halo);

  const tone = new THREE.Color();
  for (let i = 0; i < flakeN; i++) {
    tone.setRGB(rnd(0.8, 1.25), rnd(0.6, 1.0), rnd(0.75, 1.1));
    flakes.setColorAt(i, tone);
  }
  flakes.instanceColor.needsUpdate = true;

  const fk = [];
  const fcols = Math.min(5, flakeN);
  const frows = Math.ceil(flakeN / fcols);
  for (let i = 0; i < flakeN; i++) {
    // spread over the card the same way the motes are, because they are the
    // same card coming apart — scattered at random, four of them landed on
    // top of each other and the card looked like it broke in three places
    const x = (((i % fcols) + 0.5) / fcols - 0.5) * CARD_W * 0.92 + rnd(-0.13, 0.13);
    const z = ((Math.floor(i / fcols) + 0.5) / frows - 0.5) * CARD_H * 0.92 + rnd(-0.13, 0.13);
    const u = 0.5 + (z * home) / CARD_H;
    const off = depart + rnd(0, 0.10) + u * 0.05;
    fk.push({
      x, z, len: rnd(0.20, 0.46),
      born: SWEEP0 + u * SWEEP + rnd(0, 0.05),
      vy: rnd(1.05, 2.25),
      dx: rnd(-0.85, 0.85), dz: rnd(-0.70, 0.70),
      tx: rnd(-1, 1), tz: rnd(-1, 1), lean: rnd(0, 3), spin: rnd(-1.3, 1.3),
      departAt: off,
      span: Math.max(0.3, arrive + rnd(-0.03, 0.04) - off),
    });
  }

  /* --- the landing. The crystal comes back together into a card at the hand:
     the same rounded plate the seam came off, a ring, and a short light. Rule
     three of owning a card's exit is that the motes must arrive SOMEWHERE —
     and this is also the half of the user's sentence about a returned card
     appearing in the hand rather than simply ceasing over the board. */
  const plate = land ? new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 0.92, CARD_H * 0.92),
    new THREE.MeshBasicMaterial({
      map: ghostTex(), color: 0xff4d84, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  ) : null;
  if (plate) {
    plate.rotation.x = -Math.PI / 2;
    plate.position.copy(to);
    group.add(plate);
  }

  /* --- the light. LOW and LONG, where the Dragon's is bright and short: this
     is a card quietly coming apart and a flash would read as a kill. It is
     also the only thing lighting the facets, so it travels with the crystal
     instead of staying over the square it left. Reach 4.4 against 2.9 between
     squares means a neighbour catches an edge of it and the far side of the
     board catches nothing, which is the line shardfire draws too. */
  const lamp = new THREE.PointLight(0xff3a72, 0, 4.4, 2);
  lamp.position.copy(p).setY(p.y + 0.5);
  group.add(lamp);

  const vec = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  // the line of flight, for the flakes to swing onto as they leave
  const aim = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    trip.clone().setY(trip.y + 1.2).normalize(),
  );

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    if (seam) {
      const sweep = Math.min(1, Math.max(0, (s - SWEEP0) / SWEEP));
      const gy = face + 0.5 * (1 - (1 - Math.min(1, s / 0.46)) ** 2);
      seam.position.set(p.x, gy, p.z + home * (sweep - 0.5) * CARD_H * 1.12);
      seam.material.opacity = 1.05 * Math.min(1, sweep * 6) * (1 - sweep) ** 0.5;
    }

    if (iris) {
      const iu = Math.min(1, Math.max(0, (s - 0.01) / 0.40));
      iris.scale.setScalar(1.28 - 1.08 * (1 - (1 - iu) ** 2.2));
      iris.material.opacity = 0.5 * Math.min(1, iu * 5) * (1 - iu) ** 0.8;
      pool.material.opacity = 0.24 * Math.min(1, s / 0.25) * Math.max(0, 1 - s / 0.95) ** 1.6;
      pool.scale.setScalar(0.8 + 0.25 * Math.min(1, s / 0.5));
    }

    runCloud(dust, dustM, s);
    runCloud(glim, glimM, s);

    for (let i = 0; i < flakeN; i++) {
      const f = fk[i];
      const age = s - f.born;
      if (age <= 0) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        flakes.setMatrixAt(i, mat4); halo.setMatrixAt(i, mat4);
        continue;
      }
      const u = Math.min(1, Math.max(0, (s - f.departAt) / f.span));
      const k = u ** 1.2;               // the leaving BUILDS; it does not jerk
      const g = 0.62 * Math.sin(Math.PI * k);   // gathers, then opens out
      vec.set(
        p.x + f.x + f.dx * age,
        face + 0.05 + f.vy * age * (1 - 0.34 * age),
        p.z + f.z + f.dz * age,
      );
      const lay = k * k;                // back to its own place on the card
      vec.x += (p.x + f.x - vec.x) * lay;
      vec.y += (face + 0.05 - vec.y) * lay;
      vec.z += (p.z + f.z - vec.z) * lay;
      vec.x += (p.x - vec.x) * g;
      vec.z += (p.z - vec.z) * g;
      vec.y += (face + 0.55 - vec.y) * g * 0.5;
      vec.x += trip.x * k;
      vec.y += trip.y * k + ARC * Math.sin(Math.PI * k);
      vec.z += trip.z * k;
      axis.set(f.tx, 0.35, f.tz).normalize();
      q.setFromAxisAngle(axis, f.lean + f.spin * age);
      // and it TURNS TO POINT THE WAY IT IS GOING. Tumbling all the way out,
      // the departure was a drift of slivers at every angle; swung onto the
      // line of flight they read as a shoal, and the direction the fighter
      // went is legible from a single frame.
      q.slerp(aim, Math.min(1, k * 1.4));
      // Up to full size in 125ms and it does not shrink on the way — a flake
      // that fades in mid-air never looks like it came OFF anything, and one
      // that thins out over the journey never looks like it got there. It
      // arrives whole, holds for a breath, and is gone.
      const after = Math.max(0, s - (f.departAt + f.span));
      const size = f.len * Math.min(1, age * 8) * Math.max(0, 1 - after / 0.28);
      mat4.compose(vec, q, scl.setScalar(size));
      flakes.setMatrixAt(i, mat4);
      mat4.compose(vec, q, scl.setScalar(size * 1.6));
      halo.setMatrixAt(i, mat4);
    }
    flakes.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    haloMat.opacity = 0.55 * Math.max(0, 1 - s / (arrive + 0.6));
    flakeMat.emissiveIntensity = Math.max(0.3, 1 - s / (arrive + 0.4));

    // the lamp rides with the crystal, so what is lit is where the fighter is,
    // not the empty square it left
    const lu = Math.min(1, Math.max(0, (s - depart) / Math.max(0.2, arrive - depart)));
    const lk = lu ** 1.2;
    lamp.position.set(p.x + trip.x * lk, p.y + 0.5 + trip.y * lk + ARC * Math.sin(Math.PI * lk),
      p.z + trip.z * lk);
    lamp.intensity = 4.6 * Math.min(1, s / 0.14) * Math.max(0, 1 - s / (arrive + 0.25)) ** 1.3;

    if (plate) {
      // it puts itself back together just as the crystal gets there
      // Kept UNDER the crystal, not over it. At 0.85 this and the arriving
      // motes summed past white and the hand caught a pale grey bubble; the
      // card shape has to be the thing you see, and it is the shape that
      // carries it, not the brightness.
      const a = (s - (arrive - 0.1)) / 0.44;
      if (a > 0 && a < 1) {
        plate.material.opacity = 0.72 * Math.min(1, a / 0.2) * (1 - a) ** 1.5;
        plate.scale.setScalar(0.82 + 0.2 * easeOut(Math.min(1, a / 0.35)));
      } else {
        plate.material.opacity = 0;
      }
    }
  });
}

/* --------------------------------------------------------------- motif */

/**
 * The flourish where the SPELL went off, which is not where the fighter is.
 *
 * `at` is the card that resolved — the Shard Wisp dying on its own square, or
 * a Tactic that is not on the board at all and resolves to nothing here. The
 * fighter being bounced is somebody else, and everything that happens to it
 * happens in `exit.hand` below. So this is deliberately SMALL: a ring closing
 * on the stone and a few chips of crystal lifting off it. It used to be the
 * whole motif, card ghost and all, which meant the Shard Wisp's own square
 * played "a card is being unmade here" while the wisp was being struck flat
 * and thrown on the discard pile — the wrong sentence about the wrong card.
 */
export function bounce(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const piece = kit.piece(at);
  const home = (piece?.owner ?? 0) === 0 ? 1 : -1;
  // nowhere in particular: up and a little toward the caster's own end, and
  // out. Nothing is leaving from here, so nothing lands.
  const to = p.clone().add(new THREE.Vector3(0, 1.0, home * 1.6));
  unmake(kit, p, to, {
    flakeN: 6, dustN: 18, glimN: 12,
    seamOn: false, land: false, depart: 0.3, arrive: 0.95,
  });
}

/**
 * How long the card stays on its square after the rules have resolved.
 *
 * Short. The exit IS the animation here — there is nothing to wait for except
 * one beat of the caster's flourish, and for two of the three cards there is
 * not even that, so a long wait would be an empty board.
 */
export const timing = { kill: 0.15 };

export const exit = {
  /**
   * THE FIGHTER GOES HOME. The card is ours for this, so the card itself is
   * what comes apart: it lights up from within, thins away to nothing, and the
   * crystal it leaves behind is what carries it to the hand.
   *
   * The card does NOT travel. There is nothing left of it to travel by the
   * time the crystal sets off — that is the whole difference between this and
   * the generic `anim.vanish` it replaces, which shrank the intact slab and
   * pulled it home like a yo-yo whatever the effect had just said.
   */
  hand(kit, piece, square, ev, done) {
    const at = piece.group.position.clone();
    // Where every returning card goes. Diversion (C071) actually sends its
    // fighter to the BOTTOM OF THE DECK rather than the hand, and the deck
    // stands beside kit.grave(owner) — but the fx event carries only the
    // SOURCE card's uid, and a Tactic is not on the board to be looked up, so
    // there is nothing here to tell the two cases apart with. The hand is the
    // common one and the deck is a foot away from it.
    // WHERE IT LANDS. kit.hand(owner) is the destination and the direction
    // is taken straight from it, but the point itself is off the table on the
    // grass, and this arena has trees and boulders standing between the
    // camera and that patch: photographed at t+1320 the arrival was a pale
    // smudge over a lit green bush — additive pink over bright foliage sums
    // past white, so what should have been a card was a grey stain. It lands
    // instead on the dark apron just inside the player's own end, three
    // quarters of the way there and a little up: the same journey, and
    // somewhere the arrival can actually be seen.
    //
    // On the LEFT of that end, mirrored from the hand rather than copied,
    // because the right of it is where the discard pile stands — a returning
    // card that lands beside the graveyard is telling the wrong story.
    const h = kit.hand(piece.owner);
    const to = new THREE.Vector3(-h.x * 0.9, 1.35, h.z * 0.76);
    piece.animating = true;

    unmake(kit, at, to, { depart: 0.42, arrive: 1.15 });

    // The card: lit, then thinned out. EVERY material, not just the face —
    // the edge and the back are their own opaque materials, and fading the
    // face alone leaves a dark rectangle lying on the stone, a fighter
    // dissolving into a coaster.
    const mats = [...new Set([].concat(piece.card3d.material))];
    const base = mats.map((m) => [m.color.clone(), m.opacity, m.transparent]);
    for (const m of mats) m.transparent = true;

    const CARD = 0.46;                  // gone before the crystal sets off
    kit.anim.add(CARD, (t) => {
      // it goes the colour of the crystal first, which is what makes the
      // crystal read as the card rather than as something thrown at it
      const hot = Math.min(1, t / 0.2);
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]).lerp(GLOW, 0.8 * hot);
      }
      const g = Math.max(0, (t - 0.16) / 0.84);
      piece.group.position.y = at.y + 0.2 * easeOut(Math.min(1, t / 0.55));
      piece.tilt.rotation.x = -0.09 * g;
      piece.group.scale.setScalar(1 - 0.1 * g);
      for (let i = 0; i < mats.length; i++) mats[i].opacity = base[i][1] * (1 - g ** 1.3);
    }, () => {
      // Restore everything borrowed. Pieces are POOLED: a card that came back
      // from the pool pink, half transparent and a tenth too small is a ghost
      // on somebody's later turn.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]);
        mats[i].opacity = base[i][1];
        mats[i].transparent = base[i][2];
      }
      piece.group.position.copy(at);
      piece.group.scale.setScalar(1);
      piece.tilt.rotation.set(0, 0, 0);
      piece.animating = false;
      // Once, and here: the card body is finished, and the crystal that is
      // still in the air is scene furniture of its own. Holding the piece
      // until the landing only keeps a retired, invisible slab on the board.
      done?.();
    });
  },
};
