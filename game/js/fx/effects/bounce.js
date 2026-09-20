// BOUNCE — a fighter is UNMADE and goes home to its owner's hand.
//
// Shared by 3 cards: R060 Shard Wisp, C073 Unmarked Trails, C071 Diversion.
// One motif, one file — worked on on its own.
//
// The three cards all say the same thing in different words: the fighter is
// not killed, it is TAKEN OFF THE TABLE and put somewhere — a hand, the bottom
// of a deck. So this is the faction's other face: same crystal, same reddish
// pink as the Shard Dragon's fire, but nothing is thrown, nothing burns and
// nothing is left on the stone.
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
//     than about two units a second, where a blade of the Dragon's leaves at
//     five and shatters at the top of its arc.
//   - it GOES SOMEWHERE. Everything ends up travelling off the square toward
//     the end of the table its owner sits at, which is where the hand is.
//
// Two things about the timing, both learned the hard way on this table:
//   - the card is NOT ours for long. The board diff runs before state.fx, so
//     for a real bounce anim.vanish() has already taken the card and will have
//     retired it 400ms from now. The motif therefore never depends on the card
//     being there, and only touches it at all when nothing else is (fxlab, the
//     preview harness).
//   - the DEPARTURE IS LAST. An earlier arrangement had the motes stream off
//     immediately and the square then sat empty for a second; and on another
//     motif the card was pulled away before the flourish landed and the whole
//     thing read as a bug. Here the unmaking happens on the card, over its
//     first third of a second, and the leaving happens after it.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=300&van=1" \
//             --eval tools/fxdemo/bounce.js --out /tmp/b-300.png --settle 700
// ?t is milliseconds into the motif and &van=1 makes the preview do what the
// real table does with the card. Both matter: without &van the card sits on
// its square and you are looking at fxlab, not at a bounce.

import { THREE, CARD_W, CARD_H } from '../kit.js';

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
 * The CARD'S OWN SHAPE, soft at the edges: a rounded rectangle, brightest
 * along the middle. This is the ghost the fighter leaves when it is taken
 * off the board, so it has to be card-shaped — the round blob that was here
 * first read as a puff of smoke sitting on the flagstone, which is the one
 * thing every other effect on this table already looks like.
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
// over a card is exactly where that happens. Green near 0.15 keeps the core
// pink however many motes overlap.
const HOT = new THREE.Color(1.0, 0.22, 0.42);       // the freshest motes
const COOL = new THREE.Color(0.52, 0.03, 0.16);     // as one fades out

// The whole thing, and the UI is held for all of it, so it is as short as it
// can be and still land. The last mote sets off at 0.57 and takes 0.88, which
// is the number this has to clear; the lamp is dark before that.
const SPAN = 1.5;

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

/* -------------------------------------------------------------- motif */

export function bounce(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const piece = kit.piece(at);

  // WHICH WAY HOME. A card belongs to the player it faces, and that player's
  // hand is off the near or far end of the table, so the whole motif drifts
  // that way — a bounce you can see the direction of is a bounce you can tell
  // apart from a death. With no piece to ask (a Tactic resolving), the near
  // end is the safe guess: that is where the camera is.
  const home = (piece?.owner ?? 0) === 0 ? 1 : -1;

  const floor = 0.095;                  // the flagstone face, plus a hair
  // Flat things that belong to the CARD have to clear its face, which sits
  // about 0.055 above the card's own origin. Drawn at at.y they lose the depth
  // test against the card and appear only on the stone around it.
  const face = p.y + 0.055;
  const group = new THREE.Group();

  /* --- the ghost. The card's own shape, lifting off the square and coming
     apart as it goes.
     
     This is the only part of the motif that can stand in for the card itself,
     because THE CARD IS ALREADY LEAVING. sync() runs the board diff before it
     plays state.fx, so anim.vanish() has hold of the piece on the very frame
     this function is called: 200ms from now the slab is a unit and a half up
     in the air on its way to its owner, and 400ms from now it has been
     retired. Photographed at t+80ms the square held one faint ring with the
     fighter in mid-flight above it — the motif had no opening at all. The
     ghost gives it one: the fighter's outline flares where it stood, lifts,
     and is gone before the eye asks why there are two of it. */
  const SWEEP0 = 0.02, SWEEP = 0.16;
  const ghost = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.06, CARD_H * 1.06),
    new THREE.MeshBasicMaterial({
      map: ghostTex(), color: 0xff3a72, transparent: true, opacity: 0,
      // DEPTH TEST OFF, both here and on the seam. anim.vanish() lifts the
      // card 1.6 units in the first 200ms and it flies straight over the
      // square: depth-tested, the whole opening of the motif was hidden
      // behind the very card it is about — at t+60ms the shot showed a slab
      // in mid-air and a bare flagstone under it.
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  );
  ghost.rotation.x = -Math.PI / 2;
  ghost.position.set(p.x, face, p.z);
  group.add(ghost);

  /* --- the seam: one bright line crossing the ghost in the direction the
     fighter is about to leave in, and the crystal wakes up behind it. This is
     the part that says UNMADE rather than blown up — there is a front, it
     passes over the card once, and what is behind it is no longer card. */
  const seam = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.02, CARD_H * 0.46),
    new THREE.MeshBasicMaterial({
      map: seamTex(), color: 0xff5f92, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }),
  );
  seam.rotation.x = -Math.PI / 2;
  seam.position.set(p.x, face + 0.01, p.z);
  group.add(seam);

  /* --- the iris, on the STONE. A thin ring that CONTRACTS into the middle of
     the square. The Dragon's fire throws a shockwave outward from exactly
     here; this is the same gesture run backwards, which is the cheapest way to
     tell a viewer at a glance that this is the opposite kind of event. It also
     leaves the eye somewhere to look once the crystal has climbed away. */
  const iris = new THREE.Mesh(
    new THREE.RingGeometry(0.945, 1.0, 56),
    new THREE.MeshBasicMaterial({
      color: 0xff5c90, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  iris.rotation.x = -Math.PI / 2;
  iris.position.set(p.x, floor + 0.03, p.z);
  group.add(iris);

  /* --- the pool on the stone. Pale, additive, and GONE by the end — the one
     thing shardfire leaves behind is a dark scorch, and the whole point of
     this motif is that the square is untouched afterwards. */
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: softTex(), color: 0xc42a58, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(p.x, floor + 0.012, p.z);
  group.add(pool);

  /* --- the motes. Laid out over the CARD'S footprint, not in a circle: what
     comes apart is a rectangle of printed card, and a round puff of particles
     is what every other effect in this game already looks like.

     Each one wakes when the seam reaches it, floats, and then leaves. The
     leaving is staggered so the cloud drains away toward the hand instead of
     all of it going at once, which looked like a cut rather than a departure.
     */
  const DEPART = 0.42;                  // after the unmaking, never during it
  // WHERE IT GOES, and this had to be MEASURED rather than reasoned about. I
  // built the departure as a tall climb first, on the argument that height is
  // the axis a table-top camera reads best. It is the opposite. The camera
  // sits at (0, 19.6, 18.6) — nearly overhead — so projecting the end of the
  // journey gives: climb 3.4 with 2.6 of reach lands ELEVEN pixels from where
  // it started, while climb 1.2 with 4.4 of reach lands a hundred. The tall
  // version looked exactly like crystal hanging over the square fading out,
  // which is the one thing this motif must not do. So the swarm travels mostly
  // ALONG the table toward the end its owner sits at, with just enough lift to
  // come off the board.
  const REACH = 6.0;                    // the owner's hand is about that far
  const CLIMB = 1.3;
  const make = (n, rise, lit) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      // a jittered grid, so the cloud keeps the card's shape for the first
      // moments; scattered at random it read as a puff from the very first
      // frame and the card was never legible in it
      const cols = Math.ceil(Math.sqrt(n * (CARD_W / CARD_H)));
      const rows = Math.ceil(n / cols);
      const gx = (((i % cols) + 0.5) / cols - 0.5) * CARD_W;
      const gz = ((Math.floor(i / cols) + 0.5) / rows - 0.5) * CARD_H;
      const x = gx + rnd(-0.06, 0.06);
      const z = gz + rnd(-0.06, 0.06);
      // the seam runs toward the hand, so a mote's birth is where it stands
      // along that axis
      const u = 0.5 + (z * home) / CARD_H;
      out.push({
        x, z,
        born: SWEEP0 + u * SWEEP + rnd(0, 0.07),
        vy: rnd(1.55, 3.10) * rise,
        dx: rnd(-0.95, 0.95), dz: rnd(-0.80, 0.80),
        swirl: rnd(0, Math.PI * 2), swirlR: rnd(0.02, 0.10),
        departAt: DEPART + rnd(0, 0.10) + u * 0.05,
        travel: rnd(0.78, 0.88),
        flick: rnd(9, 22), bright: rnd(0.62, 1) * lit,
      });
    }
    return out;
  };

  const DUST = 46, GLIM = 24;
  const dust = cloud(DUST, dustTex(), 0.26, 0.45);
  const glim = cloud(GLIM, glimmerTex(), 0.55, 1.0);
  const dustM = make(DUST, 1, 0.85);
  const glimM = make(GLIM, 1.15, 1.35);
  group.add(dust.points, glim.points);

  const tint = new THREE.Color();
  const runCloud = (c, list, s) => {
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const a4 = i * 4;
      const age = s - m.born;
      if (age <= 0) { c.col[a4 + 3] = 0; continue; }
      const u = Math.min(1, Math.max(0, (s - m.departAt) / m.travel));
      const k = u ** 1.2;               // eases INTO the journey; it builds
      // float
      let x = p.x + m.x + m.dx * age + Math.sin(m.swirl + age * 2.1) * m.swirlR;
      let y = face + 0.02 + m.vy * age * (1 - 0.42 * age);
      let z = p.z + m.z + m.dz * age + Math.cos(m.swirl + age * 1.7) * m.swirlR;
      // and then HOME, in two parts that happen at once: the scatter is
      // GATHERED back toward the middle of the square, and the whole gathered
      // thing is carried off the board. Without the gather the cloud just
      // slid sideways keeping the width it had spread to, and a 3-unit-wide
      // smear of crystal crossing the table read as debris rather than as
      // something being taken. Drawn in as it goes, it reads as a stream.
      // The pull is toward the CENTRE LINE of the table (x * 0.4), because
      // both hands are off the middle of their own end.
      const g = 0.62 * k;
      x += (p.x * 0.4 - x) * g;
      z += (p.z - z) * g;
      y += (face + 0.55 - y) * g * 0.5;
      y += CLIMB * k;
      z += home * REACH * k;
      c.pos[i * 3] = x; c.pos[i * 3 + 1] = y; c.pos[i * 3 + 2] = z;
      tint.copy(HOT).lerp(COOL, Math.min(1, u * 1.2));
      const flick = 0.72 + 0.28 * Math.sin(age * m.flick + i);
      const fade = Math.min(1, (1 - u) / 0.26) ** 1.1;
      c.col[a4] = tint.r; c.col[a4 + 1] = tint.g; c.col[a4 + 2] = tint.b;
      c.col[a4 + 3] = m.bright * flick * fade * Math.min(1, age / 0.09);
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
     hard silhouette. So the card now comes apart into a dozen of them, and the
     motes are the glitter around them.

     Same squeezed octahedron the Dragon's fire throws, so the two motifs are
     plainly the same crystal. The difference is what happens to it: shardfire
     launches blades at 5 units a second and breaks them at the top of the arc;
     these lift off at under 1.5, keep turning over, and are carried away
     whole. Nothing here shatters. */
  const FLAKES = 18;
  const flakeGeo = new THREE.OctahedronGeometry(0.5, 0);
  flakeGeo.scale(0.34, 1, 0.27);        // slim enough to be a shard, not so
                                        // flat it vanishes when it turns edge-on
  const flakeMat = new THREE.MeshStandardMaterial({
    color: 0x8d1740, emissive: 0xff2f68, emissiveIntensity: 1.0,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, FLAKES);
  flakes.frustumCulled = false;
  flakes.castShadow = true;
  group.add(flakes);

  // A larger, purely additive copy of every flake. The braziers are low and
  // warm and the board is dark: lit crystal alone came out as dull maroon
  // chips, and this is the heat coming off them that makes them read as
  // crystal rather than as gravel.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff3f7a, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.InstancedMesh(flakeGeo, haloMat, FLAKES);
  halo.frustumCulled = false;
  group.add(halo);

  const tone = new THREE.Color();
  for (let i = 0; i < FLAKES; i++) {
    tone.setRGB(rnd(0.8, 1.25), rnd(0.6, 1.0), rnd(0.75, 1.1));
    flakes.setColorAt(i, tone);
  }
  flakes.instanceColor.needsUpdate = true;

  const fk = [];
  for (let i = 0; i < FLAKES; i++) {
    // spread over the card the same way the motes are, because they are the
    // same card coming apart — scattered at random, four of them landed on
    // top of each other and the card looked like it broke in three places
    const cols = 5, rows = Math.ceil(FLAKES / 5);
    const x = (((i % cols) + 0.5) / cols - 0.5) * CARD_W * 0.92 + rnd(-0.08, 0.08);
    const z = ((Math.floor(i / cols) + 0.5) / rows - 0.5) * CARD_H * 0.92 + rnd(-0.08, 0.08);
    const u = 0.5 + (z * home) / CARD_H;
    fk.push({
      x, z, len: rnd(0.20, 0.46),
      born: SWEEP0 + u * SWEEP + rnd(0, 0.05),
      vy: rnd(1.05, 2.25),
      dx: rnd(-0.85, 0.85), dz: rnd(-0.70, 0.70),
      tx: rnd(-1, 1), tz: rnd(-1, 1), lean: rnd(0, 3), spin: rnd(-1.3, 1.3),
      departAt: DEPART + rnd(0, 0.10) + u * 0.05, travel: rnd(0.78, 0.88),
    });
  }

  /* --- the light. LOW and LONG, where the Dragon's is bright and short: this
     is a card quietly coming apart and a flash would read as a kill. It is
     also the only thing lighting the facets, so it follows the crystal instead
     of staying over the empty square. Reach 4.4 against 2.9 between squares
     means a neighbour catches an edge of it and the far side of the board
     catches nothing, which is the line shardfire draws too. */
  const lamp = new THREE.PointLight(0xff3a72, 0, 4.4, 2);
  lamp.position.set(p.x, p.y + 0.5, p.z);
  group.add(lamp);

  // the card itself, ONLY if nothing else has hold of it (fxlab, the preview
  // harness). In a real bounce anim.vanish() owns the transform and the
  // opacity, and fighting it made the card strobe.
  //
  // EVERY material on the slab, not just the face. Fading the face alone left
  // a dark rectangle lying on the stone — the card's edge and back are their
  // own opaque materials, so what you got was the fighter dissolving into a
  // coaster.
  const mine = piece && !piece.animating && piece.card3d ? piece : null;
  const mats = mine ? [...new Set([].concat(mine.card3d.material))] : [];
  const was = mats.map((m) => [m.opacity, m.transparent]);
  for (const m of mats) m.transparent = true;

  const vec = new THREE.Vector3();
  const q = new THREE.Quaternion();
  // the line of flight, for the flakes to swing onto as they leave
  const aim = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, CLIMB, home * REACH).normalize(),
  );
  const axis = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;
    const sweep = Math.min(1, Math.max(0, (s - SWEEP0) / SWEEP));

    // The ghost is there on the FIRST frame at full size — it does not grow
    // in. It rises as it burns off, so the fighter reads as leaving upward
    // rather than as a lamp switching on and off on the flagstone.
    const gu = Math.min(1, s / 0.46);
    const gy = face + 0.62 * (1 - (1 - gu) ** 2);
    ghost.position.y = gy;
    ghost.material.opacity = 0.62 * Math.min(1, s / 0.04) * (1 - gu) ** 1.4;

    // the seam crosses it and fades as it leaves the far edge
    seam.position.set(p.x, gy + 0.012, p.z + home * (sweep - 0.5) * CARD_H * 1.12);
    seam.material.opacity = 1.05 * Math.min(1, sweep * 6) * (1 - sweep) ** 0.5;

    const iu = Math.min(1, Math.max(0, (s - 0.01) / 0.40));
    iris.scale.setScalar(1.28 - 1.08 * (1 - (1 - iu) ** 2.2));
    iris.material.opacity = 0.5 * Math.min(1, iu * 5) * (1 - iu) ** 0.8;

    pool.material.opacity = 0.24 * Math.min(1, s / 0.25) * Math.max(0, 1 - s / 0.95) ** 1.6;
    pool.scale.setScalar(0.8 + 0.25 * Math.min(1, s / 0.5));

    runCloud(dust, dustM, s);
    runCloud(glim, glimM, s);

    for (let i = 0; i < FLAKES; i++) {
      const f = fk[i];
      const age = s - f.born;
      if (age <= 0) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        flakes.setMatrixAt(i, mat4); halo.setMatrixAt(i, mat4);
        continue;
      }
      const u = Math.min(1, Math.max(0, (s - f.departAt) / f.travel));
      const k = u ** 1.2;               // the leaving BUILDS; it does not jerk
      const g = 0.62 * k;               // ...and gathers as it goes, see above
      vec.set(
        p.x + f.x + f.dx * age,
        face + 0.05 + f.vy * age * (1 - 0.34 * age),
        p.z + f.z + f.dz * age,
      );
      vec.x += (p.x * 0.4 - vec.x) * g;
      vec.z += (p.z - vec.z) * g;
      vec.y += (face + 0.55 - vec.y) * g * 0.5;
      vec.y += CLIMB * k;
      vec.z += home * REACH * k;
      axis.set(f.tx, 0.35, f.tz).normalize();
      q.setFromAxisAngle(axis, f.lean + f.spin * age);
      // and it TURNS TO POINT THE WAY IT IS GOING. Tumbling all the way out,
      // the departure was a drift of slivers at every angle; swung onto the
      // line of flight they read as a shoal, and the direction the fighter
      // went is legible from a single frame.
      q.slerp(aim, Math.min(1, k * 1.4));
      // Up to full size in 125ms and it does not shrink on the way — a flake
      // that fades in mid-air never looks like it came OFF anything — but it
      // thins to nothing as it goes home. Slowing that ramp to 180ms to make
      // the unmaking gentler cost the opening: the card is still flying over
      // its own square for the first 250ms and half-size crystal underneath it
      // was invisible.
      const size = f.len * Math.min(1, age * 8) * Math.min(1, (1 - u) / 0.32);
      mat4.compose(vec, q, scl.setScalar(size));
      flakes.setMatrixAt(i, mat4);
      mat4.compose(vec, q, scl.setScalar(size * 1.6));
      halo.setMatrixAt(i, mat4);
    }
    flakes.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    haloMat.opacity = 0.55 * Math.max(0, 1 - s / 1.8);
    flakeMat.emissiveIntensity = Math.max(0.25, 1 - s / 1.2);

    // the lamp rides with the cloud, so the departure is lit rather than the
    // empty square it left
    const lu = Math.min(1, Math.max(0, (s - DEPART) / 0.8));
    lamp.position.set(p.x, p.y + 0.5 + CLIMB * 0.5 * lu * lu, p.z + home * REACH * 0.6 * lu * lu);
    lamp.intensity = 4.6 * Math.min(1, s / 0.14) * Math.max(0, 1 - s / 1.4) ** 1.3;

    if (mine) {
      // fades out behind the seam — the whole card at once, because a sprite
      // cannot mask half a mesh, but timed to the seam so the eye reads the
      // line as the thing doing it
      const gone = Math.max(0, 1 - Math.max(0, (s - 0.07) / 0.24));
      for (let i = 0; i < mats.length; i++) mats[i].opacity = was[i][0] * gone;
      mine.lift = 0.14 * Math.min(1, s / 0.4);
    }
  }, () => {
    for (let i = 0; i < mats.length; i++) {
      mats[i].opacity = was[i][0];
      mats[i].transparent = was[i][1];
    }
    if (mine) mine.lift = 0;
  });
}
