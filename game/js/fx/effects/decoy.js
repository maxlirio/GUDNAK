// THE DECOY — a tornado stands where the villager was, and when it lifts the
// villager is gone and something bigger is standing there.
//
// Shared by 2 cards: M025 and M026, both "Totally Normal Villager".
//
//   "Nothing to See Here — While this fighter is in your Back Row, you may
//    Deploy IIs or IIIs on top of it. Before you do, put this fighter into
//    your hand without its stack."
//
// So the villager does NOT get covered up and stay there. It LEAVES, to its
// owner's hand, and the card you deployed lands on the square it was standing
// on. The player reads that as the villager having BEEN the monster all along,
// so what this motif has to be is a TRANSFORMATION — the funnel a film drops
// over somebody in the half second before the thing they turn into walks out
// of it. The joke in the name survives it: the one totally normal villager on
// the quay turns out to be a conjuring trick.
//
// WHAT IT IS: the stone goes dark, debris boils up off it, and a funnel winds
// out of that — torn and spread at the top, drawn in to a waist a quarter of
// the way up, disappearing into the churning mound at its foot. It leans, the
// mound hides the card completely, and torn costume is whipped round and up
// the outside of it the whole time. Then it ropes out: the foot leaves the
// ground, the column thins and drifts back, and the fighter that was never
// there is standing on the square. The swap happens inside the mound.
//
// ── REJECTED TWICE. READ THIS BEFORE CHANGING THE SHAPE. ──────────────────
//
// Version 2 was a FLAT SPINNING DISC lying on the flagstone, six coloured
// spiral arms turning on the stone with some short ribbons round it. The user
// looked at one frame and said: "that looks like a pin wheel". They were
// right, and it is worth being precise about why, because the reasoning that
// produced it sounds correct:
//
//   the camera's elevation is fixed at 52 degrees, so anything vertical is
//   foreshortened; height costs screen pixels and width costs nothing;
//   therefore spend width, and a whirlwind seen from above is mostly a spiral
//   on the ground.
//
// That argument holds for a THIN vertical thing — a beam, a shaft, a single
// column of light seen nearly end-on, where the silhouette is a few pixels
// wide and disappears. It does NOT hold for a tornado. Three and a half units
// of height at this camera is a hundred and thirty screen pixels, against
// about sixty of width: a silhouette twice the height of a card standing in
// the middle of the board. A spiral drawn flat on the floor has no silhouette
// at all, and a spiral with no silhouette is a pinwheel every time. The lesson
// is not "never go vertical" — it is that FORESHORTENED IS NOT INVISIBLE, and
// the outline is what a stranger names the thing by.
//
// So the outline was built first and everything else hung off it:
//
//  - The profile is a real funnel and it is NOT a cone. A cone reads as a
//    party hat. The wall goes wide and torn at the top, pulls IN to a waist a
//    quarter of the way up, and flares back out into the ground debris at the
//    foot. Those two opposite curves are the whole silhouette.
//  - The funnel and the debris are two different sizes. Tying the column's
//    width to the mound that hides the card made it as wide as it was tall,
//    which photographs as a mushroom.
//  - The axis BENDS, and the bend moves. A straight column of revolution is a
//    vase however it is painted. The foot is planted and the top swings.
//  - The rim is ragged and the raggedness turns with the column, so the
//    outline boils instead of sitting still.
//  - Things go UP. Torn costume climbs the outside continuously, from the
//    first frame to the last. Rotation alone is a spinning circle; rotation
//    plus LIFT is a tornado, and lift is the half the disc could never show.
//
// WHAT HIDES THE CARD. Not the funnel wall — a wall you can see through is
// worth having, and at this camera the sight-line from the far corner of the
// card climbs the inside of the column and leaves through its mouth without
// ever crossing the wall, because the wall's flare and the sight-line are
// nearly parallel. So the concealment is a separate CLOSED DOME of ground
// debris squatting over the square, and being closed is the whole argument:
// any sight-line that starts on the card has to cross its surface to get out.
//
// Version 2 did this with a flat opaque disc and painted spiral arms on it,
// which is what got the motif called a pinwheel. The disc is gone. The dome
// has no arms in it and no direction in it at all — it is a couple of hundred
// soft lumps — and what turns is the column standing in the middle of it.
//
// AND THREE WRONG TURNS INSIDE THIS REBUILD, each recorded where its number
// lives, because every one of them photographed as something with a name:
//
//   MUSHROOM — the column tied to the width of the thing that hides the card,
//     so it came out as wide as it was tall.            (see WALL)
//   BOUQUET  — the debris built as a tall dome, which swallowed the waist, so
//     what was left only ever got wider as it rose.     (see BOWL_H)
//   STEAM    — the wall painted lighter than the arena on the theory that a
//     dark thing on a dark board has no outline. It is not seen against the
//     board; it is seen against the LIT FLAGSTONES of the rows behind it, and
//     a pale column on pale stone is a puff of steam.   (see wallTex)
//
// The common thread is that all three were argued from the code and none of
// them survived one screenshot. ?only= exists so each layer can be shot alone.
//
// THE COLOURS ARE THE CARD'S OWN, off untitled-card-3.png: the deep crimson of
// the costume, the purple of the sleeves and hood, and the light blue of the
// canal and of the card's own title. They are kept APART — the wall's texture
// is divided into three colour zones and repeated twice round the column, so
// the order is crimson, blue, purple, crimson, blue, purple and no two of the
// same ever touch. Nothing here is additive. Three saturated colours on
// additive blending sum past 1.0 in all three channels under ACES and
// photograph as one grey-white smear, which is exactly the trap a
// three-colour whirlwind walks into.
//
// WHAT IT IS NOT: the Void pit out to the left, which is also a spinning thing
// with purple and blue arms. That one is a HOLE — flat black mouth, broken
// ground, additive swirl sunk into the dirt. This one STANDS UP off the stone.
//
// WHY IT IS NOT ON THE CARD'S FACE. The first build tipped the card up on its
// far edge like a bin lid to show what was underneath, and it cannot work:
// this camera's elevation is fixed at 52 degrees, so the underside of a card
// is only visible once the card is tipped past 52 degrees — at the quarter of
// a radian that still reads as a card lying on a table you see MORE of the
// face and none of the gap. Still true, still worth knowing.
//
// Preview:  node tools/shot.js --url "game/?quick=1&seed=5&p0=The%20Masked&t=560" \
//             --eval tools/fxdemo/decoy.js --out /tmp/decoy-560.png \
//             --wait 10000 --settle 600
// ?t is milliseconds INTO the motif, ?me is the square — 0..2 is the near back
// row and 6..8 the far one, and BOTH have to be checked because on the far
// seat the column is pointing at the top of the frame. ?only=core hides every
// layer but one, which is the only honest way to tune any of them. ?tex=1 lays
// the canvases over the page. ?zoom drops the camera in and ?solo=1 leaves the
// villager standing.

import { THREE, CARD_W, CARD_H } from '../kit.js';

const TAU = Math.PI * 2;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Deterministic noise for the canvases, so a texture is the same every page. */
function seeded(n) {
  let s = n * 1664525 + 1013904223;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/* ------------------------------------------------------------------ time */

// Every moment here is in SECONDS from the first frame, NOT a fraction of
// SPAN, because `timing.kill` and the card's own leaving are in seconds too
// and all three have to be read against each other. Get that wrong and the
// card is gone before the dust has closed over it, which is the bug the Fire
// Bolt was pulled up on.
//
// SPAN is 1.70 rather than the 1.55 the disc used. The extra sixth of a second
// is all at the end and it is the DISSIPATION: a tornado that stops existing
// on a frame is a light being switched off. It ropes out instead.
const SPAN = 1.70;
const SHUT = 0.42;      // the foot is packed solid from here...
const OPEN = 0.70;      // ...until here, and then it lifts off the stone
const CLEAR = 0.88;     // and there is nothing over the square at all

/* ---------------------------------------------------------------- colour */

// Read off the card. Marvorren's kit colour is a pale cyan and it is NOT what
// this card looks like — the villager is crimson first, and a generic faction
// wash would have thrown away the only thing that makes this motif hers.
//
// The light blue is pushed further toward cyan and brighter than the printing.
// ACES pulls roughly a third of green into red, so a polite sky blue arrives
// on screen as grey; at 0x5ec9ee it is still plainly blue next to the purple.
const COL = [
  { cloth: '#c4133c', lit: '#ff5d7e', hex: 0xc4133c },   // the costume
  { cloth: '#5ec9ee', lit: '#b6ecff', hex: 0x5ec9ee },   // the canal, the title
  { cloth: '#7d3fc0', lit: '#bb8bee', hex: 0x7d3fc0 },   // the sleeves
];

/* -------------------------------------------------------------- geometry */

// WHAT HAS TO BE COVERED. A card is 1.74 x 1.76, so its corner is 1.237 from
// the middle of the square, and whatever hides it has to be solid out to
// there. Sized off the card rather than typed in, because the two must not
// drift.
const HIDE = Math.hypot(CARD_W, CARD_H) / 2;

// THE DEBRIS IS A LUMP, NOT A PLATE, and that decision is doing two jobs.
//
// The first is the pinwheel. The cover that hid the card used to be a flat
// opaque disc lying on the flagstone; painting spiral arms on it is what got
// this motif rejected, and even swept clean of arms a hundred-pixel circle
// lying flat on the floor is one bad idea away from being a pinwheel again.
// A dome cannot be mistaken for one. It is the boiling ground debris a real
// funnel stands in, it has a top and a near side and a far side, and its
// outline is nothing anybody can trace with a compass.
//
// The second is that it hides the card BETTER than the disc did. It is closed,
// so every sight-line that starts on the card and leaves toward the camera has
// to cross its surface, whatever angle the camera is at — no arithmetic about
// what the funnel's mouth does or does not let through.
//
// 1.11 of the card's corner radius: 2.75 across against a 2.5 flagstone, proud
// of its own stone. The rule this card lives by only works in a BACK ROW, so
// the square is always on the edge of the board with a wooden rail and the
// Stronghold plinth right behind it, and the neighbouring CARD starts 1.75
// out — and the most outward lobe of the dome's wobble stops short of that at
// 1.68, which is what sets the dome's `jag` in the tick rather than taste.
// That wobble is also why the radius cannot simply be trimmed: it only ever
// pushes OUTWARD (see `lift` in lay), so the dome is never narrower than this,
// and at the card's own corner it still has a tenth of a unit of margin over
// the 1.237 it has to cover.
const BOWL = HIDE * 1.11;
// LOW, and this is the number that decides whether the funnel has a waist.
// At 1.15 the dome came up over a third of the column and swallowed the
// narrowest part of it whole; what was left above was a shape that only ever
// got wider as it rose, and a shape that only gets wider as it rises is a
// bouquet. At 0.55 it is a skirt of debris the funnel stands IN rather than a
// lump the funnel stands ON, and everything that gives the column its outline
// is above it.
//
// Height costs nothing in concealment. The dome is CLOSED, so a sight-line
// that starts on the card can only leave by crossing its surface, and its
// surface is opaque — all that is required is that the card be inside it, and
// at the card's own corner the dome is still 0.29 high.
const BOWL_H = 0.55;
const domeR = (u) => BOWL * (1 - u * u) ** 0.55;

// THE FUNNEL IS MUCH THINNER THAN THE DEBRIS, and it took two photographs to
// believe it. Tied to the width of the thing that hides the card, the column
// came out as wide as it was tall and photographed as a lumpy purple MUSHROOM;
// widened again to fix a weak silhouette it became a translucent BOUQUET. They
// are two different objects and they are allowed to be two different sizes:
// the debris is what is being dragged along the ground, and the funnel
// standing in it is a slender thing. At the waist the column is about
// thirty-five pixels across against a hundred and thirty of height.
//
// WALL is the radius the profile below is a fraction of; the profile runs from
// 0.52 at the waist to 1.38 at the torn mouth.
const WALL = 0.95;

// THE HEIGHT. A world unit is about 36 screen pixels across and 37 up on the
// near back row, so this is about a hundred and thirty pixels of column —
// twice the height of a card, standing against the board and the dark scenery
// behind it.
//
// It is not larger, and the limit is not taste: the rule only works in a BACK
// ROW, and on the other seat that is the row furthest from the camera and
// highest in the frame. Every tenth of a unit here costs about five pixels off
// the top of the picture there, and a column cut off by the frame edge looks
// like a column that was meant to stop. tools/fxdemo/decoy.js prints where the
// highest vertex lands; check ?me=7 after touching this.
const TALL = 3.60;

// The profile of the wall, as (height fraction, radius as a fraction of WALL).
// This IS the silhouette, and it is the first thing that was drawn. Read it
// bottom to top: a small flare where it disappears into the debris, a waist
// just above that, and then a long widening that turns up sharply in the last
// tenth into a torn mouth two and a half times the waist. The curve is CONCAVE
// the whole way — a straight taper is a cone, and a cone at this camera is a
// party hat.
//
// The WAIST is deliberately at a quarter height and not lower: below that it
// is inside the debris and cannot be seen, and a funnel whose narrowest point
// is hidden is just a cone. The flare at the very top is late and steep for
// the opposite reason — the mouth is torn away over the top eighth of the
// column, so a flare spread evenly up the whole wall is a flare nobody sees.
const PROFILE = [
  [0.00, 0.72], [0.10, 0.58], [0.24, 0.52], [0.42, 0.60], [0.62, 0.72],
  [0.80, 0.90], [0.88, 1.00], [0.94, 1.16], [1.00, 1.38],
];
function prof(u) {
  for (let i = 1; i < PROFILE.length; i++) {
    if (u <= PROFILE[i][0]) {
      const [a, ra] = PROFILE[i - 1];
      const [b, rb] = PROFILE[i];
      return ra + (rb - ra) * ((u - a) / (b - a));
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

// The flagstone face is at 0.080 and a card's at 0.2205 (resting 0.203 plus
// half the slab). Anything FLAT over a card has to sit 0.055 clear of its face
// or the depth test drops it onto the stone AROUND the card instead of onto
// the card, which at this camera is a centimetre the depth buffer cannot
// separate; the ground stain is under the card instead and only ever seen
// around it, so it sits just off the stone.
const GROUND_Y = 0.135;
const BASE_Y = 0.09;    // where the dome and the wall meet the stone

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
 * A soft round brush.
 *
 * The streaks were first drawn as hard strokes under a canvas blur filter, and
 * a canvas filter costs a full-surface pass PER DRAW — and there are thousands
 * of dabs in the wall texture. A pre-built gradient dab drawn with drawImage
 * is the same softness for nothing.
 */
const BRUSH = new Map();
function brush(css) {
  let c = BRUSH.get(css);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, css);
    grd.addColorStop(0.45, css);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    BRUSH.set(css, c);
  }
  return c;
}

// How far one streak drifts sideways over the height of the tile. The tile is
// laid twice round the column, so 0.20 of a tile is about a fifth of a turn
// top to bottom — a lean, not a barber pole. It was 0.34 first and every
// crimson streak finished its climb inside the blue zone, which is the one
// thing the colour layout exists to stop.
const SLANT = 0.20;

/**
 * THE WALL: torn dust, tiling round the column.
 *
 * x runs round the funnel and is repeated TWICE, so the three colour zones
 * become six and the order round the column is crimson, blue, purple, crimson,
 * blue, purple. y runs up it — canvas BOTTOM is the foot, because three.js
 * flips v by default.
 *
 * `kind` is 'core' (the column itself) or 'veil' (a looser, wider shell hung
 * outside it). Two different paints rather than one texture at two opacities,
 * because the second shell's whole job is to NOT line up with the first.
 */
const wallTex = (kind) => tex(`wall-${kind}`, (g, W, H) => {
  const dense = kind === 'core';
  const rnd = seeded(dense ? 11 : 29);
  g.clearRect(0, 0, W, H);

  // Every dab is laid three times, one tile left and one right, or a streak
  // that runs off the edge is cut in half at the seam.
  const dab = (css, x, y, r, a) => {
    if (a <= 0) return;
    g.globalAlpha = a;
    const b = brush(css);
    g.drawImage(b, x - r, y - r, r * 2, r * 2);
    g.drawImage(b, x - r - W, y - r, r * 2, r * 2);
    g.drawImage(b, x - r + W, y - r, r * 2, r * 2);
  };

  // One streak of dust, from the foot upward. `tall` is how far up the tile it
  // gets and is different for every streak, so the top of the tile is a row of
  // tongues at different heights. `css` may be a colour to add or 'cut', which
  // takes dust AWAY — the holes are painted with the same brush as the dust so
  // they lean the same way.
  const streak = (x0, css, alpha, wide, tall, dash) => {
    const N = 120;
    const cut = css === 'cut';
    g.globalCompositeOperation = cut ? 'destination-out' : 'source-over';
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1);
      const y = H * (1 - t * tall);
      const x = x0 + SLANT * W * t + Math.sin(t * 4.4 + x0 * 0.03) * W * 0.012;
      const w = wide * (0.62 + 0.55 * Math.sin(t * 5 + x0 * 0.05));
      // Alphas look absurdly low because they are not one dab's worth: a
      // hundred and twenty soft dabs along a streak overlap five or six deep.
      // The dash term breaks the streak up along its length; smoothly varying
      // streaks packed edge to edge painted a seamless satin CURTAIN, which is
      // the wrong material entirely.
      const a = alpha * (1 - dash + dash * (0.5 + 0.5 * Math.sin(t * 21 + x0)))
        * (1 - smooth((t - 0.88) / 0.12))
        // A hole opens as it climbs. The foot has to stay packed — it is the
        // part standing on the card — and the mouth has to come apart.
        * (cut ? 0.12 + 0.9 * t : 1);
      dab(cut ? '#000' : css, x, y, w, a);
    }
    g.globalCompositeOperation = 'source-over';
  };

  // THE CORE IS PAINTED SOLID AND THEN TORN, not built up out of wisps, and
  // that is the third thing this went through before it read. Wisps at four
  // tenths alpha over a night-dark arena come out four tenths as bright as the
  // paint — the column photographed as a dark smoky vortex with bright threads
  // in it, which is a magic effect and not weather. A tornado is a MASS: it is
  // nearly opaque, and what makes it ragged is the holes torn in it, not its
  // being faint all over.
  //
  // DARK on purpose, and that is a reversal worth recording. The first two
  // cuts painted it LIGHTER than the arena on the reasoning that a dark object
  // on a dark board has no silhouette. It does not stand against the board:
  // the near back row is seen against the lit flagstones of the two rows
  // behind it, which are the palest thing in the picture, and a pale column
  // against pale stone photographed as a puff of steam. Dark against the
  // stone, lit along its edges against the scenery above — that is the shape
  // that reads from both seats.
  //
  // THE VEIL GETS NO SUCH FILL, and it cost a photograph to work that out. It
  // is drawn OVER the core, so a veil painted solid too laid a second opaque
  // sheet across the first and the pair came out as one pale lavender haze
  // with the flagstones showing through: no dark side, no waist, no outline.
  // The veil is wisps and only wisps — its whole job is the ragged fringe
  // around a silhouette the core has already made solid.
  if (dense) {
    const body = g.createLinearGradient(0, H, 0, 0);
    body.addColorStop(0, 'rgba(62,40,54,0.98)');
    body.addColorStop(0.22, 'rgba(54,33,46,0.98)');
    body.addColorStop(0.62, 'rgba(58,36,50,0.97)');
    body.addColorStop(0.92, 'rgba(66,43,58,0.86)');
    body.addColorStop(1, 'rgba(70,46,62,0.30)');
    g.fillStyle = body;
    g.fillRect(0, 0, W, H);
  }

  // Tone within the mass, so it is not a flat card of colour. On the veil
  // these ARE the veil.
  for (let i = 0; i < (dense ? 14 : 24); i++) {
    streak(rnd() * W, i % 2 ? '#8e6d7e' : '#2d1826', dense ? 0.13 : 0.16,
      W * (0.030 + rnd() * 0.055), 0.86 + rnd() * 0.26, dense ? 0.55 : 0.75);
  }

  // STORM BANDS. Six soft dark bands lying across the column, wavy and leaning
  // the same way the streaks do. They are what stops a vertical striped column
  // reading as a FLAME or a flower: a real funnel is wrapped in sheets of dust
  // at different heights and the cross-banding is the most recognisable thing
  // about it after the outline. They are drawn before the colours so the
  // colours still show through them.
  for (let i = 0; i < 6; i++) {
    const t0 = 0.08 + i * 0.15 + rnd() * 0.05;
    const thick = H * (0.012 + rnd() * 0.022);
    for (let k = 0; k < 90; k++) {
      const fx = k / 89;
      const y = H * (1 - (t0 + Math.sin(fx * 5.5 + i) * 0.035 + fx * SLANT * 0.28));
      dab(i % 2 ? '#2a1522' : '#3c2233', fx * W, y, thick, 0.05 + rnd() * 0.02);
    }
  }

  // The colours, one third of the tile each and spaced inside their third so
  // they do not clump on one side. A broad wash first and a narrow band on top
  // of it: the wash is what is still legible when the column is a hundred
  // pixels wide, and the band is what stops the wash being a smear.
  for (let c = 0; c < 3; c++) {
    const col = COL[c];
    const n = dense ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const x0 = (c + (i + 0.2 + rnd() * 0.6) / n) * (W / 3);
      streak(x0, col.cloth, dense ? 0.07 : 0.08,
        W * (0.05 + rnd() * 0.05), 0.88 + rnd() * 0.22, 0.35);
      streak(x0 + W * 0.01, col.cloth, dense ? 0.14 : 0.12,
        W * (0.016 + rnd() * 0.02), 0.86 + rnd() * 0.26, 0.6);
    }
    // A bright edge where a fold catches the braziers. A THIRD of what looks
    // right on the canvas: at half alpha in near-white every streak became a
    // tube of light and the three colours became one.
    for (let i = 0; i < 4; i++) {
      streak((c + rnd()) * (W / 3), col.lit, 0.05, W * 0.009, 0.62 + rnd() * 0.38, 0.7);
    }
  }
  g.globalAlpha = 1;

  // NOW TEAR IT. Holes right through the mass, opening wider the higher they
  // go, so the foot stays packed and the mouth comes apart.
  //
  // Ten of them, not the twenty-two this had first: a cut streak is a hundred
  // and twenty overlapping dabs and twenty-two of them across a 256-pixel tile
  // ate the entire mass. The column went straight back to being a dark smoky
  // vortex with bright threads in it, and the whole reason for painting it
  // solid was thrown away in one line.
  if (dense) {
    for (let i = 0; i < 10; i++) {
      streak(rnd() * W, 'cut', 0.075,
        W * (0.02 + rnd() * 0.045), 0.40 + rnd() * 0.70, 0.55 + rnd() * 0.4);
    }
  }

  // TEAR THE MOUTH, and only the mouth. Canvas y=0 is the top of the column.
  // Without this the column ends on a hard ring, and that ring seen from above
  // at 52 degrees is an ellipse three units across — a disc, which is the
  // exact failure being fixed.
  //
  // The notches are FOURTEEN and they are confined to the top third. At
  // thirty-four spread over the top half they covered that half six times over
  // and there was simply no column above the waist.
  g.globalCompositeOperation = 'destination-out';
  const f = g.createLinearGradient(0, 0, 0, H);
  f.addColorStop(0, 'rgba(0,0,0,0.95)');
  f.addColorStop(0.035, 'rgba(0,0,0,0.45)');
  f.addColorStop(0.09, 'rgba(0,0,0,0.12)');
  f.addColorStop(0.16, 'rgba(0,0,0,0)');
  g.fillStyle = f;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W;
    const r = W * (0.018 + rnd() * 0.032);
    g.globalAlpha = 0.45 + rnd() * 0.55;
    const y = rnd() * rnd() * H * 0.26;
    g.drawImage(brush('#000'), x - r, y - r, r * 2, r * 2);
    g.drawImage(brush('#000'), x - r - W, y - r, r * 2, r * 2);
    g.drawImage(brush('#000'), x - r + W, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}, 256, 512);

/**
 * THE DEBRIS DOME: the mass boiling along the ground at the funnel's touchdown,
 * and the only thing in this motif that actually hides the card.
 *
 * Tiles round the dome the same way the wall tiles round the column — x goes
 * round, y goes from the ground rim at the bottom of the canvas up to the
 * apex. Painted OPAQUE everywhere, because a hole in it is a hole you can see
 * a card through.
 *
 * NO ARMS ANYWHERE IN IT. Version 2 drew six coloured spiral arms across the
 * flat disc that used to do this job and that is what the user named a
 * pinwheel — a spiral drawn on a disc is a pinwheel whatever it is called in
 * the code. This is lumps: a couple of hundred soft dabs in no arrangement at
 * all, which has no direction in it to be read as spin. What turns is the
 * column standing in the middle of it.
 */
const domeTex = () => tex('dome', (g, W, H) => {
  const rnd = seeded(5);
  // Lighter at the apex, where it catches what light there is, and darkest
  // where it meets the stone — which is also the shadow the funnel is casting
  // into its own dust. Canvas BOTTOM is the ground: three.js flips v.
  const base = g.createLinearGradient(0, H, 0, 0);
  base.addColorStop(0, 'rgba(22,11,18,1)');
  base.addColorStop(0.40, 'rgba(38,20,31,1)');
  base.addColorStop(1, 'rgba(62,38,52,1)');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  const lump = ['#4a1c33', '#150a11', '#6a4557', '#57293f'];
  const put = (col, x, y, sz, al) => {
    g.globalAlpha = al;
    g.drawImage(brush(col), x - sz, y - sz, sz * 2, sz * 2);
    g.drawImage(brush(col), x - sz - W, y - sz, sz * 2, sz * 2);
    g.drawImage(brush(col), x - sz + W, y - sz, sz * 2, sz * 2);
  };
  for (let i = 0; i < 200; i++) {
    const sz = W * (0.05 + rnd() * 0.13);
    put(lump[Math.floor(rnd() * lump.length)], rnd() * W, rnd() * H, sz, 0.07 + rnd() * 0.1);
  }
  // The card's own three colours carried through the debris, in the same three
  // zones and the same order as the wall above it, so the dome and the column
  // are plainly one object.
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 7; i++) {
      const sz = W * (0.035 + rnd() * 0.08);
      put(COL[c].cloth, (c + 0.1 + rnd() * 0.8) * (W / 3), rnd() * H, sz, 0.07 + rnd() * 0.09);
    }
    put(COL[c].lit, (c + rnd()) * (W / 3), rnd() * H * 0.7, W * 0.03, 0.10);
  }
  g.globalAlpha = 1;
}, 256, 128);

/**
 * THE STAIN: the stone going dark under the tornado, and a ring of lifted grit
 * around its foot.
 *
 * Nothing in this motif glows enough to read on its own against lit flagstone,
 * and turning anything up far enough to try takes it straight to white under
 * ACES. Darkening the ground first is what buys the silhouette its contrast,
 * and the ring is the only part of the effect that says the wind is dragging
 * on the floor rather than hovering over it.
 */
const stainTex = () => tex('stain', (g, W) => {
  const c = W / 2;
  // THE DARK IS PUT WHERE IT CAN BE SEEN. A plain blot darkest in the middle
  // does nothing: the middle is under the debris dome, which is opaque, so the
  // only part that ever reaches the camera is the band just outside it.
  const grd = g.createRadialGradient(c, c, 0, c, c, c);
  grd.addColorStop(0, 'rgba(12,4,14,0.55)');
  grd.addColorStop(0.40, 'rgba(11,4,13,0.86)');
  grd.addColorStop(0.62, 'rgba(15,5,18,0.74)');
  grd.addColorStop(0.78, 'rgba(58,16,42,0.30)');
  grd.addColorStop(0.88, 'rgba(46,12,34,0.12)');
  grd.addColorStop(1, 'rgba(46,12,34,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
}, 128, 128);

/**
 * A torn sliver of cloth, long and thin and soft at both ends.
 *
 * It was a fat pentagon first, which at the ten or fifteen pixels these get on
 * screen photographed as CONFETTI — a dozen flat paper shapes sitting beside
 * the column. A sliver drawn out along the direction it is travelling reads as
 * something moving fast instead, which is what it is, and it is the cheapest
 * motion blur there is. The sprite is scaled long on x and short on y and then
 * turned to face the way it is going; three.js scales a sprite before it
 * rotates it, so a non-uniform scale and a rotation compose properly.
 */
const scrapTex = () => tex('scrap', (g, W, H) => {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(W * 0.02, H * 0.52);
  g.lineTo(W * 0.30, H * 0.16);
  g.lineTo(W * 0.66, H * 0.30);
  g.lineTo(W * 0.98, H * 0.46);
  g.lineTo(W * 0.62, H * 0.82);
  g.lineTo(W * 0.26, H * 0.66);
  g.closePath();
  g.fill();
  // soft at both ends, so it is a rag in the wind and not a dart
  g.globalCompositeOperation = 'destination-out';
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.9)');
  grd.addColorStop(0.28, 'rgba(0,0,0,0)');
  grd.addColorStop(0.72, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.9)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}, 96, 40);

/* ------------------------------------------------------------------ bits */

/** A flat decal lying face up. */
function plate(map, size, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity: 0,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  return m;
}

/**
 * A stack of rings, rewritten every frame — a funnel wall or the debris dome.
 *
 * Built by hand rather than with LatheGeometry because the axis has to BEND
 * and the rim has to boil, and a lathe can only ever make a surface of
 * revolution standing straight up. That difference is most of what separates
 * this from the cone it would otherwise be.
 *
 * `shape(u)` is the radius at height fraction u, so the same builder makes the
 * column and the closed dome under it. `solid` writes depth; `lit` takes the
 * arena's light. Nothing additive — see the header.
 */
function shell(RINGS, SEGS, kind, map, shape, opacity, solid, lit) {
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(2, 1);

  const geo = new THREE.BufferGeometry();
  const N = RINGS * (SEGS + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const uv = new Float32Array(N * 2);
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j <= SEGS; j++) {
      const k = (i * (SEGS + 1) + j) * 2;
      uv[k] = j / SEGS;
      uv[k + 1] = i / (RINGS - 1);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // The seam column j = SEGS sits on top of j = 0 in space but carries uv 1
  // instead of uv 0, which is what makes the tiling close without a visible
  // join down one side of the column.
  const idx = [];
  for (let i = 0; i < RINGS - 1; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = i * (SEGS + 1) + j;
      idx.push(a, a + SEGS + 1, a + 1, a + 1, a + SEGS + 1, a + SEGS + 2);
    }
  }
  geo.setIndex(idx);

  // LIT, for the column and the debris; UNLIT for the outer veil.
  //
  // The unlit version of the column photographed as a flat pale lavender haze
  // — every part of it the same value, no near side, no far side, nothing to
  // tell a viewer it had a front and a back. A tornado is read as a volume
  // almost entirely by its SHADING, and this arena has a spotlight over the
  // board that will do that for free. The emissive map is the same canvas at
  // low strength, so the shaded side goes dim rather than black, which is what
  // a lit material does in an arena this dark if it is left to itself.
  //
  // The veil stays unlit on purpose: it is a fringe of loose dust hanging
  // outside the column, and lighting it only gave it a second, competing
  // shaded form beside the one that matters.
  // `solid` is the DOME and only the dome, and it is what lets it write depth.
  // Being opaque, writing depth is what makes the funnel's far wall disappear
  // BEHIND it rather than blend over the top of it — without that the debris
  // looked like it had been painted on a pane of glass in front of the effect.
  // The shells must not write depth: their near-invisible fringe fragments
  // would punch holes in everything drawn after them.
  const mesh = new THREE.Mesh(geo, lit ? new THREE.MeshStandardMaterial({
    map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.30,
    roughness: 1, metalness: 0, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: !!solid,
  }) : new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0, side: THREE.DoubleSide,
    depthWrite: !!solid,
  }));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // The funnel leans right out of its own bounding sphere and the sphere is
  // only computed once, so without this it pops out of existence the moment
  // the top swings past the camera frustum's edge.
  mesh.frustumCulled = false;
  mesh.name = `decoy-${kind}`;
  return { mesh, geo, RINGS, SEGS, shape, opacity, lit };
}

/** A fleck of costume. Sprites, so they face the camera. */
function scrap(hex) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: scrapTex(), color: hex, transparent: true, depthWrite: false, opacity: 0,
    // NOT additive. A handful of coloured flecks crossing each other over a
    // lit flagstone on additive blending is a white cloud, every time.
  }));
}

/* ------------------------------------------------------------------ main */

export function decoy(kit, at) {
  const p = kit.at(at);
  if (!p) return;
  // The tornado belongs to the SQUARE, not to the card — the card is the one
  // thing in this that is about to leave. Pinned to the villager it would have
  // followed him off the board and taken the reveal with it.
  funnel(kit, p.x, p.z);
}

function funnel(kit, cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);

  const stain = plate(stainTex(), 4.4, GROUND_Y);
  // Named so tools/fxdemo/decoy.js can print what is actually on screen and
  // how strongly. Half of this motif is a decal a few dozen pixels across, and
  // at that size "faint" and "never faded up" are the same picture.
  stain.name = 'decoy-stain';
  stain.renderOrder = 2;
  g.add(stain);

  // THE DEBRIS DOME. Opaque, closed, and it is what hides the card.
  const boil = shell(14, 40, 'boil', domeTex(), domeR, 1, true, true);
  boil.mesh.renderOrder = 6;
  g.add(boil.mesh);

  // TWO SHELLS FOR THE COLUMN, not one. The core is the column; the veil is a
  // looser, wider, fainter shell hung outside it turning at a different rate.
  // One shell alone is a printed cylinder however it is painted — it is the
  // PARALLAX between two of them, and the way the near wall of one slides
  // across the far wall of the other, that says the thing has an inside.
  const core = shell(26, 44, 'core', wallTex('core'), prof, 0.98, false, true);
  const veil = shell(20, 36, 'veil', wallTex('veil'), prof, 0.34, false, false);
  core.mesh.renderOrder = 7;
  veil.mesh.renderOrder = 9;
  g.add(core.mesh, veil.mesh);

  // TORN COSTUME CLIMBING THE OUTSIDE. Six strips, two of each colour, each
  // one a short length of helix that travels UP the wall and is replaced at
  // the bottom by the next. They are deliberately SHORT: six full-height
  // helices are a barber pole, which is the pinwheel's cousin.
  const SEG = 26;
  const ribs = [];
  for (let i = 0; i < 6; i++) {
    const col = COL[i % 3];
    // emissive WELL under 1. A standard material's emissive goes through ACES,
    // and this arena is dark enough that the temptation is to crank it — at
    // 1.8 the crimson strip tone-mapped to a white streak and the three
    // colours became one.
    const st = kit.strip({ segments: SEG, width: 0.14, colour: col.hex, emissive: 0.55 });
    // DARK BODY, coloured emissive. Left at its own colour the light-blue
    // strip stood in the lamp below it and tone-mapped to white — three
    // colours of cloth and one of them arriving as paper. Lit by a quarter of
    // itself it keeps its hue whatever is shining on it.
    st.mat.color.setHex(col.hex).multiplyScalar(0.30);
    // No shadows. Six thin strips turning over a spotlit square striped the
    // card underneath, and the stripes moved — during the reveal, which is the
    // one moment that has to be clean.
    st.mesh.castShadow = false;
    st.mesh.name = 'decoy-rib';
    st.mat.depthWrite = false;
    st.mesh.renderOrder = 8;    // over the core, under the veil
    st.mesh.frustumCulled = false;
    g.add(st.mesh);
    ribs.push({
      st,
      phase: (i / 6) * TAU,
      lift: i / 6,                       // where in the climb this one starts
      pts: Array.from({ length: SEG }, () => new THREE.Vector3()),
      // SHORT, and it took a photograph to learn why. At a quarter of the
      // height and a turn and a half of wrap a strip is nearly two units long,
      // and at the waist the column is only one across — so it hung out in
      // clear air beside the funnel and read as a red ribbon being blown past
      // it. Kept under a fifth of the height it stays ON the wall, which is
      // where a piece of costume being dragged up one belongs.
      span: 0.18 + (i % 3) * 0.045,      // how much of the height it covers
      wrap: 0.9 + (i % 2) * 0.5,         // how far round it goes while it does
    });
  }

  // DEBRIS, and it is the single most important thing in here after the
  // outline. A ring that turns is a spinning circle; a ring that turns while
  // everything in it RISES is a tornado. These climb continuously from the
  // first frame — not only at the end, which is what the disc version did and
  // why nothing in it ever went up.
  const scraps = [];
  for (let i = 0; i < 22; i++) {
    const s = scrap(COL[i % 3].hex);
    s.name = 'decoy-scrap';
    s.renderOrder = 10;
    s.visible = false;
    g.add(s);
    scraps.push({
      s,
      u0: i / 22,                              // staggered up the column
      rate: 0.80 + (i % 5) * 0.11,             // and climbing at its own speed
      ang: (i * 2.399) % TAU,                  // golden angle: no spokes
      // WELL outside the wall, not hugging it. Debris painted onto the column
      // is debris nobody can see: it has to be out in clear air beside it,
      // against the flagstone, or the one thing that separates a tornado from
      // a spinning circle — that everything in it is being carried UP — never
      // reaches the picture at all.
      out: 1.30 + (i % 3) * 0.22,
      // A world unit is about 36 screen pixels across at this camera, so the
      // shortest of these is still eleven pixels long. A sub-pixel detail is
      // an absent one.
      len: 0.26 + (i % 4) * 0.055,
      wid: 0.085 + (i % 3) * 0.02,
    });
  }

  // One light, inside the column, so the flagstone and the fighter's own edges
  // take a little colour while the dome is shut over them.
  //
  // DIM AND NEARLY NEUTRAL. A bright saturated magenta at 9 was fine over a
  // flat unlit disc — it was the only colour on the square. The column is a
  // LIT material now, and a strong coloured lamp standing inside it washed
  // every band of the wall to the same magenta: the crimson and the purple
  // became one thing and the card's light blue never reached the screen at
  // all. At 3.2 and half the saturation the wall keeps its own colours and the
  // lamp only lifts the stone.
  const lamp = new THREE.PointLight(0x8a5a76, 0, 5.4, 2);
  lamp.position.y = 0.9;
  g.add(lamp);

  // The angle is ACCUMULATED rather than computed from the clock, because the
  // spin has to be slow while it gathers and fast at the peak, and integrating
  // that by hand each frame is one line against a closed form nobody can read.
  let ang = 0;
  let last = 0;

  /** Rewrite one shell's rings for this frame. */
  const lay = (sh, { base, height, foot, spin, sway, jag, lag, lift = 0, jagLo = 0.25 }) => {
    const pos = sh.geo.attributes.position.array;
    for (let i = 0; i < sh.RINGS; i++) {
      const u = i / (sh.RINGS - 1);
      const r0 = foot * sh.shape(u);
      // THE BEND. Planted at the foot (u squared is zero there) and swinging
      // at the top, on two different periods so it snakes rather than orbits.
      // Without this the wall is a surface of revolution and a surface of
      // revolution is a vase.
      const bend = sway * u * u;
      const bx = bend * Math.sin(last * 1.7 + u * 2.0) + bend * 0.45;
      const bz = bend * Math.cos(last * 1.25 + u * 1.5) * 0.7;
      // The column is turned bodily — texture, bumps and all — rather than
      // scrolling a uv offset, so the two shells can be shared textures and a
      // second cast cannot fight the first over one texture's offset.
      //
      // `lag` is a FIXED shear, not a multiple of the spin: the bottom leads
      // the top by about a fifth of a turn and stays there. Made proportional
      // to the accumulated angle it wound the texture round the column more
      // and more times as the shot went on and the wall smeared to mush.
      const turn = spin + lag * (1 - u);
      for (let j = 0; j <= sh.SEGS; j++) {
        const a = (j / sh.SEGS) * TAU;
        // The raggedness lives in the rotating frame, so the lumps travel
        // round with the column and the OUTLINE boils.
        //
        // `jagLo` is how much raggedness survives at the BOTTOM ring. The
        // column wants a quarter of it there and no more — its foot has a
        // wooden rail and a plinth 1.75 away — but the debris dome wants it
        // all, because the bottom ring IS the dome's outline where it meets
        // the stone, and damped there it photographed as a clean ellipse
        // lying on the flagstone. A clean ellipse on the floor is the exact
        // shape this motif was rejected for.
        const q = jag * (jagLo + (1 - jagLo) * u);
        // `lift` pushes the whole wobble OUTWARD so it can only ever add
        // radius. The debris dome needs that: it is the thing hiding the card,
        // and a dent in it that happens to fall over a corner is a corner you
        // can see. The column has lift 0, so its outline dents as well as
        // bulges, which is most of what makes it boil.
        const r = r0 * (1 + q * (lift
          + 0.12 * Math.sin(3 * a + u * 4.2)
          + 0.07 * Math.sin(5 * a - u * 6.1)
          + 0.05 * Math.sin(7 * a + last * 3.0)));
        const w = a + turn;
        const k = (i * (sh.SEGS + 1) + j) * 3;
        pos[k] = bx + Math.cos(w) * r;
        pos[k + 1] = base + u * height;
        pos[k + 2] = bz + Math.sin(w) * r;
      }
    }
    sh.geo.attributes.position.needsUpdate = true;
    // Only the lit shells need normals, and they need them EVERY frame — the
    // wall is rewritten from scratch each tick, so normals computed once at
    // build time describe a shape that no longer exists and the column lights
    // as though it were a smooth cylinder standing still.
    if (sh.lit) sh.geo.computeVertexNormals();
  };

  kit.hold(g, SPAN, (t) => {
    const s = t * SPAN;

    const grow = smooth(s / 0.30);                        // the column winds up
    const dense = smooth((s - 0.06) / 0.30);              // and thickens
    // ...and then ropes out. FAST at first and slow afterwards, which is both
    // what a rope-out looks like and what the reveal needs: the foot has to be
    // off the new fighter within a fifth of a second of OPEN or the swap
    // happens behind a wall of dust that is still standing there. Stretched
    // over half a second, as it was, the column was still sitting squarely on
    // the card at 780ms and the whole point of the beat was lost.
    const rope = smooth((s - OPEN) / 0.30);
    const fade = smooth((s - OPEN - 0.02) / 0.30);

    ang += (3.0 + 7.0 * dense) * Math.max(0, s - last);
    last = s;

    // THE COLUMN. Grows up out of the stone, stands, then ropes: the foot
    // leaves the ground, the whole thing thins, and it drifts AWAY from the
    // camera as it goes. Lifting alone moves it up the screen, which is
    // already most of the way off the card; the drift takes the last of it off
    // the new fighter's face, and the reveal is the one frame in this that has
    // to be clean.
    //
    // It stretches only a LITTLE as it ropes. At half again its height, with
    // the foot lifting as well, the top of it went clean off the top of the
    // picture — and on the far back row, where the square is already high in
    // the frame, it went off by a wide margin. What sells a rope-out is the
    // thinning and the lift, not the length.
    const height = TALL * (0.14 + 0.86 * grow) * (1 + 0.15 * rope);
    const base = BASE_Y + 1.50 * rope * rope;
    const foot = WALL * (0.52 + 0.48 * grow) * (1 - 0.72 * rope);
    const sway = 0.42 + 0.40 * rope;
    g.position.z = cz - 0.9 * rope * rope;

    lay(core, {
      base, height, foot, sway, jag: 1.45, lag: 0.95, spin: ang,
    });
    lay(veil, {
      // the veil is wider, shorter-lived at the top, more ragged, and turns
      // slower — the two outlines must never agree or they read as one
      base: base + 0.02, height: height * 1.14, foot: foot * 1.07,
      sway: sway * 1.25, jag: 1.9, lag: -0.7, spin: ang * 0.74 + 1.1,
    });
    core.mesh.material.opacity = core.opacity * dense * (1 - fade);
    veil.mesh.material.opacity = veil.opacity * dense * (1 - fade);

    // THE DEBRIS DOME. Packed solid from SHUT, and whipped off in a tenth of
    // a second at OPEN. The fall is much faster than the rise on purpose:
    // something closing over a card is a curtain and something coming off it
    // is a conjuror's hand.
    //
    // It is BUILT AT FULL SIZE and never scaled below what covers the card
    // while it is meant to be covering it — `shut` reaches 1 at SHUT, which is
    // four hundredths before the card starts to go.
    const shut = smooth((s - 0.14) / (SHUT - 0.14));
    const gone = smooth((s - OPEN) / 0.13);
    const swell = (0.40 + 0.60 * shut) * (1 + 0.35 * rope);
    lay(boil, {
      base: BASE_Y + 1.4 * rope * rope,
      height: BOWL_H * swell * (1 - 0.45 * rope),
      foot: swell,
      sway: 0.05, jag: 0.45, lift: 0.26, jagLo: 1, lag: 0.4, spin: ang * 0.5,
    });
    boil.mesh.material.opacity = shut * (1 - gone);
    // Depth is only written while it is genuinely opaque. Left on through the
    // fade it goes on hiding the new fighter after it has stopped being
    // visible itself, and the reveal happens behind an invisible wall.
    boil.mesh.material.depthWrite = boil.mesh.material.opacity > 0.92;

    // THE STAIN: on early, because the ground going dark is the first warning
    // anything is happening; off late, after the square is clear.
    stain.material.opacity = 0.78 * smooth(s / 0.20) * (1 - smooth((s - CLEAR) / 0.46));
    stain.scale.setScalar(0.62 + 0.40 * grow + 0.26 * rope);

    // THE CLIMBING STRIPS. Each is a short length of helix whose whole span
    // slides up the wall and wraps round to the bottom again.
    for (const r of ribs) {
      const p = (r.lift + s * 0.85) % 1.25 - 0.18;
      // A strip is dropped entirely while its span is off the top or below the
      // stone, instead of being clamped there — clamped, all six piled up on
      // the last ring and made a bright collar round the mouth.
      const live = p > -0.16 && p < 1.0;
      r.st.mesh.visible = live && dense > 0.02;
      if (!r.st.mesh.visible) continue;
      let front = 0;
      for (let j = 0; j < SEG; j++) {
        const v = j / (SEG - 1);
        const u = clamp01(p + v * r.span);
        const rr = foot * prof(u) * 1.02;
        const a = r.phase + ang * 1.05 + 0.95 * (1 - u) + v * r.wrap;
        const bend = sway * u * u;
        r.pts[j].set(
          bend * Math.sin(last * 1.7 + u * 2.0) + bend * 0.45 + Math.cos(a) * rr,
          base + u * height,
          bend * Math.cos(last * 1.25 + u * 1.5) * 0.7 + Math.sin(a) * rr,
        );
        front += Math.sin(a);
      }
      r.st.lay(r.pts, { taper: 0.7, twist: s * 3 + r.phase });
      // NOTHING HERE WRITES DEPTH, so a strip on the FAR side of the column
      // paints straight through it at full strength and the column stops
      // having a near and a far. Dimming by which side it is on is a tenth of
      // the cost of sorting and reads the same at this size. The camera is out
      // at +z, so a positive mean sine is the near half.
      const near = 0.34 + 0.66 * clamp01(0.5 + front / SEG);
      const edge = smooth(clamp01(p + 0.16) / 0.14) * (1 - smooth((p - 0.74) / 0.26));
      r.st.mat.opacity = 0.8 * dense * (1 - fade) * near * edge;
    }

    // THE DEBRIS. Rising the whole time, wrapping when it reaches the mouth,
    // and thrown outward once the funnel has let go.
    const flung = clamp01((s - OPEN) / 0.35);
    for (const k of scraps) {
      const raw = k.u0 + s * k.rate * (0.35 + 0.65 * dense);
      const u = raw % 1.18;
      if (u > 1.02 || dense < 0.04) { k.s.visible = false; continue; }
      k.s.visible = true;
      // Out of the wall as it climbs, and further out again once it is flung
      const rr = foot * prof(u) * k.out * (1 + 1.5 * flung * flung);
      // Turning faster low down where the column is tight, which is the one
      // piece of real tornado behaviour that costs nothing to add.
      const a = k.ang + ang * (1.5 - 0.6 * u) + Math.floor(raw / 1.18) * 2.1;
      k.s.position.set(
        sway * u * u * (Math.sin(last * 1.7 + u * 2.0) + 0.45) + Math.cos(a) * rr,
        base + u * height + 1.2 * flung,
        sway * u * u * Math.cos(last * 1.25 + u * 1.5) * 0.7 + Math.sin(a) * rr,
      );
      // TURNED TO FACE THE WAY IT IS GOING. Its velocity is tangential plus
      // the climb; the camera looks down 52 degrees, so world +z lands on the
      // screen at cos(52) of itself and world +y at -sin(52), and the screen
      // angle of the motion follows from those two. Aligned, these read as
      // streaks of torn cloth being whipped round the column; unaligned they
      // were flat paper shapes hanging in the air beside it.
      const vx = -Math.sin(a);
      const vz = Math.cos(a);
      // The rise is deliberately SMALL against the spin. Debris in a vortex
      // is going round far faster than it is going up, so the streaks lie
      // along the circle and sweep across the column; weighted the other way
      // they stood on end and read as needles stuck into it.
      const vy = 0.18 + 1.6 * flung;
      k.s.material.rotation = Math.atan2(0.78 * vy - 0.62 * vz, vx);
      // same near/far dimming as the strips, and the same reason
      const near = 0.36 + 0.64 * clamp01(0.5 + Math.sin(a) * 0.5);
      // fade in off the ground and out at the mouth, or they pop
      const life = smooth(u / 0.10) * (1 - smooth((u - 0.74) / 0.28));
      k.s.material.opacity = 0.70 * dense * life * near * (1 - fade);
      k.s.scale.set(k.len * (1 + 0.45 * u), k.wid * (1 + 0.45 * u), 1);
    }

    // THE LAMP, only while the foot is shut.
    lamp.intensity = 3.2 * smooth((s - 0.18) / 0.22) * (1 - smooth((s - OPEN) / 0.2));
    lamp.position.y = 0.9 + base;
  });
}

/* ------------------------------------------------------- what becomes of it */

/**
 * How long the villager must stay on the board: until the foot is SHUT.
 *
 * SHUT is 0.42 and this is 0.46, so the card starts leaving four hundredths
 * after the debris has packed over it and is finished at 0.66, four hundredths
 * before the foot lifts at 0.70. Every one of those numbers is in the same
 * clock as the tick above. Without a declared wait the engine — which resolves
 * instantly — takes the card off the board on the first frame, and the tornado
 * then closes over an empty square and opens on the same empty square, which
 * is no trick at all.
 */
export const timing = { kill: 0.46 };

const CARD = 0.20;      // and 0.46 + 0.20 = 0.66, which is under the foot

export const exit = {
  /**
   * THE VILLAGER IS TAKEN BY THE TORNADO.
   *
   * The generic return to hand shrinks the intact card and flies it off the
   * near edge of the table in an arc. Under a shut foot that arc is invisible
   * for its first half and then reappears out in the open beyond the debris,
   * which reads as the card SLIDING OUT FROM UNDER the effect — the thing the
   * motif is meant to hide. So the card does not travel at all: it turns on
   * the column's own axis, goes the colour of the cloth, and is eaten, all of
   * it in the dark inside the dome.
   *
   * What says where it went is three flecks of costume flicked out toward the
   * owner's end as the funnel lifts, which is the only part of this the player
   * ever actually sees leave.
   */
  hand(kit, piece, square, ev, done) {
    const at = piece.group.position.clone();
    const yaw = piece.card3d.rotation.y;
    piece.animating = true;

    // EVERY material, not just the face. The edge and the back are their own
    // opaque materials and fading the face alone leaves a dark rectangle lying
    // on the stone — a fighter dissolving into a coaster.
    const mats = [...new Set([].concat(piece.card3d.material))];
    const base = mats.map((m) => [m.color.clone(), m.opacity, m.transparent]);
    for (const m of mats) m.transparent = true;
    const CLOTH = new THREE.Color(0x3a0f2c);

    // The flecks leave as the foot does, not with the card — thrown out of a
    // shut funnel they would be three things crossing an opaque dome.
    kit.after(Math.max(0.01, OPEN - timing.kill), () => toss(kit, at, piece.owner));

    kit.anim.add(CARD, (t) => {
      // DOWN, and barely tilted. The first cut leaned the card 0.5 of a
      // radian as it went, and a card 1.74 wide leaned that far lifts its
      // near edge 0.09 — and the cover it was under at the time sat only 0.06
      // above its face. Photographed at 560ms a wedge of the villager's own
      // portrait was showing through the middle of the effect, which is the
      // one thing this motif exists to prevent. The dome is taller than that
      // cover was and the lean would probably survive now, but the sink is
      // what sells being swallowed anyway.
      const e = t * t;
      piece.group.position.set(at.x, at.y - 0.16 * e, at.z);
      piece.card3d.rotation.y = yaw + 5.2 * e;
      piece.tilt.rotation.x = 0.14 * e;
      piece.tilt.rotation.z = -0.16 * e;
      piece.group.scale.setScalar(1 - 0.72 * e);
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]).lerp(CLOTH, Math.min(1, t * 1.6));
        mats[i].opacity = base[i][1] * (1 - smooth(t / 0.9));
      }
    }, () => {
      // Restore everything borrowed. Pieces are POOLED: a card that came back
      // from the pool a third of its size, plum coloured and half transparent
      // is a ghost on somebody else's turn.
      for (let i = 0; i < mats.length; i++) {
        mats[i].color.copy(base[i][0]);
        mats[i].opacity = base[i][1];
        mats[i].transparent = base[i][2];
      }
      piece.group.position.copy(at);
      piece.group.scale.setScalar(1);
      piece.tilt.rotation.set(0, 0, 0);
      piece.card3d.rotation.y = yaw;
      piece.animating = false;
      done?.();
    });
  },
};

/**
 * Three flecks of costume thrown toward the owner's end.
 *
 * WHERE THEY LAND. kit.hand(owner) is where a returning card goes, but that
 * point is off the table out on the grass, and this arena has trees and
 * boulders standing between the camera and that patch — ./bounce.js pays for
 * the same lesson in its own comments, where an arrival photographed over lit
 * foliage came out as a smudge. These stop on the dark apron just inside the
 * player's own end, and on the LEFT of it, because the right of that end is
 * where the discard pile stands and something drifting toward the graveyard is
 * telling the wrong story.
 */
function toss(kit, from, owner) {
  const h = kit.hand(owner);
  const to = new THREE.Vector3(-h.x * 0.9, 0.9, h.z * 0.72);
  const grp = new THREE.Group();
  const bits = [];
  for (let i = 0; i < 3; i++) {
    const s = scrap(COL[i].hex);
    s.name = 'decoy-fleck';
    // Half as big again as the debris in the column, because these have to
    // cross the dark apron and be read against grass and torchlight rather
    // than against a flagstone. At 0.34 they were nine screen pixels and
    // photographed as dirt on the lens.
    s.scale.set(0.62, 0.20, 1);
    grp.add(s);
    bits.push({ s, lag: i * 0.06, side: (i - 1) * 0.55, spin: (Math.random() - 0.5) * 7 });
  }
  kit.hold(grp, 0.7, (t) => {
    for (const b of bits) {
      const u = clamp01((t - b.lag) / (1 - b.lag));
      b.s.position.lerpVectors(from, to, u);
      b.s.position.x += b.side * Math.sin(u * Math.PI);
      b.s.position.y += Math.sin(u * Math.PI) * 0.6;
      b.s.material.rotation = b.spin * u;
      b.s.material.opacity = 0.95 * smooth(u / 0.12) * (1 - smooth((u - 0.6) / 0.4));
      b.s.scale.set(0.62 * (1 - 0.35 * u), 0.20 * (1 - 0.35 * u), 1);
    }
  });
}
