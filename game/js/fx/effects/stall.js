// PETRIFIED — a fighter is STOPPED rather than killed.
//
// Shared by 2 cards: C049 (Greater Cockatrice, "Petrifying Gaze") and C076
// (Burnout). The Cockatrice is the image the motif is built on: grey stone
// creeps in over a living fighter and locks it where it stands.
//
// The whole motif turns on ONE thing the other effects do not do: it ENDS
// STILL. Everything else on this table throws something, burns something or
// takes something away, and the last frame is always the board settling back
// to normal. Here the card is still there, still whole, and dead weight — so
// the last second and a half of the span is a completely static frame. No
// flicker, no drift, no pulsing light. Every oscillator in this file is gated
// off before the hold starts, because a single 2Hz sine left running is the
// difference between "stopped" and "idling".
//
// Everything else follows from that:
//   - the card has to MOVE first or its stopping reads as nothing. It flinches
//     when the gaze lands and then judders, and the judder's amplitude is tied
//     to how much of it is already stone, so the struggle is visibly being put
//     out rather than just fading on a timer.
//   - it seizes MID-MOTION. A small permanent tilt and yaw are left on the
//     card when the stone closes. Returned to square, the final frame was just
//     "a grey card", indistinguishable from the engine's own fatigue grey.
//   - the effect DRAINS colour instead of adding it. Shardsworn's other motifs
//     are reddish-pink crystal; this one has no faction colour in it at all.
//     Grey against the braziers' warm light is the read.
//   - nothing in it is additive except the two hundred milliseconds of the
//     gaze. At this exposure (ACES, 1.18) additive geometry comes out of the
//     tone mapper as a white slab, and the stone has to be a SOLID — lit by
//     the scene, taking the scene's shadows, sitting at the same value as the
//     flagstones under it.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&seedfx=3&t=900" \
//             --eval tools/fxdemo/stall.js --out /tmp/st.png \
//             --wait 6000 --settle 600
//
// Take the spread WELL PAST the motion — t=2200 and t=3000 are what prove the
// held frame actually holds. &seedfx pins the dice so two tunings can be
// compared; without it every shot rolls a different pile of rock.

import { THREE, CARD_W, CARD_H, easeOut } from '../kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map, so building these per cast would leak one
// canvas per petrified fighter.
const TEXES = new Map();
function tex(key, paint, size = 256) {
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
 * Granite. Dead NEUTRAL — no channel bias at all — and painted at roughly the
 * value of the flagstones it will lie on, with its contrast carried by the
 * mottling rather than by being dark.
 *
 * Getting that wrong cost two passes. Painted dark, on the reasoning that
 * "stone is dark" and that the brief asks for the dark rather than more light,
 * the crust rendered as a BLACK RECTANGLE the exact size of the card with the
 * lumps standing on it like white pebbles; at t+900ms the square read as a hole
 * in the board with rubble in it. A destroyed card leaves a hole. This one is
 * still occupied.
 */
const stoneTex = () => tex('pet-stone', (g, S) => {
  g.fillStyle = '#70727c';
  g.fillRect(0, 0, S, S);
  // broad blotches first, so the grain has something to sit on
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = S * rnd(0.05, 0.19);
    const v = (rnd(0.26, 0.86) * 255) | 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // grain. Fine and dense: sparse big speckles read as dirt on the lens.
  for (let i = 0; i < 9000; i++) {
    const v = (rnd(0.3, 0.82) * 255) | 0;
    g.fillStyle = `rgba(${v},${v},${v},${rnd(0.1, 0.4)})`;
    g.fillRect(Math.random() * S, Math.random() * S, rnd(1, 2.4), rnd(1, 2.4));
  }
  // fissures — DARK lines, never light ones. Bright cracks on a grey plate is
  // the crystal motif next door; a petrified thing is cracked, not glowing.
  g.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    let x = Math.random() * S, y = Math.random() * S, a = Math.random() * 6.28;
    g.strokeStyle = `rgba(26,26,32,${rnd(0.3, 0.72)})`;
    g.lineWidth = rnd(1, 3.6);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      a += rnd(-0.8, 0.8);
      x += Math.cos(a) * S * 0.045; y += Math.sin(a) * S * 0.045;
      g.lineTo(x, y);
    }
    g.stroke();
  }
});

/** A soft round mote, painted white and tinted grey per particle. */
const dustTex = () => tex('pet-dust', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.48);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
}, 64);

/** The ring of dust kicked off the flagstone when the card seizes. */
const puffTex = () => tex('pet-puff', (g, S) => {
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0)');
  grd.addColorStop(0.76, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.92, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  // bitten at the rim so the puff is not a perfect hoop
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
    const r = S * rnd(0.33, 0.47);
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, S * rnd(0.03, 0.08), 0, 6.3);
    g.fill();
  }
}, 128);

/* ----------------------------------------------------------- the motif */

// The scene's fill is a 0x93a9d2 hemisphere at 1.05 and the key is a warm
// directional, so a flat, upward-facing surface here is lit almost entirely by
// the blue half of that. A neutrally-painted crust came out LAVENDER — the
// motif was adding a colour while claiming to take one away. This cancels the
// cast at the material rather than in the texture, because the texture is
// also used on the lumps, whose facets point every which way.
//
// It is also darker than white, but only by about a tenth, and that tenth took
// two passes to place. At full value the crust came out lighter than the
// flagstones it lies on and read as styrofoam. Taken down by a fifth it read,
// at the size the board is actually played at, as a HOLE — a black square where
// a card used to be, which is the picture for a card that has been destroyed,
// the exact opposite of this motif. It has to sit just under the flagstones.
const WARM = 0xe6d9c6;

const SPAN = 3.6;
const GAZE = 0.22;          // the stare lands
const CREEP0 = 0.12;        // stone starts biting at the rim
const CREEP1 = 1.24;        // it closes over the middle
const QUIET = 1.80;         // NOTHING moves after this
const LET_GO = 3.18;        // and the crust hands back to the board

export function stall(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  // A card already in the air belongs to whatever is flying it, and taking its
  // transform away mid-throw would snap it back to its square. The stone still
  // plays on the square in that case; it just does not touch the card.
  const piece = kit.piece(at)?.animating ? null : kit.piece(at);
  // `restingPosition` is where the board says this card lives; the group's own
  // position is wherever the resting lerp had got to this frame, which is not
  // the same thing and drifts under the crust by a few thousandths.
  const home = piece?.restingPosition?.() || p.clone();
  // kit.at() hands back y=0.4 for a bare square index — a card-height guess
  // from before there were cards on it — and the crust would hang in the air.
  if (!piece) home.y = 0.203;
  const card = piece?.frontMat || null;
  const yaw = piece?.baseYaw || 0;

  const group = new THREE.Group();
  group.position.copy(home);
  group.rotation.y = yaw;
  // The crust rides the card and the ground puff does not, so they cannot
  // share a transform: parented together, the puff sank with the card as it
  // got heavy and disappeared INTO the flagstone (face 0.080) at the exact
  // moment it was supposed to be seen.
  const crust = new THREE.Group();
  group.add(crust);

  // The card FACE is 0.0175 above the group origin. The crust sits at 0.040 —
  // clear enough for the depth test at this near/far, and the 0.02 of daylight
  // under it is wanted: from the raised camera you can still see a sliver of
  // the card's own edge underneath, which is what says the fighter is still
  // there rather than having been replaced by a rock.
  const FACE = 0.040;

  /* --- relief. Four sine octaves rather than a noise texture: the crust needs
     its height at arbitrary (x,z) for both the plate vertices and the lumps,
     and it is sampled a few hundred times once, not per frame. */
  const oct = [];
  for (let i = 0; i < 4; i++) {
    oct.push({ fx: rnd(1.4, 4.6), fz: rnd(1.4, 4.6), px: rnd(0, 6.3), pz: rnd(0, 6.3), a: 1 / (i + 1) });
  }
  let wsum = 0;
  for (const o of oct) wsum += o.a;
  const relief = (x, z) => {
    let v = 0;
    for (const o of oct) v += o.a * Math.sin(x * o.fx + o.px) * Math.cos(z * o.fz + o.pz);
    return v / wsum;                                     // -1..1
  };

  /* --- the plate: the grey itself.
     The creeping front is done with a per-vertex ALPHA on an 18x18 grid rather
     than a shader — three takes a 4-component colour attribute as vertex alpha
     (USE_COLOR_ALPHA), and 361 floats a frame costs nothing. A shader would
     have had to be patched into MeshStandardMaterial by hand to keep the
     scene's own lighting, which is the one thing the stone cannot do without:
     unlit, the crust was a flat grey rectangle stuck over the art.

     It is SMALLER than the card, not larger. Covered edge to edge the square
     stopped looking like a card at all — it was a slab of rock on a flagstone,
     and the brief for this motif is that the victim SURVIVES. A rim of the
     card's own drained border left showing all the way round is what says
     there is still a fighter under there; the lumps spill over that rim and
     past it, so the outline is broken without the card being erased. */
  const SEG = 18;
  const pGeo = new THREE.PlaneGeometry(CARD_W * 0.94, CARD_H * 0.94, SEG, SEG);
  pGeo.rotateX(-Math.PI / 2);
  const pPos = pGeo.attributes.position.array;
  const N = pGeo.attributes.position.count;
  const pCol = new Float32Array(N * 4);
  // How far in from the rim each vertex is: 0 at the edge, 1 at the middle.
  // Chebyshev and euclidean mixed, because pure chebyshev closes as a tidy
  // rectangle (a picture frame shrinking) and pure euclidean as a tidy circle.
  // Mixed and jittered it closes like something spreading.
  const dRim = new Float32Array(N);
  const cap = new Float32Array(N);   // how opaque this vertex is ever allowed to be
  const hx = CARD_W * 0.52, hz = CARD_H * 0.52;
  for (let i = 0; i < N; i++) {
    const x = pPos[i * 3], z = pPos[i * 3 + 2];
    const ch = Math.max(Math.abs(x) / hx, Math.abs(z) / hz);
    const eu = Math.min(1, Math.hypot(x / hx, z / hz) * 0.82);
    const d = 1 - (ch * 0.55 + eu * 0.45);
    dRim[i] = clamp01(d + relief(x * 2.1, z * 2.1) * 0.20);
    // thickest in the middle, thinning to nothing at the edge, so the crust
    // is a scab over the card and not a slab lying on it
    pPos[i * 3 + 1] = (0.5 + 0.5 * relief(x * 1.7, z * 1.7)) * 0.135 * (0.22 + 0.78 * dRim[i]);
    pCol[i * 4] = 1; pCol[i * 4 + 1] = 1; pCol[i * 4 + 2] = 1; pCol[i * 4 + 3] = 0;
    // The OUTER ring never goes fully opaque, so the crust's own edge is
    // uneven. This was tried at 1.15 the card's size with the ring dropping to
    // zero, on the theory that stone spilling onto the flagstone would break
    // the rectangle; what it actually drew was a flat pale BORDER round the
    // rock, and at sixty pixels that reads as fog, not stone. The raggedness
    // has to come from the lumps, which have real silhouette; the plate's job
    // is only to not end in a ruled line.
    cap[i] = ch > 0.999 ? rnd(0.3, 0.95) : 1;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
  pGeo.computeVertexNormals();

  const plateMat = new THREE.MeshStandardMaterial({
    map: stoneTex(), color: WARM, roughness: 0.97, metalness: 0,
    // NOT flat shaded. It was tried: at 14 segments across a card that is
    // sixty pixels wide the facets are four pixels each, and four-pixel facets
    // at this light level are noise, not rock — the square came back a grey
    // smudge. Big flat faces are what read as stone here, and those have to
    // come from the lumps, which are ten times the area.
    vertexColors: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const plate = new THREE.Mesh(pGeo, plateMat);
  plate.position.y = FACE;
  plate.receiveShadow = true;
  crust.add(plate);

  /* --- the lumps. The plate alone gives the colour but no silhouette, and at
     this camera a card is about sixty pixels across — a flat grey rectangle
     the same size and shape as the card it covers is a recolour, not a change
     of state. These are faceted solids that stand proud of the crust, so the
     card's outline goes from a clean rectangle to a broken lumpy one, which is
     the thing you can actually see from across the board.

     Few and big. Forty small ones were tried and at sixty pixels they are
     grey static; a dozen that each take up a tenth of the card have a lit face
     and a shadow side and read as rock. */
  const LUMPS = 13;
  const lumpGeo = new THREE.IcosahedronGeometry(0.5, 0);
  // Knocked about before it is used. An icosahedron is a regular solid and
  // thirteen copies of one, however they are turned, read as thirteen copies
  // of one — the eye picks the repeat out at this size. Displacing the
  // twelve vertices once, in the shared geometry, costs nothing and the random
  // per-instance rotation then hides the fact that they are still all the same
  // rock. The range is NARROW: run at 0.55-1.45 the solid came out spiky, and
  // thirteen spiky flattened copies of it read as shattered slate — something
  // that broke, when the whole motif is about something that did not.
  {
    const a = lumpGeo.attributes.position.array;
    const seen = new Map();
    for (let i = 0; i < a.length; i += 3) {
      const key = `${a[i].toFixed(3)},${a[i + 1].toFixed(3)},${a[i + 2].toFixed(3)}`;
      let k = seen.get(key);
      if (k === undefined) { k = rnd(0.72, 1.28); seen.set(key, k); }
      a[i] *= k; a[i + 1] *= k; a[i + 2] *= k;
    }
    lumpGeo.attributes.position.needsUpdate = true;
  }
  // FLAT. Run at a third of their width the lumps piled into a little cairn and
  // the square read as rubble — as something that had come apart, which is the
  // one thing this motif must not say. A shell lying close to the card reads as
  // encasement instead.
  lumpGeo.scale(1, 0.24, 1);
  // The SAME stone as the plate, not a colour picked to look like it. Given
  // its own flat grey the lumps came out a full stop brighter than the crust
  // they sit in and the square read as white chippings on a dark tray.
  const lumpMat = new THREE.MeshStandardMaterial({
    map: stoneTex(), color: WARM, roughness: 0.95, metalness: 0,
    flatShading: true, transparent: true,
  });
  const lumps = new THREE.InstancedMesh(lumpGeo, lumpMat, LUMPS);
  lumps.frustumCulled = false;
  lumps.position.y = FACE;
  // The lumps throw a shadow onto the crust under them. It is the cheapest
  // depth cue available here and the only one that survives the card being
  // sixty pixels wide: without it the rocks and the plate they sit in are the
  // same grey and the whole thing flattens out.
  lumps.castShadow = true;
  // Both meshes are transparent and they interpenetrate, so their order cannot
  // be left to three's back-to-front sort — which is by object CENTRE, and both
  // centres are the same point. The lumps write depth; the plate does not, and
  // draws after so it is correctly hidden where a lump stands over it.
  lumps.renderOrder = 0;
  plate.renderOrder = 1;
  crust.add(lumps);

  const rock = [];
  const tint = new THREE.Color();
  for (let i = 0; i < LUMPS; i++) {
    // Eight round the rim, four inside, one dead centre — at EVEN angles with
    // a little jitter, not at random radii. Left entirely to chance the rocks
    // clumped in one quarter and the rest of the card stayed flat plate, so
    // whether the motif read at all depended on the roll: two seeds of the
    // SAME tuning came back looking like two different effects, and I spent a
    // pass tuning a layout that was really just a bad throw. The rim ring also
    // overhangs the card's edge, which is what breaks the rectangle.
    const rim = i < 8;
    const a = i === LUMPS - 1 ? 0
      : (i / (rim ? 8 : LUMPS - 9)) * Math.PI * 2 + rnd(-0.3, 0.3);
    const r = i === LUMPS - 1 ? rnd(0, 0.12) : rim ? rnd(0.72, 0.96) : rnd(0.44, 0.62);
    const x = Math.cos(a) * r * hx, z = Math.sin(a) * r * hz;
    const ch = Math.max(Math.abs(x) / hx, Math.abs(z) / hz);
    const eu = Math.min(1, Math.hypot(x / hx, z / hz) * 0.82);
    // the same two numbers the plate's vertices are built from, so a lump
    // arrives exactly when the crust under it does
    const dIn = clamp01(1 - (ch * 0.55 + eu * 0.45) + relief(x * 2.1, z * 2.1) * 0.20);
    rock.push({
      x, z,
      d: dIn,
      // WIDE size range, and the middle ones kept OFF the middle. All thirteen
      // within a factor of 1.5 of each other read as a cabbage — identical
      // overlapping petals — and big interior rocks at a third of the card's
      // radius covered the centre by 700ms whatever the plate's own front was
      // doing, so the last island of colour, the beat the whole creep is built
      // around, never appeared on screen at all.
      s: rim ? rnd(0.36, 0.66) : rnd(0.56, 0.82),
      // Sat on top of the PLATE'S OWN HEIGHT at this spot, not at a fixed
      // offset. The plate stands up to 0.135 in the middle of the card and a
      // half-height-0.06 lump placed at 0.06 was BURIED by it — on some rolls
      // the whole interior of the crust was swallowed and the square came back
      // a flat grey card with a couple of rocks round the edge.
      y: (0.5 + 0.5 * relief(x * 1.7, z * 1.7)) * 0.135 * (0.22 + 0.78 * dIn),
      // Tilted, not laid flat. Flattened plates given only a few degrees of
      // tip, sitting on a ring at even angles, arranged themselves into a
      // starburst — the square read as a paper flower. At about 24 degrees
      // they interlock and overlap instead and the ring stops being visible;
      // much past that they go edge-on to this camera and disappear.
      rx: rnd(-0.42, 0.42), ry: rnd(0, 6.28), rz: rnd(-0.42, 0.42),
    });
    // no two the same shade, or thirteen identical grey pebbles read as a
    // pattern rather than as broken stone
    const v = rnd(0.74, 1.1);
    tint.setRGB(v, v, v);
    lumps.setColorAt(i, tint);
  }
  lumps.instanceColor.needsUpdate = true;

  /* --- the gaze. One broad ring above the card, contracting onto it and gone
     inside a quarter second. This is the only part of the motif that arrives
     rather than spreads, and it is what gives the stone a cause: without it
     the crust just started, and the card looked like it had decided to.

     It is drawn ABOVE the card (0.16 up) rather than on the stone, because a
     ring on the flagstone is the ground-effect vocabulary every other motif
     already uses, and this one is not a blast. */
  const gazeMat = new THREE.MeshBasicMaterial({
    color: 0xbcc4d2, transparent: true, opacity: 0, depthWrite: false,
    depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const gaze = new THREE.Mesh(new THREE.RingGeometry(0.80, 1, 56), gazeMat);
  gaze.rotation.x = -Math.PI / 2;
  gaze.position.y = 0.16;
  gaze.renderOrder = 9;
  crust.add(gaze);

  /* --- dust sifting off the edge as the stone takes hold, and the ring of it
     knocked loose when the card finally settles. Grey, and NOT additive: dust
     lit by a brazier is dim, and additive grey at this exposure is a haze of
     white over the card. */
  const DUST = 26;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3);
  const dCol = new Float32Array(DUST * 4);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 4));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    map: dustTex(), size: 0.16, sizeAttenuation: true, vertexColors: true,
    // depth-tested, unlike most particle work in this folder: nothing flies
    // over this square (the whole point is that the victim stays put), so a
    // mote behind a lump should be behind it.
    transparent: true, depthWrite: false,
  }));
  dust.frustumCulled = false;
  crust.add(dust);
  const motes = [];
  for (let i = 0; i < DUST; i++) {
    const a = rnd(0, 6.28);
    const e = rnd(0.72, 1.02);                           // near the rim
    motes.push({
      x: Math.cos(a) * e * hx, z: Math.sin(a) * e * hz,
      vx: Math.cos(a) * rnd(0.04, 0.22), vz: Math.sin(a) * rnd(0.04, 0.22),
      // it FALLS. Dust that rises is smoke, and a fighter turning to stone is
      // not burning — this was the single biggest wrong note in the first cut.
      vy: rnd(-0.05, 0.09),
      born: rnd(CREEP0 + 0.05, CREEP1 - 0.06), life: rnd(0.34, 0.6),
      v: rnd(0.62, 0.95), size: rnd(0.55, 1.25),
    });
  }

  const puff = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 3.0),
    new THREE.MeshBasicMaterial({
      map: puffTex(), color: 0xbbb4a6, transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  puff.rotation.x = -Math.PI / 2;
  // on the FLAGSTONE (face 0.080), not on the card: this is what the seizing
  // shook off the ground, and it has to be seen to be under the card
  puff.position.y = 0.095 - home.y;
  group.add(puff);

  /* --- light. Cool and WEAK. This exists to give the lumps a lit side and a
     dark side; run at anything like kit.light's default the crust went white
     and the whole point of the motif — that the colour is being taken away —
     went with it. It is off well before the still frame, so the held stone is
     lit by nothing but the braziers, and grey under a warm light is as cold as
     this scene can make anything look. */
  const cold = new THREE.PointLight(0xaebbd0, 0, 3.4, 2);
  cold.position.set(-0.7, 1.05, -0.5);
  crust.add(cold);

  /* --- the card itself. `animating` is re-asserted every tick because the
     board's own resting lerp clears it, and pieces.js only leaves the front
     material and the transform alone while it is set. */
  const jit = { x: 0, z: 0, y: 0, t: 0, r: 0 };
  const sgn = () => (Math.random() < 0.5 ? -1 : 1);
  const lock = {                                   // the pose it seizes in
    x: rnd(0.012, 0.035) * sgn(), z: rnd(0.012, 0.035) * sgn(),
    t: rnd(0.03, 0.062) * sgn(), r: rnd(0.04, 0.085) * sgn(),
  };
  const drain = new THREE.Color();
  // scratch, hoisted: nothing is allocated per frame
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const vpos = new THREE.Vector3();
  const vsc = new THREE.Vector3();

  kit.hold(group, SPAN, (t) => {
    const s = t * SPAN;

    /* ---- the creeping front ---- */
    const u = clamp01((s - CREEP0) / (CREEP1 - CREEP0));
    // Mostly linear. Run on easeOut alone — the obvious choice, so the rim goes
    // at once and the middle holds out — at halfway it is already at 0.88 and
    // four fifths of the card was stone within 300ms — the crust arrived
    // rather than crept, and the whole middle of the motif was dead time.
    // Held nearer linear and let go at the end, the ring of stone visibly
    // closes and the last island of colour in the middle is on screen for
    // about a third of a second.
    const front = (u * 0.62 + easeOut(u) * 0.38) * 1.16;
    // and it lets go at the very end, over 0.42s, so the crust is not removed
    // with a pop. In play the fighter is fatigued on its owner's next turn and
    // the board greys it for real; this hands over to that.
    const go = 1 - clamp01((s - LET_GO) / (SPAN - LET_GO));

    for (let i = 0; i < N; i++) {
      // a NARROW ramp. At 0.17 the front was a milky band a third of a card
      // wide and the half-covered card looked fogged rather than half eaten.
      pCol[i * 4 + 3] = clamp01((front - dRim[i]) / 0.10) * cap[i] * 0.98 * go;
    }
    pGeo.attributes.color.needsUpdate = true;

    for (let i = 0; i < LUMPS; i++) {
      const r = rock[i];
      // a lump swells in over 0.13 of front once the front reaches it, with a
      // little overshoot so it looks pushed up from underneath
      const k = clamp01((front - r.d) / 0.13);
      const sw = k < 0.78 ? (k / 0.78) * 1.1 : 1.1 - (k - 0.78) / 0.22 * 0.1;
      eul.set(r.rx, r.ry, r.rz);
      quat.setFromEuler(eul);
      vpos.set(r.x, r.y + r.s * 0.11, r.z);
      vsc.setScalar(r.s * sw * go);
      m4.compose(vpos, quat, vsc);
      lumps.setMatrixAt(i, m4);
    }
    lumps.instanceMatrix.needsUpdate = true;
    lumpMat.opacity = go;

    /* ---- the gaze ---- */
    if (s < GAZE) {
      const g = s / GAZE;
      gaze.scale.setScalar(2.35 - 1.5 * easeOut(g));
      // in fast, out fast, brightest a third of the way through — a ring that
      // fades up is a halo, and a halo is a blessing.
      //
      // The band is a FIFTH of the radius, not a twentieth. Drawn as a hairline
      // it was four pixels of pale grey on a busy board and the opening beat
      // simply did not exist; I spent a pass believing the gaze was not firing.
      gazeMat.opacity = 0.62 * Math.min(1, g / 0.18) * (1 - g) ** 1.4;
    } else {
      gazeMat.opacity = 0;
    }

    /* ---- dust ---- */
    for (let i = 0; i < DUST; i++) {
      const d = motes[i];
      const du = (s - d.born) / d.life;
      const a4 = i * 4;
      if (du <= 0 || du >= 1) { dCol[a4 + 3] = 0; continue; }
      const ds = s - d.born;
      dPos[i * 3] = d.x + d.vx * ds;
      dPos[i * 3 + 1] = FACE + 0.02 + d.vy * ds - 0.55 * ds * ds;
      dPos[i * 3 + 2] = d.z + d.vz * ds;
      dCol[a4] = d.v; dCol[a4 + 1] = d.v; dCol[a4 + 2] = d.v;
      dCol[a4 + 3] = 0.62 * Math.min(1, du * 6) * (1 - du) ** 1.2;
    }
    dGeo.attributes.position.needsUpdate = true;
    dGeo.attributes.color.needsUpdate = true;

    /* ---- the settle on the stone ---- */
    const pu = (s - CREEP1) / 0.55;
    if (pu > 0 && pu < 1) {
      // it has to START wider than the card (1.74) or the whole ring is
      // hidden underneath the thing that made it
      puff.scale.setScalar(0.62 + 0.40 * easeOut(pu));
      puff.material.opacity = 0.44 * Math.min(1, pu * 5) * (1 - pu) ** 1.5;
    } else {
      puff.material.opacity = 0;
    }

    /* ---- light ---- */
    // two beats: the stare, then the forming. Both out by QUIET.
    const stare = s < 0.3 ? (1 - s / 0.3) ** 1.6 * Math.min(1, s / 0.05) : 0;
    const form = clamp01((QUIET - s) / (QUIET - CREEP0)) * Math.min(1, s / 0.2);
    cold.intensity = 2.6 * stare + 0.8 * form * form;

    /* ---- the card ---- */
    if (piece) {
      piece.animating = true;

      // The struggle, and the pose it is left in.
      //
      // MEASURE THE AMPLITUDE IN PIXELS. This ran at 0.022 units for four
      // passes and I could not see it in a single screenshot: a card is 1.74
      // units and about 60 pixels across, so 0.022 units is three quarters of
      // ONE PIXEL, and the two-degree twist under it moved a corner by about
      // the same. The beat the whole motif rests on — it moves, then it stops
      // — was technically present and visually absent.
      //
      // Amplitude is (1 - coverage), not a timer: the shaking is visibly being
      // squeezed out by the stone rather than politely winding down beside it.
      // Two frequencies, or it is a vibration and not a fight.
      const alive = clamp01(1 - front / 1.02);
      const kick = s < GAZE ? Math.min(1, s / 0.06) * (1 - s / GAZE) : 0;
      const amp = alive ** 1.3;
      if (s < CREEP1 + 0.05) {
        // ...and it SEIZES CROOKED. The shake decays to nothing by design, so
        // without this the card settled back to dead square and the final
        // frame was a grey rectangle sitting exactly where a grey rectangle
        // belongs — indistinguishable from the engine's own fatigue grey, and
        // no longer the picture of something caught in the middle of moving.
        // The set pose arrives with the stone and then never changes again.
        const set = clamp01(front / 1.05);
        jit.x = 0.07 * amp * (Math.sin(s * 47) * 0.7 + Math.sin(s * 29.3 + 1.7) * 0.3)
          + lock.x * set;
        jit.z = 0.07 * amp * (Math.cos(s * 41.5 + 0.6) * 0.7 + Math.cos(s * 26.1) * 0.3)
          + lock.z * set;
        jit.r = 0.10 * amp * Math.sin(s * 33.7 + 2.2) + lock.r * set;
        jit.t = 0.07 * amp * Math.cos(s * 38.2) + lock.t * set;
        // it recoils when the stare lands, then sinks — a petrified fighter is
        // heavier than a live one and the last thing it does is get heavy
        jit.y = kick * 0.1 - clamp01((s - 0.5) / 0.8) * 0.03;
      }
      // Past CREEP1 the numbers above stop being written, so the card holds
      // EXACTLY the pose it seized in for the rest of the span — including the
      // leftover tilt and twist. Squared up, the final frame was just a grey
      // card and looked no different from the engine's own fatigue state.
      //
      // The pose then comes out on the same `go` ramp as the crust. It used to
      // hold to the last frame and be squared by the done handler, and the
      // seam was plain in a shot at t+3400: a card lying visibly crooked with
      // no stone left on it to explain why, which then snapped straight.
      const gx = jit.x * go, gy = jit.y * go, gz = jit.z * go;
      const gt = jit.t * go, gr = jit.r * go;
      piece.group.position.set(home.x + gx, home.y + gy, home.z + gz);
      if (piece.tilt) { piece.tilt.rotation.x = gt; piece.tilt.rotation.z = gr; }
      if (piece.card3d) piece.card3d.rotation.y = yaw + gr * 0.8;
      crust.position.set(gx, gy, gz);
      crust.rotation.set(gt, gr * 0.8, gr);

      if (card) {
        // Drained, not dimmed. frontMat.color is a multiplier over the card's
        // own art, so it cannot desaturate — the crust above does that. What
        // this does is pull the exposed part down and COOL it, so the scrap of
        // picture still showing through the closing front is already half
        // dead and the two halves of the card agree with each other.
        const dead = clamp01(front / 1.0) * (1 - 0.35 * (1 - go));
        // The JOLT. Between the ring closing at 0.22 and the first stone being
        // legible at about 0.3 there was a tenth of a second of nothing at all
        // — the gaze landed on a card that just sat there, and the two halves
        // of the opening did not connect. Washing the card out for a sixth of
        // a second is the hit itself, and it is a drain rather than a flash:
        // what goes up is the whole colour at once, towards white, which is
        // where the grey is going anyway.
        const jolt = s < 0.18 ? Math.min(1, s / 0.035) * (1 - s / 0.18) ** 1.3 : 0;
        const v = Math.min(1.55, 1 - dead * 0.4 + jolt * 0.55);
        drain.setRGB(v * 0.94, v * 0.97, v);
        card.color.copy(drain);
      }
    }
  }, () => {
    if (!piece) return;
    if (card) card.color.setScalar(1);
    piece.group.position.copy(piece.restingPosition?.() || home);
    if (piece.tilt) piece.tilt.rotation.set(0, 0, 0);
    if (piece.card3d) piece.card3d.rotation.y = yaw;
    piece.animating = false;
  });
}
