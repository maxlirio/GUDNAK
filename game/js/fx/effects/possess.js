// POSSESS — a shadow runs over a fighter, STANDS UP OFF IT as a hooded thing,
// and presses it flat under its hands.
//
// Shared by 2 cards: C083 Dominating Wraith, A064 Detached Shadow. Both put
// one fighter physically ON another: the card underneath is still lying there
// and is no longer in play. So the motif is a SMOTHERING, and its end state
// has to be a card that has been COVERED OVER rather than a card something
// happened near. That distinction is the one thing the effect must say, and
// nothing below is allowed to cost it.
//
// WHAT THIS REPLACES, AND WHY. For most of its life the whole design was that
// the end state is a RECTANGLE — a card-shaped slab of black laid squarely
// over the card, on the reasoning that every other dark thing on this table is
// round, so a rectangle is the one shape that says COVERED rather than
// DAMAGED. The reasoning is sound and it was rejected on sight: "needs to look
// more ghastly than a black square". It was legible and it was not
// frightening. A dark mass the size of a card reads as a HOLE, not as a thing
// — the same trap stall.js documents — and a possession is not a hole. The
// card is a WRAITH TAKING A BODY.
//
// So the read is kept and the look is thrown away. What covers the card now is
// not a slab but a POOL with a torn outline (see `poolTex`: a card-shaped core
// so the art underneath is genuinely covered, and a fringe that wanders by
// about a fifth of a card so the silhouette is never straight), and a FIGURE
// stands up out of it — hood, hollow face, two cold eyes, two bone hands that
// come down on the card and hold it. The victim is pressed: the card takes a
// jolt under the grip and shakes. A shape on a card is not ghastly; something
// being DONE TO somebody is.
//
// The figure is built the way raise.js's hand had to be built, and for the
// same reasons. It is YAWED TO FACE THE LENS every frame and LAID BACK about
// thirty degrees, so its plane is square to a camera that is forty-six degrees
// above the board — laid back, its own height is carried by the "away" axis as
// well as the "up" one and it projects at nearly full length instead of the 26
// pixels a world unit that straight-up height costs here. Its light is BAKED
// per vertex rather than asked of the arena, whose key is a spot confined to
// the board and is behind the figure at one of the two seats. And the dark
// body carries a violet keyline — the inverse of the hand's black one, because
// the problem here is a dark object on a dark board rather than a pale one on
// pale art, and a silhouette with a cold edge is the whole of what survives at
// sixty pixels.
//
// It is still the one LATERAL motif here. Everything else on this table rises,
// falls or spreads from a centre; this runs in across the stone from the far
// side, climbs the card's far edge and wipes toward the player, and the
// reading of "arrived from somewhere" lives in that direction. What is new is
// that having arrived it GETS UP.
//
// LEGIBILITY of the approach. Black on a dark board is nothing, and the fix is
// not to make it purple — a bright effect for a smothering is a lie. What
// carries it is ONE LINE of cold light travelling at the LEADING EDGE of the
// darkness: the eye tracks the moving bright line, and what it reads is the
// black following behind it. That the line is the same line the whole way —
// across the stone, up over the card's far lip, and on across the card — is
// what made the arrival work. Before it there was a bright front on the
// flagstone, then nothing, then a different bright front on the card, and what
// a player saw was two unrelated events.
//
// MultiplyBlending was tried for the dark body and is unusable here — its
// alpha is ignored, so it can be turned off but never turned down, and all of
// this has to fade.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=700" \
//             --eval tools/fxdemo/possess.js --out /tmp/p.png --wait 10000 \
//             --settle 600
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
 * this, so the dark that crosses the flagstone and the dark that arrives on
 * the card are visibly one thing.
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
 * the shape lives in the seam, which is never scaled — and in the pool below,
 * which takes over from this sheet the moment the wipe is done.
 *
 * `lip` is what the last two per cent of it is made of. The one on the CARD is
 * violet — violet where it is thin and near-black where it is deep, the same
 * trick the Gloaming flourish uses. The one on the STONE is plain dark,
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
 * THE POOL — what actually lies on the card, and the answer to "a black
 * square".
 *
 * Two demands pull against each other. The card's ART has to be covered or the
 * fighter reads as merely damaged; and the OUTLINE must not be a rectangle or
 * the whole thing reads as a hole with corners. So the core is a SQUIRCLE, not
 * a disc: a circle big enough to reach a card's corners leaves no room in the
 * quad for a fringe, while an exponent-5 superellipse hugs the card and still
 * leaves a fifth of a card's width of tear all the way round.
 *
 * The edge is made by BLURRING the fill rather than by a radial alpha ramp. A
 * radial ramp is measured from the centre, so on a shape whose radius already
 * varies with angle it thins the corners and leaves the flats hard — exactly
 * the wrong way round. A blur gives the same soft edge at every bearing, so
 * the alpha is flat across the whole card and the only thing that varies is
 * WHERE the edge is.
 *
 * Three octaves of wobble plus a few long tendrils. One octave is a lobed blob
 * and reads as a stain; the tendrils are what make it look torn.
 */
const poolTex = () => tex('pool', (g, W, H) => {
  const cx = W / 2, cy = H / 2;
  // The base is the CARD'S OWN RECTANGLE, offset outward, and the tear is
  // added to it in pixels. A superellipse was tried first and it fails at the
  // corners for a reason worth writing down: a squircle only reaches 1.23
  // times its axis radius on the diagonal where a rectangle reaches 1.41, so a
  // core tuned to cover the card's flats fell eight pixels short of its
  // corners and the art showed through them. Following the rectangle itself
  // cannot go wrong, and the blur below is what rounds the corners off.
  const AX = W * 0.322, AY = W * 0.326;          // half a card, in canvas px
  const cardR = (a) => Math.min(AX / Math.max(1e-4, Math.abs(Math.cos(a))),
    AY / Math.max(1e-4, Math.abs(Math.sin(a))));
  // The tear is BIASED OUTWARD — it never subtracts. A symmetric wobble took
  // bites back inside the card at its troughs and let slivers of lit art out,
  // which is the one thing that undoes "covered".
  const tear = (a) => 14
    + 11 * (0.5 + 0.5 * (0.55 * Math.sin(a * 3 + 1.1)
      + 0.30 * Math.sin(a * 7 + 2.4)
      + 0.15 * Math.sin(a * 13 + 0.3)))
    // three tendrils, narrow and long — a raised cosine, so each is a finger
    // of dark reaching off the card rather than a bump on the outline
    + 22 * Math.max(0, Math.cos((a - 0.7) * 2)) ** 9
    + 19 * Math.max(0, Math.cos((a - 2.9) * 2)) ** 9
    + 17 * Math.max(0, Math.cos((a - 4.4) * 2)) ** 9;
  const path = (grow) => {
    g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const d = Math.min(cardR(a) + tear(a) + grow, W * 0.49);
      g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
    g.closePath();
  };
  // the skirt first: a faint, shapeless spread so the pool sits IN the stone
  // rather than on top of it
  g.filter = `blur(${W * 0.075}px)`;
  g.fillStyle = 'rgba(14,5,34,0.40)';
  path(10); g.fill();
  // then the body, which is what covers the art. The edge is made by BLURRING
  // the fill rather than by a radial alpha ramp: a ramp is measured from the
  // centre, so on a shape whose radius already varies with angle it thins the
  // corners and leaves the flats hard — exactly the wrong way round.
  g.filter = `blur(${W * 0.034}px)`;
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.44);
  grd.addColorStop(0.00, 'rgba(3,1,10,1)');
  grd.addColorStop(0.55, 'rgba(5,2,14,1)');
  grd.addColorStop(0.82, 'rgba(16,6,38,1)');   // violet only where it is thin
  grd.addColorStop(1.00, 'rgba(30,12,66,1)');
  g.fillStyle = grd;
  path(0); g.fill();
  g.filter = 'none';
}, 256, 256);

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
 * What is left when the wraith has lain down: a thin outline the shape of a
 * card.
 *
 * This is the one place the rectangle is still the right answer, because it is
 * the last frame and it is the frame that has to say COVERED. A black card
 * with a cold edge on it reads as a card that has been shut.
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

/**
 * THE HOLLOW — what is inside the hood, painted rather than modelled.
 *
 * The head is about twenty-five screen pixels across at play distance and a
 * sub-pixel detail is an absent detail, so nothing in here is geometry: a
 * modelled brow at that size is three dark pixels wherever you put it. Painted,
 * every mark is placed where it will land.
 *
 * What is drawn, in order of how much it matters: the VOID, a black almond
 * where a face should be; the BRIM, a bone-pale arc over it and down its left
 * side, which is the one thing that makes the void read as a hood opening and
 * not a smudge; two SOCKETS bitten deeper into the void for the eyes to sit
 * in; and the faintest pair of cheek ticks under them. A hood with nothing in
 * it is ghastlier than a skull, and a skull at twenty-five pixels is a blob.
 */
const faceTex = () => tex('face', (g, W, H) => {
  const cx = W / 2;
  // the void: an almond, wider at the brow and drawn to a point at the chin
  g.filter = `blur(${W * 0.05}px)`;
  g.fillStyle = 'rgba(2,0,7,0.99)';
  g.beginPath();
  g.moveTo(cx, H * 0.10);
  g.bezierCurveTo(W * 0.92, H * 0.16, W * 0.90, H * 0.62, cx, H * 0.95);
  g.bezierCurveTo(W * 0.10, H * 0.62, W * 0.08, H * 0.16, cx, H * 0.10);
  g.closePath();
  g.fill(); g.fill();
  g.filter = 'none';

  // the sockets — deeper black, and OFFSET OUTWARD. Set close together they
  // read as a snout; set wide, with the brow line above them, they read as a
  // skull's orbits.
  g.filter = `blur(${W * 0.035}px)`;
  g.fillStyle = 'rgba(0,0,0,1)';
  for (const s of [-1, 1]) {
    g.save();
    g.translate(cx + s * W * 0.185, H * 0.375);
    g.rotate(s * 0.35);
    g.scale(1, 0.72);
    g.beginPath(); g.arc(0, 0, W * 0.145, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.filter = 'none';

  // the brim: the cowl's lit edge, over the top and down the LEFT, which is
  // the bearing the whole motif is lit from. A ring all the way round is a
  // hoop; an arc that dies at the cheek is an edge catching light.
  const brim = (w, alpha, blur, a0, a1) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(214,198,255,${alpha})`;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.ellipse(cx, H * 0.40, W * 0.415, H * 0.335, 0, a0, a1);
    g.stroke();
  };
  brim(W * 0.075, 0.13, W * 0.06, Math.PI * 1.04, Math.PI * 2.04);
  brim(W * 0.022, 0.34, W * 0.012, Math.PI * 1.08, Math.PI * 2.00);
  // a brighter catch on the upper-left shoulder of the hood ONLY. Run all the
  // way round at this strength it came out as a lit hoop — a monk in a halo
  // rather than a hood with light on one side of it.
  g.filter = `blur(${W * 0.008}px)`;
  g.strokeStyle = 'rgba(206,186,255,0.62)';
  g.lineWidth = W * 0.018;
  g.beginPath();
  g.ellipse(cx, H * 0.40, W * 0.415, H * 0.335, 0, Math.PI * 1.10, Math.PI * 1.52);
  g.stroke();
  g.filter = 'none';

  // cheeks: two short bone ticks under the sockets. Two pixels each, and they
  // are the difference between a hollow and a face in a hollow.
  g.filter = `blur(${W * 0.018}px)`;
  g.strokeStyle = 'rgba(190,172,232,0.34)';
  g.lineWidth = W * 0.026;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * W * 0.30, H * 0.52);
    g.quadraticCurveTo(cx + s * W * 0.24, H * 0.62, cx + s * W * 0.11, H * 0.70);
    g.stroke();
  }
  g.filter = 'none';
}, 128, 160);

/**
 * The eyes: two cold points, additive, to be laid in the sockets above.
 *
 * Held off white. Additive plus this arena's filmic curve drives any pale
 * colour to white, and white eyes came out as two headlamps with no faction in
 * them; the red is held down and the blue up, so they read COLD, and the bloom
 * around them is violet rather than lavender for the same reason.
 */
const eyeTex = () => tex('eyes', (g, W, H) => {
  // THE SIZES HERE WERE ONCE A THIRD OF THIS and the shot came back with a
  // blank black hollow. A core of 0.072 of the canvas width, on a quad this
  // size, is about one and a half screen pixels — a sub-pixel detail is an
  // absent detail, and two absent eyes are just a hood with nothing in it.
  for (const s of [-1, 1]) {
    const x = W / 2 + s * W * 0.215, y = H * 0.5;
    const halo = g.createRadialGradient(x, y, 0, x, y, W * 0.30);
    halo.addColorStop(0.00, 'rgba(158,116,252,0.95)');
    halo.addColorStop(0.35, 'rgba(108,60,220,0.42)');
    halo.addColorStop(1.00, 'rgba(54,20,140,0)');
    g.fillStyle = halo;
    g.fillRect(x - W * 0.30, y - W * 0.30, W * 0.60, W * 0.60);
    // the core, a narrow vertical slit — a round pupil at three pixels is a
    // dot, and a dot reads as a light rather than as a look
    g.save();
    g.translate(x, y);
    g.scale(0.40, 1);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.135);
    core.addColorStop(0.00, 'rgba(232,220,255,1)');
    core.addColorStop(0.40, 'rgba(176,136,255,0.82)');
    core.addColorStop(1.00, 'rgba(110,60,220,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(0, 0, W * 0.135, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}, 128, 64);

/**
 * A rag hanging off the mantle: long, tapered, notched down one side, with a
 * thread of violet caught on its edge.
 *
 * Near-black and NORMAL-blended. Additive rags glowed and the wraith became a
 * bonfire; the point of them is that they eat the mantle's clean cone edge.
 */
const tatterTex = () => tex('tatter', (g, W, H) => {
  g.filter = `blur(${W * 0.07}px)`;
  g.fillStyle = 'rgba(6,2,16,0.96)';
  g.beginPath();
  g.moveTo(W * 0.22, 0);
  g.lineTo(W * 0.80, H * 0.06);
  g.lineTo(W * 0.62, H * 0.44);
  g.lineTo(W * 0.74, H * 0.63);
  g.lineTo(W * 0.48, H * 1.00);
  g.lineTo(W * 0.40, H * 0.70);
  g.lineTo(W * 0.26, H * 0.52);
  g.lineTo(W * 0.34, H * 0.22);
  g.closePath();
  g.fill();
  g.filter = 'none';
  // one lit thread down the left edge, where the motif's light comes from
  g.filter = `blur(${W * 0.05}px)`;
  g.strokeStyle = 'rgba(96,58,182,0.40)';
  g.lineWidth = W * 0.07;
  g.beginPath();
  g.moveTo(W * 0.27, H * 0.04);
  g.quadraticCurveTo(W * 0.31, H * 0.40, W * 0.45, H * 0.92);
  g.stroke();
  g.filter = 'none';
}, 64, 192);

/* ------------------------------------------------------------------ colour */

// Light caught on the edge of a shadow, not the shadow's own colour. At the
// faction's lilac the seam read as a violet ribbon lying on the card — another
// piece of the effect — instead of as the lit crest of something dark. Washed
// most of the way to white with the blue held above the red, it reads COLD and
// the violet only shows where it is thin.
const SEAM = 0xc3aaff;
const RIM = 0x9f7ff0;

// The wraith's cloth. Near-black, and it is the VERTEX COLOURS below that give
// it any form at all — this is a MeshBasicMaterial on purpose, because the
// arena's key is a spot confined to the board and two violet flashes are fired
// at the square during this motif, and anything lit will go flat.
const CLOTH = 0x1b1236;
// Its keyline, and the inverse of raise.js's: a pale object on pale card art
// needs a black edge, a black object on a dark board needs a cold one. It has
// to be BRIGHTER THAN THE CLOTH or there is no line — the first build had the
// two within a hair of each other and what came back was a solid royal-blue
// cone with no edge anywhere on it. Still well under the seam's value: a
// bright outline turns the figure into a neon sign, and the figure has to stay
// a hole in the light with a cold edge round it.
const EDGE = 0x522ca6;

/* ------------------------------------------------------------------ layout */

// The pool overhangs the card by half again. The fringe needs somewhere to
// happen, and the overhang also reaches the sliver of the SMOTHERED card,
// which pieces.js slides back and to the left so that its edge still shows.
// That sliver is only a few pixels at the real camera, so the darkening of the
// square around it is doing most of the work of saying that the fighter
// underneath has gone out.
const W = CARD_W * 1.10;          // the arriving sheet, cut to the card
const H = CARD_H * 1.10;
const POOL = CARD_W * 1.55;       // the torn mass that replaces it

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
// cards, not a flourish on forty, so it can afford more than the cast's 0.75 —
// and it needs it now that something has to stand up and lie down again.
const SPAN = 1.35;
const WIPE0 = 0.14;      // the seam crosses the far edge
const WIPE1 = 0.34;      // and reaches the near one
const SPILL = 0.42;      // the flare over the near lip, and the seam is gone
// THE RISE STARTS BEFORE THE WIPE HAS FINISHED, on purpose. Between the seam
// reaching the near edge and the pool taking over there is a window in which
// what is on the card is a straight-edged slab — the very thing this motif was
// rejected for — and at a quarter of a second of it that window was the single
// longest-held picture in the whole cast. Starting the figure inside it cuts
// it to about a tenth of a second and makes it a moment of arrival rather than
// a state: the dark flows in and something is already standing up out of it.
const RISE0 = 0.27;      // the shadow starts getting up
const RISE1 = 0.52;      // full height, arms wide
const GRIP = 0.62;       // the hands come down; the card takes it
const HOLD = 0.72;       // it bears down, shaking
// SOAK MUST LEAVE ROOM AFTER IT. Set to 1.00 — the end of the span — the
// lie-down had zero duration, so every `(t - SOAK) / (1 - SOAK)` divided by
// zero, every one of them clamped to nothing, and the wraith simply vanished
// at full height on the last frame with the pool still black under it.
const SOAK = 0.79;       // and lies down into the card it has taken

const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };
const decal = (map, w, h, extra = {}) => flat(new THREE.Mesh(
  new THREE.PlaneGeometry(w, h),
  new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, ...extra,
  }),
));

/* ------------------------------------------------------------- the camera */

/**
 * The lens, borrowed from the first thing this motif draws.
 *
 * The wraith is built to be LOOKED AT — face to the lens, arms across the view
 * — and that is only possible if it knows where the lens is. Nothing in `kit`
 * hands a motif the camera, so the flat quad that is on screen from the very
 * first frame is used as a peephole: three.js calls onBeforeRender with the
 * camera it is drawing for. Checked for a perspective camera because the
 * shadow pass renders from the sun's, and a figure that turned to face the
 * shadow camera would spin once per frame.
 */
let CAM = null;
const peep = (renderer, scene, cam) => { if (cam.isPerspectiveCamera) CAM = cam; };

/* -------------------------------------------------------------- the figure */

/**
 * Merged geometry with the light BAKED IN, per vertex, plus a pushed-out hull
 * for the keyline. Lifted wholesale from raise.js's `Bones` and here for the
 * same two reasons: one draw call instead of forty, and — far more important —
 * shading that no lamp in the arena can wash out, because baked dark
 * multiplies the albedo rather than adding to it.
 */
const BAKE_L = new THREE.Vector3(-0.30, 0.74, 0.60).normalize();
class Carve {
  constructor(hull) { this.pos = []; this.nor = []; this.col = []; this.hull = []; this.off = hull; }

  /** `t0`/`t1` are how bright this piece is at its base and at its tip. */
  add(geo, m, t0 = 1, t1 = t0, len = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const u = len > 0 ? Math.min(1, Math.max(0, v.y / len + 0.5)) : 0.5;
      v.applyMatrix4(m);
      nv.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      // wrapped lambert, bottoming out well above black: cloth in a torchlit
      // ruin still catches the sky, and a term that reaches zero turns the
      // whole shadow side into one dead value with no form in it
      const lam = 0.5 + 0.5 * nv.dot(BAKE_L);
      const c = (t0 + (t1 - t0) * u) * (0.18 + 0.82 * lam ** 1.3);
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(nv.x, nv.y, nv.z);
      this.col.push(c, c, c);
      this.hull.push(v.x + nv.x * this.off, v.y + nv.y * this.off, v.z + nv.z * this.off);
    }
    if (g !== geo) g.dispose();
  }

  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, material);
  }

  /**
   * The keyline: the same shapes, every vertex pushed out along its normal,
   * drawn back-faces-only so it survives only where the solid does not cover
   * it. On the BONE it is black, for the reason raise.js gives — pale bone on
   * pale card art has no edge. On the CLOTH it is violet, which is the same
   * argument run backwards: the body is near-black, the board is near-black,
   * and without a cold line round it there is no figure there at all.
   */
  outline(colour) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.hull, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colour, side: THREE.BackSide }));
  }
}

const M4 = new THREE.Matrix4(), TR = new THREE.Matrix4();
const node = (parent, x, y, z) => {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
};
/** A shaft along the node's +Y, base at its origin. */
const shaft = (C, at, r0, r1, len, t0, t1, seg = 7) => {
  at.updateWorldMatrix(true, false);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  C.add(g, M4.multiplyMatrices(at.matrixWorld, TR.makeTranslation(0, len / 2, 0)), t0, t1, len);
  g.dispose();
};
/** A bead. Without them a finger is a rod and a hand is a fork. */
const bead = (C, at, y, r, t, squash = 1, wide = 1, deep = 1) => {
  at.updateWorldMatrix(true, false);
  const g = new THREE.SphereGeometry(r, 8, 6);
  g.scale(wide, squash, deep);
  C.add(g, M4.multiplyMatrices(at.matrixWorld, TR.makeTranslation(0, y, 0)), t, t, 0);
  g.dispose();
};
const jit = (k) => (Math.random() - 0.5) * k;

/**
 * A wraith's hand, at the end of an arm whose +Y runs out along the limb.
 *
 * The digits are raise.js's, shortened. Everything that matters about them is
 * in that file's third build and none of it is re-derived here: the digits are
 * SPREAD much wider than a living hand opens, because width is free at this
 * camera and height costs 26 pixels a unit, and the four gaps between five
 * digits are the entire silhouette; the fingers hook TOWARD the lens, because
 * the hand's plane is square to it and a finger bent any other way comes out
 * dead straight; value is RANKED dark-to-bright from wrist to tip; and the
 * whole thing carries a black keyline or it has no edge over card art.
 *
 * Three bones a finger there, two here. This hand is about nineteen screen
 * pixels across where that one is thirty-two, and a third bone at that size is
 * a pixel with a dark line either side of it — which is to say, nothing.
 */
function clawInto(B, at, side) {
  bead(B, at, -0.01, 0.062, 0.40, 0.52, 1.5);
  const AT = [-0.058, -0.019, 0.019, 0.056];
  const SPLAY = [-0.40, -0.13, 0.12, 0.36];
  const FAN = [-0.24, -0.08, 0.08, 0.22];
  const MC = [0.105, 0.120, 0.112, 0.095];
  const PH = [0.150, 0.172, 0.158, 0.120];
  for (let i = 0; i < 4; i++) {
    const d = node(at, AT[i] * side, 0.015, 0);
    d.rotation.order = 'ZXY';
    d.rotation.z = -SPLAY[i] * side + jit(0.05);
    d.rotation.x = 0.06 * (i % 2 ? 1 : -1) + jit(0.05);
    shaft(B, d, 0.034, 0.029, MC[i], 0.30, 0.58, 6);
    const k = node(d, 0, MC[i], 0);
    k.rotation.z = -FAN[i] * side + jit(0.05);
    k.rotation.x = 0.40 + jit(0.10);
    bead(B, k, 0, 0.038, 0.98, 0.82);
    // a long taper to a POINT. A finger that ends blunt is a finger; one that
    // ends in nothing is a claw, and this hand is not meant to be a hand.
    shaft(B, k, 0.028, 0.007, PH[i], 0.48, 1.0, 6);
  }
  // the thumb, swung right out and standing proud toward the lens — the one
  // thing in the silhouette that says hand and not rake
  const th = node(at, -0.040 * side, -0.030, 0.022);
  th.rotation.order = 'ZXY';
  th.rotation.z = 1.34 * side + jit(0.08);
  th.rotation.x = 0.50;
  shaft(B, th, 0.038, 0.032, 0.105, 0.34, 0.66, 6);
  const t2 = node(th, 0, 0.105, 0);
  t2.rotation.z = 0.20 * side;
  t2.rotation.x = 0.44;
  bead(B, t2, 0, 0.036, 0.94, 0.82);
  shaft(B, t2, 0.030, 0.007, 0.115, 0.52, 1.0, 6);
}

/**
 * THE WRAITH.
 *
 * Proportions are in world units and they are not a taste: the card is about
 * eighty screen pixels wide, so the hood is twenty-six pixels across, each eye
 * is a three-pixel core seven pixels from its twin, and a hand is nineteen
 * pixels of splayed claw. Anything finer than that is not there.
 *
 * The silhouette is the product, in this order: a hood, two shoulder points, a
 * mantle that flares to the pool, rags off the hem, and two arms across the
 * view. The mantle is a CONE and a cone seen from forty-six degrees up is a
 * disc, which is why there is a hood on it and points on it and rags off it —
 * the tornado elsewhere in this game works at three and a half units for
 * exactly the same reason, and a smooth one does not work at any size.
 */
function wraith() {
  const grp = new THREE.Group();
  grp.rotation.order = 'YXZ';

  const C = new Carve(0.034);
  const root = new THREE.Object3D();

  // The mantle. Its base is BELOW the card face on purpose: the pool is drawn
  // over it, so the figure has no hem of its own and is seen to come out of
  // the dark rather than to stand on it.
  const body = node(root, 0, -0.16, 0);
  shaft(C, body, 0.56, 0.20, 1.00, 0.12, 0.46, 9);
  // the shoulders: a wide squashed mass, which is what turns a cone into
  // somebody wearing something
  const sh = node(root, 0, 0.82, 0.02);
  bead(C, sh, 0, 0.30, 0.52, 0.34, 1.35, 0.72);
  // and their POINTS — a cowl's cape stands up where the shoulder is under it,
  // and two peaks either side of a head is the oldest hooded silhouette there
  // is. Without them the shoulder mass is a bolster.
  for (const s of [-1, 1]) {
    const pk = node(root, 0.285 * s, 0.80, 0.01);
    pk.rotation.z = -0.55 * s;
    shaft(C, pk, 0.11, 0.015, 0.22, 0.44, 0.24, 6);
  }
  // the neck, barely there — the head is meant to sit low and forward, the
  // way a thing stooping over a body sits
  const nk = node(root, 0, 0.90, 0.02);
  nk.rotation.x = 0.22;
  shaft(C, nk, 0.13, 0.15, 0.16, 0.34, 0.40, 6);
  // THE HOOD, and the first one was a bald egg. A sphere with a violet
  // keyline round it and a dark oval painted on the front is a HELMET — the
  // outline is a closed circle, which is the one shape a cowl never is. Three
  // things fix it and all three are silhouette: a PEAK standing off the top,
  // and two falls of cloth down either side of the face to the shoulders,
  // which is what a hood actually is — an opening with drape hanging round it.
  const hd = node(root, 0, 1.12, 0.00);
  bead(C, hd, 0, 0.285, 0.24, 1.20, 0.90, 0.86);
  const pk = node(hd, 0, 0.12, -0.04);
  pk.rotation.x = -0.28;
  shaft(C, pk, 0.185, 0.02, 0.36, 0.24, 0.09, 6);
  for (const s2 of [-1, 1]) {
    const fa = node(root, 0.195 * s2, 1.24, 0.12);
    fa.rotation.order = 'ZXY';
    // +Y turned to point DOWN and outward, so the shaft hangs
    fa.rotation.z = -(Math.PI - 0.30) * s2;
    fa.rotation.x = 0.10;
    shaft(C, fa, 0.075, 0.115, 0.48, 0.30, 0.20, 6);
  }

  const cloth = new THREE.MeshBasicMaterial({ color: CLOTH, vertexColors: true });
  grp.add(C.outline(EDGE), C.build(cloth));

  // ---- the hollow, and the eyes in it.
  // Painted quads rather than geometry, and set in FRONT of the hood's ovoid
  // rather than recessed into it. Recessed, they lost the depth test against a
  // surface a centimetre away and speckled; this camera cannot separate a
  // centimetre and never will, so nothing here relies on it.
  const head = new THREE.Group();
  // Z IS FREE HERE AND IT IS THE ONLY AXIS THAT IS. The first build put the
  // hollow at 0.255 — seven millimetres clear of the hood's own surface — and
  // nothing was drawn at all, because this camera cannot separate a centimetre
  // and never could. It can be pushed as far forward as it likes: the figure
  // is pitched so that its local +Z runs almost straight down the view axis,
  // so 20cm along it moves the quad about a pixel and a half on screen while
  // buying all the depth clearance there is.
  head.position.set(0, 1.14, 0.46);
  grp.add(head);
  const quad = (map, w, h, order, extra = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0, depthWrite: false, ...extra,
      }));
    m.renderOrder = order;
    head.add(m);
    return m;
  };
  const hollow = quad(faceTex(), 0.50, 0.625, 20);
  const eyes = quad(eyeTex(), 0.52, 0.26, 21, { blending: THREE.AdditiveBlending });
  eyes.position.set(0, 0.040, 0.030);

  // ---- the rags.
  // Six, hung round the mantle and swayed per frame. Five was a tidy cone with
  // decoration on it and fifteen was a grey fringe with no shape; six at a
  // seventh of a card wide each is what breaks the cone's edge while each one
  // is still a rag you can see.
  const rags = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.86),
      new THREE.MeshBasicMaterial({
        map: tatterTex(), transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide,
      }));
    // OUTSIDE the mantle, which is not where they started. Hung at a third of
    // a unit of z they were inside the cone's own surface for their whole
    // length and not one of them was ever drawn; the outer two are set back so
    // they wrap the cone rather than floating off the front of it.
    const u = (i + 0.5) / 6 - 0.5;
    m.position.set(u * 1.06, 0.32, 0.42 - Math.abs(u) * 0.26);
    m.renderOrder = 8;
    m.userData = { x: m.position.x, ph: Math.random() * 6.28, sw: 0.7 + Math.random() * 0.8 };
    rags.push(m);
    grp.add(m);
  }

  // ---- the arms.
  // Each is a rigid merged mesh with its origin AT THE SHOULDER, swung by
  // rotation.z alone. An elbow was built and thrown away: at nineteen pixels a
  // forearm and an upper arm are one dark streak whatever angle sits between
  // them, and the joint only bought a second thing to get wrong.
  const arms = [];
  for (const side of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(0.26 * side, 0.84, 0.10);
    a.rotation.order = 'ZXY';
    grp.add(a);

    const S = new Carve(0.024);           // the sleeve
    const B = new Carve(0.020);           // the bone
    const ar = new THREE.Object3D();
    shaft(S, ar, 0.145, 0.062, 0.40, 0.26, 0.48, 7);
    // a cuff, so the sleeve ENDS rather than tapering into the wrist
    const cf = node(ar, 0, 0.36, 0);
    bead(S, cf, 0, 0.085, 0.58, 0.55, 1.25, 1.0);
    // the wrist is BROKEN FORWARD, and by a lot. Built straight, the claws
    // pointed wherever the arm did — out sideways at full spread, which read
    // as a shrug. Bent, the same swing that brings the arms down turns the
    // hands to point at the card, and the grip is in the wrist rather than in
    // a keyframe.
    const wr = node(ar, 0, 0.40, 0.01);
    wr.rotation.order = 'ZXY';
    wr.rotation.z = -0.72 * side;
    clawInto(B, wr, side);

    const bone = new THREE.MeshStandardMaterial({
      // mid ivory, not white: the last pale thing on this table came out as
      // the brightest object in frame now that the key is a spot confined to
      // the board, and the vertex colours take most of this darker again
      color: 0xa89372, roughness: 0.88, metalness: 0, vertexColors: true,
      // a whisper, and COLD. Four times this is where shardfire's teeth went
      // wrong — a flat saturated lozenge no light can model.
      emissive: 0x33246b, emissiveIntensity: 0.30,
    });
    a.add(S.outline(EDGE), S.build(cloth), B.outline(0x0a0616), B.build(bone));
    arms.push(a);
  }

  return { grp, hollow, eyes, rags, arms, cloth };
}

/* ---------------------------------------------------------------- the beat */

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
     unrolled toward the player, has a direction in it on any single frame. */
  const tide = decal(tideTex(), 2.9, 1);
  tide.position.y = STONE;
  tide.renderOrder = 1;
  // and it is the peephole: on screen from the first frame, so the wraith
  // knows where the lens is long before it has to face it
  tide.onBeforeRender = peep;

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
      // bar and the flow had no length in it.
      off: (i * 0.014) + Math.random() * 0.025,
    });
    g.add(m);
  }

  /* --- the arriving sheet, anchored at the far edge and grown toward the
     player. It only lives until the wipe is done; the pool takes over. */
  const shroud = decal(shroudTex(), W, H);
  shroud.position.y = face;
  shroud.renderOrder = 3;

  /* --- the pool: the torn mass that is actually lying on the card. NEVER
     SCALED, which is the whole reason it is a separate object — a ragged
     outline on a quad that grows is a ragged outline that stretches, and what
     that looks like is a texture being pulled rather than a shadow spreading. */
  const pool = decal(poolTex(), POOL, POOL);
  pool.position.y = face + 0.002;
  pool.renderOrder = 4;

  /* --- the seam. Wider than the card so it runs off both sides: cut to the
     card's width it stopped dead at the edges and read as a lid closing on a
     box rather than as a front of shadow washing over one. */
  const seam = decal(seamTex(), W * 1.26, 0.40, { blending: THREE.AdditiveBlending, color: SEAM });
  seam.renderOrder = 5;                            // its height is set per frame

  /* --- and the outline the whole thing leaves behind. */
  const rim = decal(rimTex(), CARD_W * 1.17, CARD_H * 1.17,
    { blending: THREE.AdditiveBlending, color: RIM });
  rim.position.y = face + 0.008;
  rim.renderOrder = 6;

  // These all lie within a centimetre of each other, so the depth sort put
  // them in whatever order the camera happened to give, and on some frames the
  // shroud was painted last and swallowed its own seam. The stack is stated.
  g.add(tide, shroud, pool, seam, rim);

  /* --- the figure. */
  const wr = wraith();
  wr.grp.position.set(0, face - 0.03, 0);
  // Laid back thirty-two degrees. At forty-four its plane would be exactly
  // square to a lens forty-six degrees up, which is what raise.js's hand
  // wants; a whole FIGURE at that angle is lying down. This much keeps the
  // face within fifteen degrees of the lens — a cosine of 0.97, so nothing is
  // lost — while the body still stands, and it buys most of the projection: an
  // axis leaning away from the camera gains screen height faster than a
  // vertical one does, so 1.3 units of wraith draws about 60 pixels tall
  // instead of the 34 that straight-up height would cost.
  wr.grp.rotation.x = -0.56;
  g.add(wr.grp);

  // The lamp rides its OWN pivot, not the figure. Parented to the wraith it
  // was dragged down to the card face when the figure lay down at the end, and
  // a point light at a card's own height blows the whole square to white.
  const lampPivot = new THREE.Group();
  lampPivot.position.set(0, face, 0);
  g.add(lampPivot);
  const fill = new THREE.PointLight(0xc3b0ff, 0, 2.5, 2);
  fill.position.set(-0.42, 1.05, 0.95);
  lampPivot.add(fill);

  // The arena's key is a single spot at a fixed corner of the world, so from
  // one seat it falls on the wraith's face and from the other it is behind it
  // and every surface the player can see is a shadow side. This fill rides the
  // pivot, which faces the lens, and is therefore always over the viewer's
  // shoulder — scaled by how much of that job the key is already doing, so the
  // near seat barely pays for it. The sun is found in the scene rather than
  // written down here, because a number copied out of arena.js goes stale in
  // silence.
  const sun = kit.scene.children.find((o) => o.isSpotLight);
  const KEY = sun ? sun.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
  const toCam = new THREE.Vector3();

  /* --- the press. The one thing that says this is happening TO somebody.
     A hard drop on the frame the hands land, a short shake, and then it stays
     down — the fighter is not recovering, it is being held.

     THE FLAT LAYERS DO NOT RIDE IT, and that cost an afternoon. They did at
     first, on the obvious reasoning that a pool which did not follow the card
     would tear free of it — which is true of any large movement and is worth
     nothing here, because the press is five hundredths and the pool overhangs
     the card by fifteen. What it bought instead was this: the card is pressed
     DOWN, the pool followed it down, and the clearance the pool needs over the
     card face shrank from 0.055 to about 0.014. That is inside the depth
     test's reach at this distance — measured, a headless buffer here resolves
     about two hundredths at the board — so the pool drew on the stone AROUND
     the card and not on the card itself. The square went dark except the one
     surface that had to go dark, which is a shot that looks exactly like an
     effect that never fired, and it was blamed on the pool's texture, its
     alpha, its size and its render order before it was measured.
     Left where they are, the clearance can only GROW while the card is held
     down, and it is never smaller than the value that has always worked.
     Whether it presses at all is also decided once: both cards that use this
     motif DEPLOY the fighter, so the piece is often still running its own
     arrival tween when this fires and must not be touched. */
  const piece = kit.piece(at);
  const pressing = !!(piece?.restingPosition && !piece.animating);
  const press = (t) => {
    if (!pressing || t < GRIP) return 0;
    const s = t - GRIP;
    const down = -0.052 * Math.min(1, s / 0.035);
    const shake = 0.020 * Math.exp(-s * 11) * Math.cos(s * 46);
    // let it up a little as the wraith lies down, so the last frame is a card
    // at rest rather than a card stuck in the floor
    const up = Math.min(1, Math.max(0, (t - SOAK) / (1 - SOAK)));
    return (down + shake) * (1 - up);
  };

  kit.hold(g, SPAN, (t) => {
    const dy = press(t);
    // How far through LYING DOWN the whole motif is. Declared here rather than
    // beside the figure it belongs to, because the pool and the outline read
    // it too and a `const` is in its temporal dead zone until its own line —
    // written below them this threw on the first frame of the soak.
    //
    // MOSTLY LINEAR. On a cubic ease-in the wraith stood at five sixths of its
    // height until the last tenth of a second and then dropped, so the last
    // frame before it was gone still had a figure standing on the card — which
    // reads as the effect being switched off rather than as something lying
    // down. raise.js's mouth had to come off the same curve for the same
    // reason.
    const down = Math.min(1, Math.max(0, (t - SOAK) / (1 - SOAK)));
    // The FIGURE is flat before the POOL thins, and that order is the whole
    // ending. Faded together, the last third of a second was a hard dark
    // silhouette lying across a card that was already half lit again — a
    // smudge, and the one frame of this motif that looked like a fault. The
    // wraith goes down into black, and only then does the black go.
    const sink = Math.min(1, (down * down * 0.42 + down * 0.58) / 0.70);

    /* how far across the card the wipe has got — the arrival follows it */
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
      const k2 = (t - f.off) / 0.18;
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
      f.m.material.opacity = 0.95 * Math.min(1, k2 * 4)
        * Math.max(0, 1 - Math.max(0, (t - WIPE0) / 0.14));
      const tip = z + len * 0.82;
      if (tip > front) front = tip;
    }

    /* one front, for the whole arrival */
    // THE SAME LINE crosses the stone and then the card. Before it there was a
    // bright bar travelling over the flagstone, then nothing, then a different
    // bright bar travelling over the card, and a player saw two events.
    //
    // The wipe only gets a say ONCE IT HAS STARTED. Left in unconditionally it
    // evaluates to the card's own far edge at k = 0, which pinned the front
    // there from the first frame: the sheet was full length before anything
    // had moved, and three passes of shots showed a dark rectangle parked
    // above the card that never advanced.
    const spill = Math.min(1, Math.max(0, (t - WIPE1) / (SPILL - WIPE1)));
    const edge = Math.max(front + 0.14, u > 0 ? farZ + H * k + 0.05 + spill * 0.10 : -99);

    /* the stone */
    // The tide stops a hair SHORT of the light, so the heads of the tongues
    // stick out past it onto lit stone and the front has fingers on it. Once
    // the wipe is up on the card the BACK comes forward too, faster than the
    // front, so the sheet gathers onto the square rather than leaving a black
    // runway lying across two flagstones for the rest of the motif.
    const back = farZ - 1.5 + 1.25 * easeIn(Math.min(1, Math.max(0, (t - WIPE0) / 0.28)));
    const lead = Math.max(edge - 0.16, back + 0.4);
    const gone = easeIn(Math.min(1, Math.max(0, (t - HOLD) / (1 - HOLD))));
    tide.scale.set(1, lead - back, 1);
    tide.position.z = (lead + back) / 2;
    tide.material.opacity = 0.95 * Math.min(1, t / 0.05) * (1 - gone);

    /* the sheet, and the pool it hands over to */
    // The sheet grows from the far edge: the anchored edge stays put and the
    // leading one travels, which is a different picture from a slab fading up
    // in place. It is then CROSS-FADED into the pool over a tenth of a second
    // — both are near-black, so what a player sees is not a fade at all, it is
    // a straight edge becoming a torn one.
    const hand = Math.min(1, Math.max(0, (t - WIPE1) / 0.07));
    shroud.scale.set(1, Math.max(0.001, k), 1);
    shroud.position.z = farZ + (H * k) / 2;
    shroud.position.y = face;
    shroud.material.opacity = Math.min(1, u * 6) * (1 - hand);
    // The pool NEVER draws back the way it came — the shadow has become the
    // fighter, and retreating would undo the whole reading. It thins in place,
    // and it is the last dark thing to go.
    pool.position.y = face + 0.002;
    pool.material.opacity = hand * (1 - Math.min(1, Math.max(0, (down - 0.55) / 0.45)));

    /* the seam — the light, all the way from the stone to the near lip */
    // It CLIMBS. Between a little before the card's far edge and a little
    // after, the line lifts from the flagstone to the card face, which is the
    // one moment in the arrival where anything leaves the ground. Handled the
    // obvious way — hold it on the stone until it is under the card and then
    // snap it up — it vanished for two frames behind the card's own edge,
    // because a light at stone height inside the card's footprint is simply
    // occluded by the card. So it starts rising half a unit early.
    const climb = Math.min(1, Math.max(0, (edge - (farZ - 0.50)) / 0.52));
    seam.position.set(0, STONE + 0.012 + climb * (face + 0.004 - STONE - 0.012), edge);
    // and it NARROWS as it comes up: a front as wide as the tide gathers to
    // the width of the card. Brightest at the two lips and dim while it is
    // just crossing, so what a player sees is two beats and a sweep between.
    const flare = Math.max(climb * (1 - climb) * 4, spill * (1 - spill) * 4);
    seam.material.opacity = (0.45 + 0.8 * flare)
      * Math.min(1, t / 0.04) * (1 - easeIn(spill));
    seam.scale.set(1.20 - 0.20 * climb, 1 + 0.45 * flare, 1);

    /* the outline */
    // It comes up as the wraith lies down, so the light is not lost, it is put
    // away into the shape of the card. Then it goes out slowly — last thing on
    // screen, and the only part still there when the card is clean. This is
    // where COVERED is finally said: a card-shaped cold line and nothing
    // inside it.
    const on = Math.min(1, Math.max(0, (t - HOLD) / 0.16));
    rim.position.y = face + 0.008;
    rim.material.opacity = 0.92 * easeOut(on)
      * (1 - Math.min(1, Math.max(0, (down - 0.45) / 0.55)) ** 1.3);
    rim.scale.setScalar(1.08 - 0.08 * easeOut(on));

    /* ---------------------------------------------------------- the figure */
    // Turned to face the lens every frame. Without this the wraith is a hood
    // seen edge-on from one of the two seats, which is what killed raise.js's
    // first hand and would kill this too.
    const yaw = CAM ? Math.atan2(CAM.position.x - p.x, CAM.position.z - p.z) : 0;
    lampPivot.rotation.y = yaw;
    lampPivot.position.y = face;

    // IT STANDS UP OUT OF THE POOL. The rise is a scale on the figure's own
    // axis, from a sliver lying in the dark to full height, and that one
    // choice is most of the motif: a shadow on a card BECOMING a thing is a
    // different event from a thing being faded in over a card. It spreads as
    // it lies down again at the end, for the same reason.
    const up = Math.min(1, Math.max(0, (t - RISE0) / (RISE1 - RISE0)));
    // overshoot a little at the top — it is thrown up, not extruded
    const tall = (0.03 + 0.97 * easeOut(up)) * (1 + 0.06 * Math.sin(Math.PI * up) * up)
      * (1 - sink * 0.985);
    const wide = (1.34 - 0.34 * easeOut(up)) * (1 + 0.55 * sink);
    wr.grp.visible = t > RISE0 - 0.01 && sink < 0.999;
    wr.grp.position.y = face - 0.03 + dy;
    wr.grp.rotation.y = yaw;
    // a slow lean over its victim while it holds, and a shiver in it
    const bear = Math.min(1, Math.max(0, (t - GRIP) / (HOLD - GRIP)));
    wr.grp.rotation.x = -0.56 - 0.10 * bear
      + (t > GRIP && t < SOAK ? 0.008 * Math.sin((t - GRIP) * 130) : 0);
    wr.grp.scale.set(wide, tall, wide);

    // the hollow and the eyes. The eyes are LAST TO ARRIVE and last to leave:
    // they kindle only once the hood is clear of the pool, and they are still
    // burning after the body has lain down, which is the frame that says the
    // thing is not gone, it is in there now.
    const lit = Math.min(1, Math.max(0, (t - (RISE0 + 0.10)) / 0.16));
    wr.hollow.material.opacity = lit * (1 - sink);
    // a hard flare on the grip, and a slow pulse while it bears down
    const hit = Math.max(0, 1 - Math.abs(t - GRIP) / 0.10);
    // A THIRD OF THIS AND THEY ARE NOT THERE. Two lit points in a hood is the
    // ghastliest thing in the motif and the only detail a player will read
    // from across the table; tuned by eye against the shot rather than by what
    // looked reasonable in the file.
    wr.eyes.material.opacity = lit * (1.0 + 0.9 * hit ** 2
      + 0.12 * Math.sin(t * 19)) * Math.max(0, 1 - sink ** 2);
    wr.eyes.scale.setScalar(1 + 0.45 * hit ** 2);

    // the rags, swaying — and trailing BACKWARD as the figure rises, so it
    // looks to have come from somewhere rather than to have grown here
    for (const m of wr.rags) {
      const d = m.userData;
      m.material.opacity = 0.95 * Math.min(1, up * 2.2) * (1 - sink);
      m.rotation.z = Math.sin(t * 4.1 * d.sw + d.ph) * 0.16 - d.x * 0.22
        - (1 - easeOut(up)) * 0.5;
      m.scale.set(1, 0.55 + 0.45 * easeOut(up), 1);
    }

    // THE ARMS. Folded in against the body while it is still a sliver, thrown
    // wide as it stands, then driven down and in onto the card — and the wrist
    // is bent far enough forward (see `wraith`) that the same swing turns the
    // claws to point straight down at the fighter.
    const swing = t < RISE1
      ? 0.30 + 1.30 * easeOut(up)                        // out and up
      : 1.60 + 0.76 * easeIn(Math.min(1, (t - RISE1) / (GRIP - RISE1)));  // down and in
    const clutch = t > GRIP
      ? 0.10 * Math.min(1, (t - GRIP) / 0.10) + 0.022 * Math.exp(-(t - GRIP) * 8)
        * Math.cos((t - GRIP) * 38)
      : 0;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      wr.arms[i].rotation.z = -(swing + clutch) * side;
      // and a little forward as they come down, so the hands close over the
      // card's near edge instead of sweeping past its sides
      wr.arms[i].rotation.x = 0.10 + 0.30 * Math.min(1, Math.max(0, (t - RISE1) / 0.14));
    }

    // the fill, which is really only on at the far seat
    if (CAM) {
      toCam.copy(CAM.position).sub(p).normalize();
      fill.intensity = 2.0 * (1 - Math.max(0, toCam.dot(KEY)) ** 1.5)
        * Math.min(1, up * 2) * (1 - sink);
    }
  });

  /* --- one cold breath, low and on the far side, for the approach. Hung over
     the middle it lit the card face and undid the whole motif; set low, small
     and behind, it only catches the stone the flow is crossing. */
  const lamp = new THREE.PointLight(0x7e52d8, 0, 2.4, 2);
  lamp.position.set(p.x, STONE + 0.34, p.z - H * 0.62);
  kit.hold(lamp, SPAN * 0.42, (t) => {
    lamp.intensity = 4.2 * Math.min(1, t * 4) * (1 - t) ** 1.6;
  });

  /* --- the blow. */
  // Saturated and WEAK, and both are hard-won elsewhere: a pale lilac at any
  // useful power washes the square grey through the filmic curve, and anything
  // strong this close to a card blows its face to white and takes the pool
  // with it. The punch is the ring and the press; the light only says what
  // colour it was. And the ring's SIZE is a narrow window — kit.ring draws at
  // y = 0.1, beneath a card whose face is at 0.21, so under about 1.8 it never
  // escapes the card's own half-width and nothing is drawn at all, while over
  // about 3 a half-unit band of lavender is still at half alpha when it clears
  // the edge and parks a slab round the square.
  kit.after(SPAN * GRIP, () => {
    kit.light(p.clone().setY(face + 1.05), 0x8a58f0, { power: 2.8, seconds: 0.45, reach: 3.0 });
    kit.ring(p.clone().setY(face), 0x8a58f0, { size: 2.0, seconds: 0.42 });
  });

  /* --- the card takes it. */
  // Forcing a moving piece to its resting position for the press teleported it
  // across the board mid-flight, so `pressing` above is the gate and the
  // arrival is animation enough when it is shut.
  if (pressing) {
    const home = piece.restingPosition();
    kit.hold(new THREE.Object3D(), SPAN, (t) => {
      const pc = kit.piece(at);
      if (!pc || t < GRIP) return;
      // set every tick, not once: the board's own move tween clears this flag
      // when it ends and the card was snapping home mid-press
      pc.animating = true;
      pc.group.position.copy(home);
      pc.group.position.y += press(t);
    }, () => {
      const pc = kit.piece(at);
      if (pc) { pc.group.position.copy(home); pc.animating = false; }
    });
  }
}
