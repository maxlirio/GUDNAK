// POSSESS — a shadow flows over a fighter and comes to rest ON TOP of it.
//
// Shared by 2 cards: C083 Dominating Wraith, A064 Detached Shadow. Both put
// one fighter physically ON another: the card underneath is still lying there
// and is no longer in play. So the motif is a SMOTHERING, and its end state
// has to be a card that has been covered over rather than a card something
// happened near.
//
// THE SHAPE IS A RECTANGLE, and that is the whole design decision. Every other
// dark thing on this table is round — the Gloaming flourish opens a circular
// pool on the card (cast-gloaming.js), the Gloom Bolt tears a round hole in
// the flagstones (shadow.js), the grave opens as a round mouth (raise.js). A
// card-shaped slab of black laid squarely over a card cannot be confused with
// any of them at sixty pixels, because it is the one shape on the board that
// says COVERED rather than DAMAGED.
//
// It is also the one LATERAL motif here. Everything else rises, falls or
// spreads from a centre; this runs in across the stone from the far side,
// climbs the card's far edge and wipes toward the player, and the reading of
// "arrived from somewhere and settled" lives entirely in that direction.
//
// LEGIBILITY. Black on a dark board is nothing, and the fix is not to make it
// purple — a bright effect for a smothering is a lie. What carries it is ONE
// LINE of cold light travelling at the LEADING EDGE of the darkness: the eye
// tracks the moving bright line, and what it reads is the black following
// behind it. That the line is the same line the whole way — across the stone,
// up over the card's far lip, and on across the card — is the single change
// that made this effect work. Before it there was a bright front on the
// flagstone, then nothing, then a different bright front on the card, and what
// a player saw was two unrelated events. When the line goes over the near edge
// it spills, dies, and hands what is left of itself to a thin outline around
// the card, so the last thing on screen is a black card with a cold rim.
//
// MultiplyBlending was tried for the dark body and is unusable here — its
// alpha is ignored, so it can be turned off but never turned down, and all of
// this has to fade.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5" \
//             --eval tools/fxdemo/possess.js --out /tmp/p.png --settle 600
// which puts six ages of it on six STACKS at once. The harness explains why
// wall-clock --settle cannot be trusted here.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';

/* ---------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 256, h = 256) {
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
 * A sheet of the shadow — the stone half and the card half are both cut from
 * this, so the dark that crosses the flagstone and the dark that covers the
 * card are visibly one thing.
 *
 * It is anchored at its FAR edge and grown toward the player, so in canvas
 * terms the TOP row is the anchored end and the BOTTOM row is the leading edge
 * that travels. (PlaneGeometry rotated -90° about x maps local +y to world -z,
 * and a CanvasTexture flips y, so canvas top = far.)
 *
 * The leading edge is NOT drawn as a hard wavy line. It gets a short fade and
 * the seam is parked on top of it: a sheet that is SCALED to grow would squash
 * any baked wobble to nothing at the start and stretch it at the end, so the
 * two edges drifted apart and the seam floated over a straight grey step. All
 * the shape lives in the seam, which is never scaled.
 *
 * `lip` is what the last two per cent of it is made of. The one on the CARD is
 * violet — violet where it is thin and near-black where it is deep, the same
 * trick the Gloaming flourish uses, and it costs nothing because the shroud has
 * soaked away by the time the motif ends. The one on the STONE is plain dark,
 * because the tide is still lying there at the end and a violet lip left a hard
 * purple stripe across the flagstone in front of the card for the last third of
 * every cast.
 */
const sheetTex = (key, lip) => tex(key, (g, W, H) => {
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0.000, 'rgba(24,9,52,0)');       // the far end, feathered
  v.addColorStop(0.055, 'rgba(12,4,28,0.80)');
  v.addColorStop(0.150, 'rgba(4,1,12,0.96)');
  v.addColorStop(0.780, 'rgba(3,1,10,0.97)');
  v.addColorStop(0.900, 'rgba(9,3,24,0.95)');
  v.addColorStop(0.968, lip);
  v.addColorStop(1.000, 'rgba(60,30,124,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  // and feathered at the sides, so the slab has no cut edges of its own
  const across = g.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.07, 'rgba(0,0,0,1)');
  across.addColorStop(0.93, 'rgba(0,0,0,1)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
});
const shroudTex = () => sheetTex('shroud', 'rgba(48,22,102,0.58)');
const tideTex = () => sheetTex('tide', 'rgba(7,3,18,0.62)');

/**
 * The seam: the line of cold light the darkness travels behind.
 *
 * It MEANDERS. A straight bar sweeping a rectangle is a photocopier, and that
 * was exactly what the first cut looked like — a mechanism scanning a card,
 * with no weight in it. A line that wanders by a few per cent of the card is
 * the front of something being poured.
 *
 * Painted white and tinted by the material, so the one texture serves the
 * travelling seam and the flare at the lip.
 */
const seamTex = () => tex('seam', (g, W, H) => {
  const mid = H * 0.5;
  const line = (x) => mid
    + H * 0.115 * Math.sin(x * 0.0255 + 1.1)
    + H * 0.055 * Math.sin(x * 0.061 + 3.0);
  const pass = (width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    for (let x = 0; x <= W; x += 4) { if (x) g.lineTo(x, line(x)); else g.moveTo(0, line(0)); }
    g.stroke();
  };
  // three passes: a wide haze, a body, a hot core. One stroke of one width is
  // a drawn line; light on an edge has a falloff either side of it.
  pass(H * 0.44, 0.13, H * 0.13);
  pass(H * 0.17, 0.42, H * 0.055);
  pass(H * 0.055, 1.0, H * 0.012);
  g.filter = 'none';
  // The ends die away. The seam is wider than the card so it overhangs, and a
  // blunt end reads as a bar with a length rather than a front with no edges.
  const across = g.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.16, 'rgba(0,0,0,1)');
  across.addColorStop(0.84, 'rgba(0,0,0,1)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 256, 64);

/**
 * What is left when the seam dies: a thin outline the shape of a card.
 *
 * This is the frame that has to survive at sixty pixels. A black card with a
 * cold edge on it reads as a card that has been shut; a black card with no
 * edge reads as a rendering fault.
 *
 * It is deliberately UNEVEN. Drawn as a clean stroke of constant weight all
 * the way round it came out looking like a selection highlight — this board
 * already outlines squares to say "you may click this", and a violet version
 * of that on a card is a UI element, not a shadow. Weighted toward the far and
 * left edges and bitten into in three places, it reads as light catching what
 * is left of an edge.
 */
const rimTex = () => tex('rim', (g, W, H) => {
  const inset = W * 0.086;
  const round = (r) => {
    g.beginPath();
    g.moveTo(inset + r, inset);
    g.arcTo(W - inset, inset, W - inset, H - inset, r);
    g.arcTo(W - inset, H - inset, inset, H - inset, r);
    g.arcTo(inset, H - inset, inset, inset, r);
    g.arcTo(inset, inset, W - inset, inset, r);
    g.closePath();
  };
  g.filter = `blur(${W * 0.018}px)`;
  g.strokeStyle = 'rgba(255,255,255,0.30)';
  g.lineWidth = W * 0.040;
  round(W * 0.05); g.stroke();
  g.filter = `blur(${W * 0.004}px)`;
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = W * 0.011;
  round(W * 0.05); g.stroke();
  g.filter = 'none';
  // the light falls off away from the far-left corner
  g.globalCompositeOperation = 'destination-in';
  const wash = g.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0.00, 'rgba(0,0,0,1)');
  wash.addColorStop(0.45, 'rgba(0,0,0,0.78)');
  wash.addColorStop(1.00, 'rgba(0,0,0,0.34)');
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);
  // and three soft bites out of it, so the line is not continuous
  g.globalCompositeOperation = 'destination-out';
  g.filter = `blur(${W * 0.045}px)`;
  for (const [x, y, r] of [[W * 0.62, inset, W * 0.13], [inset, H * 0.30, W * 0.10],
    [W * 0.86, H * 0.74, W * 0.11]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
});

/**
 * A tongue of the flow, lying flat on the stone: a blunt head with a thin
 * shaft trailing behind it, painted as a MASK and tinted near-black.
 *
 * Head at the canvas BOTTOM, which is the +z end — the direction of travel.
 */
const tongueTex = () => tex('tongue', (g, W, H) => {
  g.filter = `blur(${W * 0.05}px)`;
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath();
  g.moveTo(W * 0.5, H * 0.02);                     // the tail, a point
  g.bezierCurveTo(W * 0.60, H * 0.36, W * 0.80, H * 0.62, W * 0.78, H * 0.82);
  g.bezierCurveTo(W * 0.76, H * 0.99, W * 0.24, H * 0.99, W * 0.22, H * 0.82);
  g.bezierCurveTo(W * 0.20, H * 0.62, W * 0.40, H * 0.36, W * 0.5, H * 0.02);
  g.closePath();
  g.fill();
  g.filter = 'none';
  // thinned along its length, so the tail is a smear and the head is solid
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0.00, 'rgba(0,0,0,0)');
  v.addColorStop(0.34, 'rgba(0,0,0,0.42)');
  v.addColorStop(0.78, 'rgba(0,0,0,0.95)');
  v.addColorStop(1.00, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}, 128, 256);

/* ------------------------------------------------------------------ colour */

// Light caught on the edge of a shadow, not the shadow's own colour. At the
// faction's lilac the seam read as a violet ribbon lying on the card — another
// piece of the effect — instead of as the lit crest of something dark. Washed
// most of the way to white with the blue held above the red, it reads COLD and
// the violet only shows where it is thin.
const SEAM = 0xc3aaff;
const RIM = 0x9f7ff0;

/* ------------------------------------------------------------------ layout */

// The shroud overhangs the card by a tenth. Cut exactly to the card it left a
// hairline of lit card art showing all the way round — the one thing that
// undoes "covered" — and the overhang also reaches the sliver of the SMOTHERED
// card, which pieces.js slides back and to the left so that its edge still
// shows. That sliver is only a few pixels at the real camera, so the darkening
// of the square around it is doing most of the work of saying that the fighter
// underneath has gone out.
const W = CARD_W * 1.10;
const H = CARD_H * 1.10;

// `kit.at` answers about 0.20 for a card, whose face is at ~0.21, and 0.4 for
// a bare square. The clearance is 0.055: at 0.03 the flat parts land on the
// card face to within a rounding error, fail the depth test (gl.LESS fails on
// equal) and are drawn on the stone AROUND the card but not on the card
// itself — so the one surface that has to go black stays lit, and the shot
// looks as though the effect never fired.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;
const STONE = 0.100;                               // the flagstone face is 0.080

/* -------------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. This is a tactic on two
// cards, not a flourish on forty, so it can afford more than the cast's 0.75.
const SPAN = 1.00;
const WIPE0 = 0.24;      // the seam crosses the far edge
const WIPE1 = 0.56;      // and reaches the near one
const SPILL = 0.66;      // the flare over the near lip, and the seam is gone
const SOAK = 0.74;       // the shroud starts sinking into the card

const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };
const decal = (map, w, h, extra = {}) => flat(new THREE.Mesh(
  new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, ...extra,
  }),
));

export function possess(kit, at) {
  const p = kit.at(at);
  if (!p) return;

  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);                     // every child sets its own y
  const face = flatY(p);
  const farZ = -H / 2;                             // world -z is away from seat 0

  /* --- the tide: the darkness itself, lying on the flagstone.
     It is a SHEET with a front, not a pool. The first three passes of this
     were a soft radial blob that grew and drifted, and at every size it read
     as a stain spreading on the stone — a blot hugging the card, never a thing
     arriving. A sheet the width of the square, anchored a square away and
     unrolled toward the player, has a direction in it on any single frame.
     It is cut from the same sheet as the shroud, which is the point: the dark
     that crosses the stone and the dark that covers the card are one thing,
     and a tide that changed its look halfway read as two unrelated events. */
  const tide = decal(tideTex(), 2.9, 1);
  tide.position.y = STONE;
  tide.renderOrder = 1;

  /* --- the flow. Tongues of it run out ahead of the tide, so its front has
     fingers on it rather than the straight hem of a scaled quad, and they die
     at the card's far lip where the seam takes the front over.

     Five, not fifteen. At the size a flagstone actually occupies on screen a
     thin dark streak is four pixels wide, and fifteen of them are a grey haze
     with no direction in it. */
  const FLOW = 5;
  const tongues = [];
  for (let i = 0; i < FLOW; i++) {
    const m = flat(new THREE.Mesh(
      new THREE.PlaneGeometry(0.80, 2.0),
      new THREE.MeshBasicMaterial({
        map: tongueTex(), color: 0x05010e, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    ));
    m.renderOrder = 2;
    m.position.y = STONE + 0.004;
    // The tongues converge: they start spread wider than the card and are
    // drawn in to its width by the time they reach it. Parallel, they were
    // five streaks going past a card; converging, they are one thing arriving
    // at one place.
    const u = (i + 0.5) / FLOW - 0.5;
    const len = 0.78 + Math.random() * 0.42;
    tongues.push({
      m,
      len,
      x0: u * W * 1.85 + (Math.random() - 0.5) * 0.12,
      x1: u * W * 0.72,
      z0: farZ - 1.95 - Math.random() * 0.3,
      // Where it STOPS is worked back from where its head has to end up, not
      // set directly. The mesh is two units deep and scaled by `len`, so the
      // tip is a whole `len` ahead of the centre — aiming the centre at the
      // card's far edge, which is what this did at first, parked every head
      // under the middle of the card and the tongues appeared to melt through
      // it. They now die just SHORT of the lip, where the seam is waiting.
      z1: farZ - 0.10 - len * 0.82,
      // Staggered rather than released together. Level, they arrived as one
      // bar and the flow had no length in it; they now reach the card over
      // about 100ms, so there is always one still on its way in while the
      // first are already being swallowed.
      off: (i * 0.017) + Math.random() * 0.03,
    });
    g.add(m);
  }

  /* --- the shroud, anchored at the far edge and grown toward the player. */
  const shroud = decal(shroudTex(), W, H);
  shroud.position.y = face;
  shroud.renderOrder = 3;

  /* --- the seam. Wider than the card so it runs off both sides: cut to the
     card's width it stopped dead at the edges and read as a lid closing on a
     box rather than as a front of shadow washing over one. */
  const seam = decal(seamTex(), W * 1.26, 0.40, { blending: THREE.AdditiveBlending, color: SEAM });
  seam.renderOrder = 4;                            // its height is set per frame

  /* --- and the outline it leaves behind. */
  const rim = decal(rimTex(), CARD_W * 1.17, CARD_H * 1.17,
    { blending: THREE.AdditiveBlending, color: RIM });
  rim.position.y = face + 0.008;
  rim.renderOrder = 5;

  // These all lie within a centimetre of each other, so the depth sort put
  // them in whatever order the camera happened to give, and on some frames the
  // shroud was painted last and swallowed its own seam. The stack is stated.
  g.add(tide, shroud, seam, rim);

  kit.hold(g, SPAN, (t) => {
    const lift = 1 - easeIn(Math.min(1, Math.max(0, (t - 0.76) / 0.24)));

    /* how far across the card the wipe has got — everything else follows it */
    // Fast off the far edge and creeping at the end. A constant sweep read as
    // a wiper blade; most of the seam's life now happens in the near half of
    // the card, which is the half the camera actually shows.
    const u = Math.min(1, Math.max(0, (t - WIPE0) / (WIPE1 - WIPE0)));
    const k = u * 0.34 + easeOut(u) * 0.66;

    /* the flow */
    // Seeded just inside the tide's own back edge, not at the tongues' start.
    // Seeded further out the light appeared on the NEXT SQUARE for the first
    // few frames, before the flow had moved at all.
    let front = farZ - 1.35;                       // how far in the dark has got
    for (const f of tongues) {
      const k2 = (t - f.off) / 0.22;
      if (k2 <= 0) { f.m.material.opacity = 0; continue; }
      const kk = Math.min(1, k2);
      const e = kk * 0.5 + easeOut(kk) * 0.5;
      const z = f.z0 + (f.z1 - f.z0) * e;
      const x = f.x0 + (f.x1 - f.x0) * e;
      const len = f.len * (0.55 + 0.45 * e);
      f.m.position.set(x, f.m.position.y, z);
      f.m.scale.set(0.7 + 0.5 * e, len, 1);
      // They do not fade out, they are SWALLOWED: held at full strength right
      // up to the card and then cut as the tide closes over where they went.
      // Faded, the flow evaporated on the stone and the card was covered by
      // something unrelated.
      f.m.material.opacity = 0.95 * Math.min(1, k2 * 4)
        * Math.max(0, 1 - Math.max(0, (t - WIPE0) / 0.16));
      // The tip is a whole `len` ahead of the centre, since the mesh is two
      // units deep and scaled by it.
      const tip = z + len * 0.82;
      if (tip > front) front = tip;
    }

    /* one front, for the whole motif */
    // THE SAME LINE crosses the stone and then the card. This is the single
    // change that made the effect read: before it there was a bright bar
    // travelling over the flagstone, then nothing, then a different bright bar
    // travelling over the card, and a player saw two events. Now the light is
    // simply the edge of the shadow, wherever the shadow has got to, and the
    // flagstone and the card are one journey.
    //
    // The wipe only gets a say ONCE IT HAS STARTED. Left in unconditionally it
    // evaluates to the card's own far edge at k = 0, which pinned the front
    // there from the first frame: the sheet was full length before anything
    // had moved, and three passes of shots showed a dark rectangle parked
    // above the card that never advanced. Nothing was wrong with the flow —
    // the max() was simply never looking at it.
    const spill = Math.min(1, Math.max(0, (t - WIPE1) / (SPILL - WIPE1)));
    const edge = Math.max(front + 0.14, u > 0 ? farZ + H * k + 0.05 + spill * 0.10 : -99);

    /* the stone */
    // The tide stops a hair SHORT of the light, so the heads of the tongues
    // stick out past it onto lit stone and the front has fingers on it. Once
    // the wipe is up on the card the BACK comes forward too, faster than the
    // front, so the sheet gathers onto the square rather than leaving a black
    // runway lying across two flagstones for the rest of the motif.
    const back = farZ - 1.5 + 1.25 * easeIn(Math.min(1, Math.max(0, (t - WIPE0) / 0.34)));
    const lead = Math.max(edge - 0.16, back + 0.4);
    tide.scale.set(1, lead - back, 1);
    tide.position.z = (lead + back) / 2;
    tide.material.opacity = 0.95 * Math.min(1, t / 0.06) * lift;

    /* the shroud */
    // It SOAKS IN rather than draws back: the shadow has become the fighter,
    // so retreating the way it came would undo the whole reading. The curve is
    // barely eased — at a cubic ease-in the card was still two thirds black a
    // tenth of a second before the motif ended, and the last frame looked like
    // a bug rather than a finish.
    const soak = Math.min(1, Math.max(0, (t - SOAK) / (1 - SOAK)) ** 1.15);
    shroud.scale.set(1, Math.max(0.001, k), 1);
    // grown from the far edge: the anchored edge stays put and the leading one
    // travels, which is a different picture from a slab fading up in place
    shroud.position.z = farZ + (H * k) / 2;
    shroud.material.opacity = Math.min(1, u * 6) * (1 - soak);

    /* the seam — the light, all the way from the stone to the near lip */
    // It CLIMBS. Between a little before the card's far edge and a little
    // after, the line lifts from the flagstone to the card face, which is the
    // one moment in the motif where anything leaves the ground. Handled the
    // obvious way — hold it on the stone until it is under the card and then
    // snap it up — it vanished for two frames behind the card's own edge,
    // because a light at stone height inside the card's footprint is simply
    // occluded by the card. So it starts rising half a unit early and is fully
    // up before it crosses.
    const climb = Math.min(1, Math.max(0, (edge - (farZ - 0.50)) / 0.52));
    seam.position.set(0, STONE + 0.012 + climb * (face + 0.004 - STONE - 0.012), edge);
    // and it NARROWS as it comes up: a front as wide as the tide gathers to
    // the width of the card. Held wide it overhung the card by a third of its
    // own width and the eye read the light as belonging to the stone.
    // Brightest at the two lips — as it clears the stone onto the card, and
    // again as it goes over the near edge — and dim while it is just crossing,
    // so what a player sees is two beats and a sweep between them.
    const flare = Math.max(climb * (1 - climb) * 4, spill * (1 - spill) * 4);
    seam.material.opacity = (0.45 + 0.8 * flare)
      * Math.min(1, t / 0.05) * (1 - easeIn(spill));
    seam.scale.set(1.20 - 0.20 * climb, 1 + 0.45 * flare, 1);

    /* the outline */
    // It arrives as the seam dies, so the light is not lost, it is put away
    // into the shape of the card. Then it goes out slowly — last thing on
    // screen, and the only part that is still there when the card is clean.
    const on = Math.min(1, Math.max(0, (t - WIPE1) / 0.14));
    rim.material.opacity = 0.92 * easeOut(on)
      * (1 - easeIn(Math.min(1, Math.max(0, (t - 0.72) / 0.26))));
    rim.scale.setScalar(1.06 - 0.06 * easeOut(on));
  });

  /* --- one cold breath, low and on the far side. Hung over the middle it lit
     the card face and undid the whole motif; set low, small and behind, it
     only catches the stone the flow is crossing. */
  const lamp = new THREE.PointLight(0x7e52d8, 0, 2.4, 2);
  lamp.position.set(p.x, STONE + 0.34, p.z - H * 0.62);
  kit.hold(lamp, SPAN * 0.55, (t) => {
    lamp.intensity = 4.2 * Math.min(1, t * 4) * (1 - t) ** 1.6;
  });
}
