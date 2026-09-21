// PHYLACTERY — a soul breaks for the graveyard and something waiting on the
// stone takes it instead.
//
// Shared by 1 card: R073. "When a Hero you control is destroyed, put it into
// this square instead of into your Graveyard and destroy this Construct."
//
// So the motif has a SHAPE, and the shape is a departure that is caught. The
// light goes out of the card, a pale soul tears free and runs for the discard
// pile — the place every dead card on this table goes — and one square out it
// flies over a squat black urn that has been standing there, unlit, since the
// first frame. The urn's lid tips. The flight stops dead in the air, is hauled
// BACK and DOWN into the mouth, the lid slams, and the glyphs cut into the urn
// come alight from the inside. Then the urn carries its prize home and sets
// down on the square.
//
// The catch is the whole point, so it is built to survive a frozen frame: the
// soul's wake is laid along the path it actually flew, which means the moment
// it is taken leaves a hard ELBOW hanging in the air — a bright line running
// away from the card and then bent right back into a black jar. In motion it
// is the arrest that reads; in a still it is the elbow.
//
// What it must not be — the Gloaming already owns three of these:
//   - harvest.js runs a ribbon off the board to the discard pile and reels a
//     card-shaped prize back. This one goes the OTHER way and never arrives:
//     nothing here is a tether, the wake is a comet's and is attached to
//     nothing, and the pile is the destination that is DENIED.
//   - raise.js opens a ragged grave-mouth with a lit lip. There is no hole in
//     the ground here at all, and the one solid object is above the stone
//     rather than coming up through it.
//   - cast-gloaming.js is dust SINKING into a card in a soft dark pool. The
//     only thing here that sinks is the seal, at the very end.
//
// It is death-adjacent and it is NOT a death: the soul is preserved. So the
// soul is the one BONE-PALE thing in a violet motif — it stays whole, whole
// the entire way in, and nothing about it is ever destroyed. What is left
// behind is the empty body, which `exit.destroy` at the bottom carries off.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=760&fov=16" \
//             --eval tools/fxdemo/phylactery.js --out /tmp/ph-760.png \
//             --wait 10000 --settle 700
// `t` is the moment in the MOTIF to freeze at, in milliseconds. The harness
// takes the animator off the frame clock and steps it by hand; see it for why
// wall-clock --settle cannot be trusted to land on a beat. 760 is the haul
// back, which is the frame the motif is judged on; &exit=1 also runs the
// exit below, on the same hand-stepped clock, which is the only way to see
// the handover of the card's colour between the two.

import { THREE, CARD_W, easeOut, easeIn, easeInOut } from '../kit.js';
import { blobTexture } from '../../textures.js';

/* ------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold() disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, make) {
  let t = TEXES.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(make());
    t.colorSpace = THREE.SRGBColorSpace;
    TEXES.set(key, t);
  }
  return t;
}

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

/**
 * The glyphs cut into the urn, laid out once and drawn into BOTH of its maps.
 *
 * `v` runs up the lathe and `u` around it, so this is the jar unrolled: x is
 * the circumference, y is the height with the lip at the top.
 */
function glyphs(g, W, H, paint) {
  // three bands — foot, belly, lip — because an urn that is scratched evenly
  // all over reads as noise at thirty pixels, and three horizontal rules read
  // as a made object
  for (const [y, h] of [[0.09, 0.022], [0.44, 0.030], [0.86, 0.026]]) {
    paint.band(g, 0, y * H, W, h * H);
  }
  // and short vertical ticks hung off the belly band, evenly around, so
  // whichever way the table is turned the same number of them face you
  for (let i = 0; i < 14; i++) {
    const x = (i + 0.5) / 14 * W;
    const long = i % 3 === 0;
    paint.tick(g, x, 0.47 * H, long ? 0.20 * H : 0.11 * H);
  }
  // one seam running the whole way up: it is what splits when the lid slams
  paint.tick(g, W * 0.5, 0.10 * H, 0.76 * H);
}

/**
 * The urn's colour map: NEAR-BLACK, and it has to stay near-black.
 *
 * A dark object on a dark board is invisible and the answer is never a
 * brighter purple — it is to let the braziers find the shoulder of the jar and
 * to put every lit pixel in the emissive map instead, where it can be turned
 * up and down. Painted bright here, the urn was a violet blob at the moment it
 * most needed to be a silhouette with a hole in the top.
 */
const urnMap = () => tex('urn', () => {
  const W = 256, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // the body, darkest at the foot where no light reaches
  const up = g.createLinearGradient(0, H, 0, 0);
  up.addColorStop(0.00, '#07030f');
  up.addColorStop(0.45, '#120a22');
  up.addColorStop(1.00, '#1b1030');
  g.fillStyle = up;
  g.fillRect(0, 0, W, H);
  // grave-dust caught in the turning marks: horizontal streaks, very low
  // contrast, so the jar has a surface rather than being a flat fill
  g.globalAlpha = 0.16;
  for (let i = 0; i < 60; i++) {
    g.fillStyle = i % 2 ? '#2a2033' : '#050209';
    g.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2);
  }
  g.globalAlpha = 1;
  glyphs(g, W, H, {
    band(gg, x, y, w, h) { gg.fillStyle = '#6a6355'; gg.fillRect(x, y, w, h); },
    tick(gg, x, y, len) { gg.fillStyle = '#2a1348'; gg.fillRect(x - 1.5, y, 3, len); },
  });
  return c;
});

/**
 * And the SAME glyphs as an emissive map: black everywhere else, so three.js
 * lights only the cuts. Painting the gradient on `map` alone and leaving
 * emissive constant drowned the whole jar in one flat glow — emissive is
 * modulated by emissiveMap and by nothing else — and the moment the soul went
 * in could not be told apart from the moment before it.
 */
const urnGlow = () => tex('urnGlow', () => {
  const W = 256, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  glyphs(g, W, H, {
    band(gg, x, y, w, h) {
      gg.fillStyle = '#4a2aa8';
      gg.fillRect(x, y - 1, w, h + 2);
    },
    tick(gg, x, y, len) {
      gg.shadowColor = '#7a44e8'; gg.shadowBlur = 7;
      gg.fillStyle = '#b489ff';
      gg.fillRect(x - 1.5, y, 3, len);
      gg.shadowBlur = 0;
    },
  });
  // the lip, brightest of all — it is the rim of the hole the soul goes down
  const lip = g.createLinearGradient(0, 0, 0, 0.13 * H);
  lip.addColorStop(0.00, '#c9a6ff');
  lip.addColorStop(1.00, '#000');
  g.fillStyle = lip;
  g.fillRect(0, 0, W, 0.13 * H);
  return c;
});

/**
 * The binding circle on the flagstone: a ragged violet ring with ticks, flat.
 *
 * Flat is deliberate. The camera's elevation never changes, so anything
 * standing up is foreshortened to about two thirds — but the ground plane is
 * seen almost square on, and a mark drawn ON the stone is the one thing in
 * this motif that is never compressed. It is where the eye is told to look
 * before the soul gets there.
 */
const sigilMap = () => tex('sigil', () => {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.translate(128, 128);
  const rag = (r, wob) => {
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const d = r * (1 + wob * Math.sin(a * 5.3 + 1.1) + wob * 0.6 * Math.sin(a * 9.7));
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d);
    }
    g.closePath();
  };
  g.lineJoin = 'round';
  // a wide soft one under a narrow bright one: a heavy glowing annulus at this
  // size fills in and becomes a disc, and a disc is a pool, which belongs to
  // the faction's flourish and not here
  g.shadowColor = 'rgba(122,72,232,0.85)'; g.shadowBlur = 16;
  g.strokeStyle = 'rgba(96,52,196,0.42)'; g.lineWidth = 12;
  rag(96, 0.035); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(186,148,255,0.92)'; g.lineWidth = 3;
  rag(96, 0.035); g.stroke();
  g.strokeStyle = 'rgba(150,104,246,0.6)'; g.lineWidth = 2;
  rag(72, 0.05); g.stroke();
  // ticks pointing IN, so the circle is a thing that holds rather than a halo
  g.strokeStyle = 'rgba(176,136,255,0.8)'; g.lineWidth = 3.4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    g.beginPath();
    g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92);
    g.lineTo(Math.cos(a) * 64, Math.sin(a) * 64);
    g.stroke();
  }
  return c;
});

/**
 * The soul's wake, head at u=0.
 *
 * Bone-pale where the soul is and grave-violet where it has been — the soul
 * itself is the only warm thing in the motif, because it is the thing being
 * SAVED and everything taking it is cold. It is on `map` and `emissiveMap`
 * both, or the painted run of it is drowned by a constant glow.
 */
const wakeMap = () => tex('wake', () => {
  const c = canvas(256, 64);
  const g = c.getContext('2d');
  const run = g.createLinearGradient(0, 0, 256, 0);
  run.addColorStop(0.00, 'rgba(255,248,226,1)');
  run.addColorStop(0.09, 'rgba(228,206,255,1)');
  run.addColorStop(0.34, 'rgba(150,104,246,0.72)');
  run.addColorStop(0.70, 'rgba(86,42,186,0.28)');
  run.addColorStop(1.00, 'rgba(50,20,120,0)');
  g.fillStyle = run;
  g.fillRect(0, 0, 256, 64);
  const across = g.createLinearGradient(0, 0, 0, 64);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.42, 'rgba(0,0,0,1)');
  across.addColorStop(0.58, 'rgba(0,0,0,1)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, 256, 64);
  return c;
});

/** The pale ring the body makes when it lets go. */
const letgoMap = () => tex('letgo', () => {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0.00, 'rgba(255,246,222,0)');
  grd.addColorStop(0.62, 'rgba(228,206,255,0.10)');
  grd.addColorStop(0.80, 'rgba(244,232,255,0.85)');
  grd.addColorStop(0.92, 'rgba(146,98,244,0.30)');
  grd.addColorStop(1.00, 'rgba(120,70,220,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
});

/* -------------------------------------------------------------- geometry */

/**
 * The urn, as real geometry rather than a billboard.
 *
 * A sprite was the first try, for the usual reason — a sprite always faces the
 * camera, so an urn painted on one is an urn from every azimuth. But this
 * camera looks down at about forty-five degrees and a billboard standing on
 * the ground under it reads as a cutout LYING BACK on the stone, which is
 * exactly what a vessel must not look like. A lathe costs nothing here and
 * stands up.
 */
function urnMesh() {
  const pts = [
    [0.001, 0.00], [0.30, 0.00], [0.33, 0.05], [0.44, 0.24], [0.50, 0.46],
    [0.47, 0.66], [0.34, 0.84], [0.26, 0.95], [0.30, 1.04], [0.33, 1.10],
    [0.27, 1.12],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 26);
  const mat = new THREE.MeshStandardMaterial({
    map: urnMap(),
    emissive: 0xffffff, emissiveMap: urnGlow(), emissiveIntensity: 0,
    roughness: 0.46, metalness: 0.42,
    // the inside of the neck has to show, or the mouth is a flat black disc
    // and the light that wells up it has nothing to land on
    side: THREE.DoubleSide, transparent: true,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** The lid: a shallow cap, the same stone as the jar. */
function lidMesh(mat) {
  const pts = [
    [0.001, 0.15], [0.11, 0.142], [0.21, 0.115], [0.29, 0.065],
    [0.345, 0.015], [0.35, -0.01], [0.28, -0.05], [0.001, -0.05],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), mat);
  m.castShadow = true;
  return m;
}

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment here is a
// fraction and SPAN is the only number in seconds. One card uses this, so it
// can afford to be a sentence — but the UI is held while it runs.
const SPAN = 1.5;
const DRAIN = 0.05;    // the light starts going out of the card
const LOOSE = 0.21;    // the soul tears free and runs
const OPEN = 0.31;     // the lid tips; cold light wells up the neck
const CATCH = 0.44;    // it is stopped in the air — THE MOMENT
const IN = 0.555;      // drawn down the neck
const SLAM = 0.578;    // the lid
const CARRY = 0.70;    // the urn lifts and starts home
const SET = 0.90;      // it sets down on the square
const SEG = 34;        // wake segments
const TAIL = 0.15;     // how far back in time the wake reaches

// Where a flat thing has to sit to be drawn ON a card rather than only on the
// stone around it: kit.at answers about 0.2 for a card whose face is at 0.21,
// and under about +0.05 the depth test fails on equal and the card itself is
// the one place nothing appears.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;
const STONE = 0.082;   // the flagstone face, which the urn stands on

// How big the jar is, against the lathe below. At 1 it stood 1.12 world units
// tall, and height on this camera costs about 26 pixels a unit — so at the
// board's own scale, where a card is sixty pixels across, the one solid object
// in the motif was a thirty-pixel smudge and the catch read as a violet glow
// happening somewhere. 1.32 puts it at about three quarters of a card wide,
// which is the size of a thing you could put a person in.
const URN = 1.32;
const MOUTH = 1.06 * URN;   // where the soul goes in, in world units above J

export function phylactery(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  const piece = kit.piece(at);
  const owner = piece?.owner ?? 0;

  /* ---- the line the soul is trying to fly, and where it gets no further */

  // Toward the discard pile, because that is where a destroyed card goes and
  // the whole motif is about not arriving. Flattened: the pile's own height
  // varies with how full it is and the soul never gets near it anyway.
  const gp = kit.grave(owner);
  const dir = new THREE.Vector3(gp.x - p.x, 0, gp.z - p.z);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  const reach = dir.length();
  dir.normalize();

  // The urn stands about one square out. Fixed at 2.3 it sat on the grass
  // beyond the board when the card was already in the back row, so it is
  // capped by how far there is to go — it must always be short of the pile,
  // since being short of the pile is the point.
  const stand = Math.max(1.55, Math.min(2.3, reach * 0.42));
  const J = new THREE.Vector3(p.x + dir.x * stand, STONE, p.z + dir.z * stand);

  const S = new THREE.Vector3(p.x, flatY(p) + 0.07, p.z);   // where it leaves
  const M = new THREE.Vector3(J.x, J.y + MOUTH, J.z);       // the mouth
  const PEAK = 1.82;
  // PAST the urn, and above it. Being caught level with the jar is a landing;
  // being caught beyond it and hauled BACK is an interception, and the
  // difference is the whole card.
  const P = new THREE.Vector3(J.x + dir.x * 0.62, PEAK, J.z + dir.z * 0.62);

  const g = new THREE.Group();

  /* ---- the urn, standing there from the first frame, unlit */

  const urnG = new THREE.Group();
  urnG.position.copy(J);
  urnG.scale.setScalar(URN);
  const urn = urnMesh();
  urnG.add(urn);
  const lidPivot = new THREE.Group();
  lidPivot.position.y = 1.12;
  const lid = lidMesh(urn.material);
  lidPivot.add(lid);
  urnG.add(lidPivot);

  // The light that wells up the neck lives INSIDE the jar, so the inner wall
  // is what glows and the mouth reads as a hole with something down it. A flat
  // additive disc over the lip was the first try and it was a violet coin
  // sitting on top of the urn — the one thing it did not look like was depth.
  const inner = new THREE.PointLight(0x8a4ff0, 0, 3.4, 2);
  inner.position.y = 0.72;
  urnG.add(inner);
  g.add(urnG);

  const sigil = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9 * URN, 1.9 * URN),
    new THREE.MeshBasicMaterial({
      map: sigilMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.set(J.x, STONE + 0.012, J.z);
  g.add(sigil);

  /* ---- the soul: a wake with a pale head on it */

  // The wake is laid along the path the soul ACTUALLY FLEW — sampled from the
  // same curve at earlier times — so the turn is real geometry and survives a
  // frozen frame. Remembered frame by frame instead, it was at the mercy of
  // the frame rate: at thirty it was a chain of dots and headless it was two
  // points and a straight line through the corner the motif exists for.
  const wake = kit.strip({ segments: SEG, width: 0.30, colour: 0xffffff, emissive: 1.25 });
  wake.mat.map = wakeMap();
  wake.mat.emissiveMap = wakeMap();
  wake.mat.emissive.setHex(0xffffff);
  wake.mat.color.setHex(0xb9a6e8);
  wake.mat.opacity = 0;
  // kit.strip casts shadows, for cloth. A lit wake dropping a hard black
  // shadow across the board read as a strap of tar thrown over the squares.
  wake.mesh.castShadow = false;
  wake.mesh.renderOrder = 2;
  g.add(wake.mesh);
  const pts = Array.from({ length: SEG }, () => new THREE.Vector3());

  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobTexture('rgba(255,250,232,1)', 'rgba(255,250,232,0)'),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  core.renderOrder = 4;
  g.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: blobTexture('rgba(168,118,255,0.85)', 'rgba(120,60,220,0)'),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.renderOrder = 3;
  g.add(halo);

  /* ---- the body letting go */

  const letgo = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.15, CARD_W * 1.15),
    new THREE.MeshBasicMaterial({
      map: letgoMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  letgo.rotation.x = -Math.PI / 2;
  letgo.position.set(p.x, flatY(p), p.z);
  letgo.renderOrder = 2;
  g.add(letgo);

  /* ---- the splash: what is knocked off it when it hits */

  // Not a burst. These are thrown out for a twelfth of a second and then every
  // one of them turns round and goes down the neck, because nothing of the
  // soul is allowed to be lost — that is the difference between this card and
  // every other death on the table.
  const motes = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture('rgba(255,246,222,0.95)', 'rgba(190,150,255,0)'),
      transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const a = i * 2.39996;
    const r = 0.34 + ((i * 5) % 7) / 7 * 0.40;
    s.userData = {
      // splayed mostly ACROSS the flight, because a splash that goes straight
      // on looks like the soul coming apart rather than hitting something
      v: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.75 + 0.16, Math.sin(a * 1.7) * r)
        .addScaledVector(dir, 0.22),
      lag: ((i * 3) % 5) / 5 * 0.035,
      size: 0.15 + (i % 4) * 0.045,
    };
    s.renderOrder = 3;
    motes.push(s);
    g.add(s);
  }

  /* ---- the card's own light going out */

  // pieces.js recomputes frontMat.color from scratch every frame unless the
  // piece is marked as animated, so the dim has to own the card while it runs
  // and hand it back afterwards. The FRONT base is white, not whatever it
  // happens to be holding: captured mid-grey (a fatigued fighter) it would be
  // squared on the way down and restored wrong.
  const mats = [];
  const base = [];
  const wasClear = [];
  let mark = null;
  if (piece) {
    const edge = piece.card3d.material[0];
    mats.push(piece.frontMat, piece.backMat, edge);
    for (let i = 0; i < mats.length; i++) {
      base.push(i === 0 ? new THREE.Color(1, 1, 1) : mats[i].color.clone());
      wasClear.push(mats[i].transparent);
    }
    // so exit.destroy below can tell this card is already hollow and take the
    // colour over instead of starting a second drain on top of this one
    mark = { yield: false };
    piece.phylMark = mark;
    piece.animating = true;
  }
  const tint = new THREE.Color();

  /* ------------------------------------------------------------- the run */

  const tmp = new THREE.Vector3();
  /**
   * Where the soul is at a given moment of the motif.
   *
   * Analytic rather than integrated, so the wake can ask where it WAS. The run
   * accelerates — it is fleeing — and the hook does the opposite: a stall of a
   * few frames where it drifts the last of its momentum and stops, and then it
   * is taken, slowly at first and then all at once.
   */
  const soulAt = (tau, out) => {
    if (tau <= LOOSE) return out.copy(S);
    if (tau < CATCH) {
      const u = (tau - LOOSE) / (CATCH - LOOSE);
      const s = u * u * 0.74 + u * 0.26;
      out.copy(S).addScaledVector(dir, (stand + 0.62) * s);
      // climbs the whole way and is still climbing when it is taken, so the
      // line has a direction in it even standing still
      out.y = S.y + (PEAK - S.y) * Math.sin(s * Math.PI * 0.5);
      return out;
    }
    const u = Math.min(1, (tau - CATCH) / (IN - CATCH));
    const stall = easeOut(Math.min(1, u / 0.18));
    const drawn = easeIn(Math.max(0, (u - 0.18) / 0.82));
    tmp.copy(P).addScaledVector(dir, 0.2 * stall);
    return out.lerpVectors(tmp, M, drawn);
  };

  const head = new THREE.Vector3();

  kit.hold(g, SPAN, (t) => {
    /* the urn */
    // It arrives QUIETLY — no ring, no flash, no rise out of the stone. The
    // menace is that it was already there; a vessel that announces itself is a
    // summon, and this card summons nothing. The only tell before the soul
    // moves is the faintest breath on the glyphs.
    const wake0 = Math.min(1, t / 0.085);
    urn.material.opacity = wake0;
    const noticed = Math.max(0, 1 - Math.abs(t - LOOSE) / 0.09);
    const open = Math.max(0, Math.min(1, (t - OPEN) / 0.09));
    const bound = Math.max(0, Math.min(1, (t - SLAM) / 0.07));
    // a heartbeat once it is holding something, slowing as it settles
    const beat = 0.5 + 0.5 * Math.sin((t - SLAM) * 34);
    const flare = Math.max(0, 1 - Math.abs(t - SLAM) / 0.045);
    urn.material.emissiveIntensity = wake0 * (0.06 + noticed * 0.35 + open * 0.45
      + bound * (0.85 + beat * 0.5) + flare * 2.6);

    // The lid HINGES. Slid straight up and back down it read as a cork being
    // pulled, which is a thing being opened rather than a thing opening
    // itself, and the urn has to be the one acting here.
    const shut = Math.max(0, Math.min(1, (t - SLAM) / 0.05));
    const tip = easeOut(open) * (1 - easeIn(shut));
    lidPivot.rotation.z = -1.15 * tip;
    lidPivot.position.y = 1.12 + 0.26 * tip;
    lidPivot.position.x = -0.16 * tip;

    // the light down the neck: up as it opens, snuffed by the lid
    inner.intensity = wake0 * (open * 5.2 * (1 - shut) + flare * 9 + bound * beat * 1.6);

    sigil.material.opacity = 0.18 * wake0 + 0.42 * open
      + 0.55 * Math.max(0, 1 - Math.abs(t - CATCH) / 0.1) + flare * 0.7;
    sigil.scale.setScalar(1 - 0.05 * open + flare * 0.18);

    /* the card */
    if (mats.length && !mark.yield) {
      // The light goes out BEFORE anything leaves, because that is the order it
      // happens in — the fighter dies, and only then is there a soul to catch.
      // Brought in at the same instant as the departure it read as the soul
      // taking the card's colour with it, which is a theft and not a rescue.
      const out = easeOut(Math.min(1, Math.max(0, (t - DRAIN) / (LOOSE - DRAIN))));
      // and a last pale swell on the face just before it lets go
      const swell = Math.max(0, 1 - Math.abs(t - LOOSE + 0.035) / 0.12) * 0.3;
      // 0.86, not 0.72. Probed at the catch the front material was sitting at
      // 0x8c8990 — a bit over half brightness in sRGB, which is a card in
      // shade rather than a card whose light has gone out, and next to two
      // undimmed neighbours it did not read as anything having happened. The
      // art has to stay legible underneath (a card gone to black is a hole in
      // the board), so this stops at about a third.
      const k = 1 - out * 0.86 + swell;
      tint.setRGB(k * 0.94, k * 0.9, k);
      for (let i = 0; i < mats.length; i++) mats[i].color.copy(base[i]).multiply(tint);
    }

    letgo.material.opacity = 0.9 * Math.max(0, 1 - Math.abs(t - LOOSE) / 0.085) ** 0.7;
    letgo.scale.setScalar(0.26 + easeOut(Math.max(0, Math.min(1, (t - LOOSE + 0.06) / 0.16))) * 0.8);

    /* the soul */
    const alive = t > LOOSE - 0.03 && t < SLAM;
    if (alive) {
      soulAt(t, head);
      // The wake is cut short of the card on purpose. Run all the way back to
      // the square it started on, it was a lit line joining two places — which
      // is harvest's tether, and this soul is attached to nothing.
      const reelIn = Math.max(0, 1 - Math.max(0, t - IN) / (SLAM - IN));
      const span = TAIL * reelIn;
      for (let i = 0; i < SEG; i++) {
        soulAt(Math.max(LOOSE + 0.004, t - (i / (SEG - 1)) * span), pts[i]);
      }
      wake.lay(pts, { taper: 0.85, twist: 0 });
      wake.mat.opacity = Math.min(1, (t - LOOSE + 0.03) / 0.05) * reelIn;

      // It SHRINKS as it goes down the neck but it never dims: the soul is
      // preserved, and a soul that fades on the way in has been consumed.
      const eaten = Math.max(0, (t - (IN - 0.07)) / (SLAM - IN + 0.07));
      const grow = Math.min(1, (t - LOOSE + 0.03) / 0.06);
      core.position.copy(head);
      core.scale.setScalar((0.46 - eaten * 0.34) * grow);
      core.material.opacity = grow;
      halo.position.copy(head);
      halo.scale.setScalar((1.02 - eaten * 0.7) * grow);
      halo.material.opacity = 0.62 * grow;
    } else {
      wake.mat.opacity = 0;
      core.material.opacity = 0;
      halo.material.opacity = 0;
    }

    /* the splash */
    for (const m of motes) {
      const u = m.userData;
      const k = (t - CATCH - u.lag) / (IN - CATCH);
      if (k <= 0 || k >= 1.05) { m.material.opacity = 0; continue; }
      // out for a twelfth of a second, then every one of them goes in
      const outK = easeOut(Math.min(1, k / 0.26));
      const back = easeIn(Math.max(0, (k - 0.26) / 0.74));
      tmp.copy(P).addScaledVector(u.v, outK);
      m.position.lerpVectors(tmp, M, back);
      m.scale.setScalar(u.size * (1 - back * 0.55));
      m.material.opacity = Math.min(1, k * 8) * (1 - back ** 3);
    }

    /* home */
    // It CARRIES the thing back. The soul has to end where the card is, or the
    // motif says the urn took it away — and the card says the opposite, that
    // it is put into this square. A glide, low and flat, with no line and
    // nothing reeling: the jar simply walks its prize home.
    const home = easeInOut(Math.max(0, Math.min(1, (t - CARRY) / (SET - CARRY))));
    urnG.position.set(
      J.x + (p.x - J.x) * home,
      J.y + (flatY(p) - J.y) * home + Math.sin(Math.PI * home) * 0.16,
      J.z + (p.z - J.z) * home,
    );
    if (home > 0) sigil.material.opacity *= 1 - home;
    // and sinks into the square it was carried to, so what the player is left
    // looking at is the card, which is where the rules put the fighter
    const gone = easeIn(Math.max(0, (t - SET) / (1 - SET)));
    urnG.scale.setScalar(URN * (1 - gone * 0.55));
    if (gone > 0) {
      urn.material.opacity = 1 - gone;
      urn.castShadow = gone < 0.5;
      lid.castShadow = gone < 0.5;
      letgo.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, gone * 1.2));
      letgo.scale.setScalar(0.5 + gone * 0.75);
    }
  }, () => {
    urn.castShadow = true;
    if (!mats.length || mark.yield) return;
    // Pieces are pooled: a card handed back still dark is a ghost for as long
    // as it lives.
    for (let i = 0; i < mats.length; i++) {
      mats[i].color.copy(base[i]);
      mats[i].opacity = 1;
      mats[i].transparent = wasClear[i];
    }
    piece.animating = false;
    if (piece.phylMark === mark) piece.phylMark = null;
  });

  // Light only where something happens, and never along the run: the braziers
  // are low and a lit line crossing two squares washes the whole board.
  kit.after(CATCH * SPAN, () => {
    kit.light(P, 0xd8c4ff, { power: 13, seconds: 0.2, reach: 3.2 });
  });
  kit.after(SLAM * SPAN, () => {
    kit.light(new THREE.Vector3(J.x, J.y + 0.7, J.z), 0x8a4ff0,
      { power: 17, seconds: 0.36, reach: 4.2 });
  });
}

/* ------------------------------------------------- what becomes of the card */

/**
 * How long the body must stay on the table after the rules have killed it.
 *
 * Measured against the motif above rather than guessed. The soul is not clear
 * of the card until LOOSE (0.315s) and it is not SAFE until the lid slams at
 * 0.867s; killed sooner than the first of those, the card is off the square
 * before the thing that came out of it has gone anywhere, which is the Fire
 * Bolt bug — a card dying before its own effect reaches it.
 *
 * 0.62 rather than 0.45 because of what the exit does with the time: it lets
 * the husk SETTLE for 0.3s before it starts dragging, so 0.62 puts the drag
 * at 0.92s, just after the slam. At 0.45 the body began sliding off the board
 * during the catch and there were two things moving at once in a motif whose
 * whole point is one of them.
 */
export const timing = { kill: 0.62 };

const EXIT = 1.15;
const HOLLOW = 0.34;   // all the colour is out of it

/**
 * A card the Phylactery emptied has to leave like an EMPTY THING.
 *
 * The generic death strikes the card flat, throws it up and lobs it onto the
 * discard pile with a burst under it — which is a body with something still in
 * it. Here the only part worth keeping has already been taken and is sitting
 * in a jar on the square, so the husk gets no burst, no dust, no light and no
 * lift at all: it drains to bone grey, settles, and is dragged off along the
 * stone to the pile, thinning as it goes.
 *
 * Nothing rises. That is the whole difference, and it is the only death on
 * this table where the card never leaves the ground.
 */
export const exit = {
  destroy(kit, piece, square, ev, done) {
    if (!piece) { done?.(); return; }

    const home = piece.restingPosition?.() || piece.group.position.clone();
    const gp = kit.grave(piece.owner);
    const to = new THREE.Vector3(gp.x - home.x, 0, gp.z - home.z);
    // a Stronghold sits on its own plinth directly over its graveyard, so the
    // direction can come out as nothing at all
    if (to.lengthSq() < 1e-6) to.set(0, 0, 1);

    // The motif may already own this card's colour (see `phylMark`) — the card
    // that resolved is a Construct and the rules destroy it as part of the
    // catch, so the motif and the exit can land on the same piece. Take the
    // drain over rather than starting a second one under it.
    const mark = piece.phylMark || null;
    if (mark) mark.yield = true;
    // AND IT MUST NOT DRAIN IT AGAIN. `base` for the front is white, so an
    // easeOut starting from sec = 0 puts the card back to FULL BRIGHTNESS on
    // the very frame the exit takes over and then dims it a second time — a
    // card that has had the light taken out of it flashing back to life the
    // moment the body is dragged away. Already hollow, this starts hollow.
    const hollowed = !!mark;

    const edge = piece.card3d.material[0];
    const mats = [piece.frontMat, piece.backMat, edge];
    const wasClear = mats.map((m) => m.transparent);
    // white for the front, for the same reason as above: pieces.js owns that
    // one and it is holding whatever dim it last computed
    const base = mats.map((m, i) => (i === 0 ? new THREE.Color(1, 1, 1) : m.color.clone()));
    for (const m of mats) m.transparent = true;
    piece.animating = true;

    const tint = new THREE.Color();
    kit.anim.add(EXIT, (t) => {
      const sec = t * EXIT;
      // Bone, not black. A card that goes black has been burnt, and this one
      // has not been touched — it has only been vacated, so what is left is
      // the colour of something that was never alive.
      const out = hollowed ? 1 : easeOut(Math.min(1, sec / HOLLOW));
      // matched to the motif's own drain above, and a shade paler, so a card
      // the Phylactery emptied does not get BRIGHTER the moment the exit takes
      // it over — which is what happened while the motif stopped at 0.72 and
      // this stopped at 0.68.
      const k = 1 - out * 0.82;
      tint.setRGB(k * 0.98, k * 0.95, k * 0.9);
      for (let i = 0; i < mats.length; i++) mats[i].color.copy(base[i]).multiply(tint);

      // It SETTLES rather than buckling: nothing is pushing it, nothing is
      // burning it, and there is no longer anything inside holding it up.
      const slump = easeOut(Math.min(1, sec / 0.42));
      const haul = easeIn(Math.max(0, (sec - 0.3) / (EXIT - 0.3)));
      piece.group.position.set(
        home.x + to.x * haul,
        // never above where it started — the one death on this table with no
        // lift in it, which is what says the thing inside is already gone
        home.y - 0.035 * slump,
        home.z + to.z * haul,
      );
      piece.tilt.rotation.x = 0.055 * slump;
      piece.tilt.rotation.z = -0.03 * slump - 0.1 * haul;
      piece.group.scale.setScalar(1 - 0.1 * slump - 0.2 * haul);
      // gone before it gets there: an empty shell does not need putting down
      const fade = Math.max(0, (haul - 0.35) / 0.65);
      for (const m of mats) m.opacity = 1 - fade ** 1.4;
      piece.group.visible = fade < 0.998;
    }, () => {
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i]);
        mats[i].opacity = 1;
        mats[i].transparent = wasClear[i];
      }
      piece.group.visible = true;
      piece.group.scale.setScalar(1);
      piece.group.position.copy(home);
      piece.tilt.rotation.set(0, 0, 0);
      piece.animating = false;
      if (piece.phylMark === mark) piece.phylMark = null;
      done?.();
    });
  },
};
