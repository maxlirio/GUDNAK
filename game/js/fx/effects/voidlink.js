// VOIDLINK — a fighter stands still and the Void feeds it.
//
// Shared by 5 Auroxi cards: M178 Shadow Soldier and M184/M187 Shadow Hunter
// ("this fighter has the abilities of all fighters that are in The Void and
// share a trait with it"), plus Black Aurox and Living Stronghold, which make
// the squares beside them count as adjacent to The Void. Every one of them is
// the same sentence: SOMETHING OVER THERE IS PART OF THIS FIGHTER.
//
// So the motif is a LINE, and it is the only line in the game drawn to the
// pit. The Void is a real object out to the left at square 9 — board.js draws
// it at `squareToWorld(9)` — and a cord of plied shadow-cloth is spun out of
// its throat, carried across the board and laid onto the fighter, which never
// moves. Three beads of cold light then run down it from the pit to the card,
// and when it is over the cord is not switched off: its tail runs up the span
// and is swallowed by the fighter, because what was borrowed is now HELD.
//
// NOT VOIDSTEP. voidstep.js already owns the other half of this relationship
// and the two must never be mistaken for each other at sixty pixels, so every
// choice here is its opposite:
//   - voidstep runs UNDER the board at flagstone height and is occluded by
//     every card it passes; this is carried a full unit ABOVE the cards and
//     occludes them. The arch is the whole reason it reads as a link rather
//     than as a shadow crawling about.
//   - voidstep travels card → pit → card and the card leaves with it; this
//     goes pit → card once and the card stays exactly where it was.
//   - voidstep's only light is two hairlines down the sides of a shadow; this
//     is a lit cord over a DARK BAND painted on the stones beneath it. That
//     band is the shadow the cord would cast, and it is what tells the eye the
//     cord is up in the air — without it the span read as a violet wire
//     printed on the flagstones and the whole height of the arch was lost.
//
// THE PLY IS PAINTED, NOT BUILT. The first cut ran two strands helically
// round the spine: at this camera each strand came out four pixels wide and
// the braid was a shimmer. The cord is now one ribbon about ten pixels across
// with the twist in its map, on the same rule cloth-kit.js's weave was drawn
// by — coarse bands that survive, rather than fine ones that alias. The map
// scrolls toward the fighter each frame, so the cord is visibly RUNNING IN
// even in the beats when no bead is on it.
//
// Colour is the Void's own, from board.js `spiralTexture`: blue at the throat
// (96,170,255), purple between (126,86,240), and 0x7a4cf0 for the spill light.
// Using those exact values is what makes the cord and the pit one object. The
// cord is NOT additive — ACES turns an additive rope into a white slab and
// eats a third of the blue on the way — so it is a lit map on NormalBlending
// and only the beads and the halo are allowed to add.
//
// Preview:  node tools/shot.js --wait 10000 --settle 600 \
//   --url "game/?quick=1&seed=5&p0=The%20Voidbringers&t=420" \
//   --eval tools/fxdemo/voidlink.js --out /tmp/vl.png
// THE DECK MATTERS: ?p0= falls back to the first deck SILENTLY when the name
// misses, and without The Voidbringers there is no pit to draw from.

import { THREE, CARD_W, CARD_H, easeOut, easeIn } from '../kit.js';
import { squareToWorld, VOID_SQUARE } from '../../board.js';
import { blobTexture } from '../../textures.js';

/* ---------------------------------------------------------------- colour */

const THROAT = 0x8fc4ff;   // the blue at the centre of the spiral
const VIOLET = 0x7a4cf0;   // the Void's own spill light, from board.js
const CORD = 0x9a6cf5;     // the cord itself: violet lifted enough to read
                           // against near-black stone without going lilac

/* --------------------------------------------------------------- heights */

// The flagstone face is 0.080 and a card's slab runs 0.185 to 0.220.
//
// STONE is voidstep's number and it is not a free choice: at 0.092 a flat
// decal does not draw AT ALL at this camera — the depth buffer cannot
// separate a centimetre — while a ribbon four millimetres above it does.
// 0.118 draws reliably and is still well under a card, which is what the dark
// band beneath the cord wants: it is a shadow, so it belongs behind the cards
// it passes.
const STONE = 0.118;
const FACE = 0.215;        // a card's face, as thread.js has it
const ON_CARD = FACE + 0.06;   // anything flat that must survive OVER a card
// The cord's shadow has to be ABOVE the cards, which sounds wrong and is not.
// Laid at flagstone height the band was hidden under exactly the cards it
// existed to prove the cord was flying over — the gaps between squares are
// four pixels wide, so there was nowhere for it to show. A shadow falls on
// whatever is under it, card faces included, so it is drawn on top of them.
const SHADE_Y = FACE + 0.06;

/* -------------------------------------------------------------- textures */

// Cached for the life of the page: kit.hold disposes materials, and a
// material never disposes its map.
const TEXES = new Map();
function tex(key, paint, w = 256, h = 64, wrap = false) {
  let t = TEXES.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (wrap) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; }
    TEXES.set(key, t);
  }
  return t;
}

/**
 * The cord: a twisted two-ply rope. x runs ALONG it and repeats; y is across.
 *
 * The shading is in the map and the colour is on the material, which is the
 * only arrangement that survives here — a flat-coloured strip has nothing for
 * the dark to bite on and reads as a drawn line, and an additive one is a
 * white slab under ACES. So this is a greyscale rope: near-black at both
 * selvedges, a hot line just off centre where a round thing catches the light
 * from above, and coarse diagonal ply bands.
 *
 * THE BANDS ARE DELIBERATELY FAT. One repeat is a world unit, which is about
 * thirty-five pixels, and two bands in it puts a ply at seventeen. Eight bands
 * — the first cut, and what a real rope looks like — was two pixels a band and
 * came out as a shimmering grey stripe with no twist in it at all.
 */
const cordTex = () => tex('vl-cord', (g, W, H) => {
  // across: dark edges, a bright shoulder above the middle
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, '#141024');
  across.addColorStop(0.20, '#3d2d78');
  across.addColorStop(0.38, '#d9ccff');
  across.addColorStop(0.52, '#8b74e6');
  across.addColorStop(0.80, '#2a1f52');
  across.addColorStop(1.00, '#100c1e');
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);

  // the ply. Drawn past both ends so the diagonals meet across the seam —
  // a band that stops at the edge of the canvas puts a visible joint every
  // repeat, and on a scrolling map that joint marches down the rope.
  g.lineCap = 'butt';
  for (let i = -2; i < 4; i++) {
    const x = (i * W) / 2;
    g.strokeStyle = 'rgba(255,255,255,0.40)';
    g.lineWidth = H * 0.34;
    g.beginPath(); g.moveTo(x, H + 4); g.lineTo(x + H * 1.15, -4); g.stroke();
    g.strokeStyle = 'rgba(6,2,16,0.62)';
    g.lineWidth = H * 0.30;
    g.beginPath(); g.moveTo(x + H * 0.66, H + 4); g.lineTo(x + H * 1.81, -4); g.stroke();
  }

  // and the selvedge feather, so the rope has no ruled edge
  const alpha = g.createLinearGradient(0, 0, 0, H);
  alpha.addColorStop(0.00, 'rgba(0,0,0,0)');
  alpha.addColorStop(0.16, 'rgba(0,0,0,0.85)');
  alpha.addColorStop(0.34, 'rgba(0,0,0,1)');
  alpha.addColorStop(0.68, 'rgba(0,0,0,1)');
  alpha.addColorStop(0.88, 'rgba(0,0,0,0.80)');
  alpha.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = alpha;
  g.fillRect(0, 0, W, H);
}, 64, 32, true);

/**
 * The halo carried either side of the cord: no ply, no edge, just a falloff.
 *
 * The cord alone is ten pixels of violet on nearly black stone and it read as
 * a scratch. This is three times its width at a tenth of its strength, and it
 * is what gives the span a body — the same trick voidstep's haze plays with
 * darkness, run the other way round because this one is in the light.
 */
const haloTex = () => tex('vl-halo', (g, W, H) => {
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, 'rgba(255,255,255,0)');
  across.addColorStop(0.30, 'rgba(255,255,255,0.30)');
  across.addColorStop(0.50, 'rgba(255,255,255,1)');
  across.addColorStop(0.70, 'rgba(255,255,255,0.38)');
  across.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 8, 64);

/**
 * The band of shade the cord throws on the flagstones under it. Soft both
 * ways: it has to darken and then stop darkening, with no silhouette of its
 * own, or it reads as a mat someone laid on the board.
 */
const shadeTex = () => tex('vl-shade', (g, W, H) => {
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(255,255,255,0)');
  along.addColorStop(0.16, 'rgba(255,255,255,0.75)');
  along.addColorStop(0.55, 'rgba(255,255,255,1)');
  along.addColorStop(1.00, 'rgba(255,255,255,0.85)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.28, 'rgba(0,0,0,0.42)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.72, 'rgba(0,0,0,0.42)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 128, 64);

/**
 * A bead: what actually travels. A comet, not a dot — bright at the nose and
 * trailing away behind, so it has a direction of travel in a single frame. x
 * is tail (0) to nose (1).
 */
const beadTex = () => tex('vl-bead', (g, W, H) => {
  const along = g.createLinearGradient(0, 0, W, 0);
  along.addColorStop(0.00, 'rgba(255,255,255,0)');
  along.addColorStop(0.42, 'rgba(255,255,255,0.30)');
  along.addColorStop(0.82, 'rgba(255,255,255,0.95)');
  along.addColorStop(0.94, 'rgba(255,255,255,1)');
  along.addColorStop(1.00, 'rgba(255,255,255,0.15)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  const across = g.createLinearGradient(0, 0, 0, H);
  across.addColorStop(0.00, 'rgba(0,0,0,0)');
  across.addColorStop(0.32, 'rgba(0,0,0,0.55)');
  across.addColorStop(0.50, 'rgba(0,0,0,1)');
  across.addColorStop(0.68, 'rgba(0,0,0,0.55)');
  across.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);
}, 128, 32);

/**
 * The mark left ON the fighter: the card's own outline, drawn in Void light.
 *
 * This is the part that says BORROWED. The card keeps its art and its badges
 * and simply gains an edge that is not its own — which is a different picture
 * from possess.js (a card-shaped slab of BLACK laid over a fighter) and from
 * thread.js (a woven mat covering one), and cannot be confused with either.
 * Drawn as a rounded rectangle stroked three times, wide and faint down to
 * narrow and hot, because one stroke of one width is a drawn border and light
 * on an edge has a falloff either side of it.
 */
const rimTex = () => tex('vl-rim', (g, W, H) => {
  const pass = (inset, width, alpha, blur) => {
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = width;
    g.beginPath();
    g.roundRect(inset, inset, W - inset * 2, H - inset * 2, 16);
    g.stroke();
  };
  pass(W * 0.235, W * 0.060, 0.17, W * 0.022);
  pass(W * 0.235, W * 0.024, 0.46, W * 0.008);
  pass(W * 0.235, W * 0.009, 1.0, W * 0.0025);
  g.filter = 'none';
}, 256, 256);

/**
 * The hem: dark drawn INWARD from the card's own border, nothing in the
 * middle.
 *
 * Darkening the STONE around the fighter turned out to be nearly worthless
 * here, and it is worth saying why because it is not obvious and it cost two
 * shots. A near-black pool at 0.8 opacity — proven to be drawing at all by
 * painting it red — barely changed the square, because the grass tufts and
 * the ivy that grow over every flagstone stand ABOVE any height a flat decal
 * can use without also climbing onto the cards. They stay lit, and the eye
 * goes on reading the square as lit. A card face has no greenery on it. So
 * the shadow this motif buys its contrast with is laid on the CARD, as a hem:
 * alpha 0 through the middle, so the art and the badges are untouched, rising
 * to a band of dark at the border for the violet rim to burn against.
 */
const hemTex = () => tex('vl-hem', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.52);
  grd.addColorStop(0.00, 'rgba(4,1,14,0)');
  grd.addColorStop(0.50, 'rgba(4,1,14,0)');
  grd.addColorStop(0.74, 'rgba(4,1,14,0.44)');
  grd.addColorStop(0.92, 'rgba(4,1,14,0.82)');
  grd.addColorStop(1.00, 'rgba(4,1,14,0.88)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 256, 256);

/** A soft annulus for the wash on the stone around the fighter's square. */
const washTex = () => tex('vl-wash', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.42, 'rgba(255,255,255,0.22)');
  grd.addColorStop(0.60, 'rgba(255,255,255,1)');
  grd.addColorStop(0.78, 'rgba(255,255,255,0.28)');
  grd.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 256, 256);

/**
 * The shade the fighter stands in while it is linked: a plateau that survives
 * out past the card's corners and only then falls away.
 *
 * NOT a blobTexture — the kit's blob is a straight ramp from centre to edge
 * and the card covers the middle of it, so all that ever shows is the outer
 * half at alpha 0.4 and under, which at sixty pixels is no darker at all.
 * voidstep paid three shots to learn this.
 */
const poolTex = () => tex('vl-pool', (g, W, H) => {
  const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grd.addColorStop(0.00, 'rgba(3,0,10,0.92)');
  grd.addColorStop(0.46, 'rgba(3,0,10,0.88)');
  grd.addColorStop(0.62, 'rgba(6,1,18,0.64)');
  grd.addColorStop(0.80, 'rgba(9,3,26,0.28)');
  grd.addColorStop(1.00, 'rgba(12,5,34,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}, 256, 256);

/* ------------------------------------------------------------- the ribbon */

/** A strip of quads whose spine and uvs are rewritten every frame. */
function ribbon(segs) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(segs * 2 * 2), 2));
  const idx = [];
  for (let i = 0; i < segs - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  return geo;
}

/* ------------------------------------------------------------------ time */

// kit.hold hands the tick a FRACTION of the span, so every moment below is a
// fraction and SPAN is the only number in seconds.
const SPAN = 2.0;
const WAKE = 0.04;      // the pit stirs
const REACH0 = 0.07;    // the cord is spun out of the throat
const REACH1 = 0.36;    // and reaches the fighter
const GRIP = 0.36;      // it takes hold
// Three beads, because three is the most fighters that can plausibly be
// standing in The Void and one bead is a spark rather than a supply.
const BEADS = [0.40, 0.50, 0.60];
const BEAD_RUN = 0.19;
// The cord is drawn in through the card. This was 0.90 and the whole ending
// happened in under two tenths of a second — it never appeared in a shot and
// in motion it read as the cord being switched off, which is the one thing
// the ending must not say. The last bead lands at 0.79, so there is a beat of
// the link simply HOLDING before the tail comes off the pit.
const TAKE = 0.82;
const REPEAT_LEN = 1.05; // world units per turn of the ply

const flat = (m) => { m.rotation.x = -Math.PI / 2; return m; };

/** A flat quad on the ground or on a card. */
function decal(map, w, h, extra = {}) {
  return flat(new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, ...extra,
    }),
  ));
}

export function voidlink(kit, at, faction) {
  const p = kit.at(at);
  if (!p) return;
  // The pit is asked of the BOARD, not of `kit.at(9)`. kit.at resolves a
  // piece before a square and uids start at 1, so uid 9 — an ordinary card
  // eight plays into a game — would answer instead of the Void and the cord
  // would run to whichever fighter happened to hold that number.
  const pit = squareToWorld(VOID_SQUARE);

  /* ------------------------------------------------------------ the span */

  // Where the cord is anchored at each end. The pit end is held ABOVE the
  // throat rather than in it: the Void is a legal square and there is very
  // often a card lying on it, and a cord that started at 0.1 spent the whole
  // motif underneath that card.
  const A = new THREE.Vector3(pit.x, 0.52, pit.z);
  const B = new THREE.Vector3(p.x, FACE + 0.055, p.z);
  const flatRun = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
  let reach = flatRun.length();
  // Black Aurox and Living Stronghold can both sit close to the pit, and a
  // span of nothing collapses every rib of the ribbon onto one point.
  if (reach < 1.8) {
    A.set(pit.x - 1.7, 0.52, pit.z - 0.9);
    flatRun.set(B.x - A.x, 0, B.z - A.z);
    reach = Math.max(1.2, flatRun.length());
  }
  const dir = flatRun.clone().divideScalar(reach);
  // Bowed AWAY from the camera, which is the opposite of what voidstep does
  // and for a reason worth writing down. This span runs left-right across the
  // screen, so its perpendicular is very nearly the screen's vertical: a bow
  // toward the near side pushes the middle DOWN the picture and cancels the
  // arch almost exactly, which is what the first cut did — 1.45 units of lift
  // and 0.72 of near-side bow came out as a cord lying flat on the cards.
  // Thrown the other way the two add, and the span climbs.
  //
  // It is kept SMALL, though, and the height does the work instead. At 0.62
  // the arch was handsome and the cord passed over the bare stone between the
  // rows, where "high in the air" and "lying on the back row" look identical;
  // held near the straight line it crosses the middle row's cards and drops
  // its shade on them, and there is then nothing else the picture can mean.
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  if (side.z > 0) side.negate();
  const BOW = Math.min(0.30, reach * 0.035);
  // How high the arch goes. This is the whole difference between a link and a
  // stain on the flagstones — height costs about 26 pixels a world unit, so a
  // metre of arch is a finger's breadth of daylight over the cards it crosses,
  // and at 0.4 there was none and the cord looked painted on the board.
  const LIFT = Math.min(1.70, 0.50 + reach * 0.155);

  const path = (u, out) => {
    const k = Math.min(1, Math.max(0, u));
    out.set(A.x + (B.x - A.x) * k, 0, A.z + (B.z - A.z) * k)
      .addScaledVector(side, Math.sin(Math.PI * k) * BOW);
    // Up out of the throat fast, over, and a steep dive onto the fighter. The
    // ^0.85 skews the crown toward the pit, which is what makes the arrival
    // read as something coming DOWN on the card rather than as the far half
    // of a rainbow.
    out.y = A.y + (B.y - A.y) * k + Math.sin(Math.PI * k ** 0.85) * LIFT;
    return out;
  };

  const g = new THREE.Group();
  const SEGS = 56;

  /* ---------------------------------------------------------- the ground */

  // The shade under the span. Sits at stone height, so every card it crosses
  // covers it — which is correct, the cord is above them and its shadow is
  // not — and that occlusion is itself a depth cue.
  const shadeGeo = ribbon(SEGS);
  const shade = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({
    map: shadeTex(), color: 0x06021a, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  shade.frustumCulled = false;
  shade.renderOrder = 3;
  g.add(shade);

  /* ------------------------------------------------------------ the cord */

  const haloGeo = ribbon(SEGS);
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
    map: haloTex(), color: VIOLET, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  g.add(halo);

  const cordGeo = ribbon(SEGS);
  const cord = new THREE.Mesh(cordGeo, new THREE.MeshBasicMaterial({
    map: cordTex(), color: CORD, transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  cord.frustumCulled = false;
  cord.renderOrder = 5;
  g.add(cord);

  const beads = BEADS.map(() => {
    const geo = ribbon(14);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: beadTex(), color: THROAT, transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    m.frustumCulled = false;
    m.renderOrder = 6;
    // And a lamp at its nose. The ribbon alone — half again the cord's width
    // and additive — read as a lighter STRETCH of rope rather than as a thing
    // travelling down it, because it is the same shape as what it rides on. A
    // sprite is round, sticks out past the selvedge on both sides and is
    // camera-facing, so it is unmistakably an object on the line. renderOrder
    // is set by hand: a sprite defaults to 0 and is painted over by the
    // decals on the card at the far end.
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blobTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'),
      color: THROAT, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    lamp.renderOrder = 6;
    g.add(m, lamp);
    return { geo, mesh: m, lamp };
  });

  /* -------------------------------------------------------- the pit's end */

  // The Void answering. It is OUTSIDE the board's spotlight, so without its
  // own light there is nothing out there to see the cord leave from.
  // blobTexture is (INNER, OUTER); written the other way round the quad's
  // corners take the last stop and what appears is a bright SQUARE.
  const mouth = decal(blobTexture('rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'),
    5.2, 5.2, { blending: THREE.AdditiveBlending, color: VIOLET });
  mouth.position.set(pit.x, 0.055, pit.z);
  mouth.renderOrder = 2;
  g.add(mouth);

  /* ------------------------------------------------------ the fighter's end */

  // THE STONE GOES DARK FIRST. The first cut lit the square with a violet
  // wash and darkened it with a pool at the same time, and the two cancelled:
  // the square came out a flat mauve with no edge anywhere in it. Contrast is
  // bought with shadow here — the stones around the fighter lose their light
  // and only the card's own edge burns, which is what makes a sixty-pixel
  // card read as WEARING something.
  const pool = decal(poolTex(), CARD_W * 2.5, CARD_W * 2.5);
  pool.position.set(p.x, STONE, p.z);
  pool.renderOrder = 1;
  g.add(pool);

  const wash = decal(washTex(), CARD_W * 1.95, CARD_W * 1.95,
    { blending: THREE.AdditiveBlending, color: VIOLET });
  wash.position.set(p.x, STONE + 0.006, p.z);
  wash.renderOrder = 2;
  g.add(wash);

  const hem = decal(hemTex(), CARD_W * 1.02, CARD_H * 1.02);
  hem.position.set(p.x, ON_CARD, p.z);
  hem.renderOrder = 7;
  g.add(hem);

  // The rim is the one thing in this motif that is allowed to sit on the card
  // face, and it has to clear it by 0.055 or the depth test drops it onto the
  // stone AROUND the card and the fighter is left with a halo it is standing
  // in the middle of.
  const rim = decal(rimTex(), CARD_W * 1.70, CARD_H * 1.70,
    { blending: THREE.AdditiveBlending, color: VIOLET });
  rim.position.set(p.x, ON_CARD + 0.01, p.z);
  rim.renderOrder = 8;
  g.add(rim);

  // Where the cord bites. A cord that simply stopped somewhere over the card
  // read as a line that had been cut off; this is the knot it ends in, and it
  // is what the beads visibly go into.
  const knot = decal(blobTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'),
    0.85, 0.85, { blending: THREE.AdditiveBlending, color: THROAT });
  knot.renderOrder = 7;
  g.add(knot);

  // The flash each bead makes as it goes in. Small and quick: three of these
  // at full size would be three explosions on a card that is not exploding.
  const take = decal(blobTexture('rgba(255,255,255,0.8)', 'rgba(255,255,255,0)'),
    CARD_W * 1.7, CARD_W * 1.7, { blending: THREE.AdditiveBlending, color: THROAT });
  take.position.set(p.x, ON_CARD + 0.014, p.z);
  take.renderOrder = 9;
  g.add(take);

  /* --------------------------------------------------------------- laying */

  const head = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const next = new THREE.Vector3();
  const upv = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const sid = new THREE.Vector3();

  /**
   * Lay a ribbon down the span from u0 to u1.
   *
   * `drop` flattens it onto the stones, which is how the shade band is drawn
   * from the same spine as the cord without a second path. `uvScale` of 0
   * stretches one copy of the map over the whole strip (the shade, the halo,
   * a bead); anything else repeats it by WORLD LENGTH, so the ply stands
   * still in the world while the cord grows past it.
   */
  const lay = (geo, u0, u1, hw, { drop = false, uvScale = 0, scroll = 0, taper = null } = {}) => {
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv.array;
    const n = pos.length / 6;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const u = u0 + (u1 - u0) * k;
      path(u, head);
      path(Math.max(0, u - 0.008), prev);
      path(Math.min(1, u + 0.008), next);
      tan.copy(next).sub(prev);
      sid.copy(tan).cross(upv);
      if (sid.lengthSq() < 1e-9) sid.set(0, 0, 1);
      sid.normalize();
      const w = hw * (taper ? taper(k) : 1);
      const y = drop ? SHADE_Y : head.y;
      pos[i * 6 + 0] = head.x - sid.x * w; pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = head.z - sid.z * w;
      pos[i * 6 + 3] = head.x + sid.x * w; pos[i * 6 + 4] = y;
      pos[i * 6 + 5] = head.z + sid.z * w;
      const uu = uvScale ? u * reach * uvScale - scroll : k;
      uv[i * 4 + 0] = uu; uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = uu; uv[i * 4 + 3] = 1;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
  };

  // A rounded nose, and barely any tail taper WHILE THE TAIL IS IN THE PIT —
  // thinning an anchored end made the cord look like it was coming from
  // nowhere. Once the tail comes off the pit and runs up the span it has to
  // taper away instead, or the cord ends in a blunt cut edge sliding along
  // itself, which reads as clipping rather than as something being drawn in.
  let pinch = 0;
  const nose = (k) => Math.min(1, (1 - k) / 0.05) ** 0.5
    * Math.min(1, k / (0.03 + 0.28 * pinch) + 0.6 * (1 - pinch));

  kit.hold(g, SPAN, (t) => {
    /* --- the pit stirs, holds while it is feeding, and lets go last. */
    const woke = easeOut(Math.min(1, Math.max(0, (t - WAKE) / 0.14)));
    const closed = easeIn(Math.min(1, Math.max(0, (t - TAKE) / 0.15)));
    mouth.material.opacity = 0.44 * woke * (1 - closed);
    mouth.scale.setScalar(0.50 + 0.52 * woke);

    /* --- the cord.
       Its TAIL stays in the throat for the whole of the feeding — this is a
       supply line and both ends of it have to be somewhere. Only at the end
       does the tail come off the pit and run up the span into the card. */
    const grow = Math.min(1, Math.max(0, (t - REACH0) / (REACH1 - REACH0)));
    // Off the mark quickly and slowing in: the cord is CAST, and a linear run
    // over eight units looked like a progress bar filling.
    const uHead = grow * 0.35 + easeOut(grow) * 0.65;
    const pull = Math.min(1, Math.max(0, (t - TAKE) / 0.14)) ** 1.6;
    pinch = pull;
    const uTail = pull;
    const alive = Math.min(1, grow * 7) * (1 - pull * 0.15);
    if (uHead > 0.001 && uTail < 0.995) {
      // The ply scrolls toward the fighter the whole time, so the cord is
      // running in even between beads. Slowest while it is still being spun
      // out; a fast scroll on a growing cord reads as the map sliding rather
      // than as the rope turning.
      const scroll = t * SPAN * (0.35 + 0.75 * Math.min(1, grow)) / REPEAT_LEN;
      const thin = 1 - 0.45 * pull;
      lay(cordGeo, uTail, uHead, 0.185 * thin,
        { uvScale: 1 / REPEAT_LEN, scroll, taper: nose });
      lay(haloGeo, uTail, uHead, 0.36 * thin, { taper: nose });
      lay(shadeGeo, uTail, uHead, 0.58, { drop: true, taper: nose });
      cord.material.opacity = alive;
      halo.material.opacity = 0.22 * alive;
      shade.material.opacity = 0.74 * alive;
    } else {
      cord.material.opacity = 0;
      halo.material.opacity = 0;
      shade.material.opacity = 0;
    }

    /* --- the beads. Each one runs the whole span and is gone into the card;
       they are spaced so that there is always one somewhere on the rope
       between the grip and the end, which is what makes the link read as
       FEEDING rather than as a thing that fired once. */
    let arrived = 0;
    let flash = 0;
    for (let i = 0; i < beads.length; i++) {
      const b = beads[i];
      const k = (t - BEADS[i]) / BEAD_RUN;
      if (k <= 0 || k > 1.18) {
        b.mesh.material.opacity = 0; b.lamp.material.opacity = 0; continue;
      }
      const u = Math.min(1, k * 0.55 + easeIn(Math.min(1, k)) * 0.45);
      // A bead has to be clearly FATTER than the cord it rides or it is just
      // a lighter stretch of rope: at 0.20 against a 0.185 cord it could not
      // be found in a frame at all.
      const tailU = Math.max(uTail, u - 0.20);
      lay(b.geo, tailU, u, 0.30);
      // dies into the card rather than at it
      const fade = k > 1 ? 1 - Math.min(1, (k - 1) / 0.18) : Math.min(1, k * 8);
      b.mesh.material.opacity = 0.95 * fade;
      path(u, head);
      b.lamp.position.copy(head);
      b.lamp.material.opacity = 0.62 * fade;
      b.lamp.scale.setScalar(0.78 + 0.18 * Math.sin(t * SPAN * 9 + i));
      if (k >= 1) { arrived = Math.max(arrived, i + 1); }
      if (k > 0.94) flash = Math.max(flash, 1 - Math.min(1, Math.abs(k - 1.0) / 0.14));
    }
    // how much has been taken on: it steps with each bead, so the fighter is
    // visibly gaining something three times over
    const loadTarget = (arrived + (t >= GRIP ? 1 : 0)) / (beads.length + 1);
    const load = Math.min(1, loadTarget);

    /* --- what the fighter wears. The shade under it and the wash around it
       come up with the grip; the rim on the card face steps with the beads
       and is the LAST thing to go, because the ability does not leave when
       the cord does. */
    const held = easeOut(Math.min(1, Math.max(0, (t - GRIP + 0.04) / 0.16)));
    const out = 1 - easeIn(Math.min(1, Math.max(0, (t - 0.93) / 0.07)));
    pool.material.opacity = 0.82 * held * out;
    pool.scale.setScalar(0.66 + 0.36 * held);
    wash.material.opacity = (0.06 + 0.13 * load) * held * out;
    wash.scale.setScalar(0.80 + 0.24 * held + 0.05 * Math.sin(t * SPAN * 6.0));
    hem.material.opacity = (0.34 + 0.46 * load) * held * out;
    rim.material.opacity = (0.30 + 0.52 * load) * held * out;
    rim.scale.setScalar(1 + 0.02 * (1 - held));
    // the knot rides the cord's own head, so while the cord is still being
    // spun out it is the nose of it and afterwards it sits on the fighter
    path(Math.max(uTail, uHead), head);
    knot.position.set(head.x, Math.max(ON_CARD + 0.006, head.y), head.z);
    knot.material.opacity = (0.30 + 0.34 * flash + 0.30 * pull) * Math.min(1, grow * 3)
      * out;
    knot.scale.setScalar(0.65 + 0.45 * flash + 0.06 * Math.sin(t * SPAN * 7.3));
    take.material.opacity = 0.42 * flash * out;
    take.scale.setScalar(0.55 + 0.5 * flash);
  });

  /* ----------------------------------------------------------- the lights */

  // Two, both LOW and both short. The Void is outside the board's spotlight
  // and needs a breath of its own when the cord leaves it; the card needs one
  // when the cord lands, and hung high it bleached the card face out.
  kit.after(REACH0 * SPAN, () => {
    kit.light(new THREE.Vector3(pit.x, 0.45, pit.z), VIOLET,
      { power: 15, seconds: 0.45, reach: 6 });
  });
  kit.after(GRIP * SPAN, () => {
    kit.light(new THREE.Vector3(p.x, FACE + 0.30, p.z), VIOLET,
      { power: 6.5, seconds: 0.40, reach: 3.0 });
  });
}

/**
 * Nothing this motif touches leaves the board — every card that plays it is a
 * constant ability on a fighter that stays exactly where it is — so there is
 * no kill wait to declare and no exit to own.
 */
export const timing = { kill: 0 };
