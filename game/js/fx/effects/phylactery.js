// PHYLACTERY — a soul breaks for the graveyard and something hanging over the
// stone takes it instead.
//
// Shared by 1 card: R073. "When a Hero you control is destroyed, put it into
// this square instead of into your Graveyard and destroy this Construct."
//
// So the motif has a SHAPE, and the shape is a departure that is caught. The
// light goes out of the card, a pale soul tears free and runs for the discard
// pile — the place every dead card on this table goes — and one square out it
// flies over a black iron LANTERN that has been hanging there, dark and
// slightly crooked, since the first frame. The lantern's roof hinges up. The
// flight stops dead in the air, is hauled BACK and DOWN through the opening,
// the roof drops, and the thing is alight: a bone-pale flame behind four dirty
// panes, and four spokes of violet light thrown out across the flagstones with
// the lantern's own black shadow sitting in the middle of them. Then it
// carries its prize home and lowers itself onto the square.
//
// It was an urn before, and the urn was wrong for a reason worth writing down:
// a vessel sits, and a thing that sits is furniture. A lantern HANGS — off
// nothing, from a chain that fades out into the air above it — so it is being
// HELD, and the holder is not in the frame. It also has panes, which is the
// whole reason it beats the urn at this camera: the urn could only be a
// silhouette, but a lantern CASTS LIGHT IN SHAPES, and shapes thrown flat
// across the ground are the one thing this fixed elevation is generous with.
// Height costs about 26 pixels a world unit here; width costs nothing.
//
// The catch is the whole point, so it is built to survive a frozen frame: the
// soul's wake is laid along the path it actually flew, which means the moment
// it is taken leaves a hard ELBOW hanging in the air — a bright line running
// away from the card and then bent right back into a black box. In motion it
// is the arrest that reads; in a still it is the elbow.
//
// Creepy rather than merely lit, which is the brief, comes from four things and
// none of them is gore:
//   - it hangs from a chain that goes up and stops. Nothing is holding it.
//   - it is not plumb. It rides about four degrees off vertical and sways, on
//     a table where nothing else moves at all.
//   - the light is grave-violet, not fire-orange. The arena is full of warm
//     braziers and this must never be mistaken for one of them.
//   - its spokes of light turn slowly on the ground while the lantern itself
//     stays put, and the flame guts and recovers like something alive and
//     unhappy in there.
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
//     only thing here that sinks is the lantern, at the very end.
//
// It is death-adjacent and it is NOT a death: the soul is preserved. So the
// soul is the one BONE-PALE thing in a violet motif — it stays whole, whole
// the entire way in, and it is still pale once it is the flame. What is left
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
 * The iron: NEAR-BLACK, and it has to stay near-black.
 *
 * A previous pass on a different motif ran its ironwork at metalness 0.8, found
 * it had nothing in this scene to reflect, went black, and had to be rescued
 * with a big emissive — at which point it was a pale lilac frame and not iron
 * at all. So the metal here is barely metal, it is LIT rather than glowing, and
 * every bright pixel in the lantern lives on the panes where it can be turned
 * up and down. The flagstones are the brightest thing on this board, so a black
 * frame standing on them is a silhouette for free.
 */
const ironMap = () => tex('lanternIron', () => {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#0a0713';
  g.fillRect(0, 0, W, W);
  // pitting, very low contrast: a flat fill at this size reads as plastic
  g.globalAlpha = 0.5;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W, y = Math.random() * W;
    g.fillStyle = Math.random() < 0.4 ? '#1d1730' : '#030106';
    g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random());
  }
  g.globalAlpha = 1;
  return c;
});

/**
 * The glass, as a colour map: dirty and dark, so an UNLIT lantern is a black
 * box and not a pale one.
 *
 * Same lesson the urn taught and it survives the rebuild intact — painting the
 * light onto `map` leaves the object glowing at every moment including the ones
 * before anything has happened, and the instant the soul goes in cannot be told
 * apart from the instant before it.
 */
const paneMap = () => tex('lanternPane', () => {
  const W = 128, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0818';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 3 ? '#16102a' : '#040208';
    g.fillRect(Math.random() * W, 0, 2 + Math.random() * 7, H);
  }
  g.globalAlpha = 1;
  return c;
});

/**
 * And the SAME pane as an emissive map, which is where all of its light is.
 *
 * Not a flat rectangle of violet: an even panel comes out of ACES as a
 * saturated lozenge with no shape in it whatever the light does. So the glass
 * is brightest at the middle where the flame is, the lead cames that cross it
 * are BLACK, and the soot up the inside of the glass eats the top corners. The
 * cames are also what puts the dark bars in the light on the floor, so they
 * have to be in both places or the shadow pattern has no cause.
 */
const paneGlow = () => tex('lanternPaneGlow', () => {
  const W = 128, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // the flame behind the glass, low and central
  const lit = g.createRadialGradient(W * 0.5, H * 0.56, 4, W * 0.5, H * 0.56, H * 0.52);
  lit.addColorStop(0.00, '#e8d6ff');
  lit.addColorStop(0.22, '#9a5cf4');
  lit.addColorStop(0.60, '#41199c');
  lit.addColorStop(1.00, '#000');
  g.fillStyle = lit;
  g.fillRect(0, 0, W, H);
  // soot, drawn as the absence of light rather than as grey paint
  const soot = g.createLinearGradient(0, 0, 0, H * 0.42);
  soot.addColorStop(0.00, 'rgba(0,0,0,0.95)');
  soot.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = soot;
  g.fillRect(0, 0, W, H * 0.42);
  // the cames: one up, one across, hard black, a couple of pixels of world each
  g.fillStyle = '#000';
  g.fillRect(W * 0.5 - 3, 0, 6, H);
  g.fillRect(0, H * 0.5 - 3, W, 6);
  // a crack off the cross, because a lantern in this good repair is a prop
  g.strokeStyle = '#000'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W * 0.5, H * 0.5);
  g.lineTo(W * 0.78, H * 0.63);
  g.lineTo(W * 0.72, H * 0.84);
  g.stroke();
  return c;
});

/**
 * THE SPOKES: what the lantern throws across the flagstones.
 *
 * This is the single thing a lantern can do that the urn could not, and it is
 * worth more here than the lantern's own body. The camera's elevation is fixed,
 * so anything standing up is foreshortened and a tall object loses its shape —
 * but the ground plane is seen almost square on, so a pattern drawn ON the
 * stone is never compressed. The urn's binding circle used to occupy this slot;
 * the spokes replace it outright.
 *
 * It takes TWO layers, and the second one is the one that made it work. An
 * additive pool with the bars cut out of it was a soft violet wash with some
 * scratches in it: these flagstones are already the brightest thing on the
 * board, so the difference between "lit wedge" and "missing light" was a few
 * per cent of a tan stone. The bars only become bars once something actually
 * DARKENS the floor under them — so the shadow is painted, in its own
 * normal-blended near-black layer, and the additive light is painted only where
 * the shadow is not. They never overlap, which is also why two ground overlays
 * on the same square do not sum past 1.0 and go white.
 */

// One description of the post and came shadows, used by both layers so the
// light and the dark stay registered to each other. A shadow DIVERGES from its
// caster, so every bar is a wedge and not a stripe — parallel-sided ones read
// as spokes painted on a wheel, which is a rune and not a shadow.
//
// WIDE. The first cut ran the posts at three degrees, which is honest geometry
// and useless picture: only a fortieth of the circle went dark. At twelve
// degrees a side, two fifths of the pool is black and what is left are four
// separate BLADES of light.
const BARS = [];
for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + i * Math.PI / 2;   // the four corner posts
  BARS.push([a, 0.26, 0.38, 0.45], [a, 0.175, 0.275, 1]);
  const b = i * Math.PI / 2;                 // the came up the middle of a pane
  BARS.push([b, 0.07, 0.10, 0.30], [b, 0.036, 0.062, 0.62]);
}
// one post is bent. Four identical spokes is a snowflake; a snowflake with a
// fault in it is a made thing that has been somewhere.
BARS.push([Math.PI * 1.25 + 0.16, 0.10, 0.20, 0.7]);

function wedges(g, paint) {
  for (const [a, w0, w1, alpha] of BARS) {
    g.globalAlpha = alpha * paint;
    g.beginPath();
    g.moveTo(Math.cos(a - w0) * 28, Math.sin(a - w0) * 28);
    g.lineTo(Math.cos(a - w1) * 252, Math.sin(a - w1) * 252);
    g.lineTo(Math.cos(a + w1) * 252, Math.sin(a + w1) * 252);
    g.lineTo(Math.cos(a + w0) * 28, Math.sin(a + w0) * 28);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Layer one: the light, with the bars taken out of it. */
const spokeMap = () => tex('lanternSpokes', () => {
  const W = 512, C = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.translate(C, C);

  // The middle is EMPTY. A lantern hangs over its own shadow, and the dark disc
  // under the light is the whole cue that the source is up in the air rather
  // than painted on the floor.
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, 248);
  // Deep violet, not pale lilac. Additive light this bright on flagstones that
  // are already the brightest thing on the board took the red and blue channels
  // past 1.0 together and the near field came out a white-hot puddle with no
  // colour in it — a brazier, which is the one thing this must never be. Held
  // down in green it clips toward violet instead of toward white.
  // It also has to STOP somewhere. A long smooth falloff let every blade melt
  // away into the stone and the whole thing went back to being a glow with
  // streaks in it; a blade is a shape, and a shape needs an end. So the light
  // holds most of its strength out to two thirds and then quits over a tenth
  // of the radius, which gives each wedge a hard far edge to be a shape with.
  pool.addColorStop(0.00, 'rgba(140,70,240,0)');
  pool.addColorStop(0.15, 'rgba(140,70,240,0)');
  pool.addColorStop(0.19, 'rgba(172,118,255,1)');
  pool.addColorStop(0.44, 'rgba(132,70,244,0.86)');
  pool.addColorStop(0.62, 'rgba(104,46,224,0.60)');
  pool.addColorStop(0.72, 'rgba(78,30,190,0.16)');
  pool.addColorStop(0.80, 'rgba(52,18,140,0)');
  g.fillStyle = pool;
  g.fillRect(-C, -C, W, W);

  g.globalCompositeOperation = 'destination-out';
  wedges(g, 1);
  g.globalCompositeOperation = 'source-over';
  return c;
});

/** Layer two: the shadow, which is what makes the light into shapes. */
const shadeMap = () => tex('lanternShade', () => {
  const W = 512, C = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.translate(C, C);

  // the lantern's own body, sitting directly under it
  const under = g.createRadialGradient(0, 0, 0, 0, 0, 82);
  under.addColorStop(0.00, 'rgba(6,3,14,0.92)');
  under.addColorStop(0.62, 'rgba(6,3,14,0.80)');
  under.addColorStop(1.00, 'rgba(8,4,18,0)');
  g.fillStyle = under;
  g.fillRect(-C, -C, W, W);

  // and the bars, fading out with distance the way a penumbra does
  g.fillStyle = '#06030e';
  wedges(g, 0.9);
  // the shadow ends where the light ends, or the bars run on across bare stone
  // past the edge of the pool and read as cracks in the flagstones
  const off = g.createRadialGradient(0, 0, 40, 0, 0, 250);
  off.addColorStop(0.00, 'rgba(0,0,0,1)');
  off.addColorStop(0.52, 'rgba(0,0,0,0.85)');
  off.addColorStop(0.72, 'rgba(0,0,0,0.16)');
  off.addColorStop(0.80, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = off;
  g.fillRect(-C, -C, W, W);
  return c;
});

/**
 * The chain, hanging UP out of the lantern and fading into nothing.
 *
 * On a Sprite, because the links only have to read from one direction and this
 * camera never moves — and because at three pixels wide a chain modelled in the
 * round is eight hundred triangles of nothing. It fades out at the top rather
 * than reaching anything: whatever is holding the lantern is not in the frame,
 * and that is the point of the whole object.
 */
const chainMap = () => tex('lanternChain', () => {
  const W = 64, H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  // FIVE links over the whole strip, overlapping, not nine with air between
  // them. Nine put a link every four screen pixels with nothing joining them,
  // and a chain drawn as a dotted line is not drawn at all.
  for (let i = 0; i < 5; i++) {
    const y = H - 26 - i * 48;
    const wide = i % 2 === 0;
    g.lineWidth = 11;
    g.strokeStyle = '#07040d';
    g.beginPath();
    g.ellipse(W / 2, y, wide ? 20 : 8, 30, 0, 0, Math.PI * 2);
    g.stroke();
    // one edge catches whatever light there is, or it is a black worm
    g.lineWidth = 3.5;
    g.strokeStyle = 'rgba(150,128,186,0.6)';
    g.beginPath();
    g.ellipse(W / 2 - 2.5, y - 2.5, wide ? 20 : 8, 30, 0, Math.PI * 0.8, Math.PI * 1.55);
    g.stroke();
  }
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0.00, 'rgba(0,0,0,0)');
  fade.addColorStop(0.24, 'rgba(0,0,0,0.35)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  fade.addColorStop(0.75, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  return c;
});

/**
 * The flame, which is the soul.
 *
 * Bone-pale in the middle and grave-violet at the edge, the same two colours
 * the soul wore on the way in — it is preserved, so it must still be the pale
 * thing once it is burning. Seen THROUGH the glass rather than in the open, so
 * it never has to be bright: the panes carry the light and this only has to be
 * the shape behind them.
 */
const flameMap = () => tex('lanternFlame', () => {
  const W = 128, H = 192;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const body = (cx, cy, r, sy, a) => {
    g.save();
    g.translate(cx, cy);
    g.scale(1, sy);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0.00, `rgba(255,250,232,${a})`);
    grd.addColorStop(0.26, `rgba(226,198,255,${a * 0.8})`);
    grd.addColorStop(0.58, `rgba(150,96,244,${a * 0.42})`);
    grd.addColorStop(1.00, 'rgba(96,44,196,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  body(64, 124, 46, 1.35, 1);      // the seat of it
  body(64, 68, 22, 2.1, 0.85);     // and the tongue
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

// The lantern, in its own units, foot of the base plate at y = 0. Scaled by
// LANT below. The proportions are deliberately WRONG: roof tip to foot it is
// nearly twice its own width, where a real hand lantern is nearer four to
// three, and the glass is a tall narrow slot rather than a square window. It
// is a small amount of wrong and it is most of why the thing is unpleasant to
// look at before anything has even happened to it.
const BODY = 0.72;      // the base plate, across
// An upright, square. At LANT this is about four and a half pixels on screen,
// which is the floor for a thing that has to read as a hard edge — the black
// frame is the entire silhouette and there is nothing else holding it up.
const POST = 0.090;
const RAIL_LO = 0.11;   // the bottom rail, and where the glass starts
const RAIL_HI = 0.96;   // the top rail, and where it stops
const OPENING = 0.99;   // the lip the roof hinges off, and where the soul goes
const RING = 1.30;      // where the chain is made fast
// The glass is set INSIDE the uprights, not flush with them. Flush, the near
// pane covered the two posts on its own face and the whole lantern came out as
// one lit rectangle standing on the stone — no frame, no corners, no lantern.
// Inset, the posts stand proud of the light on both sides and the silhouette
// has something black in it at thirty pixels.
const GLASS = BODY / 2 - POST - 0.012;

/** Every black iron part, on one material so one opacity fades the lot. */
function frameMesh(mat) {
  const g = new THREE.Group();
  const box = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  box(BODY, 0.085, BODY, 0, 0.0425, 0);                      // the base plate
  box(BODY - 0.05, 0.055, BODY - 0.05, 0, RAIL_LO + 0.02, 0); // bottom rail
  box(BODY - 0.05, 0.060, BODY - 0.05, 0, RAIL_HI, 0);        // top rail
  const o = BODY / 2 - POST / 2;
  for (const [x, z] of [[-o, -o], [o, -o], [o, o], [-o, o]]) {
    box(POST, RAIL_HI - RAIL_LO, POST, x, (RAIL_HI + RAIL_LO) / 2, z);
  }
  // the bail the chain hooks through. Small, but it is the joint between the
  // lantern and the nothing holding it, so it has to be a real object.
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.032, 6, 14), mat);
  bail.position.y = RING;
  bail.castShadow = true;
  g.add(bail);
  box(0.05, RING - OPENING - 0.06, 0.05, 0, (RING + OPENING) / 2 - 0.02, 0);
  return g;
}

/** The roof: a low pyramid, hinged, which is how a lantern is got into. */
function roofMesh(mat) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.50, 0.30, 4), mat);
  m.rotation.y = Math.PI / 4;   // faces square to the box, not corner-on
  m.position.y = 0.15;
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
const OPEN = 0.31;     // the roof hinges up; cold light leaks out of the box
const CATCH = 0.44;    // it is stopped in the air — THE MOMENT
const IN = 0.555;      // drawn down through the opening
const SLAM = 0.578;    // the roof drops and the lantern lights
const CARRY = 0.70;    // it lifts off its spot and drifts home
const SET = 0.90;      // it lowers itself onto the square
const SEG = 34;        // wake segments
const TAIL = 0.15;     // how far back in time the wake reaches

// Where a flat thing has to sit to be drawn ON a card rather than only on the
// stone around it: kit.at answers about 0.2 for a card whose face is at 0.21,
// and under about +0.05 the depth test fails on equal and the card itself is
// the one place nothing appears.
const flatY = (p) => Math.min(p.y, 0.225) + 0.055;
const STONE = 0.082;   // the flagstone face, which the light lands on

// How big the lantern is, and how high it hangs.
//
// The urn this replaced ran at 1.32 for a hard-won reason: at 1 it was a
// thirty-pixel smudge and the catch read as "a violet glow happening
// somewhere". 1.22 puts the lantern about 36px across and 40px of glass tall,
// with the roof and the chain above that — but the body was never going to be
// where the presence came from. It is bought on the FLOOR, where this camera
// gives away width for nothing, and the lantern's light reaches half a board.
const LANT = 1.22;
// and it hangs CLEAR of the stone. At 0.34 the base was eleven pixels off the
// flagstone, which at this elevation is not a gap — it is a thing standing on
// the floor with a bad shadow. 0.52 is a hand's breadth of daylight under it
// and that gap is the whole reason the object is unpleasant.
const HANG = 0.48;
const MOUTH = HANG + OPENING * LANT;        // the opening, above the stone
const SPOKES = 5.0;                         // how far the light reaches, across

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

  // The lantern hangs about one square out. Fixed at 2.3 it sat over the grass
  // beyond the board when the card was already in the back row, so it is
  // capped by how far there is to go — it must always be short of the pile,
  // since being short of the pile is the point.
  const stand = Math.max(1.55, Math.min(2.3, reach * 0.42));
  const J = new THREE.Vector3(p.x + dir.x * stand, STONE, p.z + dir.z * stand);

  const S = new THREE.Vector3(p.x, flatY(p) + 0.07, p.z);   // where it leaves
  const M = new THREE.Vector3(J.x, J.y + MOUTH, J.z);       // the opening
  // The arc has to CLEAR THE LANTERN. At 1.82 — the height the urn was built
  // for — the soul passed through the roof on its way past, and the near half
  // of the wake, elbow included, was hidden behind a black box. A lantern that
  // hangs in the air is a much taller obstacle than a jar that sits on the
  // stone, so the flight goes over the top of it by about fifteen pixels.
  const PEAK = 2.95;
  // PAST the lantern, and above it. Being caught level with it is a landing;
  // being caught beyond it and hauled BACK is an interception, and the
  // difference is the whole card. OVER is used by the flight AND by the catch
  // point: split, they disagreed, and the soul teleported forward a quarter of
  // a unit on the exact frame it was supposed to stop dead.
  const OVER = 0.90;
  const P = new THREE.Vector3(J.x + dir.x * OVER, PEAK, J.z + dir.z * OVER);

  const g = new THREE.Group();

  /* ---- the lantern, hanging there from the first frame, unlit */

  const lantG = new THREE.Group();
  lantG.position.set(J.x, STONE + HANG, J.z);
  lantG.scale.setScalar(LANT);

  const iron = new THREE.MeshStandardMaterial({
    map: ironMap(), color: 0x1a1526,
    // low metal ON PURPOSE. There is nothing in this scene for polished iron
    // to reflect, so at high metalness it goes black, needs a big emissive to
    // exist at all, and stops being iron.
    roughness: 0.58, metalness: 0.18,
    transparent: true,
  });
  const frame = frameMesh(iron);
  lantG.add(frame);

  const roofPivot = new THREE.Group();
  roofPivot.position.y = OPENING;
  const roof = roofMesh(iron);
  roofPivot.add(roof);
  lantG.add(roofPivot);

  // The four panes. One material, mirrored on two of them, so the soot and the
  // crack do not repeat identically around the box — four matching faults read
  // as a pattern, and a pattern is decoration rather than damage.
  const paneMat = new THREE.MeshStandardMaterial({
    map: paneMap(),
    emissive: 0xffffff, emissiveMap: paneGlow(), emissiveIntensity: 0,
    roughness: 0.32, metalness: 0,
    transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide,
  });
  const paneGeo = new THREE.PlaneGeometry(BODY - 2 * POST - 0.02, RAIL_HI - RAIL_LO - 0.05);
  const panes = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(paneGeo, paneMat);
    const a = i * Math.PI / 2;
    m.position.set(Math.sin(a) * GLASS, (RAIL_HI + RAIL_LO) / 2, Math.cos(a) * GLASS);
    m.rotation.y = a;
    if (i % 2) m.scale.x = -1;
    m.renderOrder = 3;
    panes.push(m);
    lantG.add(m);
  }

  // The flame lives INSIDE, behind the glass, and is never seen in the open.
  // An additive sprite in clear air was the first try and it was a violet coin
  // floating over the lantern — everything ACES does to a bright additive blob
  // on a dark board, it did. Behind a pane at 0.82 opacity it is a shape with a
  // surface in front of it instead.
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameMap(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  flame.center.set(0.5, 0.18);
  flame.position.y = RAIL_LO + 0.18;
  flame.renderOrder = 2;
  lantG.add(flame);

  const inner = new THREE.PointLight(0x9a5cf4, 0, 3.6, 2);
  inner.position.y = 0.62;
  lantG.add(inner);

  const chainMat = new THREE.SpriteMaterial({
    map: chainMap(), transparent: true, opacity: 0, depthWrite: false,
  });
  const chain = new THREE.Sprite(chainMat);
  chain.scale.set(0.30, 1.05, 1);
  chain.position.y = RING + 0.46;
  chain.renderOrder = 1;
  lantG.add(chain);

  g.add(lantG);

  /* ---- and what it throws on the floor */

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(SPOKES, SPOKES),
    new THREE.MeshBasicMaterial({
      map: shadeMap(), transparent: true, opacity: 0, depthWrite: false,
    }),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(J.x, STONE + 0.010, J.z);
  shade.renderOrder = 1;
  g.add(shade);

  const spokes = new THREE.Mesh(
    new THREE.PlaneGeometry(SPOKES, SPOKES),
    new THREE.MeshBasicMaterial({
      map: spokeMap(), transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  spokes.rotation.x = -Math.PI / 2;
  spokes.position.set(J.x, STONE + 0.013, J.z);
  spokes.renderOrder = 2;
  g.add(spokes);

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
  // one of them turns round and goes down into the lantern, because nothing of
  // the soul is allowed to be lost — that is the difference between this card
  // and every other death on the table.
  const motes = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      // pale, not WHITE. At 0.95 warm-white and additive these fourteen came
      // out of ACES as a handful of flat white pills scattered over the stone,
      // which is the single failure this renderer hands out for free.
      map: blobTexture('rgba(232,212,255,0.8)', 'rgba(168,118,255,0)'),
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
      out.copy(S).addScaledVector(dir, (stand + OVER) * s);
      // climbs the whole way and is still climbing when it is taken, so the
      // line has a direction in it even standing still — and climbs EARLY, so
      // that by the time it is over the lantern it is already clear of the roof
      out.y = S.y + (PEAK - S.y) * Math.sin(s * Math.PI * 0.5) ** 0.55;
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
    const sec = t * SPAN;

    /* the lantern */
    // It arrives QUIETLY — no ring, no flash, no drop out of the sky. The
    // menace is that it was already hanging there; a lantern that announces
    // itself is a summon, and this card summons nothing.
    const wake0 = Math.min(1, t / 0.085);
    iron.opacity = wake0;
    paneMat.opacity = 0.82 * wake0;
    chainMat.opacity = 0.9 * wake0;

    const noticed = Math.max(0, 1 - Math.abs(t - LOOSE) / 0.09);
    const open = Math.max(0, Math.min(1, (t - OPEN) / 0.09));
    const bound = Math.max(0, Math.min(1, (t - SLAM) / 0.07));
    const flare = Math.max(0, 1 - Math.abs(t - SLAM) / 0.045);

    // A flame GUTTERS. Deterministic in `sec` rather than Math.random, or a
    // frozen preview frame lands somewhere different every run and nothing
    // about the look can be judged twice.
    const jitter = 0.86 + 0.09 * Math.sin(sec * 41.3) + 0.06 * Math.sin(sec * 17.1 + 1.2);
    const gutter = 1 - 0.42 * Math.max(0, Math.sin(sec * 7.3 - 1.4)) ** 10;
    const live = bound * jitter * gutter;

    // A LANTERN IS NOT A BRAZIER. The arena is full of warm firelight and the
    // one rule this effect cannot break is reading as another one of them, so
    // every lit pixel it owns is violet and the pale core only ever shows
    // through the glass.
    paneMat.emissiveIntensity = wake0 * (0.04 + noticed * 0.18 + open * 0.30
      + live * 1.55 + flare * 2.2);

    // The roof HINGES. Lifted straight up and set straight down it read as a
    // lid being taken off by somebody, which is a thing being opened rather
    // than a thing opening itself, and the lantern has to be the one acting.
    // The roof has to be DOWN on the frame the lantern flares, not starting to
    // move on it. Measured from SLAM with a 0.05 window, `1 - easeIn(shut)`
    // left it ninety per cent open at 900ms — the flash of the catch happening
    // over an open box, which is the one thing the slam is there to deny. It
    // now falls across the 36ms either side of the beat instead.
    const shut = Math.max(0, Math.min(1, (t - SLAM + 0.024) / 0.036));
    const tip = easeOut(open) * (1 - easeIn(shut));
    // and it hinges AWAY FROM THE CAMERA, not sideways. Tipped about z it
    // swung out across the screen into exactly the airspace the soul is caught
    // in, and a black flap the size of the lantern sat on top of the elbow —
    // the one thing in the motif that has to survive a frozen frame. Tipped
    // about x it goes up and back behind its own body and occludes nothing.
    roofPivot.rotation.x = -1.02 * tip;
    roofPivot.position.y = OPENING + 0.18 * tip;
    roofPivot.position.z = -0.12 * tip;

    // It is not plumb, and it never stops moving. Nothing else on this table
    // sways, which is the entire trick: the motion is small enough to be
    // deniable and constant enough to be noticed.
    lantG.rotation.z = -0.07 + 0.045 * Math.sin(sec * 1.9 + 0.6);
    lantG.rotation.x = 0.03 * Math.sin(sec * 1.45);

    const glow = open * 0.55 * (1 - shut) + live + flare * 1.2;
    inner.intensity = wake0 * glow * 4.6;
    flame.material.opacity = Math.min(1, bound * 0.95 + flare * 0.5);
    flame.scale.set(0.30 + 0.03 * Math.sin(sec * 33), 0.44 * (0.88 + 0.18 * jitter), 1);

    // The spokes turn. The lantern stays put and its light does not, which is
    // the cheapest genuinely wrong thing available and the one that survives
    // being watched for a second and a half.
    const cast = Math.min(0.60, wake0 * 0.03 + open * 0.18 + glow * 0.40);
    spokes.material.opacity = cast;
    shade.material.opacity = Math.min(0.70, cast * 1.15);
    const turn = sec * 0.42;
    const size = 0.82 + 0.16 * Math.min(1, glow) + flare * 0.1;
    spokes.rotation.z = turn; spokes.scale.setScalar(size);
    shade.rotation.z = turn; shade.scale.setScalar(size);

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

      // It SHRINKS as it goes in but it never dims: the soul is preserved, and
      // a soul that fades on the way in has been consumed.
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
    // motif says the lantern took it away — and the card says the opposite,
    // that it is put into this square. It DRIFTS, at the height it has hung at
    // all along, with nothing pulling it: a hanging thing that changes address
    // without descending is the last unpleasant beat in the sequence.
    const home = easeInOut(Math.max(0, Math.min(1, (t - CARRY) / (SET - CARRY))));
    // and then it lowers itself onto the square, which is the only moment the
    // whole card the lantern ever touches anything.
    const gone = easeIn(Math.max(0, (t - SET) / (1 - SET)));
    const x = J.x + (p.x - J.x) * home;
    const z = J.z + (p.z - J.z) * home;
    lantG.position.set(x,
      STONE + HANG + Math.sin(Math.PI * home) * 0.10 - (HANG - 0.02) * gone, z);
    lantG.scale.setScalar(LANT * (1 - gone * 0.35));
    spokes.position.set(x, STONE + 0.013, z);
    shade.position.set(x, STONE + 0.010, z);
    if (gone > 0) {
      // the light goes out DOWNWARD, into the square, which is where the rules
      // put the fighter — so what the player is left looking at is the card
      const left = 1 - gone;
      iron.opacity = left;
      paneMat.opacity = 0.82 * left;
      chainMat.opacity = 0.9 * left * (1 - gone * 0.6);
      flame.material.opacity *= left;
      spokes.material.opacity *= left ** 0.6;
      shade.material.opacity *= left ** 0.6;
      const shrink = (0.82 + 0.16) * (1 - gone * 0.55);
      spokes.scale.setScalar(shrink);
      shade.scale.setScalar(shrink);
      inner.intensity *= left;
      for (const c of frame.children) c.castShadow = gone < 0.5;
      roof.castShadow = gone < 0.5;
      letgo.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, gone * 1.2));
      letgo.scale.setScalar(0.5 + gone * 0.75);
    }
  }, () => {
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
    kit.light(new THREE.Vector3(J.x, STONE + HANG + 0.7, J.z), 0x8a4ff0,
      { power: 17, seconds: 0.36, reach: 4.2 });
  });
}

/* ------------------------------------------------- what becomes of the card */

/**
 * How long the body must stay on the table after the rules have killed it.
 *
 * Measured against the motif above rather than guessed. The soul is not clear
 * of the card until LOOSE (0.315s) and it is not SAFE until the roof drops at
 * 0.867s; killed sooner than the first of those, the card is off the square
 * before the thing that came out of it has gone anywhere, which is the Fire
 * Bolt bug — a card dying before its own effect reaches it.
 *
 * 0.62 rather than 0.45 because of what the exit does with the time: it lets
 * the husk SETTLE for 0.3s before it starts dragging, so 0.62 puts the drag
 * at 0.92s, just after the roof. At 0.45 the body began sliding off the board
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
 * it. Here the only part worth keeping has already been taken and is burning in
 * a lantern over the square, so the husk gets no burst, no dust, no light and
 * no lift at all: it drains to bone grey, settles, and is dragged off along the
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
