// TRAPSPRING — a facedown card FLIPS FACE UP and the square snaps shut.
//
// Shared by 2 cards: R062 Blockade, R065 Concealed Post. Both are laid
// facedown and both go off by turning over, so the FLIP is the motif and
// everything else is the mechanism it trips.
//
// This is the one Shardsworn motif that is a MACHINE rather than magic. Shard
// Fire burns and Shatter Blast detonates; this thing is sprung. So:
//   - nothing here fades in. Every part is either seated in the stone or out
//     of it, and it gets from one to the other in a few frames.
//   - the accents are ON THE BEAT. The card lands face up, the jaw shuts and
//     the flash goes off within 20ms of each other, so the whole thing reads
//     as one CLACK rather than a sequence of pretty events.
//   - the loud part is 250ms and the quiet part is a second. What outlives the
//     snap is iron standing in the stone, cooling — the square is now closed.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&fxat=0.24" \
//             --eval tools/fxdemo/trapspring.js --out /tmp/ts.png --settle 400

import { THREE, easeOut, easeIn } from '../kit.js';
import { IRON } from '../iron-kit.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// The flagstone face. Anything under this is inside an opaque slab, which is
// how the mechanism hides: it does not fade out, it goes back into the stone.
const STONE = 0.080;
// The square's own glow plane sits at 0.085 and its rim at 0.09, so the seam
// has to clear both or it z-fights the tile it is cut into.
const SEAM_Y = 0.096;

// Shard Fire's palette, because the faction has one. Hot pink core, a lighter
// pink for light, a dark crimson for the crystal body — the green and blue
// channels are held down for the same reason they are over there: ACES pushes
// anything bright toward white and a blue-leaning pink turns sugary.
const HOT = 0xff2f68;
const LIT = 0xff5a92;
const DEEP = 0x8d1740;

// Phase boundaries in seconds, not durations.
const T = {
  LOAD: 0.090,   // the card presses down, the seam opens, the frame cracks up
  RISE: 0.110,   // teeth start coming out of the stone
  OPEN: 0.205,   // jaw fully open, leaning outward
  LAND: 0.230,   // the card is face up and back on the stone
  SHUT: 0.250,   // the jaw is closed over its edges — ONE beat with LAND
  CALM: 0.420,   // the ringing stops
  HOLD: 0.950,   // stood locked, cooling
  SINK: 1.340,   // drawn back into the stone
  TOTAL: 1.500,
};

/* ------------------------------------------------------------ textures */

// Cached for the life of the page: kit.hold() disposes materials and a
// material never disposes its map.
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
 * The seam the mechanism comes out of — a square groove cut round the card.
 *
 * Drawn as a MASK and used DARK, on NormalBlending. An additive pink outline
 * was the first cut and it read as a neon coaster under the card: contrast on
 * this board is bought by darkening first and putting the bright edge on top,
 * which is what the iron frame is for.
 */
const seamTex = () => tex('seam', (g, S) => {
  const inset = S * 0.085;
  g.strokeStyle = '#fff';
  g.lineJoin = 'miter';
  g.filter = `blur(${S * 0.011}px)`;
  g.lineWidth = S * 0.062;
  g.strokeRect(inset, inset, S - inset * 2, S - inset * 2);
  // Bitten out along its length, so it is a crack in stone rather than a
  // printed rectangle. A clean rule reads as UI.
  g.filter = 'none';
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    const e = (Math.random() * 4) | 0;
    const u = Math.random();
    const x = e === 0 || e === 2 ? inset + u * (S - inset * 2) : (e === 1 ? S - inset : inset);
    const y = e === 1 || e === 3 ? inset + u * (S - inset * 2) : (e === 0 ? inset : S - inset);
    g.beginPath();
    g.arc(x, y, S * (0.012 + Math.random() * 0.03), 0, Math.PI * 2);
    g.fill();
  }
});

/** A hard four-point glint, for the instant a tooth locks. */
const glintTex = () => tex('glint', (g, S) => {
  const c = S / 2;
  const core = g.createRadialGradient(c, c, 0, c, c, S * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
  g.filter = `blur(${S * 0.013}px)`;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(c, c, S * 0.46, S * 0.016, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(c, c, S * 0.016, S * 0.31, 0, 0, Math.PI * 2); g.fill();
}, 128);

/* --------------------------------------------------------------- shapes */

// A tooth is an octahedron squeezed long and flat: eight facets, so
// flatShading gives it a lit side and a dark side and it reads as crystal.
// Cones were tried and their smooth flank looked like pink bunting.
//
// TRANSLATED so its base is at the origin — a tooth grows out of the frame it
// is bolted to, and centring it meant every one of them was half buried in the
// rail and half the length it was built for.
function toothGeo() {
  const g = new THREE.OctahedronGeometry(0.5, 0);
  g.scale(0.44, 1, 0.30);
  g.translate(0, 0.5, 0);
  return g;
}

/* ---------------------------------------------------------------- motif */

export function trapspring(kit, at) {
  const piece = kit.piece(at);
  // The square, not the card: the card is about to leave the ground and come
  // back, and the mechanism is bolted to the stone.
  const p = piece?.restingPosition ? piece.restingPosition() : kit.at(at);
  if (!p) return;
  const cx = p.x;
  const cz = p.z;

  const group = new THREE.Group();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const vec = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();
  const tint = new THREE.Color();

  // The frame is a SQUARE, 2.30 across inside a 2.5 flagstone. A round rail
  // was tried first: from a fixed elevation it reads as a plate under the card
  // and says nothing about which square is closed. Four straight bars say
  // machined, and they line up with the card they are clamping.
  const HALF = 1.15;
  const BAR_Y = STONE + 0.022;    // the seated height of the rail's middle

  /* --- the seam. Dark, normal-blended, and the first thing that happens:
     it is what the bright parts are read against. */
  const seam = new THREE.Mesh(
    new THREE.PlaneGeometry(2.46, 2.46),
    new THREE.MeshBasicMaterial({
      map: seamTex(), color: 0x14090c, transparent: true, opacity: 0,
      depthWrite: false,
    }),
  );
  seam.rotation.x = -Math.PI / 2;
  seam.position.set(cx, SEAM_Y, cz);
  group.add(seam);

  /* --- the rail. Iron, not crystal: this is the part that was BUILT.
     metalness is high but the emissive is what actually makes it read — there
     is no environment map in this scene, so a physically metallic bar has
     nothing to reflect and comes out a black silhouette (the same trap
     iron-kit.js names). The cold emissive gives it a body; the pink one is
     driven by the snap. */
  //
  // DARKER than the chains' iron, and far less metallic. At IRON with
  // metalness 0.8 the four bars needed a strong emissive to be visible at
  // all, and a strong emissive on a light grey bar is a pale lilac frame
  // sitting round the card — a photo mount, not a mechanism. Dropping the
  // metalness lets the braziers actually light it, so the bar can be dark and
  // still read, and the emissive is then free to be what it should be: the
  // heat the snap puts into the iron, which arrives with the lock and goes
  // out over the second the trap stands there cooling.
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x5c534c, metalness: 0.3, roughness: 0.5,
    emissive: 0x5a1230, emissiveIntensity: 0.1,
  });
  const rail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), railMat, 4);
  rail.frustumCulled = false;
  rail.castShadow = true;
  group.add(rail);

  /* --- the teeth. Five a side, twenty in all, bolted along the rail. */
  const PER = 5;
  const N = PER * 4;
  const tg = toothGeo();
  const toothMat = new THREE.MeshStandardMaterial({
    color: DEEP, emissive: HOT, emissiveIntensity: 0.22,
    roughness: 0.28, metalness: 0.05, flatShading: true,
  });
  const teeth = new THREE.InstancedMesh(tg, toothMat, N);
  teeth.frustumCulled = false;
  teeth.castShadow = true;
  group.add(teeth);

  // A larger additive twin of every tooth. Lit crystal on a dark board reads
  // as flat pink card; the solid gives the facets, this gives the heat coming
  // off them. Kept at 0.3 — two overlapping additive halos sum past 1.0 and
  // the whole jaw goes white, which is the one thing it must not do.
  const haloMat = new THREE.MeshBasicMaterial({
    color: HOT, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.InstancedMesh(tg, haloMat, N);
  halo.frustumCulled = false;
  group.add(halo);

  // side 0..3: -z, +x, +z, -x. `nx/nz` points out of the square, `tx/tz` runs
  // along the bar, and the tooth leans about the bar.
  const SIDES = [
    { nx: 0, nz: -1, tx: 1, tz: 0 },
    { nx: 1, nz: 0, tx: 0, tz: 1 },
    { nx: 0, nz: 1, tx: -1, tz: 0 },
    { nx: -1, nz: 0, tx: 0, tz: -1 },
  ];
  const tooth = [];
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < PER; i++) {
      const u = (i - (PER - 1) / 2) * 0.475;
      tooth.push({
        s,
        x: cx + SIDES[s].nx * HALF + SIDES[s].tx * u,
        z: cz + SIDES[s].nz * HALF + SIDES[s].tz * u,
        // the middle teeth are the long ones, so a closed jaw has a profile
        len: (0.40 + 0.13 * Math.cos((u / 1.0) * 1.5)) * rnd(0.88, 1.12),
        lag: rnd(0, 0.022),           // no two come up on the same frame
        ring: rnd(0.85, 1.15),        // and no two ring down together
      });
    }
  }
  for (let i = 0; i < N; i++) {
    tint.setRGB(rnd(0.78, 1.25), rnd(0.6, 1.0), rnd(0.75, 1.1));
    teeth.setColorAt(i, tint);
  }
  teeth.instanceColor.needsUpdate = true;

  /* --- what the snap throws off. Small, few, and they land INSIDE the
     flagstone: Shard Fire's chips used to skate two squares away and half a
     second later the board was littered with pink diamonds. */
  const CHIPS = 12;
  const chipMat = new THREE.MeshStandardMaterial({
    color: DEEP, emissive: HOT, emissiveIntensity: 0.5,
    roughness: 0.3, metalness: 0.05, flatShading: true, transparent: true,
  });
  const chips = new THREE.InstancedMesh(tg, chipMat, CHIPS);
  chips.frustumCulled = false;
  group.add(chips);
  const chip = [];
  for (let i = 0; i < CHIPS; i++) {
    const t = tooth[(Math.random() * N) | 0];
    const a = Math.atan2(cz - t.z, cx - t.x) + rnd(-0.8, 0.8);
    chip.push({
      x: t.x, y: STONE + t.len * 0.7, z: t.z,
      vx: Math.cos(a) * rnd(0.5, 1.5), vz: Math.sin(a) * rnd(0.5, 1.5),
      vy: rnd(1.1, 2.4), len: rnd(0.07, 0.15),
      spin: rnd(-15, 15), life: rnd(0.28, 0.5),
    });
  }

  /* --- the glints. Three sprites on three tooth tips at the instant of the
     lock, 80ms each. This is the CLACK: a mechanism is read by its highlights
     catching, and without them the jaw just arrives. */
  const glints = [];
  for (let i = 0; i < 3; i++) {
    const t = tooth[((i * 7 + 2) * 3) % N];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glintTex(), color: LIT, transparent: true, opacity: 0,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    s.position.set(t.x, STONE + t.len * 0.8, t.z);
    s.scale.setScalar(0.66);
    s.renderOrder = 20;
    group.add(s);
    glints.push({ s, born: T.SHUT - 0.02 + i * 0.012 });
  }

  /* --- the shockline. One thin ring running out across the stone. Thin on
     purpose and it stays thin as it grows: kit.ring scales a fixed-width
     annulus, so asking it for this size parks a pink slab on the square. */
  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.955, 1, 48),
    new THREE.MeshBasicMaterial({
      color: LIT, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }),
  );
  shock.rotation.x = -Math.PI / 2;
  shock.position.set(cx, STONE + 0.03, cz);
  shock.scale.setScalar(0.4);
  group.add(shock);

  /* --- light. Reach 4.2 against squares 2.9 apart, so the neighbours catch an
     edge of the snap and the far side of the board catches nothing. Held OFF
     CENTRE and high, so the teeth get a lit face and a dark one — lit from
     inside they all come out the same shade and read as cut paper. */
  const clack = new THREE.PointLight(LIT, 0, 4.2, 2);
  clack.position.set(cx + 0.7, STONE + 1.05, cz - 0.55);
  group.add(clack);
  const ember = new THREE.PointLight(HOT, 0, 3.0, 2);
  ember.position.set(cx, STONE + 0.3, cz);
  group.add(ember);

  /* --------------------------------------------------------- the card */

  // The FLIP is the motif, and the card is the only thing that can do it.
  // Concealed Post takes its own Construct off the board as it fires, so by
  // the time this plays the piece can already be gone; the mechanism then runs
  // on its own rather than the whole effect vanishing.
  if (piece) flip(kit, piece, p);

  /* --------------------------------------------------------- the tween */

  // ONE tween for the whole mechanism. A tween added from inside another
  // tween's callback is dropped by the animator's filter pass, so every beat
  // below carries its own delay instead of being booked later.
  kit.hold(group, T.TOTAL, (k) => {
    const s = k * T.TOTAL;

    // How far the mechanism is out of the stone: cracked up during the load,
    // seated by the time the jaw opens, drawn back in at the end.
    const up = s < T.LOAD ? easeOut(s / T.LOAD) * 0.55
      : s < T.OPEN ? 0.55 + 0.45 * easeOut((s - T.LOAD) / (T.OPEN - T.LOAD))
        : s < T.SINK ? 1
          : Math.max(0, 1 - easeIn((s - T.SINK) / (T.TOTAL - T.SINK)));

    // the rail is driven a hair further down by the slam, then rings
    const kick = s > T.SHUT && s < T.CALM
      ? Math.sin((s - T.SHUT) * 70) * 0.012 * Math.exp(-(s - T.SHUT) * 15) : 0;
    const railY = STONE - 0.075 + (BAR_Y - STONE + 0.075) * up + kick;
    for (let i = 0; i < 4; i++) {
      const S = SIDES[i];
      vec.set(cx + S.nx * HALF, railY, cz + S.nz * HALF);
      q.setFromAxisAngle(axis.set(0, 1, 0), i * Math.PI / 2);
      mat4.compose(vec, q, scl.set(2.36, 0.075, 0.115));
      rail.setMatrixAt(i, mat4);
    }
    rail.instanceMatrix.needsUpdate = true;

    // the rail takes the heat of the snap and lets it go over a second
    const heat = s < T.SHUT ? Math.max(0, (s - T.LOAD) / (T.SHUT - T.LOAD)) * 0.35
      : Math.max(0, 1 - (s - T.SHUT) / 0.85) ** 1.6;
    railMat.emissiveIntensity = 0.1 + 0.85 * heat;

    /* the jaw. Out of the stone leaning AWAY, then shut in 45ms. The lean is
       what carries the snap — a jaw that only rises reads as a fence going up,
       and the first cut of this did exactly that. */
    for (let i = 0; i < N; i++) {
      const t = tooth[i];
      const S = SIDES[t.s];
      const r = Math.max(0, Math.min(1, (s - T.RISE - t.lag) / (T.OPEN - T.RISE)));
      let lean;
      if (s < T.OPEN) lean = -0.62 * easeOut(r);
      else if (s < T.SHUT) {
        // no easing on the way shut: a mechanism does not decelerate
        lean = -0.62 + 1.40 * ((s - T.OPEN) / (T.SHUT - T.OPEN));
      } else {
        const e = s - T.SHUT;
        lean = 0.78 + Math.sin(e * 58 * t.ring) * 0.085 * Math.exp(-e * 13);
      }
      // grown out of the stone; the rail carries it back down at the end
      const len = t.len * (s < T.OPEN ? r : 1) * (s > T.SINK
        ? Math.max(0, 1 - easeIn((s - T.SINK) / (T.TOTAL - T.SINK))) : 1);
      // The sign, and it was BACKWARDS. Rotating +y about the bar's own
      // tangent by -lean tips the tooth toward the square when lean is
      // negative — so the jaw came out of the stone leaning IN over the card
      // and then snapped OUT, which is a flower opening, not a trap shutting.
      // Photographed at 200ms and 260ms the two frames told the story the
      // wrong way round. With +lean the open jaw splays away from the square
      // and the shut one closes over the card's edges, which is the whole
      // gesture.
      axis.set(S.tx, 0, S.tz);
      q.setFromAxisAngle(axis, lean);
      vec.set(t.x, railY + 0.03, t.z);
      mat4.compose(vec, q, scl.setScalar(len));
      teeth.setMatrixAt(i, mat4);
      mat4.compose(vec, q, scl.set(len * 1.5, len * 1.12, len * 1.5));
      halo.setMatrixAt(i, mat4);
    }
    teeth.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    // Emissive KEPT DOWN, the same number ./shardfire.js settled on. At the
    // 0.92 this peaked at, every tooth was one flat saturated pink lozenge
    // whatever the light did — twenty pieces of cut paper standing round the
    // card, the exact "pink bunting" the tooth geometry was chosen to avoid.
    // The facets need the clack light to fall across them, not to be washed
    // out by their own glow, so the snap flares to half that and no further.
    toothMat.emissiveIntensity = 0.16 + 0.34 * heat;
    haloMat.opacity = 0.22 * Math.max(0, heat) + (s < T.SHUT ? 0.05 : 0);

    // the chips, thrown on the lock
    for (let i = 0; i < CHIPS; i++) {
      const c = chip[i];
      const e = s - T.SHUT;
      const u = e / c.life;
      if (u <= 0 || u >= 1) {
        mat4.compose(vec.set(0, -99, 0), q.identity(), scl.setScalar(0));
        chips.setMatrixAt(i, mat4);
        continue;
      }
      vec.set(c.x + c.vx * e,
        Math.max(STONE + 0.03, c.y + c.vy * e - 5.6 * e * e),
        c.z + c.vz * e);
      q.setFromAxisAngle(axis.set(0.4, 0.7, 0.3).normalize(), c.spin * e + i);
      mat4.compose(vec, q, scl.setScalar(c.len * Math.min(1, (1 - u) * 3)));
      chips.setMatrixAt(i, mat4);
    }
    chips.instanceMatrix.needsUpdate = true;
    chipMat.opacity = 1;

    for (const g of glints) {
      const u = (s - g.born) / 0.085;
      g.s.material.opacity = u <= 0 || u >= 1 ? 0 : 0.9 * (1 - u) ** 0.8;
      g.s.scale.setScalar(0.4 + 0.5 * Math.min(1, u * 4));
    }

    const sk = (s - T.SHUT) / 0.24;
    if (sk > 0 && sk < 1) {
      shock.scale.setScalar(0.42 + 1.15 * easeOut(sk));
      shock.material.opacity = 0.8 * (1 - sk) ** 1.4;
    } else shock.material.opacity = 0;

    // The seam arrives with the load and is the last thing to go, because it
    // is the mark left in the stone and the mark should outlive the machine.
    seam.material.opacity = 0.75 * Math.min(1, s / T.LOAD)
      * (s > T.SINK ? Math.max(0, 1 - (s - T.SINK) / (T.TOTAL - T.SINK)) : 1);

    const cu = (s - T.SHUT + 0.012) / 0.2;
    clack.intensity = cu > 0 && cu < 1 ? 11 * (1 - cu) ** 1.6 * Math.min(1, cu * 9) : 0;
    ember.intensity = 2.6 * heat * (0.84 + 0.16 * Math.sin(s * 37));
  });
}

// What the flip borrowed, and who is driving the card.
//
// Both matter because the two tweens OVERLAP: the mechanism runs for a second
// and a half, and a spent trap is handed to exit.destroy below a fifth of a
// second in. Left alone, the flip went on writing the card's transform every
// frame underneath the throw — the card jittered on the square instead of
// leaving it — and then put it back on the square a second time when its own
// tween ended. The exit claims the piece and the flip stands down; only the
// flip knows which side was up before any of this started, so it leaves that
// here for the exit to hand back.
const BORROWED = new WeakMap();
const CLAIMED = new WeakSet();

/**
 * THE FLIP.
 *
 * A card turned by rotating its own group 180 degrees ends up with its back
 * texture on top and the printing upside down — BoxGeometry's -Y face has its
 * own orientation and it is not the mirror of +Y. So the turn is done in two
 * halves and the MATERIALS are swapped at the instant the card is edge-on and
 * nothing of either face is visible: 0 to -90 degrees showing the back, then
 * +90 back to 0 showing the front. The silhouette is identical across the
 * swap, the direction of travel continues, and the card lands in exactly the
 * pose the board expects.
 *
 * It also has to LIFT, and by a measured amount rather than a guessed one: the
 * card is 1.76 deep, so edge-on its lower half reaches 0.88 below its middle,
 * and the flagstone is an opaque plane at 0.080. Flipped flat on the stone the
 * bottom half of the card was simply eaten for the middle third of the turn.
 * The lift here tracks |sin| of the actual angle, so the low edge kisses the
 * stone the whole way round and the settle at the end rocks on that edge
 * instead of floating.
 */
function flip(kit, piece, rest) {
  // The game owns the card's real transform; this borrows it and must hand
  // back exactly what it took. `faceDown` included — today the engine fires
  // this motif when the Trap is PLAYED, when the card is still a secret, and a
  // motif that left it face up would be showing the opponent the trap.
  const wasDown = piece.faceDown;
  const baseTilt = piece.tilt.rotation.x;
  piece.animating = true;
  BORROWED.set(piece, { wasDown, baseTilt });

  const apply = (ang, hop) => {
    // Re-asserted every frame, not set once: a resync can land mid-flip and
    // put the real face back on top while the card is still showing its back.
    if (ang > -Math.PI / 2) {
      piece.setFaceDown(true);
      piece.tilt.rotation.x = baseTilt + ang;
    } else {
      piece.setFaceDown(false);
      piece.tilt.rotation.x = baseTilt + ang + Math.PI;
    }
    const edge = Math.abs(Math.sin(ang));
    // squashed as it turns — a snapped card is not a rigid plate, and the
    // squash is also what buys back a third of the lift it would need
    const sc = 1 - 0.16 * edge;
    piece.group.scale.setScalar(sc);
    piece.group.position.set(rest.x, rest.y + 0.92 * edge * sc + hop, rest.z);
  };

  kit.anim.add(T.TOTAL, (k) => {
    if (CLAIMED.has(piece)) return;      // the exit has the card now
    const s = k * T.TOTAL;
    if (s < T.LOAD) {
      // the load: pressed down into the stone and cocked, like a plate being
      // trodden on. Without it the card simply leaves, and the snap has no
      // wind-up to snap out of.
      const e = easeIn(s / T.LOAD);
      piece.setFaceDown(true);
      piece.tilt.rotation.x = baseTilt - 0.05 * e;
      piece.group.scale.setScalar(1 - 0.035 * e);
      piece.group.position.set(rest.x, rest.y - 0.014 * e, rest.z);
      return;
    }
    if (s < T.LAND) {
      const u = (s - T.LOAD) / (T.LAND - T.LOAD);
      // flung, not swung: fast off the mark and decelerating into the stop,
      // which is what a spring does to a card
      apply(-Math.PI * (1 - (1 - u) ** 2.2), 0.17 * Math.sin(Math.PI * u));
      return;
    }
    // it does not stop dead on 180 — it goes past and rocks back, twice
    const e = s - T.LAND;
    apply(-Math.PI - 0.20 * Math.sin(e * 44) * Math.exp(-e * 13), 0);
  }, () => {
    if (CLAIMED.has(piece)) return;      // the exit hands it back instead
    piece.tilt.rotation.x = baseTilt;
    piece.group.scale.setScalar(1);
    piece.group.position.copy(rest);
    piece.setFaceDown(wasDown);
    piece.animating = false;
    BORROWED.delete(piece);
  });
}

/**
 * How long a card that this action moved must stay where it is.
 *
 * A Trap fires when an enemy DECLARES the move, before it lands — so the
 * intruder has to still be standing on its old square while the jaw shuts, or
 * the whole point of the timing is lost.
 *
 * Measured to the RINGING, not to the lock. At the 0.30 this started on, a
 * Concealed Post threw its own spent card off the square fifty milliseconds
 * after the jaw closed on it, and the shut and the throw arrived as one
 * muddled event; the eye never got to see the trap closed. T.CALM is the
 * frame the mechanism stops moving, which is the earliest the square can
 * afford to lose anything.
 */
export const timing = { kill: T.CALM };

/* -------------------------------------------- what becomes of a spent trap */

export const exit = {
  /**
   * Concealed Post takes its OWN card off the board as it fires: it puts a
   * fighter from your hand into the square and destroys itself. So the card
   * this motif just turned face up has to leave, and the generic death — a
   * red burst, a red ring, a slide onto the pile — knows nothing about the
   * machine standing round it and reads as a second unrelated thing happening
   * to the same square.
   *
   * What happens instead is the only thing consistent with the rest of this
   * file: the mechanism EJECTS it. The jaw is shut and the bars have taken
   * the shock, and the spent card is flicked out of the frame like a case out
   * of a breech — low, fast, flat, tumbling end over end, and down on the
   * pile. Deliberately the opposite shape to ./depthcharge.js's throw, which
   * lofts its victim two units into the air: that one is water taking a card
   * with it, this one is sprung steel getting rid of one.
   *
   * The iron stays. It sinks back into the stone on its own clock, which is
   * the picture the card leaves behind — the square is now closed.
   */
  destroy(kit, piece, square, ev, done) {
    const held = BORROWED.get(piece)
      || { wasDown: piece.faceDown, baseTilt: piece.tilt.rotation.x };
    CLAIMED.add(piece);
    piece.animating = true;

    // From where the card LIES, not from where the flip has it this frame:
    // the flip's rock is still running when this takes over, and launching
    // off a frame of that put a different tilt and height into the throw
    // every time it was played.
    const from = piece.restingPosition ? piece.restingPosition() : piece.group.position.clone();
    const pile = kit.grave(piece.owner);

    const SPAN = 1.05;
    const FLY = 0.62;             // ejected fast; the rest is settling on the pile
    // Low and hard. A high arc is a thing thrown by an explosion; a spent
    // case clears the mechanism by about a card's width and no more, and the
    // flatness is most of what makes it read as mechanical.
    const V0 = 2.3, G = (2 * V0) / FLY;

    const mats = [piece.frontMat, piece.backMat, piece.card3d.material[0]];
    const base = mats.map((m) => m.color.clone());
    for (const m of mats) m.transparent = true;

    kit.anim.add(SPAN, (k) => {
      const s = k * SPAN;
      const fly = Math.min(s, FLY);
      const u = fly / FLY;
      // The kick is sideways FIRST — it is pushed out of the jaw before it is
      // thrown anywhere. Starting both together looked like the card had
      // simply been picked up and moved.
      const h = easeOut(Math.max(0, (fly - 0.05) / (FLY - 0.05)));
      piece.group.position.set(
        from.x + (pile.x - from.x) * h,
        from.y + V0 * fly - 0.5 * G * fly * fly,
        from.z + (pile.z - from.z) * h,
      );
      // Two turns, ending flat. On tilt and not on the card mesh: the yaw
      // lives under the tilt, and a card spun there turns face-on to the
      // other player halfway across the table.
      piece.tilt.rotation.x = held.baseTilt - Math.PI * 4 * easeOut(u);
      piece.tilt.rotation.z = Math.sin(u * 9) * 0.3 * (1 - u);
      // Spent: the crystal in it is out, so it goes over dark on the way and
      // lands a dull thing on the pile.
      const dark = 1 - 0.45 * Math.min(1, fly / 0.3);
      for (let i = 0; i < mats.length; i++) mats[i].color.copy(base[i]).multiplyScalar(dark);
      // It only fades once it is DOWN, and only part of the way: the last
      // card onto a pile of cards, not a card evaporating in mid-air.
      const settle = Math.max(0, (s - FLY) / (SPAN - FLY));
      for (const m of mats) m.opacity = 1 - 0.7 * settle;
    }, () => {
      // Pieces are POOLED. Everything borrowed goes back — colour, opacity,
      // tilt, scale and which face was up — or the next card out of the pool
      // is this one's ghost.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i]);
        mats[i].opacity = 1;
      }
      piece.tilt.rotation.set(0, 0, 0);
      piece.group.scale.setScalar(1);
      piece.setFaceDown(held.wasDown);
      piece.animating = false;
      CLAIMED.delete(piece);
      BORROWED.delete(piece);
      done?.();
    });
  },
};
