// THE DECOY — for a moment you can see what is actually on the card.
//
// Shared by 2 cards: M025 and M026, both "Totally Normal Villager". "While
// this fighter is in your Back Row, you may Deploy IIs or IIIs on top of it."
// The rule is a hiding place. The joke is the NAME, and it is the only joke in
// the whole card pool, so this is the one motif on the table allowed to be
// funny — and the only way a 60-pixel card is funny is TIMING.
//
// WHAT IT IS: nothing happens. Then the villager's portrait goes dark from the
// inside, as if something behind it had shifted, and two eyes open on the
// card — much too big, and much too far apart. They look at you. The card
// gives a small start. Something puts a limb out from under one edge onto the
// stone, realises, and pulls it back; the picture comes back; and a good half
// second later, when it is an ordinary card again, one bubble of seawater
// seeps out from under it on dry stone and pops.
//
// THE PAUSES ARE THE MOTIF. Every beat here is separated by dead air — dark,
// nothing, eyes, nothing, limb, snap, nothing, bubble. Played continuously the
// same events are a monster attack. The reveal is also SLOW and the retreat is
// FAST, which is the whole difference between something looking out and
// something caught looking.
//
// WHY IT IS ON THE CARD'S FACE. The first build tipped the card up on its far
// edge like a bin lid to show what was underneath, and it cannot work: this
// camera's elevation is fixed at 52 degrees, so the underside of a card is
// only visible once the card is tipped past 52 degrees — at the quarter of a
// radian that still reads as a card lying on a table you see MORE of the face
// and none of the gap. The card's own face is the only surface this camera
// ever gets a good look at, so that is where the thing has to appear.
//
// WHAT IT IS NOT: ./possess.js, which is also something dark arriving on a
// fighter. That one is a card-shaped slab that flows over a fighter and TAKES
// ITS PLACE — a Gloaming takeover, and it wins. Nothing here takes anything:
// the shape is not card-shaped, it is cropped by the card's own border because
// it does not fit inside it, it is gone in a third of a second, and the
// fighter is completely unchanged afterwards. The card wins.
//
// RESTRAINT. Nothing glows, nothing is additive, and the largest movement is
// the card flinching three millimetres. The eyes are the only pale thing in
// it, and they are a dull sea-green: under ACES on a dark board a bright pale
// pair of anything is two headlamps.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&t=600" \
//             --eval tools/fxdemo/decoy.js --out /tmp/decoy-600.png \
//             --wait 8000 --settle 500
// ?t is milliseconds INTO the motif, ?me is the square, ?zoom drops the camera
// in, and ?stack=1 buries the villager under a real card — which is what the
// rule is for, and the case where the thing has to show through SOMEBODY
// ELSE'S portrait.

import { THREE, CARD_W, CARD_H } from '../kit.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds. It is long for a flourish
// on one card, and it is long on purpose: half of it is the gaps.
const SPAN = 1.9;
const DARK0 = 0.16, DARK1 = 0.27;    // the portrait goes wrong from the inside
const EYE0 = 0.30, EYE1 = 0.37;      // ...then a beat, and the eyes open
const REACH0 = 0.38, REACH1 = 0.52;  // something puts a limb out
const SNAP = 0.56;                   // seen, and everything goes back at once
const BUB0 = 0.76, BUB1 = 0.95;      // and much later, one bubble

/* ---------------------------------------------------------------- colour */

// Marvorren is the sea faction and its card art is ITSELF blue-green, so hue
// buys nothing on a card; all of this is carried by VALUE. The mass is nearly
// black, the eyes are the only pale thing, and the limb is a silhouette.
const MASS = 0x04090b;
const LIMB = 0x0c2b34;
const WET = 0x0a2f45;

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a material
// never disposes its map, so a canvas built per cast leaks a GPU upload every
// time a villager is played.
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
 * What is really behind the disguise, CROPPED BY THE CARD.
 *
 * The shape runs off the top corners of its own canvas on purpose. Drawn to
 * fit inside the card it is a creature standing politely in a frame, which is
 * a portrait — the same thing the card already has. Cut off by the border it
 * reads as something bigger than the card it is hiding in, which is the joke
 * and the rules text at once.
 *
 * Soft, because a crisp silhouette on a card face is a sticker. This is meant
 * to look like something seen THROUGH the printing.
 */
const massTex = () => tex('mass', (g, W, H) => {
  g.clearRect(0, 0, W, H);
  // A BAND, not a body. The first cut drew the whole creature — a hunched
  // mass filling two thirds of the card — and it buried the portrait and the
  // card's name, which is where the joke actually is: you have to be able to
  // read "Totally Normal Villager" WHILE it looks at you. What is left is the
  // dark the eyes are set into, and two spurs leaving the card's top edge.
  g.filter = `blur(${W * 0.035}px)`;
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.38, W * 0.58, H * 0.2, 0.03, 0, Math.PI * 2);
  g.fill();
  // The spurs — horns, or the first joints of something — running off the top
  // corners. They are the only part of the thing that is plainly BIGGER than
  // the card it is hiding in, and they cost two strokes.
  g.filter = `blur(${W * 0.012}px)`;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  for (const [x0, y0, x1, y1, w] of [
    [W * 0.30, H * 0.34, -W * 0.04, -H * 0.10, W * 0.085],
    [W * 0.72, H * 0.35, W * 1.03, -H * 0.03, W * 0.07],
  ]) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2, y0 - H * 0.26, x1, y1);
    g.stroke();
  }
}, 160, 160);

/**
 * One eye: a wide almond, a pale iris, and a horizontal slit.
 *
 * Painted in COLOUR rather than white-and-tinted, because the shape IS the
 * contrast between a pale iris and a black pupil and a material tint cannot
 * give two values. A plain pale lozenge is a lamp; an eye is a lamp with a
 * hole in it.
 */
const eyeTex = () => tex('eye', (g, W, H) => {
  const cx = W / 2, cy = H / 2;
  const almond = (rx, ry) => {
    g.beginPath();
    g.moveTo(cx - rx, cy);
    g.quadraticCurveTo(cx, cy - ry * 2, cx + rx, cy);
    g.quadraticCurveTo(cx, cy + ry * 2, cx - rx, cy);
    g.closePath();
  };
  // A dark surround first, so the eye is never a pale shape floating on
  // nothing — it is set into something.
  g.filter = `blur(${W * 0.09}px)`;
  g.fillStyle = 'rgba(3,10,12,1)';
  almond(W * 0.50, H * 0.40); g.fill();
  almond(W * 0.46, H * 0.34); g.fill();
  g.filter = `blur(${W * 0.016}px)`;
  // Duller than it wants to be. A clean saturated cyan almond at this size is
  // a pair of sunglasses drawn on the portrait — which is a joke, but the
  // wrong one. The iris is mostly dark and only its middle has any colour.
  const iris = g.createRadialGradient(cx, cy, 2, cx, cy, W * 0.4);
  iris.addColorStop(0, 'rgba(150,206,188,1)');
  iris.addColorStop(0.45, 'rgba(86,148,140,1)');
  iris.addColorStop(1, 'rgba(19,52,56,1)');
  g.fillStyle = iris;
  almond(W * 0.37, H * 0.23); g.fill();
  // The slit. Horizontal, like a cuttlefish's — a round pupil is a friendly
  // cartoon eye, which is the wrong joke.
  g.filter = `blur(${W * 0.012}px)`;
  g.fillStyle = 'rgba(2,7,9,1)';
  g.beginPath();
  g.ellipse(cx, cy, W * 0.29, H * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  // One specular nick, off centre, which is the whole difference between a
  // painted eye and a wet one.
  g.filter = 'none';
  g.fillStyle = 'rgba(236,255,250,0.9)';
  g.beginPath();
  g.ellipse(cx - W * 0.12, cy - H * 0.07, W * 0.033, H * 0.036, 0, 0, Math.PI * 2);
  g.fill();
}, 160, 112);

/**
 * The limb: a tapering arm with a curl on the end, pointing +x from the LEFT
 * EDGE of the canvas so it can be pushed out of the card by scaling x about
 * its own base.
 *
 * Silhouette only. Anything with modelled suckers on it is a monster, and this
 * is a card that would rather you did not look.
 */
const limbTex = () => tex('limb', (g, W, H) => {
  const cy = H / 2;
  g.filter = `blur(${W * 0.01}px)`;
  g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath();
  g.moveTo(0, cy - H * 0.22);
  g.bezierCurveTo(W * 0.40, cy - H * 0.28, W * 0.72, cy - H * 0.42, W * 0.87, cy - H * 0.10);
  g.bezierCurveTo(W * 0.96, cy + H * 0.14, W * 0.77, cy + H * 0.24, W * 0.69, cy + H * 0.06);
  g.bezierCurveTo(W * 0.62, cy - H * 0.08, W * 0.38, cy + H * 0.08, 0, cy + H * 0.22);
  g.closePath();
  g.fill();
}, 192, 96);

/** A bead of water: a dark rim with a bright top, which is what a bubble is. */
const bubbleTex = () => tex('bubble', (g, W) => {
  const c = W / 2;
  const rim = g.createRadialGradient(c, c, W * 0.2, c, c, W * 0.46);
  rim.addColorStop(0, 'rgba(70,132,140,0.14)');
  rim.addColorStop(0.74, 'rgba(154,218,212,0.6)');
  rim.addColorStop(1, 'rgba(120,190,190,0)');
  g.fillStyle = rim;
  g.fillRect(0, 0, W, W);
  const hi = g.createRadialGradient(c - W * 0.11, c - W * 0.12, 0,
    c - W * 0.11, c - W * 0.12, W * 0.17);
  hi.addColorStop(0, 'rgba(228,252,248,0.95)');
  hi.addColorStop(1, 'rgba(228,252,248,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, W, W);
}, 96, 96);

/** A soft blot, for wet stone. */
const blotTex = () => tex('blot', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 96, 96);

/* ------------------------------------------------------------------ main */

/** A flat decal lying face up. */
function plate(map, w, h, colour) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map, color: colour, transparent: true, depthWrite: false, opacity: 0,
  }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function decoy(kit, at) {
  const villager = kit.piece(at);
  const p = kit.at(at);
  if (!p) return;

  // The thing shows through whatever is ON TOP of this square, which is the
  // villager itself until somebody uses the rule and deploys a II onto it.
  // Drawn on the buried card the whole effect is under another card and
  // invisible — and it is funnier this way round anyway: the thing looks out
  // through the portrait of whoever is standing on it.
  const sq = villager?.square;
  const lid = (sq >= 0 && sq < 9 && kit.pieces?.topAt?.(sq)) || villager;
  if (!lid) return;

  // The deal is still in the air when a deployed card's flourish fires — the
  // engine resolves instantly and anim.deploy takes 0.46s — and a decal placed
  // on a card that is still flying in sits on the square the card is about to
  // land on. The wait is not a fudge: this motif's first beat is silence.
  kit.after(lid.animating ? 0.54 : 0.02, () => {
    if (lid.group.parent) run(kit, lid);
  });
}

function run(kit, lid) {
  const home = lid.group.position.clone();
  // Anything flat on a card sits 0.055 above its face, which is at about 0.21;
  // the flagstone is at 0.080. At less clearance the depth test (gl.LESS fails
  // on equal) drops a decal on the stone AROUND the card and not on the card.
  const FACE = 0.21 + 0.055;
  const GROUND = 0.08 + 0.055;

  const g = new THREE.Group();
  g.position.set(home.x, 0, home.z);

  // The mass, exactly the card's footprint: it has to be CROPPED by the
  // card's own border, so it may not be a hair wider than the card is.
  const mass = plate(massTex(), CARD_W, CARD_H, MASS);
  mass.position.y = FACE;
  mass.renderOrder = 3;
  g.add(mass);

  // THE EYES, 0.62 apart on a card 1.74 wide. That is wider than the shoulders
  // of anything that could be standing in a village, and the gap is the joke —
  // eyes a sensible distance apart are a person in there.
  const eyes = [-1, 1].map((s) => {
    const e = plate(eyeTex(), 0.46, 0.34, 0xffffff);
    e.position.set(s * 0.25, FACE + 0.004, -0.18);
    // Mirrored, and canted with the outer corner low. Two identical lozenges
    // side by side are goggles; two that lean away from each other are a face.
    e.scale.x = s;
    e.rotation.z = s * 0.1;
    e.renderOrder = 5;
    g.add(e);
    return e;
  });

  // The limb, lying ON THE STONE past the card's near edge — the one part of
  // this that is not on the card, and the only one that says the thing does
  // not fit. Its geometry is shifted so the pivot is at the base, which is how
  // scaling x pushes it out of the card instead of fattening it in place.
  const limb = plate(limbTex(), 1.1, 0.56, LIMB);
  limb.geometry.translate(1.1 / 2, 0, 0);
  limb.position.set(0.12, GROUND, CARD_H * 0.48);
  limb.rotation.z = -0.55;
  limb.renderOrder = 2;
  g.add(limb);

  // The evidence. Dry stone, and what comes out of it is seawater.
  const wet = plate(blotTex(), 0.9, 0.6, WET);
  wet.position.set(0.24, GROUND, CARD_H * 0.56);
  wet.renderOrder = 2;
  g.add(wet);

  const bubble = plate(bubbleTex(), 0.36, 0.36, 0xffffff);
  // Leaned toward the camera rather than flat: a bubble seen from straight
  // above is a ring, and a ring on the ground is every other effect in this
  // game. The lean is 38 degrees off the flat, which puts its normal on the
  // camera at this fixed elevation.
  bubble.rotation.x = -0.66;
  bubble.position.set(0.3, 0.2, CARD_H * 0.56);
  bubble.renderOrder = 5;
  g.add(bubble);

  kit.hold(g, SPAN, (t) => {
    // Everything on the card's face follows the card, because a decal left on
    // the square while the card flinches is a decal sliding off it.
    if (lid.group.parent) {
      // A START, not a jump: three millimetres up and a hair of roll, once,
      // on the frame the eyes open. It is the only motion in the motif and it
      // only works because nothing else is moving.
      const jolt = Math.max(0, Math.sin(((t - EYE0) / 0.10) * Math.PI))
        * (t > EYE0 && t < EYE0 + 0.10 ? 1 : 0);
      lid.animating = true;
      lid.group.position.set(home.x, home.y + 0.03 * jolt, home.z);
      lid.tilt.rotation.z = 0.035 * jolt;
      g.position.set(lid.group.position.x, 0, lid.group.position.z);
      mass.position.y = FACE + 0.03 * jolt;
      for (const e of eyes) e.position.y = FACE + 0.004 + 0.03 * jolt;
    }

    // The portrait goes wrong from the inside. Slow up, and then gone in a
    // tenth: the difference between something surfacing and something diving.
    const show = smooth((t - DARK0) / (DARK1 - DARK0))
      * (1 - smooth((t - SNAP) / 0.055));
    mass.material.opacity = 0.8 * show;

    // The eyes OPEN, by getting taller rather than by fading up — a pair of
    // eyes that dissolve into being are ghosts, and this thing has a body.
    const lit = smooth((t - EYE0) / (EYE1 - EYE0)) * (1 - smooth((t - SNAP) / 0.04));
    for (let i = 0; i < 2; i++) {
      const e = eyes[i];
      e.material.opacity = clamp01(lit * 1.3);
      e.scale.set(i ? 1 : -1, Math.max(0.03, lit), 1);
      // One slow look sideways and back. Nothing else is moving while this
      // happens, so three hundredths of a unit is plenty.
      e.position.x = (i ? 1 : -1) * 0.25 + Math.sin(t * 6.5) * 0.03;
    }

    // Out slowly, back in one frame's worth of panic.
    const reach = smooth((t - REACH0) / (REACH1 - REACH0))
      * (1 - smooth((t - SNAP) / 0.05));
    limb.scale.set(Math.max(0.001, reach), 1, 1);
    limb.material.opacity = 0.88 * clamp01(reach * 3);
    limb.rotation.z = -0.55 + 0.2 * Math.sin(t * 8);

    // The wet patch only appears once everything else has gone and the card is
    // an ordinary card again. Shown during the reveal it is one more thing
    // happening at the busiest moment; shown after, it is the punchline.
    const dry = smooth((t - SNAP - 0.06) / 0.07) * (1 - smooth((t - 0.88) / 0.12));
    wet.material.opacity = 0.4 * dry;
    const b = smooth((t - BUB0) / (BUB1 - BUB0));
    // It swells and then is simply NOT THERE. A bubble does not fade out; the
    // last frame is the pop.
    bubble.material.opacity = b > 0.93 ? 0 : 0.95 * smooth((t - BUB0) / 0.05);
    bubble.scale.setScalar(0.5 + b * 0.7);
    bubble.position.y = 0.2 + b * 0.05;
  }, () => {
    if (!lid.group.parent) return;
    lid.group.position.copy(home);
    lid.tilt.rotation.z = 0;
    lid.animating = false;
  });
}
