// WANDER — an uninvited arrival beside an enemy stack.
//
// Shared by 1 card: C164 The Wanderer. "Move this fighter to an unoccupied
// square adjacent to target enemy stack", and it cannot be attacked by
// fighters in stacks. So the picture is a figure nobody invited standing next
// to you, and the stack it is standing next to cannot do anything about it.
//
// WHAT IT IS: a long thin human SHADOW lying on the flagstones, with no
// figure above it. It stands still at two or three places along the way from
// where the Wanderer was to where it now is, and it is never seen crossing
// between them — one goes out as the next comes up, with a few frames where
// you can faintly see it in two places at once. What it leaves behind at each
// place it has left is a patch of bleached stone in its own outline, so by the
// end there is a dotted line of pale marks running back across the board, and
// at the head of it the Wanderer's card and one last shadow stretching out of
// it onto the enemy stack.
//
// THE SHADOW POINTS THE WRONG WAY, and that is the whole uncanny beat. Every
// other shadow on this table falls with the light — arena.js puts the key at
// (-13,15,9) and the braziers are low and warm. This one always points where
// it is going, whichever way that is, and at the last station it turns and
// points at the enemy. Nothing else here is wrong in a way you have to look
// twice at, and this cost nothing to build: it is just an angle.
//
// THE HEAD IS THE ONLY THING THAT TOUCHES THE ENEMY. The body lies on the
// stone and is honestly occluded by the enemy card's near edge; the head is
// lifted onto the card's FACE and rests on their art, and the enemy card does
// not react to it at all. That one-way contact is "cannot be Attacked by
// fighters in stacks" drawn rather than written. It is also why the figure is
// built as TWO decals with a neck gap between them — the gap is where the
// height step from stone to card face hides, so there is no seam to fix.
//
// WHY IT IS DARK. Neutral is a pale bone (0xd8cbb4) and under ACES a pale
// additive anything is a white slab within two frames, so there is no glow in
// this motif at all — every surface here is normal-blended and every value is
// painted into a canvas. The bone is spent on the bleach marks and on a
// hairline round the shadow, and both are laid over a DARKENED patch: darken
// first, then put the pale on top of it. At 0.88 the marks read as chalk and
// at 0.46 they were not on the board at all; 0.72 over a 0.86 shadow is where
// they read as stone that has been wrong-ed rather than painted.
//
// WHAT IT IS NOT:
//  - not voidstep.js. That is a formless dark runner SLIDING across the
//    stones and deliberately passing UNDER the cards. This one never slides:
//    it is a figure, it is still whenever you can see it, and its head is
//    lifted ON TOP of a card rather than hidden beneath one.
//  - not possess.js. That is a card-shaped slab laid over a fighter. Nothing
//    here is ever laid on the Wanderer's own card, and the silhouette is a
//    person, which is the one shape this board does not already own.
//  - not usher.js. That is one square, two rails and a bow wave. This crosses
//    the whole board and has no lane in it.
//
// Preview:  node tools/shot.js --wait 8000 --settle 600 \
//   --url "game/?quick=1&seed=5&t=900" --eval tools/fxdemo/wander.js \
//   --out /tmp/wa.png
// ?t is milliseconds INTO the motif; ?hop=1 plays the one-square version,
// ?look/?fov move the camera, and ?tex=1 dumps this file's own canvases on
// three bands of grey — which is how the silhouette's shape gets judged, since
// on the board it is twenty-five pixels wide and any wrong shape just looks
// dark. The span is 1.36s for a hop and 1.82s across the board, so a shot at
// ?t=1200 is the arrival standing with its whole trail behind it.

import { THREE, CARD_W, CARD_H } from '../kit.js';
import { STEP } from '../../arena.js';
import { squareToWorld } from '../../board.js';

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/* ------------------------------------------------------------------ colour */

// Both values are painted into the canvases rather than set as a material
// tint, because every piece of this is TWO values at once — a dark body with
// a lit edge, or a bone body with a dark halo — and one MeshBasicMaterial can
// only be given one colour.
//
// The dark is not black: the braziers are warm and the flagstones are a warm
// grey, so a neutral black sat on them read as a hole punched in the floor. A
// hair of blue in it (5,5,12) reads as a shadow cast by a light that is not in
// this room, which is the note the whole motif is after. The pale is
// FACTION.Neutral's bone, 0xd8cbb4 = (216,203,180), and it is never additive:
// under ACES a pale additive anything is a white slab within two frames.

/* ----------------------------------------------------------------- heights */

// The flagstone face is 0.080. voidstep.js paid for the lower bound here: at
// 0.092 a big flat decal simply does not draw at this camera, because the
// depth buffer cannot separate a centimetre. 0.115 is clear of the stone and
// still well under a card face at ~0.21, so anything at stone height is
// honestly hidden where a card covers it — which is what makes the last
// shadow appear to come out from UNDER the Wanderer.
const STONE = 0.115;
// A card's face is at about 0.21 and gl.LESS fails on equal, so flat work on
// a card needs 0.055 of clearance or it draws on the stone around the card
// and not on the card at all.
const onCard = (y) => Math.min(y, 0.225) + 0.055;

/* ---------------------------------------------------------------- the body */

// The figure, in world units, measured from the FEET.
//
// SIZE WAS THE FIRST THING WRONG WITH THIS. A 1.8 x 0.6 figure measured out
// on paper looked right and on screen was forty pixels long and ten wide — a
// dark comma. The board's own scale is the only honest guide: a card is 1.74
// across and about sixty pixels, so a fighter's shadow has to be of that
// order, not a fraction of it.
//
// It also changes shape with the direction it points, and there is nothing to
// be done about that: the camera's elevation is fixed, so a world unit across
// the screen is about 34 pixels and a world unit into it is about 23. The
// same figure is 80px long and 25 wide pointing sideways, and 60 by 32
// pointing at the player. Both read; they are just different views of the
// same shadow, which is what a real one does.
const BODY_LEN = 2.10;
const BODY_WID = 0.92;
const NECK = 0.13;                 // the gap between the shoulders and the head
const HEAD = 0.52;
const FIG_LEN = BODY_LEN + NECK + HEAD;
// Half of CARD_H is 0.88, so the card one square away begins at 1.74 and its
// middle is at STEP = 2.62. The head lands at 2.49 — on their card, but on the
// near third of it, so their art is still readable underneath.
const HEAD_X = BODY_LEN + NECK + HEAD / 2;

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, paint, w, h) {
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
 * Half the width of the body at u along it, 0 = feet, 1 = neck, as a fraction
 * of half the canvas height.
 *
 * The first cut tapered evenly from wide shoulders down to a point at the
 * feet, and what came out was a TADPOLE — a fat blunt end with a tail and a
 * dot in front of it. What makes a smear of dark read as a PERSON at fifteen
 * pixels across is three things and nothing else: a wide flat SHOULDER, a
 * sharp pinch above it, and legs that stay roughly one width all the way to
 * the ground instead of running out to nothing.
 */
// The shoulders used to add 0.52 on top of 0.46, which took the figure to 0.98
// — the full width of its own ribbon — and blown up on the bench that is not a
// person, it is a SPOON: a straight handle with a round bowl on the end, and
// the bowl reads as the head, which leaves the real head floating past it as a
// second one. A human shadow is about a quarter as wide as it is long at the
// shoulders. This tops out at 0.74, so the widest point is plainly narrower
// than the ribbon it lies in and the figure has a silhouette instead of
// filling its own box.
// And the flare is SLOW. Squeezed into u 0.66 to 0.86 the figure was a bar
// with a ball stuck on the end of it; a person seen from above widens from the
// hips to the shoulders over most of the torso, and that slope is what tells
// the eye which end is which.
// The LEGS carry more of the width than they did (0.36 rather than 0.30) and
// the shoulders add less (0.26 rather than 0.32). The maximum is the same, so
// the figure is no wider than before; what changed is the ratio. At 0.30 to
// 0.72 the silhouette was a wedge two and a half times wider at one end than
// the other with a dot in front of it, and photographed on the board that is
// not a person walking, it is an ARROW pointing at the enemy — which is the
// one thing on this table a shadow must never be mistaken for, since the
// board draws real arrows to say where you may move.
const halfW = (u) => (0.36
  + 0.08 * smooth((u - 0.18) / 0.30)          // hips
  + 0.26 * smooth((u - 0.50) / 0.34))         // torso opening to the shoulders
  * (1 - 0.58 * smooth((u - 0.88) / 0.12));   // and the pinch of a neck

// The centreline is not straight. A perfectly mirrored silhouette reads as a
// printed symbol — a logo lying on the board — and a couple of per cent of
// lean is the difference between a mark and a body standing badly.
const mid = (u) => 0.5 + 0.038 * Math.sin(u * 4.1 + 1.2);

/** The body silhouette as a canvas path, from x0 to x1 across a canvas H tall. */
function bodyPath(g, x0, x1, H) {
  const N = 48;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = x0 + (x1 - x0) * u;
    const y = H * (mid(u) - halfW(u) * 0.5);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    g.lineTo(x0 + (x1 - x0) * u, H * (mid(u) + halfW(u) * 0.5));
  }
  g.closePath();
}

/**
 * A wedge taken out of the bottom third along the centreline, so the legs are
 * two and not one. Three pixels of gap on screen and worth every one of them:
 * without it the lower half is a plank, and a plank with shoulders on it is a
 * bottle.
 */
function legSplit(g, W, H, x0, x1) {
  g.globalCompositeOperation = 'destination-out';
  // 0.08 of the canvas either side and barely blurred. At 0.05 with a 4.5px
  // blur the notch was narrower than its own penumbra and closed up again: the
  // bench dump showed a plank with no split in it at all.
  g.filter = `blur(${H * 0.025}px)`;
  g.fillStyle = 'rgba(0,0,0,1)';
  g.beginPath();
  g.moveTo(x0, H * (mid(0) - 0.08));
  g.lineTo(x0 + (x1 - x0) * 0.40, H * mid(0.40));
  g.lineTo(x0, H * (mid(0) + 0.08));
  g.closePath();
  g.fill();
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
}

/**
 * Thinned at the FEET so the shadow dissolves into the stone rather than
 * starting at a line, and a little at the head end too: a cast shadow softens
 * as it gets further from whatever is casting it, and an even black from end
 * to end read as a paper cut-out lying on the floor.
 */
function alongFade(g, W, H) {
  const a = g.createLinearGradient(0, 0, W, 0);
  // 0.58 at the feet and not 0.30. Together with the taper, fading the far
  // end to less than a third finished the wedge off into a POINT, and the
  // whole figure read as an arrowhead lying on the stone.
  a.addColorStop(0.00, 'rgba(0,0,0,0.58)');
  a.addColorStop(0.18, 'rgba(0,0,0,0.92)');
  a.addColorStop(0.55, 'rgba(0,0,0,1)');
  a.addColorStop(1.00, 'rgba(0,0,0,0.86)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = a;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

// THE TWO STATES ARE A VALUE PAIR, and that is what makes the motif legible
// on a board whose stones run from nearly white by a brazier to nearly black
// in a corner. Where it IS is a dark figure with a hairline of bone on its
// edge; where it WAS is a bone figure with a dark aura around it. Whichever
// square a mark lands on, one of the two values has the stone beaten.
//
// An OUTLINE was tried for the marks first and is useless here: the figure is
// fifteen screen pixels wide, so a stroke of any weight the canvas can draw
// lands under half a pixel and all three marks came out as pale wisps — smoke,
// not a shape. At this size everything has to be a filled silhouette.

/** Where it is: dark, with the edge just catching. */
const bodyTex = () => tex('wa-body', (g, W, H) => {
  const x0 = W * 0.02, x1 = W * 0.985;
  const path = () => bodyPath(g, x0, x1, H);
  // A 0.15 penumbra is 15px on a canvas 25 screen pixels tall — the whole
  // figure was inside its own blur, which is why the first board shots showed
  // a smear rather than a shape. 0.09 still lifts it off lit stone.
  g.filter = `blur(${H * 0.09}px)`;             // separates it from lit stone
  g.fillStyle = 'rgba(3,3,8,0.46)';
  path(); g.fill();
  g.filter = `blur(${H * 0.028}px)`;
  g.fillStyle = 'rgba(5,5,12,0.98)';
  path(); g.fill();
  g.filter = `blur(${H * 0.022}px)`;
  g.strokeStyle = 'rgba(216,203,180,0.34)';
  g.lineWidth = H * 0.055;
  path(); g.stroke();
  g.filter = 'none';
  legSplit(g, W, H, x0, x1);
  alongFade(g, W, H);
}, 228, 100);

/** The head that goes with it: an egg, leaning the way the shoulders do. */
const headTex = () => tex('wa-head', (g, W, H) => {
  const egg = () => {
    g.beginPath();
    g.ellipse(W * 0.50, H * 0.52, W * 0.34, H * 0.38, 0.22, 0, Math.PI * 2);
  };
  g.filter = `blur(${W * 0.14}px)`;
  g.fillStyle = 'rgba(3,3,8,0.46)';
  egg(); g.fill();
  g.filter = `blur(${W * 0.04}px)`;
  g.fillStyle = 'rgba(5,5,12,0.98)';
  egg(); g.fill();
  // A thinner, fainter rim than the body's. At 0.34 on a line a sixteenth of
  // the canvas wide the head came off the bench as a DONUT — a bright ring
  // with a dark hole — because the stroke is drawn on the ellipse's own path
  // and half of it lands inside a shape that is only thirty pixels across.
  g.filter = `blur(${W * 0.025}px)`;
  g.strokeStyle = 'rgba(216,203,180,0.22)';
  g.lineWidth = W * 0.035;
  egg(); g.stroke();
  g.filter = 'none';
}, 96, 88);

/**
 * Where it WAS: the stone bleached in the shape of it, head and all, with the
 * dark of the shadow left as a halo round the outside.
 *
 * Bitten into in three places. A clean unbroken stamp of a figure looked
 * printed — and this board already draws crisp geometry on its squares to say
 * "you may click this", which is the one thing a mark left by something
 * uninvited must not look like.
 */
const bleachTex = () => tex('wa-bleach', (g, W, H) => {
  const x0 = W * 0.006, x1 = W * (BODY_LEN / FIG_LEN);
  const hx = W * (HEAD_X / FIG_LEN);
  // THE HEAD WAS THE WRONG SHAPE, and it is why the trail photographed as a
  // white splat with a second white dot in front of it rather than as a
  // person. The canvas runs x ALONG the figure and y ACROSS it, and the old
  // ellipse was 0.064W along by 0.38H across — a head a fifth as long as it
  // is wide, and as wide as the shoulders. Both radii now come off the same
  // world measurements the body mesh uses: HEAD is 0.52 world on a ribbon
  // BODY_WID wide and FIG_LEN long, so it is round, and it is plainly
  // narrower than the shoulders.
  const hrx = W * (HEAD / FIG_LEN) * 0.5;
  const hry = H * (HEAD / BODY_WID) * 0.5;
  const shapes = () => {
    bodyPath(g, x0, x1, H);
    // ...and a NECK, which the body mesh does not need because there the gap
    // is where the step up onto a card's face hides. On bare stone there is
    // no step, so the gap was simply a hole, and a silhouette broken in two
    // at fifteen pixels is two marks and not a figure.
    const ny = H * (mid(1) - 0.10), nh = H * 0.20;
    g.moveTo(x1 - W * 0.01, ny);
    g.lineTo(hx, ny);
    g.lineTo(hx, ny + nh);
    g.lineTo(x1 - W * 0.01, ny + nh);
    g.closePath();
    g.moveTo(hx + hrx, H * 0.52);
    g.ellipse(hx, H * 0.52, hrx, hry, 0.22, 0, Math.PI * 2);
  };
  // BOTH VALUES HAD TO GO UP. At 0.46 bone over 0.62 dark, times a material
  // opacity of 0.6, a mark on the flagstones came out at about a quarter of an
  // alpha of a colour the flagstones already are — photographed at 900ms, with
  // two marks reported at 0.600 by the bench, the board was bare stone. The
  // dark halo is what actually does the work on a lit square and the bone is
  // what does it on a dark one, so neither can be a whisper.
  // 0.72 and not 0.88. At 0.88 the marks stopped being bleached STONE and
  // became chalk: three near-white smears lying on the flagstones, brighter
  // than anything else in the frame including the braziers, which is exactly
  // the trap the header warns about for pale bone. The dark under them went up
  // instead, and its penumbra reaches further, so each mark sits in a shadow
  // of its own and is read as a patch of floor that is wrong rather than as
  // something painted on top of the floor.
  // 0.13 of blur and not 0.19. The figure is fifteen screen pixels across and
  // a 19px penumbra on a 100px canvas is wider than the shape inside it, so
  // what landed on the stone was a soft oval with a silhouette somewhere in
  // the middle of it. The dark still has to reach further than the bone —
  // that is what sits the mark in its own shadow — but not four times as far.
  g.filter = `blur(${H * 0.13}px)`;              // the dark first
  g.fillStyle = 'rgba(6,5,10,0.90)';
  shapes(); g.fill();
  // 0.50 and not 0.72. THE ARENA GOT DARKER SINCE THIS WAS TUNED: the key is
  // now a spotlight confined to the board and the apron round it is nearly
  // black, and a bone at 0.72 over that is no longer bleached stone, it is
  // the brightest thing in the frame — three chalk smears brighter than the
  // braziers. The value that does the work on dark stone is the DARK halo
  // above; the bone only has to be a shade paler than the flagstone it lies
  // on, which is all a bleach is.
  g.filter = `blur(${H * 0.045}px)`;             // then the bone on top of it
  g.fillStyle = 'rgba(223,212,192,0.50)';
  shapes(); g.fill();
  g.filter = 'none';
  legSplit(g, W, H, x0, x1);
  g.globalCompositeOperation = 'destination-out';
  g.filter = `blur(${H * 0.11}px)`;
  for (const [x, y, r] of [[W * 0.17, H * 0.28, H * 0.24], [W * 0.46, H * 0.82, H * 0.20],
    [W * 0.70, H * 0.22, H * 0.17]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
}, 300, 100);

/* ------------------------------------------------------------------ board */

/** Every piece the kit will admit to, defensively. */
function allPieces(kit) {
  const src = kit.pieces;
  if (!src) return [];
  try {
    if (src.byUid?.values) return [...src.byUid.values()];
    if (typeof src.values === 'function') return [...src.values()];
    if (Array.isArray(src)) return src;
  } catch { /* a motif never throws on the table */ }
  return [];
}

/** How many fighters are standing on each of the nine squares, by side. */
function census(pieces) {
  const by = new Map();
  for (const p of pieces) {
    const sq = p?.square;
    if (!(sq >= 0 && sq < 9)) continue;
    let e = by.get(sq);
    if (!e) by.set(sq, (e = { n: 0, owner: p.owner }));
    e.n++;
  }
  return by;
}

/**
 * The enemy STACK the arrival is beside — two or more of theirs on one
 * square, and the nearest such if there is a choice, because the rule says
 * the Wanderer ends up ADJACENT to it and the nearest one is the one the
 * player will read as the target. A lone enemy will do if there is no stack;
 * if there is no enemy at all the figure keeps facing the way it was walking.
 */
function enemyStack(pieces, mySq, mine) {
  const by = census(pieces);
  let best = null;
  for (const [sq, e] of by) {
    if (e.owner === mine) continue;
    const d = mySq == null ? 0 : squareToWorld(sq).distanceTo(squareToWorld(mySq));
    const rank = (e.n >= 2 ? 0 : 100) + d;
    if (!best || rank < best.rank) best = { sq, rank };
  }
  return best?.sq ?? null;
}

/**
 * Where it came FROM. The card has already been moved by the time a motif
 * runs, so the journey has to be reconstructed — and the honest answer is
 * "somewhere else on this board". The furthest EMPTY square is chosen: empty
 * because a trail of marks laid over other fighters reads as something having
 * happened to them, and furthest because the length of the walk is the point.
 */
function origin(pieces, mySq) {
  const by = census(pieces);
  const here = squareToWorld(mySq ?? 4);
  let best = null;
  for (let sq = 0; sq < 9; sq++) {
    if (sq === mySq) continue;
    const d = squareToWorld(sq).distanceTo(here);
    const rank = d - (by.has(sq) ? 90 : 0);   // an occupied square only if nothing else
    if (!best || rank > best.rank) best = { sq, rank };
  }
  return best?.sq ?? null;
}

/**
 * The face height of whatever is lying at a point, or null for bare stone.
 *
 * The HIGHEST match, not the first: a stack has a buried card sitting a
 * centimetre and a half below its top one and offset back and left, so both
 * answer the footprint test, and taking whichever came out of the map first
 * put the shadow under the top card half the time.
 */
function coverAt(pieces, x, z) {
  let y = null;
  for (const p of pieces) {
    const q = p?.group?.position;
    if (!q) continue;
    if (Math.abs(q.x - x) < CARD_W * 0.5 && Math.abs(q.z - z) < CARD_H * 0.5) {
      const h = onCard(q.y);
      if (y == null || h > y) y = h;
    }
  }
  return y;
}

/* ------------------------------------------------------------------- time */

// kit.hold hands the tick a FRACTION of the span, so everything below is a
// fraction and SPAN is the only number in seconds. It scales with the length
// of the walk: a one-square hop given the cross-board timing spent most of a
// second with nothing on screen.
// THE ARRIVAL IS THE PAYOFF AND IT WAS ON SCREEN FOR A TENTH OF A SECOND.
// With the last station only reaching full at 0.66 and the body already going
// out at 0.84, a shot taken at 900ms — the exact moment the Wanderer is
// supposed to be standing over the enemy stack — caught it at 0.13 opacity,
// and the bench confirmed nothing on the board was above 0.14. The walk now
// finishes in the first half of the span and the whole back half is the
// arrival STANDING there with its trail still behind it, which is the picture
// the motif exists to make.
const ARRIVE = 0.52;               // the last station is up by here
const FADE0 = 0.84;                // the trail starts going out
const GONE = 0.14;                 // and everything is out by t = 1
/* ------------------------------------------------------------------ meshes */

const lit = (map, order) => {
  const m = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  m.userData = { order };
  return m;
};

/**
 * The figure is not a flat quad. It is a RIBBON down its own length whose
 * height is sampled square by square, so where it runs under a card it is at
 * stone height and honestly occluded, and where it lies on one it is up on
 * the card's face.
 *
 * This is not a nicety. Two adjacent squares are STEP = 2.62 apart and a card
 * is 1.76 deep, so there is only 0.86 of bare stone between them: a flat
 * shadow at stone height laid from the Wanderer toward the enemy showed as a
 * twenty-pixel sliver in that gap and nothing else, and four passes of shots
 * had a last station that looked as though it had failed to fire. Climbing
 * the enemy's card is what gives the arrival anything to look at — and it is
 * the right picture anyway, because the only part of this that touches them
 * is the shadow lying across their fighter.
 */
function ribbon(map, len, wid, yAt, order) {
  const N = 24;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((N + 1) * 2 * 3);
  const uv = new Float32Array((N + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = u * len;
    const y = yAt(x);
    for (let j = 0; j < 2; j++) {
      const k = i * 2 + j;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = (j ? 0.5 : -0.5) * wid;
      uv[k * 2] = u; uv[k * 2 + 1] = j;
    }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, lit(map, order));
  // A card carries its own decal plate for its badges, and anything left at
  // the default order can be painted over by it.
  m.renderOrder = order;
  m.frustumCulled = false;
  return m;
}

/** The head, which is small enough to sit at one height. */
function egg(map, size, y, order) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.92), lit(map, order));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = order;
  return m;
}

export function wander(kit, at) {
  const dest = kit.at(at);
  if (!dest) return;

  const pieces = allPieces(kit);
  const me = kit.piece(at);
  const mySq = me?.square ?? (typeof at === 'number' && at >= 0 && at < 9 ? at : null);
  const mine = me?.owner ?? 0;

  const fromSq = origin(pieces, mySq);
  const from = fromSq == null ? dest.clone().setZ(dest.z - STEP * 2) : squareToWorld(fromSq);
  const walk = new THREE.Vector3(dest.x - from.x, 0, dest.z - from.z);
  const dist = walk.length();
  if (dist < 0.01) walk.set(0, 0, -1); else walk.normalize();

  // Where it ends up FACING. rotation.y maps local +x onto (cos y, 0, -sin y).
  const foeSq = enemyStack(pieces, mySq, mine);
  const aim = walk.clone();
  if (foeSq != null) {
    const f = squareToWorld(foeSq);
    const v = new THREE.Vector3(f.x - dest.x, 0, f.z - dest.z);
    if (v.lengthSq() > 0.01) aim.copy(v.normalize());
  }
  const yawOf = (d) => Math.atan2(-d.z, d.x);

  // HOW MANY TIMES IT IS SEEN. Four stations, one per square walked, is what
  // this had first and it was wrong for a reason that only shows up in a
  // shot: the figure is 2.75 long and four stations across the board are 2.47
  // apart, so every mark it left OVERLAPPED the next one and the trail came
  // out as a single unbroken white stroke painted across the flagstones. The
  // spacing has to be the FIGURE'S length, not the board's, and at three
  // stations they stand clear of each other. Three is also simply less, which
  // this motif wants.
  const n = Math.max(2, Math.min(3, Math.round(dist / (FIG_LEN * 1.25)) + 1));
  // Longer than it was. The old 1.32s for a cross-board walk had to fit three
  // stations, two marks and an arrival into it, and every one of them got a
  // couple of hundred milliseconds — a flicker each rather than a figure that
  // stands still, which is the one thing this motif said it was going to do.
  const SPAN = 0.90 + 0.46 * (n - 1);
  const step = ARRIVE / (n - 1);
  const IN = step * 0.36, HOLD = step * 0.74, OUT = step * 0.40;

  const g = new THREE.Group();
  const marks = [];

  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const u = i / (n - 1);
    const p = new THREE.Vector3(from.x + walk.x * dist * u, 0, from.z + walk.z * dist * u);
    const dir = last ? aim : walk;
    const yaw = yawOf(dir);

    // The figure's own frame: local +x from the feet toward the head.
    const st = new THREE.Group();
    st.position.set(p.x, 0, p.z);
    st.rotation.y = yaw;

    // The ground under this figure, sampled along its own length.
    const yAt = (x) => coverAt(pieces, p.x + dir.x * x, p.z + dir.z * x) ?? STONE;

    const body = ribbon(bodyTex(), BODY_LEN, BODY_WID, yAt, 3);
    const head = egg(headTex(), HEAD, yAt(HEAD_X), 4);
    head.position.x = HEAD_X;

    st.add(body, head);
    g.add(st);

    // The mark it leaves. The station it is standing on now does not get one —
    // it has not left yet, and a mark under the card that is plainly there is
    // just a smudge.
    let mark = null;
    if (!last) {
      // Put in the STATION's frame rather than the world's. Laid in world
      // space it needed a second rotation stacked on the -90° about x that
      // makes it flat, and Euler order then had it lying at the wrong angle on
      // three squares out of four; in the station's frame it is simply the
      // same +x as the body.
      mark = ribbon(bleachTex(), FIG_LEN, BODY_WID, (x) => yAt(x) - 0.002, 2);
      st.add(mark);
    }

    marks.push({ body, head, mark, on: i * step, last, i });
  }

  kit.hold(g, SPAN, (t) => {
    for (const s of marks) {
      // It is never seen ARRIVING at a station and never seen leaving one: it
      // fades up standing still and fades down standing still, and the two
      // envelopes overlap by about a tenth of a station, so for a handful of
      // frames it is faintly in two places. That overlap is the whole trick —
      // cut hard between the two it read as a dropped frame, and separated by
      // a gap it read as a light being switched on and off.
      let a;
      if (s.last) {
        a = smooth((t - s.on) / IN);
      } else {
        a = smooth((t - s.on) / IN) * (1 - smooth((t - s.on - HOLD) / OUT));
      }
      // The body goes before the head at the end, so the last thing on screen
      // is a dark spot lying on the enemy's card.
      // The body goes before the head at the end, and both are out by t = 1:
      // kit.hold removes the group on the last frame, so anything still lit
      // when the span runs out is a pop rather than a fade.
      s.body.material.opacity = 0.92 * a
        * (s.last ? 1 - smooth((t - (1 - GONE)) / (GONE * 0.75)) : 1);
      s.head.material.opacity = 0.95 * a
        * (s.last ? 1 - smooth((t - (1 - GONE * 0.6)) / (GONE * 0.6)) : 1);

      if (!s.mark) continue;
      // The mark appears as the figure leaves, not as it arrives: it is what
      // is left, not what it stood in.
      const b0 = s.on + HOLD * 0.72;
      // 0.9, not 0.6. At 0.6 of a canvas whose bone was itself only 0.46 the
      // mark was a quarter of an alpha of a colour the flagstones already are,
      // and the trail — the whole record of the walk — was not on the board at
      // all. See bleachTex.
      s.mark.material.opacity = 0.80 * smooth((t - b0) / (step * 0.5))
        // and the oldest goes out first, so the trail retreats toward the
        // Wanderer rather than all of it switching off together.
        * (1 - smooth((t - FADE0 - s.i * 0.03) / (1 - FADE0 - s.i * 0.03)));
    }
  });
}
