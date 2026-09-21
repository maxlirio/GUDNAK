// THE HAUL — one fighter is towed along behind another.
//
// Shared by 1 card: A003 Mammoth Caravan. "Once per turn, after this fighter
// Moves or is relocated, you may relocate target other fighter 1 square."
//
// THE PICTURE IS THE LINE BETWEEN THEM. Everything else here — the ruts, the
// dust, the lurch — is in service of one thing: a trace running from the
// mammoth to somebody else, going tight, and that somebody coming with it.
// Without the line the motif is two cards that happen to move; with it the
// second card is not moving, it is BEING MOVED, which is what the card says.
//
// SLACK FIRST. The trace lies loose and bowed across the stone for a fifth of
// a second before it straightens, and that fifth of a second is most of the
// motif: a line that is taut from the first frame is a wire between two points
// and says nothing about which end is pulling. The slack is also where the
// WEIGHT is — you can see how much rope there is to take up.
//
// AND THE SLACK IS SIDEWAYS. A rope hanging between two cards sags about a
// tenth of a unit, which is three pixels at this camera, so vertical slack is
// invisible; height costs 26px a unit here and WIDTH IS FREE. So the loose
// trace bows across the stone instead, and tautening is a bow closing rather
// than a curve lifting.
//
// WHAT IT IS NOT: ./usher.js, which is the other motif about moving one
// fighter one square. That is a COURTESY — two rails of water open a lane
// beside a fighter, nothing touches him, and the lane keeps clear of his card
// entirely. This is the opposite in every part: one heavy strap, it is
// attached to both of them, it drags across their art, and what it leaves
// behind is scraped stone rather than foam.
//
// Nor is it ./cloth.js, the bolts, though it is the same faction's cloth. A
// bolt is a long ribbon that unrolls and WRAPS. This is short, straight, taut,
// and hitched at both ends — harness, not a thrown banner.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=420" \
//             --eval tools/fxdemo/haul.js --out /tmp/haul-420.png \
//             --wait 8000 --settle 500
// ?t is milliseconds INTO the motif; ?me and ?you are the two squares, so the
// trace can be looked at running toward the camera, away from it, and across.

import { THREE, CARD_W } from '../kit.js';
import { weave } from '../cloth-kit.js';
import { STEP } from '../../arena.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 1.5;
const TAUT = 0.30;        // the slack is gone and the tow starts
const DROP = 0.62;        // the strain comes off and the trace goes loose
const GONE = 0.80;        // ...and is dragged away after him

/**
 * How long the towed fighter must stay put.
 *
 * Exactly the moment the trace goes tight. Without it main.js starts the slide
 * on the first frame and the card is already a third of the way there before
 * there is a line attached to it — which reads as a fighter walking off and a
 * rope being thrown after him.
 */
export const timing = { kill: SPAN * TAUT };

/* ---------------------------------------------------------------- colour */

// Auroxi dye, and DARKER than the faction's own flourish. ./cast-auroxi.js
// learned this the expensive way: its first pass used FACTION.spark, a peachy
// 0xffb257, and the cloth came out as cream paper. A harness strap is dyed
// hide worked to death, not a pennant.
const STRAP = 0x8f4614;
const RUT = new THREE.Color(0x120c05);
// How far in from each card's centre the trace is made fast.
const HITCH = CARD_W * 0.29;
// Dust, and DARK dust. A pale puff on lit flagstone is invisible, so what is
// drawn is the shadow the dust throws rather than the dust. This works here
// because the puff is SMALL and sits on stone the key is falling on; ./gust.js
// took the same rule out to a front across the whole board and the front
// disappeared — see the head of ./steppe.js, which replaced it.
const GRIT = new THREE.Color(0x4b3a26);

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials and a material
// never disposes its map, so a canvas built per cast leaks a GPU upload.
const TEX = new Map();
function tex(key, paint, w, h) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    TEX.set(key, t);
  }
  return t;
}

/**
 * Two ruts, scraped along the stone: the marks of something that did not want
 * to come.
 *
 * TWO and not one, and they run the whole length of the canvas so the plate
 * can be stretched along the path. One line is a drawn trajectory — the
 * interface pointing at a square — and two lines a card's width apart are the
 * corners of a card that was dragged on its face.
 */
const rutTex = () => tex('rut', (g, W, H) => {
  g.clearRect(0, 0, W, H);
  // A SWATH FIRST, then the two ruts in it. The first cut was two dashed lines
  // 5 canvas pixels wide, which over a square and a half of stone works out at
  // a trail of dark specks two or three screen pixels across: drawn, measured,
  // present in the scene graph at 0.62 opacity, and completely invisible in
  // every shot. A sub-pixel detail is an absent detail, so everything here is
  // sized from how big it will be ON SCREEN — the ruts are a fifth of a unit
  // across, which is five pixels, and the dashes are a third of a unit long.
  const swath = g.createLinearGradient(0, 0, 0, H);
  swath.addColorStop(0, 'rgba(255,255,255,0)');
  swath.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  swath.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = swath;
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  for (const [v, w, a] of [[0.3, 11, 0.95], [0.7, 9, 0.8]]) {
    // Broken, and wandering. A rut held at one width down its whole length is
    // a ruled line, and a ruled line on a game board is a UI element.
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * W, x1 = ((i + 0.78) / n) * W;
      const y = (k) => H * v + Math.sin(k * 1.7 + v * 9) * H * 0.05;
      g.strokeStyle = `rgba(255,255,255,${a * (0.55 + 0.45 * Math.sin(i * 2.3 + v))})`;
      g.lineWidth = w * (0.7 + 0.5 * Math.sin(i * 1.1 + v * 3));
      g.beginPath();
      g.moveTo(x0, y(i));
      g.quadraticCurveTo((x0 + x1) / 2, y(i + 0.5), x1, y(i + 1));
      g.stroke();
    }
  }
}, 256, 64);

/** A soft blot, for the dust a dragged corner throws up. */
const puffTex = () => tex('puff', (g, W) => {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const x = W / 2 + Math.cos(a) * W * 0.16, y = W / 2 + Math.sin(a) * W * 0.14;
    const grd = g.createRadialGradient(x, y, 0, x, y, W * 0.3);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, W);
  }
}, 96, 96);

/**
 * The faction's own woven cloth, at a scale a harness strap can carry.
 *
 * ../cloth-kit.js caches ONE weave for the whole game and ./cast-auroxi.js's
 * pennants are built on it, so its repeat may not be touched — a strap that
 * retuned the shared texture would silently rescale every bolt of cloth in the
 * game. This keeps a cloned pair of its own instead: one extra upload for the
 * life of the page rather than one per cast.
 *
 * The repeat matters and cast-auroxi paid for the lesson: at the map's native
 * scale the ribs land every 0.1 units, which is under three pixels at this
 * camera, and a sub-pixel weave is a shimmering checkerboard rather than
 * cloth. 0.35 puts a crease every 7 or 8 pixels, running ACROSS the strap,
 * which is the way creases lie on something under tension.
 */
let WEFT = null;
function weft() {
  if (!WEFT) {
    const w = weave();
    const map = w.map.clone();
    map.needsUpdate = true;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(0.35, 1);
    const alpha = w.alpha.clone();
    alpha.needsUpdate = true;
    WEFT = { map, alpha };
  }
  return WEFT;
}

/** The hitch: a dark knot of strapping where the trace is made fast. */
const hitchTex = () => tex('hitch', (g, W, H) => {
  g.filter = `blur(${W * 0.03}px)`;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  for (const [y, w] of [[0.3, 0.19], [0.5, 0.26], [0.72, 0.17]]) {
    g.lineWidth = H * w;
    g.beginPath();
    g.moveTo(W * 0.14, H * y);
    g.quadraticCurveTo(W * 0.5, H * (y + (y < 0.5 ? -0.13 : 0.13)), W * 0.86, H * y);
    g.stroke();
  }
}, 96, 64);

/* -------------------------------------------------------------- who moves */

/**
 * The fighter being towed.
 *
 * Read off the board rather than passed in: the rules hand the motif the
 * mammoth's uid and nothing else. main.js pins every card the rules moved at
 * the square it LEFT while it waits out timing.kill above, so the towed
 * fighter is the one standing a square away from where it belongs — and the
 * nearest such card to the mammoth, because the Caravan's chain can move
 * several in one action and the trace only has two ends.
 */
function towed(kit, me, from) {
  let best = null, bestD = Infinity;
  for (const piece of kit.pieces?.byUid?.values?.() || []) {
    if (piece === me) continue;
    if (!(piece.square >= 0 && piece.square < 9)) continue;
    const rest = piece.restingPosition?.();
    if (!rest) continue;
    const moved = Math.hypot(rest.x - piece.group.position.x, rest.z - piece.group.position.z);
    if (moved < STEP * 0.5) continue;
    const d = piece.group.position.distanceTo(from);
    if (d < bestD) { bestD = d; best = piece; }
  }
  if (best) return best;
  // Nothing pinned — the effects bench, or a chain that had nowhere to go. The
  // nearest other fighter is still the honest answer to "who came with it",
  // and a motif that drew nothing at all on the bench could not be reviewed.
  for (const piece of kit.pieces?.byUid?.values?.() || []) {
    if (piece === me) continue;
    if (!(piece.square >= 0 && piece.square < 9)) continue;
    const d = piece.group.position.distanceTo(from);
    if (d > STEP * 1.6 || d > bestD) continue;
    bestD = d; best = piece;
  }
  return best;
}

/* ------------------------------------------------------------------ main */

/** A flat decal lying on the stone. */
function plate(map, w, h, colour, order) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity: 0,
  }));
  m.material.color.copy(colour instanceof THREE.Color ? colour : new THREE.Color(colour));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = order;
  return m;
}

export function haul(kit, at) {
  const me = kit.piece(at);
  const from = kit.at(at);
  if (!from) return;
  const you = towed(kit, me, from);
  if (!you) return;

  // Where the tow ENDS, taken now: restingPosition is the square the rules
  // already put him on, and it is the only thing here that knows where he is
  // going. A card caught mid-lerp would answer with a place it is only
  // passing through.
  const start = you.group.position.clone();
  const end = you.restingPosition?.() || start;

  const g = new THREE.Group();

  /* ------------------------------------------------------------ the trace */

  // kit.strip, the Auroxi cloth: a chain of points laid into a quad strip with
  // real normals, so the strap takes the key light and has a lit edge and a
  // dark one. Emissive is 0.09 and not the kit's 0.4 — at 0.22, with no weave
  // map to take the saturation out of it the way ./cast-auroxi.js's pennants
  // have, this came out as a flat orange plank lying across two cards with no
  // shading in it anywhere. Dark dyed hide that catches the key on one edge is
  // both the right object and the only version that reads against lit stone.
  const N = 54;
  const trace = kit.strip({ segments: N, width: 0.19, colour: STRAP, emissive: 0.09 });
  const cloth = weft();
  trace.mat.map = cloth.map;
  trace.mat.alphaMap = cloth.alpha;
  // alphaTest as well as blending, exactly as the bolts do: it gives the
  // ending for free, since as opacity falls the strap is eaten away from its
  // frayed selvedge inward instead of ghosting out as a whole rectangle.
  trace.mat.alphaTest = 0.2;
  trace.mat.needsUpdate = true;
  trace.mat.opacity = 0;
  g.add(trace.mesh);

  // A hitch at each end. Two cards joined by a bare line are two cards with a
  // line drawn between them; the knots are what make it ATTACHED, and they are
  // also the one detail that says harness rather than thrown ribbon.
  const hitches = [0, 1].map(() => {
    const h = plate(hitchTex(), 0.33, 0.24, new THREE.Color(0x2a1608), 6);
    g.add(h);
    return h;
  });

  /* ------------------------------------------------------- what it leaves */

  // The ruts, along the path he is dragged. Anchored at the square he left, so
  // growing scale.x scrapes them out BEHIND him rather than fattening a mark
  // that was already there.
  const span = Math.hypot(end.x - start.x, end.z - start.z) || STEP;
  const ruts = plate(rutTex(), span, CARD_W * 0.62, RUT, 2);
  ruts.geometry.translate(span / 2, 0, 0);
  ruts.position.set(start.x, 0.08 + 0.055, start.z);
  ruts.rotation.z = -Math.atan2(end.z - start.z, end.x - start.x);
  g.add(ruts);

  // Dust off the two trailing corners. Flat decals and not sprites: a
  // camera-facing blob at this size is a round bright dot, and round bright
  // dots are lens bokeh — the eye goes to them instead of to the board.
  const dir = new THREE.Vector3(end.x - start.x, 0, end.z - start.z).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const puffs = [-1, 1].map((s) => {
    const m = plate(puffTex(), 0.8, 0.8, GRIT, 3);
    m.userData.side = s;
    g.add(m);
    return m;
  });

  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < N; i++) pts.push(new THREE.Vector3());

  kit.hold(g, SPAN, (t) => {
    if (!me?.group.parent || !you.group.parent) { trace.mat.opacity = 0; return; }
    // Re-read both ends EVERY frame. The towed card is pinned for the first
    // third of this and then slid by main.js's own tween, and a trace laid
    // once at the start detaches from him the instant he sets off — which is
    // the one thing a tow rope may never do.
    A.copy(me.group.position);
    B.copy(you.group.position);
    const gap = A.distanceTo(B) || 0.001;
    const ux = (B.x - A.x) / gap, uz = (B.z - A.z) / gap;
    // It is made fast a third of the way in from each card's centre rather
    // than at the centres. Run centre to centre the strap lies straight across
    // both fighters' faces — a bar over the art of the two cards the effect is
    // about — where hitched on the inner edge it crosses only the half of each
    // card that is already pointing at the other one.
    A.x += ux * HITCH; A.z += uz * HITCH;
    B.x -= ux * HITCH; B.z -= uz * HITCH;
    const L = Math.max(0.3, gap - HITCH * 2);

    // The slack, as a sideways bow that closes. It is thrown to one side and
    // wobbles, because a symmetric arc between two points is a drawn bracket.
    const loose = 1 - smooth(t / TAUT);
    const sag = 1 - smooth((t - DROP) / (GONE - DROP));   // it goes slack again
    const bow = 1.05 * Math.max(loose, (1 - sag) * 0.5);
    // The twang: the moment it comes tight the whole length rings once and
    // damps out. Two hundredths of a unit, and it is the difference between a
    // rope taking a load and a line being redrawn.
    const ring = Math.exp(-Math.abs(t - TAUT) * 34) * Math.sin((t - TAUT) * 150) * 0.055;

    // Where it sits: on the card faces at both ends and down on the stone in
    // between. Flat work needs 0.055 of clearance — a card face is at about
    // 0.21 and the flagstone at 0.080, and at less the depth test (gl.LESS
    // fails on equal) drops it on the stone AROUND a card, not on it.
    const HI = 0.21 + 0.055, LO = 0.08 + 0.075;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const s = u * L;
      // On the card as far as its edge, and down on the stone past it.
      const on = Math.max(smooth((CARD_W * 0.5 - HITCH - s) / 0.2),
        smooth((CARD_W * 0.5 - HITCH - (L - s)) / 0.2));
      const lat = Math.sin(Math.PI * u) * bow
        + Math.sin(Math.PI * 2.4 * u + 1.1) * bow * 0.3
        + Math.sin(Math.PI * 3 * u) * ring;
      pts[i].set(A.x + ux * s - uz * lat, LO + (HI - LO) * on, A.z + uz * s + ux * lat);
    }
    // taper 0.12, not the kit's 0.55: a strap that narrows to half its width
    // by the far end is a pennant, and the whole point of this one is that it
    // is the same heavy thing at both ends.
    trace.lay(pts, { taper: 0.12 });
    trace.mat.opacity = Math.min(1, smooth(t / 0.07)) * (1 - smooth((t - GONE) / 0.2));
    // castShadow does not read opacity, so a faded strap keeps throwing a hard
    // shadow on the stone after it has gone.
    trace.mesh.castShadow = trace.mat.opacity > 0.4;

    for (let i = 0; i < 2; i++) {
      const p = i ? B : A;
      hitches[i].position.set(p.x, HI + 0.006, p.z);
      hitches[i].rotation.z = -Math.atan2(uz, ux);
      hitches[i].material.opacity = 0.8 * trace.mat.opacity;
    }

    /* ---- the ruts and the dust ---- */
    // Keyed to where he actually IS, not to the clock: main.js owns his slide
    // and its easing is not this file's to guess at, so the scrape is measured
    // off the distance he has covered.
    const gone = clamp01(Math.hypot(B.x - start.x, B.z - start.z) / span);
    ruts.scale.set(Math.max(0.001, gone), 1, 1);
    ruts.material.opacity = 0.88 * Math.min(1, gone * 4) * (1 - smooth((t - 0.72) / 0.28));

    for (let i = 0; i < 2; i++) {
      const m = puffs[i];
      const s = m.userData.side;
      // At the trailing corners, which is where a dragged card scrapes.
      m.position.set(B.x - dir.x * 0.75 + side.x * s * 0.52, 0.08 + 0.05,
        B.z - dir.z * 0.75 + side.z * s * 0.52);
      // Keyed to the distance for when it STARTS and to the clock for when it
      // goes: on distance alone the dust died the instant he arrived, which is
      // the one moment dust does not do anything of the kind.
      m.scale.setScalar(0.6 + clamp01(gone) * 1.4);
      m.material.opacity = 0.45 * smooth((gone - 0.08) / 0.22)
        * (1 - smooth((t - 0.5) / 0.34));
    }
  }, () => {
    trace.mesh.castShadow = false;
  });
}

/**
 * This motif CARRIES its card: it reads the card's current position as the
 * start of the journey and its resting place as the end, and does the moving
 * itself. The table's own slide must stand down, or it runs over the top at a
 * third of the length and the card arrives before the motif has finished
 * putting it there. Declared here rather than on a list in main.js so the
 * fact lives next to the code that depends on it.
 */
export const carries = true;
